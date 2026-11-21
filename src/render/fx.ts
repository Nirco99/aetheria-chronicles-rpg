// Combat "juice": particles, glowing Bezier slash ribbons, physics damage numbers, polygonal
// crystal death shatter, shockwave rings, lightning bolts, star glints, banners, shake and flashes.
import type { RibbonSpec } from '../types/game';
import { G } from '../core/state';
import { drawGlow } from './glow';
import { rgba, rnd, TAU, clamp } from '../engine/util';

export type PKind = 'spark' | 'dust' | 'glow' | 'smoke' | 'square' | 'heal' | 'ember';

interface Particle {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  life: number; max: number; size: number; color: string; kind: PKind; drag: number; grav: number; add: boolean;
}
export interface Ribbon {
  xs: Float32Array; ys: Float32Array; nx: Float32Array; ny: Float32Array; wp: Float32Array;
  color: string; color2: string; t: number; life: number; w: number;
  /** origin and vertical squash of the 2D projection, so the 3D renderer can lay the arc flat */
  cy: number; sq: number;
}
interface DmgNum {
  x: number; y: number; z: number; vx: number; vz: number; text: string; color: string; size: number; t: number; life: number; bounces: number;
}
interface Shard {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; rot: number; vr: number; spin: number; vs: number;
  size: number; color: string; t: number; life: number;
}
interface Ring { x: number; y: number; r0: number; r1: number; t: number; life: number; color: string; w: number }
interface Bolt { pts: number[]; t: number; life: number; color: string }
interface Banner { text: string; sub: string; color: string; t: number; life: number; size: number }
interface Glint { x: number; y: number; color: string; t: number; life: number; size: number }

const MAX_PARTICLES = 1400;
const SEG = 18;

export const NUM_COLORS = {
  normal: '#ffffff',
  crit: '#ffd166',
  shield: '#7fe9ff',
  elem: '#c18cff',
  heal: '#7dff9a',
  hurt: '#ff5d6c',
  info: '#e6edf7',
};

class FX {
  parts: Particle[] = [];
  ribbons: Ribbon[] = [];
  nums: DmgNum[] = [];
  shards: Shard[] = [];
  rings: Ring[] = [];
  bolts: Bolt[] = [];
  banners: Banner[] = [];
  glints: Glint[] = [];
  shakeAmt = 0;
  flashColor = '#ffffff';
  flashA = 0;
  vignette = 0;

  clear(): void {
    this.parts.length = 0;
    this.ribbons.length = 0;
    this.nums.length = 0;
    this.shards.length = 0;
    this.rings.length = 0;
    this.bolts.length = 0;
    this.glints.length = 0;
  }

  // ---------------------------------------------------------------- emitters

  particle(x: number, y: number, o: Partial<Particle> & { kind?: PKind }): void {
    if (this.parts.length >= MAX_PARTICLES) this.parts.shift();
    const max = o.max ?? o.life ?? 0.6;
    this.parts.push({
      x, y, z: o.z ?? 0, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0, life: max, max, size: o.size ?? 3,
      color: o.color ?? '#ffffff', kind: o.kind ?? 'spark', drag: o.drag ?? 2, grav: o.grav ?? 0, add: o.add ?? true,
    });
  }

