'use strict';

const express = require('express');
const router = express.Router();
const returnController = require('./return.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { isAdmin } = require('../../middlewares/adminMiddleware');
const { validateBody, validateParams } = require('../../middlewares/validateMiddleware');
const { createReturnSchema, updateReturnStatusSchema, returnIdParamSchema } = require('./return.validation');

router.post('/', authenticate, validateBody(createReturnSchema), returnController.createReturn);
router.get('/my', authenticate, returnController.getMyReturns);

router.get('/admin/all', authenticate, isAdmin, returnController.getAllReturns);
router.put('/admin/:returnId/status', authenticate, isAdmin, validateParams(returnIdParamSchema), validateBody(updateReturnStatusSchema), returnController.updateReturnStatus);

module.exports = router;
