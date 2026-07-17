const path = require('path');
const Module = require('module');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

// =========================================================================
// 1. VOICE MODULE INTERCEPTION (Forces fallback to Browser WebRTC API)
// =========================================================================
const originalRequire = Module.prototype.require;

Module.prototype.require = function(request) {
  // If Discord tries to load its native desktop voice engine, block it.
  // This forces Discord to fall back to standard browser-level WebRTC/getUserMedia,
  // which makes our preload.js stereo audio graph actually work.
  if (request.includes('discord_voice') || request === 'discord_voice.node') {
    console.log('[Realcord] Intercepted voice engine request. Blocking native module to force WebRTC fallback...');
    throw new Error('Native voice engine disabled to force WebRTC fallback.');
  }
  return originalRequire.apply(this, arguments);
};

// =========================================================================
// 2. ELECTRON WINDOW MANAGEMENT & DYNAMIC UPDATER
// =========================================================================
function createWindow() {
  const localPreloadPath = path.join(__dirname, 'preload.js');

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: localPreloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "Stereo Discord Client",
  });

  // Dynamic Update Check: Fetches your fresh script from GitHub on startup
  const REMOTE_PRELOAD_URL = "https://raw.githubusercontent.com/xempyy/realcord-updates/refs/heads/main/preload.js";

  fetch(REMOTE_PRELOAD_URL)
    .then(res => res.text())
    .then(onlineCode => {
      if (onlineCode && onlineCode.includes('Stereo')) {
        fs.writeFileSync(localPreloadPath, onlineCode, 'utf-8');
        console.log('[Updater] Preload script updated successfully!');
      }
    })
    .catch(err => {
      console.log('[Updater] Offline or check failed. Using cached version.', err);
    });

  // Spoofs standard Chrome browser so Discord allows the connection
  const customUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  mainWindow.loadURL('https://discord.com/app', { userAgent: customUserAgent });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});