  sparks(x: number, y: number, color: string, n = 8, speed = 160, z = 14): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.particle(x, y, { z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rnd(20, 140), max: rnd(0.25, 0.5), size: rnd(1.5, 3.2), color, kind: 'spark', drag: 4, grav: 380 });
    }
  }

  dust(x: number, y: number, n = 5, color = '#cbbfa8'): void {
    for (let i = 0; i < n; i++) {
      this.particle(x + rnd(-6, 6), y + rnd(-3, 3), { vx: rnd(-40, 40), vy: rnd(-14, 6), vz: rnd(4, 26), max: rnd(0.35, 0.7), size: rnd(3, 6), color, kind: 'dust', drag: 3, add: false });
    }
  }

  burst(x: number, y: number, color: string, n = 14, speed = 120, kind: PKind = 'glow'): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.3;
      this.particle(x, y, { z: 16, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * 0.6, vz: rnd(0, 60), max: rnd(0.35, 0.7), size: rnd(2.5, 5), color, kind, drag: 3 });
    }
  }

  heal(x: number, y: number): void {
    for (let i = 0; i < 10; i++) {
      this.particle(x + rnd(-14, 14), y + rnd(-4, 4), { z: rnd(0, 20), vz: rnd(40, 80), max: rnd(0.6, 1), size: rnd(2, 4), color: '#7dff9a', kind: 'heal', drag: 1 });
    }
  }

  /** glowing Bezier slash ribbon that tapers out over 240ms */
  ribbon(cx: number, cy: number, aim: number, r: RibbonSpec, color: string, color2: string): void {
    const xs = new Float32Array(SEG + 1);
    const ys = new Float32Array(SEG + 1);
    const wp = new Float32Array(SEG + 1);
    const style = r.style ?? 'arc';
    const rad = r.r ?? 56;
    if (style === 'arc') {
      const A0 = aim + r.a0;
      const A1 = aim + r.a1;
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG;
        const a = A0 + (A1 - A0) * t;
        const rr = rad * (0.82 + 0.18 * Math.sin(Math.PI * t));
        xs[i] = cx + Math.cos(a) * rr;
        ys[i] = cy + Math.sin(a) * rr * 0.82 - 14;
        wp[i] = Math.pow(Math.sin(Math.PI * t), 0.75) * (0.55 + 0.45 * t);
      }
    } else if (style === 'thrust') {
      const len = r.len ?? 120;
      const ca = Math.cos(aim);
      const sa = Math.sin(aim);
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG;
        const d = 10 + (len - 10) * t;
        xs[i] = cx + ca * d;
        ys[i] = cy + sa * d * 0.85 - 14;
        wp[i] = Math.min(1, t * 6) * Math.pow(1 - t, 0.45);
      }
    } else {
      const p0x = cx + Math.cos(aim + r.a0) * rad;
      const p0y = cy + Math.sin(aim + r.a0) * rad * 0.82 - 14;
      const l2 = r.len ?? rad;
      const p3x = cx + Math.cos(aim + r.a1) * l2;
      const p3y = cy + Math.sin(aim + r.a1) * l2 * 0.82 - 14;
      const mx = (p0x + p3x) / 2;
      const my = (p0y + p3y) / 2;
      const dx = p3x - p0x;
      const dy = p3y - p0y;
      const bend = 0.18;
      const c1x = mx - dy * bend;
      const c1y = my + dx * bend;
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG;
        const u = 1 - t;
        xs[i] = u * u * p0x + 2 * u * t * c1x + t * t * p3x;
        ys[i] = u * u * p0y + 2 * u * t * c1y + t * t * p3y;
        wp[i] = Math.pow(Math.sin(Math.PI * t), 0.7);
      }
    }
    const nx = new Float32Array(SEG + 1);
    const ny = new Float32Array(SEG + 1);
    for (let i = 0; i <= SEG; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(SEG, i + 1);
      let tx = xs[b] - xs[a];
      let ty = ys[b] - ys[a];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      nx[i] = -ty;
      ny[i] = tx;
    }
    this.ribbons.push({ xs, ys, nx, ny, wp, color: r.color ?? color, color2: r.color2 ?? color2, t: 0, life: 0.24, w: r.w ?? 14, cy, sq: style === 'thrust' ? 0.85 : 0.82 });
  }

  number(x: number, y: number, text: string, color: string, size = 15): void {
    if (!G.settings.numbers) return;
    this.nums.push({ x: x + rnd(-6, 6), y, z: 26, vx: rnd(-34, 34), vz: rnd(150, 200), text, color, size, t: 0, life: 0.95, bounces: 0 });
  }

  /** SAO-style polygonal crystal shatter: 24-36 rotating translucent triangles drifting upward */
  shatter(x: number, y: number, colors: string[], scale = 1): void {
    const n = Math.round(24 + Math.random() * 12);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = rnd(30, 140) * scale;
      this.shards.push({
        x: x + rnd(-10, 10) * scale, y, z: rnd(6, 34) * scale, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.4, vz: rnd(40, 160),
        rot: Math.random() * TAU, vr: rnd(-8, 8), spin: Math.random() * TAU, vs: rnd(-9, 9),
        size: rnd(4, 11) * Math.sqrt(scale), color: colors[i % colors.length], t: 0, life: rnd(0.9, 1.5),
      });
    }
    this.ring(x, y, '#ffffff', 10, 70 * scale, 0.4);
  }

  ring(x: number, y: number, color: string, r0: number, r1: number, life = 0.45, w = 4): void {
    this.rings.push({ x, y, r0, r1, t: 0, life, color, w });
  }

  bolt(x0: number, y0: number, x1: number, y1: number, color = '#ffe066'): void {
    const pts: number[] = [x0, y0];
    const n = 7;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const off = rnd(-14, 14);
      const dx = x1 - x0;
      const dy = y1 - y0;
      const l = Math.hypot(dx, dy) || 1;
      pts.push(x0 + dx * t + (-dy / l) * off, y0 + dy * t + (dx / l) * off);
    }
    pts.push(x1, y1);
    this.bolts.push({ pts, t: 0, life: 0.22, color });
  }

  glint(x: number, y: number, color: string, size = 18): void {
    this.glints.push({ x, y, color, t: 0, life: 0.18, size });
  }

  banner(text: string, color: string, sub = '', size = 64, life = 1.3): void {
    this.banners = this.banners.filter((b) => b.text !== text);
    this.banners.push({ text, sub, color, t: 0, life, size });
  }

  shake(p: number): void {
    if (!G.settings.shake) return;
    this.shakeAmt = Math.min(16, Math.max(this.shakeAmt, p));
  }

  flash(color: string, a: number): void {
    this.flashColor = color;
    this.flashA = Math.max(this.flashA, a);
  }

  // ---------------------------------------------------------------- update

  update(dt: number, realDt: number): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vz -= p.grav * dt;
      p.z += p.vz * dt;
      if (p.z < 0) {
        p.z = 0;
        p.vz = -p.vz * 0.3;
      }
    }
    for (let i = this.ribbons.length - 1; i >= 0; i--) {
      this.ribbons[i].t += dt;
      if (this.ribbons[i].t >= this.ribbons[i].life) this.ribbons.splice(i, 1);
    }
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += realDt;
      n.x += n.vx * realDt;
      n.vz -= 520 * realDt;
      n.z += n.vz * realDt;
      if (n.z < 0 && n.bounces < 2) {
        n.z = 0;
        n.vz = -n.vz * 0.38;
        n.bounces++;
      }
      if (n.z < 0) n.z = 0;
      if (n.t >= n.life) this.nums.splice(i, 1);
    }
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 1 - 1.6 * dt;
      s.vy *= 1 - 1.6 * dt;
      s.vz = s.vz * (1 - 0.8 * dt) + 30 * dt;
      s.z += s.vz * dt;
      s.rot += s.vr * dt;
      s.spin += s.vs * dt;
      if (s.t >= s.life) this.shards.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].t += dt;
      if (this.rings[i].t >= this.rings[i].life) this.rings.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].t += dt;
      if (this.bolts[i].t >= this.bolts[i].life) this.bolts.splice(i, 1);
    }
    for (let i = this.glints.length - 1; i >= 0; i--) {
      this.glints[i].t += dt;
      if (this.glints[i].t >= this.glints[i].life) this.glints.splice(i, 1);
    }
    for (let i = this.banners.length - 1; i >= 0; i--) {
      this.banners[i].t += realDt;
      if (this.banners[i].t >= this.banners[i].life) this.banners.splice(i, 1);
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - realDt * 40);
    this.flashA = Math.max(0, this.flashA - realDt * 2.2);
  }

  // ---------------------------------------------------------------- draw (world space)

  drawWorld(ctx: CanvasRenderingContext2D): void {
    // rings (ground shockwaves)
    for (const r of this.rings) {
      const k = r.t / r.life;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - k, 3));
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.w * (1 - k) + 1;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rad, rad * 0.55, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    // ribbons: outer glow, mid body, white-hot core
    for (const r of this.ribbons) {
      const k = r.t / r.life;
      const reveal = Math.min(1, r.t / 0.05);
      const last = Math.max(1, Math.floor(SEG * reveal));
      const fade = 1 - k;
      const wscale = r.w * (1 - 0.55 * k);
      this.ribbonPoly(ctx, r, last, wscale * 1.9, rgba(r.color, 0.28 * fade));
      this.ribbonPoly(ctx, r, last, wscale, rgba(r.color, 0.75 * fade));
      this.ribbonPoly(ctx, r, last, wscale * 0.38, rgba(r.color2, 0.95 * fade));
    }
    // particles
    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'dust' || p.kind === 'smoke') continue;
      if (p.kind === 'glow' || p.kind === 'heal' || p.kind === 'ember') {
        drawGlow(ctx, p.x, p.y - p.z, p.size * 3, p.color, a * 0.9);
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.z - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
    for (const b of this.bolts) {
      const a = 1 - b.t / b.life;
      for (const [w, col, al] of [[7, b.color, 0.35], [3, b.color, 0.9], [1.4, '#ffffff', 1]] as [number, string, number][]) {
        ctx.strokeStyle = rgba(col, al * a);
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(b.pts[0], b.pts[1]);
        for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(b.pts[i], b.pts[i + 1]);
        ctx.stroke();
      }
    }
    for (const g of this.glints) {
      const k = g.t / g.life;
      const s = g.size * (k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6) + 2;
      drawGlow(ctx, g.x, g.y, s * 2.2, g.color, 0.9);
      ctx.fillStyle = rgba('#ffffff', 0.95);
      ctx.beginPath();
      ctx.moveTo(g.x, g.y - s * 1.4);
      ctx.lineTo(g.x + s * 0.18, g.y - s * 0.18);
      ctx.lineTo(g.x + s * 1.4, g.y);
      ctx.lineTo(g.x + s * 0.18, g.y + s * 0.18);
      ctx.lineTo(g.x, g.y + s * 1.4);
      ctx.lineTo(g.x - s * 0.18, g.y + s * 0.18);
      ctx.lineTo(g.x - s * 1.4, g.y);
      ctx.lineTo(g.x - s * 0.18, g.y - s * 0.18);
      ctx.closePath();
      ctx.fill();
    }
    // crystal shards
    for (const s of this.shards) {
      const k = s.t / s.life;
      const a = (1 - k) * 0.85;
      const sx = Math.cos(s.spin);
      const cx = s.x;
      const cy = s.y - s.z;
      const r = s.size * (1 - k * 0.4);
      const p = [0, 1, 2].map((i) => {
        const ang = s.rot + (i * TAU) / 3;
        return [cx + Math.cos(ang) * r * sx, cy + Math.sin(ang) * r];
      });
      ctx.fillStyle = rgba(s.color, a * 0.7);
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      ctx.lineTo(p[1][0], p[1][1]);
      ctx.lineTo(p[2][0], p[2][1]);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', a * 0.8);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.parts) {
      if (p.kind !== 'dust' && p.kind !== 'smoke') continue;
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y - p.z, p.size * (1.6 - a * 0.6), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private ribbonPoly(ctx: CanvasRenderingContext2D, r: Ribbon, last: number, w: number, fill: string): void {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i <= last; i++) {
      const ww = r.wp[i] * w * 0.5;
      if (i === 0) ctx.moveTo(r.xs[i] + r.nx[i] * ww, r.ys[i] + r.ny[i] * ww);
      else ctx.lineTo(r.xs[i] + r.nx[i] * ww, r.ys[i] + r.ny[i] * ww);
    }
    for (let i = last; i >= 0; i--) {
      const ww = r.wp[i] * w * 0.5;
      ctx.lineTo(r.xs[i] - r.nx[i] * ww, r.ys[i] - r.ny[i] * ww);
    }
    ctx.closePath();
    ctx.fill();
  }

  /** damage numbers sit above everything else in world space */
  drawNumbers(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of this.nums) {
      const k = n.t / n.life;
      const a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const pop = n.t < 0.08 ? 1 + (0.08 - n.t) * 6 : 1;
      ctx.globalAlpha = a;
      ctx.font = `900 ${Math.round(n.size * pop)}px "Trebuchet MS", "Segoe UI", sans-serif`;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(8,10,20,0.85)';
      ctx.strokeText(n.text, n.x, n.y - n.z);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, n.x, n.y - n.z);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- draw (screen space)

  drawScreen(ctx: CanvasRenderingContext2D, w: number, h: number, noFlash = false): void {
    if (this.flashA > 0.01 && !noFlash) {
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const b of this.banners) {
      const k = b.t / b.life;
      const pop = b.t < 0.12 ? 0.6 + (b.t / 0.12) * 0.55 : b.t < 0.22 ? 1.15 - ((b.t - 0.12) / 0.1) * 0.15 : 1;
      const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      const y = h * 0.3;
      ctx.save();
      ctx.translate(w / 2, y);
      ctx.scale(pop, pop);
      ctx.globalAlpha = a;
      const grd = ctx.createLinearGradient(-w * 0.35, 0, w * 0.35, 0);
      grd.addColorStop(0, rgba(b.color, 0));
      grd.addColorStop(0.5, rgba(b.color, 0.28));
      grd.addColorStop(1, rgba(b.color, 0));
      ctx.fillStyle = grd;
      ctx.fillRect(-w * 0.35, -b.size * 0.7, w * 0.7, b.size * 1.4);
      ctx.font = `italic 900 ${b.size}px "Trebuchet MS", "Segoe UI", sans-serif`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(5,8,18,0.9)';
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(b.text, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(b.color, 0.75);
      ctx.fillText(b.text, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      if (b.sub) {
        ctx.font = `700 ${Math.round(b.size * 0.3)}px "Trebuchet MS", "Segoe UI", sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeText(b.sub, 0, b.size * 0.75);
        ctx.fillStyle = '#e6edf7';
        ctx.fillText(b.sub, 0, b.size * 0.75);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

export const fx = new FX();
