// Static ground baking: every 8x8-tile chunk of non-animated ground (plus "deep" wall interiors
// that can never overlap an actor) is pre-rendered once into an offscreen canvas, so the game
// loop draws ~20 chunk images per frame instead of ~800 individual tiles. Animated liquids
// are still drawn per tile on top.
import type { GameMap } from '../world/tilemap';
import { GT, SOL } from '../world/tilemap';
import { TILE, WALL_H } from '../data/constants';
import { groundTile, shoreTile, wallTop } from './tilecache';
import { hash2 } from '../engine/util';

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
  c.width = Math.ceil(px * scale);
  c.height = Math.ceil(px * scale);
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.scale(scale, scale);
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
      ctx.drawImage(c, cx * px, cy * px - 0.01, px, px + 0.02);
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
