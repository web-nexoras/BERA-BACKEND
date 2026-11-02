'use strict';

/**
 * @file user.controller.js
 */

const userService = require('./user.service');
const { successResponse } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { StatusCodes } = require('http-status-codes');

const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user.id);
  return successResponse(res, 'Profile retrieved successfully', user);
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  return successResponse(res, 'Profile updated successfully', user);
});

const getAddresses = asyncHandler(async (req, res) => {
  const addresses = await userService.getAddresses(req.user.id);
  return successResponse(res, 'Addresses retrieved successfully', addresses);
});

const addAddress = asyncHandler(async (req, res) => {
  const address = await userService.addAddress(req.user.id, req.body);
  return successResponse(res, 'Address added successfully', address, StatusCodes.CREATED);
});

const updateAddress = asyncHandler(async (req, res) => {
  const address = await userService.updateAddress(req.user.id, req.params.addressId, req.body);
  return successResponse(res, 'Address updated successfully', address);
});

const deleteAddress = asyncHandler(async (req, res) => {
  await userService.deleteAddress(req.user.id, req.params.addressId);
  return successResponse(res, 'Address deleted successfully');
});

const setDefaultAddress = asyncHandler(async (req, res) => {
  const address = await userService.setDefaultAddress(req.user.id, req.params.addressId);
  return successResponse(res, 'Default address set successfully', address);
});

module.exports = { getProfile, updateProfile, getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress };
