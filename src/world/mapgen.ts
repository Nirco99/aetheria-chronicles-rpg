// Deterministic procedural generators for every map in Aetheria.
import type { HouseSave, InteractAction, NpcRole, ShopKind } from '../types/game';
import { GameMap, GT, SOL } from './tilemap';
import { REALMS } from '../data/realms';
import { TILE } from '../data/constants';
import { NPC_NAMES } from '../data/lore';
import { COMPANIONS } from '../data/guilds';
import { FURNITURE } from '../data/items';
import { BOSS_IDS } from '../data/monsters';
import { RNG, fbm, hash2 } from '../engine/util';

const T = TILE;
const c = (t: number): number => t * T + T / 2;

function fillRect(m: GameMap, x: number, y: number, w: number, h: number, g: number, s: number): void {
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) m.set(tx, ty, g, s);
}

function fillCircle(m: GameMap, cx: number, cy: number, r: number, g: number, s: number): void {
  for (let ty = Math.floor(cy - r); ty <= Math.ceil(cy + r); ty++) {
    for (let tx = Math.floor(cx - r); tx <= Math.ceil(cx + r); tx++) {
      if ((tx + 0.5 - cx) ** 2 + (ty + 0.5 - cy) ** 2 <= r * r) m.set(tx, ty, g, s);
    }
  }
}

function solidRect(m: GameMap, x: number, y: number, w: number, h: number): void {
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) if (m.inBounds(tx, ty)) m.solid[m.idx(tx, ty)] = SOL.PROP;
}

function areaFree(m: GameMap, x: number, y: number, w: number, h: number, margin = 0): boolean {
  for (let ty = y - margin; ty < y + h + margin; ty++) {
    for (let tx = x - margin; tx < x + w + margin; tx++) {
      if (!m.inBounds(tx, ty) || m.sol(tx, ty) !== SOL.FREE) return false;
    }
  }
  return true;
}

// ------------------------------------------------------------------ prop helpers

function tree(m: GameMap, tx: number, ty: number, rng: RNG): void {
  const P = REALMS[m.realm].palette;
  const tk = rng.pick(P.trees);
  const v = rng.int(0, 2);
  m.solid[m.idx(tx, ty)] = SOL.PROP;
  m.addProp({ kind: 'tree', x: c(tx), y: c(ty) + 8, sprite: `tree:${m.realm}:${tk}:${v}`, ax: 40, ay: 112, sw: 80, sh: 118, sortOff: 0, data: { tk, v },
    light: tk === 'glow' || tk === 'crystal' ? { r: 70, color: P.leaf2, oy: -50 } : undefined });
}

function rock(m: GameMap, tx: number, ty: number, rng: RNG): void {
  const v = rng.int(0, 2);
  m.solid[m.idx(tx, ty)] = SOL.PROP;
  m.addProp({ kind: 'rock', x: c(tx), y: c(ty) + 8, sprite: `rock:${m.realm}:${v}`, ax: 22, ay: 34, sw: 44, sh: 40, sortOff: 0, data: { v } });
}

function bush(m: GameMap, tx: number, ty: number, rng: RNG): void {
  const v = rng.int(0, 2);
  m.addProp({ kind: 'bush', x: c(tx), y: c(ty) + 6, sprite: `bush:${m.realm}:${v}`, ax: 18, ay: 26, sw: 36, sh: 30, sortOff: -6, data: { v } });
}

function lamp(m: GameMap, tx: number, ty: number): void {
  if (m.sol(tx, ty) !== SOL.FREE) return;
  m.solid[m.idx(tx, ty)] = SOL.PROP;
  m.addProp({ kind: 'lamp', x: c(tx), y: c(ty) + 8, sprite: `lamp:${m.realm}`, ax: 12, ay: 70, sw: 24, sh: 74, sortOff: 0,
    light: { r: 120, color: REALMS[m.realm].palette.lampColor, flicker: true, oy: -58 } });
}

function simpleProp(m: GameMap, kind: 'fountain' | 'statue' | 'bench' | 'crate' | 'stall' | 'banner' | 'well' | 'sign' | 'pillar',
  tx: number, ty: number, w: number, h: number, data: Record<string, unknown> = {}, solid = true): void {
  if (!areaFree(m, tx, ty, w, h)) return;
  if (solid) solidRect(m, tx, ty, w, h);
  const dims: Record<string, [number, number, number]> = {
    fountain: [92, 92, 8], statue: [44, 92, 6], bench: [66, 38, 4], crate: [36, 42, 6], stall: [78, 72, 6],
    banner: [28, 92, 6], well: [48, 62, 6], sign: [34, 46, 6], pillar: [40, 100, 6],
  };
  const [sw, sh, off] = dims[kind];
  const key = `${kind}:${m.realm}:${JSON.stringify(data)}`;
  m.addProp({ kind, x: (tx + w / 2) * T, y: (ty + h) * T - off, sprite: key, ax: sw / 2, ay: sh - off, sw, sh, sortOff: 0, data,
    light: kind === 'fountain' && m.realm === 1 ? { r: 80, color: '#7fe9ff', oy: -20 } : undefined });
}

