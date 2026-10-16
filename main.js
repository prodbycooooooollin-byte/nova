// Nova - minimal Chromium browser. Main process: window, tabs, spaces, sleeping/archiving, adblock.
const { app, BaseWindow, WebContentsView, ipcMain, session, Menu, dialog, shell, clipboard, screen, nativeImage } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const updater = require('./updater');
const features = require('./features');
const budget = require('./budget');
const persona = require('./persona');
const UA = persona.UA;
const setup = require('./setup');
const setupMode = setup.detectMode();
const gotLock = setupMode ? true : app.requestSingleInstanceLock();
const fs = require('fs');

const DEFAULT_KEYS = {
  newTab: ['Ctrl+T'], go: ['Ctrl+L', 'Ctrl+K'], closeTab: ['Ctrl+W'], reopenTab: ['Ctrl+Shift+T'],
  nextTab: ['Ctrl+Tab', 'Ctrl+PageDown'], prevTab: ['Ctrl+Shift+Tab', 'Ctrl+PageUp'],
  overview: ['Ctrl+E'], reload: ['Ctrl+R', 'F5'], back: ['Alt+ArrowLeft'], forward: ['Alt+ArrowRight'],
  toggleSidebar: ['Ctrl+B'], focusMode: ['Ctrl+Shift+F'], find: ['Ctrl+F'], settings: ['Ctrl+,'],
  zoomIn: ['Ctrl+=', 'Ctrl++'], zoomOut: ['Ctrl+-'], zoomReset: ['Ctrl+0'], devtools: ['F12'],
  pinTab: ['Ctrl+Shift+P'], cleanUp: ['Ctrl+Shift+K'], bookmark: ['Ctrl+D'], history: ['Ctrl+H'], downloads: ['Ctrl+J'], bookmarks: ['Ctrl+Shift+O'], screenshot: ['Ctrl+Shift+S'], privateTab: ['Ctrl+Shift+N'], print: ['Ctrl+P'], fullscreen: ['F11'], lastTab: ['Ctrl+`'], copyClean: ['Ctrl+Shift+C'], darkPage: ['Ctrl+Shift+D'],
  space1: ['Alt+1'], space2: ['Alt+2'], space3: ['Alt+3'], space4: ['Alt+4'], space5: ['Alt+5'],
};
const DEFAULTS = {
  suggestions: false, blockAutoplay: true, density: 'comfortable', wallpaper: { mode: 'theme', preset: 'orbit', dim: 30, blur: 0 }, startPage: { sites: true, greeting: true },
  firstRun: true, setupVersion: 0, profile: 'nova', effects: true, keepHistory: true, thumbnails: true,
  searchEngine: 'https://duckduckgo.com/?q=%s',
  layout: 'left', compact: false, sidebarWidth: 252, gap: 8, radius: 12, fontSize: 13, font: 'Inter',
  theme: { bg: '#0b0b12', page: '#161621', surface: '#13131c', surface2: '#1c1c28', text: '#ececf3', dim: '#8b8ba0', accent: '#8b7dff', danger: '#ff6b7a' },
  customCss: '', customJs: '', pageCss: '',
  sleepAfterMin: 10, archiveAfterHours: 24, maxTabs: 25, dedupeTabs: true,
  adblock: true, extensions: [], keys: {}, updateFeed: '', zoom: {},
  // Optional features. Everything beyond the essentials is off until the user turns it on.
  budget: { enabled: true, ramMB: 2048, cpuGuard: true, cpuPct: 20 },
  features: { tabSearch: false, snooze: false, rewind: false, peek: false, darkPage: false, cleanLinks: false, soloAudio: false, screenshot: false, pip: false, savePdf: false, translate: false, privateTabs: false },
};

const HOME = 'nova://home';
const HOME_FILE = pathToFileURL(path.join(__dirname, 'ui', 'home.html')).href;
const isHome = (u) => u === HOME || (u || '').startsWith(HOME_FILE);
const homeUrl = () => HOME_FILE + '?' + new URLSearchParams({ bg: settings.theme.page, chrome: settings.theme.bg, accent: settings.theme.accent, text: settings.theme.text, dim: settings.theme.dim, engine: settings.searchEngine, fx: settings.effects ? 1 : 0, wall: settings.wallpaper.mode === 'none' ? '' : settings.wallpaper.preset });
// Profiles: one switch that decides how much Nova does.
const FEATURE_KEYS = ['tabSearch', 'snooze', 'rewind', 'peek', 'darkPage', 'cleanLinks', 'soloAudio', 'screenshot', 'pip', 'savePdf', 'translate', 'privateTabs'];
const featureSet = (on) => Object.fromEntries(FEATURE_KEYS.map((k) => [k, on]));
const PROFILES = {
  ultra: { blockAutoplay: true, effects: false, keepHistory: false, thumbnails: false, adblock: false, gap: 0, radius: 0, features: featureSet(false), budget: { enabled: true, ramMB: 1024, cpuGuard: true, cpuPct: 20 } },
  nova: { blockAutoplay: true, effects: true, keepHistory: true, thumbnails: true, adblock: true, gap: 8, radius: 12, features: featureSet(false), budget: { enabled: true, ramMB: 2048, cpuGuard: true, cpuPct: 20 } },
  complete: { blockAutoplay: false, effects: true, keepHistory: true, thumbnails: true, adblock: true, gap: 8, radius: 12, features: featureSet(true), budget: { enabled: true, ramMB: 4096, cpuGuard: true, cpuPct: 25 } },
};
let sessions = [], privSes = null;
let win, ui, settings, state;
let overlayOpen = false, sidebarHidden = false, focusMode = false, pageFullscreen = false;
const tabs = new Map(); // id -> tab
let nextId = 1;
let blocker = null;

const userFile = (n) => path.join(app.getPath('userData'), n);
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(userFile(f), 'utf8')); } catch { return d; } };
const writeJson = (f, v) => { try { fs.writeFileSync(userFile(f), JSON.stringify(v)); } catch (e) { console.error(e); } };

