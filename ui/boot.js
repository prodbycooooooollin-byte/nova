// Skip DOM writes when nothing changed: the chrome re-renders on every title/loading event, most of them no-ops.
(() => { const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML'); for (const id of ['nav', 'winctl', 'urlbar', 'bmbar', 'pins', 'tabhead', 'tabs', 'spaces', 'tools']) { const el = document.getElementById(id); let cur = null; Object.defineProperty(el, 'innerHTML', { configurable: true, get() { return d.get.call(el); }, set(v) { if (v === cur) return; cur = v; d.set.call(el, v); } }); } })();
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

// ---------- drag tabs to reorder ----------
let dragTab = null, dropInfo = null, deferredRender = false, dragSince = 0;
// pressing a close button must never turn into a tab drag
document.addEventListener('mousedown', (e) => { if (e.target.closest('[data-close],[data-mute]')) { const t = e.target.closest('.tab'); if (t) t.draggable = false; } }, true);
const clearDrop = () => document.querySelectorAll('.drop-before,.drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
document.addEventListener('dragstart', (e) => { const t = e.target.closest('.tab[data-tab]'); if (!t) return; dragTab = +t.dataset.tab; dragSince = Date.now(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragTab)); setTimeout(() => t.classList.add('dragging'), 0); });
document.addEventListener('dragover', (e) => {
  if (dragTab === null) return; const t = e.target.closest('.tab[data-tab]'); if (!t || +t.dataset.tab === dragTab) return;
  e.preventDefault(); const r = t.getBoundingClientRect(), after = S.settings.layout === 'top' ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
  clearDrop(); t.classList.add(after ? 'drop-after' : 'drop-before'); dropInfo = { target: +t.dataset.tab, after };
});
document.addEventListener('drop', (e) => { if (dragTab === null || !dropInfo) return; e.preventDefault(); nova.cmd('reorder', { id: dragTab, ...dropInfo }); });
document.addEventListener('dragend', () => { dragTab = null; dropInfo = null; clearDrop(); document.querySelectorAll('.dragging').forEach((x) => x.classList.remove('dragging')); if (deferredRender) { deferredRender = false; render(); } });
