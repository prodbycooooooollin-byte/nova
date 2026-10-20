// Nova Resource Budget: the user sets how much memory Nova may use; Nova keeps itself under it by putting the
// least recently used background tabs to sleep, and a CPU guard stops background tabs that burn CPU.
const { app } = require('electron');

let C;
let snap = { used: 0, tabs: {}, cpu: {}, over: false };
let lastToast = 0;
const hot = new Map(); // tabId -> consecutive high-CPU checks
let overStreak = 0, cool = 0;

function measure() {
  const byPid = new Map(app.getAppMetrics().map((m) => [m.pid, { mb: (m.memory.privateBytes || m.memory.workingSetSize * 0.5) / 1024, cpu: m.cpu.percentCPUUsage }]));
  let used = 0, cpuTotal = 0; for (const v of byPid.values()) { used += v.mb; cpuTotal += v.cpu; }
  const tabs = {}, cpu = {};
  for (const t of C.tabs.values()) {
    if (!t.view || t.view.webContents.isDestroyed()) continue;
    const m = byPid.get(t.view.webContents.getOSProcessId());
    if (m) { tabs[t.id] = Math.round(m.mb); cpu[t.id] = m.cpu; }
  }
  return { used: Math.round(used), tabs, cpu, cpuTotal: Math.round(cpuTotal * 10) / 10 };
}

// the whole computer, not only Nova, is short of memory (under 8% free): Windows would start to swap, which makes everything slow
function pressure() {
  try { const m = process.getSystemMemoryInfo(); return m.total > 0 && m.free / m.total < 0.08; } catch { return false; }
}

function sleepable() { // background tabs only, never the ones in view, pinned or making sound, and never one that holds something not sent yet (text, an attachment, a call)
  const visible = new Set(C.visibleIds());
  const now = Date.now(); // a tab woken by hovering its row is about to be opened: leave it alone for a while
  return [...C.tabs.values()].filter((t) => t.view && !t.pinned && !t.audible && !visible.has(t.id) && !(t.warmAt && now - t.warmAt < 30000) && !(C.holdsWork && C.holdsWork(t))).sort((a, b) => a.lastActive - b.lastActive);
}

function tick() {
  const b = C.settings().budget;
  const m = measure();
  const cap = b.ramMB;
  let slept = [];
  if (cool > 0) cool--;
  overStreak = b.enabled && cap > 0 && m.used > cap ? overStreak + 1 : 0;
  if (overStreak >= 2 && cool === 0) { // over the limit for two rounds: sleep the oldest background tabs, then let the numbers settle
    let over = m.used - cap;
    for (const t of sleepable()) { if (over <= 0 || slept.length >= 2) break; over -= Math.min(m.tabs[t.id] || 80, 250); C.sleepTab(t); slept.push(t); }
    if (slept.length) cool = 2;
  }
  let pressed = false;
  if (b.enabled && cool === 0 && !slept.length && pressure()) { // the two oldest background tabs go to sleep, then the numbers get time to settle
    for (const t of sleepable()) { if (slept.length >= 2) break; C.sleepTab(t); slept.push(t); }
    if (slept.length) { cool = 3; pressed = true; }
  }
  if (b.cpuGuard) {
    const visible = new Set(C.visibleIds());
    for (const t of sleepable()) {
      if (visible.has(t.id)) continue;
      if ((m.cpu[t.id] || 0) > b.cpuPct) { const n = (hot.get(t.id) || 0) + 1; hot.set(t.id, n); if (n >= 3 && !slept.includes(t)) { C.sleepTab(t); slept.push(t); hot.delete(t.id); } } else hot.delete(t.id);
    }
  }
  const was = snap;
  snap = { used: m.used, tabs: m.tabs, cpu: m.cpu, cpuTotal: m.cpuTotal, over: b.enabled && cap > 0 && m.used > cap };
  if (slept.length && Date.now() - lastToast > 45000) { lastToast = Date.now(); C.toast(`${pressed ? 'Windows is low on memory' : 'Staying within your budget'}: put ${slept.length} background tab${slept.length > 1 ? 's' : ''} to sleep.`); }
  if (slept.length || snap.over !== was.over || Math.abs(snap.used - was.used) >= 10 || (C.watching && C.watching())) C.push(); // the small number in the corner does not need an update every five seconds
}

// How often to look: every few seconds while something needs watching (a panel that shows the numbers is open, a tab burns CPU, the limit is near), otherwise rarely.
// Every look asks Windows about all processes, so a calm browser should not do it all day.
function nextDelay() {
  if (C.watching && C.watching()) return 3000;
  if (hot.size || cool > 0 || overStreak > 0 || snap.over) return 5000;
  const b = C.settings().budget;
  return !b.enabled && !b.cpuGuard ? 30000 : 12000;
}
function loop() { try { tick(); } catch (e) { console.error('budget', e.message); } setTimeout(loop, nextDelay()); }
function init(ctx) { C = ctx; setTimeout(loop, 2500); }
const get = () => ({ used: snap.used, cpu: snap.cpuTotal || 0, tabCpu: snap.cpu, tabs: snap.tabs, over: snap.over, cap: C.settings().budget.ramMB, enabled: C.settings().budget.enabled });

module.exports = { init, get };