function building(m: GameMap, tx: number, ty: number, w: number, h: number, data: Record<string, unknown>,
  interact?: { label: string; action: InteractAction }): void {
  for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) m.set(x, y, m.gr(x, y), SOL.PROP);
  const roofH = 66 + (h >= 6 ? 18 : 0);
  const sw = w * T + 12;
  const sh = h * T + roofH;
  const light = data.type === 'forge' ? { r: 110, color: '#ff9a3d', flicker: true, oy: -12 } : data.type === 'alchemist' ? { r: 80, color: '#7fe9ff', oy: -12 } : { r: 70, color: REALMS[m.realm].palette.lampColor, oy: -14 };
  m.addProp({ kind: 'building', x: (tx + w / 2) * T, y: (ty + h) * T, sprite: `bld:${m.realm}:${data.type}:${w}x${h}:${data.style ?? 0}`, ax: sw / 2, ay: sh, sw, sh, sortOff: 0, data: { ...data, w, h, roofH }, light });
  const doorTx = tx + Math.floor(w / 2);
  if (m.sol(doorTx, ty + h) === SOL.FREE && m.gr(doorTx, ty + h) !== GT.PLAZA) m.ground[m.idx(doorTx, ty + h)] = GT.PATH;
  if (interact) m.addInteract((tx + w / 2) * T, (ty + h) * T + 12, interact.label, interact.action, 42);
}

function npc(m: GameMap, x: number, y: number, role: NpcRole, rng: RNG, o: { wander?: number; shop?: ShopKind; companion?: string; name?: string } = {}): void {
  m.npcs.push({ x, y, role, name: o.name ?? rng.pick(NPC_NAMES), wander: o.wander ?? 0, shop: o.shop, companion: o.companion });
}

/** draws a thick line of path, turning liquid into bridges */
function carveLine(m: GameMap, x0: number, y0: number, x1: number, y1: number, r: number, g: number): void {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(d * 2));
  for (let i = 0; i <= steps; i++) {
    const px = x0 + ((x1 - x0) * i) / steps;
    const py = y0 + ((y1 - y0) * i) / steps;
    for (let ty = Math.floor(py - r); ty <= Math.ceil(py + r); ty++) {
      for (let tx = Math.floor(px - r); tx <= Math.ceil(px + r); tx++) {
        if (!m.inBounds(tx, ty) || tx < 2 || ty < 1 || tx >= m.w - 2 || ty >= m.h - 2) continue;
        if ((tx + 0.5 - px) ** 2 + (ty + 0.5 - py) ** 2 > r * r) continue;
        const cur = m.gr(tx, ty);
        m.set(tx, ty, cur === GT.LIQUID || cur === GT.VOID ? GT.WOOD : g, SOL.FREE);
      }
    }
  }
}

function floodReach(m: GameMap, sx: number, sy: number): Uint8Array {
  const out = new Uint8Array(m.w * m.h);
  const q: number[] = [m.idx(sx, sy)];
  out[q[0]] = 1;
  while (q.length) {
    const cur = q.pop() as number;
    const cx = cur % m.w;
    const cy = (cur - cx) / m.w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!m.inBounds(nx, ny)) continue;
      const ni = m.idx(nx, ny);
      if (out[ni] || m.solid[ni] !== SOL.FREE) continue;
      out[ni] = 1;
      q.push(ni);
    }
  }
  return out;
}

// ================================================================== CITY

