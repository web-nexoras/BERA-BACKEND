'use strict';

const express = require('express');
const router = express.Router();
const returnController = require('./return.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { isAdmin } = require('../../middlewares/adminMiddleware');

// Customer
router.post('/', authenticate, returnController.createReturn);
router.get('/my', authenticate, returnController.getMyReturns);

// Admin
router.get('/admin/all', authenticate, isAdmin, returnController.getAllReturns);
router.put('/admin/:returnId/status', authenticate, isAdmin, returnController.updateReturnStatus);

module.exports = router;
