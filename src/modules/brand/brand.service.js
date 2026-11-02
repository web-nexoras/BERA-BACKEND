'use strict';

const Brand = require('./brand.model');
const { get, set, delByPattern } = require('../../config/redis');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { StatusCodes } = require('http-status-codes');

const CACHE_KEYS = { ALL: 'brands:all', SINGLE: (id) => `brands:${id}`, PATTERN: 'brands:*' };
const CACHE_TTL = 600;

async function getBrands(query = {}) {
  const { includeInactive = false } = query;
  const cacheKey = `${CACHE_KEYS.ALL}:inactive=${includeInactive}`;

  const cached = await get(cacheKey);
  if (cached) return cached;

  const filter = includeInactive ? {} : { isActive: true };
  const brands = await Brand.find(filter).sort({ name: 1 }).lean();

  await set(cacheKey, brands, CACHE_TTL);
  return brands;
}

async function getBrandById(id) {
  const cacheKey = CACHE_KEYS.SINGLE(id);
  const cached = await get(cacheKey);
  if (cached) return cached;

  const brand = await Brand.findById(id).lean();
  if (!brand) throw new AppError('Brand not found', StatusCodes.NOT_FOUND);

  await set(cacheKey, brand, CACHE_TTL);
  return brand;
}

async function createBrand(data) {
  const existing = await Brand.findOne({ name: data.name });
  if (existing) throw new AppError('A brand with this name already exists', StatusCodes.CONFLICT);

  const brand = await Brand.create(data);
  logger.info('Brand created', { id: brand._id, name: brand.name });
  await delByPattern(CACHE_KEYS.PATTERN);
  return brand;
}

async function updateBrand(id, data) {
  const brand = await Brand.findById(id);
  if (!brand) throw new AppError('Brand not found', StatusCodes.NOT_FOUND);

  if (data.name && data.name !== brand.name) {
    const conflict = await Brand.findOne({ name: data.name, _id: { $ne: id } });
    if (conflict) throw new AppError('A brand with this name already exists', StatusCodes.CONFLICT);
  }

  Object.assign(brand, data);
  const updated = await brand.save();
  logger.info('Brand updated', { id, changes: Object.keys(data) });
  await delByPattern(CACHE_KEYS.PATTERN);
  return updated;
}

async function deleteBrand(id) {
  const brand = await Brand.findById(id);
  if (!brand) throw new AppError('Brand not found', StatusCodes.NOT_FOUND);

  // lazy-require to avoid circular dep
  const Product = require('../product/product.model');
  const productCount = await Product.countDocuments({ brand: id, isDeleted: false });
  if (productCount > 0) {
    throw new AppError(`Cannot delete: ${productCount} product(s) are assigned to this brand.`, StatusCodes.BAD_REQUEST);
  }

  await Brand.findByIdAndDelete(id);
  logger.info('Brand deleted', { id, name: brand.name });
  await delByPattern(CACHE_KEYS.PATTERN);
}

module.exports = { getBrands, getBrandById, createBrand, updateBrand, deleteBrand };
