'use strict';

const { StatusCodes } = require('http-status-codes');
const { ZodError } = require('zod');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const { errorResponse } = require('../utils/apiResponse');

function handleZodError(err) {
  const errors = err.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
    code: e.code,
  }));
  return new AppError('Validation failed', StatusCodes.BAD_REQUEST, errors);
}

function handleMongooseValidationError(err) {
  const errors = Object.values(err.errors).map((e) => ({
    field: e.path,
    message: e.message,
  }));
  return new AppError('Validation failed', StatusCodes.BAD_REQUEST, errors);
}

function handleCastError(err) {
  return new AppError(
    `Invalid value '${err.value}' for field '${err.path}'`,
    StatusCodes.BAD_REQUEST,
  );
}

function handleDuplicateKeyError(err) {
  const field = Object.keys(err.keyValue || {})[0] || 'field';
  const value = err.keyValue ? err.keyValue[field] : 'unknown';
  return new AppError(
    `Duplicate value '${value}' for field '${field}'. Please use a different value.`,
    StatusCodes.CONFLICT,
  );
}

function handleJWTError() {
  return new AppError('Invalid token. Please log in again.', StatusCodes.UNAUTHORIZED);
}

function handleJWTExpiredError() {
  return new AppError('Your token has expired. Please log in again.', StatusCodes.UNAUTHORIZED);
}

// must be registered after all routes (4-arg signature required by Express)
function errorMiddleware(err, req, res, next) { // eslint-disable-line no-unused-vars
  logger.error('Unhandled error', {
    message: err.message,
    name: err.name,
    statusCode: err.statusCode,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  let error = err;

  if (err instanceof ZodError) {
    error = handleZodError(err);
  } else if (err instanceof mongoose.Error.ValidationError) {
    error = handleMongooseValidationError(err);
  } else if (err instanceof mongoose.Error.CastError) {
    error = handleCastError(err);
  } else if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  } else if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  } else if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  if (error instanceof AppError && error.isOperational) {
    return errorResponse(res, error.message, error.statusCode, error.errors);
  }

  // hide details in production
  const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Something went wrong. Please try again later.'
      : error.message || 'Internal server error';

  return errorResponse(res, message, statusCode);
}

module.exports = errorMiddleware;
