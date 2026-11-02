'use strict';

/**
 * @file category.controller.js
 */

const { StatusCodes } = require('http-status-codes');
const categoryService = require('./category.service');
const { successResponse } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const getCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.getCategories(req.query);
  return successResponse(res, 'Categories retrieved successfully', categories);
});

const getCategoryTree = asyncHandler(async (req, res) => {
  const tree = await categoryService.getCategoryTree();
  return successResponse(res, 'Category tree retrieved successfully', tree);
});

const getCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  return successResponse(res, 'Category retrieved successfully', category);
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  return successResponse(res, 'Category created successfully', category, StatusCodes.CREATED);
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  return successResponse(res, 'Category updated successfully', category);
});

const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  return successResponse(res, 'Category deleted successfully');
});

module.exports = { getCategories, getCategoryTree, getCategoryById, createCategory, updateCategory, deleteCategory };
