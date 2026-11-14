# Nexora Fashions Backend API

REST API backend for the Nexora Fashions e-commerce platform. It provides customer authentication, product discovery, cart and checkout, order and payment handling, inventory controls, and administrative reporting.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Environment configuration](#environment-configuration)
- [Run the server](#run-the-server)
- [API overview](#api-overview)
- [Authentication](#authentication)
- [Request and response conventions](#request-and-response-conventions)
- [Background jobs](#background-jobs)
- [Project structure](#project-structure)
- [Operational notes](#operational-notes)

## Features

- Registration, login, email verification, password reset/change, JWT access and refresh tokens.
- Customer profiles and delivery address book.
- Product catalogue with categories, brands, variants, images, search/filtering, featured items, new arrivals, and best sellers.
- Guest and signed-in shopping carts, coupon application, and wishlist management.
- Checkout, order tracking and management, stock reservation/release, and invoice generation.
- Cash on delivery and SSLCommerz payment callbacks, transaction history, and admin refunds.
- Admin inventory adjustments and stock history, customer controls, store settings, and sales/inventory reports.
- Cloudinary image storage, Brevo email integration, optional Redis caching, request validation, rate limiting, structured logging, and Swagger UI.

## Technology

Node.js (CommonJS), Express 4, MongoDB with Mongoose, Redis with ioredis, Zod validation, JWT, Cloudinary, Brevo email delivery, SSLCommerz, and node-cron.

## Requirements

- Node.js compatible with the installed dependencies (Node.js 20 or later is recommended).
- npm.
- A MongoDB database. Checkout uses MongoDB transactions; use a replica set (including a single-node replica set for local development) for transaction support.
- Redis is used for caching and distributed job locks. The cache layer degrades when Redis is unavailable, but configure Redis for reliable production caching and job coordination.
- Credentials for Cloudinary, Brevo, and SSLCommerz are required by the current startup environment validation, even if you are not exercising those integrations locally.

## Getting started

```bash
npm install
```

Copy `.env.example` to `.env`, then fill in the required values. Never commit `.env` or production credentials.

PowerShell:

```powershell
Copy-Item .env.example .env
```

Create secure JWT secrets of at least 32 characters each and set a valid MongoDB connection string. Configure the remaining required integration values as described below.

## Environment configuration

The application loads `.env` from the project working directory and validates configuration at startup. Invalid or missing required values stop the process with a list of configuration errors.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production`. |
| `PORT` | HTTP port; defaults to `5000`. |
| `APP_URL` | Public base URL used in logs and Swagger server definitions. |
| `FRONTEND_URL` | Frontend URL used by email and related flows. |
| `MONGODB_URI` | MongoDB connection string; required. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Separate signing secrets, each at least 32 characters. |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Token lifetimes, for example `15m` and `7d`. |
| `REDIS_URL` or `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Redis connection settings. `REDIS_URL` takes precedence when set. |
| `REDIS_CACHE_TTL_PRODUCTS`, `REDIS_CACHE_TTL_CATEGORIES`, `REDIS_CACHE_TTL_FEATURED`, `REDIS_CACHE_TTL_BESTSELLERS` | Cache durations in seconds. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Required Cloudinary credentials for image uploads. |
| `BREVO_API_KEY`, `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`, `EMAIL_SUPPORT_ADDRESS` | Email delivery credentials and sender addresses. `BREVO_API_KEY` is required. |
| `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASS`, `SSLCOMMERZ_IS_LIVE` | Payment gateway credentials and sandbox/live selection. Store credentials are required at startup. |
| `SSLCOMMERZ_SUCCESS_URL`, `SSLCOMMERZ_FAIL_URL`, `SSLCOMMERZ_CANCEL_URL`, `SSLCOMMERZ_IPN_URL` | Payment callback URLs. Set these to publicly reachable HTTPS endpoints in deployed environments. |
| `CORS_ORIGINS` | Comma-separated allowlist of frontend origins. Requests without an Origin header are allowed. |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `AUTH_RATE_LIMIT_MAX` | General and authentication rate limits. |
| `OTP_EXPIRES_IN_MINUTES`, `PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES` | OTP and password reset expiry. |
| `SHIPPING_CHARGE_INSIDE_DHAKA`, `SHIPPING_CHARGE_OUTSIDE_DHAKA` | Default shipping charges (BDT); shipping zones are seeded at startup. |
| `UNPAID_ORDER_CANCEL_MINUTES` | Age after which unpaid SSLCommerz orders are cancelled and reserved stock is released. |
| `ADMIN_DEFAULT_EMAIL`, `ADMIN_DEFAULT_PASSWORD` | Admin defaults used by admin-related setup. Change the password before deployment. |
| `CRON_ORDER_CLEANUP`, `CRON_COUPON_EXPIRY`, `CRON_INVENTORY_ALERT`, `CRON_DAILY_REPORT`, `CRON_CLEAR_OTPS` | Cron expressions for scheduled jobs. |
| `CRON_TIMEZONE` | Timezone used by scheduled jobs; defaults to `Asia/Dhaka`. |
| `SWAGGER_ENABLED` | Set to `true` or `false` to enable/disable the docs UI. |
| `LOG_LEVEL` | Winston log level: `error`, `warn`, `info`, `http`, or `debug`. |
| `BCRYPT_SALT_ROUNDS` | Password hashing cost; supported range is 8–15. |

Values shown in `.env.example` are placeholders, not working secrets. The exact runtime defaults are defined in `src/config/env.js`; mandatory credentials must still be supplied.

## Run the server

```bash
# Development mode with Node's watch mode
npm run dev

# Normal start
npm start

# Production start (the package script uses NODE_ENV=production)
npm run start:prod
```

On boot the service connects to MongoDB, attempts to seed default shipping zones, starts listening, and initializes scheduled jobs. Local base URLs with the default port:

- API: `http://localhost:5000/api/v1`
- Health: `http://localhost:5000/api/v1/health`
- Swagger UI: `http://localhost:5000/api-docs` (when `SWAGGER_ENABLED=true`)

The health endpoint reports process/API availability; it is not a full dependency readiness check.

## API overview

All routes below are relative to `/api/v1`. See Swagger UI for the documented request schemas and interactive API explorer.

| Prefix | Purpose | Access |
| --- | --- | --- |
| `/health` | Basic API health response | Public |
| `/auth` | Register/login, email verification, password and token flows | Mostly public; logout/password change require a token |
| `/users` | Profile and address book | Signed-in user |
| `/categories`, `/brands` | Browse catalogue taxonomy; create/update/delete | Reads public; writes admin |
| `/products` | Browse/search products, featured/new/best sellers, related items | Reads public; writes, variants and images admin |
| `/inventory` | Inventory list, low/out-of-stock views, adjustments and history | Admin |
| `/cart` | Cart summary/items/coupons; guest cart merge | Guest or signed-in; merge requires login |
| `/wishlist` | Wishlist and move item to cart | Signed-in user |
| `/coupons` | Validate coupon; manage coupon records | Validation requires login; management admin |
| `/orders` | Checkout, order history/detail/cancel, tracking, admin order operations and invoices | Checkout/tracking guest-friendly; personal routes require login; admin operations admin |
| `/payments` | Initiate payment, callbacks, transactions, admin refunds | User routes require login; callbacks public for gateway; admin routes admin |
| `/returns` | Create/list own returns; manage returns | Signed-in user; admin management admin |
| `/shipping` | List zones and calculate charge; manage zones | Reads public; writes admin |
| `/admin` | Dashboard, sales/inventory reports, customer controls and store settings | Admin |

### Common workflows

1. Register or log in at `/auth`; retain the returned access token for protected routes.
2. Browse `/categories`, `/brands`, and `/products`. Product listing supports query filters and pagination; see Swagger for the exact query fields.
3. Add items to `/cart/items` (guest sessions are supported), optionally apply a coupon, and submit `/orders/checkout` with a shipping address and `paymentMethod` (`cod` or `sslcommerz`).
4. For SSLCommerz, configure the callback URLs and gateway credentials. Checkout/payment responses may include a payment URL; the gateway calls the configured success/fail/cancel/IPN endpoints.
5. Track a guest order through `/orders/track`, or use signed-in order history and admin order tools.

Example health request:

```bash
curl http://localhost:5000/api/v1/health
```

Example authenticated request:

```bash
curl http://localhost:5000/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Authentication

Protected endpoints use a JWT access token in the standard header:

```http
Authorization: Bearer <accessToken>
```

Admin routes additionally require an authenticated user with the admin role. Access and refresh tokens have separate signing secrets and configurable expiration. Never expose secrets or tokens in client-side public configuration or logs. Authentication endpoints have a stricter rate limit than the general API.

## Request and response conventions

- Request and response bodies use JSON unless a route handles an upload or payment callback.
- Request bodies, route parameters, and selected query parameters are validated with Zod schemas.
- Responses use a `success` boolean and a human-readable `message`; successful responses commonly include `data`. Paginated list responses may also include pagination metadata.
- Unknown routes return a JSON 404. Errors are handled by centralized error middleware.
- CORS permits configured origins from `CORS_ORIGINS` (comma-separated) and requests without an Origin header.
- The general `/api/` rate limiter and stricter login/register/forgot-password limiter are configurable via environment variables.

## Background jobs

Jobs start with the API process and use `CRON_TIMEZONE` (default `Asia/Dhaka`). Schedule expressions can be overridden with the corresponding environment variables:

- **Order cleanup:** cancels pending unpaid SSLCommerz orders after `UNPAID_ORDER_CANCEL_MINUTES` and releases reserved inventory.
- **Coupon expiry:** processes expired coupons.
- **Inventory alert:** checks low stock and sends alerts as implemented by the job.
- **Daily report:** prepares/sends the daily report as implemented by the job.
- **Clear OTPs:** removes expired OTP data.

Redis locks are used to avoid duplicate work across instances when Redis is available. If Redis is disconnected, jobs may run without distributed locking; deploy accordingly when running multiple API instances.

## Project structure

```text
src/
  app.js                  Express middleware and route setup
  server.js               Startup, database connection and graceful shutdown
  config/                 Environment, MongoDB, Redis and Cloudinary configuration
  docs/swagger.js         OpenAPI specification and Swagger UI settings
  jobs/                   Scheduled maintenance/report jobs
  middlewares/            Authentication, authorization, validation and error handling
  modules/                Feature modules (routes, controllers, services, models, validation)
  routes/index.js         API health endpoint and module route mounting
  services/               Shared email and Redis-cache services
  utils/                  Error, response, logging and helper utilities
scripts/
  sync-cart-indexes.js    Cart index synchronization utility
```

Feature modules include auth, user, category, brand, product, variant, inventory, cart, wishlist, coupon, order, payment, return, shipping, and admin.

## Operational notes

- Keep `.env` out of version control; `.gitignore` excludes it. Rotate any credentials that have been exposed.
- Use TLS at the public reverse proxy and HTTPS callback URLs in production.
- Set `CORS_ORIGINS` to the exact frontend origins that should be allowed. Avoid broad origins in production.
- Set strong, distinct JWT secrets and replace the default admin password before exposing the service.
- MongoDB transaction support is important for checkout, payment/order updates, and stock consistency.
- Redis is helpful for response caching and coordinating scheduled jobs across instances. Check logs and monitoring for connection errors.
- Logs are written through Winston; local log files/directories are excluded from Git.

## Available npm scripts

| Command | Description |
| --- | --- |
| `npm start` | Start `src/server.js`. |
| `npm run dev` | Start with Node watch mode for development. |
| `npm run start:prod` | Start with `NODE_ENV=production` (the script syntax is Unix-style; on Windows set `NODE_ENV=production` in the environment before running `npm start`). |
| `npm run db:sync-cart-indexes` | Run the cart index synchronization utility. |
