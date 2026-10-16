// Preload of the small card the password saver shows over a page ("Save password?" and the list of saved logins).
// The card never receives a password: it is told the site and the user name, and answers with what the user clicked.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('novaPw', {
  onModel: (cb) => ipcRenderer.on('nova:pwcard-model', (_e, m) => cb(m)),
  onSelect: (cb) => ipcRenderer.on('nova:pwcard-select', (_e, i) => cb(i)),
  send: (op, arg) => ipcRenderer.send('nova:pwcard', op, arg),
});
