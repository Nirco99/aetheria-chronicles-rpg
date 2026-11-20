// The strategy wiki's procedural engine: the game's own renderers (item icons, gear, monsters,
// mounts, pets, companions, terrain) and its loot / forging math, bundled by
// scripts/build-wiki-data.mjs into wiki/wiki-engine.js as window.AetheriaEngine.
import type { GearItem, Rarity, CraftGrade, MonsterDef, CompanionSave } from '../src/types/game';
import { gearIconCanvas, itemIconCanvas, setIconScale, skillIcon } from '../src/render/icons';
import { drawMonster } from '../src/render/monsters';
import type { Monster } from '../src/entities/monster';
import type { Pet } from '../src/entities/pet';
import { buildCompanionLook, drawHumanoid, lookFromStyle, previewAnim } from '../src/render/paperdoll';
import { drawMount, drawPet } from '../src/render/v3render';
import { drawTemperSparks, visOf } from '../src/render/gear';
import { propSprite } from '../src/render/props';
import { minimapColor, wallFace, wallTop } from '../src/render/tilecache';
import { drawGround } from '../src/render/chunks';
import { gemColor } from '../src/systems/stats';
import { GEAR_BASES, gearStats, gearValue, makeGear, makeSetPiece, makeUnique } from '../src/data/items';
import { MONSTERS, monsterStats } from '../src/data/monsters';
import { GRADE_RARITY, blueprintCost, salvageYield, socketCost, temperCost } from '../src/data/recipes';
import { expectedGear, gearRollOdds, goldRange, killsFor, lootSource, lootTable, mfChance, rarityOdds, type LootCtx } from '../src/data/loot';
import { MOUNT_BY_ID, PET_BY_ID } from '../src/data/v3';
import { COMPANION_BY_ID } from '../src/data/guilds';
import { TILE, WALL_H, tierForLevel } from '../src/data/constants';
import { genCity, genDungeon, genWild } from '../src/world/mapgen';
import { SOL, type GameMap } from '../src/world/tilemap';
import { hash2 } from '../src/engine/util';

export const version = '3.1.0';

setIconScale(4);

// ================================================================== gear

export interface GearSpec {
  kind: 'base' | 'mythic' | 'unique' | 'set';
  base?: string;
  tier: number;
  rarity?: number;
  grade?: CraftGrade | null;
  temper?: number;
  unique?: string;
  set?: string;
  piece?: number;
}

const gearCache = new Map<string, GearItem>();

/** a deterministic, affix-free piece of gear exactly as the game builds it */
export function makeSpecGear(s: GearSpec): GearItem {
  const key = JSON.stringify([s.kind, s.base, s.tier, s.rarity, s.grade, s.unique, s.set, s.piece]);
  let g = gearCache.get(key);
  if (!g) {
    const grade = s.grade ?? null;
    if (s.kind === 'unique') g = makeUnique(s.unique as string, s.tier, false);
    else if (s.kind === 'set') g = makeSetPiece(s.set as string, s.piece ?? 0, s.tier, (s.rarity ?? 3) as Rarity, false);
    else if (s.kind === 'mythic') g = makeGear(s.base as string, 6, 5, { mythic: true, grade, affixes: false });
    else g = makeGear(s.base as string, s.tier, (grade ? GRADE_RARITY[grade] : s.rarity ?? 0) as Rarity, { grade, affixes: false });
    gearCache.set(key, g);
  }
  return { ...g, temper: s.temper ?? 0 };
}

export function gearIcon(s: GearSpec): HTMLCanvasElement {
  return gearIconCanvas(makeSpecGear({ ...s, temper: Math.min(s.temper ?? 0, 10) }));
}

export function gearPreview(s: GearSpec) {
  const g = makeSpecGear(s);
  const steps = [];
  for (let t = 0; t < 10; t++) {
    const c = temperCost({ ...g, temper: t });
    steps.push({ to: t + 1, stone: c.stone, stones: c.stones, gold: c.gold, chance: c.chance });
  }
  return {
    name: g.name,
    rarity: g.rarity,
    grade: g.grade,
    sockets: g.kind === 'weapon' ? g.sockets : 0,
    power: g.power ?? null,
    set: g.set ?? null,
    stats: gearStats(g),
    value: gearValue(g),
    salvage: salvageYield(g),
    socketCost: g.kind === 'weapon' ? socketCost(g) : 0,
    temperSteps: steps,
    blueprint: s.kind === 'base' || s.kind === 'mythic' ? blueprintCost(s.base as string, s.kind === 'mythic' ? 6 : s.tier, s.kind === 'mythic') : null,
  };
}

