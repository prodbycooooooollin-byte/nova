// ---------- settings ----------
Object.assign(PATHS, {
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>', camera: '<path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/>',
  film: '<rect width="18" height="14" x="3" y="5" rx="2"/><rect width="7" height="5" x="12" y="12" rx="1"/>', file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', check: '<path d="m5 12 5 5L20 7"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>', search2: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
});
const PROFILE_INFO = [
  ['ultra', 'Ultra Performance', 'p-ultra', 'The bare minimum. Search and tabs, nothing else.', ['No ad blocker, history or previews', 'No animations or effects', 'Memory limit 1 GB'], 5, 1],
  ['nova', 'Nova', 'p-nova', 'Recommended. Light, with the essentials.', ['Ad blocker built in', 'Subtle effects, history and previews', 'Memory limit 2 GB'], 4, 3],
  ['complete', 'Complete', 'p-complete', 'Everything switched on, for people who want it all.', ['Ad blocker and every extra tool', 'Private tabs, screenshots, PDF and more', 'Memory limit 4 GB'], 2, 5],
];
const NAV_GROUPS = [
  ['Make it yours', [['Profile', 'user'], ['Appearance', 'palette'], ['Layout', 'layout'], ['Start page', 'grid']]],
  ['Browsing', [['Tabs', 'layers'], ['Search & privacy', 'shield'], ['Downloads', 'download'], ['Performance', 'gauge']]],
  ['Tools', [['Built in', 'zap'], ['Features', 'sliders'], ['Extensions', 'box'], ['Shortcuts', 'keyboard'], ['Custom code', 'code'], ['Passwords', 'password']]],
  ['Data', [['Move in', 'imp'], ['Backup & updates', 'save']]],
];
const PAGE_INFO = {
  Profile: ['user', 'Choose how much Nova does. Switch whenever you like.'],
  Appearance: ['palette', 'Colours, type and motion. Pick a look and Nova changes next to this panel.'],
  Layout: ['layout', 'Where your tabs live and what the sidebar holds. Every change shows in Nova right beside this panel.'],
  'Start page': ['grid', 'The page you see in every new tab.'],
  Tabs: ['layers', 'Nova keeps your tab list tidy so you never have to.'],
  'Search & privacy': ['shield', 'One search engine, one blocker, nothing else phoning home.'],
  Downloads: ['download', 'Big files come down over several connections at once and survive a restart.'],
  Performance: ['gauge', 'Memory, sleeping tabs and disk cache. Nova keeps itself inside the limits you set.'],
  'Built in': ['zap', 'What people usually add extensions for, already part of Nova. Switch on what you like.'],
  Features: ['sliders', 'Nova stays light. Everything beyond the essentials is off until you want it.'],
  Shortcuts: ['keyboard', 'Click a shortcut, then press the keys you want.'],
  Extensions: ['box', 'Nova ships bare. Add only what you want, installed in one click.'],
  'Custom code': ['code', 'Nova is built from plain CSS variables. Rewrite anything.'],
  Passwords: ['password', 'Logins Nova keeps for you, sealed with your Windows account. Off until you switch it on.'],
  'Move in': ['imp', 'Switching browsers without starting from zero.'],
  'Backup & updates': ['save', 'Your whole setup is one JSON document. Nova updates itself.'],
};
const FEATURE_ICONS = { tabSearch: 'search2', snooze: 'clock', rewind: 'rewind', soloAudio: 'vol', peek: 'eye', darkPage: 'moon', darkSite: 'contrast', cleanLinks: 'link', screenshot: 'camera', pip: 'film', autoPip: 'film', videoSpeed: 'clock', sponsorBlock: 'zap', ytDislike: 'eye', cookieBanners: 'shield', savePdf: 'file', translate: 'globe', privateTabs: 'lock', passwords: 'password' };
const TAB_ALIAS = { Theme: 'Appearance', Arrange: 'Layout', 'Resource budget': 'Performance', Code: 'Custom code' };

