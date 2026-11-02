'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const cartService = require('./cart.service');
const { successResponse } = require('../../utils/apiResponse');
const { StatusCodes } = require('http-status-codes');

const getCart = asyncHandler(async (req, res) => {
  const data = await cartService.getCart(req.user.id);
  return successResponse(res, 'Cart retrieved successfully', data);
});

const addToCart = asyncHandler(async (req, res) => {
  const data = await cartService.addToCart(req.user.id, req.body);
  return successResponse(res, 'Item added to cart', data, StatusCodes.CREATED);
});

const updateCartItem = asyncHandler(async (req, res) => {
  const data = await cartService.updateCartItem(req.user.id, req.params.variantId, req.body.quantity);
  return successResponse(res, 'Cart updated successfully', data);
});

const removeCartItem = asyncHandler(async (req, res) => {
  const data = await cartService.removeCartItem(req.user.id, req.params.variantId);
  return successResponse(res, 'Item removed from cart', data);
});

const clearCart = asyncHandler(async (req, res) => {
  await cartService.clearCart(req.user.id);
  return successResponse(res, 'Cart cleared successfully');
});

const applyCoupon = asyncHandler(async (req, res) => {
  const data = await cartService.applyCoupon(req.user.id, req.body.code);
  return successResponse(res, 'Coupon applied successfully', data);
});

const removeCoupon = asyncHandler(async (req, res) => {
  const data = await cartService.removeCoupon(req.user.id);
  return successResponse(res, 'Coupon removed', data);
});

const getCartSummary = asyncHandler(async (req, res) => {
  const summary = await cartService.getCartSummary(req.user.id);
  return successResponse(res, 'Cart summary', summary);
});

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, clearCart, applyCoupon, removeCoupon, getCartSummary };