function loadSettings() {
  const s = readJson('settings.json', {});
  settings = { ...DEFAULTS, ...s, features: { ...DEFAULTS.features, ...(s.features || {}) }, budget: { ...DEFAULTS.budget, ...(s.budget || {}) }, wallpaper: { ...DEFAULTS.wallpaper, ...(s.wallpaper || {}) }, startPage: { ...DEFAULTS.startPage, ...(s.startPage || {}) }, theme: { ...DEFAULTS.theme, ...(s.theme || {}), ...(s.theme && !s.theme.page ? { page: s.theme.surface || DEFAULTS.theme.page } : {}) }, keys: { ...DEFAULT_KEYS, ...(s.keys || {}) } };
  if (!['', 'orbit', 'stars', 'grid'].includes(settings.wallpaper.preset)) settings.wallpaper.preset = 'orbit'; // the old colour-blob wallpapers are gone
}
const saveSettings = () => writeJson('settings.json', settings);

// ---------- helpers ----------
function normalizeInput(text) {
  const t = text.trim();
  if (/^nova:\/\/home/i.test(t)) return HOME;
  if (!t) return HOME;
  if (/^(https?|file|about|chrome|devtools):/i.test(t)) return t;
  if (!/\s/.test(t) && (/^localhost(:\d+)?(\/|$)/i.test(t) || /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/|$)/.test(t) || /^[^\s/]+\.[a-z]{2,}(:\d+)?([/?#]|$)/i.test(t))) return 'https://' + t;
  return settings.searchEngine.replace('%s', encodeURIComponent(t));
}
const activeSpace = () => state.spaces.find((s) => s.id === state.activeSpace) || state.spaces[0];
const activeTab = () => tabs.get(state.activeTab);

// ---------- layout ----------
function layout() {
  if (!win) return;
  const [w, h] = win.getContentSize();
  const gap = settings.gap;
  const side = settings.compact ? 56 : settings.sidebarWidth;
  const top = 96; // top layout: toolbar row + tab strip
  const hidden = sidebarHidden || focusMode || pageFullscreen;
  let uiRect = { x: 0, y: 0, width: 0, height: 0 }, c;
  if (hidden) c = { x: 0, y: 0, width: w, height: h };
  else if (settings.layout === 'top') { uiRect = { x: 0, y: 0, width: w, height: top }; c = { x: gap, y: top, width: w - gap * 2, height: h - top - gap }; }
  else if (settings.layout === 'right') { uiRect = { x: w - side, y: 0, width: side, height: h }; c = { x: gap, y: gap, width: w - side - gap, height: h - gap * 2 }; }
  else { uiRect = { x: 0, y: 0, width: side, height: h }; c = { x: side, y: gap, width: w - side - gap, height: h - gap * 2 }; }
  ui.setBounds(overlayOpen ? { x: 0, y: 0, width: w, height: h } : uiRect);
  ui.setVisible(overlayOpen || !hidden);
  const vis = visibleTabs();
  const gapIn = vis.length > 1 ? 6 : 0;
  vis.forEach((t, i) => {
    const each = Math.floor((c.width - gapIn) / vis.length);
    t.view.setBounds({ x: c.x + i * (each + gapIn), y: c.y, width: each, height: c.height });
    try { t.view.setBorderRadius(hidden || t.playing ? 0 : settings.radius); } catch {} // a rounded mask makes video cost more CPU, so square corners while media plays
  });
  win.setBackgroundColor(settings.theme.bg);
  features.relayoutPeek();
}
function visibleTabs() {
  const a = activeTab();
  const out = [];
  if (a && a.view) out.push(a);
  const s = state.split && tabs.get(state.split);
  if (s && s.view && s !== a && s.spaceId === a?.spaceId) out.push(s);
  return out;
}
function sync() { // attach visible views, keep ui on top
  for (const t of tabs.values()) if (t.view && t.attached && !visibleTabs().includes(t)) { win.contentView.removeChildView(t.view); t.attached = false; }
  for (const t of visibleTabs()) if (!t.attached) { win.contentView.addChildView(t.view); t.attached = true; }
  win.contentView.addChildView(ui);
  layout();
}

// ---------- state push ----------
let pushTimer = null;
function push() {
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    if (!ui || ui.webContents.isDestroyed()) return;
    ui.webContents.send('state', publicState());
    persistSoon();
  }, 30);
}
function publicState() {
  return {
    tabs: [...tabs.values()].map((t) => ({ id: t.id, spaceId: t.spaceId, url: t.url, title: t.title, favicon: t.favicon, pinned: t.pinned, asleep: !t.view, loading: t.loading, audible: t.audible, lastActive: t.lastActive, canBack: t.canBack, canForward: t.canForward, muted: !!t.muted, dark: !!t.dark, private: !!t.private, bookmarked: features.isBookmarked(t.url) })),
    extensions: (() => { try { return features.listExtensions(); } catch { return []; } })(), snoozed: (state.snoozed || []).length,
    spaces: state.spaces, activeSpace: state.activeSpace, activeTab: state.activeTab, split: state.split,
    archive: state.archive.slice(0, 80), settings, hidden: sidebarHidden || focusMode, focusMode, now: Date.now(),
    blockedCount: blockedCount, budget: (() => { try { return budget.get(); } catch { return { used: 0, tabs: {}, cap: 0, enabled: false }; } })(), version: updater.version, updateReady: updater.hasPending(),
  };
}
let persistTimer = null;
function persistSoon() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 600);
}
function persist() {
  writeJson('state.json', {
    spaces: state.spaces, activeSpace: state.activeSpace, activeTab: state.activeTab, archive: state.archive.slice(0, 300), snoozed: state.snoozed || [],
    tabs: [...tabs.values()].filter((t) => !t.private).map((t) => ({ id: t.id, spaceId: t.spaceId, url: t.url, title: t.title, favicon: t.favicon, pinned: t.pinned, lastActive: t.lastActive })),
  });
}
let blockedCount = 0;

