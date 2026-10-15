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
