// Golden powers: legendary affixes, unique-weapon abilities, relic-codex powers and six-piece
// set bonuses. The player caches its active power ids on refresh(); combat calls these hooks.
import type { Actor } from '../entities/actor';
import type { HitOpts } from './combat';
import { G } from '../core/state';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { angTo, dist, rnd } from '../engine/util';
import { damage, hitTest, targetsOf } from './combat';
import { paintGauge } from './reactions';

const cds: Record<string, number> = {};
let spellCount = 0;

export function hasPower(id: string): boolean {
  return !!G.player?.powers?.has(id);
}

export function tickPowers(dt: number): void {
  for (const k in cds) if (cds[k] > 0) cds[k] -= dt;
}

function ready(id: string, cd: number): boolean {
  if ((cds[id] ?? 0) > 0) return false;
  cds[id] = cd;
  return true;
}

export function powerCooldown(id: string): number {
  return Math.max(0, cds[id] ?? 0);
}

function foesNear(x: number, y: number, r: number, except?: Actor): Actor[] {
  return G.world.targetsFor('player').filter((f) => f !== except && !f.dead && dist(f.x, f.y, x, y) <= r + f.radius);
}

/** a delayed draconic / phoenix meteor at (x, y) */
export function meteorStrike(src: Actor, x: number, y: number, mult: number, color = '#ff9a3d'): void {
  fx.ring(x, y, color, 70, 8, 0.5, 3);
  G.world.after(0.45, () => {
    fx.burst(x, y - 10, color, 30, 240);
    fx.ring(x, y, '#ffd166', 10, 100, 0.5, 6);
    fx.shake(5);
    audio.play('fire', 0.9);
    for (const f of foesNear(x, y, 95)) damage(src, f, { mult, element: 'fire', source: 'skill', isSkill: true, kb: 160, kbAngle: angTo(x, y, f.x, f.y), brk: 12 });
  });
}

// ------------------------------------------------------------------ offensive hooks

/** extra damage multiplier from powers (applied before defence) */
export function powerDamageBonus(p: Actor, t: Actor): number {
  let b = 1;
  const low = t.hp < t.stats.maxHp * 0.3;
  if (low && hasPower('p_executioner')) b *= 1.4;
  if (hasPower('s6_abyss') && p.hp < p.stats.maxHp * 0.5) b *= 1.3;
  return b;
}

/** called after a player-team hit lands on an enemy (never for reaction / reflect damage) */
export function onPlayerHit(src: Actor, t: Actor, dmg: number, crit: boolean, o: HitOpts): void {
  const p = G.player;
  if (src !== p) return;
  // lifesteal
  let ls = p.stats.lifesteal;
  if (hasPower('s6_abyss') && p.hp < p.stats.maxHp * 0.5) ls += 0.06;
  if (ls > 0 && dmg > 0) p.hp = Math.min(p.stats.maxHp, p.hp + dmg * ls);
  if (o.isSkill && hasPower('p_arcsurge')) p.mp = Math.min(p.stats.maxMp, p.mp + 2);
  if (crit && hasPower('p_storm') && ready('p_storm', 0.35) && !t.dead) {
    fx.bolt(t.x + rnd(-10, 10), t.y - 110, t.x, t.y - 16, '#ffe066');
    damage(p, t, { flat: dmg * 0.6, source: 'reflect', canBlock: false });
    paintGauge(p, t, 'shock', dmg);
  }
  if (crit && hasPower('u_rimecrest') && ready('u_rimecrest', 0.5)) {
    fx.ring(t.x, t.y, '#bff3ff', 6, 80, 0.35, 4);
    fx.shatter(t.x, t.y - 14, ['#bff3ff', '#7fe9ff'], 0.4);
    for (const f of foesNear(t.x, t.y, 80)) {
      damage(p, f, { flat: dmg * 0.6, source: 'reflect', canBlock: false });
      paintGauge(p, f, 'frost', dmg);
    }
    audio.play('ice', 0.6);
  }
  if (t.dead) return;
  if (crit && hasPower('s6_frost')) paintGauge(p, t, 'frost', dmg);
  if (hasPower('s6_pyre')) paintGauge(p, t, 'burn', dmg);
  if (o.isSkill && hasPower('s6_aether')) paintGauge(p, t, 'aether', dmg);
  if (o.source === 'proj' && p.mode === 'bow' && hasPower('u_phoenix')) {
    t.addStatus({ kind: 'burn', dur: 3 });
    paintGauge(p, t, 'burn', dmg);
  }
  if (o.isSkill && o.magic && hasPower('u_aetherion') && ready('u_aetherion_arc', 0.15)) {
    const extra = foesNear(t.x, t.y, 180, t).slice(0, 2);
    for (const f of extra) {
      fx.bolt(t.x, t.y - 20, f.x, f.y - 20, '#c18cff');
      damage(p, f, { flat: dmg * 0.4, source: 'reflect', canBlock: false });
    }
  }
}

/** phoenix fire when a burning enemy dies */
export function onEnemyKilled(t: Actor): void {
  if (hasPower('u_phoenix') && t.has('burn')) {
    fx.burst(t.x, t.y - 20, '#ff6a3d', 26, 220);
    fx.ring(t.x, t.y, '#ffd166', 8, 90, 0.4, 5);
    for (const f of foesNear(t.x, t.y, 90, t)) {
      damage(G.player, f, { mult: 1.2, element: 'fire', source: 'skill', isSkill: true, kb: 120 });
      f.addStatus({ kind: 'burn', dur: 3 });
    }
  }
}

