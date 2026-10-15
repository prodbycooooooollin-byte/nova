// Nova Resource Budget: the user sets how much memory Nova may use; Nova keeps itself under it by putting the
// least recently used background tabs to sleep, and a CPU guard stops background tabs that burn CPU.
const { app } = require('electron');

let C;
let snap = { used: 0, tabs: {}, cpu: {}, over: false };
let lastToast = 0;
const hot = new Map(); // tabId -> consecutive high-CPU checks
let overStreak = 0, cool = 0;

function measure() {
  const byPid = new Map(app.getAppMetrics().map((m) => [m.pid, { mb: m.memory.workingSetSize / 1024, cpu: m.cpu.percentCPUUsage }]));
  let used = 0, cpuTotal = 0; for (const v of byPid.values()) { used += v.mb; cpuTotal += v.cpu; }
  const tabs = {}, cpu = {};
  for (const t of C.tabs.values()) {
    if (!t.view || t.view.webContents.isDestroyed()) continue;
    const m = byPid.get(t.view.webContents.getOSProcessId());
    if (m) { tabs[t.id] = Math.round(m.mb); cpu[t.id] = m.cpu; }
  }
  return { used: Math.round(used), tabs, cpu, cpuTotal: Math.round(cpuTotal * 10) / 10 };
}

function sleepable() { // background tabs only, never the ones in view, pinned or making sound
  const visible = new Set(C.visibleIds());
  return [...C.tabs.values()].filter((t) => t.view && !t.pinned && !t.audible && !visible.has(t.id)).sort((a, b) => a.lastActive - b.lastActive);
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
    for (const t of sleepable()) { if (over <= 0 || slept.length >= 2) break; over -= Math.min(m.tabs[t.id] || 150, 350); C.sleepTab(t); slept.push(t); }
    if (slept.length) cool = 2;
  }
  if (b.cpuGuard) {
    const visible = new Set(C.visibleIds());
    for (const t of sleepable()) {
      if (visible.has(t.id)) continue;
      if ((m.cpu[t.id] || 0) > b.cpuPct) { const n = (hot.get(t.id) || 0) + 1; hot.set(t.id, n); if (n >= 3 && !slept.includes(t)) { C.sleepTab(t); slept.push(t); hot.delete(t.id); } } else hot.delete(t.id);
    }
  }
  snap = { used: m.used, tabs: m.tabs, cpu: m.cpu, cpuTotal: m.cpuTotal, over: b.enabled && cap > 0 && m.used > cap };
  if (slept.length && Date.now() - lastToast > 45000) { lastToast = Date.now(); C.toast(`Staying within your budget: put ${slept.length} background tab${slept.length > 1 ? 's' : ''} to sleep.`); }
  C.push();
}

function init(ctx) { C = ctx; setInterval(tick, 5000); setTimeout(tick, 2500); }
const get = () => ({ used: snap.used, cpu: snap.cpuTotal || 0, tabCpu: snap.cpu, tabs: snap.tabs, over: snap.over, cap: C.settings().budget.ramMB, enabled: C.settings().budget.enabled });

module.exports = { init, get };
