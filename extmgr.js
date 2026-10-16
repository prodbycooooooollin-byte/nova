// Nova's extension manager: install from the Chrome Web Store (keeping the store's own extension ID), remove, list, open the popup,
// and tell whether a freshly installed extension started cleanly. The chrome.* APIs Electron lacks are in extbridge.js and ext-shim.js.
const { app, BrowserWindow } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const hooks = { installed: null }; // extbridge.js tells the extension it was installed
let C; // context from features.js: ses, settings, saveSettings, push, toast, userAgent, win
const extDir = () => path.join(app.getPath('userData'), 'extensions');
const UA_CHROME = () => process.versions.chrome;

// ---------- the extension's own ID ----------
// The Web Store signs every extension with a key, and the ID is a fingerprint of it. An unpacked copy has no key, so Chromium invents an ID
// from the folder path, and anything that talks to an extension by its real ID (Proton's website handing a sign-in to Proton Pass) cannot find it.
// The key sits in the .crx header; copying it into the manifest brings the store ID back.
function varint(b, i) { let r = 0, s = 0, x; do { x = b[i++]; r += (x & 0x7f) * 2 ** s; s += 7; } while (x & 0x80); return [r, i]; }
function fields(b) {
  const out = []; let i = 0;
  while (i < b.length) {
    let tag; [tag, i] = varint(b, i); const f = Math.floor(tag / 8), w = tag & 7;
    if (w === 2) { let len; [len, i] = varint(b, i); out.push([f, b.subarray(i, i + len)]); i += len; }
    else if (w === 0) { let v; [v, i] = varint(b, i); out.push([f, v]); }
    else if (w === 1) i += 8; else if (w === 5) i += 4; else break;
  }
  return out;
}
const idFromKey = (der) => [...crypto.createHash('sha256').update(der).digest().subarray(0, 16)].map((x) => String.fromCharCode(97 + (x >> 4)) + String.fromCharCode(97 + (x & 15))).join('');
function crxKey(buf, wantId) {
  try {
    const ver = buf.readUInt32LE(4);
    if (ver === 2) { const k = buf.subarray(16, 16 + buf.readUInt32LE(8)); return idFromKey(k) === wantId ? k.toString('base64') : null; }
    const header = buf.subarray(12, 12 + buf.readUInt32LE(8));
    for (const [n, v] of fields(header)) {
      if (n !== 2 && n !== 3) continue; // RSA or ECDSA proofs
      const pk = fields(v).find(([m]) => m === 1);
      if (pk && Buffer.isBuffer(pk[1]) && idFromKey(pk[1]) === wantId) return pk[1].toString('base64');
    }
  } catch { /* fall through */ }
  return null;
}

// ---------- download ----------
async function fetchCrx(id) {
  const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${UA_CHROME()}&acceptformat=crx2,crx3&x=${encodeURIComponent(`id=${id}&installsource=ondemand&uc`)}`;
  const res = await (C.fetch || fetch)(url, { headers: { 'User-Agent': C.userAgent }, signal: AbortSignal.timeout(60000) });
  if (res.status === 204 || res.status === 404) throw new Error('The Web Store has no download for this extension.');
  if (!res.ok) throw new Error('Web Store answered ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 4).toString() !== 'Cr24') throw new Error('Unexpected file from the Web Store');
  return buf;
}
const zipStart = (buf) => (buf.readUInt32LE(4) === 3 ? 12 + buf.readUInt32LE(8) : 16 + buf.readUInt32LE(8) + buf.readUInt32LE(12));

// Watches a freshly loaded extension's background worker for a few seconds: did it start, did it complain?
function health(ext, ms = 6000) {
  return new Promise((resolve) => {
    const m = ext.manifest || {};
    if (!(m.background && m.background.service_worker)) return resolve({ ok: true, note: '' });
    const errors = []; let running = false;
    const scope = `chrome-extension://${ext.id}/`;
    const onMsg = (_e, d) => { if (d.level >= 3 && String(d.sourceUrl || '').startsWith('chrome-extension://' + ext.id) && !/Content-Security-Policy|favicon|not signed in|Login is required/i.test(d.message)) errors.push(String(d.message).slice(0, 160)); };
    const onStatus = (d) => { if (d.runningStatus === 'running') running = true; };
    C.ses.serviceWorkers.on('console-message', onMsg); C.ses.serviceWorkers.on('running-status-changed', onStatus);
    setTimeout(() => {
      C.ses.serviceWorkers.off('console-message', onMsg); C.ses.serviceWorkers.off('running-status-changed', onStatus);
      resolve(!running ? { ok: false, note: 'Its background worker did not start.' } : errors.length ? { ok: true, note: 'It started, but reported a problem: ' + errors[0] } : { ok: true, note: '' });
    }, ms);
    void scope;
  });
}

