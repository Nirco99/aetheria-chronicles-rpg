// Monster AI: aggro, flow-field chasing, ranged kiting, telegraphed attacks (cones, circles,
// lines, rings, projectiles), multi-hit combos, boss phases, modifiers and Break states.
import type { BossDef, MonsterAttackDef, MonsterDef, SpawnZone, TeleShape } from '../types/game';
import { Actor } from './actor';
import { G } from '../core/state';
import { BOSSES, monsterStats } from '../data/monsters';
import { ELEMENT_COLORS, SHATTER_FREEZE } from '../data/constants';
import { damage, hitTest } from '../systems/combat';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { angTo, dirFromAngle, dist, easeOutCubic, lerp, rnd, TAU, weighted } from '../engine/util';
import { bossPhaseEnter, bossSpecial } from './bosses';
import { lookFromStyle, type Look } from '../render/paperdoll';

interface Ev {
  t: number;
  fn: () => void;
}

export class Monster extends Actor {
  readonly kind = 'monster' as const;
  readonly def: MonsterDef;
  readonly bdef: BossDef | null;
  readonly isBoss: boolean;
  readonly isElite: boolean;
  st: 'spawn' | 'idle' | 'chase' | 'attack' | 'recover' | 'return' = 'spawn';
  stT = 0;
  target: Actor | null = null;
  tauntT = 0;
  tauntBy: Actor | null = null;
  homeX: number;
  homeY: number;
  wanderT = 0;
  wx: number;
  wy: number;
  cds: Record<string, number> = {};
  cur: MonsterAttackDef | null = null;
  curStart = 0;
  curEnd = 0;
  phase = 0;
  mods: string[];
  zone: SpawnZone | null = null;
  hpBarT = 0;
  baseSpeed: number;
  xpValue: number;
  frontGuard = false;
  armored = false;
  shield = 0;
  shieldMax = 0;
  shieldRegen = 0;
  variant = 0;
  healer = false;
  alwaysAggro = false;
  clock = 0;
  events: Ev[] = [];
  dashS: { ang: number; speed: number; rem: number } | null = null;
  leapS: { x0: number; y0: number; x1: number; y1: number; t: number; dur: number } | null = null;
  channel: { t: number; dur: number; tickT: number; tick: number; fn: (m: Monster) => void } | null = null;
  spawnT = 0.45;
  look: Look | null;
  bob = Math.random() * TAU;
  bountyTag = '';
  /** v3: roaming raid boss / world-event spawn */
  raid = false;
  eventTag = '';

  constructor(def: MonsterDef, level: number, x: number, y: number, mods: string[] = []) {
    super();
    this.team = 'enemy';
    this.def = def;
    this.bdef = def.boss ? BOSSES[def.id] ?? null : null;
    this.isBoss = !!def.boss;
    this.isElite = !!def.elite;
    this.mods = mods;
    const st = monsterStats(def, level);
    this.level = level;
    this.stats.maxHp = st.hp;
    this.hp = st.hp;
    this.stats.atk = st.atk;
    this.stats.mag = st.atk;
    this.stats.def = st.def;
    this.stats.crit = this.isBoss ? 0.08 : 0.05;
    this.stats.critDmg = 1.5;
    this.brkMax = st.poise;
    this.baseSpeed = st.speed * (mods.includes('Hasted') ? 1.35 : 1);
    this.xpValue = st.xp;
    this.radius = def.size;
    this.hw = Math.min(13, def.size * 0.55);
    this.hh = Math.min(9, def.size * 0.38);
    this.flying = !!def.flying;
    this.x = this.homeX = this.wx = x;
    this.y = this.homeY = this.wy = y;
    this.look = def.humanoid ? lookFromStyle(def.humanoid) : null;
    if (mods.includes('Arcane-Shielded')) {
      this.shieldMax = Math.round(this.stats.maxHp * 0.35);
      this.shield = this.shieldMax;
    }
    if (def.id === 'b_wyrm') this.armored = true;
    if (def.id === 'b_paragon') this.frontGuard = true;
    if (def.id === 'spore_pod') this.healer = true;
    if (this.isBoss || this.isElite) this.alwaysAggro = this.isBoss;
    for (const a of def.attacks) this.cds[a.id] = rnd(0.4, Math.min(2.5, a.cd));
  }

  get displayName(): string {
    return this.def.name;
  }

  height(): number {
    return this.def.size * 2.3 * (this.look?.scale ?? 1) + (this.flying ? 16 : 0);
  }

  sf(): number {
    const phaseSpeed = this.bdef ? this.bdef.phases[this.phase].speed ?? 1 : 1;
    return phaseSpeed * (this.mods.includes('Hasted') ? 1.25 : 1) * (this.has('chill') ? 0.75 : 1);
  }

