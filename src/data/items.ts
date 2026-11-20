// Item catalogue: materials, consumables, food, gems, furniture, trophies and procedural gear.
import type {
  ArmorSlot, CraftGrade, FurnitureDef, FurnitureKind, GearColors, GearItem, ItemDef, MarketCategory,
  Rarity, StatBlock, WeaponType, GemType,
} from '../types/game';
import type { Affix, AffixKind } from '../types/game';
import { GRADE_INFO, RARITY_MULT, TEMPER_STEP, TIERS, tierForLevel } from './constants';
import { uid, weighted } from '../engine/util';
import { AFFIXES, AFFIX_COUNT, LEGENDARY_POWERS, SETS, SET_BY_ID, UNIQUES, UNIQUE_BY_ID, type AffixDef } from './v3';
import { LOOT_WEIGHTS, MF_RARITY_UPGRADE, SET_PIECE_CHANCE } from './loot';

const I: Record<string, ItemDef> = {};
function def(d: ItemDef): void {
  I[d.id] = d;
}

// ------------------------------------------------------------------ ores & ingots
const ores: [string, string, number, string, number][] = [
  ['ore_copper', 'Copper Ore', 6, '#c8733a', 0],
  ['ore_iron', 'Iron Ore', 8, '#8d96a0', 0],
  ['ore_silver', 'Silver Ore', 18, '#dfe5ee', 1],
  ['ore_mithril', 'Mithril Ore', 30, '#6fd0e8', 1],
  ['ore_orichalcum', 'Orichalcum Ore', 48, '#e6ae47', 2],
  ['ore_crimson', 'Crimson Steel Ore', 62, '#d0304a', 2],
  ['ore_titanium', 'Titanium Ore', 70, '#9fb3c8', 3],
  ['ore_starlight', 'Starlight Crystal', 85, '#c4e8ff', 3],
  ['ore_voidsteel', 'Voidsteel Ore', 110, '#7b56d6', 4],
  ['ore_dragonbone', 'Dragonbone', 130, '#efe6d2', 4],
];
for (const [id, name, value, color, realm] of ores) {
  def({ id, name, cat: 'material', value, color, icon: id === 'ore_dragonbone' ? 'bone' : 'ore', tier: realm, desc: `Raw material mined from veins in Realm ${realm + 1}. Smelt it into ingots at any forge.` });
}
const ingots: [string, string, number, string][] = [
  ['ingot_iron', 'Iron Ingot', 26, '#a3acb6'],
  ['ingot_silver', 'Silver Ingot', 45, '#e8edf4'],
  ['ingot_mithril', 'Mithril Ingot', 85, '#8fd3e8'],
  ['ingot_orichalcum', 'Orichalcum Ingot', 110, '#e6ae47'],
  ['ingot_demonsteel', 'Crimson Demonsteel Ingot', 170, '#c0283f'],
  ['ingot_starlight', 'Starlight Crystal Ingot', 220, '#c4e8ff'],
  ['ingot_dragonbone', 'Aetherial Dragonbone Alloy', 330, '#e9dcff'],
];
ingots.forEach(([id, name, value, color], tier) =>
  def({ id, name, cat: 'material', value, color, icon: 'ingot', tier, desc: `Refined ${TIERS[tier].name}-tier metal used by every forge blueprint of that tier.` }),
);

// ------------------------------------------------------------------ herbs
const herbs: [string, string, number, string, number][] = [
  ['herb_moonleaf', 'Moonleaf', 5, '#9be15d', 0],
  ['herb_lotus', 'Azure Lotus', 14, '#59b8ff', 1],
  ['herb_firebell', 'Firebell Root', 24, '#ff7a3d', 2],
  ['herb_frostpetal', 'Frostpetal', 34, '#bfefff', 3],
  ['herb_skyorchid', 'Sky Orchid', 48, '#f6a5ff', 4],
];
for (const [id, name, value, color, realm] of herbs) {
  def({ id, name, cat: 'material', value, color, icon: 'herb', tier: realm, desc: `A reagent herb gathered in Realm ${realm + 1}. Used in alchemy and cooking.` });
}

