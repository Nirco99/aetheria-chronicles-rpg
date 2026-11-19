// Boss & elite special moves and phase transitions.
import type { MonsterAttackDef, TeleShape } from '../types/game';
import type { Actor } from './actor';
import type { Monster } from './monster';
import { G } from '../core/state';
import { ELEMENT_COLORS } from '../data/constants';
import { damage, hitTest } from '../systems/combat';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { angTo, rnd, TAU } from '../engine/util';

function colorOf(atk: MonsterAttackDef): string {
  return atk.element && atk.element !== 'none' ? ELEMENT_COLORS[atk.element] : '#ff3b3b';
}

function tele(m: Monster, s: TeleShape, dur: number, atk: MonsterAttackDef): void {
  G.world.addTele(s, dur, m.id, () => m.resolve({ ...atk, dash: undefined, special: undefined }, s), colorOf(atk), 0);
}

function spawnAround(m: Monster, id: string, n: number, radius: number, level: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd(-0.4, 0.4);
    const p = G.world.map.nearestFree(m.x + Math.cos(a) * radius, m.y + Math.sin(a) * radius, 4);
    const s = G.world.spawnMonster(id, Math.max(1, level), p.x, p.y, G.world.map.modifiers);
    s.alwaysAggro = true;
    fx.burst(p.x, p.y, '#ffffff', 10, 100);
  }
}

/** returns the attack's total duration, or -1 if the special is not handled here */
export function bossSpecial(m: Monster, atk: MonsterAttackDef, t: Actor, wind: number): number {
  const tx = t.x;
  const ty = t.y;
  switch (atk.special) {
    case 'leap': {
      const s: TeleShape = { kind: 'circle', x: tx, y: ty, r: atk.r ?? 100 };
      tele(m, s, wind, atk);
      m.after(Math.max(0, wind - 0.4), () => m.leapTo(tx, ty, 0.38));
      return wind + 0.15;
    }
    case 'vines': {
      tele(m, { kind: 'circle', x: tx, y: ty, r: atk.r ?? 60 }, wind, atk);
      for (let i = 0; i < 2; i++) tele(m, { kind: 'circle', x: tx + rnd(-90, 90), y: ty + rnd(-70, 70), r: atk.r ?? 60 }, wind + 0.15 * (i + 1), atk);
      return wind + 0.4;
    }
    case 'meteors':
    case 'spikes': {
      const n = atk.special === 'meteors' ? 5 : 4;
      for (let i = 0; i < n; i++) {
        const px = i === 0 ? tx : tx + rnd(-150, 150);
        const py = i === 0 ? ty : ty + rnd(-110, 110);
        tele(m, { kind: 'circle', x: px, y: py, r: atk.r ?? 70 }, wind + i * 0.13, atk);
      }
      return wind + n * 0.13;
    }
    case 'heal_spores':
      spawnSpores(m);
      return wind;
    case 'waves': {
      for (let k = 0; k < 3; k++) {
        const r = 100 + k * 95;
        tele(m, { kind: 'ring', x: m.x, y: m.y, r, inner: r - 62 }, wind + k * 0.38, atk);
      }
      return wind + 0.9;
    }
    case 'beam_rotate': {
      const a0 = angTo(m.x, m.y, tx, ty);
      const pre: TeleShape = { kind: 'line', x: m.x, y: m.y, a: a0, len: atk.len ?? 460, w: atk.w ?? 30 };
      G.world.addTele(pre, wind, m.id, () => {
        const beam: TeleShape = { kind: 'line', x: m.x, y: m.y, a: a0, len: atk.len ?? 460, w: atk.w ?? 30 };
        const spin = Math.random() < 0.5 ? 1.05 : -1.05;
        G.world.addTele(beam, 2.2, m.id, null, '#bff3ff', spin, true);
        audio.play('beam');
        m.channel = {
          t: 0, dur: 2.2, tick: 0.2, tickT: 0,
          fn: (mm) => {
            beam.x = mm.x;
            beam.y = mm.y;
            for (const a of G.world.targetsFor('enemy')) {
              if (!a.dead && hitTest(beam, a.x, a.y, a.radius)) damage(mm, a, { mult: atk.mult, element: 'frost', status: atk.status, kb: 60, source: 'enemy', srcX: mm.x, srcY: mm.y });
            }
            fx.sparks(beam.x + Math.cos(beam.a) * beam.len, beam.y + Math.sin(beam.a) * beam.len, '#bff3ff', 3, 100);
          },
        };
      }, '#bff3ff', 0);
      return wind + 2.3;
    }
    case 'vortex': {
      const s: TeleShape = { kind: 'circle', x: tx, y: ty, r: atk.r ?? 140 };
      G.world.addTele(s, wind, m.id, () => {
        G.world.addZone({ kind: 'vortex', x: tx, y: ty, r: atk.r ?? 140, dur: 4.5, color: '#9fdcff', team: 'enemy', tick: 0.5, mult: atk.mult, pull: 95, slow: 0.35, element: 'frost', status: { kind: 'chill', dur: 1.5 } }, m);
        audio.play('wind');
      }, '#9fdcff', 0);
      return wind;
    }
    case 'clones':
      spawnClones(m);
      return wind;
    case 'cross': {
      const len = atk.len ?? 420;
      tele(m, { kind: 'line', x: tx - len / 2, y: ty, a: 0, len, w: atk.w ?? 44 }, wind, atk);
      tele(m, { kind: 'line', x: tx, y: ty - len / 2, a: Math.PI / 2, len, w: atk.w ?? 44 }, wind, atk);
      return wind;
    }
    case 'blink': {
      m.after(wind, () => {
        const tg = m.target;
        if (!tg || m.dead) return;
        const away = angTo(m.x, m.y, tg.x, tg.y);
        m.blinkTo(tg.x + Math.cos(away) * (tg.radius + m.radius + 12), tg.y + Math.sin(away) * (tg.radius + m.radius + 12));
        const follow = m.def.attacks.find((a) => !a.special && a.shape !== 'proj' && a.shape !== 'none');
        if (follow) {
          m.cds[follow.id] = 0;
          m.after(0.02, () => {
            if (!m.dead && m.canAct()) {
              m.st = 'chase';
              m.startAttackById(follow.id);
            }
          });
        }
      });
      return wind + 0.05;
    }
    default:
      return -1;
  }
}

