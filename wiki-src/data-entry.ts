// Extracts the complete game dataset for the strategy wiki straight from the game's own registries
// (src/data/*). scripts/build-wiki-data.mjs bundles this file for Node, runs buildDataset(), adds
// the Hebrew text from wiki-src/i18n and writes wiki/wiki-data.js. Every translatable string is
// emitted as { en } (or { en, parts } for composed names) so the generator can prove that nothing
// is left untranslated.
import {
  ACTIVE_RANKS, ACTIVE_SP, ARMOR_INFO, BRANCHES, BRANCH_INFO, CUPS, ELEMENT_COLORS, GEM_INFO, GEM_TYPES, GRADE_INFO,
  MAX_LEVEL, MAX_RANK, MAX_TEMPER, NIGHT_END, NIGHT_START, PASSIVE_RANKS, RARITY_COLORS, RARITY_MULT, RARITY_NAMES,
  SECONDS_PER_HOUR, TEMPER_STEP, TIERS, WEAPON_INFO, masteryToNext, xpToNext,
} from '../src/data/constants';
import { FURNITURE, GEAR_BASES, GEAR_BASE_IDS, ITEMS, TROPHIES, FRACTIONAL, gearName, scaleStats } from '../src/data/items';
import { BOSS_IDS, MONSTERS, monsterStats } from '../src/data/monsters';
import { REALMS } from '../src/data/realms';
import { ACTIVE_SKILLS, AWAKENINGS, PASSIVE_SKILLS } from '../src/data/skills';
import {
  ALCHEMY, AUTO_FORGE_ODDS, COOKING, FORGE_GUILD_QUALITY, FORGE_HOME_QUALITY, GRADE_RARITY, GRADE_THRESHOLDS, SMELT,
  TEMPER_CHANCE, TEMPER_GUILD_PER_RANK, TEMPER_SET_BONUS, blueprintCost,
} from '../src/data/recipes';
import { COMPANIONS, GUILDS, GUILD_IDS, GUILD_RANKS, GUILD_REP } from '../src/data/guilds';
import {
  ACHIEVEMENTS, AFFINITY_NAMES, AFFINITY_RANKS, AFFIXES, AFFIX_COUNT, BRANCH_ELEMENT, BRIDGES, DYES, DYE_PRICE, ELEMENT_GAUGE,
  FISH, GAMBITS, GAMBIT_ORDER, GAUGE_COLORS, GAUGE_DUR, KEYSTONES, MORPHS, MORPH_RANK, MOUNTS, PETS, POWERS, RAID_BOSSES,
  REACTIONS, REACTION_RULES, GAUGE_RULES, SECTOR_ORDER, SETS, SKILL_MAX_RANK, SKILL_RANK_CDR, SKILL_RANK_DMG, STYLE_MAX, STYLE_RANKS, UNIQUES,
  extractable, morphName, skillRankCost, skillRankMastery,
} from '../src/data/v3';
import { COMBOS, FRAMES, SIM_HZ } from '../src/data/framedata';
import {
  LOOT, LOOT_WEIGHTS, MF_RARITY_UPGRADE, MF_SOURCES, MF_WEIGHT, SET_PIECE_CHANCE, goldRange, lootTable, spawnInfo, typicalLevel,
} from '../src/data/loot';
import type { MonsterDef, StatBlock } from '../src/types/game';

export interface Tx {
  en: string;
  /** composed text: the generator translates each part and joins them with `sep` */
  parts?: string[];
  sep?: string;
}

const T = (en: string): Tx => ({ en });
const Tp = (en: string, parts: string[], sep: string): Tx => ({ en, parts, sep });
const opt = (s: string | undefined): Tx | null => (s ? T(s) : null);

