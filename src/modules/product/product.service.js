'use strict';

const { StatusCodes } = require('http-status-codes');
const Product = require('./product.model');
const ProductVariant = require('../variant/variant.model');
const InventoryLog = require('../inventory/inventory.model');
const { get, set, del, delByPattern } = require('../../config/redis');
const { uploadImage, deleteImage } = require('../../config/cloudinary');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { calculatePagination, getSkip } = require('../../utils/helpers');

const CACHE_TTL = env.REDIS_CACHE_TTL_PRODUCTS;
const FEATURED_TTL = env.REDIS_CACHE_TTL_FEATURED;
const BESTSELLERS_TTL = env.REDIS_CACHE_TTL_BESTSELLERS;

function buildProductFilter(query) {
  const filter = { isDeleted: false, status: 'active' };
  if (query.category) filter.category = query.category;
  if (query.brand) filter.brand = query.brand;
  if (query.isFeatured !== undefined) filter.isFeatured = query.isFeatured === true || query.isFeatured === 'true';
  if (query.isNewArrival !== undefined) filter.isNewArrival = query.isNewArrival === true || query.isNewArrival === 'true';
  if (query.isBestSeller !== undefined) filter.isBestSeller = query.isBestSeller === true || query.isBestSeller === 'true';
  if (query.search) filter.$text = { $search: query.search };
  return filter;
}

function buildSortOption(sort) {
  const map = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    price_asc: { basePrice: 1 },
    price_desc: { basePrice: -1 },
    popular: { totalSold: -1 },
    rating: { averageRating: -1 },
    name_asc: { name: 1 },
    name_desc: { name: -1 },
  };
  return map[sort] || { createdAt: -1 };
}

async function getProducts(query = {}) {
  const page = parseInt(query.page) || 1;
  const limit = Math.min(parseInt(query.limit) || 12, 50);
  const skip = getSkip(page, limit);
  const filter = buildProductFilter(query);
  const sort = buildSortOption(query.sort);

  const priceRange = {};
  if (query.minPrice !== undefined) priceRange.$gte = Number(query.minPrice);
  if (query.maxPrice !== undefined) priceRange.$lte = Number(query.maxPrice);
  const hasPriceRange = Object.keys(priceRange).length > 0;
  const variantAttributeFilter = { isActive: true };
  if (query.size) variantAttributeFilter.size = query.size;
  if (query.color) variantAttributeFilter.color = query.color;
  const hasVariantAttributes = Boolean(query.size || query.color || query.inStock !== undefined);
  const variantFilter = { ...variantAttributeFilter };

  if (query.inStock === true || query.inStock === 'true') {
    variantFilter.stock = { $gt: 0 };
  } else if (query.inStock === false || query.inStock === 'false') {
    const collation = query.size || query.color ? { locale: 'en', strength: 2 } : undefined;
    let matchingAttributeVariants = ProductVariant.find(variantAttributeFilter);
    let stockedAttributeVariants = ProductVariant.find({ ...variantAttributeFilter, stock: { $gt: 0 } });
    if (collation) {
      matchingAttributeVariants = matchingAttributeVariants.collation(collation);
      stockedAttributeVariants = stockedAttributeVariants.collation(collation);
    }
    const [matchingIds, stockedIds] = await Promise.all([
      matchingAttributeVariants.distinct('product'),
      stockedAttributeVariants.distinct('product'),
    ]);
    const stockedIdSet = new Set(stockedIds.map(String));
    filter._id = { $in: matchingIds.filter((id) => !stockedIdSet.has(String(id))) };
    variantFilter.stock = 0;
  } else if (hasVariantAttributes) {
    let matchingVariants = ProductVariant.find(variantFilter);
    if (query.size || query.color) matchingVariants = matchingVariants.collation({ locale: 'en', strength: 2 });
    filter._id = { $in: await matchingVariants.distinct('product') };
  }
  if (hasPriceRange) {
    const variantPriceFilter = { ...variantFilter, price: priceRange };
    let matchingPriceVariants = ProductVariant.find(variantPriceFilter);
    if (query.size || query.color) matchingPriceVariants = matchingPriceVariants.collation({ locale: 'en', strength: 2 });
    const matchingPriceProductIds = await matchingPriceVariants.distinct('product');
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ basePrice: priceRange }, { _id: { $in: matchingPriceProductIds } }] },
    ];
  }

  const [products, total] = await Promise.all([
    Product.find(filter).populate('category', 'name slug').populate('brand', 'name logo').sort(sort).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);

  const productIds = products.map((p) => p._id);
  const variantsSummary = await ProductVariant.find({ product: { $in: productIds }, isActive: true })
    .select('product size color price regularPrice stock')
    .lean();

  const variantMap = {};
  variantsSummary.forEach((v) => {
    const pid = v.product.toString();
    if (!variantMap[pid]) variantMap[pid] = [];
    variantMap[pid].push(v);
  });

  const enriched = products.map((p) => ({
    ...p,
    variants: variantMap[p._id.toString()] || [],
    minPrice: variantMap[p._id.toString()] ? Math.min(...variantMap[p._id.toString()].map((v) => v.price)) : p.basePrice,
    inStock: variantMap[p._id.toString()] ? variantMap[p._id.toString()].some((v) => v.stock > 0) : false,
  }));

  return { products: enriched, pagination: calculatePagination(page, limit, total) };
}
async function getProductById(id) {
  const cacheKey = `product:${id}`;
  const cached = await get(cacheKey);
  if (cached) {
    if (!cached.isDeleted && cached.status === 'active') return cached;
    await del(cacheKey);
  }

  const product = await Product.findOne({ _id: id, isDeleted: false, status: 'active' })
    .populate('category', 'name slug')
    .populate('brand', 'name logo')
    .lean();

  if (!product) throw new AppError('Product not found', StatusCodes.NOT_FOUND);

  const variants = await ProductVariant.find({ product: id, isActive: true })
    .select('size color colorCode price regularPrice stock sku images isActive product')
    .lean();
  const result = { ...product, variants };

  await set(cacheKey, result, CACHE_TTL);
  return result;
}

