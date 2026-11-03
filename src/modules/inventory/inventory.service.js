'use strict';

const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');
const ProductVariant = require('../variant/variant.model');
const InventoryLog = require('./inventory.model');
const Product = require('../product/product.model');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { calculatePagination, getSkip } = require('../../utils/helpers');

async function getInventory(query = {}) {
  const page = parseInt(query.page) || 1;
  const limit = Math.min(parseInt(query.limit) || 20, 100);
  const skip = getSkip(page, limit);

  const filter = {};
  if (query.lowStock === 'true') {
    filter.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
  }
  if (query.outOfStock === 'true') filter.stock = 0;

  const [variants, total] = await Promise.all([
    ProductVariant.find(filter)
      .populate('product', 'name sku images')
      .sort({ stock: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProductVariant.countDocuments(filter),
  ]);

  return { variants, pagination: calculatePagination(page, limit, total) };
}

async function adjustStock(variantId, quantity, type, reference, adminId, notes) {
  const variant = await ProductVariant.findById(variantId);
  if (!variant) throw new AppError('Variant not found', StatusCodes.NOT_FOUND);

  const previousStock = variant.stock;
  const newStock = type === 'increment'
    ? previousStock + quantity
    : Math.max(0, previousStock - quantity);

  variant.stock = newStock;
  await variant.save();

  await InventoryLog.create({
    product: variant.product,
    variant: variantId,
    type: type === 'increment' ? 'purchase' : 'adjustment',
    quantity: type === 'increment' ? quantity : -quantity,
    previousStock,
    newStock,
    reference,
    performedBy: adminId,
    notes,
  });

  logger.info('Stock adjusted', { variantId, type, quantity, previousStock, newStock });
  return variant;
}

async function getStockHistory(variantId, query = {}) {
  const page = parseInt(query.page) || 1;
  const limit = Math.min(parseInt(query.limit) || 20, 100);
  const skip = getSkip(page, limit);

  const [logs, total] = await Promise.all([
    InventoryLog.find({ variant: variantId })
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    InventoryLog.countDocuments({ variant: variantId }),
  ]);

  return { logs, pagination: calculatePagination(page, limit, total) };
}

async function getLowStockProducts() {
  return ProductVariant.find({
    $expr: { $and: [{ $lte: ['$stock', '$lowStockThreshold'] }, { $gt: ['$stock', 0] }] },
    isActive: true,
  })
    .populate('product', 'name sku images')
    .lean();
}

async function getOutOfStockProducts() {
  return ProductVariant.find({ stock: 0, isActive: true })
    .populate('product', 'name sku images')
    .lean();
}

/**
 * Reserve stock for an order (decrement within a session).
 * @param {string} variantId
 * @param {number} quantity
 * @param {mongoose.ClientSession} [session]
 */
async function reserveStock(variantId, quantity, session) {
  const variant = await ProductVariant.findOneAndUpdate(
    { _id: variantId, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { new: true, session },
  );

  if (!variant) {
    throw new AppError('Insufficient stock for this item. Please update your cart.', StatusCodes.CONFLICT);
  }

  return variant;
}

/**
 * Release reserved stock (increment) — used for cancelled orders.
 * @param {string} variantId
 * @param {number} quantity
 * @param {mongoose.ClientSession} [session]
 */
async function releaseStock(variantId, quantity, session) {
  await ProductVariant.findByIdAndUpdate(
    variantId,
    { $inc: { stock: quantity } },
    { session },
  );
}

module.exports = {
  getInventory,
  adjustStock,
  getStockHistory,
  getLowStockProducts,
  getOutOfStockProducts,
  reserveStock,
  releaseStock,
};
