'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const couponService = require('./coupon.service');
const { successResponse, paginatedResponse } = require('../../utils/apiResponse');
const { StatusCodes } = require('http-status-codes');

const getCoupons = asyncHandler(async (req, res) => {
  const { coupons, pagination } = await couponService.getCoupons(req.query);
  return paginatedResponse(res, 'Coupons retrieved', coupons, pagination);
});

const getCouponById = asyncHandler(async (req, res) =>
  successResponse(res, 'Coupon retrieved', await couponService.getCouponById(req.params.id)));

const createCoupon = asyncHandler(async (req, res) =>
  successResponse(res, 'Coupon created', await couponService.createCoupon(req.body), StatusCodes.CREATED));

const updateCoupon = asyncHandler(async (req, res) =>
  successResponse(res, 'Coupon updated', await couponService.updateCoupon(req.params.id, req.body)));

const deleteCoupon = asyncHandler(async (req, res) => {
  await couponService.deleteCoupon(req.params.id);
  return successResponse(res, 'Coupon deleted');
});

const validateCoupon = asyncHandler(async (req, res) => {
  const { code, orderAmount } = req.body;
  const result = await couponService.validateCoupon(code, req.user.id, orderAmount);
  return successResponse(res, 'Coupon is valid', result);
});

module.exports = { getCoupons, getCouponById, createCoupon, updateCoupon, deleteCoupon, validateCoupon };
