// The player-controlled Diver: 160ms input buffering, the cancel hierarchy, kinetic micro-lunge
// stepping, combos, dodge, block / Perfect Parry / Counter-Riposte, Sword Skills with ranks,
// Rune Morphs and Skill Connect chains, mounts with the Charge Slam, jump pads and death.
import type { Branch, MorphKind, MountDef, ResourceNode } from '../types/game';
import type { Monster } from './monster';
import { Actor } from './actor';
import { G } from '../core/state';
import { SkillRun } from '../systems/skills';
import { SKILL_BY_ID } from '../data/skills';
import { BRANCH_INFO, HOTBAR_SIZE } from '../data/constants';
import { activePowers, activeSet, gemColor, modeBranch, playerStats, setBranches, weaponMode, type WeaponMode } from '../systems/stats';
import { COMBOS, basicHit, reachOf } from '../systems/basic';
import { FRAMES } from '../data/framedata';
import { buildPlayerLook, type Look } from '../render/paperdoll';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { useConsumable, addItem } from '../systems/inventory';
import { angDiff, angTo, clamp, dirFromAngle, dist, easeOutCubic, lerp } from '../engine/util';
import { itemDef } from '../data/items';
import { MORPH_RANK, MOUNT_BY_ID, SKILL_RANK_CDR, SKILL_RANK_DMG } from '../data/v3';
import { CONNECT_MP, CONNECT_STEP, CONNECT_WINDOW, NOVA_CHAIN, connectBanner, connectFlash, finishingNova, riposteFx, style } from '../systems/feel';
import { hasPower, onDodgePowers, skillMpMult } from '../systems/powers';
import { damage, hitTest, targetsOf } from '../systems/combat';
import { Shadow } from './allies';

type PState = 'normal' | 'attack' | 'skill' | 'dodge' | 'dead' | 'gather' | 'switch' | 'charge' | 'jump';
type BufKind = 'attack' | 'skill' | 'dodge' | 'parry' | 'switch' | 'swap';

const KEYS_HOTBAR = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
const KEYS_QUICK = ['KeyZ', 'KeyX', 'KeyC'];
/** every combat input is remembered for 160ms and fires the moment it becomes legal */
export const INPUT_BUFFER = FRAMES.inputBuffer;
const STEP_FRICTION = FRAMES.stepFriction;

export class Player extends Actor {
  readonly kind = 'player' as const;
  st: PState = 'normal';
  look!: Look;
  mode: WeaponMode = 'fists';
  branches = new Set<Branch>();
  tint: string | null = null;
  weaponColor = '#dfe8ff';
  powers = new Set<string>();
  /** last enemy the Diver struck (Focus My Target gambit) */
  focus: Actor | null = null;
  // attack
  combo = 0;
  atkT = 0;
  atkDur = 0;
  atkCd = 0;
  hitDone = false;
  queued = false;
  lastAtkEnd = -9;
  riposting = false;
  stepVx = 0;
  stepVy = 0;
  // defence
  blocking = false;
  blockStart = -9;
  parryFlash = 0;
  riposteT = 0;
  dodgeT = 0;
  dodgeCd = 0;
  dodgeAng = 0;
  dodgeDur = 0.24;
  staDelay = 0;
  // skills
  skillCd: Record<string, number> = {};
  casting: SkillRun | null = null;
  chainT = 0;
  switchGauge = 0;
  flurry = 0;
  flurryT = 0;
  thousandCuts = 0;
  aegisCd = 0;
  potionCd = 0;
  // skill connect
  connectT = 0;
  connectArmed = false;
  chain = 0;
  chainSkill: string | null = null;
  connectCount = 0;
  novaPending = false;
  // buffer
  buf: { kind: BufKind; slot: number; t: number } | null = null;
  // mount & jump pads
  mounted: MountDef | null = null;
  chargeT = 0;
  jump: { x0: number; y0: number; x1: number; y1: number; t: number; dur: number } | null = null;
  // misc
  lastCombat = -99;
  deathT = 0;
  gatherT = 0;
  gatherNode: ResourceNode | null = null;
  lastMouseMove = 0;
  usingMouse = true;

  constructor() {
    super();
    this.team = 'player';
    this.hw = 6;
    this.hh = 4;
    // hurtbox 20% tighter than the 11px body: near-misses feel fair
    this.radius = 9;
    this.lvl = 0;
  }

  get displayName(): string {
    return G.save.name;
  }

  refresh(): void {
    const s = G.save;
    this.level = s.level;
    this.powers = activePowers(s);
    this.stats = playerStats(s, this.buffs, style.rank);
    if (this.mounted) this.stats.move *= this.mounted.speed;
    this.look = buildPlayerLook(s);
    const { main, off } = activeSet(s);
    this.mode = weaponMode(main, off);
    this.branches = setBranches(main, off);
    this.tint = gemColor(main);
    this.weaponColor = this.tint ?? (main ? main.colors.glow : '#dfe8ff');
    this.hp = clamp(this.hp, 0, this.stats.maxHp);
    this.mp = clamp(this.mp, 0, this.stats.maxMp);
  }

