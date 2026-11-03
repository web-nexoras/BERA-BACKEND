'use strict';

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

router.post('/register', validateBody(registerSchema), authController.register);

router.post('/login', validateBody(loginSchema), authController.login);

router.get(
  '/verify-email/:token',
  validateParams(verifyEmailSchema),
  authController.verifyEmail,
);

router.post(
  '/forgot-password',
  validateBody(forgotPasswordSchema),
  authController.forgotPassword,
);

router.post(
  '/reset-password/:token',
  validateParams(resetPasswordParamsSchema),
  validateBody(resetPasswordSchema),
  authController.resetPassword,
);

router.post('/refresh-token', authController.refreshToken);

router.post('/logout', authenticate, authController.logout);

router.put(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  authController.changePassword,
);

module.exports = router;
