// ---------- small menus that open under a button: the extensions list and the bookmark card ----------
// Both sit on the transparent "pop" overlay, so the browser behind them stays where it is and a click anywhere else closes them.
// thin outline symbols for the tabs-on-top bar (Lucide, ISC licence), drawn on a 24 px grid
Object.assign(PATHS, {
  't-back': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', 't-fwd': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', 't-reload': '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  't-shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  't-globe': '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>', 't-search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  't-star': '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  't-puzzle': '<path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/>',
  't-pin': '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  't-video': '<path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  't-mic': '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  't-bell': '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  't-clip': '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  't-lock': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  't-unlock': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  't-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  't-home': '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  't-edit': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  't-folder': '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v6"/><path d="m9 13 3 3 3-3"/>',
  't-user': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>', 't-menu': '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
  't-grid': '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>', 't-check': '<path d="M20 6 9 17l-5-5"/>',
});
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

// the shortcut written next to a menu row, taken from the user's own key settings
const kbdOf = (action) => { const k = ((S.settings.keys || {})[action] || [])[0]; return k ? esc(k.replace(/Shift\+/g, '⇧ ').replace(/Control\+|Ctrl\+/g, 'Ctrl ').replace(/\+/g, ' ')) : ''; };

// the menu behind the three lines: everything that is not on the bar, with its shortcut
function mainMenu(o) {
  const W = 290, p = popAt(document.querySelector('.menubtn'), W, true), F = S.settings.features || {};
  const row = (act, label, key) => `<button class="mmrow" data-act="${act}"><span>${label}</span><kbd>${key === undefined ? kbdOf(act) : key}</kbd></button>`;
  const sep = '<div class="mmsep"></div>';
  o.innerHTML = `<div class="pmenu mm box" style="left:${p.left}px;top:${p.top}px;width:${W}px"><div class="pmb">
    ${row('newTab', 'New tab')}${row('newWindow', 'New window')}${F.privateTabs ? row('privateTab', 'New private tab') : ''}${sep}
    ${row('bookmarks', 'Bookmarks')}${row('history', 'History')}${row('downloads', 'Downloads')}${row('hub', 'Extensions', '')}${sep}
    ${row('overview', 'Tab overview')}${row('find', 'Find in page')}
    <div class="mmrow zoom"><span>Zoom</span><span class="zb"><button data-act="zoomOut" title="Zoom out">−</button><button data-act="zoomReset" title="Back to 100%">Reset</button><button data-act="zoomIn" title="Zoom in">+</button></span></div>
    ${row('print', 'Print')}${row('fullscreen', 'Full screen')}${sep}
    ${row('settings', 'Settings')}<button class="mmrow" data-cmd="checkUpdate"><span>Check for updates</span><kbd></kbd></button><button class="mmrow" data-cmd="makeDefault" id="mmdef" hidden><span>Make Nova your default browser</span><kbd></kbd></button>
    <div class="mmver">Nova ${esc(S.version || '')}</div></div></div>`;
  o.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => nova.cmd('action', { name: b.dataset.act })));
  o.querySelectorAll('[data-cmd]').forEach((b) => (b.onclick = async () => { await nova.cmd('closeOverlay'); nova.cmd(b.dataset.cmd); }));
  nova.cmd('defaultBrowser').then((r) => { const b = o.querySelector('#mmdef'); if (b && r && !r.isDefault) b.hidden = false; }); // only offered while it is not the default
}

