// Combat and ambient effects in 3D. Everything the simulation emits into the shared `fx` state
// (particles, slash ribbons, shockwave rings, lightning, crystal shards, glints) is drawn here as
// HDR geometry that feeds the bloom pass, together with ground telegraphs, skill zones, traps,
// arrow rain, weather (rain, snow, petals, embers, fireflies) and the emitters of torches,
// forges, chimneys, fountains and portals.
import * as THREE from 'three';
import { G } from '../core/state';
import { fx } from '../render/fx';
import { isNight } from '../data/constants';
import { clamp } from '../engine/util';
import type { Quality } from './quality';
import type { Engine3D } from './engine';
import type { MapScene } from './mapscene';
import type { LightSrc } from './env';
import type { TerrainField } from './terrain';
import { col } from './util3';

const SEG = 18;
const MAX_RIBBONS = 28;
const MAX_RINGS = 48;
const MAX_SHARDS = 260;
const MAX_LINES = 400;
const DECALS = 28;

const POINT_VERT = /* glsl */ `
attribute vec4 aCol;
attribute vec2 aSize;
uniform float uPx;
varying vec4 vCol;
varying float vShape;
void main() {
  vCol = aCol;
  vShape = aSize.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.xyz -= normalize(mv.xyz) * 22.0;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, aSize.x * uPx / max(1.0, -mv.z));
}
`;

const POINT_FRAG = /* glsl */ `
precision highp float;
varying vec4 vCol;
varying float vShape;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = length(p);
  float a;
  if (vShape > 2.5) { // four-point star glint
    float star = max(0.0, 1.0 - abs(p.x) * abs(p.y) * 26.0) * max(0.0, 1.0 - d);
    a = star + pow(max(0.0, 1.0 - d), 3.0) * 0.6;
  } else if (vShape > 1.5) { // soft smoke puff
    a = smoothstep(1.0, 0.25, d) * 0.6;
  } else if (vShape > 0.5) { // hard spark
    a = smoothstep(1.0, 0.55, d);
  } else { // glow
    a = pow(max(0.0, 1.0 - d), 1.8);
  }
  if (a <= 0.003) discard;
  gl_FragColor = vec4(vCol.rgb * a * vCol.a, a * vCol.a);
}
`;

const DECAL_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const DECAL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uCol;
uniform float uK;
uniform float uShape;
uniform float uArc;
uniform float uInner;
uniform float uTime;
uniform float uAlpha;
uniform float uSwirl;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float base = 0.0; float fill = 0.0; float edge = 0.0;
  float aa = 0.03;
  if (uShape < 0.5) { // circle
    float r = length(p);
    base = 1.0 - smoothstep(1.0 - aa, 1.0, r);
    fill = 1.0 - smoothstep(uK - aa, uK, r);
    edge = smoothstep(0.9, 0.97, r) * base;
  } else if (uShape < 1.5) { // ring
    float r = length(p);
    float band = smoothstep(uInner - aa, uInner, r) * (1.0 - smoothstep(1.0 - aa, 1.0, r));
    base = band;
    fill = band * (1.0 - smoothstep(uInner + (1.0 - uInner) * uK - aa, uInner + (1.0 - uInner) * uK, r));
    edge = (smoothstep(0.92, 0.98, r) + (1.0 - smoothstep(uInner, uInner + 0.06, r))) * band;
  } else if (uShape < 2.5) { // cone opening along +x
    float r = length(p);
    float ang = abs(atan(p.y, p.x));
    float inA = 1.0 - smoothstep(uArc * 0.5 - 0.03, uArc * 0.5, ang);
    base = inA * (1.0 - smoothstep(1.0 - aa, 1.0, r));
    fill = base * (1.0 - smoothstep(uK - aa, uK, r));
    edge = (smoothstep(0.92, 0.98, r) + smoothstep(uArc * 0.5 - 0.09, uArc * 0.5 - 0.02, ang)) * base;
  } else { // line: x in [0,1]
    float x = vUv.x; float y = abs(p.y);
    base = (1.0 - smoothstep(1.0 - aa * 3.0, 1.0, y)) * step(0.0, x);
    fill = base * (1.0 - smoothstep(uK - 0.01, uK, x));
    edge = (smoothstep(0.8, 0.95, y) + smoothstep(0.985, 1.0, x)) * base;
  }
  float pulse = 0.85 + 0.15 * sin(uTime * 18.0);
  float stripes = 0.5 + 0.5 * sin((p.x + p.y) * 26.0 - uTime * 7.0);
  float a = base * 0.13 + fill * (0.26 + 0.1 * stripes) + edge * 0.85 * pulse;
  if (uSwirl > 0.0) {
    float r = length(p);
    float sw = sin(atan(p.y, p.x) * 3.0 + r * 8.0 - uTime * 3.0 * uSwirl) * 0.5 + 0.5;
    a = base * (0.16 + sw * 0.22 * (1.0 - r)) + edge * 0.8;
  }
  a *= uAlpha;
  if (a <= 0.004) discard;
  gl_FragColor = vec4(uCol * (0.7 + edge * 1.6 + fill * 0.5) * a, a);
}
`;

const AMBIENT_VERT = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime;
uniform vec3 uCenter;
uniform vec3 uBox;
uniform vec3 uVel;
uniform float uSway;
uniform float uPx;
uniform float uSize;
uniform float uStreak;
varying float vTw;
void main() {
  vec3 p = aSeed * uBox + uVel * uTime;
  p.x += sin(uTime * 0.7 + aSeed.z * 31.0) * uSway;
  p.z += cos(uTime * 0.53 + aSeed.x * 27.0) * uSway;
  p = mod(p, uBox) - uBox * 0.5;
  p.y += uBox.y * 0.5;
  vec3 wp = uCenter + p;
  wp.y -= uCenter.y;
  wp += position * uStreak;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, uSize * (0.6 + aSeed.y * 0.8) * uPx / max(1.0, -mv.z));
  vTw = fract(aSeed.x * 7.0 + aSeed.z * 3.0);
}
`;

