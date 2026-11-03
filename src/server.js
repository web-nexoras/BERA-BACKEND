'use strict';

const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const logger = require('./utils/logger');
const { initJobs } = require('./jobs/index');

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: String(reason) });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception — shutting down', { error: err.message, stack: err.stack });
  process.exit(1);
});

async function bootstrap() {
  try {
    await connectDB();

    // seed default shipping zones if not present
    try {
      const { seedDefaultZones } = require('./modules/shipping/shipping.service');
      await seedDefaultZones();
    } catch (seedErr) {
      logger.warn('Shipping zone seeding skipped', { error: seedErr.message });
    }

    const server = app.listen(env.PORT, () => {
      logger.info(`Nexora Fashions Backend running on port ${env.PORT}`);
      logger.info(`   Environment : ${env.NODE_ENV}`);
      logger.info(`   API Base    : ${env.APP_URL}/api/v1`);
      if (env.SWAGGER_ENABLED) logger.info(`   API Docs    : ${env.APP_URL}/api-docs`);
    });

    initJobs();

    const shutdown = (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        logger.info('HTTP server closed');
        try {
          const mongoose = require('mongoose');
          await mongoose.connection.close();
          logger.info('MongoDB connection closed');
        } catch {}
        process.exit(0);
      });
      // force exit if shutdown takes too long
      setTimeout(() => { logger.error('Forced shutdown after timeout'); process.exit(1); }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

bootstrap();
