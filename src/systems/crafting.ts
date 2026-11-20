// Smelting, forging (with craft grades), tempering, gem socketing, salvaging, alchemy and cooking.
import type { CraftGrade, GearItem, GemType, Rarity } from '../types/game';
import { G } from '../core/state';
import { GRADE_INFO, MAX_TEMPER } from '../data/constants';
import { makeGear, itemDef } from '../data/items';
import { GRADE_RARITY, AUTO_FORGE_ODDS, FORGE_GUILD_QUALITY, FORGE_HOME_QUALITY, GRADE_THRESHOLDS, TEMPER_GUILD_PER_RANK, TEMPER_SET_BONUS, blueprintCost, salvageYield, socketCost, temperCost, type Recipe } from '../data/recipes';
import { hasPower } from './powers';
import { guildRank } from '../data/guilds';
import { addGear, addItem, gearFull, hasItems, isEquipped, removeGear, takeItems, countItem, removeItem } from './inventory';
import { checkAwakenings } from './progression';
import { effectiveSockets } from './stats';
import { audio } from '../engine/audio';

export function maxCraftable(r: Recipe): number {
  let n = 999;
  for (const [id, q] of r.ins) n = Math.min(n, Math.floor(countItem(id) / q));
  return n;
}

export function craftRecipe(r: Recipe, times: number): string | null {
  if (times < 1 || !hasItems(r.ins, times)) return 'Missing ingredients.';
  takeItems(r.ins, times);
  addItem(r.out, r.qty * times);
  G.save.counters.crafted += times;
  audio.play(r.station === 'smelt' ? 'anvil' : 'craft');
  G.ui.toast(`Created ${itemDef(r.out).name} x${r.qty * times}.`, 'loot');
  return null;
}

export function canForge(baseId: string, tier: number, mythic: boolean): string | null {
  const c = blueprintCost(baseId, tier, mythic);
  if (gearFull()) return 'Inventory full.';
  if (G.save.gold < c.gold) return `Need ${c.gold} G.`;
  if (!hasItems(c.ins)) return 'Missing materials.';
  return null;
}


/** hammer-gauge score: 3 strikes x 0..3 points */
export function gradeFromScore(score: number, quality: number): CraftGrade {
  const s = score * quality;
  if (s >= GRADE_THRESHOLDS.supreme) return 'supreme';
  if (s >= GRADE_THRESHOLDS.masterwork) return 'masterwork';
  if (s >= GRADE_THRESHOLDS.fine) return 'fine';
  return 'standard';
}

export function autoForgeGrade(): CraftGrade {
  const r = Math.random();
  return r < AUTO_FORGE_ODDS.standard ? 'standard' : r < AUTO_FORGE_ODDS.standard + AUTO_FORGE_ODDS.fine ? 'fine' : 'masterwork';
}

export function forgeQualityBonus(home: boolean): number {
  const s = G.save;
  let q = home ? FORGE_HOME_QUALITY : 1;
  if (s.joined.includes('anvil')) q += FORGE_GUILD_QUALITY * (guildRank(s.guilds.anvil) + 1);
  return q;
}

export function forge(baseId: string, tier: number, mythic: boolean, grade: CraftGrade, customName?: string): GearItem | string {
  const err = canForge(baseId, tier, mythic);
  if (err) return err;
  const c = blueprintCost(baseId, tier, mythic);
  takeItems(c.ins);
  G.save.gold -= c.gold;
  const g = makeGear(baseId, tier, mythic ? 5 : GRADE_RARITY[grade], { grade, mythic, forgedBy: G.save.name });
  if (grade === 'supreme' && customName && customName.trim()) g.customName = customName.trim().slice(0, 28);
  addGear(g);
  const s = G.save;
  s.counters.forged++;
  if (grade === 'masterwork' || grade === 'supreme') s.counters.masterworks++;
  checkAwakenings();
  audio.play('craft');
  return g;
}

export function temper(g: GearItem): { ok: boolean; msg: string } {
  if (g.temper >= MAX_TEMPER) return { ok: false, msg: 'Already tempered to +10.' };
  const c = temperCost(g);
  if (countItem(c.stone) < c.stones) return { ok: false, msg: `Need ${c.stones}x ${itemDef(c.stone).name}.` };
  if (G.save.gold < c.gold) return { ok: false, msg: `Need ${c.gold} G.` };
  removeItem(c.stone, c.stones);
  G.save.gold -= c.gold;
  if (Math.random() < c.chance + temperBonus()) {
    g.temper++;
    audio.play('anvil');
    if (isEquipped(g.uid)) G.player.refresh();
    return { ok: true, msg: `Success! ${g.customName ?? g.name} is now +${g.temper}.` };
  }
  audio.play('error');
  return { ok: false, msg: 'The tempering failed. Materials were consumed, but the item is unharmed.' };
}

/** tempering success bonus from the Gilded Anvil Syndicate and the Artisan's Pride set power */
export function temperBonus(): number {
  const s = G.save;
  return (s.joined.includes('anvil') ? TEMPER_GUILD_PER_RANK * (guildRank(s.guilds.anvil) + 1) : 0) + (hasPower('s6_anvil') ? TEMPER_SET_BONUS : 0);
}

export function socketGem(g: GearItem, slot: number, gem: GemType): string | null {
  const sockets = effectiveSockets(g, G.save.awakenings.includes('aw_smith'));
  if (slot >= sockets) return 'No socket there.';
  if (countItem('gem_' + gem) < 1) return 'You have no such gem.';
  const cost = socketCost(g);
  if (G.save.gold < cost) return `Socketing costs ${cost} G.`;
  while (g.gems.length < sockets) g.gems.push(null);
  const old = g.gems[slot];
  removeItem('gem_' + gem, 1);
  if (old) addItem('gem_' + old, 1);
  g.gems[slot] = gem;
  G.save.gold -= cost;
  audio.play('magic');
  if (isEquipped(g.uid)) G.player.refresh();
  return null;
}

export function unsocketGem(g: GearItem, slot: number): void {
  const old = g.gems[slot];
  if (!old) return;
  g.gems[slot] = null;
  addItem('gem_' + old, 1);
  audio.play('uiBack');
  if (isEquipped(g.uid)) G.player.refresh();
}

export function salvage(g: GearItem): string | null {
  if (isEquipped(g.uid)) return 'Unequip it first.';
  if (!removeGear(g.uid)) return 'Item not found.';
  const out = salvageYield(g);
  for (const [id, n] of out) addItem(id, n);
  for (const gem of g.gems) if (gem) addItem('gem_' + gem, 1);
  audio.play('anvil');
  G.ui.toast(`Salvaged into: ${out.map(([id, n]) => `${itemDef(id).name} x${n}`).join(', ')}`, 'loot');
  return null;
}

export function gradeLabel(g: CraftGrade): string {
  return GRADE_INFO[g].name;
}
