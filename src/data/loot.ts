// Loot rules: every drop chance, quantity, gold formula, Magic Find rule and spawn condition in one
// declarative module. The game rolls each kill through lootTable() and the strategy wiki builds its
// drop-rate tables, reverse lookups and Magic Find calculator from the very same functions.
import type { MonsterDef } from '../types/game';
import { REALMS } from './realms';
import { monsterStats } from './monsters';

export type DropClass = 'material' | 'stone' | 'gem' | 'gear' | 'unique' | 'map' | 'relic' | 'mythic';

/** Magic Find scales a non-guaranteed drop as chance x (1 + MF x weight), capped at 100% */
export const MF_WEIGHT: Record<DropClass, number> = { material: 0.5, stone: 0.5, gem: 1, gear: 1, unique: 1, map: 1, relic: 0.5, mythic: 0.5 };

/** gear rarity weights per source: 0 monster, 1 elite, 2 boss, 3 deep Abyss (floor 20+) */
export const LOOT_WEIGHTS: number[][] = [
  [70, 22, 6.5, 1.3, 0.2, 0],
  [20, 40, 28, 9, 3, 0],
  [0, 20, 45, 25, 10, 0],
  [0, 10, 40, 30, 18, 2],
];
/** chance per point of Magic Find that a rolled gear piece is upgraded one rarity (up to Legendary) */
export const MF_RARITY_UPGRADE = 0.35;
/** an Epic or Legendary gear roll becomes a random set piece with this chance: [monster, elite and stronger] */
export const SET_PIECE_CHANCE = [0.15, 0.3];

export const LOOT = {
  /** gold = (base + level x perLevel) x random(min..max) x source multiplier (x abyss inside the Abyss) */
  gold: { base: 3, perLevel: 1.6, min: 0.6, max: 1.4, elite: 4, boss: 14, abyss: 1.3 },
  /** gear pieces: regular monsters roll one piece at `normal`; elites drop one plus a second at `eliteSecond`; bosses drop `boss` */
  gear: { normal: 0.06, eliteSecond: 0.4, boss: 3 },
  stones: { normalLevel: 5, normal: 0.04, greaterLevel: 30, greater: 0.015, elite: 0.5 },
  /** chance of one random Elemental Gem (each of the five types is equally likely) */
  gem: { normal: 0.006, elite: 0.25, boss: 0.6 },
  unique: { elite: 0.015, boss: 0.1, bossDeep: 0.18, deepFloor: 15, raid: 0.45 },
  map: { eliteBoss: 0.12 },
  abyss: { relicFloor: 10, relicStrong: 0.5, relic: 0.04, mythicCore: 0.35, mythicGearFloor: 30, mythicGear: 0.15, deepFloor: 20 },
};

/** Magic Find sources wired into the game besides gear affixes, golden powers, food and pets */
export const MF_SOURCES = {
  /** Style rank bonus at SSS (scales linearly from D = 0) */
  styleMax: 0.4,
  /** Hunting Mastery: bonus against a species once enough of it has been slain */
  huntMastery: 0.1,
  huntKills: { monster: 50, elite: 10, boss: 5 },
  /** Night Hunt: kills in the open wilds between 20:00 and 05:00 */
  night: 0.15,
  /** Crimson Wing Rangers guild perk per rank (rank 1-5) */
  guildPerRank: 0.04,
};

export interface LootCtx {
  level: number;
  /** Abyss floor, 0 outside the Abyss */
  floor: number;
  /** total Magic Find as a fraction (0.25 = +25%) */
  mf: number;
  /** roaming raid boss */
  raid?: boolean;
}

export interface DropLine {
  /** stable key, unique within one table */
  key: string;
  kind: 'item' | 'gem' | 'gear' | 'unique' | 'mythicGear';
  item?: string;
  cls: DropClass;
  /** chance per kill with no Magic Find */
  base: number;
  /** chance per kill with ctx.mf applied */
  chance: number;
  min: number;
  max: number;
  /** listed in the creature's own drop table (false = a global rule) */
  own: boolean;
}

