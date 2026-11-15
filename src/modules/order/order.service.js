'use strict';

const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const Order = require('./order.model');
const Payment = require('../payment/payment.model');
const Cart = require('../cart/cart.model');
const shippingService = require('../shipping/shipping.service');
const { reserveStock, releaseStock } = require('../inventory/inventory.service');
const { markCouponUsed, validateCoupon } = require('../coupon/coupon.service');
const emailService = require('../../services/email.service');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { calculatePagination, getSkip, sanitizePhoneNumber } = require('../../utils/helpers');

const ORDER_STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['return_requested'],
  return_requested: ['returned'],
  cancelled: [],
  returned: [],
};

function isDuplicateOrderNumberError(err) {
  return err?.code === 11000 && Boolean(
    err.keyPattern?.orderNumber || err.keyValue?.orderNumber || String(err.message).includes('orderNumber_1'),
  );
}

// Reserve stock and create the order atomically.
async function checkout(userId, sessionId, data) {
  const { shippingAddress, paymentMethod, couponCode, notes } = data;
  const Settings = require('../admin/settings.model');
  const settings = await Settings.getSettings();
  if (paymentMethod === 'cod' && !settings.codEnabled) {
    throw new AppError('Cash on delivery is currently unavailable.', StatusCodes.CONFLICT);
  }
  if (paymentMethod === 'sslcommerz' && !settings.sslcommerzEnabled) {
    throw new AppError('Online payment is currently unavailable.', StatusCodes.CONFLICT);
  }
  const normalizedPhone = sanitizePhoneNumber(shippingAddress.phone);
  if (!normalizedPhone) throw new AppError('Please provide a valid Bangladeshi phone number.', StatusCodes.BAD_REQUEST);
  shippingAddress.phone = normalizedPhone;

  const cartQuery = userId ? { user: userId } : { sessionId };
  const cart = await Cart.findOne(cartQuery)
    .populate('items.variant', 'price regularPrice stock sku size color product isActive')
    .populate('items.product', 'name images status isDeleted isActive category');

  if (!cart || cart.items.length === 0) throw new AppError('Your cart is empty', StatusCodes.BAD_REQUEST);

  for (const item of cart.items) {
    if (!item.product || item.product.status !== 'active' || item.product.isDeleted || item.product.isActive === false) {
      throw new AppError('A product in your cart is no longer available. Please update your cart.', StatusCodes.CONFLICT);
    }
    if (!item.variant || !item.variant.isActive || String(item.variant.product) !== String(item.product._id)) {
      throw new AppError('A product option in your cart is no longer available. Please update your cart.', StatusCodes.CONFLICT);
    }
    if (Number(item.price) !== Number(item.variant.price)) {
      throw new AppError('Prices changed, please review your cart.', StatusCodes.CONFLICT);
    }
    if (item.variant.stock < item.quantity) {
      throw new AppError('A cart item is no longer available in the requested quantity.', StatusCodes.CONFLICT);
    }
  }

  const checkoutItems = cart.items.map((item) => ({
    ...item.toObject(),
    price: item.variant.price,
  }));
  const subtotal = checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const { charge: shippingCharge } = await shippingService.getShippingCharge(shippingAddress.district);
  let discountAmount = 0;
  let couponId = null;
  if (couponCode) {
    const { coupon, discountAmount: disc } = await validateCoupon(couponCode, userId, subtotal, checkoutItems);
    discountAmount = disc;
    couponId = coupon._id;
  }
  const total = Math.max(0, subtotal + shippingCharge - discountAmount);
  const orderItems = checkoutItems.map((item) => {
    const mainImg = item.product.images?.find((i) => i.isMain) || item.product.images?.[0];
    const unitPrice = item.price;
    return {
      product: item.product._id, variant: item.variant._id, name: item.product.name,
      image: mainImg?.url || '', size: item.variant.size || '', color: item.variant.color || '',
      sku: item.variant.sku || '', quantity: item.quantity, price: unitPrice,
      totalPrice: unitPrice * item.quantity,
    };
  });

  const session = await mongoose.startSession();
  let order;
  let payment;
  try {
    let committed = false;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      order = undefined;
      payment = undefined;
      try {
        session.startTransaction();
        [order] = await Order.create([{
          user: userId || null,
          guestEmail: userId ? null : (shippingAddress.email || null),
          guestPhone: userId ? null : (shippingAddress.phone || null),
          items: orderItems,
          shippingAddress,
          pricing: { subtotal, shippingCharge, discountAmount, couponCode: couponCode || null, couponId: couponId || null, total },
          paymentMethod,
          paymentStatus: 'pending',
          orderStatus: paymentMethod === 'cod' ? 'confirmed' : 'pending',
          statusHistory: [{ status: paymentMethod === 'cod' ? 'confirmed' : 'pending', note: 'Order created', updatedAt: new Date() }],
          notes: notes || '',
        }], { session });

        for (const item of cart.items) {
          await reserveStock(String(item.variant._id), item.quantity, session, order.orderNumber);
        }

        [payment] = await Payment.create([{
          order: order._id, user: userId || null, method: paymentMethod, amount: total, status: 'pending',
        }], { session });

        if (couponId) {
          const used = await markCouponUsed(couponId, userId, session);
          if (!used) throw new AppError('This coupon is no longer available.', StatusCodes.CONFLICT);
        }
        await session.commitTransaction();
        committed = true;
        break;
      } catch (err) {
        if (session.inTransaction()) await session.abortTransaction();
        if (isDuplicateOrderNumberError(err) && attempt < 3) continue;
        throw err;
      }
    }
    if (!committed) throw new AppError('Could not create a unique order number.', StatusCodes.CONFLICT);
  } finally {
    await session.endSession();
  }

  const clearQuery = userId ? { user: userId } : { sessionId };
  await Cart.findOneAndUpdate(clearQuery, { items: [], appliedCoupon: null });

  try {
    if (userId) {
      const User = require('../auth/auth.model');
      const user = await User.findById(userId);
      await emailService.sendOrderConfirmationEmail(user, order);
    } else if (shippingAddress.email) {
      await emailService.sendOrderConfirmationEmail({ name: shippingAddress.recipientName, email: shippingAddress.email }, order);
    }
  } catch (e) {
    logger.error('Failed to send order confirmation email', { error: e.message });
  }

  logger.info('Order placed', { orderId: order._id, orderNumber: order.orderNumber, paymentMethod });
  let paymentUrl = null;
  let paymentInitFailed = false;
  if (paymentMethod === 'sslcommerz') {
    try {
      const paymentService = require('../payment/payment.service');
      let user;
      if (userId) {
        const User = require('../auth/auth.model');
        user = await User.findById(userId);
      } else {
        user = { name: shippingAddress.recipientName, email: shippingAddress.email, phone: shippingAddress.phone };
      }
      const initialized = await paymentService.initSSLCommerzPayment(order, user);
      paymentUrl = initialized.gatewayUrl;
      payment.transactionId = initialized.tranId;
    } catch (err) {
      paymentInitFailed = true;
      logger.error('SSLCommerz initialization failed after order commit; client can retry payment', { orderId: order._id, error: err.message });
    }
  }
  return { order, payment, paymentUrl, paymentInitFailed };
}

