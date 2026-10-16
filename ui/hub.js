// ---------- extension hub: hand-picked extensions that start cleanly in Nova, plus the whole Chrome Web Store ----------
function extHub(o, d) {
  const CATS = [['All', 'Discover', 'grid'], ['installed', 'Installed', 'check'], ['security', 'Security', 'lock'], ['privacy', 'Privacy', 'shield'], ['video', 'Video', 'film'], ['productivity', 'Productivity', 'clock'], ['writing', 'Writing', 'file'], ['developer', 'Developer', 'code'], ['appearance', 'Appearance', 'palette'], ['reading', 'Reading', 'eye'], ['store', 'Web Store', 'globe']];
  let items = [], cat = d.cat || 'All', q = '';
  const store = { q: '', res: null, loading: false, err: '', cats: [], slug: '', byCat: {}, catLoading: false, catErr: '' };
  const busy = new Set(), added = new Set(), gone = new Set();
  let timer = null;
  const users = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(/\.0$/, '')}M users` : n >= 1e3 ? `${Math.round(n / 1e3)}K users` : n > 0 ? `${n} users` : '');
  const stamp = (e) => Date.parse(e.updated) || 0;
  o.innerHTML = `<div class="box settings lib hub"><div class="sn"><div class="brand"><img src="mark.svg" alt="">Nova<small>Hub</small></div><div class="nav" id="hnav">${CATS.map(([id, label, icon]) => `<button data-c="${id}">${ic(icon)}<span>${label}</span></button>`).join('')}</div><button id="hback" class="closebtn">${ic('sliders')}<span>Settings</span></button><button id="hclose" class="closebtn">${ic('x')}<span>Close</span></button></div><div class="sb" id="hb"></div></div>`;
  const body = $('#hb');
  $('#hclose').onclick = () => nova.cmd('closeOverlay');
  $('#hback').onclick = () => nova.cmd('overlay', { kind: 'settings', data: { tab: 'Built in' } });
  const mark = () => o.querySelectorAll('[data-c]').forEach((b) => b.classList.toggle('on', b.dataset.c === cat));
  const isIn = (e) => (!gone.has(e.id)) && (added.has(e.id) || !!e.installed || (S.extensions || []).some((x) => x.id === e.id));
  const stars = (e) => (e.ratingCount ? `<span title="${e.rating} of 5 from ${e.ratingCount.toLocaleString()} ratings">★ ${e.rating.toFixed(1)}</span>` : '');
  const card = (e) => {
    const isBusy = busy.has(e.id), inst = isIn(e), meta = [stars(e), users(e.users)].filter(Boolean).join(' · ');
    const warn = e.limits && e.limits.length ? `<div class="hwarn" title="Electron, the engine under Nova, does not provide ${esc(e.limits.join(', '))}. The extension installs, but those parts will not work.">${ic('info')}<span>Limited here: needs ${esc(e.limits.slice(0, 2).join(' and '))}</span></div>` : '';
    const icon = e.icon ? `<img class="hico logo" data-fb="hico" src="${esc(e.icon)}" alt="">` : `<span class="hico">${ic('box')}</span>`;
    return `<div class="hcard" data-id="${e.id}">${icon}<div class="hb"><b title="${esc(e.name)}">${esc(e.name)}</b><p>${esc(e.tagline)}</p>${warn}<div class="hmeta"><span>${meta}</span>${inst ? `<span class="hok">${ic('check')}Installed</span><button class="hrm" data-rm="${e.id}" title="Remove">${ic('trash')}</button>` : `<button class="btn primary small" data-add="${e.id}" ${isBusy ? 'disabled' : ''}>${isBusy ? 'Installing…' : 'Add to Nova'}</button>`}</div></div></div>`;
  };
  const shelf = (title, sub, list) => (list.length ? `<section class="shelf"><div class="shead"><h3>${title}</h3><span>${sub}</span></div><div class="hgrid">${list.map(card).join('')}</div></section>` : '');
  const wait = (text) => `<div class="hwait"><span class="spinner"></span>${text}</div>`;
  const find = (id) => items.find((x) => x.id === id) || (store.res && store.res.items.find((x) => x.id === id)) || Object.values(store.byCat).flatMap((r) => r.items || []).find((x) => x.id === id);

  // the live Web Store results under a search, and the category browser
  function storeSection(term, curatedIds) {
    if (term.length < 2) return '';
    const head = (sub) => `<div class="shead"><h3>From the Chrome Web Store</h3><span>${sub}</span></div>`;
    if (store.q !== term || (store.loading && !store.res)) return `<section class="shelf">${head('')}${wait('Searching the Web Store…')}</section>`;
    if (store.err) return `<section class="shelf">${head('')}<div class="hnone">${esc(store.err)} <button class="btn small" data-retry="1">Try again</button></div></section>`;
    const list = store.res.items.filter((e) => !curatedIds.has(e.id));
    if (!list.length) return `<section class="shelf">${head('')}<div class="hnone">Nothing in the Web Store matches “${esc(term)}”.</div></section>`;
    const more = store.res.total > store.res.items.length ? `<div class="hmore"><span>The ${store.res.items.length} best of ${store.res.total.toLocaleString()} matches.</span><button class="btn small" data-store-open="${esc(store.res.url || '')}">See all in the Web Store</button></div>` : '';
    return `<section class="shelf">${head('Anything the Chrome Web Store has')}<div class="hgrid">${list.map(card).join('')}</div>${more}</section>`;
  }
  function browse() {
    const chips = `<div class="hchips">${store.cats.map(([slug, label]) => `<button class="hchip ${slug === store.slug ? 'on' : ''}" data-slug="${slug}">${esc(label)}</button>`).join('')}</div>`;
    const r = store.byCat[store.slug];
    const grid = !store.cats.length || (store.catLoading && !r) ? wait('Loading the Web Store…') : store.catErr ? `<div class="hnone">${esc(store.catErr)} <button class="btn small" data-retry-cat="1">Try again</button></div>` : r ? `<div class="hgrid">${r.items.map(card).join('')}</div>${r.url ? `<div class="hmore"><span>The most used extensions in this category.</span><button class="btn small" data-store-open="${esc(r.url)}">See all in the Web Store</button></div>` : ''}` : '';
    return `<section class="shelf"><div class="shead"><h3>Browse the Chrome Web Store</h3><span>Every extension in it can be added here</span></div>${chips}${grid}</section>`;
  }
  const loadCategory = async (slug) => {
    store.slug = slug; store.catErr = '';
    if (!store.byCat[slug]) { store.catLoading = true; keep(); const r = await nova.cmd('storeCategory', { slug }); if (store.slug !== slug) return; store.catLoading = false; if (r && r.items && r.items.length) store.byCat[slug] = r; else store.catErr = (r && r.error) || 'The Web Store did not answer.'; }
    keep();
  };
  const runSearch = async (term) => {
    if (term.length < 2) return;
    store.q = term; store.loading = true; store.res = null; store.err = ''; keep();
    const r = await nova.cmd('storeSearch', { q: term });
    if (store.q !== term) return; // the person typed on
    store.loading = false; store.res = r && r.items ? r : { items: [], total: 0 }; store.err = (r && r.error) || ''; keep();
  };
  const schedule = () => { clearTimeout(timer); const term = q.trim().toLowerCase(); if (term.length >= 2 && term !== store.q) timer = setTimeout(() => runSearch(term), 380); };

  function paint() {
    mark();
    const term = q.trim().toLowerCase();
    const match = (e) => (cat === 'All' || cat === 'store' || cat === 'installed' || e.cat === cat) && (!term || `${e.name} ${e.tagline} ${e.cat}`.toLowerCase().includes(term));
    let html = `<div class="pghead"><span class="tile big">${ic('box')}</span><div><h2>Extension hub</h2><p>Hand-picked extensions that start cleanly in Nova, and every other extension in the Chrome Web Store. Add one in a single click.</p></div></div><div class="lsearch">${ic('search')}<input id="hq" placeholder="Search every extension" value="${esc(q)}" autocomplete="off" spellcheck="false"></div>`;
    let curatedIds = new Set();
    if (cat === 'installed' && !term) html += extensionsHtml({ banner: false });
    else if (cat === 'store' && !term) html += browse();
    else if (cat === 'All' && !term) {
      html += shelf('Must-have', 'What most people install first', items.filter((e) => e.must))
        + shelf('Popular', 'Most used worldwide', [...items].sort((a, b) => b.users - a.users).slice(0, 8))
        + shelf('Freshly updated', 'Recently released versions', [...items].sort((a, b) => stamp(b) - stamp(a)).slice(0, 6))
        + `<div class="hmore wide"><span>Looking for something else? Search above or browse the whole Chrome Web Store.</span><button class="btn small" data-c-go="store">Browse the Web Store</button></div>`;
    } else {
      const list = items.filter(match).sort((a, b) => b.users - a.users);
      curatedIds = new Set(list.map((e) => e.id));
      html += list.length ? `<div class="hgrid">${list.map(card).join('')}</div>` : (term.length >= 2 ? '' : `<div class="lempty">${ic('search')}<b>Nothing found</b><span>Search the Chrome Web Store above, or paste a store link.</span></div>`);
    }
    html += storeSection(term, curatedIds);
    if (cat === 'installed' && !term) setTimeout(() => bindExtensions(body, keep), 0);
    html += `<p class="hnote">Nova runs Chromium extensions, but Electron implements only part of Chrome's extension interface. Extensions marked “Limited here” install fine but lose the features named there. Every extension runs in its own process and typically uses 40 to 70 MB of memory.</p>`;
    body.innerHTML = html;
    const search = $('#hq'); if (search) { search.oninput = () => { q = search.value; const pos = search.selectionStart; paint(); const s2 = $('#hq'); s2.focus(); s2.setSelectionRange(pos, pos); schedule(); }; if (d.focus !== false && !term && !body.dataset.f) { search.focus(); body.dataset.f = '1'; } }
    body.querySelectorAll('[data-add]').forEach((b) => (b.onclick = async () => {
      const id = b.dataset.add, e = find(id) || { id, name: 'extension' }; busy.add(id); keep();
      const r = await nova.cmd('installExt', { id });
      busy.delete(id);
      if (r && r.ok) { added.add(id); gone.delete(id); if (e.installed !== undefined) e.installed = true; toast(r.health && !r.health.ok ? `${r.name} was added, but ${r.health.note.replace(/^Its/, 'its')}` : `${r.name} is installed and ready.`); } else toast(`Could not install ${e.name}: ${(r && r.error) || 'unknown problem'}`);
      keep();
    }));
    body.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = async () => { const id = b.dataset.rm, e = find(id) || { name: 'The extension' }; await nova.cmd('removeExt', { id }); gone.add(id); added.delete(id); if (e.installed !== undefined) e.installed = false; toast(`${e.name} removed.`); setTimeout(keep, 250); }));
    body.querySelectorAll('[data-slug]').forEach((b) => (b.onclick = () => loadCategory(b.dataset.slug)));
    body.querySelectorAll('[data-store-open]').forEach((b) => (b.onclick = () => nova.cmd('open', { text: b.dataset.storeOpen, newTab: true })));
    body.querySelectorAll('[data-retry]').forEach((b) => (b.onclick = () => { store.q = ''; runSearch(q.trim().toLowerCase()); }));
    body.querySelectorAll('[data-retry-cat]').forEach((b) => (b.onclick = () => { delete store.byCat[store.slug]; loadCategory(store.slug); }));
    body.querySelectorAll('[data-c-go]').forEach((b) => (b.onclick = () => go(b.dataset.cGo)));
  }
  // repaint without losing the search box: results arrive while the person is typing
  function keep() {
    const s = $('#hq'), had = s && document.activeElement === s, pos = s ? s.selectionStart : 0, top = body.scrollTop;
    paint(); body.scrollTop = top;
    if (had) { const s2 = $('#hq'); if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); } }
  }
  const go = (c) => { cat = c; q = ''; paint(); body.scrollTop = 0; if (c === 'store' && !store.slug) loadCategory(store.cats.length ? store.cats[0][0] : ''); };
  o.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => go(b.dataset.c)));
  body.innerHTML = '<p class="mi-wait" style="padding:30px">Loading the hub…</p>';
  nova.cmd('storeCategories').then((c) => { store.cats = c || []; if (cat === 'store') loadCategory(store.slug || (store.cats[0] || [])[0] || ''); });
  nova.cmd('hub').then((r) => { items = (r && r.items) || []; paint(); });
}
