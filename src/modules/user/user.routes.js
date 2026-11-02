'use strict';

const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateBody, validateParams } = require('../../middlewares/validateMiddleware');
const { updateProfileSchema, addAddressSchema, updateAddressSchema, addressIdParamSchema: addressIdSchema } = require('./user.validation');

router.use(authenticate);

router.get('/profile', userController.getProfile);
router.put('/profile', validateBody(updateProfileSchema), userController.updateProfile);
router.get('/addresses', userController.getAddresses);
router.post('/addresses', validateBody(addAddressSchema), userController.addAddress);
router.put('/addresses/:addressId', validateParams(addressIdSchema), validateBody(updateAddressSchema), userController.updateAddress);
router.delete('/addresses/:addressId', validateParams(addressIdSchema), userController.deleteAddress);
router.put('/addresses/:addressId/default', validateParams(addressIdSchema), userController.setDefaultAddress);

module.exports = router;
