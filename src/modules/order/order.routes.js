'use strict';

const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const { authenticate, optionalAuth, attachSession } = require('../../middlewares/authMiddleware');
const { isAdmin } = require('../../middlewares/adminMiddleware');
const { validateBody, validateParams } = require('../../middlewares/validateMiddleware');
const { checkoutSchema, updateOrderStatusSchema, cancelOrderSchema, orderIdParamSchema: orderIdSchema } = require('./order.validation');

// Public order tracking (guest-friendly).
router.get('/track', orderController.trackOrder);

router.post('/checkout', optionalAuth, attachSession, validateBody(checkoutSchema), orderController.checkout);

router.get('/', authenticate, orderController.getMyOrders);
router.get('/my/:orderId', authenticate, validateParams(orderIdSchema), orderController.getMyOrderById);
router.post('/:orderId/cancel', authenticate, validateParams(orderIdSchema), validateBody(cancelOrderSchema), orderController.cancelMyOrder);

router.get('/admin/all', authenticate, isAdmin, orderController.getAllOrders);
router.get('/admin/:orderId', authenticate, isAdmin, validateParams(orderIdSchema), orderController.getOrderById);
router.put('/admin/:orderId/status', authenticate, isAdmin, validateParams(orderIdSchema), validateBody(updateOrderStatusSchema), orderController.updateOrderStatus);
router.get('/admin/:orderId/invoice', authenticate, isAdmin, validateParams(orderIdSchema), orderController.generateInvoice);

module.exports = router;