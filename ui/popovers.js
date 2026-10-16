// ---------- small menus that open under a button: the extensions list and the bookmark card ----------
// Both sit on the transparent "pop" overlay, so the browser behind them stays where it is and a click anywhere else closes them.
const popAt = (el, w, alignRight) => {
  const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : { left: innerWidth - 60, right: innerWidth - 20, bottom: 52 };
  const left = alignRight ? Math.round(r.right - w) : Math.round(r.left);
  return { left: Math.max(10, Math.min(innerWidth - w - 10, left)), top: Math.round(r.bottom + 8) };
};

// the extensions button: one list instead of an icon per extension; a click on a row opens that extension's own menu
function extMenu(o) {
  const W = 310, p = popAt(document.querySelector('.extbtn'), W, true), list = S.extensions || [];
  const row = (e) => `<button class="pmrow" data-ext="${esc(e.id)}" data-popup="${e.popup ? 1 : 0}"><span class="pmico">${e.icon ? `<img src="${e.icon}" alt="">` : ic('box')}</span><span class="pmt"><b>${esc(e.name)}</b><small>${e.popup ? 'Open its menu' : 'Works in the background'}</small></span>${e.popup ? ic('fwd') : ''}</button>`;
  o.innerHTML = `<div class="pmenu box" style="left:${p.left}px;top:${p.top}px;width:${W}px"><div class="pmh"><b>Extensions</b><span>${list.length ? list.length + ' installed' : ''}</span></div>
    <div class="pmb">${list.length ? list.map(row).join('') : `<div class="pmnone">${ic('box')}<b>No extensions yet</b><span>Add one from the hub in a click.</span></div>`}</div>
    <div class="pmf"><button class="btn small primary" data-pm="hub">Discover extensions</button><span style="flex:1"></span><button class="btn small ghost" data-pm="manage">Manage</button></div></div>`;
  o.querySelectorAll('[data-ext]').forEach((b) => (b.onclick = async () => {
    if (b.dataset.popup !== '1') return toast('This extension has no menu. It works in the background.');
    await nova.cmd('closeOverlay'); setTimeout(() => nova.cmd('extPopup', { id: b.dataset.ext }), 80);
  }));
  o.querySelectorAll('[data-pm]').forEach((b) => (b.onclick = async () => {
    await nova.cmd('closeOverlay');
    if (b.dataset.pm === 'hub') nova.cmd('action', { name: 'hub' }); else nova.cmd('overlay', { kind: 'hub', data: { cat: 'installed' } });
  }));
}

// the bookmark card: the page is saved the moment the star is pressed; here it gets its name, or is taken out again
async function bookmarkPop(o) {
  const star = document.getElementById('bmstar'), anchor = star && star.offsetParent ? star : document.getElementById('urlbar'), W = 340, p = popAt(anchor, W, false);
  const info = (await nova.cmd('bookmarkInfo')) || {};
  let host = ''; try { host = new URL(info.url).hostname.replace(/^www\./, ''); } catch { /* not a page */ }
  o.innerHTML = `<div class="pmenu bmpop box" style="left:${p.left}px;top:${p.top}px;width:${W}px"><div class="pmh"><b>${info.saved ? 'Bookmark saved' : 'Bookmark'}</b><span>${esc(host)}</span></div>
    <div class="bmbody"><label for="bmname">Name</label><input id="bmname" value="${esc(info.title || host)}" autocomplete="off" spellcheck="false"></div>
    <div class="pmf"><button class="btn small ghost danger" data-bm2="remove">Remove</button><span style="flex:1"></span><button class="btn small ghost" data-bm2="all">All bookmarks</button><button class="btn small primary" data-bm2="done">Done</button></div></div>`;
  const input = document.getElementById('bmname'); input.focus(); input.select();
  const save = async () => { await nova.cmd('bookmarkSet', { title: input.value }); await nova.cmd('closeOverlay'); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  o.querySelectorAll('[data-bm2]').forEach((b) => (b.onclick = async () => {
    const a = b.dataset.bm2;
    if (a === 'done') return save();
    if (a === 'remove') { await nova.cmd('bookmarkRemove'); return nova.cmd('closeOverlay'); }
    await nova.cmd('bookmarkSet', { title: input.value }); await nova.cmd('closeOverlay'); nova.cmd('overlay', { kind: 'library', data: { tab: 'Bookmarks' } });
  }));
}

// the spaces button: the list of spaces under it; a click switches, the footer adds, renames or deletes
function spacePop(o) {
  const W = 260, p = popAt(document.querySelector('.spacebtn'), W, true), list = S.spaces || [];
  const row = (sp, i) => `<button class="pmrow" data-sp="${sp.id}"><span class="spdot"><i style="background:${sp.color}"></i></span><span class="pmt"><b>${esc(sp.name)}</b></span>${sp.id === S.activeSpace ? ic('check') : `<kbd>Alt ${i + 1}</kbd>`}</button>`;
  o.innerHTML = `<div class="pmenu box" style="left:${p.left}px;top:${p.top}px;width:${W}px"><div class="pmh"><b>Spaces</b><span>${list.length}</span></div>
    <div class="pmb">${list.map(row).join('')}</div>
    <div class="pmf"><button class="btn small primary" data-sm="new">New space</button><span style="flex:1"></span><button class="btn small ghost" data-sm="edit">Edit</button><button class="btn small ghost danger" data-sm="del">Delete</button></div></div>`;
  o.querySelectorAll('[data-sp]').forEach((b) => (b.onclick = async () => { await nova.cmd('closeOverlay'); nova.cmd('switchSpace', { id: +b.dataset.sp }); }));
  o.querySelectorAll('[data-sm]').forEach((b) => (b.onclick = async () => {
    const a = b.dataset.sm; await nova.cmd('closeOverlay');
    if (a === 'new') return setTimeout(newSpaceFlow, 80);
    const items = spaceMenu(S.activeSpace); setTimeout(() => items[a === 'edit' ? 0 : 1].run(), 80);
  }));
}