// ---------- tabs ----------
function newTabObj(o) {
  const t = { id: nextId++, spaceId: o.spaceId || state.activeSpace, url: o.url || HOME, title: o.title || (!o.url || o.url === HOME ? 'New tab' : ''), favicon: o.favicon || '', pinned: !!o.pinned, private: !!o.private, lastActive: o.lastActive || Date.now(), view: null, attached: false, loading: false, audible: false, canBack: false, canForward: false, thumb: '' };
  tabs.set(t.id, t);
  return t;
}
function wake(t) {
  if (t.view) return;
  const view = new WebContentsView({ webPreferences: { partition: t.private ? 'nova-private' : 'persist:nova', sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: settings.profile !== 'ultra', autoplayPolicy: settings.blockAutoplay ? 'document-user-activation-required' : 'no-user-gesture-required' } });
  t.view = view;
  view.setBackgroundColor(settings.theme.page);
  const wc = view.webContents;
  const upd = () => { if (wc.isDestroyed()) return; const u = wc.getURL(); t.url = isHome(u) ? HOME : u || t.url; if (t.url === HOME) t.title = 'New tab'; t.canBack = wc.navigationHistory.canGoBack(); t.canForward = wc.navigationHistory.canGoForward(); push(); };
  wc.on('page-title-updated', (_e, title) => { t.title = isHome(t.url) ? 'New tab' : title; if (!isHome(t.url) && !t.private) features.recordVisit(wc.getURL(), title); push(); });
  wc.on('page-favicon-updated', (_e, f) => { t.favicon = f[0] || ''; if (!t.private && settings.keepHistory) features.setIcon(wc.getURL(), f[0]); push(); });
  wc.on('did-start-loading', () => { t.loading = true; push(); });
  wc.on('did-stop-loading', () => { t.loading = false; upd(); if (t.id === state.activeTab) setTimeout(() => capture(t), 1500); });
  wc.on('did-navigate', () => { upd(); applyZoom(wc); if (!t.private) features.recordVisit(wc.getURL(), wc.getTitle()); });
  wc.on('did-navigate-in-page', upd);
  wc.on('audio-state-changed', (e) => { t.audible = e.audible; features.onAudio(t); push(); });
  wc.on('media-started-playing', () => { if (!t.playing) { t.playing = true; layout(); } });
  wc.on('media-paused', () => { if (t.playing) { t.playing = false; layout(); } });
  wc.on('focus', () => { if (state.activeTab !== t.id && visibleTabs().includes(t)) activate(t.id, true); });
  wc.on('before-input-event', (e, input) => handleKey(e, input));
  wc.on('enter-html-full-screen', () => { pageFullscreen = true; win.setFullScreen(true); layout(); });
  wc.on('leave-html-full-screen', () => { pageFullscreen = false; win.setFullScreen(false); layout(); });
  wc.on('found-in-page', (_e, r) => ui.webContents.send('found', r));
  wc.setWindowOpenHandler(({ url, disposition, features }) => {
    // window.open(...) with a size is a login popup: it needs its opener, so it stays a real window
    if (disposition === 'new-window' && features) {
      const num = (k) => Number(new RegExp(k + '=(\d+)').exec(features)?.[1]) || undefined;
      return { action: 'allow', overrideBrowserWindowOptions: { width: num('width') || 520, height: num('height') || 700, autoHideMenuBar: true, backgroundColor: settings.theme.bg, icon: path.join(__dirname, 'build', 'icon.ico'), webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } } };
    }
    openUrl(url, { background: false, afterId: t.id, private: t.private }); return { action: 'deny' };
  });
  wc.on('context-menu', (_e, p) => contextMenu(wc, p));
  wc.on('did-finish-load', () => {
    applyPageCss(wc); if (t.dark) features.applyDark(t);
    if (isHome(wc.getURL())) pushHome(wc);
    if (isHome(wc.getURL()) && !t.private) wc.executeJavaScript(`window.novaSites && window.novaSites(${JSON.stringify(settings.keepHistory ? features.topSites(8) : [])})`).catch(() => {});
  });
  persona.ready(wc).then(() => { if (!wc.isDestroyed()) wc.loadURL(isHome(t.url) ? homeUrl() : t.url).catch(() => {}); });
}
// ---- start page theme: colours, wallpaper and switches are pushed into every open start page ----
let wallData = null;
function wallImage() {
  if (wallData !== null) return wallData;
  try { wallData = 'data:image/jpeg;base64,' + fs.readFileSync(userFile('wallpaper.jpg')).toString('base64'); } catch { wallData = ''; }
  return wallData;
}
function homeTheme() {
  const w = settings.wallpaper, t = settings.theme;
  return { bg: t.page, chrome: t.bg, accent: t.accent, text: t.text, dim: t.dim, wall: w.mode === 'none' ? '' : w.preset, dim_amount: w.dim, blur: w.blur, image: w.mode === 'image' ? wallImage() : '', stars: w.mode !== 'image', fx: !!settings.effects, sites: settings.startPage.sites, greeting: settings.startPage.greeting };
}
function pushHome(wc) {
  const js = `window.novaTheme && window.novaTheme(${JSON.stringify(homeTheme())})`;
  const targets = wc ? [wc] : [...tabs.values()].filter((t) => t.view && isHome(t.url) && !t.view.webContents.isDestroyed()).map((t) => t.view.webContents);
  for (const w of targets) w.executeJavaScript(js).catch(() => {});
}
async function pickWallpaper() {
  const r = await dialog.showOpenDialog(win, { title: 'Choose a wallpaper for the start page', properties: ['openFile'], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }] });
  if (r.canceled) return false;
  try {
    let img = nativeImage.createFromPath(r.filePaths[0]); if (img.isEmpty()) throw new Error('empty');
    const { width } = img.getSize(); if (width > 2560) img = img.resize({ width: 2560, quality: 'good' });
    fs.writeFileSync(userFile('wallpaper.jpg'), img.toJPEG(86)); wallData = null;
    settings.wallpaper = { ...settings.wallpaper, mode: 'image' }; saveSettings(); pushHome(); push(); return true;
  } catch (e) { toast('Could not use that image.'); return false; }
}
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
function applyZoom(wc) { const z = settings.zoom?.[hostOf(wc.getURL())]; if (z !== undefined) wc.setZoomLevel(z); }
function saveZoom(wc) { const h = hostOf(wc.getURL()); if (!h) return; settings.zoom = { ...settings.zoom, [h]: wc.getZoomLevel() }; saveSettings(); }
function applyPageCss(wc) { if (settings.pageCss && !wc.isDestroyed()) wc.insertCSS(settings.pageCss).catch(() => {}); }
async function capture(t) {
  if (!settings.thumbnails) return;
  if (!t.view || !t.attached || t.view.webContents.isDestroyed()) return;
  try {
    const img = await t.view.webContents.capturePage();
    if (img.isEmpty()) return;
    t.thumb = 'data:image/jpeg;base64,' + img.resize({ width: 360 }).toJPEG(55).toString('base64');
  } catch {}
}
function sleep(t) {
  if (!t.view) return;
  if (t.attached) { win.contentView.removeChildView(t.view); t.attached = false; }
  const wc = t.view.webContents;
  t.url = wc.isDestroyed() ? t.url : (isHome(wc.getURL()) ? HOME : wc.getURL() || t.url);
  if (!wc.isDestroyed()) { try { if (wc.debugger.isAttached()) wc.debugger.detach(); } catch {} wc.close(); }
  t.view = null; t.audible = false; t.loading = false; t.darkKey = null; t.muted = false;
}
function destroyTab(t) { sleep(t); tabs.delete(t.id); }

