const { app, Tray, Menu, nativeImage, Notification, shell, dialog, BrowserWindow, globalShortcut, screen, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, exec } = require('child_process');

const APP_NAME = 'MegaBonk Tray';
// Explicit AppUserModelID helps Windows show the correct app name in toast notifications
const APP_ID = 'com.megabonk.tray';
if (process.platform === 'win32') {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    try {
      // Show a toast in the existing instance's app name instead of spawning a duplicate
      new Notification({ title: APP_NAME, body: 'MegaBonk Tray is already running.' }).show();
    } catch (e) {
      // ignore
    }
    app.quit();
  }

  app.on('second-instance', () => {
    try {
      if (tray) {
        tray.displayBalloon({ title: APP_NAME, content: 'MegaBonk Tray is already running.' });
      } else {
        new Notification({ title: APP_NAME, body: 'MegaBonk Tray is already running.' }).show();
      }
    } catch (e) {
      // ignore
    }
  });
}
try {
  if (process.platform === 'win32' && app) {
    if (typeof app.setName === 'function') {
      app.setName(APP_NAME);
    }
    if (typeof app.setAppUserModelId === 'function') {
      app.setAppUserModelId(APP_ID);
    }
  }
} catch (e) {
  // ignore failures here
}

let tray = null;
let serverProcess = null;
let overlayWindow = null;
let overlayVisible = false;
let overlayHotkey = 'Control+Shift+O';
let overlayClickHotkey = 'Control+Shift+I';
let overlayClickable = false;
let serverRunning = false;
let sessionTrackingActive = false;
let sessionStatusLastChecked = 0;
let overlayServingActive = false;
let overlayAvailable = false;
let overlayStatusLastChecked = 0;
let logsEnabled = false;
let autoUpdatesEnabled = false;
let updateAvailable = false;
let updateDownloaded = false;
let updateChecking = false;
let updateError = null;
let updateNotifyOnNoUpdate = false;

const HEALTH_URL = 'http://127.0.0.1:17502/health';
const SESSION_URL = 'http://127.0.0.1:17502/api/session';
const OVERLAY_STATUS_URL = 'http://127.0.0.1:17502/api/overlay/status';
const OVERLAY_ACTION_URL = 'http://127.0.0.1:17502/api/overlay';
const POLL_INTERVAL_MS = 5000;
let healthInterval = null;

function getLogPath() {
  // Use the same log path as relay-server when possible
  return path.join(__dirname, '..', 'relay-server.log');
}

