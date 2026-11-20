// Sword Skill executor: runs the timeline scripts from data/skills.ts. A 0.12s Pre-Motion
// Initiation Flash precedes every skill, then scripted dashes, leaps, hits and ribbons play out.
import type {
  ActiveSkillDef, BuffSpec, Element, MorphKind, ProjSpec, RibbonSpec, SfxName, SkillAPI, SkillCaster, SkillHitOpts, StatusApply, TeleShape, ZoneSpec,
} from '../types/game';
import { FRAMES } from '../data/framedata';
import { BRANCH_ELEMENT, MORPHS } from '../data/v3';
import type { Actor } from '../entities/actor';
import type { Monster } from '../entities/monster';
import { G } from '../core/state';
import { damage, hitTest, targetsOf } from './combat';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { angTo, dist, easeOutCubic, lerp, mix } from '../engine/util';

export const PRE_MOTION = FRAMES.preMotion;

interface Ev {
  t: number;
  fn: () => void;
}

export class SkillRun implements SkillAPI {
  t = -PRE_MOTION;
  started = false;
  done = false;
  moveWin: { t: number; mult: number } | null = null;
  private events: Ev[] = [];
  private dashS: { ang: number; speed: number; rem: number } | null = null;
  private leapS: { x0: number; y0: number; x1: number; y1: number; t: number; dur: number } | null = null;
  private aimV: number;
  /** seconds since the skill's final scripted event fired (-1 while events remain) */
  doneT = -1;

  constructor(
    readonly actor: Actor,
    readonly def: ActiveSkillDef,
    readonly tx: number,
    readonly ty: number,
    private mult: number,
    private tint: string | null,
    readonly morph: MorphKind | null = null,
  ) {
    this.aimV = actor.aim;
    if (morph === 'power') this.mult *= 1.35;
    if (morph) this.tint = this.tint ? mix(this.tint, MORPHS[morph].color, 0.5) : mix(def.color, MORPHS[morph].color, 0.45);
  }

  /** still in the 0.12s Pre-Motion flash (cancellable startup) */
  get preMotion(): boolean {
    return !this.started;
  }

  /** every scripted strike has resolved: only recovery frames remain */
  get eventsDone(): boolean {
    return this.started && this.events.length === 0 && !this.dashS && !this.leapS;
  }

  private get element(): Element | undefined {
    return this.morph === 'leech' ? BRANCH_ELEMENT[this.def.branch] : undefined;
  }

  private get areaMult(): number {
    return this.morph === 'power' ? 1.15 : 1;
  }

  get caster(): SkillCaster {
    return this.actor;
  }

  get aim(): number {
    return this.aimV;
  }

  get busyMoving(): boolean {
    return !!this.dashS || !!this.leapS;
  }

  update(dt: number): void {
    this.t += dt;
    if (!this.started && this.t >= 0) {
      this.started = true;
      const t0 = this.t;
      this.t = 0;
      this.def.run(this);
      this.t = t0;
    }
    if (this.started && this.events.length) {
      const due = this.events.filter((e) => e.t <= this.t);
      if (due.length) {
        this.events = this.events.filter((e) => e.t > this.t);
        for (const e of due) if (!this.actor.dead) e.fn();
      }
    }
    const a = this.actor;
    if (this.dashS) {
      const d = this.dashS;
      const step = Math.min(d.rem, d.speed * dt);
      const res = G.world.map.move(a, Math.cos(d.ang) * step, Math.sin(d.ang) * step, a.flying);
      d.rem -= step;
      if (Math.random() < 0.6) a.anim.ghosts.push({ x: a.x, y: a.y, z: a.z, t: 0.18, dir: a.dir });
      if (res.hitX || res.hitY || d.rem <= 0.01) this.dashS = null;
    }
    if (this.leapS) {
      const L = this.leapS;
      L.t += dt;
      const k = Math.min(1, L.t / L.dur);
      const e = easeOutCubic(k);
      a.x = lerp(L.x0, L.x1, e);
      a.y = lerp(L.y0, L.y1, e);
      a.z = Math.sin(Math.PI * k) * 48;
      if (k >= 1) {
        a.z = 0;
        this.leapS = null;
        fx.dust(a.x, a.y, 10);
      }
    }
    if (this.moveWin) {
      this.moveWin.t -= dt;
      if (this.moveWin.t <= 0) this.moveWin = null;
    }
    if (this.eventsDone) this.doneT = this.doneT < 0 ? 0 : this.doneT + dt;
    if (this.started && this.t >= this.def.dur && this.events.length === 0 && !this.dashS && !this.leapS) this.done = true;
  }

