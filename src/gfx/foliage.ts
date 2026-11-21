// Vegetation: GPU-instanced grass that sways in the wind and parts around actors, wildflowers,
// procedural trees (broadleaf, blossom, bioluminescent, pine, charred, crystal), rocks and bushes.
import * as THREE from 'three';
import type { GameMap } from '../world/tilemap';
import { GT, SOL } from '../world/tilemap';
import { REALMS } from '../data/realms';
import { TILE } from '../data/constants';
import { hash2 } from '../engine/util';
import { LAYER, type DetailLib } from './textures';
import type { Quality } from './quality';
import type { Environment } from './env';
import type { TerrainField } from './terrain';
import { Geo, col, colMix, h1, shadeCol, shared, uber, uberDepth } from './util3';

const T = TILE;
const REGION = 12;
/** sphere tessellation of foliage, set from the quality preset before a map is built */
let SEG = 10;
export const MAX_PUSH = 10;

const GRASSY = new Set<number>([GT.GRASS, GT.GRASS2, GT.FLOWERS]);

// ---------------------------------------------------------------------------------- grass

const GRASS_VERT_HEAD = /* glsl */ `
attribute vec3 aOff;
attribute vec4 aPar;
uniform float uTime;
uniform vec3 uWind;
uniform vec4 uPush[${MAX_PUSH}];
uniform vec3 uFocus;
uniform float uDist;
uniform vec3 uRoot;
uniform vec3 uTip;
uniform vec3 uTip2;
uniform float uWidth;
varying vec3 vGrass;
varying float vBlade;
`;

const GRASS_VERT_BEGIN = /* glsl */ `
vec3 transformed;
{
  float t = position.y;
  float fade = 1.0 - smoothstep(uDist * 0.78, uDist, distance(aOff.xz, uFocus.xz));
  float hgt = aPar.y * fade;
  float cy = cos(aPar.x);
  float sy = sin(aPar.x);
  float ph = aOff.x * 0.027 + aOff.z * 0.023 + uTime * 1.5;
  float gust = sin(ph) * 0.55 + sin(ph * 0.41 + 1.3) * 0.45 + sin(ph * 2.7 + aPar.x) * 0.18;
  vec2 bend = uWind.xz * (0.22 + 0.3 * gust) * hgt * 0.75;
  float squash = 0.0;
  for (int i = 0; i < ${MAX_PUSH}; i++) {
    vec2 d = aOff.xz - uPush[i].xy;
    float l = length(d);
    float k = 1.0 - smoothstep(0.0, uPush[i].z, l);
    bend += (d / max(l, 0.001)) * k * hgt * 0.85;
    squash = max(squash, k * 0.45);
  }
  float curve = t * t;
  float wdt = aPar.z * uWidth * (1.0 - t * 0.82);
  vec3 p = vec3(position.x * wdt * cy, t * hgt * (1.0 - squash), position.x * wdt * sy);
  p.xz += bend * curve;
  p.y -= length(bend) * curve * 0.3;
  transformed = aOff + p;
  vBlade = t;
  vec3 tip = mix(uTip, uTip2, aPar.w);
  vGrass = mix(mix(uRoot, tip, clamp((uWidth - 1.0) * 0.45, 0.0, 0.6)), tip, pow(t, 0.8)) * (0.86 + 0.28 * fract(aPar.x * 3.7));
}
`;

