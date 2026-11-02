'use strict';

/**
 * @file category.routes.js
 */

const express = require('express');
const router = express.Router();

const categoryController = require('./category.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { isAdmin } = require('../../middlewares/adminMiddleware');
const { validateBody, validateParams } = require('../../middlewares/validateMiddleware');
const { createCategorySchema, updateCategorySchema, categoryIdSchema } = require('./category.validation');

// Public
router.get('/', categoryController.getCategories);
router.get('/tree', categoryController.getCategoryTree);
router.get('/:id', validateParams(categoryIdSchema), categoryController.getCategoryById);

// Admin-only
router.post('/', authenticate, isAdmin, validateBody(createCategorySchema), categoryController.createCategory);
router.put('/:id', authenticate, isAdmin, validateParams(categoryIdSchema), validateBody(updateCategorySchema), categoryController.updateCategory);
router.delete('/:id', authenticate, isAdmin, validateParams(categoryIdSchema), categoryController.deleteCategory);

module.exports = router;
