'use strict';

/**
 * @file auth.routes.js
 * @description Express router for authentication endpoints.
 */

const express = require('express');
const router = express.Router();

const authController = require('./auth.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateBody, validateParams } = require('../../middlewares/validateMiddleware');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordParamsSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
  refreshTokenSchema,
} = require('./auth.validation');

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------

/** @route POST /api/v1/auth/register */
router.post('/register', validateBody(registerSchema), authController.register);

/** @route POST /api/v1/auth/login */
router.post('/login', validateBody(loginSchema), authController.login);

/** @route GET /api/v1/auth/verify-email/:token */
router.get(
  '/verify-email/:token',
  validateParams(verifyEmailSchema),
  authController.verifyEmail,
);

/** @route POST /api/v1/auth/forgot-password */
router.post(
  '/forgot-password',
  validateBody(forgotPasswordSchema),
  authController.forgotPassword,
);

/** @route POST /api/v1/auth/reset-password/:token */
router.post(
  '/reset-password/:token',
  validateParams(resetPasswordParamsSchema),
  validateBody(resetPasswordSchema),
  authController.resetPassword,
);

/** @route POST /api/v1/auth/refresh-token */
router.post('/refresh-token', authController.refreshToken);

// ---------------------------------------------------------------------------
// Protected routes (require valid access token)
// ---------------------------------------------------------------------------

/** @route POST /api/v1/auth/logout */
router.post('/logout', authenticate, authController.logout);

/** @route PUT /api/v1/auth/change-password */
router.put(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  authController.changePassword,
);

module.exports = router;
