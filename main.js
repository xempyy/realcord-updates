const path = require('path');
const Module = require('module');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

// =========================================================================
// 1. VOICE MODULE INTERCEPTION
// =========================================================================
const originalRequire = Module.prototype.require;

Module.prototype.require = function(request) {
  if (request.includes('discord_voice') || request === 'discord_voice.node') {
    console.log('[Realcord] Intercepted voice engine request. Blocking native module...');
    throw new Error('Native voice engine disabled.');
  }
  return originalRequire.apply(this, arguments);
};

// =========================================================================
// 2. ELECTRON WINDOW MANAGEMENT
// =========================================================================
function createWindow() {
  const localPreloadPath = path.join(__dirname, 'preload.js');

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: localPreloadPath,
      nodeIntegration: false,
      contextIsolation: false, // Force disabled for console access
    },
    title: "Stereo Discord Client",
  });

  // SPOOF USER AGENT
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