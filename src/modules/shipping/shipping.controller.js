'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const shippingService = require('./shipping.service');
const { successResponse } = require('../../utils/apiResponse');
const { StatusCodes } = require('http-status-codes');

const getShippingZones = asyncHandler(async (req, res) =>
  successResponse(res, 'Shipping zones retrieved', await shippingService.getShippingZones()));

const getShippingCharge = asyncHandler(async (req, res) => {
  const charge = await shippingService.getShippingCharge(req.query.district || '');
  return successResponse(res, 'Shipping charge retrieved', { charge });
});

const createZone = asyncHandler(async (req, res) =>
  successResponse(res, 'Shipping zone created', await shippingService.createZone(req.body), StatusCodes.CREATED));

const updateZone = asyncHandler(async (req, res) =>
  successResponse(res, 'Shipping zone updated', await shippingService.updateZone(req.params.id, req.body)));

const deleteZone = asyncHandler(async (req, res) => {
  await shippingService.deleteZone(req.params.id);
  return successResponse(res, 'Shipping zone deleted');
});

module.exports = { getShippingZones, getShippingCharge, createZone, updateZone, deleteZone };
