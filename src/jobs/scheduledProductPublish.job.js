'use strict';

const Product = require('../modules/product/product.model');
const { delByPattern } = require('../config/redis');
const logger = require('../utils/logger');

async function runScheduledProductPublish() {
  try {
    const result = await Product.updateMany(
      {
        isDeleted: false,
        status: 'draft',
        scheduledPublishAt: { $ne: null, $lte: new Date() },
      },
      { $set: { status: 'active', scheduledPublishAt: null } },
      { runValidators: true },
    );
    if (result.modifiedCount > 0) {
      await Promise.all([delByPattern('product:*'), delByPattern('products:*')]);
      logger.info('Scheduled products published', { count: result.modifiedCount });
    }
  } catch (err) {
    logger.error('Scheduled product publish job failed', { error: err.message });
  }
}

module.exports = { runScheduledProductPublish };
