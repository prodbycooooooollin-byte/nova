// CSV for the password saver: the Chrome export format (name,url,username,password,note) and the common variants other browsers and
// managers write (Edge, Firefox, Bitwarden). Pure functions, no I/O, so they can be checked without a browser.
const MAX_BYTES = 5 * 1024 * 1024, MAX_ROWS = 20000;
const bad = (msg) => Object.assign(new Error(msg), { user: true }); // messages meant for the person, not for the log

// RFC 4180: quoted fields may hold commas, quotes ("") and line breaks. A leading byte order mark is ignored.
function parse(text) {
  text = String(text || '');
  if (text.length > MAX_BYTES) throw bad('That file is too large to be a password list.');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [], field = '', q = false, i = 0;
  const end = () => { row.push(field); field = ''; };
  const endRow = () => { end(); if (row.length > 1 || row[0] !== '') rows.push(row); row = []; if (rows.length > MAX_ROWS) throw bad('That file has too many rows.'); };
  for (; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c;
    } else if (c === '"' && field === '') q = true;
    else if (c === ',') end();
    else if (c === '\n') endRow();
    else if (c === '\r') { if (text[i + 1] === '\n') i++; endRow(); }
    else field += c;
  }
  if (q) throw bad('The file ends inside a quoted field, so it is probably cut off.');
  if (field !== '' || row.length) endRow();
  return rows;
}

const COLS = {
  url: ['url', 'login_uri', 'website', 'web site', 'origin', 'login url', 'uri', 'site', 'hostname'],
  user: ['username', 'login_username', 'user name', 'login', 'user', 'email', 'email address'],
  pass: ['password', 'login_password', 'pass'],
};
// Header row to column positions. Returns null when the file has no recognisable url and password columns.
function columns(header) {
  const names = header.map((h) => String(h).trim().toLowerCase());
  const find = (list) => { for (const n of list) { const i = names.indexOf(n); if (i >= 0) return i; } return -1; };
  const c = { url: find(COLS.url), user: find(COLS.user), pass: find(COLS.pass) };
  return c.url >= 0 && c.pass >= 0 ? c : null;
}

// Table to [{url, user, password}]; rows that miss a url or a password are counted in `skipped`.
function toRows(table) {
  if (!table.length) return { rows: [], skipped: 0, error: 'The file is empty.' };
  const c = columns(table[0]);
  if (!c) return { rows: [], skipped: 0, error: 'This does not look like a password export. It needs a url column and a password column.' };
  const rows = []; let skipped = 0;
  for (const r of table.slice(1)) {
    const url = String(r[c.url] || '').split(/\r?\n/)[0].trim(), password = String(r[c.pass] || ''), user = c.user >= 0 ? String(r[c.user] || '').trim() : '';
    if (!url || !password) { skipped++; continue; }
    rows.push({ url, user, password });
  }
  return { rows, skipped };
}

const cell = (v) => { v = String(v == null ? '' : v); return /[",\r\n]/.test(v) || /^\s|\s$/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
// Fields Nova writes itself (name, url) start with a letter, so a spreadsheet never reads them as a formula.
function format(rows) {
  const lines = ['name,url,username,password,note'];
  for (const r of rows) lines.push([r.name, r.url, r.user, r.password, ''].map(cell).join(','));
  return lines.join('\r\n') + '\r\n';
}

module.exports = { parse, toRows, format, MAX_BYTES };
