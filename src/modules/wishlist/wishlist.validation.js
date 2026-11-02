'use strict';

/**
 * @file wishlist.validation.js
 * @description Zod validation schemas for wishlist endpoints.
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
 * Schema for adding a product to the wishlist.
 * POST /api/v1/wishlist/items
 */
const addToWishlistSchema = z.object({
  productId: objectId,
});

/**
 * Schema for route params that include a productId.
 * DELETE /api/v1/wishlist/items/:productId
 * POST   /api/v1/wishlist/items/:productId/move-to-cart
 */
const wishlistItemParamsSchema = z.object({
  productId: objectId,
});

/**
 * Schema for move-to-cart body.
 * POST /api/v1/wishlist/items/:productId/move-to-cart
 */
const moveToCartSchema = z.object({
  variantId: objectId,
  quantity: z
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be an integer')
    .positive('Quantity must be at least 1')
    .max(100, 'Maximum quantity is 100')
    .default(1),
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = {
  addToWishlistSchema,
  wishlistItemParamsSchema,
  moveToCartSchema,
};
