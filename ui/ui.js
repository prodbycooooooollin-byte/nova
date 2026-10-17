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
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>', trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>', open: '<path d="M14 3h7v7M21 3l-9 9M10 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4"/>',
  split: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M12 3a14 14 0 0 0 0 18 14 14 0 0 0 0-18M3 12h18"/>',
};
const ic = (n) => ICONS[n] ? `<svg class="cb" viewBox="0 0 32 32">${ICONS[n]}</svg>` : `<svg viewBox="0 0 24 24">${PATHS[n] || ''}</svg>`;
// bundled brand icon; falls back to a neutral globe tile, never a placeholder letter
const brand = (file, cls = 'av') => `<img class="${cls} logo" src="icons/${file}.png" data-fb="${cls}" alt="">`;
document.addEventListener('error', (e) => { const el = e.target; if (el.tagName === 'IMG' && el.dataset.fb) { const s = document.createElement('span'); s.className = el.dataset.fb + ' gl'; s.innerHTML = ic('globe'); el.replaceWith(s); } }, true);
const ibtn = (n, title, id, cls = '') => `<button class="ibtn ${cls}" title="${esc(title)}" data-do="${id}">${ic(n)}</button>`;
const STAR = '<span class="star"><svg viewBox="0 0 24 24"><path d="M12 1c.7 6.6 4.4 10.3 11 11-6.6.7-10.3 4.4-11 11-.7-6.6-4.4-10.3-11-11C7.6 11.3 11.3 7.6 12 1z"/></svg></span>';

