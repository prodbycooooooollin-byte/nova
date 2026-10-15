// Runs before any page script in every frame of Nova's tabs and gives the page the window.chrome
// object that regular Chrome has (Electron leaves it empty), so Nova looks like the Chromium browser it is.
const { contextBridge } = require('electron');
try {
  contextBridge.executeInMainWorld({
    func: () => {
      const c = window.chrome || (window.chrome = {});
      if (!c.app) c.app = { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }, getDetails() { return null; }, getIsInstalled() { return false; }, runningState() { return 'cannot_run'; } };
      if (!c.csi) c.csi = function () { return { startE: Math.round(performance.timeOrigin), onloadT: Date.now(), pageT: performance.now(), tran: 15 }; };
      if (!c.loadTimes) c.loadTimes = function () { const t = performance.timeOrigin / 1000; return { requestTime: t, startLoadTime: t, commitLoadTime: t, finishDocumentLoadTime: 0, finishLoadTime: 0, firstPaintTime: 0, firstPaintAfterLoadTime: 0, navigationType: 'Other', wasFetchedViaSpdy: true, wasNpnNegotiated: true, npnNegotiatedProtocol: 'h2', wasAlternateProtocolAvailable: false, connectionInfo: 'h2' }; };
    },
  });
} catch (e) { /* not available in this frame */ }
