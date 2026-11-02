'use strict';

/**
 * @file routes/index.js
 * @description Central router — mounts all module routes.
 */

const express = require('express');
const router = express.Router();

// ── Health Check ─────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Nexora Fashions API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── Auth & Users ──────────────────────────────────────────────────────────────
router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/users', require('../modules/user/user.routes'));

// ── Catalogue ────────────────────────────────────────────────────────────────
router.use('/categories', require('../modules/category/category.routes'));
router.use('/brands', require('../modules/brand/brand.routes'));
router.use('/products', require('../modules/product/product.routes'));

// ── Inventory ────────────────────────────────────────────────────────────────
router.use('/inventory', require('../modules/inventory/inventory.routes'));

// ── Shopping ─────────────────────────────────────────────────────────────────
router.use('/cart', require('../modules/cart/cart.routes'));
router.use('/wishlist', require('../modules/wishlist/wishlist.routes'));
router.use('/coupons', require('../modules/coupon/coupon.routes'));

// ── Orders & Payments ─────────────────────────────────────────────────────────
router.use('/orders', require('../modules/order/order.routes'));
router.use('/payments', require('../modules/payment/payment.routes'));
router.use('/returns', require('../modules/return/return.routes'));

// ── Shipping ─────────────────────────────────────────────────────────────────
router.use('/shipping', require('../modules/shipping/shipping.routes'));

// ── Admin ────────────────────────────────────────────────────────────────────
router.use('/admin', require('../modules/admin/admin.routes'));

module.exports = router;
