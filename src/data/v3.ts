// v3.0 Full-Dive data: Rune Morphs, keystones & hybrid bridges, affixes, golden powers,
// unique weapons, armor sets, mounts, pets, fish, dyes, achievements, adventurers, raid bosses
// and the elemental reaction matrix. Everything here is declarative; systems read it.
import type {
  AchievementDef, AffixKind, Branch, BridgeDef, Element, FishDef, GaugeKind, Gambit, GearColors, KeystoneDef, MorphDef,
  MorphKind, MountDef, PetDef, PowerDef, RaidBossInfo, ReactionDef, SaveData, SetDef, StatBlock, UniqueDef,
} from '../types/game';
import { SKILL_BY_ID } from './skills';

// ------------------------------------------------------------------ skill ranks & morphs

export const SKILL_MAX_RANK = 5;
/** SP cost to raise a learned skill from rank r to r+1 */
export const skillRankCost = (r: number): number => r + 1;
/** branch mastery needed for skill rank r+1 (on top of the skill's own unlock rank) */
export const skillRankMastery = (unlock: number, r: number): number => unlock + r * 3;
export const SKILL_RANK_DMG = 0.12;
export const SKILL_RANK_CDR = 0.05;
export const MORPH_RANK = 3;

export const MORPHS: Record<MorphKind, MorphDef> = {
  power: { kind: 'power', label: 'Execution Rune', color: '#ff5d6c', desc: 'x1.35 damage, +15% area and +50% damage against enemies below 30% HP.' },
  clone: { kind: 'clone', label: 'Shadow-Clone Rune', color: '#b07bff', desc: 'A shadow clone repeats every hit 0.25s later for 40% damage, and you gain a short evasive step after the skill.' },
  leech: { kind: 'leech', label: 'Elemental Rune', color: '#5ee6a0', desc: 'Converts the skill to your branch element, applies its reaction gauge and heals 8% of damage dealt.' },
};

/** element the Elemental Rune converts each branch to (covers all six reaction gauges) */
export const BRANCH_ELEMENT: Record<Branch, Element> = { sword: 'frost', dual: 'poison', shield: 'lightning', spear: 'fire', bow: 'wind', magic: 'void' };
const ELEMENT_WORD: Partial<Record<Element, string>> = { frost: 'Rime', poison: 'Venom', lightning: 'Storm', fire: 'Pyre', wind: 'Gale', void: 'Aether' };

export function morphName(skillId: string, kind: MorphKind): string {
  const s = SKILL_BY_ID[skillId];
  if (!s) return MORPHS[kind].label;
  if (kind === 'power') return `${s.name}: Executioner`;
  if (kind === 'clone') return `${s.name}: Phantom Echo`;
  return `${s.name}: ${ELEMENT_WORD[BRANCH_ELEMENT[s.branch]] ?? 'Aether'} Siphon`;
}

// ------------------------------------------------------------------ keystones & bridges

export const KEYSTONES: KeystoneDef[] = [
  { id: 'ks_sword', name: 'Blade Ascendant', branch: 'sword', rank: 15, sp: 3, desc: 'Sword combo finishers launch a piercing crescent wave (80% damage). +15% critical damage.', stats: { critDmg: 0.15 } },
  { id: 'ks_dual', name: 'Thousand Cuts', branch: 'dual', rank: 15, sp: 3, desc: 'Every 10th hit within 3s triggers a free whirlwind flurry around you. +8% attack speed.', stats: { aspd: 0.08 } },
  { id: 'ks_shield', name: 'Unbreakable Bastion', branch: 'shield', rank: 15, sp: 3, desc: 'Perfect Parry window +0.08s and blocking costs half Stamina. +15% DEF.', stats: { defPct: 0.15 } },
  { id: 'ks_spear', name: "Dragoon's Momentum", branch: 'spear', rank: 15, sp: 3, desc: 'Wall Slams trigger at lower speed and deal +90% instead of +45% impact damage. +3 Break power.', stats: { brk: 3 } },
  { id: 'ks_bow', name: 'Deadeye Focus', branch: 'bow', rank: 15, sp: 3, desc: 'Your first hit against a full-HP enemy is always a critical. +8% critical chance.', stats: { crit: 0.08 } },
  { id: 'ks_magic', name: 'Arcane Overflow', branch: 'magic', rank: 15, sp: 3, desc: 'Sword Skills cost 15% less MP. +40% MP regeneration and +8% skill damage.', stats: { regen: 0.4, skillDmg: 0.08 } },
];
export const KEYSTONE_BY_ID: Record<string, KeystoneDef> = Object.fromEntries(KEYSTONES.map((k) => [k.id, k]));

/** constellation order of the six sectors - bridges join neighbours */
export const SECTOR_ORDER: Branch[] = ['sword', 'dual', 'bow', 'magic', 'shield', 'spear'];

export const BRIDGES: BridgeDef[] = [
  { id: 'br_sword_dual', name: "Duelist's Accord", a: 'sword', b: 'dual', rank: 10, sp: 2, desc: 'Hybrid node: +6% attack speed and +4% critical chance.', stats: { aspd: 0.06, crit: 0.04 } },
  { id: 'br_dual_bow', name: 'Wind Walker', a: 'dual', b: 'bow', rank: 10, sp: 2, desc: 'Hybrid node: +6% move speed and +12% critical damage.', stats: { move: 0.06, critDmg: 0.12 } },
  { id: 'br_bow_magic', name: 'Arcane Archer', a: 'bow', b: 'magic', rank: 10, sp: 2, desc: 'Hybrid node: +8% ATK and +8% MAG.', stats: { atkPct: 0.08, magPct: 0.08 } },
  { id: 'br_magic_shield', name: 'Runeguard', a: 'magic', b: 'shield', rank: 10, sp: 2, desc: 'Hybrid node: +10% DEF, +30 MP and +20% MP regeneration.', stats: { defPct: 0.1, mp: 30, regen: 0.2 } },
  { id: 'br_shield_spear', name: 'Phalanx Doctrine', a: 'shield', b: 'spear', rank: 10, sp: 2, desc: 'Hybrid node: +8% DEF and +4 Break power.', stats: { defPct: 0.08, brk: 4 } },
  { id: 'br_spear_sword', name: "Lancer's Edge", a: 'spear', b: 'sword', rank: 10, sp: 2, desc: 'Hybrid node: +8% ATK and +6% skill damage.', stats: { atkPct: 0.08, skillDmg: 0.06 } },
];
export const BRIDGE_BY_ID: Record<string, BridgeDef> = Object.fromEntries(BRIDGES.map((b) => [b.id, b]));

// ------------------------------------------------------------------ elemental reactions

