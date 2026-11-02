'use strict';

const axios = require('axios');
const crypto = require('crypto');
const { StatusCodes } = require('http-status-codes');

const env = require('../../config/env');
const logger = require('../../utils/logger');
const AppError = require('../../utils/AppError');

// lazy-require models to avoid circular deps at startup
const getOrder = () => require('../order/order.model');
const getPayment = () => require('./payment.model');

const { sendOrderConfirmationEmail } = (() => {
  try { return require('../../services/email.service'); }
  catch { return { sendOrderConfirmationEmail: async () => {} }; }
})();

const SSL_SANDBOX_BASE = 'https://sandbox.sslcommerz.com';
const SSL_LIVE_BASE = 'https://securepay.sslcommerz.com';
const getSSLBase = () => env.SSLCOMMERZ_IS_LIVE ? SSL_LIVE_BASE : SSL_SANDBOX_BASE;

const md5 = (str) => crypto.createHash('md5').update(str).digest('hex');

const generateTranId = () => {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `NF-${Date.now()}-${rand}`;
};

// verify IPN hash to confirm notification authenticity
const verifyIPNHash = (ipnData) => {
  try {
    const { verify_sign, verify_key } = ipnData;
    if (!verify_sign || !verify_key) return false;
    const keys = verify_key.split(',');
    const parts = keys.map((k) => `${k}=${ipnData[k] ?? ''}`);
    parts.push(`store_passwd=${md5(env.SSLCOMMERZ_STORE_PASS)}`);
    return md5(parts.join('&')) === verify_sign;
  } catch (err) {
    logger.error('IPN hash verification error', { err: err.message });
    return false;
  }
};

// initiate SSLCommerz session and return gateway URL
const initSSLCommerzPayment = async (order, user) => {
  const Order = getOrder();
  const Payment = getPayment();

  const tranId = generateTranId();
  const baseUrl = getSSLBase();

  const payload = new URLSearchParams({
    store_id: env.SSLCOMMERZ_STORE_ID,
    store_passwd: env.SSLCOMMERZ_STORE_PASS,
    total_amount: order.pricing.total.toFixed(2),
    currency: 'BDT',
    tran_id: tranId,
    success_url: env.SSLCOMMERZ_SUCCESS_URL || `${env.APP_URL}/api/v1/payments/sslcommerz/success`,
    fail_url: env.SSLCOMMERZ_FAIL_URL || `${env.APP_URL}/api/v1/payments/sslcommerz/fail`,
    cancel_url: env.SSLCOMMERZ_CANCEL_URL || `${env.APP_URL}/api/v1/payments/sslcommerz/cancel`,
    ipn_url: env.SSLCOMMERZ_IPN_URL || `${env.APP_URL}/api/v1/payments/sslcommerz/ipn`,
    cus_name: user.name || 'Customer',
    cus_email: user.email,
    cus_add1: order.shippingAddress?.addressLine1 || 'N/A',
    cus_add2: order.shippingAddress?.addressLine2 || '',
    cus_city: order.shippingAddress?.city || 'Dhaka',
    cus_state: order.shippingAddress?.division || 'Dhaka',
    cus_postcode: order.shippingAddress?.postalCode || '1000',
    cus_country: 'Bangladesh',
    cus_phone: user.phone || '01700000000',
    ship_name: user.name || 'Customer',
    ship_add1: order.shippingAddress?.addressLine1 || 'N/A',
    ship_city: order.shippingAddress?.city || 'Dhaka',
    ship_state: order.shippingAddress?.division || 'Dhaka',
    ship_postcode: order.shippingAddress?.postalCode || '1000',
    ship_country: 'Bangladesh',
    shipping_method: 'Courier',
    num_of_item: String(order.items?.length || 1),
    product_name: 'Nexora Fashions Order',
    product_category: 'Fashion & Clothing',
    product_profile: 'general',
    product_amount: order.pricing.total.toFixed(2),
    value_a: String(order._id),
  });

  logger.info('Initiating SSLCommerz payment', { tranId, orderId: order._id });

  const response = await axios.post(
    `${baseUrl}/gwprocess/v4/api.php`,
    payload.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );

  const { data } = response;
  if (!data || data.status !== 'SUCCESS') {
    logger.error('SSLCommerz init failed', { data });
    throw new AppError('Payment gateway initialization failed. Please try again.', StatusCodes.BAD_GATEWAY);
  }

  await Payment.findOneAndUpdate(
    { order: order._id },
    { order: order._id, user: user._id, method: 'sslcommerz', amount: order.pricing.total, currency: 'BDT', status: 'pending', transactionId: tranId, gatewayResponse: { sessionkey: data.sessionkey } },
    { upsert: true, new: true },
  );

  await Order.findByIdAndUpdate(order._id, { 'shipping.trackingNumber': tranId });

  logger.info('SSLCommerz session created', { tranId, gatewayUrl: data.GatewayPageURL });
  return { gatewayUrl: data.GatewayPageURL, tranId };
};

