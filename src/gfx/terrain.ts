// 3D terrain: the tile map becomes a continuous height field (plateaus with rock slopes, carved
// river beds, mountain borders, floating-island edges), shaded by a splat material that blends
// procedural PBR layers per tile type. Architectural walls and timber decks are separate meshes.
import * as THREE from 'three';
import type { GameMap } from '../world/tilemap';
import { ELEV, GT, SOL } from '../world/tilemap';
import { REALMS } from '../data/realms';
import { TILE } from '../data/constants';
import { fbm, hash2 } from '../engine/util';
import { LAYER, type DetailLib } from './textures';
import { BED_DEPTH, Geo, PLATEAU_H, WALL_H3, WATER_Y, col, colMix, meshOf, shadeCol, shared } from './util3';

const T = TILE;
const SUB = 4;

function smooth01(v: number): number {
  const t = v < 0 ? 0 : v > 1 ? 1 : v;
  return t * t * (3 - 2 * t);
}

/** CPU-side description of the terrain surface, shared by the mesh builder and actor placement */
export class TerrainField {
  readonly w: number;
  readonly h: number;
  readonly plat: Uint8Array;
  readonly stairs: Uint8Array;
  readonly rock: Uint8Array;
  readonly liquid: Uint8Array;
  readonly shallow: Uint8Array;
  readonly voidM: Uint8Array;
  readonly wall: Uint8Array;
  readonly deck: Uint8Array;
  private rockH: Float32Array;
  readonly liquidKind: 'water' | 'lava' | 'void';
  readonly hasLiquid: boolean;

