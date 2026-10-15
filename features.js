// Nova features: data stores (history, bookmarks, session snapshots, snoozed tabs), downloads, extension store,
// tab tools (full-text search across tabs, memory, dark page, mute, clean links) and Peek.
const { app, BrowserWindow, WebContentsView, clipboard, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

let C; // context from main.js
let history = [], bookmarks = [], snapshots = [], downloads = [];
let peek = null; // { view, url }
const saveTimers = {};

const file = (n) => C.userFile(n);
const load = (n, d) => C.readJson(n, d);
function saveSoon(name, get) { clearTimeout(saveTimers[name]); saveTimers[name] = setTimeout(() => C.writeJson(name, get()), 1500); }

const TRACKERS = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_eid|mc_cid|igshid|yclid|_hsenc|_hsmi|ref_src|ref_url|si|spm|vero_id)$/i;
const cleanUrl = (u) => { try { const x = new URL(u); for (const k of [...x.searchParams.keys()]) if (TRACKERS.test(k)) x.searchParams.delete(k); return x.href; } catch { return u; } };

// ---------- history & bookmarks ----------
function recordVisit(url, title) {
  if (!C.settings().keepHistory) return;
  if (!/^https?:/i.test(url)) return;
  let h = history.find((x) => x.url === url);
  if (!h) { h = { url, title: title || '', n: 0, t: 0 }; history.unshift(h); if (history.length > 6000) history.length = 6000; }
  h.n++; h.t = Date.now(); if (title) h.title = title;
  saveSoon('history.json', () => history);
}
const isBookmarked = (url) => bookmarks.some((b) => b.url === url);
function toggleBookmark(t) {
  if (!t || !/^https?:/i.test(t.url)) return C.toast('Only web pages can be bookmarked.');
  const i = bookmarks.findIndex((b) => b.url === t.url);
  if (i >= 0) { bookmarks.splice(i, 1); C.toast('Bookmark removed'); } else { bookmarks.unshift({ url: t.url, title: t.title, t: Date.now() }); C.toast('Bookmarked. Find it any time with Ctrl+K.'); }
  saveSoon('bookmarks.json', () => bookmarks);
}
const score = (q, ...f) => { const hay = f.join(' ').toLowerCase(); let s = 0; for (const w of q.toLowerCase().split(/\s+/).filter(Boolean)) { const i = hay.indexOf(w); if (i < 0) return -1; s += 100 - Math.min(i, 99); } return s; };
function query(text) {
  const q = (text || '').trim();
  if (!q) return { bookmarks: [], history: [], downloads: downloads.slice(0, 3), snapshots: [] };
  const b = bookmarks.map((x) => ({ x, s: score(q, x.title, x.url) })).filter((r) => r.s >= 0).sort((a, c) => c.s - a.s).slice(0, 4).map((r) => r.x);
  const h = history.map((x) => ({ x, s: score(q, x.title, x.url) })).filter((r) => r.s >= 0).sort((a, c) => (c.s + Math.log(1 + c.x.n) * 10) - (a.s + Math.log(1 + a.x.n) * 10)).slice(0, 5).map((r) => r.x).filter((x) => !b.some((y) => y.url === x.url));
  const wantsSnap = /rewind|restore|session|undo/i.test(q);
  const d = /down|file/i.test(q) ? downloads.slice(0, 5) : [];
  return { bookmarks: b, history: h, downloads: d, snapshots: wantsSnap && C.settings().features.rewind ? snapshots.slice(0, 8).map((s) => ({ t: s.t, n: s.tabs.length })) : [] };
}