function spawnSpores(m: Monster): void {
  spawnAround(m, 'spore_pod', 3, 170, m.level);
  fx.banner('HEALING SPORES', '#7dff9a', 'Destroy the pods before they restore the boss!', 40, 1.6);
}

function spawnClones(m: Monster): void {
  spawnAround(m, 'ice_clone', 2, 130, m.level - 1);
  fx.banner('MIRROR COURT', '#bff3ff', 'Ice clones join the battle!', 44, 1.5);
  audio.play('ice');
}

export function bossPhaseEnter(m: Monster, enter: string): void {
  switch (enter) {
    case 'summon_sentinels':
      spawnAround(m, 'kobold_sentinel', 2, 110, m.level - 2);
      fx.banner('CALL TO ARMS', '#ff9a3d', 'Kobold Sentinels rush to the Warchief!', 40, 1.5);
      break;
    case 'swap_weapon':
      m.variant = 1;
      m.brk = 0;
      fx.flash('#ff7a3d', 0.2);
      fx.banner('THE GREAT CLEAVER', '#ff7a3d', 'Gorrak casts aside his buckler!', 44, 1.6);
      audio.play('roar');
      break;
    case 'heal_spores':
      spawnSpores(m);
      break;
    case 'enrage':
      fx.flash('#ff3b3b', 0.25);
      fx.banner('ENRAGED', '#ff3b3b', `${m.def.name} grows faster and deadlier!`, 48, 1.5);
      break;
    case 'armor_up':
      m.armored = true;
      fx.ring(m.x, m.y, '#ffb02e', 10, 160, 0.6, 8);
      fx.banner('SCALES HARDEN', '#ffb02e', 'Break the armor again to deal full damage!', 42, 1.6);
      audio.play('anvil');
      break;
    case 'clones':
      spawnClones(m);
      break;
    case 'guard_up':
      fx.banner('DIVINE STRATEGY', '#fff1a8', 'His guard tightens - strike from the flank!', 42, 1.6);
      break;
    case 'overdrive':
      fx.flash('#ffd166', 0.3);
      fx.banner('SOVEREIGN OVERDRIVE', '#ffd166', 'The Paragon unleashes everything!', 46, 1.7);
      audio.play('awaken');
      break;
  }
}
