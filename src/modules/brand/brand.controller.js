'use strict';

const { StatusCodes } = require('http-status-codes');
const brandService = require('./brand.service');
const { successResponse, paginatedResponse } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const getBrands = asyncHandler(async (req, res) => {
  const brands = await brandService.getBrands(req.query);
  return successResponse(res, 'Brands retrieved successfully', brands);
});

const getBrandById = asyncHandler(async (req, res) => {
  const brand = await brandService.getBrandById(req.params.id);
  return successResponse(res, 'Brand retrieved successfully', brand);
});

const createBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.createBrand(req.body);
  return successResponse(res, 'Brand created successfully', brand, StatusCodes.CREATED);
});

const updateBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.updateBrand(req.params.id, req.body);
  return successResponse(res, 'Brand updated successfully', brand);
});

const deleteBrand = asyncHandler(async (req, res) => {
  await brandService.deleteBrand(req.params.id);
  return successResponse(res, 'Brand deleted successfully');
});

module.exports = { getBrands, getBrandById, createBrand, updateBrand, deleteBrand };
