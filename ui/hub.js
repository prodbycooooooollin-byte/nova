// ---------- extension hub: curated, tested extensions you can add in one click ----------
function extHub(o, d) {
  const CATS = [['All', 'All', 'grid'], ['security', 'Security', 'lock'], ['privacy', 'Privacy', 'shield'], ['video', 'Video', 'film'], ['productivity', 'Productivity', 'clock'], ['writing', 'Writing', 'file'], ['developer', 'Developer', 'code'], ['appearance', 'Appearance', 'palette'], ['reading', 'Reading', 'eye']];
  let items = [], cat = d.cat || 'All', q = '';
  const busy = new Set();
  const users = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(/\.0$/, '')}M users` : n >= 1e3 ? `${Math.round(n / 1e3)}K users` : '');
  const stamp = (e) => Date.parse(e.updated) || 0;
  o.innerHTML = `<div class="box settings lib hub"><div class="sn"><div class="brand"><img src="mark.svg" alt="">Nova<small>Hub</small></div><div class="nav" id="hnav">${CATS.map(([id, label, icon]) => `<button data-c="${id}">${ic(icon)}<span>${label}</span></button>`).join('')}</div><button id="hclose" class="closebtn">${ic('x')}<span>Close</span></button></div><div class="sb" id="hb"></div></div>`;
  const body = $('#hb');
  $('#hclose').onclick = () => nova.cmd('closeOverlay');
  const mark = () => o.querySelectorAll('[data-c]').forEach((b) => b.classList.toggle('on', b.dataset.c === cat));
  const card = (e) => {
    const isBusy = busy.has(e.id);
    return `<div class="hcard" data-id="${e.id}"><img class="hico logo" data-fb="hico" src="${esc(e.icon)}" alt=""><div class="hb"><b title="${esc(e.name)}">${esc(e.name)}</b><p>${esc(e.tagline)}</p><div class="hmeta"><span>${users(e.users)}</span>${e.installed ? `<span class="hok">${ic('check')}Installed</span><button class="hrm" data-rm="${e.id}" title="Remove">${ic('trash')}</button>` : `<button class="btn primary small" data-add="${e.id}" ${isBusy ? 'disabled' : ''}>${isBusy ? 'Installing…' : 'Add to Nova'}</button>`}</div></div></div>`;
  };
  const shelf = (title, sub, list) => (list.length ? `<section class="shelf"><div class="shead"><h3>${title}</h3><span>${sub}</span></div><div class="hgrid">${list.map(card).join('')}</div></section>` : '');
  function paint() {
    mark();
    const term = q.trim().toLowerCase();
    const match = (e) => (cat === 'All' || e.cat === cat) && (!term || `${e.name} ${e.tagline} ${e.cat}`.toLowerCase().includes(term));
    let html = `<div class="pghead"><span class="tile big">${ic('box')}</span><div><h2>Extension hub</h2><p>Hand-picked extensions, each one checked to start cleanly in Nova. Add one in a single click.</p></div></div><div class="lsearch">${ic('search')}<input id="hq" placeholder="Search the hub" value="${esc(q)}" autocomplete="off" spellcheck="false"></div>`;
    if (cat === 'All' && !term) {
      html += shelf('Must-have', 'What most people install first', items.filter((e) => e.must))
        + shelf('Popular', 'Most used worldwide', [...items].sort((a, b) => b.users - a.users).slice(0, 8))
        + shelf('Freshly updated', 'Recently released versions', [...items].sort((a, b) => stamp(b) - stamp(a)).slice(0, 6));
    } else {
      const list = items.filter(match).sort((a, b) => b.users - a.users);
      html += list.length ? `<div class="hgrid">${list.map(card).join('')}</div>` : `<div class="lempty">${ic('search')}<b>Nothing found</b><span>Try another word, or paste a Chrome Web Store link under Settings > Extensions.</span></div>`;
    }
    html += `<p class="hnote">Nova runs Chromium extensions, but Electron implements only part of Chrome's extension interface. The hub lists only extensions that start cleanly; a few of their extra features can still be limited. Every extension runs in its own process and typically uses 40 to 70 MB of memory.</p>`;
    body.innerHTML = html;
    const search = $('#hq'); if (search) { search.oninput = () => { q = search.value; const pos = search.selectionStart; paint(); const s2 = $('#hq'); s2.focus(); s2.setSelectionRange(pos, pos); }; if (d.focus !== false && !term) search.focus(); }
    body.querySelectorAll('[data-add]').forEach((b) => (b.onclick = async () => {
      const id = b.dataset.add, e = items.find((x) => x.id === id); busy.add(id); paint();
      const r = await nova.cmd('installExt', { id });
      busy.delete(id);
      if (r && r.ok) { e.installed = true; toast(`${r.name} is installed and ready.`); } else toast(`Could not install ${e.name}: ${(r && r.error) || 'unknown problem'}`);
      paint();
    }));
    body.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = async () => { const e = items.find((x) => x.id === b.dataset.rm); await nova.cmd('removeExt', { id: b.dataset.rm }); e.installed = false; toast(`${e.name} removed.`); paint(); }));
  }
  o.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { cat = b.dataset.c; q = ''; paint(); body.scrollTop = 0; }));
  body.innerHTML = '<p class="mi-wait" style="padding:30px">Loading the hub…</p>';
  nova.cmd('hub').then((r) => { items = (r && r.items) || []; paint(); });
}
