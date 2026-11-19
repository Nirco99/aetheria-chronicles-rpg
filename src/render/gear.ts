// Procedural vector drawing for every weapon and shield. Weapons are drawn along +X from the
// grip at the origin so the paper-doll rig, display racks and icons can rotate them freely.
import type { GearItem } from '../types/game';
import { RARITY_COLORS } from '../data/constants';
import { mix, rgba, shade, TAU } from '../engine/util';
import { glowSprite } from './glow';

export interface GearVis {
  kind: string;
  style: number;
  tier: number;
  main: string;
  accent: string;
  trim: string;
  glow: string;
  temper: number;
  gem: string | null;
  rarity: number;
  mythic: boolean;
}

export function visOf(g: GearItem | null, gem: string | null = null): GearVis | null {
  if (!g) return null;
  return {
    kind: g.wtype ?? g.aslot ?? 'none',
    style: g.style,
    tier: g.tier,
    main: g.colors.main,
    accent: g.colors.accent,
    trim: g.colors.trim,
    glow: g.colors.glow,
    temper: g.temper,
    gem,
    rarity: g.rarity,
    mythic: !!g.mythic,
  };
}

/** solid blade colour (per-frame gradients are avoided for 60 FPS; highlights are drawn as strokes) */
function bladeFill(ctx: CanvasRenderingContext2D, v: GearVis, _len: number): void {
  ctx.fillStyle = v.main;
}

