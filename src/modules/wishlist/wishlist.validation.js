'use strict';

const { z } = require('zod');

const objectId = z
  .string({ required_error: 'ID is required' })
  .length(24, 'Must be a valid 24-character ObjectId')
  .regex(/^[a-f\d]{24}$/i, 'Must be a valid ObjectId');

const addToWishlistSchema = z.object({
  productId: objectId,
});

const wishlistItemParamsSchema = z.object({
  productId: objectId,
});

const moveToCartSchema = z.object({
  variantId: objectId,
  quantity: z
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be an integer')
    .positive('Quantity must be at least 1')
    .max(100, 'Maximum quantity is 100')
    .default(1),
});

module.exports = {
  addToWishlistSchema,
  wishlistItemParamsSchema,
  moveToCartSchema,
};
