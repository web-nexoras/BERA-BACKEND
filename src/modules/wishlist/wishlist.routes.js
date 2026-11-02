'use strict';

const express = require('express');
const router = express.Router();
const wishlistController = require('./wishlist.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateBody, validateParams } = require('../../middlewares/validateMiddleware');
const { addToWishlistSchema, wishlistItemParamsSchema } = require('./wishlist.validation');

router.use(authenticate);

router.get('/', wishlistController.getWishlist);
router.post('/items', validateBody(addToWishlistSchema), wishlistController.addToWishlist);
router.delete('/items/:productId', validateParams(wishlistItemParamsSchema), wishlistController.removeFromWishlist);
router.post('/items/:productId/move-to-cart', validateParams(wishlistItemParamsSchema), wishlistController.moveToCart);
router.delete('/', wishlistController.clearWishlist);

module.exports = router;