  hasShield(): boolean {
    const { off } = activeSet(G.save);
    return !!off && off.aslot === 'shield';
  }

  basicBranch(): Branch | null {
    return modeBranch(this.mode, this.hasShield());
  }

  damageBonus(t: Actor, isSkill: boolean): number {
    let b = 1;
    const fl = G.save.passives['du_p_flurry'] ?? 0;
    if (fl > 0 && this.mode === 'dual') b *= 1 + Math.min(this.flurry, 6 * fl) * 0.01;
    const hm = G.save.passives['bw_p_hunter'] ?? 0;
    if (hm > 0 && this.mode === 'bow' && dist(this.x, this.y, t.x, t.y) > 160) b *= 1 + 0.05 * hm;
    void isSkill;
    return b;
  }

  onDealtDamage(_t: Actor, crit: boolean): void {
    this.flurry++;
    this.flurryT = 1.5;
    if (G.save.keystones.includes('ks_dual')) {
      this.thousandCuts = this.flurryT > 0 ? this.thousandCuts + 1 : 1;
      if (this.thousandCuts >= 10) {
        this.thousandCuts = 0;
        this.thousandCutsFlurry();
      }
    }
    if (crit && G.save.awakenings.includes('aw_dual') && Math.random() < 0.1) {
      let any = false;
      for (const k of Object.keys(this.skillCd)) {
        if (this.skillCd[k] > 0) any = true;
        this.skillCd[k] = 0;
      }
      if (any) {
        fx.number(this.x, this.y - 56, 'COOLDOWN RESET', '#b07bff', 14);
        audio.play('chime');
      }
    }
  }

  private thousandCutsFlurry(): void {
    fx.number(this.x, this.y - 64, 'THOUSAND CUTS', '#b07bff', 15);
    for (let i = 0; i < 3; i++) {
      G.world.after(i * 0.09, () => {
        if (this.dead) return;
        fx.ribbon(this.x, this.y, this.aim + i * 2.1, { a0: -Math.PI, a1: Math.PI, r: 62, w: 8 }, '#b07bff', '#ffffff');
        const shape = { kind: 'circle' as const, x: this.x, y: this.y, r: 74 };
        for (const t of targetsOf(this)) if (!t.dead && hitTest(shape, t.x, t.y, t.radius)) damage(this, t, { mult: 0.55, source: 'reflect', kb: 30, brk: 3 });
        audio.play('swing2', 0.6);
      });
    }
  }

  onKill(_m: Monster): void {
    this.lastCombat = G.time;
  }

  onHurt(): void {
    if (this.st === 'gather') {
      this.st = 'normal';
      this.gatherNode = null;
    }
    if (this.mounted && this.lastDmg >= this.stats.maxHp * 0.08) this.dismount(true);
  }

  checkEmergencyAegis(): void {
    if (!G.save.awakenings.includes('aw_aegis') || this.aegisCd > 0 || this.dead) return;
    if (this.hp > 0 && this.hp < this.stats.maxHp * 0.4) {
      this.aegisCd = 45;
      this.barrier = Math.max(this.barrier, this.stats.maxHp * 0.3);
      this.barrierT = 8;
      fx.ring(this.x, this.y, '#ffd166', 10, 110, 0.6, 6);
      fx.burst(this.x, this.y - 20, '#fff1a8', 20, 140);
      fx.banner('DIVINE AEGIS', '#ffd166', 'Emergency barrier deployed', 40, 1.1);
      audio.play('awaken', 0.6);
    }
  }

  // ---------------------------------------------------------------- update

