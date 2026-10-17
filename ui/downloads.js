// ---------- downloads: the panel under the download button, and the rows the library page shares with it ----------
const fileKind = (name) => {
  const e = ((String(name).match(/\.([a-z0-9]+)$/i) || [])[1] || '').toLowerCase();
  if (/^(zip|rar|7z|tar|gz|bz2|xz|iso)$/.test(e)) return 'box';
  if (/^(png|jpe?g|gif|webp|bmp|svg|avif|heic|tiff?)$/.test(e)) return 'camera';
  if (/^(mp4|mkv|mov|avi|webm|m4v|wmv)$/.test(e)) return 'film';
  if (/^(mp3|wav|flac|ogg|m4a|aac|opus)$/.test(e)) return 'vol';
  if (/^(exe|msi|msix|appx|bat|cmd|ps1|dmg|apk)$/.test(e)) return 'zap';
  if (/^(pdf|docx?|xlsx?|pptx?|txt|rtf|odt|csv|md|epub)$/.test(e)) return 'file';
  return 'download';
};
const dlWhen = (t) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000)), d = new Date(t);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};
const dlPct = (j) => (j.size ? Math.min(100, Math.round(j.received / j.size * 100)) : 0);
const dlProgressInfo = (j) => {
  const paused = j.state === 'paused', failed = j.state === 'error';
  if (failed) return j.error ? 'Stopped: ' + j.error : 'Stopped';
  return `${fmtBytes(j.received)}${j.size ? ' of ' + fmtBytes(j.size) : ''}${paused ? ' · paused' : j.speed ? ' · ' + fmtBytes(j.speed) + '/s' : ''}${!paused && j.eta ? ' · ' + fmtEta(j.eta) + ' left' : ''}${j.accel && j.ranged && !paused ? ' · ' + j.conns + ' connections' : ''}`;
};
function dlActiveRow(j) {
  const paused = j.state === 'paused';
  return `<div class="dli busy ${paused ? 'paused' : ''}" data-row="${j.id}"><span class="dlico">${ic(fileKind(j.name))}</span><div class="dlt"><b title="${esc(j.name)}">${esc(j.name)}</b><div class="dlbar ${j.size ? '' : 'ind'}"><i style="width:${dlPct(j)}%"></i></div><span class="dls">${esc(dlProgressInfo(j))}</span></div><div class="dlb"><button class="ibtn sm" data-dlact="${paused ? 'resume' : 'pause'}" data-id="${j.id}" title="${paused ? 'Resume' : 'Pause'}">${ic(paused ? 'play' : 'pause')}</button><button class="ibtn sm" data-dlact="cancel" data-id="${j.id}" title="Cancel">${ic('x')}</button></div></div>`;
}
function dlDoneRow(x) {
  const bad = x.state !== 'completed', gone = !bad && x.exists === false;
  return `<div class="dli done ${bad || gone ? 'bad' : ''}"><span class="dlico">${ic(fileKind(x.name))}</span><div class="dlt"><b title="${esc(x.name)}">${esc(x.name)}</b><span class="dls">${bad ? 'Download failed' : gone ? 'File moved or deleted' : (x.size ? fmtBytes(x.size) + ' · ' : '') + dlWhen(x.t)}${x.accel && !bad && !gone ? ' · accelerated' : ''}</span></div><div class="dlb">${!bad && !gone ? `<button class="ibtn sm" data-dlact="open" data-path="${esc(x.path)}" title="Open">${ic('open')}</button><button class="ibtn sm" data-dlact="folder" data-path="${esc(x.path)}" title="Show in folder">${ic('folder')}</button>` : ''}<button class="ibtn sm" data-dlact="remove" data-t="${x.t}" title="Remove from the list">${ic('x')}</button></div></div>`;
}
// buttons on rows: pause, resume, cancel, open, show in folder, remove
function bindDlRows(root, after) {
  root.querySelectorAll('[data-dlact]').forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    const a = b.dataset.dlact;
    if (a === 'pause' || a === 'resume' || a === 'cancel') nova.cmd({ pause: 'dlPause', resume: 'dlResume', cancel: 'dlCancel' }[a], { id: b.dataset.id });
    else if (a === 'open') nova.cmd('dlOpen', { path: b.dataset.path });
    else if (a === 'folder') nova.cmd('showDownload', { path: b.dataset.path });
    else if (a === 'remove') await nova.cmd('dlRemove', { t: +b.dataset.t });
    if (after) after(a);
  }));
}
// the running downloads in a list: the markup is rebuilt only when a download starts, pauses or ends; progress is written into the rows in place,
// so a button is never replaced under the pointer while it is being pressed
function paintLive(el, st, after) {
  if (!el) return 0;
  const jobs = (S && S.dl) || [], key = jobs.map((j) => j.id + ':' + j.state).join(',');
  if (key !== st.key) { st.key = key; el.innerHTML = jobs.map(dlActiveRow).join(''); bindDlRows(el, after); } else {
    for (const j of jobs) {
      const row = el.querySelector(`[data-row="${j.id}"]`); if (!row) continue;
      const bar = row.querySelector('.dlbar i'), info = row.querySelector('.dls');
      if (bar) bar.style.width = dlPct(j) + '%';
      if (info) info.textContent = dlProgressInfo(j);
    }
  }
  return jobs.length;
}

