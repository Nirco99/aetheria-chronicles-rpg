// Static world props in 3D: buildings, lamps, the Teleport Gate, dungeon portals, fountains,
// market stalls, banners, pillars, torches, house furniture and the additive light pools under
// every light. Whole regions are merged into single meshes; only a few animated pieces stay live.
import * as THREE from 'three';
import type { Prop } from '../types/game';
import { SOL } from '../world/tilemap';
import { REALMS } from '../data/realms';
import { TILE } from '../data/constants';
import { hash2 } from '../engine/util';
import { propSprite } from '../render/props';
import { LAYER, canvasTexture, radialTexture } from './textures';
import type { Quality } from './quality';
import type { Environment } from './env';
import type { TerrainField } from './terrain';
import { Geo, WALL_H3, col, colMix, meshOf, shadeCol, shared, uber } from './util3';

const T = TILE;
const PI = Math.PI;

export interface Emitter {
  x: number;
  y: number;
  z: number;
  kind: 'flame' | 'smoke' | 'fountain' | 'portal' | 'ember' | 'spark';
  color: string;
  rate: number;
}

interface Live {
  obj: THREE.Object3D;
  kind: 'portal' | 'crystal' | 'water' | 'flame';
  seed: number;
  baseY: number;
}

const PORTAL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec3 uCol;
uniform vec3 uCol2;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float sw = sin(a * 3.0 + r * 9.0 - uTime * 3.2) * 0.5 + 0.5;
  float sw2 = sin(a * 5.0 - r * 14.0 + uTime * 2.1) * 0.5 + 0.5;
  float core = smoothstep(0.75, 0.0, r);
  vec3 c = mix(uCol2, uCol, sw * 0.7 + core * 0.5) * (0.7 + sw2 * 0.9);
  c += vec3(1.0) * pow(core, 3.0) * 1.1;
  c *= 0.8 + core * 1.0;
  float edge = smoothstep(1.0, 0.86, r);
  gl_FragColor = vec4(c * edge, edge);
}
`;

const WATER_DISC_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec3 uCol;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float rip = sin(r * 22.0 - uTime * 4.0) * 0.5 + 0.5;
  float rip2 = sin(r * 9.0 - uTime * 2.2 + atan(p.y, p.x) * 3.0) * 0.5 + 0.5;
  vec3 c = uCol * (0.55 + rip * 0.25 + rip2 * 0.2) + vec3(0.9, 1.0, 1.0) * pow(rip * rip2, 3.0) * 0.6;
  gl_FragColor = vec4(c, 0.86);
}
`;

const UV_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

// ---------------------------------------------------------------------------------- builders

function lamp(g: Geo, realm: number): void {
  const P = REALMS[realm].palette;
  const iron = '#2a2a33';
  const m = { metal: 0.7, rough: 0.45 };
  g.cyl(0, 1.5, 0, 3.4, 4.2, 3, iron, m, 8);
  g.cyl(0, 25, 0, 1, 1.4, 46, iron, m, 6);
  g.cyl(0, 48.5, 0, 3.4, 1.4, 2, iron, m, 6);
  g.box(0, 54, 0, 7, 9, 7, P.lampColor, { em: 54.5, rough: 0.3 });
  for (const [x, z] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]] as [number, number][]) g.box(x, 54, z, 0.9, 9.6, 0.9, iron, m);
  g.cone(0, 61.5, 0, 6.4, 6, iron, m, 4, [0, PI / 4, 0]);
  g.sphere(0, 65, 0, 1.1, 1.1, 1.1, iron, m, 6);
}

function torch(g: Geo, wall: boolean, color: string): void {
  const iron = '#3a3640';
  if (wall) {
    g.box(0, 22, -1, 3, 3, 4, iron, { metal: 0.6, rough: 0.5 });
    g.cyl(0, 25, 2.4, 1, 0.8, 10, '#3a2a1f', { rough: 0.9 }, 6, [0.5, 0, 0]);
    g.cone(0, 31.5, 5, 2.2, 6, color, { em: 6, rough: 0.5 }, 6);
  } else {
    g.cyl(0, 13, 0, 1.2, 1.8, 26, '#3a2a1f', { rough: 0.9 }, 6);
    g.cyl(0, 27, 0, 4.6, 2.4, 4, iron, { metal: 0.6, rough: 0.5 }, 8);
    g.cone(0, 33, 0, 3.2, 9, color, { em: 6, rough: 0.5 }, 6);
  }
}

function gateFrame(g: Geo, realm: number, abyss: boolean): void {
  const P = REALMS[realm].palette;
  const stone = abyss ? '#2a2236' : P.wallTop;
  const o = { layer: LAYER.brick, rough: 0.8 };
  g.box(0, 3, 0, 108, 6, 34, shadeCol(stone, -0.3), o);
  g.box(0, 8, 0, 92, 4, 26, shadeCol(stone, -0.12), o);
  for (const sx of [-1, 1]) {
    g.box(sx * 38, 30, 0, 12, 44, 14, stone, o);
    g.box(sx * 38, 54, 0, 15, 5, 17, shadeCol(stone, 0.1), o);
    g.sphere(sx * 38, 60, 0, 4, 4, 4, abyss ? '#a970ff' : '#7fe9ff', { em: 5, rough: 0.2 }, 10);
  }
  g.torus(0, 48, 0, 34, 5.5, shadeCol(stone, 0.05), o, [0, 0, 0], PI * 2, 30);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2 + PI / 8;
    g.sphere(Math.cos(a) * 34, 48 + Math.sin(a) * 34, 3.5, 2.2, 2.2, 2.2, abyss ? '#c9a8ff' : '#bff3ff', { em: 6, rough: 0.2 }, 6);
  }
}

