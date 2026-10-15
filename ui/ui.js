// Nova interface renderer
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HOME = 'nova://home';

const PATHS = {
  back: '<path d="m15 18-6-6 6-6"/>', fwd: '<path d="m9 18 6-6-6-6"/>',
  reload: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/>',
  sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', min: '<path d="M5 12h14"/>', max: '<rect width="12" height="12" x="6" y="6" rx="1.5"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3"/>', lock: '<rect width="16" height="10" x="4" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  vol: '<path d="M11 4.7 6.5 9H3v6h3.5l4.5 4.3z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  cmd: '<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  layout: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  palette: '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".6"/><circle cx="17.5" cy="10.5" r=".6"/><circle cx="6.5" cy="12.5" r=".6"/><circle cx="8.5" cy="7.5" r=".6"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  keyboard: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M8 13h8"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>', box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  save: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>', moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  gauge: '<path d="M12 14l4-5"/><path d="M3.3 17a9 9 0 1 1 17.4 0"/><circle cx="12" cy="14" r="1.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>', rewind: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>', mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>', imp: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  split: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M12 3a14 14 0 0 0 0 18 14 14 0 0 0 0-18M3 12h18"/>',
};
const ic = (n) => `<svg viewBox="0 0 24 24">${PATHS[n]}</svg>`;
const ibtn = (n, title, id, cls = '') => `<button class="ibtn ${cls}" title="${esc(title)}" data-do="${id}">${ic(n)}</button>`;
const STAR = '<span class="star"><svg viewBox="0 0 24 24"><path d="M12 1c.7 6.6 4.4 10.3 11 11-6.6.7-10.3 4.4-11 11-.7-6.6-4.4-10.3-11-11C7.6 11.3 11.3 7.6 12 1z"/></svg></span>';

const PRESETS = {
  Nova: { bg: '#0b0b12', surface: '#13131c', surface2: '#1b1b27', text: '#ececf3', dim: '#8b8ba0', accent: '#8b7dff', danger: '#ff6b7a' },
  Daylight: { bg: '#e9e8ee', surface: '#f6f5f9', surface2: '#ffffff', text: '#1b1b22', dim: '#76758a', accent: '#5b4bf0', danger: '#d92d56' },
  Nebula: { bg: '#100a1c', surface: '#1a1229', surface2: '#251a39', text: '#f0e9fb', dim: '#9d8ebb', accent: '#c084fc', danger: '#ff6b8b' },
  Supernova: { bg: '#130d0a', surface: '#1d1511', surface2: '#2a1e18', text: '#f7ebe2', dim: '#a89283', accent: '#ff9a4d', danger: '#ff5d5d' },
  Aurora: { bg: '#07100f', surface: '#0e1a19', surface2: '#152624', text: '#e4f5f1', dim: '#7ea39b', accent: '#2dd4bf', danger: '#ff6b7a' },
  Graphite: { bg: '#141414', surface: '#1c1c1c', surface2: '#262626', text: '#eeeeee', dim: '#8e8e8e', accent: '#e5e5e5', danger: '#ff6b6b' },
};
const ACTIONS = {
  newTab: 'New tab', go: 'Address and search bar', closeTab: 'Close tab', reopenTab: 'Reopen closed tab', nextTab: 'Next tab', prevTab: 'Previous tab',
  overview: 'Tab overview', reload: 'Reload', back: 'Back', forward: 'Forward', toggleSidebar: 'Toggle sidebar', focusMode: 'Focus mode',
  find: 'Find in page', settings: 'Settings', zoomIn: 'Zoom in', zoomOut: 'Zoom out', zoomReset: 'Reset zoom', devtools: 'Developer tools', pinTab: 'Pin or unpin tab',
  cleanUp: 'Clean up tabs', screenshot: 'Take screenshot', privateTab: 'New private tab', space1: 'Space 1', space2: 'Space 2', space3: 'Space 3', space4: 'Space 4', space5: 'Space 5',
};
const FEATURES = [
  ['tabSearch', 'Search inside open tabs', 'Start a Ctrl+K query with ? to find text on any open page.'],
  ['snooze', 'Snooze tabs', 'Send a tab away and have it come back later.'],
  ['rewind', 'Session rewind', 'Saves your tab set every few minutes so you can bring tabs back.'],
  ['soloAudio', 'One sound at a time', 'Pause other playing tabs when one starts playing.'],
  ['peek', 'Peek at links', 'Right-click a link to preview it in a floating card.'],
  ['darkPage', 'Dark mode for pages', 'Invert any page to a dark version.'],
  ['cleanLinks', 'Copy clean links', 'Strip tracking parameters when copying a link.'],
  ['screenshot', 'Screenshots', 'Capture the page to Pictures and the clipboard (Ctrl+Shift+S).'],
  ['pip', 'Picture in picture', 'Pop the biggest video on a page into a floating window.'],
  ['savePdf', 'Save page as PDF', 'Export the current page to your Downloads folder.'],
  ['translate', 'Translate page', 'Open the current page through Google Translate.'],
  ['privateTabs', 'Private tabs', 'Tabs that keep no history, cookies or cache (Ctrl+Shift+N).'],
];
const FEATURE_GROUPS = [['Tab tools', ['tabSearch', 'snooze', 'rewind', 'soloAudio']], ['Page tools', ['peek', 'darkPage', 'cleanLinks', 'screenshot', 'pip', 'savePdf', 'translate']], ['Privacy', ['privateTabs']]];
const ENGINES = { DuckDuckGo: 'https://duckduckgo.com/?q=%s', Google: 'https://www.google.com/search?q=%s', Brave: 'https://search.brave.com/search?q=%s', Startpage: 'https://www.startpage.com/do/search?q=%s', Ecosia: 'https://www.ecosia.org/search?q=%s', Bing: 'https://www.bing.com/search?q=%s' };

let S = null, overlay = null, customJsApplied = null;

// ---------- settings -> DOM ----------
function applySettings() {
  const s = S.settings, r = document.documentElement.style;
  for (const [k, v] of Object.entries(s.theme)) r.setProperty('--' + k, v);
  { const h = s.theme.accent.replace('#', ''), v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h; const L = (0.299 * parseInt(v.slice(0, 2), 16) + 0.587 * parseInt(v.slice(2, 4), 16) + 0.114 * parseInt(v.slice(4, 6), 16)) / 255; r.setProperty('--on-accent', L > 0.62 ? '#111118' : '#ffffff'); }
  r.setProperty('--radius', s.radius + 'px'); r.setProperty('--gap', s.gap + 'px'); r.setProperty('--side', (s.compact ? 56 : s.sidebarWidth) + 'px');
  r.setProperty('--fs', s.fontSize + 'px'); r.setProperty('--font', `${s.font || "'Inter'"}, 'Inter', system-ui, sans-serif`);
  $('#app').className = `layout-${s.layout}` + (s.compact ? ' compact' : '') + (S.hidden ? ' hidden' : '') + (overlay ? ' ov' : '') + (s.effects ? '' : ' noeffects');
  $('#user-css').textContent = s.customCss || '';
  if (s.customJs !== customJsApplied) {
    customJsApplied = s.customJs;
    if (s.customJs) { try { new Function('nova', 'state', s.customJs)(window.nova, S); } catch (e) { toast('Custom JS error: ' + e.message); } }
  }
}

// ---------- chrome ----------
const spaceTabs = () => S.tabs.filter((t) => t.spaceId === S.activeSpace);
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
function favHtml(t) {
  if (t.loading) return STAR;
  if (t.url === HOME) return '<img class="fav" src="mark.svg" style="background:none" alt="">';
  const h = hostOf(t.url) || t.title || '?';
  if (t.favicon) return `<img class="fav" src="${esc(t.favicon)}" data-l="${esc(h[0] || '?')}" data-h="${hue(h)}">`;
  return fallbackFav(h);
}
const hue = (s) => { let n = 0; for (const c of s) n = (n * 31 + c.charCodeAt(0)) % 360; return n; };
const fallbackFav = (h, hv = hue(h)) => `<span class="fav" style="background:hsl(${hv} 42% 40%)">${esc((h[0] || '+').toUpperCase())}</span>`;
document.addEventListener('error', (e) => { const el = e.target; if (el.tagName === 'IMG' && el.classList.contains('fav')) el.outerHTML = fallbackFav(el.dataset.l, +el.dataset.h); }, true);

