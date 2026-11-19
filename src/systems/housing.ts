// Player housing: purchases, the grid decorator, furniture interactions, display mounts and sleep.
import type { FurnitureKind, GearItem, HouseSave } from '../types/game';
import { G } from '../core/state';
import { REALMS } from '../data/realms';
import { FURNITURE, itemDef } from '../data/items';
import { TILE } from '../data/constants';
import { genHouse } from '../world/mapgen';
import { addGear, addItem, countItem, removeItem, gearFull } from './inventory';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';

export function ownsHouse(realm: number): boolean {
  return !!G.save.houses[realm]?.owned;
}

export function buyHouse(realm: number): string | null {
  const s = G.save;
  if (ownsHouse(realm)) return 'You already own this house.';
  const price = REALMS[realm].house.price;
  if (s.gold < price) return `You need ${price.toLocaleString()} G.`;
  s.gold -= price;
  s.houses[realm] = { owned: true, furniture: [] };
  audio.play('coin');
  G.ui.toast(`You bought the ${REALMS[realm].house.name}! Enter it from its front door. Press B inside to decorate.`, 'loot');
  return null;
}

export function currentHouse(): HouseSave | null {
  const m = G.world.map;
  if (m.kind !== 'house') return null;
  return G.save.houses[m.realm] ?? null;
}

export function canPlace(kind: FurnitureKind, tx: number, ty: number): boolean {
  const m = G.world.map;
  if (m.kind !== 'house') return false;
  const fd = FURNITURE[kind];
  const door = Math.floor(m.w / 2);
  const p = G.player;
  for (let y = ty; y < ty + fd.h; y++) {
    for (let x = tx; x < tx + fd.w; x++) {
      if (x < 1 || y < 2 || x > m.w - 2 || y > m.h - 2) return false;
      if (!m.walkable(x, y) && !(kind === 'rug')) return false;
      if (kind === 'rug' && m.sol(x, y) !== 0) return false;
      if (x === door && y >= m.h - 3) return false;
      if (!fd.walkable && Math.abs(p.x - (x + 0.5) * TILE) < TILE * 0.9 && Math.abs(p.y - (y + 0.5) * TILE) < TILE * 0.9) return false;
    }
  }
  const house = currentHouse();
  if (house && kind === 'rug') {
    for (const f of house.furniture) {
      if (f.kind !== 'rug') continue;
      const o = FURNITURE.rug;
      if (tx < f.tx + o.w && tx + fd.w > f.tx && ty < f.ty + o.h && ty + fd.h > f.ty) return false;
    }
  }
  return true;
}

function rebuild(): void {
  const m = G.world.map;
  const house = currentHouse();
  if (!house) return;
  G.world.replaceMap(genHouse(m.realm, house));
}

export function placeFurniture(itemId: string, tx: number, ty: number): boolean {
  const house = currentHouse();
  const d = itemDef(itemId);
  if (!house || !d.furniture || countItem(itemId) < 1 || !canPlace(d.furniture, tx, ty)) return false;
  removeItem(itemId, 1);
  house.furniture.push({ item: itemId, kind: d.furniture, tx, ty, mounts: new Array(FURNITURE[d.furniture].mounts).fill(null) });
  rebuild();
  audio.play('craft');
  fx.dust((tx + FURNITURE[d.furniture].w / 2) * TILE, (ty + FURNITURE[d.furniture].h) * TILE, 8);
  return true;
}

export function furnitureAt(tx: number, ty: number): number {
  const house = currentHouse();
  if (!house) return -1;
  for (let i = house.furniture.length - 1; i >= 0; i--) {
    const f = house.furniture[i];
    const fd = FURNITURE[f.kind];
    if (tx >= f.tx && tx < f.tx + fd.w && ty >= f.ty && ty < f.ty + fd.h) return i;
  }
  return -1;
}

export function removeFurniture(index: number): string | null {
  const house = currentHouse();
  if (!house || !house.furniture[index]) return null;
  const f = house.furniture[index];
  const mounted = f.mounts.filter((g): g is GearItem => !!g);
  if (G.save.gear.length + mounted.length > 120) return 'Not enough inventory space for the mounted gear.';
  for (const g of mounted) addGear(g);
  addItem(f.item, 1);
  house.furniture.splice(index, 1);
  rebuild();
  audio.play('uiBack');
  return null;
}

export function mountGear(index: number, slot: number, g: GearItem): string | null {
  const house = currentHouse();
  const f = house?.furniture[index];
  if (!f) return 'Nothing to mount on.';
  if (f.kind === 'rack' && g.kind !== 'weapon') return 'Weapon racks only hold weapons.';
  if (f.kind === 'mannequin') {
    const want = ['head', 'chest', 'boots', 'cloak', 'shield'][slot];
    if (g.aslot !== want) return `That slot holds a ${want}.`;
  }
  const i = G.save.gear.findIndex((x) => x.uid === g.uid);
  if (i < 0) return 'Item not in your inventory.';
  G.save.gear.splice(i, 1);
  const old = f.mounts[slot];
  f.mounts[slot] = g;
  if (old) G.save.gear.push(old);
  audio.play('ui');
  return null;
}

export function unmountGear(index: number, slot: number): string | null {
  const house = currentHouse();
  const f = house?.furniture[index];
  if (!f || !f.mounts[slot]) return null;
  if (gearFull()) return 'Inventory full.';
  G.save.gear.push(f.mounts[slot] as GearItem);
  f.mounts[slot] = null;
  audio.play('uiBack');
  return null;
}

export function useFurniture(index: number): void {
  const house = currentHouse();
  const f = house?.furniture[index];
  if (!f) return;
  switch (f.kind) {
    case 'vault':
      G.ui.openVault();
      break;
    case 'anvil':
      G.ui.openForge(true);
      break;
    case 'alchemy':
      G.ui.openCraft('alchemy');
      break;
    case 'hearth':
      G.ui.openCraft('cooking');
      break;
    case 'bed':
      sleep();
      break;
    case 'rack':
    case 'mannequin':
      G.ui.openMount(index);
      break;
    case 'trophy':
      G.ui.toast(`${itemDef(f.item).name} - a monument to your victory.`, 'info');
      break;
    case 'bookshelf':
      G.ui.openHandbook();
      break;
    default:
      G.ui.toast(itemDef(f.item).desc, 'info');
  }
}

export function sleep(): void {
  const s = G.save;
  const p = G.player;
  G.game.fadeFlash();
  if (s.time >= 7) s.day++;
  s.time = 7;
  p.hp = p.stats.maxHp;
  p.mp = p.stats.maxMp;
  p.addBuff({ id: 'rested', name: 'Well Rested', dur: 1800, color: '#ffd166' });
  p.refresh();
  audio.play('heal');
  G.ui.toast('You slept until 07:00 and woke up Well Rested: +20% XP for 30 minutes.', 'buff');
}
