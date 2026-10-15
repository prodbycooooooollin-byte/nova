// Nova's signature motion: a point of light goes supernova, the debris settles into a quiet field of stars,
// and nearby stars connect into faint constellations. Used by the setup (browser onboarding) and the installer.
function NovaSky(canvas, opts = {}) {
  const g = canvas.getContext('2d'), dpr = devicePixelRatio || 1;
  const accent = () => (opts.accent && opts.accent()) || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8b7dff';
  let W = 0, H = 0, stars = [], parts = [], ring = null, flare = 0, boost = 0, mx = 0, my = 0, raf = 0, last = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function size() {
    const r = canvas.getBoundingClientRect(); W = canvas.width = Math.max(1, r.width * dpr); H = canvas.height = Math.max(1, r.height * dpr);
    stars = Array.from({ length: Math.round(Math.min(260, (r.width * r.height) / 5200)) }, () => ({ x: Math.random() * W, y: Math.random() * H, z: rnd(.15, 1), p: rnd(0, 6.3), s: rnd(.4, 1) }));
  }
  function origin() { const o = opts.origin ? opts.origin() : null; return o ? { x: o.x * dpr, y: o.y * dpr } : { x: W / 2, y: H / 2 }; }
  function burst() {
    const o = origin(), pal = ['#ffffff', accent(), '#ffd9a3', '#ffffff'];
    parts = Array.from({ length: 280 }, () => { const a = rnd(0, 6.283), v = rnd(2, 15) * dpr * (Math.random() < .15 ? 1.8 : 1); return { x: o.x, y: o.y, px: o.x, py: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(.9, 2.6), age: 0, c: pal[(Math.random() * pal.length) | 0], w: rnd(.6, 1.8) * dpr }; });
    ring = { x: o.x, y: o.y, r: 0, a: .8 }; flare = 1;
  }
  function frame(t) {
    const dt = Math.min(.05, (t - last) / 1000 || .016); last = t;
    g.clearRect(0, 0, W, H);
    const ac = accent();
    // drifting stars
    for (const s of stars) {
      s.y += (s.z * .22 + boost * 9 * s.z) * dpr * s.s; if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
      const x = s.x + mx * -26 * s.z * dpr, y = s.y + my * -26 * s.z * dpr, tw = .45 + .55 * Math.sin(t / 800 + s.p);
      g.globalAlpha = s.z * tw * .9; g.fillStyle = s.z > .88 ? ac : '#fff';
      if (boost > .15) { g.strokeStyle = g.fillStyle; g.lineWidth = s.z * 1.3 * dpr; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - boost * 60 * s.z * dpr); g.stroke(); } else { g.beginPath(); g.arc(x, y, s.z * 1.25 * dpr, 0, 6.283); g.fill(); }
    }
    // constellations between close, bright stars
    if (boost < .15) {
      g.lineWidth = .6 * dpr;
      for (let i = 0; i < stars.length; i += 2) for (let j = i + 1; j < Math.min(stars.length, i + 7); j++) {
        const a = stars[i], b = stars[j], d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 120 * dpr && a.z > .5 && b.z > .5) { g.globalAlpha = (1 - d / (120 * dpr)) * .22; g.strokeStyle = ac; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
      }
    }
    // supernova debris
    for (const p of parts) {
      p.age += dt; if (p.age > p.life) continue; p.px = p.x; p.py = p.y; p.vx *= .965; p.vy *= .965; p.x += p.vx; p.y += p.vy;
      g.globalAlpha = Math.max(0, 1 - p.age / p.life); g.strokeStyle = p.c; g.lineWidth = p.w; g.beginPath(); g.moveTo(p.px, p.py); g.lineTo(p.x, p.y); g.stroke();
    }
    parts = parts.filter((p) => p.age < p.life);
    if (ring) { ring.r += 14 * dpr * (1 - ring.r / (Math.max(W, H))); ring.a *= .965; g.globalAlpha = ring.a; g.strokeStyle = ac; g.lineWidth = 1.4 * dpr; g.beginPath(); g.arc(ring.x, ring.y, ring.r, 0, 6.283); g.stroke(); if (ring.a < .01) ring = null; }
    if (flare > .01) { const o = origin(), L = 420 * dpr * flare; const gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, L * .5); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.25, ac + '66'); gr.addColorStop(1, 'transparent'); g.globalAlpha = flare; g.fillStyle = gr; g.fillRect(o.x - L, o.y - L, L * 2, L * 2);
      g.globalAlpha = flare * .85; g.fillStyle = '#fff'; g.fillRect(o.x - L, o.y - .8 * dpr, L * 2, 1.6 * dpr); g.fillRect(o.x - .8 * dpr, o.y - L * .7, 1.6 * dpr, L * 1.4); flare *= .955; }
    g.globalAlpha = 1; raf = requestAnimationFrame(frame);
  }
  const move = (e) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; };
  addEventListener('mousemove', move); addEventListener('resize', size); size(); raf = requestAnimationFrame(frame);
  if (opts.burst !== false) setTimeout(burst, opts.delay ?? 250);
  return { burst, setBoost: (v) => { boost = v; }, stop: () => { cancelAnimationFrame(raf); removeEventListener('mousemove', move); removeEventListener('resize', size); } };
}
