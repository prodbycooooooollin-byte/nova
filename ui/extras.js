// ---------- extensions, move-in (shared by Settings and the wizard) ----------
const CATALOG = [
  { id: 'ghmbeldphafepmbegfdlkpapadhbakde', name: 'Proton Pass', desc: 'Password manager with built-in aliases' },
  { id: 'nngceckbapebfimnlniiiahkandclblb', name: 'Bitwarden', desc: 'Open-source password manager' },
  { id: 'aeblfdkhhhdcdjpifhhbdiojplfjncoa', name: '1Password', desc: 'Needs the 1Password desktop app, which Nova cannot talk to yet' },
  { id: 'eimadpbcbfnmbkopoojfekhnkhdbieeh', name: 'Dark Reader', desc: 'Dark mode for every website' },
  { id: 'mnjggcdmjocbbbhaepdhchncahnbgone', name: 'SponsorBlock', desc: 'Skip sponsors in YouTube videos' },
  { id: 'nffaoalbilbmmfgbnbgppjihopabppdk', name: 'Video Speed Controller', desc: 'Speed up or slow down any video' },
];
const SIGNINS = [['Google', 'https://accounts.google.com/', 'google'], ['YouTube', 'https://www.youtube.com/', 'youtube'], ['Microsoft', 'https://login.live.com/', 'microsoft'], ['GitHub', 'https://github.com/login', 'github'], ['Discord', 'https://discord.com/login', 'discord'], ['Spotify', 'https://accounts.spotify.com/login', 'spotify'], ['Reddit', 'https://www.reddit.com/login', 'reddit'], ['X', 'https://x.com/login', 'x'], ['Amazon', 'https://www.amazon.com/ap/signin', 'amazon'], ['Netflix', 'https://www.netflix.com/login', 'netflix']];
const installedId = (id) => (S.extensions || []).some((e) => (e.path || '').replace(/\\/g, '/').endsWith('/' + id));
function catalogHtml(ids) {
  return `<div class="catalog">${CATALOG.filter((c) => !ids || ids.includes(c.id)).map((c, n) => `<div class="cat" style="--i:${n}">${brand('ext-' + c.id)}<div class="cm"><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></div>${installedId(c.id) ? `<span class="done">${ic('check')}Installed</span>` : `<button class="btn primary" data-install="${c.id}">Install</button>`}</div>`).join('')}</div>`;
}
function bindInstall(root, redraw) {
  root.querySelectorAll('[data-install]').forEach((b) => (b.onclick = async () => {
    b.textContent = 'Installing'; b.disabled = true;
    const r = await nova.cmd('installExt', { id: b.dataset.install });
    toast(r.ok ? `${r.name} is installed and ready.` : `Could not install: ${r.error}`);
    setTimeout(redraw, 200);
  }));
}
function extensionsHtml() {
  const list = S.extensions || [];
  return (list.length ? `<div class="group">${list.map((e) => `<div class="row"><div class="l" style="display:flex;gap:12px;align-items:center">${e.icon ? `<img src="${e.icon}" width="24" height="24" style="border-radius:6px">` : '<span class="fav" style="background:var(--surface2)">+</span>'}<div>${esc(e.name)}<small>Version ${esc(e.version)}</small></div></div><button class="btn danger" data-rmext="${esc(e.id)}">Remove</button></div>`).join('')}</div>` : '<p>No extensions yet.</p>')
    + `<div class="hubbanner"><span class="tile big">${ic('box')}</span><div><b>Extension hub</b><small>Hand-picked extensions that are checked to start cleanly in Nova: password managers, YouTube tools, privacy helpers and more.</small></div><button class="btn primary" id="openhub">Open the hub</button></div>`
    + `<h4>Install from the Chrome Web Store</h4><div class="group"><div class="row"><div class="l">Paste a Web Store link or extension ID<small>Nova downloads it and installs it right here.</small></div><div style="display:flex;gap:8px"><input type="text" id="storeid" placeholder="https://chromewebstore.google.com/detail/…" style="width:230px"><button class="btn primary" id="storego">Install</button></div></div></div>`
    + '<p style="margin-top:12px;font-size:12px">Nova runs Chromium extensions, but Electron implements only part of the Chrome extension API. Simple extensions work best; if one misbehaves, remove it. <a href="#" id="unpacked" style="color:var(--accent)">Load an unpacked folder</a></p>';
}
function bindExtensions(root, redraw) {
  bindInstall(root, redraw);
  root.querySelectorAll('[data-rmext]').forEach((b) => (b.onclick = async () => { await nova.cmd('removeExt', { id: b.dataset.rmext }); setTimeout(redraw, 200); }));
  const go = $('#storego'); if (go) go.onclick = async () => { const v = $('#storeid').value.trim(); if (!v) return; go.textContent = 'Installing'; const r = await nova.cmd('installExt', { id: v }); toast(r.ok ? `${r.name} is installed and ready.` : `Could not install: ${r.error}`); setTimeout(redraw, 200); };
  const oh = $('#openhub'); if (oh) oh.onclick = () => nova.cmd('action', { name: 'hub' });
  const up = $('#unpacked'); if (up) up.onclick = (e) => { e.preventDefault(); nova.cmd('loadExtension'); };
}
// Move in: pick another browser, tick what to bring over, watch it happen.
// opts.hub false: no sign-in shortcuts (the setup wizard). opts.onReady(controller): the wizard's Continue button runs the import.
async function renderMoveIn(el, opts = {}) {
  el.innerHTML = '<p class="mi-wait">Looking for other browsers…</p>';
  let scan = null; try { scan = await nova.cmd('scanBrowsers'); } catch { scan = null; }
  const found = (scan && scan.profiles) || [], checked = (scan && scan.checked) || [];
  const hub = opts.hub === false ? '' : `<div class="sect"><h4>Sign in once</h4><p>Nova remembers sign-ins like any browser. Open a service and log in.</p></div><div class="signins">${SIGNINS.map(([n, u, f]) => `<button class="btn withicon" data-go="${u}">${brand('site-' + f, 'mini')}${n}</button>`).join('')}</div>`;
  const bindHub = () => el.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => nova.cmd('open', { text: b.dataset.go, newTab: true })));
  const num = (n) => n.toLocaleString();
  let fileMsg = '';
  const fileBtn = () => `<div class="mi-file"><div><b>Another browser, or a file?</b><span>Every browser can export its bookmarks as a file. Choose that file here.</span>${fileMsg ? `<em>${fileMsg}</em>` : ''}</div><button class="btn" id="mi-file">Choose a bookmarks file…</button></div>`;
  const where = () => `<details class="mi-where"><summary>Where Nova looked</summary><ul>${checked.map((c) => `<li class="${c.found ? 'yes' : ''}"><b>${esc(c.browser)}</b><span>${esc(c.folder)}</span><i>${c.found ? 'found' : 'not here'}</i></li>`).join('')}</ul></details>`;
  const bindFile = (after) => { const b = el.querySelector('#mi-file'); if (b) b.onclick = async () => { b.disabled = true; const r = await nova.cmd('importFile'); b.disabled = false; if (r.canceled) return; fileMsg = r.error ? esc(r.error) : `${esc(r.file)}: ${num(r.n)} new of ${num(r.found)} bookmarks`; toast(r.error ? r.error : `${num(r.n)} bookmarks brought over.`); after(); }; };
  if (!found.length) {
    const draw0 = () => { el.innerHTML = `<div class="mi-empty">${ic('globe')}<div><b>No other browser found</b><span>Nova looks for Chrome, Edge, Brave, Vivaldi, Opera, Yandex, Chromium and Firefox on this PC, in every profile.</span></div></div>${fileBtn()}${where()}${hub}`; bindHub(); bindFile(draw0); };
    draw0(); if (opts.onReady) opts.onReady({ pending: () => false, run: async () => {} }); return;
  }
  const useful = (b) => b.bookmarks + b.extensions.length + (b.history ? 1 : 0);
  let sel = [...found].sort((a, b) => useful(b) - useful(a))[0];
  const pick = { bookmarks: true, history: true, extensions: true, search: true };
  let exts = new Set(), busy = false, done = null, failed = [];
  const work = () => !!((pick.bookmarks && sel.bookmarks) || (pick.history && sel.history) || (pick.extensions && exts.size) || (pick.search && sel.search));
  const draw = () => {
    exts = new Set([...exts].filter((id) => sel.extensions.some((e) => e.id === id)));
    const open = sel.extensions.filter((e) => !e.installed && !e.firefox);
    const ffNote = sel.extNote ? `<span class="mi-note">${esc(sel.extNote)}</span><button class="btn small" id="mi-hub">Open the extension hub</button>` : '';
    const extDesc = open.length ? `${open.length} to install from the Chrome Web Store` : sel.extNote ? `${sel.extensions.length} Firefox add-on${sel.extensions.length === 1 ? '' : 's'}` : sel.extensions.length ? 'Everything is installed already' : 'No extensions in this profile';
    const rows = [
      { k: 'bookmarks', ic: 'star', t: 'Bookmarks', d: sel.bookmarks ? `${num(sel.bookmarks)} saved pages` : 'None in this profile', off: !sel.bookmarks },
      { k: 'history', ic: 'clock', t: 'Browsing history', d: sel.history ? 'Your most visited pages, so Ctrl+K and the start page know you from day one' : 'None found', off: !sel.history },
      { k: 'extensions', ic: 'box', t: 'Extensions', d: extDesc, off: !open.length, extra: open.length ? `<details class="mi-ext"><summary>Choose which</summary>${open.map((e) => `<label class="mi-e"><input type="checkbox" data-e="${e.id}" ${exts.has(e.id) ? 'checked' : ''}><i></i><span>${esc(e.name)}${e.disabled ? ' <small>(turned off there)</small>' : ''}</span></label>`).join('')}</details>` : ffNote },
      ...(sel.search ? [{ k: 'search', ic: 'search2', t: 'Search engine', d: `Use ${esc(sel.search.name)} like in ${esc(sel.browser)}` }] : []),
    ];
    el.innerHTML = `<div class="mi-profiles">${found.map((b) => `<button class="mi-prof ${b.id === sel.id ? 'on' : ''}" data-pid="${esc(b.id)}">${brand(b.icon || 'br-chrome')}<div><b>${esc(b.browser)}</b><span>${esc(b.label)}</span><small>${num(b.bookmarks)} bookmarks · ${b.extensions.length} extensions</small></div></button>`).join('')}</div>
      ${sel.note ? `<p class="mi-warn">${esc(sel.note)}</p>` : ''}
      <div class="mi-list">${rows.map((r) => `<div class="mi-row ${r.off ? 'off' : ''}" data-row="${r.k}"><label class="mi-chk"><input type="checkbox" data-k="${r.k}" ${pick[r.k] && !r.off ? 'checked' : ''} ${r.off || busy ? 'disabled' : ''}><i>${ic('check')}</i></label><span class="tile">${ic(r.ic)}</span><div class="mi-t"><b>${r.t}</b><span>${r.d}</span>${r.extra || ''}<div class="mi-fails" data-fails="${r.k}"></div></div><span class="mi-st" data-st="${r.k}"></span></div>`).join('')}
        <div class="mi-row info"><span class="mi-chk off"><i>${ic('lock')}</i></span><span class="tile">${ic('lock')}</span><div class="mi-t"><b>Passwords and sign-ins stay put</b><span>${esc(sel.browser)} locks them to itself, and moving them out is exactly what password stealers do. Export a CSV from ${esc(sel.browser)} (Settings › Passwords), import it into your password manager, and sign in below.</span></div></div></div>
      <div class="mi-go"><button class="btn primary big" id="mi-run" ${busy ? 'disabled' : ''}>${done ? 'Done' : busy ? 'Bringing it over…' : 'Bring it over'}<span class="arr">${ic('fwd')}</span></button>${done ? `<span class="mi-sum">${done}</span>` : ''}</div>${fileBtn()}${where()}${hub}`;
    el.querySelectorAll('[data-pid]').forEach((b) => (b.onclick = () => { if (busy) return; sel = found.find((f) => f.id === b.dataset.pid); done = null; failed = []; exts = new Set(sel.extensions.filter((e) => !e.installed && !e.firefox).map((e) => e.id)); draw(); if (opts.onReady) opts.onReady(ctl); }));
    el.querySelectorAll('[data-k]').forEach((c) => (c.onchange = () => { pick[c.dataset.k] = c.checked; if (opts.onReady) opts.onReady(ctl); }));
    el.querySelectorAll('[data-e]').forEach((c) => (c.onchange = () => { c.checked ? exts.add(c.dataset.e) : exts.delete(c.dataset.e); if (opts.onReady) opts.onReady(ctl); }));
    const h = el.querySelector('#mi-hub'); if (h) h.onclick = () => nova.cmd('overlay', { kind: 'hub' });
    $('#mi-run').onclick = run; bindHub(); bindFile(draw);
    paintFails();
  };
  const st = (k, html, cls = '') => { const s = el.querySelector(`[data-st="${k}"]`); if (s) { s.className = 'mi-st ' + cls; s.innerHTML = html; } };
  const paintFails = () => { const f = el.querySelector('[data-fails="extensions"]'); if (f && failed.length) f.innerHTML = `<details class="mi-ext" open><summary>${failed.length} could not be installed</summary>${failed.map((x) => `<div class="mi-e bad"><span><b>${esc(x.name)}</b> ${esc(x.error)}</span></div>`).join('')}</details>`; };
  async function run() {
    if (busy || done) return; busy = true; failed = []; el.querySelectorAll('input').forEach((i) => (i.disabled = true)); $('#mi-run').disabled = true; $('#mi-run').firstChild.textContent = 'Bringing it over…';
    const parts = []; const spin = '<span class="spinner"></span>';
    if (pick.bookmarks && sel.bookmarks) { st('bookmarks', spin); const r = await nova.cmd('importPart', { id: sel.id, part: 'bookmarks' }); st('bookmarks', `${ic('check')}${num(r.n)} new`, 'ok'); parts.push(`${num(r.n)} bookmarks`); }
    if (pick.history && sel.history) { st('history', spin); const r = await nova.cmd('importPart', { id: sel.id, part: 'history' }); if (r.n >= 0) { st('history', `${ic('check')}${num(r.n)} pages`, 'ok'); parts.push(`${num(r.n)} pages`); } else st('history', esc(r.error || 'Could not read'), 'bad'); }
    if (pick.extensions && exts.size) {
      let ok = 0; const names = Object.fromEntries(sel.extensions.map((e) => [e.id, e.name]));
      for (const id of exts) { st('extensions', `${spin}${ok + failed.length + 1} of ${exts.size}`); const r = await nova.cmd('importPart', { part: 'extension', ext: id }); if (r.ok) ok++; else failed.push({ name: names[id] || id, error: /no download|not found|404|204/i.test(r.error || '') ? 'is not in the Chrome Web Store (it may come from the other browser\'s own store).' : (r.error || 'did not install.') }); }
      st('extensions', `${ic('check')}${ok} installed${failed.length ? `, ${failed.length} not available` : ''}`, failed.length && !ok ? 'bad' : 'ok'); if (ok) parts.push(`${ok} extensions`); paintFails();
    }
    if (pick.search && sel.search) { st('search', spin); const r = await nova.cmd('importPart', { id: sel.id, part: 'search' }); st('search', r.name ? `${ic('check')}${esc(r.name)}` : '—', r.name ? 'ok' : ''); if (r.name) parts.push('search engine'); }
    busy = false; done = parts.length ? `Brought over ${parts.join(', ')}.` : 'Nothing was selected.';
    const b = $('#mi-run'); if (b) { b.disabled = false; b.firstChild.textContent = 'Done'; const g = el.querySelector('.mi-go'); if (g && !g.querySelector('.mi-sum')) g.insertAdjacentHTML('beforeend', `<span class="mi-sum">${done}</span>`); }
    toast(done); if (opts.onReady) opts.onReady(ctl);
  }
  const ctl = { pending: () => !busy && !done && work(), run };
  exts = new Set(sel.extensions.filter((e) => !e.installed && !e.firefox).map((e) => e.id));
  draw(); if (opts.onReady) opts.onReady(ctl);
}

