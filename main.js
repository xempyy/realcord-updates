const path = require('path');
const Module = require('module');
const fs = require('fs'); // Added to write the updated preload file to your disk
const { app, BrowserWindow } = require('electron');

// =========================================================================
// 1. VOICE MODULE INTERCEPTION (Runs before Electron UI initialization)
// =========================================================================
const originalRequire = Module.prototype.require;

Module.prototype.require = function(request) {
  // If Discord tries to load its default mono voice engine, intercept it
  if (request.includes('discord_voice') || request === 'discord_voice.node') {
    console.log('[Realcord] Intercepted voice engine. Injecting stereo binary...');
    
    // Resolve the target binary path
    let targetPath = path.join(__dirname, 'voice_module', 'discord_voice.node');
    
    // FIX: If running inside the packaged app.asar, point to the unpacked folder instead
    if (targetPath.includes('app.asar')) {
      targetPath = targetPath.replace('app.asar', 'app.asar.unpacked');
    }
    
    console.log('[Realcord] Loading binary from: ' + targetPath);
    
    // Redirect to your local, patched C++ module
    return originalRequire.call(this, targetPath);
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
      // Basic verification to ensure we actually got the JS file and not an error page
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