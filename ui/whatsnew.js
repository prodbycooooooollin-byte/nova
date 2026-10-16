// ---------- what's new: shown once, the first time Nova starts after it was updated ----------
// The logo appears out of a spark, the stars go supernova behind it, the version counts in and the notes of what came with it follow.
function whatsNew(o, d) {
  const entries = d.entries || [];
  const letters = (t) => [...String(t)].map((c, i) => `<span style="--i:${i}">${esc(c)}</span>`).join('');
  o.innerHTML = `<div class="wn"><canvas id="wnsky"></canvas><div class="wnc">
    <div class="wnmk" data-flare=".645,.258"><img id="wnlogo" src="logo.svg" alt=""><i class="wnspark"></i></div>
    <span class="wnpill">Nova is up to date</span>
    <h1 class="wnver">${letters(d.version || '')}</h1>
    <div class="wnnotes">${entries.map((e, k) => `<section class="wnentry" style="--k:${k}"><h3>${esc(e.version)}${e.date ? `<small>${esc(e.date)}</small>` : ''}</h3><ul>${(e.notes || []).map((n, i) => `<li style="--i:${i + k * 3}">${ic('check')}<span>${esc(n)}</span></li>`).join('')}</ul></section>`).join('') || '<p class="wnnone">This version brings small fixes and improvements.</p>'}</div>
    <button class="btn primary big" id="wnok"><span>Continue</span><span class="arr">${ic('fwd')}</span></button></div></div>`;
  if (S.settings.effects) {
    const sky = NovaSky($('#wnsky'), { fps: 40, burst: false, origin: () => { const el = document.querySelector('.wnmk'); if (!el) return null; const r = el.getBoundingClientRect(), f = (el.dataset.flare || '.5,.5').split(',').map(Number); return { x: r.left + r.width * f[0], y: r.top + r.height * f[1] }; } });
    setTimeout(() => sky.burst(1.3), 650); // the spark above the N has grown
  }
  $('#wnok').onclick = () => nova.cmd('closeOverlay');
  $('#wnok').focus({ preventScroll: true });
}