  constructor(readonly map: GameMap) {
    const { w, h } = map;
    this.w = w;
    this.h = h;
    const n = w * h;
    this.plat = new Uint8Array(n);
    this.stairs = new Uint8Array(n);
    this.rock = new Uint8Array(n);
    this.liquid = new Uint8Array(n);
    this.shallow = new Uint8Array(n);
    this.voidM = new Uint8Array(n);
    this.wall = new Uint8Array(n);
    this.deck = new Uint8Array(n);
    this.rockH = new Float32Array(n);
    this.liquidKind = REALMS[map.realm].palette.liquid;
    const cliff = map.wallStyle === 'cliff';
    let any = false;
    for (let i = 0; i < n; i++) {
      const g = map.ground[i];
      const s = map.solid[i];
      if (map.hasElev && map.elev[i] === ELEV.PLATEAU) this.plat[i] = 1;
      if (map.hasElev && map.elev[i] === ELEV.STAIRS) this.stairs[i] = 1;
      if (s === SOL.WALL) {
        this.wall[i] = 1;
        if (cliff) this.rock[i] = 1;
      }
      if (g === GT.LIQUID || g === GT.VOID) {
        if (this.liquidKind === 'void' || s === SOL.VOID) this.voidM[i] = 1;
        else this.liquid[i] = 1;
        any = true;
      }
      if (g === GT.SHALLOW) this.shallow[i] = 1;
    }
    // decks and bridges standing over liquid: the bed continues underneath them
    const isDeck = (i: number): boolean => map.ground[i] === GT.BRIDGE || map.ground[i] === GT.WOOD;
    for (let pass = 0; pass < 4; pass++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (!isDeck(i) || this.deck[i]) continue;
          let touch = false;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (this.liquid[j] && !isDeck(j)) touch = true;
            if (this.voidM[j] && !isDeck(j)) touch = true;
            if (this.deck[j]) touch = true;
          }
          if (touch) this.deck[i] = 1;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      if (!this.deck[i]) continue;
      if (this.liquidKind === 'void') this.voidM[i] = 1;
      else this.liquid[i] = 1;
    }
    this.hasLiquid = any;
    // mountain heights grow with distance into the wall mass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!this.rock[i]) continue;
        const d = map.wdepth[i];
        const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
        this.rockH[i] = 30 + d * 9 + (edge < 2 ? 34 - edge * 8 : 0) + fbm(x * 0.21, y * 0.21, 77 + map.realm) * 26;
      }
    }
  }

  private get(mask: Uint8Array, tx: number, ty: number, outside: number): number {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return outside;
    return mask[ty * this.w + tx];
  }

  /** signed distance (world units, clamped to one tile) to the union of masked tiles; negative inside */
  sdf(mask: Uint8Array, px: number, pz: number, outside = 0): number {
    const tx = Math.floor(px / T);
    const ty = Math.floor(pz / T);
    const inside = this.get(mask, tx, ty, outside);
    let d = T;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (this.get(mask, tx + dx, ty + dy, outside) === inside) continue;
        const x0 = (tx + dx) * T;
        const y0 = (ty + dy) * T;
        const ex = px < x0 ? x0 - px : px > x0 + T ? px - x0 - T : 0;
        const ey = pz < y0 ? y0 - pz : pz > y0 + T ? pz - y0 - T : 0;
        const dd = Math.hypot(ex, ey);
        if (dd < d) d = dd;
      }
    }
    return inside ? -d : d;
  }

  private rockHeight(px: number, pz: number): number {
    const fx = px / T - 0.5;
    const fy = pz / T - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const ax = fx - x0;
    const ay = fy - y0;
    const g = (x: number, y: number): number => {
      const cx = x < 0 ? 0 : x >= this.w ? this.w - 1 : x;
      const cy = y < 0 ? 0 : y >= this.h ? this.h - 1 : y;
      const v = this.rockH[cy * this.w + cx];
      return v > 0 ? v : 34;
    };
    const top = g(x0, y0) * (1 - ax) + g(x0 + 1, y0) * ax;
    const bot = g(x0, y0 + 1) * (1 - ax) + g(x0 + 1, y0 + 1) * ax;
    return top * (1 - ay) + bot * ay;
  }

  /** terrain surface height at a world point */
  height(px: number, pz: number): number {
    let h = 0;
    const wob = Math.abs(fbm(px * 0.045, pz * 0.045, 31) - 0.5) * 5;
    if (this.hasLiquid) {
      const sl = this.sdf(this.liquid, px, pz);
      if (sl < 3) h = -BED_DEPTH * smooth01((3 - sl) / 18);
      const sv = this.sdf(this.voidM, px, pz);
      if (sv < 2) h = Math.min(h, -260 * smooth01((2 - sv - wob * 0.4) / 26));
    }
    if (this.map.ground.length) {
      const ss = this.sdf(this.shallow, px, pz);
      if (ss < 4) h = Math.min(h, -4.4 * smooth01((4 - ss) / 9));
    }
    if (this.map.hasElev) {
      const sp = this.sdf(this.plat, px, pz) - wob * 0.5;
      let hp = 0;
      if (sp < 7) hp = PLATEAU_H * (sp <= 0 ? 1 : smooth01(1 - sp / 7));
      const tx = Math.floor(px / T);
      const ty = Math.floor(pz / T);
      if (this.get(this.stairs, tx, ty, 0)) {
        const fz = pz / T - ty;
        hp = Math.max(hp, PLATEAU_H * (1 - fz));
      } else {
        for (const dx of [-1, 1]) {
          if (!this.get(this.stairs, tx + dx, ty, 0)) continue;
          const x0 = (tx + dx) * T;
          const ex = px < x0 ? x0 - px : px - x0 - T;
          if (ex < 5) hp = Math.max(hp, PLATEAU_H * (1 - (pz / T - ty)) * smooth01(1 - ex / 5));
        }
      }
      h = Math.max(h, hp);
    }
    if (this.map.wallStyle === 'cliff') {
      const sr = this.sdf(this.rock, px, pz, 1) - wob * 0.4;
      if (sr < 4) {
        const hr = this.rockHeight(px, pz) * smooth01((4 - sr) / 13);
        h = Math.max(h, h + hr);
      }
    }
    return h;
  }

  /** render height of an actor standing at a world position (plateau tier, stairs, shallows) */
  groundY(x: number, y: number): number {
    const m = this.map;
    let base = m.hasElev ? m.liftAt(x, y) * PLATEAU_H : 0;
    const tx = Math.floor(x / T);
    const ty = Math.floor(y / T);
    if (tx >= 0 && ty >= 0 && tx < this.w && ty < this.h && this.shallow[ty * this.w + tx]) {
      const ss = this.sdf(this.shallow, x, y);
      base += -3.4 * smooth01((2 - ss) / 8);
    }
    return base;
  }
}

// ---------------------------------------------------------------------------------- data textures

export interface TerrainTextures {
  tiles: THREE.DataTexture;
  /** signed distance to liquid at 4 texels per tile: 0.5 = shoreline, <0.5 inside the liquid */
  shore: THREE.DataTexture;
}