/** orbiting temper sparks over a gear icon (+4 and higher), drawn the way the game does on equipment */
export function drawSparks(ctx: CanvasRenderingContext2D, s: GearSpec, x: number, y: number, t: number): void {
  const g = makeSpecGear(s);
  const v = visOf(g, gemColor(g));
  if (v && (s.temper ?? 0) >= 4) drawTemperSparks(ctx, x, y, v, t);
}

export function itemIcon(id: string): HTMLCanvasElement {
  return itemIconCanvas(id);
}

export { skillIcon };

// ================================================================== creatures

type Stub = Record<string, unknown>;

function monsterStub(def: MonsterDef): Stub {
  const look = def.humanoid ? lookFromStyle(def.humanoid) : null;
  const flying = !!def.flying;
  return {
    def, x: 0, y: 0, z: 0, bob: 0, spawnT: 0, dead: false, dying: 0, look, anim: previewAnim(0), dir: 0, aim: Math.PI / 2,
    moving: false, vx: 0, vy: 0, flash: 0, frontGuard: def.id === 'b_paragon', broken: 0, st: 'idle', armored: def.id === 'b_wyrm',
    shield: 0, isBoss: !!def.boss, isElite: !!def.elite, healer: def.id === 'spore_pod', variant: 0, statuses: [],
    has: () => false,
    height: () => def.size * 2.3 * (look?.scale ?? 1) + (flying ? 16 : 0),
  };
}

const stubs = new Map<string, Stub>();

/** draws a creature standing at the bottom-centre of a w x h box; dir 0 down, 1 up, 2 left, 3 right */
export function drawCreature(ctx: CanvasRenderingContext2D, id: string, t: number, w: number, h: number, dir = 0, attacking = false): void {
  const def = MONSTERS[id];
  if (!def) return;
  let m = stubs.get(id);
  if (!m) {
    m = monsterStub(def);
    stubs.set(id, m);
  }
  const anim = m.anim as ReturnType<typeof previewAnim>;
  anim.t = t;
  anim.walk = t * 6;
  anim.swing = attacking ? (t * 1.4) % 1 : 0;
  m.st = attacking ? 'attack' : 'idle';
  m.dir = dir;
  m.aim = [Math.PI / 2, -Math.PI / 2, Math.PI, 0][dir];
  const height = (m.height as () => number)();
  const k = Math.min((h * 0.72) / Math.max(18, height), (w * 0.82) / (def.size * 4.4));
  ctx.save();
  ctx.translate(w / 2, h * 0.86);
  ctx.scale(k, k);
  drawMonster(ctx, m as unknown as Monster, t);
  ctx.restore();
}

export function drawMountSprite(ctx: CanvasRenderingContext2D, id: string, t: number, w: number, h: number, dir = 3): void {
  const M = MOUNT_BY_ID[id];
  if (!M) return;
  const big = M.kind === 'drake' || M.kind === 'gryphon';
  const k = Math.min(h / (big ? 64 : 56), w / 64);
  ctx.save();
  ctx.translate(w / 2, h * 0.82);
  ctx.scale(k, k);
  drawMount(ctx, 0, 0, M, dir, t * 5, false);
  drawMount(ctx, 0, 0, M, dir, t * 5, true);
  ctx.restore();
}

export function drawPetSprite(ctx: CanvasRenderingContext2D, id: string, t: number, w: number, h: number): void {
  const def = PET_BY_ID[id];
  if (!def) return;
  const k = Math.min(w, h) / 34;
  ctx.save();
  ctx.translate(w / 2, h * 0.8);
  ctx.scale(k, k);
  drawPet(ctx, { def, x: 0, y: 0, z: 10 + Math.sin(t * 3) * 2.5, face: Math.cos(t * 0.7) >= 0 ? 1 : -1 } as unknown as Pet, t);
  ctx.restore();
}