async function getOrders(userId, query = {}) {
  const page = parseInt(query.page) || 1;
  const limit = Math.min(parseInt(query.limit) || 10, 50);
  const skip = getSkip(page, limit);

  const filter = { user: userId };
  if (query.status) filter.orderStatus = query.status;

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);

  return { orders, pagination: calculatePagination(page, limit, total) };
}

async function getOrderById(userId, orderId) {
  const order = await Order.findOne({ _id: orderId, user: userId }).lean();
  if (!order) throw new AppError('Order not found', StatusCodes.NOT_FOUND);
  return order;
}

async function _cancelOrder(orderId, reason, updatedBy, userId = null) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const orderFilter = { _id: orderId };
    if (userId) orderFilter.user = userId;
    const currentOrder = await Order.findOne(orderFilter).session(session);
    if (!currentOrder) throw new AppError('Order not found', StatusCodes.NOT_FOUND);
    if (!ORDER_STATUS_TRANSITIONS[currentOrder.orderStatus]?.includes('cancelled')) {
      throw new AppError('This order cannot be cancelled at this stage', StatusCodes.BAD_REQUEST);
    }

    let paymentStatus = currentOrder.paymentStatus;
    const payment = await Payment.findOne({ order: orderId }).session(session);
    if (payment?.status === 'completed') {
      const refundPending = await Payment.findOneAndUpdate(
        { _id: payment._id, status: 'completed' },
        { $set: { refundStatus: 'pending' } },
        { session, new: true },
      );
      if (!refundPending) throw new AppError('Payment changed while cancelling order.', StatusCodes.CONFLICT);
      paymentStatus = 'paid';
    } else if (payment && ['pending', 'failed'].includes(payment.status)) {
      const cancelledPayment = await Payment.findOneAndUpdate(
        { _id: payment._id, status: payment.status },
        { $set: { status: 'cancelled' } },
        { session, new: true },
      );
      if (!cancelledPayment) throw new AppError('Payment changed while cancelling order.', StatusCodes.CONFLICT);
      paymentStatus = payment.status === 'failed' ? 'failed' : 'pending';
    } else if (payment?.status === 'refunded') {
      paymentStatus = 'refunded';
    }

    const cancelledOrder = await Order.findOneAndUpdate(
      { ...orderFilter, orderStatus: currentOrder.orderStatus },
      {
        $set: { orderStatus: 'cancelled', cancelReason: reason, paymentStatus },
        $push: { statusHistory: { status: 'cancelled', note: reason, updatedBy, updatedAt: new Date() } },
      },
      { session, new: true, runValidators: true },
    );
    if (!cancelledOrder) throw new AppError('Order status changed; refresh and try again.', StatusCodes.CONFLICT);

    for (const item of cancelledOrder.items) {
      await releaseStock(String(item.variant), item.quantity, session, cancelledOrder.orderNumber);
    }
    await session.commitTransaction();
    logger.info('Order cancelled', { orderId, userId, updatedBy, paymentStatus });
    return cancelledOrder;
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
}

