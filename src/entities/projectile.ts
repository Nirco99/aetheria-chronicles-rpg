// Arrows, arcane bolts, fireballs, ice lances, homing orbs, meteors and monster missiles.
import type { Branch, ProjSpec, Team } from '../types/game';
import type { Actor } from './actor';
import { G } from '../core/state';
import { ELEMENT_COLORS, TILE } from '../data/constants';
import { damage } from '../systems/combat';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { angDiff, angTo, dist } from '../engine/util';

export class Projectile {
  x: number;
  y: number;
  z = 16;
  vx: number;
  vy: number;
  ang: number;
  dist = 0;
  t = 0;
  dead = false;
  hits = new Set<number>();
  readonly team: Team;
  trailT = 0;

  constructor(
    readonly owner: Actor,
    readonly spec: ProjSpec,
    angle: number,
    readonly tx: number,
    readonly ty: number,
    readonly branch: Branch | null,
    readonly skill: boolean,
  ) {
    this.team = owner.team;
    this.ang = angle;
    if (spec.kind === 'meteor') {
      this.x = tx;
      this.y = ty;
      this.z = 320;
      this.vx = this.vy = 0;
    } else {
      this.x = owner.x + Math.cos(angle) * 14;
      this.y = owner.y + Math.sin(angle) * 8;
      this.vx = Math.cos(angle) * spec.speed;
      this.vy = Math.sin(angle) * spec.speed;
    }
  }

  get color(): string {
    return this.spec.color ?? (this.spec.element ? ELEMENT_COLORS[this.spec.element] : this.team === 'enemy' ? '#ff6a6a' : '#e8eef6');
  }

  private hitOpts() {
    return {
      mult: this.spec.mult, magic: this.spec.magic, element: this.spec.element, status: this.spec.status, brk: this.spec.brk, kb: this.spec.kb ?? 60,
      kbAngle: this.ang, source: (this.team === 'enemy' ? 'enemy' : this.skill ? 'skill' : 'proj') as 'enemy' | 'skill' | 'proj',
      isSkill: this.skill, branch: this.branch, srcX: this.x - this.vx * 0.05, srcY: this.y - this.vy * 0.05,
    };
  }

  private explode(): void {
    const r = this.spec.aoe ?? 60;
    for (const t of G.world.targetsFor(this.team)) {
      if (t.dead || dist(this.x, this.y, t.x, t.y) > r + t.radius) continue;
      damage(this.owner, t, { ...this.hitOpts(), kbAngle: angTo(this.x, this.y, t.x, t.y) });
    }
    fx.ring(this.x, this.y, this.color, 8, r, 0.4, 6);
    fx.burst(this.x, this.y, this.color, 18, r * 2);
    fx.dust(this.x, this.y, 8, '#6a5a52');
    if (dist(this.x, this.y, G.player.x, G.player.y) < 500) {
      audio.play(this.spec.element === 'fire' ? 'fire' : 'quake', 0.6);
      fx.shake(this.spec.kind === 'meteor' ? 6 : 2);
    }
  }

  update(dt: number): void {
    this.t += dt;
    const s = this.spec;
    if (s.kind === 'meteor') {
      const fall = 0.6;
      this.z = 320 * (1 - this.t / fall);
      if (this.t >= fall) {
        this.z = 0;
        this.explode();
        this.dead = true;
      }
      return;
    }
    if (s.homing) {
      let best: Actor | null = null;
      let bd = 320;
      for (const t of G.world.targetsFor(this.team)) {
        if (t.dead) continue;
        const d = dist(this.x, this.y, t.x, t.y);
        if (d < bd && Math.abs(angDiff(this.ang, angTo(this.x, this.y, t.x, t.y))) < 1.3) {
          bd = d;
          best = t;
        }
      }
      if (best) {
        const want = angTo(this.x, this.y, best.x, best.y);
        const diff = angDiff(this.ang, want);
        this.ang += Math.max(-s.homing * dt, Math.min(s.homing * dt, diff));
        this.vx = Math.cos(this.ang) * s.speed;
        this.vy = Math.sin(this.ang) * s.speed;
      }
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.dist += s.speed * dt;
    this.trailT -= dt;
    if (this.trailT <= 0 && s.kind !== 'arrow' && s.kind !== 'rock') {
      this.trailT = 0.03;
      fx.particle(this.x, this.y, { z: this.z, vx: -this.vx * 0.05, vy: -this.vy * 0.05, max: 0.3, size: s.kind === 'fireball' ? 4 : 2.5, color: this.color, kind: 'glow', drag: 3 });
    }
    if (G.world.map.blocksShot(Math.floor(this.x / TILE), Math.floor(this.y / TILE))) {
      if (s.aoe) this.explode();
      else fx.sparks(this.x, this.y, this.color, 5, 90, this.z);
      this.dead = true;
      return;
    }
    const rad = s.radius ?? 7;
    for (const t of G.world.targetsFor(this.team)) {
      if (t.dead || this.hits.has(t.id)) continue;
      if (Math.hypot(this.x - t.x, this.y - (t.y - 4)) > rad + t.radius) continue;
      if (s.aoe) {
        this.explode();
        this.dead = true;
        return;
      }
      damage(this.owner, t, this.hitOpts());
      fx.sparks(this.x, this.y, this.color, 6, 120, this.z);
      if (!s.pierce) {
        this.dead = true;
        return;
      }
      this.hits.add(t.id);
    }
    if (this.dist >= s.range) {
      if (s.aoe) this.explode();
      this.dead = true;
    }
  }
}
