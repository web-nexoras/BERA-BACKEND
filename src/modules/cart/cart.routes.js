'use strict';

const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateBody, validateParams } = require('../../middlewares/validateMiddleware');
const { addToCartSchema, updateCartItemSchema, applyCouponSchema, removeCartItemSchema } = require('./cart.validation');

router.use(authenticate);

router.get('/', cartController.getCart);
router.get('/summary', cartController.getCartSummary);
router.post('/items', validateBody(addToCartSchema), cartController.addToCart);
router.put('/items/:variantId', validateParams(removeCartItemSchema), validateBody(updateCartItemSchema), cartController.updateCartItem);
router.delete('/items/:variantId', validateParams(removeCartItemSchema), cartController.removeCartItem);
router.delete('/', cartController.clearCart);
router.post('/coupon', validateBody(applyCouponSchema), cartController.applyCoupon);
router.delete('/coupon', cartController.removeCoupon);

module.exports = router;
