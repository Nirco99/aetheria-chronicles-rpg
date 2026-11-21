// Damage resolution: crits, elements, blocking, Perfect Parry, frontal guards, barriers,
// hit-stop, knockback, the Break Bar, status effects, lifesteal, kill rewards and loot rolls.
import type { Branch, Element, GearItem, StatusApply, TeleShape } from '../types/game';
import type { Actor } from '../entities/actor';
import type { Player } from '../entities/player';
import type { Monster } from '../entities/monster';
import type { Companion } from '../entities/companion';
import { G } from '../core/state';
import { BREAK_CRIT_MULT, BREAK_STUN, HITSTOP, PARRY_WINDOW, isNight } from '../data/constants';
import { FRAMES } from '../data/framedata';
import { MF_SOURCES, huntMasteryMf, lootSource, lootTable, rollGold, type LootCtx } from '../data/loot';
import { dominantElement, elementAffinity } from '../data/monsters';
import { randomGear, makeGear, GEAR_BASE_IDS, randomUnique } from '../data/items';
import { tierForLevel } from '../data/constants';
import { GEM_TYPES } from '../data/constants';
import { angDiff, angTo, chance, clamp, rnd, rndi } from '../engine/util';
import { audio } from '../engine/audio';
import { fx, NUM_COLORS } from '../render/fx';
import { checkAwakenings, gainMastery, gainXp } from './progression';
import type { Breakable } from '../entities/breakable';
import { gaugeOf, paintGauge } from './reactions';
import { GAUGE_RULES } from '../data/v3';
import { hasPower, onBlockPowers, onBreakPower, onEnemyKilled, onParryPowers, onPlayerHit, onPlayerHurt, powerDamageBonus, tryPhoenixRevive } from './powers';
import { RIPOSTE_WINDOW, style } from './feel';
import { checkAchievements } from './achievements';

export interface HitOpts {
  mult?: number;
  magic?: boolean;
  element?: Element;
  brk?: number;
  kb?: number;
  kbAngle?: number;
  status?: StatusApply;
  crit?: number;
  forceCrit?: boolean;
  canBlock?: boolean;
  isSkill?: boolean;
  branch?: Branch | null;
  source?: 'basic' | 'skill' | 'proj' | 'dot' | 'zone' | 'reflect' | 'chain' | 'enemy';
  srcX?: number;
  srcY?: number;
  flat?: number;
  noNumber?: boolean;
  bonus?: number;
}

// ------------------------------------------------------------------ geometry

export function hitTest(s: TeleShape, x: number, y: number, r: number): boolean {
  switch (s.kind) {
    case 'circle':
      return (x - s.x) ** 2 + (y - s.y) ** 2 <= (s.r + r) ** 2;
    case 'ring': {
      const d = Math.hypot(x - s.x, y - s.y);
      return d >= s.inner - r && d <= s.r + r;
    }
    case 'cone': {
      const d = Math.hypot(x - s.x, y - s.y);
      if (d > s.r + r) return false;
      if (d < r + 6) return true;
      const da = Math.abs(angDiff(s.a, angTo(s.x, s.y, x, y)));
      return da <= s.arc / 2 + Math.asin(Math.min(1, r / d));
    }
    case 'line': {
      const dx = x - s.x;
      const dy = y - s.y;
      const c = Math.cos(s.a);
      const sn = Math.sin(s.a);
      const along = dx * c + dy * sn;
      const perp = Math.abs(-dx * sn + dy * c);
      return along >= -r && along <= s.len + r && perp <= s.w / 2 + r;
    }
  }
}

export function targetsOf(a: Actor): Actor[] {
  return G.world.targetsFor(a.team);
}

// ------------------------------------------------------------------ break & parry

