// ---------- library: bookmarks, history, downloads and clearing data ----------
function library(o, d) {
  const NAV = [['Bookmarks', 'bookmark'], ['History', 'clock'], ['Downloads', 'download'], ['Clear data', 'trash']];
  const INFO = { Bookmarks: 'Pages you saved. Add one with Ctrl+D.', History: 'Pages you visited, newest first.', Downloads: 'Files Nova saved to your Downloads folder.', 'Clear data': 'Remove what Nova remembers, for a time range you choose.' };
  let tab = d.tab || 'Bookmarks';
  o.innerHTML = `<div class="box settings lib"><div class="sn"><div class="brand"><img src="mark.svg" alt="">Nova<small>Library</small></div><div class="nav" id="lnav">${NAV.map(([n, i]) => `<button data-t="${n}">${ic(i)}<span>${n}</span></button>`).join('')}</div><button id="lx" class="closebtn">${ic('x')}<span>Close</span></button></div><div class="sb" id="lb"></div></div>`;
  const body = $('#lb');
  const mark = () => o.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
  const head = (name) => `<div class="pghead"><span class="tile big">${ic(NAV.find((n) => n[0] === name)[1])}</span><div><h2>${name}</h2><p>${INFO[name]}</p></div></div>`;
  const ago = (t) => { const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5); return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? 'This week' : 'Earlier'; };
  const time = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const icon = (x) => (x.icon ? `<img class="fav" src="${x.icon}" alt="">` : `<span class="fav" style="background:var(--hover);color:var(--dim)">${ic('globe')}</span>`);

  async function list(name) {
    const kind = name.toLowerCase();
    body.innerHTML = head(name) + `<div class="lsearch">${ic('search')}<input id="lq" placeholder="${name === 'Downloads' ? 'Search downloads' : 'Search ' + kind}" autocomplete="off" spellcheck="false"></div>${name === 'Downloads' ? '<div id="dl-live"></div>' : ''}<div id="ll"></div>`;
    const draw = async () => {
      const q = $('#lq').value.trim(), items = await nova.cmd('library', { kind, q }) || [];
      const ll = $('#ll'); if (!ll) return;
      if (!items.length) { ll.innerHTML = `<div class="lempty">${ic(NAV.find((n) => n[0] === name)[1])}<b>${q ? 'Nothing matches' : 'Nothing here yet'}</b><span>${name === 'Bookmarks' ? 'Press Ctrl+D on any page to save it.' : name === 'History' ? 'Pages you visit will show up here.' : 'Downloaded files will show up here.'}</span></div>`; return; }
      let last = '';
      ll.innerHTML = items.map((x) => {
        if (name === 'Downloads') return `<div class="lrow">${ic('download')}<div class="lt"><b>${esc(x.name)}</b><span>${x.state === 'completed' ? 'Saved' : esc(x.state)} · ${time(x.t)}</span></div><button class="btn" data-show="${esc(x.path)}">${ic('open')}Show in folder</button></div>`;
        const g = name === 'History' ? ago(x.t) : ''; const gh = g && g !== last ? `<div class="lgrp mono">${g}</div>` : ''; last = g || last;
        return `${gh}<div class="lrow" data-url="${esc(x.url)}">${icon(x)}<div class="lt"><b>${esc(x.title || x.url)}</b><span>${esc(hostOf(x.url))}${name === 'History' ? ' · ' + time(x.t) : ''}</span></div><button class="ibtn sm" data-del="${esc(x.url)}" title="Remove">${ic('x')}</button></div>`;
      }).join('');
      ll.querySelectorAll('[data-url]').forEach((r) => (r.onclick = (e) => { if (e.target.closest('[data-del]')) return; nova.cmd('open', { text: r.dataset.url, newTab: true }); }));
      ll.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => { await nova.cmd(name === 'Bookmarks' ? 'removeBookmark' : 'removeHistory', { url: b.dataset.del }); draw(); }));
      ll.querySelectorAll('[data-show]').forEach((b) => (b.onclick = () => nova.cmd('showDownload', { path: b.dataset.show })));
    };
    // running downloads sit above the finished ones and update live from the state Nova pushes
    let prevActive = -1;
    const dlRow = (j) => {
      const pct = j.size ? Math.min(100, Math.round(j.received / j.size * 100)) : 0, paused = j.state === 'paused';
      const info = `${fmtBytes(j.received)}${j.size ? ' of ' + fmtBytes(j.size) : ''}${paused ? ' · paused' : j.speed ? ' · ' + fmtBytes(j.speed) + '/s' : ''}${!paused && j.eta ? ' · ' + fmtEta(j.eta) + ' left' : ''}${j.ranged && !paused ? ' · ' + j.conns + ' connections' : ''}`;
      return `<div class="lrow dlrow">${ic('download')}<div class="lt"><b>${esc(j.name)}</b><div class="dlbar"><i style="width:${pct}%"></i></div><span>${info}</span></div><button class="ibtn sm" data-dl="${paused ? 'resume' : 'pause'}" data-id="${j.id}" title="${paused ? 'Resume' : 'Pause'}">${ic(paused ? 'play' : 'pause')}</button><button class="ibtn sm" data-dl="cancel" data-id="${j.id}" title="Cancel">${ic('x')}</button></div>`;
    };
    const drawLive = () => {
      const el = $('#dl-live'); if (!el) return;
      const jobs = S.dl || [];
      el.innerHTML = jobs.map(dlRow).join('');
      el.querySelectorAll('[data-dl]').forEach((b) => (b.onclick = () => nova.cmd({ pause: 'dlPause', resume: 'dlResume', cancel: 'dlCancel' }[b.dataset.dl], { id: +b.dataset.id })));
      if (prevActive >= 0 && jobs.length < prevActive) draw(); // one finished: it now belongs to the list below
      prevActive = jobs.length;
    };
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
  const show = (name) => { tab = name; mark(); name === 'Clear data' ? clear() : list(name); };
  o.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => show(b.dataset.t)));
  $('#lx').onclick = () => nova.cmd('closeOverlay');
  show(tab);
}