export function buildTerrainTextures(f: TerrainField): TerrainTextures {
  const m = f.map;
  const n = m.w * m.h;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = i % m.w;
    const y = (i - x) / m.w;
    let flags = 0;
    if (f.plat[i]) flags |= 1;
    if (f.stairs[i]) flags |= 2;
    if (f.rock[i]) flags |= 4;
    if (f.liquid[i]) flags |= 8;
    if (f.voidM[i]) flags |= 16;
    if (f.wall[i]) flags |= 32;
    if (f.deck[i]) flags |= 64;
    data[i * 4] = m.ground[i];
    data[i * 4 + 1] = flags;
    data[i * 4 + 2] = Math.min(255, m.wdepth[i] * 80);
    data[i * 4 + 3] = Math.floor(hash2(x, y, 5) * 255);
  }
  const tiles = new THREE.DataTexture(data, m.w, m.h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tiles.magFilter = tiles.minFilter = THREE.NearestFilter;
  tiles.colorSpace = THREE.NoColorSpace;
  tiles.needsUpdate = true;
  const sw = m.w * 4;
  const sh = m.h * 4;
  const sd = new Uint8Array(sw * sh);
  const both = new Uint8Array(n);
  for (let i = 0; i < n; i++) both[i] = f.liquid[i] || f.voidM[i] ? 1 : 0;
  if (f.hasLiquid) {
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const d = f.sdf(both, (x + 0.5) * 8, (y + 0.5) * 8);
        sd[y * sw + x] = Math.max(0, Math.min(255, Math.round(127.5 + (d / 32) * 127.5)));
      }
    }
  } else sd.fill(255);
  const shore = new THREE.DataTexture(sd, sw, sh, THREE.RedFormat, THREE.UnsignedByteType);
  shore.magFilter = shore.minFilter = THREE.LinearFilter;
  shore.colorSpace = THREE.NoColorSpace;
  shore.needsUpdate = true;
  return { tiles, shore };
}

// ---------------------------------------------------------------------------------- splat material

const TERRAIN_FRAG_HEAD = /* glsl */ `
precision highp sampler2DArray;
uniform sampler2D uTiles;
uniform sampler2D uShore;
uniform vec2 uMapSize;
uniform sampler2DArray uDetA;
uniform sampler2DArray uDetN;
uniform sampler2D uNoise;
uniform vec3 uTint[18];
uniform vec4 uMat[18];
uniform vec3 uRockTint;
uniform vec3 uBedTint;
uniform float uWaterY;
uniform float uTime;
uniform float uCaustic;
uniform float uWet;
uniform float uLava;
varying vec3 vWp;
varying vec3 vWn;
struct MS { vec3 alb; float h; vec2 n; float rough; float ao; };
vec3 tNormal = vec3(0.0, 1.0, 0.0);
float tRough = 1.0;
vec3 tEmissive = vec3(0.0);
vec4 tileAt(vec2 t) { return texelFetch(uTiles, ivec2(clamp(t, vec2(0.0), uMapSize - 1.0)), 0); }
MS matSample(int ty, vec2 xz) {
  vec4 m = uMat[ty];
  vec2 uv = xz * m.y;
  vec4 a = texture(uDetA, vec3(uv, m.x));
  vec4 nn = texture(uDetN, vec3(uv, m.x));
  MS s;
  s.alb = uTint[ty] * a.rgb * 2.0;
  s.h = a.a * 0.5 + m.w;
  s.n = nn.rg * 2.0 - 1.0;
  s.rough = nn.b * m.z;
  s.ao = nn.a;
  return s;
}
`;

