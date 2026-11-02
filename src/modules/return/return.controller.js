'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const returnService = require('./return.service');
const { successResponse, paginatedResponse } = require('../../utils/apiResponse');
const { StatusCodes } = require('http-status-codes');

const createReturn = asyncHandler(async (req, res) =>
  successResponse(res, 'Return request submitted', await returnService.createReturnRequest(req.user.id, req.body), StatusCodes.CREATED));

const getMyReturns = asyncHandler(async (req, res) => {
  const { returns, pagination } = await returnService.getMyReturns(req.user.id, req.query);
  return paginatedResponse(res, 'Returns retrieved', returns, pagination);
});

const getAllReturns = asyncHandler(async (req, res) => {
  const { returns, pagination } = await returnService.getAllReturns(req.query);
  return paginatedResponse(res, 'Returns retrieved', returns, pagination);
});

const updateReturnStatus = asyncHandler(async (req, res) => {
  const returnDoc = await returnService.updateReturnStatus(req.params.returnId, req.body.status, req.body.adminNotes, req.body.refundAmount);
  return successResponse(res, 'Return status updated', returnDoc);
});

module.exports = { createReturn, getMyReturns, getAllReturns, updateReturnStatus };
