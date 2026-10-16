// Electron implements only part of the chrome.* extension APIs. This file fills the gaps for extension service workers, extension popups and
// extension pages opened in tabs. Small things (permissions, alarms, badge calls) get honest stand-ins here; everything that needs the
// browser itself (opening tabs and windows, frames, notifications, context menus, downloads, sign-in pop-ups, messages from a website to
// the extension) is answered by extbridge.js in the main process, reached through one IPC channel.
// It runs as a service-worker preload (registered in main.js), as the preload of popup windows and as the preload of tabs that show an
// extension page.
function novaPatchChrome(c, bridge) {
  if (!c || c.__novaShim) return;
  try { Object.defineProperty(c, '__novaShim', { value: true }); } catch { return; }
  const noop = () => {};
  const evt = () => { const l = new Set(); return { addListener: (f) => l.add(f), removeListener: (f) => l.delete(f), hasListener: (f) => l.has(f), hasListeners: () => l.size > 0, _list: l, _fire: (...a) => l.forEach((f) => { try { f(...a); } catch (e) { console.error(e); } }) }; };
  const done = (args, v) => { const f = args[args.length - 1]; if (typeof f === 'function') { try { f(v); } catch {} return undefined; } return Promise.resolve(v); };
  const manifest = (() => { try { return c.runtime.getManifest() || {}; } catch { return {}; } })();
  const def = (name, obj) => { if (!c[name]) { try { c[name] = obj; } catch { try { Object.defineProperty(c, name, { value: obj, configurable: true }); } catch {} } } };
  // set a property even where Electron left a read-only native one
  const put = (o, name, v) => { try { o[name] = v; if (o[name] === v) return true; } catch {} try { Object.defineProperty(o, name, { value: v, configurable: true, writable: true, enumerable: true }); return o[name] === v; } catch { return false; } };
  const ns = (name) => { if (!c[name]) def(name, {}); return c[name]; };

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
  const act = {}; for (const n of ['setIcon', 'setBadgeText', 'setBadgeBackgroundColor', 'setBadgeTextColor', 'setTitle', 'setPopup', 'enable', 'disable']) act[n] = (...a) => done(a, undefined);
  for (const n of ['getBadgeText', 'getTitle', 'getPopup']) act[n] = (...a) => done(a, '');
  act.onClicked = evt(); act.openPopup = (...a) => done(a, undefined);
  def('action', act);
  if (!c.browserAction) def('browserAction', act);
  for (const n of Object.keys(act)) if (c.action && typeof c.action[n] !== 'function' && n !== 'onClicked') put(c.action, n, act[n]);

  // offscreen documents only serve clipboard clearing and similar extras here
  def('offscreen', { createDocument: (...a) => done(a, undefined), closeDocument: (...a) => done(a, undefined), hasDocument: (...a) => done(a, false), Reason: new Proxy({}, { get: (_t, k) => String(k) }) });
  def('commands', { getAll: (...a) => done(a, Object.entries(manifest.commands || {}).map(([name, v]) => ({ name, description: v.description || '', shortcut: (v.suggested_key && (v.suggested_key.windows || v.suggested_key.default)) || '' }))), onCommand: evt() });
  def('idle', { queryState: (...a) => done(a, 'active'), setDetectionInterval: noop, onStateChanged: evt() });
  def('sidePanel', { setOptions: (...a) => done(a, undefined), setPanelBehavior: (...a) => done(a, undefined), open: (...a) => done(a, undefined) });

  // any other namespace Electron leaves out becomes an inert stand-in: methods answer "nothing", events never fire
  const inert = () => { const t = {}; return new Proxy(t, { has: () => true, get: (_o, k) => { if (typeof k === 'symbol') return undefined; if (!(k in t)) t[k] = /^on[A-Z]/.test(k) ? evt() : (...a) => done(a, undefined); return t[k]; } }); };
  for (const n of ['accessibilityFeatures', 'bookmarks', 'browsingData', 'contentSettings', 'cookies', 'declarativeContent', 'declarativeNetRequest', 'dns', 'history', 'omnibox', 'pageCapture', 'power', 'privacy', 'proxy', 'readingList', 'search', 'sessions', 'system', 'tabGroups', 'topSites', 'tts', 'userScripts', 'webRequest']) def(n, inert());
  const konst = (o, vals) => { if (!o) return; for (const [k, v] of Object.entries(vals)) if (o[k] === undefined) put(o, k, v); };

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
  if (!c.extension) def('extension', {});
  if (c.extension) {
    const ext = c.extension;
    for (const [n, v] of Object.entries({ isAllowedFileSchemeAccess: true, isAllowedIncognitoAccess: false })) if (typeof ext[n] !== 'function') { try { ext[n] = (...a) => done(a, v); } catch (e) { /* read-only */ } }
    if (typeof ext.getViews !== 'function') { try { ext.getViews = () => []; } catch (e) { /* read-only */ } }
  }

  // ---------- everything that needs the browser: answered by extbridge.js ----------
  const events = {}; // 'tabs.onUpdated' -> the event object extensions subscribe to
  const sink = (space, name) => { const e = evt(); put(ns(space), name, e); events[space + '.' + name] = e; return e; };
  if (bridge) {
    const clean = (e) => new Error(String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    const call = (op, ...args) => bridge.call(op, args).catch((e) => { throw clean(e); });
    const setErr = (e) => { try { Object.defineProperty(c.runtime, 'lastError', { value: { message: e.message }, configurable: true, writable: true }); } catch {} };
    const clearErr = () => { try { Object.defineProperty(c.runtime, 'lastError', { value: undefined, configurable: true, writable: true }); } catch {} };
    // chrome style: with a callback it answers there (and sets lastError on failure), without one it returns a promise
    const fn = (impl) => function (...a) {
      const cb = typeof a[a.length - 1] === 'function' ? a.pop() : null;
      const p = Promise.resolve().then(() => impl(...a));
      if (!cb) return p;
      p.then((v) => { try { cb(v); } catch (e) { console.error(e); } }, (e) => { setErr(e); try { cb(); } catch (x) { console.error(x); } finally { clearErr(); } });
      return undefined;
    };
    const wire = (space, names, prefix = space) => { const o = ns(space); for (const n of names) put(o, n, fn((...a) => call(prefix + '.' + n, ...a))); };

    wire('tabs', ['create', 'update', 'remove', 'get', 'getCurrent', 'query', 'reload', 'duplicate', 'move', 'goBack', 'goForward', 'discard', 'captureVisibleTab', 'highlight', 'group', 'ungroup']);
    wire('windows', ['get', 'getCurrent', 'getLastFocused', 'getAll', 'create', 'update', 'remove']);
    konst(c.windows, { WINDOW_ID_NONE: -1, WINDOW_ID_CURRENT: -2 }); konst(c.tabs, { TAB_ID_NONE: -1 });
    wire('webNavigation', ['getFrame', 'getAllFrames']);
    wire('notifications', ['create', 'update', 'clear', 'getAll', 'getPermissionLevel']);
    wire('management', ['getSelf', 'getAll', 'get', 'uninstallSelf']);
    for (const n of ['setEnabled', 'getPermissionWarningsById', 'getPermissionWarningsByManifest', 'launchApp', 'createAppShortcut', 'setLaunchType', 'generateAppForLink']) put(ns('management'), n, (...a) => done(a, undefined));
    put(ns('runtime'), 'openOptionsPage', fn(() => call('runtime.openOptionsPage')));
    put(ns('runtime'), 'reload', () => { call('runtime.reload').catch(noop); });
    if (c.action) put(c.action, 'openPopup', fn(() => call('action.openPopup')));
    if (c.browserAction && c.browserAction !== c.action) put(c.browserAction, 'openPopup', fn(() => call('action.openPopup')));
    // downloads
    const dl = ns('downloads'); put(dl, 'download', fn((o) => call('downloads.download', o)));
    for (const n of ['search', 'pause', 'resume', 'cancel', 'erase', 'removeFile', 'show', 'showDefaultFolder', 'open', 'setShelfEnabled', 'acceptDanger']) put(dl, n, (...a) => done(a, n === 'search' ? [] : undefined));
    // identity
    const idn = ns('identity');
    put(idn, 'getRedirectURL', (p = '') => `https://${c.runtime.id}.chromiumapp.org/${String(p).replace(/^\/+/, '')}`);
    put(idn, 'launchWebAuthFlow', fn((d) => call('identity.launchWebAuthFlow', d)));
    put(idn, 'getAuthToken', fn(() => { throw new Error('Sign-in with a Google account is not available in Nova. Use launchWebAuthFlow.'); }));
    for (const n of ['removeCachedAuthToken', 'clearAllCachedAuthTokens']) put(idn, n, (...a) => done(a, undefined));
    put(idn, 'getProfileUserInfo', (...a) => done(a, { email: '', id: '' }));
    // context menus (chrome.menus is the same API under its newer name)
    const cm = ns('contextMenus'); let menuSeq = 0;
    put(cm, 'create', (p = {}, cb) => { const q = { ...p, id: p.id != null ? p.id : 'nova-menu-' + (++menuSeq) }; call('contextMenus.create', q).then(() => { if (typeof cb === 'function') cb(); }, (e) => { setErr(e); try { if (typeof cb === 'function') cb(); } finally { clearErr(); } }); return q.id; });
    for (const n of ['update', 'remove', 'removeAll']) put(cm, n, fn((...a) => call('contextMenus.' + n, ...a)));
    konst(cm, { ACTION_MENU_TOP_LEVEL_LIMIT: 6, ContextType: new Proxy({}, { get: (_t, k) => String(k).toLowerCase() }), ItemType: { NORMAL: 'normal', CHECKBOX: 'checkbox', RADIO: 'radio', SEPARATOR: 'separator' } });
    // events the browser delivers
    for (const n of ['onCreated', 'onUpdated', 'onActivated', 'onRemoved']) sink('tabs', n);
    for (const n of ['onMoved', 'onAttached', 'onDetached', 'onHighlighted', 'onReplaced']) if (!c.tabs[n]) sink('tabs', n);
    for (const n of ['onCreated', 'onRemoved', 'onFocusChanged', 'onBoundsChanged']) sink('windows', n);
    for (const n of ['onBeforeNavigate', 'onCommitted', 'onCompleted', 'onDOMContentLoaded', 'onCreatedNavigationTarget', 'onErrorOccurred', 'onHistoryStateUpdated', 'onReferenceFragmentUpdated', 'onTabReplaced']) sink('webNavigation', n);
    for (const n of ['onClicked', 'onClosed', 'onButtonClicked', 'onPermissionLevelChanged', 'onShowSettings']) sink('notifications', n);
    sink('contextMenus', 'onClicked'); put(c, 'menus', cm);
    for (const n of ['onCreated', 'onChanged', 'onErased', 'onDeterminingFilename']) sink('downloads', n);
    for (const n of ['onInstalled', 'onUninstalled', 'onEnabled', 'onDisabled']) sink('management', n);
    const external = sink('runtime', 'onMessageExternal'); sink('runtime', 'onConnectExternal'); sink('runtime', 'onInstalled'); sink('runtime', 'onStartup');
    // a website's message to this extension: queue it until the extension has registered its listener, then answer through sendResponse
    const onExternal = (d) => {
      let tries = 0;
      const deliver = () => {
        const ls = [...external._list];
        if (!ls.length && tries++ < 40) return setTimeout(deliver, 100);
        let responded = false, keep = false;
        const respond = (v) => { if (responded) return; responded = true; call('ext.reply', { id: d.replyId, value: v }).catch(noop); };
        for (const f of ls) {
          try { const r = f(d.message, d.sender, respond); if (r === true) keep = true; else if (r && typeof r.then === 'function') { keep = true; r.then(respond, () => respond(undefined)); } } catch (e) { console.error(e); }
        }
        if (!keep) respond(undefined);
      };
      deliver();
    };
    bridge.onEvent((name, args) => {
      try {
        if (name === 'runtime.onMessageExternal') return onExternal(args[0]);
        const e = events[name]; if (!e) return;
        // events that wake a sleeping worker can arrive before the extension has registered its listener: wait for it a moment
        const late = /^(runtime\.on(Installed|Startup)|contextMenus\.onClicked|notifications\.on(Clicked|Closed|ButtonClicked))$/.test(name);
        const fire = (n) => { if (e._list.size || !late || n > 30) e._fire(...args); else setTimeout(() => fire(n + 1), 100); };
        fire(0);
      } catch (x) { console.error('[nova shim]', x && x.message); }
    });
  } else {
    // no bridge (it could not be reached): opening things is skipped instead of crashing the extension
    const fakeTab = (p) => ({ id: -1, index: 0, windowId: 1, active: true, pinned: false, highlighted: true, incognito: false, url: (p && p.url) || '', title: '' });
    const T = ns('tabs');
    for (const [n, f] of Object.entries({ create: (p) => fakeTab(p), update: (_id, p) => fakeTab(typeof _id === 'object' ? _id : p), remove: () => undefined, duplicate: () => fakeTab(), getCurrent: () => undefined, move: () => [], group: () => 0, ungroup: () => undefined, discard: () => undefined, captureVisibleTab: () => '' })) put(T, n, (...a) => { const cb = a[a.length - 1]; const v = f(...a.filter((x) => typeof x !== 'function')); if (typeof cb === 'function') { try { cb(v); } catch (e) { /* ignore */ } return undefined; } return Promise.resolve(v); });
    const win = { id: 1, focused: true, type: 'normal', state: 'normal', incognito: false, alwaysOnTop: false };
    def('windows', { get: (...a) => done(a, win), getCurrent: (...a) => done(a, win), getLastFocused: (...a) => done(a, win), getAll: (...a) => done(a, [win]), create: (...a) => done(a, win), update: (...a) => done(a, win), remove: (...a) => done(a, undefined), onCreated: evt(), onRemoved: evt(), onFocusChanged: evt(), onBoundsChanged: evt() });
    for (const n of ['webNavigation', 'notifications', 'contextMenus', 'downloads', 'identity', 'management']) def(n, inert());
  }
  // namespaces that exist but lack events extensions subscribe to at start-up
  const missing = { runtime: ['onInstalled', 'onStartup', 'onSuspend', 'onSuspendCanceled', 'onConnect', 'onMessage', 'onUpdateAvailable', 'onRestartRequired', 'onBrowserUpdateAvailable'], storage: ['onChanged'], cookies: ['onChanged'], webRequest: ['onBeforeRequest', 'onBeforeSendHeaders', 'onSendHeaders', 'onHeadersReceived', 'onAuthRequired', 'onResponseStarted', 'onBeforeRedirect', 'onCompleted', 'onErrorOccurred'], tabs: ['onZoomChange'] };
  for (const [space, names] of Object.entries(missing)) { const o = c[space]; if (!o) continue; for (const n of names) if (!o[n]) put(o, n, evt()); }
}

// Preload scripts run in their own context, so the patch is handed to the page's / worker's main world, where `chrome` lives.
// In a service worker `chrome` may only appear after the preload ran, so it is patched the moment it is assigned.
try {
  const { contextBridge, ipcRenderer } = require('electron');
  const body = `try {
    const patch = ${novaPatchChrome.toString()};
    const g = typeof window !== 'undefined' ? window : self;
    if (g.chrome) patch(g.chrome, bridge);
    else { let held; Object.defineProperty(g, 'chrome', { configurable: true, get() { return held; }, set(v) { held = v; try { patch(v, bridge); } catch (e) { console.error('[nova shim]', e && e.message); } } }); }
  } catch (e) { console.error('[nova shim]', e && e.message); }`;
  const listeners = new Set();
  ipcRenderer.on('nova:ext-event', (_e, name, args) => listeners.forEach((f) => { try { f(name, args); } catch (e) { /* the page went away */ } }));
  const bridge = { call: (op, args) => ipcRenderer.invoke('nova:ext', op, args), onEvent: (f) => { listeners.add(f); } };
  contextBridge.executeInMainWorld({ func: new Function('bridge', body), args: [bridge] });
} catch (e) { try { console.log('[nova shim] could not reach the main world: ' + e.message); } catch {} }