function settings(o, d) {
  let tab = TAB_ALIAS[d.tab] || d.tab || 'Profile';
  const patch = (p) => nova.cmd('settings', { patch: p });
  const tile = (icon) => `<span class="tile">${ic(icon)}</span>`;
  const row = (label, ctl, hint = '', icon = '') => `<div class="row">${icon ? tile(icon) : ''}<div class="l">${label}${hint ? `<small>${hint}</small>` : ''}</div>${ctl}</div>`;
  const sw = (k, on) => `<label class="sw"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}><i></i></label>`;
  const bsw = (k, on) => `<label class="sw"><input type="checkbox" data-bud="${k}" ${on ? 'checked' : ''}><i></i></label>`;
  const dsw = (k, on) => `<label class="sw"><input type="checkbox" data-dl="${k}" ${on ? 'checked' : ''}><i></i></label>`;
  const fsw = (k, on) => `<label class="sw"><input type="checkbox" data-feat="${k}" ${on ? 'checked' : ''}><i></i></label>`;
  const rng = (k, min, max, step, unit = '') => `<div class="rng"><input type="range" min="${min}" max="${max}" step="${step}" value="${S.settings[k]}" data-k="${k}" data-num><span class="val">${S.settings[k]}${unit}</span></div>`;
  const stepper = (k, v, min = 0, max = 999, by = 1, attr = 'data-k') => `<div class="stepper"><button data-step="-${by}" aria-label="Less">−</button><input type="number" min="${min}" max="${max}" ${attr}="${k}" data-num value="${v}"><button data-step="${by}" aria-label="More">+</button></div>`;
  const grp = (...rows) => `<div class="group">${rows.join('')}</div>`;
  const sect = (t, sub = '') => `<div class="sect"><h4>${t}</h4>${sub ? `<p>${sub}</p>` : ''}</div>`;
  const mock = (cls, p) => `<div class="mock ${cls}" style="--mb:${p.bg};--mp:${p.page || p.surface};--ma:${p.accent};--ms:${p.surface2}"><i class="mr"></i><i class="mp"></i><i class="ma"></i></div>`;
  // the parts of the sidebar, in their current order: move them up and down, switch the ones that can go
  const partsGroup = (s) => {
    const ord = blockOrder(s), hid = (s.layoutBlocks || {}).hidden || [], top = s.layout === 'top';
    return grp(...ord.map((id, i) => { const [, name, hint, icon, canHide] = BLOCKS.find((b) => b[0] === id); return row(name, `<div class="arr"><button class="ibtn sm up ${i === 0 || top ? 'off' : ''}" data-blk-mv="-1" data-b="${id}" title="Move up">${ic('back')}</button><button class="ibtn sm down ${i === ord.length - 1 || top ? 'off' : ''}" data-blk-mv="1" data-b="${id}" title="Move down">${ic('back')}</button>${canHide ? `<label class="sw"><input type="checkbox" data-blk-show="${id}" ${hid.includes(id) ? '' : 'checked'}><i></i></label>` : '<span class="fixed">Always shown</span>'}</div>`, hint, icon); }),
      row('Original arrangement', '<button class="btn" id="arrreset">Reset</button>', 'Puts every part back where it started and shows all of them.', 'refresh'));
  };
  // what Nova tells websites about the colour scheme: they switch to a dark theme of their own when it is dark
  const schemeRow = (s) => row('Websites follow', `<div class="seg">${[['system', 'Windows'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<button data-scheme="${v}" class="${(s.pageScheme || 'system') === v ? 'on' : ''}">${l}</button>`).join('')}</div>`, 'Sites with a dark theme of their own use it when this is Dark, or when it follows Windows and Windows is dark. Smart dark mode is separate: it darkens sites that have no dark theme.', 'moon');
  const pages = {
    Profile: (s) => `<div class="profiles">${PROFILE_INFO.map(([id, name, icon, tag, bullets, speed, feat]) => `<div class="pcard ${s.profile === id ? 'on' : ''}"><div class="pic">${ic(icon)}</div><div class="ph"><b>${name}</b>${id === 'nova' ? '<span class="tag">Recommended</span>' : ''}</div><p>${tag}</p><div class="meters"><span>Speed</span><i class="dots d${speed}"></i><span>Features</span><i class="dots d${feat}"></i></div><ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>${s.profile === id ? '<div class="active"><span>' + ic('check') + 'Active</span></div>' : `<button class="btn" data-profile="${id}">Use ${name}</button>`}</div>`).join('')}</div>`
      + sect('Setup') + grp(row('Run the welcome setup again', '<button class="btn" id="rerun">Start setup</button>', 'Walk through profile, layout, search and extensions once more.', 'refresh')),
    Appearance: (s) => sect('Theme', 'Pick a look. Every colour stays editable below.') + `<div class="themes">${Object.entries(PRESETS).map(([n, p]) => `<button class="theme ${s.theme.accent === p.accent && s.theme.bg === p.bg ? 'on' : ''}" data-preset="${n}">${mock('', p)}<span>${n}</span></button>`).join('')}</div>`
      + `<details class="more"><summary>Fine-tune colours</summary>${grp(row('Windows accent colour', '<button class="btn" id="winaccent">Use it</button>', 'Takes the accent colour from your Windows settings and leaves the rest as it is.', 'palette'), ...Object.keys(s.theme).filter((k) => k !== 'wall').map((k) => row(k[0].toUpperCase() + k.slice(1), `<input class="swatch" type="color" data-theme="${k}" value="${s.theme[k]}">`)))}</details>`
      + sect('Type and motion') + grp(row('Interface font size', rng('fontSize', 11, 17, 1, 'px')), row('Interface font', `<input type="text" data-k="font" value="${esc(s.font)}" placeholder="Inter">`, 'Any installed font family. Inter is built in.'), row('Animations and blur', sw('effects', s.effects), 'Turn off for the leanest possible interface.'), schemeRow(s)),
    Layout: (s) => sect('Where tabs live', 'Changes show in Nova right beside this panel.') + `<div class="layouts">${[['left', 'Sidebar left'], ['right', 'Sidebar right'], ['top', 'Tabs on top']].map(([v, l]) => `<button class="lay ${s.layout === v ? 'on' : ''}" data-layout="${v}"><div class="lm ${v}"><i class="c"></i><i class="p"></i></div><span>${l}</span></button>`).join('')}</div>`
      + (s.layout === 'top' ? '' : sect('Sidebar') + grp(row('Compact sidebar', sw('compact', s.compact), 'Icons only, for maximum page space.', 'layout'), row('Sidebar width', rng('sidebarWidth', 180, 420, 4, 'px')), row('Tab density', `<div class="seg">${['compact', 'comfortable', 'spacious'].map((v) => `<button data-dens="${v}" class="${s.density === v ? 'on' : ''}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div>`, 'How tall each tab row is.')))
      + (s.layout === 'top' ? '' : sect('Sidebar parts', s.layout === 'top' ? 'Tabs on top has a fixed arrangement, so here you can only hide parts. Order applies to the sidebar layouts.' : 'Move the parts up and down. Switch a part off to hide it. You see the result at once.') + partsGroup(s))
      + sect('Bookmarks bar') + grp(row('Bookmarks bar', sw('bookmarksBar', s.bookmarksBar), 'Your bookmarks right under the search bar, above your tabs. Hidden while you have none.', 'bookmark'), row('Bookmark names', sw('bookmarkNames', s.bookmarkNames !== false), 'Show each title next to its icon (tabs on top). Right-click the bar to switch this quickly.', 'bookmark'))
      + sect('Window frame') + grp(row('Gap around the page', rng('gap', 0, 24, 1, 'px')), row('Corner radius', rng('radius', 0, 28, 1, 'px'))),
    'Start page': (s) => sect('Background', 'Used behind the search box in a new tab.') + `<div class="walls">${WALLS.map(([id, label]) => `<button class="wall ${(s.wallpaper.mode === 'theme' && id === 'theme') || (s.wallpaper.mode === 'none' && id === 'none') || (s.wallpaper.mode === 'preset' && s.wallpaper.preset === id) ? 'on' : ''}" data-wall="${id}"><div class="wpv" data-wall="${id === 'theme' ? (WALL_OF[Object.keys(PRESETS).find((n) => PRESETS[n].accent === s.theme.accent && PRESETS[n].bg === s.theme.bg)] || s.wallpaper.preset) : id}">${id === 'none' ? ic('x') : ''}</div><span>${label}</span></button>`).join('')}<button class="wall ${s.wallpaper.mode === 'image' ? 'on' : ''}" data-wall="image"><div class="wpv img">${ic('imp')}</div><span>Your image</span></button></div>`
      + (s.wallpaper.mode === 'image' ? sect('Your image') + grp(row('Image dimming', `<div class="rng"><input type="range" min="0" max="80" step="5" value="${s.wallpaper.dim}" data-wp="dim" data-num><span class="val">${s.wallpaper.dim}%</span></div>`, 'Darken the image so text stays readable.'), row('Image blur', `<div class="rng"><input type="range" min="0" max="24" step="1" value="${s.wallpaper.blur}" data-wp="blur" data-num><span class="val">${s.wallpaper.blur}px</span></div>`), row('Colours from this image', '<button class="btn" id="wallcolors">Use its colours</button>', 'Rebuilds Nova’s whole colour set around the main colour of your image.', 'palette'), row('Follow the image', `<label class="sw"><input type="checkbox" data-wfollow ${s.wallpaper.follow ? 'checked' : ''}><i></i></label>`, 'Every new image you pick recolours Nova to match.', 'refresh')) : '')
      + sect('On the page') + grp(row('Show most visited sites', `<label class="sw"><input type="checkbox" data-sp="sites" ${s.startPage.sites ? 'checked' : ''}><i></i></label>`, 'Icons of the pages you open the most.'), row('Show greeting', `<label class="sw"><input type="checkbox" data-sp="greeting" ${s.startPage.greeting ? 'checked' : ''}><i></i></label>`), row('Show Nova’s numbers', `<label class="sw"><input type="checkbox" data-sp="stats" ${s.startPage.stats !== false ? 'checked' : ''}><i></i></label>`, 'Memory in use, ads blocked and tabs asleep, under the search box.')),
    Tabs: (s) => sect('Keep things tidy') + grp(
      row('Tab budget', stepper('maxTabs', s.maxTabs, 0, 200), 'Past this many tabs, the least recently used are archived. 0 means unlimited.', 'layers'),
      row('Sleep after', `<div class="unit">${stepper('sleepAfterMin', s.sleepAfterMin, 0, 1440)}<span>min</span></div>`, 'Frees memory. A sleeping tab reloads when you open it. Smart sleep (under Performance) can sleep tabs sooner. 0 means never.', 'moon'),
      row('Archive after', `<div class="unit">${stepper('archiveAfterHours', s.archiveAfterHours, 0, 720)}<span>hours</span></div>`, 'Unpinned tabs idle this long move to Stardust, still searchable from Ctrl K.', 'archive'))
      + sect('Behaviour') + grp(row('New tab opens', `<div class="seg">${[['home', 'Start page'], ['bar', 'Search bar']].map(([v, l]) => `<button data-ntp="${v}" class="${(s.newTabPage || 'home') === v ? 'on' : ''}">${l}</button>`).join('')}</div>`, 'The start page with the greeting and search, or straight to the address bar.', 'plus'), row('Reuse existing tabs', sw('dedupeTabs', s.dedupeTabs), 'Opening a page you already have open switches to it.', 'link')),
    Performance: (s) => {
      const b = s.budget, pct = b.enabled && b.ramMB ? Math.min(100, Math.round(S.budget.used / b.ramMB * 100)) : 0;
      return `<div class="gaugecard"><div class="ring"><svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="52"/><circle class="val ${pct >= 90 ? 'hot' : ''}" id="bud-ring" cx="60" cy="60" r="52" stroke-dasharray="${(pct * 3.267).toFixed(1)} 400"/></svg><div class="mid"><b id="bud-text">${S.budget.used}</b><span>MB in use</span></div></div>
        <div class="gc"><div class="gl">Limit <b id="bud-of">${b.enabled ? b.ramMB + ' MB' : 'none'}</b></div><p>Everything Nova uses counts: the interface, the ad blocker and every tab. At the limit, the tabs you used longest ago go to sleep.</p>
        <div class="chips">${[[800, '0.8 GB'], [1500, '1.5 GB'], [3000, '3 GB']].map(([v, l]) => `<button class="chip2 ${b.enabled && b.ramMB === v ? 'on' : ''}" data-bud="ramMB" data-v="${v}">${l}</button>`).join('')}<button class="chip2 ${!b.enabled ? 'on' : ''}" data-bud-off="1">No limit</button></div></div></div>`
        + sect('Fine control') + grp(row('Keep Nova under a limit', bsw('enabled', b.enabled), 'Turn the whole budget on or off.', 'gauge'), row('Custom limit', `<div class="rng"><input type="range" min="512" max="8192" step="128" value="${b.ramMB}" data-bud="ramMB" data-num><span class="val">${b.ramMB} MB</span></div>`))
        + sect('Smart sleep', 'Three steps that take memory and CPU back from tabs you are not looking at. Switch off any of them.') + grp(
          row('Freeze background tabs', bsw('freeze', b.freeze), 'A tab you left stops using CPU after a short while and keeps everything as it was. It resumes the moment you open it. Pinned tabs are never frozen.', 'zap'),
          row('Freeze after', `<div class="unit">${stepper('freezeAfterSec', b.freezeAfterSec, 10, 600, 10, 'data-bud')}<span>sec</span></div>`),
          row('Invisible wake', bsw('softWake', b.softWake), 'Before a tab sleeps, Nova keeps where you scrolled, what you typed into plain fields and a picture of the page. The picture shows while the page reloads, and resting the pointer on a sleeping tab wakes it early. Tabs holding passwords or rich editors never sleep on their own.', 'eye'),
          row('Sleep unused tabs after', `<div class="unit">${stepper('earlySleepMin', b.earlySleepMin, 1, 60, 1, 'data-bud')}<span>min</span></div>`, 'With Invisible wake on, this replaces the longer time under Tabs.', 'moon'),
          row('Adaptive timing', bsw('adaptive', b.adaptive), 'Learns how soon you come back to each site. Sites you never return to sleep after about a minute, sites you check often stay. Only host names and time gaps are kept, on this device.', 'clock'))
        + sect('Process model') + grp(row('Share processes between sites', sw('lowIsolation', s.lowIsolation), 'Loads a page and the other sites embedded in it in one process. Saves around 12% memory on busy pages. Chrome keeps them apart as a security measure, so leave this off unless memory matters more to you. Needs a restart.', 'layers'))
        + sect('Disk cache', 'Pages keep images and scripts on disk so they open faster next time. Past the limit, the oldest are dropped.') + grp(
          row('Cache limit', `<div class="chips">${[[100, '100 MB'], [250, '250 MB'], [500, '500 MB'], [1000, '1 GB']].map(([v, l]) => `<button class="chip2 ${(s.cache || {}).limitMB === v ? 'on' : ''}" data-cache="limitMB" data-v="${v}">${l}</button>`).join('')}</div>`, 'Applies from the next start. Smaller keeps your disk tidy, larger saves more loading.', 'save'),
          row('Clean automatically', `<label class="sw"><input type="checkbox" data-cache="auto" ${(s.cache || {}).auto !== false ? 'checked' : ''}><i></i></label>`, 'If the cache ever grows well past the limit, Nova empties it on its own.', 'trash'),
          row('Cache size now', '<button class="btn" id="cacheclean">Clean now</button>', '<span id="cache-size">Measuring…</span>', 'gauge'))
        + sect('Background CPU') + grp(row('CPU guard', bsw('cpuGuard', b.cpuGuard), 'A background tab that keeps using a lot of CPU is put to sleep.', 'zap'), row('Guard threshold', `<div class="rng"><input type="range" min="5" max="80" step="5" value="${b.cpuPct}" data-bud="cpuPct" data-num><span class="val">${b.cpuPct}%</span></div>`))
        + sect('Heaviest tabs right now') + `<div class="group" id="bud-list">${budList()}</div>`;
    },
    Downloads: (s) => {
      const d = s.downloads || {}, live = S.dl || [];
      return sect('Accelerated downloads', 'Big files come down in several pieces at once when the server allows it. Anything else downloads the normal way.')
        + grp(
          row('Accelerate downloads', dsw('fast', d.fast !== false), 'Pause, resume and keep going after a restart come with it. Private tabs always use the normal download.', 'download'),
          row('Open the panel for tabs on top and the compact sidebar', dsw('panel', !!d.panel), 'In the normal sidebar the downloads tray slides up by itself. This is for tabs on top and the compact sidebar: open the downloads panel when a download starts.', 'download'),
          row('Connections per file', `<div class="unit">${stepper('connections', d.connections || 8, 2, 16, 1, 'data-dl')}<span>at once</span></div>`, 'More is faster until the server or your line is the limit. Eight is a good balance, a server that refuses is backed off from automatically.', 'layers'),
          row('Only for files bigger than', `<div class="unit">${stepper('minMB', d.minMB || 8, 1, 4096, 1, 'data-dl')}<span>MB</span></div>`, 'Small files finish too quickly to gain anything.', 'file'),
          row('Speed limit', `<div class="unit">${stepper('limitMBs', d.limitMBs || 0, 0, 1000, 1, 'data-dl')}<span>MB/s</span></div>`, 'Keeps the rest of your connection free. 0 means no limit.', 'gauge'))
        + (live.length ? sect('Running now') + `<div class="group">${live.map((j) => row(esc(j.name), `<span class="val">${j.size ? Math.round(j.received / j.size * 100) + '%' : '…'}</span>`, j.state === 'paused' ? 'Paused' : `${fmtBytes(j.speed)}/s`, 'download')).join('')}</div>` : '')
        + sect('Where files go') + grp(row('Download folder', '<button class="btn" id="dlfolder">Show in Explorer</button>', 'Files are saved to your Downloads folder, with a number added if a name is taken.', 'open'));
    },
    'Search & privacy': (s) => sect('Search engine') + `<div class="engines">${Object.keys(ENGINES).map((n) => `<button class="engine ${ENGINES[n] === s.searchEngine ? 'on' : ''}" data-engine="${n}">${brand('eng-' + n.toLowerCase())}${n}</button>`).join('')}</div>`
      + grp(row('Custom search URL', `<input type="text" data-k="searchEngine" value="${esc(s.searchEngine)}">`, 'Use %s where the query goes.', 'search2'))
      + sect('Privacy') + grp(
        row('Ad and tracker blocker', sw('adblock', s.adblock), (() => { const ab = S.adblock || {}; const when = ab.updated ? new Date(ab.updated).toLocaleDateString() : ''; return `${ab.state === 'ready' ? `Active with uBlock Origin, EasyList and EasyPrivacy lists plus uBlock Origin scriptlets (${ab.source}${when ? ', ' + when : ''}).` : ab.state === 'failed' ? 'Not loaded: ' + (ab.error || 'unknown problem') + '.' : 'Loading the filter lists…'} ${S.blockedCount} blocked this session. Lists refresh daily and apply from the next start.`; })(), 'shield'),
        ...((S.adblock || {}).state === 'failed' || (S.adblock || {}).state === 'ready' ? [row((S.adblock || {}).state === 'failed' ? 'Ad blocker problem' : 'Update filter lists', '<button class="btn" data-adretry>' + ((S.adblock || {}).state === 'failed' ? 'Retry' : 'Update now') + '</button>', (S.adblock || {}).state === 'failed' ? 'Nova tries again with its own network stack and falls back to the lists bundled with the app.' : 'Fetches the newest lists now. They apply from the next start.', 'refresh')] : []),
        row('Block autoplay', sw('blockAutoplay', s.blockAutoplay), 'Videos and sound start only after you click. Saves a lot of CPU on news sites. Applies to tabs opened after you change it.', 'zap'),
        row('Search suggestions', sw('suggestions', s.suggestions), 'Shows suggestions from your search engine while you type. This sends what you type to that engine, so it is off by default.', 'search2'),
        row('Keep browsing history', sw('keepHistory', s.keepHistory), 'Lets Ctrl K find pages you visited. Off keeps nothing.', 'clock'),
        row('Tab previews', sw('thumbnails', s.thumbnails), 'Small screenshots in the tab overview. Off saves a little CPU and memory.', 'eye'),
        row('Clear browsing data', '<button class="btn" id="cleardata">Clear…</button>', 'History, cookies and cached files.', 'trash')),
    'Built in': (s) => {
      const on = BUILT_IN.filter(([k]) => s.features[k]).length;
      return `<div class="bihero"><div><b>Already part of Nova</b><span>The jobs people usually add extensions for, built in. No extra process, and nothing running while a tool is off.</span></div><div class="bicount"><b>${on}</b><span>of ${BUILT_IN.length} on</span></div></div>`
        + `<div class="fgrid">${BUILT_IN.map(([k, rep]) => { const f = FEATURES.find((x) => x[0] === k); return `<label class="fcard big ${s.features[k] ? 'on' : ''}"><span class="tile">${ic(FEATURE_ICONS[k] || 'sliders')}</span><span class="ft"><b>${f[1]}</b><small>${f[2]}</small><em class="rep">Replaces ${rep}</em></span><span class="sw"><input type="checkbox" data-feat="${k}" ${s.features[k] ? 'checked' : ''}><i></i></span></label>`; }).join('')}</div>`
        + (s.features.darkSite && (s.darkSites || []).length ? '<div style="margin-top:10px">' + grp(row('Sites in dark mode', '<button class="btn" id="darkclear">Turn off everywhere</button>', esc(s.darkSites.slice(0, 4).join(', ') + (s.darkSites.length > 4 ? ` and ${s.darkSites.length - 4} more` : '')), 'contrast')) + '</div>' : '')
        + sect('Websites with a dark theme of their own', 'Some sites switch to a dark theme by themselves. This decides what Nova tells them.') + grp(schemeRow(s))
        + (s.features.passwords ? sect('Passwords') + grp(row('Saved passwords and import', '<button class="btn" data-tab-go="Passwords">Open</button>', 'Manage what the password saver has kept.', 'lock')) : '');
    },
    Features: (s) => {
      const shown = FEATURES.filter(([k]) => FEATURE_GROUPS.some(([, keys]) => keys.includes(k))), on = shown.filter(([k]) => s.features[k]).length;
      return `<div class="hubbanner"><span class="tile big">${ic('zap')}</span><div><b>Looking for dark mode, SponsorBlock or the password saver?</b><small>They moved to Built in, so they are easy to find.</small></div><button class="btn primary" data-tab-go="Built in">Open Built in</button></div><p class="fsum" style="margin-top:16px"><b>${on}</b> of ${shown.length} are on. A feature that is off costs nothing.</p>` + FEATURE_GROUPS.map(([g, keys]) => sect(g)
        + `<div class="fgrid">${FEATURES.filter(([k]) => keys.includes(k)).map(([k, l, h]) => `<label class="fcard ${s.features[k] ? 'on' : ''}"><span class="tile">${ic(FEATURE_ICONS[k] || 'sliders')}</span><span class="ft"><b>${l}</b><small>${h}</small></span><span class="sw"><input type="checkbox" data-feat="${k}" ${s.features[k] ? 'checked' : ''}><i></i></span></label>`).join('')}</div>`
        + (keys.includes('darkSite') && s.features.darkSite && (s.darkSites || []).length ? '<div style="margin-top:10px">' + grp(row('Sites in dark mode', '<button class="btn" id="darkclear">Turn off everywhere</button>', esc(s.darkSites.slice(0, 4).join(', ') + (s.darkSites.length > 4 ? ` and ${s.darkSites.length - 4} more` : '')), 'contrast')) + '</div>' : '')).join('');
    },
    Shortcuts: (s) => grp(...Object.entries(ACTIONS).map(([k, l]) => row(l, `<button class="keybtn" data-rec="${k}">${keyChips(s.keys[k] || [])}</button>`))) + '<p style="margin-top:16px"><button class="btn" id="rk">Reset all shortcuts</button></p>',
    Extensions: () => extensionsHtml(),
    'Custom code': (s) => `<div class="codetabs"><div class="seg"><button class="on" data-code="ccss">Interface CSS</button><button data-code="pcss">Website CSS</button><button data-code="cjs">Interface JS</button></div></div>
      <div class="codepane" data-pane="ccss"><p>Parts: <code>#chrome</code> <code>#tabs</code> <code>.tab</code> <code>#urlbar</code> <code>#tools</code> <code>.card</code> <code>.box</code>. Variables: <code>--bg</code> <code>--page</code> <code>--accent</code> <code>--radius</code></p><textarea id="ccss" spellcheck="false">${esc(s.customCss)}</textarea></div>
      <div class="codepane" data-pane="pcss" hidden><p>Injected into every website you open.</p><textarea id="pcss" spellcheck="false" placeholder="Dark tweaks, hide a cookie banner, anything.">${esc(s.pageCss)}</textarea></div>
      <div class="codepane" data-pane="cjs" hidden><p>Runs when the interface loads, with <code>nova</code> and <code>state</code> in scope.</p><textarea id="cjs" spellcheck="false">${esc(s.customJs)}</textarea></div>
      <p style="margin-top:14px"><button class="btn primary" id="applycode">Apply</button></p>`,
    Passwords: (s) => pwPageHtml(s, { row, grp, sect, fsw }),
    'Move in': () => '<div id="movein"><p>Looking for other browsers</p></div>',
    'Backup & updates': (s) => `<div class="vcard" id="updcard">${updCardHtml()}</div>`
      + sect('Patch notes', 'What came with each version. The newest is on top.') + '<div id="patchnotes" class="pnotes"><p class="pnnone">Loading the notes…</p></div>'
      + sect('Settings backup', 'Copy this to save or share your setup. Paste another one and press Import.') + `<textarea id="bk" spellcheck="false">${esc(JSON.stringify(s, null, 2))}</textarea><p style="margin-top:12px;display:flex;gap:8px"><button class="btn primary" id="imp">Import</button><button class="btn danger" id="rst">Reset everything</button></p>`
      + `<details class="more"><summary>Advanced</summary>${grp(row('Update source', `<input type="text" data-k="updateFeed" value="${esc(s.updateFeed)}" placeholder="owner/repo or https://…/latest.json">`, 'A GitHub “owner/repo” or a URL to a latest.json file. Leave empty for the default.'))}</details>`,
  };

  o.innerHTML = `<div class="box settings"><div class="sn"><div class="brand"><img src="mark.svg" alt="">Nova<small>Settings</small></div><div class="ssearch">${ic('search')}<input id="ss" placeholder="Search settings" autocomplete="off" spellcheck="false"></div><div class="nav" id="snav">${NAV_GROUPS.map(([g, items]) => `<div class="grp">${g}</div>${items.map(([n, i]) => `<button data-t="${n}">${ic(i)}<span>${n}</span>${n === 'Extensions' ? `<em class="out">${ic('open')}</em>` : ''}</button>`).join('')}`).join('')}</div><button id="sx" class="closebtn">${ic('x')}<span>Close</span></button></div><div class="sb" id="sbody"></div></div>`;
  const body = $('#sbody');
  const header = (name) => { const [ico, sub] = PAGE_INFO[name] || ['sliders', '']; return `<div class="pghead">${tile(ico).replace('tile', 'tile big')}<div><h2>${name}</h2><p>${sub}</p></div></div>`; };
  const mark = () => o.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tab && !$('#ss').value));
  const render = (keepScroll, swap) => { const st = body.scrollTop; body.innerHTML = header(tab) + `<div class="pgbody ${swap ? 'swap' : ''}">${(() => { try { return pages[tab](S.settings); } catch (e) { console.error('settings page', tab, e); return `<div class="lempty">${ic('info')}<b>This page could not be drawn</b><span>${esc(e.message)}</span></div>`; } })()}</div>`; body.scrollTop = keepScroll ? st : 0; mark(); bind(); };
  const show = (name) => { if (name === 'Extensions') return nova.cmd('overlay', { kind: 'hub', data: { from: 'settings' } }); tab = name; $('#ss').value = ''; render(false, true); };
  const again = (ms = 40) => setTimeout(() => { if ($('#sbody') && !$('#ss').value) render(true); }, ms);

  let index = null;
  const buildIndex = () => { index = []; for (const [name, fn] of Object.entries(pages)) { if (name === 'Move in' || name === 'Extensions') continue; const t = document.createElement('div'); t.innerHTML = fn(S.settings); t.querySelectorAll('.row,.fcard').forEach((r) => { const l = r.querySelector('.l'), f = r.querySelector('.ft b'); if (l) index.push({ page: name, label: l.childNodes[0].textContent.trim(), hint: l.querySelector('small')?.textContent || '' }); else if (f) index.push({ page: name, label: f.textContent.trim(), hint: r.querySelector('.ft small')?.textContent || '' }); }); } };
  $('#ss').addEventListener('input', (e) => {
    const q = e.target.value.trim(); mark();
    if (!q) return render(false, true);
    if (!index) buildIndex();
    const hits = index.filter((i) => score(q, i.label, i.hint, i.page) >= 0).slice(0, 14);
    body.innerHTML = `<div class="pghead">${tile('search2').replace('tile', 'tile big')}<div><h2>Search</h2><p>${hits.length ? hits.length + ' result' + (hits.length > 1 ? 's' : '') : 'Nothing matches that.'}</p></div></div>` + (hits.length ? `<div class="group pgbody swap">${hits.map((h, n) => `<button class="row hit" data-hit="${n}"><div class="l">${esc(h.label)}<small>${esc(h.page)}${h.hint ? ' · ' + esc(h.hint) : ''}</small></div>${ic('fwd')}</button>`).join('')}</div>` : '');
    body.querySelectorAll('[data-hit]').forEach((b) => (b.onclick = () => { const h = hits[+b.dataset.hit]; show(h.page); const r = [...body.querySelectorAll('.row,.fcard')].find((x) => (x.querySelector('.l')?.childNodes[0]?.textContent || x.querySelector('.ft b')?.textContent || '').trim() === h.label); if (r) { r.scrollIntoView({ block: 'center' }); r.classList.add('flash'); } }));
  });
  o.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => show(b.dataset.t)));
  $('#sx').onclick = () => nova.cmd('closeOverlay');

  const bind = () => {
    body.querySelectorAll('[data-k]').forEach((el) => (el.oninput = el.onchange = () => {
      const v = el.type === 'checkbox' ? el.checked : el.type === 'range' || el.dataset.num !== undefined ? +el.value : el.value;
      if (el.type === 'range') el.nextElementSibling.textContent = v + (el.nextElementSibling.textContent.match(/[a-z%]+$/)?.[0] || '');
      patch({ [el.dataset.k]: v });
    }));
    body.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => { const inp = b.parentElement.querySelector('input'); const v = Math.min(+inp.max || 1e9, Math.max(+inp.min || 0, (+inp.value || 0) + +b.dataset.step)); inp.value = v; inp.dispatchEvent(new Event('change')); }));
    body.querySelectorAll('[data-layout]').forEach((b) => (b.onclick = () => { patch({ layout: b.dataset.layout }); body.querySelectorAll('[data-layout]').forEach((x) => x.classList.toggle('on', x === b)); }));
    body.querySelectorAll('[data-engine]').forEach((b) => (b.onclick = () => { patch({ searchEngine: ENGINES[b.dataset.engine] }); body.querySelectorAll('[data-engine]').forEach((x) => x.classList.toggle('on', x === b)); const i = body.querySelector('[data-k=searchEngine]'); if (i) i.value = ENGINES[b.dataset.engine]; }));
    body.querySelectorAll('[data-theme]').forEach((el) => (el.oninput = () => patch({ theme: { ...S.settings.theme, [el.dataset.theme]: el.value } })));
    body.querySelectorAll('[data-preset]').forEach((b) => (b.onclick = () => { const n = b.dataset.preset; patch({ theme: PRESETS[n], wallpaper: S.settings.wallpaper.mode === 'theme' ? { ...S.settings.wallpaper, preset: WALL_OF[n] || '' } : S.settings.wallpaper }); body.querySelectorAll('[data-preset]').forEach((x) => x.classList.toggle('on', x === b)); again(200); }));
    body.querySelectorAll('[data-ntp]').forEach((b) => (b.onclick = () => { patch({ newTabPage: b.dataset.ntp }); body.querySelectorAll('[data-ntp]').forEach((x) => x.classList.toggle('on', x === b)); }));
    body.querySelectorAll('[data-dens]').forEach((b) => (b.onclick = () => { patch({ density: b.dataset.dens }); body.querySelectorAll('[data-dens]').forEach((x) => x.classList.toggle('on', x === b)); }));
    body.querySelectorAll('[data-wall]').forEach((b) => (b.onclick = async () => { const id = b.dataset.wall, w = S.settings.wallpaper; if (id === 'image') { const ok = await nova.cmd('pickWallpaper'); if (ok) again(200); return; } patch({ wallpaper: id === 'theme' ? { ...w, mode: 'theme', preset: WALL_OF[Object.keys(PRESETS).find((n) => PRESETS[n].accent === S.settings.theme.accent && PRESETS[n].bg === S.settings.theme.bg)] || w.preset } : id === 'none' ? { ...w, mode: 'none' } : { ...w, mode: 'preset', preset: id } }); again(200); }));
    body.querySelectorAll('[data-adretry]').forEach((b) => (b.onclick = () => { nova.cmd('adblockRetry'); toast('Loading the ad blocker lists…'); }));
    body.querySelectorAll('[data-wp]').forEach((el) => (el.oninput = () => { el.nextElementSibling.textContent = el.value + (el.dataset.wp === 'blur' ? 'px' : '%'); patch({ wallpaper: { ...S.settings.wallpaper, [el.dataset.wp]: +el.value } }); }));
    body.querySelectorAll('[data-sp]').forEach((el) => (el.onchange = () => patch({ startPage: { ...S.settings.startPage, [el.dataset.sp]: el.checked } })));
    body.querySelectorAll('[data-feat]').forEach((el) => (el.onchange = () => { patch({ features: { ...S.settings.features, [el.dataset.feat]: el.checked } }); const c = el.closest('.fcard'); if (c) c.classList.toggle('on', el.checked); const sm = body.querySelector('.fsum b, .bicount b'); if (sm) sm.textContent = body.querySelectorAll('[data-feat]:checked').length; }));
    body.querySelectorAll('[data-bud]').forEach((el) => {
      const set = (v) => patch({ budget: { ...S.settings.budget, ...(el.dataset.bud === 'ramMB' ? { enabled: true } : {}), [el.dataset.bud]: v } });
      if (el.tagName === 'BUTTON') el.onclick = () => { set(+el.dataset.v); again(140); };
      else if (el.type === 'checkbox') el.onchange = () => { set(el.checked); again(140); };
      else if (el.type === 'number') el.onchange = () => set(Math.min(+el.max || 1e9, Math.max(+el.min || 0, +el.value || 0)));
      else el.oninput = () => { const v = +el.value; el.nextElementSibling.textContent = v + (el.dataset.bud === 'cpuPct' ? '%' : ' MB'); set(v); };
    });
    body.querySelectorAll('[data-dl]').forEach((el) => {
      const set = (v) => patch({ downloads: { ...S.settings.downloads, [el.dataset.dl]: v } });
      if (el.type === 'checkbox') el.onchange = () => set(el.checked);
      else if (el.type === 'number') el.onchange = () => set(Math.min(+el.max || 1e9, Math.max(+el.min || 0, +el.value || 0)));
    });
    body.querySelectorAll('[data-cache]').forEach((el) => {
      const set = (v) => patch({ cache: { ...S.settings.cache, [el.dataset.cache]: v } });
      if (el.tagName === 'BUTTON') el.onclick = () => { set(+el.dataset.v); body.querySelectorAll('[data-cache="limitMB"]').forEach((x) => x.classList.toggle('on', x === el)); };
      else el.onchange = () => set(el.checked);
    });
    if ($('#cache-size')) nova.cmd('cacheInfo').then((r) => { const el = $('#cache-size'); if (el && r) el.textContent = `${fmtBytes(r.size)} on disk, limit ${fmtBytes(r.limit)}`; });
    body.querySelectorAll('[data-tab-go]').forEach((b) => (b.onclick = () => show(b.dataset.tabGo)));
    body.querySelectorAll('[data-scheme]').forEach((b) => (b.onclick = () => { patch({ pageScheme: b.dataset.scheme }); body.querySelectorAll('[data-scheme]').forEach((x) => x.classList.toggle('on', x === b)); toast(b.dataset.scheme === 'system' ? 'Websites follow Windows.' : `Websites now see a ${b.dataset.scheme} colour scheme.`); }));
    body.querySelectorAll('[data-bud-off]').forEach((b) => (b.onclick = () => { patch({ budget: { ...S.settings.budget, enabled: false } }); again(140); }));
    body.querySelectorAll('[data-sleep]').forEach((b) => (b.onclick = () => nova.cmd('sleep', { id: +b.dataset.sleep })));
    body.querySelectorAll('[data-profile]').forEach((b) => (b.onclick = () => { nova.cmd('applyProfile', { name: b.dataset.profile }); toast('Profile switched.'); again(200); }));
    body.querySelectorAll('[data-rec]').forEach((b) => (b.onclick = () => recordKey(b)));
    body.querySelectorAll('[data-code]').forEach((b) => (b.onclick = () => { body.querySelectorAll('[data-code]').forEach((x) => x.classList.toggle('on', x === b)); body.querySelectorAll('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.code)); }));
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    on('#cleardata', () => nova.cmd('overlay', { kind: 'library', data: { tab: 'Clear data' } }));
    on('#winaccent', async () => { const ok = await nova.cmd('windowsAccent'); toast(ok ? 'Accent colour taken from Windows.' : 'Windows did not give an accent colour.'); if (ok) again(200); });
    on('#wallcolors', async () => { const ok = await nova.cmd('wallColors'); toast(ok ? 'Colours updated from your image.' : 'Could not read the image.'); if (ok) again(200); });
    body.querySelectorAll('[data-wfollow]').forEach((el) => (el.onchange = async () => { patch({ wallpaper: { ...S.settings.wallpaper, follow: el.checked } }); if (el.checked) { await nova.cmd('wallColors'); again(200); } }));
    body.querySelectorAll('[data-blk-mv]').forEach((b) => (b.onclick = () => { const ord = blockOrder(S.settings), i = ord.indexOf(b.dataset.b), j = i + +b.dataset.blkMv; if (j < 0 || j >= ord.length) return; [ord[i], ord[j]] = [ord[j], ord[i]]; patch({ layoutBlocks: { ...S.settings.layoutBlocks, order: ord } }); again(160); }));
    body.querySelectorAll('[data-blk-show]').forEach((el) => (el.onchange = () => { const hid = new Set((S.settings.layoutBlocks || {}).hidden || []); el.checked ? hid.delete(el.dataset.blkShow) : hid.add(el.dataset.blkShow); patch({ layoutBlocks: { ...S.settings.layoutBlocks, hidden: [...hid] } }); }));
    on('#arrreset', () => { patch({ layoutBlocks: { order: [], hidden: [] } }); again(100); });
    on('#cacheclean', async () => { const r = await nova.cmd('cacheClean'); toast('Cache emptied.'); const el = $('#cache-size'); if (el && r) el.textContent = `${fmtBytes(r.size)} on disk`; });
    on('#dlfolder', () => nova.cmd('openDownloadsFolder'));
    on('#darkclear', () => { patch({ darkSites: [] }); again(150); });
    on('#rk', () => { patch({ keys: {} }); again(150); }); bindUpd(); on('#rerun', () => nova.cmd('runSetup')); fillPatchNotes();
    on('#applycode', () => { patch({ customCss: $('#ccss').value, pageCss: $('#pcss').value, customJs: $('#cjs').value }); toast('Applied'); });
    on('#imp', () => { try { patch(JSON.parse($('#bk').value)); toast('Imported'); } catch (e) { toast('Invalid JSON: ' + e.message); } });
    on('#rst', async () => { if (await askDialog({ title: 'Reset everything?', text: 'All settings go back to the defaults. Your tabs and bookmarks stay.', ok: 'Reset', danger: true })) nova.cmd('resetSettings'); });
    if (tab === 'Extensions') bindExtensions(body, () => render(true));
    if (tab === 'Move in') renderMoveIn($('#movein'));
    if (tab === 'Passwords') pwPageBind(body, { row, sect, patch, again, on: () => !!S.settings.features.passwords });
  };
  render(false, false);
}

const keyChips = (list) => (list.length ? list.map((k) => `<span class="keys">${k.split('+').map((x) => `<kbd>${esc(x === ' ' ? 'Space' : x)}</kbd>`).join('')}</span>`).join('<span class="or">or</span>') : '<span class="none">Not set</span>');
function recordKey(btn) {
  const action = btn.dataset.rec; const prev = btn.innerHTML;
  btn.classList.add('rec'); btn.innerHTML = '<span class="none">Press the new keys…  Esc cancels, Backspace clears</span>';
  nova.cmd('keysPause', { on: true });
  const done = () => { window.removeEventListener('keydown', onKey, true); btn.classList.remove('rec'); nova.cmd('keysPause', { on: false }); };
  const onKey = (e) => {
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape') { btn.innerHTML = prev; return done(); }
    let list;
    if (e.key === 'Backspace' || e.key === 'Delete') list = [];
    else { const parts = []; if (e.ctrlKey || e.metaKey) parts.push('Ctrl'); if (e.altKey) parts.push('Alt'); if (e.shiftKey) parts.push('Shift'); parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key); list = [parts.join('+')]; }
    nova.cmd('settings', { patch: { keys: { ...S.settings.keys, [action]: list } } });
    btn.innerHTML = keyChips(list); done();
  };
  window.addEventListener('keydown', onKey, true);
}


// ---------- patch notes: every version with what it brought, the newest open ----------
async function fillPatchNotes() {
  const box = $('#patchnotes'); if (!box) return;
  let log = []; try { log = (await nova.cmd('changelog')) || []; } catch { log = []; }
  if (!$('#patchnotes')) return; // the page changed while the notes were on their way
  if (!log.length) { box.innerHTML = '<p class="pnnone">No notes were found for this version.</p>'; return; }
  const day = (e) => { try { return new Date(e.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };
  box.innerHTML = log.map((e, i) => {
    const h = e.headline, notes = e.notes || [];
    return `<details class="pnv" ${i === 0 ? 'open' : ''}><summary><b>${esc(e.version)}</b><span>${esc(day(e))}</span>${e.version === S.version ? '<em>installed</em>' : ''}</summary>`
      + (h ? `<div class="pnh"><b>${esc(h.title)}</b>${h.text ? `<span>${esc(h.text)}</span>` : ''}</div>` : '')
      + (notes.length ? `<ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : (h ? '' : '<p class="pnnone">Small fixes and improvements.</p>')) + '</details>';
  }).join('');
}