function activate(id, fromFocus) {
  const t = tabs.get(id);
  if (!t) return;
  const prev = activeTab();
  if (prev && prev !== t) state.prevTab = prev.id;
  if (prev && prev !== t) { capture(prev); prev.lastActive = Date.now(); }
  if (t.spaceId !== state.activeSpace) state.activeSpace = t.spaceId;
  state.activeTab = id;
  t.lastActive = Date.now();
  if (state.split && (state.split === id || tabs.get(state.split)?.spaceId !== t.spaceId)) state.split = null;
  wake(t);
  sync();
  if (!fromFocus && !overlayOpen) t.view.webContents.focus();
  push();
}
function openUrl(url, o = {}) {
  url = normalizeInput(url);
  if (settings.dedupeTabs && !isHome(url)) {
    const same = [...tabs.values()].find((t) => t.url === url && !o.forceNew && !t.private);
    if (same) { if (!o.background) activate(same.id); return same; }
  }
  const t = newTabObj({ url, spaceId: o.spaceId, private: o.private });
  if (o.afterId) { /* order is by map insertion; move after reference */ reorderAfter(t.id, o.afterId); }
  enforceLimit(t.id);
  if (o.background) { push(); return t; }
  activate(t.id);
  return t;
}
function reorderAfter(id, afterId) {
  const arr = [...tabs.entries()];
  const i = arr.findIndex(([k]) => k === id); const [item] = arr.splice(i, 1);
  const j = arr.findIndex(([k]) => k === afterId);
  arr.splice(j + 1, 0, item);
  tabs.clear(); arr.forEach(([k, v]) => tabs.set(k, v));
}
function archiveTab(t, quiet) {
  if (t.url && !isHome(t.url) && !t.private) state.archive.unshift({ url: t.url, title: t.title, favicon: t.favicon, spaceId: t.spaceId, closedAt: Date.now() });
  state.archive = state.archive.slice(0, 300);
  closeTab(t.id, quiet);
}
function closeTab(id) {
  const t = tabs.get(id);
  if (!t) return;
  const list = [...tabs.values()].filter((x) => x.spaceId === t.spaceId);
  const idx = list.indexOf(t);
  const wasActive = state.activeTab === id;
  if (state.split === id) state.split = null;
  destroyTab(t);
  if (t.private && privSes && ![...tabs.values()].some((x) => x.private)) privSes.clearStorageData().catch(() => {}); // last private tab gone: forget everything
  if (!tabs.size) { persist(); win.close(); return; } // the very last tab closes the window, like every other browser
  if (wasActive) {
    const rest = [...tabs.values()].filter((x) => x.spaceId === t.spaceId);
    const next = rest[Math.min(idx, rest.length - 1)] || null;
    if (next) activate(next.id);
    else { state.activeTab = null; const n = newTabObj({ spaceId: t.spaceId }); activate(n.id); }
  }
  push();
}
function enforceLimit(keepId) {
  const max = settings.maxTabs;
  if (!max) return;
  const open = [...tabs.values()].filter((t) => !t.pinned && t.id !== keepId && t.id !== state.activeTab);
  const over = tabs.size - max;
  if (over <= 0) return;
  open.sort((a, b) => a.lastActive - b.lastActive).slice(0, over).forEach((t) => archiveTab(t));
  toast(`Tab budget reached - archived ${Math.min(over, open.length)} oldest tab(s). Ctrl+K to bring them back.`);
}
function cleanUp(mode) {
  const now = Date.now();
  let n = 0;
  if (mode === 'duplicates') {
    const seen = new Map();
    for (const t of [...tabs.values()]) {
      if (seen.has(t.url) && !isHome(t.url) && t.id !== state.activeTab) { closeTab(t.id); n++; } else if (!seen.has(t.url)) seen.set(t.url, t);
    }
  } else {
    const idleMs = mode === 'hour' ? 3600e3 : mode === 'day' ? 86400e3 : 0;
    for (const t of [...tabs.values()]) {
      if (t.pinned || t.id === state.activeTab) continue;
      if (now - t.lastActive >= idleMs) { archiveTab(t); n++; }
    }
  }
  toast(n ? `Cleaned up ${n} tab(s). They're in the archive (Ctrl+K).` : 'Nothing to clean up.');
  push();
}
function toast(msg) { if (ui && !ui.webContents.isDestroyed()) ui.webContents.send('toast', msg); }

// idle policy: sleep after X min, archive after Y h
function idlePolicy() {
  const now = Date.now();
  for (const t of [...tabs.values()]) {
    if (t.id === state.activeTab || visibleTabs().includes(t) || t.audible) continue;
    const idle = now - t.lastActive;
    if (!t.pinned && settings.archiveAfterHours > 0 && idle > settings.archiveAfterHours * 3600e3) { archiveTab(t); continue; }
    if (t.view && settings.sleepAfterMin > 0 && idle > settings.sleepAfterMin * 60e3) sleep(t);
  }
  push();
}

