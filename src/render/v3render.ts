// v3 visual layer: dynamic sun / moon shadows tracking the clock, swaying grass that bends
// around actors, reactive footsteps (leaf motes, ripples, dust, fading snow prints), drifting
// cloud shadows, the 1.18x foreground canopy parallax with god-rays, the 12-sample blade trail
// mesh, mounts, pets, breakable props, the escort caravan, jump pads, fishing spots and dig sites.
import type { Actor } from '../entities/actor';
import type { Anim, MountDef, Prop } from '../types/game';
import type { Pet } from '../entities/pet';
import type { Breakable } from '../entities/breakable';
import type { Caravan } from '../entities/allies';
import type { GameMap } from '../world/tilemap';
import { G } from '../core/state';
import { TILE } from '../data/constants';
import { REALMS } from '../data/realms';
import { GT } from '../world/tilemap';
import { bladeTrail } from './paperdoll';
import { glowSprite } from './glow';
import { fx } from './fx';
import { clamp, hash2, mix, rgba, shade, TAU } from '../engine/util';

/** feature switches (also driven by Settings > Render quality) */
export const v3flags = { shadows: true, grass: true, clouds: true, foreground: true, trails: true };

// ------------------------------------------------------------------ sun & moon

/** shadow direction and length from the 24h clock (east at dawn, west at dusk, soft moon at night) */
export function sunVector(): { dx: number; dy: number; len: number; alpha: number } {
  const h = G.save?.time ?? 12;
  const m = G.world.map;
  if (!m.outdoor) return { dx: 0.2, dy: -0.3, len: 0.25, alpha: 0.1 };
  if (h >= 6 && h <= 18) {
    const k = (h - 12) / 6;
    return { dx: k, dy: -0.32, len: 0.35 + Math.abs(k) * 1.4, alpha: 0.22 - Math.abs(k) * 0.06 };
  }
  const nh = h > 18 ? h - 24 : h;
  const k = clamp(nh / 6, -1, 1);
  return { dx: -k * 0.8, dy: -0.25, len: 0.6, alpha: 0.1 };
}

const TALL = new Set(['tree', 'building', 'pillar', 'statue', 'lamp', 'torch', 'gate', 'abyssgate', 'crystal', 'fountain', 'banner', 'dungeon', 'stall']);

/** one batched path of skewed elliptical shadows for actors and tall props */
// GPU-friendly sprites: every shadow and grass tuft is a cached bitmap drawn as a textured quad,
// instead of thousands of anti-aliased path segments rasterised every frame.
let shadowSpr: HTMLCanvasElement | null = null;
function shadowSprite(): HTMLCanvasElement {
  if (shadowSpr) return shadowSpr;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.translate(64, 32);
  g.scale(1, 0.5);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 62);
  gr.addColorStop(0, 'rgba(6,8,20,1)');
  gr.addColorStop(0.55, 'rgba(6,8,20,0.85)');
  gr.addColorStop(1, 'rgba(6,8,20,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, 62, 0, TAU);
  g.fill();
  shadowSpr = c;
  return c;
}

