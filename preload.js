const { contextBridge, ipcRenderer } = require('electron');
const on = (ch) => (cb) => ipcRenderer.on(ch, (_e, d) => cb(d));
contextBridge.exposeInMainWorld('nova', {
  cmd: (name, args) => ipcRenderer.invoke('cmd', name, args),
  state: () => ipcRenderer.invoke('state'),
  thumbs: () => ipcRenderer.invoke('thumbs'),
  onState: on('state'), onOverlay: on('overlay'), onToast: on('toast'), onFound: on('found'), onMaximized: on('maximized'), onPeek: on('peek'),
});