function dungeonGate(g: Geo, realm: number): void {
  const P = REALMS[realm].palette;
  const stone = P.dunFace;
  const top = P.dunTop;
  const o = { layer: LAYER.brick, rough: 0.85 };
  const glow = realm === 2 ? '#ff7a3d' : realm === 3 ? '#9fdcff' : realm === 4 ? '#fff1a8' : '#7fb4ff';
  // rocky mound behind the portal
  g.ico(0, 26, -44, 78, 46, 44, shadeCol(P.cliffFace, -0.1), { layer: LAYER.rock, rough: 0.9 }, 2);
  g.ico(-58, 16, -36, 34, 28, 30, shadeCol(P.cliffFace, -0.2), { layer: LAYER.rock, rough: 0.9 }, 1, [0.3, 0.7, 0]);
  g.ico(60, 18, -38, 36, 30, 30, shadeCol(P.cliffFace, -0.16), { layer: LAYER.rock, rough: 0.9 }, 1, [0.1, 1.9, 0.2]);
  for (const sx of [-1, 1]) {
    g.box(sx * 36, 36, -8, 20, 72, 22, stone, o);
    g.box(sx * 36, 75, -8, 24, 6, 26, top, o);
    g.cone(sx * 36, 87, -8, 13, 18, shadeCol(top, -0.2), o, 4, [0, PI / 4, 0]);
    g.sphere(sx * 36, 52, 4.5, 3.4, 3.4, 3.4, glow, { em: 6 }, 8);
  }
  g.box(0, 66, -8, 56, 14, 22, stone, o);
  g.box(0, 76, -8, 64, 6, 26, top, o);
  g.ico(0, 66, 4.5, 6, 6, 3, glow, { em: 5, rough: 0.2 }, 0);
  // steps
  for (let i = 0; i < 3; i++) g.box(0, 2 + i * 3, 12 - i * 6, 62 - i * 6, 4, 10, shadeCol(stone, 0.06 * i), o);
  // the dark doorway
  g.box(0, 30, -9, 52, 60, 6, '#05060c', { rough: 1 });
}

function fountain(g: Geo, realm: number): void {
  const P = REALMS[realm].palette;
  const st = P.plaza;
  const o = { layer: LAYER.marble, rough: 0.5 };
  g.cyl(0, 4, 0, 36, 38, 8, shadeCol(st, -0.12), o, 24);
  g.torus(0, 8.5, 0, 34, 3, shadeCol(st, 0.06), o, [PI / 2, 0, 0], PI * 2, 30);
  g.cyl(0, 14, 0, 4.5, 6.5, 22, st, o, 12);
  g.cyl(0, 26, 0, 15, 5, 5, shadeCol(st, 0.05), o, 16);
  g.cyl(0, 33, 0, 2.6, 3.4, 10, st, o, 10);
  g.sphere(0, 40, 0, 4.2, 4.2, 4.2, realm === 1 ? '#7fe9ff' : shadeCol(st, 0.15), realm === 1 ? { em: 3, rough: 0.2 } : o, 12);
}

function statue(g: Geo, realm: number, hero: boolean): void {
  const P = REALMS[realm].palette;
  const st = shadeCol(P.rock, 0.12);
  const o = { layer: LAYER.marble, rough: 0.6 };
  g.box(0, 6, 0, 22, 12, 22, shadeCol(P.rock, -0.1), { layer: LAYER.brick, rough: 0.8 });
  g.box(0, 13.5, 0, 26, 3, 26, st, o);
  // a robed swordsman, blade raised
  g.cyl(0, 27, 0, 4.4, 7, 24, st, o, 10);
  g.sphere(0, 43, 0, 5.6, 6, 5.2, st, o, 12);
  g.limb(-5, 37, 0, -9, 28, 3, 1.9, st, o);
  g.limb(5, 37, 0, 10, 50, 2, 1.9, st, o);
  g.box(10.4, 64, 2, 1.6, 26, 0.9, hero ? '#ffd27a' : st, hero ? { metal: 0.9, rough: 0.25, em: 0.4 } : o);
  g.box(10.4, 51, 2, 7, 1.4, 1.6, st, o);
}

function bench(g: Geo, realm: number): void {
  const w = REALMS[realm].palette.wood;
  const o = { layer: LAYER.planks, rough: 0.8 };
  g.box(0, 9, 0, 52, 2.4, 13, w, o);
  g.box(0, 17, -6, 52, 9, 2, shadeCol(w, -0.1), o);
  for (const sx of [-22, 22]) {
    g.box(sx, 4.5, 4, 2.6, 9, 2.6, '#2a2a33', { metal: 0.6, rough: 0.5 });
    g.box(sx, 10, -6, 2.6, 21, 2.6, '#2a2a33', { metal: 0.6, rough: 0.5 });
  }
}

function crate(g: Geo, realm: number, v: number): void {
  const w = REALMS[realm].palette.wood;
  const o = { layer: LAYER.planks, rough: 0.85 };
  const one = (x: number, y: number, z: number, s: number, ry: number): void => {
    g.push(x, y, z, 0, ry, 0);
    g.box(0, s / 2, 0, s, s, s, w, o);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.box((sx * s) / 2, s / 2, (sz * s) / 2, 2, s + 1, 2, shadeCol(w, -0.3), o);
    g.box(0, s + 0.4, 0, s + 1.4, 1.2, s + 1.4, shadeCol(w, -0.22), o);
    g.pop();
  };
  one(0, 0, 0, 20, 0.12);
  if (v % 2 === 1) one(3, 21.2, -1, 15, 0.5);
}

function stall(g: Geo, realm: number, color: string): void {
  const w = REALMS[realm].palette.wood;
  const o = { layer: LAYER.planks, rough: 0.8 };
  g.box(0, 8, 2, 62, 16, 18, shadeCol(w, -0.05), o);
  g.box(0, 16.8, 2, 66, 1.8, 22, shadeCol(w, 0.1), o);
  for (const [x, z] of [[-30, 11], [30, 11], [-30, -9], [30, -9]] as [number, number][]) g.cyl(x, 24, z, 1.3, 1.3, 48, shadeCol(w, -0.3), { layer: LAYER.bark, rough: 0.9 }, 6);
  // striped canvas awning
  for (let i = 0; i < 8; i++) {
    const c = i % 2 ? '#f4efe6' : color;
    g.box(-28 + i * 8, 47, 3, 8.2, 1, 30, c, { rough: 0.95, wind: 0.18 }, [0.26, 0, 0]);
  }
  // wares
  const goods = ['#ff6a5c', '#ffd166', '#7fd67f', '#8fb8ff', '#f29ac0', '#c9a46e'];
  for (let i = 0; i < 7; i++) g.sphere(-24 + i * 8, 19.6, 3 + (i % 2) * 5 - 2, 2.8, 2.4, 2.8, goods[i % goods.length], { rough: 0.5 }, 8);
}

