'use strict';

const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller');
const { authenticate, optionalAuth, attachSession } = require('../../middlewares/authMiddleware');
const { validateBody, validateParams } = require('../../middlewares/validateMiddleware');
const { addToCartSchema, updateCartItemSchema, applyCouponSchema, removeCartItemSchema } = require('./cart.validation');

router.use(optionalAuth, attachSession);

router.get('/', cartController.getCart);
router.get('/summary', cartController.getCartSummary);
router.post('/items', validateBody(addToCartSchema), cartController.addToCart);
router.put('/items/:variantId', validateParams(removeCartItemSchema), validateBody(updateCartItemSchema), cartController.updateCartItem);
router.delete('/items/:variantId', validateParams(removeCartItemSchema), cartController.removeCartItem);
router.delete('/', cartController.clearCart);
router.post('/coupon', validateBody(applyCouponSchema), cartController.applyCoupon);
router.delete('/coupon', cartController.removeCoupon);

// Merge guest cart into user cart on login.
router.post('/merge', authenticate, attachSession, cartController.mergeCart);

module.exports = router;