export const ELEMENT_GAUGE: Partial<Record<Element, GaugeKind>> = {
  fire: 'burn', frost: 'frost', lightning: 'shock', wind: 'bleed', poison: 'venom', void: 'aether', holy: 'aether',
};
export const GAUGE_COLORS: Record<GaugeKind, string> = {
  burn: '#ff6a3d', frost: '#7fe9ff', shock: '#ffe066', bleed: '#ff3b5c', venom: '#9be15d', aether: '#c18cff',
};
export const GAUGE_DUR = 4.5;
/** a non-elemental hit paints one of the weapon's gem / oil elements with `gemChance`; melee critical hits paint Bleed with `critBleed` */
export const GAUGE_RULES = { gemChance: 0.35, critBleed: 0.6 };

export const REACTIONS: ReactionDef[] = [
  { id: 'melt', name: 'MELT', a: 'burn', b: 'frost', color: '#ffb35c', desc: 'Burn + Frost: the hit detonates for a 2.2x elemental burst.' },
  { id: 'shatter', name: 'SHATTER', a: 'frost', b: 'bleed', color: '#bff3ff', desc: 'Frost + Bleed: ice shrapnel explodes around the target and shatters 35% of its Break Bar.' },
  { id: 'overload', name: 'OVERLOAD', a: 'burn', b: 'shock', color: '#ff9af0', desc: 'Burn + Shock: a plasma blast deals area damage and hurls enemies outward.' },
  { id: 'superconduct', name: 'SUPERCONDUCT', a: 'frost', b: 'shock', color: '#9ad1ff', desc: 'Frost + Shock: armor collapses, -40% DEF for 8 seconds.' },
  { id: 'tempest', name: 'TEMPEST SPREAD', a: 'venom', b: null, color: '#9be15d', desc: 'Venom + any gauge: every status and gauge on the target spreads to nearby enemies.' },
  { id: 'singularity', name: 'AETHER SINGULARITY', a: 'aether', b: null, color: '#c18cff', desc: 'Aether + any gauge: a gravity vortex drags enemies together and crushes them.' },
];
export const REACTION_BY_ID: Record<string, ReactionDef> = Object.fromEntries(REACTIONS.map((r) => [r.id, r]));

/** exact reaction numbers used by systems/reactions.ts (damage values are multiples of the triggering hit) */
export const REACTION_RULES = {
  /** extra burst on the target: the hit itself plus 1.2x more = a 2.2x total (x1.6 with Dragonlord Inferno) */
  melt: { burst: 1.2, setBonus: 1.6 },
  /** shrapnel to every enemy within `radius`, half that to the target, and 35% of the target's Break Bar */
  shatter: { mult: 0.6, radius: 95, self: 0.5, breakPct: 0.35, kb: 90, uniqueBonus: 1.5, setBonus: 1.8 },
  overload: { mult: 0.8, radius: 110, kb: 240, self: 0.5, selfKb: 200, setBonus: 1.6 },
  /** armor collapse: -40% DEF for 8 s */
  superconduct: { shred: 0.4, dur: 8 },
  /** every status and gauge on the target spreads within `radius`; Venom poisons everyone it touches */
  tempest: { radius: 150, poisonDur: 4, selfPoisonDur: 5, selfPoisonPower: 1.2 },
  /** a void vortex: `mult` x the caster's damage every `tick` s for `dur` s, pulling at `pull` px/s */
  singularity: { radius: 130, dur: 2.4, tick: 0.4, mult: 0.35, pull: 170 },
};

// ------------------------------------------------------------------ affixes

export interface AffixDef {
  kind: AffixKind;
  w: number;
  weapon: boolean;
  armor: boolean;
  min: number;
  max: number;
  /** flat values scale by tier, fractional by 1 + 6%/tier */
  flat: boolean;
  label: string;
}

export const AFFIXES: AffixDef[] = [
  { kind: 'atk', w: 10, weapon: true, armor: true, min: 3, max: 6, flat: true, label: 'ATK' },
  { kind: 'mag', w: 8, weapon: true, armor: true, min: 3, max: 6, flat: true, label: 'MAG' },
  { kind: 'def', w: 8, weapon: false, armor: true, min: 2, max: 5, flat: true, label: 'DEF' },
  { kind: 'hp', w: 9, weapon: false, armor: true, min: 12, max: 26, flat: true, label: 'Max HP' },
  { kind: 'mp', w: 5, weapon: true, armor: true, min: 8, max: 16, flat: true, label: 'Max MP' },
  { kind: 'atkPct', w: 7, weapon: true, armor: true, min: 0.03, max: 0.08, flat: false, label: 'ATK' },
  { kind: 'magPct', w: 6, weapon: true, armor: true, min: 0.03, max: 0.08, flat: false, label: 'MAG' },
  { kind: 'defPct', w: 6, weapon: false, armor: true, min: 0.04, max: 0.1, flat: false, label: 'DEF' },
  { kind: 'hpPct', w: 6, weapon: false, armor: true, min: 0.03, max: 0.08, flat: false, label: 'Max HP' },
  { kind: 'crit', w: 8, weapon: true, armor: true, min: 0.02, max: 0.05, flat: false, label: 'Critical Chance' },
  { kind: 'critDmg', w: 7, weapon: true, armor: true, min: 0.08, max: 0.2, flat: false, label: 'Critical Damage' },
  { kind: 'aspd', w: 6, weapon: true, armor: true, min: 0.03, max: 0.07, flat: false, label: 'Attack Speed' },
  { kind: 'move', w: 5, weapon: false, armor: true, min: 0.02, max: 0.05, flat: false, label: 'Move Speed' },
  { kind: 'brk', w: 5, weapon: true, armor: false, min: 1, max: 3, flat: true, label: 'Break Power' },
  { kind: 'regen', w: 4, weapon: true, armor: true, min: 0.1, max: 0.25, flat: false, label: 'MP Regeneration' },
  { kind: 'lifesteal', w: 3, weapon: true, armor: false, min: 0.01, max: 0.03, flat: false, label: 'Lifesteal' },
  { kind: 'skillDmg', w: 5, weapon: true, armor: true, min: 0.04, max: 0.1, flat: false, label: 'Sword Skill Damage' },
  { kind: 'cdr', w: 4, weapon: true, armor: true, min: 0.03, max: 0.07, flat: false, label: 'Cooldown Reduction' },
  { kind: 'magicFind', w: 4, weapon: true, armor: true, min: 0.05, max: 0.15, flat: false, label: 'Magic Find' },
  { kind: 'xpPct', w: 3, weapon: false, armor: true, min: 0.03, max: 0.08, flat: false, label: 'XP Gain' },
];
export const AFFIX_COUNT = [0, 1, 2, 3, 3, 4];

// ------------------------------------------------------------------ golden powers (relic codex)