const TERRAIN_FRAG_MAP = /* glsl */ `
#include <map_fragment>
{
  vec3 gn = normalize(vWn);
  vec2 xz = vWp.xz;
  vec4 macro = texture(uNoise, xz / 760.0);
  vec2 warp = (texture(uNoise, xz / 210.0).rg - 0.5) * 18.0;
  vec2 tc = (xz + warp) / 32.0 - 0.5;
  vec2 bb = floor(tc);
  vec2 ff = smoothstep(0.0, 1.0, fract(tc));
  float w0 = (1.0 - ff.x) * (1.0 - ff.y);
  float w1 = ff.x * (1.0 - ff.y);
  float w2 = (1.0 - ff.x) * ff.y;
  float w3 = ff.x * ff.y;
  vec4 d0 = tileAt(bb);
  vec4 d1 = tileAt(bb + vec2(1.0, 0.0));
  vec4 d2 = tileAt(bb + vec2(0.0, 1.0));
  vec4 d3 = tileAt(bb + vec2(1.0, 1.0));
  int t0 = int(d0.r * 255.0 + 0.5);
  int t1 = int(d1.r * 255.0 + 0.5);
  int t2 = int(d2.r * 255.0 + 0.5);
  int t3 = int(d3.r * 255.0 + 0.5);
  float wallW = step(0.12, d0.g) * 0.0;
  {
    int f0 = int(d0.g * 255.0 + 0.5); int f1 = int(d1.g * 255.0 + 0.5); int f2 = int(d2.g * 255.0 + 0.5); int f3 = int(d3.g * 255.0 + 0.5);
    wallW = float((f0 / 32) % 2) * w0 + float((f1 / 32) % 2) * w1 + float((f2 / 32) % 2) * w2 + float((f3 / 32) % 2) * w3;
  }
  if (t1 == t0) { w0 += w1; w1 = 0.0; }
  if (t2 == t0) { w0 += w2; w2 = 0.0; } else if (t2 == t1) { w1 += w2; w2 = 0.0; }
  if (t3 == t0) { w0 += w3; w3 = 0.0; } else if (t3 == t1) { w1 += w3; w3 = 0.0; } else if (t3 == t2) { w2 += w3; w3 = 0.0; }
  MS s0 = MS(vec3(0.0), 0.0, vec2(0.0), 1.0, 1.0);
  MS s1 = s0; MS s2 = s0; MS s3 = s0;
  float h0 = -9.0; float h1 = -9.0; float h2 = -9.0; float h3 = -9.0;
  if (w0 > 0.002) { s0 = matSample(t0, xz); h0 = s0.h + w0; }
  if (w1 > 0.002) { s1 = matSample(t1, xz); h1 = s1.h + w1; }
  if (w2 > 0.002) { s2 = matSample(t2, xz); h2 = s2.h + w2; }
  if (w3 > 0.002) { s3 = matSample(t3, xz); h3 = s3.h + w3; }
  float ma = max(max(h0, h1), max(h2, h3)) - 0.16;
  float b0 = max(h0 - ma, 0.0); float b1 = max(h1 - ma, 0.0); float b2 = max(h2 - ma, 0.0); float b3 = max(h3 - ma, 0.0);
  float bs = 1.0 / (b0 + b1 + b2 + b3);
  vec3 alb = (s0.alb * b0 + s1.alb * b1 + s2.alb * b2 + s3.alb * b3) * bs;
  vec2 dn = (s0.n * b0 + s1.n * b1 + s2.n * b2 + s3.n * b3) * bs;
  float rough = (s0.rough * b0 + s1.rough * b1 + s2.rough * b2 + s3.rough * b3) * bs;
  float ao = (s0.ao * b0 + s1.ao * b1 + s2.ao * b2 + s3.ao * b3) * bs;
  alb *= 0.86 + 0.28 * macro.g;
  // rock on steep slopes and mountain crowns (triplanar)
  int cf = int(tileAt(floor(xz / 32.0)).g * 255.0 + 0.5);
  float isRockTile = float((cf / 4) % 2);
  float steep = smoothstep(0.9, 0.66, gn.y);
  float crown = isRockTile * smoothstep(8.0, 26.0, vWp.y) * smoothstep(0.42, 0.62, macro.r + texture(uNoise, xz / 90.0).g * 0.35);
  float rockAmt = clamp(max(steep, crown * 0.85), 0.0, 1.0);
  if (vWp.y < -30.0) rockAmt = 1.0;
  if (rockAmt > 0.01) {
    vec3 an = pow(abs(gn), vec3(5.0));
    an /= (an.x + an.y + an.z);
    float rs = 1.0 / 110.0;
    vec4 ra = texture(uDetA, vec3(vWp.zy * rs, ${LAYER.rock}.0)) * an.x + texture(uDetA, vec3(vWp.xz * rs, ${LAYER.rock}.0)) * an.y + texture(uDetA, vec3(vWp.xy * rs, ${LAYER.rock}.0)) * an.z;
    vec4 rn = texture(uDetN, vec3(vWp.xz * rs + vWp.y * rs, ${LAYER.rock}.0));
    vec3 ralb = uRockTint * ra.rgb * 2.0 * (0.8 + 0.4 * macro.b);
    ralb *= mix(0.72, 1.05, smoothstep(-6.0, 40.0, vWp.y));
    alb = mix(alb, ralb, rockAmt);
    dn = mix(dn, (rn.rg * 2.0 - 1.0) * 1.3, rockAmt);
    rough = mix(rough, 0.9, rockAmt);
    ao = mix(ao, rn.a, rockAmt);
  }
  // contact shading at the foot of walls
  alb *= 1.0 - 0.42 * smoothstep(0.18, 0.62, wallW) * (1.0 - isRockTile) * step(vWp.y, 4.0);
  // river bed, wet shoreline and caustics
  float shore = texture(uShore, xz / (uMapSize * 32.0)).r;
  float under = smoothstep(uWaterY + 0.8, uWaterY - 2.0, vWp.y);
  if (uWaterY > -900.0) {
    float wetBand = smoothstep(uWaterY + 3.6, uWaterY + 0.4, vWp.y) * smoothstep(0.75, 0.55, shore);
    alb = mix(alb, uBedTint * (0.75 + 0.5 * macro.g), under);
    alb *= 1.0 - 0.38 * wetBand * (1.0 - under);
    rough = mix(rough, 0.22, wetBand);
    if (uCaustic > 0.0 && under > 0.0) {
      vec2 cuv = xz * 0.03;
      float c1 = texture(uNoise, cuv + vec2(uTime * 0.035, uTime * 0.02)).b;
      float c2 = texture(uNoise, cuv * 1.4 - vec2(uTime * 0.03, -uTime * 0.025)).b;
      float ca = pow(clamp(c1 * c2 * 2.6, 0.0, 1.0), 2.4);
      alb += vec3(0.75, 0.95, 1.0) * ca * 0.55 * under * uCaustic;
    }
    if (uLava > 0.0) {
      float glow = smoothstep(uWaterY + 9.0, uWaterY - 1.0, vWp.y) * smoothstep(0.82, 0.5, shore);
      tEmissive += vec3(1.0, 0.28, 0.05) * glow * 1.6 * (0.7 + 0.3 * sin(uTime * 1.7 + xz.x * 0.05));
      alb = mix(alb, vec3(0.05, 0.03, 0.03), glow * 0.6);
    }
  }
  // rain soaks everything
  alb *= 1.0 - 0.22 * uWet;
  rough = mix(rough, rough * 0.45, uWet);
  alb *= mix(0.66, 1.0, ao);
  diffuseColor.rgb = alb;
  tRough = clamp(rough, 0.05, 1.0);
  float flat01 = smoothstep(0.3, 0.75, gn.y);
  tNormal = normalize(gn - vec3(dn.x, 0.0, dn.y) * mix(0.55, 0.95, flat01));
}
`;

