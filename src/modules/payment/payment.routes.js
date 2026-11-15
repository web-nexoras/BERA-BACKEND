'use strict';

const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { isAdmin } = require('../../middlewares/adminMiddleware');
const { validateBody, validateQuery } = require('../../middlewares/validateMiddleware');
const { initPaymentSchema, paymentQuerySchema } = require('./payment.validation');

router.post('/initiate', authenticate, validateBody(initPaymentSchema), paymentController.initiatePayment);
router.get('/my-transactions', authenticate, validateQuery(paymentQuerySchema), paymentController.getMyTransactions);

// SSLCommerz callbacks (no auth - called by SSLCommerz servers)
router.post('/sslcommerz/success', paymentController.sslcommerzSuccess);
router.post('/sslcommerz/fail', paymentController.sslcommerzFail);
router.post('/sslcommerz/cancel', paymentController.sslcommerzCancel);
router.post('/sslcommerz/ipn', paymentController.sslcommerzIPN);

router.get('/admin/all', authenticate, isAdmin, validateQuery(paymentQuerySchema), paymentController.getAllTransactions);
router.post('/admin/refund', authenticate, isAdmin, paymentController.processRefund);

module.exports = router;
