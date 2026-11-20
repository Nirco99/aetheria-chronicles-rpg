// Full-Dive combat feel: the D..SSS Style meter, Skill Connect chains and the Finishing Nova,
// Wall-Slam impacts, Counter-Riposte criticals and the parry time-freeze.
import type { Actor } from '../entities/actor';
import { FRAMES } from '../data/framedata';
import { G } from '../core/state';
import { STYLE_MAX, STYLE_RANKS } from '../data/v3';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { damage, applyBreak, hitTest, targetsOf } from './combat';
import { hasPower, onWallSlamPower } from './powers';
import { rnd, TAU } from '../engine/util';

// ------------------------------------------------------------------ style meter

class StyleMeter {
  pts = 0;
  rank = 0;
  idle = 0;
  flash = 0;
  lastGain = '';
  lastGainT = 0;
  private best = 0;

  get def(): (typeof STYLE_RANKS)[number] {
    return STYLE_RANKS[this.rank];
  }

  /** fraction of the way to the next rank (decay bar) */
  get progress(): number {
    const cur = STYLE_RANKS[this.rank].min;
    const next = this.rank < STYLE_RANKS.length - 1 ? STYLE_RANKS[this.rank + 1].min : STYLE_MAX;
    return Math.max(0, Math.min(1, (this.pts - cur) / Math.max(1, next - cur)));
  }

  add(n: number, label = ''): void {
    if (!G.player || G.player.dead) return;
    this.pts = Math.min(STYLE_MAX, this.pts + n);
    this.idle = 0;
    if (label) {
      this.lastGain = label;
      this.lastGainT = 1.2;
    }
    this.recompute();
  }

  hurt(fraction: number): void {
    this.pts = Math.max(0, this.pts - 140 - fraction * 600);
    this.idle = 0;
    this.recompute();
  }

  reset(): void {
    this.pts = 0;
    this.idle = 0;
    this.recompute();
  }

  update(dt: number): void {
    this.idle += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.lastGainT > 0) this.lastGainT -= dt;
    if (this.idle > 2.2 && this.pts > 0) {
      const slow = hasPower('p_showstopper') ? 0.6 : 1;
      const rate = (35 + this.rank * 14) * slow;
      this.pts = Math.max(0, this.pts - rate * dt);
      const inCombat = G.time - G.player.lastCombat < 6;
      if (hasPower('p_showstopper') && inCombat) this.pts = Math.max(this.pts, STYLE_RANKS[1].min);
      this.recompute();
    }
  }

  private recompute(): void {
    let r = 0;
    for (let i = 0; i < STYLE_RANKS.length; i++) if (this.pts >= STYLE_RANKS[i].min) r = i;
    if (r === this.rank) return;
    const up = r > this.rank;
    this.rank = r;
    this.flash = up ? 0.6 : 0;
    G.player?.refresh();
    if (up && r >= 4 && G.settings.styleMeter) audio.play(r === 6 ? 'awaken' : 'chime', r === 6 ? 0.8 : 0.45);
    if (up && r === 6) {
      fx.banner('SSS: FULL-DIVE OVERDRIVE!', '#ff5df0', '+25% attack speed, +15% move speed, +40% magic find', 54, 1.6);
      fx.flash('#ff5df0', 0.12);
      if (this.best < 6) G.save.counters.sssReached++;
    }
    this.best = Math.max(this.best, r);
  }
}

export const style = new StyleMeter();

// ------------------------------------------------------------------ skill connect

export const CONNECT_WINDOW = FRAMES.connectWindow;
export const CONNECT_MP = FRAMES.connectMp;
export const CONNECT_STEP = FRAMES.connectStep;
export const NOVA_CHAIN = FRAMES.novaChain;

export function connectFlash(a: Actor, color = '#7fe9ff'): void {
  fx.ring(a.x, a.y - 4, color, 6, 46, 0.3, 3);
  fx.glint(a.x, a.y - 30, '#ffffff', 26);
}

