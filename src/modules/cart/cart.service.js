'use strict';

const { StatusCodes } = require('http-status-codes');
const Cart = require('./cart.model');
const Product = require('../product/product.model');
const ProductVariant = require('../variant/variant.model');
const { validateCoupon } = require('../coupon/coupon.service');
const AppError = require('../../utils/AppError');
const env = require('../../config/env');

function ownerQuery(userId, sessionId) {
  if (userId) return { user: userId };
  return { sessionId };
}

async function getOrCreateCart(userId, sessionId) {
  let cart = await Cart.findOne(ownerQuery(userId, sessionId))
    .populate('items.product', 'name images isActive isDeleted status')
    .populate('items.variant', 'size color price stock isActive product');
  if (!cart) {
    cart = await Cart.create({ user: userId || null, sessionId: userId ? null : sessionId, items: [] });
  }
  return cart;
}

async function getCart(userId, sessionId) {
  const cart = await getOrCreateCart(userId, sessionId);
  const availableItems = [];
  let changed = false;

  for (const item of cart.items) {
    const product = item.product;
    const variant = item.variant;
    const available = product && product.status === 'active' && product.isActive !== false && !product.isDeleted
      && variant && variant.isActive && variant.stock >= item.quantity
      && String(variant.product) === String(product._id);
    if (!available) {
      changed = true;
      continue;
    }
    if (Number(item.price) !== Number(variant.price)) {
      item.price = variant.price;
      changed = true;
    }
    availableItems.push(item);
  }

  if (availableItems.length !== cart.items.length) cart.items = availableItems;
  if (changed) {
    cart.appliedCoupon = null;
    await cart.save();
  }
  return { cart, totals: cart.getTotals() };
}
async function addToCart(userId, sessionId, { productId, variantId, quantity }) {
  const product = await Product.findOne({ _id: productId, isDeleted: false, status: 'active' });
  if (!product) throw new AppError('Product not found or unavailable', StatusCodes.NOT_FOUND);

  const variant = await ProductVariant.findOne({ _id: variantId, product: productId, isActive: true });
  if (!variant) throw new AppError('Variant not found', StatusCodes.NOT_FOUND);

  let cart = await Cart.findOne(ownerQuery(userId, sessionId));
  if (!cart) cart = await Cart.create({ user: userId || null, sessionId: userId ? null : sessionId, items: [] });

  const existingIndex = cart.items.findIndex((i) => String(i.variant) === String(variantId));

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

async function updateCartItem(userId, sessionId, variantId, quantity) {
  const cart = await Cart.findOne(ownerQuery(userId, sessionId));
  if (!cart) throw new AppError('Cart not found', StatusCodes.NOT_FOUND);

  const idx = cart.items.findIndex((i) => String(i.variant) === String(variantId));
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

async function removeCartItem(userId, sessionId, variantId) {
  const cart = await Cart.findOne(ownerQuery(userId, sessionId));
  if (!cart) throw new AppError('Cart not found', StatusCodes.NOT_FOUND);
  cart.items = cart.items.filter((i) => String(i.variant) !== String(variantId));
  await cart.save();
  return { cart, totals: cart.getTotals() };
}

async function clearCart(userId, sessionId) {
  await Cart.findOneAndUpdate(ownerQuery(userId, sessionId), { items: [], appliedCoupon: null });
}

async function applyCoupon(userId, sessionId, code) {
  const cart = await Cart.findOne(ownerQuery(userId, sessionId)).populate('items.product', 'category');
  if (!cart) throw new AppError('Cart not found', StatusCodes.NOT_FOUND);
  const totals = cart.getTotals();
  const { coupon, discountAmount } = await validateCoupon(code, userId, totals.subtotal, cart.items);
  cart.appliedCoupon = { code: coupon.code, discountAmount, couponId: coupon._id };
  await cart.save();
  return { cart, totals: cart.getTotals() };
}

async function removeCoupon(userId, sessionId) {
  const cart = await Cart.findOneAndUpdate(ownerQuery(userId, sessionId), { appliedCoupon: null }, { new: true });
  if (!cart) throw new AppError('Cart not found', StatusCodes.NOT_FOUND);
  return { cart, totals: cart.getTotals() };
}

async function getCartSummary(userId, sessionId) {
  const cart = await getOrCreateCart(userId, sessionId);
  const totals = cart.getTotals();
  const shippingEstimate = totals.itemCount > 0 ? env.SHIPPING_CHARGE_INSIDE_DHAKA : 0;
  return { ...totals, shippingEstimate };
}

async function mergeCart(userId, sessionId) {
  if (!userId || !sessionId) return { merged: false };
  const guestCart = await Cart.findOne({ sessionId, user: null });
  if (!guestCart || guestCart.items.length === 0) return { merged: false };

  let userCart = await Cart.findOne({ user: userId });
  if (!userCart) userCart = await Cart.create({ user: userId, items: [] });

  for (const item of guestCart.items) {
    const idx = userCart.items.findIndex((i) => String(i.variant) === String(item.variant));
    if (idx >= 0) {
      userCart.items[idx].quantity += item.quantity;
    } else {
      userCart.items.push(item);
    }
  }
  if (guestCart.appliedCoupon && !userCart.appliedCoupon) {
    userCart.appliedCoupon = guestCart.appliedCoupon;
  }
  await userCart.save();
  await Cart.deleteOne({ _id: guestCart._id });
  return { merged: true };
}

module.exports = {
  getCart, addToCart, updateCartItem, removeCartItem, clearCart, applyCoupon, removeCoupon,
  getCartSummary, mergeCart,
};
