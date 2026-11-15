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

async function adjustStock(variantId, quantity, type, direction, reference, adminId, notes) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError('Quantity must be a positive integer.', StatusCodes.BAD_REQUEST);
  }

  const additions = ['purchase', 'return', 'initial'];
  const subtractions = ['sale', 'damaged'];
  const increase = additions.includes(type) || (type === 'adjustment' && direction === 'increase');
  const decrease = subtractions.includes(type) || (type === 'adjustment' && direction === 'decrease');
  if (!increase && !decrease) throw new AppError('A valid direction is required for adjustment.', StatusCodes.BAD_REQUEST);

  const session = await mongoose.startSession();
  let updatedVariant;
  try {
    session.startTransaction();
    const filter = { _id: variantId };
    if (decrease) filter.stock = { $gte: quantity };
    updatedVariant = await ProductVariant.findOneAndUpdate(
      filter,
      { $inc: { stock: increase ? quantity : -quantity } },
      { new: true, session, runValidators: true },
    );
    if (!updatedVariant) {
      const exists = await ProductVariant.exists({ _id: variantId }).session(session);
      if (!exists) throw new AppError('Variant not found', StatusCodes.NOT_FOUND);
      throw new AppError('Insufficient stock for this adjustment.', StatusCodes.CONFLICT);
    }

    const previousStock = updatedVariant.stock + (increase ? -quantity : quantity);
    await InventoryLog.create([{
      product: updatedVariant.product,
      variant: variantId,
      type,
      quantity: increase ? quantity : -quantity,
      previousStock,
      newStock: updatedVariant.stock,
      reference,
      performedBy: adminId,
      notes,
    }], { session });
    await session.commitTransaction();

    logger.info('Stock adjusted', { variantId, type, direction: increase ? 'increase' : 'decrease', quantity, previousStock, newStock: updatedVariant.stock });
    return updatedVariant;
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
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
async function reserveStock(variantId, quantity, session, reference = '') {
  const variant = await ProductVariant.findOneAndUpdate(
    { _id: variantId, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { new: true, session },
  );
  if (!variant) throw new AppError('Insufficient stock for this item. Please update your cart.', StatusCodes.CONFLICT);

  const previousStock = variant.stock + quantity;
  await InventoryLog.create([{
    product: variant.product, variant: variant._id, type: 'sale', quantity: -quantity,
    previousStock, newStock: variant.stock, reference,
  }], { session });
  return variant;
}

async function releaseStock(variantId, quantity, session, reference = '') {
  const variant = await ProductVariant.findOneAndUpdate(
    { _id: variantId },
    { $inc: { stock: quantity } },
    { new: true, session },
  );
  if (!variant) throw new AppError('Variant not found', StatusCodes.NOT_FOUND);

  await InventoryLog.create([{
    product: variant.product, variant: variant._id, type: 'return', quantity,
    previousStock: variant.stock - quantity, newStock: variant.stock, reference,
  }], { session });
  return variant;
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
