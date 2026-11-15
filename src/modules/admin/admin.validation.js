'use strict';

const { z } = require('zod');

const monthlySalesQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
}).strict();

const updateSettingsSchema = z.object({
  storeName: z.string().trim().min(1).max(200).optional(),
  storeLogo: z.string().trim().max(2048).optional(),
  storeEmail: z.string().trim().email().toLowerCase().optional(),
  storePhone: z.string().trim().max(30).optional(),
  storeAddress: z.string().trim().max(500).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  deliveryChargeInsideDhaka: z.coerce.number().nonnegative().optional(),
  deliveryChargeOutsideDhaka: z.coerce.number().nonnegative().optional(),
  sslcommerzEnabled: z.boolean().optional(),
  codEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one setting must be provided',
});

module.exports = { monthlySalesQuerySchema, updateSettingsSchema };