export function genCity(realm: number): GameMap {
  const R = REALMS[realm];
  const W = 56;
  const H = 44;
  const m = new GameMap(`city:${realm}`, 'city', realm, R.city, W, H, 'masonry');
  m.music = 'city';
  m.ambient = R.ambient;
  const rng = new RNG(1000 + realm * 77);
  const seed = 300 + realm * 17;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm(x * 0.15, y * 0.15, seed);
      const g = n > 0.62 ? GT.GRASS2 : n < 0.34 && hash2(x, y, seed) < 0.35 ? GT.FLOWERS : GT.GRASS;
      m.set(x, y, g, SOL.FREE);
    }
  }
  for (let x = 0; x < W; x++) {
    m.set(x, 0, GT.GRASS, SOL.WALL);
    m.set(x, H - 1, GT.GRASS, SOL.WALL);
  }
  for (let y = 0; y < H; y++) {
    m.set(0, y, GT.GRASS, SOL.WALL);
    m.set(W - 1, y, GT.GRASS, SOL.WALL);
  }
  const roadG = realm === 4 ? GT.MARBLE : GT.PATH;
  fillRect(m, 26, 1, 4, H - 1, roadG, SOL.FREE);
  fillRect(m, 2, 19, W - 4, 3, roadG, SOL.FREE);
  fillCircle(m, 28, 20.5, 6.6, GT.PLAZA, SOL.FREE);
  // south gate opening
  fillRect(m, 26, H - 1, 4, 1, roadG, SOL.FREE);
  m.exits.push({ x: 26 * T, y: (H - 1) * T + 14, w: 4 * T, h: T, to: `wild:${realm}`, entry: 'north', label: R.short });

  // decorative water / lava / void feature in the south-west (Arcadia keeps it for the Coliseum)
  if (realm !== 0) {
    for (let y = 31; y < 42; y++) {
      for (let x = 2; x < 23; x++) {
        const dx = (x + 0.5 - 12.5) / 10;
        const dy = (y + 0.5 - 36.5) / 5.6;
        if (dx * dx + dy * dy <= 1) m.set(x, y, GT.LIQUID, R.palette.liquid === 'void' ? SOL.VOID : SOL.LIQUID);
      }
    }
    const deckG = realm === 3 ? GT.ICE : realm === 4 ? GT.MARBLE : GT.WOOD;
    fillRect(m, 11, 30, 3, 9, deckG, SOL.FREE);
    fillRect(m, 6, 35, 12, 3, deckG, SOL.FREE);
    simpleProp(m, 'bench', 7, 36, 2, 1, {}, true);
    simpleProp(m, 'statue', 16, 35, 1, 1, { realm }, true);
  }

  // teleport gate
  solidRect(m, 27, 19, 3, 1);
  m.addProp({ kind: 'gate', x: 28.5 * T, y: 20 * T, sprite: `gate:${realm}`, ax: 66, ay: 150, sw: 132, sh: 156, sortOff: 0, light: { r: 170, color: '#7fe9ff', oy: -60 } });
  m.addInteract(28.5 * T, 20.8 * T, 'Teleport Gate', { t: 'gate' }, 48);
  m.entries.gate = { x: 28.5 * T, y: 21.6 * T };
  m.entries.south = { x: 28 * T, y: (H - 3) * T };
  simpleProp(m, 'fountain', 22, 15, 2, 2, {}, true);
  simpleProp(m, 'fountain', 33, 15, 2, 2, {}, true);

  const B = R.buildings;
  building(m, 5, 6, 7, 5, { type: 'forge', name: B.forge, style: realm }, { label: `Enter ${B.forge}`, action: { t: 'forge' } });
  building(m, 15, 7, 5, 4, { type: 'alchemist', name: B.alchemist, style: realm }, { label: `Enter ${B.alchemist}`, action: { t: 'alchemy' } });
  building(m, 35, 5, 8, 5, { type: 'guild', name: B.guild, style: realm }, { label: `Enter ${B.guild}`, action: { t: 'guild' } });
  building(m, 46, 7, 5, 4, { type: 'estate', name: B.estate, style: realm }, { label: `Enter ${B.estate}`, action: { t: 'estate' } });
  building(m, 5, 25, 7, 4, { type: 'market', name: B.market, style: realm }, { label: `Enter ${B.market}`, action: { t: 'shop', shop: 'market' } });
  building(m, 15, 25, 5, 4, { type: 'general', name: B.general, style: realm }, { label: `Enter ${B.general}`, action: { t: 'shop', shop: 'general' } });
  building(m, 37, 25, 6, 4, { type: 'house', name: R.house.name, style: realm, tier: realm }, { label: R.house.name, action: { t: 'house' } });
  m.entries.house = { x: 40 * T, y: 30 * T };
  if (realm === 0) {
    building(m, 4, 32, 12, 7, { type: 'coliseum', name: 'Grand Coliseum Arena', style: 0 }, { label: 'Enter the Grand Coliseum', action: { t: 'coliseum' } });
    m.entries.coliseum = { x: 10 * T, y: 40.5 * T };
  }
  if (realm === 0 || realm === 4) {
    solidRect(m, 46, 33, 3, 1);
    m.addProp({ kind: 'abyssgate', x: 47.5 * T, y: 34 * T, sprite: `abyssgate:${realm}`, ax: 62, ay: 138, sw: 124, sh: 144, sortOff: 0, light: { r: 150, color: '#a970ff', oy: -50 } });
    m.addInteract(47.5 * T, 34.8 * T, 'Infinite Abyss Gate', { t: 'abyss' }, 46);
    m.entries.abyss = { x: 47.5 * T, y: 36 * T };
  } else {
    simpleProp(m, 'statue', 47, 34, 1, 1, { realm, hero: true }, true);
    simpleProp(m, 'well', 50, 36, 1, 1, {}, true);
  }

  // market stalls, crates, banners
  simpleProp(m, 'stall', 13, 30, 2, 1, { color: R.palette.roofs[0] }, true);
  simpleProp(m, 'stall', 3, 30, 2, 1, { color: R.palette.roofs[1] }, true);
  simpleProp(m, 'crate', 21, 26, 1, 1, { v: 0 }, true);
  simpleProp(m, 'crate', 21, 27, 1, 1, { v: 1 }, true);
  simpleProp(m, 'crate', 13, 7, 1, 1, { v: 1 }, true);
  simpleProp(m, 'banner', 34, 9, 1, 1, { color: '#efe6d2' }, true);
  simpleProp(m, 'banner', 44, 9, 1, 1, { color: '#c18cff' }, true);
  simpleProp(m, 'banner', 34, 6, 1, 1, { color: '#ff5d6c' }, true);
  simpleProp(m, 'banner', 44, 6, 1, 1, { color: '#ffd166' }, true);
  simpleProp(m, 'sign', 31, 40, 1, 1, {}, true);
  m.addInteract(31.5 * T, 41 * T, 'Read Signpost', { t: 'sign', text: `South Gate - the ${R.short} and the ${R.dungeon}.` }, 34);
  simpleProp(m, 'bench', 24, 24, 2, 1, {}, true);
  simpleProp(m, 'bench', 31, 24, 2, 1, {}, true);

  // lamps along roads
  for (let y = 4; y < H - 3; y += 6) {
    lamp(m, 25, y);
    lamp(m, 30, y);
  }
  for (let x = 5; x < W - 4; x += 7) {
    lamp(m, x, 18);
    lamp(m, x, 22);
  }

  // trees on free grass with a margin
  for (let i = 0; i < 260; i++) {
    const tx = rng.int(2, W - 3);
    const ty = rng.int(2, H - 3);
    if (!areaFree(m, tx, ty, 1, 1, 1)) continue;
    const g = m.gr(tx, ty);
    if (g !== GT.GRASS && g !== GT.GRASS2 && g !== GT.FLOWERS) continue;
    let nearRoad = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const gg = m.gr(tx + dx, ty + dy);
      if (gg === GT.PATH || gg === GT.PLAZA || gg === GT.MARBLE || gg === GT.WOOD) nearRoad = true;
    }
    if (nearRoad) continue;
    if (rng.chance(0.55)) tree(m, tx, ty, rng);
    else bush(m, tx, ty, rng);
  }

  // NPCs
  npc(m, c(10), c(11), 'smith', rng, { shop: 'smith' });
  npc(m, c(19), c(11), 'alchemist', rng, { shop: 'alchemist' });
  npc(m, c(41), c(10) + 4, 'guild', rng);
  npc(m, c(50), c(11), 'realtor', rng);
  npc(m, c(10), c(29), 'merchant', rng, { shop: 'market' });
  npc(m, c(19), c(29), 'chef', rng, { shop: 'general' });
  npc(m, c(31), c(22), 'gatekeeper', rng);
  npc(m, c(25), (H - 2) * T, 'guard', rng);
  npc(m, c(30), (H - 2) * T, 'guard', rng);
  if (realm === 0) npc(m, c(13), c(39), 'arena', rng);
  if (realm === 0 || realm === 4) npc(m, c(50), c(35), 'warden', rng);
  for (let i = 0; i < 6; i++) npc(m, c(rng.int(23, 33)), c(rng.int(15, 27)), 'villager', rng, { wander: 90 });
  let ci = 0;
  for (const comp of COMPANIONS) {
    if (comp.city !== realm) continue;
    npc(m, c(35 + ci * 2), c(12) + 6, 'companion', rng, { companion: comp.id, name: comp.name });
    ci++;
  }
  m.computeWallDepth();
  return m;
}