const ELEMENT_NAMES: Record<string, string> = { none: 'None', fire: 'Fire', frost: 'Frost', lightning: 'Lightning', wind: 'Wind', void: 'Void', holy: 'Holy', poison: 'Poison' };
const GAUGE_NAMES: Record<string, string> = { burn: 'Burn', frost: 'Frost', shock: 'Shock', bleed: 'Bleed', venom: 'Venom', aether: 'Aether' };
const STATUS_NAMES: Record<string, string> = { burn: 'Burn', poison: 'Poison', chill: 'Chill', freeze: 'Freeze', shock: 'Shock', root: 'Root', stun: 'Stun', shred: 'Armor Shred', slow: 'Slow' };
const WEATHER_NAMES: Record<string, string> = { clear: 'Clear', rain: 'Rain', storm: 'Thunderstorm', blizzard: 'Blizzard', ash: 'Ember Ash' };
const STAT_LABELS: Record<string, string> = {
  atk: 'ATK', def: 'DEF', mag: 'MAG', hp: 'Max HP', mp: 'Max MP', crit: 'Critical Chance', critDmg: 'Critical Damage',
  aspd: 'Attack Speed', move: 'Move Speed', brk: 'Break Power', block: 'Block Efficiency', regen: 'MP Regeneration',
  atkPct: 'ATK %', defPct: 'DEF %', magPct: 'MAG %', hpPct: 'Max HP %', xpPct: 'XP Gain', lifesteal: 'Lifesteal',
  skillDmg: 'Sword Skill Damage', cdr: 'Cooldown Reduction', magicFind: 'Magic Find',
};

function itemSub(id: string, cat: string): string {
  if (cat === 'furniture') return 'furniture';
  if (cat === 'trophy') return 'trophy';
  if (cat === 'gem') return 'gem';
  if (cat === 'food') return 'dish';
  if (cat === 'consumable') return id.startsWith('oil_') ? 'oil' : id === 'treasure_map' ? 'map' : 'potion';
  if (id.startsWith('ore_')) return 'ore';
  if (id.startsWith('ingot_')) return 'ingot';
  if (id.startsWith('herb_')) return 'herb';
  if (id === 'fish' || id.startsWith('fish_')) return 'fish';
  if (id === 'enh_stone' || id === 'enh_greater') return 'stone';
  if (id === 'relic_shard' || id === 'mythic_core' || id === 'arcane_dust') return 'relic';
  if (id === 'spice' || id === 'bread' || id === 'honey') return 'ingredient';
  return 'monster';
}

function stats(s: StatBlock | undefined): StatBlock {
  return s ? { ...s } : {};
}

/**
 * Runs a Sword Skill's timeline script against a recording stub of the SkillAPI and returns when each
 * strike lands, its damage multiplier, and when the last scripted event resolves (the moment the
 * Skill Connect window opens in-game, see SkillRun.eventsDone).
 */
function skillTimeline(s: (typeof ACTIVE_SKILLS)[number]) {
  const hits: { t: number; m: number; k: string }[] = [];
  let cur = 0;
  let end = 0;
  let counter: [number, number] | null = null;
  let move: [number, number] | null = null;
  const mark = (t: number) => { end = Math.max(end, t); };
  const api = new Proxy({} as Record<string, unknown>, {
    get(_o, p) {
      switch (p) {
        case 'aim': return 0;
        case 'caster': return { x: 0, y: 0 };
        case 'tx': case 'ty': return 120;
        case 'at': return (t: number, fn: () => void) => { const prev = cur; cur = t; mark(t); fn(); cur = prev; };
        case 'counter': return (dur: number) => { counter = [cur, cur + dur]; mark(cur + dur); };
        case 'hit': return (o: { mult?: number }) => { hits.push({ t: cur, m: o.mult ?? 1, k: 'hit' }); };
        case 'proj': return (o: { mult?: number }) => { hits.push({ t: cur, m: o.mult ?? 1, k: 'proj' }); };
        case 'rain': return (_x: number, _y: number, _r: number, count: number, dur: number, mult: number) => { for (let i = 0; i < count; i++) hits.push({ t: +(cur + (dur * i) / count).toFixed(3), m: mult, k: 'rain' }); };
        case 'chain': return (mult: number, jumps: number) => { for (let j = 0; j < jumps; j++) hits.push({ t: cur, m: +(mult * Math.pow(0.85, j)).toFixed(3), k: 'chain' }); };
        case 'dash': return (_a: number, _d: number, dur: number) => mark(cur + dur);
        case 'leap': return (_x: number, _y: number, dur: number) => mark(cur + dur);
        case 'allowMove': return (dur: number) => { move = [cur, cur + dur]; };
        default: return () => undefined;
      }
    },
  });
  (s.run as unknown as (a: unknown) => void)(api);
  hits.sort((a, b) => a.t - b.t);
  return { hits, eventsEnd: +end.toFixed(3), counter, move, total: +hits.reduce((x, h) => x + h.m, 0).toFixed(2) };
}

