// The live simulation: current map, actors, projectiles, telegraphs, zones, loot, boss rooms,
// night elites, day/night + weather, transitions, SWITCH! and respawning.
import type { Branch, Element, GearItem, Interactable, ProjSpec, ResourceNode, Team, TeleShape, Weather, ZoneSpec } from '../types/game';
import type { Actor } from '../entities/actor';
import type { LootBundle } from '../systems/combat';
import { G } from '../core/state';
import { GameMap, SOL } from './tilemap';
import { genArena, genCity, genDungeon, genHouse, genWild, abyssModifiers } from './mapgen';
import { Monster } from '../entities/monster';
import { Companion } from '../entities/companion';
import { Npc } from '../entities/npc';
import { Projectile } from '../entities/projectile';
import { MONSTERS, BOSSES } from '../data/monsters';
import { REALMS } from '../data/realms';
import { COMPANION_BY_ID } from '../data/guilds';
import { SECONDS_PER_HOUR, TILE } from '../data/constants';
import { itemDef, randomGear } from '../data/items';
import { damage } from '../systems/combat';
import { addGear, addItem } from '../systems/inventory';
import { checkAwakenings, deathPenalty } from '../systems/progression';
import { onBossBounty, onKillBounty, refreshBoard } from '../systems/guilds';
import { updateEconomy } from '../systems/economy';
import { arena } from '../systems/arena';
import { floorCleared } from '../systems/abyss';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { angTo, dist, pick, rnd, rndi, TAU } from '../engine/util';

export interface TeleInst {
  shape: TeleShape;
  t: number;
  dur: number;
  color: string;
  owner: number;
  onDone: (() => void) | null;
  spin: number;
  beam: boolean;
}
export interface ZoneInst {
  spec: ZoneSpec;
  t: number;
  tickT: number;
  owner: Actor | null;
}
export interface TrapInst {
  x: number;
  y: number;
  t: number;
  dur: number;
  root: number;
  owner: Actor;
}
export interface RainInst {
  owner: Actor;
  x: number;
  y: number;
  r: number;
  left: number;
  every: number;
  next: number;
  mult: number;
  element: Element;
  drops: { x: number; y: number; t: number }[];
}
export interface LootInst {
  id: number;
  x: number;
  y: number;
  z: number;
  vz: number;
  t: number;
  bundle: LootBundle;
  kind: 'crystal' | 'chest';
  opened: boolean;
  rarity: number;
}

let LOOT_ID = 1;

export function isNight(h: number): boolean {
  return h >= 20 || h < 5;
}

export class World {
  map!: GameMap;
  private cache = new Map<string, GameMap>();
  monsters: Monster[] = [];
  npcs: Npc[] = [];
  companion: Companion | null = null;
  projectiles: Projectile[] = [];
  teles: TeleInst[] = [];
  zones: ZoneInst[] = [];
  traps: TrapInst[] = [];
  rains: RainInst[] = [];
  loots: LootInst[] = [];
  flow = new Int16Array(1);
  flowT = 0;
  weather: Weather = 'clear';
  weatherT = 3;
  lightningT = 6;
  lightning = 0;
  transition: { to: string; entry: string; t: number; phase: 'out' | 'in'; after?: () => void } | null = null;
  nearest: Interactable | null = null;
  boss: Monster | null = null;
  rushQueue: string[] = [];
  eliteAlive: Monster | null = null;
  timers: { t: number; fn: () => void }[] = [];
  private enemies: Actor[] = [];
  private allies: Actor[] = [];

  // ---------------------------------------------------------------- maps

  getMap(id: string): GameMap {
    const [kind, arg] = id.split(':');
    const n = Number(arg);
    if ((kind === 'city' || kind === 'wild') && this.cache.has(id)) return this.cache.get(id) as GameMap;
    let m: GameMap;
    switch (kind) {
      case 'city':
        m = genCity(n);
        break;
      case 'wild':
        m = genWild(n);
        break;
      case 'dun':
        m = genDungeon(n, 9000 + n * 31);
        break;
      case 'house':
        m = genHouse(n, G.save.houses[n] ?? { owned: true, furniture: [] });
        break;
      case 'abyss': {
        const seed = n * 7717 + Math.floor(Math.random() * 1e6);
        m = genDungeon((n - 1) % 5, seed, n);
        m.modifiers = abyssModifiers(n, seed);
        break;
      }
      default:
        m = genArena();
    }
    if (kind === 'city' || kind === 'wild') this.cache.set(id, m);
    return m;
  }

