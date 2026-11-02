'use strict';

const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse, createdResponse, errorResponse } = require('../../utils/apiResponse');
const authService = require('./auth.service');

const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  return createdResponse(res, 'Account created. Please verify your email.', { user });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.login(email, password);
  return successResponse(res, 'Logged in successfully.', { user, accessToken, refreshToken });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const user = await authService.verifyEmail(req.params.token);
  return successResponse(res, 'Email verified successfully.', { user });
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  return successResponse(res, 'If that email exists, a reset link has been sent.');
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.params.token, req.body.password);
  return successResponse(res, 'Password reset successfully. You can now log in.');
});

const refreshToken = asyncHandler(async (req, res) => {
  const raw = req.body.refreshToken || req.cookies?.refreshToken;
  if (!raw) return errorResponse(res, 'Refresh token is required.', StatusCodes.BAD_REQUEST);
  const tokens = await authService.refreshAccessToken(raw);
  return successResponse(res, 'Token refreshed.', tokens);
});

const logout = asyncHandler(async (req, res) => {
  const raw = req.body.refreshToken || req.cookies?.refreshToken;
  await authService.logout(req.user._id.toString(), raw);
  return successResponse(res, 'Logged out successfully.');
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user._id.toString(), currentPassword, newPassword);
  return successResponse(res, 'Password changed. Please log in again.');
});

module.exports = { register, login, verifyEmail, forgotPassword, resetPassword, refreshToken, logout, changePassword };
