// Preload bridge: exposes a small, explicit desktop API to the game as window.aetheriaDesktop.
// File access is limited to *.json names inside the saves folder (validated in the main process).
const { contextBridge, ipcRenderer } = require('electron');

const info = ipcRenderer.sendSync('app:info') || {};

contextBridge.exposeInMainWorld('aetheriaDesktop', {
  isDesktop: true,
  version: String(info.version || '0.0.0'),
  savesDir: String(info.savesDir || ''),
  selftest: !!info.selftest,
  packaged: !!info.packaged,
  readFile: (name) => ipcRenderer.sendSync('saves:read', String(name)),
  writeFile: (name, data) => ipcRenderer.sendSync('saves:write', String(name), String(data)),
  removeFile: (name) => ipcRenderer.sendSync('saves:remove', String(name)),
  listFiles: () => ipcRenderer.sendSync('saves:list'),
  openSavesFolder: () => ipcRenderer.invoke('saves:openFolder'),
  toggleFullscreen: () => ipcRenderer.sendSync('win:toggleFullscreen'),
  setFullscreen: (on) => ipcRenderer.sendSync('win:setFullscreen', !!on),
  isFullscreen: () => ipcRenderer.sendSync('win:isFullscreen'),
  setResolution: (w, h) => ipcRenderer.send('win:setResolution', Number(w), Number(h)),
  quit: () => ipcRenderer.send('app:quit'),
  openWiki: () => ipcRenderer.send('app:openWiki'),
  openExternal: (url) => ipcRenderer.send('app:openExternal', String(url)),
  reportSelftest: (report) => ipcRenderer.send('selftest:report', JSON.stringify(report)),
  onFullscreenChange: (cb) => ipcRenderer.on('win:fullscreen', (_e, on) => cb(!!on)),
});
