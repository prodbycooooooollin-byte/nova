// ---------- library: bookmarks, history, downloads and clearing data ----------
function library(o, d) {
  const NAV = [['Bookmarks', 'bookmark'], ['History', 'clock'], ['Downloads', 'download'], ['Clear data', 'trash']];
  const INFO = { Bookmarks: 'Pages you saved. Add one with Ctrl+D.', History: 'Pages you visited, one list for each space. Search it, remove a page or a whole website, or clear it.', Downloads: 'Files Nova saved to your Downloads folder.', 'Clear data': 'Remove what Nova remembers in the profile you are in, for a time range you choose.' };
  let tab = d.tab || 'Bookmarks';
  o.innerHTML = `<div class="box settings lib"><div class="sn"><div class="brand"><img src="mark.svg" alt="">Nova<small>Library</small></div><div class="nav" id="lnav">${NAV.map(([n, i]) => `<button data-t="${n}">${ic(i)}<span>${n}</span></button>`).join('')}</div><button id="lx" class="closebtn">${ic('x')}<span>Close</span></button></div><div class="sb" id="lb"></div></div>`;
  const body = $('#lb');
  const mark = () => o.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
  const head = (name) => `<div class="pghead"><span class="tile big">${ic(NAV.find((n) => n[0] === name)[1])}</span><div><h2>${name}</h2><p>${INFO[name]}</p></div></div>`;
  const ago = (t) => { const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5); return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? 'This week' : 'Earlier'; };
  const time = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const icon = (x) => siteFav(x.url, x.icon);

  // ---- history: one list per space, searchable, removable page by page, site by site, by search result, or all at once ----
  async function historyList() {
    let space = String(S.activeSpace), sort = 'new', loaded = [];
    const spaces = S.spaces || [], host = (u) => hostOf(u).replace(/^www\./, '');
    const dayLabel = (t) => { const d0 = new Date().setHours(0, 0, 0, 0), dd = new Date(t).setHours(0, 0, 0, 0), days = Math.round((d0 - dd) / 864e5); return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : new Date(t).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); };
    const spaceOf = () => (space === 'all' ? 0 : +space), spaceName = () => (space === 'all' ? 'all spaces' : ((spaces.find((x) => String(x.id) === space) || {}).name || 'this space'));
    body.innerHTML = head('History') + `<div class="hchips" id="hch"></div><div class="hrow"><div class="lsearch">${ic('search')}<input id="lq" placeholder="Type a page or a website to find it" autocomplete="off" spellcheck="false"></div><button class="btn small" id="hsort"></button><button class="btn small ghost danger" id="hclr">Clear…</button></div><div class="hbar" id="hbar" hidden></div><div id="ll"></div>`;
    const chips = () => { $('#hch').innerHTML = spaces.map((x) => `<button class="hchip ${space === String(x.id) ? 'on' : ''}" data-hs="${x.id}"><i style="background:${x.color}"></i>${esc(x.name)}</button>`).join('') + `<button class="hchip ${space === 'all' ? 'on' : ''}" data-hs="all">All spaces</button>`; $('#hch').querySelectorAll('[data-hs]').forEach((b) => (b.onclick = () => { space = b.dataset.hs; chips(); draw(); })); };
    const sortLabel = () => { $('#hsort').textContent = sort === 'new' ? 'Newest first' : 'Most visited'; };
    const confirm = (title, text, ok) => askDialog({ title, text, ok, danger: true });
    async function draw() {
      const q = $('#lq').value.trim(); loaded = (await nova.cmd('library', { kind: 'history', q, space: spaceOf() })) || [];
      const items = [...loaded].sort(sort === 'new' ? (a, b) => b.t - a.t : (a, b) => (b.n || 0) - (a.n || 0) || b.t - a.t);
      const ll = $('#ll'); if (!ll) return;
      const bar = $('#hbar'), hosts = [...new Set(items.map((x) => host(x.url)))];
      if (q && items.length) { bar.hidden = false; bar.innerHTML = `<span>${items.length}${items.length >= 600 ? '+' : ''} page${items.length === 1 ? '' : 's'} found</span><span style="flex:1"></span>${hosts.length === 1 ? `<button class="btn small" data-hb="site">Remove everything from ${esc(hosts[0])}</button>` : ''}<button class="btn small danger" data-hb="match">Remove ${items.length === 1 ? 'this page' : 'these ' + items.length}</button>`; } else { bar.hidden = true; bar.innerHTML = ''; }
      if (!items.length) { ll.innerHTML = `<div class="lempty">${ic('clock')}<b>${q ? 'Nothing matches' : 'Nothing here yet'}</b><span>${q ? 'Try a part of the address or of the title.' : 'Pages you visit in ' + esc(spaceName()) + ' will show up here.'}</span></div>`; return; }
      let last = '';
      ll.innerHTML = items.map((x) => {
        const g = sort === 'new' ? dayLabel(x.t) : '', gh = g && g !== last ? `<div class="lgrp">${esc(g)}</div>` : ''; last = g || last;
        const sp = space === 'all' && x.sp ? spaces.find((y) => y.id === x.sp) : null;
        return `${gh}<div class="lrow" data-url="${esc(x.url)}">${icon(x)}<div class="lt"><b>${esc(x.title || x.url)}</b><span>${sp ? `<i class="hsd" style="background:${sp.color}" title="${esc(sp.name)}"></i>` : ''}${esc(host(x.url))} · ${time(x.t)}${x.n > 1 ? ' · ' + x.n + ' visits' : ''}</span></div><span class="lact"><button class="ibtn sm" data-site="${esc(host(x.url))}" title="Remove everything from ${esc(host(x.url))}">${ic('globe')}</button><button class="ibtn sm" data-del="${esc(x.url)}" title="Remove this page">${ic('x')}</button></span></div>`;
      }).join('');
      ll.querySelectorAll('[data-url]').forEach((r) => (r.onclick = (e) => { if (e.target.closest('[data-del],[data-site]')) return; nova.cmd('open', { text: r.dataset.url, newTab: true }); }));
      ll.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => { await nova.cmd('removeHistory', { url: b.dataset.del, space: spaceOf() }); draw(); }));
      ll.querySelectorAll('[data-site]').forEach((b) => (b.onclick = async () => { if (await confirm('Remove this website from your history?', `Every page from ${b.dataset.site} in ${spaceName()} is removed.`, 'Remove')) { await nova.cmd('removeHistorySite', { host: b.dataset.site, space: spaceOf() }); draw(); } }));
      bar.querySelectorAll('[data-hb]').forEach((b) => (b.onclick = async () => {
        if (b.dataset.hb === 'site') { if (await confirm('Remove this website from your history?', `Every page from ${hosts[0]} in ${spaceName()} is removed.`, 'Remove')) { await nova.cmd('removeHistorySite', { host: hosts[0], space: spaceOf() }); draw(); } }
        else if (await confirm('Remove these pages?', `${items.length} page${items.length === 1 ? '' : 's'} found for “${q}” in ${spaceName()} will be removed from your history.`, 'Remove')) { await nova.cmd('removeHistoryMatching', { q, space: spaceOf() }); $('#lq').value = ''; draw(); }
      }));
    }
    $('#hsort').onclick = () => { sort = sort === 'new' ? 'visits' : 'new'; sortLabel(); draw(); };
    $('#hclr').onclick = async () => { if (await confirm('Clear your history?', space === 'all' ? 'All pages in all spaces are removed from your history.' : `All pages visited in ${spaceName()} are removed from your history.`, 'Clear')) { await nova.cmd('clearHistory', { space: spaceOf() }); draw(); } };
    let t; $('#lq').addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 120); });
    chips(); sortLabel(); window.updateDownloadsLive = null; await draw(); $('#lq').focus();
  }

  async function list(name) {
    if (name === 'History') return historyList();
    const kind = name.toLowerCase();
    body.innerHTML = head(name) + `<div class="lsearch">${ic('search')}<input id="lq" placeholder="${name === 'Downloads' ? 'Search downloads' : 'Search ' + kind}" autocomplete="off" spellcheck="false"></div>${name === 'Downloads' ? '<div id="dl-live"></div>' : ''}<div id="ll"></div>`;
    const draw = async () => {
      const q = $('#lq').value.trim(), items = await nova.cmd('library', { kind, q }) || [];
      const ll = $('#ll'); if (!ll) return;
      if (!items.length) { ll.innerHTML = `<div class="lempty">${ic(NAV.find((n) => n[0] === name)[1])}<b>${q ? 'Nothing matches' : 'Nothing here yet'}</b><span>${name === 'Bookmarks' ? 'Press Ctrl+D on any page to save it.' : name === 'History' ? 'Pages you visit will show up here.' : 'Downloaded files will show up here.'}</span></div>`; return; }
      let last = '';
      ll.innerHTML = items.map((x) => {
        if (name === 'Downloads') return dlDoneRow(x);
        const g = name === 'History' ? ago(x.t) : ''; const gh = g && g !== last ? `<div class="lgrp">${g}</div>` : ''; last = g || last;
        return `${gh}<div class="lrow" data-url="${esc(x.url)}"${name === 'Bookmarks' && !q ? ` draggable="true" data-bmd="${esc(x.url)}"` : ''}>${icon(x)}<div class="lt"><b>${esc(x.title || x.url)}</b><span>${esc(hostOf(x.url))}${name === 'History' ? ' · ' + time(x.t) : ''}</span></div>${name === 'Bookmarks' ? `<button class="ibtn sm" data-edit="${esc(x.url)}" title="Rename">${ic('t-edit')}</button>` : ''}<button class="ibtn sm" data-del="${esc(x.url)}" title="Remove">${ic('x')}</button></div>`;
      }).join('');
      ll.toggleAttribute('data-bmlist', name === 'Bookmarks' && !q); // a list that can be reordered by dragging (not while a search is showing only some of the bookmarks)
      ll.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => { // rename in place: the title turns into a field
        const row = b.closest('.lrow'), t = row.querySelector('.lt b'), old = t.textContent, inp = Object.assign(document.createElement('input'), { value: old, className: 'lren', spellcheck: false });
        t.replaceWith(inp); inp.focus(); inp.select(); let done = false;
        const save = async (ok) => { if (done) return; done = true; if (ok && inp.value.trim() && inp.value.trim() !== old) await nova.cmd('renameBookmark', { url: b.dataset.edit, title: inp.value }); draw(); };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(true); else if (e.key === 'Escape') save(false); e.stopPropagation(); }); inp.addEventListener('blur', () => save(true)); inp.addEventListener('click', (e) => e.stopPropagation());
      }));
      ll.querySelectorAll('[data-url]').forEach((r) => (r.onclick = (e) => { if (e.target.closest('[data-del],[data-edit],.lren')) return; nova.cmd('open', { text: r.dataset.url, newTab: true }); }));
      ll.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => { await nova.cmd(name === 'Bookmarks' ? 'removeBookmark' : 'removeHistory', { url: b.dataset.del }); draw(); }));
      if (name === 'Downloads') bindDlRows(ll, () => draw());
    };
    window.bmListRedraw = name === 'Bookmarks' ? draw : null; // a bookmark dropped into a new place (ui/boot.js) redraws this list
    // running downloads sit above the finished ones and update live from the state Nova pushes
    const st = { key: null }; let prevActive = -1;
    const drawLive = () => { const n = paintLive($('#dl-live'), st, () => draw()); if (prevActive >= 0 && n < prevActive) draw(); prevActive = n; };
    window.updateDownloadsLive = name === 'Downloads' ? drawLive : null;
    let t; $('#lq').addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 120); });
    await draw(); drawLive(); $('#lq').focus();
  }
  function clear() {
    const pick = { history: true, cookies: false, cache: true, downloads: false }; let range = 'week';
    body.innerHTML = head('Clear data') + `<div class="group">${[['history', 'Browsing history', 'Pages you visited and their icons', 'clock'], ['cookies', 'Cookies and site data', 'Signs you out of most websites', 'lock'], ['cache', 'Cached files', 'Images and scripts stored to load pages faster', 'archive'], ['downloads', 'Download list', 'The list only, your files stay', 'download']].map(([k, t, s, i]) => `<div class="row"><span class="tile">${ic(i)}</span><div class="l">${t}<small>${s}</small></div><label class="sw"><input type="checkbox" data-c="${k}" ${pick[k] ? 'checked' : ''}><i></i></label></div>`).join('')}<div class="row"><div class="l">Time range</div><div class="seg">${[['hour', 'Last hour'], ['day', 'Last day'], ['week', 'Last week'], ['all', 'Everything']].map(([v, l]) => `<button data-r="${v}" class="${v === range ? 'on' : ''}">${l}</button>`).join('')}</div></div></div><p style="margin-top:18px"><button class="btn danger solid" id="doclear">Clear data</button></p>`;
    body.querySelectorAll('[data-c]').forEach((c) => (c.onchange = () => { pick[c.dataset.c] = c.checked; }));
    body.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => { range = b.dataset.r; body.querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('on', x === b)); }));
    $('#doclear').onclick = async () => { if (!Object.values(pick).some(Boolean)) return toast('Pick something to clear.'); const r = await askDialog({ title: 'Clear this data?', text: pick.cookies ? 'You will be signed out of most websites.' : 'This cannot be undone.', ok: 'Clear', danger: true }); if (r) { await nova.cmd('clearData', { what: pick, range }); } };
  }
  const show = (name) => { tab = name; mark(); window.bmListRedraw = null; name === 'Clear data' ? clear() : list(name); };
  o.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => show(b.dataset.t)));
  $('#lx').onclick = () => nova.cmd('closeOverlay');
  show(tab);
}