  after(t: number, fn: () => void): void {
    this.events.push({ t: this.clock + t, fn });
  }

  // ---------------------------------------------------------------- reactions

  aggroOn(src: Actor): void {
    if (this.tauntT > 0) return;
    if (!this.target || this.target.dead) this.target = src;
    else if (src.kind === 'player' && this.target.kind !== 'player' && Math.random() < 0.3) this.target = src;
    if (this.st === 'idle' || this.st === 'return') this.st = 'chase';
  }

  taunt(by: Actor, dur: number): void {
    this.tauntT = dur;
    this.tauntBy = by;
    this.target = by;
    if (this.st === 'idle' || this.st === 'return') this.st = 'chase';
    fx.number(this.x, this.y - this.height() - 6, '!', '#ffb347', 18);
  }

  onDamaged(): void {
    if (!this.bdef || this.dead) return;
    const frac = this.hp / this.stats.maxHp;
    while (this.phase + 1 < this.bdef.phases.length && frac <= this.bdef.phases[this.phase + 1].at) {
      this.phase++;
      const ph = this.bdef.phases[this.phase];
      fx.banner(`PHASE ${this.phase + 1}`, '#ff5d6c', `${this.def.name}: ${ph.name}`, 50, 1.7);
      audio.play('roar');
      fx.shake(6);
      if (ph.enter) bossPhaseEnter(this, ph.enter);
    }
  }

  cancelAttack(): void {
    this.cur = null;
    if (this.st === 'attack') this.st = 'chase';
    G.world.removeTeles(this.id);
    this.events = [];
    this.channel = null;
    this.dashS = null;
  }

  die(): void {
    this.cancelAttack();
    this.dead = true;
    this.dying = SHATTER_FREEZE;
    this.anim.kind = 'dead';
    this.kbx = this.kby = 0;
  }

  leapTo(x: number, y: number, dur: number): void {
    const p = G.world.map.nearestFree(x, y, 3);
    this.leapS = { x0: this.x, y0: this.y, x1: p.x, y1: p.y, t: 0, dur };
  }

  blinkTo(x: number, y: number): void {
    const p = G.world.map.boxFree(x, y, this.hw, this.hh, this.flying) ? { x, y } : G.world.map.nearestFree(x, y, 3);
    this.anim.ghosts.push({ x: this.x, y: this.y, z: 0, t: 0.35, dir: this.dir });
    fx.burst(this.x, this.y - 20, this.def.colors[2] ?? '#ffffff', 10, 100);
    this.x = p.x;
    this.y = p.y;
    fx.glint(this.x, this.y - 30, this.def.colors[2] ?? '#ffffff', 20);
    audio.play('dodge', 0.7);
  }

  // ---------------------------------------------------------------- update

  update(dt: number): void {
    this.tickTimers(dt);
    if (this.dead) return;
    this.clock += dt;
    if (this.spawnT > 0) this.spawnT -= dt;
    for (const k in this.cds) this.cds[k] -= dt;
    this.tauntT -= dt;
    this.hpBarT -= dt;
    if (this.shieldMax > 0) {
      if (this.shieldRegen > 0) this.shieldRegen -= dt;
      else this.shield = Math.min(this.shieldMax, this.shield + this.shieldMax * 0.15 * dt);
    }
    if (this.healer) this.healBoss(dt);
    if (this.events.length) {
      const due = this.events.filter((e) => e.t <= this.clock);
      if (due.length) {
        this.events = this.events.filter((e) => e.t > this.clock);
        for (const e of due) if (!this.dead) e.fn();
      }
    }
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    if (this.leapS) {
      const L = this.leapS;
      L.t += dt;
      const k = Math.min(1, L.t / L.dur);
      this.x = lerp(L.x0, L.x1, easeOutCubic(k));
      this.y = lerp(L.y0, L.y1, easeOutCubic(k));
      this.z = Math.sin(Math.PI * k) * 70;
      if (k >= 1) {
        this.z = 0;
        this.leapS = null;
        fx.dust(this.x, this.y, 14);
      }
      return;
    }
    if (this.dashS) {
      const d = this.dashS;
      const step = Math.min(d.rem, d.speed * dt);
      const r = G.world.map.move(this, Math.cos(d.ang) * step, Math.sin(d.ang) * step, this.flying);
      d.rem -= step;
      if (Math.random() < 0.5) this.anim.ghosts.push({ x: this.x, y: this.y, z: 0, t: 0.15, dir: this.dir });
      if (d.rem <= 0 || r.hitX || r.hitY) this.dashS = null;
    }
    if (!this.canAct()) {
      if (this.cur || this.channel) this.cancelAttack();
      this.anim.kind = 'stun';
      this.moving = false;
      return;
    }
    if (this.channel) {
      const c = this.channel;
      c.t += dt;
      c.tickT -= dt;
      if (c.tickT <= 0) {
        c.tickT = c.tick;
        c.fn(this);
      }
      if (c.t >= c.dur) this.channel = null;
      this.anim.kind = 'cast';
      return;
    }
    if (this.st === 'spawn') {
      if (this.spawnT <= 0) this.st = 'idle';
      return;
    }
    this.think(dt);
  }

