// Nova's built-in password saver, main-process half. The page side is pw-preload.js (registered only while the feature is on), storage and
// encryption are pwstore.js (every secret sealed with Electron's safeStorage, which is Windows DPAPI), the little card shown over a page is
// ui/pwcard.* and the Settings page is ui/pwpage.js.
//
// The rules this file enforces, in one place:
//  - Only the top frame of an http(s) page is ever read from or written to, and the origin always comes from the browser (senderFrame.url),
//    never from what the page says. Iframes get nothing.
//  - A saved login is offered only on the exact same origin (scheme, host and port): an https login never fills an http page.
//  - A login is filled only after the user clicked it in Nova's own card, which a page cannot see, move or click. Only visible fields are filled.
//  - Private tabs never save. Secrets are never logged and never sent to the card; a submitted password is sealed at once, so no plaintext
//    is kept while the offer waits for the next page.
const { app, ipcMain, safeStorage, WebContentsView, dialog, clipboard } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createStore, originOf, labelOf, LIMITS } = require('./pwstore');
const csv = require('./pwcsv');

let C; // context from main.js: sessions, privateSession, settings, tabs, activeTab, overlayOpen, win, ui, userFile, toast, openOverlay
let store = null; // opened on first use, dropped again when the feature is off and nothing needs it
const preloadIds = new Map(); // session -> id of the registered frame preload
const pending = new Map(); // webContents id -> a login that was just submitted and waits for the page that follows: { origin, user, blob, id, update, timer }
let card = null; // { view, ready, cur, idle }: the card view, kept for a little while after use; cur is what it shows right now
let unloadTimer = null;
// A sign-in that asks for the user name first and the password on the next page or step: the name typed (or picked) is kept here for ten minutes, for this tab and this exact origin only.
const carried = new Map(); // webContents id -> { origin, user, t }
const CARRY_MS = 10 * 60e3;
const carryFor = (id, origin) => { const c = carried.get(id); if (!c) return null; if (c.origin !== origin || Date.now() - c.t > CARRY_MS) { carried.delete(id); return null; } return c; };

const L = (m) => { try { if (C.log) C.log('pw: ' + m); } catch { /* the log is a help only */ } }; // host names and yes/no only, never a user name or a password
const featureOn = () => !!(C.settings().features || {}).passwords;
const cfg = () => ({ save: true, fill: true, ...(C.settings().passwords || {}) });
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
function getStore() {
  if (!store) store = createStore({ safeStorage, fs, file: C.userFile('passwords.json') });
  return store;
}
// With the feature off the store is only needed while the Settings page is open: let go of it a minute after the last use.
function touch() {
  clearTimeout(unloadTimer);
  if (!featureOn()) unloadTimer = setTimeout(() => { if (!featureOn() && store) { store.unload(); store = null; } }, 60000);
}
const isTabSession = (wc) => C.sessions().includes(wc.session);
const isPrivate = (wc) => wc.session === C.privateSession();
const tabOf = (wc) => { for (const t of C.tabs.values()) if (t.view && t.view.webContents === wc) return t; return null; };
// The top frame of a page tab and its origin, as the browser knows them. A page cannot influence either.
function topOf(e) {
  const f = e.senderFrame;
  if (!f || f.parent || !isTabSession(e.sender)) return null;
  const origin = originOf(f.url);
  return origin ? { frame: f, origin } : null;
}
const drop = (id) => { const p = pending.get(id); if (p) { clearTimeout(p.timer); pending.delete(id); } };

