'use strict';

const { StatusCodes } = require('http-status-codes');
const { errorResponse } = require('../utils/apiResponse');

function isAdmin(req, res, next) {
  if (!req.user) return errorResponse(res, 'Authentication required.', StatusCodes.UNAUTHORIZED);
  if (req.user.role !== 'admin') return errorResponse(res, 'Access denied. Admin privileges required.', StatusCodes.FORBIDDEN);
  return next();
}

module.exports = { isAdmin };
