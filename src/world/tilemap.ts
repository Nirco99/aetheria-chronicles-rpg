// Tile map container with sliding sub-pixel AABB collision (X first, then Y, with a 4px
// corner nudge so actors never snag on oblique wall corners), line-of-sight and BFS flow fields.
import type {
  AmbientKind, BossRoom, Interactable, MapExit, MapKind, NpcSpawn, Prop, ResourceNode, SpawnZone,
} from '../types/game';
import { TILE } from '../data/constants';

export const GT = {
  VOID: 0, GRASS: 1, GRASS2: 2, FLOWERS: 3, DIRT: 4, PATH: 5, PLAZA: 6, WOOD: 7, SAND: 8,
  LIQUID: 9, FLOOR: 10, FLOOR2: 11, CARPET: 12, WOODFLOOR: 13, ICE: 14, MARBLE: 15,
} as const;

export const SOL = { FREE: 0, WALL: 1, LIQUID: 2, PROP: 3, VOID: 4 } as const;

export type WallStyle = 'cliff' | 'masonry' | 'dungeon' | 'interior';

export interface Box {
  x: number;
  y: number;
  hw: number;
  hh: number;
}

const NUDGE = 4;

export class GameMap {
  readonly ground: Uint8Array;
  readonly solid: Uint8Array;
  readonly wdepth: Uint8Array;
  props: Prop[] = [];
  nodes: ResourceNode[] = [];
  interacts: Interactable[] = [];
  exits: MapExit[] = [];
  spawns: SpawnZone[] = [];
  npcs: NpcSpawn[] = [];
  entries: Record<string, { x: number; y: number }> = {};
  outdoor = true;
  dark = 0;
  music = 'wild';
  ambient: AmbientKind = 'none';
  bossRoom: BossRoom | null = null;
  floor = 0;
  modifiers: string[] = [];
  minimap: HTMLCanvasElement | null = null;
  rooms: { x: number; y: number; w: number; h: number }[] = [];
  chests: { x: number; y: number; rarity: number; opened: boolean }[] = [];
  eliteSpot: { x: number; y: number } | null = null;
  private nextId = 1;

  constructor(
    readonly id: string,
    readonly kind: MapKind,
    readonly realm: number,
    public name: string,
    readonly w: number,
    readonly h: number,
    readonly wallStyle: WallStyle,
  ) {
    this.ground = new Uint8Array(w * h);
    this.solid = new Uint8Array(w * h);
    this.wdepth = new Uint8Array(w * h);
  }

  get pw(): number {
    return this.w * TILE;
  }
  get ph(): number {
    return this.h * TILE;
  }

  uid(): number {
    return this.nextId++;
  }

  idx(tx: number, ty: number): number {
    return ty * this.w + tx;
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h;
  }

  sol(tx: number, ty: number): number {
    if (!this.inBounds(tx, ty)) return SOL.WALL;
    return this.solid[ty * this.w + tx];
  }

  gr(tx: number, ty: number): number {
    if (!this.inBounds(tx, ty)) return GT.VOID;
    return this.ground[ty * this.w + tx];
  }

  set(tx: number, ty: number, ground: number, solid: number): void {
    if (!this.inBounds(tx, ty)) return;
    const i = ty * this.w + tx;
    this.ground[i] = ground;
    this.solid[i] = solid;
  }

  walkable(tx: number, ty: number): boolean {
    return this.sol(tx, ty) === SOL.FREE;
  }

  isWallAt(tx: number, ty: number): boolean {
    return this.sol(tx, ty) === SOL.WALL;
  }

  blocksShot(tx: number, ty: number): boolean {
    const s = this.sol(tx, ty);
    return s === SOL.WALL || s === SOL.PROP;
  }

  /** true when the box does not overlap any blocking tile */
  boxFree(x: number, y: number, hw: number, hh: number, flying = false): boolean {
    const x0 = Math.floor((x - hw) / TILE);
    const x1 = Math.floor((x + hw - 0.001) / TILE);
    const y0 = Math.floor((y - hh) / TILE);
    const y1 = Math.floor((y + hh - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
        const s = this.solid[ty * this.w + tx];
        if (s === SOL.WALL || s === SOL.PROP) return false;
        if (!flying && s !== SOL.FREE) return false;
      }
    }
    return true;
  }