// ------------------------------------------------------------------ monster materials
const mats: [string, string, number, string, ItemDef['icon'], string][] = [
  ['wolf_pelt', 'Dire Wolf Pelt', 7, '#8a7a6a', 'hide', 'Tough pelt. Iron-tier crafting material.'],
  ['boar_meat', 'Boar Meat', 6, '#d9725a', 'meat', 'Marbled meat for hearty cooking.'],
  ['kobold_fang', 'Kobold Fang', 8, '#efe3c8', 'fang', 'A jagged fang. Merchants buy them by the sack.'],
  ['treant_bark', 'Treant Bark', 16, '#6b8f4e', 'bark', 'Living bark. Silver-tier crafting material.'],
  ['venom_sac', 'Venom Sac', 18, '#8ee05d', 'essence', 'Potent venom. Mithril-tier crafting material and alchemy reagent.'],
  ['water_essence', 'Water Essence', 20, '#5ab8ff', 'essence', 'Condensed lake spirit. Alchemy reagent.'],
  ['spore_cap', 'Blight Spore Cap', 15, '#b07acc', 'herb', 'A corrupted mushroom cap. Sells well to alchemists.'],
  ['drake_scale', 'Drake Scale', 30, '#e0763a', 'scale', 'Heat-proof scale. Orichalcum-tier crafting material.'],
  ['drake_meat', 'Drake Meat', 26, '#c4513c', 'meat', 'Smoky, rich meat for stews.'],
  ['golem_core', 'Obsidian Core', 40, '#34262e', 'core', 'A volcanic heart-stone. Demonsteel-tier crafting material.'],
  ['flame_emblem', 'Flame Knight Emblem', 38, '#ff9a3d', 'shard', 'An oath-emblem still warm to the touch.'],
  ['demon_core', 'Demon Core', 55, '#ff3b5c', 'core', 'A smoldering core prized by collectors. Pyrehold traders pay a fortune for it.'],
  ['wyvern_scale', 'Frost Wyvern Scale', 52, '#a8d8ff', 'scale', 'Starlight-tier crafting material.'],
  ['wyvern_meat', 'Wyvern Steak', 40, '#e3a0a0', 'meat', 'Lean meat that keeps frozen forever.'],
  ['phantom_cloth', 'Phantom Silk', 50, '#c9c2ff', 'cloth', 'Spectral thread for cloaks and robes.'],
  ['frost_essence', 'Frost Essence', 48, '#bff3ff', 'essence', 'A sliver of eternal winter. Alchemy reagent.'],
  ['automaton_gear', 'Seraphim Cog', 70, '#ffd27a', 'cog', 'Precision cog. Dragonbone-tier crafting material.'],
  ['reaver_claw', 'Reaver Claw', 72, '#7b56d6', 'fang', 'A claw that cuts through light itself.'],
  ['aether_dust', 'Aether Dust', 60, '#f6d9ff', 'dust', 'Glittering sky dust. Alchemy reagent.'],
  ['wisp_lumen', 'Wisp Lumen', 55, '#fff3a8', 'essence', 'A captured mote of living light.'],
  ['arcane_dust', 'Arcane Dust', 12, '#b9a3ff', 'dust', 'Salvage residue. Sells to alchemists and enchanters.'],
  ['relic_shard', 'Abyssal Relic Shard', 250, '#ff4f7b', 'relic', 'A fragment of the Abyss. Required for Mythic blueprints.'],
  ['mythic_core', 'Mythic Core', 900, '#ff9ad0', 'core', 'The heart of an Abyss boss. Required for Mythic blueprints.'],
  ['enh_stone', 'Enhancement Stone', 60, '#9ad1ff', 'stone', 'Tempers gear from +1 to +5.'],
  ['enh_greater', 'Greater Enhancement Stone', 240, '#ffd166', 'stone', 'Tempers gear from +6 to +10.'],
  ['spice', "Traveler's Spices", 4, '#e0a050', 'dust', 'A pouch of salt, pepper and dried herbs.'],
  ['bread', 'Fresh Bread', 6, '#e8c07a', 'dish', 'Baked this morning.'],
  ['fish', 'Silverscale Fish', 12, '#a9c8e0', 'meat', 'A plump lake fish from Sylvanis.'],
  ['honey', 'Cloud Honey', 18, '#ffc94a', 'flask', 'Golden honey from Aetherion sky-hives.'],
];
for (const [id, name, value, color, icon, desc] of mats) def({ id, name, cat: 'material', value, color, icon, desc });

// ------------------------------------------------------------------ v3: fish & treasure maps
const fishes: [string, string, number, string, string][] = [
  ['fish_minnow', 'Plains Minnow', 6, '#c9d6c0', 'A tiny, quick fish from the Emerald Plains streams.'],
  ['fish_goldcarp', 'Golden Carp', 60, '#ffc94a', 'A lucky carp with scales like coins. Collectors adore it.'],
  ['fish_lotus', 'Lotus Koi', 22, '#ff9ad0', 'A koi that sleeps under lotus pads.'],
  ['fish_glowtrout', 'Glowcap Trout', 70, '#b8ff7a', 'Its fins glow faintly in murky water.'],
  ['fish_rooteel', 'Ancient Root-Eel', 600, '#6b8f4e', 'Legendary. As old as the Arch-Treant itself.'],
  ['fish_magmaw', 'Magmaw', 90, '#ff7a3d', 'Swims in lava. Handle with tongs.'],
  ['fish_cinder', 'Cinder Pike', 220, '#ff4f3a', 'A predator wreathed in sparks.'],
  ['fish_icecod', 'Glacier Cod', 40, '#bfe6ff', 'Frozen solid the instant it leaves the water.'],
  ['fish_crystal', 'Crystal Char', 260, '#c4e8ff', 'Transparent as glass, sharp as ice.'],
  ['fish_skyray', 'Sky Ray', 140, '#c69bff', 'Glides through the cloud-sea around Aetherion.'],
  ['fish_starwhale', 'Starwhale Calf', 1800, '#ffd1f0', 'Mythic. A sky-whale calf worth a fortune to collectors.'],
];
for (const [id, name, value, color, desc] of fishes) def({ id, name, cat: 'material', value, color, icon: 'meat', desc });
def({ id: 'treasure_map', name: 'Ancient Treasure Map', cat: 'consumable', value: 300, color: '#e8c07a', icon: 'relic', desc: 'Use it to reveal a dig site in the wilds. Find the X on your minimap and press E to dig.' });
def({ id: 'food_platter', name: "Angler's Platter", cat: 'food', value: 160, color: '#9ad1ff', icon: 'dish', desc: '+10% ATK, +10% MAG and +12% Magic Find for 8 minutes.', effect: { buff: { id: 'food', name: "Angler's Platter", dur: 480, color: '#9ad1ff', stats: { atkPct: 0.1, magPct: 0.1, magicFind: 0.12 } } } });