function grassMaterial(P: { grass: string; grass2: string; grassDark: string }, snowy: boolean): THREE.MeshStandardMaterial & { gu: Record<string, { value: unknown }> } {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, side: THREE.DoubleSide }) as THREE.MeshStandardMaterial & { gu: Record<string, { value: unknown }> };
  const push: THREE.Vector4[] = [];
  for (let i = 0; i < MAX_PUSH; i++) push.push(new THREE.Vector4(0, 0, 0.001, 0));
  const gu = {
    uTime: shared.time,
    uWind: shared.wind,
    uPush: { value: push },
    uFocus: { value: new THREE.Vector3() },
    uDist: { value: 600 },
    uWidth: { value: 1 },
    uRoot: { value: snowy ? shadeCol(P.grassDark, -0.1) : colMix(P.grass, P.grassDark, 0.55).multiplyScalar(0.8) },
    uTip: { value: snowy ? col('#f4f8ff').clone() : colMix(P.grass, '#c8de6e', 0.3).multiplyScalar(0.86) },
    uTip2: { value: snowy ? col('#cfe2f4').clone() : colMix(P.grass2, '#e6da7c', 0.36).multiplyScalar(0.88) },
  };
  mat.gu = gu;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, gu);
    sh.vertexShader = GRASS_VERT_HEAD + sh.vertexShader
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', GRASS_VERT_BEGIN);
    sh.fragmentShader = 'varying vec3 vGrass;\nvarying float vBlade;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = vGrass * mix(0.72, 1.0, vBlade);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGrass * vBlade * vBlade * 0.05;');
  };
  mat.customProgramCacheKey = () => 'grass';
  return mat;
}

