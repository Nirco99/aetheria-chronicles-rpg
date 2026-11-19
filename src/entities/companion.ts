// AI Guild Companion: follows the Diver, fights in real time with basic combos and its own
// Sword Skills, dodges telegraphs, guards, revives after being knocked out, and executes
// the Synchronized Chain Skill when the player calls SWITCH!
import type { ActiveSkillDef, CompanionDef, CompanionSave } from '../types/game';
import { Actor } from './actor';
import { G } from '../core/state';
import { SkillRun } from '../systems/skills';
import { skillsOfBranch } from '../data/skills';
import { companionStats, gemColor, setBranches, weaponMode, type WeaponMode } from '../systems/stats';
import { COMBOS, basicHit, reachOf } from '../systems/basic';
import { damage, hitTest } from '../systems/combat';
import { buildCompanionLook, type Look } from '../render/paperdoll';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { angTo, clamp, dirFromAngle, dist, rnd } from '../engine/util';

const SKILL_LEVELS = [1, 6, 12, 20, 30];

export class Companion extends Actor {
  readonly kind = 'companion' as const;
  readonly def: CompanionDef;
  readonly save: CompanionSave;
  look!: Look;
  mode: WeaponMode = 'fists';
  target: Actor | null = null;
  st: 'follow' | 'attack' | 'skill' | 'dodge' | 'down' | 'chain' = 'follow';
  atkT = 0;
  atkDur = 0;
  atkCd = 0;
  hitDone = false;
  combo = 0;
  skillCd: Record<string, number> = {};
  casting: SkillRun | null = null;
  guard = false;
  guardT = 0;
  downT = 0;
  dodgeT = 0;
  dodgeAng = 0;
  thinkT = 0;
  chainT = 0;
  chainTarget: Actor | null = null;
  chainHits = 0;
  tint: string | null = null;

  constructor(def: CompanionDef, save: CompanionSave) {
    super();
    this.def = def;
    this.save = save;
    this.team = 'player';
    this.hw = 6;
    this.hh = 4;
    this.radius = 11;
    this.level = G.save.level;
    this.refresh();
    this.hp = this.stats.maxHp;
    this.mp = this.stats.maxMp;
  }

  get displayName(): string {
    return this.def.name;
  }

  syncLevel(): void {
    this.level = G.save.level;
    this.refresh();
    this.hp = this.stats.maxHp;
  }

  refresh(): void {
    this.stats = companionStats(this.level, this.save, this.buffs);
    this.look = buildCompanionLook(this.def, this.save);
    this.mode = weaponMode(this.save.equip.main, this.save.equip.off);
    this.tint = gemColor(this.save.equip.main);
    this.hp = clamp(this.hp, 0, this.stats.maxHp);
  }

  private color(): string {
    return this.tint ?? this.def.colors.glow;
  }

  knockOut(): void {
    if (this.dead) return;
    this.dead = true;
    this.st = 'down';
    this.downT = 15;
    this.casting?.cancel();
    this.casting = null;
    this.guard = false;
    fx.shatter(this.x, this.y - 18, [this.def.colors.glow, '#bff3ff', '#ffffff'], 0.8);
    audio.play('shatter', 0.6);
    G.ui.toast(`${this.def.name} was knocked out! Returning in 15s.`, 'warn');
  }

  private revive(): void {
    const p = G.player;
    const pos = G.world.map.nearestFree(p.x - 30, p.y + 10, 4);
    this.x = pos.x;
    this.y = pos.y;
    this.dead = false;
    this.st = 'follow';
    this.hp = this.stats.maxHp * 0.5;
    this.statuses.length = 0;
    this.iframes = 1.5;
    fx.burst(this.x, this.y - 18, this.def.colors.glow, 14, 120);
    audio.play('teleport', 0.5);
  }

  performChain(target: Actor): void {
    if (this.dead) return;
    this.casting?.cancel();
    this.casting = null;
    this.st = 'chain';
    this.chainT = 0;
    this.chainHits = 0;
    this.chainTarget = target;
    const side = angTo(target.x, target.y, this.x, this.y);
    const p = G.world.map.boxFree(target.x + Math.cos(side) * (target.radius + 18), target.y + Math.sin(side) * (target.radius + 18), this.hw, this.hh)
      ? { x: target.x + Math.cos(side) * (target.radius + 18), y: target.y + Math.sin(side) * (target.radius + 18) }
      : G.world.map.nearestFree(target.x, target.y, 3);
    this.anim.ghosts.push({ x: this.x, y: this.y, z: 0, t: 0.35, dir: this.dir });
    this.x = p.x;
    this.y = p.y;
    this.aim = angTo(this.x, this.y, target.x, target.y);
    this.dir = dirFromAngle(this.aim);
    this.iframes = 1.2;
    this.anim.glint = 0.12;
    this.anim.glintColor = this.color();
    fx.glint(this.x, this.y - 26, this.color(), 24);
  }

