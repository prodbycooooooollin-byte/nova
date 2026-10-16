// Run with: node scripts/build-hub.js  -> hub.json + ui/icons/ext/<id>.png
// Asks the Chrome Web Store about every candidate (name, icon, user count, last update) and reads the manifest from the CRX to see which
// browser APIs it needs. scripts/probe-extensions.js then adds whether it actually starts inside Nova.
const fs = require('fs'), path = require('path');
const AdmZip = require('adm-zip');
const candidates = require('./hub-candidates');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
const root = path.join(__dirname, '..'), iconDir = path.join(root, 'ui', 'icons', 'ext');
fs.mkdirSync(iconDir, { recursive: true });
const num = (s) => { const m = /([\d.,]+)\s*([KM]?)/i.exec(s || ''); if (!m) return 0; let n = parseFloat(m[1].replace(/,/g, '')); if (/k/i.test(m[2])) n *= 1e3; if (/m/i.test(m[2])) n *= 1e6; return Math.round(n); };
const decode = (s) => (s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
// APIs Electron does not provide to extensions at all: an extension that depends on them cannot work
const UNSUPPORTED = ['declarativeNetRequest', 'declarativeNetRequestWithHostAccess', 'userScripts', 'nativeMessaging', 'sidePanel', 'devtools_page', 'proxy', 'webRequestBlocking', 'debugger', 'tabCapture', 'desktopCapture', 'identity'];
(async () => {
  const out = [];
  for (const c of candidates) {
    try {
      const page = await (await fetch(`https://chromewebstore.google.com/detail/${c.id}?hl=en`, { headers: { 'User-Agent': UA } })).text();
      const title = decode((/<title>([^<]+?) - Chrome Web Store<\/title>/.exec(page) || [])[1]);
      if (!title) throw new Error('not on the store');
      const img = (/<meta property="og:image" content="([^"]+)"/.exec(page) || [])[1];
      const users = num((/([\d.,]+[KM]?\+?)\s*users/i.exec(page) || [])[1]);
      const updated = (/Updated<\/[^>]+>\s*<[^>]+>([^<]+)</.exec(page) || /"([A-Z][a-z]+ \d{1,2}, \d{4})"/.exec(page) || [])[1] || '';
      const crxRes = await fetch(`https://clients2.google.com/service/update2/crx?response=redirect&prodversion=146.0.0.0&acceptformat=crx2,crx3&x=${encodeURIComponent(`id=${c.id}&installsource=ondemand&uc`)}`, { headers: { 'User-Agent': UA } });
      if (!crxRes.ok) throw new Error('no download (' + crxRes.status + ')');
      const buf = Buffer.from(await crxRes.arrayBuffer());
      if (buf.subarray(0, 4).toString() !== 'Cr24') throw new Error('not a CRX');
      const ver = buf.readUInt32LE(4), zipAt = ver === 3 ? 12 + buf.readUInt32LE(8) : 16 + buf.readUInt32LE(8) + buf.readUInt32LE(12);
      const zip = new AdmZip(buf.subarray(zipAt));
      const mf = JSON.parse(zip.readAsText('manifest.json').replace(/^﻿/, ''));
      const perms = [...(mf.permissions || []), ...(mf.optional_permissions || [])];
      if (mf.devtools_page) perms.push('devtools_page'); if (mf.side_panel) perms.push('sidePanel');
      const blockers = UNSUPPORTED.filter((p) => perms.includes(p));
      if (img) { const r = await fetch(img.replace(/=s\d+.*$/, '=s128-rj-sc0x00ffffff')); if (r.ok) fs.writeFileSync(path.join(iconDir, c.id + '.png'), Buffer.from(await r.arrayBuffer())); }
      out.push({ id: c.id, name: title, tagline: c.tagline, cat: c.cat, must: !!c.must, users, updated, mv: mf.manifest_version, version: mf.version, blockers, icon: fs.existsSync(path.join(iconDir, c.id + '.png')) ? `icons/ext/${c.id}.png` : '' });
      console.log('ok  ', title, '|', users.toLocaleString(), 'users | MV' + mf.manifest_version, blockers.length ? '| needs ' + blockers.join(',') : '');
    } catch (e) { console.log('skip', c.id, e.message); }
  }
  fs.writeFileSync(path.join(root, 'hub.json'), JSON.stringify({ built: new Date().toISOString(), items: out }, null, 1));
  console.log(out.length, 'extensions written');
})();