// ------------------------------------------------------------------ consumables
def({ id: 'pot_hp_s', name: 'Minor Healing Potion', cat: 'consumable', value: 20, color: '#ff5d6c', icon: 'potion', desc: 'Restores 30% HP.', effect: { heal: 0.3 } });
def({ id: 'pot_hp_m', name: 'Healing Elixir', cat: 'consumable', value: 60, color: '#ff3b5c', icon: 'potion', desc: 'Restores 55% HP.', effect: { heal: 0.55 } });
def({ id: 'pot_hp_l', name: 'Grand Healing Elixir', cat: 'consumable', value: 150, color: '#ff8fb1', icon: 'flask', desc: 'Restores 85% HP and cleanses ailments.', effect: { heal: 0.85, cleanse: true } });
def({ id: 'pot_mp_s', name: 'Mana Tonic', cat: 'consumable', value: 25, color: '#4aa8ff', icon: 'potion', desc: 'Restores 35% MP.', effect: { mana: 0.35 } });
def({ id: 'pot_mp_l', name: 'Arcane Elixir', cat: 'consumable', value: 90, color: '#7f6bff', icon: 'flask', desc: 'Restores 70% MP and all Stamina.', effect: { mana: 0.7, sta: 1 } });
def({ id: 'pot_crit', name: 'Draught of Precision', cat: 'consumable', value: 80, color: '#ffd166', icon: 'flask', desc: '+12% critical chance for 3 minutes.', effect: { buff: { id: 'draught', name: 'Precision', dur: 180, color: '#ffd166', stats: { crit: 0.12 } } } });
def({ id: 'pot_haste', name: 'Quicksilver Draught', cat: 'consumable', value: 70, color: '#7fe9ff', icon: 'flask', desc: '+15% attack speed and +12% move speed for 3 minutes.', effect: { buff: { id: 'draught', name: 'Quicksilver', dur: 180, color: '#7fe9ff', stats: { aspd: 0.15, move: 0.12 } } } });
def({ id: 'oil_fire', name: 'Fire Blade Oil', cat: 'consumable', value: 90, color: '#ff6a3d', icon: 'oil', desc: 'Coats your weapon in flame for 3 minutes: +15% fire damage and Burn.', effect: { buff: { id: 'oil', name: 'Fire Oil', dur: 180, color: '#ff6a3d', oil: 'fire' } } });
def({ id: 'oil_frost', name: 'Frost Blade Oil', cat: 'consumable', value: 100, color: '#7fe9ff', icon: 'oil', desc: 'Coats your weapon in frost for 3 minutes: +15% frost damage and Chill.', effect: { buff: { id: 'oil', name: 'Frost Oil', dur: 180, color: '#7fe9ff', oil: 'frost' } } });
def({ id: 'oil_lightning', name: 'Lightning Blade Oil', cat: 'consumable', value: 120, color: '#ffe066', icon: 'oil', desc: 'Charges your weapon for 3 minutes: +15% lightning damage and Shock.', effect: { buff: { id: 'oil', name: 'Lightning Oil', dur: 180, color: '#ffe066', oil: 'lightning' } } });