function bladeGeometry(): THREE.BufferGeometry {
  // a tapered three-segment blade in the XY plane: x in [-0.5, 0.5], y in [0, 1]
  const ys = [0, 0.36, 0.7, 1];
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < ys.length; i++) {
    if (i === ys.length - 1) pos.push(0, ys[i], 0);
    else pos.push(-0.5, ys[i], 0, 0.5, ys[i], 0);
  }
  idx.push(0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------------- tree models

function canopy(g: Geo, cx: number, cy: number, cz: number, r: number, leaf: string, leaf2: string, seed: number, n = 7): void {
  const dark = shadeCol(leaf, -0.3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + h1(i, seed) * 0.8;
    const rr = i === 0 ? 0 : r * (0.45 + h1(i, seed + 1) * 0.3);
    const y = cy + (i === 0 ? r * 0.42 : (h1(i, seed + 2) - 0.45) * r * 0.7);
    const br = r * (i === 0 ? 0.78 : 0.5 + h1(i, seed + 3) * 0.22);
    const cl = col(leaf).clone().lerp(col(leaf2), i === 0 ? 0.55 : h1(i, seed + 4) * 0.5).lerp(dark, y < cy ? 0.45 : 0);
    g.sphere(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr, br, br * 0.86, br, cl, { layer: LAYER.grass, rough: 0.82, wind: 1.6 }, SEG);
  }
}

function buildTree(realm: number, tk: string, v: number): Geo {
  const P = REALMS[realm].palette;
  const g = new Geo();
  const seed = realm * 31 + v * 7 + tk.length;
  const bark = { layer: LAYER.bark, rough: 0.92 };
  if (tk === 'charred') {
    const c = col('#1c1513');
    g.cyl(0, 22, 0, 2.2, 4.2, 44, c, bark, 7);
    const br: [number, number, number, number, number, number][] = [[0, 30, 0, -15, 50, 4], [0, 38, 0, 16, 60, -5], [0, 24, 0, 13, 36, 8], [0, 42, 0, -5, 68, -6], [-15, 50, 4, -22, 58, 2], [16, 60, -5, 21, 70, -2]];
    for (const [ax, ay, az, bx, by, bz] of br) g.limb(ax, ay, az, bx, by, bz, 1.5, c, bark);
    for (let i = 0; i < 7; i++) g.sphere(-14 + h1(i, seed) * 28, 34 + h1(i, seed + 5) * 34, -6 + h1(i, seed + 9) * 12, 1.1, 1.1, 1.1, '#ff7a3d', { em: 5, rough: 0.5 }, 6);
    return g;
  }
  if (tk === 'pine') {
    g.cyl(0, 10, 0, 3, 4.4, 22, P.trunk, bark, 8);
    const snow = realm === 3;
    for (let i = 0; i < 4; i++) {
      const r = 21 - i * 4.4;
      const y = 22 + i * 15;
      g.cone(0, y + 9, 0, r, 26, shadeCol(P.leaf, i * 0.06 - 0.06), { layer: LAYER.grass, rough: 0.85, wind: 0.5 + i * 0.3 }, 9);
      if (snow) g.cone(0, y + 15.5, 0, r * 0.62, 14, '#f4f9ff', { layer: LAYER.snow, rough: 0.5, wind: 0.5 + i * 0.3 }, 9);
    }
    return g;
  }
  if (tk === 'crystal') {
    g.ico(0, 3, 0, 15, 6, 12, shadeCol(P.rock, -0.2), { layer: LAYER.rock, rough: 0.9 }, 1);
    const cols = ['#bfe6ff', '#e0c8ff', '#ffffff'];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + v;
      const hh = 34 + h1(i, seed) * 44;
      const rr = i === 0 ? 0 : 6 + h1(i, seed + 2) * 5;
      const tilt = i === 0 ? 0 : 0.18 + h1(i, seed + 3) * 0.2;
      g.push(Math.cos(a) * rr, 4, Math.sin(a) * rr, Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
      g.cyl(0, hh * 0.42, 0, 3.2, 4.4, hh * 0.84, cols[i % 3], { metal: 0.25, rough: 0.12, em: 0.7 }, 6);
      g.cone(0, hh * 0.84 + 5, 0, 3.2, 10, cols[i % 3], { metal: 0.25, rough: 0.12, em: 0.9 }, 6);
      g.pop();
    }
    return g;
  }
  const glow = tk === 'glow';
  const th = glow ? 46 : 32;
  const tc = glow ? '#3e3048' : P.trunk;
  // trunk with a root flare and two boughs
  g.cyl(0, th / 2, 0, 2.6, 4.6, th, tc, bark, 8);
  g.cone(0, 2.5, 0, 7, 9, shadeCol(tc, -0.12), bark, 8);
  g.limb(0, th * 0.62, 0, -11, th + 6, 3, 1.9, tc, bark);
  g.limb(0, th * 0.7, 0, 11, th + 8, -3, 1.9, tc, bark);
  const leaf = tk === 'blossom' ? '#f29ac0' : P.leaf;
  const leaf2 = tk === 'blossom' ? '#ffd9ea' : glow ? '#2a9a86' : P.leaf2;
  const cy = th + 16;
  canopy(g, 0, cy, 0, 21 + v * 1.4, leaf, leaf2, seed, 7);
  canopy(g, -10, cy - 6, 4, 12.5, leaf, leaf2, seed + 11, 4);
  canopy(g, 11, cy - 4, -3, 12.5, leaf, leaf2, seed + 23, 4);
  if (tk === 'blossom') for (let i = 0; i < 14; i++) g.sphere(-22 + h1(i, seed + 8) * 44, cy - 12 + h1(i, seed + 10) * 30, -18 + h1(i, seed + 12) * 36, 1.5, 1.5, 1.5, '#ffffff', { rough: 0.6, wind: 1.6 }, 6);
  if (glow) for (let i = 0; i < 12; i++) g.sphere(-22 + h1(i, seed + 12) * 44, cy - 16 + h1(i, seed + 14) * 34, -18 + h1(i, seed + 16) * 36, 1.7, 1.7, 1.7, P.leaf2, { em: 6, rough: 0.4, wind: 1.6 }, 6);
  return g;
}

function buildRock(realm: number, v: number): Geo {
  const P = REALMS[realm].palette;
  const g = new Geo();
  const c = col(P.rock);
  const o = { layer: LAYER.rock, rough: 0.9 };
  g.ico(0, 6.5, 0, 15 + v, 10 + v * 1.5, 12, c, o, 1, [0.2, v * 1.1, 0.1]);
  g.ico(9, 4, 5, 8, 6, 7, shadeCol(P.rock, -0.14), o, 1, [0.4, v * 2.1, 0.2]);
  g.ico(-10, 3.5, -3, 7, 5, 6, shadeCol(P.rock, 0.06), o, 1, [0.1, v * 0.7, 0.5]);
  if (realm === 0 || realm === 1) g.sphere(-1, 13.5 + v, 0, 10, 3, 8, shadeCol(P.leaf, -0.1), { layer: LAYER.grass, rough: 0.9 }, 8);
  if (realm === 3) g.sphere(0, 14 + v, 0, 12, 3.4, 9, '#f6faff', { layer: LAYER.snow, rough: 0.5 }, 8);
  if (realm === 2) g.sphere(4, 9, 6, 2, 2, 2, '#ff6a2a', { em: 4 }, 6);
  return g;
}

function buildBush(realm: number, v: number): Geo {
  const P = REALMS[realm].palette;
  const g = new Geo();
  const c = realm === 2 ? '#3a2e2a' : realm === 3 ? '#9ab8c8' : P.leaf;
  const o = { layer: LAYER.grass, rough: 0.85, wind: 0.7 };
  g.sphere(-6, 6, 0, 8, 7, 8, shadeCol(c, -0.16), o, 9);
  g.sphere(6, 6, 1, 8, 7, 8, shadeCol(c, -0.06), o, 9);
  g.sphere(0, 10, -1, 9, 8, 9, col(c).clone().lerp(col(P.leaf2), 0.25), o, 9);
  for (let i = 0; i < 5; i++) g.sphere(-9 + h1(i, v) * 18, 8 + h1(i, v + 3) * 8, 4 + h1(i, v + 6) * 5, 1.4, 1.4, 1.4, P.flower[i % P.flower.length], { rough: 0.6, wind: 0.7, em: realm === 1 ? 2 : 0 }, 6);
  return g;
}

function buildFlower(): Geo {
  const g = new Geo();
  g.cyl(0, 3.2, 0, 0.3, 0.36, 6.4, '#3f8a3a', { rough: 0.8, wind: 0.25 }, 5);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.sphere(Math.cos(a) * 1.5, 6.9, Math.sin(a) * 1.5, 1.25, 0.5, 1.25, '#ffffff', { rough: 0.55, wind: 0.4 }, 6);
  }
  g.sphere(0, 7.1, 0, 0.9, 0.6, 0.9, '#ffe066', { rough: 0.5, wind: 0.4 }, 6);
  return g;
}

