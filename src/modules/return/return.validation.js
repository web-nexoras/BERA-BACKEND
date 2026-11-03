'use strict';

const { z } = require('zod');

const objectId = z
  .string({ required_error: 'ID is required' })
  .length(24, 'Must be a valid 24-character ObjectId')
  .regex(/^[a-f\d]{24}$/i, 'Must be a valid ObjectId');

const createReturnSchema = z.object({
  orderId: objectId,
  items: z
    .array(
      z.object({
        orderItemIndex: z
          .number({ required_error: 'Order item index is required', invalid_type_error: 'Index must be a number' })
          .int('Index must be an integer')
          .min(0, 'Index must be 0 or greater'),
        reason: z
          .string({ required_error: 'Return reason is required' })
          .trim()
          .min(5, 'Reason must be at least 5 characters')
          .max(500, 'Reason cannot exceed 500 characters'),
        quantity: z
          .number({ required_error: 'Return quantity is required', invalid_type_error: 'Quantity must be a number' })
          .int('Quantity must be an integer')
          .positive('Quantity must be at least 1'),
      })
    )
    .min(1, 'At least one item must be specified for a return'),
});

const updateReturnStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'completed'], {
    required_error: 'Status is required',
    invalid_type_error: 'Status must be "approved", "rejected", or "completed"',
  }),
  adminNotes: z.string().trim().max(500).optional(),
  refundAmount: z
    .number()
    .min(0, 'Refund amount cannot be negative')
    .optional(),
  refundMethod: z.string().trim().max(100).optional(),
});

const returnIdParamSchema = z.object({
  returnId: objectId,
});

module.exports = {
  createReturnSchema,
  updateReturnStatusSchema,
  returnIdParamSchema,
};
