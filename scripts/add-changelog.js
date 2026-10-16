// node scripts/add-changelog.js <version> "<notes, one per line>"
// Puts the notes of a release at the top of changelog.json. The update screen ("what's new") reads that file after Nova has been updated.
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'changelog.json');
const version = String(process.argv[2] || '').replace(/^v/, ''), notes = String(process.argv[3] || '').split(/\r?\n/).map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
if (!/^\d+\.\d+\.\d+$/.test(version)) { console.error('usage: add-changelog.js <x.y.z> "<notes>"'); process.exit(1); }
let log = []; try { log = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first entry */ }
log = log.filter((e) => e.version !== version);
log.unshift({ version, date: new Date().toISOString().slice(0, 10), notes });
fs.writeFileSync(file, JSON.stringify(log, null, 2) + '\n');
console.log('changelog:', version, notes.length, 'notes');
