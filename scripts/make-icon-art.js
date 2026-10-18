// Builds the drawings of the app icon: build/icon.svg (256 px and up) and build/icon-small.svg (48 px and down) from the star artwork in build/star.svg and build/star-small.svg.
// The icon is the star on a deep indigo tile with the shape of a soft square (a superellipse, like the icons of Windows 11), a faint glow behind the star, a light edge on top and a
// short shadow below, and it fills almost the whole canvas: the star alone was a thin shape with a lot of empty room around it and looked small on the desktop.
// Run with: node scripts/make-icon-art.js, then: electron scripts/make-icons.js
const fs = require('fs'), path = require('path');
const B = (f) => path.join(__dirname, '..', 'build', f);
// a superellipse: |x|^n + |y|^n = r^n, as a closed path (n = 5 is the soft square of the Windows icons)
function squircle(cx, cy, r, n = 5, steps = 180) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    pts.push([cx + r * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), cy + r * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]);
  }
  return 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
}
const parts = (svg) => {
  const defs = (/<defs>([\s\S]*?)<\/defs>/.exec(svg) || [, ''])[1];
  const body = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<defs>[\s\S]*?<\/defs>/, '');
  return { defs, body };
};
function build({ star, margin, scale, dy, shadow, glow }) {
  const { defs, body } = parts(fs.readFileSync(B(star), 'utf8')), r = 256 - margin, tile = squircle(256, 256, r);
  const sh = shadow ? `<path d="${squircle(256, 256 + shadow.dy, r)}" fill="#05030f" opacity="${shadow.o}" filter="url(#tsh)"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${defs}
<linearGradient id="tbg" x1="0.15" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="#4635b8"/><stop offset="0.5" stop-color="#1e1560"/><stop offset="1" stop-color="#0d0929"/></linearGradient>
<radialGradient id="tgl" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#8a74ff" stop-opacity="${glow}"/><stop offset="0.5" stop-color="#6a4cff" stop-opacity="${(glow * 0.35).toFixed(2)}"/><stop offset="1" stop-color="#6a4cff" stop-opacity="0"/></radialGradient>
<linearGradient id="tedge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.34"/><stop offset="0.35" stop-color="#ffffff" stop-opacity="0.06"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
<clipPath id="tclip"><path d="${tile}"/></clipPath>
<filter id="tsh" x="-15%" y="-15%" width="130%" height="135%"><feGaussianBlur stdDeviation="9"/></filter></defs>
${sh}<path d="${tile}" fill="url(#tbg)"/>
<g clip-path="url(#tclip)"><circle cx="256" cy="256" r="${Math.round(r * 0.98)}" fill="url(#tgl)"/></g>
<g transform="translate(256 ${256 + dy}) scale(${scale}) translate(-256 -256)">${body}</g>
<path d="${tile}" fill="none" stroke="url(#tedge)" stroke-width="3"/></svg>`;
}
fs.writeFileSync(B('icon.svg'), build({ star: 'star.svg', margin: 18, scale: 1.0, dy: 10, shadow: { dy: 7, o: 0.5 }, glow: 0.55 }));
fs.writeFileSync(B('icon-small.svg'), build({ star: 'star-small.svg', margin: 6, scale: 1.04, dy: 8, shadow: null, glow: 0.45 }));
console.log('wrote build/icon.svg and build/icon-small.svg');
