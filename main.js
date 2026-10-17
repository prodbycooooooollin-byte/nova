// Nova - minimal Chromium browser. Main process: window, tabs, spaces, sleeping/archiving, adblock.
const { app, BaseWindow, WebContentsView, ipcMain, session, Menu, dialog, shell, clipboard, screen, nativeImage, net, systemPreferences, nativeTheme, crashReporter } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const updater = require('./updater');
const features = require('./features');
const wallpalette = require('./wallpalette');
const darkmode = require('./darkmode');
const webtools = require('./webtools');
const passwords = require('./passwords');
const extbridge = require('./extbridge');
const scriptletGuard = require('./scriptlet-guard');
const extmgr = require('./extmgr');
const budget = require('./budget');
const sleeper = require('./sleeper');
const persona = require('./persona');
const profiles = require('./profiles');
const UA = persona.UA;
const setup = require('./setup');
const setupMode = setup.detectMode();
const gotLock = setupMode ? true : app.requestSingleInstanceLock();
const fs = require('fs');

const DEFAULT_KEYS = {
  newTab: ['Ctrl+T'], go: ['Ctrl+L', 'Ctrl+K', 'Alt+D', 'F6'], closeTab: ['Ctrl+W', 'Ctrl+F4'], reopenTab: ['Ctrl+Shift+T'],
  nextTab: ['Ctrl+Tab', 'Ctrl+PageDown'], prevTab: ['Ctrl+Shift+Tab', 'Ctrl+PageUp'],
  overview: ['Ctrl+E'], reload: ['Ctrl+R', 'F5'], back: ['Alt+ArrowLeft', 'Mouse4'], forward: ['Alt+ArrowRight', 'Mouse5'],
  toggleSidebar: ['Ctrl+B'], focusMode: ['Ctrl+Shift+F'], find: ['Ctrl+F'], settings: ['Ctrl+,'],
  zoomIn: ['Ctrl+=', 'Ctrl++', 'Ctrl+WheelUp'], zoomOut: ['Ctrl+-', 'Ctrl+WheelDown'], zoomReset: ['Ctrl+0'], devtools: ['F12', 'Ctrl+Shift+I'],
  pinTab: ['Ctrl+Shift+P'], hub: ['Ctrl+Shift+E'], cleanUp: ['Ctrl+Shift+K'], bookmark: ['Ctrl+D'], history: ['Ctrl+H'], downloads: ['Ctrl+J'], bookmarks: ['Ctrl+Shift+O'], screenshot: ['Ctrl+Shift+S'], privateTab: ['Ctrl+Shift+N'], print: ['Ctrl+P'], fullscreen: ['F11'], lastTab: ['Ctrl+`'], copyClean: ['Ctrl+Shift+C'], darkPage: ['Ctrl+Shift+D'],
  newWindow: ['Ctrl+N'], hardReload: ['Ctrl+Shift+R', 'Ctrl+F5'], viewSource: ['Ctrl+U'], savePage: ['Ctrl+S'], clearData: ['Ctrl+Shift+Delete'],
  findNext: ['F3', 'Ctrl+G'], findPrev: ['Shift+F3', 'Ctrl+Shift+G'], homePage: ['Alt+Home'], bookmarksBarToggle: ['Ctrl+Shift+B'], closeWindow: ['Ctrl+Shift+W'],
  moveTabLeft: ['Ctrl+Shift+PageUp'], moveTabRight: ['Ctrl+Shift+PageDown'],
  tab1: ['Ctrl+1'], tab2: ['Ctrl+2'], tab3: ['Ctrl+3'], tab4: ['Ctrl+4'], tab5: ['Ctrl+5'], tab6: ['Ctrl+6'], tab7: ['Ctrl+7'], tab8: ['Ctrl+8'], tabLast: ['Ctrl+9'],
  space1: ['Alt+1'], space2: ['Alt+2'], space3: ['Alt+3'], space4: ['Alt+4'], space5: ['Alt+5'],
};
// Smart sleep (Settings > Resource budget): freeze background tabs, wake them invisibly, learn per site how soon to sleep them
const SMART = { freeze: true, freezeAfterSec: 30, softWake: true, earlySleepMin: 3, adaptive: true };
const DEFAULTS = {
  suggestions: false, bookmarksBar: true, blockAutoplay: true, density: 'comfortable', wallpaper: { mode: 'preset', preset: 'stars', dim: 30, blur: 0, follow: false }, startPage: { sites: true, greeting: true, stats: true },
  firstRun: true, setupVersion: 0, profile: 'nova', effects: true, keepHistory: true, thumbnails: true,
  searchEngine: 'https://duckduckgo.com/?q=%s',
  searchKeywords: 'yt https://www.youtube.com/results?search_query=%s YouTube\nw https://en.wikipedia.org/w/index.php?search=%s Wikipedia\ngh https://github.com/search?q=%s GitHub\nr https://www.reddit.com/search/?q=%s Reddit\na https://www.amazon.com/s?k=%s Amazon\nmaps https://www.google.com/maps/search/%s Google Maps\ng https://www.google.com/search?q=%s Google\ntw https://www.twitch.tv/search?term=%s Twitch', // address bar: a keyword, a space and what to look for (yt cats): keyword, address with %s, name
  bookmarksPos: 'below', topHide: [], // tabs-on-top bar: where the bookmarks row sits (below / above the address bar) and which buttons are hidden
  layout: 'top', compact: false, sidebarWidth: 252, gap: 8, radius: 12, fontSize: 13, font: 'Inter',
  theme: { bg: '#0b0b12', page: '#161621', surface: '#13131c', surface2: '#1c1c28', text: '#ececf3', dim: '#8b8ba0', accent: '#8b7dff', danger: '#ff6b7a' },
  customCss: '', customJs: '', pageCss: '',
  sleepAfterMin: 10, archiveAfterHours: 24, maxTabs: 25, dedupeTabs: true,
  adblock: true, extensions: [], keys: {}, updateFeed: '', zoom: {},
  // Optional features. Everything beyond the essentials is off until the user turns it on.
  budget: { enabled: true, ramMB: 1500, cpuGuard: true, cpuPct: 20, ...SMART }, lowIsolation: false, downloads: { fast: true, connections: 8, limitMBs: 0, minMB: 8, panel: false }, cache: { limitMB: 500, auto: true }, pageScheme: 'system', layoutBlocks: { order: [], hidden: [] },
  features: { tabSearch: false, snooze: false, rewind: false, peek: false, darkPage: false, cleanLinks: false, soloAudio: false, screenshot: false, pip: false, autoPip: false, savePdf: false, translate: false, privateTabs: false, darkSite: false, videoSpeed: false, sponsorBlock: false, ytDislike: false, cookieBanners: false, passwords: false },
  darkSites: [],
  profiles: [], purge: [], // the user's profiles (profiles.js: a name, a colour and a session of their own); purge: partition folders of deleted profiles, removed at the next start
  passkeys: false, // websites may ask Windows for a passkey or security key (the Windows Security window with a PIN); off: they are told none is available
  bookmarkNames: true, // false: the bookmarks bar shows only the small icons
  newTabPage: 'home', // what a new tab shows: the start page ('home') or the address bar to type into ('bar')
};

const { execFile } = require('child_process');
const AUMID = 'app.nova.browser.v2'; // the taskbar groups windows and picks their icon by this name; a new name starts without any old cached picture
const HOME = 'nova://home';
const HOME_FILE = pathToFileURL(path.join(__dirname, 'ui', 'home.html')).href;
const isHome = (u) => u === HOME || (u || '').startsWith(HOME_FILE);
const homeUrl = () => HOME_FILE + '?' + new URLSearchParams({ bg: settings.theme.page, chrome: settings.theme.bg, accent: settings.theme.accent, text: settings.theme.text, dim: settings.theme.dim, engine: settings.searchEngine, kw: settings.searchKeywords || '', prof: settings.profile, fx: settings.effects ? 1 : 0, wall: settings.wallpaper.mode === 'none' ? '' : settings.wallpaper.preset });
// Profiles: one switch that decides how much Nova does.
const FEATURE_KEYS = ['tabSearch', 'snooze', 'rewind', 'peek', 'darkPage', 'darkSite', 'cleanLinks', 'soloAudio', 'screenshot', 'pip', 'autoPip', 'savePdf', 'translate', 'privateTabs', 'videoSpeed', 'sponsorBlock', 'ytDislike', 'cookieBanners', 'passwords'];
const featureSet = (on) => Object.fromEntries(FEATURE_KEYS.map((k) => [k, on]));
const GROUP_COLORS = ['#8b7dff', '#4db8ff', '#4ddc9a', '#ffb04d', '#ff7a90', '#c084fc', '#2dd4bf', '#ff6b6b'];
const PROFILES = {
  ultra: { blockAutoplay: true, effects: false, keepHistory: false, thumbnails: false, adblock: false, gap: 0, radius: 0, features: featureSet(false), budget: { enabled: true, ramMB: 800, cpuGuard: true, cpuPct: 20, ...SMART } },
  nova: { blockAutoplay: true, effects: true, keepHistory: true, thumbnails: true, adblock: true, gap: 8, radius: 12, features: featureSet(false), budget: { enabled: true, ramMB: 1500, cpuGuard: true, cpuPct: 20, ...SMART } },
  complete: { blockAutoplay: false, effects: true, keepHistory: true, thumbnails: true, adblock: true, gap: 8, radius: 12, features: featureSet(true), budget: { enabled: true, ramMB: 3000, cpuGuard: true, cpuPct: 25, ...SMART } },
};
let sessions = []; // every session that exists: one per profile that was opened, plus an in-memory one for its private tabs (made on first use, see sessionFor)
const profSes = new Map(), sesInfo = new Map(), sesReady = new Map(); // 'main' / 'main!' (private) -> session; session -> { pid, priv }; session -> promise: its extensions are loaded
let win, ui, settings, state;
let overlayKind = '', overlayOpen = false, sidebarHidden = false, focusMode = false, pageFullscreen = false;
const tabs = new Map(); // id -> tab
let nextId = 1;
let blocker = null;

const userFile = (n) => path.join(app.getPath('userData'), n);
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(userFile(f), 'utf8')); } catch { return d; } };
const writeJson = (f, v) => { try { fs.writeFileSync(userFile(f), JSON.stringify(v)); } catch (e) { console.error(e); } };
// ---------- diagnostics: crash dumps stay on this PC, and a short log of what Nova was doing explains why it closed ----------
try { crashReporter.start({ uploadToServer: false, compress: true, productName: 'Nova', companyName: 'Nova' }); } catch { /* not available */ }
const dlog = (m) => { try { fs.appendFileSync(userFile('nova.log'), `${new Date().toISOString()} ${m}\n`); } catch { /* disk full or locked */ } };
try {
  const lp = userFile('nova.log'), flag = userFile('running.flag');
  if (fs.existsSync(lp) && fs.statSync(lp).size > 400 * 1024) fs.renameSync(lp, userFile('nova.old.log'));
  if (fs.existsSync(flag)) dlog('!! the previous session did not end cleanly (' + fs.readFileSync(flag, 'utf8') + ')');
  fs.writeFileSync(flag, `${app.getVersion()} pid ${process.pid} since ${new Date().toISOString()}`);
  app.on('will-quit', () => { try { fs.unlinkSync(flag); } catch { /* gone */ } });
} catch { /* the log is a help, never a reason to stop */ }
process.on('uncaughtException', (e) => dlog('uncaught exception: ' + ((e && e.stack) || e)));
process.on('unhandledRejection', (e) => dlog('unhandled rejection: ' + ((e && e.stack) || e)));
app.on('child-process-gone', (_e, d) => dlog(`child process gone: ${d.type} ${d.reason} exit ${d.exitCode}${d.name ? ' ' + d.name : ''}`));
app.on('render-process-gone', (_e, wc, d) => { let u = ''; try { u = wc.getURL().slice(0, 80); } catch { /* gone */ } dlog(`renderer gone: ${d.reason} exit ${d.exitCode} ${u}`); });

try {
  const early = readJson('settings.json', {});
  if (early.lowIsolation) app.commandLine.appendSwitch('disable-site-isolation-trials'); // opt-in: one process for a page and its frames, about 12% less memory, weaker isolation
  const cacheMB = early.cache && early.cache.limitMB !== undefined ? +early.cache.limitMB : 500; // the page cache on disk: Chromium itself keeps it under this size
  if (cacheMB > 0) app.commandLine.appendSwitch('disk-cache-size', String(Math.round(cacheMB * 1048576)));
} catch {}