export const POWERS: PowerDef[] = [
  // legendary pool - weapon
  { id: 'p_vampiric', name: 'Sanguine Edge', slot: 'weapon', color: '#ff3b5c', desc: 'Heal for 5% of all damage you deal.', stats: { lifesteal: 0.05 } },
  { id: 'p_storm', name: 'Stormcaller', slot: 'weapon', color: '#ffe066', desc: 'Critical hits call down a lightning strike for 60% damage that applies Shock.' },
  { id: 'p_echo', name: 'Echo Strike', slot: 'weapon', color: '#7fe9ff', desc: 'Basic attacks have a 15% chance to strike a second time.' },
  { id: 'p_executioner', name: "Executioner's Verdict", slot: 'weapon', color: '#ff7a3d', desc: '+40% damage against enemies below 30% HP.' },
  { id: 'p_arcsurge', name: 'Arcane Surge', slot: 'weapon', color: '#c18cff', desc: 'Sword Skill hits restore 2 MP each.' },
  // legendary pool - armor
  { id: 'p_thorns', name: 'Thornmail', slot: 'armor', color: '#9be15d', desc: 'Reflect 20% of melee damage taken back at the attacker.' },
  { id: 'p_bulwark', name: 'Bulwark Sigil', slot: 'armor', color: '#ffd166', desc: '+8% block efficiency and +15% DEF.', stats: { block: 0.08, defPct: 0.15 } },
  { id: 'p_second_wind', name: 'Second Wind', slot: 'armor', color: '#5ee6a0', desc: 'Dropping below 30% HP instantly heals 25% max HP (90s cooldown).' },
  { id: 'p_featherstep', name: 'Featherstep', slot: 'armor', color: '#bff3ff', desc: 'Dodges cost 40% less Stamina and grant +30% move speed for 1.2s.' },
  // legendary pool - utility
  { id: 'p_midas', name: 'Midas Touch', slot: 'utility', color: '#ffd166', desc: '+30% gold from every source.' },
  { id: 'p_scholar', name: "Scholar's Insight", slot: 'utility', color: '#9ad1ff', desc: '+15% experience gained.', stats: { xpPct: 0.15 } },
  { id: 'p_pathfinder', name: 'Pathfinder', slot: 'utility', color: '#57e389', desc: '+10% move speed.', stats: { move: 0.1 } },
  { id: 'p_fortune', name: "Fortune's Favor", slot: 'utility', color: '#ff9ad0', desc: '+25% Magic Find.', stats: { magicFind: 0.25 } },
  { id: 'p_showstopper', name: 'Showstopper', slot: 'utility', color: '#ff5df0', desc: 'Your Style meter decays 40% slower and never drops below rank C in combat.' },
  // unique weapon powers
  { id: 'u_nightfall', name: 'Shadow Doppelganger', slot: 'weapon', color: '#7fe9ff', desc: 'Every 3rd Skill Connect summons a Shadow Doppelganger that repeats your skill for 60% damage.' },
  { id: 'u_rimecrest', name: 'Rimecrest Nova', slot: 'weapon', color: '#bff3ff', desc: 'Critical hits unleash a piercing Frost Nova (60% damage, applies Frost). SHATTER deals +50% damage.' },
  { id: 'u_dawnspark', name: 'Dawnspark Lance', slot: 'weapon', color: '#fff1a8', desc: 'Attack speed also shortens Sword Skill cooldowns. Dodging leaves a damaging lance of light.' },
  { id: 'u_ivory_verdict', name: 'Divine Judgment', slot: 'armor', color: '#ffd27a', desc: 'Perfect Parries fire a Divine Judgment beam (250% damage) and grant a barrier worth 25% max HP.' },
  { id: 'u_dragonbone', name: 'Draconic Meteor', slot: 'weapon', color: '#ff9a3d', desc: 'Wall Slams and Breaks call down a draconic meteor (200% fire damage). Thrusts reach 30% further.' },
  { id: 'u_phoenix', name: 'Phoenix Rebirth', slot: 'weapon', color: '#ff6a3d', desc: 'Arrows ignite. Burning enemies explode in phoenix fire on death. Once per 120s, lethal damage revives you at 40% HP.' },
  { id: 'u_aetherion', name: 'Aetherion Cascade', slot: 'weapon', color: '#c18cff', desc: 'Spells arc to 2 extra enemies for 40% damage. Every 5th spell costs no MP.' },
  // set six-piece powers (not extractable)
  { id: 's6_nightfall', name: 'Nightfall Rhythm', slot: 'weapon', color: '#7fe9ff', desc: 'Skill Connect costs no MP and adds +10% extra damage per chain step.' },
  { id: 's6_ivory', name: 'Ivory Absolution', slot: 'armor', color: '#ffd27a', desc: 'Blocking restores 2% max HP; Perfect Parry heals 10% max HP.' },
  { id: 's6_sylvan', name: 'Windrunner Volley', slot: 'weapon', color: '#57e389', desc: 'Dodging fires 3 homing wind arrows for 50% damage each.' },
  { id: 's6_pyre', name: 'Dragonlord Inferno', slot: 'weapon', color: '#ff6a3d', desc: 'All your hits apply Burn; MELT and OVERLOAD deal +60% damage.' },
  { id: 's6_frost', name: 'Valkyrie Winter', slot: 'weapon', color: '#bff3ff', desc: 'Critical hits apply Frost; SHATTER deals +80% damage.' },
  { id: 's6_aether', name: 'Archmage Convergence', slot: 'weapon', color: '#c18cff', desc: 'Sword Skills cost 30% less MP and apply Aether.' },
  { id: 's6_anvil', name: "Artisan's Pride", slot: 'utility', color: '#ffc861', desc: '+15% tempering success, +25% gathering yield and +20% Break power.' },
  { id: 's6_abyss', name: 'Sovereign Hunger', slot: 'weapon', color: '#ff4f7b', desc: 'Below 50% HP you deal +30% damage and heal 6% of damage dealt.' },
];
export const POWER_BY_ID: Record<string, PowerDef> = Object.fromEntries(POWERS.map((p) => [p.id, p]));
export const LEGENDARY_POWERS = POWERS.filter((p) => p.id.startsWith('p_'));
export const extractable = (id: string): boolean => id.startsWith('p_') || id.startsWith('u_');

// ------------------------------------------------------------------ unique weapons

const UC = (main: string, accent: string, trim: string, glow: string): GearColors => ({ main, accent, trim, glow });