const TERRAIN_VERT_HEAD = /* glsl */ `
varying vec3 vWp;
varying vec3 vWn;
`;

export interface TerrainUniforms {
  [k: string]: { value: unknown };
}

export function makeTerrainMaterial(f: TerrainField, tex: TerrainTextures, lib: DetailLib): THREE.MeshStandardMaterial & { tu: TerrainUniforms } {
  const m = f.map;
  const P = REALMS[m.realm].palette;
  const tint: THREE.Color[] = [];
  const mat: THREE.Vector4[] = [];
  const set = (type: number, layer: number, c: THREE.Color | string, period: number, rough = 1, prio = 0): void => {
    tint[type] = (typeof c === 'string' ? col(c) : c).clone();
    mat[type] = new THREE.Vector4(layer, 1 / period, rough, prio);
  };
  const realm = m.realm;
  const natural = realm === 2 ? LAYER.dirt : realm === 3 ? LAYER.snow : LAYER.grass;
  const bed = f.liquidKind === 'lava' ? col('#2a1a18') : f.liquidKind === 'void' ? col(P.cliffFace) : colMix(P.sand, '#5d6a58', 0.45);
  for (let i = 0; i < 18; i++) set(i, LAYER.dirt, P.dirt, 80);
  set(GT.VOID, LAYER.rock, P.cliffFace, 110, 1, -0.1);
  // flat-shaded palette greens read neon under physically based light: settle them toward meadow tones
  const meadow = (c: string): THREE.Color => (realm === 2 || realm === 3 ? col(c).clone() : col(c).clone().lerp(new THREE.Color(0.2, 0.3, 0.1), 0.2).multiplyScalar(0.86));
  set(GT.GRASS, natural, meadow(P.grass), 104, 1, 0.07);
  set(GT.GRASS2, natural, meadow(P.grass2), 104, 1, 0.07);
  set(GT.FLOWERS, natural, meadow(P.grass).lerp(meadow(P.grass2), 0.5), 104, 1, 0.07);
  set(GT.DIRT, LAYER.dirt, P.dirt, 84, 1, 0);
  set(GT.PATH, LAYER.cobble, P.path, 72, 1, -0.05);
  set(GT.PLAZA, LAYER.slab, P.plaza, 64, 1, -0.05);
  set(GT.WOOD, LAYER.dirt, shadeCol(P.dirt, -0.25), 84, 1, -0.1);
  set(GT.SAND, LAYER.sand, P.sand, 96, 1, 0.02);
  set(GT.LIQUID, LAYER.sand, bed, 96, 1, -0.12);
  set(GT.FLOOR, LAYER.flag, P.floor, 64, 1, 0);
  set(GT.FLOOR2, LAYER.flag, P.floor2, 64, 1, 0);
  set(GT.CARPET, LAYER.carpet, '#7a2f45', 64, 1, 0.05);
  set(GT.WOODFLOOR, LAYER.planks, '#9a6a42', 64, 1, 0);
  set(GT.ICE, LAYER.ice, '#bfe2f6', 128, 1, 0);
  set(GT.MARBLE, LAYER.marble, P.plaza, 128, 1, -0.05);
  set(GT.SHALLOW, LAYER.sand, colMix(P.sand, '#5d6a58', 0.3), 96, 1, -0.08);
  set(GT.BRIDGE, LAYER.sand, bed, 96, 1, -0.12);
  const tu: TerrainUniforms = {
    uTiles: { value: tex.tiles },
    uShore: { value: tex.shore },
    uMapSize: { value: new THREE.Vector2(m.w, m.h) },
    uDetA: { value: lib.albedo },
    uDetN: { value: lib.normal },
    uNoise: { value: lib.noise },
    uTint: { value: tint },
    uMat: { value: mat },
    uRockTint: { value: m.wallStyle === 'cliff' || m.hasElev ? col(P.cliffFace).clone() : col(P.rock).clone() },
    uBedTint: { value: bed.clone() },
    uWaterY: { value: f.hasLiquid && f.liquidKind !== 'void' ? WATER_Y : -999 },
    uTime: shared.time,
    uCaustic: { value: f.liquidKind === 'water' ? 1 : 0 },
    uWet: { value: 0 },
    uLava: { value: f.liquidKind === 'lava' ? 1 : 0 },
  };
  const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }) as THREE.MeshStandardMaterial & { tu: TerrainUniforms };
  material.tu = tu;
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, tu);
    sh.vertexShader = TERRAIN_VERT_HEAD + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWn = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = TERRAIN_FRAG_HEAD + sh.fragmentShader
      .replace('#include <map_fragment>', TERRAIN_FRAG_MAP)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = tRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize((viewMatrix * vec4(tNormal, 0.0)).xyz);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += tEmissive;');
  };
  material.customProgramCacheKey = () => 'terrain';
  return material;
}

