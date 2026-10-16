// Soft wake, page side. main.js gives this preload only to a view it wakes with something to restore, so no other page pays for it.
// While the real page loads it shows the last picture of the page (a fixed layer the clicks pass through), then puts back the
// scroll position and whatever was typed into plain form fields. Everything gives way to the user's first scroll, key or click.
const { ipcRenderer, webFrame } = require('electron');
(() => {
  if (window.top !== window) return;
  let p = null;
  try { p = ipcRenderer.sendSync('nova:wake', location.href); } catch (e) { return; }
  if (!p) return;

  const started = Date.now();
  let layer = null, user = false, over = false, ended = false, scrolled = !p.x && !p.y, timer = null;
  if (p.ghost) {
    const bg = p.bg || '#ffffff';
    const size = p.w > 0 ? `${p.w}px auto` : '100% auto'; // 1:1: the picture carries the old scrollbar, which the layer (it stops at the real scrollbar) clips off
    // Author origin on purpose: Electron cannot remove a user-origin sheet again. A page whose CSP forbids data: images shows only the background colour.
    try { layer = webFrame.insertCSS(`html::before{content:""!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;background:${bg} url("${p.ghost}") 0 0/${size} no-repeat!important;transition:opacity .16s ease!important}`); } catch (e) { layer = null; }
  }
  const hideLayer = () => {
    if (!layer) return;
    const k = layer; layer = null;
    let k2 = null; try { k2 = webFrame.insertCSS('html::before{opacity:0!important}'); } catch (e) { /* frame is going away */ }
    setTimeout(() => { try { webFrame.removeInsertedCSS(k); if (k2) webFrame.removeInsertedCSS(k2); } catch (e) { /* frame is going away */ } }, 240);
  };

  // plain fields only; the key has to match the one sleeper.js builds before the page is discarded
  const want = new Map((p.f || []).map((e) => [e.k, e])), done = new Set(), touched = new WeakSet();
  addEventListener('input', (e) => { if (e.isTrusted) touched.add(e.target); }, true);
  const fire = (el) => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const restoreForms = () => {
    if (!want.size || done.size >= want.size) return;
    const seen = {};
    for (const el of document.querySelectorAll('input,textarea,select')) {
      const k = [el.tagName, (el.type || '').toLowerCase(), el.id || '', el.name || ''].join('|'), i = seen[k] = (seen[k] === undefined ? -1 : seen[k]) + 1, key = k + '#' + i, e = want.get(key);
      if (!e || done.has(key)) continue;
      if (touched.has(el)) { done.add(key); continue; }
      try {
        if (el.tagName === 'SELECT') { if (el.value !== e.v) { el.value = e.v; fire(el); } }
        else if (e.c !== undefined) { if (el.checked !== !!e.c) { el.checked = !!e.c; fire(el); } }
        else if (el.value === el.defaultValue) { Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, e.v); fire(el); }
        done.add(key);
      } catch (err) { done.add(key); }
    }
  };
  const restoreScroll = () => {
    const el = document.scrollingElement; if (!el) return;
    const max = Math.max(0, el.scrollHeight - innerHeight);
    if (!scrolled && (max >= p.y - 2 || over)) { scrollTo({ left: p.x, top: Math.min(p.y, max), behavior: 'instant' }); scrolled = max >= p.y - 2 || over; }
    else if (scrolled && p.y && max >= p.y - 2 && Math.abs(scrollY - p.y) > 8 && Date.now() - started < 3500) scrollTo({ left: p.x, top: p.y, behavior: 'instant' }); // a script that resets the scroll while the page boots loses
  };
  const finish = () => { if (ended) return; ended = true; clearInterval(timer); over = true; if (!user) { try { restoreScroll(); restoreForms(); } catch (e) { /* page is going away */ } } hideLayer(); for (const ev of ['wheel', 'keydown', 'mousedown', 'touchstart']) removeEventListener(ev, onUser, true); };
  const onUser = () => { user = true; finish(); };
  const step = () => { if (user || ended) return; try { restoreForms(); restoreScroll(); } catch (e) { /* page is going away */ } if (Date.now() - started > 4500) finish(); };
  for (const ev of ['wheel', 'keydown', 'mousedown', 'touchstart']) addEventListener(ev, onUser, { capture: true, passive: true });
  timer = setInterval(step, 250);
  document.addEventListener('DOMContentLoaded', step, { once: true });
  addEventListener('load', () => { step(); setTimeout(finish, 120); }, { once: true });
})();