// ---------- the card over the page ----------
const SAVE_W = 380, ROW = 44, H_SAVE = 116, H_SAVE_PLAIN = 140, H_PICK = 53; // heights match ui/pwcard.css
function makeCard() {
  const view = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'pwcard-preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false } });
  view.setBackgroundColor('#00000000');
  const wc = view.webContents;
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (ev) => ev.preventDefault());
  wc.loadFile(path.join(__dirname, 'ui', 'pwcard.html')).catch(() => {});
  return { view, ready: false, cur: null, idle: null };
}
function sendModel() {
  if (!card || !card.ready || !card.cur) return;
  const wc = card.view.webContents, s = C.settings();
  if (!wc.isDestroyed()) wc.send('nova:pwcard-model', { ...card.cur.model, theme: s.theme, radius: s.radius, effects: !!s.effects });
}
function place() {
  const cur = card.cur, pb = cur.tab.view.getBounds(), pad = 12;
  let w, x, y;
  if (cur.mode === 'pick') {
    const z = cur.wc.getZoomFactor() || 1, r = cur.rect;
    w = Math.round(Math.max(280, Math.min(SAVE_W, r.w * z, pb.width - pad * 2)));
    x = Math.round(Math.max(pb.x + 8, Math.min(pb.x + r.x * z, pb.x + pb.width - w - 8)));
    y = Math.round(pb.y + (r.y + r.h) * z + 4);
    if (y + cur.h > pb.y + pb.height - 8) y = Math.round(pb.y + r.y * z - cur.h - 4); // no room below the field: above it
    y = Math.max(pb.y + 8, y);
  } else {
    w = Math.min(SAVE_W, pb.width - pad * 2);
    x = pb.x + pb.width - w - pad; y = pb.y + 10;
  }
  card.view.setBounds({ x, y, width: w, height: cur.h });
  try { card.view.setBorderRadius(Math.max(0, Math.min(+C.settings().radius || 0, 18))); } catch { /* older shell */ }
  C.win().contentView.addChildView(card.view); // adding again moves it to the top, above any page view added since
}
function present(cur) {
  hide();
  if (!card) card = makeCard();
  clearTimeout(card.idle);
  cur.wc.on('before-input-event', cur.kb = keys(cur));
  if (cur.mode === 'pick') cur.wc.once('did-navigate', cur.nav = () => hide());
  cur.timer = setTimeout(hide, cur.mode === 'pick' ? 120000 : 45000);
  card.cur = cur;
  sendModel();
  place();
}
// Escape closes the card; in the list of logins the arrow keys move and Enter picks, but only once an arrow key has chosen a row,
// so Enter in the field still submits the form like it always did.
function keys(cur) {
  return (ev, input) => {
    if (input.type !== 'keyDown' || !card || card.cur !== cur) return;
    const k = input.key;
    if (k === 'Escape') { ev.preventDefault(); hide(); return; }
    if (cur.mode !== 'pick') return;
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      ev.preventDefault();
      const n = cur.entries.length; cur.sel = k === 'ArrowDown' ? (cur.sel + 1) % n : cur.sel <= 0 ? n - 1 : cur.sel - 1;
      if (!card.view.webContents.isDestroyed()) card.view.webContents.send('nova:pwcard-select', cur.sel);
    } else if (k === 'Enter' && cur.sel >= 0) { ev.preventDefault(); pick(cur.sel); }
  };
}
function hide() {
  if (!card || !card.cur) return;
  const cur = card.cur; card.cur = null;
  clearTimeout(cur.timer);
  try { if (cur.kb) cur.wc.removeListener('before-input-event', cur.kb); if (cur.nav) cur.wc.removeListener('did-navigate', cur.nav); } catch { /* page gone */ }
  try { if (card.view.webContents.isFocused() && !cur.wc.isDestroyed()) cur.wc.focus(); } catch { /* ignore */ } // the click on the card took the keyboard: give it back
  try { C.win().contentView.removeChildView(card.view); } catch { /* not attached */ }
  clearTimeout(card.idle);
  card.idle = setTimeout(destroyCard, 30000); // a second login within half a minute finds the card ready; after that it is gone and costs nothing
}
function destroyCard() {
  if (!card || card.cur) return;
  const wc = card.view.webContents; card = null;
  try { if (!wc.isDestroyed()) wc.close(); } catch { /* already closed */ }
}
// Called from main.js layout(): the card only lives over the page in front, with no overlay open. It follows the page when the window changes.
function relayout() {
  if (!card || !card.cur) return;
  const cur = card.cur, v = cur.tab && cur.tab.view;
  if (!v || v.webContents.isDestroyed() || C.activeTab() !== cur.tab || C.overlayOpen()) return hide();
  place();
}

