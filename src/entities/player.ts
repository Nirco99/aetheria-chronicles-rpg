// The player-controlled Diver: input, movement, combos, dodge, block/parry, skills and death.
import type { Branch, ResourceNode } from '../types/game';
import type { Monster } from './monster';
import { Actor } from './actor';
import { G } from '../core/state';
import { SkillRun } from '../systems/skills';
import { SKILL_BY_ID } from '../data/skills';
import { BRANCH_INFO, HOTBAR_SIZE } from '../data/constants';
import { activeSet, gemColor, modeBranch, playerStats, setBranches, weaponMode, type WeaponMode } from '../systems/stats';
import { COMBOS, basicHit } from '../systems/basic';
import { buildPlayerLook, type Look } from '../render/paperdoll';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { useConsumable, addItem } from '../systems/inventory';
import { angTo, clamp, dirFromAngle, dist } from '../engine/util';
import { itemDef } from '../data/items';

type PState = 'normal' | 'attack' | 'skill' | 'dodge' | 'dead' | 'gather' | 'switch';

const KEYS_HOTBAR = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
const KEYS_QUICK = ['KeyZ', 'KeyX', 'KeyC'];

export class Player extends Actor {
  readonly kind = 'player' as const;
  st: PState = 'normal';
  look!: Look;
  mode: WeaponMode = 'fists';
  branches = new Set<Branch>();
  tint: string | null = null;
  weaponColor = '#dfe8ff';
  // attack
  combo = 0;
  atkT = 0;
  atkDur = 0;
  atkCd = 0;
  hitDone = false;
  queued = false;
  lastAtkEnd = -9;
  // defence
  blocking = false;
  blockStart = -9;
  parryFlash = 0;
  dodgeT = 0;
  dodgeCd = 0;
  dodgeAng = 0;
  staDelay = 0;
  // skills
  skillCd: Record<string, number> = {};
  casting: SkillRun | null = null;
  chainT = 0;
  switchGauge = 0;
  flurry = 0;
  flurryT = 0;
  aegisCd = 0;
  potionCd = 0;
  // misc
  lastCombat = -99;
  deathT = 0;
  gatherT = 0;
  gatherNode: ResourceNode | null = null;
  lastMouseAim = 0;
  usingMouse = true;

  constructor() {
    super();
    this.team = 'player';
    this.hw = 6;
    this.hh = 4;
    this.radius = 11;
  }

  get displayName(): string {
    return G.save.name;
  }

