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
  logoutSchema,
  resendVerificationSchema,
} = require('./auth.validation');

router.post('/register', validateBody(registerSchema), authController.register);

router.post('/login', validateBody(loginSchema), authController.login);

router.post('/resend-verification', validateBody(resendVerificationSchema), authController.resendVerificationEmail);

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

router.post('/refresh-token', validateBody(refreshTokenSchema), authController.refreshToken);

router.post('/logout', authenticate, validateBody(logoutSchema), authController.logout);

router.put(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  authController.changePassword,
);

module.exports = router;
