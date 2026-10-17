// Settings > Passwords: the page body and what it does. settings.js draws it with pwPageHtml(s, helpers) and then calls pwPageBind(body, helpers).
// The list comes from the main process without any secret in it; a password only crosses to this page when you press Show, and it is hidden again after 20 seconds.
const pwLabel = (origin) => { try { const u = new URL(origin); return u.protocol === 'http:' ? 'http://' + u.host : u.host; } catch { return String(origin); } };

function pwPageHtml(s, h) {
  const { row, grp, sect, fsw } = h;
  const on = !!s.features.passwords, c = { save: true, fill: true, ...(s.passwords || {}) };
  const csw = (k, v) => `<label class="sw"><input type="checkbox" data-pwcfg="${k}" ${v ? 'checked' : ''}><i></i></label>`;
  return sect('Password saver', 'Kept on this device only, sealed with your Windows account.')
    + grp(
      row('Save and fill passwords', fsw('passwords', on), 'Off by default. Nova asks after you sign in and fills a login only when you pick it, on the exact same site. Never in private tabs, never inside embedded frames.', 'password'),
      ...(on ? [
        row('Offer to save', csw('save', c.save), 'Asks after a sign-in worked, never before.', 'save'),
        row('Offer to fill', csw('fill', c.fill), 'Click into a sign-in field to see the logins saved for that site. An http page never gets what was saved on https.', 'user')] : []),
      row('Good to know', '', 'Programs running as you can still ask Windows to open the passwords, as with every browser. A password manager with its own master password stays the stronger choice.', 'info'))
    + sect('Saved passwords') + '<div id="pwbox"></div><div id="pwnever"></div>'
    + sect('Move passwords') + grp(
      row('Import from a CSV file', '<button class="btn" id="pwimp">Import…</button>', 'Reads the file Chrome writes (Settings › Passwords › Export), and exports from Edge, Firefox and Bitwarden. A login you already have is never replaced.', 'imp'),
      row('Export to a CSV file', '<button class="btn" id="pwexp">Export…</button>', 'Writes every saved password as plain text. Anyone who gets the file can read them.', 'export'),
      row('Delete all saved passwords', '<button class="btn danger" id="pwwipe">Delete all…</button>', 'Sites you told Nova to never ask about stay on their list.', 'trash'))
    + '<div id="pwnote"></div>';
}