// the parts of the sidebar, in their default order: id, name, what it is, icon, and whether it can be hidden
const BLOCKS = [
  ['urlbar', 'Search bar', 'Where you type addresses and searches.', 'search2', false],
  ['bmbar', 'Bookmarks bar', 'Your bookmarks as small icons.', 'bookmark', true],
  ['pins', 'Pinned tabs', 'The tabs you pinned, as small tiles.', 'pin', true],
  ['tabhead', 'Tab heading', 'The “Tabs” label with the count and the new tab button.', 'layers', true],
  ['tabs', 'Tab list', 'All your open tabs.', 'grid', false],
  ['spaces', 'Spaces', 'The switcher between your spaces.', 'layout', true],
  ['tools', 'Dock', 'Extensions, downloads and the memory meter.', 'sliders', true],
];
const blockOrder = (s) => { const o = ((s.layoutBlocks || {}).order || []).filter((id, i, a) => BLOCKS.some((b) => b[0] === id) && a.indexOf(id) === i); for (const b of BLOCKS) if (!o.includes(b[0])) o.push(b[0]); return o; };
const PRESETS = {
  'Nova': { bg: '#0b0b12', page: '#161621', surface: '#13131c', surface2: '#1c1c28', text: '#ececf3', dim: '#8b8ba0', accent: '#8b7dff', danger: '#ff6b7a' },
  'Daylight': { bg: '#e9e8ee', page: '#ffffff', surface: '#f6f5f9', surface2: '#ffffff', text: '#1b1b22', dim: '#76758a', accent: '#5b4bf0', danger: '#ff6b7a' },
  'Nebula': { bg: '#100a1c', page: '#1b1230', surface: '#1a1229', surface2: '#251a39', text: '#f0e9fb', dim: '#9d8ebb', accent: '#c084fc', danger: '#ff6b7a' },
  'Supernova': { bg: '#130d0a', page: '#211812', surface: '#1d1511', surface2: '#2a1e18', text: '#f7ebe2', dim: '#a89283', accent: '#ff9a4d', danger: '#ff6b7a' },
  'Aurora': { bg: '#07100f', page: '#0f1d1b', surface: '#0e1a19', surface2: '#152624', text: '#e4f5f1', dim: '#7ea39b', accent: '#2dd4bf', danger: '#ff6b7a' },
  'Graphite': { bg: '#141414', page: '#202020', surface: '#1c1c1c', surface2: '#262626', text: '#eeeeee', dim: '#8e8e8e', accent: '#e5e5e5', danger: '#ff6b7a' },
  'Midnight': { bg: '#060a14', page: '#0e1626', surface: '#0b1220', surface2: '#16213a', text: '#e6edf9', dim: '#7d8cab', accent: '#4da3ff', danger: '#ff6b7a' },
  'Rosé': { bg: '#1a1015', page: '#28171f', surface: '#22141b', surface2: '#311d27', text: '#fbe9f0', dim: '#b08a99', accent: '#ff7aa8', danger: '#ff6b7a' },
  'Forest': { bg: '#0a120d', page: '#14221a', surface: '#101b14', surface2: '#1b2f23', text: '#e6f5ea', dim: '#7fa38b', accent: '#5ddc88', danger: '#ff6b7a' },
  'Ocean': { bg: '#05121a', page: '#0d2230', surface: '#0a1b26', surface2: '#12303f', text: '#e2f4fa', dim: '#77a3b3', accent: '#34d0e8', danger: '#ff6b7a' },
  'Sakura': { bg: '#f4e9ee', page: '#fff8fa', surface: '#fbeff3', surface2: '#ffffff', text: '#3a2530', dim: '#9a7a8a', accent: '#e0508a', danger: '#ff6b7a' },
  'Sand': { bg: '#ece6da', page: '#faf6ee', surface: '#f3eee3', surface2: '#ffffff', text: '#2d2820', dim: '#8a8072', accent: '#c2763a', danger: '#ff6b7a' },
  'Mono': { bg: '#000000', page: '#0a0a0a', surface: '#0a0a0a', surface2: '#161616', text: '#ffffff', dim: '#9a9a9a', accent: '#ffffff', danger: '#ff6b7a' },
  'Cyber': { bg: '#07070d', page: '#0f0f1c', surface: '#0c0c18', surface2: '#17172b', text: '#e9fff7', dim: '#7fb3a2', accent: '#00f0a8', danger: '#ff6b7a' },
  'Tokyo Night': { bg: '#16161e', page: '#1a1b26', surface: '#16161e', surface2: '#24283b', text: '#c0caf5', dim: '#7982a9', accent: '#7aa2f7', danger: '#ff6b7a' },
  'Dracula': { bg: '#1e1f29', page: '#282a36', surface: '#232532', surface2: '#343746', text: '#f8f8f2', dim: '#8a93b6', accent: '#bd93f9', danger: '#ff6b7a' },
  'Nord': { bg: '#242933', page: '#2e3440', surface: '#2b303b', surface2: '#3b4252', text: '#eceff4', dim: '#9aa5ba', accent: '#88c0d0', danger: '#ff6b7a' },
  'Catppuccin': { bg: '#181825', page: '#1e1e2e', surface: '#181825', surface2: '#313244', text: '#cdd6f4', dim: '#9399b2', accent: '#cba6f7', danger: '#ff6b7a' },
  'Gruvbox': { bg: '#1d2021', page: '#282828', surface: '#232323', surface2: '#3c3836', text: '#ebdbb2', dim: '#a89984', accent: '#fabd2f', danger: '#ff6b7a' },
};
const WALL_OF = {'Nova': 'orbit', 'Daylight': 'orbit', 'Nebula': 'orbit', 'Supernova': 'orbit', 'Aurora': 'orbit', 'Graphite': 'stars', 'Midnight': 'orbit', 'Rosé': 'orbit', 'Forest': 'orbit', 'Ocean': 'orbit', 'Sakura': 'orbit', 'Sand': 'orbit', 'Mono': 'stars', 'Cyber': 'grid', 'Tokyo Night': 'orbit', 'Dracula': 'orbit', 'Nord': 'stars', 'Catppuccin': 'orbit', 'Gruvbox': 'orbit'};
const WIZARD_THEMES = ['Nova', 'Daylight', 'Nebula', 'Aurora', 'Midnight', 'Rosé', 'Forest', 'Tokyo Night', 'Graphite'];
const WALLS = [['theme', 'Follow theme'], ['none', 'Plain'], ['orbit', 'Orbit'], ['stars', 'Stars'], ['grid', 'Grid']];
const ACTIONS = {
  newTab: 'New tab', newWindow: 'New window', go: 'Address and search bar', closeTab: 'Close tab', reopenTab: 'Reopen closed tab', nextTab: 'Next tab', prevTab: 'Previous tab',
  overview: 'Tab overview', reload: 'Reload', back: 'Back', forward: 'Forward', toggleSidebar: 'Toggle sidebar', focusMode: 'Focus mode',
  find: 'Find in page', settings: 'Settings', zoomIn: 'Zoom in', zoomOut: 'Zoom out', zoomReset: 'Reset zoom', devtools: 'Developer tools', pinTab: 'Pin or unpin tab',
  hub: 'Extension hub', history: 'History', downloads: 'Downloads', bookmarks: 'Bookmarks', cleanUp: 'Clean up tabs', screenshot: 'Take screenshot', privateTab: 'New private tab', space1: 'Space 1', space2: 'Space 2', space3: 'Space 3', space4: 'Space 4', space5: 'Space 5',
  hardReload: 'Reload, ignoring the cache', viewSource: 'View page source', savePage: 'Save page as…', clearData: 'Clear browsing data', findNext: 'Find next', findPrev: 'Find previous', homePage: 'Go to the start page', bookmarksBarToggle: 'Show or hide the bookmarks bar', closeWindow: 'Close window', moveTabLeft: 'Move tab left', moveTabRight: 'Move tab right',
  tab1: 'Go to tab 1', tab2: 'Go to tab 2', tab3: 'Go to tab 3', tab4: 'Go to tab 4', tab5: 'Go to tab 5', tab6: 'Go to tab 6', tab7: 'Go to tab 7', tab8: 'Go to tab 8', tabLast: 'Go to the last tab',
};
const FEATURES = [
  ['tabSearch', 'Search inside open tabs', 'Start a Ctrl+K query with ? to find text on any open page.'],
  ['snooze', 'Snooze tabs', 'Send a tab away and have it come back later.'],
  ['rewind', 'Session rewind', 'Saves your tab set every few minutes so you can bring tabs back.'],
  ['soloAudio', 'One sound at a time', 'Pause other playing tabs when one starts playing.'],
  ['peek', 'Peek at links', 'Right-click a link to preview it in a floating card.'],
  ['darkPage', 'Dark mode for pages', 'Invert any page to a dark version.'],
  ['darkSite', 'Smart dark mode', "Dark Reader's engine, built in. Remembered per site."],
  ['cleanLinks', 'Copy clean links', 'Strip tracking parameters when copying a link.'],
  ['screenshot', 'Screenshots', 'Capture the page to Pictures and the clipboard (Ctrl+Shift+S).'],
  ['pip', 'Picture in picture', 'Pop the biggest video on a page into a floating window.'],
  ['autoPip', 'Float video when you switch tabs', 'A video that is playing pops out into a small window when you leave its tab, and goes back when you return.'],
  ['videoSpeed', 'Video speed keys', 'S slower, D faster, R back to normal, Z and X jump ten seconds. Works on any video.'],
  ['sponsorBlock', 'Skip YouTube sponsors', 'Jumps over sponsor, self-promotion and reminder segments reported by viewers (SponsorBlock). Sends only a short code of the video, never the video itself.'],
  ['ytDislike', 'Show YouTube dislikes', 'Brings the dislike count back next to the button (Return YouTube Dislike).'],
  ['cookieBanners', 'Hide cookie banners', 'Hides the consent boxes of the common cookie tools and lifts the scroll lock they leave behind. It never clicks accept for you.'],
  ['savePdf', 'Save page as PDF', 'Export the current page to your Downloads folder.'],
  ['translate', 'Translate page', 'Open the current page through Google Translate.'],
  ['privateTabs', 'Private tabs', 'Tabs that keep no history, cookies or cache (Ctrl+Shift+N).'],
  ['passwords', 'Password saver', 'Offers to keep a login after you sign in and fills it only when you pick it, on the exact same site. Encrypted with your Windows account. Skip it if you use a password manager extension.'],
];
const FEATURE_GROUPS = [['Tab tools', ['tabSearch', 'snooze', 'rewind', 'soloAudio']], ['Page tools', ['peek', 'darkPage', 'cleanLinks', 'screenshot', 'pip', 'autoPip', 'savePdf', 'translate']], ['Privacy', ['privateTabs']]];
// the jobs people usually install an extension for, built into Nova: key, the extension it replaces
const BUILT_IN = [['darkSite', 'Dark Reader'], ['videoSpeed', 'Video Speed Controller'], ['sponsorBlock', 'SponsorBlock'], ['ytDislike', 'Return YouTube Dislike'], ['cookieBanners', 'I don’t care about cookies'], ['passwords', 'a basic password manager']];
const ENGINES = { DuckDuckGo: 'https://duckduckgo.com/?q=%s', Google: 'https://www.google.com/search?q=%s', Brave: 'https://search.brave.com/search?q=%s', Startpage: 'https://www.startpage.com/do/search?q=%s', Ecosia: 'https://www.ecosia.org/search?q=%s', Bing: 'https://www.bing.com/search?q=%s' };

let S = null, overlay = null, customJsApplied = null;