// ---------- session snapshots ("Rewind") ----------
let lastSnap = '';
function snapshot() {
  if (!C.settings().features.rewind) return;
  const tabs = [...C.tabs.values()].filter((t) => !/^nova:/.test(t.url)).map((t) => ({ url: t.url, title: t.title, spaceId: t.spaceId, pinned: t.pinned }));
  const key = JSON.stringify(tabs.map((t) => t.url));
  if (!tabs.length || key === lastSnap) return;
  lastSnap = key; snapshots.unshift({ t: Date.now(), tabs }); snapshots.length = Math.min(snapshots.length, 48);
  C.writeJson('snapshots.json', snapshots);
}
function restoreSnapshot(t) {
  const s = snapshots.find((x) => x.t === t); if (!s) return;
  const open = new Set([...C.tabs.values()].map((x) => x.url)); let n = 0;
  for (const x of s.tabs) if (!open.has(x.url)) { C.addBackgroundTab(x); n++; }
  C.toast(n ? `Brought back ${n} tab(s) from ${new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : 'Everything from that moment is already open.');
}

// ---------- snooze ("Boomerang") ----------
function snooze(tab, until) {
  const st = C.state();
  st.snoozed = st.snoozed || [];
  st.snoozed.push({ url: tab.url, title: tab.title, favicon: tab.favicon, spaceId: tab.spaceId, until });
  C.closeTab(tab.id);
  C.toast(`Snoozed until ${new Date(until).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.`);
}
function wakeSnoozed() {
  const st = C.state(); if (!st.snoozed?.length) return;
  const now = Date.now(); const due = st.snoozed.filter((s) => s.until <= now);
  if (!due.length) return;
  st.snoozed = st.snoozed.filter((s) => s.until > now);
  for (const s of due) C.addBackgroundTab(s);
  C.toast(`Back from snooze: ${due.map((d) => d.title || d.url).slice(0, 2).join(', ')}`);
}

// ---------- tab tools ----------
async function searchTabs(text) {
  const q = (text || '').trim().toLowerCase(); if (q.length < 2) return [];
  const jobs = [...C.tabs.values()].filter((t) => t.view && !t.view.webContents.isDestroyed()).map(async (t) => {
    try {
      const r = await Promise.race([t.view.webContents.executeJavaScript(`(()=>{const q=${JSON.stringify(q)};const x=(document.body&&document.body.innerText)||'';const i=x.toLowerCase().indexOf(q);return i<0?null:x.slice(Math.max(0,i-60),i+110).replace(/\\s+/g,' ')})()`), new Promise((r) => setTimeout(() => r(null), 1800))]);
      return r ? { id: t.id, snippet: r } : null;
    } catch { return null; }
  });
  return (await Promise.all(jobs)).filter(Boolean);
}
function memory() {
  const byPid = new Map(app.getAppMetrics().map((m) => [m.pid, m.memory.workingSetSize / 1024]));
  const out = {};
  for (const t of C.tabs.values()) { try { if (t.view) out[t.id] = Math.round(byPid.get(t.view.webContents.getOSProcessId()) || 0); } catch {} }
  return out;
}
const DARK_CSS = 'html{filter:invert(.92) hue-rotate(180deg)!important;background:#fff!important}img,video,picture,canvas,svg image,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)!important}';
async function applyDark(t) {
  if (!t.view || t.view.webContents.isDestroyed()) return;
  const wc = t.view.webContents;
  if (t.darkKey) { try { await wc.removeInsertedCSS(t.darkKey); } catch {} t.darkKey = null; }
  if (t.dark) t.darkKey = await wc.insertCSS(DARK_CSS).catch(() => null);
}
function toggleDark(t) { if (!t) return; t.dark = !t.dark; applyDark(t); C.push(); }
function toggleMute(t) { if (!t?.view) return; const wc = t.view.webContents; wc.setAudioMuted(!wc.isAudioMuted()); t.muted = wc.isAudioMuted(); C.push(); }
function onAudio(t) { // "one sound at a time"
  if (!C.settings().features.soloAudio || !t.audible) return;
  for (const o of C.tabs.values()) if (o !== t && o.audible && o.view) o.view.webContents.executeJavaScript("document.querySelectorAll('video,audio').forEach(m=>{try{m.pause()}catch(e){}})").catch(() => {});
}

// ---------- downloads ----------
function initDownloads(ses) {
  ses.on('will-download', (_e, item) => {
    const dir = app.getPath('downloads'); let name = item.getFilename(), p = path.join(dir, name), i = 1;
    const ext = path.extname(name), base = path.basename(name, ext);
    while (fs.existsSync(p)) p = path.join(dir, `${base} (${i++})${ext}`);
    item.setSavePath(p);
    const d = { name: path.basename(p), path: p, state: 'progressing', t: Date.now() }; downloads.unshift(d); downloads.length = Math.min(downloads.length, 30);
    C.toast(`Downloading ${d.name}…`);
    item.on('done', (_ev, state) => { d.state = state; C.toast(state === 'completed' ? `Downloaded ${d.name}. Ctrl+K › “downloads” to open it.` : `Download ${state}: ${d.name}`); });
  });
}

// ---------- extensions: one-click install from the Chrome Web Store ----------
const extDir = () => path.join(app.getPath('userData'), 'extensions');
async function installExtension(input) {
  const id = String(input).match(/[a-p]{32}/)?.[0];
  if (!id) return { ok: false, error: 'That is not a Chrome Web Store link or extension ID.' };
  try {
    const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${process.versions.chrome}&acceptformat=crx2,crx3&x=${encodeURIComponent(`id=${id}&installsource=ondemand&uc`)}`;
    const res = await fetch(url, { headers: { 'User-Agent': C.userAgent } });
    if (!res.ok) throw new Error('Web Store answered ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 4).toString() !== 'Cr24') throw new Error('Unexpected file from the Web Store');
    const ver = buf.readUInt32LE(4);
    const zipAt = ver === 3 ? 12 + buf.readUInt32LE(8) : 16 + buf.readUInt32LE(8) + buf.readUInt32LE(12);
    const dir = path.join(extDir(), id);
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    new AdmZip(buf.subarray(zipAt)).extractAllTo(dir, true);
    const ext = await C.ses.extensions.loadExtension(dir, { allowFileAccess: true });
    const s = C.settings(); s.extensions = [...new Set([...(s.extensions || []), dir])]; C.saveSettings(); C.push();
    return { ok: true, name: ext.name, id: ext.id };
  } catch (e) { return { ok: false, error: e.message }; }
}
async function removeExtension(id) {
  try { await C.ses.extensions.removeExtension(id); } catch {}
  const s = C.settings(); s.extensions = (s.extensions || []).filter((p) => !p.includes(id) && !p.endsWith(id));
  for (const e of listExtensions()) if (e.id === id) { try { fs.rmSync(e.path, { recursive: true, force: true }); } catch {} }
  s.extensions = s.extensions.filter((p) => fs.existsSync(p)); C.saveSettings(); C.push();
}
const iconCache = {};
function listExtensions() {
  return C.ses.extensions.getAllExtensions().map((e) => {
    const m = e.manifest || {}, icons = m.icons || (m.action || m.browser_action || {}).default_icon || {};
    const best = typeof icons === 'string' ? icons : icons[Object.keys(icons).sort((a, b) => b - a)[0]];
    if (best && !iconCache[e.id]) { try { iconCache[e.id] = 'data:image/png;base64,' + fs.readFileSync(path.join(e.path, best)).toString('base64'); } catch {} }
    const act = m.action || m.browser_action || {};
    return { id: e.id, name: e.name, path: e.path, version: e.version, icon: iconCache[e.id] || '', popup: act.default_popup || '' };
  });
}
function openPopup(id) {
  const e = C.ses.extensions.getExtension(id), m = e?.manifest || {}, popup = (m.action || m.browser_action || {}).default_popup;
  if (!popup) return C.toast(`${e?.name || 'This extension'} has no popup.`);
  const b = C.win().getBounds(), right = C.settings().layout === 'right';
  const pw = new BrowserWindow({ width: 380, height: 580, x: right ? b.x + b.width - 400 : b.x + (C.settings().layout === 'top' ? b.width - 400 : 16), y: C.settings().layout === 'top' ? b.y + 90 : b.y + b.height - 600, frame: false, resizable: false, skipTaskbar: true, alwaysOnTop: true, show: false, backgroundColor: '#ffffff', webPreferences: { session: C.ses, sandbox: true } });
  pw.loadURL(`chrome-extension://${id}/${popup}`).catch(() => pw.close());
  pw.once('ready-to-show', () => pw.show());
  pw.on('blur', () => { if (!pw.isDestroyed() && !pw.webContents.isDevToolsOpened()) pw.close(); });
}

// ---------- import bookmarks from other browsers (plain JSON files; no logins or cookies are touched) ----------
const BROWSERS = { Chrome: ['Google', 'Chrome'], Edge: ['Microsoft', 'Edge'], Brave: ['BraveSoftware', 'Brave-Browser'], Vivaldi: ['Vivaldi'], Opera: null };
function bookmarkFiles() {
  const out = {};
  for (const [name, parts] of Object.entries(BROWSERS)) {
    if (!parts) continue;
    const root = path.join(process.env.LOCALAPPDATA || '', ...parts, 'User Data');
    try { for (const p of ['Default', ...fs.readdirSync(root).filter((d) => /^Profile \d+$/.test(d))]) { const f = path.join(root, p, 'Bookmarks'); if (fs.existsSync(f)) (out[name] = out[name] || []).push(f); } } catch {}
  }
  return out;
}
function importBookmarks(name) {
  const files = bookmarkFiles()[name] || []; let n = 0;
  const walk = (node) => { if (node.type === 'url' && /^https?:/i.test(node.url)) { if (!isBookmarked(node.url)) { bookmarks.push({ url: node.url, title: node.name, t: Date.now() }); n++; } } (node.children || []).forEach(walk); };
  for (const f of files) { try { Object.values(JSON.parse(fs.readFileSync(f, 'utf8')).roots || {}).forEach((r) => r && typeof r === 'object' && walk(r)); } catch {} }
  saveSoon('bookmarks.json', () => bookmarks);
  return n;
}

// ---------- Peek: preview a link in a floating card ----------
function peekBounds() { const [w, h] = C.win().getContentSize(); return { x: Math.round(w * 0.1), y: 76, width: Math.round(w * 0.8), height: h - 100 }; }
function openPeek(url) {
  closePeek();
  const view = new WebContentsView({ webPreferences: { partition: 'persist:nova', sandbox: true, contextIsolation: true } });
  view.setBackgroundColor('#ffffff'); try { view.setBorderRadius(14); } catch {}
  peek = { view, url };
  view.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && i.key === 'Escape') { e.preventDefault(); C.closeOverlay(); } });
  view.webContents.setWindowOpenHandler(({ url: u }) => { view.webContents.loadURL(u); return { action: 'deny' }; });
  view.webContents.on('did-navigate', () => { peek.url = view.webContents.getURL(); C.ui().webContents.send('peek', { url: peek.url, title: view.webContents.getTitle() }); });
  view.webContents.on('page-title-updated', (_e, t) => C.ui().webContents.send('peek', { url: peek.url, title: t }));
  view.webContents.loadURL(url).catch(() => {});
  C.openOverlay('peek', { url });
  view.setBounds(peekBounds()); C.win().contentView.addChildView(view); view.webContents.focus();
}
function closePeek() { if (!peek) return; try { C.win().contentView.removeChildView(peek.view); if (!peek.view.webContents.isDestroyed()) peek.view.webContents.close(); } catch {} peek = null; }
const peekUrl = () => peek?.url;
function relayoutPeek() { if (peek) peek.view.setBounds(peekBounds()); }

