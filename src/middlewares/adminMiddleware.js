'use strict';

const { StatusCodes } = require('http-status-codes');
const { errorResponse } = require('../utils/apiResponse');

// Run after authentication.
function isAdmin(req, res, next) {
  if (!req.user) return errorResponse(res, 'Authentication required.', StatusCodes.UNAUTHORIZED);
  if (req.user.role !== 'admin') return errorResponse(res, 'Access denied. Admin privileges required.', StatusCodes.FORBIDDEN);
  return next();
}

// No permissions means full admin access.
function hasPermission(permission) {
  return function permissionMiddleware(req, res, next) {
    if (!req.user) return errorResponse(res, 'Authentication required.', StatusCodes.UNAUTHORIZED);
    if (req.user.role !== 'admin') return errorResponse(res, 'Access denied. Admin privileges required.', StatusCodes.FORBIDDEN);
    if (!req.user.permissions || req.user.permissions.length === 0) return next();
    if (!req.user.permissions.includes(permission)) {
      return errorResponse(res, `Access denied. Required permission: '${permission}'.`, StatusCodes.FORBIDDEN);
    }
    return next();
  };
}

function restrictTo(...roles) {
  return function restrictToMiddleware(req, res, next) {
    if (!req.user) return errorResponse(res, 'Authentication required.', StatusCodes.UNAUTHORIZED);
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, `Access denied. This route is restricted to: ${roles.join(', ')}.`, StatusCodes.FORBIDDEN);
    }
    return next();
  };
}

module.exports = { isAdmin, hasPermission, restrictTo };
