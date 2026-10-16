// Nova's "Move in": finds the other browsers on this PC and reads what they keep as plain files, so bookmarks, history, extensions and the
// default search engine can come over. Passwords and signed-in sessions are encrypted by the old browser and are never touched.
// Chrome, Edge, Brave, Vivaldi, Opera, Yandex and Chromium (any channel, any profile) share one format; Firefox keeps its data in SQLite.
// A bookmarks file (HTML or JSON, which every browser can export) works for anything else.
const fs = require('fs');
const os = require('os');
const path = require('path');

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return null; } };
const exists = (f) => { try { return fs.existsSync(f); } catch { return false; } };
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

// every place a browser can live; the environment is read on each call so tests can point it elsewhere
function locations() {
  const L = process.env.LOCALAPPDATA || '', R = process.env.APPDATA || '';
  const c = (browser, icon, ...p) => ({ browser, icon, kind: 'chromium', root: path.join(L, ...p, 'User Data') });
  return [
    c('Chrome', 'br-chrome', 'Google', 'Chrome'), c('Chrome Beta', 'br-chrome', 'Google', 'Chrome Beta'), c('Chrome Dev', 'br-chrome', 'Google', 'Chrome Dev'), c('Chrome Canary', 'br-chrome', 'Google', 'Chrome SxS'), c('Chromium', 'br-chromium', 'Chromium'),
    c('Edge', 'br-edge', 'Microsoft', 'Edge'), c('Edge Beta', 'br-edge', 'Microsoft', 'Edge Beta'), c('Edge Dev', 'br-edge', 'Microsoft', 'Edge Dev'), c('Edge Canary', 'br-edge', 'Microsoft', 'Edge SxS'),
    c('Brave', 'br-brave', 'BraveSoftware', 'Brave-Browser'), c('Brave Beta', 'br-brave', 'BraveSoftware', 'Brave-Browser-Beta'), c('Brave Nightly', 'br-brave', 'BraveSoftware', 'Brave-Browser-Nightly'),
    c('Vivaldi', 'br-vivaldi', 'Vivaldi'), c('Yandex', 'br-yandex', 'Yandex', 'YandexBrowser'),
    { browser: 'Opera', icon: 'br-opera', kind: 'opera', root: path.join(R, 'Opera Software', 'Opera Stable') },
    { browser: 'Opera GX', icon: 'br-opera', kind: 'opera', root: path.join(R, 'Opera Software', 'Opera GX Stable') },
    { browser: 'Firefox', icon: 'br-firefox', kind: 'firefox', root: path.join(R, 'Mozilla', 'Firefox') },
  ];
}