// ================================================================== WILDERNESS

export function genWild(realm: number): GameMap {
  const R = REALMS[realm];
  const P = R.palette;
  const W = 96;
  const H = 72;
  const m = new GameMap(`wild:${realm}`, 'wild', realm, R.short, W, H, 'cliff');
  m.music = 'wild';
  m.ambient = R.ambient;
  const seed = 5000 + realm * 991;
  const rng = new RNG(seed);
  const liquidSolid = P.liquid === 'void' ? SOL.VOID : SOL.LIQUID;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm(x * 0.07, y * 0.07, seed);
      const cl = fbm(x * 0.06 + 40, y * 0.06 + 40, seed + 7);
      const v = fbm(x * 0.2, y * 0.2, seed + 3);
      if (n < 0.3) m.set(x, y, GT.LIQUID, liquidSolid);
      else if (cl > 0.69) m.set(x, y, GT.GRASS, SOL.WALL);
      else if (n < 0.335 && P.liquid === 'water') m.set(x, y, GT.SAND, SOL.FREE);
      else {
        const g = v > 0.64 ? GT.GRASS2 : v < 0.3 ? GT.DIRT : hash2(x, y, seed) < 0.07 ? GT.FLOWERS : GT.GRASS;
        m.set(x, y, g, SOL.FREE);
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) m.set(x, y, GT.GRASS, SOL.WALL);
    }
  }
  // north entrance from the city
  fillRect(m, 44, 0, 8, 4, GT.PATH, SOL.FREE);
  m.exits.push({ x: 44 * T, y: 0, w: 8 * T, h: 12, to: `city:${realm}`, entry: 'south', label: R.city });
  m.entries.north = { x: 48 * T, y: 4 * T };

  // main path to the dungeon
  const dx = rng.int(18, 78);
  const pts: [number, number][] = [[48, 3]];
  const wp = 4;
  for (let i = 1; i <= wp; i++) pts.push([rng.int(10, 86), 3 + (i * 58) / (wp + 1)]);
  pts.push([dx, 67]);
  for (let i = 0; i < pts.length - 1; i++) carveLine(m, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1.6, GT.PATH);
  // side trails
  for (let k = 0; k < 3; k++) {
    const a = rng.pick(pts);
    carveLine(m, a[0], a[1], rng.int(8, 88), rng.int(10, 64), 1.2, GT.DIRT);
  }
  // dungeon entrance clearing
  for (let y = 56; y < 69; y++) for (let x = dx - 5; x <= dx + 5; x++) if (x > 2 && x < W - 3) m.set(x, y, (x + y) % 5 === 0 ? GT.DIRT : GT.GRASS, SOL.FREE);
  fillRect(m, dx - 1, 63, 3, 5, GT.PATH, SOL.FREE);
  solidRect(m, dx - 2, 60, 5, 3);
  m.addProp({ kind: 'dungeon', x: (dx + 0.5) * T, y: 63 * T, sprite: `dungeon:${realm}`, ax: 92, ay: 186, sw: 184, sh: 190, sortOff: 0, light: { r: 120, color: realm === 2 ? '#ff7a3d' : '#7fb4ff', oy: -30 } });
  m.addInteract((dx + 0.5) * T, 63.4 * T, `Enter ${R.dungeon}`, { t: 'dungeon' }, 48);
  m.entries.dungeon = { x: (dx + 0.5) * T, y: 65 * T };
  simpleProp(m, 'sign', 50, 5, 1, 1, {}, true);
  m.addInteract(50.5 * T, 6.4 * T, 'Read Signpost', { t: 'sign', text: `North: ${R.city}. Somewhere to the south lies the ${R.dungeon}.` }, 34);

  // trees, rocks, bushes
  const isPathish = (x: number, y: number): boolean => {
    for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
      const g = m.gr(xx, yy);
      if (g === GT.PATH || g === GT.WOOD) return true;
    }
    return false;
  };
  for (let y = 3; y < H - 3; y++) {
    for (let x = 3; x < W - 3; x++) {
      if (m.sol(x, y) !== SOL.FREE || isPathish(x, y)) continue;
      if (Math.abs(x - dx) < 6 && y > 54) continue;
      const dens = fbm(x * 0.11, y * 0.11, seed + 11);
      const r = hash2(x, y, seed + 99);
      if (dens > 0.56 && r < 0.3) tree(m, x, y, rng);
      else if (r < 0.025) tree(m, x, y, rng);
      else if (r > 0.988) rock(m, x, y, rng);
      else if (r > 0.955 && r < 0.975) bush(m, x, y, rng);
    }
  }

  const reach = floodReach(m, 48, 4);
  const cells: [number, number][] = [];
  for (let y = 4; y < H - 3; y++) for (let x = 3; x < W - 3; x++) if (reach[m.idx(x, y)] && m.gr(x, y) !== GT.PATH && m.gr(x, y) !== GT.WOOD) cells.push([x, y]);
  const openAround = (x: number, y: number): boolean => m.walkable(x + 1, y) && m.walkable(x - 1, y) && m.walkable(x, y + 1) && m.walkable(x, y - 1);
  // ore veins
  let ores = 0;
  for (let tries = 0; tries < 900 && ores < 26; tries++) {
    const [x, y] = rng.pick(cells);
    if (Math.hypot(x - 48, y - 4) < 7 || !m.walkable(x, y) || !openAround(x, y)) continue;
    const item = rng.chance(0.56) ? R.ores[0] : R.ores[1];
    m.solid[m.idx(x, y)] = SOL.PROP;
    m.nodes.push({ id: m.uid(), kind: 'ore', item, x: c(x), y: c(y) + 6, ready: true, respawn: 0, color: '' });
    ores++;
  }
  let herbs = 0;
  for (let tries = 0; tries < 900 && herbs < 22; tries++) {
    const [x, y] = rng.pick(cells);
    if (!m.walkable(x, y) || Math.hypot(x - 48, y - 4) < 5) continue;
    if (m.nodes.some((n) => Math.abs(n.x - c(x)) < T && Math.abs(n.y - c(y)) < T)) continue;
    m.nodes.push({ id: m.uid(), kind: 'herb', item: R.herbs[0], x: c(x), y: c(y) + 4, ready: true, respawn: 0, color: '' });
    herbs++;
  }
  // spawn zones
  const zones: [number, number][] = [];
  for (let tries = 0; tries < 2000 && zones.length < 13; tries++) {
    const [x, y] = rng.pick(cells);
    if (Math.hypot(x - 48, y - 4) < 14) continue;
    if (zones.some(([zx, zy]) => Math.hypot(zx - x, zy - y) < 11)) continue;
    zones.push([x, y]);
  }
  const [l0, l1] = R.levels;
  for (const [x, y] of zones) {
    const depth = Math.min(1, Math.hypot(x - 48, y - 4) / 70);
    const lv = Math.round(l0 + (l1 - 2 - l0) * depth);
    const mons = rng.chance(0.5) ? [rng.pick(R.monsters)] : [rng.pick(R.monsters), rng.pick(R.monsters)];
    m.spawns.push({ x: c(x), y: c(y), r: 3.5 * T, monsters: mons, lvl: [Math.max(1, lv - 1), lv + 1], count: rng.int(3, 5), respawn: 28, timer: 0, alive: 0 });
  }
  // night elite lair: the reachable cell furthest from the entrance
  let best: [number, number] = [48, 30];
  let bd = 0;
  for (const [x, y] of cells) {
    const d = Math.hypot(x - 48, y - 4) + (Math.abs(x - dx) < 8 && y > 50 ? -40 : 0);
    if (d > bd && m.walkable(x, y)) {
      bd = d;
      best = [x, y];
    }
  }
  m.eliteSpot = { x: c(best[0]), y: c(best[1]) };
  m.computeWallDepth();
  return m;
}

