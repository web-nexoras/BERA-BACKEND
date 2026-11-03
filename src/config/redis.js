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
      if (times > 5) {
        logger.warn('Redis: max reconnection attempts reached – operating without cache');
        return null;
      }
      return Math.min(times * 500, 5000);
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

// alias: setEx(key, ttl, value)
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

// delete all keys matching a glob pattern, e.g. "products:*"
async function delByPattern(pattern) {
  if (!isAvailable()) return 0;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length === 0) return 0;
    return await redisClient.del(...keys);
  } catch (err) {
    logger.error('Redis DEL pattern error', { pattern, error: err.message });
    return 0;
  }
}

module.exports = { redisClient, isAvailable, get, set, setEx, del, exists, delByPattern };
