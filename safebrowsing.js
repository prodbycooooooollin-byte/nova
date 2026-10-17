// Nova's protection against dangerous sites. Chromium's own Safe Browsing is not part of Electron, so Nova keeps public lists of KNOWN bad sites on this computer
// and checks every page it is about to open against them. Nothing about the pages you visit leaves the computer: only the lists come down, never a question.
//   OpenPhish                (phishing, addresses, every 6 h)       free feed of the OpenPhish project
//   Phishing.Database        (phishing, host names, every 24 h)     MIT licence, github.com/mitchellkrogza/Phishing.Database
//   URLhaus                  (malware, addresses and hosts, 6 h)    abuse.ch, CC0
// Each list is kept as a sorted array of 64-bit hashes (8 bytes per entry, about 5 MB in all), looked up with a binary search; nothing is held as text.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
let tld = null; try { tld = require('tldts-experimental'); } catch { /* the last two labels do */ }

const SOURCES = [
  { id: 'openphish', name: 'OpenPhish', kind: 'phish', type: 'url', url: 'https://openphish.com/feed.txt', everyH: 6 },
  { id: 'phishdb', name: 'Phishing.Database', kind: 'phish', type: 'host', url: 'https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-domains-ACTIVE.txt', everyH: 24 },
  { id: 'urlhaus', name: 'URLhaus', kind: 'malware', type: 'url', url: 'https://urlhaus.abuse.ch/downloads/text_online/', everyH: 6 },
  { id: 'urlhaus-hosts', name: 'URLhaus', kind: 'malware', type: 'host', url: 'https://urlhaus.abuse.ch/downloads/hostfile/', everyH: 6 },
];
let SRC = SOURCES; // tests give init() their own lists
// The big names are never flagged by a host entry (a list that names a whole big domain by mistake must not block it); an exact bad ADDRESS on them still is.
const BIG = new Set(('google.com youtube.com gstatic.com googleapis.com googleusercontent.com microsoft.com live.com office.com bing.com apple.com icloud.com amazon.com amazon.de amazonaws.com ' +
  'facebook.com instagram.com whatsapp.com meta.com twitter.com x.com linkedin.com reddit.com wikipedia.org github.com githubusercontent.com gitlab.com stackoverflow.com paypal.com ebay.com ' +
  'netflix.com spotify.com discord.com discord.gg twitch.tv steampowered.com steamcommunity.com riotgames.com epicgames.com cloudflare.com dropbox.com notion.so zoom.us slack.com ' +
  'telegram.org tiktok.com pinterest.com yahoo.com duckduckgo.com mozilla.org openai.com chatgpt.com anthropic.com claude.ai adobe.com paypalobjects.com akamaized.net fastly.net').split(' '));

let D = null; // { dir, fetch, enabled, log }
let meta = {}, sets = new Map(), loaded = false, updating = false, timer = null;

const h64 = (s) => crypto.createHash('sha1').update(s).digest().readBigUInt64LE(0);
const file = (id) => path.join(D.dir, `sb-${id}.bin`), metaFile = () => path.join(D.dir, 'sb-meta.json');
const registrable = (host) => { try { if (tld) { const d = tld.getDomain(host, { allowPrivateDomains: true }); if (d) return d; } } catch { /* fall through */ } const p = host.split('.'); return p.length > 2 ? p.slice(-2).join('.') : host; };
const isIp = (h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':');

// an address in one fixed form: scheme and host in lower case, no port that is the default, no fragment, a path of "/" when there is none
function normUrl(u) {
  try { const x = new URL(String(u).trim()); if (!/^https?:$/.test(x.protocol)) return ''; x.hash = ''; x.hostname = x.hostname.replace(/\.$/, ''); return x.protocol + '//' + x.host + x.pathname + x.search; } catch { return ''; }
}
function parseList(text, src) {
  const out = [];
  for (const raw of String(text).split(/\r?\n/)) {
    let line = raw.trim(); if (!line || line[0] === '#' || line[0] === '!') continue;
    if (src.type === 'host') {
      const parts = line.split(/\s+/); line = parts[parts.length - 1].toLowerCase().replace(/\.$/, '');
      if (!/^[a-z0-9._-]+$/.test(line) || !line.includes('.') || line.length > 253) continue;
      if (!isIp(line) && tld) { let d = null; try { d = tld.getDomain(line, { allowPrivateDomains: true }); } catch { /* not a host */ } if (!d) continue; } // a list line that is only a public suffix (github.io, co.uk) names no site
      if (!isIp(line) && BIG.has(registrable(line))) continue;
      out.push(h64(line));
    } else { const n = normUrl(line); if (n) out.push(h64(n)); }
  }
  const a = BigUint64Array.from(out).sort(); let k = 0; // sorted and without doubles
  for (let i = 0; i < a.length; i++) if (i === 0 || a[i] !== a[i - 1]) a[k++] = a[i];
  return a.slice(0, k);
}
function has(a, h) { let lo = 0, hi = a.length - 1; while (lo <= hi) { const m = (lo + hi) >>> 1, v = a[m]; if (v === h) return true; if (v < h) lo = m + 1; else hi = m - 1; } return false; }