function monsterEntry(def: MonsterDef) {
  const bdef = def as MonsterDef & { phases?: { at: number; name: string; attacks: string[]; speed?: number; enter?: string }[]; intro?: string; trophy?: string };
  const level = typicalLevel(def);
  return {
    id: def.id,
    name: T(def.name),
    title: opt(def.title),
    draw: def.draw,
    realm: def.realm,
    boss: !!def.boss,
    elite: !!def.elite,
    raid: def.id.startsWith('r_'),
    event: def.id === 'ev_gate',
    main: BOSS_IDS.includes(def.id),
    element: def.element ?? 'none',
    weak: def.weak ?? [],
    resist: def.resist ?? [],
    size: def.size,
    flying: !!def.flying,
    ranged: !!def.ranged,
    colors: def.colors,
    mult: { hp: def.hp, atk: def.atk, def: def.def, speed: def.speed, poise: def.poise, xp: def.xp },
    aggro: def.aggro,
    attacks: def.attacks.map((a) => ({
      id: a.id,
      name: T(a.name ?? a.id),
      shape: a.shape,
      element: a.element ?? a.proj?.element ?? 'none',
      status: a.status ?? a.proj?.status ?? null,
      mult: a.mult,
      cd: a.cd,
      windup: a.windup,
      range: a.range,
      count: a.count ?? 1,
      repeat: a.repeat ?? 1,
      special: a.special ?? null,
      kb: a.kb ?? 0,
    })),
    phases: (bdef.phases ?? []).map((p) => ({ at: p.at, name: T(p.name), attacks: p.attacks, speed: p.speed ?? 1, enter: p.enter ?? null })),
    intro: opt(bdef.intro),
    trophy: bdef.trophy ?? null,
    drops: def.drops.map((d) => ({ id: d.id, chance: d.chance, min: d.min ?? 1, max: d.max ?? 1 })),
    spawns: spawnInfo(def),
    level,
    statsAt: monsterStats(def, level),
    gold: goldRange(def, level, 0),
    table: lootTable(def, { level, floor: 0, mf: 0, raid: def.id.startsWith('r_') }),
  };
}