// ---------------------------------------------------------------------------------- geometry

/** the continuous ground surface, split into frustum-culled chunks of CHUNK x CHUNK tiles */
export function buildGroundGeometry(f: TerrainField, subdiv = SUB): THREE.BufferGeometry[] {
  const m = f.map;
  const nx = m.w * subdiv + 1;
  const nz = m.h * subdiv + 1;
  const step = T / subdiv;
  const hs = new Float32Array(nx * nz);
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) hs[z * nx + x] = f.height(x * step, z * step);
  const CHUNK = 12;
  const deepWall = m.wallStyle !== 'cliff';
  const out: THREE.BufferGeometry[] = [];
  for (let cz = 0; cz < m.h; cz += CHUNK) {
    for (let cx = 0; cx < m.w; cx += CHUNK) {
      const x0 = cx * subdiv;
      const z0 = cz * subdiv;
      const x1 = Math.min(m.w, cx + CHUNK) * subdiv;
      const z1 = Math.min(m.h, cz + CHUNK) * subdiv;
      const w = x1 - x0 + 1;
      const h = z1 - z0 + 1;
      const pos = new Float32Array(w * h * 3);
      const nor = new Float32Array(w * h * 3);
      for (let z = 0; z < h; z++) {
        for (let x = 0; x < w; x++) {
          const gx = x0 + x;
          const gz = z0 + z;
          const i = z * w + x;
          pos[i * 3] = gx * step;
          pos[i * 3 + 1] = hs[gz * nx + gx];
          pos[i * 3 + 2] = gz * step;
          const hl = hs[gz * nx + Math.max(0, gx - 1)];
          const hr = hs[gz * nx + Math.min(nx - 1, gx + 1)];
          const hd = hs[Math.max(0, gz - 1) * nx + gx];
          const hu = hs[Math.min(nz - 1, gz + 1) * nx + gx];
          const ax = (hl - hr) / (2 * step);
          const az = (hd - hu) / (2 * step);
          const l = Math.hypot(ax, 1, az);
          nor[i * 3] = ax / l;
          nor[i * 3 + 1] = 1 / l;
          nor[i * 3 + 2] = az / l;
        }
      }
      const idx: number[] = [];
      for (let z = 0; z < h - 1; z++) {
        for (let x = 0; x < w - 1; x++) {
          const a = z * w + x;
          const b = a + 1;
          const c = a + w;
          const d = c + 1;
          const ha = pos[a * 3 + 1];
          const hb = pos[b * 3 + 1];
          const hc = pos[c * 3 + 1];
          const hd2 = pos[d * 3 + 1];
          if (ha < -200 && hb < -200 && hc < -200 && hd2 < -200) continue;
          if (deepWall) {
            // the floor under solid architectural walls is never visible
            const tx = Math.min(m.w - 1, Math.floor((x0 + x) / subdiv));
            const tz = Math.min(m.h - 1, Math.floor((z0 + z) / subdiv));
            if (f.wall[tz * m.w + tx] && m.wdepth[tz * m.w + tx] >= 2) continue;
          }
          // split along the flatter diagonal
          if (Math.abs(ha - hd2) < Math.abs(hb - hc)) idx.push(a, c, d, a, d, b);
          else idx.push(a, c, b, b, c, d);
        }
      }
      if (!idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setIndex(idx);
      g.computeBoundingSphere();
      g.computeBoundingBox();
      out.push(g);
    }
  }
  return out;
}

