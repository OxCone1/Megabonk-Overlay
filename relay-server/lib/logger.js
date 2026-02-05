const fs = require('fs');
const path = require('path');

function getLogPath() {
  if (process.pkg) {
    return path.join(path.dirname(process.execPath), 'relay-server.log');
  }
  return path.join(__dirname, '..', 'relay-server.log');
}

function getResponseLogPath() {
  if (process.pkg) {
    return path.join(path.dirname(process.execPath), 'relay-responses.log');
  }
  return path.join(__dirname, '..', 'relay-responses.log');
}

function ensureFile(filePath) {
  try {
    fs.closeSync(fs.openSync(filePath, 'a'));
  } catch (e) {
    // Ignore errors when creating the file
  }
}

function createLogger() {
  const LOG_FILE = getLogPath();
  const RESPONSE_LOG_FILE = getResponseLogPath();

  ensureFile(RESPONSE_LOG_FILE);

  function log(message) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    try {
      fs.appendFileSync(LOG_FILE, line);
    } catch (e) {
      // Ignore logging errors
    }
  }

  function logFullResponse(type, url, data) {
    const timestamp = new Date().toISOString();
    const separator = '='.repeat(80);
    let content;
    try {
      content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    } catch (e) {
      content = String(data);
    }
    const entry = `\n${separator}\n[${timestamp}] ${type}: ${url}\n${separator}\n${content}\n`;
    try {
      fs.appendFileSync(RESPONSE_LOG_FILE, entry);
    } catch (e) {
      // Ignore logging errors
    }
  }

  return {
    log,
    logFullResponse,
    LOG_FILE,
    RESPONSE_LOG_FILE,
  };
}

module.exports = {
  createLogger,
};
