// Procedural oblique prop sprites (trees, rocks, buildings, gates, dungeon entrances, decor,
// furniture). Each is painted once into an offscreen canvas keyed by Prop.sprite.
import type { Prop } from '../types/game';
import { REALMS } from '../data/realms';
import { TILE } from '../data/constants';
import { hash2, mix, rgba, shade } from '../engine/util';

let SCALE = 2;
const cache = new Map<string, HTMLCanvasElement>();

export function setPropScale(s: number): void {
  const n = Math.max(1, Math.min(3, Math.ceil(s)));
  if (n !== SCALE) {
    SCALE = n;
    cache.clear();
  }
}

type G2 = CanvasRenderingContext2D;

function canvas(w: number, h: number, paint: (g: G2) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SCALE);
  c.height = Math.ceil(h * SCALE);
  const g = c.getContext('2d') as G2;
  g.scale(SCALE, SCALE);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  paint(g);
  return c;
}

function shadow(g: G2, x: number, y: number, rx: number, ry: number, a = 0.3): void {
  g.fillStyle = `rgba(0,0,0,${a})`;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

function blob(g: G2, x: number, y: number, r: number, c: string): void {
  g.fillStyle = c;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

// ------------------------------------------------------------------ nature

function tree(g: G2, realm: number, tk: string, v: number): void {
  const P = REALMS[realm].palette;
  const bx = 40;
  const by = 112;
  shadow(g, bx, by - 2, 22, 7);
  const trunk = P.trunk;
  if (tk === 'charred') {
    g.strokeStyle = '#1e1614';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx + 2, by - 60);
    g.stroke();
    g.lineWidth = 3;
    for (const [dx, dy, ex, ey] of [[0, -40, -18, -64], [2, -52, 20, -78], [1, -30, 16, -44], [2, -60, -6, -88]]) {
      g.beginPath();
      g.moveTo(bx + dx, by + dy);
      g.lineTo(bx + ex, by + ey);
      g.stroke();
    }
    for (let i = 0; i < 6; i++) blob(g, bx - 16 + hash2(i, v, 3) * 32, by - 30 - hash2(i, v, 5) * 50, 1.4, '#ff7a3d');
    return;
  }
  if (tk === 'pine') {
    g.fillStyle = trunk;
    g.fillRect(bx - 4, by - 22, 8, 22);
    for (let i = 0; i < 4; i++) {
      const w = 34 - i * 7;
      const y = by - 20 - i * 20;
      g.fillStyle = shade(P.leaf, i * 0.05 - 0.05);
      g.beginPath();
      g.moveTo(bx - w, y);
      g.lineTo(bx, y - 30);
      g.lineTo(bx + w, y);
      g.closePath();
      g.fill();
      g.fillStyle = '#f4f9ff';
      g.beginPath();
      g.moveTo(bx - w * 0.55, y - 13);
      g.lineTo(bx, y - 30);
      g.lineTo(bx + w * 0.55, y - 13);
      g.quadraticCurveTo(bx, y - 8, bx - w * 0.55, y - 13);
      g.fill();
    }
    return;
  }
  if (tk === 'crystal') {
    g.fillStyle = shade(P.rock, -0.2);
    g.beginPath();
    g.ellipse(bx, by - 6, 18, 8, 0, 0, Math.PI * 2);
    g.fill();
    const cols = ['#bfe6ff', '#e0c8ff', '#ffffff'];
    for (let i = 0; i < 5; i++) {
      const x = bx - 14 + i * 7;
      const h = 40 + hash2(i, v, 9) * 50;
      g.fillStyle = rgba(cols[i % 3], 0.85);
      g.beginPath();
      g.moveTo(x - 5, by - 8);
      g.lineTo(x, by - 8 - h);
      g.lineTo(x + 5, by - 8);
      g.closePath();
      g.fill();
      g.strokeStyle = rgba('#ffffff', 0.7);
      g.lineWidth = 0.8;
      g.stroke();
    }
    return;
  }
  // broadleaf variants
  const glow = tk === 'glow';
  g.fillStyle = glow ? '#3e3048' : trunk;
  g.beginPath();
  g.moveTo(bx - 6, by);
  g.quadraticCurveTo(bx - 3, by - 20, bx - 4, by - (glow ? 64 : 46));
  g.lineTo(bx + 4, by - (glow ? 64 : 46));
  g.quadraticCurveTo(bx + 3, by - 20, bx + 7, by);
  g.closePath();
  g.fill();
  g.fillStyle = rgba('#000000', 0.25);
  g.fillRect(bx, by - 40, 4, 40);
  const leaf = tk === 'blossom' ? '#f2a6c4' : P.leaf;
  const leaf2 = tk === 'blossom' ? '#ffd6e8' : glow ? '#2a8a7a' : P.leaf2;
  const cy = glow ? by - 76 : by - 62;
  const cl: [number, number, number][] = [[-16, 6, 20], [16, 6, 20], [0, -10, 25], [-8, 14, 16], [10, 16, 16]];
  for (const [dx, dy, r] of cl) blob(g, bx + dx, cy + dy, r + v, shade(leaf, -0.18));
  for (const [dx, dy, r] of cl) blob(g, bx + dx - 2, cy + dy - 3, r - 3 + v, leaf);
  for (let i = 0; i < 7; i++) blob(g, bx - 18 + hash2(i, v, 2) * 36, cy - 14 + hash2(i, v, 4) * 28, 4 + hash2(i, v, 6) * 3, leaf2);
  if (tk === 'blossom') for (let i = 0; i < 10; i++) blob(g, bx - 22 + hash2(i, v, 8) * 44, cy - 16 + hash2(i, v, 10) * 34, 1.3, '#ffffff');
  if (glow) for (let i = 0; i < 9; i++) blob(g, bx - 20 + hash2(i, v, 12) * 40, cy - 16 + hash2(i, v, 14) * 34, 1.6, P.leaf2);
}

function rock(g: G2, realm: number, v: number): void {
  const P = REALMS[realm].palette;
  shadow(g, 22, 34, 18, 5);
  const c = P.rock;
  g.fillStyle = shade(c, -0.25);
  g.beginPath();
  g.moveTo(4, 34);
  g.lineTo(6 + v, 16);
  g.lineTo(18, 6 + v);
  g.lineTo(32, 9);
  g.lineTo(40, 22);
  g.lineTo(38, 34);
  g.closePath();
  g.fill();
  g.fillStyle = c;
  g.beginPath();
  g.moveTo(8, 22);
  g.lineTo(18, 9 + v);
  g.lineTo(31, 11);
  g.lineTo(36, 22);
  g.lineTo(22, 26);
  g.closePath();
  g.fill();
  if (realm === 0 || realm === 1) {
    g.fillStyle = rgba(P.leaf, 0.8);
    g.beginPath();
    g.ellipse(20, 12 + v, 9, 3, -0.2, 0, Math.PI * 2);
    g.fill();
  }
  if (realm === 3) {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(22, 11 + v, 11, 3.5, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function bush(g: G2, realm: number, v: number): void {
  const P = REALMS[realm].palette;
  shadow(g, 18, 26, 14, 4);
  const c = realm === 2 ? '#3a2e2a' : realm === 3 ? '#9ab8c8' : P.leaf;
  for (const [x, y, r] of [[10, 18, 8], [24, 18, 8], [17, 12, 9]] as [number, number, number][]) blob(g, x, y, r, shade(c, -0.15));
  for (const [x, y, r] of [[10, 16, 6], [24, 16, 6], [17, 10, 7]] as [number, number, number][]) blob(g, x, y, r, c);
  for (let i = 0; i < 4; i++) blob(g, 8 + hash2(i, v, 1) * 20, 8 + hash2(i, v, 2) * 12, 1.4, P.flower[i % P.flower.length]);
}

// ------------------------------------------------------------------ town decor

function lamp(g: G2, realm: number): void {
  const P = REALMS[realm].palette;
  shadow(g, 12, 70, 8, 3);
  g.fillStyle = '#2a2a33';
  g.fillRect(10, 16, 4, 54);
  g.fillRect(6, 66, 12, 4);
  g.fillStyle = '#3a3a44';
  g.fillRect(5, 6, 14, 3);
  g.fillStyle = rgba(P.lampColor, 0.95);
  g.fillRect(7, 9, 10, 10);
  g.fillStyle = '#ffffff';
  g.fillRect(10, 11, 4, 5);
  g.strokeStyle = '#2a2a33';
  g.lineWidth = 1.2;
  g.strokeRect(7, 9, 10, 10);
  g.fillStyle = '#2a2a33';
  g.beginPath();
  g.moveTo(4, 7);
  g.lineTo(12, 1);
  g.lineTo(20, 7);
  g.fill();
}

function torch(g: G2): void {
  g.fillStyle = '#3a2a1f';
  g.fillRect(7, 14, 4, 14);
  g.fillStyle = '#5a5a66';
  g.fillRect(5, 12, 8, 3);
  g.fillStyle = '#ff7a2a';
  g.beginPath();
  g.moveTo(9, 0);
  g.quadraticCurveTo(15, 8, 9, 13);
  g.quadraticCurveTo(3, 8, 9, 0);
  g.fill();
  g.fillStyle = '#ffe08a';
  g.beginPath();
  g.moveTo(9, 5);
  g.quadraticCurveTo(12, 9, 9, 12);
  g.quadraticCurveTo(6, 9, 9, 5);
  g.fill();
}

function gate(g: G2, realm: number, abyss: boolean): void {
  const P = REALMS[realm].palette;
  const w = abyss ? 124 : 132;
  const h = abyss ? 144 : 156;
  const cx = w / 2;
  shadow(g, cx, h - 6, w * 0.42, 9);
  const stone = abyss ? '#2a2236' : P.wallTop;
  g.fillStyle = shade(stone, -0.3);
  g.fillRect(cx - 52, h - 20, 104, 16);
  g.fillStyle = shade(stone, -0.1);
  g.fillRect(cx - 46, h - 26, 92, 8);
  const ry = h - 70;
  g.lineWidth = 14;
  g.strokeStyle = shade(stone, -0.2);
  g.beginPath();
  g.ellipse(cx, ry, 40, 50, 0, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 8;
  g.strokeStyle = stone;
  g.beginPath();
  g.ellipse(cx, ry - 2, 40, 50, 0, 0, Math.PI * 2);
  g.stroke();
  const glow = abyss ? '#a970ff' : '#7fe9ff';
  const grd = g.createRadialGradient(cx, ry, 4, cx, ry, 44);
  grd.addColorStop(0, rgba('#ffffff', 0.95));
  grd.addColorStop(0.35, rgba(glow, 0.8));
  grd.addColorStop(1, rgba(abyss ? '#1a0a2a' : '#1a3a6a', 0.9));
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(cx, ry, 34, 44, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = glow;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.fillRect(cx + Math.cos(a) * 41 - 1.5, ry + Math.sin(a) * 51 - 1.5, 3, 3);
  }
  g.fillStyle = shade(stone, -0.25);
  g.fillRect(cx - 50, ry - 4, 10, 60);
  g.fillRect(cx + 40, ry - 4, 10, 60);
}

function dungeonEntrance(g: G2, realm: number): void {
  const P = REALMS[realm].palette;
  const W = 184;
  const H = 190;
  const cx = W / 2;
  shadow(g, cx, H - 8, 84, 12);
  switch (realm) {
    case 0: {
      g.fillStyle = shade(P.dunTop, -0.15);
      g.fillRect(cx - 62, 40, 124, H - 50);
      g.fillStyle = P.dunTop;
      for (let r = 0; r < 7; r++) for (let c = 0; c < 6; c++) g.fillRect(cx - 60 + c * 20 + (r % 2) * 10, 44 + r * 20, 18, 18);
      g.fillStyle = shade(P.dunTop, 0.15);
      for (let i = 0; i < 6; i++) g.fillRect(cx - 62 + i * 22, 28, 14, 14);
      g.fillStyle = '#3d8fd6';
      g.fillRect(cx - 70, H - 26, 140, 14);
      break;
    }
    case 1: {
      g.strokeStyle = '#3a2a1f';
      g.lineWidth = 26;
      g.beginPath();
      g.moveTo(cx - 70, H - 10);
      g.quadraticCurveTo(cx - 60, 30, cx, 30);
      g.quadraticCurveTo(cx + 60, 30, cx + 70, H - 10);
      g.stroke();
      g.strokeStyle = '#5a4a3a';
      g.lineWidth = 8;
      g.stroke();
      for (let i = 0; i < 6; i++) blob(g, cx - 60 + hash2(i, 1, 2) * 120, 30 + hash2(i, 2, 3) * 70, 3, '#c9ff5a');
      break;
    }
    case 2: {
      g.fillStyle = '#2a2020';
      g.beginPath();
      g.moveTo(cx - 88, H - 8);
      g.lineTo(cx - 50, 40);
      g.lineTo(cx, 20);
      g.lineTo(cx + 54, 46);
      g.lineTo(cx + 88, H - 8);
      g.closePath();
      g.fill();
      g.strokeStyle = '#ff7a3d';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - 40, 70);
      g.lineTo(cx - 20, 100);
      g.lineTo(cx - 34, 130);
      g.moveTo(cx + 30, 60);
      g.lineTo(cx + 44, 110);
      g.stroke();
      break;
    }
    case 3: {
      g.fillStyle = '#d8e6f4';
      g.fillRect(cx - 64, 60, 128, H - 70);
      g.fillStyle = '#b8cce2';
      for (const x of [-64, -22, 22]) {
        g.beginPath();
        g.moveTo(cx + x, 60);
        g.lineTo(cx + x + 21, 4);
        g.lineTo(cx + x + 42, 60);
        g.fill();
      }
      g.fillStyle = rgba('#7fe9ff', 0.6);
      g.beginPath();
      g.arc(cx, 84, 14, 0, Math.PI * 2);
      g.fill();
      break;
    }
    default: {
      g.fillStyle = '#f4efe6';
      g.fillRect(cx - 70, 50, 140, H - 60);
      g.fillStyle = '#9a2a3a';
      g.fillRect(cx - 70, 50, 140, 16);
      g.fillStyle = '#ffd27a';
      g.fillRect(cx - 70, 64, 140, 3);
      for (const x of [-60, -30, 22, 52]) {
        g.fillStyle = '#ece4d6';
        g.fillRect(cx + x, 68, 10, H - 80);
      }
      g.fillStyle = '#9a2a3a';
      g.beginPath();
      g.moveTo(cx - 78, 52);
      g.lineTo(cx, 10);
      g.lineTo(cx + 78, 52);
      g.fill();
    }
  }
  // doorway
  g.fillStyle = '#05070d';
  g.beginPath();
  g.moveTo(cx - 24, H - 10);
  g.lineTo(cx - 24, H - 62);
  g.quadraticCurveTo(cx, H - 92, cx + 24, H - 62);
  g.lineTo(cx + 24, H - 10);
  g.closePath();
  g.fill();
  const grd = g.createLinearGradient(0, H - 90, 0, H - 10);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, rgba(realm === 2 ? '#ff7a3d' : '#4a6aaa', 0.4));
  g.fillStyle = grd;
  g.fill();
}

function building(g: G2, realm: number, d: Record<string, unknown>, sw: number, sh: number): void {
  const P = REALMS[realm].palette;
  const type = String(d.type);
  const w = Number(d.w);
  const tier = Number(d.tier ?? 0);
  const roofH = Number(d.roofH);
  const facadeH = Math.min(86, 46 + Number(d.h) * 6);
  const left = 6;
  const right = sw - 6;
  const fy = sh - facadeH;
  shadow(g, sw / 2, sh - 2, (w * TILE) / 2 + 4, 7, 0.35);
  if (type === 'coliseum') {
    const cx = sw / 2;
    g.fillStyle = shade('#d9c9a6', -0.25);
    g.beginPath();
    g.ellipse(cx, sh - 70, sw / 2 - 6, sh / 2 - 30, 0, Math.PI, 0);
    g.lineTo(right, sh - 4);
    g.lineTo(left, sh - 4);
    g.closePath();
    g.fill();
    g.fillStyle = '#e6d8b8';
    g.fillRect(left, sh - 92, right - left, 88);
    for (let i = 0; i < 9; i++) {
      const x = left + 12 + i * ((right - left - 24) / 8);
      g.fillStyle = '#4a3a2a';
      g.beginPath();
      g.moveTo(x - 9, sh - 20);
      g.lineTo(x - 9, sh - 52);
      g.quadraticCurveTo(x, sh - 66, x + 9, sh - 52);
      g.lineTo(x + 9, sh - 20);
      g.fill();
      g.fillStyle = '#c9b48e';
      g.fillRect(x - 12, sh - 84, 24, 6);
    }
    for (let i = 0; i < 5; i++) {
      const x = left + 30 + i * ((right - left - 60) / 4);
      g.fillStyle = '#6b4a2f';
      g.fillRect(x, sh - 130, 2, 40);
      g.fillStyle = ['#ff5d6c', '#3f7fe0', '#ffd166', '#5ee6a0', '#c18cff'][i];
      g.beginPath();
      g.moveTo(x + 2, sh - 130);
      g.lineTo(x + 18, sh - 124);
      g.lineTo(x + 2, sh - 118);
      g.fill();
    }
    g.fillStyle = '#2a1c14';
    g.beginPath();
    g.moveTo(sw / 2 - 18, sh - 4);
    g.lineTo(sw / 2 - 18, sh - 44);
    g.quadraticCurveTo(sw / 2, sh - 62, sw / 2 + 18, sh - 44);
    g.lineTo(sw / 2 + 18, sh - 4);
    g.fill();
    return;
  }
  const roofIdx = { forge: 2, alchemist: 1, guild: 0, estate: 3, market: 1, general: 2, house: 0 }[type] ?? 0;
  const roof = P.roofs[roofIdx % P.roofs.length];
  const wall = type === 'forge' ? shade(P.walls[2], -0.25) : P.walls[(roofIdx + tier) % P.walls.length];
  // facade
  g.fillStyle = wall;
  g.fillRect(left, fy, right - left, facadeH - 4);
  g.fillStyle = rgba('#000000', 0.12);
  g.fillRect(left, sh - 14, right - left, 10);
  if (realm <= 1 && type !== 'forge') {
    g.strokeStyle = shade(P.wood, -0.25);
    g.lineWidth = 3;
    g.strokeRect(left + 1.5, fy + 1.5, right - left - 3, facadeH - 7);
    for (let x = left + 24; x < right - 10; x += 26) {
      g.beginPath();
      g.moveTo(x, fy);
      g.lineTo(x, sh - 5);
      g.stroke();
    }
  } else if (realm === 2 || type === 'forge') {
    g.strokeStyle = rgba('#000000', 0.25);
    g.lineWidth = 0.8;
    for (let y = fy + 8; y < sh - 6; y += 10) {
      g.beginPath();
      g.moveTo(left, y);
      g.lineTo(right, y);
      g.stroke();
    }
  } else if (realm === 4) {
    g.fillStyle = '#ffffff';
    for (let x = left + 6; x < right - 6; x += 30) g.fillRect(x, fy + 4, 6, facadeH - 10);
    g.fillStyle = '#c9a23a';
    g.fillRect(left, fy, right - left, 3);
  } else {
    g.fillStyle = rgba('#bfe6ff', 0.4);
    for (let x = left + 10; x < right - 6; x += 22) g.fillRect(x, fy + 6, 2, facadeH - 12);
  }
  // roof
  const roofTop = 4;
  const ridge = fy - (roofH - 30);
  g.fillStyle = shade(roof, -0.25);
  g.beginPath();
  g.moveTo(left - 6, fy + 4);
  g.lineTo(left + 8, Math.max(roofTop, ridge));
  g.lineTo(right - 8, Math.max(roofTop, ridge));
  g.lineTo(right + 6, fy + 4);
  g.closePath();
  g.fill();
  g.fillStyle = roof;
  g.beginPath();
  g.moveTo(left - 2, fy + 1);
  g.lineTo(left + 10, Math.max(roofTop, ridge) + 3);
  g.lineTo(right - 10, Math.max(roofTop, ridge) + 3);
  g.lineTo(right + 2, fy + 1);
  g.closePath();
  g.fill();
  g.strokeStyle = rgba(shade(roof, -0.4), 0.6);
  g.lineWidth = 0.9;
  for (let y = Math.max(roofTop, ridge) + 10; y < fy; y += 8) {
    g.beginPath();
    g.moveTo(left + 4, y);
    g.lineTo(right - 4, y);
    g.stroke();
  }
  g.fillStyle = shade(roof, 0.25);
  g.fillRect(left + 10, Math.max(roofTop, ridge) + 1, right - left - 20, 3);
  if (realm === 3) {
    g.fillStyle = '#ffffff';
    g.fillRect(left + 8, Math.max(roofTop, ridge), right - left - 16, 5);
  }
  // chimney / features
  if (type === 'forge' || type === 'house' || type === 'general') {
    g.fillStyle = shade(P.wallFace, -0.1);
    g.fillRect(right - 34, Math.max(roofTop, ridge) - 14, 12, 26);
  }
  if (type === 'house' && tier >= 3) {
    g.fillStyle = shade(roof, -0.1);
    for (const x of [left + 10, right - 30]) {
      g.fillRect(x, fy - 40, 20, 44);
      g.beginPath();
      g.moveTo(x - 4, fy - 40);
      g.lineTo(x + 10, fy - 64);
      g.lineTo(x + 24, fy - 40);
      g.fill();
    }
  }
  // windows
  const win = mix(P.lampColor, '#ffffff', 0.2);
  const nWin = Math.max(2, Math.floor((right - left) / 40));
  for (let i = 0; i < nWin; i++) {
    const x = left + ((i + 0.5) * (right - left)) / nWin - 7;
    if (Math.abs(x + 7 - sw / 2) < 22) continue;
    g.fillStyle = shade(P.wood, -0.3);
    g.fillRect(x - 2, fy + 10, 18, 18);
    g.fillStyle = win;
    g.fillRect(x, fy + 12, 14, 14);
    g.fillStyle = shade(P.wood, -0.3);
    g.fillRect(x + 6, fy + 12, 2, 14);
    g.fillRect(x, fy + 18, 14, 2);
    if (type === 'house') {
      g.fillStyle = '#6b4a2f';
      g.fillRect(x - 2, fy + 28, 18, 4);
      for (let k = 0; k < 4; k++) blob(g, x + 1 + k * 4, fy + 27, 2, P.flower[k % P.flower.length]);
    }
  }
  // door
  const dx = sw / 2;
  g.fillStyle = shade(P.wood, -0.45);
  g.beginPath();
  g.moveTo(dx - 11, sh - 4);
  g.lineTo(dx - 11, sh - 30);
  g.quadraticCurveTo(dx, sh - 40, dx + 11, sh - 30);
  g.lineTo(dx + 11, sh - 4);
  g.fill();
  g.fillStyle = shade(P.wood, -0.15);
  g.fillRect(dx - 8, sh - 30, 16, 26);
  g.fillStyle = '#ffd166';
  g.fillRect(dx + 4, sh - 18, 2, 2);
  // shop signs
  const sx = dx + 20;
  const sy = sh - 46;
  if (type !== 'house') {
    g.fillStyle = '#3a2a1f';
    g.fillRect(sx, sy - 2, 18, 2);
    g.fillStyle = '#e8d8b0';
    g.fillRect(sx + 1, sy, 16, 14);
    g.strokeStyle = '#3a2a1f';
    g.lineWidth = 1;
    g.strokeRect(sx + 1, sy, 16, 14);
    g.fillStyle = '#3a3a44';
    g.strokeStyle = '#3a3a44';
    if (type === 'forge') {
      g.fillRect(sx + 4, sy + 7, 10, 3);
      g.fillRect(sx + 7, sy + 10, 4, 3);
    } else if (type === 'alchemist') {
      g.fillStyle = '#4aa8ff';
      g.beginPath();
      g.arc(sx + 9, sy + 9, 4, 0, Math.PI * 2);
      g.fill();
      g.fillRect(sx + 8, sy + 2, 2, 4);
    } else if (type === 'guild') {
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(sx + 4, sy + 3);
      g.lineTo(sx + 14, sy + 12);
      g.moveTo(sx + 14, sy + 3);
      g.lineTo(sx + 4, sy + 12);
      g.stroke();
    } else if (type === 'estate') {
      g.beginPath();
      g.moveTo(sx + 4, sy + 8);
      g.lineTo(sx + 9, sy + 3);
      g.lineTo(sx + 14, sy + 8);
      g.fill();
      g.fillRect(sx + 6, sy + 8, 6, 5);
    } else if (type === 'market') {
      g.fillStyle = '#c9a23a';
      g.beginPath();
      g.arc(sx + 6, sy + 9, 3, 0, Math.PI * 2);
      g.arc(sx + 12, sy + 8, 3, 0, Math.PI * 2);
      g.fill();
    } else if (type === 'general') {
      g.fillStyle = '#c98a3a';
      g.beginPath();
      g.ellipse(sx + 9, sy + 8, 6, 4, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (type === 'market') {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : P.roofs[0];
      g.fillRect(dx - 40 + i * 10, fy + 30, 10, 8);
    }
  }
  if (type === 'guild') {
    const cols = ['#efe6d2', '#ffd166', '#ff5d6c', '#c18cff'];
    for (let i = 0; i < 4; i++) {
      const x = left + 14 + i * ((right - left - 40) / 3);
      if (Math.abs(x - dx) < 16) continue;
      g.fillStyle = cols[i];
      g.fillRect(x, fy + 2, 10, 22);
      g.beginPath();
      g.moveTo(x, fy + 24);
      g.lineTo(x + 5, fy + 30);
      g.lineTo(x + 10, fy + 24);
      g.fill();
    }
  }
  if (type === 'forge') {
    g.fillStyle = '#2a2a33';
    g.fillRect(left + 8, sh - 22, 20, 8);
    g.fillRect(left + 12, sh - 14, 12, 10);
    g.fillStyle = '#ff7a2a';
    g.fillRect(right - 34, sh - 16, 22, 10);
    g.fillStyle = '#ffd08a';
    g.fillRect(right - 30, sh - 14, 14, 4);
  }
}

function simple(g: G2, kind: string, realm: number, d: Record<string, unknown>): void {
  const P = REALMS[realm].palette;
  switch (kind) {
    case 'fountain': {
      shadow(g, 46, 84, 40, 8);
      g.fillStyle = shade(P.plaza, -0.25);
      g.beginPath();
      g.ellipse(46, 66, 40, 18, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = P.liquid === 'lava' ? '#5a9ad6' : P.liquidB;
      g.beginPath();
      g.ellipse(46, 64, 33, 13, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = P.plaza;
      g.fillRect(41, 30, 10, 34);
      g.beginPath();
      g.ellipse(46, 30, 14, 6, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = rgba('#ffffff', 0.7);
      g.fillRect(44, 14, 4, 16);
      break;
    }
    case 'statue': {
      shadow(g, 22, 88, 18, 5);
      g.fillStyle = shade(P.plaza, -0.2);
      g.fillRect(8, 64, 28, 24);
      g.fillStyle = '#9aa0a8';
      g.beginPath();
      g.arc(22, 22, 7, 0, Math.PI * 2);
      g.fill();
      g.fillRect(15, 28, 14, 24);
      g.fillRect(13, 50, 7, 14);
      g.fillRect(24, 50, 7, 14);
      g.strokeStyle = '#c9ced6';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(30, 34);
      g.lineTo(38, 4);
      g.stroke();
      break;
    }
    case 'bench':
      shadow(g, 33, 34, 28, 4);
      g.fillStyle = '#6b4a2f';
      g.fillRect(4, 14, 58, 7);
      g.fillRect(4, 4, 58, 5);
      g.fillStyle = '#3a2a1f';
      g.fillRect(8, 21, 4, 12);
      g.fillRect(54, 21, 4, 12);
      break;
    case 'crate':
      shadow(g, 18, 38, 15, 4);
      if (d.v) {
        g.fillStyle = '#7a5232';
        g.beginPath();
        g.ellipse(18, 22, 13, 16, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#3a2a1f';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(5, 14);
        g.lineTo(31, 14);
        g.moveTo(5, 30);
        g.lineTo(31, 30);
        g.stroke();
      } else {
        g.fillStyle = '#8a6238';
        g.fillRect(4, 10, 28, 28);
        g.strokeStyle = '#4a3020';
        g.lineWidth = 2;
        g.strokeRect(4, 10, 28, 28);
        g.beginPath();
        g.moveTo(4, 10);
        g.lineTo(32, 38);
        g.stroke();
      }
      break;
    case 'stall': {
      shadow(g, 39, 68, 34, 5);
      g.fillStyle = '#6b4a2f';
      g.fillRect(6, 40, 66, 26);
      g.fillStyle = '#3a2a1f';
      g.fillRect(8, 14, 3, 30);
      g.fillRect(67, 14, 3, 30);
      const col = String(d.color ?? '#b8483e');
      for (let i = 0; i < 7; i++) {
        g.fillStyle = i % 2 ? '#ffffff' : col;
        g.beginPath();
        g.moveTo(4 + i * 10, 22);
        g.lineTo(6 + i * 10, 8);
        g.lineTo(16 + i * 10, 8);
        g.lineTo(14 + i * 10, 22);
        g.fill();
      }
      for (let i = 0; i < 5; i++) blob(g, 16 + i * 11, 40, 4, ['#ff6a3d', '#9be15d', '#ffd166', '#ff9ec7', '#7fe9ff'][i]);
      break;
    }
    case 'banner': {
      shadow(g, 14, 88, 8, 3);
      g.fillStyle = '#3a2a1f';
      g.fillRect(12, 6, 3, 82);
      const col = String(d.color ?? '#3f7fe0');
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(15, 10);
      g.lineTo(27, 10);
      g.lineTo(27, 44);
      g.lineTo(21, 38);
      g.lineTo(15, 44);
      g.fill();
      g.fillStyle = '#ffd166';
      g.fillRect(19, 18, 4, 4);
      break;
    }
    case 'well':
      shadow(g, 24, 58, 20, 5);
      g.fillStyle = shade(P.plaza, -0.2);
      g.beginPath();
      g.ellipse(24, 44, 18, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1a2a3a';
      g.beginPath();
      g.ellipse(24, 42, 12, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#5a3a24';
      g.fillRect(6, 8, 3, 36);
      g.fillRect(39, 8, 3, 36);
      g.fillStyle = P.roofs[0];
      g.beginPath();
      g.moveTo(2, 12);
      g.lineTo(24, 0);
      g.lineTo(46, 12);
      g.fill();
      break;
    case 'sign':
      shadow(g, 17, 42, 10, 3);
      g.fillStyle = '#5a3a24';
      g.fillRect(15, 14, 4, 30);
      g.fillStyle = '#9a6b3f';
      g.fillRect(2, 6, 30, 14);
      g.strokeStyle = '#3a2a1f';
      g.lineWidth = 1;
      g.strokeRect(2, 6, 30, 14);
      g.fillStyle = '#3a2a1f';
      g.fillRect(6, 11, 22, 1.4);
      g.fillRect(6, 15, 16, 1.4);
      break;
    case 'pillar': {
      shadow(g, 20, 96, 16, 5);
      const c = realm === 4 ? '#f4efe6' : P.dunTop;
      g.fillStyle = shade(c, -0.25);
      g.fillRect(6, 86, 28, 10);
      g.fillStyle = c;
      g.fillRect(10, 14, 20, 74);
      g.fillStyle = rgba('#ffffff', 0.25);
      g.fillRect(12, 14, 4, 74);
      g.fillStyle = shade(c, -0.15);
      g.fillRect(6, 6, 28, 10);
      break;
    }
  }
}

function stairs(g: G2, realm: number, up: boolean): void {
  const P = REALMS[realm].palette;
  if (up) {
    for (let i = 0; i < 4; i++) {
      g.fillStyle = shade(P.dunTop, 0.1 - i * 0.08);
      g.fillRect(8 + i * 3, 50 - i * 11, 52 - i * 6, 11);
    }
    g.fillStyle = rgba('#fff4c2', 0.5);
    g.fillRect(20, 4, 28, 10);
  } else {
    g.fillStyle = '#05070d';
    g.beginPath();
    g.ellipse(34, 34, 28, 16, 0, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 4; i++) {
      g.fillStyle = shade('#4a3a6a', -i * 0.15);
      g.fillRect(14 + i * 4, 24 + i * 5, 40 - i * 8, 4);
    }
    g.strokeStyle = '#a970ff';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(34, 34, 28, 16, 0, 0, Math.PI * 2);
    g.stroke();
  }
}

function crystal(g: G2): void {
  shadow(g, 22, 80, 14, 4);
  g.fillStyle = '#5a6a8a';
  g.fillRect(12, 70, 20, 10);
  g.fillStyle = rgba('#7fe9ff', 0.85);
  g.beginPath();
  g.moveTo(22, 4);
  g.lineTo(36, 30);
  g.lineTo(22, 62);
  g.lineTo(8, 30);
  g.closePath();
  g.fill();
  g.fillStyle = rgba('#ffffff', 0.7);
  g.beginPath();
  g.moveTo(22, 8);
  g.lineTo(28, 30);
  g.lineTo(22, 40);
  g.lineTo(16, 30);
  g.closePath();
  g.fill();
}

// ------------------------------------------------------------------ furniture

export function drawFurniture(g: G2, kind: string, sw: number, sh: number, item: string, realm: number): void {
  const P = REALMS[realm].palette;
  void P;
  const w = sw;
  const h = sh;
  if (kind !== 'rug') shadow(g, w / 2, h - 4, w / 2 - 4, 5, 0.25);
  switch (kind) {
    case 'vault':
      g.fillStyle = '#5a4030';
      g.fillRect(6, h - 40, w - 12, 34);
      g.fillStyle = '#7a5a40';
      g.fillRect(6, h - 46, w - 12, 10);
      g.strokeStyle = '#c9a46e';
      g.lineWidth = 2;
      g.strokeRect(6, h - 46, w - 12, 40);
      g.fillStyle = '#ffd166';
      g.fillRect(w / 2 - 4, h - 32, 8, 8);
      break;
    case 'anvil':
      g.fillStyle = '#4a3020';
      g.fillRect(10, h - 22, 18, 18);
      g.fillStyle = '#5a5f68';
      g.beginPath();
      g.moveTo(4, h - 32);
      g.lineTo(34, h - 32);
      g.lineTo(28, h - 24);
      g.lineTo(10, h - 24);
      g.closePath();
      g.fill();
      g.fillStyle = '#2a2a33';
      g.fillRect(w - 30, h - 26, 24, 22);
      g.fillStyle = '#ff7a2a';
      g.fillRect(w - 27, h - 30, 18, 6);
      g.fillStyle = '#ffd08a';
      g.fillRect(w - 23, h - 29, 10, 3);
      break;
    case 'alchemy':
      g.fillStyle = '#6b4a2f';
      g.fillRect(4, h - 28, w - 8, 8);
      g.fillRect(8, h - 20, 4, 16);
      g.fillRect(w - 12, h - 20, 4, 16);
      ['#4aa8ff', '#ff5d6c', '#9be15d', '#ffd166'].forEach((c, i) => {
        g.fillStyle = c;
        g.beginPath();
        g.arc(14 + i * 12, h - 33, 4, 0, Math.PI * 2);
        g.fill();
        g.fillRect(13 + i * 12, h - 41, 2, 5);
      });
      break;
    case 'hearth':
      g.fillStyle = '#7a7a84';
      g.fillRect(4, h - 34, w - 8, 30);
      g.fillStyle = '#2a1c14';
      g.fillRect(12, h - 26, w - 24, 22);
      g.fillStyle = '#ff7a2a';
      g.beginPath();
      g.moveTo(w / 2 - 12, h - 6);
      g.quadraticCurveTo(w / 2, h - 30, w / 2 + 12, h - 6);
      g.fill();
      g.fillStyle = '#3a3a44';
      g.beginPath();
      g.ellipse(w / 2, h - 22, 10, 5, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case 'bed':
      g.fillStyle = '#5a3a24';
      g.fillRect(4, 6, w - 8, h - 10);
      g.fillStyle = '#f4efe6';
      g.fillRect(8, 10, w - 16, 14);
      g.fillStyle = '#b4233a';
      g.fillRect(8, 24, w - 16, h - 32);
      g.fillStyle = '#ffd166';
      g.fillRect(8, 24, w - 16, 3);
      g.fillStyle = '#3a2a1f';
      g.fillRect(4, 0, 4, 14);
      g.fillRect(w - 8, 0, 4, 14);
      break;
    case 'trophy': {
      g.fillStyle = '#5a5f68';
      g.fillRect(6, h - 16, w - 12, 12);
      g.fillStyle = '#ffd166';
      const of = item.replace('trophy_', '');
      if (of.startsWith('cup')) {
        g.beginPath();
        g.moveTo(10, h - 44);
        g.lineTo(w - 10, h - 44);
        g.quadraticCurveTo(w - 12, h - 22, w / 2, h - 22);
        g.quadraticCurveTo(12, h - 22, 10, h - 44);
        g.fill();
        g.fillRect(w / 2 - 2, h - 22, 4, 6);
      } else {
        g.beginPath();
        g.arc(w / 2, h - 40, 7, 0, Math.PI * 2);
        g.fill();
        g.fillRect(w / 2 - 6, h - 34, 12, 16);
        if (of === 'wyrm') {
          g.beginPath();
          g.moveTo(w / 2 - 12, h - 30);
          g.lineTo(w / 2, h - 52);
          g.lineTo(w / 2 + 12, h - 30);
          g.fill();
        }
      }
      break;
    }
    case 'rack':
      g.fillStyle = '#6b4a2f';
      g.fillRect(4, h - 12, w - 8, 6);
      g.fillRect(6, h - 60, 4, 54);
      g.fillRect(w - 10, h - 60, 4, 54);
      g.fillRect(4, h - 58, w - 8, 4);
      g.fillRect(4, h - 36, w - 8, 3);
      break;
    case 'mannequin':
      g.fillStyle = '#6b4a2f';
      g.fillRect(w / 2 - 8, h - 6, 16, 3);
      break;
    case 'rug':
      g.fillStyle = '#7a2f45';
      g.fillRect(2, 2, w - 4, h - 4);
      g.strokeStyle = '#d8b46a';
      g.lineWidth = 2;
      g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#d8b46a';
      g.beginPath();
      g.ellipse(w / 2, h / 2, w / 5, h / 5, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case 'plant':
      g.fillStyle = '#9a5a32';
      g.fillRect(w / 2 - 8, h - 16, 16, 12);
      g.fillStyle = '#3f9a5a';
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.ellipse(w / 2 + Math.cos(i) * 8, h - 22 + Math.sin(i * 2) * 4, 7, 3, i, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'lantern':
      g.fillStyle = '#2a2a33';
      g.fillRect(w / 2 - 2, h - 40, 4, 36);
      g.fillStyle = '#ffe2a0';
      g.fillRect(w / 2 - 6, h - 50, 12, 12);
      g.strokeStyle = '#2a2a33';
      g.strokeRect(w / 2 - 6, h - 50, 12, 12);
      break;
    case 'bookshelf':
      g.fillStyle = '#5a3a22';
      g.fillRect(4, h - 72, w - 8, 68);
      for (let r = 0; r < 3; r++) {
        g.fillStyle = '#2a1c14';
        g.fillRect(8, h - 66 + r * 21, w - 16, 17);
        for (let i = 0; i < 9; i++) {
          g.fillStyle = ['#b4233a', '#3f6fb8', '#5a8a4a', '#c98a3a', '#7d4bd6'][(i + r) % 5];
          g.fillRect(10 + i * ((w - 22) / 9), h - 64 + r * 21, (w - 26) / 9, 15);
        }
      }
      break;
    case 'table':
      g.fillStyle = '#8a5a32';
      g.fillRect(4, h - 30, w - 8, 12);
      g.fillStyle = '#5a3a22';
      g.fillRect(8, h - 18, 4, 14);
      g.fillRect(w - 12, h - 18, 4, 14);
      g.fillStyle = '#f4efe6';
      g.beginPath();
      g.ellipse(w / 2, h - 27, 6, 3, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case 'chair':
      g.fillStyle = '#8a5a32';
      g.fillRect(8, h - 36, 4, 32);
      g.fillRect(w - 12, h - 20, 4, 16);
      g.fillStyle = '#b4233a';
      g.fillRect(8, h - 22, w - 16, 6);
      break;
    case 'banner':
      g.fillStyle = '#3a2a1f';
      g.fillRect(w / 2 - 1, h - 50, 3, 46);
      g.fillStyle = '#3f7fe0';
      g.fillRect(w / 2 + 2, h - 48, 12, 22);
      break;
  }
}

// ------------------------------------------------------------------ dispatcher

export function propSprite(p: Prop, realm: number): HTMLCanvasElement {
  let c = cache.get(p.sprite);
  if (c) return c;
  const d = p.data ?? {};
  c = canvas(p.sw, p.sh, (g) => {
    switch (p.kind) {
      case 'tree':
        tree(g, realm, String(d.tk), Number(d.v));
        break;
      case 'rock':
        rock(g, realm, Number(d.v));
        break;
      case 'bush':
        bush(g, realm, Number(d.v));
        break;
      case 'lamp':
        lamp(g, realm);
        break;
      case 'torch':
        torch(g);
        break;
      case 'gate':
        gate(g, realm, false);
        break;
      case 'abyssgate':
        gate(g, realm, true);
        break;
      case 'dungeon':
        dungeonEntrance(g, realm);
        break;
      case 'building':
        building(g, realm, d, p.sw, p.sh);
        break;
      case 'stairs':
        stairs(g, realm, d.up !== false);
        break;
      case 'crystal':
        crystal(g);
        break;
      case 'furniture':
        drawFurniture(g, String(d.kind), p.sw, p.sh, String(d.item), realm);
        break;
      default:
        simple(g, p.kind, realm, d);
    }
  });
  cache.set(p.sprite, c);
  return c;
}
