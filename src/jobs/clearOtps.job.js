'use strict';

const User = require('../modules/auth/auth.model');
const { redisClient, isAvailable } = require('../config/redis');
const logger = require('../utils/logger');

const LOCK_KEY = 'lock:job:clearOtps';
const LOCK_TTL = 300;

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

async function runClearOtps() {
  const acquired = await acquireLock();
  if (!acquired) {
    logger.debug('clearOtps: lock not acquired, skipping');
    return;
  }

  logger.info('[clearOtps] Clearing expired tokens...');
  try {
    const now = new Date();

    // Clear expired password reset tokens
    const resetResult = await User.updateMany(
      { passwordResetTokenExpires: { $lt: now } },
      { $unset: { passwordResetToken: '', passwordResetTokenExpires: '' } },
    );

    // Clear expired email verification tokens
    const verifyResult = await User.updateMany(
      { emailVerificationTokenExpires: { $lt: now }, isEmailVerified: false },
      { $unset: { emailVerificationToken: '', emailVerificationTokenExpires: '' } },
    );

    // Clear OTP keys from Redis
    let otpCleared = 0;
    if (isAvailable()) {
      try {
        const otpKeys = await redisClient.keys('otp:*');
        if (otpKeys.length > 0) {
          otpCleared = await redisClient.del(...otpKeys);
        }
      } catch (redisErr) {
        logger.error('[clearOtps] Redis OTP clear error', { error: redisErr.message });
      }
    }

    logger.info(
      `[clearOtps] Done — reset tokens: ${resetResult.modifiedCount}, ` +
      `verify tokens: ${verifyResult.modifiedCount}, Redis OTPs: ${otpCleared}`,
    );
  } catch (err) {
    logger.error('[clearOtps] Job failed', { error: err.message });
  } finally {
    await releaseLock();
  }
}

module.exports = { runClearOtps };
