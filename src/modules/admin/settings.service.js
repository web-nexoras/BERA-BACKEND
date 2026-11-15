'use strict';

const Settings = require('./settings.model');

let settingsCache = null;
let settingsCacheExpiresAt = 0;

async function getSettings() {
  return Settings.getSettings();
}

async function getCachedSettings() {
  if (settingsCache && Date.now() < settingsCacheExpiresAt) return settingsCache;
  settingsCache = await Settings.getSettings();
  settingsCacheExpiresAt = Date.now() + 45_000;
  return settingsCache;
}

function invalidateSettingsCache() {
  settingsCache = null;
  settingsCacheExpiresAt = 0;
}

async function updateSettings(data) {
  const settings = await Settings.getSettings();
  settings.set(data);
  const saved = await settings.save();
  invalidateSettingsCache();
  return saved;
}

module.exports = { getSettings, getCachedSettings, invalidateSettingsCache, updateSettings };
