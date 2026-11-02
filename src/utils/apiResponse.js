'use strict';

const { StatusCodes } = require('http-status-codes');

// all responses: { success, message, data?, errors?, pagination? }

function successResponse(res, message, data = null, statusCode = StatusCodes.OK) {
  return res.status(statusCode).json({ success: true, message, data });
}

function errorResponse(res, message, statusCode = StatusCodes.INTERNAL_SERVER_ERROR, errors = null) {
  const body = { success: false, message };
  if (errors !== null && errors !== undefined) body.errors = errors;
  return res.status(statusCode).json(body);
}

function paginatedResponse(res, message, data, pagination, statusCode = StatusCodes.OK) {
  return res.status(statusCode).json({ success: true, message, data, pagination });
}

function createdResponse(res, message, data = null) {
  return successResponse(res, message, data, StatusCodes.CREATED);
}

function noContentResponse(res) {
  return res.status(StatusCodes.NO_CONTENT).send();
}

module.exports = { successResponse, errorResponse, paginatedResponse, createdResponse, noContentResponse };
