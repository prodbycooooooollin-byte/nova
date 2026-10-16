// Nova's password store. Every secret is sealed with Electron's safeStorage (Windows DPAPI) before it is kept anywhere; passwords.json holds
// only the site's origin, the user name and the sealed blob. No plaintext password is written to disk, logged, or kept after the call that needed it.
// The dependencies (safeStorage, fs, file path) are handed in, so the whole module can be checked headless with a fake safeStorage.
const crypto = require('crypto');

const LIMITS = { entries: 5000, user: 512, password: 4096, origin: 300 };
const bad = (msg) => Object.assign(new Error(msg), { user: true });

// The origin a login belongs to: scheme, host and port, nothing else. https://a.com and http://a.com are different sites, so are a.com and www.a.com.
function originOf(url) {
  try {
    const u = new URL(String(url));
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname) return '';
    const o = u.origin;
    return o.length <= LIMITS.origin ? o : '';
  } catch { return ''; }
}
// What people read: the host (with the port when it is not the default); plain http keeps its scheme so it never passes for a secure site.
function labelOf(origin) {
  try { const u = new URL(origin); return u.protocol === 'http:' ? 'http://' + u.host : u.host; } catch { return String(origin); }
}

function createStore({ safeStorage, fs, file, now = Date.now, newId = () => crypto.randomBytes(8).toString('hex') }) {
  let data = null, readError = '';

  const available = () => { try { return !!safeStorage.isEncryptionAvailable(); } catch { return false; } };
  const seal = (password) => {
    if (!available()) throw bad('Windows encryption is not available, so Nova cannot keep passwords safely.');
    return safeStorage.encryptString(String(password)).toString('base64');
  };
  const open = (blob) => safeStorage.decryptString(Buffer.from(String(blob), 'base64'));

  function load() {
    if (data) return data;
    data = { v: 1, entries: [], never: [] };
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') readError = 'The password file could not be read (' + (e.code || e.message) + ').'; return data; }
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { /* handled below */ }
    const okShape = parsed && Array.isArray(parsed.entries);
    if (okShape) {
      const clean = parsed.entries.filter((e) => e && typeof e.id === 'string' && typeof e.user === 'string' && typeof e.blob === 'string' && originOf(e.origin) === e.origin);
      data.entries = clean.map((e) => ({ id: e.id, origin: e.origin, user: e.user, blob: e.blob, t: +e.t || 0 }));
      data.never = (Array.isArray(parsed.never) ? parsed.never : []).filter((o) => typeof o === 'string' && originOf(o) === o);
      if (clean.length !== parsed.entries.length) keepCopy();
    } else keepCopy(); // never silently replace a file Nova cannot understand: it is moved aside first
    return data;
  }
  function keepCopy() {
    try { fs.copyFileSync(file, file.replace(/\.json$/, '') + '.unreadable-' + now() + '.json'); } catch { /* nothing to keep */ }
  }
  function save() {
    if (readError) throw bad(readError);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file); // atomic: a crash leaves either the old file or the new one
  }

  const sameLogin = (e, origin, user) => e.origin === origin && e.user === user;
  const find = (origin, user) => load().entries.find((e) => sameLogin(e, origin, user));
  const byId = (id) => load().entries.find((e) => e.id === id);

  return {
    available, labelOf,
    error: () => { load(); return readError; },
    list() { // no secrets: what the settings page shows
      return load().entries.map(({ id, origin, user, t }) => ({ id, origin, user, t })).sort((a, b) => labelOf(a.origin).localeCompare(labelOf(b.origin)) || a.user.localeCompare(b.user));
    },
    count: () => load().entries.length,
    matches: (origin) => load().entries.filter((e) => e.origin === origin).sort((a, b) => b.t - a.t).map(({ id, user, t }) => ({ id, user, t })),
    countFor: (origin) => load().entries.reduce((n, e) => n + (e.origin === origin ? 1 : 0), 0),
    seal,
    // what to offer after a sign-in: nothing (same password already kept), an update of a kept login, or a new one
    check(origin, user, password) {
      const e = find(origin, user);
      if (!e) return { state: 'new' };
      let same = false;
      try { same = open(e.blob) === password; } catch { /* undecryptable: offer to replace it */ }
      return same ? { state: 'same', id: e.id } : { state: 'update', id: e.id };
    },
    // keep a login whose password is already sealed. An existing login of the same origin and user name is updated in place.
    put(origin, user, blob, id) {
      if (originOf(origin) !== origin) throw bad('That is not a web address.');
      user = String(user); if (user.length > LIMITS.user) throw bad('The user name is too long.');
      const e = (id && byId(id)) || find(origin, user);
      if (e) { e.user = user; e.blob = blob; e.t = now(); save(); return { id: e.id, status: 'updated' }; }
      if (load().entries.length >= LIMITS.entries) throw bad('Nova keeps up to ' + LIMITS.entries + ' passwords.');
      const n = { id: newId(), origin, user, blob, t: now() };
      load().entries.push(n); save(); return { id: n.id, status: 'added' };
    },
    add(origin, user, password) {
      password = String(password); if (!password || password.length > LIMITS.password) throw bad('The password is empty or too long.');
      return this.put(origin, user, seal(password));
    },
    reveal(id) { const e = byId(id); if (!e) throw bad('That password is gone.'); return open(e.blob); },
    userOf: (id) => (byId(id) || {}).user,
    originOfId: (id) => (byId(id) || {}).origin,
    remove(id) { const d = load(), n = d.entries.length; d.entries = d.entries.filter((e) => e.id !== id); if (d.entries.length !== n) save(); return d.entries.length !== n; },
    removeAll() { const d = load(), n = d.entries.length; d.entries = []; if (n) save(); return n; },
    isNever: (origin) => load().never.includes(origin),
    addNever(origin) { const d = load(); if (!d.never.includes(origin) && originOf(origin) === origin) { d.never.push(origin); save(); } },
    removeNever(origin) { const d = load(), n = d.never.length; d.never = d.never.filter((o) => o !== origin); if (d.never.length !== n) save(); },
    neverList: () => [...load().never].sort(),
    // everything, decrypted, for the CSV export. Entries this Windows account cannot decrypt are counted, not written.
    exportRows() {
      const rows = []; let failed = 0;
      for (const e of load().entries) {
        try { rows.push({ name: new URL(e.origin).hostname, url: e.origin + '/', user: e.user, password: open(e.blob) }); } catch { failed++; }
      }
      return { rows, failed };
    },
    // rows are {url, user, password}. Logins already kept are left alone: the same password counts as `same`, a different one as `kept` (yours wins).
    importRows(rows) {
      const r = { added: 0, same: 0, kept: 0, bad: 0 };
      const d = load();
      for (const x of rows) {
        const origin = originOf(x.url) || (/^[\w.-]+\.[a-z]{2,}(:\d+)?([/?#]|$)/i.test(String(x.url)) ? originOf('https://' + x.url) : '');
        const user = String(x.user || ''), password = String(x.password || '');
        if (!origin || !password || password.length > LIMITS.password || user.length > LIMITS.user) { r.bad++; continue; }
        const e = find(origin, user);
        if (e) { let same = false; try { same = open(e.blob) === password; } catch { /* undecryptable */ } same ? r.same++ : r.kept++; continue; }
        if (d.entries.length >= LIMITS.entries) { r.bad++; continue; }
        d.entries.push({ id: newId(), origin, user, blob: seal(password), t: now() }); r.added++;
      }
      if (r.added) save();
      return r;
    },
    unload() { data = null; readError = ''; },
  };
}

module.exports = { createStore, originOf, labelOf, LIMITS };
