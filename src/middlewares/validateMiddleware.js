'use strict';

const { ZodError } = require('zod');
const { StatusCodes } = require('http-status-codes');
const { errorResponse } = require('../utils/apiResponse');

function formatZodErrors(zodError) {
  return zodError.errors.map((e) => ({
    field: e.path.join('.') || 'value',
    message: e.message,
    code: e.code,
  }));
}

function createValidator(target, schema) {
  return function validationMiddleware(req, res, next) {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      return errorResponse(res, 'Validation failed', StatusCodes.BAD_REQUEST, formatZodErrors(result.error));
    }
    req[target] = result.data; // replace with parsed/coerced value
    return next();
  };
}

function validateBody(schema) { return createValidator('body', schema); }
function validateParams(schema) { return createValidator('params', schema); }
function validateQuery(schema) { return createValidator('query', schema); }

module.exports = { validateBody, validateParams, validateQuery };
