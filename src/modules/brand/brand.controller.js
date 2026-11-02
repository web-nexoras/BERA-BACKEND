'use strict';

/**
 * @file brand.controller.js
 * @description HTTP controllers for Brand endpoints.
 */

const { StatusCodes } = require('http-status-codes');
const brandService = require('./brand.service');
const { successResponse, paginatedResponse } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * GET /api/v1/brands
 */
const getBrands = asyncHandler(async (req, res) => {
  const brands = await brandService.getBrands(req.query);
  return successResponse(res, 'Brands retrieved successfully', brands);
});

/**
 * GET /api/v1/brands/:id
 */
const getBrandById = asyncHandler(async (req, res) => {
  const brand = await brandService.getBrandById(req.params.id);
  return successResponse(res, 'Brand retrieved successfully', brand);
});

/**
 * POST /api/v1/brands
 */
const createBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.createBrand(req.body);
  return successResponse(res, 'Brand created successfully', brand, StatusCodes.CREATED);
});

/**
 * PUT /api/v1/brands/:id
 */
const updateBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.updateBrand(req.params.id, req.body);
  return successResponse(res, 'Brand updated successfully', brand);
});

/**
 * DELETE /api/v1/brands/:id
 */
const deleteBrand = asyncHandler(async (req, res) => {
  await brandService.deleteBrand(req.params.id);
  return successResponse(res, 'Brand deleted successfully');
});

module.exports = { getBrands, getBrandById, createBrand, updateBrand, deleteBrand };
