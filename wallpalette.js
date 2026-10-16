// Colours from a picture: finds the hue that carries the picture and builds a full Nova theme around it.
// Pure functions on a BGRA bitmap (what nativeImage.toBitmap() returns), so it does not touch Electron.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

// bmp: BGRA bytes of a small copy of the picture (about 48 px wide is plenty)
function paletteFromBitmap(bmp) {
  const BINS = 36, weight = new Array(BINS).fill(0), sat = new Array(BINS).fill(0), light = new Array(BINS).fill(0), hueSum = new Array(BINS).fill(0);
  let total = 0, pixels = 0;
  for (let i = 0; i + 3 < bmp.length; i += 4) {
    if (bmp[i + 3] < 128) continue;
    const [h, s, l] = rgbToHsl(bmp[i + 2], bmp[i + 1], bmp[i]);
    pixels++;
    const vivid = s * (1 - Math.abs(2 * l - 1)); // saturated and neither near-black nor near-white
    if (vivid < 0.04) continue;
    const bin = Math.floor(h / (360 / BINS)) % BINS;
    weight[bin] += vivid; sat[bin] += s * vivid; light[bin] += l * vivid; hueSum[bin] += h * vivid; total += vivid;
  }
  let best = 0;
  for (let b = 1; b < BINS; b++) if (weight[b] + (weight[(b + 1) % BINS] + weight[(b + BINS - 1) % BINS]) * 0.5 > weight[best] + (weight[(best + 1) % BINS] + weight[(best + BINS - 1) % BINS]) * 0.5) best = b;
  const grey = !pixels || total / pixels < 0.02 || !weight[best]; // a picture without a real colour: stay neutral
  if (grey) return { bg: '#111112', page: '#1d1d1f', surface: '#18181a', surface2: '#242427', text: '#eeeeef', dim: '#8f8f95', accent: '#e5e5e8' };
  const hue = hueSum[best] / weight[best], s = sat[best] / weight[best];
  const tint = clamp(0.16 + s * 0.3, 0.2, 0.42); // how much colour the dark surfaces carry
  return {
    bg: hslToHex(hue, tint, 0.06),
    surface: hslToHex(hue, tint, 0.09),
    page: hslToHex(hue, tint, 0.115),
    surface2: hslToHex(hue, tint, 0.14),
    text: hslToHex(hue, 0.3, 0.94),
    dim: hslToHex(hue, 0.14, 0.62),
    accent: hslToHex(hue, clamp(s * 1.1, 0.55, 0.92), 0.7),
  };
}

module.exports = { paletteFromBitmap, hslToHex, rgbToHsl };