  /** swap in a regenerated version of the current map without moving actors (housing edits) */
  replaceMap(m: GameMap): void {
    this.map = m;
    this.flow = new Int16Array(m.w * m.h);
  }

  travel(to: string, entry: string, after?: () => void): void {
    if (this.transition) return;
    this.transition = { to, entry, t: 0, phase: 'out', after };
    audio.play('door', 0.6);
  }

  load(id: string, entry: string): void {
    const m = this.getMap(id);
    this.map = m;
    this.monsters = [];
    this.npcs = [];
    this.projectiles = [];
    this.teles = [];
    this.zones = [];
    this.traps = [];
    this.rains = [];
    this.loots = [];
    this.timers = [];
    this.boss = null;
    this.rushQueue = [];
    this.eliteAlive = null;
    fx.clear();
    this.flow = new Int16Array(m.w * m.h);
    this.flowT = 0;
    const p = G.player;
    const e = m.entries[entry] ?? m.entries[Object.keys(m.entries)[0]] ?? { x: m.pw / 2, y: m.ph / 2 };
    const pos = m.boxFree(e.x, e.y, p.hw, p.hh) ? e : m.nearestFree(e.x, e.y, 6);
    p.x = pos.x;
    p.y = pos.y;
    p.kbx = p.kby = 0;
    p.z = 0;
    if (p.casting) {
      p.casting.cancel();
      p.casting = null;
    }
    p.st = p.dead ? p.st : 'normal';
    if (this.companion) {
      const c = this.companion;
      const cp = m.nearestFree(p.x - 24, p.y + 8, 4);
      c.x = cp.x;
      c.y = cp.y;
      c.kbx = c.kby = 0;
      c.target = null;
      if (c.st !== 'down') c.st = 'follow';
    }
    const s = G.save;
    s.map = id;
    if (m.kind === 'city') s.lastCity = m.realm;
    for (const sp of m.npcs) {
      if (sp.role === 'companion' && sp.companion && s.companions[sp.companion]?.recruited) continue;
      this.npcs.push(new Npc(sp, Math.floor(sp.x * 13 + sp.y * 7)));
    }
    for (const z of m.spawns) {
      z.alive = 0;
      z.timer = 0;
      this.fillZone(z);
    }
    for (const c of m.chests) {
      if (c.opened) continue;
      const lvl = m.kind === 'abyss' ? 8 + m.floor : REALMS[m.realm].levels[1];
      const bundle: LootBundle = { gold: 20 + lvl * 6, items: [['enh_stone', 1], [REALMS[m.realm].herbs[0], rndi(1, 3)]], gear: [randomGear(lvl, c.rarity)], rarity: c.rarity };
      this.spawnLoot(c.x, c.y, bundle, 'chest');
    }
    this.weather = m.outdoor ? pick(REALMS[m.realm].weather) : 'clear';
    const R = REALMS[m.realm];
    audio.setMusic(m.music, R.music.root, R.music.minor);
    const sub = m.kind === 'city' ? R.cityTitle : m.kind === 'wild' ? `Lv. ${R.levels[0]}-${R.levels[1]}` : m.kind === 'abyss' ? (m.modifiers.length ? 'Modifiers: ' + m.modifiers.join(', ') : '') : m.kind === 'dungeon' ? R.dungeonDesc : '';
    fx.banner(m.name, '#bfe6ff', sub, 36, 2.2);
    G.game.snapCamera();
    if (m.kind === 'wild') this.updateElite(true);
  }

  // ---------------------------------------------------------------- spawning

  spawnMonster(id: string, level: number, x: number, y: number, mods: string[] = []): Monster {
    const m = new Monster(MONSTERS[id], level, x, y, mods);
    this.monsters.push(m);
    return m;
  }

  private fillZone(z: GameMap['spawns'][number]): void {
    let guard = 0;
    while (z.alive < z.count && guard++ < 20) {
      const a = Math.random() * TAU;
      const r = Math.random() * z.r;
      const p = this.map.nearestFree(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, 3);
      if (G.player && dist(p.x, p.y, G.player.x, G.player.y) < 180 && this.map.kind === 'wild') continue;
      const m = this.spawnMonster(pick(z.monsters), rndi(z.lvl[0], z.lvl[1]), p.x, p.y, this.map.modifiers);
      m.zone = z;
      if (this.map.kind === 'abyss') m.alwaysAggro = false;
      z.alive++;
    }
  }