function banner(g: Geo, color: string): void {
  g.cyl(0, 34, 0, 0.9, 1.2, 68, '#6b4a2f', { layer: LAYER.bark, rough: 0.9 }, 6);
  g.sphere(0, 69, 0, 2, 2, 2, '#ffd166', { metal: 0.9, rough: 0.3 }, 8);
  g.box(6.5, 62, 0, 14, 1, 1, '#6b4a2f', { rough: 0.9 });
  for (let i = 0; i < 6; i++) g.quad(7.5, 57.5 - i * 6.6, 0.4, 12, 6.8, i === 5 ? shadeCol(color, -0.2) : color, { rough: 0.95, wind: 0.15 + i * 0.3 });
  g.quad(7.5, 44, 0.9, 6, 6, '#ffffff', { rough: 0.9, wind: 0.9 }, [0, 0, PI / 4]);
}

function well(g: Geo, realm: number): void {
  const P = REALMS[realm].palette;
  const o = { layer: LAYER.cobble, rough: 0.85 };
  g.cyl(0, 7, 0, 13, 14, 14, P.wallFace, o, 14);
  g.torus(0, 14, 0, 13, 2, shadeCol(P.wallTop, 0.05), o, [PI / 2, 0, 0], PI * 2, 18);
  g.cyl(0, 13.2, 0, 11, 11, 0.6, '#1c3a5a', { rough: 0.1, metal: 0.2 }, 14);
  for (const sx of [-12, 12]) g.box(sx, 26, 0, 2.2, 28, 2.2, P.wood, { layer: LAYER.bark, rough: 0.9 });
  g.prism(0, 40, 0, 34, 10, 24, P.roofs[0], { layer: LAYER.roof, rough: 0.8 });
  g.cyl(0, 36, 0, 1.2, 1.2, 26, shadeCol(P.wood, -0.2), { rough: 0.9 }, 6, [0, 0, PI / 2]);
  g.cyl(0, 24, 0, 3, 2.4, 5, '#8a6a4a', { layer: LAYER.planks, rough: 0.8 }, 8);
}

function sign(g: Geo, realm: number): void {
  const w = REALMS[realm].palette.wood;
  g.cyl(0, 14, 0, 1.3, 1.6, 28, shadeCol(w, -0.25), { layer: LAYER.bark, rough: 0.9 }, 6);
  g.box(0, 25, 1, 24, 13, 2, w, { layer: LAYER.planks, rough: 0.8 });
  for (let i = 0; i < 3; i++) g.box(0, 28.5 - i * 3.4, 2.2, 16 - i * 3, 1, 0.5, '#3a2a1a', { rough: 0.9 });
}

function pillar(g: Geo, realm: number): void {
  const P = REALMS[realm].palette;
  const o = { layer: LAYER.brick, rough: 0.8 };
  g.box(0, 4, 0, 24, 8, 24, shadeCol(P.dunFace, 0.12), o);
  g.cyl(0, 34, 0, 8.4, 9.6, 52, shadeCol(P.dunTop, -0.05), { layer: LAYER.marble, rough: 0.6 }, 12);
  g.box(0, 62, 0, 24, 6, 24, shadeCol(P.dunFace, 0.2), o);
  g.torus(0, 22, 0, 9.4, 1.2, P.lampColor, { em: 2.2, rough: 0.3 }, [PI / 2, 0, 0], PI * 2, 14);
}

function dungeonStairs(g: Geo, realm: number): void {
  const P = REALMS[realm].palette;
  const o = { layer: LAYER.flag, rough: 0.8 };
  for (let i = 0; i < 6; i++) g.box(0, 2.5 + i * 5, 14 - i * 7, 44, 5, 8, shadeCol(P.dunTop, 0.1 - i * 0.03), o);
  for (const sx of [-25, 25]) g.box(sx, 18, -8, 6, 36, 50, P.dunFace, { layer: LAYER.brick, rough: 0.85 });
  g.box(0, 22, -30, 44, 44, 4, '#9fc8f0', { em: 0.7, rough: 0.4 });
}

