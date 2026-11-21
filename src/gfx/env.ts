// Lighting & atmosphere of the 3D renderer: a physically based sun / moon that follows the game
// clock with a camera-fitted shadow map, hemisphere sky light, image-based lighting regenerated
// from a procedural sky, weather response, fog and a pooled set of dynamic point lights.
import * as THREE from 'three';
import { G } from '../core/state';
import { REALMS } from '../data/realms';
import { RARITY_COLORS } from '../data/constants';
import { itemDef } from '../data/items';
import { col, shared } from './util3';

export interface Key {
  h: number;
  /** sun azimuth (deg, + = from the east) and elevation (deg) */
  az: number;
  el: number;
  sun: [number, number, number];
  si: number;
  sky: [number, number, number];
  ground: [number, number, number];
  hi: number;
  fog: [number, number, number];
  exposure: number;
}

const KEYS: Key[] = [
  { h: 0, az: -48, el: 52, sun: [0.46, 0.6, 1.0], si: 1.55, sky: [0.13, 0.21, 0.46], ground: [0.05, 0.07, 0.14], hi: 1.3, fog: [0.035, 0.06, 0.15], exposure: 1.18 },
  { h: 4.6, az: -48, el: 52, sun: [0.46, 0.6, 1.0], si: 1.55, sky: [0.13, 0.21, 0.46], ground: [0.05, 0.07, 0.14], hi: 1.3, fog: [0.035, 0.06, 0.15], exposure: 1.18 },
  { h: 5.3, az: 78, el: 4, sun: [1.0, 0.42, 0.2], si: 0.2, sky: [0.3, 0.26, 0.46], ground: [0.1, 0.08, 0.1], hi: 0.9, fog: [0.3, 0.22, 0.3], exposure: 1.1 },
  { h: 6.2, az: 72, el: 11, sun: [1.0, 0.56, 0.3], si: 2.6, sky: [0.56, 0.5, 0.66], ground: [0.26, 0.2, 0.18], hi: 0.9, fog: [0.72, 0.5, 0.46], exposure: 1.0 },
  { h: 8, az: 58, el: 30, sun: [1.0, 0.86, 0.68], si: 3.4, sky: [0.5, 0.68, 1.0], ground: [0.3, 0.28, 0.2], hi: 1.0, fog: [0.6, 0.74, 0.9], exposure: 1.0 },
  { h: 12, az: 18, el: 58, sun: [1.0, 0.96, 0.88], si: 3.8, sky: [0.46, 0.66, 1.0], ground: [0.34, 0.32, 0.24], hi: 1.05, fog: [0.58, 0.74, 0.94], exposure: 1.0 },
  { h: 15.5, az: -40, el: 40, sun: [1.0, 0.9, 0.72], si: 3.5, sky: [0.5, 0.66, 0.98], ground: [0.32, 0.3, 0.22], hi: 1.0, fog: [0.62, 0.72, 0.88], exposure: 1.0 },
  { h: 17.8, az: -66, el: 14, sun: [1.0, 0.58, 0.28], si: 3.0, sky: [0.62, 0.48, 0.62], ground: [0.28, 0.2, 0.18], hi: 0.95, fog: [0.8, 0.5, 0.38], exposure: 1.0 },
  { h: 19.0, az: -76, el: 4, sun: [1.0, 0.36, 0.16], si: 0.9, sky: [0.4, 0.3, 0.52], ground: [0.14, 0.1, 0.14], hi: 0.9, fog: [0.42, 0.26, 0.34], exposure: 1.08 },
  { h: 19.5, az: -48, el: 52, sun: [0.42, 0.56, 1.0], si: 0.15, sky: [0.16, 0.2, 0.44], ground: [0.05, 0.06, 0.12], hi: 0.95, fog: [0.08, 0.1, 0.2], exposure: 1.15 },
  { h: 20.4, az: -48, el: 52, sun: [0.46, 0.6, 1.0], si: 1.55, sky: [0.13, 0.21, 0.46], ground: [0.05, 0.07, 0.14], hi: 1.3, fog: [0.035, 0.06, 0.15], exposure: 1.18 },
  { h: 24, az: -48, el: 52, sun: [0.46, 0.6, 1.0], si: 1.55, sky: [0.13, 0.21, 0.46], ground: [0.05, 0.07, 0.14], hi: 1.3, fog: [0.035, 0.06, 0.15], exposure: 1.18 },
];