function pwPageBind(body, h) {
  const q = (s) => body.querySelector(s);
  const cmd = (op, a = {}) => nova.cmd('pw', { op, ...a });
  let items = [], never = [], status = { available: true, problem: '' };
  const timers = new Map(); // login id -> timer that hides a shown password again

  const when = (t) => (t ? new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const note = (kind, title, text, acts = '') => { const n = q('#pwnote'); if (n) n.innerHTML = `<div class="pwnote ${kind === 'bad' ? 'bad' : ''}">${ic(kind === 'bad' || kind === 'warn' ? 'warn' : 'check')}<div class="m"><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</div>${acts ? `<div class="acts">${acts}</div>` : ''}</div>`; return n; };
  const clearNote = () => { const n = q('#pwnote'); if (n) n.innerHTML = ''; };
  // an inline question instead of a dialog: dialogs close the Settings page
  const ask = (title, text, ok, danger, run) => {
    note('warn', title, text, `<button class="btn ghost" id="pwno">Cancel</button><button class="btn ${danger ? 'danger solid' : 'primary'}" id="pwyes">${esc(ok)}</button>`);
    q('#pwno').onclick = clearNote; q('#pwyes').onclick = () => { clearNote(); run(); };
    q('#pwnote').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  function drawList() {
    const box = q('#pwbox'); if (!box) return;
    if (!box.firstChild) box.innerHTML = '<div id="pwhead"></div><div id="pwrows"></div>';
    const f = (q('#pwq') ? q('#pwq').value : '').trim().toLowerCase();
    const shown = items.filter((x) => !f || pwLabel(x.origin).toLowerCase().includes(f) || x.user.toLowerCase().includes(f));
    const head = q('#pwhead');
    if (!items.length) head.innerHTML = '';
    else if (!q('#pwq')) { head.innerHTML = `<div class="lsearch">${ic('search')}<input id="pwq" placeholder="Search saved passwords" autocomplete="off" spellcheck="false"></div>`; q('#pwq').oninput = drawList; }
    let out;
    if (!status.available) out = `<div class="lempty">${ic('warn')}<b>Windows encryption is not available</b><span>Nova will not keep passwords without it.</span></div>`;
    else if (status.problem) out = `<div class="lempty">${ic('warn')}<b>The password file could not be read</b><span>${esc(status.problem)}</span></div>`;
    else if (!items.length) out = `<div class="lempty">${ic('password')}<b>No saved passwords</b><span>${h.on() ? 'Sign in somewhere and Nova will offer to keep it, or import a CSV file below.' : 'Switch the saver on above, or import a CSV file below.'}</span></div>`;
    else if (!shown.length) out = `<div class="lempty">${ic('search')}<b>Nothing matches</b></div>`;
    else out = shown.map((x) => {
      const host = pwLabel(x.origin), plain = x.origin.startsWith('http:');
      return `<div class="lrow pwrow" data-id="${esc(x.id)}"><span class="pwfav" style="background:hsl(${hue(host)} 42% 40%)">${esc((host.replace(/^http:\/\//, '')[0] || '?').toUpperCase())}</span><div class="lt"><b title="${esc(x.origin)}">${esc(host.replace(/^http:\/\//, ''))}${plain ? ' <i class="pwplain" title="Not encrypted in transit">http</i>' : ''}</b><span>${x.user ? esc(x.user) : 'No user name'}${x.t ? ' · ' + esc(when(x.t)) : ''}</span></div><span class="pwpass" data-pass>••••••••</span><button class="ibtn sm" data-pw="show" title="Show password">${ic('eye')}</button><button class="ibtn sm" data-pw="copy" title="Copy password (it leaves the clipboard after 30 seconds)">${ic('copy')}</button><button class="ibtn sm" data-pw="del" title="Delete">${ic('trash')}</button></div>`;
    }).join('');
    q('#pwrows').innerHTML = (status.several && status.profile ? `<div class="pfnote">These are the passwords of the profile <b>${esc(status.profile)}</b>. Every profile keeps its own.</div>` : '') + out;
    const nv = q('#pwnever');
    nv.innerHTML = never.length ? h.sect('Never saved', 'Sites you chose “Never” for.') + `<div class="group">${never.map((o) => h.row(esc(pwLabel(o)), `<button class="btn" data-unnever="${esc(o)}">Ask again</button>`, '', 'lock')).join('')}</div>` : '';
    nv.querySelectorAll('[data-unnever]').forEach((b) => (b.onclick = async () => { await cmd('unnever', { origin: b.dataset.unnever }); load(); }));
  }

  async function load() {
    const [st, ls] = await Promise.all([cmd('status'), cmd('list')]);
    if (!q('#pwbox')) return; // the page was left meanwhile
    status = st && !st.error ? st : { available: false, problem: (st && st.error) || '' };
    items = (ls && ls.items) || []; never = (ls && ls.never) || [];
    drawList();
  }

  q('#pwbox').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pw]'), r = e.target.closest('.pwrow'); if (!b || !r) return;
    const id = r.dataset.id, op = b.dataset.pw, chip = r.querySelector('[data-pass]');
    if (op === 'show') {
      if (chip.classList.contains('open')) return hide(r);
      const res = await cmd('reveal', { id });
      if (!res || res.error || typeof res.password !== 'string') return toast((res && res.error) || 'Nova could not open that password.');
      chip.textContent = res.password; chip.classList.add('open'); b.innerHTML = ic('eyeoff'); b.title = 'Hide password';
      clearTimeout(timers.get(id)); timers.set(id, setTimeout(() => hide(r), 20000));
    } else if (op === 'copy') {
      const res = await cmd('copy', { id });
      toast(res && res.ok ? 'Password copied. It leaves the clipboard in 30 seconds.' : (res && res.error) || 'Nova could not copy that password.');
    } else if (op === 'del') {
      if (!b.classList.contains('armed')) { // the first click asks, the second deletes
        b.classList.add('armed'); b.textContent = 'Delete?'; b.title = 'Click again to delete';
        setTimeout(() => { if (b.isConnected) { b.classList.remove('armed'); b.innerHTML = ic('trash'); b.title = 'Delete'; } }, 3000);
        return;
      }
      const res = await cmd('remove', { id });
      if (res && res.ok) { items = items.filter((x) => x.id !== id); drawList(); } else toast('Nova could not delete that password.');
    }
  });
  function hide(r) {
    const chip = r.querySelector('[data-pass]'), b = r.querySelector('[data-pw=show]'); if (!chip) return;
    clearTimeout(timers.get(r.dataset.id)); chip.textContent = '••••••••'; chip.classList.remove('open'); b.innerHTML = ic('eye'); b.title = 'Show password';
  }

  body.querySelectorAll('[data-pwcfg]').forEach((el) => (el.onchange = () => h.patch({ passwords: { save: true, fill: true, ...(S.settings.passwords || {}), [el.dataset.pwcfg]: el.checked } })));
  const feat = body.querySelector('[data-feat=passwords]'); if (feat) feat.addEventListener('change', () => h.again(160)); // the two options below appear and disappear with it

  q('#pwimp').onclick = async () => {
    const r = await cmd('import');
    if (!r || r.canceled) return;
    if (r.error) return note('bad', 'Nothing was imported', r.error);
    const parts = [`${r.added} added`]; if (r.same) parts.push(`${r.same} already saved`); if (r.kept) parts.push(`${r.kept} differ from a login you already have, so yours was kept`); if (r.bad) parts.push(`${r.bad} could not be used`);
    note(r.added ? 'ok' : 'warn', r.added ? `Imported from ${r.file}` : `Nothing new in ${r.file}`, parts.join(', ') + '. The file still holds your passwords as plain text: delete it when you are done.');
    load();
  };
  q('#pwexp').onclick = () => ask('Export every password as plain text?', 'The file is not protected. Anyone who can open it can read all your passwords, so save it somewhere private, use it, then delete it.', 'Choose where to save…', true, async () => {
    const r = await cmd('export');
    if (!r || r.canceled) return;
    if (r.error) return note('bad', 'Nothing was exported', r.error);
    note('warn', `Exported ${r.n} password${r.n > 1 ? 's' : ''} to ${r.file}`, 'It holds them as plain text. Delete it when you are done.' + (r.failed ? ` ${r.failed} could not be opened with this Windows account and were left out.` : ''));
  });
  q('#pwwipe').onclick = () => {
    if (!items.length) return note('warn', 'There is nothing to delete', '');
    ask(`Delete all ${items.length} saved password${items.length > 1 ? 's' : ''}?`, 'This cannot be undone. Export them first if you may want them back.', 'Delete all', true, async () => {
      const r = await cmd('removeAll');
      note('ok', r && r.n ? `Deleted ${r.n} password${r.n > 1 ? 's' : ''}` : 'Nothing deleted', '');
      load();
    });
  };
  load();
}
