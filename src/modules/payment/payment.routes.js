'use strict';

const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { isAdmin } = require('../../middlewares/adminMiddleware');

// Customer
router.post('/initiate', authenticate, paymentController.initiatePayment);
router.get('/my-transactions', authenticate, paymentController.getMyTransactions);

// SSLCommerz callbacks (no auth - called by SSLCommerz servers)
router.post('/sslcommerz/success', paymentController.sslcommerzSuccess);
router.post('/sslcommerz/fail', paymentController.sslcommerzFail);
router.post('/sslcommerz/cancel', paymentController.sslcommerzCancel);
router.post('/sslcommerz/ipn', paymentController.sslcommerzIPN);

// Admin
router.get('/admin/all', authenticate, isAdmin, paymentController.getAllTransactions);
router.post('/admin/refund', authenticate, isAdmin, paymentController.processRefund);

module.exports = router;