function sheen(ctx: CanvasRenderingContext2D, v: GearVis, x0: number, x1: number, t: number): void {
  if (v.temper <= 0 && !v.gem && !v.mythic) return;
  const a = Math.min(0.85, 0.18 + v.temper * 0.06);
  const pos = ((t * 0.9) % 1.6) - 0.3;
  const sx = x0 + (x1 - x0) * pos;
  ctx.fillStyle = rgba('#ffffff', a);
  ctx.fillRect(Math.max(x0, sx - 3), -1.6, 5, 1.4);
  if (v.temper >= 6 || v.gem || v.mythic) {
    ctx.globalCompositeOperation = 'lighter';
    const col = v.gem ?? (v.mythic ? '#ff4f7b' : v.glow);
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 5);
    ctx.drawImage(glowSprite(col), x0 - 4, -8, x1 - x0 + 8, 16);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** draws a weapon pointing along +X with the grip at the origin */
export function drawWeapon(ctx: CanvasRenderingContext2D, v: GearVis, t: number, draw = 0): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const grip = shade(v.accent, -0.1);
  switch (v.kind) {
    case 'sword': {
      ctx.fillStyle = v.trim;
      ctx.beginPath();
      ctx.arc(-8, 0, 2.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = grip;
      ctx.fillRect(-7, -1.5, 7, 3);
      ctx.fillStyle = v.trim;
      ctx.fillRect(-0.5, -6.5, 3, 13);
      bladeFill(ctx, v, 34);
      ctx.beginPath();
      ctx.moveTo(2.5, -2.6);
      ctx.lineTo(30, -2.1);
      ctx.lineTo(36, 0);
      ctx.lineTo(30, 2.1);
      ctx.lineTo(2.5, 2.6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(v.main, -0.45);
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.strokeStyle = rgba(shade(v.main, 0.7), 0.7);
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(27, 0);
      ctx.stroke();
      sheen(ctx, v, 3, 34, t);
      break;
    }
    case 'twinblade': {
      ctx.fillStyle = grip;
      ctx.fillRect(-6, -1.4, 6, 2.8);
      ctx.fillStyle = v.trim;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(2.5, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-1, 0);
      ctx.closePath();
      ctx.fill();
      bladeFill(ctx, v, 28);
      ctx.beginPath();
      ctx.moveTo(2, -2.2);
      ctx.quadraticCurveTo(16, -4.2, 29, -0.8);
      ctx.lineTo(31, 0.6);
      ctx.quadraticCurveTo(16, 1.2, 2, 2.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(v.main, -0.45);
      ctx.lineWidth = 0.7;
      ctx.stroke();
      sheen(ctx, v, 3, 29, t);
      break;
    }
    case 'spear': {
      ctx.strokeStyle = v.accent;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(36, 0);
      ctx.stroke();
      ctx.strokeStyle = v.trim;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(33, 0);
      ctx.lineTo(36, 0);
      ctx.stroke();
      bladeFill(ctx, v, 14);
      ctx.beginPath();
      ctx.moveTo(36, -3.4);
      ctx.quadraticCurveTo(44, -3, 52, 0);
      ctx.quadraticCurveTo(44, 3, 36, 3.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(v.main, -0.45);
      ctx.lineWidth = 0.7;
      ctx.stroke();
      sheen(ctx, v, 36, 52, t);
      break;
    }
    case 'halberd': {
      ctx.strokeStyle = v.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(42, 0);
      ctx.stroke();
      bladeFill(ctx, v, 14);
      ctx.beginPath();
      ctx.moveTo(26, -1.5);
      ctx.quadraticCurveTo(32, -15, 40, -12);
      ctx.quadraticCurveTo(36, -6, 38, -1.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(40, -2);
      ctx.lineTo(50, 0);
      ctx.lineTo(40, 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(30, 1.5);
      ctx.lineTo(34, 7);
      ctx.lineTo(36, 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(v.main, -0.45);
      ctx.lineWidth = 0.7;
      ctx.stroke();
      sheen(ctx, v, 28, 48, t);
      break;
    }
    case 'bow': {
      const pull = draw * 11;
      ctx.strokeStyle = v.main;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-4, -22);
      ctx.quadraticCurveTo(10, -12, 4, 0);
      ctx.quadraticCurveTo(10, 12, -4, 22);
      ctx.stroke();
      ctx.strokeStyle = v.trim;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-4, -22);
      ctx.quadraticCurveTo(8, -12, 5, -3);
      ctx.stroke();
      ctx.fillStyle = v.accent;
      ctx.fillRect(1.5, -4, 4, 8);
      ctx.strokeStyle = rgba('#f4f0e6', 0.9);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-4, -22);
      ctx.lineTo(-4 - pull, 0);
      ctx.lineTo(-4, 22);
      ctx.stroke();
      if (draw > 0.05) {
        ctx.strokeStyle = '#d8c8a8';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-4 - pull, 0);
        ctx.lineTo(22, 0);
        ctx.stroke();
        ctx.fillStyle = v.gem ?? '#e8eef6';
        ctx.beginPath();
        ctx.moveTo(22, -2.5);
        ctx.lineTo(27, 0);
        ctx.lineTo(22, 2.5);
        ctx.fill();
      }
      if (v.temper > 0 || v.gem) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + v.temper * 0.04;
        ctx.drawImage(glowSprite(v.gem ?? v.glow), -10, -26, 22, 52);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      break;
    }
    case 'staff': {
      ctx.strokeStyle = v.accent;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(30, 0);
      ctx.stroke();
      ctx.strokeStyle = v.trim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(35, 0, 6.5, 0.5, TAU - 0.5);
      ctx.stroke();
      ctx.fillStyle = v.main;
      ctx.beginPath();
      ctx.moveTo(28, -3);
      ctx.lineTo(31, 0);
      ctx.lineTo(28, 3);
      ctx.fill();
      const orb = v.gem ?? v.glow;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.75 + 0.2 * Math.sin(t * 4);
      ctx.drawImage(glowSprite(orb), 35 - 11, -11, 22, 22);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = mix(orb, '#ffffff', 0.45);
      ctx.beginPath();
      ctx.arc(35, 0, 3.2, 0, TAU);
      ctx.fill();
      break;
    }
  }
}

/** shield seen from the front (local origin = shield centre) */
export function drawShield(ctx: CanvasRenderingContext2D, v: GearVis, scale = 1): void {
  ctx.save();
  ctx.scale(scale, scale);
  const shape = v.tier <= 1 ? 0 : v.tier <= 3 ? 1 : 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (shape === 0) ctx.arc(0, 0, 8.5, 0, TAU);
  else if (shape === 1) {
    ctx.moveTo(-7, -9);
    ctx.quadraticCurveTo(0, -12, 7, -9);
    ctx.lineTo(7, 1);
    ctx.quadraticCurveTo(5, 8, 0, 12);
    ctx.quadraticCurveTo(-5, 8, -7, 1);
    ctx.closePath();
  } else {
    ctx.moveTo(-8, -12);
    ctx.lineTo(8, -12);
    ctx.lineTo(8, 8);
    ctx.quadraticCurveTo(0, 15, -8, 8);
    ctx.closePath();
  }
  ctx.fillStyle = v.main;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba(shade(v.main, 0.5), 0.35);
  ctx.fillRect(-9, -13, 7, 26);
  ctx.fillStyle = rgba('#000000', 0.18);
  ctx.fillRect(3, -13, 7, 26);
  ctx.restore();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = v.trim;
  ctx.stroke();
  ctx.fillStyle = v.accent;
  if (shape === 0) {
    ctx.beginPath();
    ctx.arc(0, 0, 2.6, 0, TAU);
    ctx.fill();
  } else if (shape === 1) {
    ctx.fillRect(-1.2, -8, 2.4, 15);
    ctx.fillRect(-5, -3, 10, 2.4);
  } else {
    ctx.fillRect(-1.5, -10, 3, 19);
    ctx.fillRect(-6, -4, 12, 3);
    ctx.strokeStyle = v.trim;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-5.5, -9.5, 11, 15);
  }
  if (v.temper > 0 || v.mythic) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18 + v.temper * 0.04;
    ctx.drawImage(glowSprite(v.mythic ? '#ff4f7b' : v.glow), -12, -14, 24, 28);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/** orbiting tempering sparks around a world-space point */
export function drawTemperSparks(ctx: CanvasRenderingContext2D, x: number, y: number, v: GearVis, t: number): void {
  const n = v.temper - 3;
  if (n <= 0) return;
  const col = v.gem ?? (v.temper >= 10 ? '#ffd166' : v.glow);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a = t * (2.4 + i * 0.13) + (i * TAU) / n;
    const r = 11 + (i % 3) * 3;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r * 0.55;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(glowSprite(col), px - 4, py - 4, 8, 8);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

export function rarityColor(r: number): string {
  return RARITY_COLORS[r] ?? '#ffffff';
}
