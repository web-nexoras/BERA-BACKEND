'use strict';

/**
 * @file settings.service.js
 */

const Settings = require('./settings.model');

async function getSettings() {
  return Settings.getSettings();
}

async function updateSettings(data) {
  const settings = await Settings.getSettings();
  Object.assign(settings, data);
  return settings.save();
}

module.exports = { getSettings, updateSettings };