// the panel that opens under the download button
function dlPanel(o, d) {
  const btn = document.querySelector('.dlbtn'), r = btn ? btn.getBoundingClientRect() : { left: 16, bottom: 48 };
  const W = 424, left = Math.max(12, Math.min(innerWidth - W - 12, Math.round(r.left - 8))), top = Math.round(r.bottom + 8);
  const st = { key: null }; let recent = [], rev = -1, cfgOpen = false, hovered = false;
  const cfg = () => ({ fast: true, connections: 8, limitMBs: 0, minMB: 8, panel: false, ...((S && S.settings && S.settings.downloads) || {}) });
  const stepper = (k, v, min, max) => `<div class="stepper"><button data-cstep="-1" data-c="${k}" aria-label="Less">−</button><input type="number" min="${min}" max="${max}" data-c="${k}" value="${v}"><button data-cstep="1" data-c="${k}" aria-label="More">+</button></div>`;
  const sw = (k, on) => `<label class="sw"><input type="checkbox" data-c="${k}" ${on ? 'checked' : ''}><i></i></label>`;
  const cfgHtml = () => { const c = cfg(); return `<div class="dlc"><span>Accelerate big files</span>${sw('fast', c.fast !== false)}</div><div class="dlc"><span>Connections per file</span>${stepper('connections', c.connections, 2, 16)}</div><div class="dlc"><span>Speed limit in MB/s <small>0 is no limit</small></span>${stepper('limitMBs', c.limitMBs, 0, 1000)}</div><div class="dlc"><span>Open this panel when a download starts</span>${sw('panel', !!c.panel)}</div>`; };
  o.innerHTML = `<div class="dlpanel box" style="left:${left}px;top:${top}px;width:${W}px">
    <div class="dlh"><div class="dlhd"><b>Downloads</b><span id="dlsum"></span></div><div class="dlhb"><button class="ibtn sm" data-h="folder" title="Open the downloads folder">${ic('folder')}</button><button class="ibtn sm" data-h="all" title="All downloads">${ic('clock')}</button><button class="ibtn sm" data-h="cfg" title="Settings">${ic('sliders')}</button></div></div>
    <div class="dlcfg" id="dlcfg" hidden></div>
    <div class="dlbody"><div id="dlactive"></div><div id="dlrecent"></div><div class="dlnone" id="dlnone" hidden>${ic('download')}<b>No downloads yet</b><span>Files you download show up here with their progress.</span></div></div>
    <div class="dlfoot"><button class="btn small ghost" data-h="clear">Clear list</button><button class="btn small" data-h="all">All downloads</button></div></div>`;
  const panel = o.querySelector('.dlpanel');
  const sum = () => {
    const jobs = (S && S.dl) || [], run = jobs.filter((j) => j.state === 'downloading' || j.state === 'queued'), speed = run.reduce((n, j) => n + j.speed, 0);
    $('#dlsum').textContent = jobs.length ? `${jobs.length} running${speed ? ' · ' + fmtBytes(speed) + '/s' : ''}` : recent.length ? 'Nothing running' : '';
  };
  const empty = () => { const n = $('#dlnone'); if (n) n.hidden = !!(((S && S.dl) || []).length || recent.length); };
  const paintRecent = () => {
    const el = $('#dlrecent'); if (!el) return;
    el.innerHTML = (recent.length ? `<div class="dlgrp">Recent</div>` : '') + recent.map(dlDoneRow).join('');
    bindDlRows(el, (a) => { if (a === 'remove') loadRecent(); });
    empty(); sum();
  };
  const loadRecent = async () => { recent = (await nova.cmd('dlRecent', { n: 8 })) || []; paintRecent(); };
  const update = () => {
    if (!$('#dlactive')) return;
    paintLive($('#dlactive'), st, () => {});
    const info = (S && S.dlInfo) || {}; if (info.rev !== rev) { rev = info.rev; loadRecent(); }
    empty(); sum();
  };
  window.updateDownloadsLive = update;
  const leave = (more) => nova.cmd('closeOverlay').then(() => more && more());
  o.querySelectorAll('[data-h]').forEach((b) => (b.onclick = async () => {
    const h = b.dataset.h;
    if (h === 'folder') nova.cmd('openDownloadsFolder');
    else if (h === 'all') { await nova.cmd('closeOverlay'); nova.cmd('overlay', { kind: 'library', data: { tab: 'Downloads' } }); }
    else if (h === 'clear') { await nova.cmd('dlClear'); loadRecent(); }
    else if (h === 'cfg') { cfgOpen = !cfgOpen; const c = $('#dlcfg'); c.hidden = !cfgOpen; if (cfgOpen) { c.innerHTML = cfgHtml(); bindCfg(); } }
  }));
  const bindCfg = () => {
    const set = (k, v) => nova.cmd('settings', { patch: { downloads: { ...cfg(), [k]: v } } });
    $('#dlcfg').querySelectorAll('input[data-c]').forEach((el) => (el.onchange = () => set(el.dataset.c, el.type === 'checkbox' ? el.checked : Math.min(+el.max, Math.max(+el.min, +el.value || 0)))));
    $('#dlcfg').querySelectorAll('[data-cstep]').forEach((b) => (b.onclick = () => { const i = b.parentElement.querySelector('input'); i.value = Math.min(+i.max, Math.max(+i.min, (+i.value || 0) + +b.dataset.cstep)); i.dispatchEvent(new Event('change')); }));
  };
  panel.addEventListener('mouseenter', () => { hovered = true; }); panel.addEventListener('mouseleave', () => { hovered = false; });
  if (d.auto) setTimeout(() => { if (overlay && overlay.kind === 'downloads' && !hovered && !cfgOpen) nova.cmd('closeOverlay'); }, 8000); // opened by itself: it goes away by itself
  update(); loadRecent();
}

