// Nova auto-updater.
// Normal updates are a small data file (the new app.asar, about 8 MB) that boot.js starts on the next launch: no installer is run, so there is
// nothing for an antivirus to block, and no process is started or killed. Only when an update needs a newer engine than the installed one
// does the full Setup exe download instead, and if Windows or an antivirus will not start it, Nova says so and offers the download page.
// All network traffic goes through Chromium's own stack (net.fetch), which follows the system proxy and trusts the certificates that antivirus
// web shields and company networks install; Node's own fetch does not, and fails behind many of them.
const { app, net } = require('electron');
const fs = require('fs');
const ofs = require('original-fs'); // *.asar is a plain file here
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');

const pkg = require('./package.json');
const RUNTIME = +process.versions.electron.split('.')[0];
let LOADER = 0; // set by boot.js; 0 means this copy was not started through the launcher (a development run)
try { LOADER = (global.__novaBoot && global.__novaBoot.loader) || 0; } catch { /* ignore */ }

let pending = null; // { kind: 'patch' | 'setup', version, file }
let busy = false, busySince = 0;
let status = { state: 'idle' };
let notify = () => {};
let feedUsed = '', blockedSetup = ''; // blockedSetup: a version whose installer Windows would not start; it is not downloaded again behind the person's back

const num = (v) => String(v).replace(/^v/, '').split('.').map(Number);
const newer = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) > (y[i] || 0)) return true; if ((x[i] || 0) < (y[i] || 0)) return false; } return false; };
const udir = () => path.join(app.getPath('userData'), 'updates');
const logLine = (m) => { try { ofs.mkdirSync(udir(), { recursive: true }); ofs.appendFileSync(path.join(udir(), 'update.log'), `${new Date().toISOString()} ${m}\n`); } catch { /* ignore */ } };
const setStatus = (s) => { status = s; try { notify({ type: 'status', status }); } catch { /* ignore */ } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const releasePage = () => (/^[\w.-]+\/[\w.-]+$/.test(feedUsed) ? `https://github.com/${feedUsed}/releases/latest` : '');
// what the person reads when something goes wrong: the cause in plain words, never a stack trace
function say(e) {
  const m = String((e && e.message) || e || '');
  if (/stall/i.test(m)) return 'The download stopped midway. Check the connection and try again.';
  if (/abort|timeout|timed out/i.test(m)) return 'GitHub did not answer in time. Check the connection, VPN or firewall and try again.';
  if (/ERR_|fetch failed|ENOTFOUND|ECONN|network|certificate|SSL/i.test(m)) return 'Nova could not reach GitHub. Check the connection, VPN or firewall and try again.';
  if (/EPERM|EACCES|EBUSY|UNKNOWN|virus|blocked/i.test(m)) return 'Windows or your antivirus would not let Nova save or start the update.';
  if (/feed (403|429)/.test(m)) return 'GitHub is limiting requests from this network right now. Try again in a little while.';
  return m.length > 140 ? m.slice(0, 140) + '…' : m;
}

async function getJson(url, headers = {}) {
  const r = await net.fetch(url, { headers: { 'User-Agent': 'Nova-Updater', ...headers }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('feed ' + r.status);
  return r.json();
}
// Both feed shapes end up the same: { version, setup: {url, sha256, name}, patch: {url, sha256, runtime, loader} }
function norm(j, base) {
  const abs = (u) => new URL(u, base).href;
  const setup = j.setup ? { ...j.setup, url: abs(j.setup.url) } : j.url ? { url: abs(j.url), sha256: j.sha256 || null, name: path.basename(new URL(abs(j.url)).pathname) } : null;
  const patch = j.patch ? { ...j.patch, url: abs(j.patch.url) } : null;
  if (!j.version) throw new Error('the update feed has no version');
  return { version: String(j.version).replace(/^v/, ''), setup, patch, notes: j.notes || '' };
}
async function readFeed(feed) {
  feedUsed = feed;
  if (/^[\w.-]+\/[\w.-]+$/.test(feed)) { // GitHub "owner/repo"
    try { return norm(await getJson(`https://github.com/${feed}/releases/latest/download/latest.json`), 'https://github.com/'); } // plain file download: no API, no rate limit
    catch (e) { logLine('latest.json: ' + e.message); }
    const j = await getJson(`https://api.github.com/repos/${feed}/releases/latest`, { Accept: 'application/vnd.github+json' });
    const asset = (j.assets || []).find((a) => /Setup.*\.exe$/i.test(a.name));
    if (!asset) throw new Error('no setup file in the latest release');
    return { version: String(j.tag_name).replace(/^v/, ''), setup: { url: asset.browser_download_url, name: asset.name, sha256: (asset.digest || '').replace(/^sha256:/, '') || null }, patch: null, notes: '' };
  }
  return norm(await getJson(feed), feed);
}

// Download to a .part file, check the checksum, move into place. A download that goes quiet for 45 seconds is given up instead of hanging for ever.
async function download(url, dest, sha256, onProgress) {
  const ac = new AbortController(); let timer;
  const bump = () => { clearTimeout(timer); timer = setTimeout(() => ac.abort(new Error('the download stalled')), 45000); };
  bump();
  const tmp = dest + '.part';
  try {
    const res = await net.fetch(url, { headers: { 'User-Agent': 'Nova-Updater' }, signal: ac.signal });
    if (!res.ok) throw new Error('download ' + res.status);
    const total = Number(res.headers.get('content-length')) || 0;
    const hash = crypto.createHash('sha256'), out = ofs.createWriteStream(tmp); let got = 0;
    for await (const chunk of res.body) {
      bump(); got += chunk.length; hash.update(chunk);
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
      if (total) onProgress(got / total);
    }
    await new Promise((res2, rej) => out.end((e) => (e ? rej(e) : res2())));
    if (sha256 && hash.digest('hex').toLowerCase() !== String(sha256).toLowerCase()) throw new Error('the downloaded file is damaged (checksum differs)');
    for (let i = 0; ; i++) { try { ofs.renameSync(tmp, dest); break; } catch (e) { if (i > 6) throw e; await sleep(500); } } // a virus scanner may hold the file for a moment
  } catch (e) { try { ofs.rmSync(tmp, { force: true }); } catch { /* ignore */ } throw e; }
  finally { clearTimeout(timer); }
}

function tidy() { // old installers and bundles are not kept: a Setup alone is 78 MB
  try {
    for (const f of ofs.readdirSync(udir())) {
      if (/^\d+\.\d+\.\d+$/.test(f) && newer(pkg.version, f)) { try { ofs.rmSync(path.join(udir(), f), { recursive: true, force: true }); } catch { /* still in use: next time */ } } // older than what runs now
      const m = /^Nova-Setup-(.+?)\.exe(\.part)?$/.exec(f);
      if (m && (m[2] || !newer(m[1], pkg.version))) ofs.rmSync(path.join(udir(), f), { force: true });
    }
  } catch { /* ignore */ }
}

function patchOk(info) { // can this install take the small update?
  if (!info.patch || !LOADER) return false;
  if (!app.isPackaged && !process.env.NOVA_UPDATE_TEST) return false;
  return (info.patch.runtime || 0) <= RUNTIME && (info.patch.loader || 1) <= LOADER;
}
const readCurrent = () => { try { return JSON.parse(ofs.readFileSync(path.join(udir(), 'current.json'), 'utf8')); } catch { return {}; } };
const writeCurrent = (o) => { const f = path.join(udir(), 'current.json'), t = f + '.tmp'; ofs.writeFileSync(t, JSON.stringify(o)); ofs.renameSync(t, f); };

async function fetchPatch(info) {
  const dir = udir(); ofs.mkdirSync(dir, { recursive: true });
  const cur = readCurrent();
  if ((cur.bad || []).includes(info.version)) throw new Error(`Nova ${info.version} did not start on this PC, so Nova stays on ${pkg.version}.`);
  const have = cur.active;
  if (have && have.version === info.version && ofs.existsSync(have.asar)) return have; // already downloaded in an earlier session
  const zip = path.join(dir, `Nova-update-${info.version}.zip`);
  setStatus({ state: 'downloading', version: info.version, pct: 0, kind: 'patch' });
  await download(info.patch.url, zip, info.patch.sha256, (p) => setStatus({ state: 'downloading', version: info.version, pct: Math.round(p * 100), kind: 'patch' }));
  const target = path.join(dir, info.version), stage = target + '.tmp';
  ofs.rmSync(stage, { recursive: true, force: true }); ofs.mkdirSync(stage, { recursive: true });
  const z = new AdmZip(zip);
  for (const e of z.getEntries()) { // only plain files, only inside the folder
    if (e.isDirectory) continue;
    const to = path.resolve(stage, e.entryName);
    if (!to.startsWith(path.resolve(stage) + path.sep)) throw new Error('the update file is not valid');
    ofs.mkdirSync(path.dirname(to), { recursive: true }); ofs.writeFileSync(to, e.getData());
  }
  const asarIn = path.join(stage, 'app.asar');
  const st = ofs.statSync(asarIn); if (st.size < 1e6) throw new Error('the update file is incomplete');
  ofs.rmSync(target, { recursive: true, force: true }); ofs.renameSync(stage, target);
  ofs.rmSync(zip, { force: true });
  for (const f of ofs.readdirSync(dir)) if (/^\d+\.\d+\.\d+$/.test(f) && f !== info.version && f !== pkg.version) { try { ofs.rmSync(path.join(dir, f), { recursive: true, force: true }); } catch { /* in use */ } } // the bundle that is running stays until the restart
  const active = { version: info.version, asar: path.join(target, 'app.asar'), size: st.size, runtime: info.patch.runtime || 0, loader: info.patch.loader || 1, tries: 0 };
  writeCurrent({ active, bad: cur.bad || [] });
  return active;
}
async function fetchSetup(info) {
  if (!info.setup) throw new Error('this release has no installer');
  const dir = udir(); ofs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `Nova-Setup-${info.version}.exe`);
  if (!ofs.existsSync(file)) {
    setStatus({ state: 'downloading', version: info.version, pct: 0, kind: 'setup' });
    await download(info.setup.url, file, info.setup.sha256, (p) => setStatus({ state: 'downloading', version: info.version, pct: Math.round(p * 100), kind: 'setup' }));
  }
  return file;
}

async function check(feed, { manual = false } = {}) {
  if (busy && Date.now() - busySince < 25 * 60e3) { if (manual) notify({ type: 'toast', text: 'Nova is already checking for updates.' }); return; }
  if (!app.isPackaged && !manual) return;
  if (!feed) { if (manual) notify({ type: 'toast', text: 'No update feed is configured yet (Settings › Backup & updates).' }); return; }
  busy = true; busySince = Date.now();
  if (manual) setStatus({ state: 'checking' });
  try {
    const info = await readFeed(feed);
    tidy();
    if (!newer(info.version, pkg.version)) { setStatus({ state: 'current', version: pkg.version }); if (manual) notify({ type: 'toast', text: `Nova ${pkg.version} is up to date.` }); return; }
    if (pending && pending.version === info.version) { setStatus({ state: 'ready', version: info.version, kind: pending.kind }); return; }
    if (!manual && blockedSetup === info.version) return;
    if (patchOk(info)) {
      try { await fetchPatch(info); pending = { kind: 'patch', version: info.version }; }
      catch (e) { logLine('patch failed: ' + e.message); if (!info.setup || /did not start/.test(e.message)) throw e; /* fall back to the full installer */ }
    }
    if (!pending) pending = { kind: 'setup', version: info.version, file: await fetchSetup(info) };
    setStatus({ state: 'ready', version: info.version, kind: pending.kind });
    notify({ type: 'ready', version: info.version });
  } catch (e) {
    logLine('check failed: ' + (e.stack || e.message)); console.error('update check failed:', e.message);
    setStatus({ state: 'error', error: say(e), page: releasePage() });
    if (manual) notify({ type: 'toast', text: 'Update failed: ' + say(e) });
  } finally { busy = false; }
}

// Make the update take effect. Resolves true when Nova should quit now.
// patch: Nova restarts and boot.js starts the new bundle. setup: the installer is started and has to be allowed to run.
async function apply() {
  if (!pending) return false;
  const p = pending;
  if (p.kind === 'patch') { pending = null; try { app.relaunch(); } catch (e) { logLine('relaunch: ' + e.message); } return true; }
  if (!ofs.existsSync(p.file)) { pending = null; setStatus({ state: 'error', error: 'The update file is gone. An antivirus may have removed it.', page: releasePage() }); return false; }
  return new Promise((resolve) => {
    const fail = (e) => { logLine('setup would not start: ' + e.message); blockedSetup = p.version; pending = null; try { ofs.rmSync(p.file, { force: true }); } catch { /* ignore */ } setStatus({ state: 'error', error: say(e) + ' The installer can be downloaded by hand.', page: releasePage() }); notify({ type: 'toast', text: releasePage() ? 'The installer could not start. Settings › Backup & updates has the download link.' : 'The installer could not start.' }); resolve(false); };
    let child;
    try { child = spawn(p.file, ['--update', '--dir', path.dirname(process.execPath), '--relaunch'], { detached: true, stdio: 'ignore' }); }
    catch (e) { return fail(e); } // Windows or an antivirus refused to start the file
    child.once('error', fail);
    child.once('spawn', () => { child.unref(); pending = null; resolve(true); });
  });
}
// Quitting with an update waiting: a small update needs nothing (the next start picks it up); an installer is started if it still can be.
function applyOnQuit() {
  const p = pending; if (!p || p.kind !== 'setup' || !ofs.existsSync(p.file)) return;
  try { const c = spawn(p.file, ['--update', '--dir', path.dirname(process.execPath), '--relaunch'], { detached: true, stdio: 'ignore' }); c.on('error', () => {}); c.unref(); pending = null; }
  catch (e) { logLine('setup on quit: ' + e.message); }
}

module.exports = {
  version: pkg.version,
  defaultFeed: pkg.novaUpdateFeed || '',
  hasPending: () => !!pending,
  status: () => ({ ...status, current: pkg.version, pending: pending ? { kind: pending.kind, version: pending.version } : null }),
  onEvent: (fn) => { notify = fn; },
  check, apply, applyOnQuit,
};