function lerp3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function sampleKeys(h: number): Key {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (h - a.h) / Math.max(0.0001, b.h - a.h)));
  // direction snaps between sun and moon while the light is nearly off
  const snap = Math.abs(a.az - b.az) > 100;
  return {
    h,
    az: snap ? (t < 0.5 ? a.az : b.az) : a.az + (b.az - a.az) * t,
    el: snap ? (t < 0.5 ? a.el : b.el) : a.el + (b.el - a.el) * t,
    sun: snap ? (t < 0.5 ? a.sun : b.sun) : lerp3(a.sun, b.sun, t),
    si: snap ? (t < 0.5 ? a.si * (1 - t * 2) : b.si * (t * 2 - 1)) : a.si + (b.si - a.si) * t,
    sky: lerp3(a.sky, b.sky, t),
    ground: lerp3(a.ground, b.ground, t),
    hi: a.hi + (b.hi - a.hi) * t,
    fog: lerp3(a.fog, b.fog, t),
    exposure: a.exposure + (b.exposure - a.exposure) * t,
  };
}

export interface LightSrc {
  id: string;
  x: number;
  y: number;
  z: number;
  r: number;
  color: THREE.Color;
  power: number;
}

interface Slot {
  light: THREE.PointLight;
  id: string | null;
  k: number;
  target: number;
}

const ORE_GLOW = new Set(['ore_mithril', 'ore_starlight', 'ore_voidsteel', 'ore_crimson', 'ore_orichalcum']);