function building(g: Geo, realm: number, d: Record<string, unknown>, emit: (e: Emitter) => void, wx: number, wy: number, wz: number): void {
  const P = REALMS[realm].palette;
  const type = String(d.type);
  const w = Number(d.w);
  const h = Number(d.h);
  const tier = Number(d.tier ?? 0);
  const W = w * T - 8;
  const D = h * T - 10;
  const cz = -(h * T) / 2 + 1;
  if (type === 'coliseum') {
    const st = '#d9c9a6';
    const o = { layer: LAYER.brick, rough: 0.8 };
    g.cyl(0, 30, cz, W / 2, W / 2, 60, st, o, 36);
    g.cyl(0, 61, cz, W / 2 + 4, W / 2 + 4, 4, shadeCol(st, 0.12), o, 36);
    g.cyl(0, 62, cz, W / 2 - 16, W / 2 - 16, 5, '#3a2c20', { rough: 1 }, 30);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * PI * 2;
      const x = Math.cos(a) * (W / 2 + 0.5);
      const z = cz + Math.sin(a) * (W / 2 + 0.5);
      g.push(x, 0, z, 0, -a + PI / 2, 0);
      g.box(0, 22, 0, 16, 32, 3, '#3a2c20', { rough: 1 });
      g.box(0, 46, 0.5, 20, 4, 3, shadeCol(st, 0.15), o);
      g.pop();
      if (i % 3 === 0) {
        const fc = ['#ff5d6c', '#3f7fe0', '#ffd166', '#5ee6a0', '#c18cff', '#ff9a3d'][(i / 3) % 6];
        g.cyl(Math.cos(a) * (W / 2), 76, cz + Math.sin(a) * (W / 2), 0.8, 0.8, 26, '#6b4a2f', { rough: 0.9 }, 5);
        g.quad(Math.cos(a) * (W / 2) + 6, 84, cz + Math.sin(a) * (W / 2), 12, 8, fc, { rough: 0.9, wind: 0.8 });
      }
    }
    g.box(0, 18, cz + W / 2 - 2, 34, 36, 10, '#1a120c', { rough: 1 });
    return;
  }
  const roofIdx = ({ forge: 2, alchemist: 1, guild: 0, estate: 3, market: 1, general: 2, house: 0 } as Record<string, number>)[type] ?? 0;
  const roof = P.roofs[roofIdx % P.roofs.length];
  const wall = type === 'forge' ? shadeCol(P.walls[2], -0.25) : col(P.walls[(roofIdx + tier) % P.walls.length]);
  const HW = 40 + (h >= 5 ? 6 : 0);
  const stoneWalls = type === 'forge' || realm === 2;
  const wallO = { layer: stoneWalls ? LAYER.brick : realm === 4 ? LAYER.marble : LAYER.plaster, rough: 0.85 };
  const wood = shadeCol(P.wood, -0.3);
  const woodO = { layer: LAYER.planks, rough: 0.8 };
  // foundation + body
  g.box(0, 3.5, cz, W + 5, 7, D + 5, shadeCol(P.wallFace, -0.05), { layer: LAYER.cobble, rough: 0.9 });
  g.box(0, 7 + HW / 2, cz, W, HW, D, wall, wallO);
  const zf = cz + D / 2;
  const zb = cz - D / 2;
  // timber framing / pilasters
  if (realm <= 1 && !stoneWalls) {
    const beam = (x: number, y: number, z: number, bw: number, bh: number, bd: number): Geo => g.box(x, y, z, bw, bh, bd, wood, woodO);
    for (const z of [zf + 0.4, zb - 0.4]) {
      beam(0, 8.5, z, W + 1.4, 3, 1.4);
      beam(0, 7 + HW - 1.5, z, W + 1.4, 3, 1.4);
      beam(0, 7 + HW * 0.56, z, W + 1.4, 2.4, 1.4);
      for (let x = -W / 2; x <= W / 2 + 0.1; x += W / Math.max(2, Math.round(W / 34))) beam(x, 7 + HW / 2, z, 2.6, HW, 1.4);
    }
    for (const x of [-W / 2 - 0.4, W / 2 + 0.4]) {
      beam(x, 7 + HW - 1.5, cz, 1.4, 3, D + 1.4);
      beam(x, 7 + HW * 0.56, cz, 1.4, 2.4, D + 1.4);
      for (const z of [zf, zb, cz]) beam(x, 7 + HW / 2, z, 1.4, HW, 2.6);
    }
  } else if (realm === 4) {
    for (let x = -W / 2 + 6; x <= W / 2 - 5; x += 26) g.cyl(x, 7 + HW / 2, zf + 2, 2.6, 3, HW, '#ffffff', { layer: LAYER.marble, rough: 0.35 }, 10);
    g.box(0, 7 + HW + 1, cz, W + 4, 3, D + 4, '#c9a23a', { metal: 0.8, rough: 0.3 });
  } else if (realm === 3) {
    for (let x = -W / 2 + 8; x <= W / 2 - 6; x += 22) g.box(x, 7 + HW / 2, zf + 0.5, 2, HW - 6, 1.2, '#bfe6ff', { em: 0.5, rough: 0.2 });
  }
  // gabled roof: ridge runs east-west so the camera sees the south slope
  const RH = 26 + Math.min(14, h * 2.2);
  const roofO = { layer: LAYER.roof, rough: 0.78 };
  g.prism(0, 7 + HW, cz, W + 14, RH, D + 16, roof, roofO);
  g.box(0, 7 + HW + RH + 0.6, cz, W + 16, 2.4, 3.4, shadeCol(roof, 0.25), roofO);
  for (const sx of [-1, 1]) g.box(sx * (W / 2 + 6.4), 7 + HW + 1, cz, 1.6, 2.6, D + 17, shadeCol(roof, -0.25), woodO);
  if (realm === 3) g.prism(0, 7 + HW + RH * 0.42, cz, W + 13, RH * 0.62, (D + 16) * 0.62, '#f6faff', { layer: LAYER.snow, rough: 0.5 });
  // door
  const doorC = shadeCol(P.wood, -0.38);
  g.box(0, 7 + 12, zf + 0.9, 17, 25, 2.4, wood, woodO);
  g.box(0, 7 + 11, zf + 1.7, 13, 22, 1.4, doorC, woodO);
  g.sphere(4.2, 7 + 11, zf + 2.8, 0.9, 0.9, 0.9, '#ffd27a', { metal: 0.9, rough: 0.3 }, 6);
  g.box(0, 5, zf + 6, 22, 4, 10, shadeCol(P.wallFace, 0.05), { layer: LAYER.slab, rough: 0.8 });
  // windows (lit at night)
  const win = colMix(P.lampColor, '#ffffff', 0.2);
  const winC = type === 'alchemist' ? '#7fe9ff' : undefined;
  const window = (x: number, y: number, z: number, ry: number): void => {
    g.push(x, y, z, 0, ry, 0);
    g.box(0, 0, 0, 13, 14, 1.6, wood, woodO);
    g.box(0, 0, 0.5, 10, 11, 1.2, winC ?? win, { em: 52.2, rough: 0.25 });
    g.box(0, 0, 1.2, 0.9, 11, 0.6, wood, woodO);
    g.box(0, 0, 1.2, 10, 0.9, 0.6, wood, woodO);
    g.box(0, -8, 1.4, 15, 1.6, 3.2, wood, woodO);
    g.pop();
  };
  const nWin = Math.max(2, Math.floor(W / 44));
  for (let i = 0; i < nWin; i++) {
    const x = -W / 2 + ((i + 0.5) * W) / nWin;
    if (Math.abs(x) < 20) continue;
    window(x, 7 + HW * 0.6, zf + 0.4, 0);
  }
  for (const sx of [-1, 1]) window(sx * (W / 2 + 0.4), 7 + HW * 0.6, cz, (sx * PI) / 2);
  if (h >= 5) window(0, 7 + HW + RH * 0.34, cz + (D + 16) * 0.33, 0);
  // per-type dressing
  const chimney = (x: number, z: number, hgt: number): void => {
    g.box(x, 7 + HW + hgt / 2 + 4, z, 10, hgt, 10, shadeCol(P.wallFace, -0.1), { layer: LAYER.brick, rough: 0.85 });
    g.box(x, 7 + HW + hgt + 5, z, 12.5, 3, 12.5, shadeCol(P.wallFace, 0.1), { layer: LAYER.brick, rough: 0.85 });
    emit({ x: wx + x, y: wy + 7 + HW + hgt + 9, z: wz + z, kind: 'smoke', color: '#8a8a92', rate: 2.2 });
  };
  const hangSign = (c: string, glyph: 'anvil' | 'flask' | 'coin' | 'shield' | 'key' | 'bag' | 'home'): void => {
    g.box(-W / 2 + 14, 7 + 30, zf + 5, 1.6, 1.6, 12, '#2a2a33', { metal: 0.7, rough: 0.5 });
    g.box(-W / 2 + 14, 7 + 23, zf + 9.5, 13, 12, 1.4, shadeCol(P.wood, 0.05), woodO);
    const gz = zf + 10.5;
    const gx = -W / 2 + 14;
    const gy = 7 + 23;
    const em = { em: 0.25, rough: 0.4 };
    if (glyph === 'anvil') {
      g.box(gx, gy + 1.5, gz, 9, 2.6, 0.8, c, em);
      g.box(gx, gy - 1.5, gz, 4, 4, 0.8, c, em);
      g.box(gx, gy - 4, gz, 7, 1.6, 0.8, c, em);
    } else if (glyph === 'flask') {
      g.sphere(gx, gy - 1.5, gz, 3.4, 3.4, 0.6, c, { em: 1.2 }, 10);
      g.box(gx, gy + 3, gz, 1.8, 4, 0.8, c, em);
    } else if (glyph === 'coin') g.cyl(gx, gy, gz, 4, 4, 0.9, c, { metal: 0.9, rough: 0.3 }, 14, [PI / 2, 0, 0]);
    else if (glyph === 'shield') {
      g.box(gx, gy + 1, gz, 7.5, 6, 0.8, c, em);
      g.cone(gx, gy - 3.4, gz, 3.8, 4, c, em, 4, [PI, PI / 4, 0]);
    } else if (glyph === 'key') {
      g.torus(gx - 2, gy + 1.5, gz, 2.2, 0.7, c, { metal: 0.9, rough: 0.3 });
      g.box(gx + 2, gy + 1.5, gz, 6, 1.2, 0.8, c, { metal: 0.9, rough: 0.3 });
    } else if (glyph === 'bag') g.sphere(gx, gy - 0.5, gz, 3.8, 4.2, 0.7, c, em, 10);
    else {
      g.box(gx, gy - 1.5, gz, 7, 5, 0.8, c, em);
      g.cone(gx, gy + 3, gz, 5.4, 4, c, em, 4, [0, PI / 4, 0]);
    }
  };
  if (type === 'forge') {
    chimney(W / 2 - 16, cz - 4, RH + 10);
    hangSign('#ffb35c', 'anvil');
    // open forge mouth glowing beside the door
    g.box(W / 2 - 20, 7 + 9, zf + 1.2, 18, 16, 3, '#1a0e0a', { rough: 1 });
    g.box(W / 2 - 20, 7 + 5, zf + 2, 13, 7, 2, '#ff7a2a', { em: 7, rough: 0.5 });
    emit({ x: wx + W / 2 - 20, y: wy + 14, z: wz + zf + 5, kind: 'ember', color: '#ffb35c', rate: 5 });
    g.box(W / 2 - 42, 7 + 4, zf + 14, 14, 8, 8, '#3a3a44', { metal: 0.8, rough: 0.4 });
    g.box(W / 2 - 42, 7 + 9.5, zf + 14, 18, 3, 7, '#4a4a55', { metal: 0.8, rough: 0.35 });
  } else if (type === 'alchemist') {
    hangSign('#7fe9ff', 'flask');
    for (let i = 0; i < 3; i++) g.sphere(W / 2 - 14 - i * 7, 7 + 6 + (i % 2) * 2, zf + 7, 2.6, 3.2, 2.6, ['#7fe9ff', '#c18cff', '#9be15d'][i], { em: 2.5, rough: 0.15 }, 8);
  } else if (type === 'guild') {
    hangSign('#ffd166', 'shield');
    // a watch-tower over the hall
    g.box(W / 2 - 22, 7 + HW + 26, cz - 6, 28, 52, 28, wall, wallO);
    g.cone(W / 2 - 22, 7 + HW + 68, cz - 6, 24, 34, roof, roofO, 4, [0, PI / 4, 0]);
    g.sphere(W / 2 - 22, 7 + HW + 87, cz - 6, 2.4, 2.4, 2.4, '#ffd166', { metal: 0.9, rough: 0.25, em: 0.5 }, 8);
    window(W / 2 - 22, 7 + HW + 34, cz + 8.4, 0);
  } else if (type === 'estate') hangSign('#ffe9b0', 'key');
  else if (type === 'market') {
    hangSign('#ffd166', 'coin');
    for (let i = 0; i < 9; i++) g.box(-W / 2 + 12 + i * ((W - 24) / 8), 7 + 34, zf + 12, (W - 24) / 8 + 0.4, 1, 22, i % 2 ? '#f4efe6' : roof, { rough: 0.95, wind: 0.12 }, [0.3, 0, 0]);
    for (const sx of [-1, 1]) g.cyl(sx * (W / 2 - 10), 7 + 15, zf + 21, 1.2, 1.2, 30, wood, { rough: 0.9 }, 6);
  } else if (type === 'general') {
    chimney(W / 2 - 14, cz, RH + 6);
    hangSign('#ffe9b0', 'bag');
    g.cyl(W / 2 - 14, 7 + 7, zf + 8, 5, 5, 14, shadeCol(P.wood, 0.05), woodO, 10);
    g.cyl(W / 2 - 26, 7 + 7, zf + 9, 5, 5, 14, shadeCol(P.wood, -0.08), woodO, 10);
  } else if (type === 'house') {
    chimney(W / 2 - 16, cz - 2, RH + 8);
    hangSign('#9fd4ff', 'home');
    if (tier >= 3) for (const sx of [-1, 1]) {
      g.box(sx * (W / 2 - 14), 7 + HW + 22, cz + D / 2 - 14, 22, 44, 22, wall, wallO);
      g.cone(sx * (W / 2 - 14), 7 + HW + 58, cz + D / 2 - 14, 19, 28, roof, roofO, 4, [0, PI / 4, 0]);
    }
  }
}

