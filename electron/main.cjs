// Electron main process for Aetheria Chronicles - the standalone Windows desktop edition.
//  - custom dark window frame (hidden native title bar + themed caption-button overlay)
//  - native filesystem saves in ./saves/*.json (next to the .exe when packaged)
//  - F11 / Alt+Enter fullscreen, resolution presets, Quit to Desktop, Open Saves Folder
//  - the bilingual strategy wiki is the only website: it opens in the OS browser
//  - `--dev` loads the Vite dev server, `--selftest` runs an automated smoke test and exits
//  - `--gfx=<classic|low|medium|high|ultra|cinematic>` forces a graphics preset for this run
//  - `--selftest --trace` also records a Chromium trace of the run to saves/selftest-trace.json
const { app, BrowserWindow, Menu, contentTracing, ipcMain, net, screen, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const isDev = process.argv.includes('--dev');
const isSelftest = process.argv.includes('--selftest');
const GFX_PRESETS = ['classic', 'low', 'medium', 'high', 'ultra', 'cinematic', 'auto'];
const gfxArg = (process.argv.find((a) => a.startsWith('--gfx=')) || '').slice(6).toLowerCase();
const forcedGfx = GFX_PRESETS.includes(gfxArg) ? gfxArg : '';
const isTrace = isSelftest && process.argv.includes('--trace');
const DEV_URL = 'http://127.0.0.1:5173';
const WIKI_URL = 'https://nirco99.github.io/aetheria-chronicles-rpg/wiki/';
const TITLEBAR_H = 32;
const SAFE_NAME = /^[a-z0-9_-]{1,48}\.json$/i;

app.setName('Aetheria Chronicles');
// The 3D renderer wants the discrete GPU on machines that have both an integrated and a dedicated one.
app.commandLine.appendSwitch('force_high_performance_gpu');
if (process.platform === 'win32') app.setAppUserModelId('com.aetheria.chronicles');

// ------------------------------------------------------------------ saves on disk

function resolveSavesDir() {
  const candidates = app.isPackaged
    ? [path.join(path.dirname(process.execPath), 'saves'), path.join(app.getPath('userData'), 'saves')]
    : [path.join(app.getAppPath(), 'saves'), path.join(app.getPath('userData'), 'saves')];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      /* try the next candidate */
    }
  }
  return app.getPath('userData');
}

let SAVES = '';
const savePath = (name) => {
  if (!SAFE_NAME.test(String(name))) throw new Error(`Rejected save file name: ${name}`);
  return path.join(SAVES, name);
};

ipcMain.on('app:info', (e) => {
  e.returnValue = { version: app.getVersion(), savesDir: SAVES, selftest: isSelftest, packaged: app.isPackaged, platform: process.platform };
});

ipcMain.on('saves:read', (e, name) => {
  try {
    const f = savePath(name);
    e.returnValue = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  } catch (err) {
    console.error(err);
    e.returnValue = null;
  }
});

ipcMain.on('saves:write', (e, name, data) => {
  try {
    const f = savePath(name);
    const tmp = `${f}.tmp`;
    fs.writeFileSync(tmp, String(data), 'utf8');
    fs.renameSync(tmp, f);
    e.returnValue = true;
  } catch (err) {
    console.error(err);
    e.returnValue = false;
  }
});

// Deleting a slot moves it into saves/deleted/ instead of destroying it.
ipcMain.on('saves:remove', (e, name) => {
  try {
    const f = savePath(name);
    if (fs.existsSync(f)) {
      const bin = path.join(SAVES, 'deleted');
      fs.mkdirSync(bin, { recursive: true });
      fs.renameSync(f, path.join(bin, `${path.basename(name, '.json')}-${Date.now()}.json`));
    }
    e.returnValue = true;
  } catch (err) {
    console.error(err);
    e.returnValue = false;
  }
});

ipcMain.on('saves:list', (e) => {
  try {
    e.returnValue = fs.readdirSync(SAVES).filter((n) => SAFE_NAME.test(n));
  } catch {
    e.returnValue = [];
  }
});

ipcMain.handle('saves:openFolder', () => shell.openPath(SAVES));

// ------------------------------------------------------------------ window controls

const winOf = (e) => BrowserWindow.fromWebContents(e.sender);