// ================================================================== DUNGEON / ABYSS

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: Room, b: Room, margin: number): boolean {
  return a.x - margin < b.x + b.w && a.x + a.w + margin > b.x && a.y - margin < b.y + b.h && a.y + a.h + margin > b.y;
}

function corridor(m: GameMap, a: Room, b: Room, rng: RNG): void {
  const ax = Math.floor(a.x + a.w / 2);
  const ay = Math.floor(a.y + a.h / 2);
  const bx = Math.floor(b.x + b.w / 2);
  const by = Math.floor(b.y + b.h / 2);
  const g = GT.FLOOR2;
  const horizFirst = rng.chance(0.5);
  const carve = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (x + dx < 1 || y + dy < 1 || x + dx >= m.w - 1 || y + dy >= m.h - 1) continue;
      if (m.sol(x + dx, y + dy) === SOL.WALL) m.set(x + dx, y + dy, g, SOL.FREE);
    }
  };
  if (horizFirst) {
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) carve(x, ay);
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) carve(bx, y);
  } else {
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) carve(ax, y);
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) carve(x, by);
  }
}

export function genDungeon(realm: number, seed: number, abyssFloor = 0): GameMap {
  const R = REALMS[realm];
  const W = 64;
  const H = 64;
  const abyss = abyssFloor > 0;
  const bossRush = abyss && abyssFloor % 5 === 0;
  const m = new GameMap(abyss ? `abyss:${abyssFloor}` : `dun:${realm}`, abyss ? 'abyss' : 'dungeon', realm,
    abyss ? `Infinite Abyss - Floor ${abyssFloor}` : R.dungeon, W, H, 'dungeon');
  m.music = abyss ? 'abyss' : 'dungeon';
  m.outdoor = false;
  m.dark = 0.6;
  m.ambient = 'dust';
  m.floor = abyssFloor;
  const rng = new RNG(seed);
  fillRect(m, 0, 0, W, H, GT.FLOOR, SOL.WALL);

  const corners: [number, number][] = [[3, 3], [W - 13, 3], [3, H - 12], [W - 13, H - 12]];
  const ci = rng.int(0, 3);
  const entrance: Room = { x: corners[ci][0], y: corners[ci][1], w: 10, h: 9 };
  const bw = bossRush ? 24 : 18;
  const bh = bossRush ? 18 : 15;
  const opp = 3 - ci;
  const bx = opp % 2 === 0 ? 3 : W - bw - 3;
  const by = opp < 2 ? 3 : H - bh - 3;
  const bossRoom: Room = { x: bx, y: by, w: bw, h: bh };
  const rooms: Room[] = [entrance];
  const target = bossRush ? 3 : 9;
  for (let tries = 0; tries < 600 && rooms.length < target + 1; tries++) {
    const r: Room = { x: rng.int(3, W - 15), y: rng.int(3, H - 13), w: rng.int(7, 12), h: rng.int(6, 10) };
    if (overlaps(r, bossRoom, 3) || rooms.some((o) => overlaps(r, o, 2))) continue;
    rooms.push(r);
  }
  for (const r of [...rooms, bossRoom]) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) m.set(x, y, (x + y) % 2 === 0 ? GT.FLOOR : GT.FLOOR2, SOL.FREE);
  }
  // connect rooms: chain by nearest unconnected
  const connected: Room[] = [entrance];
  const pending = rooms.slice(1);
  while (pending.length) {
    let bi = 0;
    let bj = 0;
    let bd = Infinity;
    for (let i = 0; i < pending.length; i++) {
      for (let j = 0; j < connected.length; j++) {
        const d = Math.hypot(pending[i].x - connected[j].x, pending[i].y - connected[j].y);
        if (d < bd) {
          bd = d;
          bi = i;
          bj = j;
        }
      }
    }
    corridor(m, pending[bi], connected[bj], rng);
    connected.push(pending[bi]);
    pending.splice(bi, 1);
  }
  for (let k = 0; k < 2 && rooms.length > 3; k++) corridor(m, rng.pick(rooms.slice(1)), rng.pick(rooms.slice(1)), rng);
  // boss room connects to its nearest room only
  let near = rooms[0];
  let nd = Infinity;
  for (const r of rooms) {
    const d = Math.hypot(r.x - bossRoom.x, r.y - bossRoom.y);
    if (d < nd) {
      nd = d;
      near = r;
    }
  }
  corridor(m, near, bossRoom, rng);
  // door cells on the boss room's outer ring
  const doorCells: number[] = [];
  for (let y = bossRoom.y - 1; y <= bossRoom.y + bossRoom.h; y++) {
    for (let x = bossRoom.x - 1; x <= bossRoom.x + bossRoom.w; x++) {
      const ring = x === bossRoom.x - 1 || x === bossRoom.x + bossRoom.w || y === bossRoom.y - 1 || y === bossRoom.y + bossRoom.h;
      if (ring && m.walkable(x, y)) doorCells.push(m.idx(x, y));
    }
  }
  const level = abyss ? 8 + abyssFloor : R.levels[1] + 1;
  let bossId = abyss ? R.elite : R.boss;
  if (bossRush) {
    const pool = [...BOSS_IDS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    bossId = 'rush:' + pool.slice(0, abyssFloor >= 25 ? 3 : 2).join(',');
  }
  m.bossRoom = { x: bossRoom.x, y: bossRoom.y, w: bossRoom.w, h: bossRoom.h, boss: bossId, level, doorCells, started: false, defeated: false };
  m.rooms = [...rooms, bossRoom];

  // entrance stairs
  const ex = entrance.x + Math.floor(entrance.w / 2);
  m.addProp({ kind: 'stairs', x: c(ex), y: (entrance.y + 1) * T, sprite: `stairs:${realm}:up`, ax: 34, ay: 56, sw: 68, sh: 60, sortOff: -40, data: { up: true } });
  m.addInteract(c(ex), (entrance.y + 1) * T + 6, abyss ? 'Return to the surface' : 'Leave the dungeon', abyss ? { t: 'leaveAbyss' } : { t: 'leaveDungeon' }, 40);
  m.entries.entrance = { x: c(ex), y: c(entrance.y + 4) };
  m.entries.boss = { x: c(bossRoom.x + bossRoom.w / 2), y: c(bossRoom.y + bossRoom.h / 2) };

  // monsters
  const realmPool = abyss ? [...R.monsters, ...R.dungeonMonsters] : R.dungeonMonsters;
  for (const r of rooms.slice(1)) {
    const area = r.w * r.h;
    const lv = abyss ? level : rng.int(R.levels[1] - 2, R.levels[1]);
    m.spawns.push({ x: c(r.x + r.w / 2), y: c(r.y + r.h / 2), r: (Math.min(r.w, r.h) / 2 - 1) * T, monsters: [rng.pick(realmPool), rng.pick(realmPool)], lvl: [lv, lv + 1], count: Math.max(2, Math.min(6, Math.round(area / 15) + (abyss ? 1 : 0))), respawn: abyss ? 0 : 9999, timer: 0, alive: 0 });
    if (r.w >= 10 && r.h >= 8) {
      for (const [px, py] of [[r.x + 2, r.y + 2], [r.x + r.w - 3, r.y + 2], [r.x + 2, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]]) simpleProp(m, 'pillar', px, py, 1, 1, { realm }, true);
    }
  }
  // treasure chests
  const chestRooms = rooms.slice(1);
  for (let k = 0; k < Math.min(3, chestRooms.length); k++) {
    const r = chestRooms[rng.int(0, chestRooms.length - 1)];
    const x = rng.int(r.x + 1, r.x + r.w - 2);
    const y = rng.int(r.y + 1, r.y + r.h - 2);
    if (m.walkable(x, y)) m.chests.push({ x: c(x), y: c(y), rarity: rng.int(1, abyss ? 3 : 2), opened: false });
  }
  // wall torches
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (m.sol(x, y) === SOL.WALL && m.walkable(x, y + 1) && (x * 7 + y * 3) % 6 === 0) {
        m.addProp({ kind: 'torch', x: c(x), y: (y + 1) * T - 1, sprite: `torch:${realm}`, ax: 9, ay: 34, sw: 18, sh: 30, sortOff: 2,
          light: { r: 130, color: abyss ? '#b98bff' : realm === 3 ? '#9fdcff' : '#ffae5c', flicker: true, oy: -26 } });
      }
    }
  }
  m.computeWallDepth();
  return m;
}

