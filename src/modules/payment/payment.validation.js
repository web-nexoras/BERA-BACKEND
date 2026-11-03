'use strict';

const { z } = require('zod');

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId');

const positiveInt = (defaultVal) =>
  z.coerce.number().int().positive().default(defaultVal);

const initPaymentSchema = z.object({
  orderId: objectId,
});

const sslcommerzSuccessSchema = z.object({
  val_id: z.string().optional(),
  tran_id: z.string().min(1, 'tran_id is required'),
  store_id: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  status: z.string().optional(),

  card_type: z.string().optional(),
  card_no: z.string().optional(),
  card_issuer: z.string().optional(),
  card_brand: z.string().optional(),
  card_issuer_country: z.string().optional(),
  card_issuer_country_code: z.string().optional(),

  bank_tran_id: z.string().optional(),
  tran_date: z.string().optional(),

  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),

  risk_level: z.union([z.string(), z.number()]).optional(),
  risk_title: z.string().optional(),

  currency_amount: z.union([z.string(), z.number()]).optional(),
  currency_rate: z.union([z.string(), z.number()]).optional(),
  base_fair: z.union([z.string(), z.number()]).optional(),

  verify_sign: z.string().optional(),
  verify_key: z.string().optional(),
  verify_sign_sha2: z.string().optional(),
}).passthrough(); // keep unlisted SSLCommerz fields

const paymentQuerySchema = z.object({
  page: positiveInt(1),
  limit: positiveInt(10),
  status: z
    .enum(['pending', 'paid', 'failed', 'refunded', 'cancelled'])
    .optional(),
  method: z.enum(['sslcommerz', 'cod']).optional(),
});

module.exports = {
  initPaymentSchema,
  sslcommerzSuccessSchema,
  paymentQuerySchema,
};
