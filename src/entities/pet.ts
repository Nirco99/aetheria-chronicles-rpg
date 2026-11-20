// Elemental combat pets: they float beside the Diver, vacuum up nearby loot crystals and fire
// support bolts that paint reaction gauges on enemies.
import type { PetDef } from '../types/game';
import { G } from '../core/state';
import { PET_BY_ID } from '../data/v3';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { angTo, dist, lerp } from '../engine/util';

export class Pet {
  readonly def: PetDef;
  x: number;
  y: number;
  z = 18;
  t = Math.random() * 10;
  fireT = 1.5;
  face = 1;

  constructor(id: string) {
    this.def = PET_BY_ID[id];
    const p = G.player;
    this.x = p.x - 20;
    this.y = p.y + 6;
  }

  update(dt: number): void {
    const p = G.player;
    this.t += dt;
    const side = p.dir === 2 ? 1 : -1;
    const tx = p.x + side * 26;
    const ty = p.y - 4 + Math.sin(this.t * 1.3) * 6;
    const k = 1 - Math.exp(-dt * 5);
    this.x = lerp(this.x, tx, k);
    this.y = lerp(this.y, ty, k);
    this.z = 22 + Math.sin(this.t * 3.1) * 4;
    if (Math.abs(tx - this.x) > 1) this.face = tx > this.x ? 1 : -1;
    if (dist(this.x, this.y, p.x, p.y) > 400) {
      this.x = p.x;
      this.y = p.y;
    }
    // auto-loot: pull loot crystals toward the Diver from much further away
    for (const l of G.world.loots) {
      if (l.kind !== 'crystal' || l.t < 0.45) continue;
      const d = dist(l.x, l.y, p.x, p.y);
      if (d > 30 && d < 230) {
        const pull = Math.min(d, 260 * dt);
        l.x += ((p.x - l.x) / d) * pull;
        l.y += ((p.y - l.y) / d) * pull;
        if (Math.random() < dt * 8) fx.particle(l.x, l.y, { z: l.z, kind: 'glow', color: this.def.color, size: 2, max: 0.3, vx: 0, vy: 0, drag: 2 });
      }
    }
    // support bolts
    this.fireT -= dt;
    if (this.fireT > 0 || p.dead) return;
    let best: { x: number; y: number } | null = null;
    let bd = 280;
    for (const m of G.world.monsters) {
      if (m.dead || m.spawnT > 0) continue;
      const d = dist(this.x, this.y, m.x, m.y);
      if (d < bd && G.world.map.los(this.x, this.y, m.x, m.y)) {
        bd = d;
        best = m;
      }
    }
    if (!best) {
      this.fireT = 0.4;
      return;
    }
    this.fireT = 2.2;
    const a = angTo(this.x, this.y - this.z, best.x, best.y - 14);
    G.world.spawnProjectile(p, { kind: 'orb', speed: 420, mult: 0.35, range: 340, homing: 4, element: this.def.element, color: this.def.color, magic: true, brk: 2, kb: 20 }, a, best.x, best.y, null);
    fx.glint(this.x, this.y - this.z, this.def.color2, 12);
    audio.play('magic', 0.25);
  }
}
