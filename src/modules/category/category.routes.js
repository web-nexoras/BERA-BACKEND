'use strict';

const express = require('express');
const router = express.Router();

const categoryController = require('./category.controller');
const { authenticate, optionalAuth } = require('../../middlewares/authMiddleware');
const { isAdmin } = require('../../middlewares/adminMiddleware');
const { validateBody, validateParams, validateQuery } = require('../../middlewares/validateMiddleware');
const { createCategorySchema, updateCategorySchema, categoryIdSchema, categoryQuerySchema } = require('./category.validation');

router.get('/', optionalAuth, validateQuery(categoryQuerySchema), categoryController.getCategories);
router.get('/tree', categoryController.getCategoryTree);
router.get('/:id', validateParams(categoryIdSchema), categoryController.getCategoryById);

router.post('/', authenticate, isAdmin, validateBody(createCategorySchema), categoryController.createCategory);
router.put('/:id', authenticate, isAdmin, validateParams(categoryIdSchema), validateBody(updateCategorySchema), categoryController.updateCategory);
router.delete('/:id', authenticate, isAdmin, validateParams(categoryIdSchema), categoryController.deleteCategory);

module.exports = router;
