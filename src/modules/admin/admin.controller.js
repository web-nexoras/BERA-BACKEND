'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const adminService = require('./admin.service');
const settingsService = require('./settings.service');
const { successResponse, paginatedResponse } = require('../../utils/apiResponse');
const AppError = require('../../utils/AppError');
const { StatusCodes } = require('http-status-codes');

// Dashboard
const getDashboardStats = asyncHandler(async (req, res) =>
  successResponse(res, 'Dashboard stats', await adminService.getDashboardStats()));

const getMonthlySales = asyncHandler(async (req, res) =>
  successResponse(res, 'Monthly sales data', await adminService.getMonthlySalesData(parseInt(req.query.year))));

const getRecentOrders = asyncHandler(async (req, res) =>
  successResponse(res, 'Recent orders', await adminService.getRecentOrders(parseInt(req.query.limit) || 10)));

const getBestSellers = asyncHandler(async (req, res) =>
  successResponse(res, 'Best selling products', await adminService.getBestSellingProducts(parseInt(req.query.limit) || 10)));

// Reports
const getSalesReport = asyncHandler(async (req, res) =>
  successResponse(res, 'Sales report', await adminService.getSalesReport(req.query.startDate, req.query.endDate)));

const getInventoryReport = asyncHandler(async (req, res) =>
  successResponse(res, 'Inventory report', await adminService.getInventoryReport()));

// Customers
const getCustomers = asyncHandler(async (req, res) => {
  const { customers, pagination } = await adminService.getCustomers(req.query);
  return paginatedResponse(res, 'Customers retrieved', customers, pagination);
});

const getCustomerById = asyncHandler(async (req, res) =>
  successResponse(res, 'Customer retrieved', await adminService.getCustomerById(req.params.id)));

const blockCustomer = asyncHandler(async (req, res) =>
  successResponse(res, 'Customer blocked', await adminService.blockCustomer(req.params.id)));

const unblockCustomer = asyncHandler(async (req, res) =>
  successResponse(res, 'Customer unblocked', await adminService.unblockCustomer(req.params.id)));

// Settings
const getSettings = asyncHandler(async (req, res) =>
  successResponse(res, 'Settings retrieved', await settingsService.getSettings()));

const updateSettings = asyncHandler(async (req, res) =>
  successResponse(res, 'Settings updated', await settingsService.updateSettings(req.body)));

module.exports = {
  getDashboardStats, getMonthlySales, getRecentOrders, getBestSellers,
  getSalesReport, getInventoryReport,
  getCustomers, getCustomerById, blockCustomer, unblockCustomer,
  getSettings, updateSettings,
};
