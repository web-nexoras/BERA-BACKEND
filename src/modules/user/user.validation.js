'use strict';

/**
 * @file user.validation.js
 * @description Zod schemas for user profile and address management endpoints.
 */

const { z } = require('zod');
const { isValidObjectId } = require('../../utils/helpers');

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

/**
 * Validates a MongoDB ObjectId string.
 */
const objectIdSchema = z
  .string()
  .refine(isValidObjectId, { message: 'Invalid ID format' });

const phoneField = z
  .string()
  .regex(
    /^(?:\+?880|0)1[3-9]\d{8}$/,
    'Please provide a valid Bangladeshi phone number',
  );

// ---------------------------------------------------------------------------
// Profile schemas
// ---------------------------------------------------------------------------

/**
 * Schema for PUT /users/profile
 * All fields are optional – PATCH-style update.
 */
const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name cannot exceed 100 characters')
      .optional(),
    phone: phoneField.optional().nullable(),
    avatar: z.string().url('Avatar must be a valid URL').optional().nullable(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' },
  );

// ---------------------------------------------------------------------------
// Address schemas
// ---------------------------------------------------------------------------

/**
 * Schema for POST /users/addresses
 */
const addAddressSchema = z.object({
  label: z.enum(['home', 'work', 'other']).default('home'),
  recipientName: z
    .string({ required_error: 'Recipient name is required' })
    .trim()
    .min(2, 'Recipient name must be at least 2 characters')
    .max(100, 'Recipient name cannot exceed 100 characters'),
  phone: phoneField,
  addressLine1: z
    .string({ required_error: 'Address line 1 is required' })
    .trim()
    .min(5, 'Address line 1 must be at least 5 characters')
    .max(200, 'Address line 1 cannot exceed 200 characters'),
  addressLine2: z
    .string()
    .trim()
    .max(200, 'Address line 2 cannot exceed 200 characters')
    .optional()
    .nullable(),
  city: z
    .string({ required_error: 'City is required' })
    .trim()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City cannot exceed 100 characters'),
  district: z
    .string({ required_error: 'District is required' })
    .trim()
    .min(2, 'District must be at least 2 characters')
    .max(100, 'District cannot exceed 100 characters'),
  division: z
    .string({ required_error: 'Division is required' })
    .trim()
    .min(2, 'Division must be at least 2 characters')
    .max(100, 'Division cannot exceed 100 characters'),
  postalCode: z
    .string({ required_error: 'Postal code is required' })
    .regex(/^\d{4}$/, 'Postal code must be a 4-digit number'),
  isDefault: z.boolean().default(false),
});

/**
 * Schema for PUT /users/addresses/:addressId
 * All fields are optional.
 */
const updateAddressSchema = z
  .object({
    label: z.enum(['home', 'work', 'other']).optional(),
    recipientName: z
      .string()
      .trim()
      .min(2, 'Recipient name must be at least 2 characters')
      .max(100, 'Recipient name cannot exceed 100 characters')
      .optional(),
    phone: phoneField.optional(),
    addressLine1: z
      .string()
      .trim()
      .min(5, 'Address line 1 must be at least 5 characters')
      .max(200, 'Address line 1 cannot exceed 200 characters')
      .optional(),
    addressLine2: z
      .string()
      .trim()
      .max(200, 'Address line 2 cannot exceed 200 characters')
      .optional()
      .nullable(),
    city: z
      .string()
      .trim()
      .min(2, 'City must be at least 2 characters')
      .max(100, 'City cannot exceed 100 characters')
      .optional(),
    district: z
      .string()
      .trim()
      .min(2, 'District must be at least 2 characters')
      .max(100, 'District cannot exceed 100 characters')
      .optional(),
    division: z
      .string()
      .trim()
      .min(2, 'Division must be at least 2 characters')
      .max(100, 'Division cannot exceed 100 characters')
      .optional(),
    postalCode: z
      .string()
      .regex(/^\d{4}$/, 'Postal code must be a 4-digit number')
      .optional(),
    isDefault: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' },
  );

/**
 * Schema for address ID URL params.
 */
const addressIdParamSchema = z.object({
  addressId: objectIdSchema,
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  objectIdSchema,
  updateProfileSchema,
  addAddressSchema,
  updateAddressSchema,
  addressIdParamSchema,
};
