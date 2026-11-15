'use strict';

require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { StatusCodes } = require('http-status-codes');

const env = require('./config/env');
const logger = require('./utils/logger');
const apiRoutes = require('./routes/index');
const errorMiddleware = require('./middlewares/errorMiddleware');
const maintenanceMode = require('./middlewares/maintenanceMode');

const app = express();
app.set('trust proxy', env.TRUST_PROXY);

app.use(helmet());

// Return a predictable client error for disallowed browser origins.
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && !env.CORS_ORIGINS_LIST.includes(origin)) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: 'Origin not allowed',
    });
  }
  return next();
});

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
    exposedHeaders: ['X-Session-Id'],
  }),
);

app.use(maintenanceMode);

app.use(compression());

if (env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
});

// Stricter auth rate limit.
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

const orderTrackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many order tracking attempts. Please try again later.' },
});

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification attempts. Please try again later.' },
});

app.use('/api/', generalLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
app.use('/api/v1/auth/reset-password', authLimiter);
app.use('/api/v1/auth/refresh-token', authLimiter);
app.use('/api/v1/auth/verify-email', verificationLimiter);
app.use('/api/v1/auth/resend-verification', verificationLimiter);
app.use('/api/v1/orders/track', orderTrackingLimiter);

if (env.SWAGGER_ENABLED) {
  const { swaggerSpec, swaggerUi, swaggerUiOptions } = require('./docs/swagger');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  logger.info(`Swagger UI available at ${env.APP_URL}/api-docs`);
}

app.use('/api/v1', apiRoutes);

app.use((req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use(errorMiddleware);

module.exports = app;