function render() {
  if (!S) return;
  applySettings();
  const cur = S.tabs.find((t) => t.id === S.activeTab);
  $('#nav').innerHTML = `<img id="mark" src="mark.svg" alt="">` + ibtn('back', 'Back (Alt+←)', 'back', cur?.canBack ? '' : 'off') + ibtn('fwd', 'Forward (Alt+→)', 'forward', cur?.canForward ? '' : 'off') + ibtn('reload', 'Reload (Ctrl+R)', 'reload');
  $('#winctl').innerHTML = ibtn('min', 'Minimize', 'min') + ibtn('max', 'Maximize', 'max') + ibtn('x', 'Close', 'wclose', 'close');
  let label = '<span>Search or enter address</span>', icon = 'search';
  if (cur && cur.url !== HOME) {
    try { const u = new URL(cur.url); icon = u.protocol === 'https:' ? 'lock' : 'globe'; label = `<b>${esc(u.hostname.replace(/^www\./, ''))}</b><span>${esc((u.pathname + u.search).replace(/^\/$/, '').slice(0, 60))}</span>`; } catch { label = `<b>${esc(cur.url)}</b>`; }
  }
  $('#urlbar').innerHTML = `${ic(icon)}<span id="url-text">${label}</span>${cur?.bookmarked ? ic('star').replace('<svg', '<svg style="fill:var(--accent);stroke:var(--accent)"') : '<kbd>Ctrl K</kbd>'}`;

  const tabs = spaceTabs(), maxAge = (S.settings.archiveAfterHours || 24) * 3600e3;
  $('#pins').innerHTML = tabs.filter((t) => t.pinned).map((t) => `<div class="pin ${t.id === S.activeTab ? 'active' : ''}" data-tab="${t.id}" title="${esc(t.title)}">${favHtml(t)}</div>`).join('');
  $('#tabs').innerHTML = `<div class="tab newtab" data-do="newTab"><span class="fav" style="color:var(--dim)">${ic('plus')}</span><span class="t">New tab</span><kbd>Ctrl T</kbd></div>`
    + tabs.filter((t) => !t.pinned).map((t) => {
      const idle = t.id === S.activeTab ? 0 : Math.min(1, (S.now - t.lastActive) / maxAge);
      return `<div class="tab ${t.id === S.activeTab ? 'active' : ''} ${t.asleep ? 'asleep' : ''} ${t.id === S.split ? 'split' : ''} ${t.private ? 'private' : ''}" data-tab="${t.id}" style="opacity:${(1 - idle * 0.5).toFixed(2)}" title="${esc(t.title)}${t.url === HOME ? '' : '\n' + esc(t.url)}">
        ${favHtml(t)}<span class="t">${esc(t.title || 'New tab')}</span>${t.audible || t.muted ? `<button class="aud" data-mute="${t.id}" title="${t.muted ? 'Unmute' : 'Mute'}">${ic(t.muted ? 'mute' : 'vol')}</button>` : ''}<button class="x" data-close="${t.id}">${ic('x')}</button></div>`;
    }).join('');
  const total = S.tabs.length, max = S.settings.maxTabs;
  $('#foot').innerHTML = S.spaces.map((sp, i) => `<button class="space ${sp.id === S.activeSpace ? 'active' : ''}" data-space="${sp.id}" title="${esc(sp.name)} (Alt+${i + 1})" style="${sp.id === S.activeSpace ? `background:${sp.color}` : ''}">${sp.id === S.activeSpace ? esc(sp.name) : esc(sp.name[0] || '?')}</button>`).join('')
    + `<button class="space add" data-do="addSpace" title="New space">${ic('plus')}</button><span class="sp"></span>`
    + (S.extensions || []).filter((e) => e.popup).slice(0, 5).map((e) => `<button class="ibtn" title="${esc(e.name)}" data-extpop="${e.id}">${e.icon ? `<img src="${e.icon}" width="16" height="16" style="border-radius:4px">` : ic('box')}</button>`).join('')
    + (S.updateReady ? `<button class="btn primary" data-do="update" style="height:24px;padding:0 10px;font-size:11.5px" title="Restart to install the update">Update</button>` : '')
    + (S.settings.adblock ? `<span class="shield" title="Blocked by the uBlock Origin filter lists">${ic('shield')}<span>${S.blockedCount}</span></span>` : '')
    + (S.budget.enabled ? `<button class="ram ${S.budget.over || S.budget.used > S.budget.cap * 0.9 ? 'hot' : ''}" data-do="budget" title="Memory used by Nova / your budget of ${S.budget.cap} MB"><i style="width:${Math.min(100, Math.round(S.budget.used / S.budget.cap * 100))}%"></i><span>${S.budget.used} MB</span></button>` : '')
    + `<span class="budget ${max && total >= max - 3 ? 'hot' : ''}" title="Open tabs / tab budget">${total}${max ? '/' + max : ''}</span>`
    + ibtn('grid', 'Tab overview (Ctrl+E)', 'overview') + ibtn('sliders', 'Settings (Ctrl+,)', 'settings');
}
setInterval(() => { if (S) { S.now = Date.now(); render(); } }, 20000);