// ------------------------------------------------------------------ food
def({ id: 'food_cutlet', name: 'Crisp Boar Cutlet', cat: 'food', value: 45, color: '#e0a050', icon: 'dish', desc: '+10% ATK and +1% HP/s regeneration for 5 minutes.', effect: { buff: { id: 'food', name: 'Boar Cutlet', dur: 300, color: '#e0a050', stats: { atkPct: 0.1 }, hpRegen: 0.01 } } });
def({ id: 'food_soup', name: 'Lakeside Lotus Soup', cat: 'food', value: 70, color: '#59b8ff', icon: 'dish', desc: '+12% MAG and +40% MP regeneration for 6 minutes.', effect: { buff: { id: 'food', name: 'Lotus Soup', dur: 360, color: '#59b8ff', stats: { magPct: 0.12, regen: 0.4 } } } });
def({ id: 'food_stew', name: 'Wyrm-Steak Stew', cat: 'food', value: 120, color: '#c4513c', icon: 'dish', desc: '+15% ATK and +10% DEF for 8 minutes.', effect: { buff: { id: 'food', name: 'Wyrm-Steak Stew', dur: 480, color: '#c4513c', stats: { atkPct: 0.15, defPct: 0.1 } } } });
def({ id: 'food_skewer', name: 'Glacier Wyvern Skewer', cat: 'food', value: 150, color: '#a8d8ff', icon: 'dish', desc: '+8% critical chance and +8% move speed for 8 minutes.', effect: { buff: { id: 'food', name: 'Wyvern Skewer', dur: 480, color: '#a8d8ff', stats: { crit: 0.08, move: 0.08 } } } });
def({ id: 'food_pie', name: 'Sky Orchid Honey Pie', cat: 'food', value: 190, color: '#f6a5ff', icon: 'dish', desc: '+15% max HP and +1.5% HP/s regeneration for 10 minutes.', effect: { buff: { id: 'food', name: 'Honey Pie', dur: 600, color: '#f6a5ff', stats: { hpPct: 0.15 }, hpRegen: 0.015 } } });
def({ id: 'food_banquet', name: "Sovereign's Banquet", cat: 'food', value: 480, color: '#ffd166', icon: 'dish', desc: '+18% ATK, +15% DEF, +18% MAG, +6% crit, +6% speed for 15 minutes.', effect: { buff: { id: 'food', name: "Sovereign's Banquet", dur: 900, color: '#ffd166', stats: { atkPct: 0.18, defPct: 0.15, magPct: 0.18, crit: 0.06, move: 0.06 } } } });

// ------------------------------------------------------------------ gems
const gemColors: Record<GemType, string> = { flame: '#ff4d3a', frost: '#5ee7ff', lightning: '#ffd84a', wind: '#57e389', void: '#a970ff' };
for (const g of Object.keys(gemColors) as GemType[]) {
  const nm = g[0].toUpperCase() + g.slice(1);
  def({ id: 'gem_' + g, name: `${nm} Gem`, cat: 'gem', value: 300, color: gemColors[g], icon: 'gem', gem: g, desc: `Socket into a weapon at a forge. Tints its aura and slash ribbons.` });
}

// ------------------------------------------------------------------ furniture
export const FURNITURE: Record<FurnitureKind, FurnitureDef> = {
  vault: { kind: 'vault', w: 2, h: 1, walkable: false, mounts: 0 },
  anvil: { kind: 'anvil', w: 2, h: 1, walkable: false, mounts: 0, light: '#ff9a3d' },
  alchemy: { kind: 'alchemy', w: 2, h: 1, walkable: false, mounts: 0, light: '#7fe9ff' },
  hearth: { kind: 'hearth', w: 2, h: 1, walkable: false, mounts: 0, light: '#ffb35c' },
  bed: { kind: 'bed', w: 2, h: 2, walkable: false, mounts: 0 },
  trophy: { kind: 'trophy', w: 1, h: 1, walkable: false, mounts: 0, light: '#ffd166' },
  rack: { kind: 'rack', w: 2, h: 1, walkable: false, mounts: 3 },
  mannequin: { kind: 'mannequin', w: 1, h: 1, walkable: false, mounts: 5 },
  rug: { kind: 'rug', w: 3, h: 2, walkable: true, mounts: 0 },
  plant: { kind: 'plant', w: 1, h: 1, walkable: false, mounts: 0 },
  lantern: { kind: 'lantern', w: 1, h: 1, walkable: false, mounts: 0, light: '#ffe2a0' },
  bookshelf: { kind: 'bookshelf', w: 2, h: 1, walkable: false, mounts: 0 },
  table: { kind: 'table', w: 2, h: 1, walkable: false, mounts: 0 },
  chair: { kind: 'chair', w: 1, h: 1, walkable: false, mounts: 0 },
  banner: { kind: 'banner', w: 1, h: 1, walkable: false, mounts: 0 },
};
const furn: [string, string, FurnitureKind, number, string, string][] = [
  ['furn_vault', 'Storage Vault', 'vault', 400, '#8a6a3a', 'A 100-slot vault shared between all of your houses.'],
  ['furn_anvil', 'Personal Master Anvil', 'anvil', 1500, '#9aa3ad', 'Forge at home with a +10% forging quality bonus.'],
  ['furn_alchemy', 'Alchemy Station', 'alchemy', 900, '#5ab8ff', 'Brew potions, draughts and blade oils at home.'],
  ['furn_hearth', 'Cooking Hearth', 'hearth', 700, '#e0763a', 'Cook buff meals at home.'],
  ['furn_bed', 'Royal Bed', 'bed', 1200, '#b4233a', 'Sleep until morning and wake Well Rested (+20% XP for 30 minutes).'],
  ['furn_rack', 'Weapon Display Rack', 'rack', 500, '#6b4a2f', 'Mount up to three weapons for display.'],
  ['furn_mannequin', 'Armor Mannequin', 'mannequin', 450, '#c8a46e', 'Dress it in a full armor set for display.'],
  ['furn_rug', 'Woven Rug', 'rug', 120, '#7a2f45', 'A soft rug you can walk over.'],
  ['furn_plant', 'Potted Fern', 'plant', 60, '#3f9a5a', 'A cheerful house plant.'],
  ['furn_lantern', 'Crystal Lantern', 'lantern', 150, '#ffe2a0', 'Casts a warm light at night.'],
  ['furn_bookshelf', 'Bookshelf', 'bookshelf', 260, '#7b5232', 'Tomes of realm lore.'],
  ['furn_table', 'Oak Table', 'table', 180, '#8a5a32', 'A sturdy dining table.'],
  ['furn_chair', 'Cushioned Chair', 'chair', 90, '#8a5a32', 'Comfortable seating.'],
  ['furn_banner', 'Guild Banner', 'banner', 140, '#3f7fe0', 'Show your guild colors.'],
];
for (const [id, name, kind, value, color, desc] of furn) def({ id, name, cat: 'furniture', value, color, icon: 'furniture', furniture: kind, desc });