// verify IPN/success callback, validate with SSLCommerz API, mark order paid
const verifySSLCommerzPayment = async (sslData) => {
  const Order = getOrder();
  const Payment = getPayment();
  const { tran_id, val_id, status } = sslData;

  logger.info('Verifying SSLCommerz payment', { tran_id, val_id, status });

  const payment = await Payment.findOne({ transactionId: tran_id });
  if (!payment) throw new AppError('Payment record not found for this transaction.', StatusCodes.NOT_FOUND);

  const order = await Order.findById(payment.order);
  if (!order) throw new AppError('Order not found.', StatusCodes.NOT_FOUND);

  // idempotent — skip if already processed
  if (payment.status === 'completed') {
    logger.info('Payment already verified — skipping duplicate IPN', { tran_id });
    return { order, payment };
  }

  const hashValid = verifyIPNHash(sslData);
  if (!hashValid) logger.warn('IPN hash verification failed — possible tampering', { tran_id });

  if (!['VALID', 'VALIDATED'].includes(status)) {
    await _markPaymentFailed(payment, order, sslData, 'Payment status invalid from SSLCommerz');
    return { order, payment };
  }

  // confirm with SSLCommerz validation API
  let validationResp;
  try {
    validationResp = await axios.get(`${getSSLBase()}/validator/api/validationserverAPI.php`, {
      params: { val_id, store_id: env.SSLCOMMERZ_STORE_ID, store_passwd: env.SSLCOMMERZ_STORE_PASS, v: 1, format: 'json' },
    });
  } catch (err) {
    logger.error('SSLCommerz validation API error', { err: err.message });
    throw new AppError('Could not validate payment with gateway.', StatusCodes.BAD_GATEWAY);
  }

  const validationData = validationResp.data;
  if (!validationData || !['VALID', 'VALIDATED'].includes(validationData.status)) {
    await _markPaymentFailed(payment, order, sslData, 'Gateway validation returned invalid status');
    return { order, payment };
  }

  // anti-fraud: amount must match
  const gatewayAmount = parseFloat(validationData.amount || 0);
  const orderAmount = parseFloat(order.pricing.total || 0);
  if (Math.abs(gatewayAmount - orderAmount) > 1) {
    logger.error('Payment amount mismatch', { gatewayAmount, orderAmount, tran_id });
    await _markPaymentFailed(payment, order, sslData, 'Amount mismatch detected');
    return { order, payment };
  }

  payment.status = 'completed';
  payment.paidAt = new Date();
  payment.gatewayResponse = validationData;
  await payment.save();

  order.paymentStatus = 'paid';
  order.orderStatus = 'confirmed';
  order.statusHistory.push({ status: 'confirmed', note: `Payment received via SSLCommerz. Val ID: ${val_id}`, updatedAt: new Date() });
  await order.save();

  try {
    const User = require('../auth/auth.model');
    const user = await User.findById(order.user);
    if (user?.email) await sendOrderConfirmationEmail(user, order);
  } catch (emailErr) {
    logger.error('Failed to send order confirmation email', { err: emailErr.message });
  }

  logger.info('SSLCommerz payment verified', { tran_id, orderId: order._id });
  return { order, payment };
};

const handleSSLCommerzFail = async (sslData) => {
  const { tran_id } = sslData;
  const payment = await getPayment().findOne({ transactionId: tran_id });
  if (!payment) { logger.warn('handleSSLCommerzFail: payment not found', { tran_id }); return { order: null, payment: null }; }
  const order = await getOrder().findById(payment.order);
  await _markPaymentFailed(payment, order, sslData, 'Payment failed at gateway');
  return { order, payment };
};

