'use strict';

const express = require('express');
const router = express.Router();
const shippingController = require('./shipping.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { isAdmin } = require('../../middlewares/adminMiddleware');
const { validateQuery } = require('../../middlewares/validateMiddleware');
const { getChargeSchema } = require('./shipping.validation');

router.get('/zones', shippingController.getShippingZones);
router.get('/charge', validateQuery(getChargeSchema), shippingController.getShippingCharge);

router.post('/zones', authenticate, isAdmin, shippingController.createZone);
router.put('/zones/:id', authenticate, isAdmin, shippingController.updateZone);
router.delete('/zones/:id', authenticate, isAdmin, shippingController.deleteZone);

module.exports = router;
