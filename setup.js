// Nova Setup: the installer, updater and uninstaller. The Setup exe is Nova itself in "setup mode":
// it shows its own interface (ui/setup.html), copies its application files to the install folder,
// creates shortcuts and registry entries. No NSIS, no Windows installer UI.
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const ofs = require('original-fs'); // asar-unaware: copies app.asar as a plain file
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');
const pkg = require('./package.json');

const ARGV = process.argv;
const arg = (n) => { const i = ARGV.indexOf(n); if (i >= 0 && ARGV[i + 1]) return ARGV[i + 1]; const p = ARGV.find((a) => a.startsWith(n + '=')); return p ? p.slice(n.length + 1) : null; };
const UNINSTALL_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Nova';
const AUMID = 'app.nova.browser';

// The Setup exe runs as an electron-builder "portable" app and carries PORTABLE_* variables.
// Children we start (the installed Nova) must NOT inherit them, or they would think they are the installer.
const cleanEnv = () => { const e = { ...process.env }; for (const k of Object.keys(e)) if (k.startsWith('PORTABLE_EXECUTABLE')) delete e[k]; return e; };
const launchNova = (dir) => spawn(path.join(dir, 'Nova.exe'), [], { detached: true, stdio: 'ignore', cwd: dir, env: cleanEnv() }).unref();
// An installed copy carries this marker and can never become an installer again.
const installedHere = () => { try { return require('original-fs').existsSync(path.join(path.dirname(process.execPath), 'nova-installed.flag')); } catch { return false; } };

function detectMode() {
  if (ARGV.includes('--uninstall')) return 'uninstall';
  if (ARGV.includes('--update')) return 'update';
  if (installedHere()) return null;
  if (ARGV.includes('--setup') || process.env.PORTABLE_EXECUTABLE_FILE) return 'install';
  return null;
}

const reg = (...a) => new Promise((res) => execFile('reg', a, { windowsHide: true }, (e, out) => res(e ? null : out)));
const ps = (script) => new Promise((res) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true }, (e, out) => res(e ? '' : out)));
const regSet = (key, name, value, type = 'REG_SZ') => reg('add', key, ...(name ? ['/v', name] : ['/ve']), '/t', type, '/d', String(value), '/f');
const startMenuDir = () => path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs');
const desktopLink = () => path.join(app.getPath('desktop'), 'Nova.lnk');
const startLink = () => path.join(startMenuDir(), 'Nova.lnk');

