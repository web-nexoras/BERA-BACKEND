'use strict';

const Category = require('./category.model');
const { get, set, delByPattern } = require('../../config/redis');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { StatusCodes } = require('http-status-codes');

const CACHE_KEYS = {
  ALL: 'categories:all',
  TREE: 'categories:tree',
  SINGLE: (id) => `categories:${id}`,
  PATTERN: 'categories:*',
};

const CACHE_TTL = () => env.REDIS_CACHE_TTL_CATEGORIES || 600;

async function getCategories(query = {}) {
  const { parent, includeInactive = false } = query;
  const cacheKey = `${CACHE_KEYS.ALL}:parent=${parent || 'all'}:inactive=${includeInactive}`;

  const cached = await get(cacheKey);
  if (cached) return cached;

  const filter = {};
  if (!includeInactive) filter.isActive = true;
  if (parent === 'root') filter.parent = null;
  else if (parent) filter.parent = parent;

  const categories = await Category.find(filter)
    .populate('parent', 'name slug')
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  await set(cacheKey, categories, CACHE_TTL());
  return categories;
}

async function getCategoryById(id) {
  const cacheKey = CACHE_KEYS.SINGLE(id);
  const cached = await get(cacheKey);
  if (cached) return cached;

  const category = await Category.findById(id)
    .populate('parent', 'name slug _id')
    .populate({ path: 'subcategories', match: { isActive: true }, select: 'name slug image isActive sortOrder', options: { sort: { sortOrder: 1, name: 1 } } })
    .lean({ virtuals: true });

  if (!category) throw new AppError('Category not found', StatusCodes.NOT_FOUND);

  await set(cacheKey, category, CACHE_TTL());
  return category;
}

async function createCategory(data) {
  const existing = await Category.findOne({ name: data.name });
  if (existing) throw new AppError('A category with this name already exists', StatusCodes.CONFLICT);

  const category = await Category.create(data);
  logger.info('Category created', { id: category._id, name: category.name });
  await delByPattern(CACHE_KEYS.PATTERN);
  return category;
}

async function updateCategory(id, data) {
  const category = await Category.findById(id);
  if (!category) throw new AppError('Category not found', StatusCodes.NOT_FOUND);

  if (data.name && data.name !== category.name) {
    const conflict = await Category.findOne({ name: data.name, _id: { $ne: id } });
    if (conflict) throw new AppError('A category with this name already exists', StatusCodes.CONFLICT);
  }

  if (data.parent && data.parent.toString() === id.toString()) {
    throw new AppError('A category cannot be its own parent', StatusCodes.BAD_REQUEST);
  }

  Object.assign(category, data);
  const updated = await category.save();
  logger.info('Category updated', { id, changes: Object.keys(data) });
  await delByPattern(CACHE_KEYS.PATTERN);
  return updated;
}

async function deleteCategory(id) {
  const category = await Category.findById(id);
  if (!category) throw new AppError('Category not found', StatusCodes.NOT_FOUND);

  const subcategoryCount = await Category.countDocuments({ parent: id });
  if (subcategoryCount > 0) {
    throw new AppError(`Cannot delete: this category has ${subcategoryCount} subcategory(ies). Reassign or delete them first.`, StatusCodes.BAD_REQUEST);
  }

  // Lazy-load to avoid a circular dependency.
  const Product = require('../product/product.model');
  const productCount = await Product.countDocuments({ category: id, isDeleted: false });
  if (productCount > 0) {
    throw new AppError(`Cannot delete: ${productCount} product(s) are assigned to this category.`, StatusCodes.BAD_REQUEST);
  }

  await Category.findByIdAndDelete(id);
  logger.info('Category deleted', { id, name: category.name });
  await delByPattern(CACHE_KEYS.PATTERN);
}

async function getCategoryTree() {
  const cached = await get(CACHE_KEYS.TREE);
  if (cached) return cached;

  const allCategories = await Category.find({ isActive: true })
    .select('name slug description image parent sortOrder isActive')
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  // O(n) tree construction using a map
  const categoryMap = {};
  allCategories.forEach((cat) => { categoryMap[cat._id.toString()] = { ...cat, children: [] }; });

  const tree = [];
  allCategories.forEach((cat) => {
    if (cat.parent) {
      const parentId = cat.parent.toString();
      if (categoryMap[parentId]) categoryMap[parentId].children.push(categoryMap[cat._id.toString()]);
    } else {
      tree.push(categoryMap[cat._id.toString()]);
    }
  });

  await set(CACHE_KEYS.TREE, tree, CACHE_TTL());
  return tree;
}

module.exports = { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory, getCategoryTree };
