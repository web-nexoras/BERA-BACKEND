'use strict';

const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const Order = require('./order.model');
const Payment = require('../payment/payment.model');
const Cart = require('../cart/cart.model');
const ShippingZone = require('../shipping/shipping.model');
const { reserveStock, releaseStock } = require('../inventory/inventory.service');
const { markCouponUsed, validateCoupon } = require('../coupon/coupon.service');
const emailService = require('../../services/email.service');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { calculatePagination, getSkip } = require('../../utils/helpers');
const env = require('../../config/env');

async function getShippingCharge(district = '') {
  const zone = await ShippingZone.findOne({ districts: { $regex: district, $options: 'i' }, isActive: true });
  if (zone) return zone.charge;
  const isInsideDhaka = district.toLowerCase().includes('dhaka');
  return isInsideDhaka ? env.SHIPPING_CHARGE_INSIDE_DHAKA : env.SHIPPING_CHARGE_OUTSIDE_DHAKA;
}

// full checkout with MongoDB transaction for atomic stock reservation
async function checkout(userId, data) {
  const { shippingAddress, paymentMethod, couponCode, notes } = data;

  const cart = await Cart.findOne({ user: userId })
    .populate('items.variant', 'price regularPrice stock sku size color product')
    .populate('items.product', 'name images');

  if (!cart || cart.items.length === 0) throw new AppError('Your cart is empty', StatusCodes.BAD_REQUEST);

  const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCharge = await getShippingCharge(shippingAddress.district);

  let discountAmount = 0;
  let couponId = null;
  if (couponCode) {
    const { coupon, discountAmount: disc } = await validateCoupon(couponCode, userId, subtotal);
    discountAmount = disc;
    couponId = coupon._id;
  }

  const total = Math.max(0, subtotal + shippingCharge - discountAmount);

  const orderItems = cart.items.map((item) => {
    const mainImg = item.product.images?.find((i) => i.isMain) || item.product.images?.[0];
    return {
      product: item.product._id,
      variant: item.variant._id,
      name: item.product.name,
      image: mainImg?.url || '',
      size: item.variant.size || '',
      color: item.variant.color || '',
      sku: item.variant.sku || '',
      quantity: item.quantity,
      price: item.price,
      totalPrice: item.price * item.quantity,
    };
  });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const item of cart.items) {
      await reserveStock(item.variant._id.toString(), item.quantity, session);
    }

    const [order] = await Order.create(
      [{
        user: userId,
        items: orderItems,
        shippingAddress,
        pricing: { subtotal, shippingCharge, discountAmount, couponCode: couponCode || null, couponId: couponId || null, total },
        paymentMethod,
        paymentStatus: 'pending',
        orderStatus: paymentMethod === 'cod' ? 'confirmed' : 'pending',
        statusHistory: [{ status: paymentMethod === 'cod' ? 'confirmed' : 'pending', note: 'Order created', updatedAt: new Date() }],
        notes: notes || '',
      }],
      { session },
    );

    const [payment] = await Payment.create(
      [{ order: order._id, user: userId, method: paymentMethod, amount: total, status: 'pending' }],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    if (couponId) await markCouponUsed(couponId, userId);
    await Cart.findOneAndUpdate({ user: userId }, { items: [], appliedCoupon: null });

    // send confirmation email — non-blocking
    try {
      const User = require('../auth/auth.model');
      const user = await User.findById(userId);
      await emailService.sendOrderConfirmationEmail(user, order);
    } catch (e) {
      logger.error('Failed to send order confirmation email', { error: e.message });
    }

    logger.info('Order placed', { orderId: order._id, orderNumber: order.orderNumber, paymentMethod });

    let paymentUrl = null;
    if (paymentMethod === 'sslcommerz') {
      const paymentService = require('../payment/payment.service');
      const User = require('../auth/auth.model');
      const user = await User.findById(userId);
      paymentUrl = await paymentService.initSSLCommerzPayment(order, user, payment._id);
    }

    return { order, payment, paymentUrl };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
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

async function cancelOrder(userId, orderId, reason) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw new AppError('Order not found', StatusCodes.NOT_FOUND);
  if (!['pending', 'confirmed'].includes(order.orderStatus)) {
    throw new AppError('This order cannot be cancelled at this stage', StatusCodes.BAD_REQUEST);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    for (const item of order.items) {
      await releaseStock(item.variant.toString(), item.quantity, session);
    }
    order.orderStatus = 'cancelled';
    order.cancelReason = reason;
    order.statusHistory.push({ status: 'cancelled', note: reason, updatedAt: new Date() });
    await order.save({ session });
    await Payment.findOneAndUpdate({ order: orderId }, { status: 'cancelled' }, { session });
    await session.commitTransaction();
    session.endSession();
    logger.info('Order cancelled by customer', { orderId, userId });
    return order;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
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
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', StatusCodes.NOT_FOUND);

  order.orderStatus = status;
  order.statusHistory.push({ status, note: note || '', updatedBy: adminId, updatedAt: new Date() });

  if (status === 'delivered') {
    order.paymentStatus = order.paymentMethod === 'cod' ? 'paid' : order.paymentStatus;
    order.shipping.deliveredAt = new Date();
    order.returnDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (order.paymentMethod === 'cod') {
      await Payment.findOneAndUpdate({ order: orderId }, { status: 'completed', paidAt: new Date() });
    }
  }

  if (status === 'shipped') order.shipping.shippedAt = new Date();

  await order.save();
  logger.info('Order status updated by admin', { orderId, status });
  return order;
}

async function generateInvoice(orderId) {
  const order = await Order.findById(orderId).populate('user', 'name email phone').lean();
  if (!order) throw new AppError('Order not found', StatusCodes.NOT_FOUND);

  // lazy-require to avoid circular dep
  const Settings = require('../admin/settings.model');
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

module.exports = { checkout, getOrders, getOrderById, cancelOrder, getAdminOrders, updateOrderStatus, generateInvoice };
