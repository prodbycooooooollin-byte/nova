// Nova smart sleep: the policy that sits on top of main.js sleep()/wake(). Three steps, each with its own switch in
// Settings > Resource budget:
//   1. Freeze    after ~30 s a background tab is frozen (CDP Page.setWebLifecycleState): no CPU at all, nothing is lost,
//                and it resumes by itself the moment it is shown. The freeze survives detaching the debugger.
//   2. Soft wake before a tab is discarded Nova remembers its scroll position, what was typed into plain form fields and
//                (in main.js) a picture of it. The reload then shows that picture and restores both (wake-preload.js).
//                Tabs holding input Nova cannot restore (passwords, card fields, rich editors) are never discarded by the idle policy.
//   3. Adaptive  how soon an unused tab is discarded is learned per site from how fast you came back to it before.
const hostOf = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.hostname.replace(/^www\./, '') : ''; } catch { return ''; } };
const noHash = (u) => String(u || '').split('#')[0];

const NEVER_MS = 60e3;       // a site you (almost) never come back to
const LATE_MS = 120e3;       // you come back, but later than it is worth keeping the page
const MIN_HOLD_MS = 5 * 60e3; // a site you do come back to is kept at least this long
const OFTEN_MS = 30 * 60e3;   // a site you check every few minutes stays half an hour
const HOLD_CAP_MS = 45 * 60e3;
const MIN_GAP_S = 4;          // switching past a tab with Ctrl+Tab is not a visit

// A frozen page keeps its sockets but cannot answer them, so a live stream or a chat is dead when the page thaws (a Twitch tab that had to be closed and opened again).
// Chrome itself does not freeze such pages; the CDP freeze ignores that rule, so Nova applies it: a page that has played or made sound since it was loaded, and the
// well-known live services, are never frozen. They are still discarded after the idle delay, which loads a clean page when the tab is opened again.
const LIVE_HOSTS = /(^|\.)(twitch\.tv|kick\.com|discord\.com|whatsapp\.com|slack\.com|teams\.microsoft\.com|teams\.live\.com|meet\.google\.com|zoom\.us|telegram\.org)$/;
const awake = (t) => { const a = C && C.settings().awakeHosts; return Array.isArray(a) && a.includes(hostOf(t.url)); }; // a site you chose to keep awake (the shield menu)
const live = (t) => !!t.mediaAt || LIVE_HOSTS.test(hostOf(t.url)) || awake(t);

let C, rev = {}, saveTimer = null;

// ---------- what the page tells us before it is discarded (runs inside the page; keep the field key in step with wake-preload.js) ----------
const SNAP_JS = `(() => {
  try {
    const BAD_TYPE = /^(password|hidden|file|submit|button|image|reset)$/i;
    const BAD_AC = /(^|\\s)(off|cc-[\\w-]+|one-time-code|new-password|current-password)(\\s|$)/i;
    const BAD_NAME = /pass|pwd|card|cvv|cvc|ccnum|otp|ssn|iban|secret|token|(^|[^a-z])pin([^a-z]|$)/i;
    const out = { url: location.href, x: Math.round(scrollX), y: Math.round(scrollY), w: innerWidth, f: [], dirty: false };
    let bytes = 0; const seen = {};
    for (const el of document.querySelectorAll('input,textarea,select')) {
      const type = (el.type || '').toLowerCase();
      const k = [el.tagName, type, el.id || '', el.name || ''].join('|'), i = seen[k] = (seen[k] === undefined ? -1 : seen[k]) + 1, key = k + '#' + i;
      if (el.disabled || el.readOnly) continue;
      if (el.tagName === 'SELECT') {
        if (el.multiple) continue;
        const def = Math.max(0, Array.from(el.options).findIndex((o) => o.defaultSelected));
        if (el.selectedIndex !== def && el.selectedIndex >= 0) out.f.push({ k: key, v: el.value });
        continue;
      }
      if (type === 'checkbox' || type === 'radio') { if (el.checked !== el.defaultChecked) out.f.push({ k: key, c: el.checked ? 1 : 0 }); continue; }
      if (el.value === el.defaultValue) continue;
      const risky = BAD_TYPE.test(type) || BAD_AC.test(el.getAttribute('autocomplete') || '') || BAD_NAME.test((el.name || '') + ' ' + (el.id || ''));
      if (risky || el.value.length > 4000 || bytes + el.value.length > 30000) { out.dirty = true; continue; }
      bytes += el.value.length; out.f.push({ k: key, v: el.value });
    }
    for (const el of document.querySelectorAll('[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"]')) if ((el.textContent || '').trim()) { out.dirty = true; break; }
    if (!out.f.length) delete out.f;
    return out;
  } catch (e) { return null; }
})()`;

