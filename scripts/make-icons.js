// Run with: electron scripts/make-icons.js  -> build/icon.png, build/icon.ico
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../build/icon.svg'), 'utf8');
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const win = new BrowserWindow({ show: false, width: 256, height: 256, transparent: true, frame: false, webPreferences: { offscreen: true } });
  const pngs = [];
  for (const s of sizes) {
    win.setContentSize(s, s);
    await win.loadURL('data:text/html,' + encodeURIComponent(`<body style="margin:0;background:transparent;overflow:hidden"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${s}" height="${s}" style="display:block">`));
    await new Promise((r) => setTimeout(r, 250));
    const img = await win.webContents.capturePage();
    pngs.push({ s, buf: img.resize({ width: s, height: s, quality: 'best' }).toPNG() });
  }
  fs.writeFileSync(path.join(__dirname, '../build/icon.png'), pngs.find((p) => p.s === 256).buf);
  // build .ico with embedded PNGs
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length; const dir = [], data = [];
  for (const p of pngs) {
    const e = Buffer.alloc(16); e[0] = p.s === 256 ? 0 : p.s; e[1] = p.s === 256 ? 0 : p.s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(p.buf.length, 8); e.writeUInt32LE(offset, 12);
    offset += p.buf.length; dir.push(e); data.push(p.buf);
  }
  fs.writeFileSync(path.join(__dirname, '../build/icon.ico'), Buffer.concat([head, ...dir, ...data]));
  app.quit();
});