  private updateChain(dt: number): void {
    this.chainT += dt;
    const t = this.chainTarget;
    const times = [0.1, 0.22, 0.34, 0.46, 0.66];
    if (t && !t.dead && this.chainHits < times.length && this.chainT >= times[this.chainHits]) {
      const i = this.chainHits++;
      const last = i === times.length - 1;
      this.aim = angTo(this.x, this.y, t.x, t.y);
      const sgn = i % 2 ? 1 : -1;
      fx.ribbon(this.x, this.y, this.aim, last ? { a0: 0, a1: 0, style: 'thrust', len: 120, w: 22 } : { a0: -1.1 * sgn, a1: 1.1 * sgn, r: 54, w: 15 }, this.color(), '#ffffff');
      damage(this, t, { mult: last ? 2.4 : 1.2, brk: last ? 45 : 25, kb: last ? 200 : 40, source: 'chain', isSkill: true, forceCrit: last });
      audio.play(last ? 'crit' : 'swing', 0.8);
      if (last) {
        fx.shake(6);
        fx.ring(t.x, t.y, this.color(), 10, 110, 0.5, 6);
      }
      this.anim.kind = 'attack';
      this.anim.a0 = this.aim - 1.1 * sgn;
      this.anim.a1 = this.aim + 1.1 * sgn;
      this.anim.swing = 0;
    }
    this.anim.swing = Math.min(1, this.anim.swing + dt * 8);
    if (this.chainT >= 0.85 || !t || t.dead) {
      this.st = 'follow';
      this.chainTarget = null;
    }
  }

  private inDanger(): { x: number; y: number } | null {
    for (const tl of G.world.teles) {
      const owner = G.world.monsterById(tl.owner);
      if (!owner || tl.beam) continue;
      if (tl.dur - tl.t > 0.45) continue;
      if (hitTest(tl.shape, this.x, this.y, this.radius)) return { x: tl.shape.x, y: tl.shape.y };
    }
    return null;
  }

  private pickTarget(): void {
    const p = G.player;
    let best: Actor | null = null;
    let bd = 340;
    for (const m of G.world.monsters) {
      if (m.dead || m.spawnT > 0) continue;
      const d = dist(p.x, p.y, m.x, m.y);
      const pref = m.target === p ? d - 40 : d;
      if (pref < bd) {
        bd = pref;
        best = m;
      }
    }
    this.target = best;
  }

  private tryCast(): boolean {
    const branches = setBranches(this.save.equip.main, this.save.equip.off);
    const p = G.player;
    const t = this.target;
    const options: ActiveSkillDef[] = [];
    for (const b of branches) {
      skillsOfBranch(b).forEach((sk, i) => {
        if (this.level >= SKILL_LEVELS[i] && (this.skillCd[sk.id] ?? 0) <= 0 && this.mp >= sk.mp) options.push(sk);
      });
    }
    if (!options.length) return false;
    let pick: ActiveSkillDef | undefined;
    if (p.hp < p.stats.maxHp * 0.5) pick = options.find((s) => s.ai === 'support');
    if (!pick && this.hp < this.stats.maxHp * 0.4) pick = options.find((s) => s.ai === 'defense');
    if (!pick && t) {
      const d = dist(this.x, this.y, t.x, t.y);
      const fit = options.filter((s) => s.ai !== 'support' && s.ai !== 'defense' && d <= s.range + 20);
      if (fit.length && Math.random() < 0.45) pick = fit[Math.floor(Math.random() * fit.length)];
    }
    if (!pick) return false;
    this.mp -= pick.mp;
    this.skillCd[pick.id] = pick.cd * 1.4;
    const tx = t ? t.x : this.x + Math.cos(this.aim) * 80;
    const ty = t ? t.y : this.y + Math.sin(this.aim) * 80;
    this.aim = angTo(this.x, this.y, tx, ty);
    this.dir = dirFromAngle(this.aim);
    this.casting = new SkillRun(this, pick, tx, ty, 0.85, this.tint);
    this.st = 'skill';
    this.anim.kind = 'skill';
    this.anim.t = 0;
    this.anim.glint = 0.12;
    this.anim.glintColor = pick.color;
    fx.glint(this.x + Math.cos(this.aim) * 20, this.y - 22, pick.color, 18);
    audio.play('chime', 0.5);
    return true;
  }