function furniture(g: Geo, kind: string, realm: number, fw: number, fh: number, emit: (e: Emitter) => void, wx: number, wy: number, wz: number): void {
  const w = REALMS[realm].palette.wood;
  const wo = { layer: LAYER.planks, rough: 0.75 };
  const W = fw * T - 8;
  const D = fh * T - 10;
  const cz = -(fh * T) / 2 + 2;
  switch (kind) {
    case 'vault':
      g.box(0, 11, cz, W, 22, D, '#6b4a2a', wo);
      g.box(0, 23, cz, W + 2, 4, D + 2, '#8a6a3a', wo);
      for (const sx of [-1, 0, 1]) g.box(sx * (W / 2 - 3), 12, cz + D / 2 + 0.4, 3, 24, 1.4, '#c9a23a', { metal: 0.9, rough: 0.3 });
      g.box(0, 13, cz + D / 2 + 1.2, 6, 7, 2, '#ffd27a', { metal: 0.9, rough: 0.25 });
      break;
    case 'anvil':
      g.cyl(-10, 7, cz, 8, 9, 14, '#5a4636', wo, 10);
      g.box(-10, 16, cz, 20, 4, 9, '#4a4a55', { metal: 0.9, rough: 0.3 });
      g.cone(-23, 16, cz, 4, 9, '#4a4a55', { metal: 0.9, rough: 0.3 }, 8, [0, 0, PI / 2]);
      g.box(16, 10, cz - 2, 18, 20, 14, '#3a3232', { layer: LAYER.brick, rough: 0.85 });
      g.box(16, 16, cz + 5.4, 12, 8, 2, '#ff7a2a', { em: 7 });
      emit({ x: wx + 16, y: wy + 22, z: wz + cz + 4, kind: 'ember', color: '#ffb35c', rate: 4 });
      break;
    case 'alchemy':
      g.box(0, 9, cz, W, 3, D, w, wo);
      for (const [x, z] of [[-W / 2 + 3, -D / 2 + 3], [W / 2 - 3, -D / 2 + 3], [-W / 2 + 3, D / 2 - 3], [W / 2 - 3, D / 2 - 3]] as [number, number][]) g.box(x, 4, cz + z, 2.4, 8, 2.4, shadeCol(w, -0.25), wo);
      ['#7fe9ff', '#c18cff', '#9be15d', '#ff9a8a'].forEach((c, i) => {
        g.sphere(-18 + i * 12, 14.5, cz - 1 + (i % 2) * 4, 3.4, 3.8, 3.4, c, { em: 2.4, rough: 0.12 }, 10);
        g.cyl(-18 + i * 12, 19.5, cz - 1 + (i % 2) * 4, 0.9, 1.2, 4, '#dff6ff', { rough: 0.15 }, 6);
      });
      break;
    case 'hearth':
      g.box(0, 15, cz - 2, W, 30, D - 2, '#6a5a52', { layer: LAYER.brick, rough: 0.85 });
      g.box(0, 9, cz + D / 2 - 2.4, W - 18, 16, 3, '#140c08', { rough: 1 });
      g.box(0, 5, cz + D / 2 - 1.6, W - 24, 6, 2.4, '#ff8a2a', { em: 8 });
      g.box(0, 31, cz - 2, W + 4, 3, D + 2, '#8a7a70', { layer: LAYER.slab, rough: 0.7 });
      emit({ x: wx, y: wy + 9, z: wz + cz + D / 2 - 1, kind: 'flame', color: '#ffb35c', rate: 10 });
      break;
    case 'bed':
      g.box(0, 5, cz, W, 6, D, shadeCol(w, -0.15), wo);
      g.box(0, 9.5, cz + 2, W - 4, 4, D - 8, '#f2ece0', { rough: 0.95 });
      g.box(0, 11, cz + D * 0.16, W - 3, 3.4, D * 0.6, '#a8344a', { layer: LAYER.carpet, rough: 0.95 });
      g.box(-W / 4, 12.6, cz - D / 2 + 9, W / 2 - 8, 3.4, 10, '#ffffff', { rough: 0.95 });
      g.box(W / 4, 12.6, cz - D / 2 + 9, W / 2 - 8, 3.4, 10, '#ffffff', { rough: 0.95 });
      g.box(0, 13, cz - D / 2 + 1.5, W, 22, 3, shadeCol(w, -0.3), wo);
      break;
    case 'trophy':
      g.box(0, 8, cz, 18, 16, 18, '#4a3a5a', { layer: LAYER.marble, rough: 0.5 });
      g.cyl(0, 19, cz, 3, 5, 6, '#ffd166', { metal: 1, rough: 0.2 }, 10);
      g.cyl(0, 26, cz, 6.5, 3.4, 9, '#ffd166', { metal: 1, rough: 0.2, em: 0.25 }, 12);
      for (const sx of [-1, 1]) g.torus(sx * 7, 26, cz, 2.6, 0.7, '#ffd166', { metal: 1, rough: 0.2 });
      break;
    case 'rack':
      for (const sx of [-1, 1]) g.box(sx * (W / 2 - 3), 16, cz, 3, 32, 4, shadeCol(w, -0.2), wo);
      g.box(0, 28, cz, W, 3, 4, w, wo);
      g.box(0, 10, cz, W, 3, 4, w, wo);
      break;
    case 'mannequin':
      g.cyl(0, 2, cz, 7, 8, 4, shadeCol(w, -0.2), wo, 10);
      g.cyl(0, 12, cz, 1.2, 1.2, 18, shadeCol(w, -0.3), wo, 6);
      g.sphere(0, 25, cz, 6.4, 8, 4.4, '#b5895a', { rough: 0.9 }, 10);
      g.sphere(0, 36, cz, 4.6, 5, 4.6, '#b5895a', { rough: 0.9 }, 10);
      break;
    case 'rug':
      g.box(0, 0.5, cz, W, 1, D, '#8a2f45', { layer: LAYER.carpet, rough: 0.98 });
      g.box(0, 0.7, cz, W - 8, 1, D - 8, '#b84a5c', { layer: LAYER.carpet, rough: 0.98 });
      break;
    case 'plant':
      g.cyl(0, 6, cz, 7, 5, 12, '#a85a3a', { layer: LAYER.plaster, rough: 0.8 }, 10);
      for (let i = 0; i < 5; i++) g.sphere(Math.cos(i * 1.3) * 5, 17 + (i % 2) * 5, cz + Math.sin(i * 1.3) * 5, 5.4, 6.4, 5.4, shadeCol('#3f9a4a', (i % 3) * 0.08), { layer: LAYER.grass, rough: 0.8, wind: 0.2 }, 8);
      break;
    case 'lantern':
      g.cyl(0, 2, cz, 5, 6, 4, '#3a3a44', { metal: 0.7, rough: 0.4 }, 8);
      g.cyl(0, 18, cz, 1, 1, 30, '#3a3a44', { metal: 0.7, rough: 0.4 }, 6);
      g.ico(0, 37, cz, 6, 8, 6, '#ffe2a0', { em: 6, rough: 0.2 }, 0);
      break;
    case 'bookshelf':
      g.box(0, 22, cz - 1, W, 44, D - 4, shadeCol(w, -0.2), wo);
      for (let r = 0; r < 4; r++) {
        for (let i = 0; i < 9; i++) {
          const bc = ['#a8344a', '#3f6fb8', '#5a8a4a', '#c9a23a', '#6a4a8a', '#8a5a3a'][(i + r * 2) % 6];
          g.box(-W / 2 + 6 + i * ((W - 12) / 8), 6 + r * 10.4, cz + D / 2 - 3.6, (W - 12) / 9.5, 7.4 + ((i * 7 + r) % 3) * 0.8, 3, bc, { rough: 0.8 });
        }
      }
      break;
    case 'table':
      g.box(0, 12, cz, W, 2.6, D, w, wo);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) g.box(x * (W / 2 - 3), 5.5, cz + z * (D / 2 - 3), 2.6, 11, 2.6, shadeCol(w, -0.25), wo);
      g.cyl(-8, 15, cz, 2.6, 2, 3.4, '#d8c8a0', { rough: 0.5 }, 8);
      g.cyl(8, 14, cz + 2, 4.5, 4.5, 0.8, '#e8e0d0', { rough: 0.4 }, 12);
      break;
    case 'chair':
      g.box(0, 8, cz, 14, 2, 14, w, wo);
      g.box(0, 17, cz - 6, 14, 16, 2, shadeCol(w, -0.1), wo);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) g.box(x * 5.6, 4, cz + z * 5.6, 2, 8, 2, shadeCol(w, -0.25), wo);
      break;
    default:
      g.push(0, 0, cz);
      banner(g, '#3f6fb8');
      g.pop();
  }
}

