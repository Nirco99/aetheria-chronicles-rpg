// v3 living-world actors built on the companion AI:
//  - Adventurer: simulated named Divers who roam, gather, shop and fight; they call for help,
//    trade rare materials and accept friendly 1v1 duels (HP clamped at 10%).
//  - Vanguard: the three Ivory Aegis knights who join a 6-hero raid.
//  - Shadow: the Shadow Doppelganger that replays a Sword Skill (Nightfall Sovereign).
//  - Caravan: the merchant wagon escorted during a Caravan Escort event.
import type { ActiveSkillDef, Branch, CompanionDef, CompanionSave, GearColors, GuildId, WeaponType } from '../types/game';
import type { Look } from '../render/paperdoll';
import { Actor } from './actor';
import { Companion } from './companion';
import { G } from '../core/state';
import { EYE_COLORS, HAIR_COLORS, SKIN_TONES, tierForLevel } from '../data/constants';
import { makeGear } from '../data/items';
import { SkillRun } from '../systems/skills';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { angTo, dist, pick, rnd, rndi } from '../engine/util';
import { ADVENTURER_LINES } from '../data/v3';

interface Kit {
  branch: Branch;
  main: string;
  off: string | null;
  weapon: WeaponType;
  offKind: 'shield' | 'sword' | null;
  chest: string;
  head: string;
}

const KITS: Kit[] = [
  { branch: 'sword', main: 'w_sword', off: 'a_shield', weapon: 'sword', offKind: 'shield', chest: 'a_plate', head: 'a_helm' },
  { branch: 'dual', main: 'w_sword', off: 'w_twinblade', weapon: 'sword', offKind: 'sword', chest: 'a_coat', head: 'a_hood' },
  { branch: 'spear', main: 'w_spear', off: null, weapon: 'spear', offKind: null, chest: 'a_brig', head: 'a_helm' },
  { branch: 'bow', main: 'w_bow', off: null, weapon: 'bow', offKind: null, chest: 'a_coat', head: 'a_hood' },
  { branch: 'magic', main: 'w_staff', off: null, weapon: 'staff', offKind: null, chest: 'a_robe', head: 'a_circlet' },
];

const GUILD_COLORS: Record<GuildId, GearColors> = {
  aegis: { main: '#f4efe6', accent: '#9a2a3a', trim: '#ffd27a', glow: '#ffd27a' },
  anvil: { main: '#a8642a', accent: '#5a3010', trim: '#ffe29a', glow: '#ffc861' },
  wing: { main: '#2f6b3a', accent: '#173a1f', trim: '#d8c070', glow: '#9be15d' },
  arcanum: { main: '#4b2f8a', accent: '#24154a', trim: '#ffd27a', glow: '#c69bff' },
};

function synthesize(id: string, name: string, title: string, kit: Kit, level: number, colors: GearColors, guild: GuildId | null, seed: number): { def: CompanionDef; save: CompanionSave } {
  const tier = tierForLevel(level);
  const r = (n: number, salt: number) => Math.abs(Math.floor(Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453)) % n;
  const def: CompanionDef = {
    id, name, title, guild, branch: kit.branch, weapon: kit.weapon, off: kit.offKind,
    skin: r(SKIN_TONES.length, 1), hairStyle: r(8, 2), hairColor: r(HAIR_COLORS.length, 3), eyeColor: r(EYE_COLORS.length, 4),
    colors, req: { level: 1 }, bio: '', lines: [], city: 0, chain: 'Vanguard Assault',
  };
  const opts = { colors };
  const save: CompanionSave = {
    recruited: true,
    equip: {
      main: makeGear(kit.main, tier, 2, { affixes: false }),
      off: kit.off ? makeGear(kit.off, tier, 2, { affixes: false }) : null,
      head: makeGear(kit.head, tier, 1, { ...opts, affixes: false }),
      chest: makeGear(kit.chest, tier, 2, { ...opts, affixes: false }),
      boots: makeGear('a_boots', tier, 1, { affixes: false }),
      cloak: makeGear('a_cloak', tier, 1, { ...opts, affixes: false }),
    },
  };
  return { def, save };
}

// ------------------------------------------------------------------ adventurers

let ADV_SEED = 1;

export class Adventurer extends Companion {
  readonly advName: string;
  readonly guildId: GuildId;
  goal: { x: number; y: number } | null = null;
  idleT = 0;
  gatherT = 0;
  hitByMonsterT = -99;
  helpNeeded = false;
  rewardCd = 0;
  dueling = false;
  bubble = '';
  bubbleT = 0;
  readonly kitBranch: Branch;