// ---------- Chromium family ----------
function chromiumProfiles(root) {
  const names = {}, cache = (readJson(path.join(root, 'Local State')) || {}).profile?.info_cache;
  if (cache) for (const [k, v] of Object.entries(cache)) names[k] = v && v.name;
  let dirs = [];
  try { dirs = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && (e.name === 'Default' || /^Profile \d+$/.test(e.name) || e.name in names) && exists(path.join(root, e.name, 'Preferences'))).map((e) => e.name); } catch { return []; }
  return dirs.sort((a, b) => (a === 'Default' ? -1 : b === 'Default' ? 1 : a.localeCompare(b, undefined, { numeric: true }))).map((d) => ({ dir: path.join(root, d), id: d, label: names[d] || (readJson(path.join(root, d, 'Preferences')) || {}).profile?.name || d }));
}
function walkChrome(node, out, folder = '') {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'url' && /^https?:/i.test(node.url || '')) out.push({ url: node.url, title: node.name || '', folder });
  const next = node.type === 'folder' && node.name ? node.name : folder;
  (node.children || []).forEach((c) => walkChrome(c, out, next));
}
function chromeBookmarks(profileDir) { // Chrome keeps the bookmarks of a signed-in account in a second file, AccountBookmarks
  const out = [];
  for (const f of ['Bookmarks', 'AccountBookmarks']) { const j = readJson(path.join(profileDir, f)); if (j) Object.values(j.roots || {}).forEach((r) => walkChrome(r, out)); }
  return dedupe(out);
}
function dedupe(list) { const seen = new Set(), out = []; for (const b of list) if (b.url && !seen.has(b.url)) { seen.add(b.url); out.push(b); } return out; }
function resolveName(dir, manifest) {
  const raw = String(manifest.name || '');
  const m = /^__MSG_(.+)__$/.exec(raw); if (!m) return raw;
  let locales = []; try { locales = fs.readdirSync(path.join(dir, '_locales')); } catch { /* none shipped */ }
  const order = [manifest.default_locale, 'en', 'en_US', 'en_GB', 'de', ...locales].filter(Boolean);
  for (const loc of [...new Set(order)]) {
    const msgs = readJson(path.join(dir, '_locales', loc, 'messages.json')); if (!msgs) continue;
    const k = Object.keys(msgs).find((x) => x.toLowerCase() === m[1].toLowerCase());
    if (k && msgs[k].message) return msgs[k].message;
  }
  return '';
}
const BUILT_IN = new Set(['ahfgeienlihckogmohjhadlkjgocpleb', 'nmmhkkegccagdldgiimedpiccmgmieda', 'pjkljhegncpnkpknbcohdijeoejaedia', 'apdfllckaahabafndbhieahigkjlhalf', 'blpcfgokakmgnkcojhhkbfbldkacnbeo', 'aapocclcgogkmnckokdopfmhonfmgoek', 'felcaaldnbdncclmgdcncolpebgiejap', 'aohghmighlieiainnegkcijnilegjfgn']); // Chrome's own helper apps
function chromeExtensions(profileDir) {
  const root = path.join(profileDir, 'Extensions'), out = [];
  const prefs = (readJson(path.join(profileDir, 'Preferences')) || {}).extensions?.settings || {};
  let ids = []; try { ids = fs.readdirSync(root).filter((d) => /^[a-p]{32}$/.test(d) && !BUILT_IN.has(d)); } catch { return out; }
  for (const id of ids) {
    try {
      const vers = fs.readdirSync(path.join(root, id)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), dir = path.join(root, id, vers[vers.length - 1]);
      const manifest = readJson(path.join(dir, 'manifest.json')); if (!manifest || manifest.theme || manifest.app) continue; // themes and old Chrome apps are not extensions
      out.push({ id, name: resolveName(dir, manifest) || manifest.short_name || id, version: manifest.version || '', disabled: !!(prefs[id] && prefs[id].state === 0) });
    } catch { /* unreadable folder: skip this one only */ }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
function chromiumSearch(profileDir) {
  const tpl = (readJson(path.join(profileDir, 'Preferences')) || {}).default_search_provider_data?.template_url_data;
  return tpl && tpl.url && tpl.url.includes('{searchTerms}') ? { name: tpl.short_name || hostOf(tpl.url), url: tpl.url.replace('{searchTerms}', '%s').replace(/\{[^}]+\}/g, '') } : null;
}

// ---------- Firefox ----------
function firefoxProfiles(root) {
  const out = [], ini = (() => { try { return fs.readFileSync(path.join(root, 'profiles.ini'), 'utf8'); } catch { return ''; } })();
  const seen = new Set();
  for (const block of ini.split(/\r?\n(?=\[)/)) {
    const p = /^Path=(.+)$/m.exec(block), n = /^Name=(.+)$/m.exec(block), rel = /^IsRelative=(\d)/m.exec(block);
    if (!p) continue;
    const dir = rel && rel[1] === '0' ? p[1].trim() : path.join(root, p[1].trim().replace(/\//g, path.sep));
    if (exists(path.join(dir, 'places.sqlite')) && !seen.has(dir)) { seen.add(dir); out.push({ dir, id: path.basename(dir), label: n ? n[1].trim() : path.basename(dir) }); }
  }
  try { for (const e of fs.readdirSync(path.join(root, 'Profiles'), { withFileTypes: true })) { const dir = path.join(root, 'Profiles', e.name); if (e.isDirectory() && exists(path.join(dir, 'places.sqlite')) && !seen.has(dir)) { seen.add(dir); out.push({ dir, id: e.name, label: e.name.replace(/^[a-z0-9]{8}\./, '') }); } } } catch { /* no Profiles folder */ }
  return out;
}
// Firefox keeps places.sqlite open while it runs; a copy (with its write-ahead log) can be read
function withPlaces(profileDir, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-places-'));
  try {
    for (const f of ['places.sqlite', 'places.sqlite-wal', 'places.sqlite-shm']) if (exists(path.join(profileDir, f))) fs.copyFileSync(path.join(profileDir, f), path.join(tmp, f));
    const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(path.join(tmp, 'places.sqlite'), { readOnly: true });
    try { return fn(db); } finally { db.close(); }
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp folder stays */ } }
}
function firefoxBookmarks(profileDir) {
  return withPlaces(profileDir, (db) => db.prepare("SELECT p.url AS url, COALESCE(b.title, p.title, '') AS title FROM moz_bookmarks b JOIN moz_places p ON b.fk = p.id WHERE b.type = 1 AND p.url LIKE 'http%'").all().map((r) => ({ url: r.url, title: r.title, folder: '' })));
}
function firefoxHistory(profileDir) {
  return withPlaces(profileDir, (db) => db.prepare("SELECT url, title, visit_count AS n, COALESCE(last_visit_date, 0) / 1000 AS ms FROM moz_places WHERE visit_count > 0 AND hidden = 0 AND url LIKE 'http%' ORDER BY visit_count DESC, last_visit_date DESC LIMIT 4000").all().map((r) => ({ url: r.url, title: r.title || '', n: r.n, t: Number(r.ms) || 0 })));
}
function firefoxExtensions(profileDir) {
  const j = readJson(path.join(profileDir, 'extensions.json')); const out = [];
  for (const a of (j && j.addons) || []) { if (a.type === 'extension' && a.location === 'app-profile' && !a.hidden) out.push({ id: 'ff:' + a.id, name: (a.defaultLocale && a.defaultLocale.name) || a.id, disabled: a.active === false, firefox: true }); }
  return out;
}

// ---------- the list the interface shows ----------
function profileOf(id) {
  const [browser, pid] = String(id).split('|');
  const loc = locations().find((l) => l.browser === browser); if (!loc) return null;
  const profiles = loc.kind === 'firefox' ? firefoxProfiles(loc.root) : loc.kind === 'opera' ? [{ dir: loc.root, id: 'Default', label: loc.browser }] : chromiumProfiles(loc.root);
  const p = profiles.find((x) => x.id === pid); return p ? { loc, p } : null;
}
function scan(installedIds = () => []) {
  const out = [], checked = [];
  for (const loc of locations()) {
    let profiles = [];
    try { profiles = loc.kind === 'firefox' ? firefoxProfiles(loc.root) : loc.kind === 'opera' ? (exists(path.join(loc.root, 'Bookmarks')) || exists(path.join(loc.root, 'Preferences')) ? [{ dir: loc.root, id: 'Default', label: loc.browser }] : []) : chromiumProfiles(loc.root); } catch { profiles = []; }
    checked.push({ browser: loc.browser, folder: loc.root, found: profiles.length > 0 });
    for (const p of profiles) {
      const entry = { id: `${loc.browser}|${p.id}`, browser: loc.browser, icon: loc.icon, profile: p.id, label: p.label, bookmarks: 0, history: false, extensions: [], search: null, note: '' };
      try {
        if (loc.kind === 'firefox') {
          try { entry.bookmarks = dedupe(firefoxBookmarks(p.dir)).length; entry.history = true; } catch (e) { entry.note = 'Close Firefox once and open this page again: its data is locked while it runs.'; }
          entry.extensions = firefoxExtensions(p.dir); entry.extNote = entry.extensions.length ? 'Firefox add-ons use a different format. Look each one up by name in the extension hub.' : '';
        } else {
          entry.bookmarks = chromeBookmarks(p.dir).length; entry.history = exists(path.join(p.dir, 'History')); entry.extensions = chromeExtensions(p.dir); entry.search = chromiumSearch(p.dir);
        }
      } catch (e) { entry.note = 'Could not read this profile: ' + e.message; }
      const have = new Set(installedIds());
      entry.extensions = entry.extensions.map((e) => ({ ...e, installed: have.has(e.id) }));
      out.push(entry);
    }
  }
  return { profiles: out, checked };
}
function bookmarksOf(id) { const r = profileOf(id); if (!r) return []; return r.loc.kind === 'firefox' ? dedupe(firefoxBookmarks(r.p.dir)) : chromeBookmarks(r.p.dir); }
function historyOf(id) {
  const r = profileOf(id); if (!r) return [];
  if (r.loc.kind === 'firefox') return firefoxHistory(r.p.dir);
  const tmp = path.join(os.tmpdir(), `nova-history-${process.pid}-${Date.now()}`);
  try {
    fs.copyFileSync(path.join(r.p.dir, 'History'), tmp);
    const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(tmp, { readOnly: true });
    try { return db.prepare("SELECT url, title, visit_count AS n, (last_visit_time / 1000 - 11644473600000) AS ms FROM urls WHERE hidden = 0 AND url LIKE 'http%' ORDER BY visit_count DESC, last_visit_time DESC LIMIT 4000").all().map((x) => ({ url: x.url, title: x.title || '', n: x.n, t: Number(x.ms) || 0 })); } finally { db.close(); }
  } finally { try { fs.rmSync(tmp, { force: true }); } catch { /* temp file stays */ } }
}
function searchOf(id) { const r = profileOf(id); return r && r.loc.kind !== 'firefox' ? chromiumSearch(r.p.dir) : null; }

// ---------- a bookmarks file: Netscape HTML (every browser exports it) or JSON (Chrome's own file, Firefox's backup) ----------
const unent = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&#x27;/g, "'").replace(/<[^>]+>/g, '').trim();
function fileBookmarks(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, ''), out = [];
  if (/^\s*[{[]/.test(text)) {
    const j = JSON.parse(text);
    if (j.roots) Object.values(j.roots).forEach((r) => walkChrome(r, out));
    else { const walk = (n) => { if (!n || typeof n !== 'object') return; const u = n.uri || n.url; if (u && /^https?:/i.test(u) && !n.children) out.push({ url: u, title: n.title || n.name || '', folder: '' }); (n.children || []).forEach(walk); }; walk(j); }
  } else {
    const re = /<A\s[^>]*?HREF="([^"]+)"[^>]*>([\s\S]*?)<\/A>/gi; let m;
    while ((m = re.exec(text))) { const url = unent(m[1]); if (/^https?:/i.test(url)) out.push({ url, title: unent(m[2]), folder: '' }); }
  }
  return dedupe(out);
}
module.exports = { scan, bookmarksOf, historyOf, searchOf, fileBookmarks, locations, hostOf };