// ---------- the chrome as rows (tabs on top) or as one column (sidebar) ----------
// Tabs on top: row one holds the tabs and the window buttons, row two the address bar exactly in the middle with back/forward and the bookmark star
// on its left and the buttons on its right, row three the bookmarks. The same elements serve the sidebar layouts, so they move when the layout changes.
function arrangeChrome(top) {
  const c = document.getElementById('chrome'); if (!c || c.dataset.top === (top ? '1' : '0')) return;
  c.dataset.top = top ? '1' : '0';
  const g = (id) => document.getElementById(id), mk = (id) => g(id) || Object.assign(document.createElement('div'), { id });
  if (top) {
    const rt = mk('rowtabs'), rb = mk('rowbar'), rm = mk('rowbm'), bl = mk('barl'), br = mk('barr'), ub = mk('urlbox');
    rt.append(g('pins'), g('tabs'), g('winctl')); c.append(g('spaces')); // the tab row belongs to the tabs; the spaces are in the profile menu (the list itself is hidden here)
    bl.append(g('nav')); ub.append(g('urlbar'), g('bmstar')); br.append(g('stats'), g('tools'));
    rb.append(bl, ub, br); rm.append(g('bmbar'));
    c.append(rt, rb, rm);
  } else {
    const head = g('head'); head.append(g('nav'), g('winctl'));
    c.append(head, g('urlbar'), g('bmstar'), g('bmbar'), g('pins'), g('tabhead'), g('tabs'), g('spaces'), g('dltray'), g('stats'), g('tools'));
    for (const id of ['rowtabs', 'rowbar', 'rowbm', 'barl', 'barr', 'urlbox', 'lead']) { const e = g(id); if (e) e.remove(); }
  }
}