export const TROPHIES: [string, string, string][] = [
  ['trophy_kobold', 'Trophy: Gorrak the Kobold Warchief', 'b_kobold'],
  ['trophy_treant', 'Trophy: Nerius the Elder Arch-Treant', 'b_treant'],
  ['trophy_wyrm', 'Trophy: Igniscor the Molten Wyrm', 'b_wyrm'],
  ['trophy_empress', 'Trophy: Valkyria the Glacial Empress', 'b_empress'],
  ['trophy_paragon', 'Trophy: Paragon Aurelion', 'b_paragon'],
  ['trophy_cup1', 'Trophy: Bronze Cup', 'cup'],
  ['trophy_cup2', 'Trophy: Silver Cup', 'cup'],
  ['trophy_cup3', 'Trophy: Gold Cup', 'cup'],
  ['trophy_cup4', 'Trophy: Platinum Cup', 'cup'],
  ['trophy_cup5', 'Trophy: Champion Cup', 'cup'],
];
for (const [id, name, of] of TROPHIES) {
  def({ id, name, cat: 'trophy', value: 0, color: '#ffd166', icon: 'trophy', furniture: 'trophy', trophyOf: of, desc: 'A trophy statue for your house. Place it with the decorator (B).' });
}

export const ITEMS = I;
export function itemDef(id: string): ItemDef {
  const d = I[id];
  if (!d) throw new Error('Unknown item ' + id);
  return d;
}
export function marketCat(id: string): MarketCategory {
  const c = itemDef(id).cat;
  return c === 'trophy' ? 'furniture' : c;
}

// ------------------------------------------------------------------ gear
export interface GearBase {
  id: string;
  kind: 'weapon' | 'armor';
  wtype?: WeaponType;
  aslot?: ArmorSlot;
  style: number;
  label: string;
  stats: StatBlock;
  ingots: number;
  mats: number;
  cloth: boolean;
}

