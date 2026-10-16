// Nova's launcher, the first file that runs. It starts the newest verified application bundle: the one inside this app.asar, or an update
// the updater has put into the user's data folder. An update is one data file (an app.asar), never a new program, so there is nothing
// an antivirus could block and nothing to install: Nova only restarts. A bundle that fails to start is dropped and the built-in one
// takes over again, so a bad update can never lock anybody out.
const { app } = require('electron');
const path = require('path');
const ofs = require('original-fs'); // plain file access: a *.asar here is a data file to read and write, not an archive to look into
const bundled = require('./package.json');

const LOADER = 1; // what this launcher can start; an update asking for more is ignored until a full Setup brings a newer launcher
const RUNTIME = +process.versions.electron.split('.')[0];
const num = (v) => String(v).replace(/^v/, '').split('.').map(Number);
const newer = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
const dir = () => path.join(app.getPath('userData'), 'updates');
const curFile = () => path.join(dir(), 'current.json');
const read = () => { try { return JSON.parse(ofs.readFileSync(curFile(), 'utf8')); } catch { return null; } };
const write = (o) => { try { const t = curFile() + '.tmp'; ofs.writeFileSync(t, JSON.stringify(o)); ofs.renameSync(t, curFile()); } catch { /* read-only profile: updates simply do not apply */ } };
const log = (m) => { try { ofs.mkdirSync(dir(), { recursive: true }); ofs.appendFileSync(path.join(dir(), 'boot.log'), `${new Date().toISOString()} ${m}\n`); } catch { /* no log, no problem */ } };

// An error nobody caught must not stop the browser behind a dialog box; it goes to a log the user can send us.
if (app.isPackaged) process.on('uncaughtException', (e) => log('uncaught: ' + ((e && e.stack) || e)));

function drop(c, why) { // never try this bundle again
  log(`dropping ${c.active && c.active.version}: ${why}`);
  write({ active: null, bad: [...new Set([...(c.bad || []), c.active && c.active.version].filter(Boolean))] });
}
function pick() {
  const c = read(); const a = c && c.active;
  if (!a || !a.version || !a.asar) return null;
  if (!newer(a.version, bundled.version)) return null; // a full Setup since then brought this version or a newer one
  if ((a.runtime || 0) > RUNTIME || (a.loader || 1) > LOADER) return null; // needs a newer engine or launcher than this install has
  let st; try { st = ofs.statSync(a.asar); } catch { log('the downloaded bundle is gone'); return null; } // removed by a cleaner or an antivirus
  if (st.size !== a.size) { log('the downloaded bundle changed size'); return null; }
  if ((a.tries || 0) >= 3) { drop(c, 'it did not finish starting three times in a row'); return null; }
  return { c, a };
}

let started = false;
const sel = pick();
if (sel) {
  const { c, a } = sel;
  write({ ...c, active: { ...a, tries: (a.tries || 0) + 1 } });
  global.__novaBoot = {
    loader: LOADER, version: a.version, bundled: bundled.version,
    good() { try { const x = read(); if (x && x.active && x.active.version === a.version && x.active.tries) write({ ...x, active: { ...x.active, tries: 0 } }); } catch { /* ignore */ } },
  };
  try { require(path.join(a.asar, 'main.js')); started = true; log(`started ${a.version}`); }
  catch (e) { drop(c, 'it failed to load: ' + ((e && e.stack) || e)); app.relaunch(); app.exit(0); started = true; }
}
if (!started) {
  global.__novaBoot = { loader: LOADER, version: bundled.version, bundled: bundled.version, good() {} };
  require('./main.js');
}