function showSave(tab, p) {
  const secure = p.origin.startsWith('https:');
  present({ mode: p.update ? 'update' : 'save', tab, wc: tab.view.webContents, offer: p, h: secure ? H_SAVE : H_SAVE_PLAIN, model: { mode: p.update ? 'update' : 'save', site: labelOf(p.origin), secure, user: p.user } });
}
function showPick(tab, t, list, rect, userOnly) {
  present({ mode: 'pick', userOnly: !!userOnly, tab, wc: tab.view.webContents, frame: t.frame, origin: t.origin, entries: list, sel: -1, rect, h: H_PICK + ROW * list.length, model: { mode: 'pick', entries: list.map((e) => ({ user: e.user })) } });
}

function doSave() {
  const cur = card && card.cur, o = cur && cur.offer; if (!o) return;
  hide();
  try { const r = getStore().put(o.origin, o.user, o.blob, o.id); C.toast(r.status === 'updated' ? `Password updated for ${labelOf(o.origin)}.` : `Password saved for ${labelOf(o.origin)}. Manage it under Settings › Passwords.`); }
  catch (err) { C.toast(err.user ? err.message : 'Nova could not save the password.'); console.error('passwords save', err.message); }
}
function doNever() {
  const cur = card && card.cur, o = cur && cur.offer; if (!o) return;
  hide();
  try { getStore().addNever(o.origin); C.toast(`Nova will not offer to save passwords for ${labelOf(o.origin)}. Undo it under Settings › Passwords.`); } catch (err) { console.error('passwords never', err.message); }
}
// The user clicked a login in the list: re-check that the page is still the same origin, then (and only then) the password leaves the store.
function pick(i) {
  const cur = card && card.cur; if (!cur || cur.mode !== 'pick') return;
  const entry = cur.entries[i]; if (!entry) return;
  hide();
  try {
    if (originOf(cur.frame.url) !== cur.origin) return; // the page moved on
    const s = getStore();
    if (s.originOfId(entry.id) !== cur.origin) return;
    if (cur.userOnly) { cur.frame.send('nova:pw-fill', { user: entry.user, userOnly: true }); carried.set(cur.wc.id, { origin: cur.origin, user: entry.user, t: Date.now() }); return; } // the user name step: the password is not touched
    cur.frame.send('nova:pw-fill', { user: entry.user, pass: s.reveal(entry.id) });
  } catch (err) { C.toast('Nova could not fill that login.'); console.error('passwords fill', err.message); }
}

