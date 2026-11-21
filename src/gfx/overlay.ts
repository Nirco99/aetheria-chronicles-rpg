// World-anchored 2D overlay for the 3D renderer, painted on the HUD canvas: name plates, monster
// health / break bars, reaction gauges, adventurer speech bubbles and physics damage numbers.
import type { Actor } from '../entities/actor';
import type { Companion } from '../entities/companion';
import type { Adventurer } from '../entities/allies';
import type { GaugeKind } from '../types/game';
import { G } from '../core/state';
import { Monster } from '../entities/monster';
import { Npc } from '../entities/npc';
import { GAUGE_COLORS } from '../data/v3';
import { UI_H } from '../data/constants';
import { fx } from '../render/fx';
import { clamp } from '../engine/util';
import type { RenderHost } from './host';

const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

/** height (world units) of an actor's head for label placement */
export function headHeight(a: Actor): number {
  if (a instanceof Monster) return Math.max(22, a.height() * 0.82) + (a.def.flying ? 16 : 0);
  if (a.kind === 'prop') return 22;
  if (a.kind === 'caravan') return 46;
  return 40;
}

function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, weight = 700): void {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.lineWidth = Math.max(2.5, size * 0.28);
  ctx.strokeStyle = 'rgba(5,8,18,0.85)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

export function drawWorldOverlay(ctx: CanvasRenderingContext2D, r: RenderHost): void {
  const k = r.h / UI_H;
  const p = G.player;
  const w = G.world;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineJoin = 'round';
  const at = (a: Actor, extra = 0): { x: number; y: number } => r.worldToScreen(a.x, a.y, headHeight(a) + a.z + extra);
  const title = G.save.title;
  if (title && !p.dead) {
    const s = r.worldToScreen(p.x, p.y, 46 + p.z + (p.mounted ? 16 : 0));
    label(ctx, `< ${title} >`, s.x, s.y, 11 * k, '#ffd166');
  }
  const actors: Actor[] = [...w.party, ...w.vanguard, ...w.adventurers, ...w.monsters, ...w.npcs];
  for (const a of actors) {
    if (a.dead || a.removed) continue;
    if (Math.abs(a.x - p.x) > 560 || Math.abs(a.y - p.y) > 460) continue;
    const s = at(a);
    if (a instanceof Monster) {
      if (a.spawnT > 0) continue;
      let y = s.y;
      const showBar = !a.isBoss && (a.hpBarT > 0 || a.isElite);
      if (showBar) {
        const bw = (a.isElite ? 62 : 42) * k;
        const bh = 5 * k;
        const x = s.x - bw / 2;
        ctx.fillStyle = 'rgba(5,8,18,0.8)';
        ctx.beginPath();
        ctx.roundRect(x - 1.5 * k, y - bh - 1.5 * k, bw + 3 * k, bh + 3 * k, 2.5 * k);
        ctx.fill();
        const fr = clamp(a.hp / a.stats.maxHp, 0, 1);
        const g = ctx.createLinearGradient(0, y - bh, 0, y);
        g.addColorStop(0, a.isElite ? '#ffc070' : '#ff8a94');
        g.addColorStop(1, a.isElite ? '#e0701a' : '#d9263c');
        ctx.fillStyle = g;
        ctx.fillRect(x, y - bh, bw * fr, bh);
        if (a.brkMax > 0 && (a.brk > 0 || a.broken > 0)) {
          ctx.fillStyle = '#ffd166';
          ctx.fillRect(x, y + 1 * k, bw * (a.broken > 0 ? 1 : a.brk / a.brkMax), 2 * k);
        }
        if (a.shield > 0) {
          ctx.fillStyle = '#9fdcff';
          ctx.fillRect(x, y - bh - 3 * k, bw * (a.shield / Math.max(1, a.shieldMax)), 2 * k);
        }
        y -= bh + 5 * k;
      }
      const gs = Object.keys(a.gauges) as GaugeKind[];
      if (gs.length) {
        gs.forEach((gk, i) => {
          const gx = s.x + (i - (gs.length - 1) / 2) * 12 * k;
          const gy = y - 5 * k;
          ctx.fillStyle = GAUGE_COLORS[gk];
          ctx.beginPath();
          ctx.moveTo(gx, gy - 5 * k);
          ctx.lineTo(gx + 4.5 * k, gy);
          ctx.lineTo(gx, gy + 5 * k);
          ctx.lineTo(gx - 4.5 * k, gy);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(5,8,18,0.8)';
          ctx.lineWidth = 1.2 * k;
          ctx.stroke();
        });
        y -= 13 * k;
      }
      if (a.isElite || a.raid || a.def.id === 'ev_gate') {
        const c = a.raid ? '#ff5d6c' : a.def.id === 'ev_gate' ? '#c9a8ff' : '#ff9a3d';
        label(ctx, `${a.def.name}  Lv.${a.level}`, s.x, y, 11.5 * k, c);
      }
      continue;
    }
    if (a instanceof Npc) {
      if (Math.hypot(a.x - p.x, a.y - p.y) > 170) continue;
      label(ctx, a.displayName, s.x, s.y, 11.5 * k, a.spawn.role === 'companion' ? '#7fe9ff' : '#ffe9b0');
      if (a.spawn.role !== 'villager' && a.spawn.role !== 'guard') {
        const role = a.spawn.role === 'companion' ? 'Recruitable Companion' : a.spawn.role;
        label(ctx, role.charAt(0).toUpperCase() + role.slice(1), s.x, s.y - 13 * k, 9.5 * k, '#aab6c8', 600);
      }
      continue;
    }
    if (a.kind === 'companion') {
      const c = a as Companion;
      let color = '#7fe9ff';
      if (c.role === 'adventurer') {
        color = '#5ee6a0';
        const adv = c as Adventurer;
        if (Math.hypot(a.x - p.x, a.y - p.y) > 300 && !adv.helpNeeded) continue;
        if (adv.bubbleT > 0) {
          ctx.font = `600 ${11 * k}px ${FONT}`;
          const bw = ctx.measureText(adv.bubble).width + 14 * k;
          ctx.fillStyle = 'rgba(245,248,255,0.94)';
          ctx.beginPath();
          ctx.roundRect(s.x - bw / 2, s.y - 36 * k, bw, 18 * k, 6 * k);
          ctx.fill();
          ctx.fillStyle = '#1a2340';
          ctx.fillText(adv.bubble, s.x, s.y - 21 * k);
        }
        if (adv.helpNeeded) label(ctx, '!', s.x, s.y - 16 * k, 22 * k, Math.floor(G.realTime * 4) % 2 ? '#ff9a3d' : '#ffd166', 900);
      } else if (c.role === 'vanguard') color = '#ffd27a';
      label(ctx, a.displayName, s.x, s.y, 11.5 * k, color);
    }
  }
  if (w.caravan && !w.caravan.dead) {
    const c = w.caravan;
    const s = r.worldToScreen(c.x, c.y, 52);
    const bw = 64 * k;
    ctx.fillStyle = 'rgba(5,8,18,0.8)';
    ctx.fillRect(s.x - bw / 2 - 1, s.y - 7 * k, bw + 2, 7 * k);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(s.x - bw / 2, s.y - 6 * k, bw * clamp(c.hp / c.stats.maxHp, 0, 1), 5 * k);
    if (c.waiting && Math.floor(G.realTime * 2) % 2) label(ctx, 'Waiting for escort...', s.x, s.y - 10 * k, 11 * k, '#ffd166');
  }
  // damage numbers
  ctx.textBaseline = 'middle';
  for (const n of fx.nums) {
    const kk = n.t / n.life;
    const a = kk > 0.7 ? 1 - (kk - 0.7) / 0.3 : 1;
    const pop = n.t < 0.08 ? 1 + (0.08 - n.t) * 6 : 1;
    const s = r.worldToScreen(n.x, n.y + 26, 34 + n.z * 0.9);
    ctx.globalAlpha = a;
    const size = n.size * 1.05 * pop * k;
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.lineWidth = Math.max(3, size * 0.24);
    ctx.strokeStyle = 'rgba(8,10,20,0.88)';
    ctx.strokeText(n.text, s.x, s.y);
    ctx.fillStyle = n.color;
    ctx.fillText(n.text, s.x, s.y);
  }
  ctx.globalAlpha = 1;
}
