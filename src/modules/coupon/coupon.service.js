'use strict';

const { StatusCodes } = require('http-status-codes');
const Coupon = require('./coupon.model');
const Order = require('../order/order.model');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { calculatePagination, getSkip } = require('../../utils/helpers');

async function getCoupons(query = {}) {
  const page = parseInt(query.page) || 1;
  const limit = Math.min(parseInt(query.limit) || 20, 100);
  const skip = getSkip(page, limit);

  const filter = {};
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';

  const [coupons, total] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Coupon.countDocuments(filter),
  ]);

  return { coupons, pagination: calculatePagination(page, limit, total) };
}

async function getCouponById(id) {
  const coupon = await Coupon.findById(id).lean();
  if (!coupon) throw new AppError('Coupon not found', StatusCodes.NOT_FOUND);
  return coupon;
}

async function createCoupon(data) {
  const existing = await Coupon.findOne({ code: data.code.toUpperCase() });
  if (existing) throw new AppError('Coupon code already exists', StatusCodes.CONFLICT);
  const coupon = await Coupon.create({ ...data, code: data.code.toUpperCase() });
  logger.info('Coupon created', { code: coupon.code });
  return coupon;
}

async function updateCoupon(id, data) {
  const coupon = await Coupon.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!coupon) throw new AppError('Coupon not found', StatusCodes.NOT_FOUND);
  return coupon;
}

async function deleteCoupon(id) {
  const coupon = await Coupon.findById(id);
  if (!coupon) throw new AppError('Coupon not found', StatusCodes.NOT_FOUND);
  if (coupon.usedCount > 0) throw new AppError('Cannot delete a coupon that has been used', StatusCodes.BAD_REQUEST);
  await Coupon.findByIdAndDelete(id);
}

async function validateCoupon(code, userId, orderAmount) {
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (!coupon) throw new AppError('Invalid or inactive coupon code', StatusCodes.BAD_REQUEST);
  if (coupon.expiresAt < new Date()) throw new AppError('This coupon has expired', StatusCodes.BAD_REQUEST);
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError('Coupon usage limit has been reached', StatusCodes.BAD_REQUEST);
  }
  if (coupon.usedBy.some((id) => id.toString() === userId)) {
    throw new AppError('You have already used this coupon', StatusCodes.BAD_REQUEST);
  }
  if (orderAmount < (coupon.minimumOrderAmount || 0)) {
    throw new AppError(`Minimum order amount for this coupon is ৳${coupon.minimumOrderAmount}`, StatusCodes.BAD_REQUEST);
  }
  if (coupon.isFirstOrderOnly) {
    const existingOrder = await Order.findOne({ user: userId, orderStatus: { $ne: 'cancelled' } });
    if (existingOrder) throw new AppError('This coupon is valid for first orders only', StatusCodes.BAD_REQUEST);
  }

  let discountAmount = coupon.type === 'percentage' ? (orderAmount * coupon.value) / 100 : coupon.value;
  if (coupon.maximumDiscount) discountAmount = Math.min(discountAmount, coupon.maximumDiscount);

  return { coupon, discountAmount: Math.round(discountAmount) };
}

async function markCouponUsed(couponId, userId) {
  await Coupon.findByIdAndUpdate(couponId, { $inc: { usedCount: 1 }, $addToSet: { usedBy: userId } });
}

module.exports = { getCoupons, getCouponById, createCoupon, updateCoupon, deleteCoupon, validateCoupon, markCouponUsed };
