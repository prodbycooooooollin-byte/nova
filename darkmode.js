// Nova's smart dark mode: Dark Reader's dynamic-theme engine (MIT, assets/darkreader) running inside the page's own renderer.
// No extension, no service worker, no extra process. dark-preload.js is registered only while the feature is on, and it is handed the
// engine only on sites the user switched to dark, so every other page pays nothing. With the feature off, nothing of this exists.
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let C; // context from main.js: sessions, settings, tabs, toast, push, domainOf
const preloadIds = new Map(); // session -> id of the registered frame preload
let engine = null; // the engine source, read on the first dark page and dropped when the feature is switched off
const waiting = new Map(); // webContents id -> resolve of a pending "is the preload there?" check

const THEME = { mode: 1, brightness: 100, contrast: 100, sepia: 0, grayscale: 0 };
const theme = () => ({ ...THEME, ...(C.settings().darkTheme || {}) });
const engineCode = () => engine || (engine = fs.readFileSync(path.join(__dirname, 'assets', 'darkreader', 'darkreader.js'), 'utf8') + '\n//# sourceURL=nova-dark-reader.js');
const bare = (h) => String(h || '').toLowerCase().replace(/^www\./, '');
const privateSites = new Set(); // switched on from a private tab: kept in memory only, so private browsing leaves no trace in settings.json
const sites = () => [...(C.settings().darkSites || []), ...privateSites];
const covers = (site, host) => host === site || host.endsWith('.' + site);
const isOnHost = (host) => { host = bare(host); return !!host && sites().some((s) => covers(s, host)); };
function hostOf(url) { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? bare(u.hostname) : ''; } catch { return ''; } }
// The name a site is saved under: its registrable domain, so one switch covers en.wikipedia.org and de.wikipedia.org (but not github.io project pages).
const keyOf = (url) => { const h = hostOf(url); if (!h) return ''; try { return bare(C.domainOf(url)) || h; } catch { return h; } };
const isOnUrl = (url) => isOnHost(hostOf(url));
const tabSession = (e) => C.sessions().includes(e.sender.session);

// Cross-origin stylesheets and images: the page cannot read them, so the engine asks here, the same way the Dark Reader extension asks its
// background page. Only stylesheets and images, never loopback or private network addresses, never more than 8 MB.
const MAX_BYTES = 8 * 1024 * 1024;
function isPrivateHost(h) {
  h = String(h).toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.lan') || h.endsWith('.home')) return true;
  if (/^(127|10|0)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return h === '::1' || /^f[cd][0-9a-f]{2}:/.test(h) || /^fe80:/.test(h);
}
async function fetchForEngine(e, url, page) {
  if (!tabSession(e)) return { error: 'not a tab' };
  try {
    const u = new URL(url), from = new URL(page);
    if (!/^https?:$/.test(u.protocol)) return { error: 'scheme' };
    if (isPrivateHost(u.hostname) && u.hostname !== from.hostname) return { error: 'private address' };
    const res = await e.sender.session.fetch(url, { credentials: 'omit', referrer: from.origin + '/', signal: AbortSignal.timeout(12000) });
    const finalHost = new URL(res.url || url).hostname;
    if (isPrivateHost(finalHost) && finalHost !== from.hostname) return { error: 'private address' };
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!(type === 'text/css' || type.startsWith('image/'))) return { error: 'not a stylesheet or image' };
    if (Number(res.headers.get('content-length')) > MAX_BYTES) return { error: 'too large' };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return { error: 'too large' };
    return { status: res.status, type, body: new Uint8Array(buf) };
  } catch (err) { return { error: err.message || 'failed' }; }
}

function install() {
  // answered synchronously, once per frame: is this site dark? Only when it is does the frame get the engine.
  ipcMain.on('nova:dark', (e, q) => {
    let r = { on: false };
    try { if (C.settings().features.darkSite && tabSession(e) && isOnHost((q && q.top) || (q && q.host))) r = { on: true, theme: theme(), code: q.needCode ? engineCode() : undefined }; } catch (err) { console.error('dark mode', err.message); }
    e.returnValue = r;
  });
  ipcMain.handle('nova:dark-fetch', fetchForEngine);
  ipcMain.on('nova:dark-ack', (e) => { if (!e.senderFrame || e.senderFrame.parent) return; const rs = waiting.get(e.sender.id); waiting.delete(e.sender.id); if (rs) rs.forEach((r) => r(true)); });
}

// Tell every frame of a page to ask again. Resolves false when the main frame never answered, which means the page was opened before the
// preload existed (the feature was switched on while it was open), so the caller reloads it once.
function refresh(wc) {
  if (!wc || wc.isDestroyed()) return Promise.resolve(false);
  const id = wc.id;
  return new Promise((resolve) => {
    waiting.set(id, [...(waiting.get(id) || []), resolve]);
    try { for (const f of wc.mainFrame.framesInSubtree) f.send('nova:dark-refresh'); } catch { return resolve(false); }
    setTimeout(() => { const rs = waiting.get(id); if (rs && rs.includes(resolve)) { const left = rs.filter((r) => r !== resolve); if (left.length) waiting.set(id, left); else waiting.delete(id); } resolve(false); }, 700);
  });
}
const refreshAll = () => { for (const t of C.tabs.values()) if (t.view && !t.view.webContents.isDestroyed()) refresh(t.view.webContents); };

// Registers or removes the frame preload so it follows the Features switch. Call after any change to settings.features.
function sync() {
  const on = !!C.settings().features.darkSite;
  for (const s of C.sessions()) {
    if (on && !preloadIds.has(s)) { try { preloadIds.set(s, s.registerPreloadScript({ type: 'frame', filePath: path.join(__dirname, 'dark-preload.js') })); } catch (e) { console.error('dark preload', e.message); } }
    else if (!on && preloadIds.has(s)) { try { s.unregisterPreloadScript(preloadIds.get(s)); } catch {} preloadIds.delete(s); }
  }
  if (!on && engine) { engine = null; refreshAll(); } // open pages turn light again
}

// The switch for the page in front of the user: remembered per site.
async function toggle(t) {
  const wc = t && t.view && t.view.webContents;
  if (!wc || wc.isDestroyed()) return;
  const url = wc.getURL(), host = hostOf(url), key = keyOf(url);
  if (!host) return C.toast('Dark mode works on web pages.');
  const s = C.settings(), list = sites();
  const hit = list.filter((x) => covers(x, host)), on = !hit.length;
  if (on && t.private) privateSites.add(key); else if (on) s.darkSites = [...(s.darkSites || []), key];
  else { s.darkSites = (s.darkSites || []).filter((x) => !hit.includes(x)); for (const x of hit) privateSites.delete(x); }
  if (!(on && t.private)) C.saveSettings();
  const ok = await refresh(wc);
  if (on && !ok) wc.reload(); // opened before the preload was registered: one reload and it is in place for good
  const touched = (h) => covers(key, h) || hit.some((x) => covers(x, h)); // other tabs on the same site follow
  for (const o of C.tabs.values()) { const w = o !== t && o.view && o.view.webContents; if (w && !w.isDestroyed() && touched(hostOf(w.getURL()))) refresh(w); }
  C.toast(on ? `Dark mode on for ${key}. Switch it off from Ctrl+K.` : `Dark mode off for ${hit[0]}.`);
  C.push();
}

function init(ctx) { C = ctx; install(); sync(); }
module.exports = { init, sync, toggle, refreshAll, isOnUrl, keyOf };
