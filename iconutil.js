// Site icons are drawn at 16 to 22 px. Nova keeps every raster icon at 48 px at most, as a PNG: about 1 to 8 KB instead of up to 70 KB each,
// which keeps icons.json (read at start, rewritten when it changes, sent to the interface for the bookmarks bar) small.
function shrink(buf) {
  try {
    const { nativeImage } = require('electron');
    const img = nativeImage.createFromBuffer(buf); if (!img || img.isEmpty()) return null;
    const { width, height } = img.getSize(), m = Math.max(width, height);
    const out = m > 48 ? img.resize({ width: Math.max(1, Math.round(width * 48 / m)), height: Math.max(1, Math.round(height * 48 / m)), quality: 'best' }) : img;
    return out.toPNG();
  } catch { return null; }
}
// an .ico holds the same icon in several sizes (often up to 256 px, 20 to 50 KB): keep the one that fits 48 px best, as the PNG inside it or as a one-size .ico
function icoPick(buf) {
  if (buf.length < 22 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  const n = buf.readUInt16LE(4), ents = [];
  for (let i = 0; i < n; i++) { const o = 6 + i * 16; if (o + 16 > buf.length) break; const w = buf[o] || 256, h = buf[o + 1] || 256, size = buf.readUInt32LE(o + 8), off = buf.readUInt32LE(o + 12); if (size > 0 && off + size <= buf.length) ents.push({ o, w, h, size, off, bpp: buf.readUInt16LE(o + 6) }); }
  if (!ents.length) return null;
  const px = (e) => Math.max(e.w, e.h), best = ents.map((e) => ({ e, s: Math.abs(px(e) - 48) + (px(e) < 32 ? 40 : 0) - (e.bpp >= 24 ? 5 : 0) })).sort((a, b) => a.s - b.s)[0].e;
  const data = buf.subarray(best.off, best.off + best.size);
  if (data.length > 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e) return { png: Buffer.from(data) };
  const out = Buffer.alloc(22 + data.length); out.writeUInt16LE(0, 0); out.writeUInt16LE(1, 2); out.writeUInt16LE(1, 4);
  buf.copy(out, 6, best.o, best.o + 16); out.writeUInt32LE(22, 6 + 12); data.copy(out, 22);
  return { ico: out };
}
// a data URL of a raster icon, made smaller when that helps; vector and unknown types stay as they are
function shrinkData(dataUrl) {
  const m = /^data:(image\/(?:png|x-icon|vnd\.microsoft\.icon|jpeg|webp|gif));base64,(.+)$/s.exec(String(dataUrl)); if (!m) return dataUrl;
  const buf = Buffer.from(m[2], 'base64');
  if (/icon/.test(m[1])) { // .ico: the best size out of the container first
    const p = icoPick(buf); if (!p) return dataUrl;
    if (p.png) { const png = shrink(p.png) || p.png; return png.length < buf.length ? 'data:image/png;base64,' + png.toString('base64') : dataUrl; }
    return p.ico.length < buf.length ? 'data:image/x-icon;base64,' + p.ico.toString('base64') : dataUrl;
  }
  const png = shrink(buf);
  return png && png.length < buf.length ? 'data:image/png;base64,' + png.toString('base64') : dataUrl;
}
module.exports = { shrink, shrinkData, icoPick };