// the colour scheme websites see (prefers-color-scheme): follow Windows, or always light, or always dark
function applyScheme() { try { nativeTheme.themeSource = ['light', 'dark'].includes(settings.pageScheme) ? settings.pageScheme : 'system'; } catch { /* not available */ } }
function loadSettings() {
  const s = readJson('settings.json', {});
  settings = { ...DEFAULTS, ...s, features: { ...DEFAULTS.features, ...(s.features || {}) }, downloads: { ...DEFAULTS.downloads, ...(s.downloads || {}) }, cache: { ...DEFAULTS.cache, ...(s.cache || {}) }, budget: { ...DEFAULTS.budget, ...(s.budget || {}) }, wallpaper: { ...DEFAULTS.wallpaper, ...(s.wallpaper || {}) }, startPage: { ...DEFAULTS.startPage, ...(s.startPage || {}) }, theme: { ...DEFAULTS.theme, ...(s.theme || {}), ...(s.theme && !s.theme.page ? { page: s.theme.surface || DEFAULTS.theme.page } : {}) }, keys: { ...DEFAULT_KEYS, ...(s.keys || {}) } };
  settings.wallpaper.preset = { orbit: 'stars', grid: 'dots' }[settings.wallpaper.preset] || settings.wallpaper.preset; // the orbit and follow-theme backgrounds are gone, the grid became dots
  if (!['', 'stars', 'glow', 'dots'].includes(settings.wallpaper.preset)) settings.wallpaper.preset = 'stars';
  if (settings.wallpaper.mode === 'theme') settings.wallpaper.mode = 'preset';
  if (!s.budgetV2 && s.budget) { const old = s.budget.ramMB; settings.budget.ramMB = { 1024: 800, 2048: 1500, 4096: 3000 }[old] || Math.max(400, Math.round((old || 2048) * 0.75 / 50) * 50); } // limits now count real (private) memory, which is smaller than the old figure
  settings.budgetV2 = true;
  if (!s.layoutV2) settings.layout = 'top'; // the default is now tabs on top, address bar in the middle; switch back in Settings > Layout
  settings.layoutV2 = true;
  settings.profiles = profiles.cleanProfiles(s.profiles, s.userName); delete settings.userName; // the old user name is the name of the first profile now
  settings.purge = Array.isArray(s.purge) ? s.purge.filter((id) => profiles.idOk(id)) : [];
  if (!s.keysV3) { // keys that are standard in other browsers, added once to the lists an older Nova saved
    const more = { go: ['Alt+D', 'F6'], closeTab: ['Ctrl+F4'], zoomIn: ['Ctrl+WheelUp'], zoomOut: ['Ctrl+WheelDown'], devtools: ['Ctrl+Shift+I'], back: ['Mouse4'], forward: ['Mouse5'] };
    for (const [a, extra] of Object.entries(more)) settings.keys[a] = [...new Set([...(settings.keys[a] || []), ...extra])];
  }
  settings.keysV3 = true;
  applyScheme();
}
const saveSettings = () => writeJson('settings.json', settings);
const runVersion = () => { try { return updater.version || app.getVersion(); } catch { return app.getVersion(); } };
// The window icon must be a real file: Windows reads it by path, and a file that carries the version in its name never meets an old picture in the icon cache.
let iconFile = null;
function appIcon() {
  if (iconFile) return iconFile;
  const src = path.join(__dirname, 'build', 'icon.ico');
  try {
    const dir = userFile('icons'), f = path.join(dir, `nova-${runVersion()}.ico`);
    if (!fs.existsSync(f)) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(f, fs.readFileSync(src)); // reading through app.asar, writing a plain file
      const old = fs.readdirSync(dir).map((n) => ({ n, t: fs.statSync(path.join(dir, n)).mtimeMs })).sort((a, b) => b.t - a.t).slice(3); // the shortcuts of the last versions may still point at an older one
      for (const o of old) { try { fs.rmSync(path.join(dir, o.n), { force: true }); } catch { /* in use */ } }
    }
    return (iconFile = f);
  } catch (e) { dlog('icon file: ' + e.message); return src; }
}
// Nova's own shortcuts (Start menu, desktop, taskbar) get that icon file and the new identity, once per version
function repairShortcuts() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  const key = runVersion() + '|' + AUMID;
  if (settings.shortcutsFixed === key) return;
  const ico = appIcon(), exe = process.execPath.toLowerCase(), links = [path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Nova.lnk'), path.join(app.getPath('desktop'), 'Nova.lnk')];
  try { const pinned = path.join(process.env.APPDATA || '', 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar'); for (const f of fs.existsSync(pinned) ? fs.readdirSync(pinned) : []) if (/^nova.*\.lnk$/i.test(f)) links.push(path.join(pinned, f)); } catch { /* no taskbar folder */ }
  let n = 0;
  for (const l of links) {
    try {
      if (!fs.existsSync(l) || String(shell.readShortcutLink(l).target).toLowerCase() !== exe) continue; // only the ones that start this Nova
      if (shell.writeShortcutLink(l, 'update', { icon: ico, iconIndex: 0, appUserModelId: AUMID })) n++;
    } catch (e) { dlog('shortcut repair: ' + e.message); }
  }
  settings.shortcutsFixed = key; saveSettings(); dlog(`shortcuts repaired: ${n}`);
  if (n) execFile('ie4uinit.exe', ['-show'], { windowsHide: true }, () => {});
}

// ---------- helpers ----------
// "yt cats": the first word is a keyword of the list in settings.searchKeywords and the rest is what to look for there
let kwSeen = null, kwList = [];
function keywordUrl(t) {
  const m = /^(\S+)\s+(.+)$/s.exec(t); if (!m) return '';
  if (kwSeen !== settings.searchKeywords) { kwSeen = settings.searchKeywords; const text = kwSeen; const list = String(text || '').split(/\r?\n/).map((l) => l.trim().match(/^(\S+)\s+(https?:\/\/\S*%s\S*)(?:\s+(.+))?$/i)).filter(Boolean).map((m) => ({ k: m[1].toLowerCase(), url: m[2], name: (m[3] || '').trim() || m[2].replace(/^https?:\/\/(www\.)?/i, '').split(/[/?#]/)[0] })); kwList = list; }
  const e = kwList.find((x) => x.k === m[1].toLowerCase());
  return e ? e.url.replace('%s', encodeURIComponent(m[2].trim())) : '';
}
function normalizeInput(text) {
  const t = text.trim();
  if (/^nova:\/\/home/i.test(t)) return HOME;
  if (!t) return HOME;
  if (/^(https?|file|about|chrome|chrome-extension|devtools):/i.test(t)) return t;
  if (!/\s/.test(t) && (/^localhost(:\d+)?(\/|$)/i.test(t) || /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/|$)/.test(t) || /^[^\s/]+\.[a-z]{2,}(:\d+)?([/?#]|$)/i.test(t))) return 'https://' + t;
  return keywordUrl(t) || settings.searchEngine.replace('%s', encodeURIComponent(t));
}
const activeSpace = () => state.spaces.find((s) => s.id === state.activeSpace) || state.spaces[0];
const activeTab = () => tabs.get(state.activeTab);

// ---------- profiles: a profile owns its spaces and its session; a window shows the profile of its active space ----------
// Logins, cookies and the page cache live in the session of the profile (sessionFor). A space belongs to one profile, a tab to its space, so a tab's profile
// (t.pid) comes from its space, and every way of changing the active space (a tab, a restore, a move) also changes the profile consistently.
// The interface only gets the spaces, tabs and closed tabs of the profile its window shows.
const spaceProfile = (spaceId) => { const sp = state.spaces.find((s) => s.id === spaceId); return sp && settings.profiles.some((p) => p.id === sp.profile) ? sp.profile : settings.profiles[0].id; };
const curProfile = () => spaceProfile(state.activeSpace);
const profSpaces = (pid = curProfile()) => state.spaces.filter((s) => spaceProfile(s.id) === pid);
const inProfile = (spaceId, pid = curProfile()) => spaceProfile(spaceId) === pid;
function spaceFor(o) { // the space a new tab goes to: the one asked for, else the first space of the profile asked for, else the one this window is in
  if (o.spaceId != null && state.spaces.some((s) => s.id === o.spaceId)) return o.spaceId;
  if (o.profile && o.profile !== curProfile()) { const sp = profSpaces(o.profile)[0]; if (sp) return sp.id; }
  return state.activeSpace;
}

// ---------- windows: each one is a whole Nova (tab row, bars, settings); tabs, spaces, bookmarks and settings are shared ----------
// A window has a record W: its active tab, its space, its split view, what its interface shows. The module variables win, ui, overlayOpen ... always belong
// to the CURRENT window and useWin(W) switches them. Every event names its window (a message from an interface comes from that interface, an event of a page
// from the window that shows the page), so the code below can go on speaking of "the window". state.activeTab, activeSpace, split and prevTab read and
// write the current window's record.
const wins = new Map(); // W.id -> W
let curW = null, nextWid = 1;
const firstW = () => wins.values().next().value;
const wOfUi = (wc) => { for (const W of wins.values()) if (!W.closed && !W.ui.webContents.isDestroyed() && W.ui.webContents === wc) return W; return null; };
function useWin(W) {
  if (!W || W === curW || W.closed) return;
  if (curW) Object.assign(curW, { overlayKind, overlayOpen, sidebarHidden, focusMode, pageFullscreen, uiLowered, lastBar, lastBarKey });
  curW = W;
  ({ win, ui, overlayKind, overlayOpen, sidebarHidden, focusMode, pageFullscreen, uiLowered, lastBar, lastBarKey } = W);
}
const useWinOf = (t) => { const W = t && wins.get(t.wid); if (W) useWin(W); };
function eachWin(fn) {
  const keep = curW;
  for (const W of [...wins.values()]) {
    if (W.closed || W.win.isDestroyed()) continue;
    useWin(W);
    try { fn(W); } catch (e) { dlog('window task: ' + ((e && e.stack) || e)); }
  }
  if (keep && !keep.closed) useWin(keep);
}
const layoutAll = () => eachWin(() => layout());
// A download started: for about a second the interface view is as large as the window, transparent and on top, so the chip that flies to the folder button can
// start where the pointer was. The page keeps the keyboard focus; the mouse cannot reach the page during that second.
function dlFlyStart() {
  try {
    if (!settings.effects) return;
    const c = screen.getCursorScreenPoint(), keep = curW;
    const W = [...wins.values()].find((x) => !x.closed && !x.win.isDestroyed() && !x.win.isMinimized() && inside(c, x.win.getContentBounds(), 0));
    if (!W) return;
    useWin(W);
    try {
      if (sidebarHidden || focusMode || pageFullscreen || overlayOpen || !ui || ui.webContents.isDestroyed()) return;
      const b = win.getContentBounds(), u = ui, pt = { x: Math.max(0, Math.min(b.width, c.x - b.x)), y: Math.max(0, Math.min(b.height, c.y - b.y)), full: true };
      W.flying = true; uiLowered = null; layout();
      clearTimeout(W.flyTimer);
      W.flyTimer = setTimeout(() => { // the chip has landed: the interface view goes back to its own place
        if (W.closed || W.win.isDestroyed()) return;
        const k = curW; W.flying = false; useWin(W); uiLowered = null; layout(); if (k && k !== W) useWin(k);
      }, 1050);
      setTimeout(() => { try { if (!u.webContents.isDestroyed()) u.webContents.send('dlfly', pt); } catch { /* closing */ } }, 60); // the view needs a moment to take its new size
    } finally { if (keep && keep !== W) useWin(keep); }
  } catch { /* only a little animation */ }
}
// "Maximized" is Nova's own: the window fills the work area of its screen and remembers the size it had. Windows' own maximize could not be undone from code
// here (unmaximize() changed nothing in the log, so a maximized window could never be pulled out of full size), and a normal window can always be moved and sized.
const sendMax = (W, v) => { try { if (!W.ui.webContents.isDestroyed()) W.ui.webContents.send('maximized', v); } catch { /* closing */ } };
function fillWindow(W) {
  const w = W.win; if (W.fill || w.isDestroyed() || w.isFullScreen()) return;
  const normal = w.getBounds(), rect = screen.getDisplayMatching(normal).workArea;
  W.fill = { normal, rect };
  // measured on this PC (GetWindowRect and DWMWA_EXTENDED_FRAME_BOUNDS of a frameless window): Windows draws a 1 px border outside the page area on the left, right and bottom, so a window given the work area spilled onto the monitors beside it.
  // The page area is one pixel narrower on each side and one pixel higher, so the visible frame is exactly the work area; the top row hides above the screen.
  w.setBounds({ x: rect.x + 1, y: rect.y - 1, width: rect.width - 2, height: rect.height }); sendMax(W, true);
}
function unfillWindow(W) {
  if (!W.fill) return;
  const { normal } = W.fill; W.fill = null;
  W.win.setBounds(normal); sendMax(W, false);
}
const anyOverlay = () => { for (const W of wins.values()) if (W === curW ? overlayOpen : W.overlayOpen) return true; return false; };
const shown = (t) => { for (const W of wins.values()) if (W.activeTab === t.id || W.split === t.id) return true; return false; }; // on screen in some window
const allVisibleIds = () => { const ids = []; for (const W of wins.values()) { if (W.activeTab != null) ids.push(W.activeTab); if (W.split != null) ids.push(W.split); } return ids; };
function bindState(st) { for (const k of ['activeTab', 'activeSpace', 'split', 'prevTab']) Object.defineProperty(st, k, { enumerable: true, configurable: true, get: () => (curW ? curW[k] : null), set: (v) => { if (curW) curW[k] = v; } }); }

// ---------- layout ----------
// Windows draws a 1 px border around the window: in the colour of the tab strip (or of the sidebar) it disappears into the interface
function borderColor() {
  const bg = /^#[0-9a-f]{6}$/i.test(settings.theme.bg) ? settings.theme.bg : '#0b0b12';
  if (settings.layout !== 'top') return bg;
  const n = parseInt(bg.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255], p = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 > 0.5 ? 0.09 : 0.44; // as --strip in ui.css
  return '#' + c.map((v) => Math.round(v * (1 - p)).toString(16).padStart(2, '0')).join('');
}
const barHeight = () => (settings.layout === 'top' && settings.bookmarksBar && features.bookmarks(curProfile()).length ? 32 : 0);
let lastBar = 0;
let uiLowered = null; // tabs on the left: the interface view spans the whole window but sits BEHIND the pages, so the window buttons in its top strip show above them
const STRIP = 32;
function layout() {
  if (!win) return;
  const [w, h] = win.getContentSize();
  const gap = settings.gap;
  const side = settings.compact ? 56 : settings.sidebarWidth;
  const top = 88 + barHeight(); // top layout: tab strip (36) + toolbar (52) + the bookmarks row (32) when there are bookmarks
  const hidden = sidebarHidden || focusMode || pageFullscreen;
  let uiRect = { x: 0, y: 0, width: 0, height: 0 }, c;
  if (hidden) c = { x: 0, y: 0, width: w, height: h };
  else if (settings.layout === 'top') { uiRect = { x: 0, y: 0, width: w, height: top }; c = { x: gap, y: top, width: w - gap * 2, height: h - top - gap }; }
  else if (settings.layout === 'right') { uiRect = { x: w - side, y: 0, width: side, height: h }; c = { x: gap, y: gap, width: w - side - gap, height: h - gap * 2 }; }
  else { uiRect = { x: 0, y: 0, width: w, height: h }; c = { x: side, y: STRIP, width: w - side - gap, height: h - STRIP - gap }; }
  const fly = !!curW.flying; // a download chip is on its way: the (transparent) interface view is as large as the window and on top
  ui.setBounds(overlayOpen || fly ? { x: 0, y: 0, width: w, height: h } : uiRect);
  ui.setVisible(overlayOpen || fly || !hidden);
  const low = !overlayOpen && !fly && !hidden && settings.layout !== 'top' && settings.layout !== 'right';
  if (low !== uiLowered) { uiLowered = low; if (low) win.contentView.addChildView(ui, 0); else win.contentView.addChildView(ui); }
  const vis = visibleTabs();
  const gapIn = vis.length > 1 ? 6 : 0;
  vis.forEach((t, i) => {
    const each = Math.floor((c.width - gapIn) / vis.length);
    t.view.setBounds({ x: c.x + i * (each + gapIn), y: c.y, width: each, height: c.height });
    try { const r = hidden ? 0 : settings.radius; if (t.radius !== r) { t.view.setBorderRadius(r); t.radius = r; } } catch { /* view is going away */ } // only when the value really changes
  });
  win.setBackgroundColor(settings.theme.bg);
  { const ac = borderColor(); if (curW.accent !== ac) { curW.accent = ac; try { win.setAccentColor(ac); } catch { /* older Windows: no border colour */ } } }
  features.relayoutPeek();
  passwords.relayout();
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
  const vis = visibleTabs();
  for (const t of tabs.values()) if (t.wid === curW.id && t.view && t.attached && !vis.includes(t)) { win.contentView.removeChildView(t.view); t.attached = false; }
  for (const t of vis) if (!t.attached) { win.contentView.addChildView(t.view); t.attached = true; }
  uiLowered = null; // the new page view went on top: layout() puts the interface back where it belongs
  layout();
}

// ---------- state push ----------
let pushTimer = null;
function push() {
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    eachWin(() => {
      if (!ui || ui.webContents.isDestroyed()) return;
      const bh = barHeight(); if (bh !== lastBar) { lastBar = bh; layout(); } // the bookmarks bar appears with the first bookmark
      ui.webContents.send('state', publicState(false));
    });
    persistSoon();
  }, 50);
}
let lastBarKey = '';
function barForState(full) {
  const bar = settings.bookmarksBar ? features.barBookmarks(curProfile()) : [];
  const key = bar.map((b) => `${b.url}\u0001${b.title}\u0001${b.icon ? b.icon.length : 0}`).join('\u0002');
  if (!full && key === lastBarKey) return null; // unchanged: the interface keeps the one it has
  lastBarKey = key; return bar;
}
// parts of the state that rarely change (settings, extension icons, the archive) travel only when they did; null tells the interface to keep the copy it has
function partOf(name, key, make, full) {
  const K = curW.sent || (curW.sent = {});
  if (!full && K[name] === key) return null;
  K[name] = key; return make();
}
function extForState(full) {
  let list = []; try { list = features.listExtensions(); } catch { /* not ready */ }
  return partOf('extensions', list.map((e) => [e.id, e.name, e.version, e.popup, e.icon ? e.icon.length : 0].join()).join('|'), () => list, full);
}
function publicState(full = true) {
  const pid = curProfile();
  return {
    tabs: [...tabs.values()].filter((t) => t.wid === curW.id && t.pid === pid).map((t) => ({ id: t.id, spaceId: t.spaceId, url: t.url, title: t.title, favicon: t.favicon, pinned: t.pinned, asleep: !t.view, frozen: !!t.frozen, sleepAt: t.sleepAt || 0, loading: t.loading, audible: t.audible, lastActive: t.lastActive, canBack: t.canBack, canForward: t.canForward, muted: !!t.muted, dark: !!t.dark, darkSite: settings.features.darkSite && darkmode.isOnUrl(t.url), darkKey: settings.features.darkSite ? darkmode.keyOf(t.url) : '', private: !!t.private, group: t.group || '', bookmarked: features.isBookmarked(t.url, t.pid) })),
    extensions: extForState(full), snoozed: (state.snoozed || []).filter((x) => inProfile(x.spaceId, pid)).length,
    spaces: profSpaces(pid), groups: state.groups.filter((g) => inProfile(g.spaceId, pid)), profile: pid, activeSpace: state.activeSpace, activeTab: state.activeTab, split: state.split,
    windows: [...wins.values()].filter((W) => W !== curW && !W.closed).map((W) => ({ id: W.id, title: (tabs.get(W.activeTab) || {}).title || 'Nova window' })),
    archive: partOf('archive', pid + ':' + state.archive.length + ':' + (state.archive[0] ? state.archive[0].closedAt : 0), () => state.archive.filter((x) => inProfile(x.spaceId, pid)).slice(0, 80), full), bar: barForState(full), dl: features.downloadsLive(), dlInfo: features.dlInfo(), settings: partOf('settings', JSON.stringify(settings), () => settings, full), hidden: sidebarHidden || focusMode, focusMode, now: Date.now(),
    adblock: adblockStatus, blockedCount: blockedCount, budget: (() => { try { return budget.get(); } catch { return { used: 0, tabs: {}, cap: 0, enabled: false }; } })(), version: updater.version, updateReady: updater.hasPending(), update: updater.status(),
  };
}
let persistTimer = null;
function persistSoon() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 600);
}
let quitting = false; // Nova is ending: the tabs of every window were saved once, before the first window closed
function persist(final) {
  if (quitting && !final) return;
  { const used = new Set([...tabs.values()].map((t) => t.group)); state.groups = state.groups.filter((g) => used.has(g.id)); } // a group without tabs is gone
  const body = JSON.stringify({
    spaces: state.spaces, activeSpace: state.activeSpace, activeTab: state.activeTab, archive: state.archive.slice(0, 300), snoozed: state.snoozed || [], groups: state.groups,
    tabs: [...tabs.values()].filter((t) => !t.private).map((t) => ({ id: t.id, spaceId: t.spaceId, profile: t.pid, url: t.url, title: t.title, favicon: t.favicon, pinned: t.pinned, group: t.group, lastActive: t.lastActive })),
  });
  if (body === lastPersisted) return;
  lastPersisted = body;
  try { fs.writeFileSync(userFile('state.json'), body); } catch (e) { console.error(e); }
}
let lastPersisted = '';
let blockedCount = 0, blockTimer = null;

// ---------- tabs ----------
function newTabObj(o) {
  const id = o.id != null && !tabs.has(o.id) ? o.id : nextId++;
  nextId = Math.max(nextId, id + 1);
  const spaceId = state.spaces.some((s) => s.id === o.spaceId) ? o.spaceId : state.activeSpace;
  const t = { id, wid: o.wid || (curW ? curW.id : 0), spaceId, pid: spaceProfile(spaceId), url: o.url || HOME, title: o.title || (!o.url || o.url === HOME ? 'New tab' : ''), favicon: o.favicon || '', pinned: !!o.pinned, private: !!o.private, lastActive: o.lastActive || Date.now(), view: null, attached: false, loading: false, audible: false, canBack: false, canForward: false, thumb: '' };
  if (o.group && state.groups.some((g) => g.id === o.group)) t.group = o.group;
  tabs.set(t.id, t);
  return t;
}
function wake(t) {
  if (t.view) return;
  const pw = settings.budget.softWake ? sleeper.wakePayload(t) : null; // scroll, typed text and the last picture of the page, if Nova kept them
  const ses = sessionFor(t.pid, t.private); // the session of the tab's profile (its private one for private tabs)
  const view = new WebContentsView({ webPreferences: { ...(String(t.url).startsWith('chrome-extension:') ? { preload: extmgr.shimPath() } : pw ? { preload: path.join(__dirname, 'wake-preload.js') } : {}), session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false, nodeIntegrationInSubFrames: !!settings.features.darkSite, spellcheck: settings.profile !== 'ultra', autoplayPolicy: settings.blockAutoplay ? 'document-user-activation-required' : 'no-user-gesture-required' } });
  t.view = view; t.pendingWake = pw; t.frozen = false; t.mediaAt = 0;
  view.setBackgroundColor((pw && pw.bg) || settings.theme.page);
  const wc = view.webContents;
  const on = (ev, fn) => wc.on(ev, (...a) => { if (t.view !== view) return; useWinOf(t); return fn(...a); }); // the window that shows this page is the current one while its event runs; a page that went to sleep is ignored
  extbridge.watch(t);
  const upd = () => { if (wc.isDestroyed()) return; const u = wc.getURL(); t.url = isHome(u) ? HOME : u || t.url; if (t.url === HOME) t.title = 'New tab'; t.canBack = wc.navigationHistory.canGoBack(); t.canForward = wc.navigationHistory.canGoForward(); push(); };
  on('page-title-updated', (_e, title) => { t.title = isHome(t.url) ? 'New tab' : title; if (!isHome(t.url) && !t.private) features.recordVisit(wc.getURL(), title, t.pid, t.spaceId); push(); });
  on('page-favicon-updated', (_e, f) => { t.favicon = f[0] || ''; if (!t.private && settings.keepHistory) features.setIcon(wc.getURL(), f[0]); push(); });
  on('did-start-loading', () => { t.loading = true; push(); });
  on('render-process-gone', (_e, d) => { if (d.reason === 'clean-exit' || d.reason === 'killed') return; const now = Date.now(); if (now - (t.lastCrash || 0) < 30000) return; t.lastCrash = now; setTimeout(() => { if (!wc.isDestroyed()) wc.reload(); }, 400); });
  on('did-stop-loading', () => { t.loading = false; upd(); if (t.id === state.activeTab) setTimeout(() => capture(t), 1500); });
  on('did-navigate', () => { t.mediaAt = 0; upd(); applyZoom(wc); if (!t.private) features.recordVisit(wc.getURL(), wc.getTitle(), t.pid, t.spaceId); });
  on('did-navigate-in-page', upd);
  on('audio-state-changed', (e) => { t.audible = e.audible; if (e.audible) t.mediaAt = Date.now(); else t.audibleAt = Date.now(); features.onAudio(t); push(); });
  on('media-started-playing', () => { t.playing = true; t.mediaAt = Date.now(); });
  on('media-paused', () => { t.playing = false; });
  on('focus', () => { if (state.activeTab !== t.id && visibleTabs().includes(t)) activate(t.id, true); });
  on('zoom-changed', (_e, dir) => { if ((settings.keys[dir === 'in' ? 'zoomIn' : 'zoomOut'] || []).includes(dir === 'in' ? 'Ctrl+WheelUp' : 'Ctrl+WheelDown')) zoomStep(wc, dir === 'in' ? 1 : -1); }); // Ctrl + wheel, as in every browser
  on('before-input-event', (e, input) => handleKey(e, input));
  on('enter-html-full-screen', () => { pageFullscreen = true; win.setFullScreen(true); layout(); });
  on('leave-html-full-screen', () => { pageFullscreen = false; win.setFullScreen(false); layout(); });
  on('found-in-page', (_e, r) => ui.webContents.send('found', r));
  wc.setWindowOpenHandler(({ url, disposition, features }) => {
    useWinOf(t);
    // window.open(...) with a size is a login popup: it needs its opener, so it stays a real window
    if (disposition === 'new-window' && features) {
      const num = (k) => Number(new RegExp(k + '=(\\d+)').exec(features)?.[1]) || undefined;
      return { action: 'allow', overrideBrowserWindowOptions: { width: num('width') || 520, height: num('height') || 700, autoHideMenuBar: true, backgroundColor: settings.theme.bg, icon: appIcon(), webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } } };
    }
    const quiet = disposition === 'background-tab'; // middle click or ctrl+click on a link: it opens behind, you stay where you are
    const away = t.pid !== curProfile(); // a page of a profile that is not in front (it was left running) must not pull the window over to its profile
    openUrl(url, { background: quiet || away, forceNew: quiet, afterId: t.id, private: t.private, spaceId: t.spaceId }); // a link opens in the profile (and space) of the page it came from
    return { action: 'deny' };
  });
  on('context-menu', (_e, p) => contextMenu(wc, p));
  on('did-finish-load', () => {
    applyPageCss(wc); if (t.dark) features.applyDark(t);
    if (isHome(wc.getURL())) pushHome(wc);
    if (isHome(wc.getURL()) && !t.private) wc.executeJavaScript(`window.novaSites && window.novaSites(${JSON.stringify(settings.keepHistory ? features.topSites(8, t.pid) : [])})`).catch(() => {});
    if (isHome(wc.getURL())) { let b = { used: 0 }; try { b = budget.get(); } catch { /* not ready */ } wc.executeJavaScript(`window.novaStats && window.novaStats(${JSON.stringify({ used: b.used || 0, cap: settings.budget.enabled ? settings.budget.ramMB : 0, blocked: blockedCount || 0, asleep: [...tabs.values()].filter((x) => !x.view).length })})`).catch(() => {}); }
  });
  // the page loads once the identity is in place and the profile's extensions are loaded (waiting at most 3 s), so their content scripts meet the very first page
  const extsReady = sesReady.has(ses) ? new Promise((res) => { const to = setTimeout(res, 3000), done = () => { clearTimeout(to); res(); }; sesReady.get(ses).then(done, done); }) : null;
  Promise.all([persona.ready(wc), extsReady]).then(() => { if (!wc.isDestroyed()) wc.loadURL(isHome(t.url) ? homeUrl() : t.url).catch(() => {}); });
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
  return { bg: t.page, chrome: t.bg, accent: t.accent, text: t.text, dim: t.dim, wall: w.mode === 'none' ? '' : w.preset, dim_amount: w.dim, blur: w.blur, image: w.mode === 'image' ? wallImage() : '', stars: w.mode !== 'image', fx: !!settings.effects, prof: settings.profile, sites: settings.startPage.sites, greeting: settings.startPage.greeting, stats: settings.startPage.stats !== false };
}
function pushHome(wc) {
  const js = `window.novaTheme && window.novaTheme(${JSON.stringify(homeTheme())})`;
  const targets = wc ? [wc] : [...tabs.values()].filter((t) => t.view && isHome(t.url) && !t.view.webContents.isDestroyed()).map((t) => t.view.webContents);
  for (const w of targets) w.executeJavaScript(js).catch(() => {});
}
// Nova's whole colour set from the start-page picture: the hue that carries the image tints the surfaces and gives the accent.
function wallColors() {
  try {
    const img = nativeImage.createFromPath(userFile('wallpaper.jpg')); if (img.isEmpty()) return false;
    settings.theme = { ...settings.theme, ...wallpalette.paletteFromBitmap(img.resize({ width: 48 }).toBitmap()) };
    for (const x of tabs.values()) if (x.view && !x.view.webContents.isDestroyed()) x.view.setBackgroundColor(settings.theme.page);
    saveSettings(); layoutAll(); pushHome(); push(); return true;
  } catch (e) { console.error('wallColors', e.message); return false; }
}
function windowsAccent() { // the colour picked in Windows settings, applied as Nova's accent only
  try {
    const c = systemPreferences.getAccentColor(); if (!/^[0-9a-f]{6,8}$/i.test(c || '')) return false;
    settings.theme = { ...settings.theme, accent: '#' + c.slice(0, 6).toLowerCase() };
    saveSettings(); pushHome(); push(); return true;
  } catch { return false; }
}
async function pickWallpaper() {
  const r = await dialog.showOpenDialog(win, { title: 'Choose a wallpaper for the start page', properties: ['openFile'], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }] });
  if (r.canceled) return false;
  try {
    let img = nativeImage.createFromPath(r.filePaths[0]); if (img.isEmpty()) throw new Error('empty');
    const { width } = img.getSize(); if (width > 2560) img = img.resize({ width: 2560, quality: 'good' });
    fs.writeFileSync(userFile('wallpaper.jpg'), img.toJPEG(86)); wallData = null;
    settings.wallpaper = { ...settings.wallpaper, mode: 'image' }; saveSettings(); pushHome(); push(); if (settings.wallpaper.follow) wallColors(); return true;
  } catch (e) { toast('Could not use that image.'); return false; }
}
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
function applyZoom(wc) { const z = settings.zoom?.[hostOf(wc.getURL())]; if (z !== undefined) wc.setZoomLevel(z); }
function saveZoom(wc) { const h = hostOf(wc.getURL()); if (!h) return; settings.zoom = { ...settings.zoom, [h]: wc.getZoomLevel() }; saveSettings(); }
function applyPageCss(wc) { if (settings.pageCss && !wc.isDestroyed()) wc.insertCSS(settings.pageCss).catch(() => {}); }
function dominantColor(img) { // the page's own background: the most common colour of a tiny copy
  const bmp = img.resize({ width: 24 }).toBitmap(), bins = new Map();
  for (let i = 0; i + 3 < bmp.length; i += 4) { const k = ((bmp[i + 2] >> 4) << 8) | ((bmp[i + 1] >> 4) << 4) | (bmp[i] >> 4), b = bins.get(k) || [0, 0, 0, 0]; b[0]++; b[1] += bmp[i + 2]; b[2] += bmp[i + 1]; b[3] += bmp[i]; bins.set(k, b); }
  let best = null; for (const b of bins.values()) if (!best || b[0] > best[0]) best = b;
  return best ? '#' + [1, 2, 3].map((j) => Math.round(best[j] / best[0]).toString(16).padStart(2, '0')).join('') : '';
}
// A page must not be closed while a picture of it (capturePage) or a debugger session on it is still on its way: that races inside Chromium and took the whole
// browser down (crash dumps of 16 October: the promise of capturePage, DevToolsAgentHostImpl, both in CrBrowserMain). Such work is counted per page here, and
// closePage() closes the page only when the count is zero.
const nativeOps = new WeakMap();
function nat(wc, p) {
  nativeOps.set(wc, (nativeOps.get(wc) || 0) + 1);
  return Promise.resolve(p).finally(() => nativeOps.set(wc, Math.max(0, (nativeOps.get(wc) || 1) - 1)));
}
function closePage(wc) {
  const t0 = Date.now();
  const go = () => { try { if (wc.isDestroyed()) return; try { if (wc.debugger.isAttached()) wc.debugger.detach(); } catch { /* closing */ } wc.close(); } catch { /* gone */ } };
  const wait = () => {
    if (!(nativeOps.get(wc) > 0)) return go();
    if (Date.now() - t0 > 5000) { dlog('page closed with native work still pending'); return go(); }
    setTimeout(wait, 40);
  };
  wait();
}
async function capture(t) {
  const thumbs = settings.thumbnails, ghost = settings.budget.softWake && !isHome(t.url);
  if (!thumbs && !ghost) return;
  if (!t.view || !t.attached || t.view.webContents.isDestroyed()) return;
  const W = wins.get(t.wid); if (!W || W.closed || W.win.isDestroyed() || W.win.isMinimized() || !W.win.isVisible()) return;
  try {
    const img = await nat(t.view.webContents, t.view.webContents.capturePage());
    if (img.isEmpty()) { if (ghost) t.ghost = ''; return; } // no picture is better than one of a different scroll position
    if (thumbs) t.thumb = 'data:image/jpeg;base64,' + img.resize({ width: 360 }).toJPEG(55).toString('base64');
    if (ghost) { t.ghost = 'data:image/jpeg;base64,' + (img.getSize().width > 960 ? img.resize({ width: 960 }) : img).toJPEG(60).toString('base64'); t.ghostBg = dominantColor(img); }
  } catch { if (ghost) t.ghost = ''; }
}
function sleep(t) {
  if (!t.view) return;
  extbridge.removed(t);
  sleeper.missed(t);
  if (t.attached) { const W = wins.get(t.wid); try { (W ? W.win : win).contentView.removeChildView(t.view); } catch { /* its window is gone */ } t.attached = false; }
  const wc = t.view.webContents;
  t.url = wc.isDestroyed() ? t.url : (isHome(wc.getURL()) ? HOME : wc.getURL() || t.url);
  if (!wc.isDestroyed()) closePage(wc);
  t.view = null; t.audible = false; t.loading = false; t.darkKey = null; t.muted = false; t.frozen = false; t.pendingWake = null;
}
function prewake(id) { // resting the pointer on a sleeping tab's row loads it in the background, so the click finds it ready
  const t = tabs.get(id);
  if (!t || t.view || !settings.budget.softWake || shown(t)) return;
  try { if (budget.get().over) return; } catch {}
  if ([...tabs.values()].filter((x) => x.view && !x.attached && x.warmAt && Date.now() - x.warmAt < 30000).length >= 2) return;
  t.warmAt = Date.now(); wake(t); push();
}
function destroyTab(t) { sleeper.missed(t); sleep(t); tabs.delete(t.id); }

function activate(id, fromFocus) {
  const t = tabs.get(id);
  if (!t) return;
  if (!wins.has(t.wid)) t.wid = curW.id;
  else if (t.wid !== curW.id) { useWinOf(t); try { win.show(); win.focus(); } catch { /* closing */ } } // a tab of another window: go there
  if (overlayOpen && (overlayKind === 'settings' || overlayKind === 'hub') && !fromFocus && id !== state.activeTab) closeOverlay(); // settings sit beside the browser: choosing a page leaves them
  const prev = activeTab();
  if (prev && prev !== t) state.prevTab = prev.id;
  if (prev && prev !== t) { features.onLeave(prev); capture(prev); prev.lastActive = Date.now(); sleeper.left(prev); }
  if (t.spaceId !== state.activeSpace) state.activeSpace = t.spaceId;
  state.activeTab = id;
  { const g = t.group && state.groups.find((x) => x.id === t.group); if (g && g.collapsed) g.collapsed = false; } // opening a tab of a folded group unfolds it
  if (prev !== t) sleeper.arrived(t);
  t.lastActive = Date.now();
  if (state.split && (state.split === id || tabs.get(state.split)?.spaceId !== t.spaceId)) state.split = null;
  wake(t);
  if (prev !== t) { extbridge.activated(t); features.onArrive(t); }
  if (t.frozen) sleeper.thaw(t);
  sync();
  if (!fromFocus && !overlayOpen) t.view.webContents.focus();
  push();
}
function openUrl(url, o = {}) {
  url = normalizeInput(url);
  const spaceId = spaceFor(o), pid = spaceProfile(spaceId);
  if (settings.dedupeTabs && !isHome(url)) {
    const same = [...tabs.values()].find((t) => t.url === url && !o.forceNew && !t.private && t.pid === pid); // the same page in another profile is another login, not a duplicate
    if (same) { if (!o.background) activate(same.id); return same; }
  }
  const t = newTabObj({ url, spaceId, private: o.private });
  if (o.afterId) { /* order is by map insertion; move after reference */ reorderAfter(t.id, o.afterId); const op = tabs.get(o.afterId); if (op && op.group && op.spaceId === t.spaceId) t.group = op.group; } // a link opened from a grouped tab joins its group
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
  useWinOf(t); // the window that shows this tab is the one that changes
  const mine = () => [...tabs.values()].filter((x) => x.wid === curW.id);
  const list = mine().filter((x) => x.spaceId === t.spaceId);
  const idx = list.indexOf(t);
  const wasActive = state.activeTab === id;
  if (state.split === id) state.split = null;
  destroyTab(t);
  if (t.private && ![...tabs.values()].some((x) => x.private && x.pid === t.pid)) { const ps = profSes.get(t.pid + '!'); if (ps) ps.clearStorageData().catch(() => {}); } // last private tab of this profile gone: forget everything
  if (!mine().length) {
    state.activeTab = null; state.split = null;
    if (wins.size > 1) { const W = curW; setTimeout(() => { try { if (!W.closed) W.win.close(); } catch { /* gone */ } }, 0); push(); return; } // the last tab of a second window: the window goes with it
    const n = newTabObj({ spaceId: state.spaces.some((sp) => sp.id === t.spaceId) ? t.spaceId : state.activeSpace }); activate(n.id); push(); return; // the last tab closed: back to the start page, the browser stays open (the window's own close button still quits)
  }
  if (wasActive) {
    const rest = mine().filter((x) => x.spaceId === t.spaceId);
    const next = rest[Math.min(idx, rest.length - 1)] || null;
    if (next) activate(next.id);
    else { state.activeTab = null; const n = newTabObj({ spaceId: t.spaceId }); activate(n.id); }
  }
  push();
}
function enforceLimit(keepId) {
  const max = settings.maxTabs;
  if (!max) return;
  const open = [...tabs.values()].filter((t) => !t.pinned && t.id !== keepId && !shown(t));
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
      if (seen.has(t.url) && !isHome(t.url) && !shown(t)) { closeTab(t.id); n++; } else if (!seen.has(t.url)) seen.set(t.url, t);
    }
  } else {
    const idleMs = mode === 'hour' ? 3600e3 : mode === 'day' ? 86400e3 : 0;
    for (const t of [...tabs.values()]) {
      if (t.pinned || shown(t)) continue;
      if (now - t.lastActive >= idleMs) { archiveTab(t); n++; }
    }
  }
  toast(n ? `Cleaned up ${n} tab(s). They're in the archive (Ctrl+K).` : 'Nothing to clean up.');
  push();
}
function toast(msg) { if (ui && !ui.webContents.isDestroyed()) ui.webContents.send('toast', msg); }

// idle policy: archive after Y h (putting tabs to sleep is sleeper.js: it freezes, then discards after the idle delay)
function idlePolicy() {
  const now = Date.now();
  for (const t of [...tabs.values()]) {
    if (shown(t) || t.audible) continue;
    const idle = now - t.lastActive;
    if (!t.pinned && settings.archiveAfterHours > 0 && idle > settings.archiveAfterHours * 3600e3) { archiveTab(t); continue; }
  }
}

// ---------- more windows: Ctrl+N, "Move to new window", or drag a tab off the tab row ----------
// A new window is a whole Nova: the same tab row, bars, settings and shortcuts. A tab keeps its session, history and scroll when it moves.
// The last tab of a second window closes the window; closing a window puts its tabs into the archive (Ctrl+K); closing the last window ends Nova.
function createWindow(o = {}) {
  const W = { id: nextWid++, closed: false, activeTab: null, activeSpace: state.spaces.some((sp) => sp.id === o.activeSpace) ? o.activeSpace : state.spaces[0].id, split: null, prevTab: null, overlayKind: '', overlayOpen: false, sidebarHidden: false, focusMode: false, pageFullscreen: false, uiLowered: null, lastBar: 0, lastBarKey: '', fill: null };
  const b = { width: o.width || 1360, height: o.height || 860 };
  if (o.x != null && o.y != null) { b.x = Math.round(o.x); b.y = Math.round(o.y); }
  W.win = new BaseWindow({ ...b, minWidth: 640, minHeight: 420, frame: false, backgroundColor: settings.theme.bg, title: 'Nova', icon: appIcon() });
  if (b.x != null) W.win.setBounds(b); // once more: on a screen with another scaling the size given at creation can come out different
  W.ui = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true } });
  W.ui.setBackgroundColor('#00000000');
  W.win.contentView.addChildView(W.ui);
  wins.set(W.id, W);
  const wc = W.ui.webContents;
  wc.on('before-input-event', (e, i) => { useWin(W); handleKey(e, i); });
  wc.loadFile(path.join(__dirname, 'ui', 'index.html'));
  W.win.on('resize', () => {
    if (W.closed) return;
    useWin(W);
    if (W.fill) { const r = W.win.getBounds(); if (Math.abs(r.width - W.fill.rect.width) > 8 || Math.abs(r.height - W.fill.rect.height) > 8) { W.fill = null; sendMax(W, false); } } // sized by hand: no longer "maximized"
    layout();
  });
  W.win.on('maximize', () => { if (!wc.isDestroyed()) wc.send('maximized', true); });
  W.win.on('unmaximize', () => { if (!wc.isDestroyed()) wc.send('maximized', false); });
  W.win.on('app-command', (e, cmd) => { // the side buttons of a mouse
    const k = { 'browser-backward': 'Mouse4', 'browser-forward': 'Mouse5' }[cmd];
    if (!k || keysPaused) return;
    useWin(W); if (runKeyed(k)) e.preventDefault();
  });
  W.win.on('focus', () => useWin(W)); // the window you work in is the current one for everything that has no window of its own
  W.win.on('closed', () => windowClosed(W));
  useWin(W);
  if (o.maximize) fillWindow(W);
  return W;
}
function windowClosed(W) {
  W.closed = true;
  if (quitting) { wins.delete(W.id); return; } // every window closes in turn when Nova ends: nothing is archived or saved again
  if (wins.size <= 1) { persist(); clearTimeout(persistTimer); wins.delete(W.id); app.quit(); return; } // the last window: Nova ends and the tabs stay saved
  wins.delete(W.id);
  if (curW === W) { curW = null; useWin(firstW()); }
  for (const t of [...tabs.values()]) {
    if (t.wid !== W.id) continue;
    t.attached = false; // the page views went with their window
    if (t.url && !isHome(t.url) && !t.private) state.archive.unshift({ url: t.url, title: t.title, favicon: t.favicon, spaceId: t.spaceId, closedAt: Date.now() });
    destroyTab(t);
  }
  state.archive = state.archive.slice(0, 300);
  persist(); push();
}
// a tab moves to another window: the page view is handed over as it is
function transferTab(t, to) {
  const from = wins.get(t.wid);
  if (!from || from === to || to.closed) return;
  useWin(from);
  const mine = [...tabs.values()].filter((x) => x.wid === from.id), same = mine.filter((x) => x.spaceId === t.spaceId), idx = same.indexOf(t), wasActive = state.activeTab === t.id;
  if (state.split === t.id) state.split = null;
  if (t.attached && t.view) { try { from.win.contentView.removeChildView(t.view); } catch { /* gone */ } }
  t.attached = false; t.wid = to.id;
  const rest = mine.filter((x) => x !== t);
  if (wasActive) state.activeTab = null; // it is not this window's page any more: nothing to "leave"
  if (wasActive && rest.length) { const inSpace = rest.filter((x) => x.spaceId === t.spaceId), next = inSpace[Math.min(idx, inSpace.length - 1)] || rest[0]; activate(next.id); }
  if (!rest.length) setTimeout(() => { try { if (!from.closed) from.win.close(); } catch { /* gone */ } }, 0); // nothing left in the window it came from
  useWin(to);
  state.activeSpace = t.spaceId;
  activate(t.id);
  try { to.win.show(); to.win.focus(); } catch { /* closing */ }
  push();
}
const inside = (p, b, m = 4) => p.x >= b.x - m && p.x <= b.x + b.width + m && p.y >= b.y - m && p.y <= b.y + b.height + m;
function detachTab(id, force) {
  const t = tabs.get(id); if (!t) return;
  useWinOf(t);
  const cur = screen.getCursorScreenPoint(), b = win.getBounds();
  if (!force) {
    if (inside(cur, b)) return; // let go inside this window: nothing to do
    for (const W of wins.values()) if (W !== curW && !W.closed && !W.win.isDestroyed() && inside(cur, W.win.getBounds(), 0)) return transferTab(t, W); // let go over another Nova window: the tab joins it
  }
  if ([...tabs.values()].filter((x) => x.wid === curW.id).length < 2) return toast('That is the only tab of this window.');
  const nb = curW.fill ? curW.fill.normal : win.getNormalBounds(), wa = screen.getDisplayNearestPoint(force ? { x: b.x + 40, y: b.y + 40 } : cur).workArea;
  const w = Math.min(nb.width > 0 ? nb.width : 1360, wa.width - 40), h = Math.min(nb.height > 0 ? nb.height : 860, wa.height - 40);
  const x = force ? b.x + 40 : cur.x - 130, y = force ? b.y + 40 : cur.y - 18;
  const W = createWindow({ x: Math.max(wa.x, Math.min(x, wa.x + wa.width - w)), y: Math.max(wa.y, Math.min(y, wa.y + wa.height - h)), width: w, height: h, activeSpace: t.spaceId });
  transferTab(t, W);
}
function newWindow(url) {
  const max = !!curW.fill || win.isMaximized(), b = curW.fill ? curW.fill.normal : win.getBounds(), wa = screen.getDisplayMatching(b).workArea;
  const o = { width: b.width, height: b.height, maximize: max, activeSpace: state.activeSpace };
  if (!max) { o.x = Math.max(wa.x, Math.min(b.x + 36, wa.x + wa.width - b.width)); o.y = Math.max(wa.y, Math.min(b.y + 36, wa.y + wa.height - b.height)); }
  createWindow(o);
  const t = newTabObj({ url: url || undefined }); activate(t.id);
}

