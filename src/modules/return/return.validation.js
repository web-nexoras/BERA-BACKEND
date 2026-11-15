'use strict';

const { z } = require('zod');

const objectId = z
  .string({ error: 'ID is required' })
  .length(24, 'Must be a valid 24-character ObjectId')
  .regex(/^[a-f\d]{24}$/i, 'Must be a valid ObjectId');

const createReturnSchema = z.object({
  orderId: objectId,
  items: z
    .array(
      z.object({
        orderItemId: objectId,
        reason: z
          .string({ error: 'Return reason is required' })
          .trim()
          .min(5, 'Reason must be at least 5 characters')
          .max(500, 'Reason cannot exceed 500 characters'),
        quantity: z
          .number({ error: (issue) => issue.input === undefined ? 'Return quantity is required' : 'Quantity must be a number' })
          .int('Quantity must be an integer')
          .positive('Quantity must be at least 1'),
      })
    )
    .min(1, 'At least one item must be specified for a return')
    .superRefine((items, context) => {
      const seen = new Set();
      items.forEach((item, index) => {
        const id = item.orderItemId.toLowerCase();
        if (seen.has(id)) context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'orderItemId'], message: 'Each order item may only be listed once' });
        seen.add(id);
      });
    }),
});

const updateReturnStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'completed'], {
    error: (issue) => issue.input === undefined ? 'Status is required' : 'Status must be "approved", "rejected", or "completed"',
  }),
  adminNotes: z.string().trim().max(500).optional(),
  refundAmount: z
    .coerce.number().min(0, 'Refund amount cannot be negative')
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
