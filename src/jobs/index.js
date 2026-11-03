'use strict';

const cron = require('node-cron');
const env = require('../config/env');
const logger = require('../utils/logger');

const { runOrderCleanup } = require('./orderCleanup.job');
const { runCouponExpiry } = require('./couponExpiry.job');
const { runInventoryAlert } = require('./inventoryAlert.job');
const { runDailyReport } = require('./dailyReport.job');
const { runClearOtps } = require('./clearOtps.job');

// Redis locks prevent duplicate cron runs.
function initJobs() {
  const TZ = env.CRON_TIMEZONE;
  logger.info('Initializing cron jobs...', { timezone: TZ });

  cron.schedule(env.CRON_ORDER_CLEANUP, async () => { await runOrderCleanup(); }, { timezone: TZ });
  logger.info(`  Order Cleanup: ${env.CRON_ORDER_CLEANUP}`);

  cron.schedule(env.CRON_COUPON_EXPIRY, async () => { await runCouponExpiry(); }, { timezone: TZ });
  logger.info(`  Coupon Expiry: ${env.CRON_COUPON_EXPIRY}`);

  cron.schedule(env.CRON_INVENTORY_ALERT, async () => { await runInventoryAlert(); }, { timezone: TZ });
  logger.info(`  Inventory Alert: ${env.CRON_INVENTORY_ALERT}`);

  cron.schedule(env.CRON_DAILY_REPORT, async () => { await runDailyReport(); }, { timezone: TZ });
  logger.info(`  Daily Report: ${env.CRON_DAILY_REPORT}`);

  cron.schedule(env.CRON_CLEAR_OTPS, async () => { await runClearOtps(); }, { timezone: TZ });
  logger.info(`  Clear OTPs: ${env.CRON_CLEAR_OTPS}`);

  logger.info('All cron jobs initialized');
}

module.exports = { initJobs };
