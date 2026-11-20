// Smelting, alchemy, cooking recipes plus forge blueprint / temper / salvage formulas.
import type { CraftGrade, GearItem, Rarity } from '../types/game';
import { GEAR_BASES } from './items';
import { TIERS } from './constants';

export interface Recipe {
  id: string;
  out: string;
  qty: number;
  ins: [string, number][];
  station: 'smelt' | 'alchemy' | 'cooking';
}

const r = (station: Recipe['station'], out: string, ins: [string, number][], qty = 1): Recipe => ({ id: `${station}_${out}`, out, qty, ins, station });

export const SMELT: Recipe[] = [
  r('smelt', 'ingot_iron', [['ore_iron', 2], ['ore_copper', 1]]),
  r('smelt', 'ingot_silver', [['ore_silver', 2]]),
  r('smelt', 'ingot_mithril', [['ore_mithril', 2], ['ore_silver', 1]]),
  r('smelt', 'ingot_orichalcum', [['ore_orichalcum', 2]]),
  r('smelt', 'ingot_demonsteel', [['ore_crimson', 3], ['ore_orichalcum', 1]]),
  r('smelt', 'ingot_starlight', [['ore_starlight', 2], ['ore_titanium', 1]]),
  r('smelt', 'ingot_dragonbone', [['ore_dragonbone', 2], ['ore_voidsteel', 1]]),
];

export const ALCHEMY: Recipe[] = [
  r('alchemy', 'pot_hp_s', [['herb_moonleaf', 2]], 2),
  r('alchemy', 'pot_mp_s', [['herb_moonleaf', 1], ['kobold_fang', 1]], 2),
  r('alchemy', 'pot_hp_m', [['herb_lotus', 2], ['water_essence', 1]], 2),
  r('alchemy', 'pot_haste', [['water_essence', 1], ['herb_lotus', 1], ['herb_moonleaf', 1]]),
  r('alchemy', 'pot_crit', [['venom_sac', 1], ['herb_firebell', 1]]),
  r('alchemy', 'oil_fire', [['herb_firebell', 2], ['drake_scale', 1]]),
  r('alchemy', 'pot_mp_l', [['herb_lotus', 2], ['frost_essence', 1]], 2),
  r('alchemy', 'oil_frost', [['herb_frostpetal', 2], ['frost_essence', 1]]),
  r('alchemy', 'pot_hp_l', [['herb_frostpetal', 2], ['herb_skyorchid', 1]], 2),
  r('alchemy', 'oil_lightning', [['aether_dust', 1], ['herb_skyorchid', 1], ['water_essence', 1]]),
];

export const COOKING: Recipe[] = [
  r('cooking', 'food_cutlet', [['boar_meat', 2], ['herb_moonleaf', 1], ['spice', 1]]),
  r('cooking', 'food_soup', [['fish', 1], ['herb_lotus', 2]]),
  r('cooking', 'food_stew', [['drake_meat', 2], ['herb_firebell', 1], ['spice', 1]]),
  r('cooking', 'food_skewer', [['wyvern_meat', 2], ['herb_frostpetal', 1]]),
  r('cooking', 'food_pie', [['herb_skyorchid', 2], ['bread', 1], ['honey', 1]]),
  r('cooking', 'food_banquet', [['boar_meat', 2], ['drake_meat', 1], ['wyvern_meat', 1], ['herb_skyorchid', 1], ['spice', 2]]),
];

export interface BlueprintCost {
  ins: [string, number][];
  gold: number;
}

export function blueprintCost(baseId: string, tier: number, mythic: boolean): BlueprintCost {
  const b = GEAR_BASES[baseId];
  const t = TIERS[tier];
  const ins: [string, number][] = [[t.ingot, b.ingots]];
  if (b.mats > 0) ins.push([t.mat, b.mats]);
  if (mythic) ins.push(['relic_shard', 3], ['mythic_core', 1]);
  return { ins, gold: Math.round(40 * Math.pow(tier + 1, 1.7) * (mythic ? 4 : 1)) };
}

/** forged gear rarity by craft grade (Mythic blueprints always forge Mythic) */
export const GRADE_RARITY: Record<CraftGrade, Rarity> = { standard: 1, fine: 2, masterwork: 3, supreme: 4 };

export const TEMPER_CHANCE = [1, 1, 1, 1, 1, 0.85, 0.7, 0.55, 0.4, 0.3];
/** tempering success bonuses: Gilded Anvil Syndicate per rank (1-5) and the Gilded Anvil Artisan 6-piece set */
export const TEMPER_GUILD_PER_RANK = 0.02;
export const TEMPER_SET_BONUS = 0.15;
/** hammer-gauge score (3 strikes x 0..3 points) x forge quality needed for each craft grade */
export const GRADE_THRESHOLDS = { fine: 3.8, masterwork: 6.5, supreme: 8.6 };
/** quick (auto) forging grade odds */
export const AUTO_FORGE_ODDS = { standard: 0.6, fine: 0.35, masterwork: 0.05 };
/** forge quality: x1.1 at a Personal Master Anvil, +2% per Gilded Anvil rank */
export const FORGE_HOME_QUALITY = 1.1;
export const FORGE_GUILD_QUALITY = 0.02;

export function temperCost(g: GearItem): { stone: string; stones: number; gold: number; chance: number } {
  const next = g.temper + 1;
  const greater = next > 5;
  return {
    stone: greater ? 'enh_greater' : 'enh_stone',
    stones: greater ? 1 + Math.floor((next - 6) / 2) : 1 + Math.floor((next - 1) / 2),
    gold: 80 * next * (g.tier + 1),
    chance: TEMPER_CHANCE[Math.min(9, next - 1)],
  };
}

export function socketCost(g: GearItem): number {
  return 150 * (g.tier + 1);
}

export function salvageYield(g: GearItem): [string, number][] {
  const b = GEAR_BASES[g.baseId];
  const out: [string, number][] = [
    [TIERS[g.tier].ingot, Math.max(1, Math.round(b.ingots * 0.4))],
    ['arcane_dust', 1 + g.rarity * 2 + (g.grade ? 1 : 0)],
  ];
  if (g.temper >= 3) out.push(['enh_stone', Math.floor(g.temper / 3)]);
  if (g.temper >= 7) out.push(['enh_greater', 1]);
  if (g.mythic) out.push(['relic_shard', 1]);
  return out;
}