// ---------------------------------------------------------------------------------- layer

export class PropLayer {
  readonly group = new THREE.Group();
  readonly emitters: Emitter[] = [];
  private live: Live[] = [];
  private pools: THREE.InstancedMesh | null = null;
  private poolAlways: THREE.InstancedMesh | null = null;
  private poolMat: THREE.MeshBasicMaterial | null = null;
  private poolAlwaysMat: THREE.MeshBasicMaterial | null = null;
  private mats: THREE.Material[] = [];
  private texs: THREE.Texture[] = [];

  constructor(private f: TerrainField, private q: Quality) {
    const m = f.map;
    const regions = new Map<string, Geo>();
    const geoFor = (x: number, z: number): Geo => {
      const k = `${Math.floor(x / (16 * T))},${Math.floor(z / (16 * T))}`;
      let g = regions.get(k);
      if (!g) {
        g = new Geo();
        regions.set(k, g);
      }
      return g;
    };
    const emit = (e: Emitter): void => {
      this.emitters.push(e);
    };
    const lights: { x: number; y: number; z: number; r: number; color: THREE.Color; always: boolean }[] = [];
    for (const p of m.props) {
      if (p.hidden || p.hidden3d || p.kind === 'tree' || p.kind === 'rock' || p.kind === 'bush') continue;
      const d = p.data ?? {};
      const gy = f.groundY(p.x, p.y - 4);
      let handled = true;
      const g = geoFor(p.x, p.y);
      const seedYaw = (hash2(p.id, 7, 3) - 0.5) * 0.3;
      switch (p.kind) {
        case 'lamp':
          g.push(p.x, gy, p.y - 8, 0, seedYaw, 0);
          lamp(g, m.realm);
          g.pop();
          break;
        case 'torch': {
          const wall = m.sol(Math.floor(p.x / T), Math.floor((p.y - 6) / T)) === SOL.WALL;
          const c = p.light?.color ?? '#ffae5c';
          g.push(p.x, gy, wall ? p.y + 0.5 : p.y);
          torch(g, wall, c);
          g.pop();
          emit({ x: p.x, y: gy + (wall ? 33 : 36), z: wall ? p.y + 5.5 : p.y, kind: 'flame', color: c, rate: 9 });
          break;
        }
        case 'gate':
        case 'abyssgate': {
          const abyss = p.kind === 'abyssgate';
          g.push(p.x, gy, p.y - 14);
          gateFrame(g, m.realm, abyss);
          g.pop();
          const mat = new THREE.ShaderMaterial({
            vertexShader: UV_VERT, fragmentShader: PORTAL_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
            uniforms: { uTime: shared.time, uCol: { value: col(abyss ? '#a970ff' : '#7fe9ff').clone() }, uCol2: { value: col(abyss ? '#3a1466' : '#1f5fd6').clone() } },
          });
          const disc = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat);
          disc.position.set(p.x, gy + 48, p.y - 14);
          disc.renderOrder = 3;
          this.group.add(disc);
          this.mats.push(mat);
          emit({ x: p.x, y: gy + 48, z: p.y - 12, kind: 'portal', color: abyss ? '#c9a8ff' : '#bff3ff', rate: 7 });
          break;
        }
        case 'crystal': {
          const cg = new Geo();
          cg.ico(0, 0, 0, 9, 17, 9, '#9ff5ff', { em: 4.5, rough: 0.08, metal: 0.3 }, 0);
          const mesh = meshOf(cg);
          mesh.position.set(p.x, gy + 40, p.y - 6);
          this.group.add(mesh);
          this.live.push({ obj: mesh, kind: 'crystal', seed: p.id, baseY: gy + 40 });
          g.cyl(p.x, gy + 3, p.y - 6, 9, 12, 6, '#8fa8c8', { layer: LAYER.marble, rough: 0.5 }, 8);
          emit({ x: p.x, y: gy + 40, z: p.y - 6, kind: 'spark', color: '#bff3ff', rate: 4 });
          break;
        }
        case 'dungeon':
          g.push(p.x, gy, p.y - 40);
          dungeonGate(g, m.realm);
          g.pop();
          break;
        case 'building':
          g.push(p.x, gy, p.y);
          building(g, m.realm, d, emit, p.x, gy, p.y);
          g.pop();
          break;
        case 'stairs':
          g.push(p.x, gy, p.y - 4);
          dungeonStairs(g, m.realm);
          g.pop();
          break;
        case 'fountain': {
          g.push(p.x, gy, p.y - 30);
          fountain(g, m.realm);
          g.pop();
          const mat = new THREE.ShaderMaterial({ vertexShader: UV_VERT, fragmentShader: WATER_DISC_FRAG, transparent: true, depthWrite: false, uniforms: { uTime: shared.time, uCol: { value: col(m.realm === 1 ? '#3fc8d8' : '#5fb4f0').clone() } } });
          const disc = new THREE.Mesh(new THREE.PlaneGeometry(66, 66).rotateX(-PI / 2), mat);
          disc.position.set(p.x, gy + 7.2, p.y - 30);
          this.group.add(disc);
          this.mats.push(mat);
          emit({ x: p.x, y: gy + 42, z: p.y - 30, kind: 'fountain', color: '#dff6ff', rate: 26 });
          break;
        }
        case 'statue':
          g.push(p.x, gy, p.y - 12, 0, 0, 0);
          statue(g, m.realm, !!d.hero);
          g.pop();
          break;
        case 'bench':
          g.push(p.x, gy, p.y - 12);
          bench(g, m.realm);
          g.pop();
          break;
        case 'crate':
          g.push(p.x, gy, p.y - 14);
          crate(g, m.realm, Number(d.v ?? 0));
          g.pop();
          break;
        case 'stall':
          g.push(p.x, gy, p.y - 14);
          stall(g, m.realm, String(d.color ?? '#b8483e'));
          g.pop();
          break;
        case 'banner':
          g.push(p.x, gy, p.y - 12);
          banner(g, String(d.color ?? '#3f6fb8'));
          g.pop();
          break;
        case 'well':
          g.push(p.x, gy, p.y - 14);
          well(g, m.realm);
          g.pop();
          break;
        case 'sign':
          g.push(p.x, gy, p.y - 10, 0, seedYaw, 0);
          sign(g, m.realm);
          g.pop();
          break;
        case 'pillar':
          g.push(p.x, gy, p.y - 12);
          pillar(g, m.realm);
          g.pop();
          break;
        case 'furniture': {
          const kind = String(d.kind);
          const fw = Math.max(1, Math.round((p.sw - 8) / T));
          const tall = kind === 'rug' ? 0 : kind === 'bookshelf' || kind === 'mannequin' || kind === 'rack' ? 56 : kind === 'trophy' || kind === 'lantern' ? 46 : 26;
          const fh = Math.max(1, Math.round((p.sh - tall) / T));
          g.push(p.x, gy, p.y + 2);
          furniture(g, kind, m.realm, fw, fh, emit, p.x, gy, p.y + 2);
          g.pop();
          break;
        }
        default:
          handled = false;
      }
      if (!handled) this.billboard(p, gy);
      if (p.light) {
        const always = p.kind === 'gate' || p.kind === 'abyssgate' || p.kind === 'crystal' || p.kind === 'dungeon' || p.kind === 'torch' || p.kind === 'furniture';
        lights.push({ x: p.x, y: gy + 0.35, z: p.y - (p.kind === 'torch' ? -10 : 6), r: p.light.r, color: col(p.light.color), always });
      }
    }
    for (const g of regions.values()) {
      if (g.empty) continue;
      const mesh = meshOf(g, undefined, q.propShadows, true);
      this.group.add(mesh);
    }
    this.buildPools(lights);
  }

  /** props without a 3D model stand as lit cut-outs of their original sprite */
  private billboard(p: Prop, gy: number): void {
    const spr = propSprite(p, this.f.map.realm);
    const tex = canvasTexture(spr);
    this.texs.push(tex);
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 });
    this.mats.push(mat);
    const k = 1.22;
    const geom = new THREE.PlaneGeometry(p.sw, p.sh * k);
    geom.translate(p.sw / 2 - p.ax, (p.sh / 2 - (p.sh - p.ay)) * k, 0);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(p.x, gy, p.y);
    mesh.rotation.x = -0.42;
    mesh.castShadow = this.q.propShadows;
    mesh.receiveShadow = false;
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.35 });
    this.group.add(mesh);
  }

  private buildPools(lights: { x: number; y: number; z: number; r: number; color: THREE.Color; always: boolean }[]): void {
    if (!lights.length) return;
    const tex = radialTexture(128, 1.7);
    this.texs.push(tex);
    const quad = new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2);
    const mk = (list: typeof lights): [THREE.InstancedMesh, THREE.MeshBasicMaterial] | null => {
      if (!list.length) return null;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, opacity: 0 });
      const im = new THREE.InstancedMesh(quad, mat, list.length);
      const mtx = new THREE.Matrix4();
      list.forEach((l, i) => {
        const s = l.r * 2.5;
        mtx.makeScale(s, 1, s).setPosition(l.x, l.y, l.z);
        im.setMatrixAt(i, mtx);
        im.setColorAt(i, l.color);
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.renderOrder = 1;
      im.frustumCulled = false;
      this.group.add(im);
      this.mats.push(mat);
      return [im, mat];
    };
    const a = mk(lights.filter((l) => !l.always));
    if (a) [this.pools, this.poolMat] = a;
    const b = mk(lights.filter((l) => l.always));
    if (b) [this.poolAlways, this.poolAlwaysMat] = b;
  }

  update(dt: number, env: Environment): void {
    void dt;
    const t = shared.time.value;
    shared.lamp.value = env.night;
    if (this.poolMat) this.poolMat.opacity = env.night * 0.42;
    if (this.poolAlwaysMat) this.poolAlwaysMat.opacity = (0.14 + env.night * 0.3) * (env.indoor ? 0.55 : 1) * (0.92 + 0.08 * Math.sin(t * 9));
    for (const l of this.live) {
      if (l.kind === 'crystal') {
        l.obj.position.y = l.baseY + Math.sin(t * 2.2 + l.seed) * 3;
        l.obj.rotation.y = t * 0.9 + l.seed;
      }
    }
  }

  dispose(): void {
    for (const m of this.mats) m.dispose();
    for (const t of this.texs) t.dispose();
    this.pools?.dispose();
    this.poolAlways?.dispose();
  }
}

export { WALL_H3 };