export function drawCastShadows(ctx: CanvasRenderingContext2D, actors: Actor[], props: Prop[], lift: (x: number, y: number) => number, inView: (x: number, y: number) => boolean): void {
  if (!v3flags.shadows) return;
  const sun = sunVector();
  if (sun.alpha <= 0.02) return;
  const ang = Math.atan2(sun.dy, sun.dx);
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const spr = shadowSprite();
  const base = ctx.getTransform();
  ctx.globalAlpha = Math.min(1, sun.alpha * 1.5);
  const one = (cx: number, cy: number, rx: number, ry: number) => {
    // translate -> rotate -> scale, composed onto the camera transform
    ctx.setTransform(base);
    ctx.transform(ca * rx / 64, sa * rx / 64, -sa * ry / 32, ca * ry / 32, cx, cy);
    ctx.drawImage(spr, -64, -32);
  };
  for (const a of actors) {
    if (a.dead || a.removed || !inView(a.x, a.y)) continue;
    const ht = a.kind === 'monster' ? (a as unknown as { height(): number }).height() * 0.8 : a.kind === 'prop' ? 18 : 38;
    const L = ht * sun.len;
    const ly = lift(a.x, a.y);
    one(a.x + ca * L * 0.5, a.y - ly + sa * L * 0.5 + 1, L * 0.5 + 6, 4.6);
  }
  for (const p of props) {
    if (!TALL.has(p.kind) || p.hidden || !inView(p.x, p.y)) continue;
    const ht = Math.min(160, p.sh * 0.75);
    const L = ht * sun.len;
    const w = Math.min(40, p.sw * 0.32);
    const ly = lift(p.x, p.y);
    one(p.x + ca * L * 0.5, p.y - ly + sa * L * 0.5 + 2, L * 0.5 + w, w * 0.32 + 3);
  }
  ctx.setTransform(base);
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ grass

const GRASSY = new Set<number>([GT.GRASS, GT.GRASS2, GT.FLOWERS]);
const TUFT_BENDS = 9;
const tuftCache = new Map<string, HTMLCanvasElement[]>();

/** pre-rendered tufts for nine bend angles in the realm's two grass tones */
function tuftSprites(c1: string, c2: string): HTMLCanvasElement[] {
  const key = c1 + c2;
  let arr = tuftCache.get(key);
  if (arr) return arr;
  arr = [];
  for (let i = 0; i < TUFT_BENDS; i++) {
    const bend = (i - (TUFT_BENDS - 1) / 2) * 1.6;
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.scale(2, 2);
    g.lineCap = 'round';
    for (const [col, w, off] of [[c1, 1.4, 0], [c2, 1.05, 0.6]] as [string, number, number][]) {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      for (let b = -1; b <= 1; b++) {
        const bx = 12 + b * 2.4 + off;
        const h = 11 - Math.abs(b) * 2 + off;
        g.moveTo(bx, 22);
        g.quadraticCurveTo(bx + bend * 0.3, 22 - h * 0.6, bx + bend + b * 1.6, 22 - h);
      }
      g.stroke();
    }
    arr.push(c);
  }
  tuftCache.set(key, arr);
  return arr;
}

export function drawGrass(ctx: CanvasRenderingContext2D, m: GameMap, x0: number, y0: number, x1: number, y1: number, t: number, movers: Actor[], lift: (x: number, y: number) => number): void {
  if (!v3flags.grass || (m.kind !== 'wild' && m.kind !== 'city')) return;
  const R = REALMS[m.realm];
  if (R.palette.liquid === 'lava') return;
  const sprites = tuftSprites(shade(R.palette.grass, -0.18), shade(R.palette.grass2, 0.12));
  const near = movers.filter((a) => !a.dead && a.x > x0 * TILE - 40 && a.x < (x1 + 1) * TILE + 40 && a.y > y0 * TILE - 40 && a.y < (y1 + 1) * TILE + 40);
  const wind = Math.sin(t * 0.7) * 1.2;
  const mid = (TUFT_BENDS - 1) / 2;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const i = ty * m.w + tx;
      if (m.solid[i] !== 0 || !GRASSY.has(m.ground[i])) continue;
      const r = hash2(tx, ty, 41);
      if (r > 0.5) continue;
      const gx = tx * TILE + 6 + hash2(tx, ty, 42) * 20;
      const gy0 = ty * TILE + 10 + hash2(tx, ty, 43) * 18;
      const gy = gy0 - lift(gx, gy0);
      let bend = Math.sin(t * 2.1 + gx * 0.05 + gy * 0.03) * 1.6 + wind;
      let squash = 0;
      for (const a of near) {
        const dx = gx - a.x;
        const dy = gy0 - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 400) {
          const k = 1 - Math.sqrt(d2) / 20;
          bend += Math.sign(dx || 1) * k * 6;
          squash = Math.max(squash, k * 0.35);
        }
      }
      const idx = Math.max(0, Math.min(TUFT_BENDS - 1, Math.round(bend / 1.6 + mid)));
      const hgt = 24 * (1 - squash) * (0.8 + r * 0.4);
      ctx.drawImage(sprites[idx], gx - 12, gy - hgt + 2, 24, hgt);
    }
  }
}

