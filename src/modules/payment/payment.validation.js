'use strict';

/**
 * @file payment.validation.js
 * @description Zod validation schemas for payment module endpoints.
 */

const { z } = require('zod');

// ---------------------------------------------------------------------------
// Reusable helpers
// ---------------------------------------------------------------------------

/** Validates a MongoDB ObjectId string */
const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId');

/** Coerces a string to a positive integer (for pagination) */
const positiveInt = (defaultVal) =>
  z.coerce.number().int().positive().default(defaultVal);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Schema for initiating a payment.
 * Used when the customer clicks "Pay Now" for an existing order.
 */
const initPaymentSchema = z.object({
  orderId: objectId,
});

/**
 * Schema for SSLCommerz IPN / success callback POST body.
 * Covers all standard IPN parameters sent by SSLCommerz.
 */
const sslcommerzSuccessSchema = z.object({
  // Core transaction fields
  val_id: z.string().optional(),
  tran_id: z.string().min(1, 'tran_id is required'),
  store_id: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  status: z.string().optional(),

  // Card / method info
  card_type: z.string().optional(),
  card_no: z.string().optional(),
  card_issuer: z.string().optional(),
  card_brand: z.string().optional(),
  card_issuer_country: z.string().optional(),
  card_issuer_country_code: z.string().optional(),

  // Bank transaction
  bank_tran_id: z.string().optional(),
  tran_date: z.string().optional(),

  // Customer info
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),

  // Risk / verify
  risk_level: z.union([z.string(), z.number()]).optional(),
  risk_title: z.string().optional(),

  // Amounts
  currency_amount: z.union([z.string(), z.number()]).optional(),
  currency_rate: z.union([z.string(), z.number()]).optional(),
  base_fair: z.union([z.string(), z.number()]).optional(),

  // Hash / verify
  verify_sign: z.string().optional(),
  verify_key: z.string().optional(),
  verify_sign_sha2: z.string().optional(),
}).passthrough(); // allow extra SSLCommerz fields we haven't listed

/**
 * Schema for payment list query parameters.
 * Used by both the customer "my-transactions" and admin "all" endpoints.
 */
const paymentQuerySchema = z.object({
  page: positiveInt(1),
  limit: positiveInt(10),
  status: z
    .enum(['pending', 'paid', 'failed', 'refunded', 'cancelled'])
    .optional(),
  method: z.enum(['sslcommerz', 'cod']).optional(),
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  initPaymentSchema,
  sslcommerzSuccessSchema,
  paymentQuerySchema,
};
