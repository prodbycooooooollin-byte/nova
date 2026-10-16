// ---------- first-run onboarding ----------
// what the setup offers as built-in tools: the jobs people usually install extensions for
const WIZARD_TOOLS = [
  ['darkSite', 'Dark mode for any site', 'Dark Reader’s engine, built in, remembered per site.'],
  ['videoSpeed', 'Video speed keys', 'S and D change the speed of any video, R resets it.'],
  ['sponsorBlock', 'Skip YouTube sponsors', 'Jumps over sponsor segments reported by viewers.'],
  ['ytDislike', 'YouTube dislike count', 'Brings the dislike number back next to the button.'],
  ['cookieBanners', 'Hide cookie banners', 'The consent boxes of the common tools are hidden.'],
  ['autoPip', 'Float video when you switch tabs', 'A playing video pops out and follows you around.'],
];
function wizard(o) {
  let i = 0, dir = 'fwd', sky = null;
  const choice = { profile: S.settings.profile || 'nova', layout: S.settings.layout, theme: 'Nova', engine: 'DuckDuckGo' };
  const pad = (n) => String(n).padStart(2, '0');
  const letters = (t, cls = '') => [...t].map((c, n) => `<span class="${cls}" style="--i:${n}">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
  const ring = (pct) => `<div class="ring big"><svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="52"/><circle class="val" id="ob-ring" cx="60" cy="60" r="52" stroke-dasharray="${(pct * 3.267).toFixed(1)} 400"/></svg><div class="mid"><b id="ob-mb">${S.settings.budget.enabled ? S.settings.budget.ramMB : '∞'}</b><span>${S.settings.budget.enabled ? 'MB limit' : 'no limit'}</span></div></div>`;
  const pickInto = (root, attr, fn) => root.querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = () => { fn(b); root.querySelectorAll(`[${attr}]`).forEach((x) => x.classList.toggle('on', x === b)); }));

  const defs = {
    hello: { label: 'Welcome', cta: 'Get started', hint: 'Enter to begin', render: () => `<div class="hello3">
      <img id="bmark" class="hmark" data-flare=".645,.258" src="logo.svg" alt="">
      <h1 class="mega">${letters('Nova', 'mg')}</h1>
      <p class="hsub">A browser, reduced.</p>
      <ul class="pillars">
        <li style="--i:0">${ic('gauge')}Light on memory</li>
        <li style="--i:1">${ic('layers')}Tabs that tidy themselves</li>
        <li style="--i:2">${ic('sliders')}Yours to rearrange</li>
        <li style="--i:3">${ic('download')}Downloads that use every connection</li>
      </ul></div>` },
    profile: { label: 'Profile', title: 'How should Nova feel?', sub: 'This sets sensible defaults for everything. You can switch any time in Settings.', render: () => `<div class="ocards">${PROFILE_INFO.map(([id, name, icon, tag, bullets, speed, feat], n) => `<button class="ocard ${choice.profile === id ? 'on' : ''}" data-p="${id}" style="--i:${n}"><div class="pic">${ic(icon)}</div><div class="ph"><b>${name}</b>${id === 'nova' ? '<span class="tag">Recommended</span>' : ''}</div><p>${tag}</p><div class="meters"><span>Speed</span><i class="dots d${speed}"></i><span>Features</span><i class="dots d${feat}"></i></div><ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul><span class="tick">${ic('check')}</span></button>`).join('')}</div>`, after: (r) => pickInto(r, 'data-p', (b) => { choice.profile = b.dataset.p; nova.cmd('applyProfile', { name: choice.profile }); }) },
    layout: { label: 'Layout', title: 'Where should your tabs live?', sub: 'Pick what feels natural. Switch any time.', render: () => `<div class="ocards three">${[['left', 'Sidebar left', 'Vertical tabs. The Nova way.'], ['right', 'Sidebar right', 'Tabs out of the way.'], ['top', 'Tabs on top', 'The classic strip.']].map(([v, l, sub], n) => `<button class="ocard lay ${choice.layout === v ? 'on' : ''}" data-l="${v}" style="--i:${n}"><div class="lm big ${v}"><i class="c"><u></u><u></u><u></u></i><i class="p"></i></div><div class="ph"><b>${l}</b></div><p>${sub}</p><span class="tick">${ic('check')}</span></button>`).join('')}</div>`, after: (r) => pickInto(r, 'data-l', (b) => { choice.layout = b.dataset.l; nova.cmd('settings', { patch: { layout: choice.layout } }); }) },
    look: { label: 'Look', title: 'Pick a look', sub: 'Watch this screen change as you choose. Every colour stays editable.', render: () => `<div class="themes big">${WIZARD_THEMES.map((n) => [n, PRESETS[n]]).map(([n, p], k) => `<button class="theme ${choice.theme === n ? 'on' : ''}" data-th="${n}" style="--i:${k}"><div class="mock" style="--mb:${p.bg};--mp:${p.page};--ma:${p.accent};--ms:${p.surface2}"><i class="mr"></i><i class="mp"></i><i class="ma"></i></div><span>${n}</span></button>`).join('')}</div>`, after: (r) => pickInto(r, 'data-th', (b) => { choice.theme = b.dataset.th; nova.cmd('settings', { patch: { theme: PRESETS[choice.theme], wallpaper: { ...S.settings.wallpaper, mode: 'theme', preset: WALL_OF[choice.theme] || '' } } }); }) },
    search: { label: 'Search', title: 'Choose your search', sub: 'Used by the address bar and the home page.', render: () => `<div class="engines big">${Object.keys(ENGINES).map((n, k) => `<button class="engine ${choice.engine === n ? 'on' : ''}" data-e="${n}" style="--i:${k}">${brand('eng-' + n.toLowerCase())}${n}<span class="tick">${ic('check')}</span></button>`).join('')}</div>`, after: (r) => pickInto(r, 'data-e', (b) => { choice.engine = b.dataset.e; nova.cmd('settings', { patch: { searchEngine: ENGINES[choice.engine] } }); }) },
    budget: { label: 'Memory', title: 'How light should Nova be?', sub: 'Nova keeps its memory use under a limit you choose, by quietly sleeping tabs you are not using.', render: () => `<div class="budrow">${ring(S.settings.budget.enabled ? Math.min(100, S.settings.budget.ramMB / 40) : 0)}<div class="ocards four">${[[800, 'Light', 'Up to 0.8 GB'], [1500, 'Balanced', 'Up to 1.5 GB'], [3000, 'Roomy', 'Up to 3 GB'], [0, 'No limit', 'Never sleep tabs for memory']].map(([v, t, sub], n) => `<button class="ocard small ${(S.settings.budget.enabled ? S.settings.budget.ramMB : 0) === v ? 'on' : ''}" data-b="${v}" style="--i:${n}"><div class="ph"><b>${t}</b></div><p>${sub}</p><span class="tick">${ic('check')}</span></button>`).join('')}</div></div>`, after: (r) => pickInto(r, 'data-b', (b) => { const v = +b.dataset.b; nova.cmd('settings', { patch: { budget: { ...S.settings.budget, enabled: v > 0, ramMB: v || S.settings.budget.ramMB } } }); const ringEl = $('#ob-ring'); if (ringEl) ringEl.setAttribute('stroke-dasharray', `${((v ? Math.min(100, v / 40) : 0) * 3.267).toFixed(1)} 400`); $('#ob-mb').textContent = v || '∞'; }) },
    bookmarks: { label: 'Move in', title: 'Bring your things over', sub: 'Coming from Chrome, Edge, Firefox or another browser? Move bookmarks, history, extensions and your search engine in one go.', render: () => '<div id="wz-mi"></div>', after: (r) => { mi = null; renderMoveIn(r.querySelector('#wz-mi'), { hub: false, onReady: (c) => { mi = c; ctaSync(); } }); } },
    tools: { label: 'Built in', title: 'What should be built in?', sub: 'These do the work of extensions you would otherwise install, without the extra memory. Switch on what you like. All of it can change later in Settings.', render: () => `<div class="ocards four tools">${WIZARD_TOOLS.map(([k, t, sub], n) => `<button class="ocard small ${(choice.feat || S.settings.features)[k] ? 'on' : ''}" data-tool="${k}" style="--i:${n}"><div class="ph"><b>${t}</b></div><p>${sub}</p><span class="tick">${ic('check')}</span></button>`).join('')}</div>`, after: (r) => r.querySelectorAll('[data-tool]').forEach((b) => (b.onclick = () => { choice.feat = choice.feat || { ...S.settings.features }; const on = !choice.feat[b.dataset.tool]; choice.feat[b.dataset.tool] = on; b.classList.toggle('on', on); nova.cmd('settings', { patch: { features: { ...choice.feat } } }); })) },
    done: { label: 'Done', cta: 'Open Nova', hint: 'Enter to open Nova', render: () => `<div class="hello3 fin">
      <h1 class="mega small">${letters('Ready.', 'mg')}</h1>
      <p class="hsub">Press <kbd>Ctrl</kbd> <kbd>K</kbd> for everything.</p>
      <div class="specs">${[['Profile', PROFILE_INFO.find((p) => p[0] === choice.profile)[1]], ['Tabs', { left: 'Sidebar left', right: 'Sidebar right', top: 'On top' }[choice.layout]], ['Look', choice.theme], ['Search', choice.engine], ['Memory', S.settings.budget.enabled ? S.settings.budget.ramMB + ' MB limit' : 'No limit']].map(([k, v], n) => `<div class="spec" style="--i:${n}"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
      <p class="specnote">Everything else lives in Settings, <kbd>Ctrl</kbd> <kbd>,</kbd></p></div>` },
  };
  const order = () => (choice.profile === 'ultra' ? ['hello', 'profile', 'layout', 'search', 'bookmarks', 'done'] : ['hello', 'profile', 'layout', 'look', 'search', 'budget', 'tools', 'bookmarks', 'done']);

  o.innerHTML = `<div class="onb"><canvas id="obsky"></canvas>
    <div class="otop"><div class="obrand"><img src="mark.svg" alt="">Nova</div><button class="skip" id="skip">Skip setup</button></div>
    <div class="ostage" id="ostage"></div>
    <div class="onav"><button class="btn ghost" id="wb">Back</button><div class="osteps" id="osteps"></div><button class="btn primary big" id="wn"><span id="wnl"></span><span class="arr">${ic('fwd')}</span></button></div></div>`;
  if (S.settings.effects) sky = NovaSky($('#obsky'), { fps: 30, origin: () => { const el = document.querySelector('#bmark') || document.querySelector('.mega'); if (!el) return null; const r = el.getBoundingClientRect(), f = (el.dataset.flare || '.5,.5').split(',').map(Number); return { x: r.left + r.width * f[0], y: r.top + r.height * f[1] }; } });

  let mi = null; // the Move in step reports here whether there is something left to bring over
  const ctaSync = () => { const k = order()[i]; if (k === 'bookmarks') $('#wnl').textContent = mi && mi.pending() ? 'Bring it over and continue' : 'Continue'; };
  function paint() {
    const keys = order(); if (i >= keys.length) i = keys.length - 1;
    const k = keys[i], d = defs[k], last = i === keys.length - 1;
    $('#osteps').innerHTML = keys.slice(1, -1).map((s, n) => `<i class="${n + 1 < i ? 'done' : n + 1 === i ? 'on' : ''}"><u></u></i>`).join('');
    o.querySelector('.onb').dataset.step = k;
    $('#ostage').innerHTML = `<div class="ostep ${dir}">${d.title ? `<div class="ohead"><span class="eyebrow">${d.label}</span><h2>${d.title}</h2><p>${d.sub}</p></div>` : ''}<div class="obody">${d.render()}</div></div>`;
    $('#wnl').textContent = d.cta || 'Continue';
    $('#wb').style.visibility = i > 1 && !last ? '' : 'hidden';
    if (d.after) d.after($('#ostage'));
    if (last && sky) sky.burst();
    $('#wn').focus({ preventScroll: true });
  }
  function finish() { const el = o.querySelector('.onb'); if (el) el.classList.add('leaving'); setTimeout(() => { if (sky) sky.stop(); nova.cmd('finishSetup'); }, el && S.settings.effects ? 380 : 0); }
  $('#skip').onclick = () => finish();
  $('#wb').onclick = () => { dir = 'back'; i--; paint(); };
  $('#wn').onclick = async () => {
    const keys = order();
    if (keys[i] === 'bookmarks' && mi && mi.pending()) { const b = $('#wn'); b.disabled = true; $('#wnl').textContent = 'Bringing it over…'; try { await mi.run(); } catch (e) { toast('Something went wrong while moving in. You can try again in Settings > Move in.'); } await new Promise((r) => setTimeout(r, 1300)); b.disabled = false; }
    if (i === keys.length - 1) return finish(); dir = 'fwd'; i++; paint();
  };
  paint();
}