const kits = new Map<string, CompanionSave>();

/** a companion in the outfit the game gives them when recruited at their level requirement */
export function drawCompanion(ctx: CanvasRenderingContext2D, id: string, t: number, w: number, h: number): void {
  const def = COMPANION_BY_ID[id];
  if (!def) return;
  let cs = kits.get(id);
  if (!cs) {
    const tier = tierForLevel(def.req.level ?? 1);
    const wBase: Record<string, string> = { sword: 'w_sword', twinblade: 'w_twinblade', spear: 'w_spear', halberd: 'w_halberd', bow: 'w_bow', staff: 'w_staff' };
    const chest = def.branch === 'magic' ? 'a_robe' : def.branch === 'dual' || def.branch === 'bow' ? 'a_coat' : def.branch === 'shield' ? 'a_plate' : 'a_brig';
    const head = def.branch === 'shield' ? 'a_helm' : def.branch === 'magic' ? 'a_circlet' : def.branch === 'bow' ? 'a_hood' : null;
    const g = (base: string, cloth = false): GearItem => makeGear(base, tier, 2, cloth ? { colors: def.colors, affixes: false } : { affixes: false });
    cs = {
      recruited: true,
      equip: {
        main: g(wBase[def.weapon]),
        off: def.off === 'shield' ? g('a_shield') : def.off === 'sword' ? g('w_twinblade') : null,
        head: head ? g(head, head === 'a_hood') : null,
        chest: g(chest, chest === 'a_coat' || chest === 'a_robe'),
        boots: g('a_boots'),
        cloak: g('a_cloak', true),
      },
    } as CompanionSave;
    kits.set(id, cs);
  }
  const look = buildCompanionLook(def, cs);
  const k = Math.min(h / 62, w / 44);
  ctx.save();
  ctx.translate(w / 2, h * 0.88);
  ctx.scale(k, k);
  drawHumanoid(ctx, 0, 0, look, previewAnim(t), 0, { aim: Math.PI / 2, moving: false, vx: 0, vy: 0, t });
  ctx.restore();
}

// ================================================================== loot math (identical to the game's rolls)

export function monsterAt(id: string, level: number) {
  return monsterStats(MONSTERS[id], level);
}

export function dropTable(id: string, ctx: LootCtx) {
  return lootTable(MONSTERS[id], ctx);
}

export function goldOf(id: string, level: number, floor: number) {
  return goldRange(MONSTERS[id], level, floor);
}

export function sourceOf(id: string, floor: number) {
  return lootSource(MONSTERS[id], floor);
}

export { expectedGear, gearRollOdds, killsFor, mfChance, rarityOdds };

// ================================================================== atlas: the real maps, drawn by the game's own terrain renderer

export interface AtlasPoi {
  type: string;
  x: number;
  y: number;
  r?: number;
  label?: string;
  item?: string;
  monsters?: string[];
  lvl?: [number, number];
  boss?: string;
  rarity?: number;
}

export interface AtlasMap {
  id: string;
  w: number;
  h: number;
  tile: number;
  hasElev: boolean;
  pois: AtlasPoi[];
  /** paints the whole map at `scale` px per world px into ctx (origin top-left) */
  paint: (ctx: CanvasRenderingContext2D, scale: number) => void;
}

const maps = new Map<string, GameMap>();

function mapOf(realm: number, kind: 'city' | 'wild' | 'dungeon'): GameMap {
  const key = `${kind}:${realm}`;
  let m = maps.get(key);
  if (!m) {
    m = kind === 'city' ? genCity(realm) : kind === 'wild' ? genWild(realm) : genDungeon(realm, 9000 + realm * 31);
    maps.set(key, m);
  }
  return m;
}

