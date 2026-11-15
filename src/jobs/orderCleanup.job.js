'use strict';

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

async function runOrderCleanup() {
  const acquired = await acquireLock();
  if (!acquired) {
    logger.debug('orderCleanup: lock not acquired, skipping');
    return;
  }

  const startTime = Date.now();
  logger.info('[orderCleanup] Starting...');

  try {
    const cutoffTime = new Date(Date.now() - env.UNPAID_ORDER_CANCEL_MINUTES * 60 * 1000);

    const unpaidOrders = await Order.find({
      orderStatus: 'pending',
      paymentMethod: 'sslcommerz',
      paymentStatus: { $in: ['pending', 'failed'] },
      createdAt: { $lt: cutoffTime },
    });

    logger.info(`[orderCleanup] Found ${unpaidOrders.length} unpaid order(s) to cancel`);

    let cancelled = 0;
    for (const order of unpaidOrders) {
      try {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          const cancelledOrder = await Order.findOneAndUpdate(
            {
              _id: order._id,
              orderStatus: 'pending',
              paymentStatus: { $in: ['pending', 'failed'] },
            },
            {
              $set: {
                orderStatus: 'cancelled',
                paymentStatus: 'failed',
                cancelReason: 'Auto-cancelled: payment not received within time limit',
              },
              $push: {
                statusHistory: {
                  status: 'cancelled',
                  note: 'Auto-cancelled by system',
                  updatedAt: new Date(),
                },
              },
            },
            { session, new: true },
          );

          if (!cancelledOrder) {
            await session.commitTransaction();
            continue;
          }

          for (const item of cancelledOrder.items) {
            await releaseStock(item.variant.toString(), item.quantity, session, cancelledOrder.orderNumber);
          }
          await Payment.findOneAndUpdate({ order: cancelledOrder._id }, { status: 'failed' }, { session });
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

    logger.info(`[orderCleanup] Completed — cancelled ${cancelled} order(s) in ${Date.now() - startTime}ms`);
  } catch (err) {
    logger.error('[orderCleanup] Job failed', { error: err.message });
  }
}

module.exports = { runOrderCleanup };