export const UNIQUES: UniqueDef[] = [
  { id: 'uq_nightfall', name: 'Nightfall Sovereign', baseId: 'w_sword', power: 'u_nightfall', colors: UC('#15161d', '#2a2f44', '#5d6a8a', '#7fe9ff'), flavor: 'Forged from a fallen star that never stopped falling.', stats: { atkPct: 0.12, crit: 0.05 } },
  { id: 'uq_rimecrest', name: 'Rimecrest Blade', baseId: 'w_sword', power: 'u_rimecrest', colors: UC('#bfe9ff', '#2b6c8f', '#e8fbff', '#bff3ff'), flavor: 'Its edge is colder than the glacier it was cut from.', stats: { critDmg: 0.25, atk: 8 } },
  { id: 'uq_dawnspark', name: 'Dawnspark Edge', baseId: 'w_twinblade', power: 'u_dawnspark', colors: UC('#fff3d0', '#c9a46e', '#ffffff', '#fff1a8'), flavor: 'Light first touches the world along this blade.', stats: { aspd: 0.12, move: 0.05 } },
  { id: 'uq_ivory_verdict', name: 'Verdict of the Ivory Aegis', baseId: 'a_shield', power: 'u_ivory_verdict', colors: UC('#f4efe6', '#9a2a3a', '#ffd27a', '#ffd27a'), flavor: 'Every blow it turns aside becomes a sentence.', stats: { defPct: 0.15, block: 0.06 } },
  { id: 'uq_dragonbone', name: 'Astral Dragonbone Spear', baseId: 'w_spear', power: 'u_dragonbone', colors: UC('#efe6d2', '#6a3a1a', '#ffb02e', '#ff9a3d'), flavor: 'Carved from the spine of a star-dragon.', stats: { atkPct: 0.1, brk: 4 } },
  { id: 'uq_phoenix', name: 'Phoenix Longbow', baseId: 'w_bow', power: 'u_phoenix', colors: UC('#c0401f', '#5a1f10', '#ffd166', '#ff6a3d'), flavor: 'Strung with a feather that refuses to burn out.', stats: { atkPct: 0.1, crit: 0.06 } },
  { id: 'uq_aetherion', name: 'Aetherion Arch-Staff', baseId: 'w_staff', power: 'u_aetherion', colors: UC('#4b2f8a', '#24154a', '#ffd27a', '#c18cff'), flavor: 'The sky-city was raised with this staff. It still hums.', stats: { magPct: 0.14, regen: 0.3 } },
];
export const UNIQUE_BY_ID: Record<string, UniqueDef> = Object.fromEntries(UNIQUES.map((u) => [u.id, u]));

// ------------------------------------------------------------------ armor sets

export const SETS: SetDef[] = [
  {
    id: 'set_nightfall', name: 'Nightfall Duelist', color: '#7fe9ff', theme: 'Dual Blades', colors: UC('#16161c', '#2a2f44', '#5d6a8a', '#7fe9ff'),
    pieces: [{ baseId: 'w_sword', name: 'Nightfall Edge' }, { baseId: 'w_twinblade', name: 'Nightfall Fang' }, { baseId: 'a_hood', name: 'Nightfall Cowl' }, { baseId: 'a_coat', name: 'Nightfall Duelist Coat' }, { baseId: 'a_boots', name: 'Nightfall Treads' }, { baseId: 'a_cloak', name: 'Nightfall Mantle' }],
    b2: { desc: '+6% attack speed, +4% critical chance', stats: { aspd: 0.06, crit: 0.04 } },
    b4: { desc: '+25% critical damage, +10% skill damage', stats: { critDmg: 0.25, skillDmg: 0.1 } },
    b6: { desc: 'Skill Connect costs no MP and adds +10% per chain step', power: 's6_nightfall' },
  },
  {
    id: 'set_ivory', name: 'Ivory Aegis Paladin', color: '#ffd27a', theme: 'Sword & Shield', colors: UC('#f4efe6', '#9a2a3a', '#ffd27a', '#ffd27a'),
    pieces: [{ baseId: 'w_sword', name: 'Ivory Oathblade' }, { baseId: 'a_shield', name: 'Ivory Aegis' }, { baseId: 'a_helm', name: 'Ivory Crest Helm' }, { baseId: 'a_plate', name: 'Ivory Aegis Plate' }, { baseId: 'a_boots', name: 'Ivory Sabatons' }, { baseId: 'a_cloak', name: 'Ivory Tabard-Cloak' }],
    b2: { desc: '+10% DEF, +5% block efficiency', stats: { defPct: 0.1, block: 0.05 } },
    b4: { desc: '+12% max HP, +20% MP regeneration', stats: { hpPct: 0.12, regen: 0.2 } },
    b6: { desc: 'Blocking restores HP; Perfect Parry heals 10%', power: 's6_ivory' },
  },
  {
    id: 'set_sylvan', name: 'Sylvan Windrunner', color: '#57e389', theme: 'Longbow', colors: UC('#2f6b3a', '#173a1f', '#d8c070', '#9be15d'),
    pieces: [{ baseId: 'w_bow', name: 'Sylvan Greatbow' }, { baseId: 'a_hood', name: 'Sylvan Hood' }, { baseId: 'a_coat', name: 'Sylvan Ranger Coat' }, { baseId: 'a_boots', name: 'Sylvan Windboots' }, { baseId: 'a_cloak', name: 'Sylvan Leafcloak' }],
    b2: { desc: '+6% move speed, +3% critical chance', stats: { move: 0.06, crit: 0.03 } },
    b4: { desc: '+12% ATK, +6% attack speed', stats: { atkPct: 0.12, aspd: 0.06 } },
    b6: { desc: 'Dodging fires 3 homing wind arrows', power: 's6_sylvan' },
  },
  {
    id: 'set_pyre', name: 'Pyrehold Dragonlord', color: '#ff6a3d', theme: 'Halberd', colors: UC('#3a140a', '#c0401f', '#ffb02e', '#ff6a3d'),
    pieces: [{ baseId: 'w_halberd', name: 'Pyrehold Dragonglaive' }, { baseId: 'a_helm', name: 'Pyrehold Horned Helm' }, { baseId: 'a_plate', name: 'Pyrehold Dragonplate' }, { baseId: 'a_boots', name: 'Pyrehold Greaves' }, { baseId: 'a_cloak', name: 'Pyrehold Ember Cape' }],
    b2: { desc: '+8% ATK, +3 Break power', stats: { atkPct: 0.08, brk: 3 } },
    b4: { desc: '+10% max HP, +20% critical damage', stats: { hpPct: 0.1, critDmg: 0.2 } },
    b6: { desc: 'Every hit applies Burn; MELT and OVERLOAD +60%', power: 's6_pyre' },
  },
  {
    id: 'set_frost', name: 'Frostspire Valkyrie', color: '#bff3ff', theme: 'Spear', colors: UC('#e8f4ff', '#3a6ab8', '#7fe9ff', '#bff3ff'),
    pieces: [{ baseId: 'w_spear', name: 'Frostspire Lance' }, { baseId: 'a_circlet', name: 'Frostspire Tiara' }, { baseId: 'a_brig', name: 'Frostspire Hauberk' }, { baseId: 'a_boots', name: 'Frostspire Boots' }, { baseId: 'a_cloak', name: 'Frostspire Wings' }],
    b2: { desc: '+5% critical chance', stats: { crit: 0.05 } },
    b4: { desc: '+30% critical damage, +4% move speed', stats: { critDmg: 0.3, move: 0.04 } },
    b6: { desc: 'Crits apply Frost; SHATTER deals +80%', power: 's6_frost' },
  },
  {
    id: 'set_aether', name: 'Aetherial Archmage', color: '#c18cff', theme: 'Arcane Staff', colors: UC('#4b2f8a', '#24154a', '#ffd27a', '#c69bff'),
    pieces: [{ baseId: 'w_staff', name: 'Aetherial Archstaff' }, { baseId: 'a_circlet', name: 'Aetherial Diadem' }, { baseId: 'a_robe', name: 'Aetherial Robe' }, { baseId: 'a_boots', name: 'Aetherial Slippers' }, { baseId: 'a_cloak', name: 'Aetherial Starcloak' }],
    b2: { desc: '+10% MAG, +30 max MP', stats: { magPct: 0.1, mp: 30 } },
    b4: { desc: '+40% MP regeneration, +12% skill damage', stats: { regen: 0.4, skillDmg: 0.12 } },
    b6: { desc: 'Skills cost 30% less MP and apply Aether', power: 's6_aether' },
  },
  {
    id: 'set_anvil', name: 'Gilded Anvil Artisan', color: '#ffc861', theme: 'Crafting', colors: UC('#a8642a', '#5a3010', '#ffe29a', '#ffc861'),
    pieces: [{ baseId: 'w_sword', name: 'Gilded Forgeblade' }, { baseId: 'a_shield', name: 'Gilded Anvil Buckler' }, { baseId: 'a_helm', name: "Gilded Smith's Visor" }, { baseId: 'a_brig', name: 'Gilded Apron-Brigandine' }, { baseId: 'a_boots', name: 'Gilded Workboots' }, { baseId: 'a_cloak', name: 'Gilded Guild Mantle' }],
    b2: { desc: '+4 Break power, +6 DEF', stats: { brk: 4, def: 6 } },
    b4: { desc: '+8% ATK, +8% DEF', stats: { atkPct: 0.08, defPct: 0.08 } },
    b6: { desc: '+15% tempering, +25% gathering, +20% Break', power: 's6_anvil' },
  },
  {
    id: 'set_abyss', name: 'Abyssal Sovereign', color: '#ff4f7b', theme: 'Abyss', colors: UC('#1a1030', '#4b1a5a', '#ff4f7b', '#ff4f7b'),
    pieces: [{ baseId: 'w_sword', name: 'Abyssal Sovereign Blade' }, { baseId: 'w_twinblade', name: 'Abyssal Fang' }, { baseId: 'a_helm', name: 'Abyssal Crown-Helm' }, { baseId: 'a_plate', name: 'Abyssal Sovereign Plate' }, { baseId: 'a_boots', name: 'Abyssal Greaves' }, { baseId: 'a_cloak', name: 'Abyssal Shroud' }],
    b2: { desc: '+8% max HP, +2% lifesteal', stats: { hpPct: 0.08, lifesteal: 0.02 } },
    b4: { desc: '+10% ATK, +10% MAG', stats: { atkPct: 0.1, magPct: 0.1 } },
    b6: { desc: 'Below 50% HP: +30% damage and 6% lifesteal', power: 's6_abyss' },
  },
];
export const SET_BY_ID: Record<string, SetDef> = Object.fromEntries(SETS.map((s) => [s.id, s]));

