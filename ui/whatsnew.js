// ---------- what's new: shown once, the first time Nova starts after it was updated ----------
// Left: the logo, the version rolling into place like an odometer. Right: the main feature of the release as a card of its own, and what else came with it.
// A release's notes come from changelog.json. An entry may carry a headline {title, text}; without one, the first note plays that part.
function whatsNew(o, d) {
  const entries = d.entries || [], top = entries[0] || {}, notes = [...(top.notes || [])];
  let head = top.headline;
  if (!head && notes.length) { const first = notes.shift(), m = first.match(/^([^:.]{4,48})[:.]\s*(.+)$/); head = m ? { title: m[1], text: m[2] } : { title: first, text: '' }; }
  const more = [...notes, ...entries.slice(1).flatMap((e) => e.notes || [])].slice(0, 9);
  const ver = String(d.version || ''), when = top.date ? new Date(top.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '';
  const odo = [...ver].map((c) => (/\d/.test(c) ? `<span class="odo"><i data-d="${c}">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<b>${n}</b>`).join('')}</i></span>` : `<span class="odc">${esc(c)}</span>`)).join('');
  o.innerHTML = `<div class="wn"><canvas id="wnsky"></canvas><div class="wnc">
    <div class="wnleft"><div class="wnmk"><span class="wnring"></span><img src="logo.svg" alt=""></div><div class="wnver" id="wnver" aria-label="${esc(ver)}">${odo}</div><div class="wnsub">Nova is up to date${when ? ' · ' + esc(when) : ''}</div></div>
    <div class="wnright">
      ${head ? `<div class="wnhero"><span class="wnico">${ic('zap')}</span><h2>${esc(head.title)}</h2>${head.text ? `<p>${esc(head.text)}</p>` : ''}</div>` : ''}
      ${more.length ? `<div class="wnmore"><h3>Also new</h3><ul>${more.map((n, i) => `<li style="--i:${i}">${ic('check')}<span>${esc(n)}</span></li>`).join('')}</ul></div>` : ''}
      ${!head && !more.length ? '<p class="wnnone">This version brings small fixes and improvements.</p>' : ''}
      <button class="btn primary big" id="wnok"><span>Continue</span><span class="arr">${ic('fwd')}</span></button>
    </div></div></div>`;
  if (S.settings.effects) NovaSky($('#wnsky'), { fps: 30, burst: false }); // only the quiet field of stars
  requestAnimationFrame(() => requestAnimationFrame(() => $('#wnver').querySelectorAll('.odo i').forEach((el, k) => { el.style.transitionDelay = (k * 110 + 450) + 'ms'; el.style.transform = `translateY(-${el.dataset.d}em)`; })));
  $('#wnok').onclick = () => nova.cmd('closeOverlay');
  $('#wnok').focus({ preventScroll: true });
}