export function abyssModifiers(floor: number, seed: number): string[] {
  const rng = new RNG(seed + 17);
  const all = ['Molten', 'Vampiric', 'Arcane-Shielded', 'Hasted'];
  const n = 1 + (floor >= 15 ? 1 : 0) + (floor >= 40 ? 1 : 0);
  const out: string[] = [];
  while (out.length < n) {
    const p = rng.pick(all);
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

// ================================================================== HOUSE

export function genHouse(realm: number, house: HouseSave): GameMap {
  const R = REALMS[realm];
  const W = R.house.w + 2;
  const H = R.house.h + 3;
  const m = new GameMap(`house:${realm}`, 'house', realm, R.house.name, W, H, 'interior');
  m.outdoor = false;
  m.dark = 0.18;
  m.music = 'house';
  fillRect(m, 0, 0, W, H, GT.WOODFLOOR, SOL.WALL);
  fillRect(m, 1, 2, W - 2, H - 3, GT.WOODFLOOR, SOL.FREE);
  const door = Math.floor(W / 2);
  m.set(door, H - 1, GT.WOODFLOOR, SOL.FREE);
  m.exits.push({ x: door * T, y: (H - 1) * T + 16, w: T, h: T, to: `city:${realm}`, entry: 'house', label: R.city });
  m.addInteract(c(door), (H - 1) * T + 4, `Leave (${R.city})`, { t: 'exitHouse' }, 30);
  m.entries.door = { x: c(door), y: (H - 2) * T + 8 };
  house.furniture.forEach((f, i) => placeFurnitureProp(m, f.kind, f.item, f.tx, f.ty, i));
  m.computeWallDepth();
  return m;
}

export function placeFurnitureProp(m: GameMap, kind: keyof typeof FURNITURE, item: string, tx: number, ty: number, index: number): void {
  const fd = FURNITURE[kind];
  if (!fd.walkable) solidRect(m, tx, ty, fd.w, fd.h);
  const sw = fd.w * T + 8;
  const sh = fd.h * T + (kind === 'rug' ? 0 : kind === 'bookshelf' || kind === 'mannequin' || kind === 'rack' ? 56 : kind === 'trophy' || kind === 'lantern' ? 46 : 26);
  m.addProp({ kind: 'furniture', x: (tx + fd.w / 2) * T, y: (ty + fd.h) * T - 2, sprite: `furn:${kind}:${item}:${m.realm}`, ax: sw / 2, ay: sh - 2, sw, sh,
    sortOff: kind === 'rug' ? -2000 : 0, data: { kind, item, index, tx, ty },
    light: fd.light ? { r: kind === 'lantern' ? 120 : 80, color: fd.light, flicker: kind !== 'trophy', oy: -20 } : undefined });
  if (kind !== 'rug' && kind !== 'plant' && kind !== 'table' && kind !== 'chair' && kind !== 'banner') {
    const labels: Record<string, string> = {
      vault: 'Open Storage Vault', anvil: 'Use Master Anvil', alchemy: 'Use Alchemy Station', hearth: 'Use Cooking Hearth', bed: 'Sleep in the Royal Bed',
      trophy: 'Admire Trophy', rack: 'Weapon Display Rack', mannequin: 'Armor Mannequin', lantern: 'Crystal Lantern', bookshelf: 'Browse Bookshelf',
    };
    m.addInteract((tx + fd.w / 2) * T, (ty + fd.h) * T + 8, labels[kind] ?? 'Use', { t: 'furniture', index }, 34);
  }
}

// ================================================================== ARENA

export function genArena(): GameMap {
  const W = 34;
  const H = 26;
  const m = new GameMap('arena', 'arena', 0, 'Grand Coliseum Arena', W, H, 'masonry');
  m.music = 'arena';
  m.ambient = 'blossom';
  fillRect(m, 0, 0, W, H, GT.PLAZA, SOL.WALL);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const dx = (x + 0.5 - W / 2) / 15;
      const dy = (y + 0.5 - H / 2) / 10.5;
      const d = dx * dx + dy * dy;
      if (d <= 1) m.set(x, y, d > 0.8 ? GT.PLAZA : GT.SAND, SOL.FREE);
    }
  }
  const door = Math.floor(W / 2);
  for (let y = H - 4; y < H; y++) fillRect(m, door - 1, y, 2, 1, GT.PLAZA, SOL.FREE);
  m.addInteract(door * T, (H - 1) * T, 'Leave the Coliseum', { t: 'leaveArena' }, 36);
  m.entries.door = { x: door * T, y: (H - 5) * T };
  m.entries.center = { x: door * T, y: (H / 2) * T };
  for (const [x, y] of [[8, 4], [25, 4], [5, 13], [28, 13], [8, 21], [25, 21]]) {
    m.addProp({ kind: 'torch', x: c(x), y: c(y), sprite: 'torch:0', ax: 9, ay: 34, sw: 18, sh: 30, sortOff: 2, light: { r: 140, color: '#ffae5c', flicker: true, oy: -26 } });
  }
  for (const [x, y] of [[12, 3], [21, 3]]) simpleProp(m, 'banner', x, y, 1, 1, { color: x < 16 ? '#ff5d6c' : '#3f7fe0' }, true);
  m.computeWallDepth();
  return m;
}