// ---------- what's new: the first start after an update shows the notes of what came with it ----------
const semNewer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
function whatsNew() {
  try {
    const version = updater.version, seen = settings.seenVersion;
    if (seen === version) return;
    settings.seenVersion = version; saveSettings();
    const log = JSON.parse(fs.readFileSync(path.join(__dirname, 'changelog.json'), 'utf8'));
    const entries = (seen ? log.filter((e) => semNewer(e.version, seen) && !semNewer(e.version, version)) : log.filter((e) => e.version === version)).slice(0, 3);
    if (!entries.length) return; // a development run, or a version without notes
    setTimeout(() => { if (!overlayOpen) openOverlay('whatsnew', { version, entries }); }, 900);
  } catch (e) { console.error('whatsnew', e.message); }
}

// ---------- window dragging ----------
let drag = null;
function startDrag() {
  endDrag();
  const w = win, W = curW, c0 = screen.getCursorScreenPoint(), full = w.isFullScreen(), big = full || !!W.fill || w.isMaximized(); // w: the window being dragged, whichever window is current when the timer runs
  let phase = 'wait'; // wait: the cursor has not moved yet; pull: leaving full size; follow: the window goes where the cursor goes
  drag = { w, W, started: Date.now(), timer: setInterval(() => {
    if (!drag) return;
    if (w.isDestroyed()) return endDrag();
    const c = screen.getCursorScreenPoint(), now = Date.now();
    if (phase === 'wait') {
      if (Math.hypot(c.x - c0.x, c.y - c0.y) < 4) return;
      drag.moved = true;
      const b = w.getBounds();
      if (!big) { drag.off = { x: c0.x - b.x, y: c0.y - b.y }; phase = 'follow'; }
      else { // pull the window out of full size and keep the grip under the cursor
        drag.grab = { rx: (c0.x - b.x) / Math.max(1, b.width), ry: Math.min(Math.max(0, c0.y - b.y), 40) }; drag.nb = W.fill ? W.fill.normal : w.getNormalBounds(); drag.fromFull = true; drag.pullAt = now; drag.lastCall = now; phase = 'pull';
        dlog(`drag: leaving ${full ? 'full screen' : W.fill ? 'maximized (Nova)' : 'maximized (Windows)'}`);
        if (full) w.setFullScreen(false); else if (!W.fill) w.unmaximize();
        return;
      }
    }
    if (phase === 'pull') {
      // leaving full screen takes a moment on Windows, and a window that was maximized before full screen comes back maximized: wait until it is really a normal window
      const waited = now - drag.pullAt;
      if (waited < 800) {
        if (w.isFullScreen()) return;
        if (w.isMaximized()) { if (now - drag.lastCall > 80) { drag.lastCall = now; w.unmaximize(); } return; }
      }
      const wa = screen.getDisplayNearestPoint(c).workArea, nb = drag.nb;
      if (W.fill) { W.fill = null; sendMax(W, false); }
      const ww = Math.min(nb.width > 0 ? nb.width : 1360, Math.round(wa.width * 0.82)), hh = Math.min(nb.height > 0 ? nb.height : 860, Math.round(wa.height * 0.82));
      w.setBounds({ x: Math.round(c.x - drag.grab.rx * ww), y: Math.round(c.y - drag.grab.ry), width: ww, height: hh });
      drag.off = { x: Math.round(drag.grab.rx * ww), y: Math.round(drag.grab.ry) }; drag.lx = c.x; drag.ly = c.y; phase = 'follow';
      dlog(`drag: normal window after ${waited} ms (${ww}x${hh}${w.isMaximized() ? ', still maximized by Windows, resizable ' + w.isResizable() + ', maximizable ' + w.isMaximizable() : ''})`);
      for (const ms of [90, 300]) setTimeout(() => { try { if (!w.isDestroyed() && !w.isFullScreen() && !w.isMaximized()) { const cur = w.getBounds(); if (cur.width !== ww || cur.height !== hh) w.setSize(ww, hh); } } catch { /* window closed */ } }, ms); // Windows may put the old size back a moment later
      return;
    }
    // only the position changes, never the size: moving between screens with different scaling must not resize or snap the window
    if (c.x !== drag.lx || c.y !== drag.ly) { drag.lx = c.x; drag.ly = c.y; w.setPosition(Math.round(c.x - drag.off.x), Math.round(c.y - drag.off.y)); }
    if (now - drag.started > 60000) endDrag();
  }, 10) };
}
function endDrag() {
  if (!drag) return;
  clearInterval(drag.timer);
  const w = drag.w, c = screen.getCursorScreenPoint(), wa = screen.getDisplayNearestPoint(c).workArea;
  if (!w.isDestroyed() && drag.moved && !drag.fromFull && c.y <= wa.y + 1) fillWindow(drag.W); // drop on the top edge to maximize; a window pulled out of full size stays small, full size is the user's own choice
  drag = null;
}