  update(dt: number): void {
    const inp = G.input;
    if (this.tickTimers(dt)) this.refresh();
    for (const k in this.skillCd) if (this.skillCd[k] > 0) this.skillCd[k] -= dt;
    this.atkCd -= dt;
    this.dodgeCd -= dt;
    this.potionCd -= dt;
    this.chainT -= dt;
    this.aegisCd -= dt;
    this.parryFlash -= dt;
    this.staDelay -= dt;
    this.flurryT -= dt;
    if (this.riposteT > 0) this.riposteT -= dt;
    if (this.flurryT <= 0) {
      this.flurry = 0;
      this.thousandCuts = 0;
    }
    if (this.dead) {
      this.updateDeath(dt);
      return;
    }
    // regeneration
    const st = this.stats;
    if (this.staDelay <= 0 && !this.blocking && this.st !== 'dodge') this.sta = Math.min(st.maxSta, this.sta + 42 * dt);
    this.mp = Math.min(st.maxMp, this.mp + st.maxMp * 0.012 * st.mpRegen * dt);
    let hpRegen = 0;
    for (const b of this.buffs) hpRegen += b.spec.hpRegen ?? 0;
    if (G.time - this.lastCombat > 6) hpRegen += 0.02;
    if (hpRegen > 0) this.hp = Math.min(st.maxHp, this.hp + st.maxHp * hpRegen * dt);

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    // aiming
    const mw = G.game.mouseWorld();
    if (performance.now() - inp.lastMouseMove < 50) this.usingMouse = true;
    const mouseAim = angTo(this.x, this.y - 14, mw.x, mw.y);
    const control = this.canAct() && !G.world.transition && !G.game.uiBlocking();
    // movement intent
    let mx = 0;
    let my = 0;
    if (control) {
      if (inp.isDown('KeyA', 'ArrowLeft')) mx -= 1;
      if (inp.isDown('KeyD', 'ArrowRight')) mx += 1;
      if (inp.isDown('KeyW', 'ArrowUp')) my -= 1;
      if (inp.isDown('KeyS', 'ArrowDown')) my += 1;
    }
    const ml = Math.hypot(mx, my);
    if (ml > 0) {
      mx /= ml;
      my /= ml;
    }
    const canAim = this.st === 'normal' || (this.st === 'skill' && !!this.casting?.moveWin);
    if (canAim) {
      if (this.usingMouse) this.aim = mouseAim;
      else if (ml > 0) this.aim = Math.atan2(my, mx);
    }

    if (control) {
      this.retryBuffer(mouseAim, mx, my);
      this.handleActions(mouseAim, mx, my);
    }
    this.updateConnect(dt);

    // kinetic micro-lunge (friction 0.84 per 60Hz frame)
    if (Math.abs(this.stepVx) + Math.abs(this.stepVy) > 2) {
      G.world.map.move(this, this.stepVx * dt, this.stepVy * dt);
      const k = Math.pow(STEP_FRICTION, dt * 60);
      this.stepVx *= k;
      this.stepVy *= k;
    } else this.stepVx = this.stepVy = 0;

    // state machine
    const baseSpeed = 150 * st.move * this.speedMult();
    this.moving = false;
    switch (this.st) {
      case 'normal': {
        const sp = baseSpeed * (this.blocking ? 0.45 : 1);
        if (ml > 0 && sp > 0) {
          G.world.map.move(this, mx * sp * dt, my * sp * dt);
          this.moving = true;
          this.anim.walk += dt * (this.mounted ? 7 : 11) * (sp / 150);
        }
        this.vx = mx * sp;
        this.vy = my * sp;
        this.anim.kind = this.blocking ? 'block' : this.moving ? 'walk' : 'idle';
        break;
      }
      case 'attack':
        this.updateAttack(dt, mx, my, baseSpeed);
        break;
      case 'skill': {
        const c = this.casting;
        if (!c) {
          this.st = 'normal';
          break;
        }
        c.update(dt);
        if (c.moveWin && ml > 0) {
          const sp = baseSpeed * c.moveWin.mult;
          G.world.map.move(this, mx * sp * dt, my * sp * dt);
          this.moving = true;
          this.anim.walk += dt * 10;
        }
        this.anim.kind = 'skill';
        if (this.mode === 'bow') this.anim.charge = Math.min(1, this.anim.charge + dt * 3);
        if (c.done) {
          this.casting = null;
          this.st = 'normal';
          this.anim.charge = 0;
          if (c.morph === 'clone') this.evasiveStep();
        }
        break;
      }
      case 'dodge': {
        this.dodgeT -= dt;
        const k = Math.max(0, this.dodgeT / this.dodgeDur);
        const sp = 140 + 520 * k;
        G.world.map.move(this, Math.cos(this.dodgeAng) * sp * dt, Math.sin(this.dodgeAng) * sp * dt);
        if (Math.random() < 0.7) this.anim.ghosts.push({ x: this.x, y: this.y, z: 0, t: 0.22, dir: this.dir });
        this.anim.kind = 'dodge';
        this.moving = true;
        if (this.dodgeT <= 0) this.st = 'normal';
        break;
      }
      case 'charge':
        this.updateCharge(dt);
        break;
      case 'jump':
        this.updateJump(dt);
        break;
      case 'gather': {
        this.gatherT -= dt;
        this.anim.kind = 'attack';
        this.anim.swing = (this.gatherT * 2.2) % 1;
        if (Math.random() < dt * 6 && this.gatherNode) fx.sparks(this.gatherNode.x, this.gatherNode.y - 10, this.gatherNode.kind === 'ore' ? '#ffe9a8' : '#9be15d', 2, 80);
        if (Math.random() < dt * 3) audio.play('gather', 0.6);
        if (ml > 0) {
          this.st = 'normal';
          this.gatherNode = null;
        } else if (this.gatherT <= 0) this.finishGather();
        break;
      }
      case 'switch':
        if (this.casting) {
          this.casting.update(dt);
          if (this.casting.done) {
            this.casting = null;
            this.st = 'normal';
          }
        } else this.st = 'normal';
        this.anim.kind = 'dodge';
        break;
      case 'dead':
        break;
    }
    // facing
    const faceAngle = this.st === 'normal' && !this.blocking && !this.usingMouse && ml > 0 ? Math.atan2(my, mx) : this.aim;
    this.dir = dirFromAngle(faceAngle);
    if (this.st === 'normal' && !this.usingMouse && ml > 0) this.dir = dirFromAngle(Math.atan2(my, mx));
  }