// ---------- window dragging ----------
let drag = null;
function startDrag() {
  endDrag();
  const c0 = screen.getCursorScreenPoint(); let moved = false;
  drag = { c0, started: Date.now(), timer: setInterval(() => {
    if (!drag) return;
    const c = screen.getCursorScreenPoint();
    if (!moved) { if (Math.hypot(c.x - c0.x, c.y - c0.y) < 5) return; moved = true;
      let b = win.getBounds();
      if (win.isMaximized()) { const ratio = (c0.x - b.x) / b.width; win.unmaximize(); b = win.getBounds(); b.x = Math.round(c0.x - b.width * ratio); b.y = Math.round(c0.y - 16); }
      drag.b = b; }
    win.setBounds({ x: Math.round(drag.b.x + c.x - c0.x), y: Math.round(drag.b.y + c.y - c0.y), width: drag.b.width, height: drag.b.height });
    if (Date.now() - drag.started > 60000) endDrag();
  }, 8) };
}
function endDrag() {
  if (!drag) return;
  clearInterval(drag.timer);
  const c = screen.getCursorScreenPoint(), wa = screen.getDisplayNearestPoint(c).workArea;
  if (drag.b && c.y <= wa.y + 1) win.maximize(); // drop on the top edge to maximize
  drag = null;
}

// ---------- overlay & keys ----------
function openOverlay(kind, data) {
  overlayOpen = true;
  layout();
  win.contentView.addChildView(ui);
  ui.webContents.focus();
  ui.webContents.send('overlay', { kind, data });
}
function closeOverlay() {
  if (!overlayOpen) return;
  features.closePeek();
  overlayOpen = false;
  ui.webContents.send('overlay', null);
  layout();
  const t = activeTab();
  if (t?.view && !t.view.webContents.isDestroyed()) { t.view.webContents.stopFindInPage('clearSelection'); t.view.webContents.focus(); }
}
function accel(input) {
  const k = input.key;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(k)) return '';
  const parts = [];
  if (input.control || input.meta) parts.push('Ctrl');
  if (input.alt) parts.push('Alt');
  if (input.shift) parts.push('Shift');
  parts.push(k.length === 1 ? k.toUpperCase() : k);
  return parts.join('+');
}
let keysPaused = false; // true while the Shortcuts page records a new key combination
function handleKey(e, input) {
  if (input.type !== 'keyDown' || keysPaused) return;
  const a = accel(input);
  if (!a || a === 'Escape') return;
  for (const [action, list] of Object.entries(settings.keys)) {
    if (list.includes(a)) { e.preventDefault(); runAction(action); return; }
  }
}
const cycle = (dir) => {
  const list = [...tabs.values()].filter((t) => t.spaceId === state.activeSpace);
  if (!list.length) return;
  const i = list.findIndex((t) => t.id === state.activeTab);
  activate(list[(i + dir + list.length) % list.length].id);
};
function runAction(action, arg) {
  const t = activeTab();
  const wc = t?.view?.webContents;
  switch (action) {
    case 'newTab': openOverlay('palette', { mode: 'new', text: '' }); break;
    case 'go': openOverlay('palette', { mode: 'go', text: t && !isHome(t.url) ? t.url : '', select: true }); break;
    case 'closeTab': if (t) closeTab(t.id); break;
    case 'reopenTab': { const a = state.archive.shift(); if (a) openUrl(a.url, { spaceId: a.spaceId, forceNew: true }); break; }
    case 'nextTab': cycle(1); break;
    case 'prevTab': cycle(-1); break;
    case 'overview': openOverlay('overview'); break;
    case 'reload': wc?.reload(); break;
    case 'back': if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); break;
    case 'forward': if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); break;
    case 'toggleSidebar': sidebarHidden = !sidebarHidden; layout(); push(); break;
    case 'focusMode': focusMode = !focusMode; layout(); push(); break;
    case 'find': openOverlay('palette', { mode: 'find', text: '' }); break;
    case 'settings': openOverlay('settings'); break;
    case 'zoomIn': wc?.setZoomLevel(wc.getZoomLevel() + 0.5); saveZoom(wc); break;
    case 'zoomOut': wc?.setZoomLevel(wc.getZoomLevel() - 0.5); saveZoom(wc); break;
    case 'zoomReset': wc?.setZoomLevel(0); saveZoom(wc); break;
    case 'bookmark': features.handle('bookmark', {}, t); push(); break;
    case 'history': openOverlay('library', { tab: 'History' }); break;
    case 'downloads': openOverlay('library', { tab: 'Downloads' }); break;
    case 'bookmarks': openOverlay('library', { tab: 'Bookmarks' }); break;
    case 'screenshot': features.handle('screenshot', {}, t); break;
    case 'privateTab': features.handle('newPrivate', {}, t); break;
    case 'print': wc?.print(); break;
    case 'fullscreen': win.setFullScreen(!win.isFullScreen()); break;
    case 'lastTab': if (state.prevTab && tabs.has(state.prevTab)) activate(state.prevTab); break;
    case 'copyClean': features.handle('copyClean', {}, t); break;
    case 'darkPage': features.handle('darkPage', {}, t); break;
    case 'devtools': wc?.toggleDevTools(); break;
    case 'pinTab': if (t) { t.pinned = !t.pinned; push(); } break;
    case 'cleanUp': openOverlay('overview'); break;
    default:
      if (/^space\d$/.test(action)) { const s = state.spaces[+action.slice(5) - 1]; if (s) switchSpace(s.id); }
  }
}
function switchSpace(id) {
  state.activeSpace = id;
  const t = [...tabs.values()].filter((x) => x.spaceId === id).sort((a, b) => b.lastActive - a.lastActive)[0] || newTabObj({ spaceId: id });
  activate(t.id);
}
function contextMenu(wc, p) {
  const items = [];
  if (p.linkURL) items.push(...(settings.features.peek ? [{ label: 'Peek at link', click: () => features.handle('peek', { url: p.linkURL }) }] : []), { label: 'Open link in new tab', click: () => openUrl(p.linkURL, { background: true, forceNew: true }) }, ...(settings.features.cleanLinks ? [{ label: 'Copy link without trackers', click: () => clipboard.writeText(features.cleanUrl(p.linkURL)) }] : []), { label: 'Copy link', click: () => clipboard.writeText(p.linkURL) }, { type: 'separator' });
  if (p.mediaType === 'image') items.push({ label: 'Open image in new tab', click: () => openUrl(p.srcURL, { forceNew: true }) }, { label: 'Copy image', click: () => wc.copyImageAt(p.x, p.y) }, { type: 'separator' });
  if (p.isEditable) items.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, { type: 'separator' });
  else if (p.selectionText) items.push({ role: 'copy' }, { label: `Search "${p.selectionText.slice(0, 24)}"`, click: () => openUrl(settings.searchEngine.replace('%s', encodeURIComponent(p.selectionText)), { forceNew: true }) }, { type: 'separator' });
  items.push({ label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() }, { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() }, { label: 'Reload', click: () => wc.reload() }, { label: 'Bookmark this page', click: () => runAction('bookmark') }, { label: 'Print…', click: () => wc.print() }, { type: 'separator' }, { label: 'Inspect', click: () => wc.inspectElement(p.x, p.y) });
  Menu.buildFromTemplate(items).popup({ window: win });
}

