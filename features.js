// Nova features: data stores (history, bookmarks, session snapshots, snoozed tabs), downloads, extension store,
// tab tools (full-text search across tabs, memory, dark page, mute, clean links) and Peek.
const { app, BrowserWindow, WebContentsView, clipboard, shell, net, dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const extmgr = require('./extmgr');
const { createDownloader } = require('./downloader');

let C; // context from main.js
let history = [], bookmarks = [], snapshots = [], downloads = [], icons = {};
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
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
  return { bookmarks: b.map(withIcon), history: h.map(withIcon), downloads: d, snapshots: wantsSnap && C.settings().features.rewind ? snapshots.slice(0, 8).map((s) => ({ t: s.t, n: s.tabs.length })) : [] };
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
      if (t.frozen) await C.thawTab(t); // a frozen page cannot answer
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
// Everything on its way to disk, whether Chromium or Nova's accelerated downloader (downloader.js) does the work, is one list: progress,
// speed, time left, pause, resume and cancel in the Downloads panel. Finished files go to a history that is kept between starts.
// Big files are handed to the accelerated downloader: Chromium's own download starts first (so the file name and the URL are known), is held
// for a moment while the server is asked what it supports, and is either handed over or simply let go on, so nothing is lost when a server
// cannot do ranges.
let fast = null, dlRev = 0, dlSeen = 0, dlDoneAt = 0, liveSeq = 0;
const liveNormal = new Map(); // id -> { item, rec, samples, probing, handedOver, last }
const finishedFast = new Set();
const bumpDl = () => { dlRev++; C.push(); };
const saveDownloads = () => { downloads.length = Math.min(downloads.length, 60); C.writeJson('downloads.json', downloads); };
const remember = (rec, priv) => { dlDoneAt = Date.now(); if (!priv) { downloads.unshift(rec); saveDownloads(); } bumpDl(); };
const dlCfg = () => ({ fast: true, connections: 8, limitMBs: 0, minMB: 8, panel: false, ...(C.settings().downloads || {}) });
const dlOptions = () => { const c = dlCfg(); return { connections: Math.max(1, Math.min(32, +c.connections || 8)), minSplitMB: Math.max(1, +c.minMB || 8), limitBps: Math.max(0, +c.limitMBs || 0) * 1048576 }; };
function fastDownloader() {
  if (fast) return fast;
  fast = createDownloader({
    fetch: (u, i) => C.ses.fetch(u, { credentials: 'include', ...i }),
    stateFile: file('downloads-active.json'),
    options: dlOptions(),
    onChange: (s) => {
      if ((s.state === 'done' || s.state === 'error') && !finishedFast.has(s.id)) {
        finishedFast.add(s.id);
        remember({ name: s.name, path: s.path, url: s.url, size: s.size, state: s.state === 'done' ? 'completed' : 'interrupted', t: Date.now(), accel: true });
      }
      if (['done', 'error', 'cancelled'].includes(s.state)) setTimeout(() => fast && fast.remove(s.id), 0);
      C.push();
    },
  });
  fast.restore();
  return fast;
}
const liveSpeed = (v) => {
  const now = Date.now(); v.samples.push([now, v.rec.received]);
  while (v.samples.length > 2 && now - v.samples[0][0] > 3000) v.samples.shift();
  const dt = (now - v.samples[0][0]) / 1000;
  return dt > 0.4 ? Math.max(0, Math.round((v.rec.received - v.samples[0][1]) / dt)) : 0;
};
const downloadsLive = () => {
  const out = [];
  if (fast) { fast.setOptions(dlOptions()); for (const j of fast.list()) if (['downloading', 'paused', 'queued'].includes(j.state)) out.push({ ...j, id: 'f' + j.id, accel: true }); }
  for (const v of liveNormal.values()) if (!v.probing && !v.handedOver) out.push(v.rec);
  return out;
};
const dlInfo = () => ({ rev: dlRev, seen: dlSeen, doneAt: dlDoneAt });
function trackNormal(item, p, priv) {
  const id = 'n' + (++liveSeq);
  const rec = { id, name: path.basename(p), path: p, url: item.getURL(), state: 'downloading', size: 0, received: 0, speed: 0, eta: 0, conns: 1, ranged: false, error: '', started: Date.now(), finished: 0, accel: false };
  const v = { item, rec, samples: [[Date.now(), 0]], probing: false, handedOver: false, last: 0 };
  liveNormal.set(id, v);
  item.on('updated', (_e, st) => {
    if (v.handedOver || v.probing) return;
    rec.state = st === 'interrupted' ? (item.canResume() ? 'paused' : 'error') : item.isPaused() ? 'paused' : 'downloading';
    const now = Date.now(); if (now - v.last < 400 && rec.state === 'downloading') return; v.last = now;
    rec.received = item.getReceivedBytes(); rec.size = item.getTotalBytes();
    rec.speed = rec.state === 'downloading' ? liveSpeed(v) : 0;
    rec.eta = rec.speed > 0 && rec.size > rec.received ? Math.round((rec.size - rec.received) / rec.speed) : 0;
    C.push();
  });
  item.on('done', (_e, st) => {
    liveNormal.delete(id);
    if (v.handedOver) return;
    const got = item.getReceivedBytes(), size = item.getTotalBytes() || got;
    if (st === 'completed') remember({ name: rec.name, path: p, url: rec.url, size, state: 'completed', t: Date.now() }, priv);
    else if (st === 'interrupted') remember({ name: rec.name, path: p, url: rec.url, size, state: 'interrupted', t: Date.now() }, priv);
    else bumpDl(); // cancelled: nothing to keep
  });
  return v;
}
function dlControl(op, id) {
  id = String(id);
  if (id[0] === 'n') {
    const v = liveNormal.get(id); if (!v) return;
    try { if (op === 'pause') v.item.pause(); else if (op === 'resume') v.item.resume(); else v.item.cancel(); } catch { /* it just finished */ }
    if (op === 'pause') { v.rec.state = 'paused'; v.rec.speed = 0; v.rec.eta = 0; } else if (op === 'resume') v.rec.state = 'downloading';
    return C.push();
  }
  const f = fastDownloader(), n = +id.slice(1);
  if (op === 'pause') f.pause(n); else if (op === 'resume') f.resume(n); else f.cancel(n);
  C.push();
}
function initDownloads(ses, priv) {
  ses.on('will-download', (_e, item, wc) => {
    dlSeen++;
    const dir = app.getPath('downloads'); let name = item.getFilename(), p = path.join(dir, name), i = 1;
    const ext = path.extname(name), base = path.basename(name, ext);
    while (fs.existsSync(p)) p = path.join(dir, `${base} (${i++})${ext}`);
    item.setSavePath(p);
    const v = trackNormal(item, p, !!priv), url = item.getURL();
    const shown = () => { bumpDl(); try { if (dlCfg().panel && !(C.overlayBusy && C.overlayBusy())) C.openOverlay('downloads', { auto: true }); } catch { /* window is closing */ } };
    if (priv || dlCfg().fast === false || !/^https?:/i.test(url)) return shown();
    try { item.pause(); v.probing = true; } catch { return shown(); }
    (async () => {
      try {
        const f = fastDownloader(); f.setOptions(dlOptions());
        let ref = ''; try { ref = wc && !wc.isDestroyed() ? wc.getURL() : ''; } catch { /* page gone */ }
        const headers = /^https?:/i.test(ref) ? { Referer: ref } : {};
        const info = await f.probe(url, headers);
        if (info.ok && info.ranges && info.size >= dlOptions().minSplitMB * 1048576) {
          v.handedOver = true; liveNormal.delete(v.rec.id); item.cancel();
          f.add({ url, headers, dir, name: item.getFilename(), probed: info });
          return shown();
        }
      } catch (e) { console.error('fast download', e.message); }
      v.probing = false;
      try { item.resume(); } catch { /* the download was cancelled meanwhile */ }
      shown();
    })();
  });
}

// ---------- extensions: install, remove, list and popups live in extmgr.js ----------
const installExtension = (input) => extmgr.install(input);
const removeExtension = (id) => extmgr.remove(id);
const listExtensions = () => extmgr.list().map(({ manifest, ...e }) => e);
const openPopup = (id) => extmgr.openPopup(id);

// ---------- Move in: movein.js reads the other browsers, this adds what it found to Nova ----------
const movein = require('./movein');
const installedExtIds = () => extmgr.installedIds();
function addBookmarks(list) {
  let n = 0;
  for (const b of list) { if (!b.url || isBookmarked(b.url)) continue; bookmarks.push({ url: b.url, title: b.title || '', t: Date.now() }); n++; }
  saveSoon('bookmarks.json', () => bookmarks); return n;
}
const scanBrowsers = () => movein.scan(installedExtIds);
const importBookmarksFrom = (id) => addBookmarks(movein.bookmarksOf(id));
function importBookmarks(name) { // every profile of one browser
  let n = 0; for (const p of scanBrowsers().profiles.filter((x) => x.browser === name)) n += importBookmarksFrom(p.id); return n;
}
function importHistoryFrom(id) {
  try {
    const rows = movein.historyOf(id), known = new Map(history.map((h) => [h.url, h])); let n = 0;
    for (const r of rows) {
      const ex = known.get(r.url);
      if (ex) { ex.n = Math.max(ex.n, r.n); continue; }
      const h = { url: r.url, title: r.title || '', n: r.n, t: r.t > 0 ? r.t : Date.now() }; history.push(h); known.set(r.url, h); n++;
    }
    history.sort((a, b) => b.t - a.t); history.length = Math.min(history.length, 6000); saveSoon('history.json', () => history);
    // give the most visited sites their real icons (one small request per site you already use every day)
    const seen = new Set();
    for (const h of rows.slice(0, 40)) { const host = hostOf(h.url); if (host && !icons[host] && !seen.has(host) && seen.size < 12) { seen.add(host); setIcon(h.url, `https://${host}/favicon.ico`); } }
    return { n };
  } catch (e) { console.error('history import', e.message); return { n: -1, error: /EBUSY|EPERM|locked|busy/i.test(e.message) ? 'The browser is open and keeps its history locked. Close it and try again.' : e.message }; }
}
function importSearchFrom(id) {
  const s = movein.searchOf(id); if (!s) return null;
  const set = C.settings(); set.searchEngine = s.url; C.saveSettings(); C.push(); return s.name;
}
async function importBookmarkFile() { // any browser's export: .html, or a Chrome / Firefox JSON file
  if (process.env.NOVA_DEBUG_SW && process.env.NOVA_TEST_BOOKMARKS_FILE) { try { const list = movein.fileBookmarks(process.env.NOVA_TEST_BOOKMARKS_FILE); return { found: list.length, n: addBookmarks(list), file: path.basename(process.env.NOVA_TEST_BOOKMARKS_FILE) }; } catch (e) { return { error: e.message }; } } // test aid: the native file dialog cannot be driven from outside
  const r = await dialog.showOpenDialog(C.win(), { title: 'Choose a bookmarks file', properties: ['openFile'], filters: [{ name: 'Bookmarks', extensions: ['html', 'htm', 'json'] }, { name: 'All files', extensions: ['*'] }] });
  if (r.canceled || !r.filePaths[0]) return { canceled: true };
  try { const list = movein.fileBookmarks(r.filePaths[0]); return { found: list.length, n: addBookmarks(list), file: path.basename(r.filePaths[0]) }; }
  catch (e) { return { error: 'That file could not be read as bookmarks: ' + e.message }; }
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
  extmgr.init({ ses: ctx.ses, settings: ctx.settings, saveSettings: ctx.saveSettings, push: ctx.push, toast: ctx.toast, userAgent: ctx.userAgent, win: ctx.win, fetch: (u, o) => net.fetch(u, o), sesFetch: (u, o) => ctx.ses.fetch(u, o) });
  history = load('history.json', []); bookmarks = load('bookmarks.json', []); snapshots = load('snapshots.json', []); icons = load('icons.json', {});
  setInterval(snapshot, 5 * 60e3); setTimeout(snapshot, 60e3);
  setInterval(wakeSnoozed, 30e3);
  downloads = load('downloads.json', []);
  initDownloads(ctx.ses, false); if (ctx.privSes) initDownloads(ctx.privSes, true);
  setTimeout(cacheGuard, 45e3); setInterval(cacheGuard, 30 * 60e3);
}

// IPC commands that return data or are purely feature-driven
const GATE = { searchTabs: 'tabSearch', snooze: 'snooze', restoreSnapshot: 'rewind', peek: 'peek', peekOpen: 'peek', darkPage: 'darkPage', copyClean: 'cleanLinks', screenshot: 'screenshot', pip: 'pip', savePdf: 'savePdf', translate: 'translate', newPrivate: 'privateTabs' };
function hub() { // the curated extension list, with what is already installed marked
  let d; try { d = JSON.parse(fs.readFileSync(path.join(__dirname, 'hub.json'), 'utf8')); } catch { return { items: [] }; }
  const have = new Set(installedExtIds());
  return { built: d.built, items: d.items.filter((i) => i.works !== false).map((i) => ({ ...i, installed: have.has(i.id) })) };
}
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
    case 'openDownloadsFolder': shell.openPath(app.getPath('downloads')); return;
    case 'dlPause': dlControl('pause', a.id); return;
    case 'dlResume': dlControl('resume', a.id); return;
    case 'dlCancel': dlControl('cancel', a.id); return;
    case 'dlOpen': if (a.path && fs.existsSync(a.path)) shell.openPath(a.path); return;
    case 'dlRemove': downloads = downloads.filter((x) => x.t !== a.t); saveDownloads(); bumpDl(); return;
    case 'dlClear': downloads = []; saveDownloads(); bumpDl(); return;
    case 'dlRecent': return downloads.slice(0, Math.min(40, +a.n || 12)).map((x) => ({ ...x, exists: fs.existsSync(x.path) }));
    case 'installExt': return installExtension(a.id);
    case 'hub': return hub();
    case 'storeSearch': try { return await extmgr.search(a.q); } catch (e) { return { items: [], total: 0, error: e.message }; }
    case 'storeCategory': try { return await extmgr.category(a.slug); } catch (e) { return { items: [], total: 0, error: e.message }; }
    case 'storeCategories': return extmgr.STORE_CATEGORIES;
    case 'removeExt': return removeExtension(a.id);
    case 'extPopup': openPopup(a.id); return;
    case 'detectBrowsers': return [...new Set(scanBrowsers().profiles.map((p) => p.browser))];
    case 'scanBrowsers': return scanBrowsers();
    case 'library': return library(a.kind, a.q);
    case 'removeBookmark': bookmarks = bookmarks.filter((b) => b.url !== a.url); saveSoon('bookmarks.json', () => bookmarks); C.push(); return;
    case 'removeHistory': history = history.filter((h) => h.url !== a.url); saveSoon('history.json', () => history); return;
    case 'clearData': return clearData(a.what || {}, a.range);
    case 'cacheInfo': { let size = 0; try { size = await C.ses.getCacheSize(); } catch { /* not readable right now */ } return { size, limit: cacheCfg().limitMB * 1048576 }; }
    case 'cacheClean': { await emptyCache(); let size = 0; try { size = await C.ses.getCacheSize(); } catch { /* ignore */ } return { size }; }
    case 'suggest': return suggest(a.q);
    case 'importPart': { // one category at a time so the interface can show live progress
      if (a.part === 'bookmarks') return { n: importBookmarksFrom(a.id) };
      if (a.part === 'history') return importHistoryFrom(a.id);
      if (a.part === 'search') return { name: importSearchFrom(a.id) };
      if (a.part === 'extension') { const r = await installExtension(a.ext); return r.ok ? { ok: true, name: r.name } : { ok: false, error: r.error }; }
      return {};
    }
    case 'importFile': return importBookmarkFile();
    case 'importBookmarks': { const n = importBookmarks(a.name); C.toast(n ? `Imported ${n} bookmarks from ${a.name}.` : `No new bookmarks found in ${a.name}.`); return n; }
    case 'extensions': return listExtensions();
  }
}