// ---------- settings -> DOM ----------
function applySettings() {
  const s = S.settings, r = document.documentElement.style;
  for (const [k, v] of Object.entries(s.theme)) r.setProperty('--' + k, v);
  { const h = s.theme.accent.replace('#', ''), v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h; const L = (0.299 * parseInt(v.slice(0, 2), 16) + 0.587 * parseInt(v.slice(2, 4), 16) + 0.114 * parseInt(v.slice(4, 6), 16)) / 255; r.setProperty('--on-accent', L > 0.62 ? '#111118' : '#ffffff'); }
  { const h = (s.theme.bg || '#000000').replace('#', ''), v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h; const L = (0.299 * parseInt(v.slice(0, 2), 16) + 0.587 * parseInt(v.slice(2, 4), 16) + 0.114 * parseInt(v.slice(4, 6), 16)) / 255; r.setProperty('color-scheme', L < 0.5 ? 'dark' : 'light'); } // form controls and scrollbars follow the theme, not Windows
  r.setProperty('--tab-h', { compact: '32px', comfortable: '38px', spacious: '45px' }[s.density] || '38px');
  r.setProperty('--radius', s.radius + 'px'); r.setProperty('--gap', s.gap + 'px'); r.setProperty('--side', (s.compact ? 56 : s.sidebarWidth) + 'px');
  r.setProperty('--fs', s.fontSize + 'px'); r.setProperty('--font', `${s.font || "'Inter'"}, 'Inter', system-ui, sans-serif`);
  { const ord = blockOrder(s); BLOCKS.forEach((b) => r.setProperty('--o-' + b[0], ord.indexOf(b[0]) + 1)); }
  arrangeChrome(s.layout === 'top');
  const lightBg = (() => { const h = (s.theme.bg || '#000000').replace('#', ''), v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h; return (0.299 * parseInt(v.slice(0, 2), 16) + 0.587 * parseInt(v.slice(2, 4), 16) + 0.114 * parseInt(v.slice(4, 6), 16)) / 255 >= 0.5; })();
  $('#app').className = `layout-${s.layout}` + (S.spaces && S.spaces.length < 2 ? ' one-space' : '') + ((s.layoutBlocks || {}).hidden || []).map((h) => ' hide-' + h).join('') + (s.compact ? ' compact' : '') + (S.bar && S.bar.length ? ' has-bar' : '') + (S.hidden ? ' hidden' : '') + (overlay ? ' ov' : '') + (s.effects ? '' : ' noeffects') + (s.bookmarkNames === false ? ' bm-icons' : '') + (lightBg ? ' light' : '');
  $('#user-css').textContent = s.customCss || '';
  dockOverlay();
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

const fmtBytes = (n) => (n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(n >= 1.0e8 ? 0 : 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const fmtEta = (s) => (s >= 3600 ? Math.floor(s / 3600) + ' h ' + Math.round((s % 3600) / 60) + ' min' : s >= 60 ? Math.round(s / 60) + ' min' : s + ' s');
const extMenuButton = (top) => `<button class="ibtn extbtn" data-do="extmenu" title="Extensions">${ic(top ? 't-puzzle' : 'box')}</button>`;
// the profiles (settings.profiles; an older state has none, then there is just one) and the colour of text that reads on a profile's colour
const profileList = () => { const l = (S && S.settings && S.settings.profiles) || []; return l.length ? l : [{ id: 'main', name: 'Personal', color: '#8b7dff' }]; };
const inkOn = (hex) => { const h = String(hex || '').replace('#', ''); if (!/^[0-9a-f]{6}$/i.test(h)) return '#ffffff'; return (0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16)) / 255 > 0.62 ? '#111118' : '#ffffff'; };
// with one profile the plain person icon; with several, a disc in the colour of the profile you are in, with its initial
const profileButton = () => { const l = profileList(), cur = l.find((x) => x.id === S.profile) || l[0]; return l.length > 1 ? `<button class="ibtn profbtn" data-do="profilemenu" title="Profile: ${esc(cur.name)}"><span class="pfdot" style="background:${esc(cur.color)};color:${inkOn(cur.color)}">${esc((cur.name[0] || '?').toUpperCase())}</span></button>` : `<button class="ibtn profbtn" data-do="profilemenu" title="Profile and privacy">${ic('t-user')}</button>`; };
const menuButton = () => `<button class="ibtn menubtn" data-do="mainmenu" title="Menu">${ic('t-menu')}</button>`;
const spaceButton = () => { const sp = (S.spaces || []).find((x) => x.id === S.activeSpace); return S.spaces && S.spaces.length > 1 && sp ? `<button class="spacebtn" data-do="spacemenu" title="Spaces: ${esc(sp.name)}"><i style="background:${sp.color}"></i><span>${esc(sp.name)}</span></button>` : ''; };
const hubButton = () => `<button class="ibtn hubbtn" data-do="hub" title="Extension hub: add extensions in one click">${ic('box')}</button>`;
// the download button: the folder fills from the bottom while files come down, and a dot marks a download that finished a moment ago
const FOLDER = 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z';
function dlButton(top) {
  const jobs = (S && S.dl) || [], info = (S && S.dlInfo) || {};
  if (!top && !jobs.length && !info.seen) return ''; // the tabs-on-top bar always has its folder
  const run = jobs.filter((j) => j.state === 'downloading' || j.state === 'queued'), size = jobs.reduce((n, j) => n + j.size, 0), got = jobs.reduce((n, j) => n + j.received, 0), speed = run.reduce((n, j) => n + j.speed, 0);
  const pct = size ? Math.min(1, got / size) : 0, busy = jobs.length > 0, fresh = !busy && Date.now() - (info.doneAt || 0) < 60000;
  const title = busy ? `${jobs.length} download${jobs.length > 1 ? 's' : ''}${speed ? ' · ' + fmtBytes(speed) + '/s' : ''}: click for details` : 'Downloads';
  const fill = busy ? Math.max(0.1, pct) : 0;
  return `<button class="ibtn dlbtn ${busy ? 'busy' : ''} ${fresh ? 'fresh' : ''} ${size ? '' : 'ind'}" data-do="downloads" title="${title}"><svg class="dlf" viewBox="0 0 24 24"><defs><clipPath id="dlclip"><rect x="0" y="${(24 - 24 * fill).toFixed(2)}" width="24" height="24"/></clipPath></defs><path class="dlfill" d="${FOLDER}" clip-path="url(#dlclip)"/><path class="dlline" d="${FOLDER}"/><path class="dlarr" d="M12 9.5v6M9.2 12.8l2.8 2.8 2.8-2.8"/></svg></button>`;
}
function render() {
  if (!S) return;
  if (typeof dragTab !== 'undefined' && dragTab !== null) { if (Date.now() - dragSince < 5000) { deferredRender = true; return; } dragTab = null; dropInfo = null; } // a drag that never ended must not freeze the tab list
  applySettings();
  const cur = S.tabs.find((t) => t.id === S.activeTab), top = S.settings.layout === 'top';
  $('#nav').innerHTML = (top ? '' : `<img id="mark" src="mark.svg" alt="">`) + ibtn(top ? 't-back' : 'back', 'Back (Alt+←)', 'back', cur?.canBack ? '' : 'off') + ibtn(top ? 't-fwd' : 'fwd', 'Forward (Alt+→)', 'forward', cur?.canForward ? '' : 'off') + ibtn(top ? 't-reload' : 'reload', 'Reload (Ctrl+R)', 'reload') + (top ? '' : dlButton());
  $('#winctl').innerHTML = ibtn('min', 'Minimize', 'min') + ibtn('max', 'Maximize', 'max') + ibtn('x', 'Close', 'wclose', 'close');
  let label = '<span>Search or enter address</span>', icon = 'search';
  if (cur && cur.url !== HOME) {
    try { const u = new URL(cur.url); icon = u.protocol === 'https:' ? 'lock' : 'globe'; label = `<b>${esc(u.hostname.replace(/^www\./, ''))}</b><span>${esc((u.pathname + u.search).replace(/^\/$/, '').slice(0, 60))}</span>`; } catch { label = `<b>${esc(cur.url)}</b>`; }
  }
  $('#urlbar').innerHTML = `${ic(top ? { lock: 't-shield', globe: 't-globe', search: 't-search' }[icon] : icon)}<span id="url-text">${label}</span>${top ? '' : cur?.bookmarked ? ic('starf').replace('<svg', '<svg style="color:var(--accent)"') : '<kbd>Ctrl K</kbd>'}`;
  { const star = document.getElementById('bmstar'), page = !!(cur && /^https?:/i.test(cur.url || '')); star.innerHTML = ic(top ? 't-star' : cur?.bookmarked ? 'starf' : 'star'); star.classList.toggle('on', !!cur?.bookmarked); star.classList.toggle('off', !page); star.title = cur?.bookmarked ? 'Edit this bookmark (Ctrl+D)' : 'Bookmark this page (Ctrl+D)'; }

  $('#bmbar').innerHTML = (S.bar || []).length ? S.bar.map((b) => `<button class="bmk" data-bm="${esc(b.url)}" title="${esc(b.title || b.url)}">${b.icon ? `<img src="${b.icon}" alt="">` : ic('globe')}<span>${esc(b.title || hostOf(b.url))}</span></button>`).join('') + `<button class="bmk more" data-do="bookmarks" title="All bookmarks (Ctrl+Shift+O)">${ic('fwd')}</button>` : '';
  const tabs = spaceTabs(), maxAge = (S.settings.archiveAfterHours || 24) * 3600e3;
  $('#pins').innerHTML = tabs.filter((t) => t.pinned).map((t) => `<div class="pin ${t.id === S.activeTab ? 'active' : ''}" data-tab="${t.id}" title="${esc(t.title)}">${favHtml(t)}<button class="pinx" data-close="${t.id}" title="Close tab">${ic('x')}</button></div>`).join('');
  const plain = tabs.filter((t) => !t.pinned), total = S.tabs.length, max = S.settings.maxTabs;
  $('#tabhead').innerHTML = `<span class="lbl">Tabs</span><span class="count ${max && total >= max - 3 ? 'hot' : ''}" title="Open tabs / tab budget">${total}${max ? ' / ' + max : ''}</span><button class="ibtn sm" data-do="newTab" title="New tab (Ctrl+T)">${ic('plus')}</button>`;
  $('#tabs').innerHTML = plain.map((t) => {
    const idle = t.id === S.activeTab ? 0 : Math.min(1, (S.now - t.lastActive) / maxAge);
    return `<div draggable="true" class="tab ${t.id === S.activeTab ? 'active' : ''} ${t.asleep ? 'asleep' : ''} ${t.id === S.split ? 'split' : ''} ${t.private ? 'private' : ''}" data-tab="${t.id}" style="--idle:${(1 - idle * 0.45).toFixed(2)}" title="${esc(t.title)}${t.url === HOME ? '' : '\n' + esc(t.url)}">
      ${favHtml(t)}<span class="t">${esc(t.title || 'New tab')}</span>${t.asleep ? `<span class="zz" title="Asleep: reloads when opened">${ic('moon')}</span>` : ''}${t.audible || t.muted ? `<button class="aud" data-mute="${t.id}" title="${t.muted ? 'Unmute' : 'Mute'}">${ic(t.muted ? 'mute' : 'vol')}</button>` : ''}<button class="x" data-close="${t.id}" title="Close tab">${ic('x')}</button></div>`;
  }).join('') + `<button class="newrow" data-do="newTab" title="New tab (Ctrl+T)">${ic('plus')}<span>New tab</span></button>`;
  $('#spaces').innerHTML = S.spaces.map((sp, i) => `<button class="space ${sp.id === S.activeSpace ? 'active' : ''}" data-space="${sp.id}" title="${esc(sp.name)} (Alt+${i + 1})"><i style="background:${sp.color}"></i><span>${esc(sp.name)}</span></button>`).join('') + `<button class="space add" data-do="addSpace" title="New space">${ic('plus')}</button>`;
  const bud = S.budget, pct = bud.enabled && bud.cap ? Math.min(100, Math.round(bud.used / bud.cap * 100)) : 0;
  dlTrayDraw();
  const chips = (S.updateReady ? `<button class="upd" data-do="update" title="Restart to install the update">Update</button>` : '') + (S.settings.adblock ? (() => { const st = (S.adblock || {}).state; return `<span class="chip ${st === 'failed' ? 'warn' : ''}" title="${st === 'failed' ? 'The ad blocker is not loaded. Open Settings > Search & privacy to retry.' : st === 'loading' ? 'The ad blocker is loading its filter lists' : 'Ads and trackers blocked'}">${ic('shield')}<b>${st === 'failed' ? '!' : st === 'loading' ? '…' : S.blockedCount}</b></span>`; })() : '') + (bud.enabled ? `<button class="ram ${bud.over || pct >= 90 ? 'hot' : ''}" data-do="budget" title="Memory used by Nova of your ${bud.cap} MB budget"><span class="lab">RAM</span><b>${bud.used}</b><small>MB</small><i style="width:${pct}%"></i></button>` : '');
  // the tab budget shows only when it matters (the last fifth of it), as a quiet number next to the other small figures
  const tcount = S.settings.maxTabs && S.tabs.length >= S.settings.maxTabs * 0.8 ? `<span class="tcount ${S.tabs.length >= S.settings.maxTabs - 3 ? 'hot' : ''}" title="Open tabs / tab budget">${S.tabs.length} / ${S.settings.maxTabs}</span>` : '';
  $('#stats').innerHTML = tcount + chips;
  $('#tools').innerHTML = top ? ibtn('t-grid', 'Tab overview (Ctrl+E)', 'overview') + extMenuButton(true) + dlButton(true) + profileButton() + menuButton()
    : extMenuButton() + `<span class="grow"></span>` + ibtn('bookmark', 'Library: bookmarks, history, downloads (Ctrl+H)', 'library') + ibtn('grid', 'Tab overview (Ctrl+E)', 'overview') + ibtn('sliders', 'Settings (Ctrl+,)', 'settings');
}
setInterval(() => { if (S && !document.hidden) { S.now = Date.now(); render(); } }, 60000); // only the dimming of idle tabs changes with time

document.addEventListener('click', (e) => {
  if (menuOpen && e.target.closest('#menu')) return;
  hideMenu();
  const d = e.target.closest('[data-do]')?.dataset.do;
  if (d) {
    const A = (name) => () => nova.cmd('action', { name });
    const m = { back: () => nova.cmd('back'), forward: () => nova.cmd('forward'), reload: () => nova.cmd('reload'), min: () => nova.cmd('win', { op: 'min' }), max: () => nova.cmd('win', { op: 'max' }), wclose: () => nova.cmd('win', { op: 'close' }), overview: A('overview'), library: A('history'), bookmarks: A('bookmarks'), downloads: () => dlToggle(), hub: A('hub'), bookmark: A('bookmark'), extmenu: () => nova.cmd('overlay', { kind: 'extmenu' }), spacemenu: () => nova.cmd('overlay', { kind: 'spacemenu' }), profilemenu: () => nova.cmd('overlay', { kind: 'profilemenu' }), mainmenu: () => nova.cmd('overlay', { kind: 'mainmenu' }), settings: A('settings'), budget: () => nova.cmd('overlay', { kind: 'settings', data: { tab: 'Resource budget' } }), newTab: A('newTab'), update: () => nova.cmd('applyUpdate'), addSpace: newSpaceFlow };
    return m[d]?.();
  }
  if (e.target.closest('#urlbar')) return nova.cmd('action', { name: 'go' });
  const bm = e.target.closest('[data-bm]'); if (bm) return nova.cmd('open', { text: bm.dataset.bm, newTab: e.ctrlKey || e.metaKey });
  const xp = e.target.closest('[data-extpop]'); if (xp) return nova.cmd('extPopup', { id: xp.dataset.extpop });
  const mu = e.target.closest('[data-mute]'); if (mu) return nova.cmd('mute', { id: +mu.dataset.mute });
  const c = e.target.closest('[data-close]'); if (c) return nova.cmd('close', { id: +c.dataset.close });
  const t = e.target.closest('[data-tab]'); if (t && !overlay) return nova.cmd('activate', { id: +t.dataset.tab });
  const sp = e.target.closest('[data-space]'); if (sp) return nova.cmd('switchSpace', { id: +sp.dataset.space });
});
document.addEventListener('auxclick', (e) => { const b = e.target.closest('[data-bm]'); if (b && e.button === 1) return nova.cmd('open', { text: b.dataset.bm, newTab: true }); const t = e.target.closest('[data-tab]'); if (t && e.button === 1) nova.cmd('close', { id: +t.dataset.tab }); });
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const t = e.target.closest('[data-tab]'), sp = e.target.closest('[data-space]'), bmk = e.target.closest('[data-bm]');
  const names = { label: S.settings.bookmarkNames === false ? 'Show bookmark names' : 'Icons only, hide names', run: () => nova.cmd('settings', { patch: { bookmarkNames: S.settings.bookmarkNames === false } }) };
  const barOpts = S.settings.layout === 'top' ? ['-', names] : []; // in the side layouts the bar is icons only anyway
  if (bmk) { const url = bmk.dataset.bm; return showMenu(e, [{ label: 'Open', run: () => nova.cmd('open', { text: url }) }, { label: 'Open in new tab', run: () => nova.cmd('open', { text: url, newTab: true }) }, '-', { label: 'Remove bookmark', run: () => nova.cmd('removeBookmark', { url }) }, ...barOpts]); }
  if (e.target.closest('#bmbar')) return showMenu(e, [{ label: 'Hide bookmarks bar', run: () => nova.cmd('settings', { patch: { bookmarksBar: false } }) }, ...barOpts]);
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
    ...(S.tabs.length > 1 ? [{ label: 'Move to new window', run: () => nova.cmd('detachTab', { id, force: true }) }] : []),
    ...((S.windows || []).length ? ['-', { label: 'Move to window' }, ...S.windows.map((w) => ({ label: (w.title || 'Nova window').slice(0, 30), run: () => nova.cmd('moveToWindow', { id, wid: w.id }) }))] : []),
    ...(others.length ? ['-', { label: 'Move to space' }, ...others.map((s) => ({ label: s.name, run: () => nova.cmd('moveToSpace', { id, spaceId: s.id }) }))] : []),
    '-', { label: 'Archive to Stardust', run: () => nova.cmd('archive', { id }) }, { label: 'Close tab', run: () => nova.cmd('close', { id }) },
  ];
}
function spaceMenu(id) {
  const sp = S.spaces.find((s) => s.id === id);
  return [
    { label: 'Rename or recolour', run: async () => { const r = await askDialog({ title: 'Edit space', input: true, value: sp.name, ok: 'Save', colors: SPACE_COLORS, color: sp.color }); if (r) nova.cmd('renameSpace', { id, name: r.value, color: r.color }); } },
    { label: 'Delete space and its tabs', run: async () => { if (S.spaces.length < 2) return toast('You need at least one space.'); const r = await askDialog({ title: 'Delete this space?', text: `“${sp.name}” and all of its tabs will be closed.`, ok: 'Delete', danger: true }); if (r) nova.cmd('deleteSpace', { id }); } },
  ];
}
// Electron has no window.prompt(), so Nova ships its own small dialog (also used for confirmations).
let askResolve = null, askShown = false; // askShown: the dialog is on screen. A close event that was already on its way (from the menu you just clicked) must not cancel a dialog that has not appeared yet
const SPACE_COLORS = ['#8b7dff', '#ff7a90', '#ffb04d', '#4ddc9a', '#4db8ff', '#c084fc', '#ff6b6b', '#2dd4bf'];
function askDialog(o) { return new Promise((res) => { askResolve = res; askShown = false; nova.cmd('overlay', { kind: 'ask', data: o }); }); }
function ask(el, d) {
  askShown = true;
  let color = d.color || (d.colors ? d.colors[0] : null);
  el.innerHTML = `<div class="box ask"><h3>${esc(d.title)}</h3>${d.text ? `<p>${esc(d.text)}</p>` : ''}${d.input ? `<input id="ask-in" value="${esc(d.value || '')}" placeholder="${esc(d.placeholder || '')}" autocomplete="off" spellcheck="false">` : ''}${d.colors ? `<div class="cdots">${d.colors.map((c) => `<button class="cdot ${c === color ? 'on' : ''}" data-c="${c}" style="--c:${c}" title="${c}"></button>`).join('')}</div>` : ''}<div class="askbtns"><button class="btn ghost" id="ask-no">Cancel</button><button class="btn ${d.danger ? 'danger' : 'primary'}" id="ask-ok">${esc(d.ok || 'OK')}</button></div></div>`;
  const input = $('#ask-in');
  const finish = (v) => { const r = askResolve; askResolve = null; askShown = false; nova.cmd('closeOverlay'); if (r) r(v); };
  el.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { color = b.dataset.c; el.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); }));
  const ok = () => { if (input && !input.value.trim()) { input.focus(); return; } finish({ value: input ? input.value.trim() : true, color }); };
  $('#ask-ok').onclick = ok; $('#ask-no').onclick = () => finish(null);
  if (input) { input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); }); input.focus(); input.select(); } else $('#ask-ok').focus();
}
async function newSpaceFlow() { const r = await askDialog({ title: 'New space', text: 'Spaces keep different parts of your life apart: work, school, projects.', input: true, placeholder: 'Name, for example Work', ok: 'Create', colors: SPACE_COLORS }); if (r) nova.cmd('addSpace', { name: r.value, color: r.color }); }
async function newProfileFlow() { const r = await askDialog({ title: 'New profile', text: 'A profile has its own logins, cookies, history, bookmarks and saved passwords. Use one for work and one for private browsing.', input: true, placeholder: 'Name, for example Work', ok: 'Create', colors: SPACE_COLORS }); if (r) nova.cmd('addProfile', { name: r.value, color: r.color }); }
async function deleteProfileFlow(p) { const r = await askDialog({ title: 'Delete this profile?', text: `“${p.name}” and everything in it will be removed from this PC: its tabs, logins, cookies, history, bookmarks and saved passwords. This cannot be undone.`, ok: 'Delete', danger: true }); if (r) nova.cmd('deleteProfile', { id: p.id }); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 4500); }

