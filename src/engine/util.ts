// Math, random, noise and color helpers shared by every module.
import type { Dir } from '../types/game';

export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax: number, ay: number, bx: number, by: number): number => (bx - ax) ** 2 + (by - ay) ** 2;
export const angTo = (ax: number, ay: number, bx: number, by: number): number => Math.atan2(by - ay, bx - ax);

export function angDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number): number => t * t * t;
export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export function dirFromAngle(a: number): Dir {
  const c = Math.cos(a);
  const s = Math.sin(a);
  if (Math.abs(c) > Math.abs(s) * 1.05) return c > 0 ? 3 : 2;
  return s > 0 ? 0 : 1;
}

export function dirToAngle(d: Dir): number {
  return d === 0 ? Math.PI / 2 : d === 1 ? -Math.PI / 2 : d === 2 ? Math.PI : 0;
}

// ------------------------------------------------------------------ random

export class RNG {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(a + (b - a + 1) * this.next());
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

export const rnd = (a: number, b: number): number => a + (b - a) * Math.random();
export const rndi = (a: number, b: number): number => Math.floor(a + (b - a + 1) * Math.random());
export const chance = (p: number): boolean => Math.random() < p;
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
export function weighted<T>(items: readonly T[], weight: (t: T) => number): T {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

let uidCounter = 0;
export function uid(): string {
  uidCounter = (uidCounter + 1) % 1e6;
  return Date.now().toString(36) + '-' + uidCounter.toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
}

// ------------------------------------------------------------------ noise

export function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
}

export function fbm(x: number, y: number, seed: number, oct = 3): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 31) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// ------------------------------------------------------------------ color

const rgbCache = new Map<string, [number, number, number]>();
export function hexToRgb(hex: string): [number, number, number] {
  let c = rgbCache.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  rgbCache.set(hex, c);
  return c;
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

function toHex(r: number, g: number, b: number): string {
  const f = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}

/** amt in [-1, 1]: negative darkens toward black, positive lightens toward white */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return toHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return toHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return toHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}

// ------------------------------------------------------------------ formatting

export function fmt(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

export function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m ${Math.floor(sec % 60).toString().padStart(2, '0')}s`;
}

export function clockText(hours: number): string {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function pct(v: number, digits = 0): string {
  return (v * 100).toFixed(digits) + '%';
}