  private healBoss(dt: number): void {
    for (const m of G.world.monsters) {
      if (m.isBoss && !m.dead) {
        m.hp = Math.min(m.stats.maxHp, m.hp + m.stats.maxHp * 0.008 * dt);
        if (Math.random() < dt * 3) fx.particle(this.x, this.y, { z: 20, vx: (m.x - this.x) * 1.4, vy: (m.y - this.y) * 1.4, max: 0.7, size: 3, color: '#7dff9a', kind: 'heal', drag: 0 });
        return;
      }
    }
  }

  private acquire(): void {
    let best: Actor | null = null;
    let bd = this.alwaysAggro ? 99999 : this.def.aggro;
    for (const a of G.world.targetsFor('enemy')) {
      if (a.dead) continue;
      const d = dist(this.x, this.y, a.x, a.y);
      if (d < bd && (this.alwaysAggro || G.world.map.los(this.x, this.y - 10, a.x, a.y - 10))) {
        bd = d;
        best = a;
      }
    }
    if (best) {
      this.target = best;
      this.st = 'chase';
      if (this.isElite || this.isBoss) audio.play('roar', 0.5);
    }
  }

  private think(dt: number): void {
    const sf = this.sf();
    if (this.tauntT > 0 && this.tauntBy && !this.tauntBy.dead) this.target = this.tauntBy;
    if (this.target && this.target.dead) this.target = null;
    if (this.target && !this.alwaysAggro && G.world.map.kind === 'wild' && dist(this.x, this.y, this.homeX, this.homeY) > 560) {
      this.target = null;
      this.st = 'return';
    }
    if (!this.target && this.st !== 'return' && this.st !== 'attack') this.acquire();
    switch (this.st) {
      case 'attack':
        this.moving = false;
        this.anim.kind = 'attack';
        this.anim.swing = Math.min(1, (this.clock - this.curStart) / Math.max(0.05, this.curEnd - this.curStart));
        if (this.clock >= this.curEnd) {
          this.st = 'recover';
          this.stT = (this.cur?.recover ?? 0.4) / sf;
          this.cur = null;
        }
        return;
      case 'recover':
        this.stT -= dt;
        this.anim.kind = 'idle';
        this.moving = false;
        if (this.stT <= 0) this.st = this.target ? 'chase' : 'idle';
        return;
      case 'return': {
        const d = dist(this.x, this.y, this.homeX, this.homeY);
        if (d < 20) {
          this.st = 'idle';
          this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.5);
          return;
        }
        this.walk(angTo(this.x, this.y, this.homeX, this.homeY), this.baseSpeed * 1.2, dt);
        this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.2 * dt);
        return;
      }
      case 'idle': {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = rnd(1.5, 4);
          const zr = this.zone ? this.zone.r : 60;
          this.wx = this.homeX + rnd(-zr, zr);
          this.wy = this.homeY + rnd(-zr, zr);
        }
        if (this.baseSpeed > 0 && dist(this.x, this.y, this.wx, this.wy) > 8) this.walk(angTo(this.x, this.y, this.wx, this.wy), this.baseSpeed * 0.4, dt);
        else {
          this.moving = false;
          this.anim.kind = 'idle';
        }
        if (this.target) this.st = 'chase';
        return;
      }
      case 'chase':
        this.chase(dt, sf);
        return;
      default:
        return;
    }
  }

  private walk(ang: number, speed: number, dt: number): void {
    const sp = speed * this.speedMult();
    if (sp <= 0) {
      this.moving = false;
      return;
    }
    G.world.map.move(this, Math.cos(ang) * sp * dt, Math.sin(ang) * sp * dt, this.flying);
    this.moving = true;
    this.anim.walk += dt * 9;
    this.anim.kind = 'walk';
    this.vx = Math.cos(ang) * sp;
    this.vy = Math.sin(ang) * sp;
    this.dir = dirFromAngle(ang);
    this.aim = ang;
  }

  availableAttacks(): MonsterAttackDef[] {
    if (!this.bdef) return this.def.attacks;
    const ids = this.bdef.phases[this.phase].attacks;
    return this.def.attacks.filter((a) => ids.includes(a.id));
  }

  private chase(dt: number, sf: number): void {
    const t = this.target;
    if (!t) {
      this.st = 'idle';
      return;
    }
    const d = dist(this.x, this.y, t.x, t.y);
    const toT = angTo(this.x, this.y, t.x, t.y);
    const ok = this.availableAttacks().filter((a) => (this.cds[a.id] ?? 0) <= 0 && d <= a.range + t.radius && (a.shape !== 'proj' || G.world.map.los(this.x, this.y - 10, t.x, t.y - 10)));
    if (ok.length) {
      this.startAttack(weighted(ok, (a) => a.weight ?? 1), t);
      return;
    }
    const keep = this.def.keepDistance ?? 0;
    const melee = this.def.attacks.filter((a) => a.shape !== 'proj' && a.shape !== 'none').reduce((m, a) => Math.min(m, a.range), 999);
    const pref = keep > 0 ? keep : Math.max(24, Math.min(melee, 70) * 0.75);
    let mv = 0;
    if (keep > 0) {
      if (d < keep * 0.75) mv = -1;
      else if (d > keep * 1.25) mv = 1;
    } else if (d > pref) mv = 1;
    if (mv !== 0 && this.baseSpeed > 0) {
      let ang = toT;
      if (mv > 0 && !this.flying && !G.world.map.los(this.x, this.y, t.x, t.y)) {
        const fa = G.world.flowDir(this.x, this.y);
        if (fa !== null) ang = fa;
      }
      if (mv < 0) ang += Math.PI + Math.sin(this.clock) * 0.6;
      this.walk(ang, this.baseSpeed * sf * (mv < 0 ? 0.75 : 1), dt);
    } else if (keep > 0 && this.baseSpeed > 0) {
      this.walk(toT + Math.PI / 2 * (Math.sin(this.bob) > 0 ? 1 : -1), this.baseSpeed * 0.35, dt);
    } else {
      this.moving = false;
      this.anim.kind = 'idle';
    }
    this.aim = toT;
    this.dir = dirFromAngle(toT);
  }

  startAttackById(id: string): void {
    const a = this.def.attacks.find((x) => x.id === id);
    if (a && this.target) this.startAttack(a, this.target);
  }

  startAttack(atk: MonsterAttackDef, t: Actor): void {
    const sf = this.sf();
    this.cur = atk;
    this.st = 'attack';
    this.curStart = this.clock;
    this.cds[atk.id] = atk.cd * (this.mods.includes('Hasted') ? 0.75 : 1);
    this.aim = angTo(this.x, this.y, t.x, t.y);
    this.dir = dirFromAngle(this.aim);
    this.moving = false;
    const wind = atk.windup / sf;
    if (dist(this.x, this.y, G.player.x, G.player.y) < 500) audio.play('telegraph', 0.6);
    if (atk.special) {
      const dur = bossSpecial(this, atk, t, wind);
      if (dur >= 0) {
        this.curEnd = this.clock + dur;
        return;
      }
    }
    const reps = atk.repeat ?? 1;
    const gap = (atk.gap ?? 0.3) / sf;
    if (atk.shape === 'proj') {
      fx.glint(this.x, this.y - this.height() * 0.6, ELEMENT_COLORS[atk.proj?.element ?? atk.element ?? 'none'], 14);
      for (let r = 0; r < reps; r++) this.after(wind + r * gap, () => this.fireProj(atk));
      this.curEnd = this.clock + wind + (reps - 1) * gap + 0.05;
      return;
    }
    if (atk.shape === 'none') {
      this.curEnd = this.clock + wind;
      return;
    }
    const color = atk.element && atk.element !== 'none' ? ELEMENT_COLORS[atk.element] : '#ff3b3b';
    for (let r = 0; r < reps; r++) {
      const start = r === 0 ? 0 : wind + (r - 1) * gap;
      const dur = r === 0 ? wind : gap;
      const spawn = () => {
        if (!this.cur || this.dead) return;
        const tg = this.target ?? t;
        if (r > 0) {
          this.aim = angTo(this.x, this.y, tg.x, tg.y);
          this.dir = dirFromAngle(this.aim);
        }
        for (const s of this.shapesFor(atk, tg.x, tg.y)) G.world.addTele(s, dur, this.id, () => this.resolve(atk, s), color, atk.sweep ?? 0);
      };
      if (start <= 0) spawn();
      else this.after(start, spawn);
    }
    this.curEnd = this.clock + wind + (reps - 1) * gap + 0.02;
  }

  shapesFor(atk: MonsterAttackDef, tx: number, ty: number): TeleShape[] {
    const base = angTo(this.x, this.y, tx, ty);
    const n = atk.count ?? 1;
    const spread = atk.spread ?? 0.4;
    const out: TeleShape[] = [];
    for (let i = 0; i < n; i++) {
      const a = base + (n > 1 ? (i - (n - 1) / 2) * spread : 0);
      switch (atk.shape) {
        case 'cone':
          out.push({ kind: 'cone', x: this.x, y: this.y, a, arc: atk.arc ?? 1.4, r: atk.r ?? 54 });
          break;
        case 'circle':
          if (atk.at === 'target') out.push({ kind: 'circle', x: tx + (i ? Math.cos(a * 7 + i) * 60 : 0), y: ty + (i ? Math.sin(a * 7 + i) * 60 : 0), r: atk.r ?? 60 });
          else out.push({ kind: 'circle', x: this.x, y: this.y, r: atk.r ?? 80 });
          break;
        case 'line':
          out.push({ kind: 'line', x: this.x, y: this.y, a, len: atk.len ?? 120, w: atk.w ?? 30 });
          break;
        case 'ring':
          out.push({ kind: 'ring', x: this.x, y: this.y, r: atk.r ?? 140, inner: atk.inner ?? 80 });
          break;
        default:
          break;
      }
    }
    return out;
  }

  resolve(atk: MonsterAttackDef, s: TeleShape): void {
    if (this.dead || !this.canAct()) return;
    if (atk.dash && s.kind === 'line') this.dashS = { ang: s.a, speed: atk.dash / 0.16, rem: atk.dash };
    for (const a of G.world.targetsFor('enemy')) {
      if (a.dead || !hitTest(s, a.x, a.y, a.radius)) continue;
      damage(this, a, { mult: atk.mult, element: atk.element, status: atk.status, kb: atk.kb ?? 110, source: 'enemy', srcX: this.x, srcY: this.y });
    }
    this.attackFx(atk, s);
    if (atk.special === 'suicide') {
      this.events = [];
      damage(null, this, { flat: this.hp + 1, noNumber: true, source: 'dot' });
    }
  }

  private attackFx(atk: MonsterAttackDef, s: TeleShape): void {
    const col = atk.element && atk.element !== 'none' ? ELEMENT_COLORS[atk.element] : this.def.colors[2] ?? '#ffffff';
    const near = dist(s.x, s.y, G.player.x, G.player.y) < 420;
    switch (s.kind) {
      case 'cone':
        fx.ribbon(this.x, this.y, s.a, { a0: -s.arc / 2, a1: s.arc / 2, r: s.r * 0.85, w: 12 }, col, '#ffffff');
        if (near) audio.play('swing', 0.6);
        break;
      case 'circle': {
        const big = s.r >= 90;
        fx.ring(s.x, s.y, col, 10, s.r, 0.45, 5);
        fx.burst(s.x, s.y, col, big ? 16 : 10, s.r * 1.4);
        fx.dust(s.x, s.y, big ? 12 : 6);
        if (near) {
          audio.play(big ? 'quake' : 'hit', big ? 0.7 : 0.5);
          if (big) fx.shake(5);
        }
        break;
      }
      case 'line':
        fx.ribbon(s.x, s.y, s.a, { a0: 0, a1: 0, style: 'thrust', len: s.len, w: Math.min(26, s.w * 0.6) }, col, '#ffffff');
        if (near) audio.play('swing2', 0.6);
        break;
      case 'ring':
        fx.ring(s.x, s.y, col, s.inner, s.r, 0.4, 8);
        if (near) audio.play('quake', 0.6);
        break;
    }
  }

  private fireProj(atk: MonsterAttackDef): void {
    if (!atk.proj || this.dead) return;
    const t = this.target;
    if (!t) return;
    const base = angTo(this.x, this.y, t.x, t.y);
    const n = atk.count ?? 1;
    const spread = atk.spread ?? 0.3;
    for (let i = 0; i < n; i++) {
      const a = base + (n > 1 ? (i - (n - 1) / 2) * (spread / Math.max(1, n - 1)) * 2 : 0);
      G.world.spawnProjectile(this, atk.proj, a, t.x, t.y, null);
    }
    if (dist(this.x, this.y, G.player.x, G.player.y) < 500) audio.play(atk.proj.element === 'fire' ? 'fire' : atk.proj.kind === 'arrow' || atk.proj.kind === 'rock' ? 'arrow' : 'magic', 0.45);
  }
}