export function dropClassOf(itemId: string): DropClass {
  if (itemId === 'enh_stone' || itemId === 'enh_greater') return 'stone';
  if (itemId === 'treasure_map') return 'map';
  if (itemId === 'relic_shard') return 'relic';
  if (itemId === 'mythic_core') return 'mythic';
  if (itemId.startsWith('gem_')) return 'gem';
  return 'material';
}

export function mfChance(base: number, mf: number, cls: DropClass): number {
  if (base >= 1) return 1;
  return Math.min(1, base * (1 + Math.max(0, mf) * MF_WEIGHT[cls]));
}

/** gear source tier used for rarity weights */
export function lootSource(def: MonsterDef, floor: number): number {
  return floor >= LOOT.abyss.deepFloor ? 3 : def.boss ? 2 : def.elite ? 1 : 0;
}

/** the complete drop table of one kill, in the order the game rolls it */
export function lootTable(def: MonsterDef, ctx: LootCtx): DropLine[] {
  const out: DropLine[] = [];
  const boss = !!def.boss;
  const elite = !!def.elite;
  const lvl = ctx.level;
  const floor = ctx.floor;
  const add = (key: string, kind: DropLine['kind'], cls: DropClass, base: number, min: number, max: number, own: boolean, item?: string): void => {
    if (base <= 0) return;
    out.push({ key, kind, item, cls, base, chance: mfChance(base, ctx.mf, cls), min, max, own });
  };
  for (const d of def.drops) add(d.id, 'item', dropClassOf(d.id), d.chance, d.min ?? 1, d.max ?? 1, true, d.id);
  const S = LOOT.stones;
  if (!boss && !elite && lvl >= S.normalLevel) add('+enh_stone', 'item', 'stone', S.normal, 1, 1, false, 'enh_stone');
  if (!boss && !elite && lvl >= S.greaterLevel) add('+enh_greater', 'item', 'stone', S.greater, 1, 1, false, 'enh_greater');
  if (elite) add('+enh_stone', 'item', 'stone', S.elite, 1, 2, false, 'enh_stone');
  add('+gem', 'gem', 'gem', boss ? LOOT.gem.boss : elite ? LOOT.gem.elite : LOOT.gem.normal, 1, 1, false);
  if (boss) add('+gear', 'gear', 'gear', 1, LOOT.gear.boss, LOOT.gear.boss, false);
  else if (elite) {
    add('+gear', 'gear', 'gear', 1, 1, 1, false);
    add('+gear2', 'gear', 'gear', LOOT.gear.eliteSecond, 1, 1, false);
  } else add('+gear', 'gear', 'gear', LOOT.gear.normal, 1, 1, false);
  const U = LOOT.unique;
  add('+unique', 'unique', 'unique', ctx.raid ? U.raid : boss ? (floor >= U.deepFloor ? U.bossDeep : U.boss) : elite ? U.elite : 0, 1, 1, false);
  if (boss || elite) add('+treasure_map', 'item', 'map', LOOT.map.eliteBoss, 1, 1, false, 'treasure_map');
  const A = LOOT.abyss;
  if (floor >= A.relicFloor) {
    add('+relic_shard', 'item', 'relic', boss || elite ? A.relicStrong : A.relic, 1, 1, false, 'relic_shard');
    if (boss) add('+mythic_core', 'item', 'mythic', A.mythicCore, 1, 1, false, 'mythic_core');
  }
  if (boss && floor >= A.mythicGearFloor) add('+mythic_gear', 'mythicGear', 'gear', A.mythicGear, 1, 1, false);
  return out;
}

/** [min, max] gold of one kill */
export function goldRange(def: MonsterDef, level: number, floor: number): [number, number] {
  const G = LOOT.gold;
  const k = (G.base + level * G.perLevel) * (def.boss ? G.boss : def.elite ? G.elite : 1) * (floor ? G.abyss : 1);
  return [Math.round(k * G.min), Math.round(k * G.max)];
}

export function rollGold(def: MonsterDef, level: number, floor: number, r: number): number {
  const G = LOOT.gold;
  return Math.round((G.base + level * G.perLevel) * (G.min + (G.max - G.min) * r) * (def.boss ? G.boss : def.elite ? G.elite : 1) * (floor ? G.abyss : 1));
}