// ---------- overlay & keys ----------
function openOverlay(kind, data) {
  overlayOpen = true; overlayKind = kind; dlog('overlay ' + kind);
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
  const list = [...tabs.values()].filter((t) => t.spaceId === state.activeSpace && t.wid === curW.id);
  if (!list.length) return;
  const i = list.findIndex((t) => t.id === state.activeTab);
  activate(list[(i + dir + list.length) % list.length].id);
};
// Zoom in fixed steps like other browsers (25% .. 500%), remembered per site; a toast shows where it stands
const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
let lastZoomAt = 0, lastFind = '';
function zoomStep(wc, dir) {
  if (!wc || wc.isDestroyed()) return;
  const now = Date.now(); if (now - lastZoomAt < 70) return; lastZoomAt = now; // a wheel sends many events
  const f = wc.getZoomFactor(); let near = 0;
  ZOOMS.forEach((z, i) => { if (Math.abs(Math.log(z / f)) < Math.abs(Math.log(ZOOMS[near] / f))) near = i; });
  const i = Math.max(0, Math.min(ZOOMS.length - 1, near + dir));
  wc.setZoomFactor(ZOOMS[i]); saveZoom(wc); toast(`Zoom ${Math.round(ZOOMS[i] * 100)}%`);
}
// an action by the key, the mouse button or the wheel turn that is assigned to it ("Mouse4", "Alt+WheelUp")
function runKeyed(accel) {
  for (const [action, list] of Object.entries(settings.keys)) if (list.includes(accel)) { runAction(action); return true; }
  return false;
}
const wheelKeys = () => Object.entries(settings.keys).flatMap(([a, l]) => l.filter((k) => /Wheel(Up|Down|Left|Right)$/.test(k) && !((a === 'zoomIn' && k === 'Ctrl+WheelUp') || (a === 'zoomOut' && k === 'Ctrl+WheelDown'))));
function runAction(action, arg) {
  const t = activeTab();
  const wc = t?.view?.webContents;
  switch (action) {
    case 'newWindow': newWindow(); break;
    case 'newTab': if (settings.newTabPage === 'bar') openOverlay('palette', { mode: 'new', text: '' }); else { const nt = newTabObj({}); activate(nt.id); } break;
    case 'go': openOverlay('palette', { mode: 'go', text: t && !isHome(t.url) ? t.url : '', select: true }); break;
    case 'closeTab': if (t) closeTab(t.id); break;
    case 'reopenTab': { const i = state.archive.findIndex((x) => inProfile(x.spaceId)), a = i >= 0 ? state.archive.splice(i, 1)[0] : null; if (a) openUrl(a.url, { spaceId: a.spaceId, forceNew: true }); break; }
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
    case 'zoomIn': zoomStep(wc, 1); break;
    case 'zoomOut': zoomStep(wc, -1); break;
    case 'zoomReset': if (wc) { wc.setZoomLevel(0); saveZoom(wc); toast('Zoom 100%'); } break;
    case 'bookmark': if (overlayOpen && overlayKind === 'bookmark') { closeOverlay(); break; } if (features.handle('bookmarkAdd', {}, t)) { push(); openOverlay('bookmark'); } break;
    case 'history': openOverlay('library', { tab: 'History' }); break;
    case 'downloads': openOverlay('downloads'); break;
    case 'bookmarks': openOverlay('library', { tab: 'Bookmarks' }); break;
    case 'hub': openOverlay('hub'); break;
    case 'screenshot': features.handle('screenshot', {}, t); break;
    case 'privateTab': features.handle('newPrivate', {}, t); break;
    case 'print': wc?.print(); break;
    case 'fullscreen': win.setFullScreen(!win.isFullScreen()); break;
    case 'lastTab': if (state.prevTab && tabs.has(state.prevTab)) activate(state.prevTab); break;
    case 'copyClean': features.handle('copyClean', {}, t); break;
    case 'darkPage': features.handle('darkPage', {}, t); break;
    case 'darkSite': if (settings.features.darkSite) darkmode.toggle(t); break;
    case 'devtools': wc?.toggleDevTools(); break;
    case 'pinTab': if (t) { t.pinned = !t.pinned; push(); } break;
    case 'cleanUp': openOverlay('overview'); break;
    case 'hardReload': wc?.reloadIgnoringCache(); break;
    case 'viewSource': if (t && /^https?:/i.test(t.url)) openUrl('view-source:' + t.url, { forceNew: true }); break;
    case 'clearData': openOverlay('library', { tab: 'Clear data' }); break;
    case 'findNext': case 'findPrev': if (wc) { if (!lastFind) openOverlay('palette', { mode: 'find', text: '' }); else wc.findInPage(lastFind, { forward: action === 'findNext', findNext: true }); } break;
    case 'homePage': if (t && t.view) { t.view.webContents.loadURL(homeUrl()).catch(() => {}); push(); } break;
    case 'bookmarksBarToggle': settings.bookmarksBar = !settings.bookmarksBar; saveSettings(); layoutAll(); push(); break;
    case 'closeWindow': win.close(); break;
    case 'savePage': if (wc && t) dialog.showSaveDialog(win, { title: 'Save page', defaultPath: (t.title || 'page').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) + '.html', filters: [{ name: 'Web page', extensions: ['html'] }] }).then((r) => { if (!r.canceled && r.filePath && !wc.isDestroyed()) wc.savePage(r.filePath, 'HTMLComplete').catch(() => toast('Nova could not save the page.')); }); break;
    case 'moveTabLeft': case 'moveTabRight': if (t) { const own = [...tabs.values()].filter((x) => x.wid === curW.id && x.spaceId === t.spaceId && !x.pinned === !t.pinned), i = own.indexOf(t), nb = own[i + (action === 'moveTabRight' ? 1 : -1)]; if (nb) { const arr = [...tabs.entries()], from = arr.findIndex(([k]) => k === t.id), [item] = arr.splice(from, 1), to = arr.findIndex(([k]) => k === nb.id); arr.splice(action === 'moveTabRight' ? to + 1 : to, 0, item); tabs.clear(); arr.forEach(([k, v]) => tabs.set(k, v)); push(); } } break;
    case 'tabLast': { const own = [...tabs.values()].filter((x) => x.wid === curW.id && x.spaceId === state.activeSpace); if (own.length) activate(own[own.length - 1].id); } break;
    default:
      if (/^tab[1-8]$/.test(action)) { const own = [...tabs.values()].filter((x) => x.wid === curW.id && x.spaceId === state.activeSpace), n = own[+action.slice(3) - 1]; if (n) activate(n.id); } else
      if (/^space\d$/.test(action)) { const s = profSpaces()[+action.slice(5) - 1]; if (s) switchSpace(s.id); }
  }
}
function switchSpace(id) {
  state.activeSpace = id;
  const t = [...tabs.values()].filter((x) => x.spaceId === id && x.wid === curW.id).sort((a, b) => b.lastActive - a.lastActive)[0] || newTabObj({ spaceId: id });
  activate(t.id);
}
// profile commands (the profile menu): switching goes to the profile's space where this window was last, else its first space
function switchProfile(pid) {
  if (!settings.profiles.some((p) => p.id === pid) || pid === curProfile()) return;
  let sp = profSpaces(pid);
  if (!sp.length) { const id = Math.max(...state.spaces.map((s) => s.id)) + 1, p = profileOfId(pid); state.spaces.push({ id, name: p.name, color: p.color, profile: pid }); sp = profSpaces(pid); }
  const last = [...tabs.values()].filter((x) => x.wid === curW.id && x.pid === pid).sort((a, b) => b.lastActive - a.lastActive)[0];
  switchSpace(last ? last.spaceId : sp[0].id);
}
const profileOfId = (pid) => settings.profiles.find((p) => p.id === pid) || settings.profiles[0];
function addProfile(name, color) {
  if (settings.profiles.length >= 12) return toast('That is plenty of profiles. Delete one first.');
  const id = profiles.newId(settings.profiles.map((p) => p.id)), n = settings.profiles.length;
  const p = { id, name: profiles.cleanName(name, 'Profile ' + (n + 1)), color: profiles.colorOk(color) ? color : profiles.COLORS[n % profiles.COLORS.length] };
  settings.profiles.push(p);
  const sid = Math.max(...state.spaces.map((s) => s.id)) + 1;
  state.spaces.push({ id: sid, name: p.name, color: p.color, profile: id }); // every profile has at least one space; the first is named like the profile
  saveSettings(); dlog('profile added: ' + id);
  switchSpace(sid);
}
function renameProfile(pid, name, color) {
  const p = settings.profiles.find((x) => x.id === pid); if (!p) return;
  const was = p.name; p.name = profiles.cleanName(name, p.name); if (profiles.colorOk(color)) p.color = color;
  for (const sp of state.spaces) if (sp.profile === pid && sp.name === was) sp.name = p.name; // the space that was named like the profile follows its name
  saveSettings(); push();
}
// spaces are gone (a deleted space or profile): their tabs close, closed tabs of a deleted space stay restorable inside their profile, and every window that
// stood on one lands on another space of the same profile (or on the first profile)
function removeSpaces(ids, dropClosed) {
  const gone = new Set(ids), was = state.spaces.filter((s) => gone.has(s.id));
  for (const x of [...tabs.values()]) if (gone.has(x.spaceId)) destroyTab(x);
  state.spaces = state.spaces.filter((s) => !gone.has(s.id));
  const landing = (dead) => (settings.profiles.some((p) => p.id === dead.profile) && state.spaces.find((s) => s.profile === dead.profile)) || state.spaces[0];
  if (dropClosed) { state.archive = state.archive.filter((x) => !gone.has(x.spaceId)); state.snoozed = (state.snoozed || []).filter((x) => !gone.has(x.spaceId)); }
  else for (const list of [state.archive, state.snoozed || []]) for (const x of list) { const dead = was.find((s) => s.id === x.spaceId); if (dead) x.spaceId = landing(dead).id; }
  eachWin((W) => {
    if (W.closed) return;
    const dead = was.find((s) => s.id === state.activeSpace);
    if (dead) state.activeSpace = landing(dead).id;
    const mine = [...tabs.values()].filter((x) => x.wid === W.id);
    if (!mine.length) { if (wins.size > 1) setTimeout(() => { try { W.win.close(); } catch { /* gone */ } }, 0); else activate(newTabObj({}).id); }
    else if (dead) switchSpace(state.activeSpace);
    else if (!tabs.get(state.activeTab) || tabs.get(state.activeTab).wid !== W.id) { state.activeTab = null; activate((mine.find((x) => x.spaceId === state.activeSpace) || mine[0]).id); }
  });
  push();
}
// Deleting a profile removes everything it kept: its tabs and spaces, what its session stored, its history, bookmarks and passwords. The partition folder is a
// live session's, so it is removed at the next start (settings.purge). The first profile cannot be deleted: it holds the logins Nova had before profiles existed.
async function deleteProfile(pid) {
  if (pid === profiles.MAIN || !settings.profiles.some((p) => p.id === pid)) return;
  const ids = state.spaces.filter((s) => s.profile === pid).map((s) => s.id);
  settings.profiles = settings.profiles.filter((p) => p.id !== pid); // first: nothing can open in it any more
  removeSpaces(ids, true);
  for (const priv of [false, true]) {
    const key = pid + (priv ? '!' : ''), s = profSes.get(key); if (!s) continue;
    profSes.delete(key); sesInfo.delete(s); sesReady.delete(s); const i = sessions.indexOf(s); if (i >= 0) sessions.splice(i, 1);
    try { adblockDisable(s); } catch { /* not enabled */ }
    try { await s.clearStorageData(); await s.clearCache(); } catch (e) { dlog('profile wipe: ' + e.message); }
  }
  features.dropProfile(pid); passwords.dropProfile(pid);
  settings.purge = [...new Set([...settings.purge, pid])]; saveSettings(); dlog('profile deleted: ' + pid);
  push();
}
function contextMenu(wc, p) {
  const items = [];
  if (p.linkURL) items.push(...(settings.features.peek ? [{ label: 'Peek at link', click: () => features.handle('peek', { url: p.linkURL }) }] : []), { label: 'Open link in new tab', click: () => openUrl(p.linkURL, { background: true, forceNew: true }) }, ...(settings.features.cleanLinks ? [{ label: 'Copy link without trackers', click: () => clipboard.writeText(features.cleanUrl(p.linkURL)) }] : []), { label: 'Copy link', click: () => clipboard.writeText(p.linkURL) }, { type: 'separator' });
  if (p.mediaType === 'image') items.push({ label: 'Open image in new tab', click: () => openUrl(p.srcURL, { forceNew: true }) }, { label: 'Copy image', click: () => wc.copyImageAt(p.x, p.y) }, { type: 'separator' });
  if (p.isEditable) items.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, { type: 'separator' });
  else if (p.selectionText) items.push({ role: 'copy' }, { label: `Search "${p.selectionText.slice(0, 24)}"`, click: () => openUrl(settings.searchEngine.replace('%s', encodeURIComponent(p.selectionText)), { forceNew: true }) }, { type: 'separator' });
  items.push({ label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() }, { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() }, { label: 'Reload', click: () => wc.reload() }, { label: 'Bookmark this page', click: () => runAction('bookmark') }, { label: 'Print…', click: () => wc.print() }, ...extbridge.menuItems(wc, p), { type: 'separator' }, { label: 'Inspect', click: () => wc.inspectElement(p.x, p.y) });
  Menu.buildFromTemplate(items).popup({ window: win });
}

