'use strict';

const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { isAdmin } = require('../../middlewares/adminMiddleware');

// All admin routes require authentication + admin role
router.use(authenticate, isAdmin);

router.get('/dashboard', adminController.getDashboardStats);
router.get('/dashboard/monthly-sales', adminController.getMonthlySales);
router.get('/dashboard/recent-orders', adminController.getRecentOrders);
router.get('/dashboard/best-sellers', adminController.getBestSellers);

router.get('/reports/sales', adminController.getSalesReport);
router.get('/reports/inventory', adminController.getInventoryReport);

router.get('/customers', adminController.getCustomers);
router.get('/customers/:id', adminController.getCustomerById);
router.put('/customers/:id/block', adminController.blockCustomer);
router.put('/customers/:id/unblock', adminController.unblockCustomer);

router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

module.exports = router;