document.addEventListener('click', (e) => {
  if (menuOpen && e.target.closest('#menu')) return;
  hideMenu();
  const d = e.target.closest('[data-do]')?.dataset.do;
  if (d) {
    const A = (name) => () => nova.cmd('action', { name });
    const m = { back: () => nova.cmd('back'), forward: () => nova.cmd('forward'), reload: () => nova.cmd('reload'), min: () => nova.cmd('win', { op: 'min' }), max: () => nova.cmd('win', { op: 'max' }), wclose: () => nova.cmd('win', { op: 'close' }), overview: A('overview'), settings: A('settings'), budget: () => nova.cmd('overlay', { kind: 'settings', data: { tab: 'Resource budget' } }), newTab: A('newTab'), update: () => nova.cmd('applyUpdate'), addSpace: () => { const n = window.prompt('Name of the new space'); n && nova.cmd('addSpace', { name: n }); } };
    return m[d]?.();
  }
  if (e.target.closest('#urlbar')) return nova.cmd('action', { name: 'go' });
  const xp = e.target.closest('[data-extpop]'); if (xp) return nova.cmd('extPopup', { id: xp.dataset.extpop });
  const mu = e.target.closest('[data-mute]'); if (mu) return nova.cmd('mute', { id: +mu.dataset.mute });
  const c = e.target.closest('[data-close]'); if (c) return nova.cmd('close', { id: +c.dataset.close });
  const t = e.target.closest('[data-tab]'); if (t && !overlay) return nova.cmd('activate', { id: +t.dataset.tab });
  const sp = e.target.closest('[data-space]'); if (sp) return nova.cmd('switchSpace', { id: +sp.dataset.space });
});
document.addEventListener('auxclick', (e) => { const t = e.target.closest('[data-tab]'); if (t && e.button === 1) nova.cmd('close', { id: +t.dataset.tab }); });
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const t = e.target.closest('[data-tab]'), sp = e.target.closest('[data-space]');
  if (t && !overlay) showMenu(e, tabMenu(+t.dataset.tab)); else if (sp) showMenu(e, spaceMenu(+sp.dataset.space));
});
function showMenu(e, items) {
  const m = $('#menu'); const oldW = innerWidth, x0 = e.clientX, y0 = e.clientY;
  m.innerHTML = items.map((i) => i === '-' ? '<div class="sep"></div>' : !i.run ? `<div class="lbl">${esc(i.label)}</div>` : `<button>${esc(i.label)}</button>`).join('');
  const runs = items.filter((i) => i !== '-' && i.run);
  m.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', (ev) => { ev.stopPropagation(); hideMenu(); runs[i].run(); }));
  m.hidden = true; menuOpen = true;
  nova.cmd('overlay', { kind: 'menu' }); // grows the view to the whole window so the menu is never clipped
  setTimeout(() => {
    const dx = S.settings.layout === 'right' ? innerWidth - oldW : 0; m.hidden = false;
    m.style.left = Math.max(8, Math.min(x0 + dx, innerWidth - 216)) + 'px'; m.style.top = Math.max(8, Math.min(y0, innerHeight - m.offsetHeight - 8)) + 'px';
  }, 120);
}
let menuOpen = false;
const hideMenu = () => { $('#menu').hidden = true; if (menuOpen) { menuOpen = false; nova.cmd('closeOverlay'); } };
function tabMenu(id) {
  const t = S.tabs.find((x) => x.id === id), others = S.spaces.filter((s) => s.id !== t.spaceId);
  return [
    { label: t.pinned ? 'Unpin tab' : 'Pin tab', run: () => nova.cmd('pin', { id }) },
    { label: id === S.split ? 'Close split view' : 'Open in split view', run: () => nova.cmd('split', { id }) },
    { label: 'Put to sleep', run: () => nova.cmd('sleep', { id }) },
    ...(others.length ? ['-', { label: 'Move to space' }, ...others.map((s) => ({ label: s.name, run: () => nova.cmd('moveToSpace', { id, spaceId: s.id }) }))] : []),
    '-', { label: 'Archive to Stardust', run: () => nova.cmd('archive', { id }) }, { label: 'Close tab', run: () => nova.cmd('close', { id }) },
  ];
}
function spaceMenu(id) {
  const sp = S.spaces.find((s) => s.id === id);
  return [
    { label: 'Rename space', run: () => { const n = window.prompt('Space name', sp.name); n && nova.cmd('renameSpace', { id, name: n }); } },
    { label: 'Change colour', run: () => { const n = window.prompt('Colour (hex)', sp.color); n && nova.cmd('renameSpace', { id, color: n }); } },
    { label: 'Delete space and its tabs', run: () => window.confirm('Delete this space and close all its tabs?') && nova.cmd('deleteSpace', { id }) },
  ];
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 4500); }

// ---------- overlay plumbing ----------
function setOverlay(kind, data) {
  overlay = { kind, data };
  $('#app').classList.add('ov');
  if (kind === 'menu') return;
  const o = $('#overlay'); o.hidden = false; o.innerHTML = '';
  o.onmousedown = (e) => { if (e.target === o && kind !== 'wizard') nova.cmd('closeOverlay'); };
  ({ palette, overview, settings, wizard, peek })[kind](o, data || {});
}
function clearOverlay() { overlay = null; $('#app').classList.remove('ov'); $('#menu').hidden = true; menuOpen = false; const o = $('#overlay'); o.hidden = true; o.innerHTML = ''; }
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay) { e.preventDefault(); nova.cmd(overlay.kind === 'wizard' ? 'finishSetup' : 'closeOverlay'); } }, true);

