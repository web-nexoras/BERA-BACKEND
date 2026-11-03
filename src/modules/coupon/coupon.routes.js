'use strict';

const express = require('express');
const router = express.Router();
const couponController = require('./coupon.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { isAdmin } = require('../../middlewares/adminMiddleware');
const { validateBody, validateParams } = require('../../middlewares/validateMiddleware');
const { createCouponSchema, updateCouponSchema, couponIdSchema } = require('./coupon.validation');

router.post('/validate', authenticate, couponController.validateCoupon);

router.get('/', authenticate, isAdmin, couponController.getCoupons);
router.get('/:id', authenticate, isAdmin, validateParams(couponIdSchema), couponController.getCouponById);
router.post('/', authenticate, isAdmin, validateBody(createCouponSchema), couponController.createCoupon);
router.put('/:id', authenticate, isAdmin, validateParams(couponIdSchema), validateBody(updateCouponSchema), couponController.updateCoupon);
router.delete('/:id', authenticate, isAdmin, validateParams(couponIdSchema), couponController.deleteCoupon);

module.exports = router;