export const GEAR_BASES: Record<string, GearBase> = {
  w_sword: { id: 'w_sword', kind: 'weapon', wtype: 'sword', style: 0, label: 'Longsword', stats: { atk: 12 }, ingots: 5, mats: 2, cloth: false },
  w_twinblade: { id: 'w_twinblade', kind: 'weapon', wtype: 'twinblade', style: 0, label: 'Twin Edge', stats: { atk: 9, aspd: 0.08, crit: 0.03 }, ingots: 4, mats: 2, cloth: false },
  w_spear: { id: 'w_spear', kind: 'weapon', wtype: 'spear', style: 0, label: 'Spear', stats: { atk: 13, brk: 2 }, ingots: 4, mats: 3, cloth: false },
  w_halberd: { id: 'w_halberd', kind: 'weapon', wtype: 'halberd', style: 0, label: 'Halberd', stats: { atk: 17, brk: 5 }, ingots: 6, mats: 3, cloth: false },
  w_bow: { id: 'w_bow', kind: 'weapon', wtype: 'bow', style: 0, label: 'Longbow', stats: { atk: 11, crit: 0.04 }, ingots: 2, mats: 4, cloth: false },
  w_staff: { id: 'w_staff', kind: 'weapon', wtype: 'staff', style: 0, label: 'Arcane Staff', stats: { atk: 5, mag: 14, mp: 15 }, ingots: 2, mats: 3, cloth: false },
  a_helm: { id: 'a_helm', kind: 'armor', aslot: 'head', style: 0, label: 'Helm', stats: { def: 4, hp: 10 }, ingots: 3, mats: 1, cloth: false },
  a_hood: { id: 'a_hood', kind: 'armor', aslot: 'head', style: 1, label: 'Hood', stats: { def: 2, crit: 0.02, move: 0.02 }, ingots: 1, mats: 3, cloth: true },
  a_circlet: { id: 'a_circlet', kind: 'armor', aslot: 'head', style: 2, label: 'Circlet', stats: { def: 2, mag: 4, mp: 10 }, ingots: 2, mats: 2, cloth: false },
  a_brig: { id: 'a_brig', kind: 'armor', aslot: 'chest', style: 0, label: 'Brigandine', stats: { def: 8, hp: 20 }, ingots: 4, mats: 3, cloth: false },
  a_coat: { id: 'a_coat', kind: 'armor', aslot: 'chest', style: 1, label: 'Duelist Coat', stats: { def: 6, crit: 0.03, aspd: 0.04 }, ingots: 2, mats: 5, cloth: true },
  a_plate: { id: 'a_plate', kind: 'armor', aslot: 'chest', style: 2, label: 'Knight Plate', stats: { def: 12, hp: 30, move: -0.03 }, ingots: 7, mats: 2, cloth: false },
  a_robe: { id: 'a_robe', kind: 'armor', aslot: 'chest', style: 3, label: 'Arcane Robe', stats: { def: 4, mag: 6, mp: 25 }, ingots: 1, mats: 5, cloth: true },
  a_boots: { id: 'a_boots', kind: 'armor', aslot: 'boots', style: 0, label: 'Greaves', stats: { def: 3, move: 0.03 }, ingots: 3, mats: 2, cloth: false },
  a_cloak: { id: 'a_cloak', kind: 'armor', aslot: 'cloak', style: 0, label: 'Cloak', stats: { def: 2, hp: 12, crit: 0.01 }, ingots: 1, mats: 4, cloth: true },
  a_shield: { id: 'a_shield', kind: 'armor', aslot: 'shield', style: 0, label: 'Shield', stats: { def: 6, block: 0.1 }, ingots: 5, mats: 1, cloth: false },
};
export const GEAR_BASE_IDS = Object.keys(GEAR_BASES);

/** Dyed cloth palettes per tier (hoods, coats, robes, cloaks). */
export const CLOTH_COLORS: GearColors[] = [
  { main: '#7a5235', accent: '#4a3020', trim: '#c9a46e', glow: '#ffe2a0' },
  { main: '#2f4a7a', accent: '#1c2c4a', trim: '#d7dde6', glow: '#cfe8ff' },
  { main: '#1f6f78', accent: '#0f3b40', trim: '#8fd3e8', glow: '#7fe9ff' },
  { main: '#a8642a', accent: '#5a3010', trim: '#ffe29a', glow: '#ffc861' },
  { main: '#16161c', accent: '#2a0d12', trim: '#c0283f', glow: '#ff3b5c' },
  { main: '#eef4ff', accent: '#3a4f9a', trim: '#b4233a', glow: '#a8d8ff' },
  { main: '#4b2f8a', accent: '#24154a', trim: '#ffd27a', glow: '#c69bff' },
];

function shieldShape(tier: number): string {
  return tier <= 1 ? 'Buckler' : tier <= 3 ? 'Kite Shield' : 'Tower Aegis';
}

const SPECIAL_NAMES: Record<string, string> = {
  'a_coat:4': 'Nightfall Duelist Coat',
  'a_plate:5': 'Ivory Aegis Knight Plate',
  'a_shield:6': 'Templar Tower Aegis',
  'a_robe:6': 'Robe of the Aether Sovereign',
  'w_sword:6': 'Aetherial Dragonbone Blade',
};

export function gearName(base: GearBase, tier: number, mythic: boolean): string {
  if (mythic && base.aslot === 'chest') return 'Mythic Aetherial Dragonmail';
  const special = SPECIAL_NAMES[`${base.id}:${tier}`];
  const label = base.aslot === 'shield' ? shieldShape(tier) : base.label;
  const nm = special ?? `${TIERS[tier].name} ${label}`;
  return mythic ? `Mythic ${nm}` : nm;
}

export const FRACTIONAL: (keyof StatBlock)[] = ['crit', 'critDmg', 'aspd', 'move', 'block', 'regen', 'atkPct', 'defPct', 'magPct', 'hpPct', 'xpPct', 'lifesteal', 'skillDmg', 'cdr', 'magicFind'];

export function scaleStats(s: StatBlock, tier: number): StatBlock {
  const out: StatBlock = {};
  const p = TIERS[tier].power;
  for (const k of Object.keys(s) as (keyof StatBlock)[]) {
    const v = s[k] ?? 0;
    out[k] = FRACTIONAL.includes(k) ? +(v * (1 + tier * 0.12)).toFixed(4) : Math.round(v * p);
  }
  return out;
}

