// Run with: electron scripts/probe-extensions.js  -> adds "works" (and the first startup error) to every entry of hub.json
// Loads each extension into a throw-away session exactly the way Nova does (including ext-shim.js), watches its background worker for
// seven seconds and records whether it started cleanly. Nothing that fails here is offered in the hub as working.
const { app, session } = require('electron');
const fs = require('fs'), os = require('os'), path = require('path');
const AdmZip = require('adm-zip');
const root = path.join(__dirname, '..');
const hubFile = path.join(root, 'hub.json');
const hub = JSON.parse(fs.readFileSync(hubFile, 'utf8'));
app.disableHardwareAcceleration();
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'nova-probe-')));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  const ses = session.fromPartition('persist:probe');
  ses.registerPreloadScript({ type: 'service-worker', filePath: path.join(root, 'ext-shim.js') });
  let current = null, errors = [], running = false;
  ses.serviceWorkers.on('console-message', (_e, d) => { if (current && d.level >= 3 && !/Content-Security-Policy|favicon|Login is required|Statsig|feature flag|not signed in/i.test(d.message)) errors.push(d.message.slice(0, 160)); });
  ses.serviceWorkers.on('running-status-changed', (d) => { if (current && d.runningStatus === 'running') running = true; });
  for (const it of hub.items) {
    current = it.id; errors = []; running = false;
    const dir = path.join(os.tmpdir(), 'nova-probe-ext', it.id);
    try {
      fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      const r = await fetch(`https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${process.versions.chrome}&acceptformat=crx2,crx3&x=${encodeURIComponent(`id=${it.id}&installsource=ondemand&uc`)}`);
      const buf = Buffer.from(await r.arrayBuffer()), ver = buf.readUInt32LE(4);
      new AdmZip(buf.subarray(ver === 3 ? 12 + buf.readUInt32LE(8) : 16 + buf.readUInt32LE(8) + buf.readUInt32LE(12))).extractAllTo(dir, true);
      const ext = await ses.extensions.loadExtension(dir, { allowFileAccess: true });
      const hasWorker = !!(ext.manifest.background && ext.manifest.background.service_worker);
      await sleep(hasWorker ? 7000 : 1500);
      it.works = errors.length === 0 && (!hasWorker || running); it.probe = hasWorker ? (errors[0] || (running ? 'worker started cleanly' : 'worker did not start')) : 'no background worker; content scripts only';
      await ses.extensions.removeExtension(ext.id);
    } catch (e) { it.works = false; it.probe = 'could not load: ' + e.message; }
    console.log(it.works ? 'works' : 'FAILS', it.name, '|', it.probe);
  }
  hub.probed = new Date().toISOString(); hub.electron = process.versions.electron;
  fs.writeFileSync(hubFile, JSON.stringify(hub, null, 1));
  app.quit();
});
