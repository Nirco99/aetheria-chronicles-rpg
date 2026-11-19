// Environmental particle layers (blossoms, leaves, embers, snow, aether motes, fireflies, dust)
// and weather overlays (rain, thunderstorm flashes, blizzard, ember ash).
import type { AmbientKind } from '../types/game';
import type { Renderer } from './renderer';
import { G } from '../core/state';
import { glowSprite } from './glow';
import { rgba, TAU } from '../engine/util';
import { isNight } from '../world/world';

interface AP {
  x: number;
  y: number;
  vx: number;
  vy: number;
  s: number;
  r: number;
  vr: number;
  ph: number;
}

class Weather {
  private amb: AP[] = [];
  private ambKind: AmbientKind | 'x' = 'x';
  private drops: { x: number; y: number; l: number; v: number }[] = [];

  private reset(kind: AmbientKind, w: number, h: number): void {
    this.ambKind = kind;
    const n = { blossom: 46, leaf: 34, ember: 70, snow: 110, mote: 50, firefly: 40, dust: 36, none: 0 }[kind];
    this.amb = [];
    for (let i = 0; i < n; i++) this.amb.push(this.spawn(kind, w, h, true));
  }

  private spawn(kind: AmbientKind, w: number, h: number, anywhere: boolean): AP {
    const x = Math.random() * w;
    const y = anywhere ? Math.random() * h : kind === 'ember' || kind === 'mote' ? h + 10 : -10;
    const base = { x, y, s: 1, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 3, ph: Math.random() * TAU };
    switch (kind) {
      case 'blossom':
      case 'leaf':
        return { ...base, vx: 20 + Math.random() * 30, vy: 25 + Math.random() * 25, s: 3 + Math.random() * 2 };
      case 'ember':
        return { ...base, vx: (Math.random() - 0.5) * 20, vy: -(20 + Math.random() * 40), s: 1.5 + Math.random() * 2 };
      case 'snow':
        return { ...base, vx: 10 + Math.random() * 20, vy: 30 + Math.random() * 40, s: 1.2 + Math.random() * 2.2 };
      case 'mote':
        return { ...base, vx: (Math.random() - 0.5) * 10, vy: -(8 + Math.random() * 14), s: 1.5 + Math.random() * 2 };
      case 'firefly':
        return { ...base, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16, s: 1.6 };
      default:
        return { ...base, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, s: 1.5 };
    }
  }

  draw(ctx: CanvasRenderingContext2D, r: Renderer, t: number): void {
    const m = G.world.map;
    const w = r.w;
    const h = r.h;
    const dpr = r.dpr;
    let kind: AmbientKind = m.ambient;
    if (kind === 'firefly' && !isNight(G.save.time) && G.save.time > 7) kind = 'leaf';
    if (G.world.weather === 'blizzard') kind = 'snow';
    if (kind !== this.ambKind) this.reset(kind, w, h);
    const dt = G.game.frameDt;
    const camDX = G.game.camDelta.x * r.zoomScale;
    const camDY = G.game.camDelta.y * r.zoomScale;
    const blizzard = G.world.weather === 'blizzard';
    const sp = blizzard ? 3.2 : 1;
    for (let i = 0; i < this.amb.length; i++) {
      const p = this.amb[i];
      p.x += p.vx * dt * dpr * sp - camDX;
      p.y += p.vy * dt * dpr * (blizzard ? 1.8 : 1) - camDY;
      p.r += p.vr * dt;
      if (kind === 'firefly' || kind === 'dust') {
        p.vx += Math.sin(t + p.ph) * 4 * dt;
        p.vy += Math.cos(t * 1.3 + p.ph) * 4 * dt;
      }
      if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) {
        const np = this.spawn(kind, w, h, false);
        if (p.x < -20) np.x = w + 10;
        else if (p.x > w + 20) np.x = -10;
        this.amb[i] = np;
      }
    }
    const s = dpr;
    for (const p of this.amb) {
      switch (kind) {
        case 'blossom':
        case 'leaf':
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.r);
          ctx.scale(Math.cos(t * 3 + p.ph), 1);
          ctx.fillStyle = kind === 'blossom' ? rgba('#ffc4dc', 0.9) : rgba(m.realm === 1 ? '#5fd8b8' : '#7cc867', 0.85);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.s * s, p.s * 0.55 * s, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        case 'snow':
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s * s, 0, TAU);
          ctx.fill();
          break;
        case 'ember':
        case 'mote':
        case 'firefly': {
          const col = kind === 'ember' ? '#ff9a3d' : kind === 'mote' ? '#fff1a8' : '#c9ff8a';
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = kind === 'firefly' ? 0.5 + 0.5 * Math.sin(t * 3 + p.ph) : 0.8;
          ctx.drawImage(glowSprite(col), p.x - p.s * 4 * s, p.y - p.s * 4 * s, p.s * 8 * s, p.s * 8 * s);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'dust':
          ctx.fillStyle = 'rgba(200,190,170,0.25)';
          ctx.fillRect(p.x, p.y, p.s * s, p.s * s);
          break;
      }
    }
    // rain
    const wthr = m.outdoor ? G.world.weather : 'clear';
    const rainy = wthr === 'rain' || wthr === 'storm';
    const want = rainy ? (wthr === 'storm' ? 260 : 160) : 0;
    while (this.drops.length < want) this.drops.push({ x: Math.random() * w, y: Math.random() * h, l: 10 + Math.random() * 14, v: 700 + Math.random() * 300 });
    if (this.drops.length > want) this.drops.length = want;
    if (rainy) {
      ctx.strokeStyle = 'rgba(180,200,235,0.45)';
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      for (const d of this.drops) {
        d.y += d.v * dt * s - camDY;
        d.x += d.v * 0.18 * dt * s - camDX;
        if (d.y > h) {
          d.y = -20;
          d.x = Math.random() * w;
        }
        if (d.x > w) d.x -= w;
        if (d.x < 0) d.x += w;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.l * 0.18 * s, d.y - d.l * s);
      }
      ctx.stroke();
    }
    if (m.outdoor && wthr === 'blizzard') {
      ctx.fillStyle = 'rgba(230,240,255,0.16)';
      ctx.fillRect(0, 0, w, h);
    }
    if (m.outdoor && wthr === 'ash') {
      ctx.fillStyle = 'rgba(120,60,30,0.08)';
      ctx.fillRect(0, 0, w, h);
    }
    if (G.world.lightning > 0.01) {
      ctx.fillStyle = `rgba(230,240,255,${(G.world.lightning * 0.5).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

export const weather = new Weather();
