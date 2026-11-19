// The 1.6-second neural-interface boot sequence played on New Game / Load:
// expanding concentric HUD rings verify each sense, then "AETHER DRIVE!" (skippable).
import { audio } from '../engine/audio';
import { glowSprite } from './glow';
import { rgba, TAU } from '../engine/util';

const STEPS = ['SIGHT', 'HEARING', 'TOUCH', 'MASTERY MATRIX', 'AETHER LINK'];
const RING_COLORS = ['#7fe9ff', '#b07bff', '#ffffff', '#ffd166', '#5ee6a0', '#ff8fb1'];

export class BootSequence {
  t = 0;
  done = false;
  private fired = new Set<number>();

  constructor(private readonly name: string) {}

  skip(): void {
    this.done = true;
  }

  update(dt: number): void {
    this.t += dt;
    STEPS.forEach((_, i) => {
      const at = 0.12 + i * 0.2;
      if (this.t >= at && !this.fired.has(i)) {
        this.fired.add(i);
        audio.play(i === STEPS.length - 1 ? 'bootOk' : 'boot');
      }
    });
    if (this.t >= 1.18 && !this.fired.has(99)) {
      this.fired.add(99);
      audio.play('engage');
    }
    if (this.t >= 1.6) this.done = true;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const t = this.t;
    const cx = w / 2;
    const cy = h / 2;
    const s = h / 720;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * 0.7);
    g.addColorStop(0, '#0e1a3a');
    g.addColorStop(1, '#02040a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const maxR = Math.hypot(w, h) * 0.6;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const r = ((t * 520 * s + i * 64 * s) % maxR) + 4;
      const a = Math.max(0, 1 - r / maxR);
      ctx.strokeStyle = rgba(RING_COLORS[i % RING_COLORS.length], 0.55 * a);
      ctx.lineWidth = (2 + (i % 3)) * s;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.stroke();
    }
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU + t * 0.6;
      const r0 = 60 * s + ((t * 900 * s + i * 37) % (maxR * 0.9));
      ctx.strokeStyle = rgba(RING_COLORS[i % RING_COLORS.length], 0.35);
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * (r0 + 40 * s), cy + Math.sin(a) * (r0 + 40 * s));
      ctx.stroke();
    }
    ctx.drawImage(glowSprite('#7fe9ff'), cx - 140 * s, cy - 140 * s, 280 * s, 280 * s);
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    STEPS.forEach((step, i) => {
      const at = 0.12 + i * 0.2;
      if (t < at) return;
      const y = cy - 70 * s + i * 30 * s;
      const x = cx - 170 * s;
      ctx.font = `700 ${Math.round(16 * s)}px "Consolas", "Trebuchet MS", monospace`;
      ctx.fillStyle = '#bfe6ff';
      ctx.fillText(step, x, y);
      ctx.fillStyle = 'rgba(191,230,255,0.4)';
      ctx.fillText('.'.repeat(Math.max(2, 18 - step.length)), x + 160 * s, y);
      if (t > at + 0.08) {
        ctx.fillStyle = '#5ee6a0';
        ctx.fillText('OK', x + 300 * s, y);
      }
    });
    if (t > 1.15) {
      const k = Math.min(1, (t - 1.15) / 0.2);
      ctx.fillStyle = `rgba(255,255,255,${(Math.max(0, 1 - Math.abs(t - 1.3) / 0.3) * 0.75).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(cx, cy + 120 * s);
      ctx.scale(0.8 + k * 0.2, 0.8 + k * 0.2);
      ctx.textAlign = 'center';
      ctx.font = `italic 900 ${Math.round(64 * s)}px "Trebuchet MS", "Segoe UI", sans-serif`;
      ctx.lineWidth = 6 * s;
      ctx.strokeStyle = 'rgba(2,6,18,0.9)';
      ctx.strokeText('AETHER DRIVE!', 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('AETHER DRIVE!', 0, 0);
      ctx.font = `600 ${Math.round(15 * s)}px "Trebuchet MS", "Segoe UI", sans-serif`;
      ctx.fillStyle = '#7fe9ff';
      ctx.fillText(`Synchronization complete. Welcome to Aetheria, ${this.name}.`, 0, 44 * s);
      ctx.restore();
    }
    ctx.textAlign = 'center';
    ctx.font = `600 ${Math.round(12 * s)}px "Trebuchet MS", "Segoe UI", sans-serif`;
    ctx.fillStyle = 'rgba(191,230,255,0.7)';
    ctx.fillText('[Space / Click to Skip]', cx, h - 30 * s);
  }
}
