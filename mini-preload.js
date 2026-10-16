// The slim toolbar of a tab that lives in a window of its own (ui/mini.html): it only talks to main.js, never to the page.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mini', {
  cmd: (name, arg) => ipcRenderer.send('mini:cmd', name, arg),
  onState: (cb) => ipcRenderer.on('mini:state', (_e, d) => cb(d)),
  onFocus: (cb) => ipcRenderer.on('mini:focus', () => cb()),
});
