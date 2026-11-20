// Dynamic world events: Corrupted Gate Outbreaks, Caravan Escorts (which unlock the Black-Market
// Vendor), roaming raid bosses with the Assault Team Raid Briefing, Ancient Treasure Map hunts
// and the Black Market's rotating stock.
import type { GearItem, TreasureHunt } from '../types/game';
import type { Monster } from '../entities/monster';
import { G } from '../core/state';
import { REALMS } from '../data/realms';
import { TILE, tierForLevel } from '../data/constants';
import { makeGear, randomSetPiece, randomUnique, GEAR_BASE_IDS } from '../data/items';
import { RAID_BOSSES } from '../data/v3';
import { Caravan } from '../entities/allies';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { dist, pick, rnd, rndi, TAU } from '../engine/util';
import { addGear, addItem } from './inventory';
import { checkAchievements } from './achievements';
import { isNight } from '../world/world';

export interface WorldEvent {
  kind: 'outbreak' | 'caravan';
  t: number;
  wave: number;
  waveT: number;
  gate: Monster | null;
  caravan: Caravan | null;
  x: number;
  y: number;
  done: boolean;
}

let eventClock = 0;
let raidClock = 0;
let raidPrompted = new Set<number>();

export function resetEvents(): void {
  eventClock = rnd(70, 140);
  raidClock = rnd(60, 120);
  raidPrompted = new Set();
}

function realmLevel(): number {
  const R = REALMS[G.world.map.realm];
  return Math.max(R.levels[1], Math.min(60, G.save.level));
}

function farPoint(minD: number): { x: number; y: number } | null {
  const m = G.world.map;
  const p = G.player;
  for (let i = 0; i < 60; i++) {
    const x = rnd(4, m.w - 4) * TILE;
    const y = rnd(6, m.h - 5) * TILE;
    const f = m.nearestFree(x, y, 3);
    if (!m.walkable(Math.floor(f.x / TILE), Math.floor(f.y / TILE))) continue;
    if (m.hasElev && m.elevAt(f.x, f.y) !== 0) continue;
    const d = dist(f.x, f.y, p.x, p.y);
    if (d > minD && d < minD + 900) return f;
  }
  return null;
}

// ------------------------------------------------------------------ outbreaks & caravans

export function startOutbreak(): void {
  const w = G.world;
  const pt = farPoint(420);
  if (!pt) return;
  const gate = w.spawnMonster('ev_gate', realmLevel(), pt.x, pt.y, []);
  gate.alwaysAggro = false;
  gate.eventTag = 'outbreak';
  w.event = { kind: 'outbreak', t: 0, wave: 0, waveT: 4, gate, caravan: null, x: pt.x, y: pt.y, done: false };
  fx.banner('CORRUPTED GATE OUTBREAK', '#a970ff', 'A corrupted gate is spewing monsters. Destroy it!', 44, 2.2);
  audio.play('roar', 0.6);
  G.ui.toast('World Event: a Corrupted Gate opened in the wilds. Follow the purple marker on your minimap and destroy it.', 'boss');
}

export function startCaravan(): void {
  const w = G.world;
  const m = w.map;
  const p = G.player;
  const start = m.nearestFree(p.x + rnd(-60, 60), p.y + rnd(40, 80), 4);
  const path: { x: number; y: number }[] = [start];
  let cx = start.x;
  let cy = start.y;
  const ang = rnd(0, TAU);
  for (let i = 0; i < 6; i++) {
    const a = ang + rnd(-0.6, 0.6);
    const nx = Math.max(4 * TILE, Math.min((m.w - 4) * TILE, cx + Math.cos(a) * 190));
    const ny = Math.max(6 * TILE, Math.min((m.h - 5) * TILE, cy + Math.sin(a) * 150));
    const f = m.nearestFree(nx, ny, 4);
    path.push(f);
    cx = f.x;
    cy = f.y;
  }
  const car = new Caravan(path, realmLevel());
  w.caravan = car;
  w.event = { kind: 'caravan', t: 0, wave: 0, waveT: 10, gate: null, caravan: car, x: path[path.length - 1].x, y: path[path.length - 1].y, done: false };
  fx.banner('CARAVAN ESCORT', '#ffd166', 'Protect the merchant caravan until it reaches safety', 44, 2.2);
  audio.play('engage', 0.6);
  G.ui.toast('World Event: a merchant caravan needs an escort. Stay close - it only moves while you are near. Success unlocks the Black Market.', 'boss');
}

function spawnWave(x: number, y: number, n: number, target: { x: number; y: number } | null): void {
  const w = G.world;
  const R = REALMS[w.map.realm];
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU);
    const pos = w.map.nearestFree(x + Math.cos(a) * rnd(60, 120), y + Math.sin(a) * rnd(40, 90), 3);
    const mon = w.spawnMonster(pick(R.monsters), realmLevel(), pos.x, pos.y, w.map.modifiers);
    mon.alwaysAggro = true;
    mon.eventTag = 'event';
    if (target) mon.target = target as unknown as Monster['target'];
    mon.st = 'chase';
  }
}

