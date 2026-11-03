'use strict';

const { z } = require('zod');

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format');

const createBrandSchema = z.object({
  name: z
    .string({ required_error: 'Brand name is required' })
    .trim()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must be at most 100 characters'),

  description: z
    .string()
    .trim()
    .max(2000, 'Description must be at most 2000 characters')
    .optional()
    .default(''),

  logo: z
    .string()
    .url('Logo must be a valid URL')
    .optional()
    .or(z.literal(''))
    .default(''),

  website: z
    .string()
    .url('Website must be a valid URL')
    .optional()
    .or(z.literal(''))
    .default(''),

  isActive: z.boolean().optional().default(true),
});

const updateBrandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must be at most 100 characters')
    .optional(),

  description: z
    .string()
    .trim()
    .max(2000, 'Description must be at most 2000 characters')
    .optional(),

  logo: z
    .string()
    .url('Logo must be a valid URL')
    .optional()
    .or(z.literal('')),

  website: z
    .string()
    .url('Website must be a valid URL')
    .optional()
    .or(z.literal('')),

  isActive: z.boolean().optional(),
});

const brandIdSchema = z.object({
  id: objectIdSchema,
});

module.exports = {
  createBrandSchema,
  updateBrandSchema,
  brandIdSchema,
};