  cancel(): void {
    this.events.length = 0;
    this.dashS = null;
    if (this.leapS) {
      this.actor.x = this.leapS.x1;
      this.actor.y = this.leapS.y1;
      this.actor.z = 0;
      this.leapS = null;
    }
    this.done = true;
  }

  // ---------------------------------------------------------------- SkillAPI

  at(t: number, fn: () => void): void {
    this.events.push({ t: this.t + t, fn });
  }

  dash(angle: number, d: number, dur: number): void {
    this.dashS = { ang: angle, speed: d / Math.max(0.05, dur), rem: d };
  }

  leap(x: number, y: number, dur: number): void {
    const a = this.actor;
    const map = G.world.map;
    let tx = a.x;
    let ty = a.y;
    const total = dist(a.x, a.y, x, y);
    for (let d = total; d >= 0; d -= 8) {
      const px = a.x + ((x - a.x) * d) / (total || 1);
      const py = a.y + ((y - a.y) * d) / (total || 1);
      if (map.boxFree(px, py, a.hw, a.hh) && map.los(a.x, a.y, px, py)) {
        tx = px;
        ty = py;
        break;
      }
    }
    this.leapS = { x0: a.x, y0: a.y, x1: tx, y1: ty, t: 0, dur };
    a.iframes = Math.max(a.iframes, dur * 0.85);
  }

  hit(o: SkillHitOpts, echo = false): number {
    const a = this.actor;
    const ang = this.aimV + (o.angle ?? 0);
    const am = this.areaMult;
    // player hitboxes are 15% more generous than the ribbon you see
    const wide = a.kind === 'player' ? 1.15 : 1;
    let shape: TeleShape;
    if (o.shape === 'arc') shape = { kind: 'cone', x: a.x, y: a.y, a: ang, arc: (o.arc ?? 1.6) * wide, r: (o.range ?? 60) * am };
    else if (o.shape === 'circle') {
      const px = o.at === 'cursor' ? this.tx : o.at === 'point' ? (o.px ?? a.x) : a.x;
      const py = o.at === 'cursor' ? this.ty : o.at === 'point' ? (o.py ?? a.y) : a.y;
      shape = { kind: 'circle', x: px, y: py, r: (o.range ?? 80) * am };
    } else if (o.shape === 'line') shape = { kind: 'line', x: a.x, y: a.y, a: ang, len: (o.range ?? 120) * am, w: (o.width ?? 30) * wide * am };
    else shape = { kind: 'ring', x: a.x, y: a.y, r: (o.range ?? 120) * am, inner: o.inner ?? 60 };
    if (echo) o = { ...o, ribbon: false };
    if (o.ribbon !== false) {
      const r: RibbonSpec | null = o.ribbon ?? (o.shape === 'arc' ? { a0: -(o.arc ?? 1.6) / 2, a1: (o.arc ?? 1.6) / 2, r: (o.range ?? 60) * 0.85 }
        : o.shape === 'line' ? { a0: 0, a1: 0, style: 'thrust', len: o.range ?? 120 }
        : o.shape === 'circle' && (o.at ?? 'self') === 'self' ? { a0: -Math.PI, a1: Math.PI, r: (o.range ?? 80) * 0.8 } : null);
      if (r) this.ribbon(r);
    }
    let n = 0;
    const mult = o.mult * this.mult * (echo ? 0.4 / (this.morph === 'power' ? 1.35 : 1) : 1);
    for (const t of targetsOf(a)) {
      if (t.dead || !hitTest(shape, t.x, t.y, t.radius)) continue;
      const exec = this.morph === 'power' && t.hp < t.stats.maxHp * 0.3 ? 0.5 : 0;
      const dealt = damage(a, t, {
        mult, magic: o.magic, element: this.element ?? o.element, brk: o.brk, kb: o.kb, status: o.status, crit: o.crit, forceCrit: o.forceCrit,
        isSkill: true, branch: this.def.branch, source: 'skill', kbAngle: o.shape === 'line' ? ang : undefined, bonus: exec || undefined,
      });
      if (this.morph === 'leech' && dealt > 0) a.hp = Math.min(a.stats.maxHp, a.hp + dealt * 0.08);
      n++;
      if (o.maxTargets && n >= o.maxTargets) break;
    }
    if (this.morph === 'clone' && !echo) {
      G.world.after(0.25, () => {
        if (a.dead) return;
        a.anim.ghosts.push({ x: a.x, y: a.y, z: a.z, t: 0.3, dir: a.dir });
        const s = shape;
        const col = '#b07bff';
        if (s.kind === 'cone') fx.ribbon(a.x, a.y, ang, { a0: -s.arc / 2, a1: s.arc / 2, r: s.r * 0.85, w: 9 }, col, '#2a1f44');
        else if (s.kind === 'line') fx.ribbon(a.x, a.y, ang, { a0: 0, a1: 0, style: 'thrust', len: s.len, w: 10 }, col, '#2a1f44');
        else fx.ring(s.x, s.y, col, 8, s.r, 0.35, 4);
        this.hit(o, true);
      });
    }
    return n;
  }

