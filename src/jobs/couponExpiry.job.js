'use strict';

/**
 * @file couponExpiry.job.js
 */

const Coupon = require('../modules/coupon/coupon.model');
const { redisClient, isAvailable } = require('../config/redis');
const logger = require('../utils/logger');

const LOCK_KEY = 'lock:job:couponExpiry';
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

async function runCouponExpiry() {
  const acquired = await acquireLock();
  if (!acquired) {
    logger.debug('couponExpiry: lock not acquired, skipping');
    return;
  }

  logger.info('🔄 [couponExpiry] Starting...');
  try {
    const result = await Coupon.updateMany(
      { expiresAt: { $lt: new Date() }, isActive: true },
      { isActive: false },
    );
    logger.info(`✅ [couponExpiry] Deactivated ${result.modifiedCount} expired coupon(s)`);
  } catch (err) {
    logger.error('❌ [couponExpiry] Job failed', { error: err.message });
  } finally {
    await releaseLock();
  }
}

module.exports = { runCouponExpiry };
