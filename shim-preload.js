// Runs before any page script in every frame of Nova's tabs and gives the page the window.chrome
// object that regular Chrome has (Electron leaves it empty), so Nova looks like the Chromium browser it is.
const { contextBridge, ipcRenderer } = require('electron');
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

// Passkeys and security keys: a page that asks for one makes Windows open its security window and ask for a PIN. Unless the person switched them on
// (Settings > Search & privacy), such a request is answered like a cancelled one and pages are told no passkey is available, so they offer the password.
try {
  let cfg = { passkeys: false, wheel: false };
  try { cfg = ipcRenderer.sendSync('nova:shim') || cfg; } catch (e) { /* keep the defaults */ }
  if (cfg.wheel) { // a wheel shortcut with Ctrl, Alt or Shift exists: tell Nova when the page sees such a turn (passive, so scrolling is never held up)
    window.addEventListener('wheel', (ev) => {
      if (!ev.isTrusted || !(ev.ctrlKey || ev.altKey || ev.shiftKey || ev.metaKey)) return;
      const mods = []; if (ev.ctrlKey || ev.metaKey) mods.push('Ctrl'); if (ev.altKey) mods.push('Alt'); if (ev.shiftKey) mods.push('Shift');
      const dir = Math.abs(ev.deltaY) >= Math.abs(ev.deltaX) ? (ev.deltaY < 0 ? 'WheelUp' : 'WheelDown') : (ev.deltaX < 0 ? 'WheelLeft' : 'WheelRight');
      try { ipcRenderer.send('nova:wheel', { mods, dir }); } catch (e) { /* closing */ }
    }, { capture: true, passive: true });
  }
  if (cfg.passkeys !== true) {
    contextBridge.executeInMainWorld({
      func: () => {
        try {
          const C = window.CredentialsContainer && CredentialsContainer.prototype;
          if (C) {
            const get = C.get, create = C.create, deny = () => Promise.reject(new DOMException('The operation either timed out or was not allowed.', 'NotAllowedError'));
            C.get = { get(o) { return o && o.publicKey ? deny() : get.apply(this, arguments); } }.get;
            C.create = { create(o) { return o && o.publicKey ? deny() : create.apply(this, arguments); } }.create;
          }
          if (window.PublicKeyCredential) {
            PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = () => Promise.resolve(false);
            PublicKeyCredential.isConditionalMediationAvailable = () => Promise.resolve(false);
          }
        } catch (e) { /* the page has no credentials API */ }
      },
    });
  }
} catch (e) { /* not available in this frame */ }
