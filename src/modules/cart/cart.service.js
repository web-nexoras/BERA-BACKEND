'use strict';

/**
 * @file cart.service.js
 */

const { StatusCodes } = require('http-status-codes');
const Cart = require('./cart.model');
const Product = require('../product/product.model');
const ProductVariant = require('../variant/variant.model');
const Coupon = require('../coupon/coupon.model');
const AppError = require('../../utils/AppError');
const env = require('../../config/env');

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId })
    .populate('items.product', 'name images isActive isDeleted')
    .populate('items.variant', 'size color price stock isActive');
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

async function getCart(userId) {
  const cart = await getOrCreateCart(userId);
  return { cart, totals: cart.getTotals() };
}

async function addToCart(userId, { productId, variantId, quantity }) {
  const product = await Product.findOne({ _id: productId, isDeleted: false, status: 'active' });
  if (!product) throw new AppError('Product not found or unavailable', StatusCodes.NOT_FOUND);

  const variant = await ProductVariant.findOne({ _id: variantId, product: productId, isActive: true });
  if (!variant) throw new AppError('Variant not found', StatusCodes.NOT_FOUND);

  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });

  const existingIndex = cart.items.findIndex((i) => i.variant.toString() === variantId);

  if (existingIndex >= 0) {
    const newQty = cart.items[existingIndex].quantity + quantity;
    if (newQty > variant.stock) {
      throw new AppError(`Only ${variant.stock} units available in stock`, StatusCodes.CONFLICT);
    }
    cart.items[existingIndex].quantity = newQty;
  } else {
    if (quantity > variant.stock) {
      throw new AppError(`Only ${variant.stock} units available in stock`, StatusCodes.CONFLICT);
    }
    const mainImage = product.images.find((i) => i.isMain) || product.images[0];
    cart.items.push({
      product: productId,
      variant: variantId,
      quantity,
      price: variant.price,
      name: product.name,
      image: mainImage ? mainImage.url : '',
      size: variant.size || '',
      color: variant.color || '',
    });
  }

  await cart.save();
  return { cart, totals: cart.getTotals() };
}

async function updateCartItem(userId, variantId, quantity) {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new AppError('Cart not found', StatusCodes.NOT_FOUND);

  const idx = cart.items.findIndex((i) => i.variant.toString() === variantId);
  if (idx === -1) throw new AppError('Item not in cart', StatusCodes.NOT_FOUND);

  const variant = await ProductVariant.findById(variantId);
  if (!variant) throw new AppError('Variant not found', StatusCodes.NOT_FOUND);
  if (quantity > variant.stock) {
    throw new AppError(`Only ${variant.stock} units available`, StatusCodes.CONFLICT);
  }

  cart.items[idx].quantity = quantity;
  await cart.save();
  return { cart, totals: cart.getTotals() };
}

async function removeCartItem(userId, variantId) {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new AppError('Cart not found', StatusCodes.NOT_FOUND);
  cart.items = cart.items.filter((i) => i.variant.toString() !== variantId);
  await cart.save();
  return { cart, totals: cart.getTotals() };
}

async function clearCart(userId) {
  await Cart.findOneAndUpdate({ user: userId }, { items: [], appliedCoupon: null });
}

async function applyCoupon(userId, code) {
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (!coupon) throw new AppError('Invalid or expired coupon', StatusCodes.BAD_REQUEST);
  if (coupon.expiresAt < new Date()) throw new AppError('Coupon has expired', StatusCodes.BAD_REQUEST);
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError('Coupon usage limit reached', StatusCodes.BAD_REQUEST);
  }

  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new AppError('Cart not found', StatusCodes.NOT_FOUND);

  const totals = cart.getTotals();
  if (totals.subtotal < (coupon.minimumOrderAmount || 0)) {
    throw new AppError(`Minimum order amount for this coupon is ৳${coupon.minimumOrderAmount}`, StatusCodes.BAD_REQUEST);
  }

  let discountAmount =
    coupon.type === 'percentage'
      ? (totals.subtotal * coupon.value) / 100
      : coupon.value;

  if (coupon.maximumDiscount) discountAmount = Math.min(discountAmount, coupon.maximumDiscount);

  cart.appliedCoupon = { code: coupon.code, discountAmount, couponId: coupon._id };
  await cart.save();
  return { cart, totals: cart.getTotals() };
}

async function removeCoupon(userId) {
  const cart = await Cart.findOneAndUpdate({ user: userId }, { appliedCoupon: null }, { new: true });
  return { cart, totals: cart.getTotals() };
}

async function getCartSummary(userId) {
  const cart = await getOrCreateCart(userId);
  const totals = cart.getTotals();
  // Estimate shipping
  const shippingEstimate = totals.itemCount > 0 ? env.SHIPPING_CHARGE_INSIDE_DHAKA : 0;
  return { ...totals, shippingEstimate };
}

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, clearCart, applyCoupon, removeCoupon, getCartSummary };
