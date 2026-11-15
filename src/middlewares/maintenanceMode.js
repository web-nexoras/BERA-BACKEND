'use strict';

const { StatusCodes } = require('http-status-codes');
const { optionalAuth } = require('./authMiddleware');
const settingsService = require('../modules/admin/settings.service');

function maintenanceMode(req, res, next) {
  settingsService.getCachedSettings().then((settings) => {
    if (!settings.maintenanceMode) return next();
    return optionalAuth(req, res, (error) => {
      if (error) return next(error);
      if (req.user?.role === 'admin') return next();
      return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'The store is temporarily unavailable for maintenance.',
      });
    });
  }).catch(next);
}

module.exports = maintenanceMode;
