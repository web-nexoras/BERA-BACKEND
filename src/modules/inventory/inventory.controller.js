'use strict';

const inventoryService = require('./inventory.service');
const { successResponse, paginatedResponse } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const getInventory = asyncHandler(async (req, res) => {
  const { variants, pagination } = await inventoryService.getInventory(req.query);
  return paginatedResponse(res, 'Inventory retrieved successfully', variants, pagination);
});

const adjustStock = asyncHandler(async (req, res) => {
  const { variantId, quantity, type, reference, notes } = req.body;
  const variant = await inventoryService.adjustStock(variantId, quantity, type, reference, req.user.id, notes);
  return successResponse(res, 'Stock adjusted successfully', variant);
});

const getStockHistory = asyncHandler(async (req, res) => {
  const { logs, pagination } = await inventoryService.getStockHistory(req.params.variantId, req.query);
  return paginatedResponse(res, 'Stock history retrieved successfully', logs, pagination);
});

const getLowStockProducts = asyncHandler(async (req, res) => {
  const variants = await inventoryService.getLowStockProducts();
  return successResponse(res, 'Low stock products retrieved successfully', variants);
});

const getOutOfStockProducts = asyncHandler(async (req, res) => {
  const variants = await inventoryService.getOutOfStockProducts();
  return successResponse(res, 'Out of stock products retrieved successfully', variants);
});

module.exports = { getInventory, adjustStock, getStockHistory, getLowStockProducts, getOutOfStockProducts };
