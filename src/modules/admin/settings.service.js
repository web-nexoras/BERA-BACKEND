'use strict';

const Settings = require('./settings.model');

async function getSettings() {
  return Settings.getSettings();
}

async function updateSettings(data) {
  const settings = await Settings.getSettings();
  settings.set(data);
  return settings.save();
}

module.exports = { getSettings, updateSettings };