// ------------------------------------------------------------------ footsteps & snow prints

interface Print {
  x: number;
  y: number;
  a: number;
  t: number;
}
const prints: Print[] = [];
const stepDist = new WeakMap<Actor, { x: number; y: number; d: number; side: number }>();

export function footsteps(movers: Actor[], m: GameMap, dt: number): void {
  for (let i = prints.length - 1; i >= 0; i--) {
    prints[i].t += dt;
    if (prints[i].t > 7) prints.splice(i, 1);
  }
  const snowy = m.outdoor && (REALMS[m.realm].palette.liquid === 'void' ? false : REALMS[m.realm].ambient === 'snow');
  for (const a of movers) {
    if (a.dead || a.z > 2) continue;
    let st = stepDist.get(a);
    if (!st) {
      st = { x: a.x, y: a.y, d: 0, side: 1 };
      stepDist.set(a, st);
    }
    const moved = Math.hypot(a.x - st.x, a.y - st.y);
    st.x = a.x;
    st.y = a.y;
    if (moved > 30) continue;
    st.d += moved;
    if (st.d < 17) continue;
    st.d = 0;
    st.side = -st.side;
    const tx = Math.floor(a.x / TILE);
    const ty = Math.floor(a.y / TILE);
    if (!m.inBounds(tx, ty)) continue;
    const g = m.ground[ty * m.w + tx];
    const ang = Math.atan2(a.vy || Math.sin(a.aim), a.vx || Math.cos(a.aim));
    if (g === GT.SHALLOW || g === GT.LIQUID) {
      fx.ring(a.x, a.y + 2, '#bfe6ff', 3, 16, 0.5, 1.4);
      if (Math.random() < 0.5) fx.particle(a.x, a.y, { z: 2, vx: (Math.random() - 0.5) * 30, vy: -10, vz: 40, kind: 'spark', color: '#dff6ff', size: 1.6, max: 0.35, drag: 2, grav: 300 });
    } else if (snowy && GRASSY.has(g)) {
      prints.push({ x: a.x + Math.cos(ang + Math.PI / 2) * 3 * st.side, y: a.y + Math.sin(ang + Math.PI / 2) * 2 * st.side, a: ang, t: 0 });
      if (prints.length > 260) prints.shift();
    } else if (GRASSY.has(g)) {
      if (Math.random() < 0.45) fx.particle(a.x, a.y - 2, { z: 3, vx: (Math.random() - 0.5) * 34, vy: -8, vz: 30 + Math.random() * 30, kind: 'square', color: Math.random() < 0.5 ? shade(REALMS[m.realm].palette.grass, 0.2) : '#c9e07a', size: 1.8, max: 0.6, drag: 1.5, grav: 120 });
    } else if (g === GT.PATH || g === GT.DIRT || g === GT.SAND || g === GT.PLAZA || g === GT.FLOOR || g === GT.FLOOR2) {
      if (Math.random() < 0.55) fx.dust(a.x, a.y, 1, g === GT.SAND ? '#e0cf9a' : '#b9ad98');
    } else if (g === GT.BRIDGE || g === GT.WOOD || g === GT.WOODFLOOR) {
      if (Math.random() < 0.15) fx.dust(a.x, a.y, 1, '#8a6a4a');
    }
  }
}