// ------------------------------------------------------------------ dyes (transmog)

export const DYES: { id: string; name: string; color: string }[] = [
  { id: 'dye_crimson', name: 'Crimson', color: '#b4233a' },
  { id: 'dye_azure', name: 'Azure', color: '#2f6fd0' },
  { id: 'dye_emerald', name: 'Emerald', color: '#1f8a52' },
  { id: 'dye_obsidian', name: 'Obsidian', color: '#16161c' },
  { id: 'dye_ivory', name: 'Ivory', color: '#eee6d6' },
  { id: 'dye_royal', name: 'Royal Purple', color: '#5a2f9a' },
  { id: 'dye_sunfire', name: 'Sunfire Gold', color: '#d9a12a' },
  { id: 'dye_frost', name: 'Frost White', color: '#dff4ff' },
  { id: 'dye_rose', name: 'Rose', color: '#d86a9a' },
  { id: 'dye_teal', name: 'Teal', color: '#1f8f8f' },
  { id: 'dye_ember', name: 'Ember Orange', color: '#e0662a' },
  { id: 'dye_slate', name: 'Slate', color: '#56606e' },
  { id: 'dye_midnight', name: 'Midnight Blue', color: '#1c2550' },
  { id: 'dye_forest', name: 'Forest', color: '#2f5a2a' },
  { id: 'dye_sand', name: 'Desert Sand', color: '#c9ad7a' },
  { id: 'dye_silver', name: 'Silver', color: '#c4cad4' },
];
export const DYE_PRICE = 150;

// ------------------------------------------------------------------ mounts & pets

export const MOUNTS: MountDef[] = [
  { id: 'm_courser', name: 'Dun Courser', kind: 'horse', desc: 'A dependable plains horse with a steady gallop.', price: 1800, speed: 1.65, colors: ['#8a5a32', '#3a2414', '#e8d8b0'], req: 8 },
  { id: 'm_frostfang', name: 'Frostfang Wolf', kind: 'wolf', desc: 'A glacier wolf that leaves rime in its tracks.', price: 4200, speed: 1.65, colors: ['#dfe8f2', '#6a7a8a', '#7fe9ff'], req: 18 },
  { id: 'm_starstag', name: 'Starlight Stag', kind: 'stag', desc: 'Its antlers catch the starlight, even at noon.', price: 7500, speed: 1.65, colors: ['#c9a46e', '#5a3a24', '#c4e8ff'], req: 28 },
  { id: 'm_emberdrake', name: 'Ember Drake', kind: 'drake', desc: 'A young caldera drake that glides on its own heat.', price: 12000, speed: 1.65, colors: ['#c0401f', '#3a140a', '#ffb02e'], req: 38 },
  { id: 'm_gryphon', name: 'Aether Gryphon', kind: 'gryphon', desc: 'A sky-city gryphon. The fastest wings in Aetheria.', price: 20000, speed: 1.65, colors: ['#eef4ff', '#8a6a3a', '#c18cff'], req: 48 },
];
export const MOUNT_BY_ID: Record<string, MountDef> = Object.fromEntries(MOUNTS.map((m) => [m.id, m]));