export class Environment {
  readonly sun = new THREE.DirectionalLight(0xffffff, 3);
  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  readonly fog = new THREE.FogExp2(0x88aacc, 0.0006);
  /** direction toward the light source */
  readonly sunDir = new THREE.Vector3(0.3, 0.8, 0.5);
  readonly sunColor = new THREE.Color(1, 1, 1);
  readonly skyColor = new THREE.Color(0.5, 0.7, 1);
  readonly fogColor = new THREE.Color(0.6, 0.75, 0.9);
  sunIntensity = 3;
  /** 0 = lamps off (bright day), 1 = fully dark */
  night = 0;
  exposure = 1;
  /** strength of volumetric light shafts */
  shafts = 0.5;
  fogDensity = 0.5;
  indoor = false;
  /** scales every local light: pale floors need less of it, dark stone more */
  localGain = 1;
  wet = 0;
  private slots: Slot[] = [];
  private pmrem: THREE.PMREMGenerator;
  private skyScene = new THREE.Scene();
  private skyMat: THREE.ShaderMaterial;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private envKey = '';
  private lightningK = 0;
  shadowSize = 2048;
  shadowsOn = true;
  /** image-based lighting; off on the laptop preset to save per-pixel work */
  ibl = true;

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer, poolSize: number) {
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 1.6;
    this.sun.shadow.radius = 2.5;
    scene.add(this.sun, this.sun.target, this.hemi);
    scene.fog = this.fog;
    for (let i = 0; i < poolSize; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 200, 1.6);
      l.castShadow = false;
      scene.add(l);
      this.slots.push({ light: l, id: null, k: 0, target: 0 });
    }
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */ `
        varying vec3 vD; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uBot; uniform vec3 uSun; uniform vec3 uSunCol;
        void main(){
          vec3 d = normalize(vD);
          float up = d.y;
          vec3 c = up > 0.0 ? mix(uHor, uTop, pow(up, 0.55)) : mix(uHor, uBot, pow(-up, 0.4));
          float s = max(dot(d, normalize(uSun)), 0.0);
          c += uSunCol * (pow(s, 600.0) * 40.0 + pow(s, 24.0) * 0.6);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.skyScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), this.skyMat));
  }

  setShadows(on: boolean, size: number): void {
    this.shadowsOn = on;
    this.sun.castShadow = on;
    if (size !== this.shadowSize) {
      this.shadowSize = size;
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        (this.sun.shadow as unknown as { map: unknown }).map = null;
      }
    }
  }

  /** updates sun, sky, fog and exposure from the game clock, the map kind and the weather */
  update(dt: number, target: THREE.Vector3, viewSpan: number): void {
    const m = G.world.map;
    const s = G.save;
    const R = REALMS[m.realm];
    const k = sampleKeys(((s?.time ?? 12) % 24 + 24) % 24);
    const outdoor = m.outdoor;
    this.indoor = !outdoor;
    let si = k.si;
    let hi = k.hi;
    let sky = k.sky;
    let ground = k.ground;
    let fog = k.fog;
    let sunC = k.sun;
    let az = k.az;
    let el = k.el;
    let exposure = k.exposure;
    let density = 0.00042;
    const h = s?.time ?? 12;
    let night = 0;
    if (h >= 20 || h < 5) night = 1;
    else if (h >= 17) night = (h - 17) / 3;
    else if (h < 7) night = (7 - h) / 2;
    this.shafts = 0.55;
    this.localGain = 1;
    if (!outdoor) {
      if (m.kind === 'house') {
        si = 1.3;
        sunC = [1.0, 0.92, 0.8];
        az = 30;
        el = 52;
        sky = [0.82, 0.78, 0.72];
        ground = [0.34, 0.29, 0.25];
        hi = 1.15 - night * 0.4;
        fog = [0.08, 0.06, 0.05];
        density = 0.0001;
        night = 0.7;
        exposure = 1.0;
        this.shafts = 0.25;
      } else {
        // dungeons and the Abyss: no sun, a faint top light for readability, torches do the work
        const abyss = m.kind === 'abyss';
        const tint = col(abyss ? '#6a4ab8' : R.palette.dunTop);
        si = 1.25;
        sunC = [tint.r * 0.5 + 0.5, tint.g * 0.5 + 0.5, tint.b * 0.5 + 0.55];
        az = 24;
        el = 64;
        sky = [tint.r * 0.8 + 0.2, tint.g * 0.8 + 0.2, tint.b * 0.8 + 0.26];
        ground = [tint.r * 0.4 + 0.05, tint.g * 0.4 + 0.05, tint.b * 0.45 + 0.07];
        hi = 1.35;
        // dark-stoned realms get more top light and pale ones less, so every dungeon reads alike
        const fl = col(R.palette.floor);
        const lum = 0.2126 * fl.r + 0.7152 * fl.g + 0.0722 * fl.b;
        const lift = Math.min(2.9, Math.max(0.75, Math.pow(0.11 / Math.max(0.01, lum), 0.78)));
        si *= lift;
        hi *= lift;
        this.localGain = Math.min(1.5, Math.max(0.45, Math.sqrt(0.11 / Math.max(0.01, lum))));
        fog = [tint.r * 0.06, tint.g * 0.06, tint.b * 0.09];
        density = 0.00062;
        night = 0.62;
        exposure = 1.22;
        this.shafts = 0.9;
      }
    } else {
      const w = G.world.weather;
      const realmFog = R.palette.liquid === 'lava' ? [0.5, 0.2, 0.1] : null;
      if (realmFog) {
        fog = lerp3(fog, realmFog as [number, number, number], 0.55);
        density *= 1.5;
      }
      if (m.realm === 1) {
        // the Twilight Forest is always dim and misty
        si *= 0.75;
        fog = lerp3(fog, [0.1, 0.24, 0.26], 0.55);
        density *= 1.9;
        night = Math.max(night, 0.45);
        this.shafts = 1.0;
      }
      if (w === 'rain' || w === 'storm') {
        const storm = w === 'storm';
        si *= storm ? 0.35 : 0.55;
        hi *= 0.85;
        sky = lerp3(sky, [0.36, 0.4, 0.46], 0.7);
        // a dark, thin haze reads as rain; a bright dense one only washes the picture out
        fog = lerp3(fog, storm ? [0.14, 0.17, 0.23] : [0.2, 0.24, 0.3], 0.75);
        density *= storm ? 1.9 : 1.55;
        night = Math.max(night, 0.35);
      } else if (w === 'blizzard') {
        si *= 0.5;
        sky = lerp3(sky, [0.8, 0.86, 0.95], 0.7);
        fog = lerp3(fog, [0.8, 0.86, 0.95], 0.85);
        density *= 5;
      } else if (w === 'ash') {
        si *= 0.7;
        fog = lerp3(fog, [0.42, 0.2, 0.12], 0.7);
        density *= 2.4;
        night = Math.max(night, 0.2);
      }
      this.wet += (((w === 'rain' || w === 'storm') ? 1 : 0) - this.wet) * Math.min(1, dt * 0.4);
    }
    if (!outdoor) this.wet = 0;
    // lightning: a sharp white spike of sky light
    const lg = G.world.lightning;
    this.lightningK = lg;
    if (lg > 0.01) {
      hi += lg * 3.2;
      sky = lerp3(sky, [0.85, 0.9, 1.0], Math.min(1, lg));
    }
    const azr = (az * Math.PI) / 180;
    const elr = (el * Math.PI) / 180;
    this.sunDir.set(Math.cos(elr) * Math.sin(azr), Math.sin(elr), Math.cos(elr) * Math.cos(azr)).normalize();
    this.sunColor.setRGB(sunC[0], sunC[1], sunC[2]);
    this.sunIntensity = si;
    this.skyColor.setRGB(sky[0], sky[1], sky[2]);
    this.fogColor.setRGB(fog[0], fog[1], fog[2]);
    this.night = night;
    this.exposure = exposure;
    this.fogDensity = density;
    this.sun.color.copy(this.sunColor);
    this.sun.intensity = si;
    this.hemi.color.setRGB(sky[0], sky[1], sky[2]);
    this.hemi.groundColor.setRGB(ground[0], ground[1], ground[2]);
    this.hemi.intensity = hi;
    this.fog.color.copy(this.fogColor);
    this.fog.density = density;
    // shadow frustum hugs the visible ground and moves in texel steps
    const span = viewSpan;
    const cam = this.sun.shadow.camera;
    if (cam.right !== span) {
      cam.left = -span;
      cam.right = span;
      cam.top = span;
      cam.bottom = -span;
      cam.near = 20;
      cam.far = 3200;
      cam.updateProjectionMatrix();
    }
    const texel = (span * 2) / this.shadowSize;
    const tx = Math.round(target.x / texel) * texel;
    const tz = Math.round((target.z - span * 0.18) / texel) * texel;
    this.sun.target.position.set(tx, target.y, tz);
    this.sun.position.set(tx + this.sunDir.x * 1500, target.y + this.sunDir.y * 1500, tz + this.sunDir.z * 1500);
    this.sun.target.updateMatrixWorld();
    shared.time.value = G.realTime;
    this.updateEnvMap(sky, ground, sunC, si);
  }

  private updateEnvMap(sky: [number, number, number], ground: [number, number, number], sunC: [number, number, number], si: number): void {
    if (!this.ibl) return;
    const q = (v: number): number => Math.round(v * 14);
    const key = `${q(sky[0])},${q(sky[1])},${q(sky[2])},${q(si * 0.3)},${Math.round(this.sunDir.x * 5)},${Math.round(this.sunDir.y * 5)},${this.lightningK > 0.3 ? 1 : 0}`;
    if (key === this.envKey) return;
    this.envKey = key;
    const u = this.skyMat.uniforms;
    (u.uTop.value as THREE.Color).setRGB(sky[0] * 0.75, sky[1] * 0.8, sky[2]);
    (u.uHor.value as THREE.Color).setRGB(sky[0] * 1.15 + 0.08, sky[1] * 1.1 + 0.08, sky[2] * 1.05 + 0.08);
    (u.uBot.value as THREE.Color).setRGB(ground[0], ground[1], ground[2]);
    (u.uSun.value as THREE.Vector3).copy(this.sunDir);
    (u.uSunCol.value as THREE.Color).setRGB(sunC[0] * si * 0.3, sunC[1] * si * 0.3, sunC[2] * si * 0.3);
    const prev = this.envTarget;
    this.envTarget = this.pmrem.fromScene(this.skyScene, 0.02, 1, 200);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.75;
    if (prev) prev.dispose();
  }

  // ------------------------------------------------------------------------------ dynamic lights

  /** every light source in play, ranked for the dynamic point-light pool */
  collect(groundY: (x: number, y: number) => number): LightSrc[] {
    const out: LightSrc[] = [];
    const w = G.world;
    const m = w.map;
    const p = G.player;
    const lamp = this.night;
    const add = (id: string, x: number, y: number, z: number, r: number, c: string | THREE.Color, power: number): void => {
      if (power <= 0.02) return;
      out.push({ id, x, y: groundY(x, y) + z, z: y, r, color: typeof c === 'string' ? col(c) : c, power });
    };
    const R2 = 760 * 760;
    for (const pr of m.props) {
      if (!pr.light || pr.hidden) continue;
      const dx = pr.x - p.x;
      const dy = pr.y - p.y;
      if (dx * dx + dy * dy > R2) continue;
      const always = pr.kind === 'gate' || pr.kind === 'abyssgate' || pr.kind === 'crystal' || pr.kind === 'dungeon' || pr.kind === 'torch' || pr.kind === 'furniture';
      const fl = pr.light.flicker ? 0.86 + 0.14 * Math.sin(G.realTime * 11 + pr.id * 1.7) * Math.sin(G.realTime * 7.3 + pr.id) : 1;
      const tall = pr.kind === 'lamp' ? 52 : pr.kind === 'tree' ? 46 : pr.kind === 'gate' || pr.kind === 'abyssgate' ? 46 : pr.kind === 'torch' ? 26 : 22;
      add('p' + pr.id, pr.x, pr.y - (pr.kind === 'torch' ? -6 : 0), tall, pr.light.r * 1.5, pr.light.color, (always ? Math.max(0.3, lamp) : lamp) * fl);
    }
    const dark = m.kind === 'dungeon' || m.kind === 'abyss';
    add('player', p.x, p.y, 26, dark ? 230 : 150, '#ffe2bd', dark ? 0.9 : lamp * 0.5);
    for (const pr of w.projectiles) if (pr.spec.kind !== 'arrow' && pr.spec.kind !== 'rock') add('j' + (pr as unknown as { id?: number }).id + pr.x.toFixed(0), pr.x, pr.y, 14 + pr.z, 110, pr.color, 1.2);
    for (const z of w.zones) add('z' + z.spec.x.toFixed(0) + z.spec.y.toFixed(0), z.spec.x, z.spec.y, 14, z.spec.r * 1.6, z.spec.color, 0.8);
    for (const l of w.loots) if (!(l.kind === 'chest' && l.opened)) add('l' + l.id, l.x, l.y, 16, 80 + l.rarity * 14, RARITY_COLORS[l.rarity] ?? '#ffffff', 0.5 + l.rarity * 0.12);
    for (const n of m.nodes) if (n.ready && ORE_GLOW.has(n.item)) add('n' + n.id, n.x, n.y, 12, 90, itemDef(n.item).color, 0.6);
    for (const mo of w.monsters) {
      if (mo.dead) continue;
      if (mo.def.draw === 'wisp' || mo.def.draw === 'imp' || mo.def.element === 'fire' || mo.isBoss) add('m' + mo.id, mo.x, mo.y, 22, mo.isBoss ? 190 : 110, mo.def.colors[2] ?? '#ffb35c', mo.isBoss ? 0.9 : 0.7);
    }
    if (w.pet) add('pet', w.pet.x, w.pet.y, 18 + w.pet.z, 100, w.pet.def.color, 0.7);
    for (const pd of m.pads) add('pad' + pd.x, pd.x, pd.y, 8, 80, '#7fe9ff', 0.6);
    for (const b of w.breakables) if (!b.dead && (b.variant === 'barrel' || b.variant === 'frost')) add('b' + b.id, b.x, b.y, 12, 70, b.variant === 'barrel' ? '#ff7a3d' : '#7fe9ff', 0.45);
    return out;
  }

  /** assigns the strongest nearby sources to the pooled point lights with smooth fades */
  assign(src: LightSrc[], focusX: number, focusZ: number, dt: number): void {
    for (const s of src) {
      const d = Math.hypot(s.x - focusX, s.z - focusZ);
      (s as LightSrc & { score: number }).score = s.power * s.r / (40 + d);
    }
    src.sort((a, b) => (b as LightSrc & { score: number }).score - (a as LightSrc & { score: number }).score);
    const top = src.slice(0, this.slots.length);
    const byId = new Map(top.map((s) => [s.id, s]));
    for (const sl of this.slots) {
      const s = sl.id ? byId.get(sl.id) : undefined;
      if (s) {
        byId.delete(s.id);
        this.apply(sl, s);
      } else sl.target = 0;
    }
    for (const s of byId.values()) {
      const free = this.slots.find((sl) => sl.k <= 0.01 && sl.target === 0);
      if (!free) break;
      free.id = s.id;
      free.k = 0;
      this.apply(free, s);
    }
    const rate = Math.min(1, dt * 7);
    for (const sl of this.slots) {
      sl.k += (sl.target - sl.k) * rate;
      if (sl.target === 0 && sl.k < 0.01) {
        sl.k = 0;
        sl.id = null;
      }
      // never toggle .visible: a changing light count makes three.js relink every shader program
      sl.light.intensity = sl.k;
    }
  }

  private apply(sl: Slot, s: LightSrc): void {
    sl.light.position.set(s.x, s.y, s.z);
    sl.light.color.copy(s.color);
    sl.light.distance = s.r * 1.25;
    // candela so that the lit radius reads as strongly as the sun at its core
    sl.target = s.power * this.localGain * 3.0 * Math.pow(s.r * 0.35, 1.6);
  }

  dispose(): void {
    this.pmrem.dispose();
    this.envTarget?.dispose();
  }
}