export function connectBanner(step: number, viaCancel: boolean): void {
  const p = G.player;
  const txt = viaCancel ? 'SKILL CONNECT!' : `SKILL CONNECT! x${step}`;
  fx.number(p.x, p.y - 70, txt, '#7fe9ff', step >= 3 ? 22 : 18);
  fx.ring(p.x, p.y - 10, '#7fe9ff', 10, 70, 0.35, 4);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + G.time * 3;
    fx.sparks(p.x + Math.cos(a) * 26, p.y - 18 + Math.sin(a) * 12, '#bff3ff', 2, 90);
  }
  audio.play('chime', 0.9);
  const s = G.save;
  s.counters.skillConnects++;
  s.counters.maxChain = Math.max(s.counters.maxChain, step);
  style.add(viaCancel ? 50 : 70 + step * 20, 'Skill Connect');
}

export function finishingNova(p: Actor, step: number): void {
  const R = FRAMES.novaRadius;
  fx.banner('FINISHING NOVA!', '#7fe9ff', `${step}-Skill Chain unleashed`, 64, 1.3);
  fx.flash('#bff3ff', 0.22);
  fx.shake(9);
  for (let i = 0; i < 4; i++) fx.ring(p.x, p.y, i % 2 ? '#ffffff' : '#7fe9ff', 12, R * (0.6 + i * 0.18), 0.5 + i * 0.08, 6 - i);
  fx.burst(p.x, p.y - 20, '#bff3ff', 40, 260);
  audio.play('beam');
  audio.play('shatter', 0.6);
  G.game.slowmo(0.4, 0.3);
  G.game.freeze(0.06);
  const shape = { kind: 'circle' as const, x: p.x, y: p.y, r: R };
  for (const t of targetsOf(p)) {
    if (t.dead || !hitTest(shape, t.x, t.y, t.radius)) continue;
    damage(p, t, { mult: FRAMES.novaMult, forceCrit: true, isSkill: true, source: 'skill', brk: FRAMES.novaBreak, kb: 260, element: 'void', branch: null });
  }
  G.save.counters.novas++;
  style.add(220, 'Finishing Nova');
}

// ------------------------------------------------------------------ wall slam

/** called by the world integrator when a knocked-back actor collides with a wall */
export function wallSlam(a: Actor, hitX: boolean, hitY: boolean): void {
  a.slamCd = FRAMES.slamCooldown;
  const src = a.lastHitBy;
  const keystone = G.save.keystones.includes('ks_spear');
  const mult = keystone ? FRAMES.slamDmgKeystone : FRAMES.slamDmg;
  const dmg = Math.max(1, Math.round(a.lastDmg * mult));
  const nx = hitX ? Math.sign(a.kbx) * a.hw : 0;
  const ny = hitY ? Math.sign(a.kby) * a.hh : 0;
  const cx = a.x + nx;
  const cy = a.y + ny;
  a.kbx = a.kby = 0;
  damage(src, a, { flat: dmg, source: 'reflect', canBlock: false, noNumber: true });
  fx.number(a.x, a.y - 58, `WALL SLAM! ${dmg}`, '#ffb35c', 19);
  if (!a.dead) {
    a.addStatus({ kind: 'stun', dur: FRAMES.slamStun });
    applyBreak(a, a.brkMax * FRAMES.slamBreak);
  }
  fx.shake(4.5);
  fx.dust(cx, cy, 14, '#b9ad98');
  fx.sparks(cx, cy - 12, '#ffe9a8', 12, 220);
  for (let i = 0; i < 8; i++) fx.particle(cx + rnd(-6, 6), cy - rnd(4, 18), { kind: 'square', color: i % 2 ? '#7a6f62' : '#a39686', vx: rnd(-120, 120), vy: rnd(-160, -40), z: 0, size: rnd(2, 4), max: 0.7, drag: 0.9 });
  audio.play('quake', 0.55);
  audio.play('hit', 0.8);
  G.save.counters.wallSlams++;
  style.add(90, 'Wall Slam');
  onWallSlamPower(a);
}

// ------------------------------------------------------------------ riposte

export const RIPOSTE_WINDOW = FRAMES.riposteWindow;

export function riposteFx(p: Actor): void {
  fx.number(p.x, p.y - 64, 'COUNTER-RIPOSTE!', '#ffd166', 20);
  fx.ring(p.x, p.y, '#ffd166', 8, 80, 0.35, 5);
  fx.flash('#ffd166', 0.1);
  fx.shake(5);
  audio.play('crit');
  G.save.counters.ripostes++;
  style.add(120, 'Counter-Riposte');
}
