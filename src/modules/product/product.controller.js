'use strict';

const { StatusCodes } = require('http-status-codes');
const productService = require('./product.service');
const { successResponse, paginatedResponse } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const getProducts = asyncHandler(async (req, res) => {
  const { products, pagination } = await productService.getProducts(req.query);
  return paginatedResponse(res, 'Products retrieved successfully', products, pagination);
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  return successResponse(res, 'Product retrieved successfully', product);
});

const getFeaturedProducts = asyncHandler(async (req, res) => {
  const products = await productService.getFeaturedProducts();
  return successResponse(res, 'Featured products retrieved successfully', products);
});

const getNewArrivals = asyncHandler(async (req, res) => {
  const products = await productService.getNewArrivals();
  return successResponse(res, 'New arrivals retrieved successfully', products);
});

const getBestSellers = asyncHandler(async (req, res) => {
  const products = await productService.getBestSellers();
  return successResponse(res, 'Best sellers retrieved successfully', products);
});

const getRelatedProducts = asyncHandler(async (req, res) => {
  const products = await productService.getRelatedProducts(req.params.id, parseInt(req.query.limit) || 8);
  return successResponse(res, 'Related products retrieved successfully', products);
});

const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);
  return successResponse(res, 'Product created successfully', product, StatusCodes.CREATED);
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  return successResponse(res, 'Product updated successfully', product);
});

const deleteProduct = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params.id);
  return successResponse(res, 'Product deleted successfully');
});

const addVariants = asyncHandler(async (req, res) => {
  const variants = await productService.addVariants(req.params.id, req.body.variants, req.user.id);
  return successResponse(res, 'Variants added successfully', variants, StatusCodes.CREATED);
});

const updateVariant = asyncHandler(async (req, res) => {
  const variant = await productService.updateVariant(req.params.id, req.params.variantId, req.body);
  return successResponse(res, 'Variant updated successfully', variant);
});

const deleteVariant = asyncHandler(async (req, res) => {
  await productService.deleteVariant(req.params.id, req.params.variantId);
  return successResponse(res, 'Variant deleted successfully');
});

const uploadProductImages = [
  upload.array('images', 10),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'No images provided' });
    }
    const images = await productService.uploadProductImages(req.params.id, req.files);
    return successResponse(res, 'Images uploaded successfully', images);
  }),
];

const deleteProductImage = asyncHandler(async (req, res) => {
  await productService.deleteProductImage(req.params.id, req.params.imageId);
  return successResponse(res, 'Image deleted successfully');
});

module.exports = {
  getProducts,
  getProductById,
  getFeaturedProducts,
  getNewArrivals,
  getBestSellers,
  getRelatedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addVariants,
  updateVariant,
  deleteVariant,
  uploadProductImages,
  deleteProductImage,
};
