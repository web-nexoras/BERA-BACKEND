'use strict';

const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');

const env = require('../../config/env');
const logger = require('../../utils/logger');
const AppError = require('../../utils/AppError');
const { calculatePagination } = require('../../utils/helpers');

// Lazy-load models to avoid circular dependencies.
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

// Verify IPN signature.
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

// Create the payment session and return its gateway URL.
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
    { $set: { order: order._id, user: user._id, method: 'sslcommerz', amount: order.pricing.total, currency: 'BDT', status: 'pending', transactionId: tranId, gatewayResponse: { sessionkey: data.sessionkey } }, $unset: { valId: 1 } },
    { upsert: true, new: true },
  );

  await Order.findByIdAndUpdate(order._id, { 'shipping.trackingNumber': tranId });

  logger.info('SSLCommerz session created', { tranId, gatewayUrl: data.GatewayPageURL });
  return { gatewayUrl: data.GatewayPageURL, tranId };
};

const initiatePaymentForOrder = async (userId, orderId) => {
  const Order = getOrder();
  const order = await Order.findOne({
    _id: orderId, user: userId, paymentMethod: 'sslcommerz', orderStatus: 'pending',
    paymentStatus: { $in: ['pending', 'failed'] },
  });
  if (!order) throw new AppError('Eligible SSLCommerz order not found.', StatusCodes.NOT_FOUND);

  const User = require('../auth/auth.model');
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found.', StatusCodes.NOT_FOUND);
  return initSSLCommerzPayment(order, user);
};

// Validate SSLCommerz callbacks before marking paid.
const verifySSLCommerzPayment = async (sslData) => {
  const Order = getOrder();
  const Payment = getPayment();
  const { tran_id, val_id, status } = sslData;
  const result = (ok, order = null, payment = null, reason = null) => ({ ok, order, payment, reason });

  logger.info('Verifying SSLCommerz payment', { tran_id, val_id, status });
  const payment = await Payment.findOne({ transactionId: tran_id });
  if (!payment) return result(false, null, null, 'payment_not_found');

  let order = await Order.findById(payment.order);
  if (!order) return result(false, null, payment, 'order_not_found');
  if (payment.status === 'completed') return result(true, order, payment, 'already_completed');

  if (!verifyIPNHash(sslData)) {
    logger.warn('IPN hash verification failed � callback rejected', { tran_id });
    return result(false, order, payment, 'invalid_ipn_hash');
  }
  if (!['VALID', 'VALIDATED'].includes(status) || !val_id) {
    await _markPaymentFailed(payment, order, sslData, 'Payment status invalid from SSLCommerz');
    return result(false, order, payment, 'invalid_callback_status');
  }

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
  const validationCurrency = String(validationData?.currency_type || validationData?.currency || '').trim().toUpperCase();
  const suppliedCurrencies = [validationData?.currency_type, validationData?.currency].filter((value) => value != null && value !== '');
  const currencyValid = validationCurrency === 'BDT' && suppliedCurrencies.every((currency) => String(currency).trim().toUpperCase() === 'BDT');
  if (!validationData || !['VALID', 'VALIDATED'].includes(validationData.status)) {
    await _markPaymentFailed(payment, order, sslData, 'Gateway validation returned invalid status');
    return result(false, order, payment, 'invalid_gateway_status');
  }
  if (validationData.tran_id !== payment.transactionId) {
    await _markPaymentFailed(payment, order, sslData, 'Gateway transaction ID mismatch');
    return result(false, order, payment, 'transaction_id_mismatch');
  }
  if (!currencyValid) {
    await _markPaymentFailed(payment, order, sslData, 'Gateway currency mismatch');
    return result(false, order, payment, 'currency_mismatch');
  }

  const gatewayAmount = Number(validationData.amount);
  const orderAmount = Number(order.pricing.total);
  if (!Number.isFinite(gatewayAmount) || !Number.isFinite(orderAmount) || Math.round(gatewayAmount * 100) !== Math.round(orderAmount * 100)) {
    logger.error('Payment amount mismatch', { gatewayAmount, orderAmount, tran_id });
    await _markPaymentFailed(payment, order, sslData, 'Amount mismatch detected');
    return result(false, order, payment, 'amount_mismatch');
  }

  const alreadyUsed = await Payment.findOne({ valId: val_id, _id: { $ne: payment._id } });
  if (alreadyUsed) {
    logger.warn('SSLCommerz val_id already used by another payment', { tran_id, val_id, paymentId: payment._id });
    return result(false, order, payment, 'val_id_already_used');
  }

  const updatedPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, status: 'pending' },
    { $set: { status: 'completed', paidAt: new Date(), valId: val_id, gatewayResponse: validationData } },
    { new: true, runValidators: true },
  );
  if (!updatedPayment) {
    const currentPayment = await Payment.findById(payment._id);
    const currentOrder = await Order.findById(payment.order);
    return result(currentPayment?.status === 'completed', currentOrder, currentPayment, currentPayment?.status === 'completed' ? 'already_completed' : 'payment_not_pending');
  }

  payment.status = updatedPayment.status;
  payment.paidAt = updatedPayment.paidAt;
  payment.valId = updatedPayment.valId;
  payment.gatewayResponse = updatedPayment.gatewayResponse;
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
  return result(true, order, payment, null);
};

