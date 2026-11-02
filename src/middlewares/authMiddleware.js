'use strict';

const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { errorResponse } = require('../utils/apiResponse');
const User = require('../modules/auth/auth.model');

function extractToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

// verify JWT and attach user to req
async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return errorResponse(res, 'Authentication required. Please log in.', StatusCodes.UNAUTHORIZED);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 'Your session has expired. Please log in again.', StatusCodes.UNAUTHORIZED);
      }
      return errorResponse(res, 'Invalid authentication token.', StatusCodes.UNAUTHORIZED);
    }

    // fetch fresh user — reject if deleted or blocked
    const user = await User.findById(decoded.id).select('-password -refreshTokens');

    if (!user) {
      return errorResponse(res, 'User belonging to this token no longer exists.', StatusCodes.UNAUTHORIZED);
    }

    if (user.isBlocked) {
      return errorResponse(res, 'Your account has been suspended. Please contact support.', StatusCodes.FORBIDDEN);
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

// like authenticate but doesn't reject missing tokens — used for public+personalised routes
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      req.user = null;
      return next();
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    } catch (_err) {
      req.user = null;
      return next();
    }

    const user = await User.findById(decoded.id).select('-password -refreshTokens');
    req.user = user && !user.isBlocked ? user : null;

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { authenticate, optionalAuth };