/** extruded walls for cities, dungeons, the arena and house interiors */
export function buildWalls(f: TerrainField): THREE.Object3D | null {
  const m = f.map;
  if (m.wallStyle === 'cliff') return null;
  const P = REALMS[m.realm].palette;
  const style = m.wallStyle;
  const H = WALL_H3[style];
  const face = style === 'dungeon' ? col(P.dunFace) : style === 'masonry' ? col(P.wallFace) : col('#d8c4a4');
  const top = style === 'dungeon' ? shadeCol(P.dunFace, -0.5) : style === 'masonry' ? col(P.wallTop) : col('#241a14');
  const layerSide = style === 'interior' ? LAYER.plaster : LAYER.brick;
  const layerTop = style === 'interior' ? LAYER.plaster : style === 'dungeon' ? LAYER.rock : LAYER.slab;
  const pos: number[] = [];
  const nor: number[] = [];
  const colr: number[] = [];
  const props: number[] = [];
  const idx: number[] = [];
  const quad = (p: number[], n: [number, number, number], c: THREE.Color, layer: number, rough: number, shadeBottom = 1): void => {
    const o = pos.length / 3;
    for (let k = 0; k < 4; k++) {
      pos.push(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]);
      nor.push(n[0], n[1], n[2]);
      const sh = p[k * 3 + 1] < 1 ? shadeBottom : 1;
      colr.push(c.r * sh, c.g * sh, c.b * sh);
      props.push(layer, 0, rough, 0);
    }
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  const isWall = (x: number, y: number): boolean => x < 0 || y < 0 || x >= m.w || y >= m.h || m.solid[y * m.w + x] === SOL.WALL;
  const black = new THREE.Color(0.012, 0.014, 0.022);
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      const i = y * m.w + x;
      if (m.solid[i] !== SOL.WALL) continue;
      const depth = m.wdepth[i];
      const x0 = x * T;
      const x1 = x0 + T;
      const z0 = y * T;
      const z1 = z0 + T;
      const hh = H + (style === 'masonry' && (x + y) % 2 === 0 && depth <= 1 ? 5 : 0);
      const tc = style !== 'masonry' && depth >= 2 ? black : top;
      quad([x0, hh, z1, x1, hh, z1, x1, hh, z0, x0, hh, z0], [0, 1, 0], tc, layerTop, 0.9);
      if (!isWall(x, y + 1)) quad([x0, 0, z1, x1, 0, z1, x1, hh, z1, x0, hh, z1], [0, 0, 1], face, layerSide, 0.85, 0.55);
      if (!isWall(x, y - 1)) quad([x1, 0, z0, x0, 0, z0, x0, hh, z0, x1, hh, z0], [0, 0, -1], face, layerSide, 0.85, 0.55);
      if (!isWall(x + 1, y)) quad([x1, 0, z1, x1, 0, z0, x1, hh, z0, x1, hh, z1], [1, 0, 0], face, layerSide, 0.85, 0.55);
      if (!isWall(x - 1, y)) quad([x0, 0, z0, x0, 0, z1, x0, hh, z1, x0, hh, z0], [-1, 0, 0], face, layerSide, 0.85, 0.55);
      if (hh > H) {
        // battlement merlon sides
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
          if (!isWall(x + dx, y + dy)) continue;
          if (dx === 1) quad([x1, H, z1, x1, H, z0, x1, hh, z0, x1, hh, z1], [1, 0, 0], face, layerSide, 0.85);
          if (dx === -1) quad([x0, H, z0, x0, H, z1, x0, hh, z1, x0, hh, z0], [-1, 0, 0], face, layerSide, 0.85);
          if (dy === 1) quad([x0, H, z1, x1, H, z1, x1, hh, z1, x0, hh, z1], [0, 0, 1], face, layerSide, 0.85);
          if (dy === -1) quad([x1, H, z0, x0, H, z0, x0, hh, z0, x1, hh, z0], [0, 0, -1], face, layerSide, 0.85);
        }
      }
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setAttribute('aProps', new THREE.Float32BufferAttribute(props, 4));
  g.setAttribute('aFx', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3), 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mesh = meshOf(g);
  mesh.name = 'walls';
  return mesh;
}