// ---------- freeze ----------
async function setState(t, state) {
  const wc = t.view?.webContents;
  if (!wc || wc.isDestroyed()) return false;
  const run = async () => {
    const d = wc.debugger, had = d.isAttached();
    try {
      if (!had) d.attach('1.3');
      await d.sendCommand('Page.setWebLifecycleState', { state });
      return true;
    } catch { return false; }
    finally { try { if (!had && !wc.isDestroyed() && d.isAttached()) d.detach(); } catch { /* page is closing */ } }
  };
  return C.native ? C.native(wc, run()) : run(); // the page is not closed while this debugger session is open
}
async function freeze(t) {
  if (t.frozen || !t.view || live(t)) return;
  if (!(await setState(t, 'frozen'))) { t.freezeFailAt = Date.now(); return; }
  t.frozen = true;
  if (!t.view || C.visibleIds().includes(t.id)) await thaw(t); // the tab was opened while the command was in flight
}
async function thaw(t) {
  if (!t.frozen) return;
  t.frozen = false;
  if (t.view) await setState(t, 'active');
}

// ---------- soft wake: snapshot ----------
async function snapshot(t) {
  const wc = t.view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  let r = null;
  try { r = await Promise.race([wc.executeJavaScript(SNAP_JS, false), new Promise((res) => setTimeout(() => res(null), 800))]); } catch { r = null; }
  t.snapAt = Date.now();
  t.snap = r && r.url ? r : null;
  t.dirty = !!(r && r.dirty);
}
function wakePayload(t) { // what the preload of a freshly woken tab gets, or null when there is nothing trustworthy to restore
  const s = t.snap;
  if (!s || noHash(s.url) !== noHash(t.url)) return null;
  return { url: s.url, x: s.x, y: s.y, w: s.w || 0, f: s.f || [], ghost: t.ghost || '', bg: t.ghostBg || '' };
}

// ---------- adaptive timing ----------
const quantile = (arr, q) => { const a = [...arr].sort((x, y) => x - y), i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return a.length ? a[lo] + (a[hi] - a[lo]) * (i - lo) : 0; };
const hostCache = new Map();
function familiar(host) { // history prior for a site without return data yet: how often its pages were loaded (this counts page loads, so it runs high)
  const c = hostCache.get(host);
  if (c && Date.now() - c.at < 60e3) return c.v;
  const v = (C.hostVisits && C.hostVisits(host)) >= 30;
  hostCache.set(host, { at: Date.now(), v });
  return v;
}
function learned(t) { // ms to keep an unused tab of this site, or null when nothing is known about it
  const host = hostOf(t.url); if (!host) return null;
  const r = rev[host], n = r ? r.g.length + r.m : 0;
  if (n >= 3) {
    if (r.g.length / n < 0.25) return NEVER_MS;
    const hold = quantile(r.g, 0.8) * 1500 + 20e3; // covers 4 in 5 of the past returns with some room
    if (hold > HOLD_CAP_MS) return LATE_MS;
    let ms = Math.max(hold, MIN_HOLD_MS);
    if (r.g.length >= 5 && quantile(r.g, 0.5) <= 300) ms = Math.max(ms, OFTEN_MS);
    return Math.round(ms);
  }
  return familiar(host) ? 15 * 60e3 : null;
}
function delayMs(t) { // idle time after which a background tab is discarded; 0 = never
  const s = C.settings(), b = s.budget, base = (s.sleepAfterMin || 0) * 60e3;
  if (!base) return 0;
  let d = b.softWake ? Math.min(base, (b.earlySleepMin || 3) * 60e3) : base;
  if (b.adaptive && !t.private && s.keepHistory) { const a = learned(t); if (a !== null) d = a; }
  return d;
}
const stat = (host) => rev[host] || (rev[host] = { g: [], m: 0, t: 0 });
const mayLearn = (t) => !t.private && C.settings().keepHistory && C.settings().budget.adaptive;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const keys = Object.keys(rev);
    if (keys.length > 400) for (const k of keys.sort((a, b) => rev[a].t - rev[b].t).slice(0, keys.length - 400)) delete rev[k];
    C.writeJson('revisit.json', rev);
  }, 3000);
}
function left(t) { t.leftAt = Date.now(); t.missed = false; }
function arrived(t) { // the tab is opened again: that is one data point for how fast this site gets revisited
  const at = t.leftAt; t.leftAt = 0;
  if (!at || !mayLearn(t)) return;
  const gap = (Date.now() - at) / 1000, host = hostOf(t.url); if (!host) return;
  if (gap < MIN_GAP_S) { if (t.missed) t.missed = false; return; }
  const r = stat(host);
  if (t.missed) { r.m = Math.max(0, r.m - 1); t.missed = false; } // it was counted as not-returned when it went to sleep; it did return after all
  r.g.push(Math.round(gap)); if (r.g.length > 24) r.g.shift();
  r.t = Date.now(); saveSoon();
}
function missed(t) { // the tab went away (slept or closed) without the user coming back to it
  if (!t.leftAt || t.missed || !mayLearn(t)) return;
  if (Date.now() - t.leftAt < MIN_GAP_S * 1000) return;
  const host = hostOf(t.url); if (!host) return;
  const r = stat(host); r.m++; r.t = Date.now(); t.missed = true; saveSoon();
}
function clear() { rev = {}; hostCache.clear(); try { C.writeJson('revisit.json', rev); } catch {} }

