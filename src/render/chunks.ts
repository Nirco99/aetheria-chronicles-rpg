// Static ground baking: every 8x8-tile chunk of non-animated ground (plus "deep" wall interiors
// that can never overlap an actor) is pre-rendered once into an offscreen canvas, so the game
// loop draws ~20 chunk images per frame instead of ~800 individual tiles. Animated liquids
// are still drawn per tile on top.
import type { GameMap } from '../world/tilemap';
import { ELEV, ELEV_H, GT, SOL } from '../world/tilemap';
import { TILE, WALL_H } from '../data/constants';
import { groundTile, shoreTile, wallFace, wallTop } from './tilecache';
import { hash2, rgba } from '../engine/util';

/** bridge rails along the edges that face open water */
function bakeRails(g: CanvasRenderingContext2D, m: GameMap, x0: number, y0: number): void {
  for (let ty = y0; ty < Math.min(m.h, y0 + CH); ty++) {
    for (let tx = x0; tx < Math.min(m.w, x0 + CH); tx++) {
      if (m.ground[ty * m.w + tx] !== GT.BRIDGE) continue;
      for (const side of [-1, 1]) {
        const n = m.gr(tx + side, ty);
        if (n === GT.BRIDGE) continue;
        const rx = side < 0 ? tx * TILE + 2 : (tx + 1) * TILE - 4;
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.fillRect(rx + side * 3, ty * TILE + 4, 3, TILE);
        g.fillStyle = '#5a3a20';
        g.fillRect(rx, ty * TILE, 2.4, TILE);
        g.fillStyle = '#3a2414';
        for (let py = 4; py < TILE; py += 14) g.fillRect(rx - 0.8, ty * TILE + py - 6, 4, 8);
        g.fillStyle = '#c9a46e';
        g.fillRect(rx + 0.4, ty * TILE, 0.8, TILE);
      }
    }
  }
}

/** plateau tops (lifted by ELEV_H), oblique rock faces and carved stone stairs */
function bakeElevation(g: CanvasRenderingContext2D, m: GameMap, x0: number, y0: number): void {
  if (!m.hasElev) return;
  for (let ty = Math.max(0, y0 - 1); ty < Math.min(m.h, y0 + CH + 1); ty++) {
    for (let tx = x0; tx < Math.min(m.w, x0 + CH); tx++) {
      const i = ty * m.w + tx;
      if (m.elev[i] !== ELEV.PLATEAU) continue;
      const v = Math.floor(hash2(tx, ty, 7) * 4);
      const px = tx * TILE;
      const py = ty * TILE - ELEV_H;
      g.drawImage(groundTile(m.realm, m.ground[i], v, 0), px, py, TILE, TILE);
      g.fillStyle = 'rgba(255,255,240,0.06)';
      g.fillRect(px, py, TILE, TILE);
      const n = ty > 0 ? m.elev[i - m.w] : ELEV.PLATEAU;
      const s = ty < m.h - 1 ? m.elev[i + m.w] : ELEV.PLATEAU;
      const w = tx > 0 ? m.elev[i - 1] : ELEV.PLATEAU;
      const e = tx < m.w - 1 ? m.elev[i + 1] : ELEV.PLATEAU;
      if (n === ELEV.GROUND) {
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(px, py, TILE, 1.6);
      }
      if (w === ELEV.GROUND) {
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(px, py, 2.2, TILE);
      }
      if (e === ELEV.GROUND) {
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(px + TILE - 2.2, py, 2.2, TILE);
      }
      if (s === ELEV.GROUND) {
        g.drawImage(wallFace(m.realm, 'cliff', v + tx), px, (ty + 1) * TILE - ELEV_H, TILE, ELEV_H);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(px, (ty + 1) * TILE - ELEV_H, TILE, 1.4);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(px, (ty + 1) * TILE, TILE, 3);
      } else if (s === ELEV.STAIRS) {
        // carved stone stairs descending south through the face into the stair tile
        const top = (ty + 1) * TILE - ELEV_H;
        const bot = (ty + 2) * TILE;
        const steps = 6;
        const sh = (bot - top) / steps;
        for (let k = 0; k < steps; k++) {
          const yy = top + k * sh;
          g.fillStyle = k % 2 ? '#a89c88' : '#bcb09a';
          g.fillRect(px + 1, yy, TILE - 2, sh * 0.62);
          g.fillStyle = '#6e6454';
          g.fillRect(px + 1, yy + sh * 0.62, TILE - 2, sh * 0.38);
        }
        g.fillStyle = rgba('#000000', 0.25);
        g.fillRect(px, top, 1.5, bot - top);
        g.fillRect(px + TILE - 1.5, top, 1.5, bot - top);
      }
    }
  }
}