  // ---------------------------------------------------------------- input & buffer

  private bufferInput(kind: BufKind, slot = 0): void {
    this.buf = { kind, slot, t: G.time };
  }

  private retryBuffer(aim: number, mx: number, my: number): void {
    const b = this.buf;
    if (!b) return;
    if (G.time - b.t > INPUT_BUFFER) {
      this.buf = null;
      return;
    }
    let ok = false;
    switch (b.kind) {
      case 'attack':
        ok = this.startAttack(aim);
        break;
      case 'skill':
        ok = this.tryCast(b.slot, aim, true);
        break;
      case 'dodge':
        ok = this.tryDodge(mx, my);
        break;
      case 'parry':
        ok = this.tryBlock(true);
        break;
      case 'switch':
        ok = this.trySwitch();
        break;
      case 'swap':
        ok = this.swapSet();
        break;
    }
    if (ok) this.buf = null;
  }

  private handleActions(mouseAim: number, mx: number, my: number): void {
    const inp = G.input;
    const s = G.save;
    if (inp.pressed('KeyQ') && !this.swapSet()) this.bufferInput('swap');
    if (inp.pressed('KeyR', 'Tab') && !this.trySwitch()) this.bufferInput('switch');
    if (inp.pressed('Space') && !this.tryDodge(mx, my)) this.bufferInput('dodge');
    if (inp.pressed('KeyV')) this.toggleMount();
    for (let i = 0; i < HOTBAR_SIZE; i++) if (inp.pressed(KEYS_HOTBAR[i]) && !this.tryCast(i, mouseAim)) this.bufferInput('skill', i);
    for (let i = 0; i < 3; i++) {
      if (inp.pressed(KEYS_QUICK[i])) {
        const id = s.quick[i];
        if (!id) G.ui.toast('Assign a consumable to this quick slot in the inventory (I).', 'info');
        else if (this.potionCd > 0) audio.play('error');
        else if (useConsumable(id)) this.potionCd = 0.8;
        else {
          G.ui.toast(`Out of ${itemDef(id).name}.`, 'warn');
          audio.play('error');
        }
      }
    }
    const blockHeld = (!G.game.decorating && inp.mouseDown(2)) || inp.isDown('ShiftLeft', 'ShiftRight');
    const blockPressed = (!G.game.decorating && inp.mousePressed(2)) || inp.pressed('ShiftLeft', 'ShiftRight');
    if (blockHeld) {
      if (!this.tryBlock(blockPressed) && blockPressed) this.bufferInput('parry');
    } else this.blocking = false;
    if ((inp.mousePressed(0) || inp.pressed('KeyJ')) && !this.blocking) {
      if (inp.mousePressed(0)) this.usingMouse = true;
      if (!this.startAttack(mouseAim)) this.bufferInput('attack');
    }
    if (inp.pressed('KeyE', 'KeyF')) G.world.interactNearest();
  }

  /** cancel windows: basic attack recovery, skill Pre-Motion and skill recovery */
  private canCancelAttack(): boolean {
    return this.st === 'attack' && this.hitDone;
  }

  private canCancelSkill(): boolean {
    const c = this.casting;
    return this.st === 'skill' && !!c && (c.preMotion || c.eventsDone);
  }

  private cancelCasting(): void {
    this.casting?.cancel();
    this.casting = null;
    this.anim.charge = 0;
  }

  tryBlock(fresh: boolean): boolean {
    if (this.sta <= 0 || this.mounted) return false;
    if (this.st === 'attack' && this.canCancelAttack()) this.st = 'normal';
    else if (this.st === 'skill' && this.canCancelSkill()) {
      this.cancelCasting();
      this.st = 'normal';
    }
    if (this.st !== 'normal') return false;
    if (!this.blocking || fresh) this.blockStart = G.time;
    this.blocking = true;
    return true;
  }

  trySwitch(): boolean {
    if (this.st === 'skill' && !this.canCancelSkill()) return false;
    if (this.st === 'attack' && !this.canCancelAttack()) return false;
    G.world.trySwitch();
    return true;
  }

  swapSet(): boolean {
    const s = G.save;
    if (this.casting || (this.st !== 'normal' && !this.canCancelAttack())) return false;
    s.activeSet = s.activeSet === 'A' ? 'B' : 'A';
    this.refresh();
    this.st = 'normal';
    const { main } = activeSet(s);
    fx.glint(this.x, this.y - 30, this.weaponColor, 16);
    audio.play('ui');
    G.ui.toast(`Weapon Set ${s.activeSet}: ${main ? main.customName ?? main.name : 'Unarmed'}`, 'info');
    return true;
  }