  spawnProjectile(owner: Actor, spec: ProjSpec, angle: number, tx: number, ty: number, branch: Branch | null, skill = false): void {
    this.projectiles.push(new Projectile(owner, spec, angle, tx, ty, branch, skill));
  }

  addTele(shape: TeleShape, dur: number, owner: number, onDone: (() => void) | null, color = '#ff3b3b', spin = 0, beam = false): TeleInst {
    const t: TeleInst = { shape, t: 0, dur: Math.max(0.05, dur), color, owner, onDone, spin, beam };
    this.teles.push(t);
    return t;
  }

  removeTeles(owner: number): void {
    this.teles = this.teles.filter((t) => t.owner !== owner);
  }

  addZone(spec: ZoneSpec, owner: Actor | null): void {
    this.zones.push({ spec, t: 0, tickT: 0, owner });
  }

  addTrap(x: number, y: number, dur: number, root: number, owner: Actor): void {
    this.traps.push({ x, y, t: 0, dur, root, owner });
  }

  addRain(owner: Actor, x: number, y: number, r: number, count: number, dur: number, mult: number, element: Element): void {
    this.rains.push({ owner, x, y, r, left: count, every: dur / count, next: 0, mult, element, drops: [] });
  }

  spawnLoot(x: number, y: number, bundle: LootBundle, kind: 'crystal' | 'chest'): void {
    this.loots.push({ id: LOOT_ID++, x, y, z: kind === 'chest' ? 0 : 30, vz: kind === 'chest' ? 0 : 140, t: 0, bundle, kind, opened: false, rarity: bundle.rarity });
  }

  after(t: number, fn: () => void): void {
    this.timers.push({ t, fn });
  }

  monsterById(id: number): Monster | null {
    for (const m of this.monsters) if (m.id === id) return m;
    return null;
  }

  targetsFor(team: Team): Actor[] {
    return team === 'player' ? this.enemies : team === 'enemy' ? this.allies : [];
  }

  setCompanion(id: string | null): void {
    if (!id) {
      this.companion = null;
      return;
    }
    const def = COMPANION_BY_ID[id];
    const cs = G.save.companions[id];
    if (!def || !cs) return;
    const c = new Companion(def, cs);
    const p = G.player;
    const pos = this.map.nearestFree(p.x - 26, p.y + 10, 4);
    c.x = pos.x;
    c.y = pos.y;
    this.companion = c;
  }

  // ---------------------------------------------------------------- events

  onMonsterKilled(m: Monster): void {
    if (m.zone) {
      m.zone.alive = Math.max(0, m.zone.alive - 1);
      m.zone.timer = m.zone.respawn;
    }
    onKillBounty(m.def.id);
    if (m === this.eliteAlive) {
      this.eliteAlive = null;
      G.save.elitesSlain.push(this.eliteKey());
      G.ui.toast(`Named Elite slain: ${m.def.name}!`, 'loot');
    }
    if (m === this.boss) this.onBossDefeated(m);
  }

