// Run with: node scripts/fetch-darkreader.js [version]  -> refreshes the bundled Dark Reader engine (MIT) in assets/darkreader
// Takes darkreader.js and LICENSE from the npm package, so updating the engine is one command and a look at the diff.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const dir = path.join(__dirname, '..', 'assets', 'darkreader');
fs.mkdirSync(dir, { recursive: true });
const WANT = { 'package/darkreader.js': 'darkreader.js', 'package/LICENSE': 'LICENSE' };
(async () => {
  const version = process.argv[2] || 'latest';
  const meta = await (await fetch(`https://registry.npmjs.org/darkreader/${version}`)).json();
  if (!meta.dist || !meta.dist.tarball) throw new Error('npm has no darkreader@' + version);
  if (meta.license !== 'MIT') throw new Error('Dark Reader is no longer MIT-licensed (' + meta.license + '); stop and check before bundling it');
  const tgz = Buffer.from(await (await fetch(meta.dist.tarball)).arrayBuffer());
  const tar = zlib.gunzipSync(tgz);
  for (let off = 0; off + 512 <= tar.length;) { // a tar file is 512-byte headers each followed by the padded file body
    const name = tar.toString('utf8', off, off + 100).replace(/\0.*$/, '');
    if (!name) break;
    const size = parseInt(tar.toString('utf8', off + 124, off + 136).replace(/\0.*$/, '').trim() || '0', 8);
    if (WANT[name]) { fs.writeFileSync(path.join(dir, WANT[name]), tar.subarray(off + 512, off + 512 + size)); console.log(WANT[name], (size / 1024).toFixed(0), 'KB'); }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  console.log('Dark Reader', meta.version, 'bundled in assets/darkreader');
})().catch((e) => { console.error(e.message); process.exit(1); });
