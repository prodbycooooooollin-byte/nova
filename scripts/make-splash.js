// Run with: electron scripts/make-splash.js  -> build/splash.bmp
// The Setup exe unpacks itself to a temp folder before its window can open, which takes seconds. The portable launcher shows this
// image during that time, so nobody double-clicks again and piles up more unpacking.
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const W = 480, H = 270;
  const win = new BrowserWindow({ show: false, width: W, height: H, useContentSize: true, frame: false, webPreferences: { offscreen: true } });
  await win.loadFile(path.join(__dirname, '../build/splash.html'));
  await new Promise((r) => setTimeout(r, 700));
  const img = (await win.webContents.capturePage()).resize({ width: W, height: H, quality: 'best' });
  const bgra = img.toBitmap(), rowBytes = W * 3; // 24-bit BMP, rows bottom-up, BGR
  const pix = Buffer.alloc(rowBytes * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = (y * W + x) * 4, d = (H - 1 - y) * rowBytes + x * 3; pix[d] = bgra[s]; pix[d + 1] = bgra[s + 1]; pix[d + 2] = bgra[s + 2]; }
  const head = Buffer.alloc(54); head.write('BM'); head.writeUInt32LE(54 + pix.length, 2); head.writeUInt32LE(54, 10);
  head.writeUInt32LE(40, 14); head.writeInt32LE(W, 18); head.writeInt32LE(H, 22); head.writeUInt16LE(1, 26); head.writeUInt16LE(24, 28); head.writeUInt32LE(pix.length, 34);
  fs.writeFileSync(path.join(__dirname, '../build/splash.bmp'), Buffer.concat([head, pix]));
  app.quit();
});