async function getFeaturedProducts() {
  const cacheKey = 'products:featured';
  const cached = await get(cacheKey);
  if (cached) return cached;

  const products = await Product.find({ isDeleted: false, status: 'active', isFeatured: true })
    .populate('category', 'name slug').populate('brand', 'name logo').limit(12).lean();

  await set(cacheKey, products, FEATURED_TTL);
  return products;
}

async function getNewArrivals() {
  const cacheKey = 'products:new_arrivals';
  const cached = await get(cacheKey);
  if (cached) return cached;

  const products = await Product.find({ isDeleted: false, status: 'active', isNewArrival: true })
    .populate('category', 'name slug').sort({ createdAt: -1 }).limit(12).lean();

  await set(cacheKey, products, CACHE_TTL);
  return products;
}

async function getBestSellers() {
  const cacheKey = 'products:best_sellers';
  const cached = await get(cacheKey);
  if (cached) return cached;

  const products = await Product.find({ isDeleted: false, status: 'active', isBestSeller: true })
    .populate('category', 'name slug').sort({ totalSold: -1 }).limit(12).lean();

  await set(cacheKey, products, BESTSELLERS_TTL);
  return products;
}

async function getRelatedProducts(productId, limit = 8) {
  const product = await Product.findOne({ _id: productId, isDeleted: false, status: 'active' }).select('category').lean();
  if (!product) throw new AppError('Product not found', StatusCodes.NOT_FOUND);

  return Product.find({ category: product.category, _id: { $ne: productId }, isDeleted: false, status: 'active' }).limit(limit).lean();
}

async function createProduct(data) {
  const product = await Product.create(data);
  logger.info('Product created', { id: product._id, name: product.name });
  await delByPattern('products:*');
  return product;
}

async function updateProduct(id, data) {
  const product = await Product.findOneAndUpdate({ _id: id, isDeleted: false }, data, { new: true, runValidators: true });
  if (!product) throw new AppError('Product not found', StatusCodes.NOT_FOUND);
  logger.info('Product updated', { id });
  await del(`product:${id}`);
  await delByPattern('products:*');
  return product;
}

async function deleteProduct(id) {
  const product = await Product.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true, status: 'inactive' }, { new: true });
  if (!product) throw new AppError('Product not found', StatusCodes.NOT_FOUND);
  logger.info('Product soft-deleted', { id });
  await del(`product:${id}`);
  await delByPattern('products:*');
}

async function addVariants(productId, variants, adminId) {
  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) throw new AppError('Product not found', StatusCodes.NOT_FOUND);

  const created = [];
  for (const v of variants) {
    const variant = await ProductVariant.create({ ...v, product: productId });
    await InventoryLog.create({
      product: productId,
      variant: variant._id,
      type: 'initial',
      quantity: variant.stock,
      previousStock: 0,
      newStock: variant.stock,
      reference: 'Initial stock',
      performedBy: adminId,
    });
    created.push(variant);
  }

  if (product.status === 'draft') { product.status = 'active'; await product.save(); }

  await del(`product:${productId}`);
  return created;
}

async function updateVariant(productId, variantId, data) {
  const variant = await ProductVariant.findOneAndUpdate({ _id: variantId, product: productId }, data, { new: true, runValidators: true });
  if (!variant) throw new AppError('Variant not found', StatusCodes.NOT_FOUND);
  await del(`product:${productId}`);
  return variant;
}

async function deleteVariant(productId, variantId) {
  const variant = await ProductVariant.findOneAndDelete({ _id: variantId, product: productId });
  if (!variant) throw new AppError('Variant not found', StatusCodes.NOT_FOUND);
  await del(`product:${productId}`);
}

async function uploadProductImages(productId, files) {
  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) throw new AppError('Product not found', StatusCodes.NOT_FOUND);

  const uploadedImages = [];
  for (const file of files) {
    const result = await uploadImage(file.buffer, `nexora/products/${productId}`);
    uploadedImages.push({
      url: result.url,
      publicId: result.publicId,
      isMain: product.images.length === 0 && uploadedImages.length === 0, // first image = main
    });
  }

  product.images.push(...uploadedImages);
  await product.save();
  await del(`product:${productId}`);
  return product.images;
}

async function deleteProductImage(productId, imageId) {
  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) throw new AppError('Product not found', StatusCodes.NOT_FOUND);

  const imageIndex = product.images.findIndex((img) => img._id.toString() === imageId);
  if (imageIndex === -1) throw new AppError('Image not found', StatusCodes.NOT_FOUND);

  const image = product.images[imageIndex];
  if (image.publicId) await deleteImage(image.publicId);

  product.images.splice(imageIndex, 1);
  if (image.isMain && product.images.length > 0) product.images[0].isMain = true;

  await product.save();
  await del(`product:${productId}`);
}

module.exports = {
  getProducts, getProductById, getFeaturedProducts, getNewArrivals, getBestSellers,
  getRelatedProducts, createProduct, updateProduct, deleteProduct,
  addVariants, updateVariant, deleteVariant, uploadProductImages, deleteProductImage,
};
