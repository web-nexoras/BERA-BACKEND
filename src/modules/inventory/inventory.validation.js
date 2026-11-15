'use strict';

const { z } = require('zod');

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format');

const INVENTORY_TYPES = ['purchase', 'sale', 'adjustment', 'return', 'damaged', 'initial'];

const adjustStockSchema = z.object({
  variantId: objectIdSchema,

  quantity: z.coerce
    .number({ error: 'Quantity is required' })
    .int('Quantity must be an integer')
    .positive('Quantity must be a positive integer'),

  type: z.enum(INVENTORY_TYPES, {
    error: (issue) => issue.input === undefined ? 'Movement type is required' : `Type must be one of: ${INVENTORY_TYPES.join(', ')}`,
  }),

  direction: z.enum(['increase', 'decrease']).optional(),

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
}).superRefine((data, ctx) => {
  if (data.type === 'adjustment' && !data.direction) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['direction'], message: 'Direction is required for adjustments' });
  }
  if (data.type !== 'adjustment' && data.direction) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['direction'], message: 'Direction is only used for adjustments' });
  }
});

const inventoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),

  stockStatus: z.enum(['low_stock', 'out_of_stock', 'in_stock']).optional(),

  product: objectIdSchema.optional(),
  category: objectIdSchema.optional(),
  brand: objectIdSchema.optional(),

  sort: z
    .enum(['stock_asc', 'stock_desc', 'updated_at', 'sku'])
    .optional()
    .default('stock_asc'),
});

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

const variantIdParamSchema = z.object({
  variantId: objectIdSchema,
});

module.exports = {
  adjustStockSchema,
  inventoryQuerySchema,
  stockHistoryQuerySchema,
  variantIdParamSchema,
};
