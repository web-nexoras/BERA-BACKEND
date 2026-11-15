'use strict';

const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

let redisClient = null;
let isRedisConnected = false;

function createRedisClient() {
  const commonOptions = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
      const delay = Math.min(500 * (2 ** Math.min(times - 1, 16)), 30_000);
      logger.warn('Redis reconnect scheduled', { attempt: times, delayMs: delay });
      return delay;
    },
  };

  if (env.REDIS_URL) {
    return new Redis(env.REDIS_URL, commonOptions);
  }

  return new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    ...commonOptions,
  });
}

try {
  redisClient = createRedisClient();

  redisClient.on('connect', () => logger.info('Redis client connected'));
  redisClient.on('ready', () => { isRedisConnected = true; logger.info('Redis client ready'); });
  redisClient.on('error', (err) => { isRedisConnected = false; logger.error('Redis error', { error: err.message }); });
  redisClient.on('close', () => { isRedisConnected = false; logger.warn('Redis connection closed'); });
  redisClient.on('reconnecting', () => logger.info('Redis reconnecting…'));
  redisClient.on('end', () => { isRedisConnected = false; logger.warn('Redis connection ended'); });
} catch (err) {
  logger.error('Failed to create Redis client – cache disabled', { error: err.message });
  redisClient = null;
}

function isAvailable() {
  return redisClient !== null && isRedisConnected;
}

async function get(key) {
  if (!isAvailable()) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error('Redis GET error', { key, error: err.message });
    return null;
  }
}

async function set(key, value, ttl) {
  if (!isAvailable()) return false;
  try {
    const serialised = JSON.stringify(value);
    if (ttl && ttl > 0) {
      await redisClient.set(key, serialised, 'EX', ttl);
    } else {
      await redisClient.set(key, serialised);
    }
    return true;
  } catch (err) {
    logger.error('Redis SET error', { key, error: err.message });
    return false;
  }
}

async function setEx(key, ttl, value) {
  return set(key, value, ttl);
}

async function del(...keys) {
  if (!isAvailable()) return 0;
  try {
    return await redisClient.del(...keys);
  } catch (err) {
    logger.error('Redis DEL error', { keys, error: err.message });
    return 0;
  }
}

async function exists(key) {
  if (!isAvailable()) return false;
  try {
    const count = await redisClient.exists(key);
    return count > 0;
  } catch (err) {
    logger.error('Redis EXISTS error', { key, error: err.message });
    return false;
  }
}

async function delByPattern(pattern) {
  if (!isAvailable()) return 0;
  try {
    let cursor = '0';
    let totalDeleted = 0;
    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length) {
        const pipeline = redisClient.pipeline();
        for (const key of keys) pipeline.del(key);
        const results = await pipeline.exec();
        totalDeleted += results.reduce((count, [err, deleted]) => count + (err ? 0 : deleted), 0);
      }
    } while (cursor !== '0');
    return totalDeleted;
  } catch (err) {
    logger.error('Redis DEL pattern error', { pattern, error: err.message });
    return 0;
  }
}

module.exports = { redisClient, isAvailable, get, set, setEx, del, exists, delByPattern };
