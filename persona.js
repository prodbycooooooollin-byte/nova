// Nova presents itself as a regular Chromium browser: consistent User-Agent, client hints
// (sec-ch-ua headers and navigator.userAgentData) and the window.chrome object that real Chrome exposes.
// Sites such as Google sign-in refuse browsers that look like embedded frameworks.
const os = require('os');
const { app } = require('electron');

const full = process.versions.chrome, major = full.split('.')[0];
const UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
const win11 = Number((os.release().split('.')[2] || 0)) >= 22000;
const brands = (v) => [{ brand: 'Chromium', version: v }, { brand: 'Not-A.Brand', version: v === major ? '24' : '24.0.0.0' }, { brand: 'Google Chrome', version: v }];
const META = { brands: brands(major), fullVersionList: brands(full), platform: 'Windows', platformVersion: win11 ? '15.0.0' : '10.0.0', architecture: 'x86', model: '', mobile: false, bitness: '64', wow64: false };

function acceptLanguage() { // plain list: Chromium adds the q-values itself
  const loc = app.getLocale() || 'en-US', base = loc.split('-')[0];
  return [...new Set([loc, base, 'en-US', 'en'])].join(',');
}
// Low-entropy client hints, added to every secure request on the session (a custom UA otherwise suppresses them).
const sec = (list) => list.map((b) => `"${b.brand}";v="${b.version}"`).join(', ');
const hints = { 'sec-ch-ua': sec(META.brands), 'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"Windows"' };
const pending = new WeakMap(); // webContents -> promise that resolves once the identity is in place

function apply(wc) {
  const job = run(wc); pending.set(wc, job); return job;
}
async function run(wc) {
  try {
    if (wc.isDestroyed()) return;
    const kind = wc.getType(); if (kind === 'backgroundPage' || kind === 'remote') return; // the hidden pages of extensions are not pages you look at: no debugger session on them (one left open there crashed Nova while it was closing)
    if (!wc.debugger.isAttached()) wc.debugger.attach('1.3');
    await wc.debugger.sendCommand('Emulation.setUserAgentOverride', { userAgent: UA, acceptLanguage: acceptLanguage(), platform: 'Win32', userAgentMetadata: META });
  } catch (e) { /* the page is closing, or DevTools holds the session */ }
}

module.exports = { UA, apply, ready: (wc) => Promise.race([pending.get(wc) || Promise.resolve(), new Promise((r) => setTimeout(r, 400))]), hints, acceptLanguage };
