'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const wishlistService = require('./wishlist.service');
const { successResponse } = require('../../utils/apiResponse');

const getWishlist = asyncHandler(async (req, res) =>
  successResponse(res, 'Wishlist retrieved', await wishlistService.getWishlist(req.user.id)));

const addToWishlist = asyncHandler(async (req, res) =>
  successResponse(res, 'Added to wishlist', await wishlistService.addToWishlist(req.user.id, req.body.productId)));

const removeFromWishlist = asyncHandler(async (req, res) =>
  successResponse(res, 'Removed from wishlist', await wishlistService.removeFromWishlist(req.user.id, req.params.productId)));

const moveToCart = asyncHandler(async (req, res) =>
  successResponse(res, 'Moved to cart', await wishlistService.moveToCart(req.user.id, req.params.productId, req.body.variantId, req.body.quantity)));

const clearWishlist = asyncHandler(async (req, res) => {
  await wishlistService.clearWishlist(req.user.id);
  return successResponse(res, 'Wishlist cleared');
});

module.exports = { getWishlist, addToWishlist, removeFromWishlist, moveToCart, clearWishlist };
