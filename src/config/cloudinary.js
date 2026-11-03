'use strict';

const cloudinary = require('cloudinary').v2;
const env = require('./env');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const { StatusCodes } = require('http-status-codes');

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Upload in-memory image to Cloudinary.
async function uploadImage(buffer, folder, publicId) {
  try {
    const result = await new Promise((resolve, reject) => {
      const opts = {
        folder,
        resource_type: 'image',
        quality: 'auto:good',
        fetch_format: 'auto',
      };

      if (publicId) {
        opts.public_id = publicId;
        opts.overwrite = true;
      }

      const stream = cloudinary.uploader.upload_stream(opts, (error, res) => {
        if (error) return reject(error);
        resolve(res);
      });

      stream.end(buffer);
    });

    logger.info('Image uploaded to Cloudinary', { publicId: result.public_id });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    };
  } catch (err) {
    logger.error('Cloudinary upload failed', { error: err.message });
    throw new AppError('Image upload failed. Please try again.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

async function deleteImage(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    logger.info('Image deleted from Cloudinary', { publicId, result: result.result });
    return result;
  } catch (err) {
    logger.error('Cloudinary delete failed', { publicId, error: err.message });
    throw new AppError('Image deletion failed. Please try again.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

function getImageUrl(publicId, transformations = {}) {
  return cloudinary.url(publicId, {
    secure: true,
    fetch_format: 'auto',
    quality: 'auto',
    ...transformations,
  });
}

module.exports = { cloudinary, uploadImage, deleteImage, getImageUrl };
