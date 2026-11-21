// Shared 3D helpers: colour conversion, a merged-geometry builder with per-vertex material
// properties (detail layer, metalness, roughness, emissive, wind) and the "uber" PBR material
// every prop, character and monster in the 3D renderer is drawn with.
import * as THREE from 'three';
import type { DetailLib } from './textures';

/** on-screen plateau tier height in world units */
export const PLATEAU_H = 26;
export const WATER_Y = -2.6;
export const BED_DEPTH = 13;
export const WALL_H3: Record<string, number> = { dungeon: 40, masonry: 36, interior: 34, cliff: 44 };

const colCache = new Map<string, THREE.Color>();
/** sRGB hex / css colour -> linear THREE.Color (cached, do not mutate the result) */
export function col(c: string): THREE.Color {
  let v = colCache.get(c);
  if (!v) {
    v = new THREE.Color(c);
    colCache.set(c, v);
  }
  return v;
}

export function colMix(a: string, b: string, t: number): THREE.Color {
  return col(a).clone().lerp(col(b), t);
}

export function shadeCol(c: string, amt: number): THREE.Color {
  const v = col(c).clone();
  if (amt >= 0) v.lerp(WHITE, amt);
  else v.multiplyScalar(1 + amt);
  return v;
}
const WHITE = new THREE.Color(1, 1, 1);

export interface VProps {
  /** detail texture layer (-1 = flat colour) */
  layer?: number;
  metal?: number;
  rough?: number;
  /** emissive strength (colour * em is added as light) */
  em?: number;
  /** wind sway weight */
  wind?: number;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _nm = new THREE.Matrix3();

const prim = new Map<string, THREE.BufferGeometry>();
function unit(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = prim.get(key);
  if (!g) {
    g = make();
    prim.set(key, g);
  }
  return g;
}

/** accumulates transformed primitives into one BufferGeometry with vertex colours + material props */
export class Geo {
  private pos: number[] = [];
  private nor: number[] = [];
  private colr: number[] = [];
  private props: number[] = [];
  private fx: number[] = [];
  private idx: number[] = [];
  private base = new THREE.Matrix4();
  private stack: THREE.Matrix4[] = [];
  count = 0;

  /** push a local transform for subsequent primitives */
  push(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1): this {
    this.stack.push(this.base.clone());
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(s, s, s));
    this.base.multiply(_m);
    return this;
  }

  pop(): this {
    const b = this.stack.pop();
    if (b) this.base.copy(b);
    return this;
  }

  add(g: THREE.BufferGeometry, c: THREE.Color | string, m: THREE.Matrix4, vp: VProps = {}): this {
    const color = typeof c === 'string' ? col(c) : c;
    const full = _m.multiplyMatrices(this.base, m);
    _nm.getNormalMatrix(full);
    const pa = g.getAttribute('position');
    const na = g.getAttribute('normal');
    const ia = g.getIndex();
    const off = this.pos.length / 3;
    const layer = vp.layer ?? -1;
    const metal = vp.metal ?? 0;
    const rough = vp.rough ?? 0.75;
    const em = vp.em ?? 0;
    const wind = vp.wind ?? 0;
    for (let i = 0; i < pa.count; i++) {
      _v.fromBufferAttribute(pa, i).applyMatrix4(full);
      this.pos.push(_v.x, _v.y, _v.z);
      _n.fromBufferAttribute(na, i).applyMatrix3(_nm).normalize();
      this.nor.push(_n.x, _n.y, _n.z);
      this.colr.push(color.r, color.g, color.b);
      this.props.push(layer, metal, rough, em);
      this.fx.push(wind);
    }
    if (ia) for (let i = 0; i < ia.count; i++) this.idx.push(ia.getX(i) + off);
    else for (let i = 0; i < pa.count; i++) this.idx.push(i + off);
    this.count++;
    return this;
  }

  private tm(x: number, y: number, z: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): THREE.Matrix4 {
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  }

