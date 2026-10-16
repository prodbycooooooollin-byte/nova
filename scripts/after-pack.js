// electron-builder afterPack hook: drop files Nova never uses. The Setup exe unpacks and copies the whole folder, so every megabyte here
// costs install time on slow disks. (dxcompiler/dxil only serve WebGPU shader compilation; the GPU, WebGL and the software fallback keep working.)
const fs = require('fs'), path = require('path');
exports.default = async (context) => {
  const dir = context.appOutDir; let freed = 0;
  for (const f of ['dxcompiler.dll', 'dxil.dll']) {
    const p = path.join(dir, f);
    try { freed += fs.statSync(p).size; fs.rmSync(p); } catch {}
  }
  console.log(`  • afterPack removed ${(freed / 1048576).toFixed(1)} MB of unused runtime files`);
};
