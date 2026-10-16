'use strict';
// Nova's accelerated downloader, built into the browser. A file is cut into blocks and several blocks are fetched at once with HTTP range
// requests, so one slow connection no longer limits the download. It pauses, resumes (also after a restart), retries broken blocks, backs
// off to fewer connections when a server pushes back, and can be limited in speed. Everything that touches the network is passed in
// (fetch), so the same code runs inside Nova (Chromium's network stack, cookies included) and in plain Node for testing.
const fs = require('fs');
const path = require('path');

const MB = 1048576;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safeName = (n) => String(n || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^[. ]+|[. ]+$/g, '').slice(0, 180);

function nameFromResponse(res, url, hint) {
  const cd = (res && res.headers && res.headers.get('content-disposition')) || '';
  let n = '';
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i.exec(cd);
  if (star) { try { n = decodeURIComponent(star[1].trim().replace(/^"|"$/g, '')); } catch { n = star[1]; } }
  if (!n) { const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(cd); if (plain) n = plain[1].trim(); }
  if (!n) { try { n = decodeURIComponent(path.posix.basename(new URL((res && res.url) || url).pathname)); } catch { /* fall through */ } }
  return safeName(n) || safeName(hint) || 'download';
}

// Asks the server what it can do: how big the file is and whether it understands byte ranges.
async function probe(fetchFn, url, headers = {}, timeoutMs = 8000) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { headers: { ...headers, Range: 'bytes=0-0' }, signal: ctl.signal, redirect: 'follow' });
    let size = 0, ranges = false;
    if (res.status === 206) { const m = /\/(\d+)\s*$/.exec(res.headers.get('content-range') || ''); size = m ? +m[1] : 0; ranges = size > 0; }
    else if (res.status === 200) size = +(res.headers.get('content-length') || 0);
    else { try { await res.body.cancel(); } catch { /* closed */ } return { ok: false, status: res.status }; }
    try { await res.body.cancel(); } catch { /* closed */ }
    return { ok: true, size, ranges, finalUrl: res.url || url, type: (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase(), name: nameFromResponse(res, url), etag: res.headers.get('etag') || '', modified: res.headers.get('last-modified') || '' };
  } catch (e) { return { ok: false, error: e.message }; } finally { clearTimeout(timer); }
}

function uniquePath(dir, name) {
  const ext = path.extname(name), base = path.basename(name, ext); let p = path.join(dir, name), i = 1;
  while (fs.existsSync(p) || fs.existsSync(p + '.part')) p = path.join(dir, `${base} (${i++})${ext}`);
  return p;
}