  /** ellipsoid with radii (rx, ry, rz) */
  sphere(x: number, y: number, z: number, rx: number, ry: number, rz: number, c: THREE.Color | string, vp?: VProps, seg = 14, rot: [number, number, number] = [0, 0, 0]): this {
    const g = unit('s' + seg, () => new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.7))));
    return this.add(g, c, this.tm(x, y, z, rot[0], rot[1], rot[2], rx, ry, rz), vp);
  }

  /** low-poly faceted ball (rocks, crystals) */
  ico(x: number, y: number, z: number, rx: number, ry: number, rz: number, c: THREE.Color | string, vp?: VProps, detail = 1, rot: [number, number, number] = [0, 0, 0]): this {
    const g = unit('i' + detail, () => {
      const ge = new THREE.IcosahedronGeometry(1, detail).toNonIndexed();
      ge.computeVertexNormals();
      return ge;
    });
    return this.add(g, c, this.tm(x, y, z, rot[0], rot[1], rot[2], rx, ry, rz), vp);
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, c: THREE.Color | string, vp?: VProps, rot: [number, number, number] = [0, 0, 0]): this {
    const g = unit('b', () => new THREE.BoxGeometry(1, 1, 1));
    return this.add(g, c, this.tm(x, y, z, rot[0], rot[1], rot[2], w, h, d), vp);
  }

  /** cylinder / cone frustum along Y, centred at (x, y, z) */
  cyl(x: number, y: number, z: number, rTop: number, rBot: number, h: number, c: THREE.Color | string, vp?: VProps, seg = 12, rot: [number, number, number] = [0, 0, 0]): this {
    const ratio = Math.round((rTop / Math.max(0.0001, rBot)) * 20) / 20;
    const g = unit(`c${seg}:${ratio}`, () => new THREE.CylinderGeometry(ratio, 1, 1, seg, 1));
    return this.add(g, c, this.tm(x, y, z, rot[0], rot[1], rot[2], rBot, h, rBot), vp);
  }

  cone(x: number, y: number, z: number, r: number, h: number, c: THREE.Color | string, vp?: VProps, seg = 10, rot: [number, number, number] = [0, 0, 0]): this {
    const g = unit('k' + seg, () => new THREE.ConeGeometry(1, 1, seg, 1));
    return this.add(g, c, this.tm(x, y, z, rot[0], rot[1], rot[2], r, h, r), vp);
  }

  /** capsule along Y between two heights */
  capsule(x: number, y: number, z: number, r: number, len: number, c: THREE.Color | string, vp?: VProps, rot: [number, number, number] = [0, 0, 0], seg = 10): this {
    const ratio = Math.round((len / Math.max(0.01, r)) * 4) / 4;
    const g = unit(`p${seg}:${ratio}`, () => new THREE.CapsuleGeometry(1, ratio, 4, seg));
    return this.add(g, c, this.tm(x, y, z, rot[0], rot[1], rot[2], r, r, r), vp);
  }

  /** capsule limb from point a to point b */
  limb(ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number, c: THREE.Color | string, vp?: VProps): this {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    const ratio = Math.round((len / Math.max(0.01, r)) * 4) / 4;
    const g = unit(`p8:${ratio}`, () => new THREE.CapsuleGeometry(1, ratio, 3, 8));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
    const m = new THREE.Matrix4().compose(new THREE.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), q, new THREE.Vector3(r, r, r));
    return this.add(g, c, m, vp);
  }

  torus(x: number, y: number, z: number, r: number, tube: number, c: THREE.Color | string, vp?: VProps, rot: [number, number, number] = [0, 0, 0], arc = Math.PI * 2, seg = 18): this {
    const ratio = Math.round((tube / r) * 40) / 40;
    const g = unit(`t${seg}:${ratio}:${arc.toFixed(2)}`, () => new THREE.TorusGeometry(1, ratio, 6, seg, arc));
    return this.add(g, c, this.tm(x, y, z, rot[0], rot[1], rot[2], r, r, r), vp);
  }

  /** triangular prism roof: ridge along X, width w (x), height h, depth d (z) centred at base */
  prism(x: number, y: number, z: number, w: number, h: number, d: number, c: THREE.Color | string, vp?: VProps, rot: [number, number, number] = [0, 0, 0]): this {
    const g = unit('prism', () => {
      const ge = new THREE.BufferGeometry();
      // base rectangle at y=0, ridge at y=1 running along x
      const P = [
        -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0, // south slope
        0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0, // north slope
        -0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0, // west gable
        0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, 0, // east gable
        -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, // bottom
      ];
      const I = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 14, 16, 17];
      ge.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      ge.setIndex(I);
      ge.computeVertexNormals();
      return ge;
    });
    return this.add(g, c, this.tm(x, y, z, rot[0], rot[1], rot[2], w, h, d), vp);
  }

  /** flat double-sided quad in the XY plane centred at (x, y, z) */
  quad(x: number, y: number, z: number, w: number, h: number, c: THREE.Color | string, vp?: VProps, rot: [number, number, number] = [0, 0, 0]): this {
    const g = unit('q', () => new THREE.PlaneGeometry(1, 1));
    return this.add(g, c, this.tm(x, y, z, rot[0], rot[1], rot[2], w, h, 1), vp);
  }

  get empty(): boolean {
    return this.pos.length === 0;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colr, 3));
    g.setAttribute('aProps', new THREE.Float32BufferAttribute(this.props, 4));
    g.setAttribute('aFx', new THREE.Float32BufferAttribute(this.fx, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// ---------------------------------------------------------------------------------- uber material

export interface UberUniforms {
  uDetA: { value: THREE.Texture | null };
  uDetN: { value: THREE.Texture | null };
  uTime: { value: number };
  uWind: { value: THREE.Vector3 };
  /** rgb + amount of the hit flash */
  uFlash: { value: THREE.Vector4 };
  /** 0..1 dissolve progress (death) */
  uDissolve: { value: number };
  uRim: { value: THREE.Vector4 };
  uDetScale: { value: number };
  uLamp: { value: number };
  uCut: { value: THREE.Vector4 };
  uFade: { value: THREE.Vector4 };
}

export const shared = {
  time: { value: 0 },
  /** 0 by day, 1 at night: scales "lamp" emissive (aProps.w > 50) */
  lamp: { value: 0 },
  /** screen-space cut-away around the player: xy = centre (px), z = radius (px), w = view depth */
  cut: { value: new THREE.Vector4(0, 0, 0, 0) },
  /** foliage thins out around the player: xy = world xz, z = inner radius, w = outer radius (0 = off) */
  fade: { value: new THREE.Vector4(0, 0, 0, 0) },
  wind: { value: new THREE.Vector3(1, 0, 0.35) },
  detA: { value: null as THREE.Texture | null },
  detN: { value: null as THREE.Texture | null },
};

export function bindDetail(lib: DetailLib): void {
  shared.detA.value = lib.albedo;
  shared.detN.value = lib.normal;
}

const UBER_VERT_HEAD = /* glsl */ `
attribute vec4 aProps;
attribute float aFx;
varying vec3 vWp;
varying vec3 vWn;
varying vec4 vProps;
varying float vFxW;
uniform float uTime;
uniform vec3 uWind;
`;

const UBER_VERT_BEGIN = /* glsl */ `
#include <begin_vertex>
vProps = aProps;
vFxW = aFx;
{
  vec4 wp4 = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    wp4 = instanceMatrix * wp4;
  #endif
  wp4 = modelMatrix * wp4;
  if (aFx > 0.0) {
    float ph = dot(wp4.xz, vec2(0.021, 0.017)) + uTime * 1.3;
    float sway = sin(ph) * 0.6 + sin(ph * 2.3 + 1.7) * 0.3 + sin(uTime * 3.1 + wp4.x * 0.11) * 0.12;
    vec3 off = uWind * sway * aFx;
    transformed += off;
    wp4.xyz += off;
  }
  vWp = wp4.xyz;
  vec3 wn = objectNormal;
  #ifdef USE_INSTANCING
    wn = mat3(instanceMatrix) * wn;
  #endif
  vWn = normalize(mat3(modelMatrix) * wn);
}
`;

const UBER_FRAG_HEAD = /* glsl */ `
precision highp sampler2DArray;
varying vec3 vWp;
varying vec3 vWn;
varying vec4 vProps;
uniform sampler2DArray uDetA;
uniform sampler2DArray uDetN;
uniform float uTime;
uniform vec4 uFlash;
uniform float uDissolve;
uniform vec4 uRim;
uniform float uDetScale;
uniform float uLamp;
uniform vec4 uCut;
uniform vec4 uFade;
varying float vFxW;
float uberHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
vec3 uberN = vec3(0.0);
float uberRough = 0.75;
float uberAo = 1.0;
`;

const UBER_FRAG_MAP = /* glsl */ `
#include <map_fragment>
{
  vec3 wn = normalize(vWn);
  if (uDissolve > 0.0) {
    float dn = uberHash(floor(vWp * 0.7));
    if (dn < uDissolve) discard;
  }
  if (uFade.w > 0.0 && vFxW > 0.3 && vWp.y > 20.0) {
    float keepF = mix(0.2, 1.0, smoothstep(uFade.z, uFade.w, distance(vWp.xz, uFade.xy)));
    float dthF = fract(52.9829189 * fract(dot(gl_FragCoord.xy + 7.0, vec2(0.06711056, 0.00583715))));
    if (keepF < dthF) discard;
  }
  if (uCut.z > 0.0 && vWp.y > 16.0) {
    float cd = distance(gl_FragCoord.xy, uCut.xy);
    if (cd < uCut.z && vViewPosition.z < uCut.w - 14.0) {
      float keep = smoothstep(uCut.z * 0.45, uCut.z, cd);
      float dth = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      if (keep < dth) discard;
    }
  }
  uberRough = vProps.z;
  if (vProps.x > -0.5) {
    vec3 an = abs(wn);
    vec2 duv;
    vec3 tx;
    vec3 ty;
    if (an.y > an.x && an.y > an.z) { duv = vWp.xz; tx = vec3(1.0, 0.0, 0.0); ty = vec3(0.0, 0.0, 1.0); }
    else if (an.x > an.z) { duv = vec2(vWp.z, -vWp.y); tx = vec3(0.0, 0.0, 1.0); ty = vec3(0.0, -1.0, 0.0); }
    else { duv = vec2(vWp.x, -vWp.y); tx = vec3(1.0, 0.0, 0.0); ty = vec3(0.0, -1.0, 0.0); }
    duv *= uDetScale;
    vec4 da = texture(uDetA, vec3(duv, vProps.x));
    vec4 dn4 = texture(uDetN, vec3(duv, vProps.x));
    diffuseColor.rgb *= da.rgb * 2.0;
    vec2 nn = dn4.rg * 2.0 - 1.0;
    uberN = normalize(wn - (tx * nn.x + ty * nn.y) * 0.9);
    uberRough *= mix(0.75, 1.25, dn4.b);
    uberAo = dn4.a;
    diffuseColor.rgb *= mix(0.72, 1.0, uberAo);
  }
}
`;

const UBER_FRAG_ROUGH = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = clamp(uberRough, 0.04, 1.0);
`;

const UBER_FRAG_METAL = /* glsl */ `
#include <metalnessmap_fragment>
metalnessFactor = vProps.y;
`;

const UBER_FRAG_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
if (vProps.x > -0.5) {
  normal = normalize((viewMatrix * vec4(uberN, 0.0)).xyz);
  if (!gl_FrontFacing) normal = -normal;
}
`;

const UBER_FRAG_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
{
  float em = vProps.w;
  if (em > 50.0) em = (em - 50.0) * uLamp;
  totalEmissiveRadiance += diffuseColor.rgb * em;
}
{
  float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.6);
  totalEmissiveRadiance += uRim.rgb * (fres * uRim.a);
  totalEmissiveRadiance += uFlash.rgb * uFlash.a;
  diffuseColor.rgb = mix(diffuseColor.rgb, uFlash.rgb, clamp(uFlash.a * 0.55, 0.0, 1.0));
  if (uDissolve > 0.0) {
    float dn2 = uberHash(floor(vWp * 0.7));
    totalEmissiveRadiance += vec3(0.5, 0.9, 1.0) * smoothstep(uDissolve + 0.12, uDissolve, dn2) * 4.0;
  }
}
`;

export interface UberOpts {
  side?: THREE.Side;
  transparent?: boolean;
  envMapIntensity?: number;
  detScale?: number;
  flatShading?: boolean;
  /** false = never cut away around the player (characters) */
  cut?: boolean;
}

/** vertex-coloured PBR material driven by the aProps attribute (detail layer, metal, rough, emissive) */
export function makeUber(opts: UberOpts = {}): THREE.MeshStandardMaterial & { uu: UberUniforms } {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    envMapIntensity: opts.envMapIntensity ?? 1,
    flatShading: opts.flatShading ?? false,
  }) as THREE.MeshStandardMaterial & { uu: UberUniforms };
  const uu: UberUniforms = {
    uDetA: shared.detA,
    uDetN: shared.detN,
    uTime: shared.time,
    uWind: shared.wind,
    uFlash: { value: new THREE.Vector4(1, 1, 1, 0) },
    uDissolve: { value: 0 },
    uRim: { value: new THREE.Vector4(0, 0, 0, 0) },
    uDetScale: { value: opts.detScale ?? 1 / 48 },
    uLamp: shared.lamp,
    uCut: opts.cut === false ? { value: new THREE.Vector4(0, 0, 0, 0) } : shared.cut,
    uFade: opts.cut === false ? { value: new THREE.Vector4(0, 0, 0, 0) } : shared.fade,
  };
  mat.uu = uu;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uu);
    sh.vertexShader = UBER_VERT_HEAD + sh.vertexShader.replace('#include <begin_vertex>', UBER_VERT_BEGIN);
    sh.fragmentShader = UBER_FRAG_HEAD + sh.fragmentShader
      .replace('#include <map_fragment>', UBER_FRAG_MAP)
      .replace('#include <roughnessmap_fragment>', UBER_FRAG_ROUGH)
      .replace('#include <metalnessmap_fragment>', UBER_FRAG_METAL)
      .replace('#include <normal_fragment_maps>', UBER_FRAG_NORMAL)
      .replace('#include <emissivemap_fragment>', UBER_FRAG_EMISSIVE);
  };
  mat.customProgramCacheKey = () => 'uber';
  return mat;
}

/** depth material that follows the uber material's wind sway and dissolve (for shadow casting) */
export function makeUberDepth(src: { uu: UberUniforms }): THREE.MeshDepthMaterial {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  d.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time;
    sh.uniforms.uWind = shared.wind;
    sh.uniforms.uDissolve = src.uu.uDissolve;
    sh.vertexShader = `attribute float aFx;\nuniform float uTime;\nuniform vec3 uWind;\nvarying vec3 vWpD;\n` + sh.vertexShader.replace('#include <begin_vertex>', /* glsl */ `
#include <begin_vertex>
{
  vec4 wp4 = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    wp4 = instanceMatrix * wp4;
  #endif
  wp4 = modelMatrix * wp4;
  if (aFx > 0.0) {
    float ph = dot(wp4.xz, vec2(0.021, 0.017)) + uTime * 1.3;
    float sway = sin(ph) * 0.6 + sin(ph * 2.3 + 1.7) * 0.3 + sin(uTime * 3.1 + wp4.x * 0.11) * 0.12;
    transformed += uWind * sway * aFx;
    wp4.xyz += uWind * sway * aFx;
  }
  vWpD = wp4.xyz;
}
`);
    sh.fragmentShader = `uniform float uDissolve;\nvarying vec3 vWpD;\n` + sh.fragmentShader.replace('#include <clipping_planes_fragment>', /* glsl */ `
#include <clipping_planes_fragment>
if (uDissolve > 0.0) {
  float dn = fract(sin(dot(floor(vWpD * 0.7), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  if (dn < uDissolve) discard;
}
`);
  };
  d.customProgramCacheKey = () => 'uberdepth';
  return d;
}

let SHARED_UBER: (THREE.MeshStandardMaterial & { uu: UberUniforms }) | null = null;
let SHARED_UBER_DS: (THREE.MeshStandardMaterial & { uu: UberUniforms }) | null = null;
let SHARED_DEPTH: THREE.MeshDepthMaterial | null = null;

/** the one material every static prop shares */
export function uber(doubleSide = false): THREE.MeshStandardMaterial & { uu: UberUniforms } {
  if (doubleSide) {
    if (!SHARED_UBER_DS) SHARED_UBER_DS = makeUber({ side: THREE.DoubleSide });
    return SHARED_UBER_DS;
  }
  if (!SHARED_UBER) SHARED_UBER = makeUber();
  return SHARED_UBER;
}

export function uberDepth(): THREE.MeshDepthMaterial {
  if (!SHARED_DEPTH) SHARED_DEPTH = makeUberDepth(uber());
  return SHARED_DEPTH;
}

/** mesh from a Geo with shadows on and the wind-aware depth material */
export function meshOf(g: Geo | THREE.BufferGeometry, mat?: THREE.Material, cast = true, receive = true): THREE.Mesh {
  const geom = g instanceof Geo ? g.build() : g;
  const m = new THREE.Mesh(geom, mat ?? uber());
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (cast && !mat) m.customDepthMaterial = uberDepth();
  return m;
}

export function disposeObject(o: THREE.Object3D): void {
  o.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (mesh.geometry && !(mesh.geometry as THREE.BufferGeometry & { shared?: boolean }).shared) mesh.geometry.dispose();
  });
  o.removeFromParent();
}

/** smooth pseudo-random helpers for deterministic model variation */
export function h1(n: number, seed = 0): number {
  const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