export function applyBreak(t: Actor, amount: number): void {
  if (t.brkMax <= 0 || t.broken > 0 || t.dead || amount <= 0) return;
  t.brk += amount;
  t.brkDelay = FRAMES.breakDelay;
  if (t.brk < t.brkMax) return;
  t.brk = t.brkMax;
  const m = t.kind === 'monster' ? (t as Monster) : null;
  const big = !!m && (m.isBoss || m.isElite);
  t.broken = big ? BREAK_STUN : FRAMES.breakStunSmall;
  if (m) {
    m.cancelAttack();
    if (m.def.id === 'b_wyrm') m.armored = false;
  }
  fx.ring(t.x, t.y, '#ffd166', 10, big ? 150 : 90, 0.55, 6);
  fx.burst(t.x, t.y - 20, '#ffd166', 18, 160);
  if (t.team === 'enemy') {
    onBreakPower(t);
    style.add(big ? 120 : 50, 'Break');
  }
  if (big) {
    fx.banner('BREAK!!', '#ffd166', 'Stunned - every hit is a 150% critical!', 76, 1.5);
    fx.flash('#ffd166', 0.22);
    fx.shake(10);
    audio.play('break');
    G.game.slowmo(0.35, 0.25);
  } else {
    fx.number(t.x, t.y - 46, 'BREAK!', '#ffd166', 18);
    audio.play('break', 0.5);
  }
}

function perfectParry(p: Player, src: Actor | null): void {
  const s = G.save;
  // 50ms time-freeze, ring shockwave, 30% MP & Stamina, a massive Break chunk and a riposte window
  G.game.freeze(FRAMES.parryFreeze);
  fx.ring(p.x, p.y, '#7fe9ff', 12, 130, 0.45, 7);
  fx.ring(p.x, p.y, '#ffffff', 6, 70, 0.3, 3);
  fx.sparks(p.x + Math.cos(p.aim) * 18, p.y - 18 + Math.sin(p.aim) * 10, '#bff3ff', 18, 240);
  fx.number(p.x, p.y - 44, 'PERFECT PARRY', NUM_COLORS.shield, 17);
  fx.flash('#bff3ff', 0.1);
  audio.play('parry');
  fx.shake(5);
  G.game.slowmo(0.22, 0.3);
  p.mp = Math.min(p.stats.maxMp, p.mp + p.stats.maxMp * FRAMES.parryRestore);
  p.sta = Math.min(p.stats.maxSta, p.sta + p.stats.maxSta * FRAMES.parryRestore);
  p.atkCd = 0;
  p.parryFlash = 0.25;
  p.riposteT = RIPOSTE_WINDOW;
  if (src && src.kind === 'monster') {
    applyBreak(src, FRAMES.parryBreakFlat + src.brkMax * FRAMES.parryBreakPct);
    src.hitstop = Math.max(src.hitstop, 0.2);
    src.kbx += Math.cos(p.aim) * 120;
    src.kby += Math.sin(p.aim) * 120;
  }
  for (const f of G.world.targetsFor('player')) {
    if (f === src || f.dead || f.kind === 'prop') continue;
    const d = Math.hypot(f.x - p.x, f.y - p.y);
    if (d < 110) {
      const a = angTo(p.x, p.y, f.x, f.y);
      f.kbx += Math.cos(a) * 140;
      f.kby += Math.sin(a) * 140;
    }
  }
  style.add(110, 'Perfect Parry');
  onParryPowers();
  s.counters.perfectParries++;
  gainMastery(p.hasShield() ? 'shield' : 'sword', 10 + p.level);
  checkAwakenings();
}

// ------------------------------------------------------------------ main entry

