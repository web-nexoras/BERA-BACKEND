'use strict';

const { z } = require('zod');

const emailField = z
  .string({ required_error: 'Email is required' })
  .email('Please provide a valid email address')
  .toLowerCase()
  .trim();

const passwordField = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/,
    'Password must contain at least one special character',
  );

const phoneField = z
  .string()
  .regex(
    /^(?:\+?880|0)1[3-9]\d{8}$/,
    'Please provide a valid Bangladeshi phone number',
  )
  .optional();

const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: emailField,
  password: passwordField,
  phone: phoneField,
});

const loginSchema = z.object({
  email: emailField,
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: emailField,
});

const resetPasswordParamsSchema = z.object({
  token: z
    .string({ required_error: 'Reset token is required' })
    .min(1, 'Reset token is required'),
});

const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string({ required_error: 'Please confirm your password' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const verifyEmailSchema = z.object({
  token: z
    .string({ required_error: 'Verification token is required' })
    .min(1, 'Verification token is required'),
});


const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: 'Current password is required' })
      .min(1, 'Current password is required'),
    newPassword: passwordField,
    confirmPassword: z.string({ required_error: 'Please confirm your new password' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: 'Refresh token is required' })
    .min(1, 'Refresh token is required'),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordParamsSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
  refreshTokenSchema,
};