// Remember each site's real favicon (as a small data URL) so the start page and Ctrl+K can show it.
const pendingIcons = new Set();
async function setIcon(pageUrl, iconUrl) {
  const host = hostOf(pageUrl);
  if (!host || !iconUrl || icons[host] || pendingIcons.has(host) || !/^https?:|^data:image/i.test(iconUrl)) return;
  pendingIcons.add(host);
  try {
    let data;
    if (iconUrl.startsWith('data:')) data = iconUrl;
    else {
      const r = await C.ses.fetch(iconUrl, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return;
      const ct = (r.headers.get('content-type') || 'image/png').split(';')[0].trim().toLowerCase();
      if (!/^image\//.test(ct) && !(/octet-stream/.test(ct) && /\.ico(\?|$)/i.test(iconUrl))) return;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 60 || buf.length > 70000) return;
      data = `data:${/^image\//.test(ct) ? ct : 'image/x-icon'};base64,${buf.toString('base64')}`;
    }
    icons[host] = data;
    const keys = Object.keys(icons); if (keys.length > 500) delete icons[keys[0]];
    saveSoon('icons.json', () => icons);
  } catch {} finally { pendingIcons.delete(host); }
}
// Bookmarks that came from another browser, or were never opened here, have no icon yet. Nova asks each site for its own, quietly, three at a time:
// the icon the page names, then /favicon.ico, and only if both fail DuckDuckGo's icon service (which is told the host name and nothing else).
function iconCandidates(html, base) {
  const out = [];
  for (const m of String(html).slice(0, 250000).matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\brel\s*=\s*["']?[^"'>]*\bicon\b/i.test(tag)) continue;
    const href = (/\bhref\s*=\s*["']([^"']+)["']/i.exec(tag) || [])[1]; if (!href) continue;
    const size = +((/\bsizes\s*=\s*["'](\d+)x/i.exec(tag) || [])[1] || 0), svg = /\.svg(\?|$)|image\/svg/i.test(tag + href);
    let url; try { url = new URL(href.replace(/&amp;/g, '&'), base).href; } catch { continue; }
    if (!/^https?:/i.test(url)) continue;
    // 32 to 128 px stays sharp at the sizes Nova draws; huge touch icons and vectors come last
    const rank = svg ? 5 : size >= 32 && size <= 128 ? 0 : size === 0 ? 1 : size < 32 ? 2 : 3;
    out.push({ url, rank });
  }
  return out.sort((a, b) => a.rank - b.rank).map((x) => x.url);
}
const iconTried = new Map(), iconWaiting = []; let iconBusy = 0;
const isLocalName = (h) => !h.includes('.') || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || /\.(local|lan|internal|home|localhost)$/.test(h);
async function discoverIcon(host) {
  const base = `https://${host}/`, urls = [];
  try {
    const r = await C.ses.fetch(base, { signal: AbortSignal.timeout(7000), headers: { Accept: 'text/html' } });
    if (r.ok && /html/i.test(r.headers.get('content-type') || '')) urls.push(...iconCandidates(await r.text(), r.url || base));
  } catch { /* the site is unreachable or slow: fall through to the plain locations */ }
  urls.push(`${base}favicon.ico`);
  for (const u of urls.slice(0, 4)) { await setIcon(base, u); if (icons[host]) return; }
  await setIcon(base, `https://icons.duckduckgo.com/ip3/${host}.ico`);
}
function queueIcons(list) {
  for (const b of list) {
    const h = hostOf(b.url);
    if (!h || icons[h] || isLocalName(h) || Date.now() - (iconTried.get(h) || 0) < 6 * 3600e3) continue;
    iconTried.set(h, Date.now()); iconWaiting.push(h);
  }
  pumpIcons();
}
function pumpIcons() {
  while (iconBusy < 3 && iconWaiting.length) {
    const h = iconWaiting.shift(); iconBusy++;
    discoverIcon(h).catch(() => {}).finally(() => { iconBusy--; if (icons[h]) C.push(); pumpIcons(); });
  }
}
const withIcon = (x) => ({ ...x, icon: icons[hostOf(x.url)] || '' });
const barBookmarks = () => queueIcons(bookmarks.slice(0, 80)) || [...bookmarks].reverse().slice(0, 60).map((b) => ({ url: b.url, title: b.title, icon: icons[hostOf(b.url)] || '' })); // oldest first, like a bar you fill from the left

function hostVisits(host) { let n = 0; for (const h of history) if (hostOf(h.url) === host) n += h.n; return n; } // page loads of a site, for smart sleep's first guess
function topSites(n = 8) { // bookmarks first, then the most visited hosts
  const seen = new Set(), out = [];
  const add = (x) => { let host; try { host = new URL(x.url).hostname.replace(/^www\./, ''); } catch { return; } if (seen.has(host) || out.length >= n) return; seen.add(host); out.push({ url: x.url, host, title: x.title, icon: icons[host] || '' }); };
  bookmarks.slice(0, 4).forEach(add);
  [...history].sort((a, b) => b.n - a.n || b.t - a.t).forEach(add);
  return out;
}
// ---------- library: browse and clean up what Nova remembers ----------
function library(kind, q = '') {
  const f = (list) => (q ? list.filter((x) => score(q, x.title, x.url) >= 0) : list);
  if (kind === 'bookmarks') return f(bookmarks).slice(0, 500).map(withIcon);
  if (kind === 'history') return f(history).slice(0, 400).map(withIcon);
  if (kind === 'downloads') return downloads.slice(0, 100).map((x) => ({ ...x, exists: fs.existsSync(x.path) }));
  return [];
}
// The page cache on disk. Chromium keeps it under the limit by itself (the disk-cache-size switch set at start); this is the safety net
// that empties it if it ever grows well past the limit, checked half an hour at a time and once shortly after start.
const cacheCfg = () => ({ limitMB: 500, auto: true, ...(C.settings().cache || {}) });
async function emptyCache() { try { await C.ses.clearCache(); await C.ses.clearCodeCaches({ urls: [] }); } catch { /* cache busy */ } }
async function cacheGuard() {
  const c = cacheCfg(); if (!c.auto || !(c.limitMB > 0)) return;
  try { if ((await C.ses.getCacheSize()) > c.limitMB * 1048576 * 1.25) await emptyCache(); } catch { /* ignore */ }
}
// Floating video: leaving a tab that is playing a video pops the video out, coming back puts it back.
// The request is sent before the tab is hidden, as if you had clicked the button yourself.
const autoPipped = new Set();
function onLeave(t) {
  if (!t || !t.view || !t.audible || !C.settings().features.autoPip) return;
  const wc = t.view.webContents; if (wc.isDestroyed()) return;
  wc.executeJavaScript("(()=>{if(document.pictureInPictureElement)return 'no';const v=[...document.querySelectorAll('video')].filter((v)=>!v.paused&&!v.ended&&v.readyState>2&&v.clientWidth>160&&!v.disablePictureInPicture).sort((a,b)=>b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight)[0];if(!v)return 'no';v.requestPictureInPicture().catch(()=>{});return 'ok'})()", true)
    .then((r) => { if (r === 'ok') autoPipped.add(t.id); }).catch(() => { /* page gone */ });
}
function onArrive(t) {
  if (!t || !autoPipped.delete(t.id) || !t.view) return;
  const wc = t.view.webContents; if (!wc.isDestroyed()) wc.executeJavaScript('document.pictureInPictureElement&&document.exitPictureInPicture().catch(()=>{})', true).catch(() => { /* page gone */ });
}
async function clearData(what, range) {
  const since = { hour: 3600e3, day: 86400e3, week: 7 * 86400e3, all: Infinity }[range] ?? Infinity, cut = Date.now() - since, ses = C.ses;
  if (what.history) { C.forgetRevisits(); history = since === Infinity ? [] : history.filter((h) => h.t < cut); C.writeJson('history.json', history); if (since === Infinity) { icons = {}; C.writeJson('icons.json', icons); } }
  if (what.downloads) { downloads = []; saveDownloads(); dlRev++; }
  if (what.cookies) await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage'] });
  if (what.cache) await ses.clearCache();
  C.toast('Cleared.');
}
const ENGINE_SUGGEST = [['duckduckgo.com', (q) => `https://duckduckgo.com/ac/?type=list&q=${q}`], ['google.', (q) => `https://suggestqueries.google.com/complete/search?client=firefox&q=${q}`], ['search.brave.com', (q) => `https://search.brave.com/api/suggest?q=${q}`], ['bing.com', (q) => `https://api.bing.com/osjson.aspx?query=${q}`]];
async function suggest(q) {
  const tpl = C.settings().searchEngine, e = ENGINE_SUGGEST.find(([h]) => tpl.includes(h)); if (!e || !C.settings().suggestions || !q || q.length < 2) return [];
  try { const r = await C.ses.fetch(e[1](encodeURIComponent(q)), { signal: AbortSignal.timeout(1800) }); const j = await r.json(); return (Array.isArray(j[1]) ? j[1] : []).slice(0, 5).map(String); } catch { return []; }
}
module.exports = { init, onLeave, onArrive, downloadsLive, dlInfo, shutdown: () => { if (fast) fast.shutdown(); }, hostVisits, topSites, setIcon, handle, recordVisit, cleanUrl, applyDark, onAudio, closePeek, relayoutPeek, isPeek: () => !!peek, listExtensions, bookmarks: () => bookmarks, barBookmarks, isBookmarked };