export function damage(src: Actor | null, t: Actor, o: HitOpts): number {
  if (t.dead || t.removed) return 0;
  if (t.kind === 'prop') return (t as Breakable).hit(src, o);
  if (t.iframes > 0 && o.source !== 'dot') return 0;
  if (t.inCitadel && t.team === 'player') {
    if (!o.noNumber) fx.number(t.x, t.y - 34, 'IMMUNE', NUM_COLORS.shield, 13);
    return 0;
  }
  const sx = o.srcX ?? src?.x ?? t.x;
  const sy = o.srcY ?? src?.y ?? t.y;
  let crit = false;
  let elemental = false;
  let dmg: number;

  if (o.flat !== undefined) dmg = o.flat;
  else {
    if (!src) return 0;
    const atk = o.magic ? src.stats.mag : src.stats.atk;
    let def = t.stats.def;
    if (t.has('shred')) def *= 1 - t.power('shred');
    dmg = atk * (o.mult ?? 1) * (100 / (100 + 2.5 * Math.max(0, def))) * rnd(0.92, 1.08);
    if (o.bonus) dmg *= 1 + o.bonus;
    const critChance = src.stats.crit + (o.crit ?? 0);
    const deadeye = src.kind === 'player' && t.team === 'enemy' && t.hp >= t.stats.maxHp && G.save.keystones.includes('ks_bow');
    if (o.isSkill) dmg *= 1 + src.stats.skillDmg;
    if (src.kind === 'player') dmg *= powerDamageBonus(src, t);
    if (deadeye && !o.forceCrit) {
      crit = true;
      dmg *= src.stats.critDmg;
    } else if (t.broken > 0) {
      crit = true;
      dmg *= Math.max(BREAK_CRIT_MULT, src.stats.critDmg);
    } else if (o.forceCrit || Math.random() < critChance) {
      crit = true;
      dmg *= src.stats.critDmg;
    }
    let elemSum = 0;
    for (const v of Object.values(src.stats.elem)) elemSum += v ?? 0;
    if (elemSum > 0) {
      dmg *= 1 + elemSum;
      elemental = true;
    }
    if (o.element && o.element !== 'none') elemental = true;
    // species weakness / resistance to the hit's element (skill element, else the strongest gem or oil)
    if (t.kind === 'monster') {
      const el = o.element && o.element !== 'none' ? o.element : dominantElement(src.stats.elem);
      if (el) dmg *= elementAffinity((t as Monster).def, el);
    }
    if (src.kind === 'player') {
      const p = src as Player;
      dmg *= p.damageBonus(t, o.isSkill ?? false);
    }
  }
  dmg = Math.max(1, dmg);

  // ---- frontal guards & armor (monsters)
  if (t.kind === 'monster') {
    const m = t as Monster;
    if (m.frontGuard && m.broken <= 0 && o.source !== 'chain' && o.source !== 'dot') {
      const facing = Math.abs(angDiff(m.aim, angTo(m.x, m.y, sx, sy)));
      if (facing < 1.05) {
        dmg *= 0.1;
        if (!o.noNumber) fx.number(t.x, t.y - 40, 'GUARD', NUM_COLORS.shield, 14);
        fx.sparks(t.x + Math.cos(m.aim) * 20, t.y - 24, '#fff1a8', 6, 160);
        audio.play('block', 0.7);
        applyBreak(t, (o.brk ?? 2) * 0.5);
      }
    }
    if (m.armored && m.broken <= 0 && o.source !== 'dot') {
      dmg *= 0.3;
      if (chance(0.3)) fx.sparks(t.x, t.y - 30, '#ffb02e', 5, 140);
    }
    if (m.shield > 0) {
      const ab = Math.min(m.shield, dmg);
      m.shield -= ab;
      dmg -= ab;
      m.shieldRegen = 5;
      if (!o.noNumber && ab > 0) fx.number(t.x - 10, t.y - 38, String(Math.round(ab)), NUM_COLORS.shield, 13);
      if (dmg <= 0) return 0;
    }
  }

  // ---- player defence: counter stance, aegis guard, block, perfect parry
  if (t.kind === 'player' && o.flat === undefined) {
    const p = t as Player;
    const front = Math.abs(angDiff(p.aim, angTo(p.x, p.y, sx, sy))) <= 1.35;
    if (p.counter) {
      const fn = p.counter.fn;
      p.counter = null;
      perfectParry(p, src);
      fn();
      return 0;
    }
    if (p.hasBuff('aegisguard') && front) {
      fx.number(p.x, p.y - 40, 'AEGIS', NUM_COLORS.shield, 14);
      fx.ring(p.x + Math.cos(p.aim) * 16, p.y, '#ffd166', 8, 40, 0.3);
      audio.play('block');
      G.save.counters.dmgBlocked += Math.round(dmg);
      checkAwakenings();
      return 0;
    }
    if (p.blocking && front && o.canBlock !== false) {
      const window = PARRY_WINDOW + FRAMES.parryPerRiposteRank * (G.save.passives['sw_p_riposte'] ?? 0) + (G.save.keystones.includes('ks_shield') ? FRAMES.parryKeystone : 0);
      if (G.time - p.blockStart <= window) {
        perfectParry(p, src);
        return 0;
      }
      const shield = p.hasShield();
      const red = Math.min(FRAMES.blockCap, (shield ? FRAMES.blockReduceShield : FRAMES.blockReduce) + p.stats.block);
      const prevented = dmg * red;
      dmg -= prevented;
      const steadfast = G.save.passives['sh_p_steadfast'] ?? 0;
      p.sta -= Math.max(5, prevented * 0.5) * (1 - 0.12 * steadfast) * (G.save.keystones.includes('ks_shield') ? 0.5 : 1);
      onBlockPowers();
      p.staDelay = 0.8;
      G.save.counters.dmgBlocked += Math.round(prevented);
      fx.number(p.x + 12, p.y - 40, String(Math.round(prevented)), NUM_COLORS.shield, 13);
      fx.sparks(p.x + Math.cos(p.aim) * 16, p.y - 16, '#ffe9a8', 6, 140);
      audio.play('block');
      gainMastery(shield ? 'shield' : 'sword', 2 + p.level * 0.3);
      const ret = G.save.passives['sh_p_retaliation'] ?? 0;
      if (ret > 0 && src && !src.dead) damage(p, src, { flat: prevented * 0.1 * ret, source: 'reflect', canBlock: false });
      if (p.sta <= 0) {
        p.sta = 0;
        p.blocking = false;
        p.addStatus({ kind: 'stun', dur: 0.9 });
        fx.number(p.x, p.y - 50, 'GUARD BREAK', NUM_COLORS.hurt, 15);
      }
      checkAwakenings();
    }
  }
  if (t.kind === 'companion' && (t as Companion).guard && o.flat === undefined) {
    const c = t as Companion;
    if (Math.abs(angDiff(c.aim, angTo(c.x, c.y, sx, sy))) <= 1.35) {
      dmg *= 0.25;
      fx.sparks(c.x + Math.cos(c.aim) * 16, c.y - 16, '#ffe9a8', 5, 140);
      audio.play('block', 0.6);
    }
  }

  // ---- barrier
  if (t.barrier > 0) {
    const ab = Math.min(t.barrier, dmg);
    t.barrier -= ab;
    dmg -= ab;
    if (!o.noNumber && ab >= 1) fx.number(t.x - 12, t.y - 36, String(Math.round(ab)), NUM_COLORS.shield, 13);
    if (dmg <= 0.5) return 0;
  }

  dmg = Math.round(dmg);
  if (G.world.duel) dmg = G.world.duelClamp(t, src, dmg);
  t.hp -= dmg;
  t.lastDmg = dmg;
  if (src) t.lastHitBy = src;
  if (o.source !== 'dot') {
    t.hitstop = Math.max(t.hitstop, HITSTOP);
    t.flash = 0.12;
  }
  // knockback
  const kbBase = o.kb ?? (o.source === 'dot' ? 0 : 40 + (o.mult ?? 1) * 20);
  if (kbBase > 0) {
    const R = FRAMES.kbResist;
    const resist = t.kind === 'monster' ? ((t as Monster).isBoss ? R.boss : (t as Monster).isElite ? R.elite : R.monster) : t.kind === 'player' ? R.player : R.companion;
    const ka = o.kbAngle ?? angTo(sx, sy, t.x, t.y);
    let kb = kbBase * resist;
    if (src && src.stats.elem.wind) kb += 60 * resist;
    t.kbx += Math.cos(ka) * kb;
    t.kby += Math.sin(ka) * kb;
    t.kbFresh = FRAMES.kbFresh;
  }
  // numbers & sound
  if (!o.noNumber) {
    let color = NUM_COLORS.normal;
    let size = 15;
    let text = String(dmg);
    if (t.team === 'player') color = NUM_COLORS.hurt;
    else if (crit) {
      color = NUM_COLORS.crit;
      size = 21;
      text = '★' + dmg;
    } else if (elemental || o.source === 'dot') color = NUM_COLORS.elem;
    fx.number(t.x, t.y - 30 - t.z - (t.kind === 'monster' ? (t as Monster).height() * 0.5 : 0), text, color, size);
  }
  if (o.source !== 'dot') {
    if (t.team === 'player') {
      audio.play('hurt');
      if (t.kind === 'player') {
        fx.shake(3);
        fx.flash('#ff2a40', 0.08);
        (t as Player).onHurt();
        const frac = dmg / Math.max(1, t.stats.maxHp);
        if (frac >= FRAMES.graceThreshold) t.iframes = Math.max(t.iframes, FRAMES.graceIframes);
        style.hurt(frac);
        onPlayerHurt(src, dmg);
      }
    } else audio.play(crit ? 'crit' : 'hit');
    fx.sparks(t.x, t.y - 18, crit ? '#ffd166' : elemental ? '#c18cff' : '#ffffff', crit ? 12 : 6, crit ? 220 : 150);
    if (crit) fx.shake(2.5);
  }

  // break, status, procs
  if (o.source !== 'dot' && o.source !== 'reflect') {
    let brk = (o.brk ?? (t.team === 'enemy' ? 2 : 0)) + (src && o.isSkill ? src.stats.brk : src ? src.stats.brk * 0.3 : 0);
    if (src?.kind === 'player' && hasPower('s6_anvil')) brk *= 1.2;
    if (t.team === 'enemy') applyBreak(t, brk);
  }
  if (o.status) {
    const resist = t.kind === 'monster' ? ((t as Monster).isBoss ? 0.6 : (t as Monster).isElite ? 0.3 : 0) : 0;
    if (t.addStatus(o.status, resist)) statusFx(t, o.status.kind);
  }
  if (src && src.team === 'player' && t.team === 'enemy' && o.flat === undefined) {
    elementProcs(src, t, dmg);
    paintHit(src, t, dmg, crit, o);
    onPlayerHit(src, t, dmg, crit, o);
    if (src.kind === 'player') style.add(7 + (crit ? 6 : 0) + (o.isSkill ? 5 : 0));
  }
  if (src && src.kind === 'monster' && (src as Monster).mods.includes('Vampiric') && !src.dead) {
    src.hp = Math.min(src.stats.maxHp, src.hp + dmg * 0.15);
  }
  if (src && src.kind === 'monster' && (src as Monster).mods.includes('Molten') && chance(0.35)) t.addStatus({ kind: 'burn', dur: 3 });

  // bookkeeping
  if (src && src.kind === 'monster') (t as { onMonsterHit?: () => void }).onMonsterHit?.();
  if (t.kind === 'monster') {
    const m = t as Monster;
    m.hpBarT = 5;
    if (src && src.team === 'player') m.aggroOn(src);
    m.onDamaged();
  }
  if (src && src.team === 'player' && t.team === 'enemy' && o.source !== 'reflect') {
    const p = G.player;
    p.lastCombat = G.time;
    if (G.world.party.some((c) => !c.dead)) p.switchGauge = Math.min(100, p.switchGauge + (src.kind === 'player' ? 2.6 : 3.4) * (crit ? 1.5 : 1));
    if (src.kind === 'player') {
      p.onDealtDamage(t, crit);
      const b = o.branch ?? p.basicBranch();
      if (b) gainMastery(b, (3 + t.level * 0.9) * (o.isSkill ? 1.4 : 1));
    }
  }
  if (src && src.kind === 'player' && t.team === 'enemy') (src as Player).focus = t;
  if (t.kind === 'player') {
    const p = t as Player;
    p.lastCombat = G.time;
    p.checkEmergencyAegis();
    if (t.hp <= 0 && tryPhoenixRevive()) return dmg;
  }

  if (t.hp <= 0) {
    t.hp = 0;
    onKill(t, src);
  }
  return dmg;
}

