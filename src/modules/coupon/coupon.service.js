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
  const existing = await Coupon.findById(id);
  if (!existing) throw new AppError('Coupon not found', StatusCodes.NOT_FOUND);
  const resultingType = data.type || existing.type;
  const resultingValue = data.value ?? existing.value;
  if (resultingType === 'percentage' && resultingValue > 100) {
    throw new AppError('Percentage value cannot exceed 100', StatusCodes.BAD_REQUEST);
  }
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

function calculateDiscount(coupon, items = [], cartSubtotal = 0) {
  const productIds = (coupon.applicableProducts || []).map(String);
  const categoryIds = (coupon.applicableCategories || []).map(String);
  const hasProductFilter = productIds.length > 0;
  const hasCategoryFilter = categoryIds.length > 0;
  const eligibleItems = items.filter((item) => {
    if (!hasProductFilter && !hasCategoryFilter) return true;
    const product = item.product && typeof item.product === 'object' ? item.product : null;
    const productId = String(product?._id || item.product || '');
    const categoryId = String(product?.category || '');
    return (hasProductFilter && productIds.includes(productId)) || (hasCategoryFilter && categoryIds.includes(categoryId));
  });
  const eligibleSubtotal = items.length
    ? eligibleItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
    : Number(cartSubtotal || 0);
  if (eligibleSubtotal <= 0) return 0;

  let discount = coupon.type === 'percentage'
    ? (eligibleSubtotal * coupon.value) / 100
    : Number(coupon.value);
  if (coupon.maximumDiscount) discount = Math.min(discount, coupon.maximumDiscount);
  return Math.min(eligibleSubtotal, Math.round(discount));
}

async function validateCoupon(code, userId, orderAmount, items = []) {
  if (!userId) throw new AppError('Log in to use coupons.', StatusCodes.FORBIDDEN);
  const normalizedUserId = String(userId);
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (!coupon) throw new AppError('Invalid or inactive coupon code', StatusCodes.BAD_REQUEST);
  if (coupon.expiresAt < new Date()) throw new AppError('This coupon has expired', StatusCodes.BAD_REQUEST);
  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError('Coupon usage limit has been reached', StatusCodes.BAD_REQUEST);
  }
  if (coupon.usedBy.some((id) => String(id) === normalizedUserId)) {
    throw new AppError('You have already used this coupon', StatusCodes.BAD_REQUEST);
  }
  if (orderAmount < (coupon.minimumOrderAmount || 0)) {
    throw new AppError(`Minimum order amount for this coupon is à§³${coupon.minimumOrderAmount}`, StatusCodes.BAD_REQUEST);
  }
  if (coupon.isFirstOrderOnly) {
    const existingOrder = await Order.findOne({ user: userId, orderStatus: { $ne: 'cancelled' } });
    if (existingOrder) throw new AppError('This coupon is valid for first orders only', StatusCodes.BAD_REQUEST);
  }

  const discountAmount = calculateDiscount(coupon, items, orderAmount);
  if (discountAmount <= 0) throw new AppError('This coupon does not apply to the items in your cart.', StatusCodes.BAD_REQUEST);
  return { coupon, discountAmount };
}

async function markCouponUsed(couponId, userId, session) {
  if (!userId) throw new AppError('Log in to use coupons.', StatusCodes.FORBIDDEN);
  return Coupon.findOneAndUpdate(
    {
      _id: couponId,
      $or: [
        { usageLimit: null },
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
      ],
      usedBy: { $ne: userId },
    },
    { $inc: { usedCount: 1 }, $addToSet: { usedBy: userId } },
    { session, new: true },
  );
}
module.exports = { getCoupons, getCouponById, createCoupon, updateCoupon, deleteCoupon, validateCoupon, markCouponUsed, calculateDiscount };