  refresh(): void {
    const s = G.save;
    this.level = s.level;
    this.stats = playerStats(s, this.buffs);
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

  onKill(_m: Monster): void {
    this.lastCombat = G.time;
  }

  onHurt(): void {
    if (this.st === 'gather') {
      this.st = 'normal';
      this.gatherNode = null;
    }
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
    if (this.flurryT <= 0) this.flurry = 0;
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

    if (control) this.handleActions(mouseAim, mx, my);

    // state machine
    const baseSpeed = 150 * st.move * this.speedMult();
    this.moving = false;
    switch (this.st) {
      case 'normal': {
        const sp = baseSpeed * (this.blocking ? 0.45 : 1);
        if (ml > 0 && sp > 0) {
          G.world.map.move(this, mx * sp * dt, my * sp * dt);
          this.moving = true;
          this.anim.walk += dt * 11 * (sp / 150);
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
        }
        break;
      }
      case 'dodge': {
        this.dodgeT -= dt;
        const k = Math.max(0, this.dodgeT / 0.24);
        const sp = 140 + 520 * k;
        G.world.map.move(this, Math.cos(this.dodgeAng) * sp * dt, Math.sin(this.dodgeAng) * sp * dt);
        if (Math.random() < 0.7) this.anim.ghosts.push({ x: this.x, y: this.y, z: 0, t: 0.22, dir: this.dir });
        this.anim.kind = 'dodge';
        this.moving = true;
        if (this.dodgeT <= 0) this.st = 'normal';
        break;
      }
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

  private handleActions(mouseAim: number, mx: number, my: number): void {
    const inp = G.input;
    const s = G.save;
    if (inp.pressed('KeyQ') && (this.st === 'normal' || this.st === 'attack')) this.swapSet();
    if (inp.pressed('KeyR', 'Tab')) G.world.trySwitch();
    if (inp.pressed('Space')) this.tryDodge(mx, my);
    for (let i = 0; i < HOTBAR_SIZE; i++) if (inp.pressed(KEYS_HOTBAR[i])) this.tryCast(i, mouseAim);
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
    const canBlock = this.st === 'normal' && this.sta > 0;
    if (blockHeld && canBlock) {
      if (!this.blocking) this.blockStart = G.time;
      this.blocking = true;
    } else this.blocking = false;
    if ((inp.mousePressed(0) || inp.pressed('KeyJ')) && !this.blocking) {
      if (inp.mousePressed(0)) this.usingMouse = true;
      this.startAttack(mouseAim);
    }
    if (inp.pressed('KeyE', 'KeyF')) G.world.interactNearest();
  }

  swapSet(): void {
    const s = G.save;
    if (this.casting) return;
    s.activeSet = s.activeSet === 'A' ? 'B' : 'A';
    this.refresh();
    this.st = 'normal';
    const { main } = activeSet(s);
    fx.glint(this.x, this.y - 30, this.weaponColor, 16);
    audio.play('ui');
    G.ui.toast(`Weapon Set ${s.activeSet}: ${main ? main.customName ?? main.name : 'Unarmed'}`, 'info');
  }

  tryDodge(mx: number, my: number): void {
    if (this.dodgeCd > 0 || this.sta < 18) return;
    if (this.st !== 'normal' && !(this.st === 'attack' && this.atkT > this.atkDur * 0.45)) return;
    this.st = 'dodge';
    this.dodgeT = 0.24;
    this.iframes = Math.max(this.iframes, 0.28);
    this.dodgeCd = 0.38;
    this.dodgeAng = mx || my ? Math.atan2(my, mx) : this.aim;
    this.sta -= 20;
    this.staDelay = 0.6;
    this.blocking = false;
    fx.dust(this.x, this.y, 6);
    audio.play('dodge');
  }

  startAttack(aim: number): void {
    if (this.atkCd > 0) return;
    if (this.st === 'attack') {
      if (this.atkT > this.atkDur * 0.35) this.queued = true;
      return;
    }
    if (this.st !== 'normal') return;
    const list = COMBOS[this.mode];
    if (G.time - this.lastAtkEnd < 0.45 && this.combo < list.length - 1) this.combo++;
    else this.combo = 0;
    const h = list[this.combo];
    this.aim = aim;
    this.atkDur = h.dur / this.stats.aspd;
    this.atkT = 0;
    this.hitDone = false;
    this.st = 'attack';
    this.anim.kind = 'attack';
    this.anim.a0 = aim + h.a0;
    this.anim.a1 = aim + h.a1;
    this.anim.hand = h.hand;
    this.anim.swing = 0;
    this.dir = dirFromAngle(aim);
    if (this.mode !== 'bow' && this.mode !== 'staff') audio.play(this.combo % 2 ? 'swing2' : 'swing', 0.8);
  }

  private updateAttack(dt: number, mx: number, my: number, baseSpeed: number): void {
    this.atkT += dt;
    this.anim.swing = this.atkT / this.atkDur;
    if (mx || my) {
      G.world.map.move(this, mx * baseSpeed * 0.28 * dt, my * baseSpeed * 0.28 * dt);
      this.anim.walk += dt * 5;
    }
    if (!this.hitDone && this.atkT >= this.atkDur * 0.35) {
      this.hitDone = true;
      const reach = 0.08 * (G.save.passives['sp_p_reach'] ?? 0);
      const n = basicHit(this, this.mode, this.combo, this.aim, this.basicBranch(), this.weaponColor, reach);
      if (this.mode !== 'bow' && this.mode !== 'staff') {
        G.world.map.move(this, Math.cos(this.aim) * 6, Math.sin(this.aim) * 6);
        if (n > 0) fx.shake(1.5);
      }
    }
    if (this.atkT >= this.atkDur) {
      this.st = 'normal';
      this.lastAtkEnd = G.time;
      const list = COMBOS[this.mode];
      if (this.combo >= list.length - 1) this.atkCd = 0.18 / this.stats.aspd;
      if (this.queued) {
        this.queued = false;
        this.startAttack(G.game.mouseAimFor(this));
      }
    }
  }

  tryCast(slot: number, aim: number): void {
    const id = G.save.hotbar[slot];
    if (!id) return;
    const def = SKILL_BY_ID[id];
    if (!def) return;
    if (this.st === 'skill' || this.st === 'dodge' || this.st === 'switch' || this.st === 'gather') return;
    if (!this.branches.has(def.branch)) {
      G.ui.toast(`${def.name} requires: ${BRANCH_INFO[def.branch].req}.`, 'warn');
      audio.play('error');
      return;
    }
    if ((this.skillCd[id] ?? 0) > 0) {
      audio.play('error');
      return;
    }
    if (this.mp < def.mp) {
      G.ui.toast('Not enough MP.', 'warn');
      audio.play('error');
      return;
    }
    this.mp -= def.mp;
    this.skillCd[id] = def.cd;
    if (def.branch === 'magic') {
      const echo = G.save.passives['mg_p_echo'] ?? 0;
      if (echo > 0 && Math.random() < 0.06 * echo) {
        this.skillCd[id] = 0;
        fx.number(this.x, this.y - 58, 'SPELL ECHO', '#c18cff', 13);
      }
    }
    this.aim = aim;
    this.dir = dirFromAngle(aim);
    this.blocking = false;
    const rank = G.save.mastery[def.branch].rank;
    let mult = 1 + rank * 0.01;
    if (this.chainT > 0) {
      mult *= 1.35;
      this.chainT = 0;
      fx.number(this.x, this.y - 60, 'SWITCH COMBO +35%', '#7fe9ff', 14);
    }
    const mw = G.game.mouseWorld();
    this.casting = new SkillRun(this, def, mw.x, mw.y, mult, this.tint);
    this.st = 'skill';
    this.anim.kind = 'skill';
    this.anim.t = 0;
    this.anim.charge = 0;
    this.anim.glint = 0.12;
    this.anim.glintColor = def.color;
    fx.glint(this.x + Math.cos(aim) * 22, this.y - 22 + Math.sin(aim) * 8, def.color, 22);
    audio.play('chime');
  }

  beginGather(n: ResourceNode): void {
    if (this.st !== 'normal' || !n.ready) return;
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
    const qty = 1 + (Math.random() < 0.45 ? 1 : 0);
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
    this.z = 0;
  }
}
