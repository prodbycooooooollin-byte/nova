// Nova's built-in page tools: what people usually install four extensions for. Video speed keys, SponsorBlock, Return YouTube Dislike and
// cookie banner hiding run inside the page through one small frame preload (webtools-preload.js). It is registered only while at least one
// of the four features is on, so with all of them off nothing of this exists. The two lookups that need the network are answered here.
const { ipcMain } = require('electron');
const crypto = require('crypto');
const path = require('path');

let C; // context from main.js: sessions, settings
const preloadIds = new Map(); // session -> id of the registered frame preload
const KEYS = ['videoSpeed', 'sponsorBlock', 'ytDislike', 'cookieBanners'];
const feature = (k) => !!(C.settings().features || {})[k];
const anyOn = () => KEYS.some(feature);
const tabSession = (e) => C.sessions().includes(e.sender.session);
const ID = /^[\w-]{11}$/;
const isYouTube = (e) => { try { return /(^|\.)youtube\.com$/.test(new URL(e.senderFrame.url).hostname); } catch { return false; } };

// small in-memory caches, so going back and forth between videos asks the servers once
const cache = (max) => { const m = new Map(); return { get: (k) => m.get(k), set: (k, v) => { m.set(k, v); if (m.size > max) m.delete(m.keys().next().value); return v; } }; };
const segCache = cache(300), voteCache = cache(300);

// SponsorBlock (sponsor.ajay.app): only the first four characters of the video's hash are sent, so the server never learns which video it is.
const SKIP = ['sponsor', 'selfpromo', 'interaction'];
async function segments(e, id) {
  if (!feature('sponsorBlock') || !tabSession(e) || !isYouTube(e) || !ID.test(id)) return [];
  if (segCache.get(id)) return segCache.get(id);
  try {
    const prefix = crypto.createHash('sha256').update(id).digest('hex').slice(0, 4);
    const url = `https://sponsor.ajay.app/api/skipSegments/${prefix}?service=YouTube&categories=${encodeURIComponent(JSON.stringify(SKIP))}&actionTypes=${encodeURIComponent('["skip"]')}`;
    const res = await e.sender.session.fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(8000) });
    if (res.status === 404) return segCache.set(id, []);
    if (!res.ok) return [];
    const list = await res.json();
    const mine = (Array.isArray(list) ? list : []).find((v) => v && v.videoID === id);
    const out = ((mine && mine.segments) || []).filter((s) => Array.isArray(s.segment) && s.segment.length === 2 && s.segment[1] > s.segment[0] && SKIP.includes(s.category))
      .map((s) => ({ start: +s.segment[0], end: +s.segment[1], id: String(s.UUID || s.segment.join('-')), category: s.category }));
    return segCache.set(id, out);
  } catch { return []; }
}

// Return YouTube Dislike (returnyoutubedislikeapi.com): the public like and dislike counts of a video.
async function votes(e, id) {
  if (!feature('ytDislike') || !tabSession(e) || !isYouTube(e) || !ID.test(id)) return null;
  if (voteCache.get(id)) return voteCache.get(id);
  try {
    const res = await e.sender.session.fetch(`https://returnyoutubedislikeapi.com/votes?videoId=${id}`, { credentials: 'omit', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = await res.json();
    if (typeof j.dislikes !== 'number') return null;
    return voteCache.set(id, { likes: +j.likes || 0, dislikes: j.dislikes });
  } catch { return null; }
}

function install() {
  // answered synchronously, once per frame: which of the tools are on? Everything else happens in the page.
  ipcMain.on('nova:tools', (e) => {
    let r = { on: false };
    try { if (tabSession(e) && anyOn()) r = { on: true, speed: feature('videoSpeed'), sponsor: feature('sponsorBlock'), dislike: feature('ytDislike'), cookies: feature('cookieBanners') }; } catch { /* settings not ready */ }
    e.returnValue = r;
  });
  ipcMain.handle('nova:tools-sponsor', (e, id) => segments(e, String(id)));
  ipcMain.handle('nova:tools-dislike', (e, id) => votes(e, String(id)));
}

// Registers or removes the frame preload so it follows the Features switches. Call after any change to settings.features.
// A tab opened before a switch was turned on picks the tool up the next time it loads a page.
function sync() {
  const on = anyOn();
  for (const s of C.sessions()) {
    if (on && !preloadIds.has(s)) { try { preloadIds.set(s, s.registerPreloadScript({ type: 'frame', filePath: path.join(__dirname, 'webtools-preload.js') })); } catch (err) { console.error('webtools preload', err.message); } }
    else if (!on && preloadIds.has(s)) { try { s.unregisterPreloadScript(preloadIds.get(s)); } catch { /* already gone */ } preloadIds.delete(s); }
  }
}

function init(ctx) { C = ctx; install(); sync(); }
module.exports = { init, sync };