/** paints reaction gauges from the hit's element, the weapon's gems / oils and blade crits */
function paintHit(src: Actor, t: Actor, dmg: number, crit: boolean, o: HitOpts): void {
  if (o.source === 'reflect' || o.source === 'dot' || o.source === 'zone' || t.dead) return;
  const g = gaugeOf(o.element);
  if (g) {
    paintGauge(src, t, g, dmg);
    return;
  }
  const elems = Object.keys(src.stats.elem) as Element[];
  if (elems.length && Math.random() < GAUGE_RULES.gemChance) {
    const eg = gaugeOf(elems[Math.floor(Math.random() * elems.length)]);
    if (eg) {
      paintGauge(src, t, eg, dmg);
      return;
    }
  }
  if (crit && src.kind === 'player') {
    const mode = (src as Player).mode;
    if ((mode === 'sword' || mode === 'dual' || mode === 'spear' || mode === 'halberd') && Math.random() < GAUGE_RULES.critBleed) paintGauge(src, t, 'bleed', dmg);
  }
}

function statusFx(t: Actor, kind: string): void {
  const colors: Record<string, string> = { burn: '#ff6a3d', poison: '#9be15d', chill: '#7fe9ff', freeze: '#bff3ff', stun: '#ffd166', root: '#5ee6a0', shred: '#b98bff', shock: '#ffe066' };
  fx.number(t.x, t.y - 52, kind.toUpperCase(), colors[kind] ?? '#ffffff', 12);
  if (kind === 'freeze') audio.play('ice', 0.6);
}

