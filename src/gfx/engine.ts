// The 3D renderer. The simulation stays 2D (x east, y south, z height); this engine presents it
// through a tilted perspective camera with physically based lighting, a camera-fitted sun shadow,
// instanced vegetation, pooled dynamic lights and an HDR post-processing stack.
import * as THREE from 'three';
import type { GameMap } from '../world/tilemap';
import { G } from '../core/state';
import { TILE } from '../data/constants';
import { REALMS } from '../data/realms';
import { footsteps } from '../render/v3render';
import { fx } from '../render/fx';
import { clamp, lerp } from '../engine/util';
import { buildDetailLib, type DetailLib } from './textures';
import { QUALITY, type GfxPreset, type Quality } from './quality';
import { Environment } from './env';
import { PostFX, type LookParams } from './post';
import { MapScene } from './mapscene';
import { ActorLayer } from './actors';
import { VfxLayer } from './vfx';
import { bindDetail, shared } from './util3';

const FOV = 26;
const PITCH = (51 * Math.PI) / 180;
/** world units visible across the screen height, measured perpendicular to the view direction */
const BASE_VIEW = 322;

const LOOKS: Record<string, LookParams> = {
  day: { contrast: 1.07, saturation: 1.03, vignette: 0.3, tintLo: [0.95, 0.99, 1.07], tintHi: [1.05, 1.01, 0.95], bloom: 0.8 },
  forest: { contrast: 1.08, saturation: 1.02, vignette: 0.4, tintLo: [0.9, 1.02, 1.08], tintHi: [1.0, 1.04, 0.98], bloom: 1.05 },
  lava: { contrast: 1.12, saturation: 1.04, vignette: 0.42, tintLo: [1.04, 0.95, 0.94], tintHi: [1.08, 1.0, 0.9], bloom: 0.8 },
  ice: { contrast: 1.05, saturation: 1.0, vignette: 0.3, tintLo: [0.94, 0.99, 1.1], tintHi: [1.0, 1.02, 1.05], bloom: 0.9 },
  sky: { contrast: 1.05, saturation: 1.04, vignette: 0.26, tintLo: [0.97, 0.98, 1.08], tintHi: [1.06, 1.03, 0.96], bloom: 0.95 },
  dungeon: { contrast: 1.14, saturation: 1.0, vignette: 0.52, tintLo: [0.92, 0.97, 1.12], tintHi: [1.08, 1.0, 0.92], bloom: 1.2 },
  house: { contrast: 1.05, saturation: 1.02, vignette: 0.36, tintLo: [1.0, 0.98, 0.98], tintHi: [1.06, 1.01, 0.94], bloom: 0.9 },
};

