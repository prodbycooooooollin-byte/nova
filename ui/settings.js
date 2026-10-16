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
  ['General', [['Profile', 'user'], ['Appearance', 'palette']]],
  ['Browsing', [['Tabs', 'layers'], ['Resource budget', 'gauge'], ['Search & privacy', 'shield']]],
  ['Customize', [['Features', 'sliders'], ['Shortcuts', 'keyboard'], ['Extensions', 'box'], ['Custom code', 'code']]],
  ['Data', [['Move in', 'imp'], ['Backup & updates', 'save']]],
];
const PAGE_INFO = {
  Profile: ['user', 'Choose how much Nova does. Switch whenever you like.'],
  Appearance: ['palette', 'Theme, layout and type. Every part of Nova is adjustable.'],
  Tabs: ['layers', 'Nova keeps your tab list tidy so you never have to.'],
  'Resource budget': ['gauge', 'Set how much memory Nova may use. It keeps itself under that on its own.'],
  'Search & privacy': ['shield', 'One search engine, one blocker, nothing else phoning home.'],
  Features: ['sliders', 'Nova stays light. Everything beyond the essentials is off until you want it.'],
  Shortcuts: ['keyboard', 'Click a shortcut, then press the keys you want.'],
  Extensions: ['box', 'Nova ships bare. Add only what you want, installed in one click.'],
  'Custom code': ['code', 'Nova is built from plain CSS variables. Rewrite anything.'],
  'Move in': ['imp', 'Switching browsers without starting from zero.'],
  'Backup & updates': ['save', 'Your whole setup is one JSON document. Nova updates itself.'],
};
const FEATURE_ICONS = { tabSearch: 'search2', snooze: 'clock', rewind: 'rewind', soloAudio: 'vol', peek: 'eye', darkPage: 'moon', cleanLinks: 'link', screenshot: 'camera', pip: 'film', savePdf: 'file', translate: 'globe', privateTabs: 'lock' };
const TAB_ALIAS = { Layout: 'Appearance', Theme: 'Appearance', Code: 'Custom code' };