ipcMain.on('win:toggleFullscreen', (e) => {
  const w = winOf(e);
  if (w) w.setFullScreen(!w.isFullScreen());
  e.returnValue = w ? w.isFullScreen() : false;
});
ipcMain.on('win:setFullscreen', (e, on) => {
  const w = winOf(e);
  if (w) w.setFullScreen(!!on);
  e.returnValue = w ? w.isFullScreen() : false;
});
ipcMain.on('win:isFullscreen', (e) => {
  const w = winOf(e);
  e.returnValue = w ? w.isFullScreen() : false;
});
ipcMain.on('win:setResolution', (e, width, height) => {
  const w = winOf(e);
  if (!w) return;
  if (w.isFullScreen()) w.setFullScreen(false);
  if (w.isMaximized()) w.unmaximize();
  const area = screen.getDisplayMatching(w.getBounds()).workAreaSize;
  w.setContentSize(Math.min(Math.round(width), area.width), Math.min(Math.round(height) + TITLEBAR_H, area.height));
  w.center();
});
ipcMain.on('app:quit', () => app.quit());
ipcMain.on('app:openWiki', () => openWiki());
ipcMain.on('app:openExternal', (_e, url) => {
  if (/^https:\/\//i.test(String(url))) shell.openExternal(String(url));
});

function openWiki() {
  const local = app.isPackaged ? path.join(process.resourcesPath, 'wiki', 'index.html') : path.join(__dirname, '..', 'wiki', 'index.html');
  if (net.isOnline() || !fs.existsSync(local)) shell.openExternal(WIKI_URL);
  else shell.openExternal(pathToFileURL(local).href);
}

// ------------------------------------------------------------------ self-test

const selftestErrors = [];
function writeSelftest(report) {
  try {
    let gpu = null;
    try {
      gpu = app.getGPUFeatureStatus();
    } catch {
      gpu = null;
    }
    const out = { ...report, mainErrors: selftestErrors, gpu, savesDir: SAVES, exe: process.execPath, finished: new Date().toISOString() };
    fs.writeFileSync(path.join(SAVES, 'selftest-report.json'), JSON.stringify(out, null, 2), 'utf8');
  } catch (err) {
    console.error(err);
  }
}
ipcMain.on('selftest:report', (e, json) => {
  let report = {};
  try {
    report = JSON.parse(String(json));
  } catch {
    report = { parseError: true };
  }
  writeSelftest(report);
  const trace = isTrace ? contentTracing.stopRecording(path.join(SAVES, 'selftest-trace.json')).catch(() => undefined) : Promise.resolve();
  // keep a capture of the final frame next to the report for visual verification
  e.sender
    .capturePage()
    .then((img) => fs.writeFileSync(path.join(SAVES, 'selftest-capture.png'), img.toPNG()))
    .catch(() => undefined)
    .then(() => trace)
    .finally(() => setTimeout(() => app.quit(), 250));
});

// ------------------------------------------------------------------ main window

function createWindow() {
  const icon = path.join(__dirname, '..', 'build', 'icon.png');
  const win = new BrowserWindow({
    width: 1440,
    height: 860 + TITLEBAR_H,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#05070d',
    title: 'Aetheria Chronicles',
    icon: fs.existsSync(icon) ? icon : undefined,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#070b16', symbolColor: '#9fdcff', height: TITLEBAR_H },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  // No in-app browsing: https links (the wiki, the repo) go to the OS browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? url.startsWith(DEV_URL) : url.startsWith('file:');
    if (!allowed) {
      event.preventDefault();
      if (/^https:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  // F11 / Alt+Enter toggle fullscreen, Ctrl+Shift+I opens devtools.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
  const sendFs = () => win.webContents.send('win:fullscreen', win.isFullScreen());
  win.on('enter-full-screen', sendFs);
  win.on('leave-full-screen', sendFs);

  win.webContents.on('console-message', (...args) => {
    const ev = args[0] || {};
    const level = ev.level !== undefined ? ev.level : args[1];
    const message = ev.message !== undefined ? ev.message : args[2];
    if (level === 'error' || level === 3) selftestErrors.push(String(message));
  });
  win.webContents.on('render-process-gone', (_e, details) => selftestErrors.push(`render-process-gone: ${details.reason}`));

  if (isSelftest) {
    setTimeout(() => {
      writeSelftest({ ok: false, reason: 'timeout - the renderer never reported back' });
      app.quit();
    }, 60000);
  }

  const query = forcedGfx ? { gfx: forcedGfx } : undefined;
  if (isDev) win.loadURL(DEV_URL + (forcedGfx ? `/?gfx=${forcedGfx}` : ''));
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), query ? { query } : undefined);
}

Menu.setApplicationMenu(null);

const gotLock = isSelftest || app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  });
  app.whenReady().then(async () => {
    SAVES = resolveSavesDir();
    if (isTrace) {
      await contentTracing
        .startRecording({ included_categories: ['toplevel', 'devtools.timeline', 'blink', 'cc', 'gpu', 'viz', 'v8', 'loading', 'ipc', 'mojom', 'audio', 'media', 'fonts'] })
        .catch(() => undefined);
    }
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
