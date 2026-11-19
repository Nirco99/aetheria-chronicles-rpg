// Inventory, equipment and consumable use.
import type { EquipSlot, GearItem } from '../types/game';
import { G } from '../core/state';
import { GEAR_CAPACITY } from '../data/constants';
import { itemDef, isBlade, isTwoHanded } from '../data/items';
import { audio } from '../engine/audio';
import { fx, NUM_COLORS } from '../render/fx';

export function countItem(id: string): number {
  return G.save.items[id] ?? 0;
}

export function addItem(id: string, qty = 1): void {
  if (qty <= 0) return;
  G.save.items[id] = (G.save.items[id] ?? 0) + qty;
}

export function removeItem(id: string, qty = 1): boolean {
  const have = G.save.items[id] ?? 0;
  if (have < qty) return false;
  if (have - qty <= 0) delete G.save.items[id];
  else G.save.items[id] = have - qty;
  return true;
}

export function hasItems(list: [string, number][], mult = 1): boolean {
  return list.every(([id, n]) => countItem(id) >= n * mult);
}

export function takeItems(list: [string, number][], mult = 1): boolean {
  if (!hasItems(list, mult)) return false;
  for (const [id, n] of list) removeItem(id, n * mult);
  return true;
}

export function gearFull(): boolean {
  return G.save.gear.length >= GEAR_CAPACITY;
}

export function addGear(g: GearItem): boolean {
  if (gearFull()) return false;
  G.save.gear.push(g);
  return true;
}

export function removeGear(uid: string): GearItem | null {
  const i = G.save.gear.findIndex((g) => g.uid === uid);
  if (i < 0) return null;
  return G.save.gear.splice(i, 1)[0];
}

export function setSlots(): [EquipSlot, EquipSlot] {
  return G.save.activeSet === 'A' ? ['mainA', 'offA'] : ['mainB', 'offB'];
}

/** equips a piece of gear from the inventory; returns an error message or null */
export function equipGear(g: GearItem, target: 'main' | 'off' = 'main', set?: 'A' | 'B'): string | null {
  const s = G.save;
  const [ms, os]: [EquipSlot, EquipSlot] = (set ?? s.activeSet) === 'A' ? ['mainA', 'offA'] : ['mainB', 'offB'];
  let slot: EquipSlot;
  if (g.kind === 'weapon') {
    if (target === 'off') {
      if (!isBlade(g)) return 'Only Longswords and Twin Edges can be held in the off hand.';
      if (isTwoHanded(s.equip[ms])) return 'Your main-hand weapon needs both hands.';
      slot = os;
    } else {
      slot = ms;
      if (isTwoHanded(g) && s.equip[os]) {
        const off = s.equip[os] as GearItem;
        if (gearFull()) return 'Inventory full - cannot free your off hand.';
        s.equip[os] = null;
        s.gear.push(off);
      }
    }
  } else if (g.aslot === 'shield') {
    if (isTwoHanded(s.equip[ms])) return 'Your main-hand weapon needs both hands.';
    slot = os;
  } else slot = g.aslot as EquipSlot;
  removeGear(g.uid);
  const old = s.equip[slot];
  s.equip[slot] = g;
  if (old) s.gear.push(old);
  audio.play('ui');
  G.player.refresh();
  return null;
}

export function unequip(slot: EquipSlot): string | null {
  const s = G.save;
  const g = s.equip[slot];
  if (!g) return null;
  if (gearFull()) return 'Inventory full.';
  s.equip[slot] = null;
  s.gear.push(g);
  audio.play('uiBack');
  G.player.refresh();
  return null;
}

export function isEquipped(uid: string): boolean {
  return Object.values(G.save.equip).some((g) => g && g.uid === uid);
}

export function useConsumable(id: string): boolean {
  const d = itemDef(id);
  if (!d.effect || countItem(id) < 1) return false;
  const p = G.player;
  if (p.dead) return false;
  const e = d.effect;
  if (e.heal) {
    const amt = Math.round(p.stats.maxHp * e.heal);
    p.hp = Math.min(p.stats.maxHp, p.hp + amt);
    fx.number(p.x, p.y - 34, '+' + amt, NUM_COLORS.heal, 15);
    fx.heal(p.x, p.y);
  }
  if (e.mana) {
    const amt = Math.round(p.stats.maxMp * e.mana);
    p.mp = Math.min(p.stats.maxMp, p.mp + amt);
    fx.number(p.x + 10, p.y - 30, '+' + amt + ' MP', '#7fb4ff', 13);
  }
  if (e.sta) p.sta = p.stats.maxSta;
  if (e.cleanse) p.clearDebuffs();
  if (e.buff) {
    p.addBuff(e.buff);
    p.refresh();
    G.ui.toast(`${e.buff.name} active for ${Math.round(e.buff.dur / 60)} min`, 'buff');
  }
  removeItem(id, 1);
  audio.play(d.cat === 'food' || e.buff ? 'buff' : 'heal');
  return true;
}