  /**
   * Sliding movement: resolve X first, then Y. When an axis is blocked but would be free
   * with up to NUDGE px of offset on the other axis, slide toward the opening (corner chamfer).
   */
  move(b: Box, dx: number, dy: number, flying = false): { hitX: boolean; hitY: boolean } {
    let hitX = false;
    let hitY = false;
    if (dx !== 0) {
      const nx = b.x + dx;
      if (this.boxFree(nx, b.y, b.hw, b.hh, flying)) b.x = nx;
      else {
        let nudged = false;
        if (dy === 0) {
          for (let n = 1; n <= NUDGE && !nudged; n++) {
            for (const s of [-1, 1]) {
              if (this.boxFree(nx, b.y + s * n, b.hw, b.hh, flying)) {
                const step = Math.min(n, Math.abs(dx));
                if (this.boxFree(b.x, b.y + s * step, b.hw, b.hh, flying)) {
                  b.y += s * step;
                  if (this.boxFree(nx, b.y, b.hw, b.hh, flying)) b.x = nx;
                  nudged = true;
                  break;
                }
              }
            }
          }
        }
        if (!nudged) {
          const sx = Math.sign(dx);
          let rem = Math.abs(dx);
          while (rem > 0) {
            const st = Math.min(0.5, rem);
            if (this.boxFree(b.x + sx * st, b.y, b.hw, b.hh, flying)) {
              b.x += sx * st;
              rem -= st;
            } else break;
          }
          hitX = true;
        }
      }
    }
    if (dy !== 0) {
      const ny = b.y + dy;
      if (this.boxFree(b.x, ny, b.hw, b.hh, flying)) b.y = ny;
      else {
        let nudged = false;
        if (dx === 0) {
          for (let n = 1; n <= NUDGE && !nudged; n++) {
            for (const s of [-1, 1]) {
              if (this.boxFree(b.x + s * n, ny, b.hw, b.hh, flying)) {
                const step = Math.min(n, Math.abs(dy));
                if (this.boxFree(b.x + s * step, b.y, b.hw, b.hh, flying)) {
                  b.x += s * step;
                  if (this.boxFree(b.x, ny, b.hw, b.hh, flying)) b.y = ny;
                  nudged = true;
                  break;
                }
              }
            }
          }
        }
        if (!nudged) {
          const sy = Math.sign(dy);
          let rem = Math.abs(dy);
          while (rem > 0) {
            const st = Math.min(0.5, rem);
            if (this.boxFree(b.x, b.y + sy * st, b.hw, b.hh, flying)) {
              b.y += sy * st;
              rem -= st;
            } else break;
          }
          hitY = true;
        }
      }
    }
    return { hitX, hitY };
  }

  /** furthest reachable point for a box travelling in a straight line (dashes, leaps, blinks) */
  sweep(b: Box, tx: number, ty: number, flying = false): { x: number; y: number } {
    const d = Math.hypot(tx - b.x, ty - b.y);
    const steps = Math.max(1, Math.ceil(d / 4));
    let lx = b.x;
    let ly = b.y;
    for (let i = 1; i <= steps; i++) {
      const px = b.x + ((tx - b.x) * i) / steps;
      const py = b.y + ((ty - b.y) * i) / steps;
      if (!this.boxFree(px, py, b.hw, b.hh, flying)) break;
      lx = px;
      ly = py;
    }
    return { x: lx, y: ly };
  }

  los(x0: number, y0: number, x1: number, y1: number): boolean {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 10);
    for (let i = 1; i < steps; i++) {
      const px = x0 + ((x1 - x0) * i) / steps;
      const py = y0 + ((y1 - y0) * i) / steps;
      if (this.blocksShot(Math.floor(px / TILE), Math.floor(py / TILE))) return false;
    }
    return true;
  }

  /** BFS distance field from a world point across walkable tiles (radius in tiles) */
  flowField(px: number, py: number, radius: number, out: Int16Array): void {
    out.fill(-1);
    const sx = Math.floor(px / TILE);
    const sy = Math.floor(py / TILE);
    if (!this.inBounds(sx, sy)) return;
    const q = new Int32Array(this.w * this.h);
    let qh = 0;
    let qt = 0;
    const start = sy * this.w + sx;
    out[start] = 0;
    q[qt++] = start;
    while (qh < qt) {
      const cur = q[qh++];
      const cd = out[cur];
      if (cd >= radius) continue;
      const cx = cur % this.w;
      const cy = (cur - cx) / this.w;
      for (let k = 0; k < 4; k++) {
        const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
        const ni = ny * this.w + nx;
        if (out[ni] !== -1 || this.solid[ni] !== SOL.FREE) continue;
        out[ni] = cd + 1;
        q[qt++] = ni;
      }
    }
  }

  computeWallDepth(): void {
    const { w, h } = this;
    for (let i = 0; i < w * h; i++) this.wdepth[i] = this.solid[i] === SOL.WALL ? 3 : 0;
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (this.solid[i] !== SOL.WALL) continue;
          let m = 3;
          for (let k = 0; k < 4; k++) {
            const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
            const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const nd = this.solid[ny * w + nx] === SOL.WALL ? this.wdepth[ny * w + nx] : -1;
            m = Math.min(m, nd + 1);
          }
          this.wdepth[i] = Math.max(0, m);
        }
      }
    }
  }

  addInteract(x: number, y: number, label: string, action: Interactable['action'], r = 38): Interactable {
    const it: Interactable = { id: this.uid(), x, y, r, label, action };
    this.interacts.push(it);
    return it;
  }

  addProp(p: Omit<Prop, 'id'>): Prop {
    const prop: Prop = { id: this.uid(), ...p };
    this.props.push(prop);
    return prop;
  }

  /** first free tile near a world point, for spawning */
  nearestFree(px: number, py: number, maxR = 8): { x: number; y: number } {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    for (let r = 0; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.walkable(tx + dx, ty + dy)) return { x: (tx + dx) * TILE + TILE / 2, y: (ty + dy) * TILE + TILE / 2 };
        }
      }
    }
    return { x: px, y: py };
  }
}
