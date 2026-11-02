'use strict';

/**
 * @file inventory.validation.js
 * @description Zod validation schemas for inventory management endpoints.
 */

const { z } = require('zod');

// ---------------------------------------------------------------------------
// Reusable primitives
// ---------------------------------------------------------------------------

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format');

const INVENTORY_TYPES = ['purchase', 'sale', 'adjustment', 'return', 'damaged', 'initial'];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Schema for manually adjusting stock for a variant.
 */
const adjustStockSchema = z.object({
  variantId: objectIdSchema,

  quantity: z.coerce
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be an integer')
    .refine((v) => v !== 0, { message: 'Quantity cannot be zero' }),

  type: z.enum(INVENTORY_TYPES, {
    errorMap: () => ({
      message: `Type must be one of: ${INVENTORY_TYPES.join(', ')}`,
    }),
  }),

  reference: z
    .string()
    .trim()
    .max(200, 'Reference must be at most 200 characters')
    .optional()
    .default(''),

  notes: z
    .string()
    .trim()
    .max(500, 'Notes must be at most 500 characters')
    .optional()
    .default(''),
});

/**
 * Schema for paginated inventory query parameters.
 */
const inventoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),

  /** Filter: 'low_stock' | 'out_of_stock' | 'in_stock' */
  stockStatus: z.enum(['low_stock', 'out_of_stock', 'in_stock']).optional(),

  product: objectIdSchema.optional(),
  category: objectIdSchema.optional(),
  brand: objectIdSchema.optional(),

  sort: z
    .enum(['stock_asc', 'stock_desc', 'updated_at', 'sku'])
    .optional()
    .default('stock_asc'),
});

/**
 * Schema for stock history query parameters.
 */
const stockHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),

  type: z.enum(INVENTORY_TYPES).optional(),

  startDate: z
    .string()
    .datetime({ message: 'startDate must be a valid ISO 8601 date' })
    .optional(),
  endDate: z
    .string()
    .datetime({ message: 'endDate must be a valid ISO 8601 date' })
    .optional(),
});

/**
 * Schema for validating the variantId route param.
 */
const variantIdParamSchema = z.object({
  variantId: objectIdSchema,
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
module.exports = {
  adjustStockSchema,
  inventoryQuerySchema,
  stockHistoryQuerySchema,
  variantIdParamSchema,
};
