// Nova's signature motion: a point of light goes supernova. A white flash, shock rings, long lens-flare spikes, rays and a few hundred
// streaking sparks, then the debris settles into a quiet field of stars with faint constellations and now and then a shooting star.
// Used by the installer, the update screen and the first-run setup. The page's own CSS provides the black behind it.
// NovaSky(canvas, { fps, origin: () => ({x, y}) in CSS pixels, accent: () => colour, delay, burst: false })
//   -> { burst(power = 1), setBoost(0..1.5) fly through the stars, stop() }
function NovaSky(canvas, opts = {}) {
  const g = canvas.getContext('2d'), dpr = devicePixelRatio || 1;
  const accent = () => (opts.accent && opts.accent()) || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8b7dff';
  let W = 0, H = 0, stars = [], parts = [], embers = [], rings = [], rays = [], shoots = [], flash = 0, wash = 0, spikes = 0, rayA = 0;
  let boost = 0, mx = 0, my = 0, raf = 0, last = 0, lastDraw = 0, nextShoot = 2600;
  const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)];
  function size() {
    const r = canvas.getBoundingClientRect(); W = canvas.width = Math.max(1, r.width * dpr); H = canvas.height = Math.max(1, r.height * dpr);
    stars = Array.from({ length: Math.round(Math.min(320, (r.width * r.height) / 4200)) }, () => ({ x: Math.random() * W, y: Math.random() * H, z: rnd(.15, 1), p: rnd(0, 6.3), s: rnd(.4, 1) }));
  }
  function origin() { const o = opts.origin ? opts.origin() : null; return o ? { x: o.x * dpr, y: o.y * dpr } : { x: W / 2, y: H / 2 }; }
  function burst(power = 1) {
    const o = origin(), now = performance.now(), ac = accent(), pal = ['#ffffff', '#ffffff', '#ffffff', ac, ac, '#9be7ff', '#ffb0e0', '#ffd9a3', '#c9bbff'], far = Math.max(W, H);
    for (let i = 0; i < Math.round(460 * power); i++) {
      const a = rnd(0, 6.283), v = rnd(2, 25) * dpr * Math.sqrt(power) * (Math.random() < .12 ? 1.7 : 1);
      parts.push({ x: o.x, y: o.y, px: o.x, py: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rnd(1.2, 3.4), w: rnd(.5, 2.3) * dpr, c: pick(pal) });
    }
    for (let i = 0; i < Math.round(90 * power); i++) { // slower, brighter embers that hang in the air and flicker
      const a = rnd(0, 6.283), v = rnd(.6, 6) * dpr;
      embers.push({ x: o.x, y: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rnd(2, 5.2), r: rnd(1.2, 3.6) * dpr, c: pick(pal), p: rnd(0, 6.3) });
    }
    [0, 140, 310].forEach((d, i) => rings.push({ x: o.x, y: o.y, r: 0, at: now + d, v: (15 - i * 3) * dpr * Math.sqrt(power), a: .9 - i * .15, w: (4 - i) * dpr, c: i === 1 ? ac : i === 2 ? '#9be7ff' : '#ffffff' }));
    rays = Array.from({ length: 26 }, () => ({ x: o.x, y: o.y, ang: rnd(0, 6.283), len: rnd(.3, 1) * far * power, wid: rnd(.012, .055), a: rnd(.12, .32) }));
    flash = 1; wash = Math.min(.7, .5 * power); spikes = 1; rayA = 1;
  }
  const star4 = (x, y, rx, ry) => { g.beginPath(); g.moveTo(x, y - ry); g.quadraticCurveTo(x, y, x + rx, y); g.quadraticCurveTo(x, y, x, y + ry); g.quadraticCurveTo(x, y, x - rx, y); g.quadraticCurveTo(x, y, x, y - ry); g.fill(); };
  function frame(t) {
    if (opts.fps && (t - lastDraw < 1000 / opts.fps - 2 || document.hidden)) { raf = requestAnimationFrame(frame); return; } lastDraw = t;
    if (!canvas.isConnected) { stop(); return; } // overlay closed: stop quietly
    const dt = Math.min(.05, (t - last) / 1000 || .016); last = t;
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
    const ac = accent(), o = origin();
    // drifting stars; with boost they stretch into streaks (a jump to light speed)
    for (const s of stars) {
      s.y += (s.z * .22 + boost * 11 * s.z) * dpr * s.s * (dt * 60); if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
      const x = s.x + mx * -26 * s.z * dpr, y = s.y + my * -26 * s.z * dpr, tw = .45 + .55 * Math.sin(t / 800 + s.p);
      g.globalAlpha = s.z * tw * .9; g.fillStyle = s.z > .88 ? ac : '#fff';
      if (boost > .15) { g.strokeStyle = g.fillStyle; g.lineWidth = s.z * 1.4 * dpr; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - boost * 70 * s.z * dpr); g.stroke(); } else { g.beginPath(); g.arc(x, y, s.z * 1.5 * dpr, 0, 6.283); g.fill(); }
    }
    // faint constellations between close, bright stars
    if (boost < .15) {
      g.lineWidth = .6 * dpr; g.strokeStyle = ac;
      for (let i = 0; i < stars.length; i += 2) for (let j = i + 1; j < Math.min(stars.length, i + 7); j++) {
        const a = stars[i], b = stars[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 120 * dpr && a.z > .5 && b.z > .5) { g.globalAlpha = (1 - d / (120 * dpr)) * .22; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
      }
    }
    // a shooting star every few seconds
    nextShoot -= dt * 1000;
    if (nextShoot < 0 && boost < .15) { nextShoot = rnd(3500, 7500); const a = rnd(.35, .6); shoots.push({ x: rnd(0, W * .7), y: rnd(0, H * .35), vx: Math.cos(a) * 15 * dpr, vy: Math.sin(a) * 15 * dpr, age: 0, life: rnd(.7, 1.1) }); }
    g.globalCompositeOperation = 'lighter';
    for (const s of shoots) {
      s.age += dt; s.x += s.vx * (dt * 60); s.y += s.vy * (dt * 60);
      const k = Math.max(0, 1 - s.age / s.life), tx = s.x - s.vx * 11, ty = s.y - s.vy * 11, gr = g.createLinearGradient(s.x, s.y, tx, ty);
      gr.addColorStop(0, 'rgba(255,255,255,' + (.95 * k) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalAlpha = 1; g.strokeStyle = gr; g.lineWidth = 1.8 * dpr; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(tx, ty); g.stroke();
    }
    shoots = shoots.filter((s) => s.age < s.life);
    // god rays out of the explosion
    if (rayA > .01) {
      for (const r of rays) {
        const gr = g.createLinearGradient(r.x, r.y, r.x + Math.cos(r.ang) * r.len, r.y + Math.sin(r.ang) * r.len);
        gr.addColorStop(0, 'rgba(255,255,255,' + (r.a * rayA) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.moveTo(r.x, r.y); g.lineTo(r.x + Math.cos(r.ang - r.wid) * r.len, r.y + Math.sin(r.ang - r.wid) * r.len); g.lineTo(r.x + Math.cos(r.ang + r.wid) * r.len, r.y + Math.sin(r.ang + r.wid) * r.len); g.fill();
      }
      rayA *= Math.pow(.32, dt);
    }
    // shock rings
    const now = performance.now(), far = Math.max(W, H) * 1.2;
    for (const r of rings) {
      if (now < r.at) continue;
      r.r += r.v * (dt * 60) * (1 - r.r / far); r.a *= Math.pow(.55, dt);
      g.globalAlpha = r.a; g.strokeStyle = r.c; g.lineWidth = Math.max(.8 * dpr, r.w * (1 - r.r / far)); g.beginPath(); g.arc(r.x, r.y, r.r, 0, 6.283); g.stroke();
    }
    rings = rings.filter((r) => r.a > .02 && r.r < far);
    // sparks: streaks that slow down and die
    for (const p of parts) {
      p.age += dt; if (p.age > p.life) continue;
      const f = Math.pow(.965, dt * 60); p.px = p.x; p.py = p.y; p.vx *= f; p.vy *= f; p.x += p.vx * (dt * 60); p.y += p.vy * (dt * 60);
      g.globalAlpha = Math.max(0, 1 - p.age / p.life); g.strokeStyle = p.c; g.lineWidth = p.w; g.beginPath(); g.moveTo(p.px, p.py); g.lineTo(p.x, p.y); g.stroke();
    }
    parts = parts.filter((p) => p.age < p.life);
    for (const e of embers) {
      e.age += dt; if (e.age > e.life) continue;
      const f = Math.pow(.985, dt * 60); e.vx *= f; e.vy *= f; e.x += e.vx * (dt * 60); e.y += e.vy * (dt * 60);
      const k = Math.max(0, 1 - e.age / e.life), fl = .55 + .45 * Math.sin(t / 90 + e.p);
      g.globalAlpha = k * fl; g.fillStyle = e.c; g.beginPath(); g.arc(e.x, e.y, e.r * (.6 + k * .6), 0, 6.283); g.fill();
    }
    embers = embers.filter((e) => e.age < e.life);
    // the flash itself: a hot core, a coloured halo, and spikes that cross the whole window
    if (flash > .01) {
      const L = Math.max(W, H) * .55 * flash + 90 * dpr, gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, L);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.22, 'rgba(255,255,255,.4)'); gr.addColorStop(.5, ac + '55'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = Math.min(1, flash * 1.1); g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, L, 0, 6.283); g.fill();
      flash *= Math.pow(.18, dt);
    }
    if (spikes > .01) {
      const L = Math.max(W, H) * 1.1 * (.35 + spikes * .65), T = 2.2 * dpr;
      g.globalAlpha = spikes * .9; g.fillStyle = '#fff'; star4(o.x, o.y, L, L * .55);
      g.globalAlpha = spikes * .55; g.fillStyle = ac; g.save(); g.translate(o.x, o.y); g.rotate(Math.PI / 4); star4(0, 0, L * .42, L * .24); g.restore();
      g.globalAlpha = spikes * .8; g.fillStyle = '#fff'; g.fillRect(o.x - L, o.y - T / 2, L * 2, T); g.fillRect(o.x - T / 2, o.y - L * .6, T, L * 1.2);
      spikes *= Math.pow(.24, dt);
    }
    if (wash > .01) { g.globalAlpha = wash; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); wash *= Math.pow(.0009, dt); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; raf = requestAnimationFrame(frame);
  }
  const move = (e) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; };
  function stop() { cancelAnimationFrame(raf); removeEventListener('mousemove', move); removeEventListener('resize', size); }
  addEventListener('mousemove', move); addEventListener('resize', size); size(); raf = requestAnimationFrame(frame);
  if (opts.burst !== false) setTimeout(() => burst(1), opts.delay ?? 250);
  return { burst, setBoost: (v) => { boost = v; }, stop };
}