async function install(input) {
  const id = String(input).match(/[a-p]{32}/)?.[0];
  if (!id) return { ok: false, error: 'That is not a Chrome Web Store link or extension ID.' };
  try {
    const buf = await fetchCrx(id);
    const dir = path.join(extDir(), id);
    let was = null;
    try { was = list().find((e) => e.id === id || path.basename(e.path) === id) || null; if (was) await C.ses.extensions.removeExtension(was.id); } catch { /* not loaded */ }
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    new AdmZip(buf.subarray(zipStart(buf))).extractAllTo(dir, true);
    const mf = path.join(dir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(mf, 'utf8').replace(/^﻿/, ''));
    const key = crxKey(buf, id);
    if (key && !manifest.key) { manifest.key = key; fs.writeFileSync(mf, JSON.stringify(manifest, null, 2)); }
    const ext = await C.ses.extensions.loadExtension(dir, { allowFileAccess: true });
    const s = C.settings(); s.extensions = [...new Set([...(s.extensions || []), dir])]; C.saveSettings(); C.push();
    const h = await health(ext);
    try { if (hooks.installed) hooks.installed(ext.id, was ? 'update' : 'install', was && was.version); } catch { /* no bridge */ }
    return { ok: true, name: ext.name, id: ext.id, storeId: id, sameId: ext.id === id, health: h };
  } catch (e) { return { ok: false, error: e.message }; }
}

// An extension installed by an older Nova has an ID made up from its folder; the ones that need the real ID are installed again.
async function upgradeLegacy() {
  const f = path.join(app.getPath('userData'), 'ext-upgraded.json'); // each extension is tried once, so a store file without a key cannot cause a download at every start
  let tried = []; try { tried = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* first time */ }
  for (const e of list()) {
    const base = path.basename(e.path);
    if (!/^[a-p]{32}$/.test(base) || e.id === base || tried.includes(base)) continue;
    const m = e.manifest || {};
    if (!(m.externally_connectable && m.externally_connectable.matches)) continue;
    tried.push(base); try { fs.writeFileSync(f, JSON.stringify(tried)); } catch { /* ignore */ }
    const r = await install(base);
    console.log('[extmgr] reinstalled', base, r.ok ? 'ok' : r.error);
  }
}

async function remove(id) {
  const hit = list().find((e) => e.id === id || path.basename(e.path) === id);
  if (hit) { try { await C.ses.extensions.removeExtension(hit.id); } catch { /* already gone */ } }
  const s = C.settings();
  s.extensions = (s.extensions || []).filter((p) => !(hit && p === hit.path) && !p.includes(id) && !p.endsWith(id));
  if (hit) { try { fs.rmSync(hit.path, { recursive: true, force: true }); } catch { /* in use */ } }
  s.extensions = s.extensions.filter((p) => fs.existsSync(p)); C.saveSettings(); C.push();
}

const iconCache = {};
function list() {
  return C.ses.extensions.getAllExtensions().map((e) => {
    const m = e.manifest || {}, icons = m.icons || (m.action || m.browser_action || {}).default_icon || {};
    const best = typeof icons === 'string' ? icons : icons[Object.keys(icons).sort((a, b) => b - a)[0]];
    if (best && !iconCache[e.id]) { try { iconCache[e.id] = 'data:image/png;base64,' + fs.readFileSync(path.join(e.path, best)).toString('base64'); } catch { /* no icon */ } }
    const act = m.action || m.browser_action || {};
    return { id: e.id, name: e.name, path: e.path, version: e.version, icon: iconCache[e.id] || '', popup: act.default_popup || '', manifest: m };
  });
}
// the IDs of installed extensions as the Web Store knows them (the folder name), whatever ID they run under
const installedIds = () => { try { return list().flatMap((e) => [e.id, path.basename(e.path)]); } catch { return []; } };

