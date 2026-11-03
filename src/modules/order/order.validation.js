'use strict';

const { z } = require('zod');

const objectId = z
  .string({ required_error: 'ID is required' })
  .length(24, 'Must be a valid 24-character ObjectId')
  .regex(/^[a-f\d]{24}$/i, 'Must be a valid ObjectId');

const shippingAddressSchema = z.object({
  recipientName: z
    .string({ required_error: 'Recipient name is required' })
    .trim()
    .min(2, 'Recipient name must be at least 2 characters')
    .max(100, 'Recipient name cannot exceed 100 characters'),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .regex(
      /^(?:\+8801|8801|01)[3-9]\d{8}$/,
      'Please provide a valid Bangladeshi phone number'
    ),
  addressLine1: z
    .string({ required_error: 'Address line 1 is required' })
    .trim()
    .min(5, 'Address must be at least 5 characters')
    .max(200, 'Address cannot exceed 200 characters'),
  addressLine2: z.string().trim().max(200).optional().default(''),
  city: z
    .string({ required_error: 'City is required' })
    .trim()
    .min(2, 'City name must be at least 2 characters')
    .max(100),
  district: z
    .string({ required_error: 'District is required' })
    .trim()
    .min(2, 'District name must be at least 2 characters')
    .max(100),
  division: z
    .string({ required_error: 'Division is required' })
    .trim()
    .min(2, 'Division name must be at least 2 characters')
    .max(100),
  postalCode: z.string().trim().max(10).optional(),
});

const checkoutSchema = z.object({
  shippingAddress: shippingAddressSchema,
  paymentMethod: z.enum(['cod', 'sslcommerz'], {
    required_error: 'Payment method is required',
    invalid_type_error: 'Payment method must be "cod" or "sslcommerz"',
  }),
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable(),
  notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(
    ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'],
    { required_error: 'Status is required', invalid_type_error: 'Invalid order status' }
  ),
  note: z.string().trim().max(500).optional(),
});

const cancelOrderSchema = z.object({
  reason: z
    .string({ required_error: 'Cancellation reason is required' })
    .trim()
    .min(5, 'Please provide a reason of at least 5 characters')
    .max(500, 'Reason cannot exceed 500 characters'),
});

const orderQuerySchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/, 'Page must be a positive integer')
    .transform(Number)
    .default('1'),
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .transform(Number)
    .default('10'),
  status: z
    .enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'])
    .optional(),
  paymentStatus: z
    .enum(['pending', 'paid', 'failed', 'refunded', 'partial_refund'])
    .optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().trim().max(100).optional(),
});

const orderIdParamSchema = z.object({
  orderId: objectId,
});

module.exports = {
  checkoutSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  orderQuerySchema,
  orderIdParamSchema,
};
