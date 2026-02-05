const fs = require('fs');
const path = require('path');
const os = require('os');

function getLegacySettingsPath() {
  if (process.pkg) {
    return path.join(path.dirname(process.execPath), 'relay-settings.json');
  }
  return path.join(__dirname, '..', 'relay-settings.json');
}

function getSettingsPath() {
  if (process.env.RELAY_SETTINGS_PATH) {
    return process.env.RELAY_SETTINGS_PATH;
  }

  const baseDir = process.env.LOCALAPPDATA
    || (process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : path.join(os.homedir(), '.config'));
  const dataDir = path.join(baseDir, 'MegaBonkRelay');
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) {
    // Ignore directory create errors
  }
  return path.join(dataDir, 'relay-settings.json');
}

function createSettingsStore({ log }) {
  const SETTINGS_FILE = getSettingsPath();
  const LEGACY_SETTINGS_FILE = getLegacySettingsPath();
  let userSettings = {};

  function migrateLegacySettingsIfNeeded() {
    try {
      if (!fs.existsSync(SETTINGS_FILE) && fs.existsSync(LEGACY_SETTINGS_FILE)) {
        fs.copyFileSync(LEGACY_SETTINGS_FILE, SETTINGS_FILE);
        log(`Migrated settings from legacy path to ${SETTINGS_FILE}`);
      }
    } catch (e) {
      // Ignore migration errors
    }
  }

  function loadSettings() {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        userSettings = parsed?.users || {};
      }
    } catch (e) {
      userSettings = {};
    }
  }

  function saveSettings() {
    try {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ users: userSettings }, null, 2));
      log(`Settings saved to ${SETTINGS_FILE}`);
    } catch (e) {
      // Ignore write errors
    }
  }

  function getUserSettings(userId) {
    return userId ? userSettings[userId] || null : null;
  }

  function setUserSettings(userId, settings) {
    if (!userId) return;
    userSettings[userId] = settings;
  }

  migrateLegacySettingsIfNeeded();
  loadSettings();

  return {
    getUserSettings,
    setUserSettings,
    saveSettings,
    loadSettings,
    migrateLegacySettingsIfNeeded,
    SETTINGS_FILE,
    LEGACY_SETTINGS_FILE,
  };
}

module.exports = {
  createSettingsStore,
};