// the profile: who you are browsing as (switch, add, rename), the privacy switches, the spaces of this profile
function profilePop(o) {
  const W = 330, p = popAt(document.querySelector('.profbtn'), W, true), s = S.settings, F = s.features || {};
  const list = profileList(), cur = list.find((x) => x.id === S.profile) || list[0], sp = S.spaces || [];
  const sw = (k, on) => `<label class="sw"><input type="checkbox" data-pk="${k}" ${on ? 'checked' : ''}><i></i></label>`;
  o.innerHTML = `<div class="pmenu prof box" style="left:${p.left}px;top:${p.top}px;width:${W}px">
    <div class="pfh"><span class="pfav" style="background:${esc(cur.color)};color:${inkOn(cur.color)}">${esc((cur.name[0] || 'N').toUpperCase())}</span><div class="pfn"><b id="pfname">${esc(cur.name)}</b><small>${esc(S.version ? 'Nova ' + S.version : '')}</small></div><button class="btn small ghost" id="pfren">Rename</button></div>
    <div class="pfbody">
    <div class="pfs">Profiles</div>
    <div class="pfsp">${list.map((x) => `<button class="mmrow" data-prof="${esc(x.id)}"><span class="spd"><i style="background:${esc(x.color)}"></i>${esc(x.name)}</span>${x.id === cur.id ? ic('t-check') : ''}</button>`).join('')}<button class="mmrow" data-pf="newprofile"><span>New profile…</span><kbd></kbd></button></div>
    ${list.length < 2 ? '<div class="pfnote">A profile keeps its own logins, cookies, history, bookmarks and passwords. Add one for work and keep your private browsing apart.</div>' : ''}
    <div class="pfs">Privacy</div>
    <div class="pfrow"><span>Ad and tracker blocker<small>${s.adblock ? `${(S.blockedCount || 0).toLocaleString('en-US')} blocked so far` : 'Off'}</small></span>${sw('adblock', s.adblock)}</div>
    <div class="pfrow"><span>Keep browsing history<small>Used for suggestions and the start page</small></span>${sw('keepHistory', s.keepHistory)}</div>
    <button class="mmrow" data-pf="clear"><span>Clear browsing data…</span><kbd></kbd></button>
    ${F.privateTabs ? '<button class="mmrow" data-pf="private"><span>New private tab</span><kbd></kbd></button>' : ''}
    <div class="pfs">Spaces</div>
    <div class="pfsp">${sp.map((x) => `<button class="mmrow" data-sp="${x.id}"><span class="spd"><i style="background:${x.color}"></i>${esc(x.name)}</span>${x.id === S.activeSpace ? ic('t-check') : ''}</button>`).join('')}<button class="mmrow" data-pf="newspace"><span>New space…</span><kbd></kbd></button></div>
    ${list.length > 1 && cur.id !== 'main' ? '<div class="mmsep"></div><button class="mmrow danger" data-pf="delprofile"><span>Delete this profile…</span><kbd></kbd></button>' : ''}
    </div>
    <div class="pmf"><button class="btn small ghost" data-pf="perf">Mode: ${esc({ ultra: 'Ultra Performance', nova: 'Nova', complete: 'Complete' }[s.profile] || 'Nova')}</button><span style="flex:1"></span><button class="btn small ghost" data-pf="settings">Settings</button></div></div>`;
  o.querySelectorAll('[data-pk]').forEach((b) => (b.onchange = () => nova.cmd('settings', { patch: { [b.dataset.pk]: b.checked } })));
  o.querySelectorAll('[data-sp]').forEach((b) => (b.onclick = async () => { await nova.cmd('closeOverlay'); nova.cmd('switchSpace', { id: +b.dataset.sp }); }));
  o.querySelectorAll('[data-prof]').forEach((b) => (b.onclick = async () => { await nova.cmd('closeOverlay'); nova.cmd('switchProfile', { id: b.dataset.prof }); }));
  const go = async (what) => {
    await nova.cmd('closeOverlay');
    if (what === 'clear') setTimeout(() => nova.cmd('overlay', { kind: 'library', data: { tab: 'Clear data' } }), 60);
    else if (what === 'private') nova.cmd('action', { name: 'privateTab' });
    else if (what === 'newspace') setTimeout(newSpaceFlow, 80);
    else if (what === 'newprofile') setTimeout(newProfileFlow, 80);
    else if (what === 'delprofile') setTimeout(() => deleteProfileFlow(cur), 80);
    else if (what === 'perf') setTimeout(() => nova.cmd('overlay', { kind: 'settings', data: { tab: 'Profile' } }), 60);
    else if (what === 'settings') nova.cmd('action', { name: 'settings' });
  };
  o.querySelectorAll('[data-pf]').forEach((b) => (b.onclick = () => go(b.dataset.pf)));
  const ren = $('#pfren'), label = $('#pfname');
  ren.onclick = () => {
    const input = document.createElement('input'); input.value = cur.name; input.placeholder = 'Profile name'; input.maxLength = 40; input.autocomplete = 'off'; input.spellcheck = false; input.className = 'pfin';
    label.replaceWith(input); input.focus(); input.select(); ren.textContent = 'Save';
    const done = () => { const v = input.value.trim() || cur.name; nova.cmd('renameProfile', { id: cur.id, name: v }); const b = document.createElement('b'); b.id = 'pfname'; b.textContent = v; input.replaceWith(b); $('.pfav').textContent = (v[0] || 'N').toUpperCase(); ren.textContent = 'Rename'; ren.onclick = null; setTimeout(() => nova.cmd('closeOverlay'), 350); };
    ren.onclick = done; input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
  };
}