export function drawPrints(ctx: CanvasRenderingContext2D): void {
  if (!prints.length) return;
  for (const p of prints) {
    ctx.fillStyle = `rgba(90,110,140,${(0.3 * (1 - p.t / 7)).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 2.6, 1.4, p.a, 0, TAU);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ cloud shadows, canopy, god rays

let cloudSprite: HTMLCanvasElement | null = null;
function cloud(): HTMLCanvasElement {
  if (cloudSprite) return cloudSprite;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  for (let i = 0; i < 6; i++) {
    const x = 50 + i * 30;
    const y = 70 + Math.sin(i * 1.7) * 18;
    const gr = g.createRadialGradient(x, y, 0, x, y, 70);
    gr.addColorStop(0, 'rgba(0,0,0,0.5)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 160);
  }
  cloudSprite = c;
  return c;
}

export function drawCloudShadows(ctx: CanvasRenderingContext2D, m: GameMap, t: number, camX: number, camY: number, vw: number, vh: number): void {
  if (!v3flags.clouds || m.kind !== 'wild' || !m.outdoor) return;
  const h = G.save.time;
  if (h < 6 || h > 19) return;
  const spr = cloud();
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 5; i++) {
    const span = m.pw + 1400;
    const x = ((t * (12 + i * 3) + i * 977) % span) - 700;
    const y = ((i * 1543) % Math.max(1, m.ph)) + Math.sin(t * 0.05 + i) * 60;
    const w = 620 + i * 90;
    const hh = w * 0.6;
    if (x + w < camX - vw / 2 || x > camX + vw / 2 || y + hh < camY - vh / 2 || y > camY + vh / 2) continue;
    ctx.drawImage(spr, x, y, w, hh);
  }
  ctx.globalAlpha = 1;
}

const leafCache = new Map<number, HTMLCanvasElement>();
function leafSprite(realm: number): HTMLCanvasElement {
  let c = leafCache.get(realm);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 200;
  c.height = 140;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const P = REALMS[realm].palette;
  const base = shade(P.grass, -0.45);
  for (let i = 0; i < 26; i++) {
    const x = 30 + Math.sin(i * 12.9) * 70 + 70;
    const y = 30 + Math.cos(i * 7.7) * 40 + 40;
    g.fillStyle = mix(base, shade(P.grass2, -0.3), (i % 5) / 5);
    g.beginPath();
    g.ellipse(x, y, 26 + (i % 4) * 6, 15 + (i % 3) * 5, i, 0, TAU);
    g.fill();
  }
  leafCache.set(realm, c);
  return c;
}

/** screen-space foreground: canopy blobs at 1.18x parallax (fading near the Diver) and god-rays */
export function drawForeground(ctx: CanvasRenderingContext2D, w: number, h: number, s: number, camX: number, camY: number, t: number): void {
  if (!v3flags.foreground) return;
  const m = G.world.map;
  const p = G.player;
  const psx = (p.x - camX) * s + w / 2;
  const psy = (p.y - 20 - camY) * s + h / 2;
  if (m.kind === 'wild') {
    const spr = leafSprite(m.realm);
    const PAR = 1.18;
    const vwp = (w / s) * 0.6;
    const vhp = (h / s) * 0.6;
    const edge = Math.min(w, h) * 0.36;
    for (const pr of m.props) {
      if (pr.kind !== 'tree') continue;
      if (hash2(Math.floor(pr.x), Math.floor(pr.y), 77) > 0.09) continue;
      const wx = pr.x;
      const wy = pr.y - pr.sh * 0.9;
      if (Math.abs(wx - camX) > vwp * 1.4 || Math.abs(wy - camY) > vhp * 1.4) continue;
      const sx = (wx - camX) * s * PAR + w / 2;
      const sy = (wy - camY) * s * PAR + h / 2;
      // overhanging foliage only frames the view: it lives near the screen edges
      const fromCenter = Math.max(Math.abs(sx - w / 2) / (w / 2), Math.abs(sy - h / 2) / (h / 2));
      const edgeK = clamp((fromCenter - 0.62) / 0.3, 0, 1);
      const d = Math.hypot(sx - psx, sy - psy);
      const a = clamp((d - edge) / (edge * 0.6), 0, 1) * edgeK * 0.5;
      if (a < 0.03) continue;
      const sw = 170 * s;
      const sh = 118 * s;
      ctx.globalAlpha = a;
      ctx.drawImage(spr, sx - sw / 2, sy - sh / 2, sw, sh);
    }
    ctx.globalAlpha = 1;
  }
  // diagonal god-rays in forests (daytime) and ruins (dungeons)
  const R = REALMS[m.realm];
  const hour = G.save.time;
  const forest = m.kind === 'wild' && (R.ambient === 'leaf' || R.ambient === 'firefly' || R.ambient === 'blossom') && hour > 7 && hour < 17;
  const ruins = m.kind === 'dungeon';
  if (!forest && !ruins) return;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const ph = t * 0.05 + i * 2.1;
    const x = ((i * 0.37 + 0.12 + Math.sin(ph) * 0.04) % 1) * w * 1.3 - w * 0.1;
    const alpha = (ruins ? 0.05 : 0.07) * (0.6 + 0.4 * Math.sin(t * 0.4 + i * 2));
    const g = ctx.createLinearGradient(x, 0, x - h * 0.5, h);
    g.addColorStop(0, rgba(ruins ? '#9fb4ff' : '#fff1c2', alpha));
    g.addColorStop(1, rgba(ruins ? '#9fb4ff' : '#fff1c2', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 70 * s, 0);
    ctx.lineTo(x + 70 * s - h * 0.5, h);
    ctx.lineTo(x - h * 0.5 - 30 * s, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ------------------------------------------------------------------ blade trail mesh

/** 12-sample triangulated hilt-to-tip ribbon with a white-hot core and elemental edge tint */
export function drawBladeTrail(ctx: CanvasRenderingContext2D, A: Anim, color: string, dy: number): void {
  if (!v3flags.trails) return;
  const tr = bladeTrail(A);
  const n = tr.length;
  if (n < 3) return;
  ctx.save();
  ctx.translate(0, -dy);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 1; i < n; i++) {
    const a = tr[i - 1];
    const b = tr[i];
    const k = i / (n - 1);
    ctx.fillStyle = rgba(color, 0.08 + 0.42 * k);
    ctx.beginPath();
    ctx.moveTo(a.hx, a.hy);
    ctx.lineTo(a.tx, a.ty);
    ctx.lineTo(b.tx, b.ty);
    ctx.lineTo(b.hx, b.hy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(color, 0.9);
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(tr[0].tx, tr[0].ty);
  for (let i = 1; i < n; i++) ctx.lineTo(tr[i].tx, tr[i].ty);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  const from = Math.max(0, n - 6);
  ctx.moveTo(tr[from].tx, tr[from].ty);
  for (let i = from + 1; i < n; i++) ctx.lineTo(tr[i].tx, tr[i].ty);
  ctx.stroke();
  const last = tr[n - 1];
  ctx.globalAlpha = 0.7;
  ctx.drawImage(glowSprite(color), last.tx - 8, last.ty - 8, 16, 16);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  if (Math.random() < 0.25) fx.particle(last.tx, last.ty + dy, { z: dy, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 30, vz: 40, kind: 'spark', color: '#ffffff', size: 1.4, max: 0.25, drag: 3, grav: 200 });
}

// ------------------------------------------------------------------ mounts

/** quadruped / drake / gryphon body; `front` draws the neck and head layer over the rider's legs */
export function drawMount(ctx: CanvasRenderingContext2D, x: number, y: number, M: MountDef, dir: number, walk: number, front: boolean): void {
  const [c0, c1, c2] = M.colors;
  const side = dir === 2 || dir === 3;
  const flip = dir === 2 ? -1 : 1;
  const gallop = Math.sin(walk * 1.4);
  ctx.save();
  ctx.translate(x, y);
  if (side) ctx.scale(flip, 1);
  const bob = Math.abs(gallop) * 1.5;
  if (!front) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 1, side ? 24 : 14, 5, 0, 0, TAU);
    ctx.fill();
    // legs
    ctx.strokeStyle = c1;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    const legs = side ? [-14, -8, 8, 14] : [-7, -3, 3, 7];
    legs.forEach((lx, i) => {
      const sw = Math.sin(walk * 1.4 + i * 1.6) * (side ? 5 : 2);
      ctx.beginPath();
      ctx.moveTo(lx, -14 - bob);
      ctx.lineTo(lx + sw * 0.4, -7 - bob);
      ctx.lineTo(lx + sw, 0);
      ctx.stroke();
    });
    // body
    ctx.fillStyle = c0;
    ctx.beginPath();
    if (side) ctx.ellipse(0, -17 - bob, 19, 8, 0, 0, TAU);
    else ctx.ellipse(0, -17 - bob, 10, 9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shade(c0, 0.18);
    ctx.beginPath();
    if (side) ctx.ellipse(-2, -20 - bob, 14, 3, 0, 0, TAU);
    else ctx.ellipse(0, -21 - bob, 6, 3, 0, 0, TAU);
    ctx.fill();
    // saddle
    ctx.fillStyle = '#5a3020';
    ctx.fillRect(-6, -26 - bob, 12, 5);
    ctx.fillStyle = c2;
    ctx.fillRect(-6, -22 - bob, 12, 1.4);
    // tail / wings
    if (M.kind === 'drake' || M.kind === 'gryphon') {
      ctx.fillStyle = rgba(c2, 0.85);
      const flap = Math.sin(walk * 2) * 6;
      ctx.beginPath();
      ctx.moveTo(-4, -22 - bob);
      ctx.lineTo(-22, -38 - flap - bob);
      ctx.lineTo(-10, -20 - bob);
      ctx.closePath();
      ctx.fill();
      if (!side) {
        ctx.beginPath();
        ctx.moveTo(4, -22 - bob);
        ctx.lineTo(22, -38 - flap - bob);
        ctx.lineTo(10, -20 - bob);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (side) {
      ctx.strokeStyle = c1;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-18, -19 - bob);
      ctx.quadraticCurveTo(-26, -14 + gallop * 2 - bob, -24, -6 - bob);
      ctx.stroke();
    }
  } else {
    // neck & head in front of the rider
    ctx.fillStyle = c0;
    if (side) {
      ctx.beginPath();
      ctx.moveTo(12, -20 - bob);
      ctx.lineTo(22, -34 - bob);
      ctx.lineTo(28, -32 - bob);
      ctx.lineTo(18, -16 - bob);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(28, -33 - bob, 7, 4, 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(29, -35 - bob, 1.6, 1.6);
      if (M.kind === 'stag') {
        ctx.strokeStyle = c2;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(25, -36 - bob);
        ctx.lineTo(22, -46 - bob);
        ctx.moveTo(23, -42 - bob);
        ctx.lineTo(18, -45 - bob);
        ctx.stroke();
      }
      ctx.strokeStyle = c1;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, -24 - bob);
      ctx.lineTo(22, -36 - bob);
      ctx.stroke();
    } else if (dir === 0) {
      ctx.beginPath();
      ctx.ellipse(0, -12 - bob, 6, 8, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(-3.5, -14 - bob, 1.6, 1.6);
      ctx.fillRect(2, -14 - bob, 1.6, 1.6);
      if (M.kind === 'stag') {
        ctx.strokeStyle = c2;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-4, -19 - bob);
        ctx.lineTo(-9, -29 - bob);
        ctx.moveTo(4, -19 - bob);
        ctx.lineTo(9, -29 - bob);
        ctx.stroke();
      }
    }
    if (M.kind === 'gryphon' || M.kind === 'drake') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25;
      ctx.drawImage(glowSprite(c2), -20, -40 - bob, 40, 30);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ pets

export function drawPet(ctx: CanvasRenderingContext2D, pet: Pet, t: number): void {
  const d = pet.def;
  const x = pet.x;
  const y = pet.y - pet.z;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(pet.x, pet.y, 6, 2.2, 0, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55;
  ctx.drawImage(glowSprite(d.color), x - 14, y - 14, 28, 28);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = d.color;
  ctx.beginPath();
  ctx.ellipse(x, y, 5.5, 5, 0, 0, TAU);
  ctx.fill();
  const flap = Math.sin(t * 14) * 3;
  ctx.fillStyle = rgba(d.color2, 0.8);
  ctx.beginPath();
  ctx.ellipse(x - 5, y - 2, 4, 2 + flap * 0.3, -0.6, 0, TAU);
  ctx.ellipse(x + 5, y - 2, 4, 2 - flap * 0.3, 0.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(x - 2.2 + pet.face, y - 1.5, 1.4, 1.4);
  ctx.fillRect(x + 1 + pet.face, y - 1.5, 1.4, 1.4);
}

// ------------------------------------------------------------------ breakables & caravan

export function drawBreakable(ctx: CanvasRenderingContext2D, b: Breakable, t: number): void {
  const jig = b.shake > 0 ? Math.sin(t * 90) * 1.5 : 0;
  const x = b.x + jig;
  const y = b.y;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(b.x, y + 1, 11, 4, 0, 0, TAU);
  ctx.fill();
  switch (b.variant) {
    case 'barrel': {
      ctx.fillStyle = '#7a3a1a';
      ctx.fillRect(x - 8, y - 20, 16, 20);
      ctx.fillStyle = '#5a2810';
      ctx.fillRect(x - 8, y - 15, 16, 2);
      ctx.fillRect(x - 8, y - 6, 16, 2);
      ctx.fillStyle = '#ff7a3d';
      ctx.beginPath();
      ctx.ellipse(x, y - 20, 8, 3, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.font = '700 8px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', x, y - 9);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 5 + b.id);
      ctx.drawImage(glowSprite('#ff7a3d'), x - 12, y - 30, 24, 18);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'frost': {
      const cols = ['#bff3ff', '#7fe9ff', '#dff6ff'];
      for (let i = 0; i < 4; i++) {
        const ox = (i - 1.5) * 5;
        const hgt = 14 + ((i * 7) % 3) * 6;
        ctx.fillStyle = cols[i % 3];
        ctx.beginPath();
        ctx.moveTo(x + ox - 4, y);
        ctx.lineTo(x + ox, y - hgt);
        ctx.lineTo(x + ox + 4, y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3 + b.id);
      ctx.drawImage(glowSprite('#7fe9ff'), x - 16, y - 30, 32, 30);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'crate':
      ctx.fillStyle = '#8a5a32';
      ctx.fillRect(x - 9, y - 16, 18, 16);
      ctx.strokeStyle = '#5a3a1a';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x - 9, y - 16, 18, 16);
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 16);
      ctx.lineTo(x + 9, y);
      ctx.moveTo(x + 9, y - 16);
      ctx.lineTo(x - 9, y);
      ctx.stroke();
      break;
    case 'urn':
      ctx.fillStyle = '#b9845a';
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 18);
      ctx.quadraticCurveTo(x - 11, y - 10, x - 6, y);
      ctx.lineTo(x + 6, y);
      ctx.quadraticCurveTo(x + 11, y - 10, x + 4, y - 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8a5a3a';
      ctx.fillRect(x - 5, y - 20, 10, 3);
      ctx.strokeStyle = '#e0c49a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 9);
      ctx.lineTo(x + 7, y - 9);
      ctx.stroke();
      break;
  }
}

export function drawCaravan(ctx: CanvasRenderingContext2D, c: Caravan, t: number): void {
  const x = c.x;
  const y = c.y;
  const right = Math.cos(c.aim) >= 0;
  ctx.save();
  ctx.translate(x, y);
  if (!right) ctx.scale(-1, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 34, 7, 0, 0, TAU);
  ctx.fill();
  // horse
  const g = Math.sin(c.wheel * 1.3);
  ctx.strokeStyle = '#5a3a24';
  ctx.lineWidth = 3;
  for (const lx of [22, 30]) {
    ctx.beginPath();
    ctx.moveTo(lx, -12);
    ctx.lineTo(lx + g * 3, 0);
    ctx.stroke();
  }
  ctx.fillStyle = '#8a5a32';
  ctx.beginPath();
  ctx.ellipse(26, -16, 10, 6, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(36, -24, 5, 3.5, 0.5, 0, TAU);
  ctx.fill();
  // wagon
  ctx.fillStyle = '#6b4224';
  ctx.fillRect(-26, -20, 40, 12);
  ctx.fillStyle = '#e8dcc0';
  ctx.beginPath();
  ctx.moveTo(-26, -20);
  ctx.quadraticCurveTo(-6, -46, 14, -20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#b9a07a';
  ctx.lineWidth = 1;
  ctx.stroke();
  for (const wx of [-18, 6]) {
    ctx.fillStyle = '#3a2414';
    ctx.beginPath();
    ctx.arc(wx, -6, 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#a07a4a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wx + Math.cos(c.wheel) * 5, -6 + Math.sin(c.wheel) * 5);
    ctx.lineTo(wx - Math.cos(c.wheel) * 5, -6 - Math.sin(c.wheel) * 5);
    ctx.stroke();
  }
  ctx.restore();
  // hp bar
  const w = 46;
  ctx.fillStyle = 'rgba(5,8,18,0.75)';
  ctx.fillRect(x - w / 2 - 1, y - 54, w + 2, 6);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(x - w / 2, y - 53, w * clamp(c.hp / c.stats.maxHp, 0, 1), 4);
  if (c.waiting && Math.floor(t * 2) % 2) {
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 9px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for escort...', x, y - 60);
  }
}

// ------------------------------------------------------------------ ground features

export function drawGroundFeatures(ctx: CanvasRenderingContext2D, m: GameMap, t: number, lift: (x: number, y: number) => number): void {
  for (const pd of m.pads) {
    const y = pd.y - lift(pd.x, pd.y);
    const pulse = 0.6 + 0.4 * Math.sin(t * 4 + pd.x);
    ctx.strokeStyle = rgba('#7fe9ff', 0.8 * pulse);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(pd.x, y, 13, 6, 0, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(pd.x, y, 8, 3.6, 0, t * 2, t * 2 + 4);
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * pulse;
    ctx.drawImage(glowSprite('#7fe9ff'), pd.x - 14, y - 22, 28, 26);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  for (const f of m.fishSpots) {
    for (let i = 0; i < 2; i++) {
      const k = ((t * 0.6 + i * 0.5) % 1);
      ctx.strokeStyle = `rgba(220,240,255,${(0.6 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(f.wx, f.wy, 4 + k * 12, 2 + k * 5, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = '#ff5d6c';
    ctx.beginPath();
    ctx.arc(f.wx, f.wy - 1 + Math.sin(t * 3) * 1, 2, 0, TAU);
    ctx.fill();
  }
  if (m.kind === 'wild') {
    const p = G.player;
    for (const hu of G.save.hunts) {
      if (hu.found || hu.realm !== m.realm) continue;
      const d = Math.hypot(hu.x - p.x, hu.y - p.y);
      if (d > 320) continue;
      const a = clamp(1 - d / 320, 0.15, 1);
      const y = hu.y - lift(hu.x, hu.y);
      ctx.strokeStyle = rgba('#ffd166', a);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(hu.x - 7, y - 4);
      ctx.lineTo(hu.x + 7, y + 4);
      ctx.moveTo(hu.x + 7, y - 4);
      ctx.lineTo(hu.x - 7, y + 4);
      ctx.stroke();
      if (Math.random() < 0.08) fx.particle(hu.x, hu.y, { z: 4, kind: 'glow', color: '#ffd166', size: 2, max: 0.6, vx: 0, vy: 0, vz: 30, drag: 1 });
    }
  }
}

/** the Corrupted Gate world-event portal */
export function drawEventGate(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, hpFrac: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 30, 9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2a1030';
  ctx.fillRect(x - 26, y - 70, 8, 70);
  ctx.fillRect(x + 18, y - 70, 8, 70);
  ctx.fillRect(x - 28, y - 76, 56, 9);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.65 + 0.2 * Math.sin(t * 5);
  ctx.drawImage(glowSprite('#a970ff'), x - 30, y - 74, 60, 76);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rgba('#ff4f7b', 0.8);
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(x, y - 36, 14 - i * 4, 28 - i * 7, 0, t * (2 + i) + i, t * (2 + i) + i + 2.5);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(5,8,18,0.75)';
  ctx.fillRect(x - 25, y - 86, 50, 5);
  ctx.fillStyle = '#c18cff';
  ctx.fillRect(x - 24, y - 85, 48 * clamp(hpFrac, 0, 1), 3);
}
