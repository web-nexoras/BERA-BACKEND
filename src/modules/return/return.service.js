'use strict';

const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const Return = require('./return.model');
const Order = require('../order/order.model');
const ProductVariant = require('../variant/variant.model');
const InventoryLog = require('../inventory/inventory.model');
const AppError = require('../../utils/AppError');
const { calculatePagination, getSkip } = require('../../utils/helpers');

async function createReturnRequest(userId, { orderId, items }) {
  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, user: userId }).session(session);
      if (!order) throw new AppError('Order not found', StatusCodes.NOT_FOUND);
      if (order.orderStatus !== 'delivered') throw new AppError('Only delivered orders can be returned', StatusCodes.BAD_REQUEST);
      if (order.returnDeadline && new Date() > order.returnDeadline) {
        throw new AppError('Return window has expired (7 days after delivery)', StatusCodes.BAD_REQUEST);
      }
      const active = await Return.exists({ order: orderId, status: { $in: ['requested', 'approved'] } }).session(session);
      if (active) throw new AppError('An active return request already exists for this order', StatusCodes.CONFLICT);

      const snapshots = items.map((item) => {
        const orderItem = order.items.id(item.orderItemId);
        if (!orderItem) throw new AppError('A selected item does not belong to this order', StatusCodes.BAD_REQUEST);
        if (item.quantity < 1 || item.quantity > orderItem.quantity) {
          throw new AppError('Return quantity cannot exceed the purchased quantity', StatusCodes.BAD_REQUEST);
        }
        return {
          orderItemId: orderItem._id,
          orderItem: {
            product: orderItem.product,
            variant: orderItem.variant,
            name: orderItem.name,
            image: orderItem.image,
            size: orderItem.size,
            color: orderItem.color,
            sku: orderItem.sku,
            quantity: orderItem.quantity,
            price: orderItem.price,
            totalPrice: orderItem.totalPrice,
          },
          quantity: item.quantity,
          reason: item.reason,
        };
      });

      const moved = await Order.findOneAndUpdate(
        { _id: order._id, orderStatus: 'delivered' },
        {
          $set: { orderStatus: 'return_requested' },
          $push: { statusHistory: { status: 'return_requested', note: 'Customer requested return', updatedAt: new Date() } },
        },
        { session, new: true, runValidators: true },
      );
      if (!moved) throw new AppError('Order status changed; refresh and try again.', StatusCodes.CONFLICT);
      [created] = await Return.create([{ order: orderId, user: userId, items: snapshots }], { session });
    });
    return created;
  } catch (err) {
    if (err?.code === 11000) throw new AppError('An active return request already exists for this order', StatusCodes.CONFLICT);
    throw err;
  } finally {
    await session.endSession();
  }
}

async function getMyReturns(userId, query = {}) {
  const page = parseInt(query.page) || 1;
  const limit = 10;
  const skip = getSkip(page, limit);
  const [returns, total] = await Promise.all([
    Return.find({ user: userId }).populate('order', 'orderNumber pricing').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Return.countDocuments({ user: userId }),
  ]);
  return { returns, pagination: calculatePagination(page, limit, total) };
}

async function getAllReturns(query = {}) {
  const page = parseInt(query.page) || 1;
  const limit = 20;
  const skip = getSkip(page, limit);
  const filter = {};
  if (query.status) filter.status = query.status;
  const [returns, total] = await Promise.all([
    Return.find(filter).populate('order', 'orderNumber pricing').populate('user', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Return.countDocuments(filter),
  ]);
  return { returns, pagination: calculatePagination(page, limit, total) };
}

const ALLOWED_TRANSITIONS = {
  requested: ['approved', 'rejected'],
  approved: ['completed'],
  rejected: [],
  completed: [],
};

async function updateReturnStatus(returnId, { status, adminNotes, refundAmount, refundMethod }, adminId) {
  const session = await mongoose.startSession();
  let updated;
  let orderId;
  let shouldRefund = false;
  try {
    await session.withTransaction(async () => {
      const current = await Return.findById(returnId).session(session);
      if (!current) throw new AppError('Return request not found', StatusCodes.NOT_FOUND);
      if (!ALLOWED_TRANSITIONS[current.status]?.includes(status)) {
        throw new AppError(`Cannot transition return from ${current.status} to ${status}`, StatusCodes.CONFLICT);
      }
      const order = await Order.findById(current.order).session(session);
      if (!order) throw new AppError('Order not found', StatusCodes.NOT_FOUND);
      if (refundAmount !== undefined && refundAmount > order.pricing.total) {
        throw new AppError('Refund amount cannot exceed the order total', StatusCodes.BAD_REQUEST);
      }

      updated = await Return.findOneAndUpdate(
        { _id: current._id, status: current.status },
        { $set: {
          status,
          ...(adminNotes !== undefined ? { adminNotes } : {}),
          ...(refundAmount !== undefined ? { refundAmount } : {}),
          ...(refundMethod !== undefined ? { refundMethod } : {}),
        } },
        { session, new: true, runValidators: true },
      );
      if (!updated) throw new AppError('Return status changed; refresh and try again.', StatusCodes.CONFLICT);

      if (status === 'rejected') {
        const restored = await Order.findOneAndUpdate(
          { _id: order._id, orderStatus: 'return_requested' },
          { $set: { orderStatus: 'delivered' }, $push: { statusHistory: { status: 'delivered', note: 'Return request rejected', updatedBy: adminId, updatedAt: new Date() } } },
          { session, new: true, runValidators: true },
        );
        if (!restored) throw new AppError('Order status changed; refresh and try again.', StatusCodes.CONFLICT);
      } else if (status === 'approved' || status === 'completed') {
        const returnedOrder = await Order.findOneAndUpdate(
          { _id: order._id, orderStatus: status === 'approved' ? 'return_requested' : 'returned' },
          { $set: { orderStatus: 'returned' }, $push: { statusHistory: { status: 'returned', note: `Return ${status} by admin`, updatedBy: adminId, updatedAt: new Date() } } },
          { session, new: true, runValidators: true },
        );
        if (!returnedOrder) throw new AppError('Order status changed; refresh and try again.', StatusCodes.CONFLICT);
        if (!current.inventoryRestockedAt) {
          for (const item of current.items) {
            const variantId = item.orderItem.variant;
            const variant = await ProductVariant.findOneAndUpdate(
              { _id: variantId },
              { $inc: { stock: item.quantity } },
              { session, new: true, runValidators: true },
            );
            if (!variant) throw new AppError(`Variant ${item.orderItem.sku || variantId} no longer exists`, StatusCodes.CONFLICT);
            await InventoryLog.create([{
              product: item.orderItem.product,
              variant: variant._id,
              type: 'return',
              quantity: item.quantity,
              previousStock: variant.stock - item.quantity,
              newStock: variant.stock,
              reference: order.orderNumber,
              performedBy: adminId,
              notes: `Return ${current._id}`,
            }], { session });
          }
          updated.inventoryRestockedAt = new Date();
          await updated.save({ session, validateBeforeSave: true });
        }
      }
      orderId = current.order;
      shouldRefund = status === 'completed' && Number(updated.refundAmount || 0) > 0;
    });
  } finally {
    await session.endSession();
  }

  if (shouldRefund) {
    const paymentService = require('../payment/payment.service');
    await paymentService.processRefund(orderId, updated.refundAmount, adminId);
  }
  return updated;
}

module.exports = { createReturnRequest, getMyReturns, getAllReturns, updateReturnStatus };