function loadAll() {
  if (loaded || !D) return; loaded = true;
  try { meta = JSON.parse(fs.readFileSync(metaFile(), 'utf8')) || {}; } catch { meta = {}; }
  for (const s of SRC) {
    try { const b = fs.readFileSync(file(s.id)); if (b.length % 8 === 0 && b.length) sets.set(s.id, new BigUint64Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length))); } catch { /* not downloaded yet */ }
  }
}
function saveMeta() { try { fs.writeFileSync(metaFile(), JSON.stringify(meta)); } catch { /* read-only folder */ } }

// the host and each parent of it down to the registrable domain: a.b.evil.com, b.evil.com, evil.com (never "com", never a shared suffix like github.io)
function hostCandidates(host) {
  const out = [host]; if (isIp(host)) return out;
  const stop = registrable(host), labels = host.split('.');
  for (let i = 1; i < labels.length - 1; i++) { const c = labels.slice(i).join('.'); out.push(c); if (c === stop) break; }
  return out;
}
// null, or { kind: 'phish' | 'malware', list, via: 'url' | 'host', host }
function check(url) {
  if (!D || !D.enabled()) return null;
  if (!loaded) loadAll();
  let u; try { u = new URL(url); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, ''), n = normUrl(url), hu = n && h64(n);
  const cands = hostCandidates(host).map((c) => [c, h64(c)]);
  for (const s of SRC) {
    const a = sets.get(s.id); if (!a) continue;
    if (s.type === 'url') { if (hu && has(a, hu)) return { kind: s.kind, list: s.name, via: 'url', host }; }
    else for (const [c, h] of cands) if (has(a, h)) return { kind: s.kind, list: s.name, via: 'host', host: c };
  }
  return null;
}

async function fetchSource(s) {
  const headers = {}; if (meta[s.id] && meta[s.id].etag && sets.has(s.id)) headers['If-None-Match'] = meta[s.id].etag;
  const r = await D.fetch(s.url, { headers, signal: AbortSignal.timeout(120000) });
  if (r.status === 304) { meta[s.id].at = Date.now(); return 'same'; }
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const arr = parseList(await r.text(), s);
  if (arr.length < (s.type === 'host' ? 50 : 5) && !D.small) throw new Error('the list looks empty'); // a broken download must not replace a good list
  fs.writeFileSync(file(s.id), Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)); sets.set(s.id, arr);
  meta[s.id] = { at: Date.now(), count: arr.length, etag: r.headers.get('etag') || '' };
  return 'new';
}
// brings every list that is due up to date; force: all of them. Returns what happened for each list.
async function update(force) {
  if (!D || updating) return null; updating = true; const res = {};
  try {
    loadAll();
    for (const s of SRC) {
      const m = meta[s.id];
      if (!force && m && sets.has(s.id) && Date.now() - m.at < s.everyH * 3600e3) { res[s.id] = 'fresh'; continue; }
      try { res[s.id] = await fetchSource(s); } catch (e) { res[s.id] = 'failed: ' + e.message; if (D.log) D.log('safe browsing: ' + s.name + ' ' + e.message); }
    }
    meta.updated = Date.now(); saveMeta();
  } finally { updating = false; }
  return res;
}
function clear() { sets.clear(); loaded = false; }
function status() {
  if (D && D.enabled() && !loaded) loadAll();
  const lists = SRC.map((s) => ({ id: s.id, name: s.name, kind: s.kind, count: sets.has(s.id) ? sets.get(s.id).length : 0, at: (meta[s.id] || {}).at || 0 }));
  return { on: !!(D && D.enabled()), updating, updated: meta.updated || 0, total: lists.reduce((n, l) => n + l.count, 0), lists };
}
function init(ctx) {
  D = ctx; SRC = ctx.sources || SOURCES; clearTimeout(timer);
  const tick = () => { if (D.enabled()) update(false).catch(() => {}); else if (loaded) clear(); };
  timer = setTimeout(() => { tick(); timer = setInterval(tick, 6 * 3600e3); if (timer.unref) timer.unref(); }, ctx.firstAfterMs != null ? ctx.firstAfterMs : 90e3);
  if (timer.unref) timer.unref();
}
module.exports = { init, check, update, status, clear, _parse: parseList, _sources: SOURCES, _norm: normUrl, _cands: hostCandidates };
