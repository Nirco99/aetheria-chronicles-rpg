// Global balance constants, visual palettes and progression curves.
import type { Branch, CraftGrade, Element, GearColors, GemType, Rarity, WeaponType, ArmorSlot } from '../types/game';

export const TILE = 32;
export const WALL_H = 26;
/** logical world-view height in pixels (world is scaled to fit the window height) */
export const VIEW_H = 600;
/** logical UI/HUD height */
export const UI_H = 720;

export const MAX_LEVEL = 60;
export const MAX_RANK = 50;
export const MAX_TEMPER = 10;
export const HOTBAR_SIZE = 6;
export const QUICK_KEYS = ['Z', 'X', 'C'];

export const PARRY_WINDOW = 0.25;
export const HITSTOP = 0.04;
export const SHATTER_FREEZE = 0.12;
export const BREAK_STUN = 4.0;
export const BREAK_CRIT_MULT = 1.5;
export const SWITCH_COST = 100;
export const SWITCH_BONUS = 0.35;
/** real seconds per in-game hour */
export const SECONDS_PER_HOUR = 60;
export const DEATH_XP_LOSS = 0.15;
export const DEATH_GOLD_FEE = 0.05;
export const GEAR_CAPACITY = 120;
export const VAULT_CAPACITY = 100;

export const BRANCHES: Branch[] = ['sword', 'dual', 'shield', 'spear', 'bow', 'magic'];

export const BRANCH_INFO: Record<Branch, { name: string; color: string; req: string; desc: string }> = {
  sword: { name: 'One-Handed Sword', color: '#7fc8ff', req: 'Longsword or Twin Edge in main hand', desc: 'Balanced lunges, diamond slashes and star flurries.' },
  dual: { name: 'Dual Blades', color: '#a78bfa', req: 'Two blades: one in each hand', desc: 'Relentless multi-hit combos and blink strikes.' },
  shield: { name: 'Shield & Fortress', color: '#ffd166', req: 'Shield in off hand', desc: 'Bashes, barriers, taunts and invulnerable domes.' },
  spear: { name: 'Spear & Polearm', color: '#5ee6a0', req: 'Spear or Halberd in main hand', desc: 'Reach, sweeps, leaping dives and armor piercing.' },
  bow: { name: 'Bow & Marksmanship', color: '#ffb35c', req: 'Bow in main hand', desc: 'Piercing shots, volleys, traps and arrow rain.' },
  magic: { name: 'Elemental & Arcane Magic', color: '#c18cff', req: 'Arcane Staff in main hand', desc: 'Meteors, ice lances, chain lightning and sanctuaries.' },
};

export const ACTIVE_RANKS = [1, 4, 8, 14, 22];
export const ACTIVE_SP = [1, 2, 3, 4, 5];
export const PASSIVE_RANKS = [2, 10, 18];

export const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
export const RARITY_COLORS = ['#c9d1d9', '#5fd38d', '#4aa8ff', '#b46cff', '#ffb347', '#ff4f7b'];
export const RARITY_MULT = [1, 1.1, 1.22, 1.36, 1.52, 1.75];

export const GRADE_INFO: Record<CraftGrade, { name: string; mult: number; color: string; sockets: number }> = {
  standard: { name: 'Standard', mult: 1.0, color: '#c9d1d9', sockets: 0 },
  fine: { name: 'Fine', mult: 1.15, color: '#5fd38d', sockets: 1 },
  masterwork: { name: 'Masterwork', mult: 1.3, color: '#4aa8ff', sockets: 1 },
  supreme: { name: 'Supreme Masterpiece', mult: 1.5, color: '#ffd166', sockets: 2 },
};

export interface TierInfo {
  name: string;
  level: number;
  power: number;
  ingot: string;
  mat: string;
  colors: GearColors;
  realm: number;
}

export const TIERS: TierInfo[] = [
  { name: 'Iron', level: 1, power: 1, ingot: 'ingot_iron', mat: 'wolf_pelt', realm: 0, colors: { main: '#a3acb6', accent: '#6b4a2f', trim: '#d5dae0', glow: '#cfe8ff' } },
  { name: 'Silver', level: 10, power: 1.9, ingot: 'ingot_silver', mat: 'treant_bark', realm: 1, colors: { main: '#dfe5ee', accent: '#3d5a80', trim: '#ffffff', glow: '#e6f2ff' } },
  { name: 'Mithril', level: 15, power: 2.6, ingot: 'ingot_mithril', mat: 'venom_sac', realm: 1, colors: { main: '#8fd3e8', accent: '#25607a', trim: '#e0fbff', glow: '#7fe9ff' } },
  { name: 'Orichalcum', level: 20, power: 3.5, ingot: 'ingot_orichalcum', mat: 'drake_scale', realm: 2, colors: { main: '#e6ae47', accent: '#6b3d12', trim: '#ffe29a', glow: '#ffc861' } },
  { name: 'Crimson Demonsteel', level: 26, power: 4.5, ingot: 'ingot_demonsteel', mat: 'golem_core', realm: 2, colors: { main: '#c0283f', accent: '#2a0d12', trim: '#ff8a8a', glow: '#ff3b5c' } },
  { name: 'Starlight Crystal', level: 32, power: 5.7, ingot: 'ingot_starlight', mat: 'wyvern_scale', realm: 3, colors: { main: '#c4e8ff', accent: '#3a4f9a', trim: '#ffffff', glow: '#a8d8ff' } },
  { name: 'Aetherial Dragonbone', level: 42, power: 7.0, ingot: 'ingot_dragonbone', mat: 'automaton_gear', realm: 4, colors: { main: '#efe6d2', accent: '#6e4bc4', trim: '#ffd27a', glow: '#c69bff' } },
];