function createDownloader(o) {
  const fetchFn = o.fetch, stateFile = o.stateFile || '';
  const opt = { connections: 8, minSplitMB: 8, limitBps: 0, ...(o.options || {}) };
  const jobs = new Map(); let nextId = Date.now() % 1e9;
  const emitters = new Map(); let saveTimer = null, nextFree = 0;

  const limiter = async (n) => { // one shared speed limit for every connection
    if (!opt.limitBps) return;
    const now = Date.now(), wait = Math.max(0, nextFree - now);
    nextFree = Math.max(now, nextFree) + (n / opt.limitBps) * 1000;
    if (wait > 20) await sleep(wait);
  };
  const snapshot = (j) => {
    const dt = j.samples.length > 1 ? (j.samples[j.samples.length - 1][0] - j.samples[0][0]) / 1000 : 0;
    const speed = j.state === 'downloading' && dt > 0.4 ? Math.round((j.samples[j.samples.length - 1][1] - j.samples[0][1]) / dt) : 0;
    const left = j.size ? j.size - j.received : 0;
    return { id: j.id, name: path.basename(j.path), path: j.path, url: j.url, state: j.state, size: j.size, received: j.received, speed, eta: speed > 0 && left > 0 ? Math.round(left / speed) : 0, conns: j.active, ranged: !!j.ranges && j.blocks.length > 1, error: j.error || '', started: j.started, finished: j.finished || 0 };
  };
  const emit = (j, force) => {
    const now = Date.now(); if (!force && now - (emitters.get(j.id) || 0) < 400) return;
    emitters.set(j.id, now); if (o.onChange) { try { o.onChange(snapshot(j)); } catch { /* listener failed */ } }
  };
  const sample = (j) => { const now = Date.now(); j.samples.push([now, j.received]); while (j.samples.length > 2 && now - j.samples[0][0] > 3000) j.samples.shift(); };
  const save = () => {
    if (!stateFile) return; clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const keep = [...jobs.values()].filter((j) => !['done', 'cancelled'].includes(j.state)).map((j) => ({ id: j.id, url: j.url, finalUrl: j.finalUrl, headers: j.headers, path: j.path, size: j.size, ranges: j.ranges, blocks: j.blocks.map((b) => [b.start, b.end, b.got]), started: j.started, etag: j.etag, state: j.state === 'error' ? 'error' : 'paused', error: j.error || '' }));
      try { fs.writeFileSync(stateFile, JSON.stringify(keep)); } catch { /* disk full or folder gone */ }
    }, 700);
  };

  function buildBlocks(j) {
    const size = j.size, conns = Math.max(1, opt.connections);
    if (!size) { j.blocks = []; return; }
    const split = j.ranges && size >= opt.minSplitMB * MB;
    const blockLen = split ? Math.max(1 * MB, Math.min(16 * MB, Math.ceil(size / (conns * 6)))) : size;
    j.blocks = []; for (let s = 0; s < size; s += blockLen) j.blocks.push({ start: s, end: Math.min(size, s + blockLen) - 1, got: 0, busy: false, fails: 0 });
  }
  const blockLen = (b) => b.end - b.start + 1;

  async function fetchBlock(j, b, signal) {
    const from = b.start + b.got;
    const res = await fetchFn(j.finalUrl, { headers: { ...j.headers, ...(j.ranges ? { Range: `bytes=${from}-${b.end}` } : {}) }, signal, redirect: 'follow' });
    if (j.ranges) {
      if (res.status !== 206) { try { await res.body.cancel(); } catch { /* closed */ } throw Object.assign(new Error(`the server answered ${res.status} to a range request`), { status: res.status }); }
      const m = /bytes\s+(\d+)-/.exec(res.headers.get('content-range') || '');
      if (m && +m[1] !== from) throw new Error('the server returned the wrong part of the file');
    } else if (res.status !== 200) { try { await res.body.cancel(); } catch { /* closed */ } throw Object.assign(new Error(`the server answered ${res.status}`), { status: res.status }); }
    const reader = res.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        let chunk = value; const room = b.end - (b.start + b.got) + 1;
        if (chunk.length > room) chunk = chunk.subarray(0, room);
        await limiter(chunk.length);
        await j.fh.write(chunk, 0, chunk.length, b.start + b.got);
        b.got += chunk.length; j.received += chunk.length; sample(j); emit(j);
        if (b.start + b.got > b.end) break;
      }
    } finally { try { await reader.cancel(); } catch { /* closed */ } }
    if (b.got < blockLen(b)) throw new Error('the connection closed early');
  }

  async function worker(j, index, signal) {
    while (!signal.aborted && index < j.maxConns) {
      const b = j.blocks.find((x) => x.got < blockLen(x) && !x.busy); if (!b) return;
      b.busy = true; j.active++;
      try { await fetchBlock(j, b, signal); b.fails = 0; }
      catch (e) {
        if (signal.aborted) return;
        b.fails++; j.fails++;
        if (j.fails >= 3 && j.maxConns > 1) { j.maxConns = Math.max(1, Math.floor(j.maxConns / 2)); j.fails = 0; } // the server is pushing back: use fewer connections
        if (b.fails > 5) throw e;
        await sleep(Math.min(8000, 300 * 2 ** b.fails));
      } finally { b.busy = false; j.active--; }
    }
  }

  // A server that tells us nothing about the size (or ignores ranges) is read as one stream.
  async function streamWhole(j, signal) {
    const res = await fetchFn(j.finalUrl, { headers: j.headers, signal, redirect: 'follow' });
    if (res.status !== 200) throw new Error(`the server answered ${res.status}`);
    const total = +(res.headers.get('content-length') || 0); if (total) j.size = total;
    j.received = 0; j.active = 1; const reader = res.body.getReader(); let pos = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        await limiter(value.length); await j.fh.write(value, 0, value.length, pos); pos += value.length; j.received = pos; sample(j); emit(j);
      }
    } finally { j.active = 0; try { await reader.cancel(); } catch { /* closed */ } }
    j.size = pos; j.blocks = [{ start: 0, end: Math.max(0, pos - 1), got: pos, busy: false, fails: 0 }];
  }

  async function run(j) {
    const ctl = new AbortController(); j.ctl = ctl; j.state = 'downloading'; j.error = ''; j.maxConns = Math.max(1, opt.connections); j.fails = 0; emit(j, true);
    try {
      if (!j.finalUrl) {
        const info = await probe(fetchFn, j.url, j.headers);
        if (!info.ok) throw new Error(info.error || `the server answered ${info.status}`);
        j.finalUrl = info.finalUrl; j.size = info.size; j.ranges = info.ranges; j.etag = info.etag;
        if (!j.path) j.path = uniquePath(j.dir, safeName(j.nameHint) || info.name);
      }
      if (!j.blocks.length && j.size) buildBlocks(j);
      fs.mkdirSync(path.dirname(j.path), { recursive: true });
      const part = j.path + '.part', fresh = !fs.existsSync(part);
      if (fresh) for (const b of j.blocks) b.got = 0;
      j.fh = await fs.promises.open(part, fresh ? 'w+' : 'r+');
      if (j.size && fresh) await j.fh.truncate(j.size);
      j.received = j.blocks.reduce((n, b) => n + b.got, 0); j.samples = [[Date.now(), j.received]];
      save();
      if (!j.size || !j.ranges && !j.blocks.length) await streamWhole(j, ctl.signal);
      else {
        if (!j.ranges) { for (const b of j.blocks) b.got = 0; j.received = 0; }
        await Promise.all(Array.from({ length: j.maxConns }, (_, i) => worker(j, i, ctl.signal)));
        if (ctl.signal.aborted) { if (j.fh) { try { await j.fh.close(); } catch { /* closed */ } j.fh = null; } return; }
        if (j.blocks.some((b) => b.got < blockLen(b))) throw new Error('the download did not complete');
      }
      await j.fh.close(); j.fh = null;
      let final = j.path; if (fs.existsSync(final)) final = uniquePath(path.dirname(final), path.basename(final));
      fs.renameSync(part, final); j.path = final; j.state = 'done'; j.finished = Date.now(); j.received = j.size || j.received;
      emit(j, true); save();
    } catch (e) {
      if (j.fh) { try { await j.fh.close(); } catch { /* closed */ } j.fh = null; }
      if (ctl.signal.aborted || j.state === 'paused' || j.state === 'cancelled') return;
      j.state = 'error'; j.error = e.message || String(e); ctl.abort(); emit(j, true); save();
    }
  }

  const make = (info) => ({ id: info.id || ++nextId, url: info.url, finalUrl: info.finalUrl || '', headers: info.headers || {}, dir: info.dir || process.cwd(), nameHint: info.name || '', path: info.path || '', size: info.size || 0, ranges: !!info.ranges, blocks: (info.blocks || []).map(([start, end, got]) => ({ start, end, got, busy: false, fails: 0 })), state: info.state || 'queued', received: 0, active: 0, samples: [], started: info.started || Date.now(), finished: 0, etag: info.etag || '', fails: 0, maxConns: 1, error: info.error || '' });

  return {
    probe: (url, headers) => probe(fetchFn, url, headers),
    // info: { url, headers, dir, name, probed?: { size, ranges, finalUrl, name } } -> starts right away
    add(info) {
      const j = make(info);
      if (info.probed && info.probed.ok) { j.finalUrl = info.probed.finalUrl; j.size = info.probed.size; j.ranges = info.probed.ranges; j.etag = info.probed.etag || ''; j.path = uniquePath(j.dir, safeName(info.name) || info.probed.name); buildBlocks(j); }
      jobs.set(j.id, j); j.runP = run(j); return snapshot(j);
    },
    pause(id) { const j = jobs.get(id); if (!j || j.state !== 'downloading') return; j.state = 'paused'; if (j.ctl) j.ctl.abort(); emit(j, true); save(); },
    resume(id) { const j = jobs.get(id); if (!j || !['paused', 'error', 'queued'].includes(j.state)) return; const prev = j.runP; j.runP = (async () => { if (prev) await prev.catch(() => {}); if (j.state !== 'cancelled') await run(j); })(); },
    cancel(id) {
      const j = jobs.get(id); if (!j) return; j.state = 'cancelled'; if (j.ctl) j.ctl.abort();
      setTimeout(() => { try { if (j.fh) j.fh.close().catch(() => {}); fs.rmSync(j.path + '.part', { force: true }); } catch { /* gone */ } }, 150);
      emit(j, true); jobs.delete(j.id); save();
    },
    remove(id) { jobs.delete(id); save(); },
    list: () => [...jobs.values()].map(snapshot),
    setOptions(p) { Object.assign(opt, p); },
    // after a restart: jobs that were not finished come back paused, ready to continue from where they stopped
    restore() {
      if (!stateFile) return;
      let saved = []; try { saved = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return; }
      for (const s of saved) {
        if (!s || !s.path || jobs.has(s.id)) continue;
        const j = make(s); j.state = 'paused'; j.received = j.blocks.reduce((n, b) => n + b.got, 0);
        if (!fs.existsSync(j.path + '.part')) { for (const b of j.blocks) b.got = 0; j.received = 0; }
        jobs.set(j.id, j); emit(j, true);
      }
    },
    shutdown() { for (const j of jobs.values()) if (j.state === 'downloading') { j.state = 'paused'; if (j.ctl) j.ctl.abort(); } clearTimeout(saveTimer); if (stateFile) { try { const keep = [...jobs.values()].filter((j) => !['done', 'cancelled'].includes(j.state)).map((j) => ({ id: j.id, url: j.url, finalUrl: j.finalUrl, headers: j.headers, path: j.path, size: j.size, ranges: j.ranges, blocks: j.blocks.map((b) => [b.start, b.end, b.got]), started: j.started, etag: j.etag, state: 'paused' })); fs.writeFileSync(stateFile, JSON.stringify(keep)); } catch { /* ignore */ } } },
  };
}

module.exports = { createDownloader, probe, nameFromResponse, safeName };
