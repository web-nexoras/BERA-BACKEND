'use strict';

/**
 * @file env.js
 * @description Environment variable validation and export using Zod.
 *              Loads .env file and validates all required/optional variables.
 *              Exits the process with a clear error if required vars are missing.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const { z } = require('zod');

// ---------------------------------------------------------------------------
// Zod schema for all environment variables
// ---------------------------------------------------------------------------
const envSchema = z.object({
  // ── App ──────────────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  APP_URL: z.string().url().default('http://localhost:5000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // ── Database ─────────────────────────────────────────────────────────────
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // ── JWT ──────────────────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // ── Redis ────────────────────────────────────────────────────────────────
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_URL: z.string().optional().default(''),
  REDIS_CACHE_TTL_PRODUCTS: z.coerce.number().int().positive().default(300),
  REDIS_CACHE_TTL_CATEGORIES: z.coerce.number().int().positive().default(600),
  REDIS_CACHE_TTL_FEATURED: z.coerce.number().int().positive().default(300),
  REDIS_CACHE_TTL_BESTSELLERS: z.coerce.number().int().positive().default(300),

  // ── Cloudinary ───────────────────────────────────────────────────────────
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),

  // ── Email / Brevo ────────────────────────────────────────────────────────
  BREVO_API_KEY: z.string().min(1, 'BREVO_API_KEY is required'),
  EMAIL_FROM_NAME: z.string().default('Nexora Fashions'),
  EMAIL_FROM_ADDRESS: z.string().email().default('noreply@nexorafashions.com'),
  EMAIL_SUPPORT_ADDRESS: z
    .string()
    .email()
    .default('support@nexorafashions.com'),

  // ── SSLCommerz ───────────────────────────────────────────────────────────
  SSLCOMMERZ_STORE_ID: z.string().min(1, 'SSLCOMMERZ_STORE_ID is required'),
  SSLCOMMERZ_STORE_PASS: z.string().min(1, 'SSLCOMMERZ_STORE_PASS is required'),
  SSLCOMMERZ_IS_LIVE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  SSLCOMMERZ_SUCCESS_URL: z.string().url().optional().default(''),
  SSLCOMMERZ_FAIL_URL: z.string().url().optional().default(''),
  SSLCOMMERZ_CANCEL_URL: z.string().url().optional().default(''),
  SSLCOMMERZ_IPN_URL: z.string().url().optional().default(''),

  // ── CORS ─────────────────────────────────────────────────────────────────
  /** Comma-separated list of allowed origins */
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000), // 15 min
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  // ── OTP / Password Reset ──────────────────────────────────────────────────
  OTP_EXPIRES_IN_MINUTES: z.coerce.number().int().positive().default(10),
  PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(30),

  // ── Shipping ─────────────────────────────────────────────────────────────
  SHIPPING_CHARGE_INSIDE_DHAKA: z.coerce.number().nonnegative().default(60),
  SHIPPING_CHARGE_OUTSIDE_DHAKA: z.coerce.number().nonnegative().default(120),

  // ── Orders ───────────────────────────────────────────────────────────────
  UNPAID_ORDER_CANCEL_MINUTES: z.coerce.number().int().positive().default(30),

  // ── Admin Defaults ────────────────────────────────────────────────────────
  ADMIN_DEFAULT_EMAIL: z
    .string()
    .email()
    .default('admin@nexorafashions.com'),
  ADMIN_DEFAULT_PASSWORD: z
    .string()
    .min(8)
    .default('Admin@123456'),

  // ── Cron ─────────────────────────────────────────────────────────────────
  CRON_ORDER_CLEANUP: z.string().default('*/30 * * * *'),
  CRON_COUPON_EXPIRY: z.string().default('0 0 * * *'),
  CRON_INVENTORY_ALERT: z.string().default('0 9 * * *'),
  CRON_DAILY_REPORT: z.string().default('0 8 * * *'),
  CRON_CLEAR_OTPS: z.string().default('*/15 * * * *'),
  CRON_TIMEZONE: z.string().default('Asia/Dhaka'),

  // ── Swagger ───────────────────────────────────────────────────────────────
  SWAGGER_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),

  // ── Logging ───────────────────────────────────────────────────────────────
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'debug'])
    .default('info'),

  // ── Security ──────────────────────────────────────────────────────────────
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),
});

// ---------------------------------------------------------------------------
// Parse & validate
// ---------------------------------------------------------------------------
const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  const formatted = _parsed.error.errors
    .map((e) => `  ✗ ${e.path.join('.')}: ${e.message}`)
    .join('\n');

  console.error(
    '\n❌  Environment variable validation failed:\n' + formatted + '\n',
  );
  process.exit(1);
}

const env = _parsed.data;

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** Parsed list of allowed CORS origins */
env.CORS_ORIGINS_LIST = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

/** Whether the app is running in production */
env.IS_PRODUCTION = env.NODE_ENV === 'production';

/** Whether the app is running in development */
env.IS_DEVELOPMENT = env.NODE_ENV === 'development';

module.exports = env;