/** timber decks, piers and rope-railed bridges over liquid */
export function buildDecks(f: TerrainField): THREE.Object3D | null {
  const m = f.map;
  const g = new Geo();
  const wood = m.kind === 'house' ? '#' + colMix(REALMS[m.realm].palette.wood, '#5c4a3c', 0.5).getHexString() : REALMS[m.realm].palette.wood;
  const isDeckTile = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < m.w && y < m.h && (m.ground[y * m.w + x] === GT.BRIDGE || m.ground[y * m.w + x] === GT.WOOD);
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!isDeckTile(x, y)) continue;
      const i = y * m.w + x;
      const over = !!f.deck[i];
      const cx = x * T + T / 2;
      const cz = y * T + T / 2;
      g.box(cx, 0.1, cz, T, 1.8, T, shadeCol(wood, (hash2(x, y, 3) - 0.5) * 0.16), { layer: LAYER.planks, rough: 0.8 });
      if (!over) continue;
      // support posts into the water
      for (const [ox, oz] of [[-13, -13], [13, 13]] as [number, number][]) g.cyl(cx + ox, -6, cz + oz, 1.5, 1.7, 13, shadeCol(wood, -0.35), { layer: LAYER.bark, rough: 0.9 }, 6);
      // rails on edges that face open liquid
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
        if (isDeckTile(x + dx, y + dy)) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
        const j = ny * m.w + nx;
        if (!(f.liquid[j] || f.voidM[j])) continue;
        const ex = cx + dx * (T / 2 - 1.2);
        const ez = cz + dy * (T / 2 - 1.2);
        const along = dx !== 0 ? [0, 1] : [1, 0];
        g.box(ex, 9, ez, dx !== 0 ? 1.4 : T, 1.4, dx !== 0 ? T : 1.4, shadeCol(wood, -0.2), { layer: LAYER.planks, rough: 0.8 });
        g.box(ex, 5, ez, dx !== 0 ? 1 : T, 1, dx !== 0 ? T : 1, shadeCol(wood, -0.3), { rough: 0.85 });
        for (const k of [-0.5, 0.5]) g.box(ex + along[0] * k * (T - 3), 5, ez + along[1] * k * (T - 3), 2.2, 10.5, 2.2, shadeCol(wood, -0.32), { layer: LAYER.bark, rough: 0.9 });
      }
    }
  }
  if (g.empty) return null;
  const mesh = meshOf(g);
  mesh.name = 'decks';
  return mesh;
}
