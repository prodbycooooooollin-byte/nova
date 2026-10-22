// Windows lists a browser under Settings > Default apps (with its link types and file types) only when it is registered the way browsers are, and a choice made there only works while the
// registration points at the program that is really installed. Setup wrote it once; a Nova that moved, a registration written by an older Setup or by a test copy left a Nova in that list
// whose links went nowhere (the Google sign-in of another program opened nothing). Now Nova checks the registration at every start and writes it again when it is not right.
// Per user (HKCU): no administrator rights, nothing outside Nova's own keys except the "open with" lists of the file types.
const fs = require('fs'), os = require('os'), path = require('path'), { execFile } = require('child_process');

const SCHEMA = 2; // raise it when the list of types below changes: every installed Nova then writes the new one
const DESC = 'Nova, a minimal browser built around your tabs';
const URLS = ['http', 'https'];
const FILES = ['.htm', '.html', '.shtml', '.xht', '.xhtml', '.svg', '.webp'];
const CAP = 'Software\\Clients\\StartMenuInternet\\Nova\\Capabilities';
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const marker = (exe) => SCHEMA + '|' + String(exe).toLowerCase(); // kept in the registration itself: it says which program and which list was written

function regText(exe, aumid, root) { // a .reg file, as text; `root` (a key path under HKCU) is only for tests: everything is written below it instead of into the real places
  const H = 'HKEY_CURRENT_USER\\' + (root ? root + '\\' : ''), ico = `${exe},0`, out = ['Windows Registry Editor Version 5.00', ''];
  const key = (k, vals) => { out.push('[' + H + k + ']'); for (const [n, v] of vals) out.push((n === '' ? '@' : '"' + n + '"') + '="' + esc(v) + '"'); out.push(''); };
  key('Software\\Classes\\NovaHTML', [['', 'Nova HTML Document']]);
  key('Software\\Classes\\NovaHTML\\Application', [['ApplicationName', 'Nova'], ['ApplicationDescription', DESC], ['ApplicationIcon', ico], ['AppUserModelId', aumid]]);
  key('Software\\Classes\\NovaHTML\\DefaultIcon', [['', ico]]);
  key('Software\\Classes\\NovaHTML\\shell\\open\\command', [['', `"${exe}" "%1"`]]);
  key('Software\\Clients\\StartMenuInternet\\Nova', [['', 'Nova']]);
  key('Software\\Clients\\StartMenuInternet\\Nova\\DefaultIcon', [['', ico]]);
  key(CAP, [['ApplicationName', 'Nova'], ['ApplicationDescription', DESC], ['ApplicationIcon', ico], ['NovaReg', marker(exe)]]);
  key(CAP + '\\URLAssociations', URLS.map((k) => [k, 'NovaHTML']));
  key(CAP + '\\FileAssociations', FILES.map((k) => [k, 'NovaHTML']));
  key(CAP + '\\StartMenu', [['StartMenuInternet', 'Nova']]);
  key('Software\\Clients\\StartMenuInternet\\Nova\\shell\\open\\command', [['', `"${exe}"`]]);
  key('Software\\RegisteredApplications', [['Nova', CAP]]);
  for (const k of FILES) key('Software\\Classes\\' + k + '\\OpenWithProgids', [['NovaHTML', '']]); // Nova is also offered under "Open with" for these files
  return out.join('\r\n');
}

function apply(exe, aumid, log, root) { // writes the registration (one `reg import`, hidden); resolves true when it worked
  return new Promise((res) => {
    const f = path.join(os.tmpdir(), `nova-reg-${process.pid}-${Date.now()}.reg`);
    try { fs.writeFileSync(f, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(regText(exe, aumid, root), 'utf16le')])); } catch (e) { if (log) log('browser registration: ' + e.message); return res(false); }
    execFile('reg', ['import', f], { windowsHide: true, timeout: 20000 }, (err) => { try { fs.rmSync(f, { force: true }); } catch { /* temp file */ } if (err && log) log('browser registration: ' + err.message); res(!err); });
  });
}
const query = (key, args) => new Promise((res) => execFile('reg', ['query', 'HKCU\\' + key, ...args], { windowsHide: true, timeout: 8000 }, (err, out) => res(err ? '' : String(out))));

async function ensure(exe, aumid, log, root) { // at every start: writes the registration only when it is missing, from an older list, or for another program
  const out = await query((root ? root + '\\' : '') + CAP, ['/v', 'NovaReg']);
  if (out.toLowerCase().includes(marker(exe).toLowerCase())) return 'ok';
  const ok = await apply(exe, aumid, log, root);
  if (log) log(ok ? 'browser registration written for ' + exe : 'browser registration failed');
  return ok ? 'written' : 'failed';
}
async function isDefault() { // what Windows has chosen for web links, not what a program claims
  const outs = await Promise.all(['https', 'http'].map((k) => query('Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\' + k + '\\UserChoice', ['/v', 'ProgId'])));
  return outs.every((o) => /ProgId\s+REG_SZ\s+NovaHTML\b/i.test(o));
}

module.exports = { ensure, apply, isDefault, regText, marker, URLS, FILES, CAP };
