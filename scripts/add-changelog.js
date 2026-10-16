// node scripts/add-changelog.js <version> "<notes, one per line>"
// Puts the notes of a release at the top of changelog.json. The update screen ("what's new") reads that file after Nova has been updated.
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'changelog.json');
const version = String(process.argv[2] || '').replace(/^v/, ''), lines = String(process.argv[3] || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
// a line that starts with # is the main feature of the release: "# Title: what it is" (the update screen shows it as a card of its own)
const h = lines.find((l) => l.startsWith('#')), notes = lines.filter((l) => !l.startsWith('#')).map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
const hm = h && h.replace(/^#+\s*/, '').match(/^([^:]+):\s*(.+)$/), headline = h ? (hm ? { title: hm[1].trim(), text: hm[2].trim() } : { title: h.replace(/^#+\s*/, ''), text: '' }) : undefined;
if (!/^\d+\.\d+\.\d+$/.test(version)) { console.error('usage: add-changelog.js <x.y.z> "<notes>"'); process.exit(1); }
let log = []; try { log = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first entry */ }
log = log.filter((e) => e.version !== version);
log.unshift({ version, date: new Date().toISOString().slice(0, 10), ...(headline ? { headline } : {}), notes });
fs.writeFileSync(file, JSON.stringify(log, null, 2) + '\n');
console.log('changelog:', version, notes.length, 'notes');