async function cancelOrder(userId, orderId, reason) {
  return _cancelOrder(orderId, reason, userId, userId);
}

async function getAdminOrders(query = {}) {
  const page = parseInt(query.page) || 1;
  const limit = Math.min(parseInt(query.limit) || 20, 100);
  const skip = getSkip(page, limit);

  const filter = {};
  if (query.status) filter.orderStatus = query.status;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.search) filter.orderNumber = { $regex: query.search, $options: 'i' };
  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
    if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
  }

  const [orders, total] = await Promise.all([
    Order.find(filter).populate('user', 'name email phone').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);

  return { orders, pagination: calculatePagination(page, limit, total) };
}

async function updateOrderStatus(orderId, status, note, adminId) {
  if (status === 'cancelled') return _cancelOrder(orderId, note || 'Cancelled by admin', adminId);

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const currentOrder = await Order.findById(orderId).session(session);
    if (!currentOrder) throw new AppError('Order not found', StatusCodes.NOT_FOUND);
    if (!ORDER_STATUS_TRANSITIONS[currentOrder.orderStatus]?.includes(status)) {
      throw new AppError('Invalid order status transition: ' + currentOrder.orderStatus + ' -> ' + status, StatusCodes.BAD_REQUEST);
    }

    const now = new Date();
    const set = { orderStatus: status };
    if (status === 'delivered') {
      if (currentOrder.paymentMethod === 'cod') set.paymentStatus = 'paid';
      set['shipping.deliveredAt'] = now;
      set.returnDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    if (status === 'shipped') set['shipping.shippedAt'] = now;

    if (status === 'delivered' && currentOrder.paymentMethod === 'cod') {
      await Payment.findOneAndUpdate(
        { order: orderId, status: 'pending' },
        { $set: { status: 'completed', paidAt: now } },
        { session, new: true },
      );
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, orderStatus: currentOrder.orderStatus },
      { $set: set, $push: { statusHistory: { status, note: note || '', updatedBy: adminId, updatedAt: now } } },
      { session, new: true, runValidators: true },
    );
    if (!updatedOrder) throw new AppError('Order status changed; refresh and try again.', StatusCodes.CONFLICT);
    await session.commitTransaction();
    logger.info('Order status updated by admin', { orderId, status });
    return updatedOrder;
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
}

async function generateInvoice(orderId) {
  const order = await Order.findById(orderId).populate('user', 'name email phone').lean();
  if (!order) throw new AppError('Order not found', StatusCodes.NOT_FOUND);

  // Lazy-load to avoid a circular dependency.
  const settings = await Settings.getSettings();

  return {
    invoiceNumber: `INV-${order.orderNumber}`,
    generatedAt: new Date(),
    store: { name: settings.storeName, email: settings.storeEmail, phone: settings.storePhone, address: settings.storeAddress },
    customer: order.user,
    shippingAddress: order.shippingAddress,
    order: { orderNumber: order.orderNumber, date: order.createdAt, status: order.orderStatus, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus },
    items: order.items,
    pricing: order.pricing,
  };
}

async function trackOrder(orderNumber, phone, email) {
  const notFound = () => new AppError('Order not found', StatusCodes.NOT_FOUND);
  if (!orderNumber || (!phone && !email)) throw notFound();

  const order = await Order.findOne({ orderNumber }).populate('user', 'email').lean();
  if (!order) throw notFound();

  const suppliedCredentials = [];
  if (phone) {
    const suppliedPhone = sanitizePhoneNumber(String(phone));
    const storedPhone = sanitizePhoneNumber(order.shippingAddress?.phone || order.guestPhone);
    suppliedCredentials.push(Boolean(suppliedPhone && storedPhone && suppliedPhone === storedPhone));
  }
  if (email) {
    const suppliedEmail = String(email).trim().toLowerCase();
    const storedEmail = order.shippingAddress?.email || order.guestEmail || order.user?.email;
    suppliedCredentials.push(Boolean(storedEmail && suppliedEmail === String(storedEmail).trim().toLowerCase()));
  }
  if (!suppliedCredentials.length || suppliedCredentials.some((matches) => !matches)) throw notFound();

  const storedPhone = sanitizePhoneNumber(order.shippingAddress?.phone || order.guestPhone);
  const maskedPhone = storedPhone ? `${storedPhone.slice(0, 3)}****${storedPhone.slice(-4)}` : null;
  return {
    status: order.orderStatus,
    paymentStatus: order.paymentStatus,
    items: order.items.map(({ name, quantity, price, totalPrice }) => ({ name, quantity, price, totalPrice })),
    totals: {
      subtotal: order.pricing.subtotal,
      shippingCharge: order.pricing.shippingCharge,
      discountAmount: order.pricing.discountAmount,
      total: order.pricing.total,
    },
    phone: maskedPhone,
  };
}

module.exports = { checkout, getOrders, getOrderById, cancelOrder, getAdminOrders, updateOrderStatus, generateInvoice, trackOrder };