export const PETS: PetDef[] = [
  { id: 'pet_ember', name: 'Ember Sprite', element: 'fire', color: '#ff6a3d', color2: '#ffd166', desc: 'Loots for you (+4% Magic Find) and spits fire bolts that apply Burn.', price: 600, req: 1, mf: 0.04 },
  { id: 'pet_frost', name: 'Frost Wisp', element: 'frost', color: '#7fe9ff', color2: '#ffffff', desc: 'Loots for you (+5% Magic Find) and fires frost motes that apply Frost.', price: 900, req: 6, mf: 0.05 },
  { id: 'pet_spark', name: 'Spark Kit', element: 'lightning', color: '#ffe066', color2: '#fff7c2', desc: 'Loots for you (+6% Magic Find) and zaps enemies with Shock.', price: 1500, req: 12, mf: 0.06 },
  { id: 'pet_gale', name: 'Gale Finch', element: 'wind', color: '#57e389', color2: '#d6ffe6', desc: 'Loots for you (+7% Magic Find) and slices with wind that causes Bleed.', price: 2400, req: 18, mf: 0.07 },
  { id: 'pet_bloom', name: 'Bloom Sprout', element: 'poison', color: '#9be15d', color2: '#f6a5ff', desc: 'Loots for you (+8% Magic Find) and spits spores that apply Venom.', price: 3600, req: 26, mf: 0.08 },
  { id: 'pet_moth', name: 'Void Moth', element: 'void', color: '#a970ff', color2: '#ff9ad0', desc: 'Loots for you (+10% Magic Find) and fires void dust that applies Aether.', price: 6000, req: 36, mf: 0.1 },
];
export const PET_BY_ID: Record<string, PetDef> = Object.fromEntries(PETS.map((p) => [p.id, p]));

// ------------------------------------------------------------------ fishing

export const FISH: FishDef[] = [
  { id: 'fish_minnow', name: 'Plains Minnow', realm: 0, rarity: 0, diff: 0.15, value: 6 },
  { id: 'fish', name: 'Silverscale Fish', realm: 0, rarity: 1, diff: 0.3, value: 12 },
  { id: 'fish_goldcarp', name: 'Golden Carp', realm: 0, rarity: 2, diff: 0.5, value: 60 },
  { id: 'fish_lotus', name: 'Lotus Koi', realm: 1, rarity: 1, diff: 0.35, value: 22 },
  { id: 'fish_glowtrout', name: 'Glowcap Trout', realm: 1, rarity: 2, diff: 0.55, value: 70 },
  { id: 'fish_rooteel', name: 'Ancient Root-Eel', realm: 1, rarity: 4, diff: 0.85, value: 600 },
  { id: 'fish_magmaw', name: 'Magmaw', realm: 2, rarity: 2, diff: 0.55, value: 90 },
  { id: 'fish_cinder', name: 'Cinder Pike', realm: 2, rarity: 3, diff: 0.7, value: 220 },
  { id: 'fish_icecod', name: 'Glacier Cod', realm: 3, rarity: 1, diff: 0.4, value: 40 },
  { id: 'fish_crystal', name: 'Crystal Char', realm: 3, rarity: 3, diff: 0.72, value: 260 },
  { id: 'fish_skyray', name: 'Sky Ray', realm: 4, rarity: 2, diff: 0.6, value: 140 },
  { id: 'fish_starwhale', name: 'Starwhale Calf', realm: 4, rarity: 5, diff: 0.95, value: 1800 },
];
export const FISH_BY_ID: Record<string, FishDef> = Object.fromEntries(FISH.map((f) => [f.id, f]));

// ------------------------------------------------------------------ gambits, style

export const GAMBITS: Record<Gambit, { name: string; key: string; desc: string; color: string }> = {
  assault: { name: 'Assault', key: 'F1', desc: 'Companions pick their own targets and use offensive skills freely.', color: '#ff5d6c' },
  guard: { name: 'Guard & Peel', key: 'F2', desc: 'Companions stay close and attack whatever is attacking you.', color: '#ffd166' },
  focus: { name: 'Focus My Target', key: 'F3', desc: 'Companions attack the last enemy you hit.', color: '#7fe9ff' },
  support: { name: 'Support & Heal', key: 'F4', desc: 'Companions keep their distance and prioritise heals, barriers and buffs.', color: '#5ee6a0' },
};
export const GAMBIT_ORDER: Gambit[] = ['assault', 'guard', 'focus', 'support'];

export const AFFINITY_RANKS = [0, 100, 300, 650, 1200];
export const AFFINITY_NAMES = ['Acquaintance', 'Comrade', 'Trusted Ally', 'Sworn Partner', 'Soulbound'];
export function affinityRank(v: number): number {
  let r = 0;
  for (let i = 0; i < AFFINITY_RANKS.length; i++) if (v >= AFFINITY_RANKS[i]) r = i;
  return r;
}

export const STYLE_RANKS: { rank: string; min: number; color: string; label: string }[] = [
  { rank: 'D', min: 0, color: '#8a96aa', label: 'Dull' },
  { rank: 'C', min: 100, color: '#5ee6a0', label: 'Crisp' },
  { rank: 'B', min: 220, color: '#7fe9ff', label: 'Bold' },
  { rank: 'A', min: 360, color: '#4aa8ff', label: 'Aerial' },
  { rank: 'S', min: 520, color: '#ffd166', label: 'Stylish' },
  { rank: 'SS', min: 700, color: '#ff9a3d', label: 'Supreme' },
  { rank: 'SSS', min: 880, color: '#ff5df0', label: 'FULL-DIVE OVERDRIVE' },
];
export const STYLE_MAX = 1000;

// ------------------------------------------------------------------ world: adventurers, raid bosses, black market

export const ADVENTURER_NAMES = [
  'Corwin Vale', 'Isolde Wren', 'Talon Ashby', 'Mirela Quill', 'Bram Holloway', 'Seris Dawnmere', 'Kestrel Fenn', 'Odo Brightwater',
  'Lysa Marrow', 'Dain Stormhollow', 'Petra Lark', 'Rook Allard', 'Elowen Pike', 'Garrick Thorne', 'Yara Sol', 'Fennick Doyle',
  'Ines Calder', 'Thane Rookwood', 'Vesna Holt', 'Arlo Finch', 'Maren Sloane', 'Cassius Reed', 'Ilse Varga', 'Jory Blackwell',
];
export const ADVENTURER_LINES = [
  'Good hunting out here today. The wolves are restless.',
  'I am saving up for a Starlight Stag. Do you know what they cost?',
  'Watch the treeline - something big has been moving at night.',
  'If you ever want a friendly spar, just say the word.',
  'Got a spare Mithril Ingot? I could trade you something rare.',
  'The Abyss changes every time. That is what makes it fun.',
  'They say a colossus walks the plains when the gates go dark.',
  'My guild master swears by Skill Connects. Chain, chain, chain!',
];