// ---------- the downloads tray: a part of the sidebar, not a window ----------
// While files come down it slides up above the dock with their progress; a few seconds after the last one it folds away again.
// The download button opens and closes it by hand. With tabs on top or the compact sidebar there is no room for it: the panel above opens instead.
const dlTray = { manual: false, dismissed: false, doneUntil: 0, lastN: 0, lastRev: -1, recent: [], st: { key: null }, built: false, timer: 0 };
const dlTrayAvailable = () => !!(S && S.settings && S.settings.layout !== 'top' && !S.settings.compact && !S.hidden);
function dlCfgHtml() {
  const c = { fast: true, connections: 8, limitMBs: 0, minMB: 8, ...((S && S.settings && S.settings.downloads) || {}) };
  const stepper = (k, v, min, max) => `<div class="stepper"><button data-cstep="-1" data-c="${k}" aria-label="Less">−</button><input type="number" min="${min}" max="${max}" data-c="${k}" value="${v}"><button data-cstep="1" data-c="${k}" aria-label="More">+</button></div>`;
  const sw = (k, on) => `<label class="sw"><input type="checkbox" data-c="${k}" ${on ? 'checked' : ''}><i></i></label>`;
  return `<div class="dlc"><span>Accelerate big files</span>${sw('fast', c.fast !== false)}</div><div class="dlc"><span>Connections per file</span>${stepper('connections', c.connections, 2, 16)}</div><div class="dlc"><span>Speed limit in MB/s <small>0 is none</small></span>${stepper('limitMBs', c.limitMBs, 0, 1000)}</div>`;
}
function bindDlCfg(root) {
  const cur = () => ({ fast: true, connections: 8, limitMBs: 0, minMB: 8, panel: false, ...((S && S.settings && S.settings.downloads) || {}) });
  const set = (k, v) => nova.cmd('settings', { patch: { downloads: { ...cur(), [k]: v } } });
  root.querySelectorAll('input[data-c]').forEach((el) => (el.onchange = () => set(el.dataset.c, el.type === 'checkbox' ? el.checked : Math.min(+el.max, Math.max(+el.min, +el.value || 0)))));
  root.querySelectorAll('[data-cstep]').forEach((b) => (b.onclick = () => { const i = b.parentElement.querySelector('input'); i.value = Math.min(+i.max, Math.max(+i.min, (+i.value || 0) + +b.dataset.cstep)); i.dispatchEvent(new Event('change')); }));
}
function dlToggle() {
  if (!dlTrayAvailable()) return nova.cmd('action', { name: 'downloads' });
  const visible = document.getElementById('dltray').classList.contains('on');
  if (visible) { dlTray.manual = false; dlTray.dismissed = true; dlTray.doneUntil = 0; } else { dlTray.manual = true; dlTray.dismissed = false; }
  dlTrayDraw();
}
function dlTrayDraw() {
  const el = document.getElementById('dltray'); if (!el || !S) return;
  const jobs = S.dl || [], info = S.dlInfo || {};
  if (jobs.length > dlTray.lastN) { dlTray.dismissed = false; dlTray.doneUntil = 0; } // a new download: show the tray again
  if (!jobs.length && dlTray.lastN > 0) { dlTray.doneUntil = Date.now() + 9000; clearTimeout(dlTray.timer); dlTray.timer = setTimeout(() => { if (typeof render === 'function') render(); }, 9200); }
  dlTray.lastN = jobs.length;
  const show = dlTrayAvailable() && ((jobs.length && !dlTray.dismissed) || dlTray.manual || Date.now() < dlTray.doneUntil);
  el.classList.toggle('on', !!show);
  if (!show) { if (dlTray.built) { el.innerHTML = ''; dlTray.built = false; dlTray.st.key = null; } return; }
  if (!dlTray.built) {
    dlTray.built = true; dlTray.lastRev = -1;
    el.innerHTML = `<div class="trh"><b>Downloads</b><span id="trsum"></span><button class="ibtn sm" data-tr="all" title="All downloads">${ic('clock')}</button><button class="ibtn sm" data-tr="cfg" title="Settings">${ic('sliders')}</button><button class="ibtn sm" data-tr="hide" title="Hide">${ic('x')}</button></div><div class="dlcfg" id="trcfg" hidden></div><div class="trbody"><div class="trlive"></div><div class="trrecent"></div></div>`;
    el.querySelectorAll('[data-tr]').forEach((b) => (b.onclick = () => {
      const a = b.dataset.tr;
      if (a === 'all') nova.cmd('overlay', { kind: 'library', data: { tab: 'Downloads' } });
      else if (a === 'hide') { dlTray.manual = false; dlTray.dismissed = true; dlTray.doneUntil = 0; dlTrayDraw(); }
      else if (a === 'cfg') { const c = document.getElementById('trcfg'); c.hidden = !c.hidden; if (!c.hidden) { c.innerHTML = dlCfgHtml(); bindDlCfg(c); } }
    }));
  }
  const run = jobs.filter((j) => j.state === 'downloading' || j.state === 'queued'), speed = run.reduce((n, j) => n + j.speed, 0);
  const sum = document.getElementById('trsum'); if (sum) sum.textContent = jobs.length ? `${jobs.length} running${speed ? ' · ' + fmtBytes(speed) + '/s' : ''}` : '';
  paintLive(el.querySelector('.trlive'), dlTray.st, () => {});
  if (info.rev !== dlTray.lastRev) {
    dlTray.lastRev = info.rev;
    nova.cmd('dlRecent', { n: 3 }).then((r) => {
      const box = el.querySelector('.trrecent'); if (!box) return;
      dlTray.recent = r || [];
      box.innerHTML = dlTray.recent.map(dlDoneRow).join('');
      bindDlRows(box, (a) => { if (a === 'remove') dlTray.lastRev = -1; });
    });
  }
}