interface Inst {
  x: number;
  y: number;
  z: number;
  yaw: number;
  s: number;
  color?: THREE.Color;
}

export class Foliage {
  readonly group = new THREE.Group();
  private grassMat: (THREE.MeshStandardMaterial & { gu: Record<string, { value: unknown }> }) | null = null;
  private grassMeshes: THREE.Mesh[] = [];
  private geoms: THREE.BufferGeometry[] = [];
  private dist: number;

  constructor(private f: TerrainField, _lib: DetailLib, private q: Quality) {
    const m = f.map;
    SEG = q.id === 'low' ? 6 : q.id === 'medium' ? 8 : q.id === 'high' ? 10 : 12;
    this.dist = q.grassDist * T;
    if (m.kind === 'wild' || m.kind === 'city' || m.kind === 'arena') this.buildGrass(m);
    this.buildProps(m);
  }

  private buildGrass(m: GameMap): void {
    const P = REALMS[m.realm].palette;
    if (P.liquid === 'lava') return;
    const snowy = m.realm === 3;
    const per = Math.round(this.q.grass * (snowy ? 0.35 : 1));
    if (per <= 0) return;
    this.grassMat = grassMaterial(P, snowy);
    (this.grassMat.gu.uDist as { value: number }).value = this.dist;
    (this.grassMat.gu.uWidth as { value: number }).value = Math.min(2.3, Math.max(1, Math.sqrt(46 / Math.max(1, this.q.grass))));
    const blade = bladeGeometry();
    this.geoms.push(blade);
    const CH = 8;
    const f = this.f;
    for (let cy = 0; cy < Math.ceil(m.h / CH); cy++) {
      for (let cx = 0; cx < Math.ceil(m.w / CH); cx++) {
        const off: number[] = [];
        const par: number[] = [];
        for (let ty = cy * CH; ty < Math.min(m.h, (cy + 1) * CH); ty++) {
          for (let tx = cx * CH; tx < Math.min(m.w, (cx + 1) * CH); tx++) {
            const i = ty * m.w + tx;
            if (!GRASSY.has(m.ground[i]) || m.solid[i] === SOL.WALL) continue;
            const lush = m.ground[i] === GT.GRASS2 ? 1.25 : 1;
            const n = Math.round(per * lush);
            for (let k = 0; k < n; k++) {
              const rx = hash2(i, k, 11);
              const rz = hash2(i, k, 23);
              const x = (tx + rx) * T;
              const z = (ty + rz) * T;
              // thin the grass where another surface begins so paths keep clean edges
              const ntx = Math.floor((x + (rx - 0.5) * 20) / T);
              const ntz = Math.floor((z + (rz - 0.5) * 20) / T);
              if (ntx >= 0 && ntz >= 0 && ntx < m.w && ntz < m.h && !GRASSY.has(m.ground[ntz * m.w + ntx]) && hash2(i, k, 5) < 0.75) continue;
              const y = f.height(x, z);
              if (y < -0.5) continue;
              const clump = hash2(Math.floor(x / 46), Math.floor(z / 46), 3);
              const hgt = (snowy ? 4.5 : 7.5) + hash2(i, k, 31) * 7 + clump * 5;
              off.push(x, y, z);
              par.push(hash2(i, k, 41) * 6.283, hgt * lush, 1.6 + hash2(i, k, 43) * 1.5, hash2(i, k, 47) < 0.3 + clump * 0.4 ? 1 : 0);
            }
          }
        }
        if (!off.length) continue;
        const g = new THREE.InstancedBufferGeometry();
        g.index = blade.index;
        g.setAttribute('position', blade.getAttribute('position'));
        g.setAttribute('aOff', new THREE.InstancedBufferAttribute(new Float32Array(off), 3));
        g.setAttribute('aPar', new THREE.InstancedBufferAttribute(new Float32Array(par), 4));
        g.instanceCount = off.length / 3;
        const cxw = (cx + 0.5) * CH * T;
        const czw = (cy + 0.5) * CH * T;
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cxw, 14, czw), CH * T * 0.78 + 30);
        const mesh = new THREE.Mesh(g, this.grassMat);
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        mesh.userData.cx = cxw;
        mesh.userData.cz = czw;
        this.grassMeshes.push(mesh);
        this.geoms.push(g);
        this.group.add(mesh);
      }
    }
  }

  private buildProps(m: GameMap): void {
    const f = this.f;
    const buckets = new Map<string, { geo: () => Geo; inst: Inst[] }>();
    const put = (key: string, geo: () => Geo, x: number, z: number, yaw: number, s: number, color?: THREE.Color): void => {
      const rk = `${key}|${Math.floor(x / (REGION * T))},${Math.floor(z / (REGION * T))}`;
      let b = buckets.get(rk);
      if (!b) {
        b = { geo, inst: [] };
        buckets.set(rk, b);
      }
      b.inst.push({ x, y: f.groundY(x, z), z, yaw, s, color });
    };
    for (const p of m.props) {
      const d = p.data ?? {};
      const r = hash2(p.id, m.realm, 9);
      if (p.kind === 'tree') {
        const tk = String(d.tk);
        const v = Number(d.v);
        put(`tree:${tk}:${v}`, () => buildTree(m.realm, tk, v), p.x, p.y - 8, r * 6.283, 0.92 + hash2(p.id, 3, 4) * 0.3);
        p.hidden3d = true;
      } else if (p.kind === 'rock') {
        const v = Number(d.v);
        put(`rock:${v}`, () => buildRock(m.realm, v), p.x, p.y - 8, r * 6.283, 0.95 + hash2(p.id, 3, 4) * 0.35);
        p.hidden3d = true;
      } else if (p.kind === 'bush') {
        const v = Number(d.v);
        put(`bush:${v}`, () => buildBush(m.realm, v), p.x, p.y - 6, r * 6.283, 0.95 + hash2(p.id, 3, 4) * 0.3);
        p.hidden3d = true;
      }
    }
    // wildflowers
    const P = REALMS[m.realm].palette;
    if (m.kind === 'wild' || m.kind === 'city') {
      for (let ty = 0; ty < m.h; ty++) {
        for (let tx = 0; tx < m.w; tx++) {
          const i = ty * m.w + tx;
          if (m.ground[i] !== GT.FLOWERS || m.solid[i] === SOL.WALL) continue;
          const n = 3 + Math.floor(hash2(tx, ty, 61) * 4);
          for (let k = 0; k < n; k++) {
            const x = (tx + 0.1 + hash2(i, k, 63) * 0.8) * T;
            const z = (ty + 0.1 + hash2(i, k, 67) * 0.8) * T;
            put('flower', buildFlower, x, z, hash2(i, k, 69) * 6.283, 0.8 + hash2(i, k, 71) * 0.6, col(P.flower[Math.floor(hash2(i, k, 73) * P.flower.length) % P.flower.length]));
          }
        }
      }
    }
    const built = new Map<string, THREE.BufferGeometry>();
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (const [rk, b] of buckets) {
      const key = rk.split('|')[0];
      let geom = built.get(key);
      if (!geom) {
        geom = b.geo().build();
        built.set(key, geom);
        this.geoms.push(geom);
      }
      const mesh = new THREE.InstancedMesh(geom, uber(), b.inst.length);
      let cx = 0;
      let cz = 0;
      b.inst.forEach((it, i) => {
        q.setFromAxisAngle(up, it.yaw);
        mtx.compose(pos.set(it.x, it.y, it.z), q, scl.set(it.s, it.s * (0.94 + h1(i, 5) * 0.14), it.s));
        mesh.setMatrixAt(i, mtx);
        if (it.color) mesh.setColorAt(i, it.color);
        cx += it.x;
        cz += it.z;
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      const small = key === 'flower';
      mesh.castShadow = !small && this.q.propShadows;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = uberDepth();
      mesh.computeBoundingSphere();
      mesh.userData.cx = cx / b.inst.length;
      mesh.userData.cz = cz / b.inst.length;
      mesh.userData.small = small;
      this.group.add(mesh);
    }
  }

  /** wind, grass draw distance and the actors that push the blades aside */
  update(env: Environment, fx: number, fz: number): void {
    void env;
    if (this.grassMat) {
      (this.grassMat.gu.uFocus.value as THREE.Vector3).set(fx, 0, fz);
      const lim = this.dist + 8 * T;
      for (const mesh of this.grassMeshes) mesh.visible = Math.abs(mesh.userData.cx - fx) < lim && Math.abs(mesh.userData.cz - fz) < lim;
    }
  }

  setPushers(list: { x: number; y: number; r: number }[]): void {
    if (!this.grassMat) return;
    const arr = this.grassMat.gu.uPush.value as THREE.Vector4[];
    for (let i = 0; i < MAX_PUSH; i++) {
      const p = list[i];
      if (p) arr[i].set(p.x, p.y, p.r, 0);
      else arr[i].set(0, 0, 0.001, 0);
    }
  }

  dispose(): void {
    for (const g of this.geoms) g.dispose();
    this.grassMat?.dispose();
    this.group.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if (im.isInstancedMesh) im.dispose();
    });
  }
}