const shimPath = () => { const p = path.join(__dirname, 'ext-shim.js'), u = p.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1'); return fs.existsSync(u) ? u : p; };
const popups = new Map(), closedAt = new Map(); // extension id -> its open popup window / when it last closed by losing focus
function openPopup(id) {
  if (Date.now() - (closedAt.get(id) || 0) < 400) return; // the click that took focus away from the popup is the click that closes it
  const e = C.ses.extensions.getExtension(id), m = (e && e.manifest) || {}, popup = (m.action || m.browser_action || {}).default_popup;
  if (!popup) return C.toast(`${(e && e.name) || 'This extension'} has no popup.`);
  if (popups.has(id) && !popups.get(id).isDestroyed()) { popups.get(id).close(); return; }
  const b = C.win().getBounds(), right = C.settings().layout === 'right', top = C.settings().layout === 'top';
  const pw = new BrowserWindow({ width: 380, height: 580, useContentSize: true, x: right ? b.x + b.width - 400 : b.x + (top ? b.width - 400 : 16), y: top ? b.y + 90 : b.y + b.height - 600, frame: false, resizable: false, skipTaskbar: true, alwaysOnTop: true, show: false, backgroundColor: '#ffffff', webPreferences: { session: C.ses, sandbox: true, preload: shimPath() } });
  popups.set(id, pw);
  pw.on('closed', () => popups.delete(id));
  pw.loadURL(`chrome-extension://${id}/${popup}`).catch(() => pw.close());
  let shown = false; const show = () => { if (!shown && !pw.isDestroyed()) { shown = true; pw.show(); } };
  pw.once('ready-to-show', () => { // like Chrome, fit the window to what the popup asks for (width 200-800, height 100-600)
    setTimeout(async () => {
      try { const [w, h] = await pw.webContents.executeJavaScript('[Math.ceil(Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)), Math.ceil(Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0))]'); if (!pw.isDestroyed() && w > 120 && h > 60) pw.setContentSize(Math.min(800, Math.max(300, w)), Math.min(600, Math.max(200, h))); } catch { /* keep the default size */ }
      show();
    }, 350);
  });
  setTimeout(show, 2500); // never leave the user waiting on a popup that stays quiet
  pw.on('blur', () => { if (!pw.isDestroyed() && !pw.webContents.isDevToolsOpened()) setTimeout(() => { if (!pw.isDestroyed() && !pw.isFocused()) { closedAt.set(id, Date.now()); pw.close(); } }, 120); });
}


// ---------- the whole Chrome Web Store: search and browse ----------
// The store has no public API; its pages carry their data as JSON inside the HTML (AF_initDataCallback). A search page holds the ten best
// matches, a category page 32 popular extensions. Every result also carries the extension's manifest, so Nova can tell before installing
// which of Chromium's extension features an extension needs that Electron does not provide.
const STORE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
const STORE_CATEGORIES = [
  ['productivity/tools', 'Tools'], ['productivity/workflow', 'Workflow'], ['productivity/communication', 'Communication'], ['productivity/developer', 'Developer tools'], ['productivity/education', 'Education'],
  ['make_chrome_yours/privacy', 'Privacy & security'], ['make_chrome_yours/functionality', 'Functionality'], ['make_chrome_yours/accessibility', 'Accessibility'],
  ['lifestyle/entertainment', 'Entertainment'], ['lifestyle/social', 'Social'], ['lifestyle/shopping', 'Shopping'], ['lifestyle/travel', 'Travel'], ['lifestyle/news', 'News & weather'],
  ['lifestyle/art', 'Art & design'], ['lifestyle/games', 'Games'], ['lifestyle/fun', 'Fun'], ['lifestyle/household', 'Home'], ['lifestyle/well_being', 'Well-being'],
];
// what Electron cannot give an extension, in words for the person
const LIMITS = { declarativeNetRequest: 'its own ad-blocking rules', nativeMessaging: 'a companion app on your PC', sidePanel: 'the side panel', webRequestBlocking: 'request blocking', userScripts: 'user scripts', proxy: 'proxy control', debugger: 'the debugger', tabCapture: 'tab recording', desktopCapture: 'screen recording', devtools_page: 'a developer tools panel', oauth2: 'Google account sign-in' };
const storeCache = new Map();
function limitsOf(mf) {
  const perms = [...(mf.permissions || [])];
  if (mf.devtools_page) perms.push('devtools_page'); if (mf.side_panel) perms.push('sidePanel'); if (mf.oauth2) perms.push('oauth2'); if (mf.declarative_net_request) perms.push('declarativeNetRequest');
  return Object.keys(LIMITS).filter((k) => perms.includes(k)).map((k) => LIMITS[k]);
}
function mapStoreItem(a) {
  let mf = {}; try { mf = JSON.parse(a[18]); } catch { /* no manifest in this entry */ }
  return { id: a[0], name: String(a[2] || ''), icon: String(a[1] || ''), rating: typeof a[3] === 'number' ? Math.round(a[3] * 10) / 10 : 0, ratingCount: a[4] || 0, tagline: String(a[6] || ''), dev: a[7] || '', cat: (a[11] && a[11][0]) || '', users: typeof a[14] === 'number' ? a[14] : 0, updated: a[17] && a[17][0] ? a[17][0] * 1000 : 0, mv: mf.manifest_version || 0, limits: limitsOf(mf), store: true };
}
async function storePage(url) {
  const hit = storeCache.get(url);
  if (hit && Date.now() - hit.t < 10 * 60e3) return hit.v;
  let res;
  try { res = await (C.sesFetch || C.fetch || fetch)(url, { headers: { 'User-Agent': STORE_UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(20000) }); } // with the browser's own cookies, so a consent answer given once in a tab counts
  catch (e) { throw new Error('Nova could not reach the Chrome Web Store. Check the connection.'); }
  if (!res.ok) throw new Error('The Chrome Web Store answered ' + res.status + '.');
  const html = await res.text();
  const m = /AF_initDataCallback\(\{key: 'ds:1', hash: '[^']*', data:([\s\S]*?), sideChannel: \{\}\}\);<\/script>/.exec(html);
  if (!m && /consent\.google\.com|Before you continue/.test(html)) throw new Error('Google wants a cookie decision before it shows the store. Open chromewebstore.google.com in a tab, answer it once, and try again.');
  if (!m) { if (process.env.NOVA_DEBUG_SW) { try { fs.writeFileSync(path.join(app.getPath('userData'), 'store-debug.html'), `<!-- ${res.url} ${res.status} -->
` + html); } catch { /* ignore */ } } throw new Error('The Chrome Web Store page looked different than expected.'); }
  const data = JSON.parse(m[1]), items = [], seen = new Set();
  let total = 0;
  (function walk(a) {
    if (!Array.isArray(a)) return;
    if (typeof a[0] === 'string' && /^[a-p]{32}$/.test(a[0]) && typeof a[2] === 'string') { if (!seen.has(a[0])) { seen.add(a[0]); items.push(mapStoreItem(a)); } return; }
    if (typeof a[0] === 'string' && a[0].length > 40 && a[1] === null && a[2] === null && typeof a[3] === 'number') total = a[3]; // the continuation token and the number of matches
    a.forEach(walk);
  })(data);
  const v = { items, total: total || items.length };
  storeCache.set(url, { t: Date.now(), v });
  if (storeCache.size > 60) storeCache.delete(storeCache.keys().next().value);
  return v;
}
async function search(q) {
  q = String(q || '').trim(); if (q.length < 2) return { items: [], total: 0 };
  const id = q.match(/[a-p]{32}/)?.[0]; // a pasted store link or ID
  const r = await storePage(`https://chromewebstore.google.com/search/${encodeURIComponent(q)}?hl=en&itemTypes=EXTENSION&ucbcb=1`);
  const pinned = id && !r.items.some((x) => x.id === id) ? [{ id, name: 'Extension ' + id.slice(0, 8) + '…', icon: '', rating: 0, ratingCount: 0, tagline: 'From the link you pasted. Nova installs it by its ID.', dev: '', cat: '', users: 0, updated: 0, mv: 0, limits: [], store: true }] : [];
  return { items: [...pinned, ...r.items], total: r.total, url: `https://chromewebstore.google.com/search/${encodeURIComponent(q)}?hl=en` };
}
async function category(slug) {
  if (!STORE_CATEGORIES.some(([s]) => s === slug)) throw new Error('Unknown category.');
  const r = await storePage(`https://chromewebstore.google.com/category/extensions/${slug}?hl=en&ucbcb=1`);
  return { items: r.items, total: r.items.length, url: `https://chromewebstore.google.com/category/extensions/${slug}?hl=en` };
}

function init(ctx) { C = ctx; }
module.exports = { hooks, search, category, STORE_CATEGORIES, init, install, remove, list, installedIds, openPopup, shimPath, upgradeLegacy, extDir, health };
