// Nova's extension bridge: the browser side of the chrome.* APIs that Electron leaves out (tabs.create and friends, windows, webNavigation,
// notifications, context menus, downloads, identity, management) and the messages a website may send to an extension it names
// (externally_connectable, which is how Proton's sign-in page hands your session to Proton Pass).
// ext-shim.js runs inside every extension worker and extension page and calls into here through one IPC channel, 'nova:ext'.
const { ipcMain, BrowserWindow, Notification, webContents, nativeImage, webFrameMain } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const extmgr = require('./extmgr');

let C; // context from main.js: ses, sessions, tabs, state, settings, win, openUrl, activate, wake, closeTab, sleepTab, push, toast, normalize, userDir
const DEBUG = !!process.env.NOVA_DEBUG_SW;
const dbg = (...a) => { if (!DEBUG) return; try { fs.appendFileSync(path.join(C.userDir(), 'extbridge.log'), new Date().toISOString().slice(11, 23) + ' ' + a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ') + String.fromCharCode(10)); } catch { /* no log */ } };
const frameExtId = (u) => { const m = /^chrome-extension:\/\/([a-p]{32})/.exec(String(u || '')); return m ? m[1] : ''; };
const extById = (id) => { try { return (id && C.ses.extensions.getExtension(id)) || null; } catch { return null; } };
const allExts = () => { try { return C.ses.extensions.getAllExtensions(); } catch { return []; } };
let anyExt = false; // events cost nothing while no extension is installed
const refreshAny = () => { anyExt = allExts().length > 0; return anyExt; };

// ---------- URL patterns ("https://*.example.com/*", "<all_urls>") ----------
const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
const patCache = new Map();
function pattern(p) {
  if (patCache.has(p)) return patCache.get(p);
  let re = null;
  if (p === '<all_urls>') re = /^(https?|file|ftp|chrome-extension):\/\//i;
  else {
    const m = /^(\*|https?|file|ftp|wss?):\/\/([^/]*)(\/.*)?$/.exec(p);
    if (m) {
      const sch = m[1] === '*' ? 'https?' : esc(m[1]);
      const host = m[2] === '*' ? '[^/]*' : m[2].startsWith('*.') ? '(?:[^/:]+\\.)?' + esc(m[2].slice(2)) : esc(m[2]);
      const pth = (m[3] || '/*').split('*').map(esc).join('.*');
      try { re = new RegExp(`^${sch}://${host}(?::\\d+)?${pth}$`, 'i'); } catch { re = null; }
    }
  }
  patCache.set(p, re); return re;
}
const matchesAny = (list, url) => (list || []).some((p) => { const r = pattern(p); return r && r.test(url); });

// ---------- tabs as extensions see them ----------
const synth = (t) => 100000 + t.id; // a tab without a page (asleep) still has an ID
const wcOf = (t) => (t && t.view && !t.view.webContents.isDestroyed() ? t.view.webContents : null);
const extTabId = (t) => { const wc = wcOf(t); return wc ? wc.id : synth(t); };
const byExtId = (id) => { id = +id; for (const t of C.tabs.values()) if (extTabId(t) === id) return t; return null; };
const tabOfWc = (wc) => { if (!wc) return null; for (const t of C.tabs.values()) { const w = wcOf(t); if (w && w.id === wc.id) return t; } return null; };
const HOME_URL = 'chrome://newtab/';

function canSee(ext, url, t) {
  if (!ext) return false;
  const m = ext.manifest || {}, perms = m.permissions || [];
  if (String(url).startsWith('chrome-extension://' + ext.id)) return true;
  if (perms.includes('tabs')) return true;
  if (perms.includes('activeTab') && t && C.state().activeTab === t.id) return true;
  return matchesAny([...(m.host_permissions || []), ...perms.filter((x) => /:\/\/|<all_urls>/.test(x))], url);
}
function tabInfo(ext, t) {
  const wc = wcOf(t), raw = (wc && wc.getURL()) || t.url, home = /^nova:\/\/home|ui[\\/]home\.html/.test(raw || '');
  const url = home ? HOME_URL : raw, vis = canSee(ext, url, t);
  const list = [...C.tabs.values()].filter((x) => !x.private), active = C.state().activeTab === t.id;
  const o = { id: extTabId(t), index: Math.max(0, list.indexOf(t)), windowId: 1, groupId: -1, active, highlighted: active, selected: active, pinned: !!t.pinned, incognito: !!t.private, discarded: !wc, autoDiscardable: true, audible: !!t.audible, mutedInfo: { muted: !!t.muted }, status: t.loading ? 'loading' : 'complete', width: 0, height: 0 };
  if (vis) { o.url = url; o.title = home ? 'New tab' : t.title || ''; if (t.favicon) o.favIconUrl = t.favicon; }
  if (wc) { const b = t.view.getBounds(); o.width = b.width; o.height = b.height; }
  return o;
}
const visibleTabs = () => [...C.tabs.values()].filter((t) => !t.private);
function query(ext, q = {}) {
  const act = C.state().activeTab;
  const urlPats = [].concat(q.url || []);
  const glob = (g, s) => new RegExp('^' + String(g).split('*').map(esc).join('.*') + '$', 'i').test(s || '');
  return visibleTabs().filter((t) => {
    const wc = wcOf(t), url = wc ? wc.getURL() : t.url, see = canSee(ext, url, t);
    if (q.active != null && (t.id === act) !== !!q.active) return false;
    if (q.highlighted != null && (t.id === act) !== !!q.highlighted) return false;
    if (q.pinned != null && !!t.pinned !== !!q.pinned) return false;
    if (q.audible != null && !!t.audible !== !!q.audible) return false;
    if (q.muted != null && !!t.muted !== !!q.muted) return false;
    if (q.discarded != null && !wc !== !!q.discarded) return false;
    if (q.status && (t.loading ? 'loading' : 'complete') !== q.status) return false;
    if (urlPats.length && !(see && matchesAny(urlPats, url))) return false;
    if (q.title && !(see && glob(q.title, t.title))) return false;
    return true;
  }).map((t) => tabInfo(ext, t));
}
function fixUrl(cx, u) {
  u = String(u || '').trim();
  if (!u) return 'nova://home';
  if (/^javascript:/i.test(u)) throw new Error('javascript: URLs cannot be opened this way.');
  if (/^(chrome:\/\/newtab\/?|about:newtab|about:blank)$/i.test(u)) return 'nova://home';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) return new URL(u.replace(/^\/+/, ''), `chrome-extension://${cx.extId}/`).href;
  return u;
}

// ---------- delivering events to extensions ----------
const startWorker = (extId) => C.ses.serviceWorkers.startWorkerForScope(`chrome-extension://${extId}/`);
function emit(extId, name, args, wakeWorker) {
  if (!extId && !anyExt) return;
  const reached = new Set();
  try {
    for (const [versionId, info] of Object.entries(C.ses.serviceWorkers.getAllRunning())) { // the key is the version ID
      const id = frameExtId(info.scope); if (!id || (extId && id !== extId)) continue;
      const w = C.ses.serviceWorkers.getWorkerFromVersionID(Number(versionId));
      if (w) { w.send('nova:ext-event', name, args); reached.add(id); }
    }
  } catch (e) { dbg('emit workers', name, JSON.stringify(args).slice(0, 200), e.message); }
  try {
    for (const wc of webContents.getAllWebContents()) {
      if (wc.isDestroyed() || wc.session !== C.ses) continue;
      const u = wc.getURL(); if (!u.startsWith('chrome-extension://')) continue;
      const id = frameExtId(u); if (extId && id !== extId) continue;
      wc.send('nova:ext-event', name, args);
    }
  } catch (e) { dbg('emit pages', e.message); }
  if (wakeWorker && extId && !reached.has(extId)) startWorker(extId).then((w) => w && w.send('nova:ext-event', name, args)).catch((e) => dbg('wake worker', e.message));
}
function emitTab(name, make) { if (!anyExt) return; for (const ext of allExts()) { const a = make(ext); if (a) emit(ext.id, name, a); } }

// ---------- operations: bridge.call(op, [args]) from ext-shim.js ----------
const ops = {};
const reply = new Map(); // external message id -> resolve
let seq = 0;

// tabs
ops['tabs.create'] = async (cx, p = {}) => {
  const t = C.openUrl(fixUrl(cx, p.url), { forceNew: true, background: p.active === false });
  if (p.pinned) t.pinned = true;
  if (!wcOf(t)) C.wake(t);
  C.push();
  return tabInfo(cx.ext, t);
};
const target = (cx, id) => { const t = id == null ? cx.tab || C.activeTab() : byExtId(id); if (!t) throw new Error('No tab with id: ' + id + '.'); return t; };
ops['tabs.get'] = async (cx, id) => tabInfo(cx.ext, target(cx, id));
ops['tabs.getCurrent'] = async (cx) => (cx.tab ? tabInfo(cx.ext, cx.tab) : undefined);
ops['tabs.query'] = async (cx, q) => query(cx.ext, q);
ops['tabs.update'] = async (cx, a, b) => {
  const id = a && typeof a === 'object' ? null : a, p = (a && typeof a === 'object' ? a : b) || {}, t = target(cx, id);
  if (p.url) { const u = C.normalize(fixUrl(cx, p.url)), wc = wcOf(t); if (wc) wc.loadURL(u).catch(() => {}); else { t.url = u; C.wake(t); } }
  if (p.active || p.highlighted) C.activate(t.id);
  if (p.pinned != null) t.pinned = !!p.pinned;
  if (p.muted != null) { const wc = wcOf(t); if (wc) { wc.setAudioMuted(!!p.muted); t.muted = !!p.muted; } }
  C.push();
  return tabInfo(cx.ext, t);
};
ops['tabs.remove'] = async (cx, ids) => { for (const id of [].concat(ids)) { const t = byExtId(id); if (t) C.closeTab(t.id); } };
ops['tabs.reload'] = async (cx, a, b) => { const id = typeof a === 'number' ? a : null, p = (typeof a === 'object' ? a : b) || {}, wc = wcOf(target(cx, id)); if (wc) { if (p.bypassCache) wc.reloadIgnoringCache(); else wc.reload(); } };
ops['tabs.duplicate'] = async (cx, id) => { const t = target(cx, id), n = C.openUrl(t.url, { forceNew: true, background: true }); C.wake(n); C.push(); return tabInfo(cx.ext, n); };
ops['tabs.move'] = async (cx, ids) => [].concat(ids).map((id) => byExtId(id)).filter(Boolean).map((t) => tabInfo(cx.ext, t));
ops['tabs.goBack'] = async (cx, id) => { const wc = wcOf(target(cx, id)); if (wc && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); };
ops['tabs.goForward'] = async (cx, id) => { const wc = wcOf(target(cx, id)); if (wc && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); };
ops['tabs.discard'] = async (cx, id) => { const t = id == null ? null : byExtId(id); if (t && t.id !== C.state().activeTab) { C.sleepTab(t); C.push(); } return t ? tabInfo(cx.ext, t) : undefined; };
ops['tabs.highlight'] = async (cx, info) => { const i = [].concat((info && info.tabs) != null ? info.tabs : 0)[0]; const t = visibleTabs()[i]; if (t) C.activate(t.id); return winInfo(false, cx); };
ops['tabs.group'] = async () => 1;
ops['tabs.ungroup'] = async () => undefined;
ops['tabs.captureVisibleTab'] = async (cx, a, b) => {
  const o = (typeof a === 'object' && a ? a : b) || {}, t = C.activeTab(), wc = wcOf(t);
  if (!wc) throw new Error('No visible tab to capture.');
  const img = await (C.native ? C.native(wc, wc.capturePage()) : wc.capturePage());
  return o.format === 'png' ? 'data:image/png;base64,' + img.toPNG().toString('base64') : 'data:image/jpeg;base64,' + img.toJPEG(o.quality || 90).toString('base64');
};

// windows: Nova has one window; pop-up windows an extension asks for are real small windows
const extWins = new Map();
function winInfo(populate, cx) {
  const w = C.win(), b = w.getBounds();
  return { id: 1, focused: w.isFocused(), top: b.y, left: b.x, width: b.width, height: b.height, incognito: false, type: 'normal', state: w.isMinimized() ? 'minimized' : w.isFullScreen() ? 'fullscreen' : w.isMaximized() ? 'maximized' : 'normal', alwaysOnTop: false, ...(populate ? { tabs: query(cx.ext, {}) } : {}) };
}
const popInfo = (bw, id) => { const b = bw.getBounds(); return { id, focused: bw.isFocused(), top: b.y, left: b.x, width: b.width, height: b.height, incognito: false, type: 'popup', state: 'normal', alwaysOnTop: false, tabs: [] }; };
const getWin = (cx, a, b) => { const id = typeof a === 'number' ? a : null, o = (typeof a === 'object' ? a : b) || {}; if (id != null && extWins.has(id)) return popInfo(extWins.get(id), id); return winInfo(!!o.populate, cx); };
ops['windows.get'] = async (cx, a, b) => getWin(cx, a, b);
ops['windows.getCurrent'] = async (cx, a) => winInfo(!!(a && a.populate), cx);
ops['windows.getLastFocused'] = async (cx, a) => winInfo(!!(a && a.populate), cx);
ops['windows.getAll'] = async (cx, a) => [winInfo(!!(a && a.populate), cx), ...[...extWins].map(([id, bw]) => popInfo(bw, id))];
ops['windows.create'] = async (cx, p = {}) => {
  const urls = [].concat(p.url == null ? [] : p.url).map((u) => fixUrl(cx, u));
  if (p.type === 'popup' && urls.length) {
    const ext = urls[0].startsWith('chrome-extension://');
    const bw = new BrowserWindow({ width: p.width || 480, height: p.height || 640, x: p.left, y: p.top, autoHideMenuBar: true, show: p.focused !== false, backgroundColor: '#ffffff', icon: path.join(__dirname, 'build', 'icon.ico'), webPreferences: { session: C.ses, sandbox: true, ...(ext ? { preload: extmgr.shimPath() } : {}) } });
    const id = 1000 + bw.id; extWins.set(id, bw);
    bw.on('closed', () => { extWins.delete(id); emit(null, 'windows.onRemoved', [id]); });
    bw.webContents.setWindowOpenHandler(({ url }) => { C.openUrl(url, { forceNew: true }); return { action: 'deny' }; });
    bw.loadURL(urls[0]).catch(() => {});
    return popInfo(bw, id);
  }
  const made = (urls.length ? urls : ['nova://home']).map((u, i) => { const t = C.openUrl(u, { forceNew: true, background: i > 0 }); if (!wcOf(t)) C.wake(t); return t; });
  C.push();
  return { ...winInfo(false, cx), tabs: made.map((t) => tabInfo(cx.ext, t)) };
};
ops['windows.update'] = async (cx, a, b) => {
  const id = typeof a === 'number' ? a : 1, p = (typeof a === 'object' ? a : b) || {}, bw = extWins.get(id) || C.win();
  if (p.state === 'maximized') bw.maximize(); else if (p.state === 'minimized') bw.minimize(); else if (p.state === 'fullscreen') bw.setFullScreen(true); else if (p.state === 'normal') { bw.setFullScreen(false); bw.restore(); }
  if (p.focused) { if (bw.isMinimized()) bw.restore(); bw.focus(); }
  return id === 1 ? winInfo(false, cx) : popInfo(bw, id);
};
ops['windows.remove'] = async (cx, id) => { const bw = extWins.get(id); if (bw && !bw.isDestroyed()) bw.close(); };

// extension pages
ops['runtime.openOptionsPage'] = async (cx) => {
  const m = cx.ext.manifest || {}, page = (m.options_ui && m.options_ui.page) || m.options_page;
  if (!page) throw new Error('Could not create an options page.');
  const url = `chrome-extension://${cx.extId}/${String(page).replace(/^\/+/, '')}`;
  const open = visibleTabs().find((t) => (t.url || '').startsWith(url));
  if (open) { C.activate(open.id); return; }
  const t = C.openUrl(url, { forceNew: true }); if (!wcOf(t)) C.wake(t); C.push();
};
ops['runtime.reload'] = async (cx) => {
  const p = cx.ext.path;
  setTimeout(async () => { try { await C.ses.extensions.removeExtension(cx.extId); await C.ses.extensions.loadExtension(p, { allowFileAccess: true }); } catch (e) { dbg('reload', e.message); } }, 50);
};
ops['action.openPopup'] = async (cx) => { extmgr.openPopup(cx.extId); };

// webNavigation
const frameId = (f, main) => (f === main ? 0 : f.frameTreeNodeId);
function frameInfo(f, main) {
  return { frameId: frameId(f, main), parentFrameId: f.parent ? frameId(f.parent, main) : -1, url: f.url, documentId: `${f.processId}-${f.routingId}`, documentLifecycle: 'active', errorOccurred: false, frameType: f === main ? 'outermost_frame' : 'sub_frame', processId: f.processId };
}
ops['webNavigation.getAllFrames'] = async (cx, d = {}) => { const wc = wcOf(byExtId(d.tabId)); if (!wc) return null; const main = wc.mainFrame; return [...main.framesInSubtree].map((f) => frameInfo(f, main)); };
ops['webNavigation.getFrame'] = async (cx, d = {}) => {
  const wc = wcOf(byExtId(d.tabId)); if (!wc) return null; const main = wc.mainFrame;
  const f = [...main.framesInSubtree].find((x) => (d.documentId ? `${x.processId}-${x.routingId}` === d.documentId : frameId(x, main) === d.frameId));
  return f ? frameInfo(f, main) : null;
};

// notifications
const notes = new Map();
function loadIcon(ext, u) {
  try {
    if (!u) return undefined;
    if (/^data:/i.test(u)) return nativeImage.createFromDataURL(u);
    const rel = u.startsWith('chrome-extension://') ? u.replace(/^chrome-extension:\/\/[a-p]{32}\//, '') : /^[a-z]+:/i.test(u) ? null : u;
    if (rel) { const f = path.join(ext.path, rel.replace(/^\/+/, '')); if (f.startsWith(ext.path) && fs.existsSync(f)) return nativeImage.createFromPath(f); }
  } catch { /* no icon */ }
  return undefined;
}
ops['notifications.create'] = async (cx, a, b) => {
  const named = typeof a === 'string', o = (named ? b : a) || {}, id = (named && a) || 'n' + crypto.randomUUID(), key = cx.extId + ':' + id;
  try { const old = notes.get(key); if (old) old.close(); } catch { /* gone */ }
  const opts = { title: String(o.title || cx.ext.name), body: String(o.message || ''), silent: o.silent === true }, icon = loadIcon(cx.ext, o.iconUrl); if (icon) opts.icon = icon;
  const n = new Notification(opts); notes.set(key, n);
  n.on('click', () => emit(cx.extId, 'notifications.onClicked', [id], true));
  n.on('close', () => { notes.delete(key); emit(cx.extId, 'notifications.onClosed', [id, true]); });
  n.show();
  return id;
};
ops['notifications.clear'] = async (cx, id) => { const n = notes.get(cx.extId + ':' + id); if (n) { try { n.close(); } catch { /* gone */ } return true; } return false; };
ops['notifications.getAll'] = async (cx) => Object.fromEntries([...notes.keys()].filter((k) => k.startsWith(cx.extId + ':')).map((k) => [k.slice(33), true]));
ops['notifications.update'] = async () => false;
ops['notifications.getPermissionLevel'] = async () => 'granted';

// context menus
const menus = new Map(); // extension id -> Map(item id -> properties)
const menuOf = (extId) => { if (!menus.has(extId)) menus.set(extId, new Map()); return menus.get(extId); };
// Chrome keeps an extension's menu entries between sessions (an MV3 worker creates them once, in onInstalled), so Nova does too
const menuFile = () => path.join(C.userDir(), 'ext-menus.json');
let menuTimer = null;
const saveMenus = () => { clearTimeout(menuTimer); menuTimer = setTimeout(() => { try { fs.writeFileSync(menuFile(), JSON.stringify(Object.fromEntries([...menus].filter(([, m]) => m.size).map(([k, m]) => [k, [...m.values()]])))); } catch { /* read-only profile */ } }, 800); };
const loadMenus = () => { try { for (const [id, items] of Object.entries(JSON.parse(fs.readFileSync(menuFile(), 'utf8')))) menus.set(id, new Map(items.map((i) => [i.id, i]))); } catch { /* none saved */ } };
ops['contextMenus.create'] = async (cx, p) => { menuOf(cx.extId).set(p.id, { ...p }); saveMenus(); };
ops['contextMenus.update'] = async (cx, id, p) => { const m = menuOf(cx.extId); if (m.has(id)) m.set(id, { ...m.get(id), ...p, id }); saveMenus(); };
ops['contextMenus.remove'] = async (cx, id) => { const m = menuOf(cx.extId); m.delete(id); for (const [k, v] of m) if (v.parentId === id) m.delete(k); saveMenus(); };
ops['contextMenus.removeAll'] = async (cx) => { menuOf(cx.extId).clear(); saveMenus(); };
function contextsOf(p) {
  const s = new Set(['all']);
  if (p.selectionText) s.add('selection'); if (p.linkURL) s.add('link'); if (p.isEditable) s.add('editable');
  if (p.mediaType === 'image') s.add('image'); if (p.mediaType === 'video') s.add('video'); if (p.mediaType === 'audio') s.add('audio');
  if (p.frameURL && p.frameURL !== p.pageURL) s.add('frame');
  if (!p.selectionText && !p.linkURL && !p.isEditable && !(p.mediaType && p.mediaType !== 'none')) s.add('page');
  return s;
}
function menuItems(wc, p) {
  if (!anyExt || !menus.size) return [];
  const out = [], ctx = contextsOf(p), pageUrl = wc.getURL();
  for (const [extId, items] of menus) {
    const ext = extById(extId); if (!ext || !items.size) continue;
    const ok = (i) => i.visible !== false && ((i.contexts ? [].concat(i.contexts) : ['page']).includes('all') || (i.contexts ? [].concat(i.contexts) : ['page']).some((c) => ctx.has(c)))
      && (!i.documentUrlPatterns || matchesAny(i.documentUrlPatterns, pageUrl)) && (!i.targetUrlPatterns || !(p.linkURL || p.srcURL) || matchesAny(i.targetUrlPatterns, p.linkURL || p.srcURL));
    const vis = [...items.values()].filter(ok), ids = new Set(vis.map((i) => i.id));
    const kids = (id) => vis.filter((k) => k.parentId === id);
    const build = (i) => {
      if (i.type === 'separator') return { type: 'separator' };
      const label = String(i.title || '').replace(/%s/g, (p.selectionText || '').slice(0, 24)), k = kids(i.id);
      const e = { label, enabled: i.enabled !== false };
      if (i.type === 'checkbox' || i.type === 'radio') { e.type = i.type; e.checked = !!i.checked; }
      if (k.length) e.submenu = k.map(build); else e.click = () => menuClick(ext, i, p, wc);
      return e;
    };
    const top = vis.filter((i) => !i.parentId || !ids.has(i.parentId)).map(build);
    if (!top.length) continue;
    out.push(top.length === 1 && !top[0].submenu ? top[0] : { label: ext.name, submenu: top });
  }
  return out.length ? [{ type: 'separator' }, ...out] : [];
}
function menuClick(ext, i, p, wc) {
  const was = !!i.checked;
  if (i.type === 'checkbox') i.checked = !was;
  else if (i.type === 'radio') { for (const o of menuOf(ext.id).values()) if (o.type === 'radio' && o.parentId === i.parentId) o.checked = o === i; }
  const info = { menuItemId: i.id, ...(i.parentId ? { parentMenuItemId: i.parentId } : {}), pageUrl: wc.getURL(), editable: !!p.isEditable, ...(p.selectionText ? { selectionText: p.selectionText } : {}), ...(p.linkURL ? { linkUrl: p.linkURL } : {}), ...(p.srcURL ? { srcUrl: p.srcURL } : {}), ...(p.mediaType && p.mediaType !== 'none' ? { mediaType: p.mediaType } : {}), ...(p.frameURL ? { frameUrl: p.frameURL } : {}), ...(i.type === 'checkbox' || i.type === 'radio' ? { checked: !!i.checked, wasChecked: was } : {}) };
  const t = tabOfWc(wc);
  emit(ext.id, 'contextMenus.onClicked', [info, t ? tabInfo(ext, t) : undefined], true);
}

// downloads
let dlSeq = 0;
ops['downloads.download'] = async (cx, o = {}) => {
  if (!/^(https?|data|blob):/i.test(String(o.url))) throw new Error('Invalid URL');
  C.ses.downloadURL(o.url); return ++dlSeq;
};

// identity: the OAuth pop-up some extensions use to sign in
ops['identity.launchWebAuthFlow'] = (cx, d = {}) => new Promise((resolve, reject) => {
  const base = `https://${cx.extId}.chromiumapp.org/`; let settled = false;
  const w = new BrowserWindow({ width: 520, height: 720, show: d.interactive !== false, autoHideMenuBar: true, backgroundColor: '#ffffff', webPreferences: { session: C.ses, sandbox: true } });
  const finish = (err, url) => { if (settled) return; settled = true; if (!w.isDestroyed()) w.close(); err ? reject(err) : resolve(url); };
  const watch = (e, url) => { if (String(url).startsWith(base)) { if (e && e.preventDefault) e.preventDefault(); finish(null, url); } };
  w.webContents.on('will-redirect', watch); w.webContents.on('will-navigate', watch); w.webContents.on('did-navigate', (_e, url) => watch(null, url));
  w.on('closed', () => finish(new Error('The user did not approve access.')));
  w.loadURL(d.url).catch((e) => { if (!settled && !/ERR_ABORTED/.test(e.message)) finish(new Error(e.message)); });
  if (d.interactive === false) setTimeout(() => finish(new Error('User interaction required.')), 8000);
});

// management
const selfInfo = (e) => { const m = e.manifest || {}; return { id: e.id, name: m.name || e.name, shortName: m.short_name || '', description: m.description || '', version: e.version, enabled: true, mayDisable: true, installType: 'normal', type: 'extension', isApp: false, optionsUrl: (m.options_ui && m.options_ui.page) || m.options_page ? `chrome-extension://${e.id}/${(m.options_ui && m.options_ui.page) || m.options_page}` : '', permissions: m.permissions || [], hostPermissions: m.host_permissions || [], homepageUrl: m.homepage_url || '' }; };
ops['management.getSelf'] = async (cx) => selfInfo(cx.ext);
ops['management.getAll'] = async () => allExts().map(selfInfo);
ops['management.get'] = async (cx, id) => { const e = extById(id); if (!e) throw new Error('Failed to find extension with id ' + id); return selfInfo(e); };
ops['management.uninstallSelf'] = async (cx) => { setTimeout(() => extmgr.remove(cx.extId), 50); };

// messages from websites to an extension (externally_connectable)
ops['ext.reply'] = async (cx, d = {}) => { const r = reply.get(d.id); if (r) { reply.delete(d.id); r(d.value); } };
const allowedBy = (ext, url) => { const ec = (ext.manifest || {}).externally_connectable; return !!(ec && ec.matches && matchesAny(ec.matches, url)); };
ipcMain.handle('nova:ext-external', async (e, d = {}) => {
  try {
    if (!C.sessions().includes(e.sender.session)) return { error: 'not a tab' };
    const url = String((e.senderFrame && e.senderFrame.url) || d.url || '');
    const ext = extById(d.extId) || allExts().find((x) => path.basename(x.path) === d.extId);
    if (!ext || !allowedBy(ext, url)) return { error: 'Could not establish connection. Receiving end does not exist.' };
    const id = ++seq, tab = tabOfWc(e.sender);
    const sender = { url, origin: new URL(url).origin, frameId: e.senderFrame && e.senderFrame.parent ? e.senderFrame.frameTreeNodeId : 0, ...(tab ? { tab: tabInfo(ext, tab) } : {}) };
    const p = new Promise((resolve) => { reply.set(id, (v) => resolve({ value: v })); setTimeout(() => { if (reply.delete(id)) resolve({ value: undefined }); }, 30000); });
    emit(ext.id, 'runtime.onMessageExternal', [{ message: d.message, sender, replyId: id }], true);
    return await p;
  } catch (err) { return { error: err.message }; }
});

// ---------- the page-side preload for websites an extension talks to ----------
// Written to the profile folder with the allowed addresses inside, so a page that is not on the list costs one regex test and nothing else.
let externalId = null, externalFile = '';
function refreshExternal() {
  try {
    const rules = allExts().map((e) => [e.id, ((e.manifest || {}).externally_connectable || {}).matches || []]).filter(([, m]) => m.length)
      .map(([id, m]) => [id, m.map((p) => { const r = pattern(p); return r ? r.source : null; }).filter(Boolean)]).filter(([, m]) => m.length);
    if (externalId != null) { try { C.ses.unregisterPreloadScript(externalId); } catch { /* already gone */ } externalId = null; }
    if (!rules.length) return;
    externalFile = path.join(C.userDir(), 'ext-external-preload.js');
    fs.writeFileSync(externalFile, `// generated by Nova: lets the websites an extension names (externally_connectable) message that extension\nconst { contextBridge, ipcRenderer } = require('electron');\ntry {\n  const RULES = ${JSON.stringify(rules)};\n  const u = location.href, ids = RULES.filter(([, m]) => m.some((s) => new RegExp(s, 'i').test(u))).map(([id]) => id);\n  if (ids.length) contextBridge.executeInMainWorld({ args: [{ send: (d) => ipcRenderer.invoke('nova:ext-external', d) }, ids], func: (bridge, ids) => {\n    const c = window.chrome || (window.chrome = {}), rt = c.runtime || (c.runtime = {});\n    const fail = (cb, msg) => { const e = new Error(msg); if (cb) { try { rt.lastError = { message: msg }; cb(); } finally { rt.lastError = undefined; } return undefined; } return Promise.reject(e); };\n    rt.sendMessage = function (...a) {\n      const cb = typeof a[a.length - 1] === 'function' ? a.pop() : null, id = a[0], message = a[1];\n      if (typeof id !== 'string' || !ids.includes(id)) return fail(cb, 'Could not establish connection. Receiving end does not exist.');\n      const p = bridge.send({ extId: id, message, url: location.href }).then((r) => { if (r && r.error) throw new Error(r.error); return r ? r.value : undefined; });\n      if (!cb) return p;\n      p.then((v) => cb(v), (e) => fail(cb, e.message)); return undefined;\n    };\n    rt.connect = function () { throw new Error('Nova does not support long-lived connections from a website to an extension yet.'); };\n  } });\n} catch (e) { /* no bridge in this frame */ }\n`);
    externalId = C.ses.registerPreloadScript({ type: 'frame', filePath: externalFile });
    dbg('external preload for', rules.map(([id]) => id).join(','));
  } catch (e) { console.error('ext external preload', e.message); }
}

// ---------- hooks main.js calls ----------
const watched = new WeakSet();
function watch(t) { // a tab just got its page
  const wc = wcOf(t); if (!wc || watched.has(wc)) return; watched.add(wc);
  const note = (change) => emitTab('tabs.onUpdated', (ext) => { const tb = tabInfo(ext, t), c = { ...change }; if (!canSee(ext, tb.url || '', t)) { delete c.url; delete c.title; delete c.favIconUrl; } return Object.keys(c).length ? [tb.id, c, tb] : null; });
  const frameOf = (pid, rid) => { try { return webFrameMain.fromId(pid, rid); } catch { return null; } };
  const nav = (name, extra) => (url, isMain, frame) => {
    if (!anyExt) return;
    try {
      const main = wc.mainFrame, fid = isMain ? 0 : (frame ? frame.frameTreeNodeId : 0), pfid = isMain ? -1 : (frame && frame.parent ? frameId(frame.parent, main) : 0);
      emitTab(name, (ext) => (canSee(ext, url || '', t) ? [{ tabId: wc.id, frameId: fid, parentFrameId: pfid, url, timeStamp: Date.now(), processId: frame ? frame.processId : -1, ...extra }] : null));
    } catch { /* frame is gone */ }
  };
  wc.on('did-start-loading', () => note({ status: 'loading' }));
  wc.on('did-stop-loading', () => note({ status: 'complete' }));
  wc.on('page-title-updated', (_e, title) => note({ title }));
  wc.on('page-favicon-updated', (_e, f) => note({ favIconUrl: f[0] || '' }));
  wc.on('audio-state-changed', (e) => note({ audible: !!e.audible }));
  wc.on('did-navigate', (_e, url) => note({ url }));
  wc.on('did-navigate-in-page', (_e, url, isMain) => { note({ url }); nav('webNavigation.onHistoryStateUpdated', { transitionType: 'link', transitionQualifiers: [] })(url, isMain, null); });
  wc.on('did-start-navigation', (e) => nav('webNavigation.onBeforeNavigate', {})(e.url, e.isMainFrame, e.frame));
  wc.on('did-frame-navigate', (_e, url, _code, _text, isMain, pid, rid) => nav('webNavigation.onCommitted', { transitionType: 'link', transitionQualifiers: [] })(url, isMain, frameOf(pid, rid)));
  wc.on('dom-ready', () => nav('webNavigation.onDOMContentLoaded', {})(wc.getURL(), true, null));
  wc.on('did-frame-finish-load', (_e, isMain, pid, rid) => nav('webNavigation.onCompleted', {})(wc.getURL(), isMain, frameOf(pid, rid)));
  emitTab('tabs.onCreated', (ext) => [tabInfo(ext, t)]);
}
function activated(t) { if (anyExt) emit(null, 'tabs.onActivated', [{ tabId: extTabId(t), windowId: 1 }]); }
function removed(t) { const wc = wcOf(t); if (wc && anyExt) emit(null, 'tabs.onRemoved', [wc.id, { windowId: 1, isWindowClosing: false }]); }

function init(ctx) {
  C = ctx;
  loadMenus();
  extmgr.hooks.installed = (id, reason, previousVersion) => { menus.delete(id); saveMenus(); refreshAny(); refreshExternal(); setTimeout(() => emit(id, 'runtime.onInstalled', [{ reason, ...(previousVersion ? { previousVersion } : {}) }], true), 1500); }; // Electron never says "installed" itself
  refreshAny();
  ipcMain.handle('nova:ext', async (e, op, args) => {
    const extId = frameExtId(e.senderFrame ? e.senderFrame.url : e.sender.getURL());
    return run({ extId, ext: extById(extId), kind: 'page', wc: e.sender, tab: tabOfWc(e.sender) }, op, args);
  });
  const hooked = new Set();
  const hook = (versionId) => {
    if (hooked.has(versionId)) return;
    let w; try { w = C.ses.serviceWorkers.getWorkerFromVersionID(versionId); } catch { return; }
    if (!w) return;
    hooked.add(versionId);
    const extId = frameExtId(w.scope);
    w.ipc.handle('nova:ext', (_e, op, args) => run({ extId, ext: extById(extId), kind: 'worker' }, op, args));
  };
  C.ses.serviceWorkers.on('running-status-changed', (d) => { try { if (d.runningStatus === 'starting' || d.runningStatus === 'running') hook(d.versionId); } catch (e) { dbg('hook', e.message); } });
  C.ses.serviceWorkers.on('registration-completed', () => { refreshAny(); });
  C.ses.on('extension-loaded', () => { refreshAny(); refreshExternal(); });
  C.ses.on('extension-unloaded', () => { refreshAny(); refreshExternal(); });
  setTimeout(() => { refreshAny(); refreshExternal(); }, 1500);
}
async function run(cx, op, args) {
  const f = ops[op];
  if (!f) throw new Error(`Nova does not support ${op} yet.`);
  if (!cx.ext) throw new Error('This extension is not loaded.');
  dbg(cx.kind, cx.extId.slice(0, 6), op, JSON.stringify(args || []).slice(0, 120));
  return f(cx, ...(Array.isArray(args) ? args : [args]));
}
// test aid, only with NOVA_DEBUG_SW: the context-menu entries extensions would add for the page in front, and a way to click one
function debug(a, t) {
  const wc = wcOf(t); if (!wc) return null;
  const flat = (list, pre = '') => list.flatMap((i) => (i.type === 'separator' ? [] : [{ label: pre + i.label, item: i }, ...(i.submenu ? flat(i.submenu, pre + i.label + ' > ') : [])]));
  const all = flat(menuItems(wc, a.p || {}));
  if (a.click) { const hit = all.find((x) => x.label === a.click); if (hit && hit.item.click) hit.item.click(); return { clicked: !!hit }; }
  return all.map((x) => x.label);
}
module.exports = { debug, init, watch, activated, removed, menuItems, refreshExternal, refreshAny, emit };