  private onBossDefeated(m: Monster): void {
    const br = this.map.bossRoom;
    const s = G.save;
    if (this.rushQueue.length && br) {
      const next = this.rushQueue.shift() as string;
      this.boss = null;
      fx.banner('GUARDIAN FALLS', '#ffd166', 'The next challenger approaches...', 44, 1.6);
      this.after(2.4, () => this.spawnBoss(next, br.level));
      return;
    }
    this.boss = null;
    s.counters.bossKills++;
    if (G.player.hp < G.player.stats.maxHp * 0.15) s.counters.lowHpBossWins++;
    checkAwakenings();
    if (br) {
      br.defeated = true;
      for (const idx of br.doorCells) this.map.solid[idx] = SOL.FREE;
    }
    const R = REALMS[this.map.realm];
    audio.setMusic(this.map.music, R.music.root, R.music.minor);
    if (this.map.kind === 'abyss') {
      floorCleared();
      return;
    }
    if (this.map.kind !== 'dungeon' || !br) return;
    const realm = this.map.realm;
    onBossBounty(m.def.id);
    const first = !s.bosses[realm];
    s.bosses[realm] = true;
    const bdef = BOSSES[m.def.id];
    if (first && bdef) {
      addItem(bdef.trophy, 1);
      G.ui.toast(`Trophy earned: ${itemDef(bdef.trophy).name}. Display it in your house!`, 'loot');
    }
    fx.banner('VICTORY', '#ffd166', `${m.def.name} has fallen!`, 70, 2.4);
    audio.play('levelup');
    if (s.mode === 'chronicle' && realm < 4 && s.unlocked < realm + 2) {
      s.unlocked = realm + 2;
      this.after(2.6, () => {
        fx.banner('NEW REALM UNLOCKED', '#7fe9ff', `The Teleport Gate to ${REALMS[realm + 1].city} is open!`, 48, 2.6);
        audio.play('awaken');
      });
    }
    const c = this.map.entries.boss;
    this.map.addProp({ kind: 'crystal', x: c.x, y: c.y + 30, sprite: 'crystal:exit', ax: 22, ay: 80, sw: 44, sh: 84, sortOff: 0, light: { r: 150, color: '#7fe9ff', oy: -40 } });
    this.map.addInteract(c.x, c.y + 36, 'Teleport Crystal: return to ' + R.city, { t: 'crystal' }, 44);
  }

  spawnBoss(id: string, level: number): void {
    const c = this.map.entries.boss;
    const m = this.spawnMonster(id, level, c.x, c.y - 30, this.map.modifiers);
    m.alwaysAggro = true;
    m.target = G.player;
    m.st = 'chase';
    m.spawnT = 0;
    this.boss = m;
    const title = BOSSES[id]?.title ?? 'Floor Warden';
    fx.banner(m.def.name, '#ff5d6c', title, 50, 2.4);
    fx.flash('#ff3b3b', 0.15);
    audio.play('roar');
    const intro = BOSSES[id]?.intro;
    if (intro) G.ui.toast(intro, 'boss');
  }

  private startBoss(): void {
    const br = this.map.bossRoom;
    if (!br) return;
    br.started = true;
    for (const idx of br.doorCells) this.map.solid[idx] = SOL.WALL;
    const c = this.companion;
    if (c && !c.dead) {
      const p = this.map.nearestFree(G.player.x, G.player.y + 20, 3);
      c.x = p.x;
      c.y = p.y;
    }
    const ids = br.boss.startsWith('rush:') ? br.boss.slice(5).split(',') : [br.boss];
    this.rushQueue = ids.slice(1);
    const R = REALMS[this.map.realm];
    audio.setMusic('boss', R.music.root, true);
    this.spawnBoss(ids[0], br.level);
  }

  private eliteKey(): string {
    const s = G.save;
    return `${s.time < 5 ? s.day - 1 : s.day}:${this.map.realm}`;
  }

  private updateElite(force = false): void {
    const m = this.map;
    if (m.kind !== 'wild' || !m.eliteSpot) return;
    const night = isNight(G.save.time);
    if (night && !this.eliteAlive && !G.save.elitesSlain.includes(this.eliteKey())) {
      const R = REALMS[m.realm];
      const e = this.spawnMonster(R.elite, R.levels[1] + 1, m.eliteSpot.x, m.eliteSpot.y, m.modifiers);
      e.alwaysAggro = false;
      this.eliteAlive = e;
      if (!force) audio.play('roar', 0.6);
      G.ui.toast(`A Named Elite stalks the ${R.short} tonight: ${MONSTERS[R.elite].name}!`, 'boss');
    }
    if (!night && this.eliteAlive && !this.eliteAlive.dead) {
      this.eliteAlive.removed = true;
      this.eliteAlive.dead = true;
      G.ui.toast(`${this.eliteAlive.def.name} retreats with the dawn.`, 'info');
      this.eliteAlive = null;
    }
  }

  // ---------------------------------------------------------------- player actions