  constructor(name: string, level: number, x: number, y: number) {
    const seed = ADV_SEED++ * 7 + name.length;
    const kit = KITS[seed % KITS.length];
    const guild = (['aegis', 'anvil', 'wing', 'arcanum'] as GuildId[])[seed % 4];
    const { def, save } = synthesize(`adv_${name}`, name, 'Adventurer', kit, level, GUILD_COLORS[guild], guild, seed);
    super(def, save, 'adventurer');
    this.advName = name;
    this.guildId = guild;
    this.kitBranch = kit.branch;
    this.level = level;
    this.refresh();
    this.hp = this.stats.maxHp;
    this.x = x;
    this.y = y;
  }

  get displayName(): string {
    return this.advName;
  }

  say(text: string, dur = 3): void {
    this.bubble = text;
    this.bubbleT = dur;
  }

  protected pickTarget(): void {
    if (this.dueling) {
      this.target = G.world.duel?.phase === 'fight' ? G.player : null;
      return;
    }
    let best: Actor | null = null;
    let bd = 230;
    for (const m of G.world.monsters) {
      if (m.dead || m.spawnT > 0 || m.raid) continue;
      const d = dist(this.x, this.y, m.x, m.y) - (m.target === this ? 80 : 0);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    this.target = best;
  }

  protected roam(dt: number, speed: number): boolean {
    if (this.bubbleT > 0) this.bubbleT -= dt;
    if (this.rewardCd > 0) this.rewardCd -= dt;
    const p = G.player;
    const t = this.target;
    if (t && !t.dead) {
      this.goal = null;
      this.engage(t, speed, dt);
      return true;
    }
    if (this.dueling) {
      this.anim.kind = 'idle';
      return true;
    }
    // assist resolution: the monsters that attacked us are gone and the Diver stayed close
    if (this.helpNeeded && G.time - this.hitByMonsterT > 1.2) {
      this.helpNeeded = false;
      if (dist(this.x, this.y, p.x, p.y) < 380 && this.rewardCd <= 0) G.world.adventurerAssisted(this);
    }
    if (this.gatherT > 0) {
      this.gatherT -= dt;
      this.anim.kind = 'attack';
      this.anim.swing = (this.gatherT * 2) % 1;
      return true;
    }
    if (!this.goal) {
      this.idleT -= dt;
      this.anim.kind = 'idle';
      if (this.idleT <= 0) {
        const m = G.world.map;
        const node = m.nodes.length && Math.random() < 0.35 ? pick(m.nodes) : null;
        const tx = node ? node.x + rnd(-18, 18) : this.x + rnd(-260, 260);
        const ty = node ? node.y + rnd(10, 20) : this.y + rnd(-200, 200);
        this.goal = m.nearestFree(Math.max(40, Math.min(m.pw - 40, tx)), Math.max(40, Math.min(m.ph - 40, ty)), 3);
        if (node) this.gatherT = -1;
      }
      return true;
    }
    const d = dist(this.x, this.y, this.goal.x, this.goal.y);
    if (d < 12) {
      this.goal = null;
      this.idleT = rnd(1.5, 4.5);
      if (this.gatherT < 0) this.gatherT = rnd(1.2, 2.2);
      else if (Math.random() < 0.25 && dist(this.x, this.y, p.x, p.y) < 260) this.say(pick(ADVENTURER_LINES));
      return true;
    }
    this.aim = angTo(this.x, this.y, this.goal.x, this.goal.y);
    this.walkToward(this.goal.x, this.goal.y, speed * 0.55, dt);
    this.anim.kind = 'walk';
    return true;
  }

  onMonsterHit(): void {
    this.hitByMonsterT = G.time;
    if (!this.helpNeeded && dist(this.x, this.y, G.player.x, G.player.y) < 420) {
      this.helpNeeded = true;
      this.say('Help! Over here!', 2.5);
    }
  }

  knockOut(): void {
    if (this.dead) return;
    this.dead = true;
    this.removed = true;
    fx.shatter(this.x, this.y - 18, [this.def.colors.glow, '#bff3ff', '#ffffff'], 0.8);
    audio.play('teleport', 0.5);
    G.ui.toast(`${this.advName} was overwhelmed and emergency-teleported back to town.`, 'warn');
  }
}

// ------------------------------------------------------------------ vanguard knights

export class Vanguard extends Companion {
  constructor(name: string, idx: number, level: number) {
    const kit = KITS[[0, 2, 4][idx % 3]];
    const colors: GearColors = { main: '#f4efe6', accent: '#9a2a3a', trim: '#ffd27a', glow: '#ffd27a' };
    const { def, save } = synthesize(`van_${idx}`, name, 'Ivory Aegis Vanguard', kit, level, colors, 'aegis', 900 + idx * 31);
    super(def, save, 'vanguard');
    this.level = level;
    this.refresh();
    this.hp = this.stats.maxHp;
  }