// ---------- overlay plumbing ----------
function setOverlay(kind, data) {
  overlay = { kind, data };
  $('#app').classList.add('ov');
  if (kind === 'menu') return;
  const o = $('#overlay'); o.hidden = false; o.innerHTML = '';
  o.onmousedown = (e) => { if (e.target === o && kind !== 'wizard') nova.cmd('closeOverlay'); };
  o.className = kind === 'settings' || kind === 'hub' ? 'docked' : kind === 'downloads' || kind === 'extmenu' || kind === 'bookmark' || kind === 'spacemenu' || kind === 'profilemenu' || kind === 'mainmenu' ? 'pop' : kind === 'whatsnew' ? 'cine' : ''; dockOverlay();
  ({ palette, overview, settings, wizard, peek, ask, library, hub: extHub, downloads: dlPanel, whatsnew: whatsNew, extmenu: extMenu, bookmark: bookmarkPop, spacemenu: spacePop, profilemenu: profilePop, mainmenu: mainMenu })[kind](o, data || {});
}
function clearOverlay() { if (askResolve && askShown) { const r = askResolve; askResolve = null; askShown = false; r(null); } overlay = null; $('#app').classList.remove('ov'); $('#menu').hidden = true; menuOpen = false; const o = $('#overlay'); o.hidden = true; o.innerHTML = ''; o.className = ''; }
// Settings and the hub sit beside the browser, not over it: the sidebar (or the top bar) stays sharp and live while you change things
function dockOverlay() {
  const o = $('#overlay'); if (!o || !o.classList.contains('docked')) return;
  const c = $('#chrome').getBoundingClientRect(), lay = (S && S.settings && S.settings.layout) || 'left';
  let l = 0, r = 0, t = 0;
  if (c.width > 0 && c.height > 0) { if (lay === 'top') t = Math.round(c.bottom); else if (lay === 'right') r = Math.round(innerWidth - c.left); else l = Math.round(c.right); }
  o.style.setProperty('--dl', l + 'px'); o.style.setProperty('--dr', r + 'px'); o.style.setProperty('--dt', t + 'px');
}
addEventListener('resize', dockOverlay);
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
    { t: 'History', s: 'Pages you visited', k: 'Ctrl H', run: A('history') }, { t: 'Downloads', k: 'Ctrl J', run: A('downloads') }, { t: 'Bookmarks', k: 'Ctrl ⇧ O', run: A('bookmarks') },
    { t: 'Clear browsing data', s: 'History, cookies, cache', run: () => nova.cmd('overlay', { kind: 'library', data: { tab: 'Clear data' } }) },
    { t: cur?.bookmarked ? 'Remove bookmark' : 'Bookmark this page', k: 'Ctrl D', run: A('bookmark') },
    ...(F.tabSearch ? [{ t: 'Search inside all open tabs', s: 'Or start your query with ?', run: () => nova.cmd('overlay', { kind: 'palette', data: { mode: 'go', text: '? ' } }) }] : []),
    ...(F.snooze ? [snz('in 1 hour', Date.now() + 3600e3), ...(hr < 17 ? [snz('this evening', at(18))] : []), snz('tomorrow morning', at(9, 0, 1)), snz('next Monday', nextMonday())] : []),
    ...(F.rewind ? [{ t: 'Rewind: bring back tabs from earlier', s: 'Sessions are saved every few minutes', run: () => nova.cmd('overlay', { kind: 'palette', data: { mode: 'go', text: 'rewind ' } }) }] : []),
    ...(F.darkPage ? [{ t: cur?.dark ? 'Turn off dark mode for this page' : 'Dark mode for this page', k: 'Ctrl ⇧ D', run: A('darkPage') }] : []),
    ...(F.darkSite && cur?.darkKey ? [{ t: cur.darkSite ? `Turn off dark mode for ${cur.darkKey}` : `Dark mode for ${cur.darkKey}`, s: 'Smart dark, remembered for this site', run: A('darkSite') }] : []),
    ...(F.screenshot ? [{ t: 'Take screenshot', k: 'Ctrl ⇧ S', run: A('screenshot') }] : []),
    ...(F.pip ? [{ t: 'Picture in picture', s: 'Pop the biggest video into a floating window', run: () => { nova.cmd('closeOverlay'); nova.cmd('pip'); } }] : []),
    ...(F.savePdf ? [{ t: 'Save page as PDF', run: () => { nova.cmd('closeOverlay'); nova.cmd('savePdf'); } }] : []),
    ...(F.translate ? [{ t: 'Translate this page', run: () => { nova.cmd('closeOverlay'); nova.cmd('translate'); } }] : []),
    ...(F.passwords ? [{ t: 'Saved passwords', s: 'Manage, import or export what Nova has saved', run: () => nova.cmd('overlay', { kind: 'settings', data: { tab: 'Passwords' } }) }] : []),
    ...(F.privateTabs ? [{ t: 'New private tab', s: 'Keeps no history, cookies or cache', k: 'Ctrl ⇧ N', run: A('privateTab') }] : []),
    ...(F.cleanLinks ? [{ t: 'Copy link without tracking junk', k: 'Ctrl ⇧ C', run: A('copyClean') }] : []),
    { t: 'Resource budget', s: 'Set how much memory Nova may use', run: () => nova.cmd('overlay', { kind: 'settings', data: { tab: 'Resource budget' } }) },
    { t: 'Clean up: archive tabs idle for 1 hour', run: clean('hour') }, { t: 'Clean up: archive all unpinned tabs', run: clean('all') }, { t: 'Clean up: close duplicate tabs', run: clean('duplicates') },
    { t: cur?.pinned ? 'Unpin tab' : 'Pin tab', k: 'Ctrl ⇧ P', run: A('pinTab') },
    { t: 'Find in page', k: 'Ctrl F', run: () => nova.cmd('overlay', { kind: 'palette', data: { mode: 'find', text: '' } }) },
    { t: 'Print', k: 'Ctrl P', run: A('print') }, { t: 'Full screen', k: 'F11', run: A('fullscreen') },
    { t: 'New window', k: 'Ctrl N', run: A('newWindow') }, { t: 'New space', run: () => setTimeout(newSpaceFlow, 80) },
    { t: 'Toggle sidebar', k: 'Ctrl B', run: A('toggleSidebar') }, { t: 'Focus mode', s: 'Hide all interface', k: 'Ctrl ⇧ F', run: A('focusMode') },
    { t: 'Sidebar on the left', run: set({ layout: 'left' }) }, { t: 'Sidebar on the right', run: set({ layout: 'right' }) }, { t: 'Tabs on top', run: set({ layout: 'top' }) },
    { t: 'Open the extension hub', s: 'Find and add extensions', run: A('hub') },
    { t: S.settings.compact ? 'Expand sidebar' : 'Compact sidebar', run: set({ compact: !S.settings.compact }) }, { t: S.settings.bookmarksBar ? 'Hide bookmarks bar' : 'Show bookmarks bar', run: set({ bookmarksBar: !S.settings.bookmarksBar }) },
    ...(S.settings.bookmarksBar && S.settings.layout === 'top' ? [{ t: S.settings.bookmarkNames === false ? 'Show bookmark names' : 'Bookmarks: icons only', s: 'Right-click the bookmarks bar for the same switch', run: set({ bookmarkNames: S.settings.bookmarkNames === false }) }] : []),
    { t: S.settings.adblock ? 'Turn ad blocker off' : 'Turn ad blocker on', run: set({ adblock: !S.settings.adblock }) },
    { t: 'Developer tools', k: 'F12', run: A('devtools') }, { t: 'Settings', k: 'Ctrl ,', run: A('settings') },
    { t: 'Move in from another browser', s: 'Bookmarks, sign-ins, extensions', run: () => nova.cmd('overlay', { kind: 'settings', data: { tab: 'Move in' } }) },
    { t: 'Close split view', run: () => nova.cmd('split', { id: S.activeTab }) },
    { t: 'Check for updates', run: () => { nova.cmd('closeOverlay'); nova.cmd('checkUpdate'); } },
    ...Object.keys(PRESETS).map((n) => ({ t: 'Theme: ' + n, run: set({ theme: PRESETS[n], wallpaper: S.settings.wallpaper.mode === 'theme' ? { ...S.settings.wallpaper, preset: WALL_OF[n] || '' } : S.settings.wallpaper }) })),
    ...S.spaces.map((sp) => ({ t: 'Go to space: ' + sp.name, run: () => { nova.cmd('closeOverlay'); nova.cmd('switchSpace', { id: sp.id }); } })),
    ...profileList().filter((x) => x.id !== S.profile).map((x) => ({ t: 'Switch to profile: ' + x.name, run: () => { nova.cmd('closeOverlay'); nova.cmd('switchProfile', { id: x.id }); } })),
    { t: 'New profile', s: 'Its own logins, cookies, history and passwords', run: () => setTimeout(newProfileFlow, 80) },
  ];
}
const looksLikeUrl = (q) => /^(https?|file|about):/i.test(q) || (!/\s/.test(q) && (/^localhost/i.test(q) || /^[^\s/]+\.[a-z]{2,}([:/?#]|$)/i.test(q)));
function palette(o, d) {
  const mode = d.mode || 'go';
  const ph = mode === 'find' ? 'Find in page' : mode === 'new' ? 'Open in a new tab: search or enter address' : 'Search, enter an address, or jump to a tab or command';
  o.innerHTML = `<div class="box palette"><div class="pinput">${ic('search')}<input id="q" placeholder="${ph}" autocomplete="off" spellcheck="false"></div><div class="list" id="list"></div><div class="hint"><span><kbd>↑</kbd><kbd>↓</kbd>select</span><span><kbd>Enter</kbd>${mode === 'find' ? 'next' : 'open'}</span>${mode === 'find' ? '<span id="found"></span>' : '<span><kbd>Alt Enter</kbd>new tab</span>'}<span><kbd>Esc</kbd>close</span></div></div>`;
  const q = $('#q'), list = $('#list'); let items = [], sel = 0, seq = 0, extra = null, inside = null, timer, sugg = [], stimer;
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
    if (sugg.length) items.push({ sec: 'Suggestions' }, ...sugg.map((x) => ({ t: x, icon: ic('search'), act: (nt) => nova.cmd('open', { text: x, newTab: nt || mode === 'new' }) })));
    const open = S.tabs.map((t) => ({ t, sc: v ? score(v, t.title, t.url) : t.id === S.activeTab ? -1 : 1 / (1 + (S.now - t.lastActive)) })).filter((x) => x.sc >= 0).sort((a, b) => b.sc - a.sc).slice(0, v ? 8 : 6);
    if (open.length) items.push({ sec: v ? 'Open tabs' : 'Recent tabs' }, ...open.map(({ t }) => { const sp = S.spaces.find((s) => s.id === t.spaceId); return { t: t.title || 'New tab', s: (S.spaces.length > 1 ? sp.name + '  ·  ' : '') + (t.url === HOME ? '' : hostOf(t.url)), icon: `<span class="dot" style="background:${sp.color}"></span>`, act: () => nova.cmd('activate', { id: t.id }) }; }));
    if (extra?.bookmarks?.length) items.push({ sec: 'Bookmarks' }, ...extra.bookmarks.map((b) => ({ t: b.title || b.url, s: hostOf(b.url), icon: b.icon ? `<img class="fav" src="${b.icon}" alt="">` : ic('star'), act: () => nova.cmd('open', { text: b.url, newTab: true }) })));
    if (extra?.history?.length) items.push({ sec: 'History' }, ...extra.history.map((h) => ({ t: h.title || h.url, s: hostOf(h.url), icon: h.icon ? `<img class="fav" src="${h.icon}" alt="">` : ic('clock'), act: () => nova.cmd('open', { text: h.url, newTab: true }) })));
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
    if (S.settings.suggestions && v.length > 1 && !looksLikeUrl(v)) { clearTimeout(stimer); stimer = setTimeout(async () => { const r = await nova.cmd('suggest', { q: v }); if (my === seq) { sugg = r || []; build(); draw(); } }, 160); } else sugg = [];
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
  const thumbs = await nova.thumbs(), mem = (S.budget && S.budget.tabs) || {};
  let space = 0, sort = 'recent';
  o.innerHTML = `<div class="box overview">
    <div class="ov-top"><div class="ov-title"><h2>Tabs</h2><span id="ovsum"></span></div>
      <div class="ov-find">${ic('search')}<input id="ovq" placeholder="Filter your tabs" autocomplete="off" spellcheck="false"></div>
      <div class="ov-acts"><button class="btn withicon" data-c="hour" title="Archive tabs not touched for an hour">${ic('archive')}Archive idle</button><button class="btn withicon" data-c="duplicates" title="Close tabs that show the same page">${ic('layers')}Close duplicates</button><button class="btn withicon" id="bud" title="Open Performance settings">${ic('gauge')}<span id="ovmb"></span></button><button class="btn primary" id="ovx">Done</button></div></div>
    <div class="ov-bar"><div class="ov-spaces" id="ovsp"></div><div class="seg" id="ovsort">${[['recent', 'Recent'], ['memory', 'Memory'], ['space', 'By space']].map(([v, l]) => `<button data-sort="${v}">${l}</button>`).join('')}</div></div>
    <div class="ov-body" id="ovb"></div></div>`;
  const body = $('#ovb'), qi = $('#ovq');
  const ago = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? 'now' : m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d'; };
  const card = (t) => {
    const old = S.now - t.lastActive > 3600e3 && t.id !== S.activeTab, host = hostOf(t.url);
    return `<div class="card ${t.id === S.activeTab ? 'active' : ''} ${old ? 'stale' : ''} ${t.asleep ? 'asleep' : ''}" data-tab="${t.id}"><div class="th" style="${thumbs[t.id] ? `background-image:url(${thumbs[t.id]})` : ''}">${thumbs[t.id] ? '' : esc((t.title || '·')[0])}</div>`
      + `<div class="badges">${t.id === S.activeTab ? '<span class="badge act">Here</span>' : ''}${t.pinned ? '<span class="badge">Pinned</span>' : ''}${t.asleep ? '<span class="badge">Asleep</span>' : t.frozen ? '<span class="badge">Resting</span>' : ''}</div>`
      + `<div class="acts"><button class="ibtn" data-act="pin" title="${t.pinned ? 'Unpin' : 'Pin'}">${ic('pin')}</button><button class="ibtn" data-act="archive" title="Archive">${ic('archive')}</button><button class="ibtn" data-act="close" title="Close">${ic('x')}</button></div>`
      + `<div class="cbody">${favHtml(t)}<div class="ct"><b>${esc(t.title || 'New tab')}</b><span>${esc(host || 'Start page')} · ${ago(S.now - t.lastActive)}${mem[t.id] ? ` · ${mem[t.id]} MB` : ''}</span></div></div></div>`;
  };
  const draw = () => {
    const v = qi.value.trim(), asleep = S.tabs.filter((t) => t.asleep).length;
    $('#ovsum').textContent = `${S.tabs.length} open${asleep ? ' · ' + asleep + ' asleep' : ''}`;
    $('#ovmb').textContent = `${S.budget.used} MB`;
    $('#ovsp').innerHTML = `<button class="ovchip ${!space ? 'on' : ''}" data-sp="0">All<small>${S.tabs.length}</small></button>` + S.spaces.map((sp) => `<button class="ovchip ${space === sp.id ? 'on' : ''}" data-sp="${sp.id}"><i style="background:${sp.color}"></i>${esc(sp.name)}<small>${S.tabs.filter((t) => t.spaceId === sp.id).length}</small></button>`).join('');
    o.querySelectorAll('[data-sort]').forEach((b) => b.classList.toggle('on', b.dataset.sort === sort));
    const list = S.tabs.filter((t) => (!space || t.spaceId === space) && (!v || score(v, t.title, t.url) >= 0));
    if (!list.length) { body.innerHTML = `<div class="lempty">${ic('search')}<b>No tabs match</b><span>Try another word, or pick All spaces.</span></div>`; return; }
    if (sort === 'space') {
      body.innerHTML = S.spaces.map((sp) => { const ts = list.filter((t) => t.spaceId === sp.id); return ts.length ? `<h3><span class="dot" style="background:${sp.color}"></span>${esc(sp.name)} <small>${ts.length}</small></h3><div class="grid">${ts.map(card).join('')}</div>` : ''; }).join('');
    } else {
      const sorted = [...list].sort(sort === 'memory' ? (a, b) => (mem[b.id] || 0) - (mem[a.id] || 0) : (a, b) => b.lastActive - a.lastActive);
      body.innerHTML = `<div class="grid">${sorted.map(card).join('')}</div>`;
    }
  };
  qi.addEventListener('input', draw);
  qi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = body.querySelector('.card'); if (first) nova.cmd('activate', { id: +first.dataset.tab }); } });
  body.addEventListener('click', async (e) => {
    const card = e.target.closest('.card'); if (!card) return; const id = +card.dataset.tab, act = e.target.closest('[data-act]')?.dataset.act;
    if (act) { e.stopPropagation(); await nova.cmd(act, { id }); return; }
    nova.cmd('activate', { id });
  });
  $('#ovsp').addEventListener('click', (e) => { const b = e.target.closest('[data-sp]'); if (b) { space = +b.dataset.sp; draw(); } });
  $('#ovsort').addEventListener('click', (e) => { const b = e.target.closest('[data-sort]'); if (b) { sort = b.dataset.sort; draw(); } });
  o.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => nova.cmd('cleanUp', { mode: b.dataset.c })));
  $('#bud').onclick = () => nova.cmd('overlay', { kind: 'settings', data: { tab: 'Performance' } });
  $('#ovx').onclick = () => nova.cmd('closeOverlay');
  overview.redraw = draw; draw(); qi.focus();
}
// Invisible wake: resting the pointer on a sleeping tab's row for 300 ms loads it in the background, so the click finds it ready
let hoverWake = null;
document.addEventListener('mouseover', (e) => {
  const row = S && S.settings.budget.softWake && !overlay ? e.target.closest?.('.tab.asleep') : null, id = row ? +row.dataset.tab : 0;
  if (hoverWake && hoverWake.id === id) return;
  if (hoverWake) clearTimeout(hoverWake.timer);
  hoverWake = id ? { id, timer: setTimeout(() => nova.cmd('prewake', { id }), 300) } : null;
});
document.documentElement.addEventListener('mouseleave', () => { if (hoverWake) { clearTimeout(hoverWake.timer); hoverWake = null; } });
