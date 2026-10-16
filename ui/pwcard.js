// The card of the password saver (see passwords.js). It is told what to show and reports what was clicked; it never sees a password.
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n) => `<svg class="cb" viewBox="0 0 32 32">${ICONS[n] || ''}</svg>`;
const send = (op, arg) => novaPw.send(op, arg);

function theme(m) {
  const r = document.documentElement.style;
  for (const [k, v] of Object.entries(m.theme || {})) r.setProperty('--' + k, v);
  const h = String((m.theme || {}).accent || '#8b7dff').replace('#', ''), v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const L = (0.299 * parseInt(v.slice(0, 2), 16) + 0.587 * parseInt(v.slice(2, 4), 16) + 0.114 * parseInt(v.slice(4, 6), 16)) / 255;
  r.setProperty('--on-accent', L > 0.62 ? '#111118' : '#ffffff');
  r.setProperty('--radius', Math.max(0, Math.min(+m.radius || 0, 18)) + 'px');
  document.body.className = m.effects ? 'fx' : '';
}

function render(m) {
  theme(m);
  const root = $('#root');
  if (m.mode === 'pick') {
    root.innerHTML = `<div class="card pick"><div class="list">${m.entries.map((e, i) => `<button class="it" data-i="${i}" title="Fill ${esc(e.user || 'this login')}"><span class="tile">${ic('user')}</span><span class="u ${e.user ? '' : 'none'}">${esc(e.user || 'No user name')}</span><span class="d">••••••••</span></button>`).join('')}</div><div class="foot"><button data-m="1">${ic('password')}Manage passwords</button></div></div>`;
    root.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => send('pick', +b.dataset.i)));
    $('[data-m]').onclick = () => send('manage');
    return;
  }
  const upd = m.mode === 'update';
  root.innerHTML = `<div class="card"><div class="head"><span class="tile">${ic('password')}</span><div class="t"><b title="${esc(m.site)}">${upd ? 'Update password' : 'Save password'} for ${esc(m.site)}?</b><span title="${esc(m.user)}">${esc(m.user)}</span></div></div>${m.secure ? '' : `<div class="plain">${ic('warn')}This site is not encrypted (http).</div>`}<div class="acts">${upd ? '' : '<button class="b ghost" data-a="never" title="Never offer to save a password for this site">Never</button>'}<span class="sp"></span><button class="b ghost" data-a="later">Not now</button><button class="b primary" data-a="save">${upd ? 'Update' : 'Save'}</button></div></div>`;
  root.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => send(b.dataset.a)));
}

novaPw.onModel(render);
novaPw.onSelect((i) => document.querySelectorAll('.it').forEach((b, n) => b.classList.toggle('sel', n === i)));
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); send('later'); } });
send('ready');