  tryDodge(mx: number, my: number): boolean {
    if (this.dodgeCd > 0 || this.sta < FRAMES.dodgeMinStamina) return false;
    if (this.st === 'attack') {
      if (!this.canCancelAttack() && this.atkT < this.atkDur * FRAMES.dodgeCancelFrac) return false;
    } else if (this.st === 'skill') {
      if (!this.canCancelSkill()) return false;
      this.cancelCasting();
    } else if (this.st !== 'normal') return false;
    if (this.mounted) this.dismount(false);
    this.st = 'dodge';
    this.dodgeDur = FRAMES.dodgeDur;
    this.dodgeT = FRAMES.dodgeDur;
    this.iframes = Math.max(this.iframes, FRAMES.dodgeIframes);
    this.dodgeCd = FRAMES.dodgeCooldown;
    this.dodgeAng = mx || my ? Math.atan2(my, mx) : this.aim;
    this.sta -= FRAMES.dodgeStamina;
    this.staDelay = 0.6;
    this.blocking = false;
    this.stepVx = this.stepVy = 0;
    fx.dust(this.x, this.y, 6);
    audio.play('dodge');
    onDodgePowers(this.dodgeAng);
    return true;
  }

  /** Shadow-Clone rune: a short evasive hop after the skill */
  private evasiveStep(): void {
    this.st = 'dodge';
    this.dodgeDur = FRAMES.evasiveDur;
    this.dodgeT = FRAMES.evasiveDur;
    this.dodgeAng = this.aim + Math.PI;
    this.iframes = Math.max(this.iframes, FRAMES.evasiveIframes);
    fx.dust(this.x, this.y, 4);
  }

  startAttack(aim: number): boolean {
    if (this.mounted) {
      if (this.st !== 'normal') return false;
      this.chargeSlam(aim);
      return true;
    }
    if (this.atkCd > 0) return false;
    if (this.st === 'attack') {
      if (this.atkT > this.atkDur * FRAMES.hitFrac) this.queued = true;
      return true;
    }
    if (this.st === 'skill' && this.canCancelSkill() && this.casting?.eventsDone) {
      this.cancelCasting();
      this.st = 'normal';
    }
    if (this.st !== 'normal') return false;
    const list = COMBOS[this.mode];
    this.riposting = this.riposteT > 0;
    if (this.riposting) {
      this.riposteT = 0;
      this.combo = list.length - 1;
    } else if (G.time - this.lastAtkEnd < FRAMES.comboChain && this.combo < list.length - 1) this.combo++;
    else this.combo = 0;
    const h = list[this.combo];
    this.aim = aim;
    this.atkDur = (h.dur / this.stats.aspd) * (this.riposting ? FRAMES.riposteSpeed : 1);
    this.atkT = 0;
    this.hitDone = false;
    this.st = 'attack';
    this.blocking = false;
    this.anim.kind = 'attack';
    this.anim.a0 = aim + h.a0;
    this.anim.a1 = aim + h.a1;
    this.anim.hand = h.hand;
    this.anim.swing = 0;
    this.dir = dirFromAngle(aim);
    if (this.mode !== 'bow' && this.mode !== 'staff') {
      audio.play(this.combo % 2 ? 'swing2' : 'swing', 0.8);
      this.kineticStep(aim, this.combo === list.length - 1 || this.riposting);
    }
    return true;
  }

  /** 110-260 px/s impulse toward the cursor / nearest target, stopping short of it */
  private kineticStep(aim: number, heavy: boolean): void {
    let sp = heavy ? FRAMES.stepHeavy : FRAMES.stepLight + FRAMES.stepPerHit * this.combo;
    const reach = reachOf(this.mode);
    let best: Actor | null = null;
    let bd = reach * 1.9;
    for (const t of targetsOf(this)) {
      if (t.dead) continue;
      const d = dist(this.x, this.y, t.x, t.y);
      if (d < bd && Math.abs(angDiff(aim, angTo(this.x, this.y, t.x, t.y))) < 0.6) {
        bd = d;
        best = t;
      }
    }
    if (best) {
      const gap = bd - (best.radius + 14);
      sp = gap < 6 ? 0 : Math.min(sp, gap * 9.6);
    }
    sp = clamp(sp, 0, FRAMES.stepHeavy);
    this.stepVx = Math.cos(aim) * sp;
    this.stepVy = Math.sin(aim) * sp;
  }

