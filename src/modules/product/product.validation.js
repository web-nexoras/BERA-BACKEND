'use strict';

const { z } = require('zod');

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format');

const positiveNumber = z.coerce
  .number({ invalid_type_error: 'Must be a number' })
  .nonnegative('Value cannot be negative');

const createProductSchema = z.object({
  name: z
    .string({ required_error: 'Product name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(200, 'Name must be at most 200 characters'),

  description: z
    .string({ required_error: 'Description is required' })
    .trim()
    .min(10, 'Description must be at least 10 characters'),

  shortDescription: z
    .string()
    .trim()
    .max(500, 'Short description must be at most 500 characters')
    .optional()
    .default(''),

  sku: z
    .string({ required_error: 'SKU is required' })
    .trim()
    .min(2, 'SKU must be at least 2 characters')
    .max(50, 'SKU must be at most 50 characters')
    .toUpperCase(),

  category: objectIdSchema,

  brand: objectIdSchema.optional().nullable(),

  tags: z.array(z.string().trim().min(1)).optional().default([]),

  isFeatured: z.boolean().optional().default(false),
  isNewArrival: z.boolean().optional().default(false),
  isBestSeller: z.boolean().optional().default(false),

  basePrice: positiveNumber.refine((v) => v >= 0, 'Base price must be a positive number'),

  scheduledPublishAt: z
    .string()
    .datetime({ message: 'scheduledPublishAt must be a valid ISO 8601 date' })
    .optional()
    .nullable(),

  status: z
    .enum(['draft', 'active', 'inactive', 'out_of_stock'])
    .optional()
    .default('draft'),
});

const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const variantSchema = z.object({
  size: z.string().trim().optional().default(''),
  color: z.string().trim().optional().default(''),
  colorCode: z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Color code must be a valid hex color')
    .optional()
    .or(z.literal(''))
    .default(''),

  sku: z
    .string({ required_error: 'Variant SKU is required' })
    .trim()
    .min(2, 'SKU must be at least 2 characters')
    .toUpperCase(),

  price: positiveNumber,
  regularPrice: positiveNumber,
  costPrice: positiveNumber.optional().default(0),

  stock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
  lowStockThreshold: z.coerce.number().int().min(0).optional().default(5),

  weight: z.coerce.number().min(0).optional().default(0),
});

const addVariantsSchema = z.object({
  variants: z
    .array(variantSchema)
    .min(1, 'At least one variant is required')
    .max(50, 'Cannot add more than 50 variants at once'),
});

const updateVariantSchema = variantSchema
  .omit({ sku: true })
  .extend({
    sku: z.string().trim().min(2).toUpperCase().optional(),
    isActive: z.boolean().optional(),
  })
  .partial();

const productQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),

  category: objectIdSchema.optional(),
  brand: objectIdSchema.optional(),

  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),

  size: z.string().trim().optional(),
  color: z.string().trim().optional(),

  search: z.string().trim().max(200).optional(),

  sort: z
    .enum([
      'price_asc',
      'price_desc',
      'newest',
      'oldest',
      'rating',
      'popular',
      'name_asc',
      'name_desc',
    ])
    .optional()
    .default('newest'),

  isFeatured: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  isNewArrival: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  isBestSeller: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  inStock: z
    .string()
    .transform((v) => v === 'true')
    .optional(),

  status: z.enum(['draft', 'active', 'inactive', 'out_of_stock']).optional(),
});

const productIdSchema = z.object({
  id: objectIdSchema,
});

const productVariantParamsSchema = z.object({
  id: objectIdSchema,
  variantId: objectIdSchema,
});

const productImageParamsSchema = z.object({
  id: objectIdSchema,
  imageId: objectIdSchema,
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  variantSchema,
  addVariantsSchema,
  updateVariantSchema,
  productQuerySchema,
  productIdSchema,
  productVariantParamsSchema,
  productImageParamsSchema,
};