  update(dt: number): void {
    if (this.tickTimers(dt)) this.refresh();
    for (const k in this.skillCd) this.skillCd[k] -= dt;
    this.atkCd -= dt;
    this.guardT -= dt;
    if (this.guardT <= 0) this.guard = false;
    if (this.st === 'down') {
      this.downT -= dt;
      if (this.downT <= 0) this.revive();
      return;
    }
    const st = this.stats;
    this.mp = Math.min(st.maxMp, this.mp + st.maxMp * 0.02 * dt);
    if (G.time - G.player.lastCombat > 5) this.hp = Math.min(st.maxHp, this.hp + st.maxHp * 0.03 * dt);
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    if (!this.canAct()) {
      this.anim.kind = 'stun';
      return;
    }
    const p = G.player;
    this.moving = false;
    if (this.st === 'chain') {
      this.updateChain(dt);
      return;
    }
    if (this.st === 'dodge') {
      this.dodgeT -= dt;
      G.world.map.move(this, Math.cos(this.dodgeAng) * 460 * dt, Math.sin(this.dodgeAng) * 460 * dt);
      this.anim.kind = 'dodge';
      if (Math.random() < 0.6) this.anim.ghosts.push({ x: this.x, y: this.y, z: 0, t: 0.2, dir: this.dir });
      if (this.dodgeT <= 0) this.st = 'follow';
      return;
    }
    if (this.st !== 'skill') {
      const danger = this.inDanger();
      if (danger) {
        if (this.save.equip.off?.aslot === 'shield' && Math.random() < 0.5) {
          this.guard = true;
          this.guardT = 0.6;
          this.aim = angTo(this.x, this.y, danger.x, danger.y);
        } else {
          this.st = 'dodge';
          this.dodgeT = 0.24;
          this.iframes = 0.3;
          this.dodgeAng = angTo(danger.x, danger.y, this.x, this.y) + rnd(-0.4, 0.4);
          this.st === 'dodge' && audio.play('dodge', 0.4);
          return;
        }
      }
    }
    if (this.st === 'skill' && this.casting) {
      this.casting.update(dt);
      if (this.casting.moveWin && this.target) {
        const a = angTo(this.x, this.y, this.target.x, this.target.y);
        G.world.map.move(this, Math.cos(a) * 110 * this.casting.moveWin.mult * dt, Math.sin(a) * 110 * this.casting.moveWin.mult * dt);
      }
      this.anim.kind = 'skill';
      if (this.casting.done) {
        this.casting = null;
        this.st = 'follow';
      }
      return;
    }
    if (this.st === 'attack') {
      this.atkT += dt;
      this.anim.swing = this.atkT / this.atkDur;
      if (!this.hitDone && this.atkT >= this.atkDur * 0.35) {
        this.hitDone = true;
        basicHit(this, this.mode, this.combo, this.aim, null, this.color(), 0, 0.85);
      }
      if (this.atkT >= this.atkDur) {
        this.st = 'follow';
        this.combo = (this.combo + 1) % COMBOS[this.mode].length;
        this.atkCd = this.combo === 0 ? 0.45 : 0.05;
      }
      return;
    }
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.25;
      this.pickTarget();
      if (this.target && this.tryCast()) return;
    }
    const t = this.target;
    const speed = 150 * st.move * this.speedMult();
    const dp = dist(this.x, this.y, p.x, p.y);
    if (dp > 520) {
      const pos = G.world.map.nearestFree(p.x - Math.cos(p.aim) * 40, p.y - Math.sin(p.aim) * 30, 4);
      this.x = pos.x;
      this.y = pos.y;
      fx.burst(this.x, this.y - 18, this.def.colors.glow, 10, 90);
      return;
    }
    if (t && !t.dead && dp < 420) {
      const d = dist(this.x, this.y, t.x, t.y);
      const ranged = this.mode === 'bow' || this.mode === 'staff';
      const want = ranged ? 190 : reachOf(this.mode) * 0.8 + t.radius;
      this.aim = angTo(this.x, this.y, t.x, t.y);
      this.dir = dirFromAngle(this.aim);
      if (d > want + 6) this.walkToward(t.x, t.y, speed, dt);
      else if (ranged && d < 120) this.walkToward(this.x * 2 - t.x, this.y * 2 - t.y, speed * 0.7, dt);
      if (d <= want + (ranged ? 200 : 14) && this.atkCd <= 0 && (!ranged || G.world.map.los(this.x, this.y - 10, t.x, t.y - 10))) {
        const h = COMBOS[this.mode][this.combo % COMBOS[this.mode].length];
        this.st = 'attack';
        this.atkT = 0;
        this.atkDur = h.dur / st.aspd;
        this.hitDone = false;
        this.anim.kind = 'attack';
        this.anim.a0 = this.aim + h.a0;
        this.anim.a1 = this.aim + h.a1;
        this.anim.hand = h.hand;
        if (!ranged) audio.play('swing', 0.35);
      }
    } else {
      const fx0 = p.x - Math.cos(p.aim) * 46;
      const fy0 = p.y - Math.sin(p.aim) * 30;
      if (dist(this.x, this.y, fx0, fy0) > 34) {
        this.walkToward(fx0, fy0, speed * (dp > 160 ? 1.25 : 1), dt);
        this.dir = dirFromAngle(angTo(this.x, this.y, fx0, fy0));
        this.aim = angTo(this.x, this.y, fx0, fy0);
      } else {
        this.aim = p.aim;
        this.dir = p.dir;
      }
    }
    this.anim.kind = this.guard ? 'block' : this.moving ? 'walk' : 'idle';
  }

  private walkToward(tx: number, ty: number, speed: number, dt: number): void {
    let a = angTo(this.x, this.y, tx, ty);
    if (!G.world.map.los(this.x, this.y, tx, ty)) {
      const fa = G.world.flowDir(this.x, this.y);
      if (fa !== null) a = fa;
    }
    G.world.map.move(this, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt);
    this.moving = true;
    this.vx = Math.cos(a) * speed;
    this.vy = Math.sin(a) * speed;
    this.anim.walk += dt * 11;
  }
}