export function atlas(realm: number, kind: 'city' | 'wild' | 'dungeon'): AtlasMap {
  const m = mapOf(realm, kind);
  const pois: AtlasPoi[] = [];
  for (const it of m.interacts) {
    const a = it.action;
    const type = a.t === 'shop' ? `shop:${a.shop}` : a.t;
    if (['npc', 'sign', 'node', 'fish', 'furniture', 'companion'].includes(a.t)) continue;
    pois.push({ type, x: it.x, y: it.y, label: it.label });
  }
  for (const n of m.nodes) pois.push({ type: n.kind, x: n.x, y: n.y, item: n.item });
  for (const f of m.fishSpots) pois.push({ type: 'fishing', x: f.x, y: f.y });
  for (const z of m.spawns) pois.push({ type: 'spawn', x: z.x, y: z.y, r: z.r, monsters: [...new Set(z.monsters)], lvl: z.lvl });
  if (m.eliteSpot) pois.push({ type: 'elite', x: m.eliteSpot.x, y: m.eliteSpot.y });
  for (const p of m.pads) pois.push({ type: 'pad', x: p.x, y: p.y });
  for (const c of m.chests) pois.push({ type: 'chest', x: c.x, y: c.y, rarity: c.rarity });
  for (const e of m.exits) pois.push({ type: 'exit', x: e.x + e.w / 2, y: e.y + e.h / 2, label: e.label });
  if (m.bossRoom) pois.push({ type: 'boss', x: (m.bossRoom.x + m.bossRoom.w / 2) * TILE, y: (m.bossRoom.y + m.bossRoom.h / 2) * TILE, r: (Math.min(m.bossRoom.w, m.bossRoom.h) / 2) * TILE, boss: m.bossRoom.boss, lvl: [m.bossRoom.level, m.bossRoom.level] });
  for (const p of m.props) if (p.kind === 'gate' || p.kind === 'abyssgate' || p.kind === 'dungeon') pois.push({ type: `prop:${p.kind}`, x: p.x, y: p.y - 20 });
  for (const p of m.props) if (p.kind === 'building') pois.push({ type: 'building', x: p.x, y: p.y - 16, label: String(p.data?.type ?? '') });

  const paint = (ctx: CanvasRenderingContext2D, scale: number): void => {
    ctx.save();
    ctx.scale(scale, scale);
    // base layer: minimap colours (so shallow walls and map edges are never transparent)
    for (let ty = 0; ty < m.h; ty++) {
      for (let tx = 0; tx < m.w; tx++) {
        const i = ty * m.w + tx;
        ctx.fillStyle = minimapColor(m.realm, m.ground[i], m.solid[i], m.wallStyle);
        ctx.fillRect(tx * TILE, ty * TILE, TILE + 0.5, TILE + 0.5);
      }
    }
    drawGround(ctx, m, 0, 0, m.w - 1, m.h - 1, 0, 1);
    // walls that the chunk baker leaves to the sorted pass: tops + south faces
    for (let ty = 0; ty < m.h; ty++) {
      for (let tx = 0; tx < m.w; tx++) {
        const i = ty * m.w + tx;
        if (m.solid[i] !== SOL.WALL) continue;
        const v = Math.floor(hash2(tx, ty, 3) * 4);
        const depth = m.wallStyle === 'dungeon' || m.wallStyle === 'interior' ? m.wdepth[i] : 0;
        ctx.drawImage(wallTop(m.realm, m.wallStyle, Math.min(3, depth), v), tx * TILE, ty * TILE - WALL_H, TILE, TILE);
        const south = ty + 1 < m.h ? m.solid[i + m.w] : SOL.WALL;
        if (south !== SOL.WALL) ctx.drawImage(wallFace(m.realm, m.wallStyle, v + tx), tx * TILE, (ty + 1) * TILE - WALL_H, TILE, WALL_H);
      }
    }
    // props (trees, rocks, buildings, gates) in depth order
    const props = m.props.filter((p) => !p.hidden).sort((a, b) => a.y + a.sortOff - (b.y + b.sortOff));
    for (const p of props) {
      try {
        ctx.drawImage(propSprite(p, m.realm), p.x - p.ax, p.y - p.ay, p.sw, p.sh);
      } catch {
        // a prop kind without a static sprite (animated in-game) is simply skipped on the atlas
      }
    }
    ctx.restore();
  };

  return { id: m.id, w: m.w, h: m.h, tile: TILE, hasElev: m.hasElev, pois, paint };
}

export function gearBaseIds(): string[] {
  return Object.keys(GEAR_BASES);
}
