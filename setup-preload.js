const { contextBridge, ipcRenderer } = require('electron');
const call = (ch) => (a) => ipcRenderer.invoke(ch, a);
contextBridge.exposeInMainWorld('setup', {
  init: call('setup:init'), browse: call('setup:browse'), install: call('setup:install'), launch: call('setup:launch'),
  defaults: call('setup:defaults'), uninstall: call('setup:uninstall'), close: call('setup:close'),
  onProgress: (cb) => ipcRenderer.on('setup:progress', (_e, d) => cb(d)),
  onError: (cb) => ipcRenderer.on('setup:error', (_e, d) => cb(d)),
});