// what the user should know about a tab in the budget list: why it is quiet, or when it will go to sleep
const sleepNote = (t) => {
  if (t.asleep) return 'Asleep. It reloads when you open it.';
  if (t.frozen) return 'Frozen. It uses no CPU and resumes when you open it.';
  if (t.sleepAt && t.sleepAt > Date.now()) { const m = Math.max(1, Math.round((t.sleepAt - Date.now()) / 60000)); return `Goes to sleep in about ${m} min`; }
  return '';
};
function budList() {
  const rows = Object.entries(S.budget.tabs).map(([id, mb]) => [S.tabs.find((t) => t.id === +id), mb]).filter(([t]) => t).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return rows.length ? rows.map(([t, mb]) => `<div class="row"><div class="l" style="display:flex;gap:10px;align-items:center;min-width:0">${favHtml(t)}<span style="min-width:0;max-width:300px"><span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title || 'New tab')}</span>${sleepNote(t) ? `<small>${sleepNote(t)}</small>` : ''}</span></div><div style="display:flex;gap:12px;align-items:center"><span class="val">${mb} MB</span>${t.id === S.activeTab ? '<span class="val">in use</span>' : `<button class="btn" data-sleep="${t.id}">Sleep</button>`}</div></div>`).join('') : '<div class="row"><div class="l" style="color:var(--dim)">No data yet.</div></div>';
}
function updateBudgetLive() {
  const t = $('#bud-text'); if (!t) return; const b = S.settings.budget, pct = b.enabled && b.ramMB ? Math.min(100, Math.round(S.budget.used / b.ramMB * 100)) : 0;
  t.textContent = S.budget.used; $('#bud-of').textContent = b.enabled ? b.ramMB + ' MB' : 'none';
  const r = $('#bud-ring'); if (r) { r.setAttribute('stroke-dasharray', (pct * 3.267).toFixed(1) + ' 400'); r.classList.toggle('hot', pct >= 90); }
  const l = $('#bud-list'); if (l) { l.innerHTML = budList(); l.querySelectorAll('[data-sleep]').forEach((x) => (x.onclick = () => nova.cmd('sleep', { id: +x.dataset.sleep }))); }
}

