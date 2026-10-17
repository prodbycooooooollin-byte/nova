// Nova profiles, the parts that need no Electron: ids, names, colours, the session partition of a profile and the files that belong to it.
// main.js owns the sessions and the spaces; this file only decides what a valid profile looks like and what its things are called.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAIN = 'main'; // the profile every install starts with: it keeps the original partition (persist:nova), so no login is lost and it cannot be deleted
const COLORS = ['#8b7dff', '#ff7a90', '#ffb04d', '#4ddc9a', '#4db8ff', '#c084fc', '#ff6b6b', '#2dd4bf'];
const idOk = (id) => typeof id === 'string' && /^[a-z0-9]{1,12}$/.test(id);
const colorOk = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const cleanName = (n, fallback) => { const s = String(n == null ? '' : n).replace(/\s+/g, ' ').trim().slice(0, 40); return s || fallback; };

// the session partition: logins, cookies, local storage and the HTTP cache of a profile live in it; private tabs get an in-memory one of their own
const partitionOf = (pid, priv) => (priv ? (pid === MAIN ? 'nova-private' : 'nova-private-' + pid) : pid === MAIN ? 'persist:nova' : 'persist:nova-p-' + pid);
// history.json -> history-<id>.json; the main profile keeps the plain name, so existing files are simply its files
const fileOf = (name, pid) => (pid === MAIN ? name : name.replace(/(\.[^.]+)$/, '-' + pid + '$1'));
const newId = (taken) => { for (;;) { const id = crypto.randomBytes(4).toString('hex'); if (!(taken || []).includes(id)) return id; } };

// The list in settings.json, repaired: valid ids, names and colours, no duplicates, and the main profile is always there (older settings
// have only a user name, which becomes the name of the main profile).
function cleanProfiles(list, legacyName) {
  const out = [], seen = new Set();
  for (const p of Array.isArray(list) ? list : []) {
    if (!p || !idOk(p.id) || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ id: p.id, name: cleanName(p.name, p.id === MAIN ? 'Personal' : 'Profile'), color: colorOk(p.color) ? p.color : COLORS[out.length % COLORS.length] });
  }
  if (!seen.has(MAIN)) out.unshift({ id: MAIN, name: cleanName(legacyName, 'Personal'), color: COLORS[0] });
  return out;
}
// Every space belongs to a profile. A space of an older Nova has none (main). A profile that spaces still name but settings.json lost is
// brought back as "Recovered profile" instead of being mapped onto another profile: its partition still holds the logins.
function repairSpaces(spaces, list) {
  let changed = false;
  for (const sp of spaces) {
    if (!sp.profile) { sp.profile = MAIN; changed = true; }
    if (!list.some((p) => p.id === sp.profile)) {
      if (idOk(sp.profile)) list.push({ id: sp.profile, name: 'Recovered profile', color: COLORS[list.length % COLORS.length] });
      else sp.profile = MAIN;
      changed = true;
    }
  }
  return changed;
}
// The partition folders of deleted profiles are removed at the next start (a live session keeps its folder busy). Only exact names are touched.
// Returns the ids whose folder is still there (locked by something), so main.js can try again at the start after.
function purge(userData, ids) {
  const left = [];
  for (const id of ids || []) {
    if (!idOk(id) || id === MAIN) continue;
    const dir = path.join(userData, 'Partitions', 'nova-p-' + id);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* still in use */ }
    if (fs.existsSync(dir)) left.push(id);
  }
  return left;
}
module.exports = { MAIN, COLORS, idOk, colorOk, cleanName, partitionOf, fileOf, newId, cleanProfiles, repairSpaces, purge };
