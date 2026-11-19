// Town NPCs: shopkeepers, guild clerks, guards, villagers and unrecruited companions.
import type { NpcSpawn } from '../types/game';
import { Actor } from './actor';
import { G } from '../core/state';
import { COMPANION_BY_ID } from '../data/guilds';
import { npcLook, buildCompanionLook, type Look } from '../render/paperdoll';
import { makeGear } from '../data/items';
import { angTo, dirFromAngle, dist, rnd } from '../engine/util';

export class Npc extends Actor {
  readonly kind = 'npc' as const;
  readonly spawn: NpcSpawn;
  look: Look;
  homeX: number;
  homeY: number;
  tx: number;
  ty: number;
  waitT = 0;

  constructor(sp: NpcSpawn, seed: number) {
    super();
    this.spawn = sp;
    this.team = 'neutral';
    this.x = this.homeX = this.tx = sp.x;
    this.y = this.homeY = this.ty = sp.y;
    this.hw = 6;
    this.hh = 4;
    if (sp.role === 'companion' && sp.companion) {
      const def = COMPANION_BY_ID[sp.companion];
      const tier = 0;
      const w = def.weapon === 'sword' ? 'w_sword' : def.weapon === 'spear' ? 'w_spear' : def.weapon === 'halberd' ? 'w_halberd' : def.weapon === 'bow' ? 'w_bow' : def.weapon === 'staff' ? 'w_staff' : 'w_twinblade';
      this.look = buildCompanionLook(def, {
        recruited: false,
        equip: {
          main: makeGear(w, tier + 2, 2, { colors: def.colors }),
          off: def.off === 'shield' ? makeGear('a_shield', 3, 2, { colors: def.colors }) : def.off === 'sword' ? makeGear('w_twinblade', 3, 2, { colors: def.colors }) : null,
          head: null,
          chest: makeGear(def.branch === 'magic' ? 'a_robe' : def.branch === 'dual' || def.branch === 'bow' ? 'a_coat' : 'a_plate', 3, 2, { colors: def.colors }),
          boots: makeGear('a_boots', 2, 1),
          cloak: makeGear('a_cloak', 3, 1, { colors: def.colors }),
        },
      });
    } else this.look = npcLook(sp.role, seed);
  }

  get displayName(): string {
    return this.spawn.name;
  }

  update(dt: number): void {
    this.tickTimers(dt);
    const p = G.player;
    const near = dist(this.x, this.y, p.x, p.y) < 70;
    this.moving = false;
    if (near) {
      this.aim = angTo(this.x, this.y, p.x, p.y);
      this.dir = dirFromAngle(this.aim);
      this.anim.kind = 'idle';
      return;
    }
    if (this.spawn.wander <= 0) {
      this.anim.kind = 'idle';
      return;
    }
    this.waitT -= dt;
    if (this.waitT > 0) {
      this.anim.kind = 'idle';
      return;
    }
    const d = dist(this.x, this.y, this.tx, this.ty);
    if (d < 6) {
      this.waitT = rnd(1, 4);
      this.tx = this.homeX + rnd(-this.spawn.wander, this.spawn.wander);
      this.ty = this.homeY + rnd(-this.spawn.wander * 0.6, this.spawn.wander * 0.6);
      return;
    }
    const a = angTo(this.x, this.y, this.tx, this.ty);
    const r = G.world.map.move(this, Math.cos(a) * 42 * dt, Math.sin(a) * 42 * dt);
    if (r.hitX || r.hitY) {
      this.tx = this.x;
      this.ty = this.y;
    }
    this.moving = true;
    this.vx = Math.cos(a) * 42;
    this.vy = Math.sin(a) * 42;
    this.anim.walk += dt * 6;
    this.anim.kind = 'walk';
    this.dir = dirFromAngle(a);
    this.aim = a;
  }
}
