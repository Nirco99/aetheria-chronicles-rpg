// Generates the app icon procedurally (no binary assets in the repo): build/icon.png (256px)
// and build/icon.ico (16/24/32/48/64/128/256 PNG-compressed entries).
// Usage: node scripts/make-icon.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build');
mkdirSync(out, { recursive: true });

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- vector scene in a 64x64 design space, sampled 4x4 per pixel
const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function roundRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.max(x0 + r, Math.min(x1 - r, x));
  const cy = Math.max(y0 + r, Math.min(y1 - r, y));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function inPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const BLADE = [[32, 5], [37.2, 13], [36, 38], [28, 38], [26.8, 13]];
function shade(x, y) {
  // background: deep night-blue rounded square with a cyan rim glow
  if (!roundRect(x, y, 2, 2, 62, 62, 13)) return null;
  const d = Math.hypot(x - 32, y - 26) / 40;
  let col = [lerp(22, 5, d), lerp(40, 8, d), lerp(78, 18, d)];
  if (!roundRect(x, y, 3.4, 3.4, 60.6, 60.6, 11.8)) col = [96, 200, 230];
  // aura behind the blade
  const glow = Math.max(0, 1 - Math.hypot((x - 32) * 1.6, y - 22) / 26);
  col = col.map((c, i) => c + glow * [60, 160, 190][i] * 0.55);
  // blade with a light edge and a white-hot core
  if (inPoly(x, y, BLADE)) {
    const edge = x < 32 ? hex('#bff3ff') : hex('#5fc8ec');
    const core = Math.abs(x - 32) < 0.8 && y > 9 ? [255, 255, 255] : edge;
    col = core;
  }
  // crossguard
  if (roundRect(x, y, 19, 37, 45, 42, 2)) col = y < 39 ? hex('#ffd98a') : hex('#d9a12a');
  // grip and pommel
  if (roundRect(x, y, 29.2, 42, 34.8, 54, 1.5)) col = (Math.floor(y) % 3 === 0) ? hex('#5a3820') : hex('#8a5a2b');
  if (Math.hypot(x - 32, y - 56.5) < 3.4) col = hex('#ffd166');
  // four-point star glint at the tip
  const sx = x - 32;
  const sy = y - 8;
  if (Math.abs(sx) * Math.abs(sy) < 2.2 && Math.abs(sx) + Math.abs(sy) < 9) col = [255, 255, 255];
  return col.map((c) => Math.max(0, Math.min(255, Math.round(c))));
}
function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  const S = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = ((px + (sx + 0.5) / S) / size) * 64;
          const y = ((py + (sy + 0.5) / S) / size) * 64;
          const c = shade(x, y);
          if (!c) continue;
          r += c[0];
          g += c[1];
          b += c[2];
          a++;
        }
      }
      const i = (py * size + px) * 4;
      if (a) {
        buf[i] = r / a;
        buf[i + 1] = g / a;
        buf[i + 2] = b / a;
      }
      buf[i + 3] = Math.round((a / (S * S)) * 255);
    }
  }
  return png(size, buf);
}

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = sizes.map((s) => render(s));
writeFileSync(join(out, 'icon.png'), pngs[pngs.length - 1]);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
const dir = Buffer.alloc(16 * sizes.length);
let offset = 6 + dir.length;
sizes.forEach((s, i) => {
  const o = i * 16;
  dir[o] = s >= 256 ? 0 : s;
  dir[o + 1] = s >= 256 ? 0 : s;
  dir.writeUInt16LE(1, o + 4);
  dir.writeUInt16LE(32, o + 6);
  dir.writeUInt32LE(pngs[i].length, o + 8);
  dir.writeUInt32LE(offset, o + 12);
  offset += pngs[i].length;
});
writeFileSync(join(out, 'icon.ico'), Buffer.concat([header, dir, ...pngs]));
console.log(`icon.png + icon.ico (${sizes.join(', ')} px) written to ${out}`);
