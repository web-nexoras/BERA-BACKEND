'use strict';

const { z } = require('zod');

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId');

const createZoneSchema = z.object({
  name: z.string().min(2, 'Zone name must be at least 2 characters').trim(),
  districts: z
    .array(z.string().min(1).trim())
    .min(1, 'At least one district is required'),
  charge: z.number().nonnegative('Charge must be 0 or greater'),
  estimatedDays: z
    .string()
    .min(1, 'Estimated days is required')
    .trim(),
  isActive: z.boolean().optional().default(true),
});

const updateZoneSchema = z
  .object({
    name: z.string().min(2).trim().optional(),
    districts: z.array(z.string().min(1).trim()).min(1).optional(),
    charge: z.number().nonnegative().optional(),
    estimatedDays: z.string().min(1).trim().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' },
  );

const getChargeSchema = z.object({
  district: z.string().min(1, 'District is required').trim(),
});

module.exports = {
  createZoneSchema,
  updateZoneSchema,
  getChargeSchema,
};