// ---------- adblock (uBlock Origin filter lists + scriptlet resources) ----------
const ADBLOCK = require('./adblock-lists');
const adblockCache = () => userFile('adblock2.bin'); // v2 = lists plus uBlock Origin's scriptlets; the old adblock.bin had no scriptlets and is ignored
let adblockStatus = { state: 'loading', source: '', updated: 0 };
// Chromium's own network stack (net.fetch) follows the system proxy and certificate store; Node's fetch does not, and fails behind many VPNs and virus scanners
const netText = async (url, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try { const r = await net.fetch(url, { signal: AbortSignal.timeout(25000) }); if (r.ok) return await r.text(); } catch {}
    await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  return null;
};
const bundledText = (name) => { try { return fs.readFileSync(path.join(__dirname, 'assets', 'filters', name), 'utf8'); } catch { return ''; } };
async function buildBlocker() { // every list on its own: one unreachable mirror must not cost the whole blocker, the bundled copy fills any gap
  const { ElectronBlocker } = require('@ghostery/adblocker-electron');
  const got = await Promise.all(ADBLOCK.lists.map(async (l) => ({ ...l, text: await netText(l.url) })));
  const online = got.filter((g) => g.text).length;
  const texts = got.map((g) => g.text || bundledText(g.file)).filter(Boolean);
  let resources = await netText(ADBLOCK.resources.url); const resOnline = !!resources;
  if (!resources) resources = bundledText(ADBLOCK.resources.file);
  if (!texts.length) throw new Error('no filter lists available');
  const b = ElectronBlocker.parse(texts.join('\n'), { loadCosmeticFilters: true, loadNetworkFilters: true });
  if (resources) b.updateResources(resources, String(resources.length));
  return { blocker: b, source: online === got.length && resOnline ? 'online' : online ? 'partly online' : 'bundled copy' };
}
const saveAdblockCache = (b) => fs.promises.writeFile(adblockCache(), Buffer.from(b.serialize())).catch(() => {});
async function initAdblock(list) {
  adblockStatus = { state: 'loading', source: '', updated: 0 }; push();
  try {
    const { ElectronBlocker } = require('@ghostery/adblocker-electron');
    let b = null, source = '', updated = 0;
    try { const st = fs.statSync(adblockCache()); b = ElectronBlocker.deserialize(fs.readFileSync(adblockCache())); source = 'saved copy'; updated = st.mtimeMs; } catch { b = null; }
    if (!b) { const r = await buildBlocker(); b = r.blocker; source = r.source; updated = Date.now(); saveAdblockCache(b); }
    blocker = b;
    blocker.on('request-blocked', () => { blockedCount++; if (!blockTimer) blockTimer = setTimeout(() => { blockTimer = null; push(); }, 2000); });
    if (settings.adblock) list.forEach((s) => adblockEnable(s));
    adblockStatus = { state: 'ready', source, updated }; push();
    if (Date.now() - updated > 24 * 3600e3) setTimeout(refreshAdblock, 45000); // lists older than a day are refreshed quietly; they apply from the next start
  } catch (e) { console.error('adblock failed', e); adblockStatus = { state: 'failed', error: e.message }; push(); toast('The ad blocker could not be loaded. Open Settings > Search & privacy to retry.'); }
}
async function refreshAdblock() {
  try { const r = await buildBlocker(); if (r.source !== 'bundled copy') { await saveAdblockCache(r.blocker); adblockStatus = { ...adblockStatus, updated: Date.now(), fresh: true }; push(); toast('Ad blocker lists updated. They apply from the next start.'); } else toast('Could not reach the filter lists. Nova keeps using the ones it has.'); } catch {}
}
// Every session (tabs, private tabs) gets the same three parts: network blocking, Nova's cosmetic/scriptlet preload and the YouTube safety net.
// The stock library registers global handlers per session and injects too late, so Nova wires the blocker's request hooks itself.
const extraAdblock = new Map(), ytPreload = new Map();
function ytDefuser(s, on) { // YouTube's own ad defuser rides along with the blocker
  if (on && !ytPreload.has(s)) { try { ytPreload.set(s, s.registerPreloadScript({ type: 'frame', filePath: path.join(__dirname, 'yt-defuser.js') })); } catch (e) { console.error('yt defuser', e.message); } }
  else if (!on && ytPreload.has(s)) { try { s.unregisterPreloadScript(ytPreload.get(s)); } catch {} ytPreload.delete(s); }
}
let tldParse = null; try { tldParse = require('tldts-experimental').parse; } catch {}
function cosmetics(url, dom) { // answers the cosmetic preload: hide rules and scriptlets for this page
  if (!blocker || !settings.adblock) return { active: false };
  try {
    const hostname = new URL(url).hostname, domain = (tldParse && tldParse(url).domain) || hostname, first = !dom;
    const { active, styles, scripts } = blocker.getCosmeticsFilters({ url, hostname, domain, classes: dom?.classes, ids: dom?.ids, hrefs: dom?.hrefs, getBaseRules: first, getInjectionRules: first, getExtendedRules: false, getRulesFromHostname: first, getRulesFromDOM: !first });
    return { active, styles, scripts: first ? scriptletGuard.guardAll(scripts) : [] };
  } catch (e) { return { active: false }; }
}
ipcMain.on('nova:cosmetics', (event, url) => { event.returnValue = cosmetics(url, null); });
ipcMain.on('nova:wake', (e, url) => { // the soft-wake preload of a woken tab asks, once, what to restore
  const t = [...tabs.values()].find((x) => x.view && !x.view.webContents.isDestroyed() && x.view.webContents === e.sender), pw = t && t.pendingWake;
  if (!pw || /^about:/i.test(url)) { e.returnValue = null; return; }
  t.pendingWake = null; t.snap = null;
  const strip = (u) => String(u || '').split('#')[0];
  e.returnValue = strip(pw.url) === strip(url) ? pw : null;
});
ipcMain.handle('nova:cosmetics-dom', (_e, url, dom) => cosmetics(url, dom).styles || '');
function adblockEnable(s) {
  if (extraAdblock.has(s)) return;
  s.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, blocker.onBeforeRequest);
  s.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, blocker.onHeadersReceived);
  let id; try { id = s.registerPreloadScript({ type: 'frame', filePath: path.join(__dirname, 'cosmetic-preload.js') }); } catch (e) { console.error('cosmetic preload', e.message); }
  extraAdblock.set(s, id);
  ytDefuser(s, true);
}
function adblockDisable(s) {
  ytDefuser(s, false);
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
  try { setAdblock(adblock); darkmode.sync(); webtools.sync(); passwords.sync(); } finally { saveSettings(); layoutAll(); push(); pushHome(); }
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

// ---------- sessions: one per profile in use, made the first time a page of the profile needs one ----------
// A profile nobody opens has no session at all: no partition folder, no extension load, no blocker hooks. Everything a session needs is wired here, once.
const persistentSessions = () => sessions.filter((s) => !(sesInfo.get(s) || {}).priv);
const curSes = () => sessionFor(curProfile(), false);
const permissions = (wc, perm, cb, details) => {
  if (['fullscreen', 'clipboard-sanitized-write', 'pointerLock'].includes(perm)) return cb(true);
  if (!['media', 'geolocation', 'notifications', 'clipboard-read'].includes(perm)) return cb(false);
  const host = (() => { try { return new URL(details.requestingUrl).host; } catch { return 'this site'; } })();
  dialog.showMessageBox(win, { type: 'question', buttons: ['Allow', 'Block'], defaultId: 1, cancelId: 1, message: `${host} wants permission: ${perm}` }).then((r) => cb(r.response === 0));
};
let legacyChecked = false;
function sessionFor(pid, priv) {
  const key = pid + (priv ? '!' : '');
  const have = profSes.get(key); if (have) return have;
  const s = session.fromPartition(profiles.partitionOf(pid, priv)); // a private one has no "persist:" in its name: in memory only, never written to disk
  profSes.set(key, s); sesInfo.set(s, { pid, priv: !!priv }); sessions.push(s);
  s.setUserAgent(UA, persona.acceptLanguage());
  s.registerPreloadScript({ type: 'frame', filePath: path.join(__dirname, 'shim-preload.js') });
  s.webRequest.onBeforeSendHeaders({ urls: ['https://*/*'] }, (d, cb) => { const h = d.requestHeaders; for (const [k, v] of Object.entries(persona.hints)) if (!Object.keys(h).some((x) => x.toLowerCase() === k)) h[k] = v; cb({ requestHeaders: h }); });
  s.setPermissionRequestHandler(permissions);
  if (blocker && settings.adblock) { try { adblockEnable(s); } catch (e) { console.error('adblock on a new session', e.message); } } // before the lists are loaded, initAdblock enables every session that exists by then
  webtools.sync(); darkmode.sync(); passwords.sync(); // their preloads follow the Features switches on every session, also on this one
  features.attachSession(s, pid, !!priv); // downloads
  if (!priv) { // private tabs get no extensions
    extbridge.attach(s);
    sesReady.set(s, loadExtensions(s).catch((e) => console.error('extensions', e.message)).then(() => { sesReady.delete(s); push(); if (!legacyChecked) { legacyChecked = true; extmgr.upgradeLegacy().catch((e) => console.error('extensions', e.message)); } }));
  }
  dlog(`session opened: profile ${pid}${priv ? ' (private)' : ''}`);
  return s;
}

// ---------- app ----------
if (setupMode) setup.run(setupMode);
if (!setupMode && gotLock) app.whenReady().then(async () => {
  app.setAppUserModelId(AUMID);
  loadSettings();
  repairShortcuts();
  // the installer can leave a profile choice behind for the very first launch
  { const fr = readJson('first-run.json', null); try { fs.rmSync(userFile('first-run.json'), { force: true }); } catch {}
    if (fr && PROFILES[fr.profile]) { const { features: f, budget: b, ...rest } = PROFILES[fr.profile]; Object.assign(settings, rest, { profile: fr.profile, features: { ...f }, budget: { ...b } }); saveSettings(); } }
  const saved = readJson('state.json', null);
  state = { spaces: saved?.spaces?.length ? saved.spaces : [{ id: 1, name: 'Main', color: '#7c8cff', profile: settings.profiles[0].id }], archive: saved?.archive || [], snoozed: saved?.snoozed || [], groups: Array.isArray(saved?.groups) ? saved.groups : [] };
  if (profiles.repairSpaces(state.spaces, settings.profiles)) saveSettings(); // spaces of older versions have no profile; a profile that settings.json lost is brought back, never merged into another
  if (settings.purge.length) { settings.purge = profiles.purge(app.getPath('userData'), settings.purge); saveSettings(); } // the partition folders of profiles deleted last time
  bindState(state); // activeTab, activeSpace, split and prevTab live in each window's record
  Menu.setApplicationMenu(null);

  // sessions are made by sessionFor() when a page of a profile first needs one; every page (tabs, sign-in popups) presents the same regular-Chrome identity
  if (!process.env.NOVA_NO_PERSONA) app.on('web-contents-created', (_e, wc) => { if (sessions.includes(wc.session)) persona.apply(wc); });
  features.init({
    app, get ses() { return curSes(); }, sessions: () => persistentSessions(), profile: () => curProfile(), tabs, userFile, readJson, writeJson, userAgent: UA,
    state: () => state, settings: () => settings, saveSettings, win: () => win, ui: () => ui,
    toast: (m) => toast(m), push: () => push(), native: (wc, p) => nat(wc, p), dlStart: () => dlFlyStart(), openOverlay: (k, d) => openOverlay(k, d), closeOverlay: () => closeOverlay(), overlayBusy: () => overlayOpen,
    newPrivateTab: () => { const t = newTabObj({ private: true }); activate(t.id); return t; },
    openUrl: (u, o) => openUrl(u, o), closeTab: (id) => closeTab(id), sleepTab: (t) => sleep(t), thawTab: (t) => sleeper.thaw(t), forgetRevisits: () => sleeper.clear(), budgetTabs: () => budget.get().tabs,
    addBackgroundTab: (o) => { const t = newTabObj({ url: o.url, title: o.title, favicon: o.favicon, spaceId: state.spaces.some((s) => s.id === o.spaceId) ? o.spaceId : state.activeSpace, pinned: o.pinned }); push(); return t; },
  });
  webtools.init({ sessions: () => sessions, settings: () => settings });
  darkmode.init({ sessions: () => sessions, settings: () => settings, saveSettings, tabs, toast: (m) => toast(m), push: () => push(), domainOf: (u) => (tldParse ? tldParse(u, { allowPrivateDomains: true }).domain : null) });
  passwords.init({ log: (m) => dlog(m), sessions: () => sessions, isPrivate: (wc) => !!(sesInfo.get(wc.session) || {}).priv, profileOf: (wc) => (sesInfo.get(wc.session) || {}).pid || settings.profiles[0].id, profile: () => curProfile(), profileName: (pid) => profileOfId(pid).name, settings: () => settings, tabs, activeTab: () => activeTab(), overlayOpen: () => overlayOpen, win: () => win, ui: () => ui, userFile, toast: (m) => toast(m), openOverlay: (k, d) => openOverlay(k, d) });
  const first = createWindow({ activeSpace: saved?.activeSpace });

  // restore tabs lazily (all asleep except the active one)
  if (saved?.tabs?.length) {
    for (const s of saved.tabs) if (s && s.id != null && !tabs.has(s.id)) newTabObj(state.spaces.some((x) => x.id === s.spaceId) ? s : { ...s, spaceId: (profSpaces(s.profile)[0] || {}).id }); // the space is the truth; a tab whose space is gone goes to its profile's first space // saved states from older versions can list a tab twice
    const sp = [...tabs.values()].filter((t) => t.spaceId === state.activeSpace);
    const pick = tabs.get(saved.activeTab) || sp[0] || [...tabs.values()][0];
    ui.webContents.once('did-finish-load', () => { useWin(first); activate(pick.id); });
  } else {
    ui.webContents.once('did-finish-load', () => { useWin(first); const t = newTabObj({}); activate(t.id); });
  }
  ui.webContents.once('did-finish-load', () => { if (settings.firstRun || settings.setupVersion < 2) { settings.seenVersion = updater.version; saveSettings(); openOverlay('wizard'); } else whatsNew(); });

  initAdblock(sessions);
  budget.init({ tabs, settings: () => settings, sleepTab: (t) => sleep(t), visibleIds: () => allVisibleIds(), toast: (m) => toast(m), push: () => push(), watching: () => anyOverlay() });
  sleeper.init({ tabs, settings: () => settings, visibleIds: () => allVisibleIds(), native: (wc, p) => nat(wc, p), sleepTab: (t) => sleep(t), readJson, writeJson, hostVisits: (h) => features.hostVisits(h) });
  app.on('before-quit', () => { persist(true); quitting = true; sleeper.flush(); features.shutdown(); });
  updater.onEvent((e) => { if (e.type === 'toast') toast(e.text); else if (e.type === 'ready') { toast(`Nova ${e.version} is ready. Restart to finish the update.`); push(); } else if (e.type === 'status') push(); });
  ui.webContents.once('did-finish-load', () => setTimeout(() => { try { global.__novaBoot && global.__novaBoot.good(); } catch {} }, 8000)); // started fine: the update bundle is trusted from now on
  const feed = () => settings.updateFeed || updater.defaultFeed;
  setTimeout(() => updater.check(feed()), 20000);
  setInterval(() => updater.check(feed()), 4 * 3600e3);
  app.on('before-quit', () => { try { updater.applyOnQuit(); } catch (e) { console.error('update on quit', e.message); } });
  app.on('second-instance', (_e, argv) => {
    const W = curW || firstW(); if (!W) return; useWin(W);
    if (win.isMinimized()) win.restore(); win.focus();
    const u = argv.slice(1).find((a) => /^https?:\/\//i.test(a) || /\.html?$/i.test(a));
    if (u) openUrl(/^https?:/i.test(u) ? u : pathToFileURL(u).href, { forceNew: true });
  });
  const startUrl = process.argv.slice(1).find((a) => /^https?:\/\//i.test(a));
  if (startUrl) ui.webContents.once('did-finish-load', () => setTimeout(() => openUrl(startUrl, { forceNew: true }), 300));
  extbridge.init({ native: (wc, p) => nat(wc, p), get ses() { return curSes(); }, sessions: () => sessions, extSessions: () => persistentSessions(), profileOf: (s) => (sesInfo.get(s) || {}).pid || settings.profiles[0].id, tabs, state: () => state, settings: () => settings, win: () => win, openUrl: (u, o) => openUrl(u, o), activate: (id) => activate(id), wake: (t) => wake(t), closeTab: (id) => closeTab(id), sleepTab: (t) => sleep(t), push: () => push(), toast: (m) => toast(m), normalize: (u) => normalizeInput(u), activeTab: () => activeTab(), userDir: () => app.getPath('userData') });
  sesReady.delete(sessionFor(curProfile(), false)); // the profile the first window opens in gets its session now, its extensions load while the interface starts and its first page does not wait for them (as always); the others get theirs when first opened and their first page waits (see wake)
  setInterval(idlePolicy, 30000);
  layout();

  // ----- IPC from the UI -----
  ipcMain.on('nova:passkeys', (e) => { e.returnValue = !!settings.passkeys; }); // answered at once: the page waits for it
  ipcMain.on('nova:shim', (e) => { e.returnValue = { passkeys: !!settings.passkeys, wheel: wheelKeys().length > 0 }; }); // what the page-side shim does: passkeys, and whether any wheel shortcut exists
  let lastWheel = 0;
  ipcMain.on('nova:wheel', (e, d) => { // a turn of the wheel with Ctrl, Alt or Shift held, seen by a page: run what is assigned to it
    const t = [...tabs.values()].find((x) => x.view && x.view.webContents === e.sender);
    if (!t || !d || !Array.isArray(d.mods) || typeof d.dir !== 'string' || !/^Wheel(Up|Down|Left|Right)$/.test(d.dir)) return;
    const mods = ['Ctrl', 'Alt', 'Shift'].filter((m) => d.mods.includes(m)); if (!mods.length) return;
    const accel = [...mods, d.dir].join('+'), now = Date.now(); if (now - lastWheel < 140) return; lastWheel = now;
    if (/^Ctrl\+Wheel(Up|Down)$/.test(accel) && (settings.keys.zoomIn || []).concat(settings.keys.zoomOut || []).includes(accel)) return; // the zoom event of the page handles those
    useWinOf(t); runKeyed(accel);
  });
  ipcMain.handle('state', (e) => { useWin(wOfUi(e.sender)); return publicState(true); });
  ipcMain.handle('thumbs', () => Object.fromEntries([...tabs.values()].filter((t) => t.thumb).map((t) => [t.id, t.thumb])));
  ipcMain.handle('cmd', async (_e, name, a = {}) => {
    useWin(wOfUi(_e.sender)); // the window whose interface sent this is the one that changes
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
      case 'adblockRetry': if (!blocker) initAdblock(sessions); else refreshAdblock(); break;
      case 'archive': if (t) archiveTab(t); break;
      case 'pin': if (t) { t.pinned = !t.pinned; push(); } break;
      case 'sleep': if (t && t.id !== state.activeTab) { sleep(t); push(); } break;
      case 'prewake': prewake(a.id); break;
      case 'restore': closeOverlay(); { const i = state.archive.findIndex((x) => x.closedAt === a.closedAt); if (i >= 0) { const [x] = state.archive.splice(i, 1); openUrl(x.url, { spaceId: x.spaceId, forceNew: true }); } } break;
      case 'groupTab': if (t) { // a tab joins a group ('new' makes one) and moves next to the other tabs of it
        let g = state.groups.find((x) => x.id === a.group);
        if (!g) { g = { id: 'g' + Date.now().toString(36), spaceId: t.spaceId, name: '', color: GROUP_COLORS[state.groups.length % GROUP_COLORS.length], collapsed: false }; state.groups.push(g); }
        t.group = g.id; const mates = [...tabs.values()].filter((x) => x !== t && x.group === g.id);
        if (mates.length) reorderAfter(t.id, mates[mates.length - 1].id);
        persistSoon(); push();
      } break;
      case 'ungroupTab': if (t && t.group) { t.group = undefined; persistSoon(); push(); } break;
      case 'groupSet': { const g = state.groups.find((x) => x.id === a.id); if (g) { if (typeof a.name === 'string') g.name = a.name.trim().slice(0, 40); if (/^#[0-9a-f]{6}$/i.test(a.color || '')) g.color = a.color; if (typeof a.collapsed === 'boolean') g.collapsed = a.collapsed; persistSoon(); push(); } } break;
      case 'groupUngroup': for (const x of tabs.values()) if (x.group === a.id) x.group = undefined; state.groups = state.groups.filter((g) => g.id !== a.id); persistSoon(); push(); break;
      case 'groupClose': for (const x of [...tabs.values()]) if (x.group === a.id) closeTab(x.id); state.groups = state.groups.filter((g) => g.id !== a.id); persistSoon(); push(); break;
      case 'moveToSpace': if (t && inProfile(a.spaceId, t.pid)) { t.spaceId = a.spaceId; if (t.id === state.activeTab) switchSpace(a.spaceId); push(); } break;
      case 'split': if (t && t.id !== state.activeTab) { state.split = t.id; wake(t); closeOverlay(); sync(); push(); } else { state.split = null; sync(); push(); } break;
      case 'closeOverlay': closeOverlay(); break;
      case 'overlay': openOverlay(a.kind, a.data); break;
      case 'action': closeOverlay(); runAction(a.name); break;
      case 'back': t?.view?.webContents.navigationHistory.goBack(); break;
      case 'forward': t?.view?.webContents.navigationHistory.goForward(); break;
      case 'reload': t?.view?.webContents.reload(); break;
      case 'find': { const wc = activeTab()?.view?.webContents; if (!wc) break; if (a.text) lastFind = a.text; if (!a.text) wc.stopFindInPage('clearSelection'); else wc.findInPage(a.text, { forward: a.forward !== false, findNext: !!a.next }); } break;
      case 'switchSpace': if (inProfile(a.id)) switchSpace(a.id); break; // the interface only knows the spaces of its profile
      case 'switchProfile': switchProfile(a.id); break;
      case 'addProfile': addProfile(a.name, a.color); break;
      case 'renameProfile': renameProfile(a.id, a.name, a.color); break;
      case 'deleteProfile': await deleteProfile(a.id); break;
      case 'addSpace': { const id = Math.max(...state.spaces.map((s) => s.id)) + 1; state.spaces.push({ id, name: a.name || 'Space ' + id, color: a.color || '#7c8cff', profile: curProfile() }); switchSpace(id); } break;
      case 'renameSpace': { const s = state.spaces.find((x) => x.id === a.id); if (s) { if (a.name) s.name = a.name; if (a.color) s.color = a.color; push(); } } break;
      case 'deleteSpace': if (state.spaces.some((s) => s.id === a.id) && profSpaces(spaceProfile(a.id)).length > 1) removeSpaces([a.id]); break; // a profile keeps at least one space
      case 'cleanUp': cleanUp(a.mode); break;
      case 'settings': {
        const prev = JSON.stringify([settings.layout, settings.compact, settings.gap, settings.radius, settings.theme.bg, settings.pageCss, settings.bookmarksBar]);
        delete a.patch.profiles; delete a.patch.purge; // profiles change only through their own commands
        Object.assign(settings, a.patch);
        if (a.patch.theme) { settings.theme = { ...DEFAULTS.theme, ...a.patch.theme }; if (!a.patch.theme.page) settings.theme.page = a.patch.theme.surface || DEFAULTS.theme.page; for (const x of tabs.values()) if (x.view && !x.view.webContents.isDestroyed()) x.view.setBackgroundColor(settings.theme.page); }
        if (a.patch.keys) settings.keys = { ...DEFAULT_KEYS, ...a.patch.keys };
        if ('adblock' in a.patch) setAdblock(a.patch.adblock);
        if ('features' in a.patch) { darkmode.sync(); webtools.sync(); passwords.sync(); }
        if ('pageScheme' in a.patch) applyScheme();
        if ('darkSites' in a.patch) darkmode.refreshAll();
        if ('lowIsolation' in a.patch) toast('Restart Nova to apply this change.');
        if ('passkeys' in a.patch) toast('Reload open pages for this to apply.');
        if (a.patch.budget && !settings.budget.freeze) for (const x of tabs.values()) if (x.frozen) sleeper.thaw(x);
        saveSettings();
        if (prev !== JSON.stringify([settings.layout, settings.compact, settings.gap, settings.radius, settings.theme.bg, settings.pageCss, settings.bookmarksBar])) layoutAll();
        if (a.patch.theme || a.patch.wallpaper || a.patch.startPage) pushHome();
        if (a.patch.pageCss !== undefined) for (const x of tabs.values()) if (x.view) { applyPageCss(x.view.webContents); }
        push();
      } break;
      case 'pw': return passwords.cmd(_e, a);
      case 'extDebug': return process.env.NOVA_DEBUG_SW ? extbridge.debug(a, t) : undefined;
      case 'applyProfile': applyProfile(a.name); break;
      case 'runSetup': closeOverlay(); setTimeout(() => openOverlay('wizard'), 60); break;
      case 'newPrivate': return features.handle('newPrivate', a, t);
      case 'resetSettings': settings = { ...DEFAULTS, theme: { ...DEFAULTS.theme }, keys: { ...DEFAULT_KEYS }, features: { ...DEFAULTS.features }, budget: { ...DEFAULTS.budget }, downloads: { ...DEFAULTS.downloads }, cache: { ...DEFAULTS.cache }, profiles: settings.profiles, purge: settings.purge, firstRun: false, setupVersion: 2 }; darkmode.sync(); webtools.sync(); passwords.sync(); saveSettings(); layoutAll(); push(); break;
      case 'finishSetup': settings.firstRun = false; settings.setupVersion = 2; saveSettings(); closeOverlay(); push(); break;
      case 'loadExtension': {
        const r = await dialog.showOpenDialog(win, { title: 'Select an unpacked extension folder', properties: ['openDirectory'] });
        if (!r.canceled) { try { for (const s of persistentSessions()) await s.extensions.loadExtension(r.filePaths[0], { allowFileAccess: true }); if (!settings.extensions.includes(r.filePaths[0])) settings.extensions.push(r.filePaths[0]); saveSettings(); toast('Extension loaded.'); } catch (e) { toast('Could not load extension: ' + e.message); } push(); }
      } break;
      case 'removeExtension': settings.extensions = settings.extensions.filter((p) => p !== a.path); saveSettings(); toast('Removed. Takes effect after restart.'); push(); break;
      case 'changelog': try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'changelog.json'), 'utf8')).slice(0, 60); } catch { return []; }
      case 'checkUpdate': updater.check(settings.updateFeed || updater.defaultFeed, { manual: true }); break;
      case 'applyUpdate': if (await updater.apply()) app.quit(); break;
      case 'keysPause': keysPaused = !!a.on; break;
      case 'detachTab': detachTab(a.id, !!a.force); break;
      case 'moveToWindow': { const tt = tabs.get(a.id), to = wins.get(a.wid); if (tt && to) transferTab(tt, to); } break;
      case 'reorder': { const arr = [...tabs.entries()], i = arr.findIndex(([k]) => k === a.id); if (i < 0) break; const [item] = arr.splice(i, 1); const j = arr.findIndex(([k]) => k === a.target); arr.splice(j < 0 ? arr.length : a.after ? j + 1 : j, 0, item); tabs.clear(); arr.forEach(([k, v]) => tabs.set(k, v)); push(); } break;
      case 'pickWallpaper': return pickWallpaper();
      case 'wallColors': return wallColors();
      case 'windowsAccent': return windowsAccent();
      case 'dragStart': startDrag(); break;
      case 'dragEnd': endDrag(); break;
      case 'external': shell.openExternal(a.url); break;
      default: return features.handle(name, a, t);
      case 'win': if (a.op === 'min') win.minimize(); else if (a.op === 'max') { if (win.isMaximized()) win.unmaximize(); else if (curW.fill) unfillWindow(curW); else fillWindow(curW); } else if (a.op === 'close') win.close(); break;
    }
  });
});
app.on('window-all-closed', () => app.quit());
