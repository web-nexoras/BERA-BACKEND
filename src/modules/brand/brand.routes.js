'use strict';

const express = require('express');
const router = express.Router();

const brandController = require('./brand.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { isAdmin } = require('../../middlewares/adminMiddleware');
const { validateBody, validateParams } = require('../../middlewares/validateMiddleware');
const { createBrandSchema, updateBrandSchema, brandIdSchema } = require('./brand.validation');

router.get('/', brandController.getBrands);
router.get('/:id', validateParams(brandIdSchema), brandController.getBrandById);

router.post('/', authenticate, isAdmin, validateBody(createBrandSchema), brandController.createBrand);
router.put('/:id', authenticate, isAdmin, validateParams(brandIdSchema), validateBody(updateBrandSchema), brandController.updateBrand);
router.delete('/:id', authenticate, isAdmin, validateParams(brandIdSchema), brandController.deleteBrand);

module.exports = router;