  private updateAttack(dt: number, mx: number, my: number, baseSpeed: number): void {
    this.atkT += dt;
    this.anim.swing = this.atkT / this.atkDur;
    if (mx || my) {
      G.world.map.move(this, mx * baseSpeed * FRAMES.attackMoveMult * dt, my * baseSpeed * FRAMES.attackMoveMult * dt);
      this.anim.walk += dt * 5;
    }
    if (!this.hitDone && this.atkT >= this.atkDur * FRAMES.hitFrac) {
      this.hitDone = true;
      let reach = 0.08 * (G.save.passives['sp_p_reach'] ?? 0);
      if (hasPower('u_dragonbone') && (this.mode === 'spear' || this.mode === 'halberd')) reach += 0.3;
      const finisher = this.combo === COMBOS[this.mode].length - 1;
      const n = basicHit(this, this.mode, this.combo, this.aim, this.basicBranch(), this.weaponColor, reach, this.riposting ? FRAMES.riposteMult : 1, this.riposting);
      if (this.riposting) riposteFx(this);
      this.riposting = false;
      if (n > 0 && this.mode !== 'bow' && this.mode !== 'staff') fx.shake(1.5);
      if (finisher && this.mode === 'sword' && G.save.keystones.includes('ks_sword')) {
        G.world.spawnProjectile(this, { kind: 'shard', speed: 560, mult: 0.8, range: 320, pierce: true, color: this.weaponColor, brk: 6, radius: 12 }, this.aim, this.x, this.y, 'sword');
      }
      if (hasPower('p_echo') && Math.random() < 0.15) {
        const combo = this.combo;
        const aim = this.aim;
        G.world.after(0.12, () => {
          if (!this.dead) basicHit(this, this.mode, combo, aim, this.basicBranch(), '#7fe9ff', reach, 0.8);
        });
      }
    }
    if (this.atkT >= this.atkDur) {
      this.st = 'normal';
      this.lastAtkEnd = G.time;
      const list = COMBOS[this.mode];
      if (this.combo >= list.length - 1) this.atkCd = FRAMES.finisherCooldown / this.stats.aspd;
      if (this.queued) {
        this.queued = false;
        this.startAttack(G.game.mouseAimFor(this));
      }
    }
  }

  // ---------------------------------------------------------------- sword skills & skill connect

  tryCast(slot: number, aim: number, buffered = false): boolean {
    const s = G.save;
    const id = s.hotbar[slot];
    if (!id) return true;
    const def = SKILL_BY_ID[id];
    if (!def) return true;
    if (this.mounted) {
      if (!buffered) G.ui.toast('Dismount (V) to use Sword Skills.', 'info');
      return true;
    }
    if (this.st === 'dodge' || this.st === 'switch' || this.st === 'gather' || this.st === 'charge' || this.st === 'jump') return false;
    let via: 'none' | 'cancel' | 'connect' = 'none';
    if (this.st === 'attack') {
      if (!this.canCancelAttack()) return false;
      via = 'cancel';
    } else if (this.st === 'skill') {
      const c = this.casting;
      if (!c || c.def.id === id || !c.eventsDone || this.connectT <= 0) return false;
      via = 'connect';
    } else if (this.connectT > 0 && this.chainSkill && this.chainSkill !== id && this.chain > 0) via = 'connect';
    if (!this.branches.has(def.branch)) {
      if (!buffered) {
        G.ui.toast(`${def.name} requires: ${BRANCH_INFO[def.branch].req}.`, 'warn');
        audio.play('error');
      }
      return true;
    }
    if ((this.skillCd[id] ?? 0) > 0) {
      if (!buffered) audio.play('error');
      return true;
    }
    let cost = def.mp * skillMpMult(def.branch === 'magic');
    if (via === 'connect') cost *= hasPower('s6_nightfall') ? 0 : CONNECT_MP;
    if (this.mp < cost) {
      if (!buffered) {
        G.ui.toast('Not enough MP.', 'warn');
        audio.play('error');
      }
      return true;
    }
    // ---- commit
    if (this.st === 'attack') this.st = 'normal';
    if (this.casting) this.cancelCasting();
    this.mp -= cost;
    const rank = s.skillRanks[id] ?? 1;
    let cd = def.cd * (1 - SKILL_RANK_CDR * (rank - 1)) * (1 - this.stats.cdr);
    if (hasPower('u_dawnspark')) cd /= Math.max(1, this.stats.aspd);
    this.skillCd[id] = cd;
    if (def.branch === 'magic') {
      const echo = s.passives['mg_p_echo'] ?? 0;
      if (echo > 0 && Math.random() < 0.06 * echo) {
        this.skillCd[id] = 0;
        fx.number(this.x, this.y - 58, 'SPELL ECHO', '#c18cff', 13);
      }
    }
    this.aim = aim;
    this.dir = dirFromAngle(aim);
    this.blocking = false;
    const mastery = s.mastery[def.branch].rank;
    let mult = (1 + mastery * 0.01) * (1 + SKILL_RANK_DMG * (rank - 1));
    if (this.chainT > 0) {
      mult *= 1 + FRAMES.switchBonus;
      this.chainT = 0;
      fx.number(this.x, this.y - 60, 'SWITCH COMBO +35%', '#7fe9ff', 14);
    }
    if (via === 'connect') {
      this.chain = Math.min(NOVA_CHAIN, this.chain + 1);
      const per = CONNECT_STEP + (hasPower('s6_nightfall') ? 0.1 : 0);
      mult *= 1 + per * (this.chain - 1);
      this.connectCount++;
      connectBanner(this.chain, false);
    } else if (via === 'cancel') {
      this.chain = 1;
      mult *= 1 + FRAMES.cancelBonus;
      connectBanner(1, true);
    } else this.chain = 1;
    this.connectT = 0;
    this.connectArmed = false;
    this.chainSkill = id;
    this.novaPending = this.chain >= NOVA_CHAIN;
    const morph: MorphKind | null = rank >= MORPH_RANK ? (s.morphs[id] ?? null) : null;
    const mw = G.game.mouseWorld();
    this.casting = new SkillRun(this, def, mw.x, mw.y, mult, this.tint, morph);
    this.st = 'skill';
    this.anim.kind = 'skill';
    this.anim.t = 0;
    this.anim.charge = 0;
    this.anim.glint = 0.12;
    this.anim.glintColor = def.color;
    this.stepVx = this.stepVy = 0;
    fx.glint(this.x + Math.cos(aim) * 22, this.y - 22 + Math.sin(aim) * 8, def.color, 22);
    audio.play('chime');
    if (via === 'connect' && hasPower('u_nightfall') && this.connectCount % 3 === 0) {
      G.world.shadows.push(new Shadow(this, def, mw.x, mw.y, mult * 0.6, this.connectCount % 2 ? 1 : -1));
      fx.number(this.x, this.y - 84, 'SHADOW DOPPELGANGER', '#7fe9ff', 15);
    }
    return true;
  }