export const GEM_INFO: Record<GemType, { name: string; element: Element; color: string; desc: string }> = {
  flame: { name: 'Flame Gem', element: 'fire', color: '#ff4d3a', desc: '+10% fire damage; 12% chance to Burn.' },
  frost: { name: 'Frost Gem', element: 'frost', color: '#5ee7ff', desc: '+10% frost damage; 12% chance to Chill.' },
  lightning: { name: 'Lightning Gem', element: 'lightning', color: '#ffd84a', desc: '+10% lightning damage; 12% chance to Shock and arc.' },
  wind: { name: 'Wind Gem', element: 'wind', color: '#57e389', desc: '+10% wind damage; +6% attack speed; heavier knockback.' },
  void: { name: 'Void Gem', element: 'void', color: '#a970ff', desc: '+10% void damage; 12% chance to Shred armor; 3% lifesteal.' },
};
export const GEM_TYPES: GemType[] = ['flame', 'frost', 'lightning', 'wind', 'void'];

export const ELEMENT_COLORS: Record<Element, string> = {
  none: '#ffffff',
  fire: '#ff6a3d',
  frost: '#7fe9ff',
  lightning: '#ffe066',
  wind: '#6dfca0',
  void: '#b98bff',
  holy: '#fff1a8',
  poison: '#9be15d',
};

export const WEAPON_INFO: Record<WeaponType, { name: string; branch: Branch; speed: number; reach: number; brk: number; twoHanded: boolean }> = {
  sword: { name: 'Longsword', branch: 'sword', speed: 1.0, reach: 54, brk: 6, twoHanded: false },
  twinblade: { name: 'Twin Edge', branch: 'sword', speed: 1.15, reach: 48, brk: 5, twoHanded: false },
  spear: { name: 'Spear', branch: 'spear', speed: 0.92, reach: 82, brk: 7, twoHanded: true },
  halberd: { name: 'Halberd', branch: 'spear', speed: 0.75, reach: 74, brk: 11, twoHanded: true },
  bow: { name: 'Longbow', branch: 'bow', speed: 0.95, reach: 520, brk: 4, twoHanded: true },
  staff: { name: 'Arcane Staff', branch: 'magic', speed: 0.9, reach: 460, brk: 4, twoHanded: true },
};

export const ARMOR_INFO: Record<ArmorSlot, { name: string }> = {
  head: { name: 'Helmet' },
  chest: { name: 'Chest Armor' },
  boots: { name: 'Boots' },
  cloak: { name: 'Cloak' },
  shield: { name: 'Shield' },
};

export const SKIN_TONES = ['#ffe3cf', '#f6cfa9', '#e8b48a', '#d39b6e', '#b07850', '#8d5a3b', '#6b4129', '#f2d5cb'];
export const HAIR_STYLES = ['Spiky Vanguard', 'Long Straight', 'High Ponytail', 'Twin Tails', 'Bob Cut', 'Swept Fringe', 'Braided Crown', 'Wild Mane'];
export const HAIR_COLORS: { name: string; color: string }[] = [
  { name: 'Raven Black', color: '#1d1b26' },
  { name: 'Chestnut', color: '#6b3e26' },
  { name: 'Golden Blonde', color: '#e8c15a' },
  { name: 'Silver White', color: '#e3e8f0' },
  { name: 'Crimson', color: '#b4233a' },
  { name: 'Azure', color: '#3f7fe0' },
  { name: 'Emerald', color: '#2fa86a' },
  { name: 'Violet', color: '#7d4bd6' },
  { name: 'Rose Pink', color: '#f08fb8' },
  { name: 'Ash Grey', color: '#8a8f99' },
];
export const EYE_COLORS: { name: string; color: string }[] = [
  { name: 'Amber', color: '#e09b2d' },
  { name: 'Sapphire', color: '#2f6fe0' },
  { name: 'Emerald', color: '#21a663' },
  { name: 'Crimson', color: '#d1283e' },
  { name: 'Violet', color: '#8f5ae8' },
  { name: 'Storm Grey', color: '#7a8796' },
  { name: 'Gold', color: '#f2c94c' },
  { name: 'Cyan', color: '#2fd3e8' },
];

export function xpToNext(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.6));
}

export function masteryToNext(rank: number): number {
  return Math.floor(40 * Math.pow(rank, 1.4));
}

export function tierForLevel(level: number): number {
  if (level < 10) return 0;
  if (level < 15) return 1;
  if (level < 20) return 2;
  if (level < 26) return 3;
  if (level < 32) return 4;
  if (level < 42) return 5;
  return 6;
}

export const CONTROLS: [string, string][] = [
  ['W A S D / Arrows', 'Move'],
  ['Left Click / J', 'Basic attack (aims at the cursor)'],
  ['Right Click / Shift', 'Block - press just before impact to Perfect Parry'],
  ['Space', 'Dodge roll with invulnerability frames'],
  ['1 - 6', 'Sword Skills on your hotbar'],
  ['Q', 'Swap weapon set A / B'],
  ['R / Tab', 'SWITCH! with your companion when the gauge is full'],
  ['E / F', 'Interact, talk, gather, enter'],
  ['Z X C', 'Quick-use consumables'],
  ['I', 'Character: equipment, inventory, mastery, guilds'],
  ['K', 'Mastery & Sword Skills'],
  ['M', 'Realm Atlas'],
  ['H', "Adventurer's Handbook"],
  ['B', 'Decorate (inside your house)'],
  ['Esc', 'Pause / close window'],
];
