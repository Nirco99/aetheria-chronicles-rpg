// Weapon-specific basic attack combos shared by the player and companions.
import type { Branch } from '../types/game';
import type { Actor } from '../entities/actor';
import type { WeaponMode } from './stats';
import { G } from '../core/state';
import { WEAPON_INFO } from '../data/constants';
import { damage, hitTest, targetsOf } from './combat';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';

export interface ComboHit {
  shape: 'arc' | 'line';
  arc: number;
  a0: number;
  a1: number;
  mult: number;
  kb: number;
  dur: number;
  brk: number;
  hand: 0 | 1;
  extra: number;
}

const h = (o: Partial<ComboHit>): ComboHit => ({ shape: 'arc', arc: 1.9, a0: -1, a1: 1, mult: 1, kb: 50, dur: 0.34, brk: 3, hand: 0, extra: 0, ...o });

export const COMBOS: Record<WeaponMode, ComboHit[]> = {
  sword: [h({ a0: -1.05, a1: 1.05 }), h({ a0: 1.05, a1: -1.05 }), h({ arc: 2.5, a0: -1.3, a1: 1.3, mult: 1.45, kb: 140, dur: 0.46, brk: 6, extra: 6 })],
  dual: [
    h({ a0: -1.0, a1: 0.9, mult: 0.75, dur: 0.24, hand: 0 }),
    h({ a0: 1.0, a1: -0.9, mult: 0.75, dur: 0.24, hand: 1 }),
    h({ a0: -1.2, a1: 1.0, mult: 0.8, dur: 0.24, hand: 0 }),
    h({ arc: 2.4, a0: 1.3, a1: -1.3, mult: 1.15, kb: 120, dur: 0.36, hand: 1, brk: 5 }),
  ],
  spear: [h({ shape: 'line', arc: 26, mult: 1.1, dur: 0.38 }), h({ shape: 'line', arc: 26, mult: 1.1, dur: 0.38 }), h({ shape: 'line', arc: 32, mult: 1.5, kb: 140, dur: 0.48, extra: 16, brk: 6 })],
  halberd: [h({ arc: 2.6, a0: -1.4, a1: 1.4, mult: 1.35, dur: 0.56, kb: 100, brk: 6 }), h({ arc: 2.6, a0: 1.4, a1: -1.4, mult: 1.75, dur: 0.66, kb: 180, brk: 9 })],
  bow: [h({ dur: 0.42 })],
  staff: [h({ dur: 0.5 })],
  fists: [h({ arc: 1.3, a0: -0.5, a1: 0.5, mult: 0.55, dur: 0.3 }), h({ arc: 1.3, a0: 0.5, a1: -0.5, mult: 0.55, dur: 0.3 })],
};

export function reachOf(mode: WeaponMode, bonus = 0): number {
  const base = mode === 'fists' ? 36 : mode === 'dual' ? WEAPON_INFO.twinblade.reach : WEAPON_INFO[mode].reach;
  return base * (1 + bonus);
}

/** resolves one basic attack hit; returns number of enemies struck */
export function basicHit(a: Actor, mode: WeaponMode, idx: number, aim: number, branch: Branch | null, color: string, reachBonus: number, multScale = 1, forceCrit = false): number {
  // the player's hitboxes are 15% wider than the ribbon on screen (asymmetric, forgiving)
  const wide = a.kind === 'player' ? 1.15 : 1;
  if (mode === 'bow') {
    G.world.spawnProjectile(a, { kind: 'arrow', speed: 780, mult: 1.0 * multScale, range: 560, brk: 4, color, pierce: forceCrit }, aim, a.x, a.y, branch);
    audio.play('arrow', a.kind === 'player' ? 1 : 0.5);
    return 0;
  }
  if (mode === 'staff') {
    G.world.spawnProjectile(a, { kind: 'bolt', speed: 520, mult: 1.0 * multScale, range: 500, magic: true, homing: 2.6, brk: 4, color }, aim, a.x, a.y, branch);
    audio.play('magic', a.kind === 'player' ? 0.5 : 0.3);
    return 0;
  }
  const c = COMBOS[mode][idx % COMBOS[mode].length];
  const reach = reachOf(mode, reachBonus) + c.extra;
  const brkBase = mode === 'fists' ? 1 : mode === 'dual' ? WEAPON_INFO.twinblade.brk : WEAPON_INFO[mode].brk;
  let n = 0;
  if (c.shape === 'line') {
    const shape = { kind: 'line' as const, x: a.x, y: a.y, a: aim, len: reach, w: c.arc * wide };
    fx.ribbon(a.x, a.y, aim, { a0: 0, a1: 0, style: 'thrust', len: reach, w: 9 }, color, '#ffffff');
    for (const t of targetsOf(a)) {
      if (t.dead || !hitTest(shape, t.x, t.y, t.radius)) continue;
      damage(a, t, { mult: c.mult * multScale, brk: c.brk + brkBase, kb: c.kb, kbAngle: aim, source: 'basic', branch, forceCrit });
      n++;
    }
  } else {
    const shape = { kind: 'cone' as const, x: a.x, y: a.y, a: aim, arc: Math.max(c.arc, Math.abs(c.a1 - c.a0)) * wide, r: reach };
    fx.ribbon(a.x, a.y, aim, { a0: c.a0, a1: c.a1, r: reach * 0.82, w: mode === 'halberd' ? 13 : 10 }, color, '#ffffff');
    for (const t of targetsOf(a)) {
      if (t.dead || !hitTest(shape, t.x, t.y, t.radius)) continue;
      damage(a, t, { mult: c.mult * multScale, brk: c.brk + brkBase, kb: c.kb, source: 'basic', branch, forceCrit });
      n++;
    }
  }
  return n;
}
