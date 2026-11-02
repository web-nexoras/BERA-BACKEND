'use strict';

/**
 * @file return.service.js
 */

const { StatusCodes } = require('http-status-codes');
const Return = require('./return.model');
const Order = require('../order/order.model');
const AppError = require('../../utils/AppError');
const { calculatePagination, getSkip } = require('../../utils/helpers');

async function createReturnRequest(userId, { orderId, items }) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw new AppError('Order not found', StatusCodes.NOT_FOUND);
  if (order.orderStatus !== 'delivered') throw new AppError('Only delivered orders can be returned', StatusCodes.BAD_REQUEST);
  if (order.returnDeadline && new Date() > order.returnDeadline) {
    throw new AppError('Return window has expired (7 days after delivery)', StatusCodes.BAD_REQUEST);
  }

  const existing = await Return.findOne({ order: orderId, user: userId });
  if (existing) throw new AppError('A return request already exists for this order', StatusCodes.CONFLICT);

  const returnRequest = await Return.create({ order: orderId, user: userId, items });
  order.orderStatus = 'return_requested';
  order.statusHistory.push({ status: 'return_requested', note: 'Customer requested return', updatedAt: new Date() });
  await order.save();

  return returnRequest;
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
    Return.find(filter)
      .populate('order', 'orderNumber pricing')
      .populate('user', 'name email')
      .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Return.countDocuments(filter),
  ]);
  return { returns, pagination: calculatePagination(page, limit, total) };
}

async function updateReturnStatus(returnId, status, adminNotes, refundAmount) {
  const returnDoc = await Return.findByIdAndUpdate(
    returnId,
    { status, adminNotes, refundAmount },
    { new: true },
  );
  if (!returnDoc) throw new AppError('Return request not found', StatusCodes.NOT_FOUND);

  if (status === 'approved') {
    const order = await Order.findById(returnDoc.order);
    if (order) {
      order.orderStatus = 'returned';
      order.statusHistory.push({ status: 'returned', note: 'Return approved by admin', updatedAt: new Date() });
      await order.save();
    }
  }
  return returnDoc;
}

module.exports = { createReturnRequest, getMyReturns, getAllReturns, updateReturnStatus };
