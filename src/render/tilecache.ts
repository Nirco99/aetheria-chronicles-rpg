// Offscreen tile & wall-face caches. Every procedural tile is painted once per realm palette
// (at the current device scale) and then blitted with drawImage during the game loop.
import { REALMS } from '../data/realms';
import { TILE, WALL_H } from '../data/constants';
import { GT } from '../world/tilemap';
import type { WallStyle } from '../world/tilemap';
import { hash2, mix, rgba, shade } from '../engine/util';

let SCALE = 2;
const cache = new Map<string, HTMLCanvasElement>();

export function setTileScale(s: number): void {
  const n = Math.max(1, Math.min(3, Math.ceil(s)));
  if (n !== SCALE) {
    SCALE = n;
    cache.clear();
  }
}

function make(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SCALE);
  c.height = Math.ceil(h * SCALE);
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.scale(SCALE, SCALE);
  paint(g);
  return c;
}

function speckle(g: CanvasRenderingContext2D, seed: number, n: number, colors: string[], size = 1.4): void {
  for (let i = 0; i < n; i++) {
    const x = hash2(i, seed, 11) * TILE;
    const y = hash2(i, seed, 23) * TILE;
    g.fillStyle = colors[i % colors.length];
    g.fillRect(x, y, size, size);
  }
}

function blades(g: CanvasRenderingContext2D, seed: number, n: number, color: string): void {
  g.strokeStyle = color;
  g.lineWidth = 0.9;
  for (let i = 0; i < n; i++) {
    const x = hash2(i, seed, 5) * TILE;
    const y = 4 + hash2(i, seed, 7) * (TILE - 4);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (hash2(i, seed, 9) - 0.5) * 3, y - 3 - hash2(i, seed, 13) * 2);
    g.stroke();
  }
}