export class Engine3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 40, 9000);
  /** same shape as the classic renderer's camera: (x, y) is the ground point at the screen centre */
  cam = { x: 0, y: 0, zoom: 1, pulse: 0, pulseZ: 1, sx: 0, sy: 0 };
  cssW = 1;
  cssH = 1;
  dpr = 1;
  q: Quality;
  lib: DetailLib;
  env: Environment;
  post: PostFX;
  current: MapScene | null = null;
  readonly actors: ActorLayer;
  readonly vfx: VfxLayer;
  /** mouse-wheel zoom chosen by the player */
  userZoom = 1;
  yaw = 0;
  pitch = PITCH;
  dynScale = 1;
  private maps = new Map<GameMap, MapScene>();
  private focusY = 0;
  private perfAcc = 0;
  private perfFrames = 0;
  private perfGood = 0;
  private lookKey = '';
  private combatZoom = 1;
  private bg = new THREE.Color(0, 0, 0);
  private ray = new THREE.Raycaster();
  private v2 = new THREE.Vector2();
  private v3 = new THREE.Vector3();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private frame = 0;
  lastBuildMs = 0;
  private stats = '';

  constructor(readonly canvas: HTMLCanvasElement, preset: Exclude<GfxPreset, 'classic'>) {
    this.q = QUALITY[preset];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, depth: false, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.info.autoReset = false;
    this.scene.background = this.bg;
    this.lib = buildDetailLib(this.renderer, this.q.detailSize);
    bindDetail(this.lib);
    this.env = new Environment(this.scene, this.renderer, this.q.pointLights);
    this.env.setShadows(this.q.shadows, this.q.shadowSize);
    this.env.ibl = this.q.ibl;
    this.post = new PostFX(this.renderer, this.scene, this.camera, this.q, this.lib.noise);
    this.actors = new ActorLayer(this.scene, this.q);
    this.vfx = new VfxLayer(this.scene, this.q);
  }

  // ------------------------------------------------------------------------------ sizing

  resize(cssW: number, cssH: number): void {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    let dpr = Math.min(window.devicePixelRatio || 1, this.q.maxDpr);
    const px = this.cssW * this.cssH * dpr * dpr;
    if (px > this.q.maxPixels) dpr *= Math.sqrt(this.q.maxPixels / px);
    dpr = Math.max(0.45, dpr * this.dynScale);
    this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.cssW, this.cssH, false);
    this.post.setSize(this.cssW, this.cssH);
    this.camera.aspect = this.cssW / this.cssH;
    this.camera.updateProjectionMatrix();
  }

  /** keeps the frame rate by trading resolution, like the classic renderer does */
  private adaptResolution(dt: number): void {
    this.perfAcc += dt;
    this.perfFrames++;
    if (this.perfAcc < 1.5) return;
    const fps = this.perfFrames / this.perfAcc;
    this.perfAcc = 0;
    this.perfFrames = 0;
    if (fps < 50 && this.dynScale > 0.6) {
      this.dynScale = Math.max(0.6, this.dynScale - 0.1);
      this.perfGood = 0;
      this.resize(this.cssW, this.cssH);
    } else if (fps > 58.5 && this.dynScale < 1) {
      this.perfGood += 1.5;
      if (this.perfGood >= 7.5) {
        this.perfGood = 0;
        this.dynScale = Math.min(1, this.dynScale + 0.1);
        this.resize(this.cssW, this.cssH);
      }
    } else this.perfGood = 0;
  }

  // ------------------------------------------------------------------------------ camera

  get viewPerp(): number {
    const aspect = this.cssW / this.cssH;
    const narrow = aspect < 1.55 ? 1.55 / aspect : 1;
    return (BASE_VIEW * narrow) / (this.cam.zoom * this.cam.pulseZ * this.userZoom * this.combatZoom);
  }

  /** device pixels per world unit at the focus point */
  get zoomScale(): number {
    return (this.cssH * this.dpr) / this.viewPerp;
  }

  private groundY(x: number, y: number): number {
    return this.current ? this.current.field.groundY(x, y) : 0;
  }

  snap(x: number, y: number): void {
    this.cam.x = x;
    this.cam.y = y;
    this.focusY = this.groundY(x, y + 18);
    this.clampCam();
  }

  private clampCam(): void {
    const m = G.world?.map;
    if (!m) return;
    const vp = this.viewPerp;
    const half = (FOV * Math.PI) / 360;
    const dist = vp / (2 * Math.tan(half));
    const hgt = dist * Math.sin(this.pitch);
    const flat = dist * Math.cos(this.pitch);
    // exact ground footprint of the frustum north and south of the focus point
    const hdN = hgt / Math.tan(this.pitch - half) - flat;
    const hdS = flat - hgt / Math.tan(this.pitch + half);
    const hw = (vp / 2) * (this.cssW / this.cssH) * 1.06;
    const over = m.wallStyle === 'cliff' ? 30 : 12;
    this.cam.x = m.pw <= hw * 2 - over * 2 ? m.pw / 2 : clamp(this.cam.x, hw - over, m.pw - hw + over);
    this.cam.y = m.ph <= hdN + hdS - over * 2 ? m.ph / 2 : clamp(this.cam.y, hdN - over, m.ph - hdS + over);
  }

  private placeCamera(): void {
    const vp = this.viewPerp;
    const dist = vp / (2 * Math.tan((FOV * Math.PI) / 360));
    const tx = this.cam.x + this.cam.sx;
    const tz = this.cam.y + this.cam.sy;
    const ty = this.focusY;
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    this.camera.position.set(tx + Math.sin(this.yaw) * cp * dist, ty + sp * dist, tz + Math.cos(this.yaw) * cp * dist);
    this.camera.lookAt(tx, ty, tz);
    this.camera.near = Math.max(20, dist * 0.25);
    this.camera.far = dist * 5 + 2500;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
  }

  update(dt: number): void {
    this.adaptResolution(dt);
    const p = G.player;
    const mw = G.game.mouseWorld();
    const lookX = p.x + (mw.x - p.x) * 0.1;
    const lookY = p.y - 16 + (mw.y - p.y) * 0.1;
    const k = 1 - Math.exp(-dt * 6.5);
    this.cam.x = lerp(this.cam.x, lookX, k);
    this.cam.y = lerp(this.cam.y, lookY, k);
    if (this.cam.pulse > 0) {
      this.cam.pulse -= dt;
      this.cam.pulseZ = lerp(this.cam.pulseZ, this.cam.pulse > 0.25 ? 1.12 : 1, 1 - Math.exp(-dt * 12));
    } else this.cam.pulseZ = lerp(this.cam.pulseZ, 1, 1 - Math.exp(-dt * 8));
    // pull the camera back when a fight gets crowded or a boss is on the field
    const w = G.world;
    let threat = 0;
    for (const mo of w.monsters) if (!mo.dead && Math.abs(mo.x - p.x) < 420 && Math.abs(mo.y - p.y) < 340) threat += mo.isBoss ? 6 : mo.isElite ? 2 : 1;
    const want = w.map.kind === 'city' || w.map.kind === 'house' ? 1.06 : clamp(1 - threat * 0.022, 0.8, 1);
    this.combatZoom = lerp(this.combatZoom, want, 1 - Math.exp(-dt * 1.4));
    const wheel = G.input.wheel;
    if (wheel && !G.game.uiBlocking()) this.userZoom = clamp(this.userZoom * (wheel > 0 ? 0.92 : 1.08), 0.72, 1.5);
    this.focusY = lerp(this.focusY, this.groundY(p.x, p.y), 1 - Math.exp(-dt * 5));
    this.clampCam();
    if (!G.game.paused) footsteps([p, ...w.party, ...w.vanguard, ...w.adventurers, ...w.monsters.filter((m) => !m.def.flying && Math.abs(m.x - p.x) < 500)], w.map, dt);
    const sh = fx.shakeAmt;
    this.cam.sx = sh > 0 ? (Math.random() - 0.5) * sh * 1.6 : 0;
    this.cam.sy = sh > 0 ? (Math.random() - 0.5) * sh * 1.6 : 0;
    if (sh > 4) this.post.impact = Math.max(this.post.impact, Math.min(1, sh / 12));
  }

  /** mouse position (CSS px) -> ground point at the player's elevation */
  screenToWorld(cssX: number, cssY: number): { x: number; y: number } {
    this.v2.set((cssX / this.cssW) * 2 - 1, -((cssY / this.cssH) * 2 - 1));
    this.ray.setFromCamera(this.v2, this.camera);
    this.plane.constant = -this.focusY;
    const hit = this.ray.ray.intersectPlane(this.plane, this.v3);
    if (!hit) return { x: this.cam.x, y: this.cam.y };
    return { x: hit.x, y: hit.z };
  }

  /** world point -> CSS px (z is height above the ground at that point) */
  worldToScreen(x: number, y: number, z = 0): { x: number; y: number; behind: boolean } {
    this.v3.set(x, this.groundY(x, y) + z, y).project(this.camera);
    return { x: (this.v3.x * 0.5 + 0.5) * this.cssW, y: (-this.v3.y * 0.5 + 0.5) * this.cssH, behind: this.v3.z > 1 };
  }

  /** projects a raw 3D point (already lifted) to CSS px */
  project3(x: number, y3: number, z: number): { x: number; y: number } {
    this.v3.set(x, y3, z).project(this.camera);
    return { x: (this.v3.x * 0.5 + 0.5) * this.cssW, y: (-this.v3.y * 0.5 + 0.5) * this.cssH };
  }

  // ------------------------------------------------------------------------------ maps

  private ensureMap(): void {
    const m = G.world.map;
    if (this.current && this.current.map === m) return;
    const t0 = performance.now();
    if (this.current) this.scene.remove(this.current.group);
    let ms = this.maps.get(m);
    if (!ms) {
      ms = new MapScene(m, this.lib, this.q);
      this.maps.set(m, ms);
    }
    ms.lastUsed = ++this.frame;
    this.current = ms;
    this.scene.add(ms.group);
    this.actors.setField(ms.field);
    this.vfx.setScene(ms);
    // keep the three most recent maps, drop the rest
    if (this.maps.size > 3) {
      const old = [...this.maps.values()].filter((x) => x !== ms).sort((a, b) => a.lastUsed - b.lastUsed)[0];
      this.maps.delete(old.map);
      old.dispose();
    }
    this.focusY = this.groundY(G.player.x, G.player.y);
    this.lastBuildMs = performance.now() - t0;
  }

  private applyLook(): void {
    const m = G.world.map;
    const R = REALMS[m.realm];
    const key = m.kind === 'dungeon' || m.kind === 'abyss' ? 'dungeon' : m.kind === 'house' ? 'house' : R.palette.liquid === 'lava' ? 'lava' : m.realm === 1 ? 'forest' : m.realm === 3 ? 'ice' : m.realm === 4 ? 'sky' : 'day';
    if (key === this.lookKey) return;
    this.lookKey = key;
    this.post.setLook(LOOKS[key]);
  }

  // ------------------------------------------------------------------------------ frame

  render(t: number): void {
    const dt = Math.min(0.1, G.game.frameDt);
    this.ensureMap();
    const ms = this.current as MapScene;
    const title = G.game.state !== 'play';
    if (title) {
      // slow cinematic drift over the city for the title screen
      const m = G.world.map;
      const tt = G.realTime;
      this.yaw = Math.sin(tt * 0.045) * 0.5;
      this.pitch = (33 * Math.PI) / 180;
      this.cam.x = m.pw / 2 + Math.sin(tt * 0.06) * 150;
      this.cam.y = m.ph * 0.5 + Math.cos(tt * 0.045) * 90;
      this.cam.zoom = 0.78;
      this.cam.pulseZ = 1;
      this.combatZoom = 1;
      this.userZoomTitle();
      this.focusY = 0;
      this.post.dofBoost = lerp(this.post.dofBoost, 0.55, 0.05);
    } else {
      this.yaw = 0;
      this.pitch = PITCH;
      this.cam.zoom = 1;
      this.post.dofBoost = lerp(this.post.dofBoost, G.game.uiBlocking() ? 0.7 : 0, 1 - Math.exp(-dt * 8));
    }
    this.placeCamera();
    const span = this.q.id === 'low' ? Math.max(260, this.viewPerp * 1.12) : Math.max(300, this.viewPerp * 1.45 + 80);
    this.v3.set(this.cam.x, this.focusY, this.cam.y);
    this.env.update(dt, this.v3, span);
    this.bg.copy(this.env.fogColor).multiplyScalar(this.env.indoor ? 0.3 : 0.9);
    this.applyLook();
    const p = G.player;
    ms.update(dt, this.env, this.cam.x, this.cam.y);
    this.actors.sync(dt, t, this);
    ms.foliage.setPushers(this.actors.pushers);
    this.vfx.sync(dt, t, this, ms);
    const lights = this.env.collect((x, y) => ms.field.groundY(x, y));
    this.vfx.addLights(lights);
    this.env.assign(lights, p.x, p.y, dt);
    // screen-space cut-away so tree crowns never hide the Diver
    if (!title && !p.dead) {
      const sp = this.worldToScreen(p.x, p.y, 20);
      this.v3.set(p.x, this.groundY(p.x, p.y) + 20, p.y).applyMatrix4(this.camera.matrixWorldInverse);
      shared.cut.value.set(sp.x * this.dpr, (this.cssH - sp.y) * this.dpr, 78 * this.dpr * (this.cssH / 720), -this.v3.z);
      shared.fade.value.set(p.x, p.y - 30, 90, 250);
    } else {
      shared.cut.value.set(0, 0, 0, 0);
      shared.fade.value.set(0, 0, 0, 0);
    }
    // depth of field: focus between the Diver and the middle of the view, and widen the sharp
    // band by however far a map edge keeps the two apart, so neither ever drifts out of focus
    const fy = this.groundY(p.x, p.y) + 16;
    this.v3.set(p.x, fy, p.y).applyMatrix4(this.camera.matrixWorldInverse);
    const depthP = -this.v3.z;
    this.v3.set(this.cam.x, fy, this.cam.y).applyMatrix4(this.camera.matrixWorldInverse);
    const spread = Math.abs(depthP + this.v3.z);
    this.post.focus.set((p.x + this.cam.x) / 2, fy, (p.y + this.cam.y) / 2);
    this.post.focusRange = 260 + spread * 0.9;
    if (title) {
      this.post.focus.set(this.cam.x, 10, this.cam.y);
      this.post.focusRange = 260;
    }
    const tr = G.world.transition;
    this.post.fade.set(0, 0, 0, 0);
    if (fx.flashA > 0.01) {
      const c = new THREE.Color(fx.flashColor);
      this.post.fade.set(c.r, c.g, c.b, Math.min(0.6, fx.flashA * 0.6));
    }
    void tr;
    this.stats = `${this.renderer.info.render.calls} calls | ${(this.renderer.info.render.triangles / 1000).toFixed(0)}k tris`;
    this.renderer.info.reset();
    this.post.render(dt, this.env, G.realTime);
  }

  private userZoomTitle(): void {
    this.userZoom = lerp(this.userZoom, 1, 0.1);
  }

  /** a short red pulse at the screen edge when the Diver is hurt */
  hurtPulse(amount: number): void {
    this.post.hurt = Math.min(1, Math.max(this.post.hurt, amount));
  }

  info(): string {
    return `${this.q.label} ${Math.round(this.cssW * this.dpr)}x${Math.round(this.cssH * this.dpr)} | ${this.stats}`;
  }

  setVisible(on: boolean): void {
    this.canvas.style.display = on ? 'block' : 'none';
  }

  dispose(): void {
    for (const m of this.maps.values()) m.dispose();
    this.maps.clear();
    this.actors.dispose();
    this.vfx.dispose();
    this.post.dispose();
    this.env.dispose();
    this.lib.dispose();
    this.renderer.dispose();
    void TILE;
  }
}
