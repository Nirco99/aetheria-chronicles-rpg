// Electron main process for Aetheria Chronicles: Sword & Forge.
// `electron . --dev` loads the Vite dev server; `electron .` loads the production build in dist/.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

const isDev = process.argv.includes('--dev');
const DEV_URL = 'http://127.0.0.1:5173';

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#05070d',
    title: 'Aetheria Chronicles: Sword & Forge',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  win.once('ready-to-show', () => win.show());

  // The in-game "Open Strategy Wiki" button uses window.open(): wiki pages open in their own
  // desktop window, any other web link opens in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('/wiki/')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1280,
          height: 860,
          autoHideMenuBar: true,
          backgroundColor: '#0b0f1a',
          title: 'Aetheria Strategy Wiki',
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
        },
      };
    }
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // F11 toggles fullscreen, Ctrl+Shift+I opens devtools.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (isDev) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