// ---------- the policy loop ----------
let busy = new Set();
async function step(t, idle, b) {
  busy.add(t.id);
  try {
    const since = Math.max(t.lastActive || 0, t.warmAt || 0, t.audibleAt || 0);
    if (b.softWake && (t.snapAt || 0) < since) { if (t.frozen) await thaw(t); if (t.view && !C.visibleIds().includes(t.id)) await snapshot(t); }
    const need = (t.loading ? 120 : b.freezeAfterSec) * 1000;
    if (b.freeze && t.view && !t.frozen && !live(t) && idle >= need && !C.visibleIds().includes(t.id) && Date.now() - (t.freezeFailAt || 0) > 60e3) await freeze(t);
  } catch (e) { console.error('smart sleep', e.message); } finally { busy.delete(t.id); }
}
function tick() {
  const s = C.settings(), b = s.budget, now = Date.now(), vis = new Set(C.visibleIds());
  for (const t of [...C.tabs.values()]) {
    if (!t.view) continue;
    const wc = t.view.webContents; if (wc.isDestroyed()) continue;
    if (vis.has(t.id)) { t.wasVisible = true; if (t.frozen) t.frozen = false; continue; }
    if (t.wasVisible) { t.wasVisible = false; if (now - t.lastActive > 8000) t.lastActive = now; } // came out of a split view
    if (t.pinned || t.audible || t.playing || busy.has(t.id) || awake(t)) { t.sleepAt = 0; continue; }
    const since = Math.max(t.lastActive || 0, t.warmAt || 0, t.audibleAt || 0), idle = now - since;
    const settle = t.warmAt > t.lastActive ? 9000 : 4000; // a hover-woken page needs a moment to put itself back
    const wantSnap = b.softWake && (t.snapAt || 0) < since && idle >= settle;
    const wantFreeze = b.freeze && !t.frozen && !live(t) && idle >= (t.loading ? 120 : b.freezeAfterSec) * 1000;
    const d = delayMs(t), keep = b.softWake && t.dirty; // typed-in input Nova cannot restore: never discard it on a timer
    t.sleepAt = d > 0 && !keep ? since + d : 0;
    if (wantSnap) { step(t, idle, b); continue; } // the picture and the scroll position are taken before anything is frozen or discarded
    if (d > 0 && idle >= d && !keep) { missed(t); C.sleepTab(t); continue; }
    if (wantFreeze) step(t, idle, b);
  }
}

function init(ctx) {
  C = ctx;
  try { // the file is ours, but a hand-edited or damaged one must not break the policy
    const r = C.readJson('revisit.json', {}); rev = {};
    for (const [h, v] of Object.entries(r && typeof r === 'object' ? r : {})) if (v && Array.isArray(v.g)) rev[h] = { g: v.g.filter((x) => Number.isFinite(x) && x >= 0).slice(-24), m: Math.max(0, Math.min(1000, +v.m || 0)), t: +v.t || 0 };
  } catch { rev = {}; }
  setInterval(tick, 5000);
}
const flush = () => { clearTimeout(saveTimer); try { C.writeJson('revisit.json', rev); } catch {} };

module.exports = { init, live, left, arrived, missed, clear, flush, freeze, thaw, snapshot, wakePayload, delayMs, learned, _rev: () => rev };
