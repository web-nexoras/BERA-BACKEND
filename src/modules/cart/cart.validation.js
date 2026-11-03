'use strict';

const { z } = require('zod');

const objectId = z
  .string({ required_error: 'ID is required' })
  .length(24, 'Must be a valid 24-character ObjectId')
  .regex(/^[a-f\d]{24}$/i, 'Must be a valid ObjectId');

const addToCartSchema = z.object({
  productId: objectId,
  variantId: objectId,
  quantity: z
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be an integer')
    .positive('Quantity must be a positive integer')
    .max(100, 'Maximum quantity per item is 100'),
});

const updateCartItemSchema = z.object({
  quantity: z
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be an integer')
    .positive('Quantity must be a positive integer')
    .max(100, 'Maximum quantity per item is 100'),
});

const applyCouponSchema = z.object({
  code: z
    .string({ required_error: 'Coupon code is required' })
    .trim()
    .min(1, 'Coupon code cannot be empty')
    .max(50, 'Coupon code is too long')
    .toUpperCase(),
});

const removeCartItemSchema = z.object({
  variantId: objectId,
});

module.exports = {
  addToCartSchema,
  updateCartItemSchema,
  applyCouponSchema,
  removeCartItemSchema,
};