function elementProcs(src: Actor, t: Actor, dmg: number): void {
  const e = src.stats.elem;
  const oil = src.buffs.find((b) => b.spec.oil)?.spec.oil;
  for (const el of Object.keys(e) as Element[]) {
    const p = 0.12 + (oil === el ? 0.13 : 0);
    if (el === 'void') src.hp = Math.min(src.stats.maxHp, src.hp + dmg * 0.03);
    if (Math.random() > p || t.dead) continue;
    if (el === 'fire') t.addStatus({ kind: 'burn', dur: 3 });
    else if (el === 'frost') t.addStatus({ kind: 'chill', dur: 2.5 });
    else if (el === 'void') t.addStatus({ kind: 'shred', dur: 5, power: 0.2 });
    else if (el === 'lightning') {
      let best: Actor | null = null;
      let bd = 130;
      for (const o of G.world.targetsFor(src.team)) {
        if (o === t || o.dead) continue;
        const d = Math.hypot(o.x - t.x, o.y - t.y);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      fx.bolt(t.x, t.y - 20, best ? best.x : t.x + rnd(-30, 30), best ? best.y - 20 : t.y - 60);
      if (best) damage(src, best, { flat: dmg * 0.3, source: 'reflect', canBlock: false });
    }
  }
}

/** periodic damage from burn / poison */
export function tickDots(a: Actor, dt: number): void {
  for (const s of a.statuses) {
    if (s.kind !== 'burn' && s.kind !== 'poison') continue;
    s.tick -= dt;
    if (s.tick > 0) continue;
    s.tick = 0.5;
    const dmg = (4 + a.level * 1.6) * s.power * 0.5 * (a.kind === 'monster' && (a as Monster).isBoss ? 2.5 : 1);
    damage(null, a, { flat: dmg, source: 'dot', canBlock: false });
    if (a.dead) return;
  }
}

// ------------------------------------------------------------------ kills & loot

export interface LootBundle {
  items: [string, number][];
  gear: GearItem[];
  gold: number;
  rarity: number;
}

/** loot context of a kill: level, Abyss floor and every Magic Find source in play */
export function lootContext(m: Monster): LootCtx {
  const s = G.save;
  const floor = G.world.map.kind === 'abyss' ? G.world.map.floor : 0;
  let mf = G.player ? G.player.stats.magicFind : 0;
  mf += huntMasteryMf(m.def, s.bestiary[m.def.id] ?? 0);
  if (G.world.map.kind === 'wild' && isNight(s.time)) mf += MF_SOURCES.night;
  return { level: m.level, floor, mf, raid: m.raid };
}

/** rolls every line of the creature's loot table (src/data/loot.ts) */
export function rollLoot(m: Monster): LootBundle {
  const ctx = lootContext(m);
  const items: [string, number][] = [];
  const gear: GearItem[] = [];
  const gold = rollGold(m.def, m.level, ctx.floor, Math.random());
  const src = lootSource(m.def, ctx.floor);
  for (const l of lootTable(m.def, ctx)) {
    if (!chance(l.chance)) continue;
    const n = rndi(l.min, l.max);
    if (l.kind === 'item' && l.item) items.push([l.item, n]);
    else if (l.kind === 'gem') items.push(['gem_' + GEM_TYPES[rndi(0, GEM_TYPES.length - 1)], 1]);
    else if (l.kind === 'gear') for (let i = 0; i < n; i++) gear.push(randomGear(m.level, src, ctx.mf));
    else if (l.kind === 'unique') {
      gear.push(randomUnique(tierForLevel(m.level)));
      G.save.counters.uniquesFound++;
    } else if (l.kind === 'mythicGear') gear.push(makeGear(GEAR_BASE_IDS[rndi(0, GEAR_BASE_IDS.length - 1)], 6, 5, { mythic: true }));
  }
  const rarity = gear.reduce((r, g) => Math.max(r, g.rarity), items.some(([id]) => id.startsWith('gem_')) ? 2 : 0);
  return { items, gear, gold, rarity };
}

function onKill(t: Actor, src: Actor | null): void {
  if (t.kind === 'monster') {
    const m = t as Monster;
    m.die();
    const s = G.save;
    // a kill counts for the Diver when they, their party or the Vanguard landed it, or when they
    // fought the creature themselves; simulated adventurers hunting elsewhere earn nothing for you
    const p = G.player;
    const own = !src || src.kind === 'player' || G.world.party.includes(src as Companion) || G.world.vanguard.includes(src as never) || src.kind === 'prop';
    const assisted = m.lastHitBy === p || m.target === p || Math.hypot(m.x - p.x, m.y - p.y) < 260;
    const credit = own || assisted || m.isBoss;
    if (credit) {
      s.counters.kills++;
      s.bestiary[m.def.id] = (s.bestiary[m.def.id] ?? 0) + 1;
      for (const c of G.world.party) if (!c.dead) s.affinity[c.def.id] = (s.affinity[c.def.id] ?? 0) + (m.isBoss ? 40 : m.isElite ? 8 : 1);
      onEnemyKilled(m);
      style.add(m.isBoss ? 200 : m.isElite ? 80 : 25, 'Kill');
      gainXp(m.xpValue);
      const loot = rollLoot(m);
      if (loot.gold > 0 || loot.items.length || loot.gear.length) G.world.spawnLoot(m.x, m.y, loot, m.isBoss ? 'chest' : 'crystal');
    }
    G.world.onMonsterKilled(m, credit);
    if (src && src.kind === 'player') {
      const p = src as Player;
      p.onKill(m);
    }
    checkAchievements();
  } else if (t.kind === 'player') {
    (t as Player).die();
  } else if (t.kind === 'companion') {
    (t as Companion).knockOut();
  } else {
    t.dead = true;
    (t as { onDeath?: () => void }).onDeath?.();
  }
}

export function clampHp(a: Actor): void {
  a.hp = clamp(a.hp, 0, a.stats.maxHp);
}
