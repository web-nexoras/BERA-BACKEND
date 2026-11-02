'use strict';

/**
 * @file inventory.routes.js
 */

const express = require('express');
const router = express.Router();
const inventoryController = require('./inventory.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { isAdmin } = require('../../middlewares/adminMiddleware');
const { validateBody, validateQuery } = require('../../middlewares/validateMiddleware');
const { adjustStockSchema, inventoryQuerySchema } = require('./inventory.validation');

// All inventory routes are admin-only
router.use(authenticate, isAdmin);

router.get('/', validateQuery(inventoryQuerySchema), inventoryController.getInventory);
router.get('/low-stock', inventoryController.getLowStockProducts);
router.get('/out-of-stock', inventoryController.getOutOfStockProducts);
router.post('/adjust', validateBody(adjustStockSchema), inventoryController.adjustStock);
router.get('/:variantId/history', inventoryController.getStockHistory);

module.exports = router;
