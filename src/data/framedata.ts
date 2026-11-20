// Frame data & combat rules: every timing window, physics threshold and damage rule of the action
// system in one declarative table. The simulation runs at a fixed 60 Hz (one frame = 1/60 s), and
// all values below are in seconds unless noted. Game systems import these numbers and the strategy
// wiki is generated from this file, so the game and its documentation cannot drift apart.
import type { WeaponMode } from '../systems/stats';

export const SIM_HZ = 60;

export const FRAMES = {
  // ---- input
  /** a press that cannot act yet is remembered this long and fires on the first legal frame */
  inputBuffer: 0.16,

  // ---- basic attacks
  /** the hitbox fires at this fraction of the swing; everything after it is cancellable recovery */
  hitFrac: 0.35,
  /** a dodge may cut into a swing from this fraction even before the hit (the hit usually comes first) */
  dodgeCancelFrac: 0.45,
  /** starting the next swing within this long of the previous one continues the combo */
  comboChain: 0.45,
  /** pause after a combo finisher, divided by attack speed */
  finisherCooldown: 0.18,
  /** walking speed multiplier while swinging */
  attackMoveMult: 0.28,
  /** kinetic stepping impulse (px/s): light hits, +per combo step, finishers & ripostes */
  stepLight: 110,
  stepPerHit: 50,
  stepHeavy: 260,
  /** per-frame friction applied to the step impulse */
  stepFriction: 0.84,

  // ---- dodge roll
  dodgeDur: 0.24,
  dodgeIframes: 0.28,
  dodgeCooldown: 0.38,
  dodgeStamina: 20,
  dodgeMinStamina: 18,
  /** Shadow-Clone rune evasive hop */
  evasiveDur: 0.14,
  evasiveIframes: 0.18,

  // ---- guard & Perfect Parry
  /** a hit that lands within this long of pressing block is a Perfect Parry */
  parryWindow: 0.25,
  /** Riposte Instinct passive: + per level */
  parryPerRiposteRank: 0.04,
  /** Unbreakable Bastion keystone */
  parryKeystone: 0.08,
  /** time-freeze on a Perfect Parry */
  parryFreeze: 0.05,
  /** fraction of max MP and Stamina restored by a Perfect Parry */
  parryRestore: 0.3,
  /** Break damage dealt to the attacker: flat + fraction of its Break Bar */
  parryBreakFlat: 40,
  parryBreakPct: 0.35,
  /** Counter-Riposte: next basic attack within this window becomes a finisher */
  riposteWindow: 1.5,
  riposteMult: 2.4,
  /** riposte swing duration multiplier (faster) */
  riposteSpeed: 0.8,
  /** damage blocked: without / with a shield (+ Block stat), capped */
  blockReduce: 0.5,
  blockReduceShield: 0.75,
  blockCap: 0.95,

  // ---- Sword Skills & Skill Connect
  /** opening Pre-Motion: the skill can still be cancelled into a dodge or block */
  preMotion: 0.12,
  /** after a skill's final strike, another skill fired within this window is a Skill Connect */
  connectWindow: 0.3,
  /** MP cost multiplier of a connected skill */
  connectMp: 0.7,
  /** damage bonus per chain step */
  connectStep: 0.25,
  /** cancelling a basic attack's recovery into a skill */
  cancelBonus: 0.15,
  /** chain length that unleashes the Finishing Nova */
  novaChain: 4,
  novaMult: 3.2,
  novaRadius: 170,
  novaBreak: 40,
  switchCost: 100,
  /** damage bonus of the first skill after a SWITCH! */
  switchBonus: 0.35,

  // ---- hit reactions
  hitstop: 0.04,
  /** a single hit worth at least this fraction of max HP grants grace i-frames */
  graceThreshold: 0.12,
  graceIframes: 0.35,
  /** how long a knocked-back target can still Wall Slam */
  kbFresh: 0.35,
  /** knockback velocity decays by (1 - kbDecay x dt) every simulation step */
  kbDecay: 9,
  /** knockback taken multipliers */
  kbResist: { monster: 1, elite: 0.35, boss: 0.08, player: 0.6, companion: 0.8 },

  // ---- Break Bar
  /** stun after breaking an elite or boss (every hit is a critical) */
  breakStun: 4.0,
  /** stun after breaking a regular monster */
  breakStunSmall: 2.5,
  breakCritMult: 1.5,
  /** seconds without Break damage before the bar starts to recover */
  breakDelay: 3,
  /** then it drains this fraction of the bar per second */
  breakDecay: 0.2,
  shatterFreeze: 0.12,

  // ---- Wall Slam
  /** minimum knockback speed (px/s) when the target hits a wall */
  slamSpeed: 150,
  slamSpeedKeystone: 105,
  /** bonus damage as a fraction of the hit that launched the target */
  slamDmg: 0.45,
  slamDmgKeystone: 0.9,
  slamStun: 1.5,
  /** fraction of the Break Bar dealt on impact */
  slamBreak: 0.3,
  slamCooldown: 0.8,

  // ---- elements
  /** damage multiplier when a hit's element matches a creature's weakness / resistance */
  weakMult: 1.3,
  resistMult: 0.6,

  // ---- mounted
  chargeDur: 0.34,
  chargeIframes: 0.3,
};

export interface ComboHit {
  shape: 'arc' | 'line';
  arc: number;
  a0: number;
  a1: number;
  mult: number;
  kb: number;
  /** swing duration in seconds at 100% attack speed */
  dur: number;
  brk: number;
  hand: 0 | 1;
  extra: number;
}

const h = (o: Partial<ComboHit>): ComboHit => ({ shape: 'arc', arc: 1.9, a0: -1, a1: 1, mult: 1, kb: 50, dur: 0.34, brk: 3, hand: 0, extra: 0, ...o });

/** weapon-specific basic attack strings shared by the player and companions */
export const COMBOS: Record<WeaponMode, ComboHit[]> = {
  sword: [h({ a0: -1.05, a1: 1.05 }), h({ a0: 1.05, a1: -1.05 }), h({ arc: 2.5, a0: -1.3, a1: 1.3, mult: 1.45, kb: 140, dur: 0.46, brk: 6, extra: 6 })],
  dual: [
    h({ a0: -1.0, a1: 0.9, mult: 0.75, dur: 0.24, hand: 0 }),
    h({ a0: 1.0, a1: -0.9, mult: 0.75, dur: 0.24, hand: 1 }),
    h({ a0: -1.2, a1: 1.0, mult: 0.8, dur: 0.24, hand: 0 }),
    h({ arc: 2.4, a0: 1.3, a1: -1.3, mult: 1.15, kb: 120, dur: 0.36, hand: 1, brk: 5 }),
  ],
  spear: [h({ shape: 'line', arc: 26, mult: 1.1, dur: 0.38 }), h({ shape: 'line', arc: 26, mult: 1.1, dur: 0.38 }), h({ shape: 'line', arc: 32, mult: 1.5, kb: 140, dur: 0.48, extra: 16, brk: 6 })],
  halberd: [h({ arc: 2.6, a0: -1.4, a1: 1.4, mult: 1.35, dur: 0.56, kb: 100, brk: 6 }), h({ arc: 2.6, a0: 1.4, a1: -1.4, mult: 1.75, dur: 0.66, kb: 180, brk: 9 })],
  bow: [h({ dur: 0.42 })],
  staff: [h({ dur: 0.5 })],
  fists: [h({ arc: 1.3, a0: -0.5, a1: 0.5, mult: 0.55, dur: 0.3 }), h({ arc: 1.3, a0: 0.5, a1: -0.5, mult: 0.55, dur: 0.3 })],
};