// ---------- command palette ----------
const score = (q, ...fields) => { const hay = fields.join(' ').toLowerCase(); let s = 0; for (const w of q.toLowerCase().split(/\s+/).filter(Boolean)) { const i = hay.indexOf(w); if (i < 0) return -1; s += 100 - Math.min(i, 99); } return s; };
const isOpenItem = (it) => it.kind === 'open';
const at = (h, m = 0, addDays = 0) => { const d = new Date(); d.setDate(d.getDate() + addDays); d.setHours(h, m, 0, 0); return d.getTime(); };
function nextMonday() { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); return d.getTime(); }
function commands() {
  const A = (name) => () => nova.cmd('action', { name });
  const set = (patch) => () => { nova.cmd('settings', { patch }); nova.cmd('closeOverlay'); };
  const cur = S.tabs.find((t) => t.id === S.activeTab);
  const clean = (mode) => () => { nova.cmd('closeOverlay'); nova.cmd('cleanUp', { mode }); };
  const snz = (label, until) => ({ t: 'Snooze tab: ' + label, s: 'It comes back on its own', run: () => { nova.cmd('closeOverlay'); nova.cmd('snooze', { until }); } });
  const hr = new Date().getHours(), F = S.settings.features;
  return [
    { t: 'Tab overview', s: 'All tabs as cards, memory use, cleanup', k: 'Ctrl E', run: A('overview') },
    { t: cur?.bookmarked ? 'Remove bookmark' : 'Bookmark this page', k: 'Ctrl D', run: A('bookmark') },
    ...(F.tabSearch ? [{ t: 'Search inside all open tabs', s: 'Or start your query with ?', run: () => nova.cmd('overlay', { kind: 'palette', data: { mode: 'go', text: '? ' } }) }] : []),
    ...(F.snooze ? [snz('in 1 hour', Date.now() + 3600e3), ...(hr < 17 ? [snz('this evening', at(18))] : []), snz('tomorrow morning', at(9, 0, 1)), snz('next Monday', nextMonday())] : []),
    ...(F.rewind ? [{ t: 'Rewind: bring back tabs from earlier', s: 'Sessions are saved every few minutes', run: () => nova.cmd('overlay', { kind: 'palette', data: { mode: 'go', text: 'rewind ' } }) }] : []),
    ...(F.darkPage ? [{ t: cur?.dark ? 'Turn off dark mode for this page' : 'Dark mode for this page', k: 'Ctrl ⇧ D', run: A('darkPage') }] : []),
    ...(F.screenshot ? [{ t: 'Take screenshot', k: 'Ctrl ⇧ S', run: A('screenshot') }] : []),
    ...(F.pip ? [{ t: 'Picture in picture', s: 'Pop the biggest video into a floating window', run: () => { nova.cmd('closeOverlay'); nova.cmd('pip'); } }] : []),
    ...(F.savePdf ? [{ t: 'Save page as PDF', run: () => { nova.cmd('closeOverlay'); nova.cmd('savePdf'); } }] : []),
    ...(F.translate ? [{ t: 'Translate this page', run: () => { nova.cmd('closeOverlay'); nova.cmd('translate'); } }] : []),
    ...(F.privateTabs ? [{ t: 'New private tab', s: 'Keeps no history, cookies or cache', k: 'Ctrl ⇧ N', run: A('privateTab') }] : []),
    ...(F.cleanLinks ? [{ t: 'Copy link without tracking junk', k: 'Ctrl ⇧ C', run: A('copyClean') }] : []),
    { t: 'Resource budget', s: 'Set how much memory Nova may use', run: () => nova.cmd('overlay', { kind: 'settings', data: { tab: 'Resource budget' } }) },
    { t: 'Clean up: archive tabs idle for 1 hour', run: clean('hour') }, { t: 'Clean up: archive all unpinned tabs', run: clean('all') }, { t: 'Clean up: close duplicate tabs', run: clean('duplicates') },
    { t: cur?.pinned ? 'Unpin tab' : 'Pin tab', k: 'Ctrl ⇧ P', run: A('pinTab') },
    { t: 'Find in page', k: 'Ctrl F', run: () => nova.cmd('overlay', { kind: 'palette', data: { mode: 'find', text: '' } }) },
    { t: 'Print', k: 'Ctrl P', run: A('print') }, { t: 'Full screen', k: 'F11', run: A('fullscreen') },
    { t: 'New space', run: () => { nova.cmd('closeOverlay'); setTimeout(() => { const n = window.prompt('Name of the new space'); n && nova.cmd('addSpace', { name: n }); }, 50); } },
    { t: 'Toggle sidebar', k: 'Ctrl B', run: A('toggleSidebar') }, { t: 'Focus mode', s: 'Hide all interface', k: 'Ctrl ⇧ F', run: A('focusMode') },
    { t: 'Sidebar on the left', run: set({ layout: 'left' }) }, { t: 'Sidebar on the right', run: set({ layout: 'right' }) }, { t: 'Tabs on top', run: set({ layout: 'top' }) },
    { t: S.settings.compact ? 'Expand sidebar' : 'Compact sidebar', run: set({ compact: !S.settings.compact }) },
    { t: S.settings.adblock ? 'Turn ad blocker off' : 'Turn ad blocker on', run: set({ adblock: !S.settings.adblock }) },
    { t: 'Developer tools', k: 'F12', run: A('devtools') }, { t: 'Settings', k: 'Ctrl ,', run: A('settings') },
    { t: 'Move in from another browser', s: 'Bookmarks, sign-ins, extensions', run: () => nova.cmd('overlay', { kind: 'settings', data: { tab: 'Move in' } }) },
    { t: 'Close split view', run: () => nova.cmd('split', { id: S.activeTab }) },
    { t: 'Check for updates', run: () => { nova.cmd('closeOverlay'); nova.cmd('checkUpdate'); } },
    ...Object.keys(PRESETS).map((n) => ({ t: 'Theme: ' + n, run: set({ theme: PRESETS[n] }) })),
    ...S.spaces.map((sp) => ({ t: 'Go to space: ' + sp.name, run: () => { nova.cmd('closeOverlay'); nova.cmd('switchSpace', { id: sp.id }); } })),
  ];
}
const looksLikeUrl = (q) => /^(https?|file|about):/i.test(q) || (!/\s/.test(q) && (/^localhost/i.test(q) || /^[^\s/]+\.[a-z]{2,}([:/?#]|$)/i.test(q)));
function palette(o, d) {
  const mode = d.mode || 'go';
  const ph = mode === 'find' ? 'Find in page' : mode === 'new' ? 'Open in a new tab: search or enter address' : 'Search, enter an address, or jump to a tab or command';
  o.innerHTML = `<div class="box palette"><div class="pinput">${ic('search')}<input id="q" placeholder="${ph}" autocomplete="off" spellcheck="false"></div><div class="list" id="list"></div><div class="hint"><span><kbd>↑</kbd><kbd>↓</kbd>select</span><span><kbd>Enter</kbd>${mode === 'find' ? 'next' : 'open'}</span>${mode === 'find' ? '<span id="found"></span>' : '<span><kbd>Alt Enter</kbd>new tab</span>'}<span><kbd>Esc</kbd>close</span></div></div>`;
  const q = $('#q'), list = $('#list'); let items = [], sel = 0, seq = 0, extra = null, inside = null, timer;
  q.value = d.text || '';
  const draw = () => {
    list.innerHTML = items.map((it, i) => it.sec ? `<div class="sec">${esc(it.sec)}</div>` : `<div class="item ${i === sel ? 'sel' : ''}" data-i="${i}"><span class="ii">${it.icon || ''}</span><div class="m"><span class="a">${esc(it.t)}</span>${it.s ? `<span class="b">${esc(it.s)}</span>` : ''}</div>${it.k ? `<kbd>${esc(it.k)}</kbd>` : ''}</div>`).join('');
    list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  };
  const first = () => Math.max(0, items.findIndex((i) => !i.sec));
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  const noop = () => {};
  const build = () => {
    if (mode === 'find') { items = []; return nova.cmd('find', { text: q.value }); }
    const v = q.value.trim(); items = [];
    if (S.settings.features.tabSearch && v.startsWith('?')) { // full-text search across open tabs
      const term = v.slice(1).trim();
      items.push({ sec: 'Inside your open tabs' });
      if (term.length < 2) items.push({ keep: 1, t: 'Type to search the text of every open tab', s: 'Sleeping tabs are skipped', icon: ic('search'), act: noop });
      else if (inside === null) items.push({ keep: 1, t: 'Searching', icon: ic('search'), act: noop });
      else if (!inside.length) items.push({ keep: 1, t: 'No open tab contains that', icon: ic('search'), act: noop });
      else items.push(...inside.map((r) => { const t = S.tabs.find((x) => x.id === r.id); return t ? { t: t.title || 'Tab', s: r.snippet, icon: favHtml(t), act: () => nova.cmd('activate', { id: t.id }) } : null; }).filter(Boolean));
      sel = first(); return;
    }
    if (v) items.push({ kind: 'open', t: looksLikeUrl(v) ? `Open ${v}` : `Search “${v}”`, s: looksLikeUrl(v) ? '' : 'with your search engine', icon: ic(looksLikeUrl(v) ? 'globe' : 'search'), act: (nt) => nova.cmd('open', { text: v, newTab: nt || mode === 'new' }) });
    const open = S.tabs.map((t) => ({ t, sc: v ? score(v, t.title, t.url) : t.id === S.activeTab ? -1 : 1 / (1 + (S.now - t.lastActive)) })).filter((x) => x.sc >= 0).sort((a, b) => b.sc - a.sc).slice(0, v ? 8 : 6);
    if (open.length) items.push({ sec: v ? 'Open tabs' : 'Recent tabs' }, ...open.map(({ t }) => { const sp = S.spaces.find((s) => s.id === t.spaceId); return { t: t.title || 'New tab', s: (S.spaces.length > 1 ? sp.name + '  ·  ' : '') + (t.url === HOME ? '' : hostOf(t.url)), icon: `<span class="dot" style="background:${sp.color}"></span>`, act: () => nova.cmd('activate', { id: t.id }) }; }));
    if (extra?.bookmarks?.length) items.push({ sec: 'Bookmarks' }, ...extra.bookmarks.map((b) => ({ t: b.title || b.url, s: hostOf(b.url), icon: ic('star'), act: () => nova.cmd('open', { text: b.url, newTab: true }) })));
    if (extra?.history?.length) items.push({ sec: 'History' }, ...extra.history.map((h) => ({ t: h.title || h.url, s: hostOf(h.url), icon: ic('clock'), act: () => nova.cmd('open', { text: h.url, newTab: true }) })));
    const arch = S.archive.map((a) => ({ a, sc: v ? score(v, a.title, a.url) : 1 })).filter((x) => x.sc >= 0).slice(0, v ? 5 : 3);
    if (arch.length) items.push({ sec: 'Stardust · recently closed' }, ...arch.map(({ a }) => ({ t: a.title || a.url, s: hostOf(a.url), icon: ic('archive'), act: () => nova.cmd('restore', { closedAt: a.closedAt }) })));
    if (extra?.downloads?.length) items.push({ sec: 'Downloads' }, ...extra.downloads.map((x) => ({ t: x.name, s: x.state === 'completed' ? 'Show in folder' : x.state, icon: ic('download'), act: () => nova.cmd('showDownload', { path: x.path }) })));
    if (extra?.snapshots?.length) items.push({ sec: 'Rewind · bring back tabs' }, ...extra.snapshots.map((s) => ({ t: `Tabs from ${ago(s.t)}`, s: `${s.n} tabs`, icon: ic('rewind'), act: () => nova.cmd('restoreSnapshot', { t: s.t }) })));
    const cmds = commands().map((cm) => ({ cm, sc: v ? score(v, cm.t, cm.s || '') : 1 })).filter((x) => x.sc >= 0).slice(0, v ? 6 : 5);
    if (cmds.length) items.push({ sec: 'Commands' }, ...cmds.map(({ cm }) => ({ t: cm.t, s: cm.s, k: cm.k, icon: ic('cmd'), act: cm.run })));
    sel = first();
  };
  const run = (it, alt) => { if (!it || !it.act) return; if (!isOpenItem(it) && !it.keep) nova.cmd('closeOverlay'); it.act(alt); };
  const refresh = () => {
    const v = q.value.trim(), my = ++seq; clearTimeout(timer);
    if (mode === 'find') return build();
    if (S.settings.features.tabSearch && v.startsWith('?')) { inside = null; build(); draw(); timer = setTimeout(async () => { const r = await nova.cmd('searchTabs', { text: v.slice(1) }); if (my === seq) { inside = r || []; build(); draw(); } }, 280); return; }
    build(); draw();
    nova.cmd('query', { text: v }).then((r) => { if (my === seq) { extra = r; build(); draw(); } });
  };
  q.addEventListener('input', refresh);
  q.addEventListener('keydown', (e) => {
    if (mode === 'find') { if (e.key === 'Enter') nova.cmd('find', { text: q.value, next: true, forward: !e.shiftKey }); return; }
    const mv = (n) => { do { sel = (sel + n + items.length) % items.length; } while (items[sel]?.sec); draw(); };
    if (e.key === 'ArrowDown') { e.preventDefault(); mv(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); mv(-1); } else if (e.key === 'Enter') { e.preventDefault(); run(items[sel], e.altKey); }
  });
  list.addEventListener('mousemove', (e) => { const i = e.target.closest('.item')?.dataset.i; if (i !== undefined && +i !== sel) { sel = +i; draw(); } });
  list.addEventListener('click', (e) => { const i = e.target.closest('.item')?.dataset.i; if (i !== undefined) run(items[+i]); });
  q.focus(); if (d.select) q.select(); refresh();
}
nova.onFound((r) => { const f = $('#found'); if (f) f.textContent = r.matches ? `${r.activeMatchOrdinal} of ${r.matches}` : 'No matches'; });

// ---------- peek ----------
function peek(o, d) {
  o.innerHTML = `<div class="peekbar"><div class="pt"><b id="pk-t">Peek</b><span id="pk-u">${esc(hostOf(d.url))}</span></div><button class="btn primary" id="pk-open">Open as tab</button><button class="btn" id="pk-x">Close</button></div>`;
  $('#pk-open').onclick = () => nova.cmd('peekOpen', { url: d.url }); $('#pk-x').onclick = () => nova.cmd('closeOverlay');
}
nova.onPeek((p) => { const t = $('#pk-t'); if (t) { t.textContent = p.title || 'Peek'; $('#pk-u').textContent = hostOf(p.url); } });

// ---------- tab overview ----------
async function overview(o) {
  const thumbs = await nova.thumbs(), mem = S.budget.tabs, total = S.budget.used;
  o.innerHTML = `<div class="box overview"><div class="ov-head"><div class="pinput">${ic('search')}<input id="ovq" placeholder="Filter ${S.tabs.length} tabs" autocomplete="off"></div><button class="btn" data-c="hour" title="Archive tabs not touched for an hour">Archive idle</button><button class="btn" data-c="duplicates">Close duplicates</button><button class="btn" id="bud" title="Open your resource budget">Nova uses ${total} MB</button><button class="btn primary" id="ovx">Done</button></div><div class="ov-body" id="ovb"></div></div>`;
  const body = $('#ovb'), qi = $('#ovq');
  const ago = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? 'now' : m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d'; };
  const draw = () => {
    const v = qi.value.trim();
    body.innerHTML = S.spaces.map((sp) => {
      const ts = S.tabs.filter((t) => t.spaceId === sp.id && (!v || score(v, t.title, t.url) >= 0));
      if (!ts.length) return '';
      return `<h3><span class="dot" style="background:${sp.color}"></span>${esc(sp.name)} <small>${ts.length}</small></h3><div class="grid">${ts.map((t) => `<div class="card ${t.id === S.activeTab ? 'active' : ''} ${S.now - t.lastActive > 3600e3 && t.id !== S.activeTab ? 'stale' : ''}" data-tab="${t.id}"><div class="th" style="${thumbs[t.id] ? `background-image:url(${thumbs[t.id]})` : ''}">${thumbs[t.id] ? '' : esc((t.title || '·')[0])}</div><span class="age">${t.pinned ? 'Pinned · ' : ''}${t.asleep ? 'Asleep · ' : ''}${ago(S.now - t.lastActive)}${mem?.[t.id] ? ` · ${mem[t.id]} MB` : ''}</span><div class="acts"><button class="ibtn" data-act="pin" title="Pin">${ic('pin')}</button><button class="ibtn" data-act="archive" title="Archive">${ic('archive')}</button><button class="ibtn" data-act="close" title="Close">${ic('x')}</button></div><div class="cb">${favHtml(t)}<span>${esc(t.title || 'New tab')}</span></div></div>`).join('')}</div>`;
    }).join('') || '<p style="color:var(--dim);padding:30px">No tabs match.</p>';
  };
  qi.addEventListener('input', draw);
  body.addEventListener('click', async (e) => {
    const card = e.target.closest('.card'); if (!card) return; const id = +card.dataset.tab, act = e.target.closest('[data-act]')?.dataset.act;
    if (act) { e.stopPropagation(); await nova.cmd(act, { id }); return; }
    nova.cmd('activate', { id });
  });
  o.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => nova.cmd('cleanUp', { mode: b.dataset.c })));
  $('#bud').onclick = () => nova.cmd('overlay', { kind: 'settings', data: { tab: 'Resource budget' } });
  $('#ovx').onclick = () => nova.cmd('closeOverlay');
  overview.redraw = draw; draw(); qi.focus();
}

// ---------- settings ----------
const PROFILE_INFO = [
  ['ultra', 'Ultra Performance', 'The bare minimum. Search and tabs, nothing else.', ['No ad blocker, history or previews', 'No animations or effects', 'Memory limit 1 GB', 'As light as a browser can be']],
  ['nova', 'Nova', 'Recommended. Light, with the essentials.', ['Ad blocker built in', 'Subtle effects, history and previews', 'Memory limit 2 GB', 'Extra tools stay off until you want them']],
  ['complete', 'Complete', 'Everything switched on, for people who want it all.', ['Ad blocker and every extra tool', 'Private tabs, screenshots, PDF, picture-in-picture, translate', 'Memory limit 4 GB', 'More features, more resources']],
];
const NAV_GROUPS = [
  ['General', [['Profile', 'user'], ['Appearance', 'palette']]],
  ['Browsing', [['Tabs', 'layers'], ['Resource budget', 'gauge'], ['Search & privacy', 'shield']]],
  ['Customize', [['Features', 'sliders'], ['Shortcuts', 'keyboard'], ['Extensions', 'box'], ['Custom code', 'code']]],
  ['Data', [['Move in', 'imp'], ['Backup & updates', 'save']]],
];
const TAB_ALIAS = { Layout: 'Appearance', Theme: 'Appearance', Code: 'Custom code' };

function settings(o, d) {
  let tab = TAB_ALIAS[d.tab] || d.tab || 'Profile';
  const patch = (p) => nova.cmd('settings', { patch: p });
  const row = (label, ctl, hint = '') => `<div class="row"><div class="l">${label}${hint ? `<small>${hint}</small>` : ''}</div>${ctl}</div>`;
  const sw = (k, on) => `<label class="sw"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}><i></i></label>`;
  const bsw = (k, on) => `<label class="sw"><input type="checkbox" data-bud="${k}" ${on ? 'checked' : ''}><i></i></label>`;
  const fsw = (k, on) => `<label class="sw"><input type="checkbox" data-feat="${k}" ${on ? 'checked' : ''}><i></i></label>`;
  const seg = (k, vals, cur) => `<div class="seg">${vals.map((v) => `<button data-seg="${k}" data-v="${v}" class="${cur === v ? 'on' : ''}">${v}</button>`).join('')}</div>`;
  const rng = (k, min, max, step, unit = '') => `<div class="rng"><input type="range" min="${min}" max="${max}" step="${step}" value="${S.settings[k]}" data-k="${k}" data-num><span class="val">${S.settings[k]}${unit}</span></div>`;
  const grp = (...rows) => `<div class="group">${rows.join('')}</div>`;
  const head = (t, sub) => `<h2>${t}</h2><p class="sub">${sub}</p>`;
  const pages = {
    Profile: (s) => head('Profile', 'One choice that decides how much Nova does. Switch whenever you like.')
      + `<div class="profiles">${PROFILE_INFO.map(([id, name, tag, bullets]) => `<div class="pcard ${s.profile === id ? 'on' : ''}"><div class="ph"><b>${name}</b>${id === 'nova' ? '<span class="tag">Recommended</span>' : ''}${s.profile === id ? '<span class="tag on">Active</span>' : ''}</div><p>${tag}</p><ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>${s.profile === id ? '' : `<button class="btn" data-profile="${id}">Use ${name}</button>`}</div>`).join('')}</div>`
      + '<h4>Setup</h4>' + grp(row('Run the welcome setup again', '<button class="btn" id="rerun">Start setup</button>', 'Walk through profile, layout, search and extensions once more.')),
    Appearance: (s) => head('Appearance', 'Theme, layout and type. Every part of Nova is adjustable.')
      + `<div class="presets">${Object.entries(PRESETS).map(([n, p]) => `<button class="preset" data-preset="${n}"><div class="pv"><i style="background:${p.bg}"></i><i style="background:${p.surface2}"></i><i style="background:${p.accent}"></i></div><span>${n}</span></button>`).join('')}</div>`
      + `<details class="more"><summary>Fine-tune colours</summary>${grp(...Object.keys(s.theme).map((k) => row(k[0].toUpperCase() + k.slice(1), `<input class="swatch" type="color" data-theme="${k}" value="${s.theme[k]}">`)))}</details>`
      + '<h4>Layout</h4>' + grp(row('Tab bar', seg('layout', ['left', 'right', 'top'], s.layout)), row('Compact sidebar', sw('compact', s.compact), 'Icons only, for maximum page space.'), row('Sidebar width', rng('sidebarWidth', 180, 420, 4, 'px')))
      + '<h4>Page frame</h4>' + grp(row('Gap around the page', rng('gap', 0, 24, 1, 'px')), row('Corner radius', rng('radius', 0, 28, 1, 'px')))
      + '<h4>Type and motion</h4>' + grp(row('Interface font size', rng('fontSize', 11, 17, 1, 'px')), row('Interface font', `<input type="text" data-k="font" value="${esc(s.font)}" placeholder="Inter">`, 'Any installed font family. Inter is built in.'), row('Animations and blur', sw('effects', s.effects), 'Turn off for the leanest possible interface.')),
    Tabs: (s) => head('Tabs', 'Nova keeps your tab list tidy so you never have to.') + grp(
      row('Tab budget', `<input type="number" min="0" data-k="maxTabs" data-num value="${s.maxTabs}">`, 'Past this many tabs, the least recently used are archived. 0 means unlimited.'),
      row('Sleep after (minutes)', `<input type="number" min="0" data-k="sleepAfterMin" data-num value="${s.sleepAfterMin}">`, 'Frees memory. A sleeping tab reloads when you open it.'),
      row('Archive after (hours)', `<input type="number" min="0" data-k="archiveAfterHours" data-num value="${s.archiveAfterHours}">`, 'Unpinned tabs idle this long move to Stardust, still searchable from Ctrl K.'),
      row('Reuse existing tabs', sw('dedupeTabs', s.dedupeTabs), 'Opening a page you already have open switches to it.')),
    'Resource budget': (s) => head('Resource budget', 'Tell Nova how much memory it may use. It keeps itself under that limit on its own.')
      + `<div class="group"><div class="row" style="display:block"><div style="display:flex;justify-content:space-between;align-items:baseline"><b id="bud-text">${S.budget.used} MB</b><span class="val" id="bud-of">of ${s.budget.enabled ? s.budget.ramMB + ' MB' : 'no limit'}</span></div><div class="meter"><i id="bud-fill" style="width:${s.budget.enabled ? Math.min(100, Math.round(S.budget.used / s.budget.ramMB * 100)) : 0}%"></i></div><small style="color:var(--dim)">Everything Nova uses: the interface, the ad blocker and every tab.</small></div></div><h4>Limit</h4>`
      + grp(row('Keep Nova under a limit', bsw('enabled', s.budget.enabled), 'At the limit, the tabs you used longest ago go to sleep.'),
        row('Preset', `<div class="seg">${[[1024, '1 GB'], [2048, '2 GB'], [4096, '4 GB']].map(([v, l]) => `<button data-bud="ramMB" data-v="${v}" class="${s.budget.ramMB === v ? 'on' : ''}">${l}</button>`).join('')}</div>`),
        row('Custom limit', `<div class="rng"><input type="range" min="512" max="8192" step="128" value="${s.budget.ramMB}" data-bud="ramMB" data-num><span class="val">${s.budget.ramMB} MB</span></div>`))
      + '<h4>Background CPU</h4>' + grp(row('CPU guard', bsw('cpuGuard', s.budget.cpuGuard), 'A background tab that keeps using a lot of CPU is put to sleep.'),
        row('Guard threshold', `<div class="rng"><input type="range" min="5" max="80" step="5" value="${s.budget.cpuPct}" data-bud="cpuPct" data-num><span class="val">${s.budget.cpuPct}%</span></div>`))
      + '<h4>Heaviest tabs right now</h4><div class="group" id="bud-list">' + budList() + '</div>',
    'Search & privacy': (s) => head('Search & privacy', 'One search engine, one blocker, nothing else phoning home.') + grp(
      row('Search engine', `<select id="eng">${Object.keys(ENGINES).map((n) => `<option ${ENGINES[n] === s.searchEngine ? 'selected' : ''}>${n}</option>`).join('')}<option value="custom" ${Object.values(ENGINES).includes(s.searchEngine) ? '' : 'selected'}>Custom</option></select>`),
      row('Search URL', `<input type="text" data-k="searchEngine" value="${esc(s.searchEngine)}">`, 'Use %s where the query goes.'),
      row('Ad and tracker blocker', sw('adblock', s.adblock), 'Network and cosmetic filtering from the uBlock Origin filter lists, EasyList and EasyPrivacy. Refreshed on every launch.'),
      row('Keep browsing history', sw('keepHistory', s.keepHistory), 'Lets Ctrl K find pages you visited. Off keeps nothing.'),
      row('Tab previews', sw('thumbnails', s.thumbnails), 'Small screenshots in the tab overview. Off saves a little CPU and memory.')),
    Features: (s) => head('Features', 'Nova stays light. Everything beyond the essentials is off until you want it.')
      + FEATURE_GROUPS.map(([g, keys]) => `<h4>${g}</h4>` + grp(...FEATURES.filter(([k]) => keys.includes(k)).map(([k, l, h]) => row(l, fsw(k, s.features[k]), h)))).join(''),
    Shortcuts: (s) => head('Shortcuts', 'Separate several shortcuts with “ | ”, for example Ctrl+Shift+T | F9.') + grp(...Object.entries(ACTIONS).map(([k, l]) => row(l, `<input type="text" data-key="${k}" value="${esc((s.keys[k] || []).join(' | '))}">`))) + '<p style="margin-top:14px"><button class="btn" id="rk">Reset shortcuts</button></p>',
    Extensions: () => head('Extensions', 'Nova ships bare. Add only what you want, installed in one click.') + extensionsHtml(),
    'Custom code': (s) => head('Custom code', 'Nova is built from plain CSS variables. Rewrite anything.') + '<h4>CSS for the Nova interface</h4><p>Parts: <code>#chrome</code> <code>#tabs</code> <code>.tab</code> <code>.pin</code> <code>#urlbar</code> <code>#foot</code> <code>.card</code> <code>.box</code> <code>.item</code>. Variables: <code>--bg</code> <code>--surface</code> <code>--accent</code> <code>--radius</code></p>'
      + `<textarea id="ccss" spellcheck="false">${esc(s.customCss)}</textarea><h4>CSS for every website</h4><textarea id="pcss" spellcheck="false" placeholder="Dark tweaks, hide a cookie banner, anything.">${esc(s.pageCss)}</textarea><h4>JavaScript for the Nova interface</h4><p>Runs at load with <code>nova</code> and <code>state</code> in scope.</p><textarea id="cjs" spellcheck="false">${esc(s.customJs)}</textarea><p style="margin-top:12px"><button class="btn primary" id="applycode">Apply</button></p>`,
    'Move in': () => head('Move in', 'Switching browsers without starting from zero.') + '<div id="movein"><p>Looking for other browsers</p></div>',
    'Backup & updates': (s) => head('Backup & updates', 'Your whole setup is one JSON document. Nova updates itself in the background.') + grp(row(`Nova ${esc(S.version || '')}`, '<button class="btn" id="chk">Check for updates</button>', 'Updates download quietly and install the next time Nova starts.'), row('Update feed', `<input type="text" data-k="updateFeed" value="${esc(s.updateFeed)}" placeholder="owner/repo or https://…/latest.json">`, 'A GitHub “owner/repo” or a URL to a latest.json file. Leave empty to use the default.'))
      + `<h4>Settings JSON</h4><textarea id="bk" spellcheck="false">${esc(JSON.stringify(s, null, 2))}</textarea><p style="margin-top:12px;display:flex;gap:8px"><button class="btn primary" id="imp">Import</button><button class="btn danger" id="rst">Reset everything</button></p>`,
  };

  o.innerHTML = `<div class="box settings"><div class="sn"><div class="brand"><img src="mark.svg" alt="">Nova</div><div class="ssearch">${ic('search')}<input id="ss" placeholder="Search settings" autocomplete="off" spellcheck="false"></div><div class="nav" id="snav">${NAV_GROUPS.map(([g, items]) => `<div class="grp">${g}</div>${items.map(([n, i]) => `<button data-t="${n}">${ic(i)}${n}</button>`).join('')}`).join('')}</div><button id="sx" class="closebtn">${ic('x')}Close</button></div><div class="sb" id="sbody"></div></div>`;
  const body = $('#sbody');
  const mark = () => o.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tab && !$('#ss').value));
  const render = (keepScroll) => { const st = body.scrollTop; body.innerHTML = pages[tab](S.settings); body.scrollTop = keepScroll ? st : 0; mark(); bind(); };
  const show = (name) => { tab = name; $('#ss').value = ''; render(false); };
  const again = (ms = 40) => setTimeout(() => { if ($('#sbody') && !$('#ss').value) render(true); }, ms);

  // search across every page's rows
  let index = null;
  const buildIndex = () => { index = []; for (const [name, fn] of Object.entries(pages)) { const t = document.createElement('div'); t.innerHTML = fn(S.settings); t.querySelectorAll('.row').forEach((r) => { const l = r.querySelector('.l'); if (l) index.push({ page: name, label: l.childNodes[0].textContent.trim(), hint: l.querySelector('small')?.textContent || '' }); }); } };
  $('#ss').addEventListener('input', (e) => {
    const q = e.target.value.trim(); mark();
    if (!q) return render(false);
    if (!index) buildIndex();
    const hits = index.filter((i) => score(q, i.label, i.hint, i.page) >= 0).slice(0, 14);
    body.innerHTML = `<h2>Search</h2><p class="sub">${hits.length ? hits.length + ' result' + (hits.length > 1 ? 's' : '') : 'Nothing matches that.'}</p>` + (hits.length ? `<div class="group">${hits.map((h, n) => `<button class="row hit" data-hit="${n}"><div class="l">${esc(h.label)}<small>${esc(h.page)}${h.hint ? ' · ' + esc(h.hint) : ''}</small></div></button>`).join('')}</div>` : '');
    body.querySelectorAll('[data-hit]').forEach((b) => (b.onclick = () => { const h = hits[+b.dataset.hit]; show(h.page); const r = [...body.querySelectorAll('.row')].find((x) => x.querySelector('.l')?.childNodes[0]?.textContent.trim() === h.label); if (r) { r.scrollIntoView({ block: 'center' }); r.classList.add('flash'); } }));
  });
  o.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => show(b.dataset.t)));
  $('#sx').onclick = () => nova.cmd('closeOverlay');

  const bind = () => {
    body.querySelectorAll('[data-k]').forEach((el) => (el.oninput = el.onchange = () => {
      const v = el.type === 'checkbox' ? el.checked : el.type === 'range' || el.dataset.num !== undefined ? +el.value : el.value;
      if (el.type === 'range') el.nextElementSibling.textContent = v + (el.nextElementSibling.textContent.match(/[a-z%]+$/)?.[0] || '');
      patch({ [el.dataset.k]: v });
    }));
    body.querySelectorAll('[data-seg]').forEach((b) => (b.onclick = () => { patch({ [b.dataset.seg]: b.dataset.v }); body.querySelectorAll(`[data-seg="${b.dataset.seg}"]`).forEach((x) => x.classList.toggle('on', x === b)); }));
    body.querySelectorAll('[data-theme]').forEach((el) => (el.oninput = () => patch({ theme: { ...S.settings.theme, [el.dataset.theme]: el.value } })));
    body.querySelectorAll('[data-preset]').forEach((b) => (b.onclick = () => { patch({ theme: PRESETS[b.dataset.preset] }); again(120); }));
    body.querySelectorAll('[data-key]').forEach((el) => (el.onchange = () => patch({ keys: { ...S.settings.keys, [el.dataset.key]: el.value.split('|').map((x) => x.trim()).filter(Boolean) } })));
    body.querySelectorAll('[data-feat]').forEach((el) => (el.onchange = () => patch({ features: { ...S.settings.features, [el.dataset.feat]: el.checked } })));
    body.querySelectorAll('[data-bud]').forEach((el) => {
      const set = (v) => patch({ budget: { ...S.settings.budget, [el.dataset.bud]: v } });
      if (el.tagName === 'BUTTON') el.onclick = () => { set(+el.dataset.v); again(120); };
      else if (el.type === 'checkbox') el.onchange = () => set(el.checked);
      else el.oninput = () => { const v = +el.value; el.nextElementSibling.textContent = v + (el.dataset.bud === 'cpuPct' ? '%' : ' MB'); set(v); };
    });
    body.querySelectorAll('[data-sleep]').forEach((b) => (b.onclick = () => nova.cmd('sleep', { id: +b.dataset.sleep })));
    body.querySelectorAll('[data-profile]').forEach((b) => (b.onclick = () => { nova.cmd('applyProfile', { name: b.dataset.profile }); toast('Profile switched.'); again(150); }));
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    if ($('#eng')) $('#eng').onchange = (e) => { if (ENGINES[e.target.value]) { patch({ searchEngine: ENGINES[e.target.value] }); again(); } };
    on('#rk', () => { patch({ keys: {} }); again(120); }); on('#chk', () => nova.cmd('checkUpdate')); on('#rerun', () => nova.cmd('runSetup'));
    on('#applycode', () => { patch({ customCss: $('#ccss').value, pageCss: $('#pcss').value, customJs: $('#cjs').value }); toast('Applied'); });
    on('#imp', () => { try { patch(JSON.parse($('#bk').value)); toast('Imported'); } catch (e) { toast('Invalid JSON: ' + e.message); } });
    on('#rst', () => window.confirm('Reset all settings to defaults?') && nova.cmd('resetSettings'));
    if (tab === 'Extensions') bindExtensions(body, () => render(true));
    if (tab === 'Move in') moveInHtml().then((h) => { const m = $('#movein'); if (m) { m.innerHTML = h; bindMoveIn(body, () => render(true)); } });
  };
  render(false);
}

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
  return `<div class="catalog">${CATALOG.filter((c) => !ids || ids.includes(c.id)).map((c) => `<div class="cat"><div><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></div>${installedId(c.id) ? '<span class="done">Installed</span>' : `<button class="btn primary" data-install="${c.id}">Install</button>`}</div>`).join('')}</div>`;
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
  const t = $('#bud-text'); if (!t) return; const b = S.settings.budget;
  t.textContent = S.budget.used + ' MB'; $('#bud-of').textContent = 'of ' + (b.enabled ? b.ramMB + ' MB' : 'no limit'); $('#bud-fill').style.width = (b.enabled ? Math.min(100, Math.round(S.budget.used / b.ramMB * 100)) : 0) + '%';
  const l = $('#bud-list'); if (l) { l.innerHTML = budList(); l.querySelectorAll('[data-sleep]').forEach((x) => (x.onclick = () => nova.cmd('sleep', { id: +x.dataset.sleep }))); }
}