export interface GearOpts {
  grade?: CraftGrade | null;
  name?: string;
  colors?: GearColors;
  mythic?: boolean;
  forgedBy?: string;
  statMult?: number;
  /** v3: roll affixes / legendary power (default true) */
  affixes?: boolean;
  set?: string;
  unique?: string;
}

export function makeGear(baseId: string, tier: number, rarity: Rarity, o: GearOpts = {}): GearItem {
  const b = GEAR_BASES[baseId];
  if (!b) throw new Error('Unknown gear base ' + baseId);
  const t = Math.max(0, Math.min(6, tier));
  const grade = o.grade ?? null;
  const mythic = !!o.mythic;
  let style = b.style;
  if (mythic && b.aslot === 'chest') style = 4;
  const colors = o.colors ?? (b.cloth ? CLOTH_COLORS[t] : TIERS[t].colors);
  const base = scaleStats(b.stats, t);
  if (o.statMult) for (const k of Object.keys(base) as (keyof StatBlock)[]) if (!FRACTIONAL.includes(k)) base[k] = Math.max(1, Math.round((base[k] ?? 0) * o.statMult));
  const raritySockets = [0, 0, 1, 1, 2, 2][rarity];
  const gradeSockets = grade ? GRADE_INFO[grade].sockets : 0;
  const sockets = b.kind === 'weapon' ? Math.max(raritySockets, gradeSockets) : 0;
  return {
    uid: uid(),
    baseId,
    kind: b.kind,
    wtype: b.wtype,
    aslot: b.aslot,
    style,
    tier: t,
    rarity: mythic ? 5 : rarity,
    grade,
    temper: 0,
    sockets,
    gems: new Array(sockets).fill(null),
    base,
    name: o.name ?? gearName(b, t, mythic),
    forgedBy: o.forgedBy,
    mythic,
    colors: { ...colors },
    affixes: o.affixes === false ? [] : rollAffixes(b.kind, t, mythic ? 5 : rarity),
    power: o.affixes !== false && (mythic || rarity >= 4) ? LEGENDARY_POWERS[Math.floor(Math.random() * LEGENDARY_POWERS.length)].id : undefined,
    set: o.set,
    unique: o.unique,
  };
}

// ------------------------------------------------------------------ v3: affixes, sets, uniques

function affixPool(kind: 'weapon' | 'armor'): AffixDef[] {
  return AFFIXES.filter((a) => (kind === 'weapon' ? a.weapon : a.armor));
}

export function rollAffix(kind: 'weapon' | 'armor', tier: number, exclude: AffixKind[] = []): Affix {
  const pool = affixPool(kind).filter((a) => !exclude.includes(a.kind));
  const a = weighted(pool, (x) => x.w);
  const r = a.min + Math.random() * (a.max - a.min);
  const value = a.flat ? Math.max(1, Math.round(r * (1 + tier * 0.9))) : +(r * (1 + tier * 0.06)).toFixed(4);
  return { kind: a.kind, value };
}

export function rollAffixes(kind: 'weapon' | 'armor', tier: number, rarity: number): Affix[] {
  const out: Affix[] = [];
  const n = AFFIX_COUNT[rarity] ?? 0;
  for (let i = 0; i < n; i++) out.push(rollAffix(kind, tier, out.map((a) => a.kind)));
  return out;
}

export function affixLabel(a: Affix): string {
  const d = AFFIXES.find((x) => x.kind === a.kind);
  if (!d) return a.kind;
  return d.flat ? `+${a.value} ${d.label}` : `+${(a.value * 100).toFixed(a.value < 0.1 ? 1 : 0)}% ${d.label}`;
}

export function makeSetPiece(setId: string, pieceIdx: number, tier: number, rarity: Rarity, affixes = true): GearItem {
  const set = SET_BY_ID[setId];
  const piece = set.pieces[pieceIdx % set.pieces.length];
  const r = Math.max(3, rarity) as Rarity;
  return makeGear(piece.baseId, tier, r, { name: piece.name, colors: { ...set.colors }, set: set.id, statMult: 1.08, affixes });
}

export function randomSetPiece(tier: number, rarity: Rarity): GearItem {
  const set = SETS[Math.floor(Math.random() * SETS.length)];
  return makeSetPiece(set.id, Math.floor(Math.random() * set.pieces.length), tier, rarity);
}

export function makeUnique(uniqueId: string, tier: number, affixes = true): GearItem {
  const u = UNIQUE_BY_ID[uniqueId];
  const g = makeGear(u.baseId, tier, 4, { name: u.name, colors: { ...u.colors }, unique: u.id, statMult: 1.15, affixes: false });
  g.affixes = affixes ? rollAffixes(g.kind, g.tier, 3) : [];
  g.power = u.power;
  for (const k of Object.keys(u.stats) as (keyof StatBlock)[]) {
    const v = u.stats[k] ?? 0;
    g.base[k] = (g.base[k] ?? 0) + (FRACTIONAL.includes(k) ? v : Math.round(v * (1 + tier * 0.5)));
  }
  if (g.kind === 'weapon') {
    g.sockets = Math.max(g.sockets, 2);
    g.gems = new Array(g.sockets).fill(null);
  }
  return g;
}