const AMBIENT_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCol;
uniform float uAlpha;
uniform float uTime;
uniform float uTwinkle;
uniform float uRound;
varying float vTw;
void main() {
  float a = uAlpha;
  if (uRound > 0.5) {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = length(p * vec2(1.0, 1.0 + uRound * 0.0));
    a *= pow(max(0.0, 1.0 - d), uRound > 1.5 ? 2.2 : 0.6);
  }
  a *= mix(1.0, 0.5 + 0.5 * sin(uTime * 3.0 + vTw * 40.0), uTwinkle);
  if (a <= 0.004) discard;
  gl_FragColor = vec4(uCol * a, a);
}
`;

interface Decal {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
}

interface Ambient {
  obj: THREE.Object3D;
  mat: THREE.ShaderMaterial;
  kind: string;
}

export class VfxLayer {
  readonly group = new THREE.Group();
  private field: TerrainField | null = null;
  // particles
  private pAdd: THREE.Points;
  private pMix: THREE.Points;
  private pMat: THREE.ShaderMaterial;
  private pMatMix: THREE.ShaderMaterial;
  private maxP: number;
  // ribbons / lines / shards / rings
  private ribbon: THREE.Mesh;
  private lines: THREE.Mesh;
  private shards: THREE.InstancedMesh;
  private rings: THREE.InstancedMesh;
  private decals: Decal[] = [];
  private ambient: Ambient[] = [];
  private ambientKey = '';
  private emitAcc = new Map<number, number>();
  private extraLights: LightSrc[] = [];
  private mtx = new THREE.Matrix4();
  private q4 = new THREE.Quaternion();
  private e3 = new THREE.Euler();
  private v3 = new THREE.Vector3();
  private s3 = new THREE.Vector3();
  private c3 = new THREE.Color();

  constructor(scene: THREE.Scene, private q: Quality) {
    this.group.name = 'vfx';
    scene.add(this.group);
    this.maxP = q.particles;
    const mkPoints = (additive: boolean): [THREE.Points, THREE.ShaderMaterial] => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxP * 3), 3));
      g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(this.maxP * 4), 4));
      g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(this.maxP * 2), 2));
      g.setDrawRange(0, 0);
      const mat = new THREE.ShaderMaterial({
        vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, premultipliedAlpha: true, uniforms: { uPx: { value: 800 } },
      });
      const pts = new THREE.Points(g, mat);
      pts.frustumCulled = false;
      pts.renderOrder = additive ? 8 : 7;
      this.group.add(pts);
      return [pts, mat];
    };
    [this.pAdd, this.pMat] = mkPoints(true);
    [this.pMix, this.pMatMix] = mkPoints(false);
    // slash ribbons: three vertices across (inner edge, hot core, outer edge)
    const rg = new THREE.BufferGeometry();
    const rv = MAX_RIBBONS * (SEG + 1) * 3;
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rv * 3), 3));
    rg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(rv * 4), 4));
    const ri: number[] = [];
    for (let r = 0; r < MAX_RIBBONS; r++) {
      const o = r * (SEG + 1) * 3;
      for (let i = 0; i < SEG; i++) {
        const a = o + i * 3;
        const b = a + 3;
        ri.push(a, a + 1, b + 1, a, b + 1, b, a + 1, a + 2, b + 2, a + 1, b + 2, b + 1);
      }
    }
    rg.setIndex(ri);
    rg.setDrawRange(0, 0);
    const addMat = (): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    this.ribbon = new THREE.Mesh(rg, addMat());
    this.ribbon.frustumCulled = false;
    this.ribbon.renderOrder = 7;
    this.group.add(this.ribbon);
    // generic glowing line quads (lightning, arrow rain, beams)
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_LINES * 8 * 3), 3));
    lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_LINES * 8 * 4), 4));
    const li: number[] = [];
    for (let i = 0; i < MAX_LINES * 2; i++) {
      const o = i * 4;
      li.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    lg.setIndex(li);
    lg.setDrawRange(0, 0);
    this.lines = new THREE.Mesh(lg, addMat());
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 8;
    this.group.add(this.lines);
    // crystal shards
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 0, -0.87, -0.5, 0, 0.87, -0.5, 0], 3));
    tri.computeVertexNormals();
    const sm = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    this.shards = new THREE.InstancedMesh(tri, sm, MAX_SHARDS);
    this.shards.count = 0;
    this.shards.frustumCulled = false;
    this.shards.renderOrder = 8;
    this.group.add(this.shards);
    // shockwave rings
    const ring = new THREE.RingGeometry(0.84, 1, 40).rotateX(-Math.PI / 2);
    const rm = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    this.rings = new THREE.InstancedMesh(ring, rm, MAX_RINGS);
    this.rings.count = 0;
    this.rings.frustumCulled = false;
    this.rings.renderOrder = 6;
    this.group.add(this.rings);
    // ground decals (telegraphs, zones, traps)
    const quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < DECALS; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: DECAL_VERT, fragmentShader: DECAL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uCol: { value: new THREE.Color() }, uK: { value: 0 }, uShape: { value: 0 }, uArc: { value: 1 }, uInner: { value: 0.5 }, uTime: { value: 0 }, uAlpha: { value: 1 }, uSwirl: { value: 0 } },
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      });
      const mesh = new THREE.Mesh(quad, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      this.group.add(mesh);
      this.decals.push({ mesh, mat });
    }
  }

  setScene(ms: MapScene): void {
    this.field = ms.field;
    this.emitAcc.clear();
  }

  addLights(out: LightSrc[]): void {
    for (const l of this.extraLights) out.push(l);
  }

  // ------------------------------------------------------------------------------ frame

  sync(dt: number, t: number, eng: Engine3D, ms: MapScene): void {
    const f = this.field;
    if (!f) return;
    const px = (eng.cssH * eng.dpr) / (2 * Math.tan((eng.camera.fov * Math.PI) / 360));
    this.pMat.uniforms.uPx.value = px;
    this.pMatMix.uniforms.uPx.value = px;
    this.extraLights.length = 0;
    if (!G.game.paused) this.emit(ms, dt);
    this.particles(f);
    this.ribbons(f);
    this.linesAndRain(f, t);
    this.shardsAndRings(f);
    this.decalsUpdate(f, t);
    this.weather(eng, t, px);
  }

  /** torches, forges, chimneys, fountains and portals feed the shared particle pool */
  private emit(ms: MapScene, dt: number): void {
    const p = G.player;
    const list = ms.props.emitters;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (Math.abs(e.x - p.x) > 520 || Math.abs(e.z - p.y) > 440) continue;
      let acc = (this.emitAcc.get(i) ?? 0) + e.rate * dt;
      while (acc >= 1) {
        acc -= 1;
        const r = Math.random;
        switch (e.kind) {
          case 'flame':
            fx.particle(e.x + (r() - 0.5) * 3, e.z + (r() - 0.5) * 3, { z: e.y + r() * 2, vx: (r() - 0.5) * 8, vy: (r() - 0.5) * 8, vz: 26 + r() * 22, max: 0.45 + r() * 0.3, size: 3.6 + r() * 2.4, color: r() < 0.35 ? '#ffe08a' : e.color, kind: 'ember', drag: 0.6 });
            break;
          case 'smoke':
            fx.particle(e.x + (r() - 0.5) * 4, e.z + (r() - 0.5) * 4, { z: e.y, vx: 6 + (r() - 0.5) * 8, vy: (r() - 0.5) * 6, vz: 16 + r() * 10, max: 2.2 + r(), size: 7 + r() * 5, color: e.color, kind: 'smoke', drag: 0.3, add: false });
            break;
          case 'fountain': {
            const a = r() * Math.PI * 2;
            const s = 10 + r() * 16;
            fx.particle(e.x, e.z, { z: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 34 + r() * 26, max: 0.9, size: 1.9 + r() * 1.4, color: e.color, kind: 'spark', drag: 0.2, grav: 150 });
            break;
          }
          case 'portal': {
            const a = r() * Math.PI * 2;
            fx.particle(e.x + Math.cos(a) * 26, e.z + 2, { z: e.y + Math.sin(a) * 30, vx: -Math.cos(a) * 26, vy: 0, vz: -Math.sin(a) * 30, max: 0.9, size: 2.6, color: e.color, kind: 'glow', drag: 0.4 });
            break;
          }
          case 'ember':
            fx.particle(e.x + (r() - 0.5) * 8, e.z + (r() - 0.5) * 4, { z: e.y, vx: (r() - 0.5) * 30, vy: (r() - 0.5) * 14, vz: 40 + r() * 50, max: 0.7 + r() * 0.5, size: 1.8, color: e.color, kind: 'spark', drag: 0.8, grav: 60 });
            break;
          default:
            fx.particle(e.x + (r() - 0.5) * 14, e.z + (r() - 0.5) * 8, { z: e.y + (r() - 0.5) * 20, vz: 14, max: 0.8, size: 2.2, color: e.color, kind: 'glow', drag: 1 });
        }
      }
      this.emitAcc.set(i, acc);
    }
  }

  private particles(f: TerrainField): void {
    const parts = fx.parts;
    const aP = this.pAdd.geometry.getAttribute('position') as THREE.BufferAttribute;
    const aC = this.pAdd.geometry.getAttribute('aCol') as THREE.BufferAttribute;
    const aS = this.pAdd.geometry.getAttribute('aSize') as THREE.BufferAttribute;
    const mP = this.pMix.geometry.getAttribute('position') as THREE.BufferAttribute;
    const mC = this.pMix.geometry.getAttribute('aCol') as THREE.BufferAttribute;
    const mS = this.pMix.geometry.getAttribute('aSize') as THREE.BufferAttribute;
    let na = 0;
    let nm = 0;
    const start = Math.max(0, parts.length - this.maxP);
    for (let i = start; i < parts.length; i++) {
      const p = parts[i];
      const a = clamp(p.life / p.max, 0, 1);
      const c = col(p.color);
      const y = f.groundY(p.x, p.y) + p.z;
      if (p.kind === 'dust' || p.kind === 'smoke') {
        if (nm >= this.maxP) continue;
        mP.setXYZ(nm, p.x, y, p.y);
        mC.setXYZW(nm, c.r, c.g, c.b, a * (p.kind === 'smoke' ? 0.55 : 0.5));
        mS.setXY(nm, p.size * (3.4 - a * 1.4), 2);
        nm++;
      } else {
        if (na >= this.maxP) continue;
        aP.setXYZ(na, p.x, y, p.y);
        const glow = p.kind === 'glow' || p.kind === 'heal' || p.kind === 'ember';
        const gain = glow ? 2.6 : 3.4;
        aC.setXYZW(na, c.r * gain, c.g * gain, c.b * gain, a);
        aS.setXY(na, glow ? p.size * 3.2 : p.size * 1.7, glow ? 0 : 1);
        na++;
      }
    }
    // star glints share the additive buffer
    for (const g of fx.glints) {
      if (na >= this.maxP) break;
      const k = g.t / g.life;
      const s = g.size * (k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6) + 2;
      const c = col(g.color);
      aP.setXYZ(na, g.x, f.groundY(g.x, g.y + 18) + 18, g.y + 18);
      aC.setXYZW(na, c.r * 3 + 1.5, c.g * 3 + 1.5, c.b * 3 + 1.5, 1);
      aS.setXY(na, s * 1.5, 3);
      na++;
    }
    aP.needsUpdate = aC.needsUpdate = aS.needsUpdate = true;
    mP.needsUpdate = mC.needsUpdate = mS.needsUpdate = true;
    this.pAdd.geometry.setDrawRange(0, na);
    this.pMix.geometry.setDrawRange(0, nm);
  }

  private ribbons(f: TerrainField): void {
    const g = this.ribbon.geometry;
    const P = g.getAttribute('position') as THREE.BufferAttribute;
    const C = g.getAttribute('color') as THREE.BufferAttribute;
    const list = fx.ribbons;
    const n = Math.min(MAX_RIBBONS, list.length);
    for (let r = 0; r < n; r++) {
      const rb = list[list.length - n + r];
      const k = rb.t / rb.life;
      const reveal = Math.min(1, rb.t / 0.05);
      const last = Math.max(1, Math.floor(SEG * reveal));
      const fade = 1 - k;
      const w = rb.w * (1 - 0.5 * k) * 1.15;
      const c1 = col(rb.color);
      const c2 = col(rb.color2);
      const o = r * (SEG + 1) * 3;
      // un-squash the 2D projection back onto the ground plane, blade height above it
      const gz = (i: number): number => rb.cy + (rb.ys[i] + 14 - rb.cy) / rb.sq;
      const gy = f.groundY(rb.xs[0], gz(0)) + 15;
      for (let i = 0; i <= SEG; i++) {
        const j = Math.min(i, last);
        const x = rb.xs[j];
        const z = gz(j);
        const a = Math.max(0, j - 1);
        const b = Math.min(SEG, j + 1);
        let tx = rb.xs[b] - rb.xs[a];
        let tz = gz(b) - gz(a);
        const l = Math.hypot(tx, tz) || 1;
        tx /= l;
        tz /= l;
        const ww = i > last ? 0 : rb.wp[j] * w * 0.5;
        const nx = -tz * ww;
        const nz = tx * ww;
        const lift = Math.sin((j / SEG) * Math.PI) * 3;
        const v = o + i * 3;
        P.setXYZ(v, x + nx, gy + lift - 1.2, z + nz);
        P.setXYZ(v + 1, x, gy + lift, z);
        P.setXYZ(v + 2, x - nx, gy + lift - 1.2, z - nz);
        const al = i > last ? 0 : fade;
        C.setXYZW(v, c1.r * 1.6, c1.g * 1.6, c1.b * 1.6, al * 0.25);
        C.setXYZW(v + 1, c2.r * 3.2 + c1.r, c2.g * 3.2 + c1.g, c2.b * 3.2 + c1.b, al);
        C.setXYZW(v + 2, c1.r * 1.6, c1.g * 1.6, c1.b * 1.6, al * 0.25);
      }
    }
    P.needsUpdate = C.needsUpdate = true;
    g.setDrawRange(0, n * SEG * 12);
  }

  /** a glowing segment drawn as two crossed quads */
  private seg(i: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, w: number, c: THREE.Color, gain: number, alpha: number): number {
    if (i >= MAX_LINES) return i;
    const P = this.lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const C = this.lines.geometry.getAttribute('color') as THREE.BufferAttribute;
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const l = Math.hypot(dx, dy, dz) || 1;
    // one perpendicular in the ground plane, one vertical-ish
    let px = -dz / l;
    let pz = dx / l;
    if (Math.abs(px) + Math.abs(pz) < 0.01) {
      px = 1;
      pz = 0;
    }
    const o = i * 8;
    P.setXYZ(o, ax + px * w, ay, az + pz * w);
    P.setXYZ(o + 1, ax - px * w, ay, az - pz * w);
    P.setXYZ(o + 2, bx - px * w, by, bz - pz * w);
    P.setXYZ(o + 3, bx + px * w, by, bz + pz * w);
    const ux = (dy * pz - dz * 0) / l;
    const uy = (dz * px - dx * pz) / l;
    const uz = (dx * 0 - dy * px) / l;
    P.setXYZ(o + 4, ax + ux * w, ay + uy * w, az + uz * w);
    P.setXYZ(o + 5, ax - ux * w, ay - uy * w, az - uz * w);
    P.setXYZ(o + 6, bx - ux * w, by - uy * w, bz - uz * w);
    P.setXYZ(o + 7, bx + ux * w, by + uy * w, bz + uz * w);
    for (let k = 0; k < 8; k++) C.setXYZW(o + k, c.r * gain, c.g * gain, c.b * gain, alpha);
    return i + 1;
  }

  private linesAndRain(f: TerrainField, t: number): void {
    let n = 0;
    for (const b of fx.bolts) {
      const a = 1 - b.t / b.life;
      const c = col(b.color);
      const gy = f.groundY(b.pts[0], b.pts[1] + 20) + 20;
      for (let i = 0; i + 3 < b.pts.length; i += 2) {
        const jy = (i % 4 ? 1 : -1) * 3;
        n = this.seg(n, b.pts[i], gy + jy, b.pts[i + 1] + 20, b.pts[i + 2], gy - jy, b.pts[i + 3] + 20, 1.5, c, 4 + a * 3, a);
      }
    }
    const gold = col('#ffe0a0');
    for (const r of G.world.rains) {
      const gy = f.groundY(r.x, r.y);
      for (const d of r.drops) {
        const k = d.t / 0.22;
        const h = 190 * (1 - k);
        n = this.seg(n, d.x + 18 * (1 - k), gy + h + 22, d.y, d.x + 18 * (1 - k) - 3, gy + h, d.y, 0.8, gold, 3.4, 1);
      }
    }
    // monster beam telegraphs
    for (const tl of G.world.teles) {
      if (!tl.beam || tl.shape.kind !== 'line') continue;
      const s = tl.shape;
      const gy = f.groundY(s.x, s.y) + 16;
      const c = col(tl.color);
      n = this.seg(n, s.x, gy, s.y, s.x + Math.cos(s.a) * s.len, gy, s.y + Math.sin(s.a) * s.len, s.w * 0.55, c, 2.6, 0.75);
      n = this.seg(n, s.x, gy, s.y, s.x + Math.cos(s.a) * s.len, gy, s.y + Math.sin(s.a) * s.len, s.w * 0.16, this.c3.set(1, 1, 1), 5, 1);
      this.extraLights.push({ id: 'beam' + tl.owner, x: s.x + Math.cos(s.a) * s.len * 0.4, y: gy, z: s.y + Math.sin(s.a) * s.len * 0.4, r: 160, color: c, power: 1.2 });
    }
    void t;
    const g = this.lines.geometry;
    g.getAttribute('position').needsUpdate = true;
    g.getAttribute('color').needsUpdate = true;
    g.setDrawRange(0, n * 12);
  }

  private shardsAndRings(f: TerrainField): void {
    let n = 0;
    for (const s of fx.shards) {
      if (n >= MAX_SHARDS) break;
      const k = s.t / s.life;
      const r = s.size * (1 - k * 0.4);
      this.e3.set(s.spin, s.rot, s.rot * 0.7);
      this.mtx.compose(this.v3.set(s.x, f.groundY(s.x, s.y) + s.z + 8, s.y), this.q4.setFromEuler(this.e3), this.s3.set(r, r, r));
      this.shards.setMatrixAt(n, this.mtx);
      const c = col(s.color);
      const a = (1 - k) * 1.7;
      this.shards.setColorAt(n, this.c3.setRGB(c.r * a + a * 0.2, c.g * a + a * 0.2, c.b * a + a * 0.2));
      n++;
    }
    this.shards.count = n;
    this.shards.instanceMatrix.needsUpdate = true;
    if (this.shards.instanceColor) this.shards.instanceColor.needsUpdate = true;
    let m = 0;
    for (const r of fx.rings) {
      if (m >= MAX_RINGS) break;
      const k = r.t / r.life;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - k, 3));
      this.mtx.makeScale(rad, 1, rad).setPosition(r.x, f.groundY(r.x, r.y) + 1.2, r.y);
      this.rings.setMatrixAt(m, this.mtx);
      const c = col(r.color);
      const a = (1 - k) * (1.4 + r.w * 0.22);
      this.rings.setColorAt(m, this.c3.setRGB(c.r * a, c.g * a, c.b * a));
      m++;
    }
    this.rings.count = m;
    this.rings.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
  }

  private decalsUpdate(f: TerrainField, t: number): void {
    let n = 0;
    const next = (): Decal | null => (n < DECALS ? this.decals[n++] : null);
    const w = G.world;
    for (const tl of w.teles) {
      if (tl.beam) continue;
      const d = next();
      if (!d) break;
      const s = tl.shape;
      const u = d.mat.uniforms;
      (u.uCol.value as THREE.Color).copy(col(tl.color)).multiplyScalar(1.6);
      u.uK.value = Math.min(1, tl.t / tl.dur);
      u.uTime.value = t;
      u.uAlpha.value = 1;
      u.uSwirl.value = 0;
      const gy = f.groundY(s.x, s.y) + 0.7;
      d.mesh.visible = true;
      d.mesh.rotation.set(0, 0, 0);
      if (s.kind === 'circle') {
        u.uShape.value = 0;
        d.mesh.position.set(s.x, gy, s.y);
        d.mesh.scale.set(s.r * 2, 1, s.r * 2);
      } else if (s.kind === 'ring') {
        u.uShape.value = 1;
        u.uInner.value = s.inner / s.r;
        d.mesh.position.set(s.x, gy, s.y);
        d.mesh.scale.set(s.r * 2, 1, s.r * 2);
      } else if (s.kind === 'cone') {
        u.uShape.value = 2;
        u.uArc.value = s.arc;
        d.mesh.position.set(s.x, gy, s.y);
        d.mesh.scale.set(s.r * 2, 1, s.r * 2);
        d.mesh.rotation.y = -s.a;
      } else {
        u.uShape.value = 3;
        d.mesh.position.set(s.x + Math.cos(s.a) * s.len * 0.5, gy, s.y + Math.sin(s.a) * s.len * 0.5);
        d.mesh.scale.set(s.len, 1, s.w);
        d.mesh.rotation.y = -s.a;
      }
    }
    for (const z of w.zones) {
      const d = next();
      if (!d) break;
      const s = z.spec;
      const k = Math.min(1, z.t / 0.25) * (z.t > s.dur - 0.4 ? (s.dur - z.t) / 0.4 : 1);
      const u = d.mat.uniforms;
      (u.uCol.value as THREE.Color).copy(col(s.color)).multiplyScalar(1.5);
      u.uShape.value = 0;
      u.uK.value = 0;
      u.uTime.value = t;
      u.uAlpha.value = k;
      u.uSwirl.value = s.kind === 'vortex' ? -1.4 : 1;
      d.mesh.visible = true;
      d.mesh.rotation.set(0, 0, 0);
      d.mesh.position.set(s.x, f.groundY(s.x, s.y) + 0.8, s.y);
      d.mesh.scale.set(s.r * 2, 1, s.r * 2);
      if (!G.game.paused && Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * s.r;
        fx.particle(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, { z: 2, vz: 26 + Math.random() * 30, max: 0.7, size: 2.4, color: s.color, kind: 'glow', drag: 0.5 });
      }
    }
    for (const tr of w.traps) {
      const d = next();
      if (!d) break;
      const u = d.mat.uniforms;
      (u.uCol.value as THREE.Color).copy(col('#ffb35c')).multiplyScalar(1.6);
      u.uShape.value = 1;
      u.uInner.value = 0.55;
      u.uK.value = 0.5 + 0.5 * Math.sin(t * 6);
      u.uTime.value = t;
      u.uAlpha.value = 1;
      u.uSwirl.value = 0;
      d.mesh.visible = true;
      d.mesh.rotation.set(0, t, 0);
      d.mesh.position.set(tr.x, f.groundY(tr.x, tr.y) + 0.8, tr.y);
      d.mesh.scale.set(40, 1, 40);
    }
    // meteor impact markers
    for (const pr of w.projectiles) {
      if (pr.spec.kind !== 'meteor') continue;
      const d = next();
      if (!d) break;
      const r = pr.spec.aoe ?? 80;
      const u = d.mat.uniforms;
      (u.uCol.value as THREE.Color).copy(col('#ff7a3d')).multiplyScalar(1.8);
      u.uShape.value = 0;
      u.uK.value = Math.min(1, pr.t / 0.6);
      u.uTime.value = t;
      u.uAlpha.value = 1;
      u.uSwirl.value = 0;
      d.mesh.visible = true;
      d.mesh.rotation.set(0, 0, 0);
      d.mesh.position.set(pr.x, f.groundY(pr.x, pr.y) + 0.8, pr.y);
      d.mesh.scale.set(r * 2, 1, r * 2);
    }
    for (let i = n; i < DECALS; i++) this.decals[i].mesh.visible = false;
  }

  // ------------------------------------------------------------------------------ weather

  private makeAmbient(kind: string, count: number, streak: boolean): Ambient {
    const seeds = new Float32Array(count * (streak ? 2 : 1) * 3);
    const pos = new Float32Array(count * (streak ? 2 : 1) * 3);
    for (let i = 0; i < count; i++) {
      const sx = Math.random();
      const sy = Math.random();
      const sz = Math.random();
      if (streak) {
        seeds.set([sx, sy, sz, sx, sy, sz], i * 6);
        pos.set([0, 0, 0, 0.16, 1, 0.05], i * 6);
      } else seeds.set([sx, sy, sz], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    const mat = new THREE.ShaderMaterial({
      vertexShader: AMBIENT_VERT, fragmentShader: AMBIENT_FRAG, transparent: true, depthWrite: false, premultipliedAlpha: true,
      blending: kind === 'ember' || kind === 'mote' || kind === 'firefly' ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(900, 240, 760) }, uVel: { value: new THREE.Vector3() },
        uSway: { value: 0 }, uPx: { value: 800 }, uSize: { value: 3 }, uStreak: { value: 0 }, uCol: { value: new THREE.Color() }, uAlpha: { value: 1 }, uTwinkle: { value: 0 }, uRound: { value: 1 },
      },
    });
    const obj = streak ? new THREE.LineSegments(g, mat) : new THREE.Points(g, mat);
    obj.frustumCulled = false;
    obj.renderOrder = 9;
    this.group.add(obj);
    return { obj, mat, kind };
  }

  private weather(eng: Engine3D, t: number, px: number): void {
    const m = G.world.map;
    let kind: string = m.ambient;
    if (kind === 'firefly' && !isNight(G.save.time) && G.save.time > 7) kind = 'leaf';
    const w = m.outdoor ? G.world.weather : 'clear';
    if (w === 'blizzard') kind = 'snow';
    const rainy = w === 'rain' || w === 'storm';
    const key = `${m.id}|${kind}|${w}`;
    if (key !== this.ambientKey) {
      this.ambientKey = key;
      for (const a of this.ambient) {
        a.obj.removeFromParent();
        (a.obj as THREE.Points).geometry.dispose();
        a.mat.dispose();
      }
      this.ambient = [];
      const dens = this.q.particles / 1400;
      const set = (a: Ambient, color: string, gain: number, size: number, vel: [number, number, number], sway: number, alpha: number, twinkle = 0, round = 1): void => {
        const u = a.mat.uniforms;
        (u.uCol.value as THREE.Color).copy(col(color)).multiplyScalar(gain);
        u.uSize.value = size;
        (u.uVel.value as THREE.Vector3).set(vel[0], vel[1], vel[2]);
        u.uSway.value = sway;
        u.uAlpha.value = alpha;
        u.uTwinkle.value = twinkle;
        u.uRound.value = round;
        this.ambient.push(a);
      };
      if (kind === 'blossom') set(this.makeAmbient(kind, Math.round(260 * dens), false), '#ffc4dc', 1, 3.4, [22, -20, 12], 22, 0.92);
      else if (kind === 'leaf') set(this.makeAmbient(kind, Math.round(180 * dens), false), m.realm === 1 ? '#5fd8b8' : '#8fd070', 1, 3.2, [20, -18, 10], 20, 0.85);
      else if (kind === 'ember') set(this.makeAmbient(kind, Math.round(300 * dens), false), '#ff9a3d', 3, 2.6, [6, 26, 4], 14, 0.9, 0.5, 2);
      else if (kind === 'snow') set(this.makeAmbient(kind, Math.round((w === 'blizzard' ? 1300 : 520) * dens), false), '#ffffff', 1, 2.4, w === 'blizzard' ? [90, -70, 30] : [10, -30, 6], 16, 0.9);
      else if (kind === 'mote') set(this.makeAmbient(kind, Math.round(220 * dens), false), '#fff1a8', 2.4, 2.4, [3, 9, 2], 18, 0.8, 0.6, 2);
      else if (kind === 'firefly') set(this.makeAmbient(kind, Math.round(140 * dens), false), '#c9ff8a', 3.4, 3, [2, 1, 2], 26, 0.9, 1, 2);
      else if (kind === 'dust') set(this.makeAmbient(kind, Math.round(160 * dens), false), '#d8ccb4', 1, 1.8, [3, 2, 2], 12, 0.3);
      if (rainy) {
        const a = this.makeAmbient('rain', Math.round((w === 'storm' ? 2200 : 1300) * dens), true);
        a.mat.uniforms.uStreak.value = 16;
        set(a, '#b4c8eb', 1.3, 1, [70, -620, 20], 0, 0.42, 0, 0);
      }
    }
    for (const a of this.ambient) {
      const u = a.mat.uniforms;
      u.uTime.value = t;
      u.uPx.value = px;
      (u.uCenter.value as THREE.Vector3).set(eng.cam.x, 0, eng.cam.y - 40);
    }
    // rain splashes on the ground around the Diver
    if (rainy && !G.game.paused && Math.random() < 0.7) {
      const p = G.player;
      fx.ring(p.x + (Math.random() - 0.5) * 520, p.y + (Math.random() - 0.5) * 400, '#bfe6ff', 1, 7, 0.32, 1.2);
    }
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | undefined;
      mat?.dispose?.();
    });
    this.group.removeFromParent();
  }
}