// ---------- updates: the card under Settings > Backup & updates, redrawn live while a check or download runs ----------
function updView() {
  const u = S.update || { state: 'idle' };
  const ver = (u.pending && u.pending.version) || u.version || '';
  if (u.state === 'checking') return { text: 'Checking for updates…', btn: 'Check for updates', off: true };
  if (u.state === 'downloading') return { text: `Downloading Nova ${esc(u.version)}… ${u.pct || 0}%`, btn: 'Check for updates', off: true };
  if (u.state === 'ready' || S.updateReady) return { text: `Nova ${esc(ver)} is ready. Restart to finish the update.`, btn: 'Restart to update', act: 'applyUpdate', primary: true };
  if (u.state === 'error') return { text: esc(u.error || 'The update did not work.'), btn: 'Try again', act: 'checkUpdate', page: u.page, bad: true };
  if (u.state === 'current') return { text: 'Nova is up to date.', btn: 'Check for updates', act: 'checkUpdate' };
  return { text: 'You are on the latest version unless a check says otherwise.', btn: 'Check for updates', act: 'checkUpdate' };
}
function updCardHtml() {
  const v = updView();
  return `<img src="mark.svg" alt=""><div><b>Nova ${esc(S.version || '')}</b><span id="upstate" class="${v.bad ? 'bad' : ''}">${v.text}</span></div>${v.page ? '<button class="btn" id="updpage">Download page</button>' : ''}<button class="btn ${v.primary ? 'primary' : ''}" id="chk" data-act="${v.act || 'checkUpdate'}" ${v.off ? 'disabled' : ''}>${v.btn}</button>`;
}
function bindUpd() {
  const c = $('#chk'); if (c) c.onclick = () => { nova.cmd(c.dataset.act || 'checkUpdate'); if ((c.dataset.act || 'checkUpdate') === 'checkUpdate') { c.disabled = true; const u = $('#upstate'); if (u) u.textContent = 'Checking for updates…'; } };
  const p = $('#updpage'); if (p) p.onclick = () => nova.cmd('external', { url: (S.update || {}).page });
}
function updateUpdateLive() { const c = $('#updcard'); if (!c) return; const html = updCardHtml(); if (c.innerHTML !== html) { c.innerHTML = html; bindUpd(); } }