/** probability of each rarity (Common..Mythic) for one rolled gear piece */
export function rarityOdds(source: number, mf: number): number[] {
  const w = LOOT_WEIGHTS[source];
  const tot = w.reduce((s, v) => s + v, 0);
  const up = Math.min(1, Math.max(0, mf) * MF_RARITY_UPGRADE);
  const out = [0, 0, 0, 0, 0, 0];
  w.forEach((v, r) => {
    const p = v / tot;
    if (r < 4) {
      out[r] += p * (1 - up);
      out[r + 1] += p * up;
    } else out[r] += p;
  });
  return out;
}

/** what one rolled gear piece turns into: plain gear by rarity, a set piece, or a Mythic */
export function gearRollOdds(source: number, mf: number): { plain: number[]; set: number; mythic: number } {
  const r = rarityOdds(source, mf);
  const sc = SET_PIECE_CHANCE[source >= 1 ? 1 : 0];
  const plain = r.map((p, i) => (i === 5 ? 0 : i >= 3 ? p * (1 - sc) : p));
  return { plain, set: (r[3] + r[4]) * sc, mythic: r[5] };
}

/** expected number of gear pieces per kill */
export function expectedGear(lines: DropLine[]): number {
  return lines.filter((l) => l.kind === 'gear').reduce((s, l) => s + l.chance * (l.min + l.max) / 2, 0);
}

/** kills needed for a `conf` chance (default 90%) of seeing a drop at least once */
export function killsFor(p: number, conf = 0.9): number {
  if (p <= 0) return Infinity;
  if (p >= 1) return 1;
  return Math.ceil(Math.log(1 - conf) / Math.log(1 - p));
}

export function huntMasteryKills(def: MonsterDef): number {
  return def.boss ? MF_SOURCES.huntKills.boss : def.elite ? MF_SOURCES.huntKills.elite : MF_SOURCES.huntKills.monster;
}

export function huntMasteryMf(def: MonsterDef, kills: number): number {
  return kills >= huntMasteryKills(def) ? MF_SOURCES.huntMastery : 0;
}

// ------------------------------------------------------------------ spawns

export type SpawnKind = 'wild' | 'dungeon' | 'night' | 'boss' | 'raid' | 'event' | 'summon';

export interface SpawnInfo {
  kind: SpawnKind;
  realm: number;
  /** level range; raid bosses and event gates scale with the player and report their floor */
  levels: [number, number];
}

const SUMMONERS: Record<string, string> = { spore_pod: 'b_treant', ice_clone: 'b_empress' };

/** every place a creature appears and at which levels (mirrors the map generator and world events) */
export function spawnInfo(def: MonsterDef): SpawnInfo[] {
  const out: SpawnInfo[] = [];
  REALMS.forEach((R, realm) => {
    const [l0, l1] = R.levels;
    if (R.monsters.includes(def.id)) out.push({ kind: 'wild', realm, levels: [Math.max(1, l0 - 1), l1 - 1] });
    if (R.dungeonMonsters.includes(def.id)) out.push({ kind: 'dungeon', realm, levels: [l1 - 2, l1 + 1] });
    if (R.elite === def.id) out.push({ kind: 'night', realm, levels: [l1 + 1, l1 + 1] });
    if (R.boss === def.id) out.push({ kind: 'boss', realm, levels: [l1 + 1, l1 + 1] });
  });
  if (def.id.startsWith('r_')) out.push({ kind: 'raid', realm: -1, levels: [REALMS[0].levels[1] + 3, 60] });
  if (def.id === 'ev_gate') out.push({ kind: 'event', realm: -1, levels: [REALMS[0].levels[1], 60] });
  const boss = SUMMONERS[def.id];
  if (boss) {
    const realm = REALMS.findIndex((R) => R.boss === boss);
    const l = REALMS[realm].levels[1] + 1;
    out.push({ kind: 'summon', realm, levels: [l, l] });
  }
  return out;
}

/** representative level of a creature for tables: the top of its first spawn range */
export function typicalLevel(def: MonsterDef): number {
  const s = spawnInfo(def)[0];
  return s ? s.levels[1] : 1;
}

export { monsterStats };