  proj(p: ProjSpec, angle: number): void {
    const spec: ProjSpec = { ...p, mult: p.mult * this.mult, element: this.element ?? p.element, radius: (p.radius ?? 7) * this.areaMult, aoe: p.aoe ? p.aoe * this.areaMult : undefined };
    if (this.morph) spec.color = this.tint ?? spec.color;
    G.world.spawnProjectile(this.actor, spec, angle, this.tx, this.ty, this.def.branch, true);
    if (this.morph === 'clone') {
      const a = this.actor;
      G.world.after(0.25, () => {
        if (!a.dead) G.world.spawnProjectile(a, { ...spec, mult: spec.mult * 0.4 / (this.morph === 'power' ? 1.35 : 1), color: '#b07bff' }, angle, this.tx, this.ty, this.def.branch, true);
      });
    }
  }

  blinkBehind(maxDist: number): boolean {
    const a = this.actor;
    let best: Actor | null = null;
    let bd = Infinity;
    for (const t of targetsOf(a)) {
      if (t.dead || dist(a.x, a.y, t.x, t.y) > maxDist) continue;
      const d = dist(this.tx, this.ty, t.x, t.y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    if (!best) return false;
    const ang = angTo(a.x, a.y, best.x, best.y);
    let px = best.x + Math.cos(ang) * (best.radius + 18);
    let py = best.y + Math.sin(ang) * (best.radius + 18);
    const map = G.world.map;
    if (!map.boxFree(px, py, a.hw, a.hh)) {
      const nf = map.nearestFree(px, py, 2);
      px = nf.x;
      py = nf.y;
    }
    a.anim.ghosts.push({ x: a.x, y: a.y, z: 0, t: 0.3, dir: a.dir });
    a.x = px;
    a.y = py;
    this.aimV = angTo(px, py, best.x, best.y);
    a.aim = this.aimV;
    a.iframes = Math.max(a.iframes, 0.25);
    fx.glint(px, py - 24, this.def.color, 20);
    audio.play('dodge');
    return true;
  }

  buff(spec: BuffSpec): void {
    this.actor.addBuff(spec);
    this.actor.refresh();
  }

  barrier(fraction: number, dur: number): void {
    const a = this.actor;
    a.barrier = Math.max(a.barrier, a.stats.maxHp * fraction);
    a.barrierT = dur;
    fx.ring(a.x, a.y, '#c18cff', 8, 50, 0.4);
  }

  zone(z: Omit<ZoneSpec, 'team'>): void {
    G.world.addZone({ ...z, team: this.actor.team }, this.actor);
  }

  trap(x: number, y: number, dur: number, root: number): void {
    G.world.addTrap(x, y, dur, root, this.actor);
  }

  taunt(radius: number, dur: number): void {
    const a = this.actor;
    for (const m of G.world.monsters) {
      if (m.dead || dist(a.x, a.y, m.x, m.y) > radius) continue;
      (m as Monster).taunt(a, dur);
    }
  }

  chain(mult: number, jumps: number, range: number, element: Element, status?: StatusApply): void {
    const a = this.actor;
    const pool = targetsOf(a).filter((t) => !t.dead);
    let cur: Actor | null = null;
    let bd = Infinity;
    for (const t of pool) {
      if (dist(a.x, a.y, t.x, t.y) > 360) continue;
      const d = dist(this.tx, this.ty, t.x, t.y);
      if (d < bd) {
        bd = d;
        cur = t;
      }
    }
    let fx0 = a.x + Math.cos(this.aimV) * 14;
    let fy0 = a.y - 26;
    let m = mult * this.mult;
    const hit = new Set<number>();
    if (!cur) {
      fx.bolt(fx0, fy0, a.x + Math.cos(this.aimV) * 120, a.y + Math.sin(this.aimV) * 80 - 20);
      return;
    }
    for (let j = 0; j < jumps && cur; j++) {
      const target: Actor = cur;
      fx.bolt(fx0, fy0, target.x, target.y - 20, '#ffe066');
      fx.burst(target.x, target.y - 18, '#ffe066', 8, 90);
      const dealt = damage(a, target, { mult: m, magic: true, element: this.element ?? element, status, isSkill: true, branch: this.def.branch, brk: 6, source: 'skill' });
      if (this.morph === 'leech' && dealt > 0) a.hp = Math.min(a.stats.maxHp, a.hp + dealt * 0.08);
      hit.add(target.id);
      fx0 = target.x;
      fy0 = target.y - 20;
      m *= 0.85;
      let next: Actor | null = null;
      let nd = range;
      for (const t of pool) {
        if (hit.has(t.id) || t.dead) continue;
        const d = dist(target.x, target.y, t.x, t.y);
        if (d < nd) {
          nd = d;
          next = t;
        }
      }
      cur = next;
    }
  }

  counter(dur: number, onTrigger: () => void): void {
    this.actor.counter = { t: dur, fn: onTrigger };
  }

  invuln(dur: number): void {
    this.actor.iframes = Math.max(this.actor.iframes, dur);
  }

  ribbon(r: RibbonSpec): void {
    const c = this.tint ? mix(r.color ?? this.def.color, this.tint, 0.5) : (r.color ?? this.def.color);
    fx.ribbon(this.actor.x, this.actor.y, this.aimV, { ...r, color: c }, c, r.color2 ?? this.def.color2);
  }

  ring(color: string, radius: number): void {
    fx.ring(this.actor.x, this.actor.y, color, 10, radius, 0.5, 5);
  }

  sfx(name: SfxName): void {
    audio.play(name, this.actor.kind === 'player' ? 1 : 0.6);
  }

  shake(power: number): void {
    const p = G.player;
    if (this.actor === p || dist(this.actor.x, this.actor.y, p.x, p.y) < 300) fx.shake(this.actor === p ? power : power * 0.5);
  }

  allowMove(dur: number, speedMult: number): void {
    this.moveWin = { t: dur, mult: speedMult };
  }

  rain(x: number, y: number, r: number, count: number, dur: number, mult: number, element: Element): void {
    G.world.addRain(this.actor, x, y, r * this.areaMult, count, dur, mult * this.mult, this.element ?? element);
  }
}