function settings(o, d) {
  let tab = TAB_ALIAS[d.tab] || d.tab || 'Profile';
  const patch = (p) => nova.cmd('settings', { patch: p });
  const tile = (icon) => `<span class="tile">${ic(icon)}</span>`;
  const row = (label, ctl, hint = '', icon = '') => `<div class="row">${icon ? tile(icon) : ''}<div class="l">${label}${hint ? `<small>${hint}</small>` : ''}</div>${ctl}</div>`;
  const sw = (k, on) => `<label class="sw"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}><i></i></label>`;
  const bsw = (k, on) => `<label class="sw"><input type="checkbox" data-bud="${k}" ${on ? 'checked' : ''}><i></i></label>`;
  const fsw = (k, on) => `<label class="sw"><input type="checkbox" data-feat="${k}" ${on ? 'checked' : ''}><i></i></label>`;
  const rng = (k, min, max, step, unit = '') => `<div class="rng"><input type="range" min="${min}" max="${max}" step="${step}" value="${S.settings[k]}" data-k="${k}" data-num><span class="val">${S.settings[k]}${unit}</span></div>`;
  const stepper = (k, v, min = 0, max = 999, by = 1, attr = 'data-k') => `<div class="stepper"><button data-step="-${by}" aria-label="Less">−</button><input type="number" min="${min}" max="${max}" ${attr}="${k}" data-num value="${v}"><button data-step="${by}" aria-label="More">+</button></div>`;
  const grp = (...rows) => `<div class="group">${rows.join('')}</div>`;
  const sect = (t, sub = '') => `<div class="sect"><h4>${t}</h4>${sub ? `<p>${sub}</p>` : ''}</div>`;
  const mock = (cls, p) => `<div class="mock ${cls}" style="--mb:${p.bg};--mp:${p.page || p.surface};--ma:${p.accent};--ms:${p.surface2}"><i class="mr"></i><i class="mp"></i><i class="ma"></i></div>`;
  const pages = {
    Profile: (s) => `<div class="profiles">${PROFILE_INFO.map(([id, name, icon, tag, bullets, speed, feat]) => `<div class="pcard ${s.profile === id ? 'on' : ''}"><div class="pic">${ic(icon)}</div><div class="ph"><b>${name}</b>${id === 'nova' ? '<span class="tag">Recommended</span>' : ''}</div><p>${tag}</p><div class="meters"><span>Speed</span><i class="dots d${speed}"></i><span>Features</span><i class="dots d${feat}"></i></div><ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>${s.profile === id ? '<div class="active"><span>' + ic('check') + 'Active</span></div>' : `<button class="btn" data-profile="${id}">Use ${name}</button>`}</div>`).join('')}</div>`
      + sect('Setup') + grp(row('Run the welcome setup again', '<button class="btn" id="rerun">Start setup</button>', 'Walk through profile, layout, search and extensions once more.', 'refresh')),
    Appearance: (s) => sect('Theme') + `<div class="themes">${Object.entries(PRESETS).map(([n, p]) => `<button class="theme ${s.theme.accent === p.accent && s.theme.bg === p.bg ? 'on' : ''}" data-preset="${n}">${mock('', p)}<span>${n}</span></button>`).join('')}</div>`
      + `<details class="more"><summary>Fine-tune colours</summary>${grp(...Object.keys(s.theme).filter((k) => k !== 'wall').map((k) => row(k[0].toUpperCase() + k.slice(1), `<input class="swatch" type="color" data-theme="${k}" value="${s.theme[k]}">`)))}</details>`
      + sect('Layout', 'Where your tabs live.') + `<div class="layouts">${[['left', 'Sidebar left'], ['right', 'Sidebar right'], ['top', 'Tabs on top']].map(([v, l]) => `<button class="lay ${s.layout === v ? 'on' : ''}" data-layout="${v}"><div class="lm ${v}"><i class="c"></i><i class="p"></i></div><span>${l}</span></button>`).join('')}</div>`
      + grp(row('Compact sidebar', sw('compact', s.compact), 'Icons only, for maximum page space.', 'layout'), row('Sidebar width', rng('sidebarWidth', 180, 420, 4, 'px')), row('Tab density', `<div class="seg">${['compact', 'comfortable', 'spacious'].map((v) => `<button data-dens="${v}" class="${s.density === v ? 'on' : ''}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div>`, 'How tall each tab row is.'))
      + sect('Start page', 'The page you see in a new tab.') + `<div class="walls">${WALLS.map(([id, label]) => `<button class="wall ${(s.wallpaper.mode === 'theme' && id === 'theme') || (s.wallpaper.mode === 'none' && id === 'none') || (s.wallpaper.mode === 'preset' && s.wallpaper.preset === id) ? 'on' : ''}" data-wall="${id}"><div class="wpv" data-wall="${id === 'theme' ? (WALL_OF[Object.keys(PRESETS).find((n) => PRESETS[n].accent === s.theme.accent && PRESETS[n].bg === s.theme.bg)] || s.wallpaper.preset) : id}">${id === 'none' ? ic('x') : ''}</div><span>${label}</span></button>`).join('')}<button class="wall ${s.wallpaper.mode === 'image' ? 'on' : ''}" data-wall="image"><div class="wpv img">${ic('imp')}</div><span>Your image</span></button></div>`
      + grp(...(s.wallpaper.mode === 'image' ? [row('Image dimming', `<div class="rng"><input type="range" min="0" max="80" step="5" value="${s.wallpaper.dim}" data-wp="dim" data-num><span class="val">${s.wallpaper.dim}%</span></div>`, 'Darken the image so text stays readable.'), row('Image blur', `<div class="rng"><input type="range" min="0" max="24" step="1" value="${s.wallpaper.blur}" data-wp="blur" data-num><span class="val">${s.wallpaper.blur}px</span></div>`)] : []), row('Show most visited sites', `<label class="sw"><input type="checkbox" data-sp="sites" ${s.startPage.sites ? 'checked' : ''}><i></i></label>`, 'Icons of the pages you open the most.'), row('Show greeting', `<label class="sw"><input type="checkbox" data-sp="greeting" ${s.startPage.greeting ? 'checked' : ''}><i></i></label>`))
      + sect('Page frame') + grp(row('Gap around the page', rng('gap', 0, 24, 1, 'px')), row('Corner radius', rng('radius', 0, 28, 1, 'px')))
      + sect('Type and motion') + grp(row('Interface font size', rng('fontSize', 11, 17, 1, 'px')), row('Interface font', `<input type="text" data-k="font" value="${esc(s.font)}" placeholder="Inter">`, 'Any installed font family. Inter is built in.'), row('Animations and blur', sw('effects', s.effects), 'Turn off for the leanest possible interface.')),
    Tabs: (s) => sect('Keep things tidy') + grp(
      row('Tab budget', stepper('maxTabs', s.maxTabs, 0, 200), 'Past this many tabs, the least recently used are archived. 0 means unlimited.', 'layers'),
      row('Sleep after', `<div class="unit">${stepper('sleepAfterMin', s.sleepAfterMin, 0, 1440)}<span>min</span></div>`, 'Frees memory. A sleeping tab reloads when you open it. 0 means never.', 'moon'),
      row('Archive after', `<div class="unit">${stepper('archiveAfterHours', s.archiveAfterHours, 0, 720)}<span>hours</span></div>`, 'Unpinned tabs idle this long move to Stardust, still searchable from Ctrl K.', 'archive'))
      + sect('Behaviour') + grp(row('Reuse existing tabs', sw('dedupeTabs', s.dedupeTabs), 'Opening a page you already have open switches to it.', 'link')),
    'Resource budget': (s) => {
      const b = s.budget, pct = b.enabled && b.ramMB ? Math.min(100, Math.round(S.budget.used / b.ramMB * 100)) : 0;
      return `<div class="gaugecard"><div class="ring"><svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="52"/><circle class="val ${pct >= 90 ? 'hot' : ''}" id="bud-ring" cx="60" cy="60" r="52" stroke-dasharray="${(pct * 3.267).toFixed(1)} 400"/></svg><div class="mid"><b id="bud-text">${S.budget.used}</b><span>MB in use</span></div></div>
        <div class="gc"><div class="gl">Limit <b id="bud-of">${b.enabled ? b.ramMB + ' MB' : 'none'}</b></div><p>Everything Nova uses counts: the interface, the ad blocker and every tab. At the limit, the tabs you used longest ago go to sleep.</p>
        <div class="chips">${[[1024, '1 GB'], [2048, '2 GB'], [4096, '4 GB']].map(([v, l]) => `<button class="chip2 ${b.enabled && b.ramMB === v ? 'on' : ''}" data-bud="ramMB" data-v="${v}">${l}</button>`).join('')}<button class="chip2 ${!b.enabled ? 'on' : ''}" data-bud-off="1">No limit</button></div></div></div>`
        + sect('Fine control') + grp(row('Keep Nova under a limit', bsw('enabled', b.enabled), 'Turn the whole budget on or off.', 'gauge'), row('Custom limit', `<div class="rng"><input type="range" min="512" max="8192" step="128" value="${b.ramMB}" data-bud="ramMB" data-num><span class="val">${b.ramMB} MB</span></div>`))
        + sect('Background CPU') + grp(row('CPU guard', bsw('cpuGuard', b.cpuGuard), 'A background tab that keeps using a lot of CPU is put to sleep.', 'zap'), row('Guard threshold', `<div class="rng"><input type="range" min="5" max="80" step="5" value="${b.cpuPct}" data-bud="cpuPct" data-num><span class="val">${b.cpuPct}%</span></div>`))
        + sect('Heaviest tabs right now') + `<div class="group" id="bud-list">${budList()}</div>`;
    },
    'Search & privacy': (s) => sect('Search engine') + `<div class="engines">${Object.keys(ENGINES).map((n) => `<button class="engine ${ENGINES[n] === s.searchEngine ? 'on' : ''}" data-engine="${n}">${brand('eng-' + n.toLowerCase())}${n}</button>`).join('')}</div>`
      + grp(row('Custom search URL', `<input type="text" data-k="searchEngine" value="${esc(s.searchEngine)}">`, 'Use %s where the query goes.', 'search2'))
      + sect('Privacy') + grp(
        row('Ad and tracker blocker', sw('adblock', s.adblock), `Filters from uBlock Origin, EasyList and EasyPrivacy, refreshed on every launch. ${S.blockedCount} blocked this session.`, 'shield'),
        row('Block autoplay', sw('blockAutoplay', s.blockAutoplay), 'Videos and sound start only after you click. Saves a lot of CPU on news sites. Applies to tabs opened after you change it.', 'zap'),
        row('Search suggestions', sw('suggestions', s.suggestions), 'Shows suggestions from your search engine while you type. This sends what you type to that engine, so it is off by default.', 'search2'),
        row('Keep browsing history', sw('keepHistory', s.keepHistory), 'Lets Ctrl K find pages you visited. Off keeps nothing.', 'clock'),
        row('Tab previews', sw('thumbnails', s.thumbnails), 'Small screenshots in the tab overview. Off saves a little CPU and memory.', 'eye'),
        row('Clear browsing data', '<button class="btn" id="cleardata">Clear…</button>', 'History, cookies and cached files.', 'trash')),
    Features: (s) => FEATURE_GROUPS.map(([g, keys]) => sect(g) + grp(...FEATURES.filter(([k]) => keys.includes(k)).map(([k, l, h]) => row(l, fsw(k, s.features[k]), h, FEATURE_ICONS[k])))).join(''),
    Shortcuts: (s) => grp(...Object.entries(ACTIONS).map(([k, l]) => row(l, `<button class="keybtn" data-rec="${k}">${keyChips(s.keys[k] || [])}</button>`))) + '<p style="margin-top:16px"><button class="btn" id="rk">Reset all shortcuts</button></p>',
    Extensions: () => extensionsHtml(),
    'Custom code': (s) => `<div class="codetabs"><div class="seg"><button class="on" data-code="ccss">Interface CSS</button><button data-code="pcss">Website CSS</button><button data-code="cjs">Interface JS</button></div></div>
      <div class="codepane" data-pane="ccss"><p>Parts: <code>#chrome</code> <code>#tabs</code> <code>.tab</code> <code>#urlbar</code> <code>#tools</code> <code>.card</code> <code>.box</code>. Variables: <code>--bg</code> <code>--page</code> <code>--accent</code> <code>--radius</code></p><textarea id="ccss" spellcheck="false">${esc(s.customCss)}</textarea></div>
      <div class="codepane" data-pane="pcss" hidden><p>Injected into every website you open.</p><textarea id="pcss" spellcheck="false" placeholder="Dark tweaks, hide a cookie banner, anything.">${esc(s.pageCss)}</textarea></div>
      <div class="codepane" data-pane="cjs" hidden><p>Runs when the interface loads, with <code>nova</code> and <code>state</code> in scope.</p><textarea id="cjs" spellcheck="false">${esc(s.customJs)}</textarea></div>
      <p style="margin-top:14px"><button class="btn primary" id="applycode">Apply</button></p>`,
    'Move in': () => '<div id="movein"><p>Looking for other browsers</p></div>',
    'Backup & updates': (s) => `<div class="vcard"><img src="mark.svg" alt=""><div><b>Nova ${esc(S.version || '')}</b><span id="upstate">${S.updateReady ? 'An update is ready. It installs when you restart.' : 'You are on the latest version unless a check says otherwise.'}</span></div><button class="btn" id="chk">Check for updates</button></div>`
      + sect('Settings backup', 'Copy this to save or share your setup. Paste another one and press Import.') + `<textarea id="bk" spellcheck="false">${esc(JSON.stringify(s, null, 2))}</textarea><p style="margin-top:12px;display:flex;gap:8px"><button class="btn primary" id="imp">Import</button><button class="btn danger" id="rst">Reset everything</button></p>`
      + `<details class="more"><summary>Advanced</summary>${grp(row('Update source', `<input type="text" data-k="updateFeed" value="${esc(s.updateFeed)}" placeholder="owner/repo or https://…/latest.json">`, 'A GitHub “owner/repo” or a URL to a latest.json file. Leave empty for the default.'))}</details>`,
  };

  o.innerHTML = `<div class="box settings"><div class="sn"><div class="brand"><img src="mark.svg" alt="">Nova<small>Settings</small></div><div class="ssearch">${ic('search')}<input id="ss" placeholder="Search settings" autocomplete="off" spellcheck="false"></div><div class="nav" id="snav">${NAV_GROUPS.map(([g, items]) => `<div class="grp">${g}</div>${items.map(([n, i]) => `<button data-t="${n}">${ic(i)}<span>${n}</span></button>`).join('')}`).join('')}</div><button id="sx" class="closebtn">${ic('x')}<span>Close</span></button></div><div class="sb" id="sbody"></div></div>`;
  const body = $('#sbody');
  const header = (name) => { const [ico, sub] = PAGE_INFO[name] || ['sliders', '']; return `<div class="pghead">${tile(ico).replace('tile', 'tile big')}<div><h2>${name}</h2><p>${sub}</p></div></div>`; };
  const mark = () => o.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tab && !$('#ss').value));
  const render = (keepScroll, swap) => { const st = body.scrollTop; body.innerHTML = header(tab) + `<div class="pgbody ${swap ? 'swap' : ''}">${pages[tab](S.settings)}</div>`; body.scrollTop = keepScroll ? st : 0; mark(); bind(); };
  const show = (name) => { tab = name; $('#ss').value = ''; render(false, true); };
  const again = (ms = 40) => setTimeout(() => { if ($('#sbody') && !$('#ss').value) render(true); }, ms);

  let index = null;
  const buildIndex = () => { index = []; for (const [name, fn] of Object.entries(pages)) { if (name === 'Move in' || name === 'Extensions') continue; const t = document.createElement('div'); t.innerHTML = fn(S.settings); t.querySelectorAll('.row').forEach((r) => { const l = r.querySelector('.l'); if (l) index.push({ page: name, label: l.childNodes[0].textContent.trim(), hint: l.querySelector('small')?.textContent || '' }); }); } };
  $('#ss').addEventListener('input', (e) => {
    const q = e.target.value.trim(); mark();
    if (!q) return render(false, true);
    if (!index) buildIndex();
    const hits = index.filter((i) => score(q, i.label, i.hint, i.page) >= 0).slice(0, 14);
    body.innerHTML = `<div class="pghead">${tile('search2').replace('tile', 'tile big')}<div><h2>Search</h2><p>${hits.length ? hits.length + ' result' + (hits.length > 1 ? 's' : '') : 'Nothing matches that.'}</p></div></div>` + (hits.length ? `<div class="group pgbody swap">${hits.map((h, n) => `<button class="row hit" data-hit="${n}"><div class="l">${esc(h.label)}<small>${esc(h.page)}${h.hint ? ' · ' + esc(h.hint) : ''}</small></div>${ic('fwd')}</button>`).join('')}</div>` : '');
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
    body.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => { const inp = b.parentElement.querySelector('input'); const v = Math.min(+inp.max || 1e9, Math.max(+inp.min || 0, (+inp.value || 0) + +b.dataset.step)); inp.value = v; inp.dispatchEvent(new Event('change')); }));
    body.querySelectorAll('[data-layout]').forEach((b) => (b.onclick = () => { patch({ layout: b.dataset.layout }); body.querySelectorAll('[data-layout]').forEach((x) => x.classList.toggle('on', x === b)); }));
    body.querySelectorAll('[data-engine]').forEach((b) => (b.onclick = () => { patch({ searchEngine: ENGINES[b.dataset.engine] }); body.querySelectorAll('[data-engine]').forEach((x) => x.classList.toggle('on', x === b)); const i = body.querySelector('[data-k=searchEngine]'); if (i) i.value = ENGINES[b.dataset.engine]; }));
    body.querySelectorAll('[data-theme]').forEach((el) => (el.oninput = () => patch({ theme: { ...S.settings.theme, [el.dataset.theme]: el.value } })));
    body.querySelectorAll('[data-preset]').forEach((b) => (b.onclick = () => { const n = b.dataset.preset; patch({ theme: PRESETS[n], wallpaper: S.settings.wallpaper.mode === 'theme' ? { ...S.settings.wallpaper, preset: WALL_OF[n] || '' } : S.settings.wallpaper }); body.querySelectorAll('[data-preset]').forEach((x) => x.classList.toggle('on', x === b)); again(200); }));
    body.querySelectorAll('[data-dens]').forEach((b) => (b.onclick = () => { patch({ density: b.dataset.dens }); body.querySelectorAll('[data-dens]').forEach((x) => x.classList.toggle('on', x === b)); }));
    body.querySelectorAll('[data-wall]').forEach((b) => (b.onclick = async () => { const id = b.dataset.wall, w = S.settings.wallpaper; if (id === 'image') { const ok = await nova.cmd('pickWallpaper'); if (ok) again(200); return; } patch({ wallpaper: id === 'theme' ? { ...w, mode: 'theme', preset: WALL_OF[Object.keys(PRESETS).find((n) => PRESETS[n].accent === S.settings.theme.accent && PRESETS[n].bg === S.settings.theme.bg)] || w.preset } : id === 'none' ? { ...w, mode: 'none' } : { ...w, mode: 'preset', preset: id } }); again(200); }));
    body.querySelectorAll('[data-wp]').forEach((el) => (el.oninput = () => { el.nextElementSibling.textContent = el.value + (el.dataset.wp === 'blur' ? 'px' : '%'); patch({ wallpaper: { ...S.settings.wallpaper, [el.dataset.wp]: +el.value } }); }));
    body.querySelectorAll('[data-sp]').forEach((el) => (el.onchange = () => patch({ startPage: { ...S.settings.startPage, [el.dataset.sp]: el.checked } })));
    body.querySelectorAll('[data-feat]').forEach((el) => (el.onchange = () => patch({ features: { ...S.settings.features, [el.dataset.feat]: el.checked } })));
    body.querySelectorAll('[data-bud]').forEach((el) => {
      const set = (v) => patch({ budget: { ...S.settings.budget, ...(el.dataset.bud === 'ramMB' ? { enabled: true } : {}), [el.dataset.bud]: v } });
      if (el.tagName === 'BUTTON') el.onclick = () => { set(+el.dataset.v); again(140); };
      else if (el.type === 'checkbox') el.onchange = () => { set(el.checked); again(140); };
      else el.oninput = () => { const v = +el.value; el.nextElementSibling.textContent = v + (el.dataset.bud === 'cpuPct' ? '%' : ' MB'); set(v); };
    });
    body.querySelectorAll('[data-bud-off]').forEach((b) => (b.onclick = () => { patch({ budget: { ...S.settings.budget, enabled: false } }); again(140); }));
    body.querySelectorAll('[data-sleep]').forEach((b) => (b.onclick = () => nova.cmd('sleep', { id: +b.dataset.sleep })));
    body.querySelectorAll('[data-profile]').forEach((b) => (b.onclick = () => { nova.cmd('applyProfile', { name: b.dataset.profile }); toast('Profile switched.'); again(200); }));
    body.querySelectorAll('[data-rec]').forEach((b) => (b.onclick = () => recordKey(b)));
    body.querySelectorAll('[data-code]').forEach((b) => (b.onclick = () => { body.querySelectorAll('[data-code]').forEach((x) => x.classList.toggle('on', x === b)); body.querySelectorAll('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.code)); }));
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    on('#cleardata', () => nova.cmd('overlay', { kind: 'library', data: { tab: 'Clear data' } }));
    on('#rk', () => { patch({ keys: {} }); again(150); }); on('#chk', () => { nova.cmd('checkUpdate'); const u = $('#upstate'); if (u) u.textContent = 'Checking…'; }); on('#rerun', () => nova.cmd('runSetup'));
    on('#applycode', () => { patch({ customCss: $('#ccss').value, pageCss: $('#pcss').value, customJs: $('#cjs').value }); toast('Applied'); });
    on('#imp', () => { try { patch(JSON.parse($('#bk').value)); toast('Imported'); } catch (e) { toast('Invalid JSON: ' + e.message); } });
    on('#rst', async () => { if (await askDialog({ title: 'Reset everything?', text: 'All settings go back to the defaults. Your tabs and bookmarks stay.', ok: 'Reset', danger: true })) nova.cmd('resetSettings'); });
    if (tab === 'Extensions') bindExtensions(body, () => render(true));
    if (tab === 'Move in') renderMoveIn($('#movein'));
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