// A download started: a small chip rises from where the person clicked (held inside the bar) to the folder button, which catches it.
function dlFly(d) {
  const btn = document.querySelector('.dlbtn'); if (!btn || !S || !S.settings.effects || document.hidden) return;
  const r = btn.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2, chrome = document.getElementById('chrome');
  const y0 = S.settings.layout === 'top' && chrome ? chrome.getBoundingClientRect().bottom - 6 : Math.min(innerHeight - 20, ty + 90);
  const x0 = Math.max(24, Math.min(innerWidth - 24, (d && d.x) || tx));
  const wrap = document.createElement('div'); wrap.className = 'dlfly'; wrap.innerHTML = `<div class="dlchip">${ic('t-folder')}</div>`; document.body.appendChild(wrap);
  const chip = wrap.firstChild, T = 780;
  wrap.animate([{ transform: `translateX(${x0}px)` }, { transform: `translateX(${tx}px)` }], { duration: T, easing: 'cubic-bezier(.5,0,.35,1)', fill: 'forwards' });
  const a = chip.animate([{ transform: `translateY(${y0}px) scale(.55)`, opacity: 0 }, { transform: `translateY(${y0 - 26}px) scale(1)`, opacity: 1, offset: 0.2 }, { transform: `translateY(${ty + 3}px) scale(.9)`, opacity: 1, offset: 0.86 }, { transform: `translateY(${ty}px) scale(.35)`, opacity: 0 }], { duration: T, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' });
  a.onfinish = () => { wrap.remove(); const b = document.querySelector('.dlbtn'); if (b) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); setTimeout(() => b.classList.remove('pop'), 650); } };
}