export const RAID_BOSSES: RaidBossInfo[] = [
  { id: 'r_colossus', name: 'Colossus of the Sundered Gate', title: 'Roaming Raid Boss', realm: -1, desc: 'A titan of gate-stone that wanders the wilds when the Teleport Gates flicker. Earthquakes, boulder rain and sweeping fists.' },
  { id: 'r_reaper', name: 'The Hollow Reaper', title: 'Roaming Raid Boss', realm: -1, desc: 'A skeletal harvester with scythe-limbs that phases through shadow. Lethal reaping lines and grasping void vortexes.' },
];

export const VANGUARD_NAMES = ['Sir Aldric Vane', 'Dame Liora Ashcroft', 'Captain Hesper Kell', 'Sir Matthis Grey', 'Warden Ysolde Crane', 'Lancer Doran Hale'];

// ------------------------------------------------------------------ achievements & titles

const c = (s: SaveData) => s.counters;
const hasAny = (s: SaveData, f: (g: NonNullable<SaveData['equip'][keyof SaveData['equip']]>) => boolean): boolean =>
  [...Object.values(s.equip), ...s.gear, ...s.vault.gear].some((g) => !!g && f(g));

export const ACHIEVEMENTS: AchievementDef[] = [
  // combat
  { id: 'a_first_blood', name: 'First Blood', cat: 'combat', desc: 'Defeat your first monster.', title: 'Fledgling Diver', check: (s) => c(s).kills >= 1 },
  { id: 'a_hunter', name: 'Monster Hunter', cat: 'combat', desc: 'Defeat 250 monsters.', check: (s) => c(s).kills >= 250 },
  { id: 'a_thousand', name: 'Thousand-Slayer', cat: 'combat', desc: 'Defeat 1,000 monsters.', title: 'Thousand-Slayer', check: (s) => c(s).kills >= 1000 },
  { id: 'a_parry', name: 'Steel Reflexes', cat: 'combat', desc: 'Land a Perfect Parry.', check: (s) => c(s).perfectParries >= 1 },
  { id: 'a_parry50', name: 'Iron Wall', cat: 'combat', desc: 'Land 50 Perfect Parries.', title: 'the Iron Wall', check: (s) => c(s).perfectParries >= 50 },
  { id: 'a_riposte', name: 'Counter-Riposte', cat: 'combat', desc: 'Land 10 Counter-Riposte criticals.', check: (s) => c(s).ripostes >= 10 },
  { id: 'a_connect', name: 'Skill Connect!', cat: 'combat', desc: 'Chain two Sword Skills with a Skill Connect.', check: (s) => c(s).skillConnects >= 1 },
  { id: 'a_nova', name: 'Finishing Nova', cat: 'combat', desc: 'Complete a 4-skill chain and unleash a Finishing Nova.', title: 'Chain Virtuoso', check: (s) => c(s).novas >= 1 },
  { id: 'a_connect100', name: 'Combo Architect', cat: 'combat', desc: 'Perform 100 Skill Connects.', check: (s) => c(s).skillConnects >= 100 },
  { id: 'a_slam', name: 'Wall Slam!', cat: 'combat', desc: 'Knock an enemy into a wall.', check: (s) => c(s).wallSlams >= 1 },
  { id: 'a_slam50', name: 'Wallbreaker', cat: 'combat', desc: 'Perform 50 Wall Slams.', title: 'Wallbreaker', check: (s) => c(s).wallSlams >= 50 },
  { id: 'a_react', name: 'Elemental Novice', cat: 'combat', desc: 'Trigger any elemental reaction.', check: (s) => c(s).reactions >= 1 },
  { id: 'a_react_all', name: 'Elementalist', cat: 'combat', desc: 'Trigger all six elemental reactions.', title: 'the Elementalist', check: (s) => s.reactionsSeen.length >= 6 },
  { id: 'a_sss', name: 'Full-Dive Overdrive', cat: 'combat', desc: 'Reach Style rank SSS.', title: 'Full-Diver', check: (s) => c(s).sssReached >= 1 },
  { id: 'a_breakables', name: 'Collateral Damage', cat: 'combat', desc: 'Destroy 25 barrels, crystals, crates or urns.', check: (s) => c(s).breakables >= 25 },
  // bosses
  { id: 'a_boss1', name: 'Tower Breaker', cat: 'legend', desc: 'Defeat Gorrak the Kobold Warchief.', check: (s) => !!s.bosses[0] },
  { id: 'a_boss2', name: 'Root Cutter', cat: 'legend', desc: 'Defeat Nerius the Elder Arch-Treant.', check: (s) => !!s.bosses[1] },
  { id: 'a_boss3', name: 'Wyrmslayer', cat: 'legend', desc: 'Defeat Igniscor the Molten Wyrm.', title: 'Wyrmslayer', check: (s) => !!s.bosses[2] },
  { id: 'a_boss4', name: 'Winter Ends', cat: 'legend', desc: 'Defeat Valkyria the Glacial Empress.', check: (s) => !!s.bosses[3] },
  { id: 'a_boss5', name: "Paragon's Bane", cat: 'legend', desc: 'Defeat Paragon Aurelion.', title: "Paragon's Bane", check: (s) => !!s.bosses[4] },
  { id: 'a_raid1', name: 'Gatebreaker', cat: 'legend', desc: 'Defeat the Colossus of the Sundered Gate.', title: 'Gatebreaker', check: (s) => s.raidBosses.includes('r_colossus') },
  { id: 'a_raid2', name: 'Reaper Reaped', cat: 'legend', desc: 'Defeat The Hollow Reaper.', title: 'Reaper-Bane', check: (s) => s.raidBosses.includes('r_reaper') },
  { id: 'a_raid_any', name: 'Assault Team', cat: 'social', desc: 'Win a 6-hero raid with the Vanguard.', check: (s) => c(s).raidsWon >= 1 },
  { id: 'a_abyss10', name: 'Into the Abyss', cat: 'legend', desc: 'Clear Abyss floor 10.', check: (s) => s.abyss.best >= 10 },
  { id: 'a_abyss50', name: 'Abyss Walker', cat: 'legend', desc: 'Clear Abyss floor 50.', title: 'Abyss Walker', check: (s) => s.abyss.best >= 50 },
  { id: 'a_abyss100', name: 'Bottomless', cat: 'legend', desc: 'Clear Abyss floor 100.', title: 'the Bottomless', check: (s) => s.abyss.best >= 100 },
  { id: 'a_coliseum', name: 'Grand Champion', cat: 'legend', desc: 'Win every Coliseum cup.', title: 'Grand Champion', check: (s) => s.arena.cups.every(Boolean) },
  // crafting & items
  { id: 'a_forge', name: 'Apprentice Smith', cat: 'craft', desc: 'Forge your first piece of gear.', check: (s) => c(s).forged >= 1 },
  { id: 'a_masterwork', name: 'Masterwork', cat: 'craft', desc: 'Forge a Masterwork or Supreme item.', check: (s) => c(s).masterworks >= 1 },
  { id: 'a_temper10', name: 'Master Smith', cat: 'craft', desc: 'Temper any gear to +10.', title: 'Master Smith', check: (s) => hasAny(s, (g) => g.temper >= 10) },
  { id: 'a_unique', name: 'Living Legend', cat: 'craft', desc: 'Obtain a unique weapon.', check: (s) => c(s).uniquesFound >= 1 },
  { id: 'a_mythic', name: 'Touched by Myth', cat: 'craft', desc: 'Obtain a Mythic item.', check: (s) => hasAny(s, (g) => g.rarity === 5) },
  { id: 'a_set6', name: 'Full Regalia', cat: 'craft', desc: 'Wear a full six-piece armor set.', title: 'the Regal', check: (s) => setCountsOf(s).some((n) => n >= 6) },
  { id: 'a_extract', name: 'Relic Scholar', cat: 'craft', desc: 'Extract a power into the Aether Relic Codex.', check: (s) => c(s).extracted >= 1 },
  { id: 'a_relics3', name: 'Codex Keeper', cat: 'craft', desc: 'Equip three relic powers at once.', check: (s) => !!(s.relics.weapon && s.relics.armor && s.relics.utility) },
  { id: 'a_crafted', name: 'Kitchen & Cauldron', cat: 'craft', desc: 'Brew or cook 25 items.', check: (s) => c(s).crafted >= 25 },
  // world & social
  { id: 'a_party', name: 'Full Party', cat: 'social', desc: 'Travel with two companions at once.', check: (s) => s.party.length >= 2 },
  { id: 'a_soulbound', name: 'Soulbound', cat: 'social', desc: 'Reach Soulbound affinity with a companion.', title: 'the Soulbound', check: (s) => Object.values(s.affinity).some((v) => v >= AFFINITY_RANKS[4]) },
  { id: 'a_triple', name: 'Triple SWITCH!', cat: 'social', desc: 'Perform a Triple SWITCH! chain.', check: (s) => c(s).tripleSwitches >= 1 },
  { id: 'a_assist', name: 'Good Samaritan', cat: 'social', desc: 'Rescue an adventurer under attack.', check: (s) => c(s).assists >= 1 },
  { id: 'a_duel', name: 'Duelist', cat: 'social', desc: 'Win a friendly duel against an adventurer.', title: 'the Duelist', check: (s) => c(s).duelsWon >= 1 },
  { id: 'a_trade', name: 'Barterer', cat: 'social', desc: 'Trade with a wandering adventurer.', check: (s) => c(s).trades >= 1 },
  { id: 'a_mount', name: 'Saddle Up', cat: 'world', desc: 'Own a mount.', check: (s) => s.mounts.length >= 1 },
  { id: 'a_mounts_all', name: 'Stablemaster', cat: 'world', desc: 'Own every mount.', title: 'Stablemaster', check: (s) => s.mounts.length >= MOUNTS.length },
  { id: 'a_charge', name: 'Cavalry Charge', cat: 'combat', desc: 'Land a Mounted Charge Slam.', check: (s) => c(s).chargeSlams >= 1 },
  { id: 'a_pet', name: 'Best Friend', cat: 'world', desc: 'Adopt a combat pet.', check: (s) => s.pets.length >= 1 },
  { id: 'a_fish', name: 'First Catch', cat: 'world', desc: 'Catch a fish.', check: (s) => c(s).fishCaught >= 1 },
  { id: 'a_fish25', name: 'Angler', cat: 'world', desc: 'Catch 25 fish.', title: 'the Angler', check: (s) => c(s).fishCaught >= 25 },
  { id: 'a_fish_legend', name: 'The One That Did Not Get Away', cat: 'world', desc: 'Catch a Legendary or Mythic fish.', check: (s) => !!(s.fish['fish_rooteel'] || s.fish['fish_starwhale']) },
  { id: 'a_treasure', name: 'X Marks the Spot', cat: 'world', desc: 'Dig up a treasure from an Ancient Treasure Map.', check: (s) => c(s).treasures >= 1 },
  { id: 'a_outbreak', name: 'Gatekeeper', cat: 'world', desc: 'Seal a Corrupted Gate Outbreak.', check: (s) => c(s).eventsWon >= 1 },
  { id: 'a_caravan', name: 'Escort Duty', cat: 'world', desc: 'Escort a caravan to safety and unlock the Black Market.', check: (s) => c(s).caravans >= 1 },
  { id: 'a_house', name: 'Homeowner', cat: 'world', desc: 'Buy a house.', check: (s) => Object.values(s.houses).some((h) => h?.owned) },
  { id: 'a_level30', name: 'Seasoned Diver', cat: 'world', desc: 'Reach level 30.', check: (s) => s.level >= 30 },
  { id: 'a_level60', name: 'Aetheria Legend', cat: 'legend', desc: 'Reach level 60.', title: 'Legend of Aetheria', check: (s) => s.level >= 60 },
  { id: 'a_bestiary', name: 'Naturalist', cat: 'world', desc: 'Record 25 different creatures in the Bestiary.', title: 'the Naturalist', check: (s) => Object.keys(s.bestiary).length >= 25 },
];
export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// ------------------------------------------------------------------ helpers shared with systems

/** equipped set piece counts (two-handed set weapons count as two pieces) */
export function setCountsOf(s: SaveData): number[] {
  const main = s.activeSet === 'A' ? s.equip.mainA : s.equip.mainB;
  const off = s.activeSet === 'A' ? s.equip.offA : s.equip.offB;
  const counts = SETS.map(() => 0);
  for (const g of [main, off, s.equip.head, s.equip.chest, s.equip.boots, s.equip.cloak]) {
    if (!g?.set) continue;
    const i = SETS.findIndex((x) => x.id === g.set);
    if (i < 0) continue;
    const twoHanded = g.wtype === 'spear' || g.wtype === 'halberd' || g.wtype === 'bow' || g.wtype === 'staff';
    counts[i] += twoHanded ? 2 : 1;
  }
  return counts;
}

export function setStats(s: SaveData): StatBlock[] {
  const out: StatBlock[] = [];
  setCountsOf(s).forEach((n, i) => {
    if (n >= 2) out.push(SETS[i].b2.stats);
    if (n >= 4) out.push(SETS[i].b4.stats);
  });
  return out;
}