const handleSSLCommerzCancel = async (sslData) => {
  const { tran_id } = sslData;
  const payment = await getPayment().findOne({ transactionId: tran_id });
  if (!payment) { logger.warn('handleSSLCommerzCancel: payment not found', { tran_id }); return { order: null, payment: null }; }
  const order = await getOrder().findById(payment.order);
  await _markPaymentFailed(payment, order, sslData, 'Payment cancelled by customer');
  return { order, payment };
};

// COD: payment record is pending until collected on delivery
const confirmCODOrder = async (orderId) => {
  const Order = getOrder();
  const Payment = getPayment();

  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found.', StatusCodes.NOT_FOUND);
  if (order.paymentMethod !== 'cod') throw new AppError('Order is not a COD order.', StatusCodes.BAD_REQUEST);

  const payment = await Payment.findOneAndUpdate(
    { order: orderId },
    { order: orderId, user: order.user, method: 'cod', amount: order.pricing.total, currency: 'BDT', status: 'pending', transactionId: generateTranId() },
    { upsert: true, new: true },
  );

  order.paymentStatus = 'pending';
  order.orderStatus = 'confirmed';
  order.statusHistory.push({ status: 'confirmed', note: 'COD order confirmed. Payment to be collected on delivery.', updatedAt: new Date() });
  await order.save();

  logger.info('COD order confirmed', { orderId, tranId: payment.transactionId });
  return { order, payment };
};

const getPaymentByOrder = async (orderId) => getPayment().findOne({ order: orderId }).lean();

const getMyTransactions = async (userId, query) => {
  const Payment = getPayment();
  const { page = 1, limit = 10, status, method } = query;
  const skip = (page - 1) * limit;
  const filter = { user: userId };
  if (status) filter.status = status;
  if (method) filter.method = method;

  const [payments, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('order', 'orderNumber pricing orderStatus').lean(),
    Payment.countDocuments(filter),
  ]);

  return { payments, total, page, pages: Math.ceil(total / limit) };
};

const getAllTransactions = async (query) => {
  const Payment = getPayment();
  const { page = 1, limit = 10, status, method } = query;
  const skip = (page - 1) * limit;
  const filter = {};
  if (status) filter.status = status;
  if (method) filter.method = method;

  const [payments, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('order', 'orderNumber pricing orderStatus')
      .populate('user', 'name email phone')
      .lean(),
    Payment.countDocuments(filter),
  ]);

  return { payments, total, page, pages: Math.ceil(total / limit) };
};

const processRefund = async (orderId, amount, adminId) => {
  const Payment = getPayment();
  const Order = getOrder();

  const payment = await Payment.findOne({ order: orderId });
  if (!payment) throw new AppError('No payment found for this order.', StatusCodes.NOT_FOUND);
  if (payment.status !== 'completed') throw new AppError('Only completed payments can be refunded.', StatusCodes.BAD_REQUEST);

  const refundAmount = amount ?? payment.amount;
  if (refundAmount > payment.amount) throw new AppError('Refund amount exceeds paid amount.', StatusCodes.BAD_REQUEST);

  payment.status = 'refunded';
  payment.refundAmount = refundAmount;
  payment.refundedAt = new Date();
  await payment.save();

  await Order.findByIdAndUpdate(orderId, {
    paymentStatus: 'refunded',
    $push: { statusHistory: { status: 'refunded', note: `Refund of BDT ${refundAmount} processed.`, updatedAt: new Date(), updatedBy: adminId } },
  });

  logger.info('Refund processed', { orderId, refundAmount, adminId });
  return payment;
};

// internal helper — marks payment failed and updates order
const _markPaymentFailed = async (payment, order, sslData, reason) => {
  if (payment) {
    payment.status = 'failed';
    payment.gatewayResponse = { ...payment.gatewayResponse, ...sslData };
    await payment.save();
  }
  if (order && order.orderStatus === 'pending') {
    order.paymentStatus = 'failed';
    order.statusHistory.push({ status: 'pending', note: `Payment failed: ${reason}`, updatedAt: new Date() });
    await order.save();
  }
  logger.warn('Payment marked as failed', { tranId: sslData?.tran_id, reason });
};

module.exports = {
  initSSLCommerzPayment, verifySSLCommerzPayment,
  handleSSLCommerzFail, handleSSLCommerzCancel,
  confirmCODOrder, getPaymentByOrder, getMyTransactions, getAllTransactions, processRefund,
};