// ---------- page side questions ----------
function install() {
  // answered synchronously, once per top frame: is the saver on for this page, may it save, does this site have saved logins?
  ipcMain.on('nova:pw-ask', (e) => {
    let r = { on: false };
    try {
      const t = featureOn() && topOf(e);
      if (t) {
        const s = getStore(), c = cfg(), ok = s.available();
        const cy = carryFor(e.sender.id, t.origin);
        r = { on: true, save: ok && c.save && !isPrivate(e.sender) && !s.isNever(t.origin), fill: ok && c.fill && s.countFor(t.origin) > 0, pending: pending.has(e.sender.id), carried: ok && c.save && cy ? cy.user : '' };
      }
    } catch (err) { console.error('passwords ask', err.message); }
    e.returnValue = r; // always answered: the page waits for it
  });
  // the user name step of a sign-in was sent off: keep the name for the page or step that asks for the password
  ipcMain.on('nova:pw-user', (e, d) => {
    try {
      const t = featureOn() && cfg().save && !isPrivate(e.sender) && topOf(e);
      if (!t || !d || typeof d.user !== 'string') return;
      const user = d.user.trim(); if (!user || user.length > LIMITS.user) return;
      const s = getStore(); if (!s.available() || s.isNever(t.origin)) return;
      carried.set(e.sender.id, { origin: t.origin, user, t: Date.now() });
    } catch (err) { console.error('passwords user', err.message); }
  });
  // a login form was submitted. The password is sealed here and now; the offer itself waits until the next page has shown that the sign-in worked.
  ipcMain.on('nova:pw-submit', (e, d) => {
    let ok = false;
    try {
      const t = featureOn() && cfg().save && !isPrivate(e.sender) && topOf(e);
      if (t && d && typeof d.user === 'string' && typeof d.pass === 'string') {
        const s = getStore(), user = d.user.trim();
        if (s.available() && !s.isNever(t.origin) && user && user.length <= LIMITS.user && d.pass && d.pass.length <= LIMITS.password) {
          const st = s.check(t.origin, user, d.pass);
          drop(e.sender.id);
          if (st.state !== 'same') {
            const id = e.sender.id, p = { origin: t.origin, user, blob: s.seal(d.pass), id: st.id, update: st.state === 'update' };
            p.timer = setTimeout(() => pending.delete(id), 120000);
            pending.set(id, p); ok = true; carried.delete(id);
          }
        }
      }
    } catch (err) { console.error('passwords submit', err.message); }
    L(`submit seen on ${(() => { const q = topOf(e); return q ? labelOf(q.origin) : 'a page that is not allowed'; })()}: ${ok ? 'an offer will follow' : 'nothing to offer'}`);
    e.returnValue = ok;
  });
  // the page after a submit, or the same page a moment later: is there still a password field? Then the sign-in failed and nothing is offered.
  ipcMain.on('nova:pw-landed', (e, d) => {
    try {
      const id = e.sender.id, p = pending.get(id);
      if (!p || !featureOn() || !topOf(e)) return;
      L(`page after the sign-in: ${d && d.hasForm ? 'still shows a password field, no offer' : 'no password field, offering to save'}`);
      if (!d || d.hasForm) { if (!e.sender.isLoading()) drop(id); return; } // still loading: the page that follows will answer
      drop(id);
      const tab = tabOf(e.sender);
      if (tab && tab === C.activeTab() && !C.overlayOpen()) showSave(tab, p);
    } catch (err) { console.error('passwords landed', err.message); }
  });
  // the user clicked into a login field: list the logins saved for exactly this origin
  ipcMain.on('nova:pw-focus', (e, rc) => {
    try {
      const t = featureOn() && cfg().fill && rc && topOf(e);
      if (!t) return;
      const tab = tabOf(e.sender);
      if (!tab || tab !== C.activeTab() || C.overlayOpen()) return;
      let list = getStore().matches(t.origin);
      const cy = !rc.userOnly && carryFor(e.sender.id, t.origin);
      if (cy) { const only = list.filter((x) => x.user.toLowerCase() === cy.user.toLowerCase()); if (only.length) list = only; } // the password step lists the user name that was just given
      list = list.slice(0, 5);
      if (!list.length) return;
      const n = (v) => (Number.isFinite(+v) ? +v : 0);
      showPick(tab, t, list, { x: n(rc.x), y: n(rc.y), w: n(rc.w), h: n(rc.h) }, !!rc.userOnly);
    } catch (err) { console.error('passwords focus', err.message); }
  });
  ipcMain.on('nova:pw-dismiss', (e) => { if (card && card.cur && card.cur.mode === 'pick' && card.cur.wc === e.sender) hide(); });
  // clicks in the card
  ipcMain.on('nova:pwcard', (e, op, arg) => {
    if (!card || e.sender !== card.view.webContents || !e.senderFrame || e.senderFrame.parent) return;
    switch (op) {
      case 'ready': card.ready = true; sendModel(); break;
      case 'save': doSave(); break;
      case 'never': doNever(); break;
      case 'later': hide(); break;
      case 'pick': pick(+arg); break;
      case 'manage': hide(); C.openOverlay('settings', { tab: 'Passwords' }); break;
    }
  });
}