export function updateEvents(dt: number): void {
  const w = G.world;
  const m = w.map;
  const ev = w.event;
  if (m.kind !== 'wild') return;
  if (ev && !ev.done) {
    ev.t += dt;
    ev.waveT -= dt;
    if (ev.kind === 'outbreak' && ev.gate) {
      if (ev.gate.dead) finishEvent(true);
      else if (ev.waveT <= 0 && dist(G.player.x, G.player.y, ev.x, ev.y) < 700) {
        ev.waveT = 9;
        ev.wave++;
        spawnWave(ev.x, ev.y, 2 + Math.min(3, ev.wave), null);
        fx.ring(ev.x, ev.y, '#a970ff', 20, 140, 0.6, 5);
      }
    } else if (ev.kind === 'caravan' && ev.caravan) {
      const car = ev.caravan;
      if (car.dead) finishEvent(false);
      else if (car.arrived) finishEvent(true);
      else if (ev.waveT <= 0 && !car.waiting) {
        ev.waveT = 13;
        ev.wave++;
        const a = rnd(0, TAU);
        spawnWave(car.x + Math.cos(a) * 220, car.y + Math.sin(a) * 160, 2 + Math.min(3, ev.wave), car);
        G.ui.toast('Ambush! Bandit-beasts are attacking the caravan!', 'warn');
      }
    }
    return;
  }
  eventClock -= dt;
  if (eventClock <= 0 && !w.boss) {
    eventClock = rnd(240, 420);
    if (Math.random() < 0.5 || G.save.blackMarket) startOutbreak();
    else startCaravan();
  }
  // roaming raid bosses appear at night
  raidClock -= dt;
  if (raidClock <= 0) {
    raidClock = rnd(150, 260);
    if (isNight(G.save.time) && !w.monsters.some((x) => x.raid) && G.save.level >= 8 && Math.random() < 0.65) spawnRaidBoss();
  }
}

function finishEvent(win: boolean): void {
  const w = G.world;
  const ev = w.event;
  if (!ev) return;
  ev.done = true;
  const s = G.save;
  if (!win) {
    fx.banner('EVENT FAILED', '#ff5d6c', 'The caravan was destroyed', 40, 1.8);
    w.caravan = null;
    w.event = null;
    return;
  }
  const lvl = realmLevel();
  const gear: GearItem[] = [makeGear(pick(GEAR_BASE_IDS), tierForLevel(lvl), 3)];
  w.spawnLoot(ev.kind === 'caravan' && ev.caravan ? ev.caravan.x : ev.x, ev.kind === 'caravan' && ev.caravan ? ev.caravan.y : ev.y, { gold: 120 + lvl * 25, items: [['enh_stone', rndi(2, 4)], ['treasure_map', 1]], gear, rarity: 3 }, 'chest');
  if (ev.kind === 'outbreak') {
    s.counters.eventsWon++;
    fx.banner('GATE SEALED', '#a970ff', 'The outbreak is over. A reward chest awaits!', 44, 2);
  } else {
    s.counters.caravans++;
    s.counters.eventsWon++;
    const first = !s.blackMarket;
    s.blackMarket = true;
    fx.banner('CARAVAN SAFE', '#ffd166', first ? 'The Black-Market Vendor now trades in every city!' : 'The merchants pay you handsomely', 44, 2.2);
    if (first) G.ui.toast('Black Market unlocked: look for the hooded Black-Market Vendor near each city plaza.', 'loot');
  }
  audio.play('levelup', 0.7);
  w.caravan = null;
  w.event = null;
  checkAchievements(true);
}

// ------------------------------------------------------------------ roaming raid bosses

export function spawnRaidBoss(id?: string): Monster | null {
  const w = G.world;
  const pt = farPoint(520);
  if (!pt) return null;
  const info = id ? RAID_BOSSES.find((r) => r.id === id) ?? RAID_BOSSES[0] : pick(RAID_BOSSES);
  const lvl = Math.min(60, realmLevel() + 3);
  const b = w.spawnMonster(info.id, lvl, pt.x, pt.y, []);
  b.raid = true;
  b.alwaysAggro = false;
  b.target = null;
  b.st = 'idle';
  fx.banner('RAID BOSS SIGHTED', '#ff5d6c', `${info.name} roams the ${REALMS[w.map.realm].short}`, 46, 2.4);
  audio.play('roar', 0.8);
  G.ui.toast(`Roaming Raid Boss: ${info.name}. Approach it to receive the Assault Team Raid Briefing (red skull on your minimap).`, 'boss');
  return b;
}

