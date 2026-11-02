'use strict';

/**
 * @file category.validation.js
 * @description Zod validation schemas for category endpoints.
 */

const { z } = require('zod');

// ---------------------------------------------------------------------------
// Reusable primitives
// ---------------------------------------------------------------------------

/** Validates a MongoDB ObjectId string (24-char hex) */
const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format');

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Schema for creating a new category.
 */
const createCategorySchema = z.object({
  name: z
    .string({ required_error: 'Category name is required' })
    .trim()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must be at most 100 characters'),

  description: z
    .string()
    .trim()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .default(''),

  image: z
    .string()
    .url('Image must be a valid URL')
    .optional()
    .or(z.literal(''))
    .default(''),

  parent: objectIdSchema.optional().nullable(),

  isActive: z.boolean().optional().default(true),

  sortOrder: z.number().int().min(0).optional().default(0),
});

/**
 * Schema for updating an existing category.
 * All fields are optional.
 */
const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must be at most 100 characters')
    .optional(),

  description: z
    .string()
    .trim()
    .max(1000, 'Description must be at most 1000 characters')
    .optional(),

  image: z
    .string()
    .url('Image must be a valid URL')
    .optional()
    .or(z.literal('')),

  parent: objectIdSchema.optional().nullable(),

  isActive: z.boolean().optional(),

  sortOrder: z.number().int().min(0).optional(),
});

/**
 * Schema for validating a category ID route param.
 */
const categoryIdSchema = z.object({
  id: objectIdSchema,
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
module.exports = {
  createCategorySchema,
  updateCategorySchema,
  categoryIdSchema,
};
