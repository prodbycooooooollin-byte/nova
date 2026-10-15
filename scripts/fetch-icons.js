// One-off helper: downloads the small brand icons Nova bundles (search engines, services, browsers, suggested extensions)
// into ui/icons so the interface never shows placeholder letters. Run: ELECTRON_RUN_AS_NODE=1 electron scripts/fetch-icons.js
const fs = require('fs'), path = require('path');
const AdmZip = require('adm-zip');
const out = path.join(__dirname, '..', 'ui', 'icons'); fs.mkdirSync(out, { recursive: true });
const png = (b) => b.length > 80 && b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
const SITES = {
  'site-google': 'google.com', 'site-youtube': 'youtube.com', 'site-microsoft': 'microsoft.com', 'site-github': 'github.com', 'site-discord': 'discord.com', 'site-spotify': 'spotify.com', 'site-reddit': 'reddit.com', 'site-x': 'x.com', 'site-amazon': 'amazon.com', 'site-netflix': 'netflix.com',
  'eng-duckduckgo': 'duckduckgo.com', 'eng-google': 'google.com', 'eng-brave': 'search.brave.com', 'eng-startpage': 'startpage.com', 'eng-ecosia': 'ecosia.org', 'eng-bing': 'bing.com',
  'br-chrome': 'google.com/chrome', 'br-edge': 'microsoft.com/edge', 'br-brave': 'brave.com', 'br-vivaldi': 'vivaldi.com', 'br-opera': 'opera.com',
};
const EXT = ['ghmbeldphafepmbegfdlkpapadhbakde', 'nngceckbapebfimnlniiiahkandclblb', 'aeblfdkhhhdcdjpifhhbdiojplfjncoa', 'eimadpbcbfnmbkopoojfekhnkhdbieeh', 'mnjggcdmjocbbbhaepdhchncahnbgone', 'gebbhagfogifgggkldgodflihgfeacdd'];
(async () => {
  for (const [name, domain] of Object.entries(SITES)) {
    try { const r = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`); const b = Buffer.from(await r.arrayBuffer()); if (png(b)) { fs.writeFileSync(path.join(out, name + '.png'), b); console.log('ok', name, b.length); } else console.log('skip', name); } catch (e) { console.log('fail', name, e.message); }
  }
  for (const id of EXT) {
    try {
      const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${process.versions.chrome}&acceptformat=crx2,crx3&x=${encodeURIComponent(`id=${id}&installsource=ondemand&uc`)}`;
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      const zipAt = buf.readUInt32LE(4) === 3 ? 12 + buf.readUInt32LE(8) : 16 + buf.readUInt32LE(8) + buf.readUInt32LE(12);
      const zip = new AdmZip(buf.subarray(zipAt)); const m = JSON.parse(zip.readAsText('manifest.json').replace(/^﻿/, ''));
      const icons = m.icons || (m.action || m.browser_action || {}).default_icon || {}; const best = typeof icons === 'string' ? icons : icons[Object.keys(icons).sort((a, b) => b - a)[0]];
      const data = zip.readFile(best.replace(/^\//, '')); if (data && png(data)) { fs.writeFileSync(path.join(out, 'ext-' + id + '.png'), data); console.log('ok ext', id, data.length); } else console.log('skip ext', id);
    } catch (e) { console.log('fail ext', id, e.message); }
  }
})();
