'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');

const User = require('./auth.model');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { hashToken } = require('../../utils/helpers');
const emailService = require('../../services/email.service');

const signAccessToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role, email: user.email }, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });

const signRefreshToken = (user) =>
  jwt.sign({ id: user._id.toString() }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });

const generateTokenPair = (user) => ({
  accessToken: signAccessToken(user),
  refreshToken: signRefreshToken(user),
});

async function register(data) {
  const { name, email, password, phone } = data;

  const existing = await User.findByEmail(email);
  if (existing) throw new AppError('Email already registered.', StatusCodes.CONFLICT);

  const user = await User.create({ name, email, password, phone });
  const rawToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  try {
    const url = `${env.FRONTEND_URL}/verify-email/${rawToken}`;
    await emailService.sendVerificationEmail(user, url);
  } catch (e) {
    logger.error('Verification email failed', { error: e.message });
  }

  return user.toJSON();
}

async function login(email, password) {
  const user = await User.findByEmail(email).select('+password +refreshTokens');
  if (!user) throw new AppError('Invalid email or password.', StatusCodes.UNAUTHORIZED);

  const valid = await user.comparePassword(password);
  if (!valid) throw new AppError('Invalid email or password.', StatusCodes.UNAUTHORIZED);

  if (user.isBlocked) throw new AppError('Account suspended. Contact support.', StatusCodes.FORBIDDEN);

  const { accessToken, refreshToken } = generateTokenPair(user);
  user.refreshTokens = [hashToken(refreshToken), ...(user.refreshTokens || [])].slice(0, 5);
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  return { user: user.toJSON(), accessToken, refreshToken };
}

async function verifyEmail(rawToken) {
  const hashed = hashToken(rawToken);
  const user = await User.findOne({
    emailVerificationToken: hashed,
    emailVerificationTokenExpires: { $gt: Date.now() },
  }).select('+emailVerificationToken +emailVerificationTokenExpires');

  if (!user) throw new AppError('Verification token is invalid or expired.', StatusCodes.BAD_REQUEST);

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationTokenExpires = undefined;
  await user.save({ validateBeforeSave: false });

  try { await emailService.sendWelcomeEmail(user); } catch (e) { logger.error('Welcome email failed', { error: e.message }); }

  return user.toJSON();
}

// Don't reveal whether an email exists.
async function forgotPassword(email) {
  const user = await User.findByEmail(email);
  if (!user) return;

  const rawToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    const url = `${env.FRONTEND_URL}/reset-password/${rawToken}`;
    await emailService.sendPasswordResetEmail(user, url);
  } catch (e) {
    user.passwordResetToken = undefined;
    user.passwordResetTokenExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new AppError('Failed to send reset email. Try again.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

async function resetPassword(rawToken, password) {
  const hashed = hashToken(rawToken);
  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetTokenExpires: { $gt: Date.now() },
  }).select('+passwordResetToken +passwordResetTokenExpires +refreshTokens');

  if (!user) throw new AppError('Reset token is invalid or expired.', StatusCodes.BAD_REQUEST);

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetTokenExpires = undefined;
  user.refreshTokens = [];
  await user.save();

  return user.toJSON();
}

// Rotate refresh tokens.
async function refreshAccessToken(refreshToken) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid or expired refresh token.', StatusCodes.UNAUTHORIZED);
  }

  const hashed = hashToken(refreshToken);
  const user = await User.findById(decoded.id).select('+refreshTokens');

  if (!user || !user.refreshTokens.includes(hashed))
    throw new AppError('Refresh token revoked. Please log in again.', StatusCodes.UNAUTHORIZED);

  if (user.isBlocked) throw new AppError('Account suspended.', StatusCodes.FORBIDDEN);

  const tokens = generateTokenPair(user);
  const newHashed = hashToken(tokens.refreshToken);
  user.refreshTokens = user.refreshTokens.filter((t) => t !== hashed).concat(newHashed).slice(0, 5);
  await user.save({ validateBeforeSave: false });

  return tokens;
}

async function logout(userId, refreshToken) {
  if (!refreshToken) return;
  const hashed = hashToken(refreshToken);
  await User.findByIdAndUpdate(userId, { $pull: { refreshTokens: hashed } });
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+password +refreshTokens');
  if (!user) throw new AppError('User not found.', StatusCodes.NOT_FOUND);

  const valid = await user.comparePassword(currentPassword);
  if (!valid) throw new AppError('Current password is incorrect.', StatusCodes.UNAUTHORIZED);

  user.password = newPassword;
  user.refreshTokens = [];
  await user.save();

  return user.toJSON();
}

module.exports = { register, login, verifyEmail, forgotPassword, resetPassword, refreshAccessToken, logout, changePassword };
