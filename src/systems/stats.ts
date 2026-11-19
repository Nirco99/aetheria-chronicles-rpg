// Derived stat calculation for the player and companions.
import type { BuffInst, Branch, GearItem, SaveData, StatBlock, Stats, CompanionSave } from '../types/game';
import { emptyStats } from '../entities/actor';
import { gearStats, isBlade } from '../data/items';
import { GEM_INFO } from '../data/constants';
import { PASSIVE_SKILLS } from '../data/skills';
import { GUILDS, GUILD_IDS, guildRank } from '../data/guilds';

export type WeaponMode = 'sword' | 'dual' | 'spear' | 'halberd' | 'bow' | 'staff' | 'fists';

export function weaponMode(main: GearItem | null, off: GearItem | null): WeaponMode {
  if (!main) return 'fists';
  if (main.wtype === 'sword' || main.wtype === 'twinblade') return isBlade(off) ? 'dual' : 'sword';
  if (main.wtype === 'spear') return 'spear';
  if (main.wtype === 'halberd') return 'halberd';
  if (main.wtype === 'bow') return 'bow';
  if (main.wtype === 'staff') return 'staff';
  return 'fists';
}

export function setBranches(main: GearItem | null, off: GearItem | null): Set<Branch> {
  const s = new Set<Branch>();
  if (isBlade(main)) {
    s.add('sword');
    if (isBlade(off)) s.add('dual');
  }
  if (off && off.aslot === 'shield') s.add('shield');
  if (main && (main.wtype === 'spear' || main.wtype === 'halberd')) s.add('spear');
  if (main && main.wtype === 'bow') s.add('bow');
  if (main && main.wtype === 'staff') s.add('magic');
  return s;
}

/** branch credited with mastery XP for a basic attack in this weapon mode */
export function modeBranch(mode: WeaponMode, hasShield: boolean): Branch | null {
  switch (mode) {
    case 'sword':
      return hasShield && Math.random() < 0.3 ? 'shield' : 'sword';
    case 'dual':
      return 'dual';
    case 'spear':
    case 'halberd':
      return 'spear';
    case 'bow':
      return 'bow';
    case 'staff':
      return 'magic';
    default:
      return null;
  }
}

interface Acc {
  atk: number; def: number; mag: number; hp: number; mp: number; crit: number; critDmg: number; aspd: number; move: number;
  brk: number; block: number; regen: number; atkPct: number; defPct: number; magPct: number; hpPct: number; xpPct: number;
}

function acc(): Acc {
  return { atk: 0, def: 0, mag: 0, hp: 0, mp: 0, crit: 0, critDmg: 0, aspd: 0, move: 0, brk: 0, block: 0, regen: 0, atkPct: 0, defPct: 0, magPct: 0, hpPct: 0, xpPct: 0 };
}

function add(a: Acc, s: StatBlock | undefined): void {
  if (!s) return;
  for (const k of Object.keys(s) as (keyof StatBlock)[]) a[k] += s[k] ?? 0;
}

function finish(level: number, a: Acc, mult = 1): Stats {
  const st = emptyStats();
  st.maxHp = Math.round((120 + 22 * (level - 1) + a.hp) * (1 + a.hpPct) * mult);
  st.maxMp = Math.round(60 + 6 * (level - 1) + a.mp);
  st.maxSta = 100;
  st.atk = (10 + 2.2 * (level - 1) + a.atk) * (1 + a.atkPct) * mult;
  st.def = (4 + 1.2 * (level - 1) + a.def) * (1 + a.defPct);
  st.mag = (8 + 2 * (level - 1) + a.mag) * (1 + a.magPct) * mult;
  st.crit = Math.min(0.75, 0.05 + a.crit);
  st.critDmg = 1.5 + a.critDmg;
  st.aspd = Math.max(0.5, 1 + a.aspd);
  st.move = Math.max(0.5, 1 + a.move);
  st.brk = a.brk;
  st.block = Math.min(0.2, a.block);
  st.mpRegen = 1 + a.regen;
  st.xpMult = 1 + a.xpPct;
  return st;
}

function gemBonus(st: Stats, g: GearItem | null, a: Acc, smithSoul: boolean): void {
  if (!g || g.kind !== 'weapon') return;
  const sockets = effectiveSockets(g, smithSoul);
  for (let i = 0; i < Math.min(sockets, g.gems.length); i++) {
    const gem = g.gems[i];
    if (!gem) continue;
    const el = GEM_INFO[gem].element;
    st.elem[el] = (st.elem[el] ?? 0) + 0.1;
    if (gem === 'wind') a.aspd += 0.06;
  }
}

export function effectiveSockets(g: GearItem, smithSoul: boolean): number {
  if (g.kind !== 'weapon') return 0;
  if (smithSoul && g.forgedBy) return Math.max(2, g.sockets);
  return g.sockets;
}

export function activeSet(save: SaveData): { main: GearItem | null; off: GearItem | null } {
  return save.activeSet === 'A' ? { main: save.equip.mainA, off: save.equip.offA } : { main: save.equip.mainB, off: save.equip.offB };
}

export function playerStats(save: SaveData, buffs: BuffInst[]): Stats {
  const a = acc();
  const { main, off } = activeSet(save);
  const branches = setBranches(main, off);
  for (const g of [main, off, save.equip.head, save.equip.chest, save.equip.boots, save.equip.cloak]) if (g) add(a, gearStats(g));
  for (const p of PASSIVE_SKILLS) {
    const lvl = save.passives[p.id] ?? 0;
    if (lvl > 0 && p.stats && branches.has(p.branch)) add(a, p.stats(lvl));
  }
  for (const gid of GUILD_IDS) if (save.joined.includes(gid)) add(a, GUILDS[gid].perkStats(guildRank(save.guilds[gid]) + 1));
  for (const b of buffs) add(a, b.spec.stats);
  if (save.awakenings.includes('aw_dual')) a.aspd += 0.2;
  if (buffs.some((b) => b.spec.id === 'rested')) a.xpPct += 0.2;
  const smith = save.awakenings.includes('aw_smith');
  const st0 = emptyStats();
  gemBonus(st0, main, a, smith);
  if (off && off.kind === 'weapon') gemBonus(st0, off, a, smith);
  const st = finish(save.level, a);
  st.elem = st0.elem;
  for (const b of buffs) if (b.spec.oil) st.elem[b.spec.oil] = (st.elem[b.spec.oil] ?? 0) + 0.15;
  return st;
}

export function companionStats(level: number, cs: CompanionSave, buffs: BuffInst[]): Stats {
  const a = acc();
  for (const g of Object.values(cs.equip)) if (g) add(a, gearStats(g));
  for (const b of buffs) add(a, b.spec.stats);
  const st0 = emptyStats();
  gemBonus(st0, cs.equip.main, a, false);
  const st = finish(level, a, 0.92);
  st.elem = st0.elem;
  return st;
}

/** primary gem colour of a weapon (tints aura and ribbons) */
export function gemColor(g: GearItem | null): string | null {
  if (!g || g.kind !== 'weapon') return null;
  for (const gem of g.gems) if (gem) return GEM_INFO[gem].color;
  return null;
}