export function buildDataset() {
  const items = Object.values(ITEMS).map((d) => ({
    id: d.id,
    cat: d.cat,
    sub: itemSub(d.id, d.cat),
    name: d.cat === 'trophy'
      ? Tp(d.name, ['Trophy', d.name.replace(/^Trophy: /, '')], ': ')
      : T(d.name),
    desc: T(d.desc),
    value: d.value,
    color: d.color,
    icon: d.icon,
    tier: d.tier ?? null,
    gem: d.gem ?? null,
    furniture: d.furniture ?? null,
    trophyOf: d.trophyOf ?? null,
    effect: d.effect
      ? {
          heal: d.effect.heal ?? 0,
          mana: d.effect.mana ?? 0,
          sta: d.effect.sta ?? 0,
          cleanse: !!d.effect.cleanse,
          buff: d.effect.buff
            ? { name: T(d.effect.buff.name), dur: d.effect.buff.dur, stats: stats(d.effect.buff.stats), hpRegen: d.effect.buff.hpRegen ?? 0, oil: d.effect.buff.oil ?? null }
            : null,
        }
      : null,
  }));

  const gearBases = GEAR_BASE_IDS.map((id) => {
    const b = GEAR_BASES[id];
    return { id, kind: b.kind, wtype: b.wtype ?? null, aslot: b.aslot ?? null, style: b.style, label: T(b.label), stats: stats(b.stats), ingots: b.ingots, mats: b.mats, cloth: b.cloth };
  });

  const gear: unknown[] = [];
  for (const id of GEAR_BASE_IDS) {
    const b = GEAR_BASES[id];
    for (let t = 0; t < TIERS.length; t++) {
      gear.push({ id: `${id}@${t}`, base: id, tier: t, mythic: false, name: T(gearName(b, t, false)), level: TIERS[t].level, stats: scaleStats(b.stats, t), blueprint: blueprintCost(id, t, false) });
    }
    gear.push({ id: `${id}@6m`, base: id, tier: 6, mythic: true, name: T(gearName(b, 6, true)), level: TIERS[6].level, stats: scaleStats(b.stats, 6), blueprint: blueprintCost(id, 6, true) });
  }

  const monsters = Object.values(MONSTERS).map(monsterEntry);

  return {
    version: '4.0.0',
    meta: {
      maxLevel: MAX_LEVEL,
      maxRank: MAX_RANK,
      maxTemper: MAX_TEMPER,
      temperStep: TEMPER_STEP,
      simHz: SIM_HZ,
      night: [NIGHT_START, NIGHT_END],
      secondsPerHour: SECONDS_PER_HOUR,
      activeRanks: ACTIVE_RANKS,
      activeSp: ACTIVE_SP,
      passiveRanks: PASSIVE_RANKS,
      xpCurve: Array.from({ length: MAX_LEVEL }, (_, i) => xpToNext(i + 1)),
      masteryCurve: Array.from({ length: MAX_RANK }, (_, i) => masteryToNext(i + 1)),
      fractional: FRACTIONAL,
    },
    rarity: RARITY_NAMES.map((n, i) => ({ id: i, name: T(n), color: RARITY_COLORS[i], mult: RARITY_MULT[i] })),
    grades: Object.entries(GRADE_INFO).map(([id, g]) => ({ id, name: T(g.name), mult: g.mult, color: g.color, sockets: g.sockets, rarity: GRADE_RARITY[id as keyof typeof GRADE_RARITY] })),
    tiers: TIERS.map((t, i) => ({ id: i, name: T(t.name), level: t.level, power: t.power, ingot: t.ingot, mat: t.mat, realm: t.realm, colors: t.colors })),
    elements: Object.keys(ELEMENT_COLORS).map((id) => ({ id, name: T(ELEMENT_NAMES[id]), color: ELEMENT_COLORS[id as keyof typeof ELEMENT_COLORS], gauge: ELEMENT_GAUGE[id as keyof typeof ELEMENT_GAUGE] ?? null })),
    gauges: Object.keys(GAUGE_COLORS).map((id) => ({ id, name: T(GAUGE_NAMES[id]), color: GAUGE_COLORS[id as keyof typeof GAUGE_COLORS] })),
    gaugeDur: GAUGE_DUR,
    statuses: Object.entries(STATUS_NAMES).map(([id, n]) => ({ id, name: T(n) })),
    statLabels: Object.entries(STAT_LABELS).map(([id, n]) => ({ id, name: T(n), pct: FRACTIONAL.includes(id as keyof StatBlock) })),
    weather: Object.entries(WEATHER_NAMES).map(([id, n]) => ({ id, name: T(n) })),
    gems: GEM_TYPES.map((g) => ({ id: g, item: 'gem_' + g, name: T(GEM_INFO[g].name), element: GEM_INFO[g].element, color: GEM_INFO[g].color, desc: T(GEM_INFO[g].desc) })),
    branches: BRANCHES.map((b) => ({ id: b, name: T(BRANCH_INFO[b].name), color: BRANCH_INFO[b].color, req: T(BRANCH_INFO[b].req), desc: T(BRANCH_INFO[b].desc), element: BRANCH_ELEMENT[b] })),
    weapons: Object.entries(WEAPON_INFO).map(([id, w]) => ({ id, name: T(w.name), branch: w.branch, speed: w.speed, reach: w.reach, brk: w.brk, twoHanded: w.twoHanded })),
    armorSlots: Object.entries(ARMOR_INFO).map(([id, a]) => ({ id, name: T(a.name) })),
    frames: FRAMES,
    combos: COMBOS,
    loot: { rules: LOOT, weights: LOOT_WEIGHTS, mfWeight: MF_WEIGHT, mfRarityUpgrade: MF_RARITY_UPGRADE, setPieceChance: SET_PIECE_CHANCE, mfSources: MF_SOURCES },
    temper: { chance: TEMPER_CHANCE, guildPerRank: TEMPER_GUILD_PER_RANK, setBonus: TEMPER_SET_BONUS },
    forge: { thresholds: GRADE_THRESHOLDS, autoOdds: AUTO_FORGE_ODDS, homeQuality: FORGE_HOME_QUALITY, guildQuality: FORGE_GUILD_QUALITY },
    items,
    furniture: FURNITURE,
    trophies: TROPHIES.map(([id, , of]) => ({ id, of })),
    gearBases,
    gear,
    affixes: AFFIXES.map((a) => ({ kind: a.kind, label: T(a.label), w: a.w, weapon: a.weapon, armor: a.armor, min: a.min, max: a.max, flat: a.flat })),
    affixCount: AFFIX_COUNT,
    powers: POWERS.map((p) => ({ id: p.id, name: T(p.name), slot: p.slot, color: p.color, desc: T(p.desc), stats: stats(p.stats), extractable: extractable(p.id), pool: p.id.startsWith('p_') ? 'legendary' : p.id.startsWith('u_') ? 'unique' : 'set' })),
    uniques: UNIQUES.map((u) => ({ id: u.id, name: T(u.name), base: u.baseId, power: u.power, colors: u.colors, flavor: T(u.flavor), stats: stats(u.stats) })),
    sets: SETS.map((s) => ({
      id: s.id, name: T(s.name), color: s.color, theme: T(s.theme), colors: s.colors,
      pieces: s.pieces.map((p) => ({ base: p.baseId, name: T(p.name) })),
      b2: { desc: T(s.b2.desc), stats: stats(s.b2.stats) },
      b4: { desc: T(s.b4.desc), stats: stats(s.b4.stats) },
      b6: { desc: T(s.b6.desc), power: s.b6.power },
    })),
    skills: ACTIVE_SKILLS.map((s) => ({
      id: s.id, name: T(s.name), branch: s.branch, rank: s.rank, sp: s.sp, mp: s.mp, cd: s.cd, dur: s.dur, ai: s.ai, range: s.range,
      color: s.color, color2: s.color2, desc: T(s.desc), timeline: skillTimeline(s),
      morphs: {
        power: Tp(morphName(s.id, 'power'), [s.name, morphName(s.id, 'power').slice(s.name.length + 2)], ': '),
        clone: Tp(morphName(s.id, 'clone'), [s.name, morphName(s.id, 'clone').slice(s.name.length + 2)], ': '),
        leech: Tp(morphName(s.id, 'leech'), [s.name, morphName(s.id, 'leech').slice(s.name.length + 2)], ': '),
      },
    })),
    passives: PASSIVE_SKILLS.map((p) => ({ id: p.id, name: T(p.name), branch: p.branch, rank: p.rank, max: p.max, desc: T(p.desc), stats: p.stats ? [1, 2, 3].map((l) => p.stats!(l)) : null })),
    awakenings: AWAKENINGS.map((a) => ({ id: a.id, name: T(a.name), desc: T(a.desc), trigger: T(a.trigger) })),
    skillRanks: { max: SKILL_MAX_RANK, dmg: SKILL_RANK_DMG, cdr: SKILL_RANK_CDR, morphRank: MORPH_RANK, cost: [1, 2, 3, 4].map(skillRankCost), mastery: [1, 2, 3, 4].map((r) => skillRankMastery(0, r)) },
    morphs: Object.values(MORPHS).map((m) => ({ kind: m.kind, label: T(m.label), color: m.color, desc: T(m.desc) })),
    keystones: KEYSTONES.map((k) => ({ id: k.id, name: T(k.name), branch: k.branch, rank: k.rank, sp: k.sp, desc: T(k.desc), stats: stats(k.stats) })),
    bridges: BRIDGES.map((b) => ({ id: b.id, name: T(b.name), a: b.a, b: b.b, rank: b.rank, sp: b.sp, desc: T(b.desc), stats: stats(b.stats) })),
    sectorOrder: SECTOR_ORDER,
    reactions: REACTIONS.map((r) => ({ id: r.id, name: T(r.name), a: r.a, b: r.b, color: r.color, desc: T(r.desc) })),
    reactionRules: REACTION_RULES,
    gaugeRules: GAUGE_RULES,
    monsters,
    realms: REALMS.map((R) => ({
      id: R.id, name: T(R.name), short: T(R.short), city: T(R.city), cityTitle: T(R.cityTitle), levels: R.levels, desc: T(R.desc),
      dungeon: T(R.dungeon), dungeonDesc: T(R.dungeonDesc),
      house: { name: T(R.house.name), price: R.house.price, w: R.house.w, h: R.house.h },
      buildings: Object.fromEntries(Object.entries(R.buildings).map(([k, v]) => [k, T(v)])),
      weather: R.weather, ambient: R.ambient, ores: R.ores, herbs: R.herbs, monsters: R.monsters, dungeonMonsters: R.dungeonMonsters,
      elite: R.elite, boss: R.boss, sky: R.palette.sky, grass: R.palette.grass, liquid: R.palette.liquid, liquidA: R.palette.liquidA,
    })),
    recipes: [...SMELT, ...ALCHEMY, ...COOKING].map((r) => ({ id: r.id, station: r.station, out: r.out, qty: r.qty, ins: r.ins })),
    guilds: GUILD_IDS.map((id) => {
      const g = GUILDS[id];
      return { id, name: T(g.name), short: T(g.short), color: g.color, hall: g.hall, motto: T(g.motto), perk: T(g.perk), perkStats: [1, 2, 3, 4, 5].map((r) => g.perkStats(r)) };
    }),
    guildRanks: GUILD_RANKS.map((n, i) => ({ name: T(n), rep: GUILD_REP[i] })),
    companions: COMPANIONS.map((c) => ({
      id: c.id, name: T(c.name), title: T(c.title), guild: c.guild, branch: c.branch, weapon: c.weapon, off: c.off, req: c.req, city: c.city,
      chain: T(c.chain), bio: T(c.bio), lines: c.lines.map(T), colors: c.colors, look: { skin: c.skin, hairStyle: c.hairStyle, hairColor: c.hairColor, eyeColor: c.eyeColor },
    })),
    affinity: AFFINITY_RANKS.map((v, i) => ({ min: v, name: T(AFFINITY_NAMES[i]) })),
    mounts: MOUNTS.map((m) => ({ id: m.id, name: T(m.name), kind: m.kind, desc: T(m.desc), price: m.price, speed: m.speed, colors: m.colors, req: m.req })),
    pets: PETS.map((p) => ({ id: p.id, name: T(p.name), element: p.element, color: p.color, color2: p.color2, desc: T(p.desc), price: p.price, req: p.req, mf: p.mf })),
    fish: FISH.map((f) => ({ id: f.id, realm: f.realm, rarity: f.rarity, diff: f.diff, value: f.value })),
    dyes: DYES.map((d) => ({ id: d.id, name: T(d.name), color: d.color })),
    dyePrice: DYE_PRICE,
    gambits: GAMBIT_ORDER.map((id) => ({ id, name: T(GAMBITS[id].name), key: GAMBITS[id].key, desc: T(GAMBITS[id].desc), color: GAMBITS[id].color })),
    style: { max: STYLE_MAX, ranks: STYLE_RANKS.map((r) => ({ rank: r.rank, min: r.min, color: r.color, label: T(r.label) })) },
    achievements: ACHIEVEMENTS.map((a) => ({ id: a.id, name: T(a.name), cat: a.cat, desc: T(a.desc), title: opt(a.title) })),
    raidBosses: RAID_BOSSES.map((r) => ({ id: r.id, name: T(r.name), title: T(r.title), desc: T(r.desc) })),
    cups: CUPS.map((c) => ({ name: T(c.name), level: c.level, gold: c.gold, trophy: c.trophy })),
  };
}
