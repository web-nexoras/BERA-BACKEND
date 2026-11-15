'use strict';

const express = require('express');
const router = express.Router();

const brandController = require('./brand.controller');
const { authenticate, optionalAuth } = require('../../middlewares/authMiddleware');
const { isAdmin } = require('../../middlewares/adminMiddleware');
const { validateBody, validateParams, validateQuery } = require('../../middlewares/validateMiddleware');
const { createBrandSchema, updateBrandSchema, brandIdSchema, brandQuerySchema } = require('./brand.validation');

router.get('/', optionalAuth, validateQuery(brandQuerySchema), brandController.getBrands);
router.get('/:id', validateParams(brandIdSchema), brandController.getBrandById);

router.post('/', authenticate, isAdmin, validateBody(createBrandSchema), brandController.createBrand);
router.put('/:id', authenticate, isAdmin, validateParams(brandIdSchema), validateBody(updateBrandSchema), brandController.updateBrand);
router.delete('/:id', authenticate, isAdmin, validateParams(brandIdSchema), brandController.deleteBrand);

module.exports = router;