  /** opens the 0.30s Skill Connect window after a skill's final strike; fires the Nova */
  private updateConnect(dt: number): void {
    const c = this.casting;
    if (c && this.st === 'skill' && c.eventsDone && !this.connectArmed) {
      this.connectArmed = true;
      if (this.novaPending) {
        this.novaPending = false;
        finishingNova(this, this.chain);
        this.chain = 0;
        this.connectT = 0;
        this.chainSkill = null;
        return;
      }
      this.connectT = CONNECT_WINDOW;
      connectFlash(this);
    }
    if (this.connectT > 0) {
      this.connectT -= dt;
      if (this.connectT <= 0 && this.st !== 'skill') {
        this.chain = 0;
        this.chainSkill = null;
      }
    }
  }

  // ---------------------------------------------------------------- mounts & jump pads

  toggleMount(): void {
    if (this.mounted) {
      this.dismount(false);
      return;
    }
    const s = G.save;
    const kind = G.world.map.kind;
    if (!s.mount) {
      G.ui.toast(s.mounts.length ? 'Choose an active mount in the Stable (P).' : 'Buy a mount from the Stablemaster in the Stable (P).', 'info');
      return;
    }
    if (kind !== 'wild' && kind !== 'city') {
      G.ui.toast('Mounts can only be ridden in cities and the open wilds.', 'info');
      return;
    }
    if (this.st !== 'normal') return;
    if (G.time - this.lastCombat < 2.5) {
      G.ui.toast('You cannot summon your mount in the heat of battle.', 'warn');
      return;
    }
    this.mounted = MOUNT_BY_ID[s.mount] ?? null;
    if (!this.mounted) return;
    this.refresh();
    fx.burst(this.x, this.y - 10, this.mounted.colors[2], 16, 120);
    fx.dust(this.x, this.y, 10);
    audio.play('teleport', 0.5);
  }

  dismount(thrown: boolean): void {
    if (!this.mounted) return;
    const col = this.mounted.colors[2];
    this.mounted = null;
    this.refresh();
    fx.burst(this.x, this.y - 10, col, 10, 90);
    if (thrown) fx.number(this.x, this.y - 50, 'DISMOUNTED', '#ffb3bb', 13);
  }

  /** Mounted Charge Slam: a galloping dash that ends in a knockback shockwave */
  private chargeSlam(aim: number): void {
    this.st = 'charge';
    this.chargeT = FRAMES.chargeDur;
    this.aim = aim;
    this.dir = dirFromAngle(aim);
    this.iframes = Math.max(this.iframes, FRAMES.chargeIframes);
    audio.play('dodge');
    fx.dust(this.x, this.y, 8);
  }

