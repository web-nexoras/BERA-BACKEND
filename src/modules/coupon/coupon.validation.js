'use strict';

const { z } = require('zod');

const objectId = z
  .string({ required_error: 'ID is required' })
  .length(24, 'Must be a valid 24-character ObjectId')
  .regex(/^[a-f\d]{24}$/i, 'Must be a valid ObjectId');

const createCouponSchema = z
  .object({
    code: z
      .string({ required_error: 'Coupon code is required' })
      .trim()
      .min(2, 'Code must be at least 2 characters')
      .max(50, 'Code cannot exceed 50 characters')
      .toUpperCase(),
    type: z.enum(['percentage', 'fixed'], {
      required_error: 'Coupon type is required',
      invalid_type_error: 'Type must be "percentage" or "fixed"',
    }),
    value: z
      .number({ required_error: 'Value is required', invalid_type_error: 'Value must be a number' })
      .positive('Value must be positive'),
    minimumOrderAmount: z
      .number()
      .min(0, 'Minimum order amount cannot be negative')
      .optional()
      .default(0),
    maximumDiscount: z
      .number()
      .positive('Maximum discount must be positive')
      .optional()
      .nullable(),
    expiresAt: z
      .string({ required_error: 'Expiry date is required' })
      .datetime({ message: 'expiresAt must be a valid ISO 8601 date-time string' })
      .refine((d) => new Date(d) > new Date(), {
        message: 'Expiry date must be in the future',
      }),
    usageLimit: z
      .number()
      .int('Usage limit must be an integer')
      .positive('Usage limit must be positive')
      .optional()
      .nullable(),
    isFirstOrderOnly: z.boolean().optional().default(false),
    applicableCategories: z.array(objectId).optional().default([]),
    applicableProducts: z.array(objectId).optional().default([]),
  })
  .refine(
    (data) => {
      if (data.type === 'percentage' && data.value > 100) return false;
      return true;
    },
    { message: 'Percentage value cannot exceed 100', path: ['value'] }
  );

const updateCouponSchema = z
  .object({
    code: z.string().trim().min(2).max(50).toUpperCase().optional(),
    type: z.enum(['percentage', 'fixed']).optional(),
    value: z.number().positive().optional(),
    minimumOrderAmount: z.number().min(0).optional(),
    maximumDiscount: z.number().positive().optional().nullable(),
    expiresAt: z
      .string()
      .datetime()
      .refine((d) => new Date(d) > new Date(), {
        message: 'Expiry date must be in the future',
      })
      .optional(),
    usageLimit: z.number().int().positive().optional().nullable(),
    isFirstOrderOnly: z.boolean().optional(),
    isActive: z.boolean().optional(),
    applicableCategories: z.array(objectId).optional(),
    applicableProducts: z.array(objectId).optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'percentage' && data.value !== undefined && data.value > 100) return false;
      return true;
    },
    { message: 'Percentage value cannot exceed 100', path: ['value'] }
  );

const applyCouponSchema = z.object({
  code: z
    .string({ required_error: 'Coupon code is required' })
    .trim()
    .min(1)
    .toUpperCase(),
  orderAmount: z
    .number({ required_error: 'Order amount is required', invalid_type_error: 'Order amount must be a number' })
    .min(0, 'Order amount cannot be negative'),
});

const couponIdSchema = z.object({
  id: objectId,
});

module.exports = {
  createCouponSchema,
  updateCouponSchema,
  applyCouponSchema,
  couponIdSchema,
};
