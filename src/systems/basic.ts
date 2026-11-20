// Weapon-specific basic attack combos shared by the player and companions.
import type { Branch } from '../types/game';
import type { Actor } from '../entities/actor';
import type { WeaponMode } from './stats';
import { G } from '../core/state';
import { WEAPON_INFO } from '../data/constants';
import { damage, hitTest, targetsOf } from './combat';
import { fx } from '../render/fx';
import { COMBOS } from '../data/framedata';
import { audio } from '../engine/audio';

export { COMBOS, type ComboHit } from '../data/framedata';

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