const handleSSLCommerzFail = async (sslData) => {
  const { tran_id } = sslData;
  const payment = await getPayment().findOne({ transactionId: tran_id });
  if (!payment) { logger.warn('handleSSLCommerzFail: payment not found', { tran_id }); return { ok: false, order: null, payment: null, reason: 'payment_not_found' }; }
  const order = await getOrder().findById(payment.order);
  if (payment.status === 'completed') return { ok: true, order, payment, reason: 'already_completed' };
  await _markPaymentFailed(payment, order, sslData, 'Payment failed at gateway');
  return { ok: false, order, payment, reason: 'payment_failed' };
};

const handleSSLCommerzCancel = async (sslData) => {
  const { tran_id } = sslData;
  const payment = await getPayment().findOne({ transactionId: tran_id });
  if (!payment) { logger.warn('handleSSLCommerzCancel: payment not found', { tran_id }); return { ok: false, order: null, payment: null, reason: 'payment_not_found' }; }
  const order = await getOrder().findById(payment.order);
  if (payment.status === 'completed') return { ok: true, order, payment, reason: 'already_completed' };
  await _markPaymentFailed(payment, order, sslData, 'Payment cancelled by customer');
  return { ok: false, order, payment, reason: 'payment_cancelled' };
};
// COD stays pending until delivery.
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
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const { status, method } = query;
  const skip = (page - 1) * limit;
  const filter = { user: userId };
  if (status) filter.status = status;
  if (method) filter.method = method;

  const [payments, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('order', 'orderNumber pricing orderStatus').lean(),
    Payment.countDocuments(filter),
  ]);

  return { payments, pagination: calculatePagination(page, limit, total) };
};

const getAllTransactions = async (query) => {
  const Payment = getPayment();
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const { status, method } = query;
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

  return { payments, pagination: calculatePagination(page, limit, total) };
};

const processRefund = async (orderId, amount, adminId) => {
  const Payment = getPayment();
  const Order = getOrder();
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const payment = await Payment.findOne({ order: orderId }).session(session);
    if (!payment) throw new AppError('No payment found for this order.', StatusCodes.NOT_FOUND);
    if (payment.status !== 'completed') throw new AppError('Only completed payments can be refunded.', StatusCodes.BAD_REQUEST);

    const previousRefundAmount = Number(payment.refundAmount || 0);
    const remainingAmount = Number((payment.amount - previousRefundAmount).toFixed(2));
    const refundAmount = amount == null ? remainingAmount : Number(amount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      throw new AppError('Refund amount must be greater than zero.', StatusCodes.BAD_REQUEST);
    }
    if (refundAmount > remainingAmount) throw new AppError('Refund amount exceeds remaining paid amount.', StatusCodes.BAD_REQUEST);

    const totalRefundAmount = Number((previousRefundAmount + refundAmount).toFixed(2));
    const fullyRefunded = totalRefundAmount >= Number(payment.amount);
    const updatedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: 'completed', refundAmount: previousRefundAmount },
      {
        $set: {
          refundAmount: totalRefundAmount,
          refundedAt: fullyRefunded ? new Date() : payment.refundedAt,
          refundStatus: fullyRefunded ? 'refunded' : 'partial',
          status: fullyRefunded ? 'refunded' : 'completed',
        },
      },
      { session, new: true, runValidators: true },
    );
    if (!updatedPayment) throw new AppError('Payment changed while processing the refund.', StatusCodes.CONFLICT);

    const order = await Order.findOneAndUpdate(
      { _id: orderId },
      {
        $set: { paymentStatus: fullyRefunded ? 'refunded' : 'partial_refund' },
        $push: {
          statusHistory: {
            status: fullyRefunded ? 'refunded' : 'partial_refund',
            note: 'Refund of BDT ' + refundAmount + ' processed.',
            updatedAt: new Date(),
            updatedBy: adminId,
          },
        },
      },
      { session, new: true },
    );
    if (!order) throw new AppError('Order not found.', StatusCodes.NOT_FOUND);

    await session.commitTransaction();
    logger.info('Refund processed', { orderId, refundAmount, totalRefundAmount, adminId });
    return updatedPayment;
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
};

// Mark payment failed and update the order.
const _markPaymentFailed = async (payment, order, sslData, reason) => {
  let markedFailed = false;
  if (payment) {
    const updated = await getPayment().findOneAndUpdate(
      { _id: payment._id, status: 'pending' },
      { $set: { status: 'failed', gatewayResponse: { ...(payment.gatewayResponse || {}), ...sslData } } },
      { new: true, runValidators: true },
    );
    if (updated) {
      markedFailed = true;
      payment.status = updated.status;
      payment.gatewayResponse = updated.gatewayResponse;
    }
  }
  if (markedFailed && order && order.orderStatus === 'pending') {
    order.paymentStatus = 'failed';
    order.statusHistory.push({ status: 'pending', note: `Payment failed: ${reason}`, updatedAt: new Date() });
    await order.save();
  }
  if (markedFailed) logger.warn('Payment marked as failed', { tranId: sslData?.tran_id, reason });
  return markedFailed;
};
module.exports = {
  initSSLCommerzPayment, initiatePaymentForOrder, verifySSLCommerzPayment,
  handleSSLCommerzFail, handleSSLCommerzCancel,
  confirmCODOrder, getPaymentByOrder, getMyTransactions, getAllTransactions, processRefund,
};
