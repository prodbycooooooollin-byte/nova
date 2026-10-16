// Electron implements only part of the chrome.* extension APIs. Password managers such as Proton Pass touch a few of the missing ones
// (permissions, alarms, action, offscreen) while they start up and stall when they find nothing. This file fills those gaps with small,
// honest stand-ins. It runs in extension service workers (registered as a service-worker preload) and in extension popup windows.
function novaPatchChrome(c) {
  if (!c || c.__novaShim) return;
  try { Object.defineProperty(c, '__novaShim', { value: true }); } catch { return; }
  const noop = () => {};
  const evt = () => { const l = new Set(); return { addListener: (f) => l.add(f), removeListener: (f) => l.delete(f), hasListener: (f) => l.has(f), hasListeners: () => l.size > 0, _fire: (...a) => l.forEach((f) => { try { f(...a); } catch (e) { console.error(e); } }) }; };
  const done = (args, v) => { const f = args[args.length - 1]; if (typeof f === 'function') { try { f(v); } catch {} return undefined; } return Promise.resolve(v); };
  const manifest = (() => { try { return c.runtime.getManifest() || {}; } catch { return {}; } })();
  const def = (name, obj) => { if (!c[name]) { try { c[name] = obj; } catch { try { Object.defineProperty(c, name, { value: obj, configurable: true }); } catch {} } } };

  // permissions: everything the manifest asks for is treated as granted
  const granted = () => ({ permissions: manifest.permissions || [], origins: manifest.host_permissions || [] });
  def('permissions', { contains: (...a) => done(a, true), request: (...a) => done(a, true), remove: (...a) => done(a, true), getAll: (...a) => done(a, granted()), onAdded: evt(), onRemoved: evt() });

  // alarms: timers that live as long as the worker does
  if (!c.alarms) {
    const timers = new Map(), onAlarm = evt();
    const mk = (name, t, repeat) => { clearTimeout(timers.get(name)?.id); const fire = () => { onAlarm._fire({ name, scheduledTime: Date.now() }); if (repeat) timers.set(name, { id: setTimeout(fire, repeat * 60000), t: Date.now() + repeat * 60000, repeat }); else timers.delete(name); }; timers.set(name, { id: setTimeout(fire, Math.max(0, t - Date.now())), t, repeat }); };
    def('alarms', {
      create: (...a) => { const name = typeof a[0] === 'string' ? a[0] : ''; const info = (typeof a[0] === 'string' ? a[1] : a[0]) || {}; mk(name, info.when || Date.now() + (info.delayInMinutes ?? info.periodInMinutes ?? 0) * 60000, info.periodInMinutes); return done(a, undefined); },
      get: (...a) => { const n = typeof a[0] === 'string' ? a[0] : ''; const t = timers.get(n); return done(a, t ? { name: n, scheduledTime: t.t, periodInMinutes: t.repeat } : undefined); },
      getAll: (...a) => done(a, [...timers].map(([name, t]) => ({ name, scheduledTime: t.t, periodInMinutes: t.repeat }))),
      clear: (...a) => { const n = typeof a[0] === 'string' ? a[0] : ''; const had = timers.has(n); clearTimeout(timers.get(n)?.id); timers.delete(n); return done(a, had); },
      clearAll: (...a) => { timers.forEach((t) => clearTimeout(t.id)); timers.clear(); return done(a, true); },
      onAlarm,
    });
  }

  // action: toolbar badge and icon calls become no-ops
  const act = {}; for (const n of ['setIcon', 'setBadgeText', 'setBadgeBackgroundColor', 'setBadgeTextColor', 'setTitle', 'setPopup', 'enable', 'disable', 'openPopup']) act[n] = (...a) => done(a, undefined);
  for (const n of ['getBadgeText', 'getTitle', 'getPopup']) act[n] = (...a) => done(a, '');
  act.onClicked = evt();
  def('action', act);
  if (!c.browserAction) def('browserAction', act);

  // offscreen documents only serve clipboard clearing and similar extras here
  def('offscreen', { createDocument: (...a) => done(a, undefined), closeDocument: (...a) => done(a, undefined), hasDocument: (...a) => done(a, false), Reason: new Proxy({}, { get: (_t, k) => String(k) }) });
  def('commands', { getAll: (...a) => done(a, []), onCommand: evt() });
  def('idle', { queryState: (...a) => done(a, 'active'), setDetectionInterval: noop, onStateChanged: evt() });
  def('sidePanel', { setOptions: (...a) => done(a, undefined), setPanelBehavior: (...a) => done(a, undefined), open: (...a) => done(a, undefined) });

  // any other namespace Electron leaves out becomes an inert stand-in: methods answer "nothing", events never fire
  const inert = () => { const t = {}; return new Proxy(t, { has: () => true, get: (_o, k) => { if (typeof k === 'symbol') return undefined; if (!(k in t)) t[k] = /^on[A-Z]/.test(k) ? evt() : (...a) => done(a, undefined); return t[k]; } }); };
  for (const n of ['accessibilityFeatures', 'bookmarks', 'browsingData', 'contentSettings', 'contextMenus', 'cookies', 'declarativeContent', 'declarativeNetRequest', 'dns', 'downloads', 'history', 'identity', 'management', 'notifications', 'omnibox', 'pageCapture', 'power', 'privacy', 'proxy', 'readingList', 'search', 'sessions', 'system', 'tabGroups', 'topSites', 'tts', 'userScripts', 'webNavigation', 'webRequest']) def(n, inert());
  // windows / tabs: the constants extensions compare against, and a single pretend window when the worker has no windows API
  const win = { id: 1, focused: true, type: 'normal', state: 'normal', incognito: false, alwaysOnTop: false };
  def('windows', { get: (...a) => done(a, win), getCurrent: (...a) => done(a, win), getLastFocused: (...a) => done(a, win), getAll: (...a) => done(a, [win]), create: (...a) => done(a, win), update: (...a) => done(a, win), remove: (...a) => done(a, undefined), onCreated: evt(), onRemoved: evt(), onFocusChanged: evt(), onBoundsChanged: evt() });
  const konst = (o, vals) => { if (!o) return; for (const [k, v] of Object.entries(vals)) if (o[k] === undefined) { try { o[k] = v; } catch { try { Object.defineProperty(o, k, { value: v, configurable: true }); } catch {} } } };
  konst(c.windows, { WINDOW_ID_NONE: -1, WINDOW_ID_CURRENT: -2 }); konst(c.tabs, { TAB_ID_NONE: -1 });
  // extension: the permission questions some extensions ask on start-up (Dark Reader's popup waits for the answer)
  if (!c.extension) def('extension', {});
  if (c.extension) {
    const ext = c.extension;
    for (const [n, v] of Object.entries({ isAllowedFileSchemeAccess: true, isAllowedIncognitoAccess: false })) if (typeof ext[n] !== 'function') { try { ext[n] = (...a) => done(a, v); } catch (e) { /* read-only */ } }
    if (typeof ext.getViews !== 'function') { try { ext.getViews = () => []; } catch (e) { /* read-only */ } }
  }
  // storage: Electron only has the local area. Extensions such as Dark Reader and Bitwarden read their settings from storage.sync, so it
  // becomes a second name for local, and the missing managed/session areas get small stand-ins.
  if (c.storage) {
    const st = c.storage;
    if (st.local) { // Electron has a stub here whose methods answer "not available": point it at the local area instead
      let done1 = false;
      try { Object.defineProperty(st, 'sync', { value: st.local, configurable: true, enumerable: true }); done1 = st.sync === st.local; } catch (e) { /* not replaceable */ }
      if (!done1) { try { if (!st.sync) st.sync = {}; for (const m of ['get', 'set', 'remove', 'clear', 'getBytesInUse', 'getKeys', 'setAccessLevel']) if (typeof st.local[m] === 'function') st.sync[m] = st.local[m].bind(st.local); if (!st.sync.onChanged) st.sync.onChanged = evt(); } catch (e) { /* give up */ } }
      try { for (const [k, v] of Object.entries({ QUOTA_BYTES: 102400, QUOTA_BYTES_PER_ITEM: 8192, MAX_ITEMS: 512, MAX_WRITE_OPERATIONS_PER_HOUR: 1800, MAX_WRITE_OPERATIONS_PER_MINUTE: 120 })) if (st.sync[k] === undefined) st.sync[k] = v; } catch (e) { /* ignore */ }
    }
    { const managed = { get: (...a) => done(a, {}), getKeys: (...a) => done(a, []), getBytesInUse: (...a) => done(a, 0), onChanged: evt() }; // Electron's own managed area answers "not available"
      try { Object.defineProperty(st, 'managed', { value: managed, configurable: true, enumerable: true }); } catch (e) { try { st.managed = managed; } catch (e2) { /* read-only */ } } }
    if (!st.session) {
      const mem = new Map(), changed = evt();
      const pick = (keys) => { const out = {}; if (keys == null) { mem.forEach((v, k) => { out[k] = v; }); return out; } const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys); for (const k of list) if (mem.has(k)) out[k] = mem.get(k); else if (keys && typeof keys === 'object' && !Array.isArray(keys)) out[k] = keys[k]; return out; };
      try { st.session = { get: (...a) => done(a, pick(typeof a[0] === 'function' ? null : a[0])), set: (...a) => { const ch = {}; for (const [k, v] of Object.entries(a[0] || {})) { ch[k] = { oldValue: mem.get(k), newValue: v }; mem.set(k, v); } changed._fire(ch, 'session'); return done(a, undefined); }, remove: (...a) => { for (const k of [].concat(a[0])) mem.delete(k); return done(a, undefined); }, clear: (...a) => { mem.clear(); return done(a, undefined); }, getBytesInUse: (...a) => done(a, 0), onChanged: changed }; } catch (e) { /* read-only */ }
    }
  }
  // tabs: the worker side of Electron has no tabs.create/update/...: opening options pages is skipped instead of crashing the extension
  if (c.tabs) {
    const fakeTab = (p) => ({ id: -1, index: 0, windowId: 1, active: true, pinned: false, highlighted: true, incognito: false, url: (p && p.url) || '', title: '' });
    for (const [n, fn] of Object.entries({ create: (p) => fakeTab(p), update: (_id, p) => fakeTab(typeof _id === 'object' ? _id : p), remove: () => undefined, reload: () => undefined, duplicate: () => fakeTab(), get: () => fakeTab(), getCurrent: () => undefined, query: () => [], sendMessage: () => undefined, goBack: () => undefined, goForward: () => undefined, move: () => [], group: () => 0, ungroup: () => undefined, discard: () => undefined, captureVisibleTab: () => '' })) {
      if (typeof c.tabs[n] !== 'function') { try { c.tabs[n] = (...a) => { const cb = a[a.length - 1]; const v = fn(...a.filter((x) => typeof x !== 'function')); if (typeof cb === 'function') { try { cb(v); } catch (e) { /* ignore */ } return undefined; } return Promise.resolve(v); }; } catch (e) { /* read-only */ } }
    }
  }
  // namespaces that exist but lack events extensions subscribe to at start-up
  const events = { tabs: ['onCreated', 'onUpdated', 'onActivated', 'onRemoved', 'onReplaced', 'onMoved', 'onAttached', 'onDetached', 'onHighlighted', 'onZoomChange'], windows: ['onCreated', 'onRemoved', 'onFocusChanged', 'onBoundsChanged'], runtime: ['onInstalled', 'onStartup', 'onSuspend', 'onSuspendCanceled', 'onConnect', 'onConnectExternal', 'onMessage', 'onMessageExternal', 'onUpdateAvailable', 'onRestartRequired', 'onBrowserUpdateAvailable'], storage: ['onChanged'], contextMenus: ['onClicked'], webNavigation: ['onBeforeNavigate', 'onCommitted', 'onCompleted', 'onDOMContentLoaded', 'onCreatedNavigationTarget', 'onErrorOccurred', 'onHistoryStateUpdated', 'onReferenceFragmentUpdated', 'onTabReplaced'], webRequest: ['onBeforeRequest', 'onBeforeSendHeaders', 'onSendHeaders', 'onHeadersReceived', 'onAuthRequired', 'onResponseStarted', 'onBeforeRedirect', 'onCompleted', 'onErrorOccurred'], cookies: ['onChanged'], downloads: ['onCreated', 'onChanged', 'onErased', 'onDeterminingFilename'], management: ['onInstalled', 'onUninstalled', 'onEnabled', 'onDisabled'] };
  for (const [ns, names] of Object.entries(events)) { const o = c[ns]; if (!o) continue; for (const n of names) { if (!o[n]) { try { o[n] = evt(); } catch { try { Object.defineProperty(o, n, { value: evt(), configurable: true }); } catch {} } } } }
}

// Preload scripts run in their own context, so the patch is handed to the page's / worker's main world, where `chrome` lives.
// In a service worker `chrome` may only appear after the preload ran, so it is patched the moment it is assigned.
try {
  const body = `try {
    const patch = ${novaPatchChrome.toString()};
    const g = typeof window !== 'undefined' ? window : self;
    if (g.chrome) patch(g.chrome);
    else { let held; Object.defineProperty(g, 'chrome', { configurable: true, get() { return held; }, set(v) { held = v; try { patch(v); } catch (e) { console.error('[nova shim]', e && e.message); } } }); }
  } catch (e) { console.error('[nova shim]', e && e.message); }`;
  require('electron').contextBridge.executeInMainWorld({ func: new Function(body) });
} catch (e) { try { console.log('[nova shim] could not reach the main world: ' + e.message); } catch {} }
