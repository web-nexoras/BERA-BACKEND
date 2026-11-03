'use strict';

const { z } = require('zod');

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format');

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

const categoryIdSchema = z.object({
  id: objectIdSchema,
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  categoryIdSchema,
};
