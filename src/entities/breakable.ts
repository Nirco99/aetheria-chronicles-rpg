// Interactive battlefield props: Explosive Alchemical Barrels (fire AoE that hurts enemies),
// Frost Crystal Clusters (freeze nearby enemies) and Breakable Crates / Urns (coins, potions, ores).
// They sit in the player's target list so swings, arrows, spells and Wall-Slams all break them.
import type { HitOpts } from '../systems/combat';
import type { LootBundle } from '../systems/combat';
import { Actor } from './actor';
import { G } from '../core/state';
import { REALMS } from '../data/realms';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { angTo, chance, dist, pick, rnd, rndi } from '../engine/util';
import { damage } from '../systems/combat';
import { paintGauge } from '../systems/reactions';
import { style } from '../systems/feel';

export type BreakableKind = 'barrel' | 'frost' | 'crate' | 'urn';

export class Breakable extends Actor {
  readonly kind = 'prop' as const;
  readonly variant: BreakableKind;
  hits: number;
  shake = 0;

  constructor(variant: BreakableKind, x: number, y: number, level: number) {
    super();
    this.variant = variant;
    this.team = 'enemy';
    this.x = x;
    this.y = y;
    this.level = level;
    this.hw = 9;
    this.hh = 6;
    this.radius = variant === 'frost' ? 14 : 12;
    this.hits = variant === 'frost' ? 2 : variant === 'barrel' ? 1 : 1;
    this.stats.maxHp = this.hp = 1;
    this.stats.def = 0;
  }

  get displayName(): string {
    return { barrel: 'Alchemical Barrel', frost: 'Frost Crystal', crate: 'Crate', urn: 'Urn' }[this.variant];
  }

  /** returns damage dealt (1 for the number of hits it absorbed) */
  hit(src: Actor | null, _o: HitOpts): number {
    if (this.dead) return 0;
    this.hits--;
    this.shake = 0.18;
    this.flash = 0.1;
    if (this.hits > 0) {
      fx.sparks(this.x, this.y - 16, this.variant === 'frost' ? '#bff3ff' : '#e8d8b0', 6, 120);
      audio.play(this.variant === 'frost' ? 'ice' : 'hit', 0.5);
      return 1;
    }
    this.shatterNow(src);
    return 1;
  }

  shatterNow(src: Actor | null): void {
    if (this.dead) return;
    this.dead = true;
    this.removed = true;
    G.save.counters.breakables++;
    style.add(20, 'Smash');
    const owner = src && src.team === 'player' ? src : G.player;
    switch (this.variant) {
      case 'barrel':
        this.explode(owner);
        break;
      case 'frost':
        this.freezeBurst(owner);
        break;
      default:
        this.spill();
    }
  }

  private explode(owner: Actor): void {
    const R = 96;
    fx.burst(this.x, this.y - 12, '#ff7a3d', 34, 260);
    fx.burst(this.x, this.y - 12, '#ffd166', 16, 180);
    fx.ring(this.x, this.y, '#ffb35c', 10, R, 0.45, 7);
    fx.shatter(this.x, this.y - 12, ['#6b4224', '#8a5a32', '#3a2414'], 0.6);
    fx.shake(7);
    audio.play('fire');
    audio.play('quake', 0.5);
    const dmg = 40 + this.level * 9;
    for (const t of G.world.targetsFor('player')) {
      if (t === this || t.dead) continue;
      if (dist(t.x, t.y, this.x, this.y) > R + t.radius) continue;
      if (t.kind === 'prop') {
        G.world.after(0.12, () => (t as Breakable).shatterNow(owner));
        continue;
      }
      const a = angTo(this.x, this.y, t.x, t.y);
      damage(owner, t, { flat: dmg, source: 'reflect', canBlock: false, kb: 260, kbAngle: a, srcX: this.x, srcY: this.y });
      t.kbFresh = 0.35;
      t.addStatus({ kind: 'burn', dur: 4, power: 1.3 });
      paintGauge(owner, t, 'burn', dmg);
    }
  }

  private freezeBurst(owner: Actor): void {
    const R = 120;
    fx.shatter(this.x, this.y - 16, ['#bff3ff', '#7fe9ff', '#ffffff', '#4aa8ff'], 0.9);
    fx.ring(this.x, this.y, '#bff3ff', 10, R, 0.5, 6);
    audio.play('shatter');
    audio.play('ice');
    const dmg = 25 + this.level * 6;
    for (const t of G.world.targetsFor('player')) {
      if (t === this || t.dead || t.kind === 'prop') continue;
      if (dist(t.x, t.y, this.x, this.y) > R + t.radius) continue;
      damage(owner, t, { flat: dmg, source: 'reflect', canBlock: false, kb: 0 });
      t.addStatus({ kind: 'freeze', dur: 2.5 });
      paintGauge(owner, t, 'frost', dmg);
    }
  }

  private spill(): void {
    fx.shatter(this.x, this.y - 10, this.variant === 'crate' ? ['#8a5a32', '#6b4224', '#c9a46e'] : ['#b9845a', '#8a5a3a', '#e0c49a'], 0.55);
    audio.play('break', 0.4);
    const R = REALMS[G.world.map.realm];
    const items: [string, number][] = [];
    if (chance(0.35)) items.push([pick(['pot_hp_s', 'pot_mp_s', 'pot_hp_s']), 1]);
    if (chance(0.4)) items.push([pick(R.ores), rndi(1, 2)]);
    if (chance(0.15)) items.push([pick(R.herbs), 1]);
    if (chance(0.02)) items.push(['treasure_map', 1]);
    const bundle: LootBundle = { gold: Math.round((4 + this.level * 1.5) * rnd(0.6, 1.6)), items, gear: [], rarity: items.some(([id]) => id === 'treasure_map') ? 3 : 0 };
    G.world.spawnLoot(this.x, this.y, bundle, 'crystal');
  }

  update(dt: number): void {
    if (this.shake > 0) this.shake -= dt;
    if (this.flash > 0) this.flash -= dt;
  }
}

/** Aether Jump Pad: stepping on it launches the Diver to its paired landing point */
export interface JumpPad {
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** elevation tier at the landing point */
  lvl: number;
  cd: number;
}
