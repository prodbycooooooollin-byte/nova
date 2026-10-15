// ---------- extensions, move-in (shared by Settings and the wizard) ----------
const CATALOG = [
  { id: 'ghmbeldphafepmbegfdlkpapadhbakde', name: 'Proton Pass', desc: 'Password manager with built-in aliases' },
  { id: 'nngceckbapebfimnlniiiahkandclblb', name: 'Bitwarden', desc: 'Open-source password manager' },
  { id: 'aeblfdkhhhdcdjpifhhbdiojplfjncoa', name: '1Password', desc: 'Password manager' },
  { id: 'eimadpbcbfnmbkopoojfekhnkhdbieeh', name: 'Dark Reader', desc: 'Dark mode for every website' },
  { id: 'mnjggcdmjocbbbhaepdhchncahnbgone', name: 'SponsorBlock', desc: 'Skip sponsors in YouTube videos' },
  { id: 'gebbhagfogifgggkldgodflihgfeacdd', name: 'Return YouTube Dislike', desc: 'Brings the dislike count back' },
];
const SIGNINS = [['Google', 'https://accounts.google.com/'], ['YouTube', 'https://www.youtube.com/'], ['Microsoft', 'https://login.live.com/'], ['GitHub', 'https://github.com/login'], ['Discord', 'https://discord.com/login'], ['Spotify', 'https://accounts.spotify.com/login'], ['Reddit', 'https://www.reddit.com/login'], ['X', 'https://x.com/login'], ['Amazon', 'https://www.amazon.com/ap/signin'], ['Netflix', 'https://www.netflix.com/login']];
const installedId = (id) => (S.extensions || []).some((e) => (e.path || '').replace(/\\/g, '/').endsWith('/' + id));
function catalogHtml(ids) {
  return `<div class="catalog">${CATALOG.filter((c) => !ids || ids.includes(c.id)).map((c, n) => `<div class="cat" style="--i:${n}"><span class="av" style="background:hsl(${hue(c.name)} 45% 42%)">${esc(c.name[0])}</span><div class="cm"><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></div>${installedId(c.id) ? `<span class="done">${ic('check')}Installed</span>` : `<button class="btn primary" data-install="${c.id}">Install</button>`}</div>`).join('')}</div>`;
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
    + '<h4>Suggested, one click</h4>' + catalogHtml()
    + `<h4>Install from the Chrome Web Store</h4><div class="group"><div class="row"><div class="l">Paste a Web Store link or extension ID<small>Nova downloads it and installs it right here.</small></div><div style="display:flex;gap:8px"><input type="text" id="storeid" placeholder="https://chromewebstore.google.com/detail/…" style="width:230px"><button class="btn primary" id="storego">Install</button></div></div></div>`
    + '<p style="margin-top:12px;font-size:12px">Nova runs Chromium extensions, but Electron implements only part of the Chrome extension API. Simple extensions work best; if one misbehaves, remove it. <a href="#" id="unpacked" style="color:var(--accent)">Load an unpacked folder</a></p>';
}
function bindExtensions(root, redraw) {
  bindInstall(root, redraw);
  root.querySelectorAll('[data-rmext]').forEach((b) => (b.onclick = async () => { await nova.cmd('removeExt', { id: b.dataset.rmext }); setTimeout(redraw, 200); }));
  const go = $('#storego'); if (go) go.onclick = async () => { const v = $('#storeid').value.trim(); if (!v) return; go.textContent = 'Installing'; const r = await nova.cmd('installExt', { id: v }); toast(r.ok ? `${r.name} is installed and ready.` : `Could not install: ${r.error}`); setTimeout(redraw, 200); };
  const up = $('#unpacked'); if (up) up.onclick = (e) => { e.preventDefault(); nova.cmd('loadExtension'); };
}
async function moveInHtml() {
  const found = await nova.cmd('detectBrowsers');
  return `<h4>1 · Bookmarks</h4><div class="group"><div class="row"><div class="l">${found.length ? 'Found bookmarks in ' + found.map(esc).join(', ') : 'No Chrome, Edge or Brave profile found'}<small>Copied once from the browser's own bookmarks file. Nothing else is read.</small></div><div style="display:flex;gap:8px">${found.map((n) => `<button class="btn" data-bm="${esc(n)}">Import ${esc(n)}</button>`).join('')}</div></div></div>`
    + `<h4>2 · Passwords</h4><div class="group"><div class="row"><div class="l">Export from your old browser, import into a password manager<small>Old browser: Settings › Passwords › Export. Then install a manager below and use its import. Nova never reads other browsers’ saved passwords or cookies; they are encrypted for good reason.</small></div></div></div><div style="margin-top:10px">${catalogHtml(CATALOG.slice(0, 3).map((c) => c.id))}</div>`
    + `<h4>3 · Sign in once</h4><p style="margin-bottom:10px">Nova remembers sign-ins like any browser. Open a service and log in once.</p><div class="signins">${SIGNINS.map(([n, u]) => `<button class="btn" data-go="${u}">${n}</button>`).join('')}</div>`;
}
function bindMoveIn(root, redraw) {
  bindInstall(root, redraw);
  root.querySelectorAll('[data-bm]').forEach((b) => (b.onclick = async () => { b.disabled = true; await nova.cmd('importBookmarks', { name: b.dataset.bm }); b.textContent = 'Imported'; }));
  root.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => nova.cmd('open', { text: b.dataset.go, newTab: true })));
}

function budList() {
  const rows = Object.entries(S.budget.tabs).map(([id, mb]) => [S.tabs.find((t) => t.id === +id), mb]).filter(([t]) => t).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return rows.length ? rows.map(([t, mb]) => `<div class="row"><div class="l" style="display:flex;gap:10px;align-items:center;min-width:0">${favHtml(t)}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px">${esc(t.title || 'New tab')}</span></div><div style="display:flex;gap:12px;align-items:center"><span class="val">${mb} MB</span>${t.id === S.activeTab ? '<span class="val">in use</span>' : `<button class="btn" data-sleep="${t.id}">Sleep</button>`}</div></div>`).join('') : '<div class="row"><div class="l" style="color:var(--dim)">No data yet.</div></div>';
}
function updateBudgetLive() {
  const t = $('#bud-text'); if (!t) return; const b = S.settings.budget, pct = b.enabled && b.ramMB ? Math.min(100, Math.round(S.budget.used / b.ramMB * 100)) : 0;
  t.textContent = S.budget.used; $('#bud-of').textContent = b.enabled ? b.ramMB + ' MB' : 'none';
  const r = $('#bud-ring'); if (r) { r.setAttribute('stroke-dasharray', (pct * 3.267).toFixed(1) + ' 400'); r.classList.toggle('hot', pct >= 90); }
  const l = $('#bud-list'); if (l) { l.innerHTML = budList(); l.querySelectorAll('[data-sleep]').forEach((x) => (x.onclick = () => nova.cmd('sleep', { id: +x.dataset.sleep }))); }
}
