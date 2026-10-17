// Site permissions: what a website may ask for, what you answered, kept per profile (permissions.json for the first profile, permissions-<id>.json for the others).
// Private tabs remember nothing. This file only knows the answers; asking is done by main.js and the interface.
const fs = require('fs');

// the things a site can ask for; label = what the question says ("<site> wants to ..."), short = the name in the site panel
const KINDS = {
  geolocation: { label: 'know your location', short: 'Location' },
  camera: { label: 'use your camera', short: 'Camera' },
  microphone: { label: 'use your microphone', short: 'Microphone' },
  notifications: { label: 'show notifications', short: 'Notifications' },
  clipboard: { label: 'see what you copied', short: 'Clipboard' },
};
let D = null, stores = new Map(), timers = new Map(); // profile id -> { file, data: { origin: { kind: 'allow' | 'block' } } }

function init(ctx) { D = ctx; stores = new Map(); }
const priv = (pid) => String(pid).endsWith('!');
function store(pid) {
  let s = stores.get(pid);
  if (!s) {
    const file = priv(pid) ? null : D.fileOf(pid); let data = {};
    if (file) { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (j && typeof j === 'object' && !Array.isArray(j)) data = j; } catch { /* none yet */ } }
    s = { file, data }; stores.set(pid, s);
  }
  return s;
}
function save(pid) {
  const s = store(pid); if (!s.file) return;
  clearTimeout(timers.get(pid));
  timers.set(pid, setTimeout(() => { try { fs.writeFileSync(s.file, JSON.stringify(s.data)); } catch { /* read-only folder */ } }, 400));
}
const flush = () => { for (const [pid, s] of stores) if (s.file && timers.has(pid)) { clearTimeout(timers.get(pid)); timers.delete(pid); try { fs.writeFileSync(s.file, JSON.stringify(s.data)); } catch { /* ignore */ } } };

// the origin a request comes from ("https://maps.example"); pages that are not on the web cannot ask
function originOf(url) { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.origin : ''; } catch { return ''; } }
// the kinds one Electron permission stands for, or null if it is not something Nova ever allows
function kindsOf(permission, details) {
  if (permission === 'geolocation') return ['geolocation'];
  if (permission === 'notifications') return ['notifications'];
  if (permission === 'clipboard-read') return ['clipboard'];
  if (permission === 'media') { const m = (details && details.mediaTypes) || []; const k = []; if (m.includes('video')) k.push('camera'); if (m.includes('audio')) k.push('microphone'); return k.length ? k : ['camera', 'microphone']; }
  return null;
}
const get = (pid, origin, kind) => (store(pid).data[origin] || {})[kind];
// 'allow' when every kind was allowed before, 'block' when one was blocked, otherwise 'ask'
function decide(pid, origin, kinds) {
  const v = kinds.map((k) => get(pid, origin, k));
  if (v.includes('block')) return 'block';
  return v.every((x) => x === 'allow') ? 'allow' : 'ask';
}
function set(pid, origin, kind, value) { // value: 'allow' | 'block' | null (ask again)
  if (!origin || !KINDS[kind]) return;
  const s = store(pid), o = s.data[origin] || (s.data[origin] = {});
  if (value === 'allow' || value === 'block') o[kind] = value; else delete o[kind];
  if (!Object.keys(o).length) delete s.data[origin];
  save(pid);
}
const forget = (pid, origin) => { const s = store(pid); if (s.data[origin]) { delete s.data[origin]; save(pid); } };
const reset = (pid) => { const s = store(pid); s.data = {}; save(pid); };
const forOrigin = (pid, origin) => Object.fromEntries(Object.keys(KINDS).map((k) => [k, get(pid, origin, k) || 'ask']));
const list = (pid) => Object.entries(store(pid).data).map(([origin, v]) => ({ origin, ...v })).sort((a, b) => a.origin.localeCompare(b.origin));
const drop = (pid) => { stores.delete(pid); };
module.exports = { init, KINDS, originOf, kindsOf, get, decide, set, forget, reset, forOrigin, list, flush, drop };
