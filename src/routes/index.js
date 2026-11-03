'use strict';

const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Nexora Fashions API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/users', require('../modules/user/user.routes'));

router.use('/categories', require('../modules/category/category.routes'));
router.use('/brands', require('../modules/brand/brand.routes'));
router.use('/products', require('../modules/product/product.routes'));

router.use('/inventory', require('../modules/inventory/inventory.routes'));

router.use('/cart', require('../modules/cart/cart.routes'));
router.use('/wishlist', require('../modules/wishlist/wishlist.routes'));
router.use('/coupons', require('../modules/coupon/coupon.routes'));

router.use('/orders', require('../modules/order/order.routes'));
router.use('/payments', require('../modules/payment/payment.routes'));
router.use('/returns', require('../modules/return/return.routes'));

router.use('/shipping', require('../modules/shipping/shipping.routes'));

router.use('/admin', require('../modules/admin/admin.routes'));

module.exports = router;