async function existingInstall() {
  const out = await reg('query', UNINSTALL_KEY, '/v', 'InstallLocation');
  const m = out && out.match(/InstallLocation\s+REG_SZ\s+(.+)/);
  const loc = m ? m[1].trim() : null;
  return loc && ofs.existsSync(path.join(loc, 'Nova.exe')) ? loc : null; // a stale entry must not steer the installer
}
async function killRunning(dir) {
  const d = dir.replace(/'/g, "''");
  await ps(`Get-CimInstance Win32_Process -Filter "Name='Nova.exe'" | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith('${d}', [StringComparison]::OrdinalIgnoreCase) -and $_.CommandLine -notmatch '--type=' -and $_.ProcessId -ne ${process.pid} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`);
  await new Promise((r) => setTimeout(r, 600));
}
function walk(dir, base = dir, out = []) {
  for (const e of ofs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out); else out.push({ rel: path.relative(base, p), size: ofs.statSync(p).size });
  }
  return out;
}
async function copyApp(src, dest, progress) {
  const files = walk(src), total = files.reduce((n, f) => n + f.size, 0) || 1;
  let done = 0;
  // Same drive: link the unpacked files instead of writing them a second time (instant, no extra disk traffic or virus scan). Anything else copies.
  let link = path.parse(path.resolve(src)).root.toLowerCase() === path.parse(path.resolve(dest)).root.toLowerCase();
  ofs.mkdirSync(dest, { recursive: true });
  for (const f of files) {
    const to = path.join(dest, f.rel);
    ofs.mkdirSync(path.dirname(to), { recursive: true });
    if (link) {
      try { try { ofs.unlinkSync(to); } catch (e) { if (e.code !== 'ENOENT') throw e; } ofs.linkSync(path.join(src, f.rel), to); done += f.size; progress(done / total, f.rel); continue; } catch { link = false; }
    }
    for (let attempt = 0; ; attempt++) {
      try { await ofs.promises.copyFile(path.join(src, f.rel), to); break; }
      catch (e) { if (attempt > 6 || !['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) throw e; await new Promise((r) => setTimeout(r, 500)); }
    }
    done += f.size; progress(done / total, f.rel);
  }
}
// Windows caches icons per shortcut; after an update the taskbar would keep showing the old one. Touch the pinned shortcut and flush the cache.
async function refreshIcons(link) {
  try {
    const pinned = path.join(process.env.APPDATA || '', 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar');
    for (const f of fs.existsSync(pinned) ? fs.readdirSync(pinned) : []) if (/^nova.*\.lnk$/i.test(f)) { try { shell.writeShortcutLink(path.join(pinned, f), 'update', link); } catch {} }
  } catch {}
  await new Promise((res) => execFile('ie4uinit.exe', ['-show'], { windowsHide: true }, () => res()));
}
async function registerShell(dir, { desktop, startMenu, register }) {
  const exe = path.join(dir, 'Nova.exe');
  require('original-fs').writeFileSync(path.join(dir, 'nova-installed.flag'), pkg.version);
  const link = { target: exe, cwd: dir, icon: exe, iconIndex: 0, appUserModelId: AUMID, description: 'Nova' };
  if (process.env.NOVA_SETUP_TEST) return; // test runs must not touch shortcuts or the registry
  if (desktop) shell.writeShortcutLink(desktopLink(), 'create', link);
  if (startMenu) { fs.mkdirSync(startMenuDir(), { recursive: true }); shell.writeShortcutLink(startLink(), 'create', link); }
  await regSet(UNINSTALL_KEY, 'DisplayName', 'Nova'); await regSet(UNINSTALL_KEY, 'DisplayVersion', pkg.version);
  await regSet(UNINSTALL_KEY, 'Publisher', 'Nova'); await regSet(UNINSTALL_KEY, 'DisplayIcon', exe);
  await regSet(UNINSTALL_KEY, 'InstallLocation', dir); await regSet(UNINSTALL_KEY, 'UninstallString', `"${exe}" --uninstall`);
  await regSet(UNINSTALL_KEY, 'NoModify', 1, 'REG_DWORD'); await regSet(UNINSTALL_KEY, 'NoRepair', 1, 'REG_DWORD');
  if (register) { // makes Nova selectable under Settings > Default apps
    const C = 'HKCU\\Software\\Classes\\NovaHTML', S = 'HKCU\\Software\\Clients\\StartMenuInternet\\Nova';
    await regSet(C, '', 'Nova HTML Document'); await regSet(C + '\\DefaultIcon', '', `${exe},0`); await regSet(C + '\\shell\\open\\command', '', `"${exe}" "%1"`);
    await regSet(S, '', 'Nova'); await regSet(S + '\\Capabilities', 'ApplicationName', 'Nova'); await regSet(S + '\\Capabilities', 'ApplicationDescription', 'Nova, a minimal browser built around your tabs');
    await regSet(S + '\\Capabilities', 'ApplicationIcon', `${exe},0`);
    for (const k of ['http', 'https']) await regSet(S + '\\Capabilities\\URLAssociations', k, 'NovaHTML');
    for (const k of ['.html', '.htm']) await regSet(S + '\\Capabilities\\FileAssociations', k, 'NovaHTML');
    await regSet(S + '\\shell\\open\\command', '', `"${exe}"`);
    await regSet('HKCU\\Software\\RegisteredApplications', 'Nova', 'Software\\Clients\\StartMenuInternet\\Nova\\Capabilities');
  }
  await refreshIcons(link);
}
async function removeShell() {
  for (const l of [desktopLink(), startLink()]) fs.rmSync(l, { force: true });
  for (const k of [UNINSTALL_KEY, 'HKCU\\Software\\Classes\\NovaHTML', 'HKCU\\Software\\Clients\\StartMenuInternet\\Nova']) await reg('delete', k, '/f');
  await reg('delete', 'HKCU\\Software\\RegisteredApplications', '/v', 'Nova', '/f');
  await reg('delete', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'Nova', '/f');
}

function run(mode) {
  app.disableHardwareAcceleration(); // the installer draws a few 2D shapes: no GPU process means a faster start and no driver surprises
  const t0 = Date.now(), log = (m) => { try { ofs.appendFileSync(path.join(os.tmpdir(), 'nova-setup.log'), `${new Date().toISOString()} +${Date.now() - t0}ms ${m}\n`); } catch {} };
  log(`setup ${pkg.version} mode=${mode} electron=${process.versions.electron} cpus=${os.cpus().length} freeMem=${Math.round(os.freemem() / 1048576)}MB`);
  if (mode === 'install') { // a second double-click while the first copy is still unpacking must not start another installer
    const lock = path.join(os.tmpdir(), 'nova-setup.lock');
    try { const st = ofs.statSync(lock), pid = +ofs.readFileSync(lock, 'utf8'); if (pid && pid !== process.pid && Date.now() - st.mtimeMs < 600000) { process.kill(pid, 0); log('another installer is already running'); app.exit(0); return; } } catch {}
    try { ofs.writeFileSync(lock, String(process.pid)); } catch {}
    app.on('quit', () => { try { ofs.unlinkSync(lock); } catch {} });
  }
  app.on('child-process-gone', (_e, d) => log(`child process gone: ${d.type} ${d.reason}`));
  app.setAppUserModelId(AUMID);
  const src = arg('--src') || path.dirname(process.execPath);
  const installedDir = path.dirname(process.execPath);
  const small = mode === 'update';
  app.whenReady().then(async () => {
    const win = new BrowserWindow({
      width: small ? 520 : 860, height: small ? 230 : 560, frame: false, resizable: false, maximizable: false, backgroundColor: '#0b0b12', show: false,
      icon: path.join(__dirname, 'build', 'icon.ico'), title: mode === 'uninstall' ? 'Uninstall Nova' : 'Nova Setup',
      webPreferences: { preload: path.join(__dirname, 'setup-preload.js'), contextIsolation: true, sandbox: true },
    });
    win.once('ready-to-show', () => { log('window ready'); win.show(); });
    setTimeout(() => { if (!win.isDestroyed() && !win.isVisible()) { log('window shown by the watchdog'); win.show(); } }, 3500);
    win.webContents.on('render-process-gone', (_e, d) => log(`renderer gone: ${d.reason}`));
    win.loadFile(path.join(__dirname, 'ui', 'setup.html'));
    const send = (ch, d) => { if (!win.isDestroyed()) win.webContents.send(ch, d); };

    ipcMain.handle('setup:init', async () => {
      const prev = await existingInstall();
      const def = path.join(process.env.LOCALAPPDATA, 'Programs', 'Nova'); let freeGB = 0;
      try { const st = ofs.statfsSync(path.parse(def).root); freeGB = Math.round(st.bavail * st.bsize / 1073741824); } catch {}
      let sizeMB = 0; try { sizeMB = Math.round(walk(src).reduce((n, f) => n + f.size, 0) / 1048576); } catch {}
      return { mode, version: pkg.version, defaultDir: def, previous: prev, dataDir: app.getPath('userData'), freeGB, sizeMB };
    });
    ipcMain.handle('setup:browse', async () => {
      const r = await dialog.showOpenDialog(win, { title: 'Choose where to install Nova', properties: ['openDirectory', 'createDirectory'] });
      return r.canceled ? null : path.join(r.filePaths[0], 'Nova');
    });
    ipcMain.handle('setup:install', async (_e, o) => {
      const dir = o.dir || path.join(process.env.LOCALAPPDATA, 'Programs', 'Nova');
      try {
        if (path.resolve(dir).toLowerCase() === path.resolve(src).toLowerCase()) throw new Error('Choose a different folder.');
        send('setup:progress', { pct: 0, text: 'Preparing' });
        if (ofs.existsSync(path.join(dir, 'Nova.exe'))) await killRunning(dir);
        await copyApp(src, dir, (p, f) => send('setup:progress', { pct: p * 0.92, text: f }));
        send('setup:progress', { pct: 0.95, text: 'Creating shortcuts' });
        await registerShell(dir, o);
        if (o.startup) await regSet('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', 'Nova', `"${path.join(dir, 'Nova.exe')}"`);
        if (o.profile) { try { const ud = app.getPath('userData'); ofs.mkdirSync(ud, { recursive: true }); ofs.writeFileSync(path.join(ud, 'first-run.json'), JSON.stringify({ profile: o.profile })); } catch {} }
        send('setup:progress', { pct: 1, text: 'Done' });
        return { ok: true, dir };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('setup:launch', (_e, dir) => { launchNova(dir); app.quit(); });
    ipcMain.handle('setup:defaults', () => shell.openExternal('ms-settings:defaultapps'));
    ipcMain.handle('setup:uninstall', async (_e, o) => {
      try {
        await killRunning(installedDir); await removeShell();
        const targets = [`"${installedDir}"`, ...(o.deleteData ? [`"${app.getPath('userData')}"`] : [])];
        const cmd = `ping 127.0.0.1 -n 4 >nul & ` + targets.map((t) => `rmdir /s /q ${t}`).join(' & ');
        spawn('cmd.exe', ['/c', `"${cmd}"`], { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true }).unref();
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('setup:close', () => app.quit());

    if (mode === 'update') { // headless-ish: no questions, copy over the existing install and relaunch
      const dir = arg('--dir') || (await existingInstall()) || installedDir;
      win.webContents.once('did-finish-load', async () => {
        try {
          send('setup:progress', { pct: 0, text: 'Preparing' });
          await killRunning(dir);
          await copyApp(src, dir, (p, f) => send('setup:progress', { pct: p * 0.97, text: f }));
          require('original-fs').writeFileSync(path.join(dir, 'nova-installed.flag'), pkg.version);
          await regSet(UNINSTALL_KEY, 'DisplayVersion', pkg.version);
          send('setup:progress', { pct: 1, text: 'Done' });
          if (ARGV.includes('--relaunch')) launchNova(dir);
        } catch (e) { send('setup:error', e.message); await new Promise((r) => setTimeout(r, 6000)); }
        setTimeout(() => app.quit(), 700);
      });
    }
  });
  app.on('window-all-closed', () => app.quit());
}

module.exports = { detectMode, run };
