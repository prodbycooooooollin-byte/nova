// Run with: node scripts/fetch-filters.js  -> refreshes the bundled snapshot in assets/filters
const fs = require('fs'), path = require('path');
const { lists, resources } = require('../adblock-lists');
const dir = path.join(__dirname, '..', 'assets', 'filters');
fs.mkdirSync(dir, { recursive: true });
(async () => {
  for (const l of [...lists, resources]) {
    const r = await fetch(l.url);
    if (!r.ok) throw new Error(`${l.url} answered ${r.status}`);
    const text = await r.text();
    fs.writeFileSync(path.join(dir, l.file), text);
    console.log(l.file, (text.length / 1048576).toFixed(2), 'MB');
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
