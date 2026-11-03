'use strict';

const { StatusCodes } = require('http-status-codes');
const Wishlist = require('./wishlist.model');
const Product = require('../product/product.model');
const cartService = require('../cart/cart.service');
const AppError = require('../../utils/AppError');

async function getWishlist(userId) {
  let wishlist = await Wishlist.findOne({ user: userId })
    .populate('items.product', 'name images basePrice status isDeleted');
  if (!wishlist) wishlist = await Wishlist.create({ user: userId, items: [] });
  return wishlist;
}

async function addToWishlist(userId, productId) {
  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) throw new AppError('Product not found', StatusCodes.NOT_FOUND);

  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) wishlist = await Wishlist.create({ user: userId, items: [] });

  const exists = wishlist.items.some((i) => i.product.toString() === productId);
  if (!exists) {
    wishlist.items.push({ product: productId });
    await wishlist.save();
  }
  return wishlist;
}

async function removeFromWishlist(userId, productId) {
  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) throw new AppError('Wishlist not found', StatusCodes.NOT_FOUND);
  wishlist.items = wishlist.items.filter((i) => i.product.toString() !== productId);
  await wishlist.save();
  return wishlist;
}

async function moveToCart(userId, productId, variantId, quantity) {
  await removeFromWishlist(userId, productId);
  return cartService.addToCart(userId, { productId, variantId, quantity: quantity || 1 });
}

async function clearWishlist(userId) {
  await Wishlist.findOneAndUpdate({ user: userId }, { items: [] });
}

module.exports = { getWishlist, addToWishlist, removeFromWishlist, moveToCart, clearWishlist };