function paintGround(g: CanvasRenderingContext2D, realm: number, type: number, v: number, frame: number): void {
  const P = REALMS[realm].palette;
  const seed = realm * 101 + type * 17 + v * 7;
  switch (type) {
    case GT.GRASS:
    case GT.GRASS2:
    case GT.FLOWERS: {
      const base = type === GT.GRASS2 ? P.grass2 : P.grass;
      g.fillStyle = base;
      g.fillRect(0, 0, TILE, TILE);
      speckle(g, seed, 18, [shade(base, 0.12), shade(base, -0.12), P.grassDark], 1.5);
      if (realm !== 3) blades(g, seed, 8, shade(base, -0.22));
      else speckle(g, seed + 3, 10, ['#ffffff', '#cfe6f6'], 1.2);
      if (type === GT.FLOWERS) {
        for (let i = 0; i < 4; i++) {
          const x = 4 + hash2(i, seed, 31) * (TILE - 8);
          const y = 4 + hash2(i, seed, 37) * (TILE - 8);
          const col = P.flower[i % P.flower.length];
          g.fillStyle = col;
          for (let k = 0; k < 4; k++) {
            g.beginPath();
            g.arc(x + Math.cos(k * 1.57) * 1.6, y + Math.sin(k * 1.57) * 1.6, 1.3, 0, Math.PI * 2);
            g.fill();
          }
          g.fillStyle = '#ffe680';
          g.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
        }
      }
      break;
    }
    case GT.DIRT:
      g.fillStyle = P.dirt;
      g.fillRect(0, 0, TILE, TILE);
      speckle(g, seed, 16, [shade(P.dirt, 0.15), shade(P.dirt, -0.18)], 2);
      break;
    case GT.PATH:
    case GT.MARBLE: {
      const base = type === GT.MARBLE ? P.plaza : P.path;
      g.fillStyle = shade(base, -0.28);
      g.fillRect(0, 0, TILE, TILE);
      const rows = 3;
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? 5 : 0;
        for (let cIdx = -1; cIdx < 3; cIdx++) {
          const x = cIdx * 12 + off + 1;
          const y = r * 10.6 + 1;
          const sh = (hash2(cIdx + 9, r + v * 3, seed) - 0.5) * 0.18;
          g.fillStyle = shade(base, sh);
          g.beginPath();
          g.roundRect(x, y, 10.5, 9, 2.4);
          g.fill();
          g.fillStyle = rgba('#ffffff', 0.12);
          g.fillRect(x + 1.5, y + 1, 7, 1.2);
        }
      }
      if (type === GT.MARBLE) {
        g.strokeStyle = rgba('#c9b98a', 0.35);
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(0, hash2(v, 1, seed) * TILE);
        g.quadraticCurveTo(TILE / 2, hash2(v, 2, seed) * TILE, TILE, hash2(v, 3, seed) * TILE);
        g.stroke();
      }
      break;
    }
    case GT.PLAZA: {
      g.fillStyle = shade(P.plaza, -0.25);
      g.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const sh = (hash2(i + v * 2, j, seed) - 0.5) * 0.14;
          g.fillStyle = shade(P.plaza, sh);
          g.fillRect(i * 16 + 0.8, j * 16 + 0.8, 14.4, 14.4);
          g.fillStyle = rgba('#ffffff', 0.15);
          g.fillRect(i * 16 + 0.8, j * 16 + 0.8, 14.4, 1.2);
        }
      }
      break;
    }
    case GT.WOOD:
    case GT.WOODFLOOR: {
      const base = type === GT.WOOD ? P.wood : '#9a6a42';
      g.fillStyle = shade(base, -0.4);
      g.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = shade(base, (hash2(i, v, seed) - 0.5) * 0.2);
        if (type === GT.WOOD) g.fillRect(0, i * 8 + 0.6, TILE, 6.8);
        else g.fillRect(i * 8 + 0.6, 0, 6.8, TILE);
        g.fillStyle = rgba('#000000', 0.25);
        if (type === GT.WOOD) {
          g.fillRect(4 + i * 7, i * 8 + 3, 1, 1);
          g.fillRect(26 - i * 5, i * 8 + 3, 1, 1);
        } else g.fillRect(i * 8 + 3, (i * 9 + v * 5) % TILE, 1, 1);
      }
      break;
    }
    case GT.SAND:
      g.fillStyle = P.sand;
      g.fillRect(0, 0, TILE, TILE);
      speckle(g, seed, 20, [shade(P.sand, 0.1), shade(P.sand, -0.12)], 1.2);
      g.strokeStyle = rgba(shade(P.sand, -0.2), 0.5);
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(2, 10 + v * 4);
      g.quadraticCurveTo(16, 6 + v * 4, 30, 12 + v * 4);
      g.stroke();
      break;
    case GT.LIQUID:
    case GT.VOID: {
      const kind = type === GT.VOID ? 'void' : P.liquid;
      if (kind === 'water') {
        g.fillStyle = P.liquidA;
        g.fillRect(0, 0, TILE, TILE);
        g.strokeStyle = rgba(P.liquidB, 0.75);
        g.lineWidth = 1.1;
        for (let i = 0; i < 3; i++) {
          const y = ((i * 11 + frame * 3 + v * 5) % TILE) + 2;
          const x = (i * 9 + v * 7) % 20;
          g.beginPath();
          g.moveTo(x, y);
          g.quadraticCurveTo(x + 4, y - 2, x + 8, y);
          g.stroke();
        }
        g.fillStyle = rgba('#ffffff', 0.08);
        g.fillRect(0, 0, TILE, 2);
      } else if (kind === 'lava') {
        g.fillStyle = P.liquidA;
        g.fillRect(0, 0, TILE, TILE);
        g.fillStyle = rgba('#5a1408', 0.55);
        for (let i = 0; i < 4; i++) {
          const x = hash2(i, v, seed) * TILE;
          const y = hash2(i, v + 5, seed) * TILE;
          g.beginPath();
          g.ellipse(x, y, 6, 3, 0.4, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = rgba(P.liquidB, 0.9);
        g.lineWidth = 1.4;
        g.beginPath();
        const ph = frame * 0.8;
        g.moveTo(0, 10 + Math.sin(ph + v) * 3);
        g.quadraticCurveTo(16, 16 + Math.cos(ph) * 3, TILE, 12 + Math.sin(ph * 1.3) * 3);
        g.stroke();
        g.fillStyle = '#ffe08a';
        g.beginPath();
        g.arc(8 + ((frame * 5 + v * 9) % 18), 22, 1.2 + (frame % 2), 0, Math.PI * 2);
        g.fill();
      } else {
        const grd = g.createLinearGradient(0, 0, 0, TILE);
        grd.addColorStop(0, mix(P.sky, '#ffffff', 0.25));
        grd.addColorStop(1, P.sky);
        g.fillStyle = grd;
        g.fillRect(0, 0, TILE, TILE);
        g.fillStyle = rgba('#ffffff', 0.55);
        for (let i = 0; i < 3; i++) {
          const x = ((hash2(i, v, seed) * TILE + frame * 2) % (TILE + 10)) - 5;
          const y = hash2(i + 3, v, seed) * TILE;
          g.beginPath();
          g.ellipse(x, y, 7, 2.6, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    }
    case GT.FLOOR:
    case GT.FLOOR2: {
      const base = type === GT.FLOOR ? P.floor : P.floor2;
      g.fillStyle = shade(base, -0.3);
      g.fillRect(0, 0, TILE, TILE);
      g.fillStyle = base;
      g.fillRect(0.8, 0.8, TILE - 1.6, TILE - 1.6);
      g.fillStyle = rgba('#ffffff', 0.06);
      g.fillRect(0.8, 0.8, TILE - 1.6, 1.5);
      if (hash2(v, 2, seed) < 0.5) {
        g.strokeStyle = rgba('#000000', 0.25);
        g.lineWidth = 0.7;
        g.beginPath();
        g.moveTo(hash2(v, 3, seed) * TILE, 2);
        g.lineTo(TILE / 2, TILE / 2);
        g.lineTo(hash2(v, 4, seed) * TILE, TILE - 2);
        g.stroke();
      }
      speckle(g, seed, 6, [shade(base, 0.1), shade(base, -0.15)], 1.6);
      break;
    }
    case GT.CARPET:
      g.fillStyle = '#7a2f45';
      g.fillRect(0, 0, TILE, TILE);
      g.strokeStyle = '#d8b46a';
      g.lineWidth = 1;
      g.strokeRect(3, 3, TILE - 6, TILE - 6);
      break;
    case GT.ICE: {
      g.fillStyle = '#bfe2f6';
      g.fillRect(0, 0, TILE, TILE);
      g.fillStyle = rgba('#ffffff', 0.4);
      g.beginPath();
      g.moveTo(2, 2);
      g.lineTo(14, 2);
      g.lineTo(2, 14);
      g.fill();
      g.strokeStyle = rgba('#7fb4d8', 0.6);
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(hash2(v, 1, seed) * TILE, 0);
      g.lineTo(TILE / 2, TILE / 2 + v);
      g.lineTo(TILE, hash2(v, 2, seed) * TILE);
      g.stroke();
      break;
    }
    default:
      g.fillStyle = '#05070d';
      g.fillRect(0, 0, TILE, TILE);
  }
}

export function groundTile(realm: number, type: number, v: number, frame: number): HTMLCanvasElement {
  const animated = type === GT.LIQUID || type === GT.VOID;
  const k = `g${realm}:${type}:${v}:${animated ? frame : 0}`;
  let c = cache.get(k);
  if (!c) {
    c = make(TILE, TILE, (g) => paintGround(g, realm, type, v, animated ? frame : 0));
    cache.set(k, c);
  }
  return c;
}

/** shoreline / cliff-lip strip drawn on liquid tiles whose northern neighbour is land */
export function shoreTile(realm: number, frame: number): HTMLCanvasElement {
  const P = REALMS[realm].palette;
  const k = `shore${realm}:${frame}`;
  let c = cache.get(k);
  if (!c) {
    c = make(TILE, TILE, (g) => {
      if (P.liquid === 'water') {
        g.fillStyle = rgba('#ffffff', 0.55 + 0.15 * Math.sin(frame));
        g.fillRect(0, 0, TILE, 3);
        g.fillStyle = rgba('#ffffff', 0.25);
        g.fillRect(0, 4 + (frame % 2), TILE, 1.5);
      } else if (P.liquid === 'lava') {
        g.fillStyle = '#2a1410';
        g.fillRect(0, 0, TILE, 7);
        g.fillStyle = rgba('#ffb02e', 0.8);
        g.fillRect(0, 7, TILE, 1.5);
      } else {
        const grd = g.createLinearGradient(0, 0, 0, 24);
        grd.addColorStop(0, P.cliffFace);
        grd.addColorStop(1, shade(P.cliffFace, -0.45));
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(TILE, 0);
        g.lineTo(TILE, 12);
        g.lineTo(TILE * 0.7, 22);
        g.lineTo(TILE * 0.35, 16);
        g.lineTo(0, 24);
        g.closePath();
        g.fill();
      }
    });
    cache.set(k, c);
  }
  return c;
}

function wallColors(realm: number, style: WallStyle): { top: string; face: string } {
  const P = REALMS[realm].palette;
  switch (style) {
    case 'cliff':
      return { top: P.cliffTop, face: P.cliffFace };
    case 'masonry':
      return { top: P.wallTop, face: P.wallFace };
    case 'dungeon':
      return { top: P.dunTop, face: P.dunFace };
    default:
      return { top: '#5a3e2a', face: '#d8c4a4' };
  }
}

export function wallTop(realm: number, style: WallStyle, depth: number, v: number): HTMLCanvasElement {
  const k = `wt${realm}:${style}:${depth}:${v}`;
  let c = cache.get(k);
  if (!c) {
    const { top } = wallColors(realm, style);
    c = make(TILE, TILE, (g) => {
      const base = style === 'dungeon' ? shade(top, -0.38 - 0.2 * depth) : shade(top, -0.16 * depth);
      g.fillStyle = base;
      g.fillRect(0, 0, TILE, TILE);
      if (depth >= 3 && style === 'dungeon') {
        g.fillStyle = '#05070d';
        g.fillRect(0, 0, TILE, TILE);
        return;
      }
      if (style === 'cliff') {
        speckle(g, realm * 7 + v, 14, [shade(base, 0.12), shade(base, -0.14)], 2);
        if (realm !== 3 && realm !== 4) blades(g, realm * 3 + v, 5, shade(base, -0.25));
      } else if (style === 'masonry' || style === 'dungeon') {
        g.strokeStyle = rgba(shade(base, -0.35), 0.7);
        g.lineWidth = 0.8;
        g.strokeRect(1, 1, TILE - 2, TILE - 2);
        g.beginPath();
        g.moveTo(0, TILE / 2);
        g.lineTo(TILE, TILE / 2);
        g.moveTo(TILE / 2 + (v % 2) * 6, 0);
        g.lineTo(TILE / 2 + (v % 2) * 6, TILE / 2);
        g.stroke();
      } else {
        g.fillStyle = shade(base, 0.12);
        g.fillRect(0, 0, TILE, 4);
      }
    });
    cache.set(k, c);
  }
  return c;
}

export function wallFace(realm: number, style: WallStyle, v: number): HTMLCanvasElement {
  const k = `wf${realm}:${style}:${v}`;
  let c = cache.get(k);
  if (!c) {
    const { face } = wallColors(realm, style);
    c = make(TILE, WALL_H, (g) => {
      const grd = g.createLinearGradient(0, 0, 0, WALL_H);
      grd.addColorStop(0, shade(face, 0.12));
      grd.addColorStop(1, shade(face, -0.35));
      g.fillStyle = grd;
      g.fillRect(0, 0, TILE, WALL_H);
      if (style === 'cliff') {
        g.strokeStyle = rgba(shade(face, -0.45), 0.6);
        g.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const x = 3 + i * 8 + (v % 3);
          g.beginPath();
          g.moveTo(x, 2);
          g.lineTo(x + 1.5, WALL_H - 3);
          g.stroke();
        }
        g.fillStyle = rgba('#000000', 0.25);
        g.fillRect(0, WALL_H - 3, TILE, 3);
      } else if (style === 'interior') {
        g.fillStyle = '#e8d8bc';
        g.fillRect(0, 0, TILE, WALL_H * 0.6);
        g.fillStyle = '#7a5232';
        g.fillRect(0, WALL_H * 0.6, TILE, WALL_H * 0.4);
        g.fillStyle = '#5a3a22';
        g.fillRect(0, WALL_H * 0.6, TILE, 1.4);
        if (v % 4 === 0) {
          g.fillStyle = '#8fc8ec';
          g.fillRect(9, 3, 14, 9);
          g.strokeStyle = '#5a3a22';
          g.lineWidth = 1.2;
          g.strokeRect(9, 3, 14, 9);
          g.beginPath();
          g.moveTo(16, 3);
          g.lineTo(16, 12);
          g.stroke();
        }
      } else {
        g.strokeStyle = rgba(shade(face, -0.5), 0.75);
        g.lineWidth = 0.8;
        for (let r = 0; r < 3; r++) {
          const y = r * (WALL_H / 3);
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(TILE, y);
          g.stroke();
          const off = r % 2 ? 8 : 0;
          for (let x = off; x < TILE; x += 16) {
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x, y + WALL_H / 3);
            g.stroke();
          }
        }
      }
      g.fillStyle = rgba('#ffffff', 0.28);
      g.fillRect(0, 0, TILE, 1.5);
      g.fillStyle = rgba('#000000', 0.25);
      g.fillRect(0, 1.5, TILE, 1.5);
    });
    cache.set(k, c);
  }
  return c;
}

/** solid minimap colour for a tile */
export function minimapColor(realm: number, ground: number, solid: number, style: WallStyle): string {
  const P = REALMS[realm].palette;
  if (solid === 1) return style === 'dungeon' ? '#0b0e18' : shade(style === 'cliff' ? P.cliffFace : P.wallFace, -0.2);
  if (ground === GT.LIQUID) return P.liquid === 'lava' ? '#e0451f' : P.liquid === 'void' ? '#9fc8ff' : '#3d8fd6';
  if (ground === GT.VOID) return '#9fc8ff';
  if (ground === GT.PATH || ground === GT.MARBLE || ground === GT.PLAZA) return P.path;
  if (ground === GT.WOOD || ground === GT.WOODFLOOR) return P.wood;
  if (ground === GT.FLOOR || ground === GT.FLOOR2) return P.floor;
  if (solid === 3) return shade(P.grass, -0.35);
  return P.grass;
}
