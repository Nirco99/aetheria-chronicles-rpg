// Elemental reaction matrix. Hits paint reaction gauges (Burn, Frost, Shock, Bleed, Venom,
// Aether) on enemies; painting a second gauge detonates a reaction:
// MELT, SHATTER, OVERLOAD, SUPERCONDUCT, TEMPEST SPREAD and AETHER SINGULARITY.
import type { Element, GaugeKind, ReactionKind } from '../types/game';
import type { Actor } from '../entities/actor';
import { G } from '../core/state';
import { ELEMENT_GAUGE, GAUGE_COLORS, GAUGE_DUR, REACTION_BY_ID, REACTION_RULES as RX } from '../data/v3';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { angTo, dist } from '../engine/util';
import { applyBreak, damage } from './combat';
import { hasPower } from './powers';
import { style } from './feel';

export function gaugeOf(el: Element | undefined): GaugeKind | null {
  if (!el || el === 'none') return null;
  return ELEMENT_GAUGE[el] ?? null;
}

const PAIRS: [GaugeKind, GaugeKind, ReactionKind][] = [
  ['burn', 'frost', 'melt'],
  ['frost', 'bleed', 'shatter'],
  ['burn', 'shock', 'overload'],
  ['frost', 'shock', 'superconduct'],
];

function findReaction(t: Actor, g: GaugeKind): { kind: ReactionKind; other: GaugeKind } | null {
  const has = (k: GaugeKind) => (t.gauges[k] ?? 0) > 0;
  for (const [a, b, kind] of PAIRS) {
    if (g === a && has(b)) return { kind, other: b };
    if (g === b && has(a)) return { kind, other: a };
  }
  if (g === 'venom') {
    for (const k of Object.keys(t.gauges) as GaugeKind[]) if (k !== 'venom' && has(k)) return { kind: 'tempest', other: k };
  } else if (has('venom')) return { kind: 'tempest', other: 'venom' };
  if (g === 'aether') {
    for (const k of Object.keys(t.gauges) as GaugeKind[]) if (k !== 'aether' && has(k)) return { kind: 'singularity', other: k };
  } else if (has('aether')) return { kind: 'singularity', other: 'aether' };
  return null;
}

/** paints a gauge on t (player-team hits only) and resolves any reaction it causes */
export function paintGauge(src: Actor | null, t: Actor, g: GaugeKind, hitDmg: number): void {
  if (t.dead || t.team !== 'enemy' || t.kind === 'prop') return;
  const r = findReaction(t, g);
  if (!r) {
    t.gauges[g] = GAUGE_DUR;
    return;
  }
  delete t.gauges[g];
  delete t.gauges[r.other];
  trigger(src, t, r.kind, Math.max(1, hitDmg));
}

function trigger(src: Actor | null, t: Actor, kind: ReactionKind, dmg: number): void {
  const def = REACTION_BY_ID[kind];
  const s = G.save;
  fx.number(t.x, t.y - 70, def.name + '!', def.color, 21);
  fx.ring(t.x, t.y, def.color, 8, 90, 0.4, 5);
  s.counters.reactions++;
  if (!s.reactionsSeen.includes(kind)) {
    s.reactionsSeen.push(kind);
    G.ui.toast(`New elemental reaction discovered: ${def.name} - ${def.desc}`, 'loot');
  }
  style.add(70, def.name);
  const foes = G.world.targetsFor('player');
  const near = (r: number) => foes.filter((f) => f !== t && !f.dead && f.kind !== 'prop' && dist(f.x, f.y, t.x, t.y) <= r + f.radius);
  switch (kind) {
    case 'melt': {
      const bonus = hasPower('s6_pyre') ? RX.melt.setBonus : 1;
      damage(src, t, { flat: dmg * RX.melt.burst * bonus, source: 'reflect', canBlock: false });
      fx.burst(t.x, t.y - 20, '#ffb35c', 22, 200);
      fx.burst(t.x, t.y - 20, '#bff3ff', 12, 160);
      audio.play('fire', 0.8);
      break;
    }
    case 'shatter': {
      let mult = RX.shatter.mult;
      if (hasPower('u_rimecrest')) mult *= RX.shatter.uniqueBonus;
      if (hasPower('s6_frost')) mult *= RX.shatter.setBonus;
      applyBreak(t, t.brkMax * RX.shatter.breakPct);
      fx.shatter(t.x, t.y - 18, ['#bff3ff', '#7fe9ff', '#ffffff'], 0.7);
      for (const f of near(RX.shatter.radius)) damage(src, f, { flat: dmg * mult, source: 'reflect', canBlock: false, kbAngle: angTo(t.x, t.y, f.x, f.y), kb: RX.shatter.kb });
      damage(src, t, { flat: dmg * mult * RX.shatter.self, source: 'reflect', canBlock: false });
      audio.play('shatter', 0.8);
      break;
    }
    case 'overload': {
      const bonus = hasPower('s6_pyre') ? RX.overload.setBonus : 1;
      fx.burst(t.x, t.y - 16, '#ff9af0', 26, 240);
      fx.ring(t.x, t.y, '#ffb35c', 10, 120, 0.45, 6);
      fx.shake(4);
      for (const f of near(RX.overload.radius)) damage(src, f, { flat: dmg * RX.overload.mult * bonus, source: 'reflect', canBlock: false, kb: RX.overload.kb, kbAngle: angTo(t.x, t.y, f.x, f.y) });
      damage(src, t, { flat: dmg * RX.overload.self * bonus, source: 'reflect', canBlock: false, kb: RX.overload.selfKb, kbAngle: src ? angTo(src.x, src.y, t.x, t.y) : 0 });
      audio.play('thunder', 0.5);
      break;
    }
    case 'superconduct':
      t.addStatus({ kind: 'shred', dur: RX.superconduct.dur, power: RX.superconduct.shred });
      fx.number(t.x, t.y - 50, '-40% DEF', '#9ad1ff', 14);
      fx.bolt(t.x - 20, t.y - 50, t.x + 10, t.y - 10, '#9ad1ff');
      audio.play('ice', 0.6);
      break;
    case 'tempest': {
      const spread = near(RX.tempest.radius);
      for (const f of spread) {
        for (const st of t.statuses) f.addStatus({ kind: st.kind, dur: Math.max(1.5, st.t), power: st.power });
        for (const k of Object.keys(t.gauges) as GaugeKind[]) f.gauges[k] = GAUGE_DUR;
        f.addStatus({ kind: 'poison', dur: RX.tempest.poisonDur });
        fx.bolt(t.x, t.y - 20, f.x, f.y - 20, '#9be15d');
      }
      t.addStatus({ kind: 'poison', dur: RX.tempest.selfPoisonDur, power: RX.tempest.selfPoisonPower });
      fx.burst(t.x, t.y - 20, '#9be15d', 20, 180);
      audio.play('wind', 0.7);
      break;
    }
    case 'singularity':
      G.world.addZone({ kind: 'vortex', x: t.x, y: t.y, r: RX.singularity.radius, dur: RX.singularity.dur, color: '#c18cff', team: 'player', tick: RX.singularity.tick, mult: RX.singularity.mult, pull: RX.singularity.pull, element: 'void' }, src);
      fx.ring(t.x, t.y, '#c18cff', RX.singularity.radius, 10, 0.6, 6);
      audio.play('magic', 0.9);
      break;
  }
}

/** visual tint for the gauge pips drawn above enemies */
export function gaugeColor(g: GaugeKind): string {
  return GAUGE_COLORS[g];
}