  private updateCharge(dt: number): void {
    this.chargeT -= dt;
    const res = G.world.map.move(this, Math.cos(this.aim) * 540 * dt, Math.sin(this.aim) * 540 * dt);
    this.moving = true;
    this.anim.walk += dt * 18;
    this.anim.kind = 'walk';
    if (Math.random() < 0.8) this.anim.ghosts.push({ x: this.x, y: this.y, z: 0, t: 0.22, dir: this.dir });
    if (this.chargeT > 0 && !res.hitX && !res.hitY) return;
    this.st = 'normal';
    const R = 96;
    const shape = { kind: 'circle' as const, x: this.x + Math.cos(this.aim) * 20, y: this.y + Math.sin(this.aim) * 14, r: R };
    let n = 0;
    for (const t of targetsOf(this)) {
      if (t.dead || !hitTest(shape, t.x, t.y, t.radius)) continue;
      damage(this, t, { mult: 1.9, kb: 320, kbAngle: angTo(this.x, this.y, t.x, t.y), brk: 25, source: 'skill', isSkill: true, branch: null });
      n++;
    }
    fx.ring(shape.x, shape.y, this.mounted?.colors[2] ?? '#ffd166', 10, R, 0.45, 6);
    fx.dust(shape.x, shape.y, 16);
    fx.shake(6);
    audio.play('quake', 0.7);
    fx.number(this.x, this.y - 64, 'CHARGE SLAM!', '#ffd166', 18);
    G.save.counters.chargeSlams++;
    if (n > 0) style.add(100, 'Charge Slam');
    this.dismount(false);
  }

  jumpTo(x: number, y: number): void {
    if (this.st !== 'normal' || this.jump) return;
    this.jump = { x0: this.x, y0: this.y, x1: x, y1: y, t: 0, dur: 0.62 };
    this.st = 'jump';
    this.iframes = Math.max(this.iframes, 0.6);
    fx.ring(this.x, this.y, '#7fe9ff', 6, 40, 0.3, 3);
    audio.play('wind', 0.7);
  }

  private updateJump(dt: number): void {
    const j = this.jump;
    if (!j) {
      this.st = 'normal';
      return;
    }
    j.t += dt;
    const k = Math.min(1, j.t / j.dur);
    const e = easeOutCubic(k);
    this.x = lerp(j.x0, j.x1, e);
    this.y = lerp(j.y0, j.y1, e);
    this.z = Math.sin(Math.PI * k) * 74;
    this.anim.kind = 'dodge';
    if (Math.random() < 0.6) fx.particle(this.x, this.y, { z: this.z, kind: 'glow', color: '#7fe9ff', size: 2.5, max: 0.4, vx: 0, vy: 0, drag: 2 });
    if (k >= 1) {
      this.z = 0;
      this.jump = null;
      this.st = 'normal';
      G.world.map.settle(this);
      fx.dust(this.x, this.y, 10);
      audio.play('quake', 0.25);
    }
  }

  // ---------------------------------------------------------------- gathering

  beginGather(n: ResourceNode): void {
    if (this.st !== 'normal' || !n.ready) return;
    if (this.mounted) this.dismount(false);
    this.st = 'gather';
    this.gatherNode = n;
    this.gatherT = n.kind === 'ore' ? 1.1 : 0.6;
    this.aim = angTo(this.x, this.y, n.x, n.y);
    this.dir = dirFromAngle(this.aim);
  }

  private finishGather(): void {
    const n = this.gatherNode;
    this.st = 'normal';
    this.gatherNode = null;
    if (!n || !n.ready) return;
    n.ready = false;
    n.respawn = 45;
    const qty = 1 + (Math.random() < 0.45 ? 1 : 0) + (hasPower('s6_anvil') && Math.random() < 0.25 ? 1 : 0);
    addItem(n.item, qty);
    G.save.counters.gathered++;
    fx.burst(n.x, n.y - 10, n.kind === 'ore' ? '#ffe9a8' : '#9be15d', 10, 90);
    fx.number(n.x, n.y - 30, `+${qty} ${itemDef(n.item).name}`, '#e6edf7', 13);
    audio.play('pickup');
  }

  // ---------------------------------------------------------------- death

  die(): void {
    if (this.dead) return;
    this.dead = true;
    this.st = 'dead';
    this.deathT = 0;
    this.casting?.cancel();
    this.casting = null;
    this.blocking = false;
    this.mounted = null;
    this.jump = null;
    this.chain = 0;
    this.connectT = 0;
    this.buf = null;
    style.reset();
    this.anim.kind = 'dead';
    fx.flash('#ff2a40', 0.4);
    fx.banner('HP CRITICAL', '#ff5d6c', 'Emergency Crystal Teleport initiated...', 54, 1.8);
    audio.play('death');
    G.game.slowmo(0.6, 0.3);
  }

  private updateDeath(dt: number): void {
    this.deathT += dt;
    if (this.deathT > 0.5 && this.deathT - dt <= 0.5) {
      fx.shatter(this.x, this.y - 18, ['#7fe9ff', '#bff3ff', '#4aa8ff', '#ffffff'], 1.1);
      audio.play('shatter');
      audio.play('teleport');
    }
    if (this.deathT >= 1.7) G.world.respawnPlayer();
  }

  revive(): void {
    this.dead = false;
    this.st = 'normal';
    this.anim.kind = 'idle';
    this.hp = this.stats.maxHp;
    this.mp = this.stats.maxMp;
    this.sta = this.stats.maxSta;
    this.statuses.length = 0;
    this.iframes = 2;
    this.kbx = this.kby = 0;
    this.stepVx = this.stepVy = 0;
    this.z = 0;
    this.refresh();
  }
}
