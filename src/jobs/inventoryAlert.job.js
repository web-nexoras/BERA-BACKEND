'use strict';

/**
 * @file inventoryAlert.job.js
 */

const ProductVariant = require('../modules/variant/variant.model');
const { sendLowStockAlertEmail } = require('../services/email.service');
const { redisClient, isAvailable } = require('../config/redis');
const logger = require('../utils/logger');
const env = require('../config/env');

const LOCK_KEY = 'lock:job:inventoryAlert';
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

async function runInventoryAlert() {
  const acquired = await acquireLock();
  if (!acquired) {
    logger.debug('inventoryAlert: lock not acquired, skipping');
    return;
  }

  logger.info('🔄 [inventoryAlert] Starting...');
  try {
    const lowStockVariants = await ProductVariant.find({
      $expr: {
        $and: [
          { $lte: ['$stock', '$lowStockThreshold'] },
          { $gt: ['$stock', 0] },
        ],
      },
      isActive: true,
    })
      .populate('product', 'name sku')
      .lean();

    const outOfStockVariants = await ProductVariant.find({ stock: 0, isActive: true })
      .populate('product', 'name sku')
      .lean();

    const alertVariants = [...outOfStockVariants, ...lowStockVariants];

    if (alertVariants.length > 0) {
      await sendLowStockAlertEmail(env.ADMIN_DEFAULT_EMAIL, alertVariants);
      logger.info(`✅ [inventoryAlert] Alert sent — ${outOfStockVariants.length} out-of-stock, ${lowStockVariants.length} low-stock variants`);
    } else {
      logger.info('✅ [inventoryAlert] No stock issues found');
    }
  } catch (err) {
    logger.error('❌ [inventoryAlert] Job failed', { error: err.message });
  } finally {
    await releaseLock();
  }
}

module.exports = { runInventoryAlert };