// ---------- adblock (uBlock Origin filter lists) ----------
const LISTS = [
  'https://ublockorigin.github.io/uAssets/filters/filters.txt',
  'https://ublockorigin.github.io/uAssets/filters/badware.txt',
  'https://ublockorigin.github.io/uAssets/filters/privacy.txt',
  'https://ublockorigin.github.io/uAssets/filters/quick-fixes.txt',
  'https://ublockorigin.github.io/uAssets/filters/unbreak.txt',
  'https://easylist.to/easylist/easylist.txt',
  'https://easylist.to/easylist/easyprivacy.txt',
];
async function initAdblock(list) {
  try {
    const { ElectronBlocker } = require('@ghostery/adblocker-electron');
    blocker = await ElectronBlocker.fromLists(fetch, LISTS, { enableCompression: true }, {
      path: userFile('adblock.bin'), read: fs.promises.readFile, write: fs.promises.writeFile,
    });
    blocker.on('request-blocked', () => { blockedCount++; push(); });
    if (settings.adblock) list.forEach((s) => adblockEnable(s));
  } catch (e) { console.error('adblock failed', e); toast('Ad blocker lists could not be loaded (offline?).'); }
}
// The blocker library registers global IPC handlers per enable call, so only the main session uses it directly;
// other sessions (private tabs) get the same filtering through the shared request hooks and preload.
const extraAdblock = new Map();
function adblockEnable(s) {
  if (s === sessions[0]) { blocker.enableBlockingInSession(s); return; }
  if (extraAdblock.has(s)) return;
  s.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, blocker.onBeforeRequest);
  s.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, blocker.onHeadersReceived);
  let id; try { id = s.registerPreloadScript({ type: 'frame', filePath: require.resolve('@ghostery/adblocker-electron-preload') }); } catch {}
  extraAdblock.set(s, id);
}
function adblockDisable(s) {
  if (s === sessions[0]) { if (blocker.isBlockingEnabled(s)) blocker.disableBlockingInSession(s); return; }
  if (!extraAdblock.has(s)) return;
  s.webRequest.onBeforeRequest(null); s.webRequest.onHeadersReceived(null);
  const id = extraAdblock.get(s); if (id) { try { s.unregisterPreloadScript(id); } catch {} } extraAdblock.delete(s);
}
function setAdblock(on) {
  settings.adblock = on;
  if (!blocker) return;
  for (const s of sessions) { try { if (on) adblockEnable(s); else adblockDisable(s); } catch (e) { console.error('adblock toggle', e.message); } }
}
function applyProfile(name) {
  const p = PROFILES[name]; if (!p) return;
  const { features: f, budget: b, adblock, ...rest } = p;
  Object.assign(settings, rest, { profile: name, features: { ...f }, budget: { ...b } });
  try { setAdblock(adblock); } finally { saveSettings(); layout(); push(); }
}

// ---------- extensions (Electron supports a subset of Chrome extension APIs) ----------
async function loadExtensions(ses) {
  try { ses.registerPreloadScript({ type: 'service-worker', filePath: (() => { const p = path.join(__dirname, 'ext-shim.js'), u = p.replace('app.asar', 'app.asar.unpacked'); return fs.existsSync(u) ? u : p; })() }); } catch (e) { console.error('ext shim', e.message); } // fills the chrome.* gaps that stall password managers
  if (process.env.NOVA_DEBUG_SW) { // diagnostics for extension service workers: NOVA_DEBUG_SW=1 writes sw.log into the profile folder
    const log = (t) => { try { fs.appendFileSync(userFile('sw.log'), t + '\n'); } catch {} };
    ses.serviceWorkers.on('console-message', (_e, d) => log(`[console ${d.level}] ${d.message} (${d.sourceUrl}:${d.lineNumber})`));
    ses.serviceWorkers.on('running-status-changed', (d) => log(`[status] version ${d.versionId} ${d.runningStatus}`));
    ses.serviceWorkers.on('registration-completed', (d) => log(`[registered] ${d.scope}`));
  }
  for (const p of settings.extensions) { try { await ses.extensions.loadExtension(p, { allowFileAccess: true }); } catch (e) { console.error('extension', p, e.message); } }
}