function log(message) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${message}\n`;
  try { fs.appendFileSync(getLogPath(), line); } catch (e) { /* ignore */ }
}

function ensureWindowsAppIdentity() {
  if (process.platform !== 'win32') return;

  try {
    const programsDir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    if (!fs.existsSync(programsDir)) {
      fs.mkdirSync(programsDir, { recursive: true });
    }

    const shortcutPath = path.join(programsDir, `${APP_NAME}.lnk`);
    const wroteShortcut = shell.writeShortcutLink(shortcutPath, {
      target: process.execPath,
      args: '',
      description: APP_NAME,
      icon: process.execPath,
      appUserModelId: APP_ID,
      iconIndex: 0
    });
    if (wroteShortcut) {
      log(`Ensured Start Menu shortcut at ${shortcutPath}`);
    } else {
      throw new Error('writeShortcutLink returned false');
    }

    log(`AppUserModelID set to ${APP_ID}`);
  } catch (e) {
    try { log(`Failed to set AppUserModelID via shortcut: ${e.message}`); } catch (err) { /* ignore */ }
    try {
      if (app && typeof app.setAppUserModelId === 'function') {
        app.setAppUserModelId(APP_NAME);
        log(`Fallback AppUserModelID set to ${APP_NAME}`);
      }
    } catch (err) {
      try { log(`Fallback AppUserModelID failed: ${err.message}`); } catch (e2) { /* ignore */ }
    }
  }
}

function showNotification(title, body) {
  try {
    let icon = null;
    const iconFile = process.platform === 'win32' ? 'megaicon_v2.ico' : 'megaicon_v2.png';
    const iconPath = path.join(__dirname, 'images', iconFile);
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath);
      if (icon && icon.isEmpty()) {
        icon = null;
      }
    }
    const options = icon ? { title, body, icon } : { title, body };
    new Notification(options).show();
  } catch (e) {
    // ignore
  }
}

// Persisted config file for user-specified server path
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function getConfiguredServerPath() {
  try {
    const cfg = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
    return cfg.serverPath || null;
  } catch (e) {
    return null;
  }
}

function saveConfiguredServerPath(p) {
  const cfg = readConfig();
  cfg.serverPath = p;
  saveConfig(cfg);
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8')) || {};
  } catch (e) {
    return {};
  }
}

function saveConfig(cfg) {
  try { fs.writeFileSync(getConfigPath(), JSON.stringify(cfg)); } catch (e) { /* ignore */ }
}

function loadOverlaySettings() {
  const cfg = readConfig();
  overlayHotkey = cfg.overlayHotkey || overlayHotkey;
  overlayClickHotkey = cfg.overlayClickHotkey || overlayClickHotkey;
  overlayClickable = cfg.overlayClickable ?? overlayClickable;
  logsEnabled = cfg.logsEnabled ?? false;
}

function saveOverlaySettings() {
  const cfg = readConfig();
  cfg.overlayHotkey = overlayHotkey;
  cfg.overlayClickHotkey = overlayClickHotkey;
  cfg.overlayClickable = overlayClickable;
  cfg.logsEnabled = logsEnabled;
  saveConfig(cfg);
}

function loadUpdateSettings() {
  const cfg = readConfig();
  autoUpdatesEnabled = cfg.autoUpdatesEnabled ?? autoUpdatesEnabled;
}

function saveUpdateSettings() {
  const cfg = readConfig();
  cfg.autoUpdatesEnabled = autoUpdatesEnabled;
  saveConfig(cfg);
}

function getOverlayUrl() {
  const devUrl = process.env.OVERLAY_DEV_URL || process.env.ELECTRON_OVERLAY_DEV_URL;
  if (devUrl) return devUrl;

  return process.env.OVERLAY_HTTP_URL || 'http://127.0.0.1:17502/overlay/';
}

function fitOverlayToPrimaryDisplay() {
  if (!overlayWindow) return;
  const display = screen.getPrimaryDisplay();
  overlayWindow.setBounds(display.bounds);
}

function createOverlayWindow() {
  if (overlayWindow) return;

  overlayWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: true,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, //testing was true
      backgroundThrottling: false
    }
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setMenuBarVisibility(false);
  overlayWindow.setResizable(false);
  applyOverlayInteractivity();

  const url = getOverlayUrl();
  if (url) {
    overlayWindow.loadURL(url).catch(() => {});
  } else {
    overlayWindow.loadURL('data:text/html,<html><body style="background:transparent;color:white;font-family:sans-serif;">Overlay build not found.</body></html>');
  }

  fitOverlayToPrimaryDisplay();

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    overlayVisible = false;
  });
}

function applyOverlayInteractivity() {
  if (!overlayWindow) return;
  if (overlayClickable) {
    overlayWindow.setIgnoreMouseEvents(false);
    overlayWindow.setFocusable(true);
  } else {
    // Fully non-interactive and let mouse pass through to the game
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.setFocusable(false);
  }
}


function showOverlay() {
  createOverlayWindow();
  if (!overlayWindow) return;
  const url = getOverlayUrl();
  if (url) {
    overlayWindow.loadURL(url).catch(() => {});
  }
  overlayWindow.showInactive();
  overlayVisible = true;
}

function hideOverlay() {
  if (overlayWindow) {
    overlayWindow.hide();
  }
  overlayVisible = false;
}

function toggleOverlay() {
  if (overlayVisible) {
    hideOverlay();
  } else {
    showOverlay();
  }
}

function toggleOverlayClickability() {
  overlayClickable = !overlayClickable;
  saveOverlaySettings();
  applyOverlayInteractivity();
  updateMenu();
}

function registerOverlayHotkeys() {
  try {
    globalShortcut.unregisterAll();
    if (overlayHotkey) {
      const success = globalShortcut.register(overlayHotkey, toggleOverlay);
      if (!success) {
        showNotification(APP_NAME, `Hotkey failed: ${overlayHotkey}`);
      }
    }
    if (overlayClickHotkey) {
      const success = globalShortcut.register(overlayClickHotkey, toggleOverlayClickability);
      if (!success) {
        showNotification(APP_NAME, `Hotkey failed: ${overlayClickHotkey}`);
      }
    }
  } catch (e) {
    showNotification(APP_NAME, `Hotkey error: ${e.message}`);
  }
}

function createPromptWindow({ title, label, value, placeholder }) {
  return new Promise((resolve) => {
    const promptId = `prompt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const win = new BrowserWindow({
      width: 520,
      height: 280,
      resizable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      modal: true,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#f3f3f3',
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
        backgroundThrottling: false
      }
    });
    win.setMenuBarVisibility(false);
    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
            body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; background: #f3f3f3; color: #111; }
            .wrap { padding: 20px 22px; display: flex; flex-direction: column; height: 100%; gap: 12px; }
            h3 { margin: 0; font-weight: 600; font-size: 18px; }
            label { font-size: 12px; color: #444; }
            .input { width: 100%; padding: 10px 12px; border: 1px solid #cfcfcf; border-radius: 6px; background: #fff; font-size: 14px; }
            .input:focus { outline: 2px solid #2d7dff; border-color: #2d7dff; }
            .hint { font-size: 11px; color: #666; }
            .buttons { margin-top: auto; display: flex; gap: 8px; justify-content: flex-end; }
            button { padding: 8px 14px; border-radius: 6px; border: 1px solid #cfcfcf; background: #fff; cursor: pointer; }
            button.primary { background: #2d7dff; border-color: #2d7dff; color: #fff; }
            button:active { transform: translateY(1px); }
          </style>
        </head>
        <body>
          <div class="wrap">
            <h3>${title}</h3>
            <label>${label}</label>
            <input id="val" class="input" placeholder="${placeholder || 'Press keys...'}" value="${value || ''}" readonly />
            <div class="hint">Click the field and press the desired keys. Use Backspace to clear. Esc to cancel.</div>
            <div class="buttons">
              <button id="cancel">Cancel</button>
              <button id="ok" class="primary">OK</button>
            </div>
          </div>
          <script>
            const { ipcRenderer } = require('electron');
            const input = document.getElementById('val');
            const toAccel = (e) => {
              const parts = [];
              if (e.ctrlKey || e.metaKey) parts.push('Control');
              if (e.altKey) parts.push('Alt');
              if (e.shiftKey) parts.push('Shift');
              const key = e.key;
              if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
                parts.push(key.length === 1 ? key.toUpperCase() : key);
              }
              return parts.join('+');
            };
            input.addEventListener('focus', () => {
              input.select();
            });
            window.addEventListener('keydown', (e) => {
              if (e.key === 'Escape') {
                ipcRenderer.send('${promptId}', { ok: false });
                return;
              }
              if (e.key === 'Backspace') {
                input.value = '';
                return;
              }
              const accel = toAccel(e);
              if (accel) {
                input.value = accel;
                e.preventDefault();
              }
              if (e.key === 'Enter') {
                ipcRenderer.send('${promptId}', { ok: true, value: input.value });
              }
            });
            document.getElementById('ok').addEventListener('click', () => ipcRenderer.send('${promptId}', { ok: true, value: input.value }));
            document.getElementById('cancel').addEventListener('click', () => ipcRenderer.send('${promptId}', { ok: false }));
          </script>
        </body>
      </html>
    `;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    win.once('ready-to-show', () => {
      win.show();
      win.focus();
    });
    ipcMain.once(promptId, (_event, result) => {
      resolve(result);
      if (win && !win.isDestroyed()) win.close();
    });
    win.on('closed', () => resolve({ ok: false }));
  });
}

function detectServerCommand() {
  // 1) Check user-configured path
  const configured = getConfiguredServerPath();
  if (configured && fs.existsSync(configured)) {
    const ext = path.extname(configured).toLowerCase();
    if (ext === '.exe') return { cmd: configured, args: [], cwd: path.dirname(configured), type: 'exe' };
    if (ext === '.js') return { cmd: process.execPath, args: [configured], cwd: path.dirname(configured), type: 'node' };
  }

  // 2) Check bundled extraResources (packaged scenario)
  // In asar, process.resourcesPath points to the resources folder
  if (process.resourcesPath) {
    const bundledExe = path.join(process.resourcesPath, 'MegaBonkRelay.exe');
    if (fs.existsSync(bundledExe)) {
      return { cmd: bundledExe, args: [], cwd: path.dirname(bundledExe), type: 'exe' };
    }
  }

  // 3) Check next to the running tray executable (installed scenario)
  const nextToExec = path.join(path.dirname(process.execPath), 'MegaBonkRelay.exe');
  if (fs.existsSync(nextToExec)) {
    return { cmd: nextToExec, args: [], cwd: path.dirname(nextToExec), type: 'exe' };
  }

  // 4) Check default relay install dir (LOCALAPPDATA\MegaBonkRelay)
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const installExe = path.join(localAppData, 'MegaBonkRelay', 'MegaBonkRelay.exe');
    if (fs.existsSync(installExe)) {
      return { cmd: installExe, args: [], cwd: path.dirname(installExe), type: 'exe' };
    }
  }

  // 5) Check dist folder (build artifact)
  const distExe = path.join(__dirname, '..', 'dist', 'MegaBonkRelay.exe');
  if (fs.existsSync(distExe)) {
    return { cmd: distExe, args: [], cwd: path.dirname(distExe), type: 'exe' };
  }

  // 6) Check repo-level drop-in
  const repoExe = path.join(__dirname, '..', 'MegaBonkRelay.exe');
  if (fs.existsSync(repoExe)) {
    return { cmd: repoExe, args: [], cwd: path.dirname(repoExe), type: 'exe' };
  }

  // 7) Development JS file
  const jsPath = path.join(__dirname, '..', 'relay-server.js');
  if (fs.existsSync(jsPath)) {
    return { cmd: process.execPath, args: [jsPath], cwd: path.dirname(jsPath), type: 'node' };
  }

  // Not found
  return null;
}

function startServer() {
  // If a server is already running externally, warn the user
  if (serverRunning && !serverProcess) {
    showNotification(APP_NAME, 'Server already running (external)');
    return;
  }

  const opt = detectServerCommand();
  if (!opt) {
    showNotification(APP_NAME, 'Server executable not found — open tray menu and choose Configure Server...');
    updateMenu();
    return;
  }

  log('Starting server...');
  const env = { ...process.env, RELAY_LOGS_ENABLED: logsEnabled ? '1' : '0' };
  serverProcess = spawn(opt.cmd, opt.args, { cwd: opt.cwd, detached: false, env });

  // Mark running immediately for better UI responsiveness
  serverRunning = true;
  updateMenu();
  showNotification(APP_NAME, 'Starting server...');
  log('Server spawn requested');

  serverProcess.on('spawn', () => {
    log('Server spawned');
    showNotification(APP_NAME, 'Server started');
    log('Server started');
  });

  serverProcess.on('error', (err) => {
    serverRunning = false;
    updateMenu();
    log(`Server failed to start: ${err.message}`);
    showNotification(APP_NAME, `Server failed: ${err.message}`);
    serverProcess = null;
  });

  serverProcess.on('exit', (code, signal) => {
    serverRunning = false;
    updateMenu();
    log(`Server exited: code=${code} signal=${signal}`);
    showNotification(APP_NAME, 'Server stopped');
    serverProcess = null;
  });

  if (serverProcess.stdout) serverProcess.stdout.on('data', (d) => log(`[stdout] ${d.toString()}`));
  if (serverProcess.stderr) serverProcess.stderr.on('data', (d) => log(`[stderr] ${d.toString()}`));
}

function stopServer() {
  if (serverProcess) {
    log('Stopping server (owned process)...');
    try {
      serverProcess.kill();
    } catch (e) {
      log(`Failed to kill server: ${e.message}`);
    }
    return;
  }

  // No owned process, attempt to force stop external server
  if (serverRunning) {
    forceStop();
  }
}

function rebootServer() {
  log('Rebooting server...');
  stopServer();
  setTimeout(() => startServer(), 1000);
}

function openLog() {
  const lp = getLogPath();
  if (fs.existsSync(lp)) {
    shell.openPath(lp).then(() => {}).catch(() => {
      // fallback to notepad on Windows
      if (process.platform === 'win32') {
        exec(`notepad "${lp}"`);
      }
    });
  } else {
    showNotification(APP_NAME, 'Log file not found');
  }
}

function configureServer() {
  const result = dialog.showOpenDialogSync({
    title: 'Select server executable or relay-server.js',
    properties: ['openFile'],
    filters: [
      { name: 'Executables / JS', extensions: ['exe', 'js'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result && result[0]) {
    saveConfiguredServerPath(result[0]);
    showNotification(APP_NAME, 'Configured server: ' + result[0]);
    updateMenu();
  }
}

function requestSessionStatus() {
  const now = Date.now();
  if (now - sessionStatusLastChecked < 3000) return;
  sessionStatusLastChecked = now;

  const req = http.get(SESSION_URL, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        sessionTrackingActive = !!data?.session?.active;
        updateMenu();
      } catch (e) {
        // ignore parse errors
      }
    });
  });
  req.on('error', () => {
    // ignore
  });
  req.setTimeout(1500, () => req.abort());
}

function requestOverlayStatus() {
  const now = Date.now();
  if (now - overlayStatusLastChecked < 3000) return;
  overlayStatusLastChecked = now;

  const req = http.get(OVERLAY_STATUS_URL, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        overlayServingActive = !!data?.enabled;
        overlayAvailable = !!data?.available;
        updateMenu();
      } catch (e) {
        // ignore parse errors
      }
    });
  });
  req.on('error', () => {
    // ignore
  });
  req.setTimeout(1500, () => req.abort());
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = !!autoUpdatesEnabled;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    updateChecking = true;
    updateError = null;
    updateMenu();
  });

  autoUpdater.on('update-available', () => {
    updateAvailable = true;
    updateDownloaded = false;
    updateChecking = false;
    updateNotifyOnNoUpdate = false;
    updateMenu();
    showNotification(APP_NAME, 'Update available');
    if (autoUpdatesEnabled) {
      autoUpdater.downloadUpdate().catch(() => {});
    }
  });

  autoUpdater.on('update-not-available', () => {
    updateAvailable = false;
    updateDownloaded = false;
    updateChecking = false;
    updateError = null;
    updateMenu();
    if (updateNotifyOnNoUpdate) {
      showNotification(APP_NAME, 'No updates found');
      updateNotifyOnNoUpdate = false;
    }
  });

  autoUpdater.on('update-downloaded', () => {
    updateAvailable = true;
    updateDownloaded = true;
    updateChecking = false;
    updateError = null;
    updateMenu();
    showNotification(APP_NAME, 'Update downloaded. Restart to install.');
  });

  autoUpdater.on('error', (err) => {
    updateChecking = false;
    updateError = err?.message || 'Update check failed';
    updateAvailable = false;
    updateDownloaded = false;
    updateMenu();
    showNotification(APP_NAME, 'Update check failed');
    updateNotifyOnNoUpdate = false;
  });
}

function checkForUpdates({ notifyOnNoUpdate = false } = {}) {
  updateNotifyOnNoUpdate = !!notifyOnNoUpdate;
  try {
    autoUpdater.checkForUpdates().catch((err) => {
      updateChecking = false;
      updateError = err?.message || 'Update check failed';
      updateMenu();
      showNotification(APP_NAME, 'Update check failed');
      updateNotifyOnNoUpdate = false;
    });
  } catch (err) {
    updateChecking = false;
    updateError = err?.message || 'Update check failed';
    updateMenu();
    showNotification(APP_NAME, 'Update check failed');
    updateNotifyOnNoUpdate = false;
  }
}

function callOverlayAction(action) {
  const url = `${OVERLAY_ACTION_URL}/${action}`;
  const req = http.request(url, { method: 'POST' }, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        overlayServingActive = !!data?.enabled;
        overlayAvailable = !!data?.available;
        updateMenu();
        const statusText = overlayServingActive ? 'Overlay serving started' : 'Overlay serving stopped';
        if (!overlayAvailable) {
          showNotification(APP_NAME, 'Overlay build not found');
        } else {
          showNotification(APP_NAME, statusText);
        }
      } catch (e) {
        showNotification(APP_NAME, 'Overlay response invalid');
      }
    });
  });
  req.on('error', () => {
    showNotification(APP_NAME, 'Relay server not reachable');
  });
  req.end();
}

function callSessionAction(action) {
  const url = `${SESSION_URL}/${action}`;
  const req = http.request(url, { method: 'POST' }, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        sessionTrackingActive = !!data?.session?.active;
        updateMenu();
        const statusText = sessionTrackingActive ? 'Session tracking started' : 'Session tracking stopped';
        showNotification(APP_NAME, statusText);
      } catch (e) {
        showNotification(APP_NAME, 'Session tracking response invalid');
      }
    });
  });
  req.on('error', () => {
    showNotification(APP_NAME, 'Relay server not reachable');
  });
  req.end();
}

function forceStop() {
  // Try to forcibly stop by process name (Windows)
  log('Force stopping server...');
  if (process.platform === 'win32') {
    exec('taskkill /IM MegaBonkRelay.exe /F', (err, stdout, stderr) => {
      if (err) {
        log(`Force stop failed: ${err.message}`);
        showNotification(APP_NAME, 'Force stop failed');
        return;
      }
      log('Force stop succeeded');
      showNotification(APP_NAME, 'Server stopped');
      serverRunning = false;
      updateMenu();
    });
  } else {
    // On non-Windows, try to kill by name
    exec('pkill -f MegaBonkRelay', (err) => {
      if (err) {
        log(`Force stop failed: ${err.message}`);
        showNotification(APP_NAME, 'Force stop failed');
        return;
      }
      log('Force stop succeeded');
      showNotification(APP_NAME, 'Server stopped');
      serverRunning = false;
      updateMenu();
    });
  }
}

function checkHealth() {
  const req = http.get(HEALTH_URL, (res) => {
    // Any 2xx considered healthy
    const healthy = res.statusCode >= 200 && res.statusCode < 300;
    if (healthy) {
      if (!serverRunning) {
        serverRunning = true;
        updateMenu();
      }
      requestSessionStatus();
      requestOverlayStatus();
    } else {
      if (serverRunning && !serverProcess) {
        serverRunning = false;
        sessionTrackingActive = false;
        overlayServingActive = false;
        overlayAvailable = false;
        updateMenu();
      }
    }
    res.resume();
  });
  req.on('error', () => {
    if (serverRunning && !serverProcess) {
      serverRunning = false;
      sessionTrackingActive = false;
      overlayServingActive = false;
      overlayAvailable = false;
      updateMenu();
    }
  });
  req.setTimeout(1500, () => req.abort());
}

function createTray() {
  const iconFile = process.platform === 'win32' ? 'megaicon_v2.ico' : 'megaicon_v2.png';
  const iconPath = path.join(__dirname, 'images', iconFile);
  let img = null;
  if (fs.existsSync(iconPath)) {
    img = nativeImage.createFromPath(iconPath);
  }

  if (!img || img.isEmpty()) {
    // Simple inline SVG icon as data URL
    const svg = `data:image/svg+xml;utf8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" rx="3" fill="#4CAF50"/><text x="8" y="11" font-size="9" text-anchor="middle" font-family="Arial" fill="white">MB</text></svg>'
    )}`;
    img = nativeImage.createFromDataURL(svg);
  }
  tray = new Tray(img);
  tray.setToolTip(APP_NAME);
  updateMenu();

  // Start health polling
  if (!healthInterval) {
    checkHealth();
    healthInterval = setInterval(checkHealth, POLL_INTERVAL_MS);
  }
}

function updateMenu() {
  const statusLabel = serverRunning ? 'Status: Running' : 'Status: Stopped';
  const forceStopEnabled = serverRunning && !serverProcess;
  const detected = detectServerCommand();
  const configured = getConfiguredServerPath();
  const sessionLabel = sessionTrackingActive ? 'Session Tracking: On' : 'Session Tracking: Off';
  const overlayStatusLabel = overlayAvailable
    ? (overlayServingActive ? 'Overlay Serving: On' : 'Overlay Serving: Off')
    : 'Overlay: Build Not Found';
  let serverLabel = '';
  if (detected) {
    serverLabel = 'Server: ' + path.basename(detected.cmd);
  } else if (configured) {
    serverLabel = 'Configured: ' + path.basename(configured) + (fs.existsSync(configured) ? '' : ' (missing)');
  }
  const sessionSubmenu = [
    { label: sessionLabel, enabled: false },
    { type: 'separator' },
    { label: 'Start Session Tracking', click: () => callSessionAction('start'), enabled: !sessionTrackingActive },
    { label: 'Stop Session Tracking', click: () => callSessionAction('stop'), enabled: sessionTrackingActive },
  ];
  const overlaySubmenu = [
    { label: overlayStatusLabel, enabled: false },
    { type: 'separator' },
    { label: 'Start Overlay', click: () => callOverlayAction('start'), enabled: serverRunning && overlayAvailable && !overlayServingActive },
    { label: 'Stop Overlay', click: () => callOverlayAction('stop'), enabled: serverRunning && overlayServingActive },
    { type: 'separator' },
    { label: overlayVisible ? 'Hide Overlay Window' : 'Show Overlay Window', click: toggleOverlay },
    { label: `Hotkey: ${overlayHotkey || 'None'}`, enabled: false },
    { label: 'Set Overlay Hotkey...', click: async () => {
      const result = await createPromptWindow({
        title: 'Overlay Hotkey',
        label: 'Enter a global hotkey (e.g. Control+Shift+O)',
        value: overlayHotkey
      });
      if (result?.ok) {
        overlayHotkey = (result.value || '').trim();
        saveOverlaySettings();
        registerOverlayHotkeys();
        updateMenu();
      }
    } },
    { type: 'separator' },
    { label: `Clickable: ${overlayClickable ? 'On' : 'Off'}`, enabled: false },
    { label: overlayClickable ? 'Disable Click-through' : 'Enable Click-through', click: toggleOverlayClickability },
    { label: `Click Toggle Hotkey: ${overlayClickHotkey || 'None'}`, enabled: false },
    { label: 'Set Click Toggle Hotkey...', click: async () => {
      const result = await createPromptWindow({
        title: 'Overlay Click Toggle Hotkey',
        label: 'Enter a global hotkey (e.g. Control+Shift+I)',
        value: overlayClickHotkey
      });
      if (result?.ok) {
        overlayClickHotkey = (result.value || '').trim();
        saveOverlaySettings();
        registerOverlayHotkeys();
        updateMenu();
      }
    } }
  ];
  const updateCheckLabel = updateDownloaded
    ? 'Restart to Install Update'
    : updateAvailable
      ? 'Update Available'
      : updateChecking
        ? 'Checking for updates...'
        : 'Check for updates';
  const updatesSubmenu = [
    {
      label: autoUpdatesEnabled ? 'Disable Auto-Updates' : 'Enable Auto-Updates',
      click: () => {
        autoUpdatesEnabled = !autoUpdatesEnabled;
        autoUpdater.autoDownload = !!autoUpdatesEnabled;
        saveUpdateSettings();
        updateMenu();
        showNotification(APP_NAME, autoUpdatesEnabled ? 'Auto-updates enabled' : 'Auto-updates disabled');
        if (autoUpdatesEnabled) {
          checkForUpdates();
        }
      }
    },
    {
      label: updateCheckLabel,
      enabled: !updateChecking,
      click: () => {
        if (updateDownloaded) {
          autoUpdater.quitAndInstall();
          return;
        }
        if (updateAvailable && !autoUpdatesEnabled) {
          autoUpdater.downloadUpdate().catch(() => {});
          return;
        }
        checkForUpdates({ notifyOnNoUpdate: true });
      }
    },
  ];

  const template = [
    { label: statusLabel, enabled: false },
    ...(serverLabel ? [{ label: serverLabel, enabled: false }] : []),
    { type: 'separator' },
    { label: 'Start', click: startServer, enabled: !serverRunning },
    { label: 'Reboot', click: rebootServer, enabled: serverRunning && !!serverProcess },
    { label: 'Stop', click: stopServer, enabled: serverRunning && !!serverProcess },
    // { label: 'Force Stop', click: forceStop, enabled: forceStopEnabled },
    { type: 'separator' },
    { label: 'Turn on logs', type: 'checkbox', checked: logsEnabled, click: () => {
      logsEnabled = !logsEnabled;
      saveOverlaySettings();
      updateMenu();
      showNotification(APP_NAME, logsEnabled ? 'Logs enabled' : 'Logs disabled');
      if (serverProcess) {
        showNotification(APP_NAME, 'Restart server to apply log setting');
      }
    } },
    { label: 'Session', submenu: sessionSubmenu },
    { label: 'Overlay', submenu: overlaySubmenu },
    { label: 'Updates', submenu: updatesSubmenu },
    { type: 'separator' },
    { label: 'Configure Server...', click: configureServer },
    { label: 'Open Log', click: openLog },
    { type: 'separator' },
    { label: 'Exit', click: () => { stopServer(); app.quit(); } }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

app.on('ready', () => {
  ensureWindowsAppIdentity();
  loadOverlaySettings();
  loadUpdateSettings();
  configureAutoUpdater();
  if (autoUpdatesEnabled) {
    checkForUpdates();
  }
  registerOverlayHotkeys();
  createTray();
  // Auto-start server on tray launch
  startServer();
});

app.on('window-all-closed', (e) => {
  // Keep app running in tray
  e.preventDefault();
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  stopServer();
});