// ---------- the Settings page (ui/pwpage.js) ----------
function copy(s, a) {
  const id = String(a.id), user = a.what === 'user';
  const text = user ? s.userOf(id) : s.reveal(id);
  if (text == null) return { error: 'That login is gone.' };
  clipboard.writeText(text);
  if (!user) { const h = sha(text); setTimeout(() => { try { if (sha(clipboard.readText()) === h) clipboard.clear(); } catch { /* ignore */ } }, 30000); } // only the hash is kept meanwhile
  return { ok: true };
}
async function exportCsv(s) {
  const { rows, failed } = s.exportRows();
  if (!rows.length) return { error: failed ? 'This Windows account cannot read the saved passwords, so there is nothing to export.' : 'There are no saved passwords to export.' };
  const r = await dialog.showSaveDialog(C.win(), { title: 'Export passwords', defaultPath: path.join(app.getPath('documents'), 'Nova Passwords.csv'), filters: [{ name: 'CSV file', extensions: ['csv'] }] });
  if (r.canceled || !r.filePath) return { canceled: true };
  fs.writeFileSync(r.filePath, csv.format(rows), { encoding: 'utf8', mode: 0o600 });
  return { n: rows.length, failed, file: path.basename(r.filePath) };
}
async function importCsv(s) {
  const r = await dialog.showOpenDialog(C.win(), { title: 'Import passwords', properties: ['openFile'], filters: [{ name: 'CSV file', extensions: ['csv'] }, { name: 'All files', extensions: ['*'] }] });
  if (r.canceled || !r.filePaths[0]) return { canceled: true };
  const f = r.filePaths[0];
  if (fs.statSync(f).size > csv.MAX_BYTES) return { error: 'That file is too large to be a password list.' };
  const t = csv.toRows(csv.parse(fs.readFileSync(f, 'utf8')));
  if (t.error) return { error: t.error };
  const res = s.importRows(t.rows);
  return { ...res, bad: res.bad + t.skipped, file: path.basename(f) };
}
// Everything the Settings page asks for comes through here, and only the interface itself may ask.
async function cmd(e, a) {
  a = a || {};
  const ui = C.ui();
  if (!e || !ui || e.sender !== ui.webContents) return { error: 'denied' };
  touch();
  const s = getStore();
  try {
    switch (a.op) {
      case 'status': return { available: s.available(), problem: s.error(), count: s.count() };
      case 'list': return { items: s.list(), never: s.neverList() };
      case 'reveal': return { password: s.reveal(String(a.id)) };
      case 'copy': return copy(s, a);
      case 'remove': return { ok: s.remove(String(a.id)) };
      case 'removeAll': return { n: s.removeAll() };
      case 'unnever': s.removeNever(String(a.origin)); return { ok: true };
      case 'export': return await exportCsv(s);
      case 'import': return await importCsv(s);
    }
  } catch (err) { console.error('passwords', a.op, err.message); return { error: err.user ? err.message : 'That did not work.' }; }
  return { error: 'Unknown request.' };
}

// Registers or removes the frame preload so it follows the Features switch. Call after any change to settings.features.
function sync() {
  const on = featureOn();
  for (const s of C.sessions()) {
    if (on && !preloadIds.has(s)) { try { preloadIds.set(s, s.registerPreloadScript({ type: 'frame', filePath: path.join(__dirname, 'pw-preload.js') })); } catch (err) { console.error('passwords preload', err.message); } }
    else if (!on && preloadIds.has(s)) { try { s.unregisterPreloadScript(preloadIds.get(s)); } catch { /* already gone */ } preloadIds.delete(s); }
  }
  if (!on) { hide(); for (const id of [...pending.keys()]) drop(id); carried.clear(); destroyCard(); touch(); }
}

function init(ctx) { C = ctx; install(); sync(); }
module.exports = { init, sync, relayout, cmd };
