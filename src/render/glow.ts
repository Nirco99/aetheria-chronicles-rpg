// Pre-cached radial gradient sprites. All glows, auras and point lights are drawn by
// stretching these with drawImage (never ctx.shadowBlur, which kills Canvas frame rates).
import { rgba } from '../engine/util';

const cache = new Map<string, HTMLCanvasElement>();

export function glowSprite(color: string, soft = 0.5): HTMLCanvasElement {
  const key = color + '|' + soft;
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, rgba(color, 1));
  grad.addColorStop(soft * 0.5, rgba(color, 0.55));
  grad.addColorStop(soft, rgba(color, 0.22));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  cache.set(key, c);
  return c;
}

/** additive glow; caller decides composite mode */
export function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number, ry = r): void {
  if (alpha <= 0.003 || r <= 0.5) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(glowSprite(color), x - r, y - ry, r * 2, ry * 2);
  ctx.globalAlpha = 1;
}