/** shows the raid briefing the first time the Diver closes in on an idle raid boss */
export function checkRaidApproach(): void {
  const w = G.world;
  const p = G.player;
  for (const m of w.monsters) {
    if (!m.raid || m.dead || w.raid) continue;
    const d = dist(m.x, m.y, p.x, p.y);
    if (d > 640) raidPrompted.delete(m.id);
    if (d < 380 && !raidPrompted.has(m.id)) {
      raidPrompted.add(m.id);
      const info = RAID_BOSSES.find((r) => r.id === m.def.id);
      G.ui.openRaidBriefing(m.def.name, info?.desc ?? '', m.level, (vanguard) => w.beginRaid(m, vanguard), () => undefined);
    }
  }
}

// ------------------------------------------------------------------ treasure maps

export function startTreasureHunt(): boolean {
  const s = G.save;
  const realm = rndi(0, Math.max(0, Math.min(4, s.unlocked - 1)));
  const m = G.world.getMap(`wild:${realm}`);
  for (let i = 0; i < 80; i++) {
    const x = rnd(5, m.w - 5) * TILE;
    const y = rnd(8, m.h - 6) * TILE;
    const f = m.nearestFree(x, y, 3);
    if (!m.walkable(Math.floor(f.x / TILE), Math.floor(f.y / TILE))) continue;
    if (m.hasElev && m.elevAt(f.x, f.y) === 2) continue;
    const hunt: TreasureHunt = { id: `h${Date.now()}${i}`, realm, x: f.x, y: f.y, found: false };
    s.hunts = [...s.hunts.filter((h) => !h.found), hunt].slice(-3);
    G.ui.toast(`The Ancient Treasure Map reveals a dig site in the ${REALMS[realm].short}. Look for the gold X on the minimap.`, 'loot');
    audio.play('chime');
    return true;
  }
  return false;
}

export function digTreasure(h: TreasureHunt): void {
  const s = G.save;
  h.found = true;
  s.counters.treasures++;
  const lvl = Math.max(REALMS[h.realm].levels[1], s.level);
  const gear: GearItem[] = [];
  if (Math.random() < 0.12) {
    gear.push(randomUnique(tierForLevel(lvl)));
    s.counters.uniquesFound++;
  } else if (Math.random() < 0.45) gear.push(randomSetPiece(tierForLevel(lvl), 3));
  else gear.push(makeGear(pick(GEAR_BASE_IDS), tierForLevel(lvl), 3));
  G.world.spawnLoot(h.x, h.y, { gold: 200 + lvl * 30, items: [['gem_' + pick(['flame', 'frost', 'lightning', 'wind', 'void']), 1], ['enh_greater', 1]], gear, rarity: gear[0].rarity }, 'chest');
  fx.burst(h.x, h.y, '#ffd166', 30, 200);
  fx.dust(h.x, h.y, 16, '#a88a5a');
  fx.banner('TREASURE UNEARTHED', '#ffd166', '', 40, 1.6);
  audio.play('coin');
  checkAchievements(true);
}

// ------------------------------------------------------------------ black market

export interface BlackMarketOffer {
  id: string;
  label: string;
  price: number;
  gear?: GearItem;
  item?: string;
  qty?: number;
}

let bmDay = -1;
let bmStock: BlackMarketOffer[] = [];

export function blackMarketStock(): BlackMarketOffer[] {
  const s = G.save;
  if (bmDay === s.day && bmStock.length) return bmStock;
  bmDay = s.day;
  const tier = tierForLevel(Math.max(5, s.level));
  const u = randomUnique(tier);
  const sp1 = randomSetPiece(tier, 3);
  const sp2 = randomSetPiece(tier, 4);
  bmStock = [
    { id: 'bm_u', label: u.name, price: 9000 + tier * 4000, gear: u },
    { id: 'bm_s1', label: sp1.name, price: 2500 + tier * 1500, gear: sp1 },
    { id: 'bm_s2', label: sp2.name, price: 4000 + tier * 2000, gear: sp2 },
    { id: 'bm_map', label: 'Ancient Treasure Map', price: 1200, item: 'treasure_map', qty: 1 },
    { id: 'bm_relic', label: 'Abyssal Relic Shard', price: 1500, item: 'relic_shard', qty: 1 },
    { id: 'bm_core', label: 'Mythic Core', price: 6500, item: 'mythic_core', qty: 1 },
    { id: 'bm_greater', label: 'Greater Enhancement Stone x3', price: 1600, item: 'enh_greater', qty: 3 },
    { id: 'bm_gem', label: `${pick(['Flame', 'Frost', 'Lightning', 'Wind', 'Void'])} Gem`, price: 1400, item: 'gem_' + pick(['flame', 'frost', 'lightning', 'wind', 'void']), qty: 1 },
  ];
  return bmStock;
}

export function buyBlackMarket(o: BlackMarketOffer): string | null {
  const s = G.save;
  if (s.gold < o.price) return 'Not enough gold.';
  if (o.gear) {
    if (!addGear(o.gear)) return 'Your gear bag is full.';
    if (o.gear.unique) s.counters.uniquesFound++;
  } else if (o.item) addItem(o.item, o.qty ?? 1);
  s.gold -= o.price;
  bmStock = bmStock.filter((x) => x !== o);
  audio.play('coin');
  checkAchievements(true);
  return null;
}
