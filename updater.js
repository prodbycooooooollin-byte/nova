// Nova auto-updater. Checks a feed, downloads the new Setup exe in the background,
// and applies it on the next quit (or immediately when asked) by running `Setup --update`.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const pkg = require('./package.json');
let pending = null; // { version, file }
let busy = false;
let notify = () => {};

const newer = (a, b) => {
  const pa = String(a).replace(/^v/, '').split('.').map(Number), pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
  return false;
};

async function readFeed(feed) {
  if (/^[\w.-]+\/[\w.-]+$/.test(feed)) { // GitHub "owner/repo"
    const r = await fetch(`https://api.github.com/repos/${feed}/releases/latest`, { headers: { 'User-Agent': 'Nova-Updater', Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error('feed ' + r.status);
    const j = await r.json();
    const asset = (j.assets || []).find((a) => /Setup.*\.exe$/i.test(a.name));
    if (!asset) throw new Error('no setup asset in latest release');
    return { version: j.tag_name, url: asset.browser_download_url, sha256: (asset.digest || '').replace(/^sha256:/, '') || null };
  }
  const r = await fetch(feed, { headers: { 'User-Agent': 'Nova-Updater' } });
  if (!r.ok) throw new Error('feed ' + r.status);
  const j = await r.json(); // { version, url, sha256? }
  return { version: j.version, url: new URL(j.url, feed).href, sha256: j.sha256 || null };
}

async function check(feed, { manual = false } = {}) {
  if (busy) return;
  if (!app.isPackaged && !manual) return;
  if (!feed) { if (manual) notify({ type: 'toast', text: 'No update feed is configured yet (Settings › Backup & updates).' }); return; }
  busy = true;
  try {
    const info = await readFeed(feed);
    if (!newer(info.version, pkg.version)) { if (manual) notify({ type: 'toast', text: `Nova ${pkg.version} is up to date.` }); return; }
    const dir = path.join(app.getPath('userData'), 'updates'); fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `Nova-Setup-${String(info.version).replace(/^v/, '')}.exe`);
    if (!fs.existsSync(file)) {
      notify({ type: 'toast', text: `Downloading Nova ${info.version}…` });
      const res = await fetch(info.url, { headers: { 'User-Agent': 'Nova-Updater' } });
      if (!res.ok) throw new Error('download ' + res.status);
      const tmp = file + '.part';
      const hash = crypto.createHash('sha256'); const out = fs.createWriteStream(tmp);
      for await (const chunk of res.body) { hash.update(chunk); if (!out.write(chunk)) await new Promise((r) => out.once('drain', r)); }
      await new Promise((r) => out.end(r));
      if (info.sha256 && hash.digest('hex').toLowerCase() !== info.sha256.toLowerCase()) { fs.rmSync(tmp, { force: true }); throw new Error('checksum mismatch'); }
      fs.renameSync(tmp, file);
    }
    pending = { version: info.version, file };
    notify({ type: 'ready', version: info.version });
  } catch (e) { console.error('update check failed:', e.message); if (manual) notify({ type: 'toast', text: 'Update check failed: ' + e.message }); }
  finally { busy = false; }
}

// Start the downloaded installer in update mode; the caller must quit right after.
function apply() {
  if (!pending) return false;
  const dir = path.dirname(process.execPath);
  spawn(pending.file, ['--update', '--dir', dir, '--relaunch'], { detached: true, stdio: 'ignore' }).unref();
  pending = null;
  return true;
}

module.exports = {
  version: pkg.version,
  defaultFeed: pkg.novaUpdateFeed || '',
  hasPending: () => !!pending,
  onEvent: (fn) => { notify = fn; },
  check, apply,
};