// ---------- first-run wizard ----------
function wizard(o) {
  let i = 0;
  const choice = { profile: S.settings.profile || 'nova', layout: S.settings.layout, theme: 'Nova', engine: 'DuckDuckGo' };
  const opt = (g, v, t, sub = '') => `<button class="opt ${choice[g] === v ? 'on' : ''}" data-g="${g}" data-v="${v}">${t}<small>${sub}</small></button>`;
  const defs = {
    profile: ['How should Nova feel?', 'Pick a profile. It sets sensible defaults for everything, and you can switch later in Settings.', () => `<div class="pchoices" style="grid-column:1/-1">${PROFILE_INFO.map(([id, name, tag, bullets]) => `<button class="pchoice ${choice.profile === id ? 'on' : ''}" data-p="${id}"><div class="ph"><b>${name}</b>${id === 'nova' ? '<span class="tag">Recommended</span>' : ''}</div><p>${tag}</p><ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul></button>`).join('')}</div>`, (root) => root.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { choice.profile = b.dataset.p; nova.cmd('applyProfile', { name: choice.profile }); root.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('on', x === b)); }))],
    layout: ['Where should your tabs live?', 'You can change this any time.', () => opt('layout', 'left', 'Sidebar left', 'Vertical tabs, the Nova way') + opt('layout', 'right', 'Sidebar right') + opt('layout', 'top', 'Tabs on top', 'The classic strip')],
    look: ['Pick a look', 'Every colour stays editable.', () => Object.keys(PRESETS).map((n) => opt('theme', n, n)).join('')],
    search: ['Choose your search', 'Used by the address bar and the home page.', () => Object.keys(ENGINES).map((n) => opt('engine', n, n)).join('')],
    budget: ['How light should Nova be?', 'Nova keeps its memory use under a limit you choose, by quietly sleeping tabs you are not using.', () => [[1024, 'Light', 'Up to 1 GB'], [2048, 'Balanced', 'Up to 2 GB'], [4096, 'Roomy', 'Up to 4 GB'], [0, 'No limit', 'Never sleep tabs for memory']].map(([v, t, sub]) => `<button class="opt ${(S.settings.budget.enabled ? S.settings.budget.ramMB : 0) === v ? 'on' : ''}" data-b="${v}">${t}<small>${sub}</small></button>`).join(''), (root) => root.querySelectorAll('[data-b]').forEach((b) => (b.onclick = () => { const v = +b.dataset.b; nova.cmd('settings', { patch: { budget: { ...S.settings.budget, enabled: v > 0, ramMB: v || S.settings.budget.ramMB } } }); root.querySelectorAll('[data-b]').forEach((x) => x.classList.toggle('on', x === b)); }))],
    bookmarks: ['Bring your bookmarks', 'Coming from Chrome, Edge or Brave? Copy your bookmarks over. Sign-ins and passwords are covered in Settings › Move in.', () => '<div id="wz-bm" style="grid-column:1/-1"></div>', async (root) => {
      const found = await nova.cmd('detectBrowsers'); const el = root.querySelector('#wz-bm');
      el.innerHTML = found.length ? `<div class="signins">${found.map((n) => `<button class="btn" data-bm="${esc(n)}">Import from ${esc(n)}</button>`).join('')}</div>` : '<p style="color:var(--dim)">No other browser found. Nothing to import.</p>';
      bindMoveIn(root, () => {});
    }],
    extras: ['Add only what you need', 'The ad blocker is built in. Install a password manager with one click, right here.', () => catalogHtml(CATALOG.slice(0, 3).map((c) => c.id)).replace('class="catalog"', 'class="catalog" style="grid-column:1/-1"'), (root) => bindInstall(root, draw)],
  };
  const order = () => (choice.profile === 'ultra' ? ['profile', 'layout', 'search'] : ['profile', 'layout', 'look', 'search', 'budget', 'bookmarks', 'extras']);
  function draw() {
    const keys = order(); if (i >= keys.length) i = keys.length - 1;
    const [h, sub, body, after] = defs[keys[i]];
    o.innerHTML = `<div class="box wizard"><div class="wl"><div><img src="mark.svg" alt=""></div><div><h1>Welcome<br>to Nova</h1><p>A browser with nothing extra, built around how you actually use tabs.</p></div><div class="dots">${keys.map((_, n) => `<i class="${n === i ? 'on' : ''}"></i>`).join('')}</div></div><div class="wr"><h2>${h}</h2><p class="sub">${sub}</p><div class="opts">${body()}</div><div class="wnav"><button class="btn" id="wb" ${i ? '' : 'style="visibility:hidden"'}>Back</button><button class="btn primary" id="wn">${i === keys.length - 1 ? 'Start browsing' : 'Continue'}</button></div></div></div>`;
    o.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { choice[b.dataset.g] = b.dataset.v; if (b.dataset.g === 'layout') nova.cmd('settings', { patch: { layout: b.dataset.v } }); if (b.dataset.g === 'theme') nova.cmd('settings', { patch: { theme: PRESETS[b.dataset.v] } }); o.querySelectorAll(`[data-g="${b.dataset.g}"]`).forEach((x) => x.classList.toggle('on', x === b)); }));
    if (after) after(o);
    $('#wb').onclick = () => { i--; draw(); };
    $('#wn').onclick = () => { if (keys[i] === 'search') nova.cmd('settings', { patch: { searchEngine: ENGINES[choice.engine] } }); if (i === keys.length - 1) nova.cmd('finishSetup'); else { i++; draw(); } };
  }
  draw();
}

// ---------- boot ----------
nova.onState((s) => { S = s; render(); if (overlay?.kind === 'overview' && overview.redraw) overview.redraw(); if (overlay?.kind === 'settings') updateBudgetLive(); });
nova.onOverlay((o) => { if (!o) return clearOverlay(); if (S) setOverlay(o.kind, o.data); });
nova.onToast(toast);
nova.state().then((s) => { S = s; render(); });

// ---------- window dragging (frameless window: done by hand so it works across monitors) ----------
const NODRAG = 'button,[data-tab],[data-do],#urlbar,input,textarea,select,.pin,.tab,.space,.item,.box,#menu,.card';
let dragging = false;
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || overlay || !e.target.closest('#chrome') || e.target.closest(NODRAG)) return;
  dragging = true; nova.cmd('dragStart');
});
const stopDrag = () => { if (dragging) { dragging = false; nova.cmd('dragEnd'); } };
addEventListener('pointerup', stopDrag); addEventListener('pointercancel', stopDrag); addEventListener('blur', stopDrag); addEventListener('mouseup', stopDrag);
document.addEventListener('dblclick', (e) => { if (!overlay && e.target.closest('#chrome') && !e.target.closest(NODRAG)) nova.cmd('win', { op: 'max' }); });