  knockOut(): void {
    if (this.dead) return;
    this.dead = true;
    this.st = 'down';
    this.downT = 12;
    this.casting?.cancel();
    this.casting = null;
    fx.shatter(this.x, this.y - 18, ['#ffd27a', '#ffffff'], 0.7);
    audio.play('shatter', 0.4);
  }
}

// ------------------------------------------------------------------ shadow doppelganger

export class Shadow extends Actor {
  readonly kind = 'shadow' as const;
  readonly look: Look;
  readonly run: SkillRun;
  fade = 0;

  constructor(src: Actor & { look: Look }, def: ActiveSkillDef, tx: number, ty: number, mult: number, side: number) {
    super();
    this.team = 'player';
    this.look = src.look;
    this.stats = { ...src.stats, elem: { ...src.stats.elem } };
    this.level = src.level;
    this.hp = this.stats.maxHp;
    const a = src.aim + side * 1.6;
    const pos = G.world.map.nearestFree(src.x + Math.cos(a) * 34, src.y + Math.sin(a) * 26, 2);
    this.x = pos.x;
    this.y = pos.y;
    this.aim = angTo(this.x, this.y, tx, ty);
    this.dir = src.dir;
    this.iframes = 99;
    this.run = new SkillRun(this, def, tx, ty, mult, '#7fe9ff');
    fx.glint(this.x, this.y - 26, '#7fe9ff', 22);
    fx.burst(this.x, this.y - 18, '#2a2f44', 12, 90);
  }

  get displayName(): string {
    return 'Shadow';
  }

  update(dt: number): void {
    this.tickTimers(dt);
    if (this.run.done) {
      this.fade += dt;
      if (this.fade > 0.35) this.removed = true;
      return;
    }
    this.run.update(dt);
    this.anim.kind = 'skill';
  }
}

// ------------------------------------------------------------------ caravan wagon

export class Caravan extends Actor {
  readonly kind = 'caravan' as const;
  path: { x: number; y: number }[];
  idx = 0;
  arrived = false;
  wheel = 0;
  waiting = false;

  constructor(path: { x: number; y: number }[], level: number) {
    super();
    this.team = 'player';
    this.path = path;
    this.x = path[0].x;
    this.y = path[0].y;
    this.level = level;
    this.hw = 14;
    this.hh = 8;
    this.radius = 18;
    this.stats.maxHp = this.hp = 600 + level * 90;
    this.stats.def = 10 + level * 2;
  }

  get displayName(): string {
    return 'Merchant Caravan';
  }

  update(dt: number): void {
    this.tickTimers(dt);
    if (this.dead || this.arrived) return;
    const p = G.player;
    this.waiting = dist(this.x, this.y, p.x, p.y) > 360;
    if (this.waiting || !this.canAct()) {
      this.moving = false;
      return;
    }
    const goal = this.path[this.idx];
    const d = dist(this.x, this.y, goal.x, goal.y);
    if (d < 10) {
      this.idx++;
      if (this.idx >= this.path.length) this.arrived = true;
      return;
    }
    const a = angTo(this.x, this.y, goal.x, goal.y);
    const sp = 44 * dt;
    const r = G.world.map.move(this, Math.cos(a) * sp, Math.sin(a) * sp);
    if (r.hitX && r.hitY) {
      const nf = G.world.map.nearestFree(goal.x, goal.y, 3);
      this.x = nf.x;
      this.y = nf.y;
    }
    this.aim = a;
    this.moving = true;
    this.wheel += dt * 6;
  }
}

export function vanguardNames(): string[] {
  return ['Sir Aldric Vane', 'Dame Liora Ashcroft', 'Captain Hesper Kell'];
}

export function randomAdventurerLevel(lo: number, hi: number): number {
  return rndi(lo, hi);
}