// ---------- app ----------
if (setupMode) setup.run(setupMode);
if (!setupMode && gotLock) app.whenReady().then(async () => {
  app.setAppUserModelId('app.nova.browser');
  loadSettings();
  // the installer can leave a profile choice behind for the very first launch
  { const fr = readJson('first-run.json', null); try { fs.rmSync(userFile('first-run.json'), { force: true }); } catch {}
    if (fr && PROFILES[fr.profile]) { const { features: f, budget: b, ...rest } = PROFILES[fr.profile]; Object.assign(settings, rest, { profile: fr.profile, features: { ...f }, budget: { ...b } }); saveSettings(); } }
  const saved = readJson('state.json', null);
  state = { spaces: saved?.spaces?.length ? saved.spaces : [{ id: 1, name: 'Main', color: '#7c8cff' }], activeSpace: saved?.activeSpace || 1, activeTab: null, archive: saved?.archive || [], snoozed: saved?.snoozed || [], split: null };
  Menu.setApplicationMenu(null);

  const ses = session.fromPartition('persist:nova');
  privSes = session.fromPartition('nova-private'); // in memory only, never written to disk
  sessions = [ses, privSes];
  for (const s of sessions) { s.setUserAgent(UA, persona.acceptLanguage()); s.registerPreloadScript({ type: 'frame', filePath: path.join(__dirname, 'shim-preload.js') }); }
  for (const s of sessions) s.webRequest.onBeforeSendHeaders({ urls: ['https://*/*'] }, (d, cb) => { const h = d.requestHeaders; for (const [k, v] of Object.entries(persona.hints)) if (!Object.keys(h).some((x) => x.toLowerCase() === k)) h[k] = v; cb({ requestHeaders: h }); });
  // every page (tabs, sign-in popups) presents the same regular-Chrome identity
  if (!process.env.NOVA_NO_PERSONA) app.on('web-contents-created', (_e, wc) => { if (sessions.includes(wc.session)) persona.apply(wc); });
  features.init({
    app, ses, privSes, tabs, userFile, readJson, writeJson, userAgent: UA,
    state: () => state, settings: () => settings, saveSettings, win: () => win, ui: () => ui,
    toast: (m) => toast(m), push: () => push(), openOverlay: (k, d) => openOverlay(k, d), closeOverlay: () => closeOverlay(),
    newPrivateTab: () => { const t = newTabObj({ private: true }); activate(t.id); return t; },
    openUrl: (u, o) => openUrl(u, o), closeTab: (id) => closeTab(id), sleepTab: (t) => sleep(t), budgetTabs: () => budget.get().tabs,
    addBackgroundTab: (o) => { const t = newTabObj({ url: o.url, title: o.title, favicon: o.favicon, spaceId: state.spaces.some((s) => s.id === o.spaceId) ? o.spaceId : state.activeSpace, pinned: o.pinned }); push(); return t; },
  });
  const permissions = (wc, perm, cb, details) => {
    if (['fullscreen', 'clipboard-sanitized-write', 'pointerLock'].includes(perm)) return cb(true);
    if (!['media', 'geolocation', 'notifications', 'clipboard-read'].includes(perm)) return cb(false);
    const host = (() => { try { return new URL(details.requestingUrl).host; } catch { return 'this site'; } })();
    dialog.showMessageBox(win, { type: 'question', buttons: ['Allow', 'Block'], defaultId: 1, cancelId: 1, message: `${host} wants permission: ${perm}` }).then((r) => cb(r.response === 0));
  };
  for (const s of sessions) s.setPermissionRequestHandler(permissions);

  win = new BaseWindow({ width: 1360, height: 860, minWidth: 640, minHeight: 420, frame: false, backgroundColor: settings.theme.bg, title: 'Nova', icon: path.join(__dirname, 'build', 'icon.ico') });
  ui = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true } });
  ui.setBackgroundColor('#00000000');
  win.contentView.addChildView(ui);
  ui.webContents.on('before-input-event', (e, i) => handleKey(e, i));
  ui.webContents.loadFile(path.join(__dirname, 'ui', 'index.html'));
  win.on('resize', layout);
  win.on('maximize', () => ui.webContents.send('maximized', true));
  win.on('unmaximize', () => ui.webContents.send('maximized', false));
  win.on('closed', () => { persist(); app.quit(); });

  // restore tabs lazily (all asleep except the active one)
  if (saved?.tabs?.length) {
    for (const s of saved.tabs) { const t = newTabObj(s); t.id = s.id; nextId = Math.max(nextId, s.id + 1); tabs.delete(t.id); tabs.set(s.id, { ...t, id: s.id }); }
    const sp = [...tabs.values()].filter((t) => t.spaceId === state.activeSpace);
    const pick = tabs.get(saved.activeTab) || sp[0] || [...tabs.values()][0];
    ui.webContents.once('did-finish-load', () => activate(pick.id));
  } else {
    ui.webContents.once('did-finish-load', () => { const t = newTabObj({}); activate(t.id); });
  }
  ui.webContents.once('did-finish-load', () => { if (settings.firstRun || settings.setupVersion < 2) openOverlay('wizard'); });

  initAdblock(sessions);
  budget.init({ tabs, settings: () => settings, sleepTab: (t) => sleep(t), visibleIds: () => visibleTabs().map((t) => t.id), toast: (m) => toast(m), push: () => push() });
  updater.onEvent((e) => { if (e.type === 'toast') toast(e.text); else if (e.type === 'ready') { toast(`Nova ${e.version} is ready. It installs when you restart.`); push(); } });
  const feed = () => settings.updateFeed || updater.defaultFeed;
  setTimeout(() => updater.check(feed()), 20000);
  setInterval(() => updater.check(feed()), 4 * 3600e3);
  app.on('before-quit', () => { if (updater.hasPending()) updater.apply(); });
  app.on('second-instance', (_e, argv) => {
    if (win.isMinimized()) win.restore(); win.focus();
    const u = argv.slice(1).find((a) => /^https?:\/\//i.test(a) || /\.html?$/i.test(a));
    if (u) openUrl(/^https?:/i.test(u) ? u : pathToFileURL(u).href, { forceNew: true });
  });
  const startUrl = process.argv.slice(1).find((a) => /^https?:\/\//i.test(a));
  if (startUrl) ui.webContents.once('did-finish-load', () => setTimeout(() => openUrl(startUrl, { forceNew: true }), 300));
  loadExtensions(ses);
  setInterval(idlePolicy, 30000);
  layout();

  // ----- IPC from the UI -----
  ipcMain.handle('state', () => publicState());
  ipcMain.handle('thumbs', () => Object.fromEntries([...tabs.values()].filter((t) => t.thumb).map((t) => [t.id, t.thumb])));
  ipcMain.handle('cmd', async (_e, name, a = {}) => {
    const t = (a.id && tabs.get(a.id)) || activeTab();
    switch (name) {
      case 'activate': closeOverlay(); activate(a.id); break;
      case 'open': closeOverlay(); {
        const url = normalizeInput(a.text);
        if (a.newTab || !activeTab()) openUrl(url, { forceNew: true });
        else { const c = activeTab(); if (c.view) c.view.webContents.loadURL(url).catch(() => {}); else { c.url = url; wake(c); } c.url = url; }
        push();
      } break;
      case 'close': closeTab(a.id); break;
      case 'archive': if (t) archiveTab(t); break;
      case 'pin': if (t) { t.pinned = !t.pinned; push(); } break;
      case 'sleep': if (t && t.id !== state.activeTab) { sleep(t); push(); } break;
      case 'restore': closeOverlay(); { const i = state.archive.findIndex((x) => x.closedAt === a.closedAt); if (i >= 0) { const [x] = state.archive.splice(i, 1); openUrl(x.url, { spaceId: x.spaceId, forceNew: true }); } } break;
      case 'moveToSpace': if (t) { t.spaceId = a.spaceId; if (t.id === state.activeTab) switchSpace(a.spaceId); push(); } break;
      case 'split': if (t && t.id !== state.activeTab) { state.split = t.id; wake(t); closeOverlay(); sync(); push(); } else { state.split = null; sync(); push(); } break;
      case 'closeOverlay': closeOverlay(); break;
      case 'overlay': openOverlay(a.kind, a.data); break;
      case 'action': closeOverlay(); runAction(a.name); break;
      case 'back': t?.view?.webContents.navigationHistory.goBack(); break;
      case 'forward': t?.view?.webContents.navigationHistory.goForward(); break;
      case 'reload': t?.view?.webContents.reload(); break;
      case 'find': { const wc = activeTab()?.view?.webContents; if (!wc) break; if (!a.text) wc.stopFindInPage('clearSelection'); else wc.findInPage(a.text, { forward: a.forward !== false, findNext: !!a.next }); } break;
      case 'switchSpace': switchSpace(a.id); break;
      case 'addSpace': { const id = Math.max(...state.spaces.map((s) => s.id)) + 1; state.spaces.push({ id, name: a.name || 'Space ' + id, color: a.color || '#7c8cff' }); switchSpace(id); } break;
      case 'renameSpace': { const s = state.spaces.find((x) => x.id === a.id); if (s) { if (a.name) s.name = a.name; if (a.color) s.color = a.color; push(); } } break;
      case 'deleteSpace': if (state.spaces.length > 1) { for (const x of [...tabs.values()]) if (x.spaceId === a.id) destroyTab(x); state.spaces = state.spaces.filter((s) => s.id !== a.id); switchSpace(state.spaces[0].id); } break;
      case 'cleanUp': cleanUp(a.mode); break;
      case 'settings': {
        const prev = JSON.stringify([settings.layout, settings.compact, settings.gap, settings.radius, settings.theme.bg, settings.pageCss]);
        Object.assign(settings, a.patch);
        if (a.patch.theme) { settings.theme = { ...DEFAULTS.theme, ...a.patch.theme }; if (!a.patch.theme.page) settings.theme.page = a.patch.theme.surface || DEFAULTS.theme.page; for (const x of tabs.values()) if (x.view && !x.view.webContents.isDestroyed()) x.view.setBackgroundColor(settings.theme.page); }
        if (a.patch.keys) settings.keys = { ...DEFAULT_KEYS, ...a.patch.keys };
        if ('adblock' in a.patch) setAdblock(a.patch.adblock);
        saveSettings();
        if (prev !== JSON.stringify([settings.layout, settings.compact, settings.gap, settings.radius, settings.theme.bg, settings.pageCss])) layout();
        if (a.patch.theme || a.patch.wallpaper || a.patch.startPage) pushHome();
        if (a.patch.pageCss !== undefined) for (const x of tabs.values()) if (x.view) { applyPageCss(x.view.webContents); }
        push();
      } break;
      case 'applyProfile': applyProfile(a.name); break;
      case 'runSetup': closeOverlay(); setTimeout(() => openOverlay('wizard'), 60); break;
      case 'newPrivate': return features.handle('newPrivate', a, t);
      case 'resetSettings': settings = { ...DEFAULTS, theme: { ...DEFAULTS.theme }, keys: { ...DEFAULT_KEYS }, features: { ...DEFAULTS.features }, budget: { ...DEFAULTS.budget }, firstRun: false, setupVersion: 2 }; saveSettings(); layout(); push(); break;
      case 'finishSetup': settings.firstRun = false; settings.setupVersion = 2; saveSettings(); closeOverlay(); push(); break;
      case 'loadExtension': {
        const r = await dialog.showOpenDialog(win, { title: 'Select an unpacked extension folder', properties: ['openDirectory'] });
        if (!r.canceled) { try { await ses.extensions.loadExtension(r.filePaths[0], { allowFileAccess: true }); if (!settings.extensions.includes(r.filePaths[0])) settings.extensions.push(r.filePaths[0]); saveSettings(); toast('Extension loaded.'); } catch (e) { toast('Could not load extension: ' + e.message); } push(); }
      } break;
      case 'removeExtension': settings.extensions = settings.extensions.filter((p) => p !== a.path); saveSettings(); toast('Removed. Takes effect after restart.'); push(); break;
      case 'checkUpdate': updater.check(settings.updateFeed || updater.defaultFeed, { manual: true }); break;
      case 'applyUpdate': if (updater.apply()) app.quit(); break;
      case 'keysPause': keysPaused = !!a.on; break;
      case 'reorder': { const arr = [...tabs.entries()], i = arr.findIndex(([k]) => k === a.id); if (i < 0) break; const [item] = arr.splice(i, 1); const j = arr.findIndex(([k]) => k === a.target); arr.splice(j < 0 ? arr.length : a.after ? j + 1 : j, 0, item); tabs.clear(); arr.forEach(([k, v]) => tabs.set(k, v)); push(); } break;
      case 'pickWallpaper': return pickWallpaper();
      case 'dragStart': startDrag(); break;
      case 'dragEnd': endDrag(); break;
      case 'external': shell.openExternal(a.url); break;
      default: return features.handle(name, a, t);
      case 'win': if (a.op === 'min') win.minimize(); else if (a.op === 'max') (win.isMaximized() ? win.unmaximize() : win.maximize()); else if (a.op === 'close') win.close(); break;
    }
  });
});
app.on('window-all-closed', () => app.quit());