function init(ctx) {
  C = ctx;
  history = load('history.json', []); bookmarks = load('bookmarks.json', []); snapshots = load('snapshots.json', []);
  setInterval(snapshot, 5 * 60e3); setTimeout(snapshot, 60e3);
  setInterval(wakeSnoozed, 30e3);
  initDownloads(ctx.ses); if (ctx.privSes) initDownloads(ctx.privSes);
}

// IPC commands that return data or are purely feature-driven
const GATE = { searchTabs: 'tabSearch', snooze: 'snooze', restoreSnapshot: 'rewind', peek: 'peek', peekOpen: 'peek', darkPage: 'darkPage', copyClean: 'cleanLinks', screenshot: 'screenshot', pip: 'pip', savePdf: 'savePdf', translate: 'translate', newPrivate: 'privateTabs' };
async function handle(name, a, t) {
  if (GATE[name] && !C.settings().features[GATE[name]]) return name === 'searchTabs' ? [] : name === 'memory' ? {} : undefined;
  switch (name) {
    case 'query': return query(a.text);
    case 'searchTabs': return searchTabs(a.text);
    case 'memory': return C.budgetTabs();
    case 'bookmark': if (t?.private) return C.toast('Private tabs cannot be bookmarked.'); toggleBookmark(t); return;
    case 'screenshot': { const wc = t?.view?.webContents; if (!wc) return; let img = await wc.capturePage().catch(() => null); if (!img || img.isEmpty()) { C.win().focus(); await new Promise((r) => setTimeout(r, 300)); img = await wc.capturePage().catch(() => null); } if (!img || img.isEmpty()) return C.toast('Could not capture the page. Bring Nova to the front and try again.'); const dir = path.join(app.getPath('pictures'), 'Nova'); fs.mkdirSync(dir, { recursive: true }); const f = path.join(dir, `Nova ${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`); fs.writeFileSync(f, img.toPNG()); clipboard.writeImage(img); C.toast('Screenshot saved to Pictures/Nova and copied.'); return; }
    case 'pip': { const wc = t?.view?.webContents; if (!wc) return; const r = await wc.executeJavaScript("(()=>{const v=[...document.querySelectorAll('video')].sort((a,b)=>b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight)[0];if(!v)return 'none';if(document.pictureInPictureElement){document.exitPictureInPicture();return 'exit'}v.requestPictureInPicture();return 'ok'})()", true).catch(() => 'none'); if (r === 'none') C.toast('No video on this page.'); return; }
    case 'savePdf': { const wc = t?.view?.webContents; if (!wc) return; const data = await wc.printToPDF({ printBackground: true }); const name = (t.title || 'page').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'page'; const f = path.join(app.getPath('downloads'), name + '.pdf'); fs.writeFileSync(f, data); C.toast(`Saved ${name}.pdf to Downloads.`); return; }
    case 'translate': if (t && /^https?:/i.test(t.url)) C.openUrl(`https://translate.google.com/translate?sl=auto&tl=${app.getLocale().slice(0, 2)}&u=${encodeURIComponent(t.url)}`, { forceNew: true }); return;
    case 'newPrivate': C.newPrivateTab(); return;
    case 'snooze': if (t) snooze(t, a.until); return;
    case 'restoreSnapshot': restoreSnapshot(a.t); return;
    case 'darkPage': toggleDark(t); return;
    case 'mute': toggleMute(t); return;
    case 'copyClean': if (t) { clipboard.writeText(cleanUrl(t.url)); C.toast('Copied link without tracking junk.'); } return;
    case 'copy': clipboard.writeText(String(a.text)); C.toast('Copied'); return;
    case 'peek': openPeek(a.url); return;
    case 'peekOpen': { const u = peekUrl() || a.url; C.closeOverlay(); C.openUrl(u, { forceNew: true }); return; }
    case 'showDownload': shell.showItemInFolder(a.path); return;
    case 'installExt': return installExtension(a.id);
    case 'removeExt': return removeExtension(a.id);
    case 'extPopup': openPopup(a.id); return;
    case 'detectBrowsers': return Object.keys(bookmarkFiles());
    case 'importBookmarks': { const n = importBookmarks(a.name); C.toast(n ? `Imported ${n} bookmarks from ${a.name}.` : `No new bookmarks found in ${a.name}.`); return n; }
    case 'extensions': return listExtensions();
  }
}

function topSites(n = 8) { // bookmarks first, then the most visited hosts
  const seen = new Set(), out = [];
  const add = (x) => { let host; try { host = new URL(x.url).hostname.replace(/^www\./, ''); } catch { return; } if (seen.has(host) || out.length >= n) return; seen.add(host); out.push({ url: x.url, host, title: x.title }); };
  bookmarks.slice(0, 4).forEach(add);
  [...history].sort((a, b) => b.n - a.n || b.t - a.t).forEach(add);
  return out;
}
module.exports = { init, topSites, handle, recordVisit, cleanUrl, applyDark, onAudio, closePeek, relayoutPeek, isPeek: () => !!peek, listExtensions, bookmarks: () => bookmarks, isBookmarked };
