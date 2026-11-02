'use strict';

/**
 * @file product.routes.js
 */

const express = require('express');
const router = express.Router();

const productController = require('./product.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { isAdmin } = require('../../middlewares/adminMiddleware');
const { validateBody, validateParams, validateQuery } = require('../../middlewares/validateMiddleware');
const {
  createProductSchema, updateProductSchema, addVariantsSchema,
  productIdSchema, productVariantParamsSchema, productImageParamsSchema, productQuerySchema,
} = require('./product.validation');

// ── Public routes ──────────────────────────────────────────────────────────
router.get('/', validateQuery(productQuerySchema), productController.getProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/new-arrivals', productController.getNewArrivals);
router.get('/best-sellers', productController.getBestSellers);
router.get('/:id', validateParams(productIdSchema), productController.getProductById);
router.get('/:id/related', validateParams(productIdSchema), productController.getRelatedProducts);

// ── Admin routes ───────────────────────────────────────────────────────────
router.post('/', authenticate, isAdmin, validateBody(createProductSchema), productController.createProduct);
router.put('/:id', authenticate, isAdmin, validateParams(productIdSchema), validateBody(updateProductSchema), productController.updateProduct);
router.delete('/:id', authenticate, isAdmin, validateParams(productIdSchema), productController.deleteProduct);

// Variants
router.post('/:id/variants', authenticate, isAdmin, validateParams(productIdSchema), validateBody(addVariantsSchema), productController.addVariants);
router.put('/:id/variants/:variantId', authenticate, isAdmin, productController.updateVariant);
router.delete('/:id/variants/:variantId', authenticate, isAdmin, productController.deleteVariant);

// Images
router.post('/:id/images', authenticate, isAdmin, productController.uploadProductImages);
router.delete('/:id/images/:imageId', authenticate, isAdmin, productController.deleteProductImage);

module.exports = router;
