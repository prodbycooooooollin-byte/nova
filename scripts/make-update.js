// Builds what a release needs besides the Setup exe, from the unpacked build electron-builder leaves in dist/win-unpacked:
//   Nova-update-<version>.zip  the new app.asar (and its unpacked helper files): the small update installed copies download
//   latest.json                what installed copies read to learn the newest version, with checksums and download links
// usage: node scripts/make-update.js <win-unpacked dir> <Setup exe> <version> <owner/repo> <out dir> [release notes]
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const AdmZip = require('adm-zip');
const [,, unpacked, setupExe, version, repo, out, notes = ''] = process.argv;
if (!unpacked || !setupExe || !version || !repo || !out) { console.error('usage: node scripts/make-update.js <win-unpacked> <Setup exe> <version> <owner/repo> <out dir> [notes]'); process.exit(1); }
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const res = path.join(unpacked, 'resources');
const asar = path.join(res, 'app.asar');
if (!fs.existsSync(asar)) throw new Error('no app.asar in ' + res);
const runtime = parseInt(require(path.join(__dirname, '..', 'node_modules', 'electron', 'package.json')).version, 10); // the engine this bundle was built for
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
if (pkg.version !== version) throw new Error(`package.json says ${pkg.version}, not ${version}`);
const zip = new AdmZip();
zip.addLocalFile(asar);
if (fs.existsSync(path.join(res, 'app.asar.unpacked'))) zip.addLocalFolder(path.join(res, 'app.asar.unpacked'), 'app.asar.unpacked');
fs.mkdirSync(out, { recursive: true });
const zipPath = path.join(out, `Nova-update-${version}.zip`); zip.writeZip(zipPath);
const base = `https://github.com/${repo}/releases/download/v${version}/`;
const info = {
  version, notes,
  setup: { name: path.basename(setupExe), url: base + path.basename(setupExe), sha256: sha(setupExe), size: fs.statSync(setupExe).size },
  patch: { name: path.basename(zipPath), url: base + path.basename(zipPath), sha256: sha(zipPath), size: fs.statSync(zipPath).size, runtime, loader: pkg.novaLoader || 1 },
};
fs.writeFileSync(path.join(out, 'latest.json'), JSON.stringify(info, null, 2));
console.log(`update ${version}: zip ${(info.patch.size / 1048576).toFixed(1)} MB, runtime ${runtime}, loader ${info.patch.loader}`);