  trySwitch(): void {
    const p = G.player;
    const c = this.companion;
    if (!c) {
      G.ui.toast('Recruit a companion at a Guild Hall to use SWITCH!', 'info');
      return;
    }
    if (c.dead || p.dead) return;
    if (p.switchGauge < 100) {
      audio.play('error');
      return;
    }
    let target: Actor | null = null;
    let bd = 280;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const d = dist(p.x, p.y, m.x, m.y) - (m.target === p ? 60 : 0);
      if (d < bd) {
        bd = d;
        target = m;
      }
    }
    if (!target) {
      G.ui.toast('No enemy close enough to SWITCH.', 'info');
      return;
    }
    p.switchGauge = 0;
    G.game.slowmo(0.35, 0.25);
    G.game.zoomPulse(1.14, 0.7);
    fx.banner('SWITCH!', '#7fe9ff', `${c.def.name}: ${c.def.chain}!`, 76, 1.25);
    audio.play('switch');
    p.casting?.cancel();
    p.casting = null;
    p.st = 'dodge';
    p.dodgeT = 0.24;
    p.dodgeAng = angTo(target.x, target.y, p.x, p.y);
    p.iframes = Math.max(p.iframes, 1.5);
    p.blocking = false;
    for (const m of this.monsters) if (m.target === p && m.tauntT <= 0) m.target = c;
    c.performChain(target);
    p.chainT = 4;
  }

  interactNearest(): void {
    if (this.nearest) G.game.interact(this.nearest);
  }

  respawnPlayer(): void {
    const p = G.player;
    const inArena = this.map.kind === 'arena';
    let msg: string;
    if (inArena) {
      arena.onDeath();
      msg = 'You were carried out of the arena. The Coliseum carries no death penalty.';
    } else {
      const pen = deathPenalty();
      msg = `Emergency teleport complete. Lost ${pen.xp} XP and a ${pen.gold} G revival fee. Your gear is safe.`;
    }
    p.revive();
    p.iframes = 3;
    const city = G.save.lastCity;
    this.travel(`city:${city}`, inArena ? 'coliseum' : 'gate', () => G.ui.toast(msg, inArena ? 'info' : 'warn'));
  }

  // ---------------------------------------------------------------- update

  update(dt: number, realDt: number): void {
    const p = G.player;
    if (this.transition) {
      const tr = this.transition;
      tr.t += realDt;
      if (tr.phase === 'out' && tr.t >= 0.3) {
        this.load(tr.to, tr.entry);
        tr.phase = 'in';
        tr.t = 0;
        const after = tr.after;
        tr.after = undefined;
        after?.();
      } else if (tr.phase === 'in' && tr.t >= 0.35) this.transition = null;
      if (tr.phase === 'out') return;
    }
    this.enemies = this.monsters.filter((m) => !m.dead);
    this.allies = [p, ...(this.companion && !this.companion.dead ? [this.companion] : [])].filter((a) => !a.dead);
    this.updateClock(dt);
    this.updateZones(dt);
    p.update(dt);
    if (this.companion) this.companion.update(dt);
    for (const m of this.monsters) m.update(dt);
    for (const n of this.npcs) n.update(dt);
    for (const pr of this.projectiles) pr.update(dt);
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
    this.updateTeles(dt);
    this.updateTraps(dt);
    this.updateRains(dt);
    this.updateLoots(dt);
    this.integrate(dt);
    for (const m of this.monsters) {
      if (m.dead && m.dying > 0 && !m.removed) {
        m.dying -= dt;
        if (m.dying <= 0) {
          const cols = [...m.def.colors, '#ffffff'];
          fx.shatter(m.x, m.y - m.height() * 0.4, cols, Math.max(0.7, m.def.size / 14));
          if (dist(m.x, m.y, p.x, p.y) < 600) audio.play('shatter', m.isBoss ? 1 : 0.6);
          m.removed = true;
        }
      }
    }
    this.monsters = this.monsters.filter((m) => !m.removed);
    // respawn zones
    if (this.map.kind === 'wild') {
      for (const z of this.map.spawns) {
        if (z.alive < z.count) {
          z.timer -= dt;
          if (z.timer <= 0 && dist(z.x, z.y, p.x, p.y) > 300) this.fillZone(z);
        }
      }
      this.updateElite();
    }
    for (const n of this.map.nodes) {
      if (!n.ready) {
        n.respawn -= dt;
        if (n.respawn <= 0) n.ready = true;
      }
    }
    for (let i = this.timers.length - 1; i >= 0; i--) {
      this.timers[i].t -= dt;
      if (this.timers[i].t <= 0) {
        const fn = this.timers[i].fn;
        this.timers.splice(i, 1);
        fn();
      }
    }
    // flow field toward the player
    this.flowT -= dt;
    if (this.flowT <= 0) {
      this.flowT = 0.35;
      this.map.flowField(p.x, p.y, 34, this.flow);
    }
    // boss room trigger
    const br = this.map.bossRoom;
    if (br && !br.started && !br.defeated && !p.dead) {
      const tx = p.x / TILE;
      const ty = p.y / TILE;
      if (tx > br.x + 1 && tx < br.x + br.w - 1 && ty > br.y + 1 && ty < br.y + br.h - 1) this.startBoss();
    }
    if (this.map.kind === 'arena') arena.update(dt);
    this.updateNearest();
    if (!this.transition && !p.dead) {
      for (const e of this.map.exits) {
        if (p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h) {
          this.travel(e.to, e.entry);
          break;
        }
      }
    }
  }

  private updateClock(dt: number): void {
    const s = G.save;
    const hours = dt / SECONDS_PER_HOUR;
    s.time += hours;
    s.playTime += dt;
    if (s.time >= 24) {
      s.time -= 24;
      s.day++;
      refreshBoard();
    }
    updateEconomy(hours);
    if (this.map.outdoor) {
      this.weatherT -= hours;
      if (this.weatherT <= 0) {
        this.weatherT = rnd(2, 5);
        const nw = pick(REALMS[this.map.realm].weather);
        if (nw !== this.weather) {
          this.weather = nw;
          const names: Record<Weather, string> = { clear: 'The skies clear.', rain: 'Rain begins to fall.', storm: 'A thunderstorm rolls in!', blizzard: 'A blizzard sweeps the glaciers!', ash: 'Ember ash drifts from the caldera.' };
          G.ui.toast(names[nw], 'info');
        }
      }
      if (this.weather === 'storm') {
        this.lightningT -= dt;
        if (this.lightningT <= 0) {
          this.lightningT = rnd(5, 12);
          this.lightning = 1;
          window.setTimeout(() => audio.play('thunder', 0.8), 250);
        }
      }
    }
    this.lightning = Math.max(0, this.lightning - dt * 3.5);
  }

  private updateZones(dt: number): void {
    const p = G.player;
    const actors: Actor[] = [p, ...(this.companion ? [this.companion] : []), ...this.monsters];
    for (const a of actors) {
      a.slowZone = 0;
      a.inCitadel = false;
    }
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      const s = z.spec;
      z.t += dt;
      if (z.t >= s.dur) {
        this.zones.splice(i, 1);
        continue;
      }
      z.tickT -= dt;
      const tick = z.tickT <= 0;
      if (tick) z.tickT = s.tick ?? 0.5;
      const allies = s.team === 'player' ? this.allies : this.enemies;
      const foes = s.team === 'player' ? this.enemies : this.allies;
      for (const a of allies) {
        if (dist(a.x, a.y, s.x, s.y) > s.r) continue;
        if (s.kind === 'citadel') a.inCitadel = true;
        if (s.kind === 'sanctuary' && tick) {
          const h = a.stats.maxHp * (s.heal ?? 0.04);
          a.hp = Math.min(a.stats.maxHp, a.hp + h);
          a.clearDebuffs();
          if (a === p) fx.number(a.x, a.y - 34, '+' + Math.round(h), '#7dff9a', 12);
          fx.heal(a.x, a.y);
        }
      }
      for (const f of foes) {
        const d = dist(f.x, f.y, s.x, s.y);
        if (d > s.r + f.radius) continue;
        if (s.slow) f.slowZone = Math.max(f.slowZone, s.slow);
        if (s.pull) {
          const a = angTo(f.x, f.y, s.x, s.y);
          const k = s.pull * dt * (s.pull < 0 ? 2 : 1);
          if (d > 8 || s.pull < 0) this.map.move(f, Math.cos(a) * k, Math.sin(a) * k, f.flying);
        }
        if (tick && s.mult && z.owner) damage(z.owner, f, { mult: s.mult, element: s.element, status: s.status, kb: 0, source: 'zone', canBlock: false, srcX: s.x, srcY: s.y });
      }
    }
  }

  private updateTeles(dt: number): void {
    for (let i = this.teles.length - 1; i >= 0; i--) {
      const t = this.teles[i];
      t.t += dt;
      if (t.spin && (t.shape.kind === 'line' || t.shape.kind === 'cone')) t.shape.a += t.spin * dt;
      if (t.beam) {
        const o = this.monsterById(t.owner);
        if (o && t.shape.kind === 'line') {
          t.shape.x = o.x;
          t.shape.y = o.y;
        }
      }
      if (t.t >= t.dur) {
        this.teles.splice(i, 1);
        const owner = this.monsterById(t.owner);
        if (t.onDone && owner && !owner.dead && owner.canAct()) t.onDone();
      }
    }
  }

  private updateTraps(dt: number): void {
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const tr = this.traps[i];
      tr.t += dt;
      let fired = false;
      for (const f of this.targetsFor(tr.owner.team)) {
        if (f.dead || dist(f.x, f.y, tr.x, tr.y) > 30 + f.radius) continue;
        f.addStatus({ kind: 'root', dur: tr.root });
        damage(tr.owner, f, { mult: 0.6, source: 'skill', isSkill: true, branch: 'bow', kb: 0 });
        fx.burst(tr.x, tr.y, '#ffb35c', 12, 90);
        fired = true;
        break;
      }
      if (fired || tr.t >= tr.dur) this.traps.splice(i, 1);
    }
  }

  private updateRains(dt: number): void {
    for (let i = this.rains.length - 1; i >= 0; i--) {
      const r = this.rains[i];
      r.next -= dt;
      if (r.left > 0 && r.next <= 0) {
        r.next = r.every;
        r.left--;
        const inside = this.targetsFor(r.owner.team).filter((t) => !t.dead && dist(t.x, t.y, r.x, r.y) < r.r);
        let x: number;
        let y: number;
        if (inside.length) {
          const t = pick(inside);
          x = t.x + rnd(-14, 14);
          y = t.y + rnd(-10, 10);
        } else {
          const a = Math.random() * TAU;
          const d = Math.sqrt(Math.random()) * r.r;
          x = r.x + Math.cos(a) * d;
          y = r.y + Math.sin(a) * d * 0.8;
        }
        r.drops.push({ x, y, t: 0 });
      }
      for (let j = r.drops.length - 1; j >= 0; j--) {
        const d = r.drops[j];
        d.t += dt;
        if (d.t >= 0.22) {
          r.drops.splice(j, 1);
          for (const t of this.targetsFor(r.owner.team)) {
            if (t.dead || dist(t.x, t.y, d.x, d.y) > 34 + t.radius) continue;
            damage(r.owner, t, { mult: r.mult, element: r.element, isSkill: true, branch: 'bow', source: 'skill', brk: 3, kb: 30 });
          }
          fx.sparks(d.x, d.y, '#ffe0a0', 5, 90, 2);
        }
      }
      if (r.left <= 0 && r.drops.length === 0) this.rains.splice(i, 1);
    }
  }

  private updateLoots(dt: number): void {
    const p = G.player;
    for (let i = this.loots.length - 1; i >= 0; i--) {
      const l = this.loots[i];
      l.t += dt;
      if (l.kind === 'crystal') {
        l.vz -= 420 * dt;
        l.z += l.vz * dt;
        if (l.z < 8) {
          l.z = 8;
          l.vz = Math.abs(l.vz) > 40 ? -l.vz * 0.35 : 0;
        }
      }
      if (p.dead || l.t < 0.45) continue;
      const d = dist(p.x, p.y, l.x, l.y);
      if (l.kind === 'crystal' && d < 120 && d >= 30) {
        const pull = Math.min(d, (180 + l.t * 120) * dt);
        l.x += ((p.x - l.x) / d) * pull;
        l.y += ((p.y - l.y) / d) * pull;
      }
      if (l.kind === 'crystal' && d < 30) {
        this.collect(l);
        this.loots.splice(i, 1);
      } else if (l.kind === 'chest' && !l.opened && d < 34) {
        l.opened = true;
        l.t = 0;
        fx.burst(l.x, l.y - 14, '#ffd166', 22, 150);
        fx.ring(l.x, l.y, '#ffd166', 6, 60, 0.5);
        audio.play('coin');
        this.collect(l);
      } else if (l.kind === 'chest' && l.opened && l.t > 12) this.loots.splice(i, 1);
    }
  }

  private collect(l: LootInst): void {
    const b = l.bundle;
    const parts: string[] = [];
    if (b.gold > 0) {
      G.save.gold += b.gold;
      parts.push(`+${b.gold} G`);
      fx.number(l.x, l.y - 30, `+${b.gold} G`, '#ffd166', 14);
      audio.play('coin', 0.7);
    }
    for (const [id, n] of b.items) {
      addItem(id, n);
      parts.push(`${itemDef(id).name}${n > 1 ? ' x' + n : ''}`);
    }
    const left: GearItem[] = [];
    for (const g of b.gear) {
      if (addGear(g)) parts.push(`[${['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'][g.rarity]}] ${g.name}`);
      else left.push(g);
    }
    if (left.length) {
      G.ui.toast('Inventory full! Gear left on the ground.', 'warn');
      this.spawnLoot(l.x + 10, l.y + 10, { gold: 0, items: [], gear: left, rarity: l.rarity }, 'crystal');
    }
    if (parts.length) G.ui.toast(parts.join(', '), b.gear.length ? 'loot' : 'info');
    audio.play('pickup', 0.8);
  }

  private integrate(dt: number): void {
    const p = G.player;
    const all: Actor[] = [p, ...(this.companion ? [this.companion] : []), ...this.monsters];
    for (const a of all) {
      if (Math.abs(a.kbx) + Math.abs(a.kby) > 2) {
        this.map.move(a, a.kbx * dt, a.kby * dt, a.flying);
        const k = Math.max(0, 1 - 9 * dt);
        a.kbx *= k;
        a.kby *= k;
      } else a.kbx = a.kby = 0;
    }
    const ms = this.monsters;
    for (let i = 0; i < ms.length; i++) {
      const a = ms[i];
      if (a.dead) continue;
      for (let j = i + 1; j < ms.length; j++) {
        const b = ms[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = (a.radius + b.radius) * 0.7;
        const d2 = dx * dx + dy * dy;
        if (d2 < min * min && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          this.map.move(a, (-dx / d) * push, (-dy / d) * push, a.flying);
          this.map.move(b, (dx / d) * push, (dy / d) * push, b.flying);
        }
      }
      const dx = a.x - p.x;
      const dy = a.y - p.y;
      const min = (a.radius + p.radius) * 0.65;
      const d2 = dx * dx + dy * dy;
      if (!p.dead && d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        this.map.move(a, (dx / d) * (min - d) * 0.6, (dy / d) * (min - d) * 0.6, a.flying);
      }
    }
  }

  private updateNearest(): void {
    const p = G.player;
    let best: Interactable | null = null;
    let bd = Infinity;
    for (const it of this.map.interacts) {
      if (it.disabled) continue;
      const d = dist(p.x, p.y, it.x, it.y);
      if (d < it.r && d < bd) {
        bd = d;
        best = it;
      }
    }
    for (const n of this.npcs) {
      const d = dist(p.x, p.y, n.x, n.y);
      if (d < 42 && d < bd) {
        bd = d;
        best = { id: -n.id, x: n.x, y: n.y, r: 42, label: n.spawn.role === 'companion' ? `Talk to ${n.displayName}` : `Talk to ${n.displayName}`, action: { t: 'npc', npc: n.id } };
      }
    }
    for (const n of this.map.nodes) {
      if (!n.ready) continue;
      const d = dist(p.x, p.y, n.x, n.y);
      if (d < 36 && d < bd) {
        bd = d;
        best = { id: -100000 - n.id, x: n.x, y: n.y, r: 36, label: `Gather ${itemDef(n.item).name}`, action: { t: 'node', node: n.id } };
      }
    }
    this.nearest = best;
  }

  nodeById(id: number): ResourceNode | null {
    return this.map.nodes.find((n) => n.id === id) ?? null;
  }

  npcById(id: number): Npc | null {
    return this.npcs.find((n) => n.id === id) ?? null;
  }

  /** steering direction from the BFS flow field toward the player, or null */
  flowDir(x: number, y: number): number | null {
    const m = this.map;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (!m.inBounds(tx, ty)) return null;
    const cur = this.flow[m.idx(tx, ty)];
    let best = cur < 0 ? 32767 : cur;
    let bx = -1;
    let by = -1;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (!m.inBounds(nx, ny)) continue;
        if (dx && dy && (!m.walkable(tx + dx, ty) || !m.walkable(tx, ty + dy))) continue;
        const v = this.flow[m.idx(nx, ny)];
        if (v >= 0 && v < best) {
          best = v;
          bx = nx;
          by = ny;
        }
      }
    }
    if (bx < 0) return null;
    return angTo(x, y, bx * TILE + TILE / 2, by * TILE + TILE / 2);
  }
}