export function randomUnique(tier: number): GearItem {
  return makeUnique(UNIQUES[Math.floor(Math.random() * UNIQUES.length)].id, tier);
}

/** Final stat contribution of a piece of gear, including rarity, craft grade and tempering. */
export function gearStats(g: GearItem): StatBlock {
  const out: StatBlock = {};
  const rm = RARITY_MULT[g.rarity];
  const gm = g.grade ? GRADE_INFO[g.grade].mult : 1;
  const tm = 1 + TEMPER_STEP * g.temper;
  for (const k of Object.keys(g.base) as (keyof StatBlock)[]) {
    const v = g.base[k] ?? 0;
    if (FRACTIONAL.includes(k)) out[k] = +(v * (v > 0 ? rm * gm : 1)).toFixed(4);
    else out[k] = Math.round(v * (v > 0 ? rm * gm * tm : 1));
  }
  for (const a of g.affixes ?? []) out[a.kind] = +((out[a.kind] ?? 0) + a.value * (FRACTIONAL.includes(a.kind) ? 1 : tm)).toFixed(4);
  return out;
}

export function gearValue(g: GearItem): number {
  const gm = g.grade ? GRADE_INFO[g.grade].mult : 1;
  return Math.round(Math.pow(g.tier + 1, 1.8) * 40 * RARITY_MULT[g.rarity] * RARITY_MULT[g.rarity] * gm * (1 + g.temper * 0.15));
}

export function gearTitle(g: GearItem): string {
  return (g.customName ?? g.name) + (g.temper > 0 ? ` +${g.temper}` : '');
}

export function isBlade(g: GearItem | null | undefined): boolean {
  return !!g && (g.wtype === 'sword' || g.wtype === 'twinblade');
}

export function isTwoHanded(g: GearItem | null | undefined): boolean {
  return !!g && (g.wtype === 'spear' || g.wtype === 'halberd' || g.wtype === 'bow' || g.wtype === 'staff');
}

export { LOOT_WEIGHTS };

export function rollRarity(source: number): Rarity {
  const w = LOOT_WEIGHTS[source];
  const idx = weighted([0, 1, 2, 3, 4, 5], (i) => w[i]);
  return idx as Rarity;
}

/** one random gear drop; the odds are documented by rarityOdds() / gearRollOdds() in data/loot.ts */
export function randomGear(level: number, source: number, magicFind = 0): GearItem {
  const tier = tierForLevel(level);
  const ids = GEAR_BASE_IDS;
  const baseId = ids[Math.floor(Math.random() * ids.length)];
  let rarity = rollRarity(source);
  if (magicFind > 0 && rarity < 4 && Math.random() < magicFind * MF_RARITY_UPGRADE) rarity = (rarity + 1) as Rarity;
  if (rarity === 5) return makeGear(baseId, 6, 5, { mythic: true });
  if (rarity >= 3 && Math.random() < SET_PIECE_CHANCE[source >= 1 ? 1 : 0]) return randomSetPiece(tier, rarity);
  return makeGear(baseId, tier, rarity);
}

export function starterKit(): { [k: string]: GearItem } {
  const leather: GearColors = { main: '#7a5235', accent: '#4a3020', trim: '#c9a46e', glow: '#ffe2a0' };
  return {
    sword: makeGear('w_sword', 0, 0, { name: 'Novice Longsword', statMult: 0.85 }),
    sword2: makeGear('w_twinblade', 0, 0, { name: 'Novice Twin Edge', statMult: 0.85 }),
    shield: makeGear('a_shield', 0, 0, { name: 'Novice Buckler', statMult: 0.85 }),
    spear: makeGear('w_spear', 0, 0, { name: 'Novice Spear', statMult: 0.85 }),
    bow: makeGear('w_bow', 0, 0, { name: 'Novice Longbow', statMult: 0.85 }),
    staff: makeGear('w_staff', 0, 0, { name: 'Novice Arcane Staff', statMult: 0.85 }),
    chest: makeGear('a_brig', 0, 0, { name: 'Novice Leather Brigandine', colors: leather, statMult: 0.8 }),
    boots: makeGear('a_boots', 0, 0, { name: 'Novice Leather Boots', colors: { ...leather, main: '#5a3a24' }, statMult: 0.8 }),
    cloak: makeGear('a_cloak', 0, 0, { name: 'Wayfarer Cloak', colors: { main: '#2f4a7a', accent: '#1c2c4a', trim: '#c9a46e', glow: '#cfe8ff' }, statMult: 0.8 }),
  };
}