/** Spell cost modifiers: Arcane Overflow keystone, Archmage set, Aetherion's free 5th spell */
export function skillMpMult(isMagic: boolean): number {
  let m = 1;
  if (G.save.keystones.includes('ks_magic')) m *= 0.85;
  if (hasPower('s6_aether')) m *= 0.7;
  if (isMagic && hasPower('u_aetherion')) {
    spellCount++;
    if (spellCount % 5 === 0) {
      fx.number(G.player.x, G.player.y - 60, 'FREE CAST', '#c18cff', 14);
      return 0;
    }
  }
  return m;
}

export function onWallSlamPower(a: Actor): void {
  if (hasPower('u_dragonbone') && ready('u_dragonbone', 1.2)) meteorStrike(G.player, a.x, a.y, 2.0);
}

export function onBreakPower(t: Actor): void {
  if (t.team === 'enemy' && hasPower('u_dragonbone') && ready('u_dragonbone_brk', 1.2)) meteorStrike(G.player, t.x, t.y, 2.0);
}

// ------------------------------------------------------------------ defensive hooks

export function onPlayerHurt(src: Actor | null, dmg: number): void {
  const p = G.player;
  if (src && !src.dead && hasPower('p_thorns') && dist(src.x, src.y, p.x, p.y) < 120) damage(p, src, { flat: dmg * 0.2, source: 'reflect', canBlock: false });
  if (!p.dead && p.hp > 0 && p.hp < p.stats.maxHp * 0.3 && hasPower('p_second_wind') && ready('p_second_wind', 90)) {
    p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.25);
    fx.number(p.x, p.y - 60, 'SECOND WIND', '#5ee6a0', 16);
    fx.heal(p.x, p.y);
    audio.play('heal');
  }
}

/** Phoenix Longbow: once per 120s lethal damage revives instead */
export function tryPhoenixRevive(): boolean {
  const p = G.player;
  if (!hasPower('u_phoenix') || !ready('u_phoenix_rebirth', 120)) return false;
  p.hp = p.stats.maxHp * 0.4;
  p.iframes = 2;
  fx.banner('PHOENIX REBIRTH', '#ff6a3d', 'The Phoenix Longbow refuses to let you fall', 48, 1.4);
  fx.burst(p.x, p.y - 20, '#ff6a3d', 40, 260);
  fx.ring(p.x, p.y, '#ffd166', 10, 140, 0.6, 6);
  audio.play('awaken');
  for (const f of foesNear(p.x, p.y, 120)) damage(p, f, { mult: 2, element: 'fire', source: 'skill', isSkill: true, kb: 220 });
  return true;
}

export function onParryPowers(): void {
  const p = G.player;
  if (hasPower('s6_ivory')) {
    p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.1);
    fx.heal(p.x, p.y);
  }
  if (hasPower('u_ivory_verdict')) {
    p.barrier = Math.max(p.barrier, p.stats.maxHp * 0.25);
    p.barrierT = 8;
    const shape = { kind: 'line' as const, x: p.x, y: p.y, a: p.aim, len: 360, w: 46 };
    fx.ribbon(p.x, p.y, p.aim, { a0: 0, a1: 0, style: 'thrust', len: 360, w: 26 }, '#ffd27a', '#ffffff');
    fx.banner('DIVINE JUDGMENT', '#ffd27a', '', 40, 0.9);
    audio.play('beam');
    for (const f of targetsOf(p)) if (!f.dead && hitTest(shape, f.x, f.y, f.radius)) damage(p, f, { mult: 2.5, element: 'holy', isSkill: true, source: 'skill', forceCrit: true, brk: 30, kbAngle: p.aim, kb: 200 });
  }
}

export function onBlockPowers(): void {
  const p = G.player;
  if (hasPower('s6_ivory') && ready('s6_ivory_block', 0.4)) p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.02);
}

export function onDodgePowers(ang: number): void {
  const p = G.player;
  if (hasPower('p_featherstep')) {
    p.sta = Math.min(p.stats.maxSta, p.sta + 8);
    p.addBuff({ id: 'featherstep', name: 'Featherstep', dur: 1.2, color: '#bff3ff', stats: { move: 0.3 } });
    p.refresh();
  }
  if (hasPower('u_dawnspark') && ready('u_dawnspark', 0.6)) {
    const back = ang + Math.PI;
    const shape = { kind: 'line' as const, x: p.x, y: p.y, a: back, len: 150, w: 34 };
    fx.ribbon(p.x, p.y, back, { a0: 0, a1: 0, style: 'thrust', len: 150, w: 16 }, '#fff1a8', '#ffffff');
    for (const f of targetsOf(p)) if (!f.dead && hitTest(shape, f.x, f.y, f.radius)) damage(p, f, { mult: 1.2, element: 'holy', isSkill: true, source: 'skill', brk: 8 });
  }
  if (hasPower('s6_sylvan') && ready('s6_sylvan', 0.8)) {
    for (let i = -1; i <= 1; i++) G.world.spawnProjectile(p, { kind: 'feather', speed: 520, mult: 0.5, range: 420, homing: 3.5, element: 'wind', color: '#57e389', brk: 3 }, p.aim + i * 0.35, p.x, p.y, 'bow');
    audio.play('arrow', 0.6);
  }
}
