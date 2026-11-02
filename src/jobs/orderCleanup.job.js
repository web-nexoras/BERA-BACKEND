'use strict';

/**
 * @file orderCleanup.job.js
 * @description Auto-cancel unpaid SSLCommerz orders after configurable timeout.
 */

const mongoose = require('mongoose');
const Order = require('../modules/order/order.model');
const Payment = require('../modules/payment/payment.model');
const { releaseStock } = require('../modules/inventory/inventory.service');
const { redisClient, isAvailable } = require('../config/redis');
const logger = require('../utils/logger');
const env = require('../config/env');

const LOCK_KEY = 'lock:job:orderCleanup';
const LOCK_TTL = 55; // seconds (shorter than shortest cron interval)

async function acquireLock() {
  if (!isAvailable()) return true; // allow if Redis unavailable
  try {
    const result = await redisClient.set(LOCK_KEY, '1', 'EX', LOCK_TTL, 'NX');
    return result === 'OK';
  } catch { return true; }
}

async function releaseLock() {
  if (!isAvailable()) return;
  try { await redisClient.del(LOCK_KEY); } catch {}
}

async function runOrderCleanup() {
  const acquired = await acquireLock();
  if (!acquired) {
    logger.debug('orderCleanup: lock not acquired, skipping');
    return;
  }

  const startTime = Date.now();
  logger.info('🔄 [orderCleanup] Starting...');

  try {
    const cutoffTime = new Date(Date.now() - env.UNPAID_ORDER_CANCEL_MINUTES * 60 * 1000);

    const unpaidOrders = await Order.find({
      orderStatus: 'pending',
      paymentMethod: 'sslcommerz',
      paymentStatus: 'pending',
      createdAt: { $lt: cutoffTime },
    });

    logger.info(`[orderCleanup] Found ${unpaidOrders.length} unpaid order(s) to cancel`);

    let cancelled = 0;
    for (const order of unpaidOrders) {
      try {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          // Release stock
          for (const item of order.items) {
            await releaseStock(item.variant.toString(), item.quantity, session);
          }
          order.orderStatus = 'cancelled';
          order.cancelReason = 'Auto-cancelled: payment not received within time limit';
          order.statusHistory.push({
            status: 'cancelled',
            note: 'Auto-cancelled by system',
            updatedAt: new Date(),
          });
          await order.save({ session });
          await Payment.findOneAndUpdate({ order: order._id }, { status: 'failed' }, { session });
          await session.commitTransaction();
          cancelled++;
        } catch (err) {
          await session.abortTransaction();
          logger.error('[orderCleanup] Failed to cancel order', { orderId: order._id, error: err.message });
        } finally {
          session.endSession();
        }
      } catch (err) {
        logger.error('[orderCleanup] Session error', { orderId: order._id, error: err.message });
      }
    }

    logger.info(`✅ [orderCleanup] Completed — cancelled ${cancelled} order(s) in ${Date.now() - startTime}ms`);
  } catch (err) {
    logger.error('❌ [orderCleanup] Job failed', { error: err.message });
  } finally {
    await releaseLock();
  }
}

module.exports = { runOrderCleanup };
