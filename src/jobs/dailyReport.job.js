'use strict';

const { sendDailyReportEmail } = require('../services/email.service');
const { redisClient, isAvailable } = require('../config/redis');
const logger = require('../utils/logger');
const env = require('../config/env');

const LOCK_KEY = 'lock:job:dailyReport';
const LOCK_TTL = 3600;

async function acquireLock() {
  if (!isAvailable()) return true;
  try {
    const result = await redisClient.set(LOCK_KEY, '1', 'EX', LOCK_TTL, 'NX');
    return result === 'OK';
  } catch { return true; }
}

async function releaseLock() {
  if (!isAvailable()) return;
  try { await redisClient.del(LOCK_KEY); } catch {}
}

async function runDailyReport() {
  const acquired = await acquireLock();
  if (!acquired) {
    logger.debug('dailyReport: lock not acquired, skipping');
    return;
  }

  logger.info('[dailyReport] Generating daily report...');
  try {
    const adminService = require('../modules/admin/admin.service');
    const stats = await adminService.getDashboardStats();

    await sendDailyReportEmail(env.ADMIN_DEFAULT_EMAIL, {
      ordersToday: stats.ordersToday,
      revenueToday: stats.revenueToday,
      newCustomersToday: stats.newCustomersToday,
      deliveredOrders: stats.deliveredOrders,
      cancelledOrders: stats.cancelledOrders,
    });

    logger.info('[dailyReport] Report sent to admin');
  } catch (err) {
    logger.error('[dailyReport] Job failed', { error: err.message });
  } finally {
    await releaseLock();
  }
}

module.exports = { runDailyReport };
