'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const cartService = require('./cart.service');
const { successResponse } = require('../../utils/apiResponse');
const { StatusCodes } = require('http-status-codes');

const uid = (req) => (req.user ? req.user._id || req.user.id : null);
const sid = (req) => req.sessionId;

const getCart = asyncHandler(async (req, res) => {
  const data = await cartService.getCart(uid(req), sid(req));
  return successResponse(res, 'Cart retrieved successfully', data);
});

const addToCart = asyncHandler(async (req, res) => {
  const data = await cartService.addToCart(uid(req), sid(req), req.body);
  return successResponse(res, 'Item added to cart', data, StatusCodes.CREATED);
});

const updateCartItem = asyncHandler(async (req, res) => {
  const data = await cartService.updateCartItem(uid(req), sid(req), req.params.variantId, req.body.quantity);
  return successResponse(res, 'Cart updated successfully', data);
});

const removeCartItem = asyncHandler(async (req, res) => {
  const data = await cartService.removeCartItem(uid(req), sid(req), req.params.variantId);
  return successResponse(res, 'Item removed from cart', data);
});

const clearCart = asyncHandler(async (req, res) => {
  await cartService.clearCart(uid(req), sid(req));
  return successResponse(res, 'Cart cleared successfully');
});

const applyCoupon = asyncHandler(async (req, res) => {
  const data = await cartService.applyCoupon(uid(req), sid(req), req.body.code);
  return successResponse(res, 'Coupon applied successfully', data);
});

const removeCoupon = asyncHandler(async (req, res) => {
  const data = await cartService.removeCoupon(uid(req), sid(req));
  return successResponse(res, 'Coupon removed', data);
});

const getCartSummary = asyncHandler(async (req, res) => {
  const summary = await cartService.getCartSummary(uid(req), sid(req));
  return successResponse(res, 'Cart summary', summary);
});

const mergeCart = asyncHandler(async (req, res) => {
  const data = await cartService.mergeCart(uid(req), req.body.sessionId || sid(req));
  return successResponse(res, 'Cart merged', data);
});

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, clearCart, applyCoupon, removeCoupon, getCartSummary, mergeCart };