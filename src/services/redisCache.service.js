'use strict';

const logger = require('../utils/logger');

// lazy-load redis config to avoid circular deps at startup
const redisConfig = (() => { try { return require('../config/redis'); } catch { return null; } })();
const getClient = () => redisConfig?.redisClient || null;

const cacheGet = async (key) => {
  try {
    const client = getClient();
    if (!client) return null;
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn('cacheGet error', { key, err: err.message });
    return null;
  }
};

const cacheSet = async (key, data, ttl = 300) => {
  try {
    const client = getClient();
    if (!client) return;
    const serialised = JSON.stringify(data);
    if (ttl > 0) await client.setex(key, ttl, serialised);
    else await client.set(key, serialised);
  } catch (err) {
    logger.warn('cacheSet error', { key, err: err.message });
  }
};

const cacheDel = async (key) => {
  try {
    const client = getClient();
    if (!client) return;
    await client.del(key);
  } catch (err) {
    logger.warn('cacheDel error', { key, err: err.message });
  }
};

// uses SCAN to avoid blocking Redis on large keyspaces
const cacheDelPattern = async (pattern) => {
  const client = getClient();
  if (!client) return 0;

  let cursor = '0';
  let totalDeleted = 0;

  try {
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        const pipeline = client.pipeline();
        keys.forEach((k) => pipeline.del(k));
        await pipeline.exec();
        totalDeleted += keys.length;
      }
    } while (cursor !== '0');

    if (totalDeleted > 0) logger.debug('Cache pattern deleted', { pattern, totalDeleted });
    return totalDeleted;
  } catch (err) {
    logger.warn('cacheDelPattern error', { pattern, err: err.message });
    return 0;
  }
};

// cache-aside: return cached data or fetch fresh, store, and return
const withCache = async (key, ttl, fetchFn) => {
  try {
    const cached = await cacheGet(key);
    if (cached !== null) { logger.debug('Cache HIT', { key }); return cached; }
    logger.debug('Cache MISS', { key });
    const fresh = await fetchFn();
    await cacheSet(key, fresh, ttl);
    return fresh;
  } catch (err) {
    logger.warn('withCache error — falling through to DB', { key, err: err.message });
    return fetchFn();
  }
};

const invalidateProductCache = async (productId) => {
  await Promise.all([
    cacheDel(`product:${productId}`),
    cacheDelPattern(`product:${productId}:*`),
    cacheDelPattern('products:list:*'),
    cacheDelPattern('products:search:*'),
    cacheDelPattern('featured:*'),
    cacheDelPattern('bestsellers:*'),
  ]);
  logger.debug('Product cache invalidated', { productId });
};

const invalidateCategoryCache = async () => {
  await cacheDelPattern('categories:*');
  await cacheDelPattern('category:*');
  logger.debug('Category cache invalidated');
};

const invalidateBrandCache = async () => {
  await cacheDelPattern('brands:*');
  await cacheDelPattern('brand:*');
  logger.debug('Brand cache invalidated');
};

const invalidateFeaturedCache = async () => {
  await cacheDelPattern('featured:*');
  logger.debug('Featured products cache invalidated');
};

module.exports = {
  cacheGet, cacheSet, cacheDel, cacheDelPattern,
  withCache, invalidateProductCache, invalidateCategoryCache,
  invalidateBrandCache, invalidateFeaturedCache,
};
