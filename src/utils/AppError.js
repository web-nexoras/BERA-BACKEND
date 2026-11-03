'use strict';

// Operational errors are safe to expose.
class AppError extends Error {
  constructor(message, statusCode, errors = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode || 500;
    this.errors = errors;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