const CH = 8;
const MAX_CHUNKS = 64;

interface ChunkCache {
  scale: number;
  chunks: Map<number, HTMLCanvasElement>;
}

const caches = new WeakMap<GameMap, ChunkCache>();

function isAnimated(g: number): boolean {
  return g === GT.LIQUID || g === GT.VOID;
}

/** walls this deep inside a wall mass can never visually overlap an actor, so they are baked */
export function bakedWall(m: GameMap, i: number): boolean {
  return m.solid[i] === SOL.WALL && m.wdepth[i] >= 2;
}

function buildChunk(m: GameMap, cx: number, cy: number, scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const px = CH * TILE;
  // integer canvas size with content scaled to fill it exactly (no partially covered edge column)
  c.width = Math.max(1, Math.round(px * scale));
  c.height = Math.max(1, Math.round(px * scale));
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.scale(c.width / px, c.height / px);
  g.translate(-cx * px, -cy * px);
  const x0 = cx * CH;
  const y0 = cy * CH;
  for (let ty = y0; ty < Math.min(m.h, y0 + CH); ty++) {
    for (let tx = x0; tx < Math.min(m.w, x0 + CH); tx++) {
      const i = ty * m.w + tx;
      if (m.solid[i] === SOL.WALL) continue;
      const gr = m.ground[i];
      if (isAnimated(gr)) continue;
      g.drawImage(groundTile(m.realm, gr, Math.floor(hash2(tx, ty, 7) * 4), 0), tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  bakeRails(g, m, x0, y0);
  bakeElevation(g, m, x0, y0);
  // deep walls (one extra row below so shifted tops crossing the chunk edge are complete)
  for (let ty = y0; ty < Math.min(m.h, y0 + CH + 1); ty++) {
    for (let tx = x0; tx < Math.min(m.w, x0 + CH); tx++) {
      const i = ty * m.w + tx;
      if (!bakedWall(m, i)) continue;
      const shade = m.wallStyle === 'dungeon' || m.wallStyle === 'interior' ? Math.min(3, m.wdepth[i]) : 0;
      g.drawImage(wallTop(m.realm, m.wallStyle, shade, Math.floor(hash2(tx, ty, 3) * 4)), tx * TILE, ty * TILE - WALL_H, TILE, TILE);
    }
  }
  return c;
}

export function drawGround(ctx: CanvasRenderingContext2D, m: GameMap, x0: number, y0: number, x1: number, y1: number, frame: number, viewScale: number): void {
  const scale = Math.min(2, Math.max(1, viewScale));
  let cache = caches.get(m);
  if (!cache || Math.abs(cache.scale - scale) > 0.01) {
    cache = { scale, chunks: new Map() };
    caches.set(m, cache);
  }
  const cw = Math.ceil(m.w / CH);
  const cx0 = Math.max(0, Math.floor(x0 / CH));
  const cx1 = Math.min(cw - 1, Math.floor(x1 / CH));
  const cy0 = Math.max(0, Math.floor((y0 - 1) / CH));
  const cy1 = Math.min(Math.ceil(m.h / CH) - 1, Math.floor((y1 + 1) / CH));
  const px = CH * TILE;
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const key = cy * cw + cx;
      let c = cache.chunks.get(key);
      if (!c) {
        c = buildChunk(m, cx, cy, scale);
        cache.chunks.set(key, c);
        if (cache.chunks.size > MAX_CHUNKS) {
          const first = cache.chunks.keys().next().value as number;
          cache.chunks.delete(first);
        }
      } else {
        cache.chunks.delete(key);
        cache.chunks.set(key, c);
      }
      // a hair of overlap on every side hides anti-aliased seams at fractional zoom levels
      ctx.drawImage(c, cx * px - 0.3, cy * px - 0.3, px + 0.6, px + 0.6);
    }
  }
  // animated liquids + shorelines
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const i = ty * m.w + tx;
      const gr = m.ground[i];
      if (!isAnimated(gr) || m.solid[i] === SOL.WALL) continue;
      ctx.drawImage(groundTile(m.realm, gr, Math.floor(hash2(tx, ty, 7) * 4), frame), tx * TILE, ty * TILE, TILE, TILE);
      if (ty > 0) {
        const ng = m.ground[i - m.w];
        if (!isAnimated(ng) && m.solid[i - m.w] !== SOL.WALL) ctx.drawImage(shoreTile(m.realm, frame), tx * TILE, ty * TILE, TILE, TILE);
      }
    }
  }
}
