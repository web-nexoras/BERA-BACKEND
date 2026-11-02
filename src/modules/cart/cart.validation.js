'use strict';

/**
 * @file cart.validation.js
 * @description Zod validation schemas for cart endpoints.
 */

const { z } = require('zod');

// ---------------------------------------------------------------------------
// Reusable helpers
// ---------------------------------------------------------------------------

/** Validates a MongoDB ObjectId string */
const objectId = z
  .string({ required_error: 'ID is required' })
  .length(24, 'Must be a valid 24-character ObjectId')
  .regex(/^[a-f\d]{24}$/i, 'Must be a valid ObjectId');

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Schema for adding an item to the cart.
 * POST /api/v1/cart/items
 */
const addToCartSchema = z.object({
  productId: objectId,
  variantId: objectId,
  quantity: z
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be an integer')
    .positive('Quantity must be a positive integer')
    .max(100, 'Maximum quantity per item is 100'),
});

/**
 * Schema for updating the quantity of an existing cart item.
 * PUT /api/v1/cart/items/:variantId
 */
const updateCartItemSchema = z.object({
  quantity: z
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be an integer')
    .positive('Quantity must be a positive integer')
    .max(100, 'Maximum quantity per item is 100'),
});

/**
 * Schema for applying a coupon to the cart.
 * POST /api/v1/cart/coupon
 */
const applyCouponSchema = z.object({
  code: z
    .string({ required_error: 'Coupon code is required' })
    .trim()
    .min(1, 'Coupon code cannot be empty')
    .max(50, 'Coupon code is too long')
    .toUpperCase(),
});

/**
 * Schema for params when removing an item or updating by variantId.
 * DELETE /api/v1/cart/items/:variantId
 */
const removeCartItemSchema = z.object({
  variantId: objectId,
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = {
  addToCartSchema,
  updateCartItemSchema,
  applyCouponSchema,
  removeCartItemSchema,
};