// a site asks for something: location, camera, microphone, notifications, clipboard. Allow remembers, "this time" does not, Block remembers; closing the card answers nothing.
const PERM_ICON = { geolocation: 't-pin', camera: 't-video', microphone: 't-mic', notifications: 't-bell', clipboard: 't-clip' };
function permPop(o, d) {
  const W = 360, p = popAt(document.getElementById('urlbar'), W, false);
  o.innerHTML = `<div class="pmenu perm box" style="left:${p.left}px;top:${p.top}px;width:${W}px"><div class="pmh"><span class="plock">${ic(d.secure ? 't-lock' : 't-unlock')}</span><b>${esc(d.host)}</b></div>
    <div class="ptxt">wants to</div><ul class="pkinds">${d.kinds.map((k) => `<li><span class="si">${ic(PERM_ICON[k.k] || 't-globe')}</span>${esc(k.label)}</li>`).join('')}</ul>
    <div class="pact"><button class="btn primary" data-pa="allow">Allow</button><button class="btn" data-pa="once">Allow this time</button><button class="btn ghost danger" data-pa="block">Block</button></div>
    <div class="pnote">You can change this any time with the shield in the address bar.</div></div>`;
  o.querySelectorAll('[data-pa]').forEach((b) => (b.onclick = () => nova.cmd('permAnswer', { id: d.id, decision: b.dataset.pa })));
  const first = o.querySelector('[data-pa=allow]'); if (first) first.focus();
}
// the shield in the address bar: is the connection safe, what may this site do, keep it awake, clear its data
async function sitePop(o) {
  const info = await nova.cmd('siteInfo'), W = 360, p = popAt(document.querySelector('#urlbar .uicon') || document.getElementById('urlbar'), W, false);
  if (!info) return nova.cmd('closeOverlay');
  const line = info.warn === 'cert' ? ['warn', 't-alert', 'Certificate warning: you chose to continue'] : info.warn ? ['warn', 't-alert', 'On a list of dangerous sites: you chose to continue'] : info.secure ? ['ok', 't-lock', 'The connection is secure'] : info.web ? ['warn', 't-unlock', 'The connection is not secure'] : info.file ? ['dim', 't-globe', 'A file on this computer'] : ['dim', 't-shield', 'A page of Nova'];
  const rows = info.perms ? Object.entries(info.kinds).map(([k, m]) => `<div class="sprow"><span class="si">${ic(PERM_ICON[k])}</span><span class="spn">${esc(m.short)}</span><div class="seg3" data-k="${k}">${['ask', 'allow', 'block'].map((v) => `<button data-v="${v}" class="${info.perms[k] === v ? 'on' : ''}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>`).join('') : '';
  o.innerHTML = `<div class="pmenu site box" style="left:${p.left}px;top:${p.top}px;width:${W}px"><div class="pmh"><b>${esc(info.host || 'This page')}</b>${info.private ? '<span>Private tab: nothing is remembered</span>' : ''}</div>
    <div class="sline ${line[0]}"><span class="si">${ic(line[1])}</span>${line[2]}</div>
    ${rows ? `<div class="sperm"><div class="slbl">This site may</div>${rows}</div>` : ''}
    ${info.web ? `<label class="sprow sawake"><span class="si">${ic('clock')}</span><span class="spn">Keep this site awake<small>Its tabs are never frozen or put to sleep</small></span><label class="sw"><input type="checkbox" id="awake" ${info.awake ? 'checked' : ''}><i></i></label></label>` : ''}
    <div class="pmf">${info.web ? '<button class="btn small ghost danger" data-s="clear">Clear this site’s data</button>' : ''}<span style="flex:1"></span><button class="btn small ghost" data-s="all">All sites…</button></div></div>`;
  o.querySelectorAll('.seg3').forEach((g) => g.querySelectorAll('button').forEach((b) => (b.onclick = () => { nova.cmd('permSet', { origin: info.origin, kind: g.dataset.k, value: b.dataset.v }); g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); })));
  const aw = o.querySelector('#awake'); if (aw) aw.onchange = () => nova.cmd('awakeSet', { host: info.host, on: aw.checked });
  o.querySelectorAll('[data-s]').forEach((b) => (b.onclick = async () => {
    if (b.dataset.s === 'all') { await nova.cmd('closeOverlay'); return nova.cmd('overlay', { kind: 'settings', data: { tab: 'Search & privacy' } }); }
    await nova.cmd('siteClear', { origin: info.origin }); nova.cmd('closeOverlay');
  }));
}
