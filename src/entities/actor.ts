// Base class for every living thing in the world. Kept dependency-free (types, util and
// constants only) so subclasses can extend it without module initialisation cycles.
import type { Anim, BuffInst, BuffSpec, Dir, GaugeKind, StatusApply, StatusInst, StatusKind, Stats, Team } from '../types/game';
import { FRAMES } from '../data/framedata';

export type ActorKind = 'player' | 'companion' | 'monster' | 'npc' | 'prop' | 'shadow' | 'caravan';
let NEXT_ID = 1;

export function newAnim(): Anim {
  return { kind: 'idle', t: 0, walk: 0, swing: 0, a0: 0, a1: 0, hand: 0, glint: 0, glintColor: '#ffffff', charge: 0, ghosts: [] };
}

export function emptyStats(): Stats {
  return { maxHp: 100, maxMp: 50, maxSta: 100, atk: 10, def: 5, mag: 5, crit: 0.05, critDmg: 1.5, aspd: 1, move: 1, brk: 0, block: 0, mpRegen: 1, xpMult: 1, elem: {}, lifesteal: 0, skillDmg: 0, cdr: 0, magicFind: 0 };
}

const DEFAULT_POWER: Record<StatusKind, number> = { burn: 1, poison: 0.8, chill: 0.4, freeze: 1, stun: 1, root: 1, shred: 0.25, shock: 1 };

export interface CounterStance {
  t: number;
  fn: () => void;
}

export abstract class Actor {
  readonly id = NEXT_ID++;
  abstract readonly kind: ActorKind;
  team: Team = 'neutral';
  x = 0;
  y = 0;
  z = 0;
  hw = 7;
  hh = 5;
  radius = 12;
  vx = 0;
  vy = 0;
  kbx = 0;
  kby = 0;
  dir: Dir = 0;
  aim = Math.PI / 2;
  level = 1;
  hp = 100;
  mp = 50;
  sta = 100;
  stats: Stats = emptyStats();
  statuses: StatusInst[] = [];
  buffs: BuffInst[] = [];
  barrier = 0;
  barrierT = 0;
  hitstop = 0;
  flash = 0;
  iframes = 0;
  dead = false;
  dying = 0;
  removed = false;
  brk = 0;
  brkMax = 0;
  broken = 0;
  brkDelay = 0;
  flying = false;
  inCitadel = false;
  slowZone = 0;
  moving = false;
  counter: CounterStance | null = null;
  anim: Anim = newAnim();
  // ---- v3 Full-Dive physics & elements
  /** elemental reaction gauges (seconds remaining) */
  gauges: Partial<Record<GaugeKind, number>> = {};
  /** damage of the last hit taken (Wall-Slam impact scales from it) */
  lastDmg = 0;
  lastHitBy: Actor | null = null;
  slamCd = 0;
  /** seconds since the last knockback impulse (Wall-Slam eligibility) */
  kbFresh = 0;
  /** elevation tier the actor stands on (0 ground, 1 plateau) */
  lvl = 0;
  /** blade-trail samples (hilt / tip) for the 12-sample trail mesh */
  trail: { hx: number; hy: number; tx: number; ty: number; t: number }[] = [];

  abstract get displayName(): string;

  /** recompute derived stats / visuals (player & companions override) */
  refresh(): void {}

  has(k: StatusKind): boolean {
    for (const s of this.statuses) if (s.kind === k) return true;
    return false;
  }

  power(k: StatusKind): number {
    let p = 0;
    for (const s of this.statuses) if (s.kind === k) p = Math.max(p, s.power);
    return p;
  }

  /** returns true when the status was applied */
  addStatus(a: StatusApply, resist = 0): boolean {
    if (this.dead) return false;
    if (a.chance !== undefined && Math.random() > a.chance) return false;
    const dur = a.dur * (1 - resist);
    if (dur <= 0.05) return false;
    const ex = this.statuses.find((s) => s.kind === a.kind);
    if (ex) {
      ex.t = Math.max(ex.t, dur);
      ex.power = Math.max(ex.power, a.power ?? DEFAULT_POWER[a.kind]);
      return true;
    }
    this.statuses.push({ kind: a.kind, t: dur, power: a.power ?? DEFAULT_POWER[a.kind], tick: 0 });
    return true;
  }

  clearDebuffs(): void {
    this.statuses.length = 0;
  }

  addBuff(spec: BuffSpec): void {
    const ex = this.buffs.find((b) => b.spec.id === spec.id);
    if (ex) {
      ex.spec = spec;
      ex.t = spec.dur;
    } else this.buffs.push({ spec, t: spec.dur });
  }

  hasBuff(id: string): boolean {
    for (const b of this.buffs) if (b.spec.id === id) return true;
    return false;
  }

  removeBuff(id: string): void {
    this.buffs = this.buffs.filter((b) => b.spec.id !== id);
  }

  speedMult(): number {
    if (this.broken > 0 || this.has('freeze') || this.has('stun') || this.has('root')) return 0;
    let m = 1;
    if (this.has('chill')) m *= 1 - this.power('chill');
    if (this.slowZone > 0) m *= 1 - this.slowZone;
    return m;
  }

  canAct(): boolean {
    return !this.dead && this.broken <= 0 && !this.has('freeze') && !this.has('stun');
  }

  /** shared timers; returns true when buffs changed (stats must be refreshed) */
  tickTimers(dt: number): boolean {
    let changed = false;
    for (let i = this.statuses.length - 1; i >= 0; i--) {
      const s = this.statuses[i];
      s.t -= dt;
      if (s.t <= 0) this.statuses.splice(i, 1);
    }
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      const b = this.buffs[i];
      b.t -= dt;
      if (b.t <= 0) {
        this.buffs.splice(i, 1);
        changed = true;
      }
    }
    if (this.flash > 0) this.flash -= dt;
    if (this.iframes > 0) this.iframes -= dt;
    if (this.barrierT > 0) {
      this.barrierT -= dt;
      if (this.barrierT <= 0) this.barrier = 0;
    }
    if (this.broken > 0) {
      this.broken -= dt;
      if (this.broken <= 0) this.brk = 0;
    } else if (this.brkDelay > 0) this.brkDelay -= dt;
    else if (this.brk > 0) this.brk = Math.max(0, this.brk - this.brkMax * FRAMES.breakDecay * dt);
    if (this.counter) {
      this.counter.t -= dt;
      if (this.counter.t <= 0) this.counter = null;
    }
    for (const k in this.gauges) {
      const g = k as GaugeKind;
      const v = (this.gauges[g] ?? 0) - dt;
      if (v <= 0) delete this.gauges[g];
      else this.gauges[g] = v;
    }
    if (this.slamCd > 0) this.slamCd -= dt;
    if (this.kbFresh > 0) this.kbFresh -= dt;
    this.anim.t += dt;
    if (this.anim.glint > 0) this.anim.glint -= dt;
    for (let i = this.anim.ghosts.length - 1; i >= 0; i--) {
      this.anim.ghosts[i].t -= dt;
      if (this.anim.ghosts[i].t <= 0) this.anim.ghosts.splice(i, 1);
    }
    return changed;
  }
}
