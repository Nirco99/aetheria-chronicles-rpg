// Live entities in 3D: one visual per world object (the Diver and their mount, companions, NPCs,
// adventurers, monsters, breakables, the caravan, loot, resource nodes, projectiles, pets), kept
// in sync with the 2D simulation every frame. Also owns hit flashes, spawn / death dissolves,
// freeze tints, blade trails, barrier shells and the small world markers (jump pads, fishing
// spots, treasure crosses).
import * as THREE from 'three';
import type { Actor } from '../entities/actor';
import type { Anim, MountDef } from '../types/game';
import type { Look } from '../render/paperdoll';
import type { Companion } from '../entities/companion';
import type { Shadow, Caravan, Adventurer } from '../entities/allies';
import type { Breakable } from '../entities/breakable';
import type { Projectile } from '../entities/projectile';
import type { LootInst } from '../world/world';
import type { ResourceNode } from '../types/game';
import { G } from '../core/state';
import { Monster } from '../entities/monster';
import { Npc } from '../entities/npc';
import { RARITY_COLORS, SHATTER_FREEZE } from '../data/constants';
import { itemDef } from '../data/items';
import { fx } from '../render/fx';
import { angDiff } from '../engine/util';
import type { Quality } from './quality';
import type { TerrainField } from './terrain';
import type { Engine3D } from './engine';
import { Human3D } from './human';
import { buildCreature, buildMount, buildPet, breakableGeo, caravanGeo, chestGeo, herbGeo, oreDepletedGeo, oreGeo, type Creature } from './creatures';
import { radialTexture } from './textures';
import { Geo, col, meshOf, uber, uberDepth } from './util3';

const ORE_GLOW = new Set(['ore_mithril', 'ore_starlight', 'ore_voidsteel', 'ore_crimson', 'ore_orichalcum']);
const TRAIL_N = 18;

interface Vis {
  root: THREE.Object3D;
  human?: Human3D;
  creature?: Creature;
  mount?: Creature;
  mountId?: string;
  face: number;
  seen: number;
  trail?: Trail;
  shell?: THREE.Mesh;
  ring?: THREE.Mesh;
  lid?: THREE.Mesh;
  alt?: THREE.Object3D;
  beam?: THREE.Mesh;
  dispose(): void;
}

/** additive ribbon swept by a melee blade */
class Trail {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  private colr: Float32Array;
  private pts: { h: THREE.Vector3; t: THREE.Vector3; time: number }[] = [];
  private mat: THREE.MeshBasicMaterial;

  constructor(parent: THREE.Object3D) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(TRAIL_N * 2 * 3);
    this.colr = new Float32Array(TRAIL_N * 2 * 4);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.colr, 4));
    const idx: number[] = [];
    for (let i = 0; i < TRAIL_N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 2);
    g.setIndex(idx);
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    parent.add(this.mesh);
  }

  update(h: THREE.Vector3, t: THREE.Vector3, active: boolean, time: number, color: THREE.Color): void {
    if (active) {
      this.pts.push({ h: h.clone(), t: t.clone(), time });
      if (this.pts.length > TRAIL_N) this.pts.shift();
    }
    while (this.pts.length && time - this.pts[0].time > 0.2) this.pts.shift();
    const n = this.pts.length;
    this.mesh.visible = n >= 2;
    if (n < 2) return;
    for (let i = 0; i < TRAIL_N; i++) {
      const p = this.pts[Math.min(i, n - 1)];
      const age = i < n ? Math.max(0, 1 - (time - p.time) / 0.2) : 0;
      const a = age * age * (i / Math.max(1, n - 1));
      this.pos.set([p.h.x, p.h.y, p.h.z, p.t.x, p.t.y, p.t.z], i * 6);
      this.colr.set([color.r * 0.5, color.g * 0.5, color.b * 0.5, a * 0.3, color.r * 2.6 + a, color.g * 2.6 + a, color.b * 2.6 + a, a], i * 8);
    }
    this.mesh.geometry.getAttribute('position').needsUpdate = true;
    this.mesh.geometry.getAttribute('color').needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.mesh.removeFromParent();
  }
}

export class ActorLayer {
  readonly group = new THREE.Group();
  pushers: { x: number; y: number; r: number }[] = [];
  private field: TerrainField | null = null;
  private vis = new Map<object, Vis>();
  private tick = 0;
  private geo = new Map<string, THREE.BufferGeometry>();
  private mats = new Map<string, THREE.Material>();
  private shellMat: THREE.ShaderMaterial;
  private shellGeo = new THREE.SphereGeometry(1, 20, 14);
  private glowTex = radialTexture(96, 2);
  private markers = new THREE.Group();
  private fishRings: THREE.Mesh[] = [];
  private padRings: THREE.Mesh[] = [];
  private huntMarks = new Map<string, THREE.Object3D>();
  /** world position of the Diver's head for the camera / overlay */
  readonly playerPos = new THREE.Vector3();

  constructor(scene: THREE.Scene, private q: Quality) {
    this.group.name = 'actors';
    scene.add(this.group);
    this.group.add(this.markers);
    this.shellMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      uniforms: { uCol: { value: new THREE.Color('#b48cff') }, uTime: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uCol; uniform float uTime; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(uCol * (0.25 + f * 2.4) * (0.85 + 0.15 * sin(uTime * 6.0)), f * 0.9 + 0.06); }',
    });
  }

  setField(f: TerrainField): void {
    this.field = f;
    for (const v of this.vis.values()) v.dispose();
    this.vis.clear();
    this.markers.clear();
    this.fishRings = [];
    this.padRings = [];
    this.huntMarks.clear();
    const m = f.map;
    const ringMat = this.basicMat('pad', '#7fe9ff', 2.4);
    for (const pd of m.pads) {
      const g = new THREE.Mesh(new THREE.TorusGeometry(13, 1.1, 6, 28).rotateX(Math.PI / 2), ringMat);
      g.position.set(pd.x, f.groundY(pd.x, pd.y) + 0.8, pd.y);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.7, 6, 20, 4).rotateX(Math.PI / 2), ringMat);
      inner.position.copy(g.position);
      this.markers.add(g, inner);
      this.padRings.push(inner);
    }
    const bob = this.basicMat('bobber', '#ff5d6c', 1.4);
    const rip = this.basicMat('ripple', '#dff6ff', 1.2, true);
    for (const fs of m.fishSpots) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.9, 8, 6), bob);
      b.position.set(fs.wx, -1.6, fs.wy);
      const r = new THREE.Mesh(new THREE.TorusGeometry(6, 0.35, 4, 20).rotateX(Math.PI / 2), rip);
      r.position.set(fs.wx, -2.2, fs.wy);
      this.markers.add(b, r);
      this.fishRings.push(r);
    }
  }

  private basicMat(key: string, color: string, gain: number, transparent = false): THREE.MeshBasicMaterial {
    let m = this.mats.get(key) as THREE.MeshBasicMaterial | undefined;
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: col(color).clone().multiplyScalar(gain), toneMapped: false, transparent, depthWrite: !transparent, opacity: transparent ? 0.7 : 1 });
      this.mats.set(key, m);
    }
    return m;
  }

  private cached(key: string, make: () => Geo): THREE.BufferGeometry {
    let g = this.geo.get(key);
    if (!g) {
      g = make().build();
      (g as THREE.BufferGeometry & { shared?: boolean }).shared = true;
      this.geo.set(key, g);
    }
    return g;
  }

  // ------------------------------------------------------------------------------ builders

  private human(look: Look): Vis {
    const h = new Human3D(look);
    this.group.add(h.root);
    const v: Vis = { root: h.root, human: h, face: Math.PI / 2, seen: 0, dispose: () => this.drop(v) };
    return v;
  }

  private drop(v: Vis): void {
    v.human?.dispose();
    v.creature?.dispose();
    v.mount?.dispose();
    v.trail?.dispose();
    v.shell?.removeFromParent();
    v.ring?.removeFromParent();
    v.beam?.removeFromParent();
    v.root.removeFromParent();
  }

  private object(mesh: THREE.Object3D): Vis {
    this.group.add(mesh);
    const v: Vis = { root: mesh, face: 0, seen: 0, dispose: () => this.drop(v) };
    return v;
  }

  private make(a: Actor): Vis {
    if (a instanceof Monster) {
      if (a.def.id === 'ev_gate') return this.eventGate();
      if (a.def.draw === 'humanoid' && a.look) return this.human(a.look);
      const c = buildCreature(a.def);
      const holder = new THREE.Group();
      holder.add(c.root);
      this.group.add(holder);
      const v: Vis = { root: holder, creature: c, face: a.aim, seen: 0, dispose: () => this.drop(v) };
      return v;
    }
    if (a.kind === 'prop') {
      const b = a as Breakable;
      return this.object(meshOf(this.cached('brk:' + b.variant, () => breakableGeo(b.variant)), uber(), this.q.propShadows));
    }
    if (a.kind === 'caravan') return this.object(meshOf(this.cached('caravan', caravanGeo), uber(), this.q.propShadows));
    const look = (a as unknown as { look: Look }).look;
    return this.human(look);
  }

  private eventGate(): Vis {
    const g = new Geo();
    const o = { rough: 0.8 };
    for (const sx of [-1, 1]) g.box(sx * 22, 35, 0, 9, 70, 9, '#2a1030', o);
    g.box(0, 72, 0, 58, 10, 10, '#2a1030', o);
    g.sphere(0, 36, 0, 15, 30, 2, '#a970ff', { em: 6, rough: 0.2 }, 16);
    g.sphere(0, 36, 0.6, 9, 20, 2, '#ff4f7b', { em: 7, rough: 0.2 }, 14);
    return this.object(meshOf(g, uber(), this.q.propShadows));
  }

  // ------------------------------------------------------------------------------ frame

  sync(dt: number, t: number, eng: Engine3D): void {
    const f = this.field;
    if (!f) return;
    this.tick++;
    const w = G.world;
    const p = G.player;
    this.shellMat.uniforms.uTime.value = t;
    this.pushers = [];
    const view = 620;
    const list: Actor[] = [p, ...w.party, ...w.vanguard, ...w.adventurers, ...w.shadows, ...w.monsters, ...w.npcs, ...w.breakables];
    if (w.caravan) list.push(w.caravan);
    for (const a of list) {
      if (a.removed) continue;
      if (a !== p && (Math.abs(a.x - p.x) > view || Math.abs(a.y - p.y) > view * 0.85)) continue;
      let v = this.vis.get(a);
      if (!v) {
        v = this.make(a);
        this.vis.set(a, v);
      }
      v.seen = this.tick;
      this.place(a, v, dt, t, f, eng);
    }
    this.syncLoot(w.loots, f, t);
    this.syncNodes(f.map.nodes, f, p.x, p.y);
    this.syncProjectiles(w.projectiles, f, t);
    this.syncPet(f, dt, t);
    this.syncMarkers(f, t);
    for (const [k, v] of this.vis) {
      if (v.seen !== this.tick) {
        v.dispose();
        this.vis.delete(k);
      }
    }
  }

  private place(a: Actor, v: Vis, dt: number, t: number, f: TerrainField, eng: Engine3D): void {
    const p = G.player;
    const gy = f.groundY(a.x, a.y);
    const isPlayer = a === p;
    const near = Math.abs(a.x - p.x) < 300 && Math.abs(a.y - p.y) < 250;
    if (near && this.pushers.length < 10 && !a.flying && a.kind !== 'prop') this.pushers.push({ x: a.x, y: a.y, r: a.kind === 'monster' ? Math.max(12, a.radius * 1.2) : 13 });
    // ---- facing
    let want = a.aim;
    const speed = Math.hypot(a.vx, a.vy);
    if (isPlayer) {
      if (p.st === 'normal' && p.moving && !p.blocking && speed > 5) want = Math.atan2(p.vy, p.vx);
      else if (p.st === 'dodge') want = p.dodgeAng;
    } else if (a instanceof Npc && a.moving && speed > 3) want = Math.atan2(a.vy, a.vx);
    v.face += angDiff(v.face, want) * (1 - Math.exp(-dt * 16));
    // ---- humans
    if (v.human) {
      const h = v.human;
      const look = (a as unknown as { look: Look | null }).look;
      if (look) h.setLook(look);
      let y = gy + a.z;
      let seated = false;
      let visible = true;
      let stunned = a.broken > 0 || a.has('stun') || a.has('freeze');
      let blocking = false;
      let down = false;
      let dodge = -1;
      if (isPlayer) {
        visible = !(p.dead && p.deathT > 0.5);
        if (p.iframes > 1.6 && !p.dead && Math.floor(t * 20) % 2) visible = false;
        blocking = p.blocking;
        if (p.st === 'dodge') dodge = 1 - Math.max(0, p.dodgeT / p.dodgeDur);
        const M = p.mounted;
        this.mountFor(v, M);
        if (M && v.mount) {
          seated = true;
          const big = M.kind !== 'wolf';
          y += big ? 17.5 : 19;
          v.mount.root.position.set(a.x, gy + a.z, a.y);
          v.mount.root.rotation.y = Math.PI / 2 - v.face;
          v.mount.pose({ ph: p.anim.walk, k: 0, windup: 0, t, moving: p.moving, dt });
        }
        this.playerPos.set(a.x, y + 30, a.y);
      } else if (a.kind === 'companion') {
        const c = a as Companion;
        blocking = c.guard;
        down = c.dead;
        if ((c as Adventurer).dueling !== undefined) stunned = stunned && !down;
      } else if (a instanceof Monster) {
        blocking = a.frontGuard && a.broken <= 0;
        if (a.def.flying) y += 12 + Math.sin(t * 3 + a.bob) * 3;
        this.monsterFx(a, v, h.mat.uu, t, dt);
      } else if (a.kind === 'shadow') {
        const sh = a as Shadow;
        h.mat.opacity = 0.6 * (sh.run.done ? Math.max(0, 1 - sh.fade / 0.35) : 1);
      }
      h.root.visible = visible;
      h.root.position.set(a.x, y, a.y);
      h.root.rotation.y = Math.PI / 2 - v.face;
      const A: Anim = a.anim;
      h.update({ anim: A, aim: a.aim, face: v.face, moving: a.moving, blocking, t, dt, speed, seated, down, stunned, dodge });
      if (!(a instanceof Monster)) {
        const u = h.mat.uu;
        const fl = Math.min(1, Math.max(0, a.flash) * 7);
        const parry = isPlayer ? Math.max(0, p.parryFlash) * 3 : 0;
        if (parry > fl) u.uFlash.value.set(0.6, 0.95, 1, Math.min(1, parry));
        else u.uFlash.value.set(1, 1, 1, fl);
      }
      // blade trail
      if (h.melee && visible) {
        const swinging = (A.kind === 'attack' && A.swing < 1 && A.swing > 0.02) || (A.kind === 'skill' && A.t > 0.1);
        if (swinging && !v.trail) v.trail = new Trail(this.group);
        if (v.trail) {
          const wc = isPlayer ? p.weaponColor : (a as unknown as { tint?: string | null; def?: { colors?: { glow: string } } }).tint ?? (a as unknown as { def?: { colors?: { glow: string } } }).def?.colors?.glow ?? '#dfe8ff';
          v.trail.update(h.hilt, h.tip, swinging, t, col(wc));
        }
      }
      // barrier shell
      this.shell(v, a.barrier > 0 || (a instanceof Monster && a.shield > 0), a.x, y + 20, a.y, 22, a instanceof Monster ? '#9fdcff' : '#b48cff');
      return;
    }
    // ---- creatures
    if (v.creature && a instanceof Monster) {
      const c = v.creature;
      let y = gy + a.z;
      if (a.def.flying) y += 12 + Math.sin(t * 3 + a.bob) * 3;
      v.root.position.set(a.x, y, a.y);
      v.root.rotation.y = Math.PI / 2 - v.face;
      const atk = a.st === 'attack';
      c.pose({ ph: a.anim.walk, k: atk ? Math.sin(Math.min(1, a.anim.swing) * Math.PI) : 0, windup: atk ? Math.min(1, a.anim.swing * 2) * (a.anim.swing < 0.5 ? 1 : Math.max(0, 2 - a.anim.swing * 2)) : 0, t, moving: a.moving, dt });
      this.monsterFx(a, v, c.mat.uu, t, dt);
      this.shell(v, a.shield > 0, a.x, y + c.height * 0.5, a.y, Math.max(c.height * 0.62, a.radius * 1.5), '#9fdcff');
      return;
    }
    // ---- plain objects
    if (a.kind === 'prop') {
      const b = a as Breakable;
      const j = b.shake > 0 ? Math.sin(t * 90) * 1.5 : 0;
      v.root.position.set(a.x + j, gy, a.y);
      v.root.visible = !a.dead;
    } else if (a.kind === 'caravan') {
      const c = a as Caravan;
      v.root.position.set(a.x, gy, a.y);
      v.root.rotation.y = -c.aim;
    } else if (a instanceof Monster) {
      v.root.position.set(a.x, gy, a.y);
      v.root.scale.setScalar(0.85 + 0.15 * Math.sin(t * 3));
    }
    void eng;
  }

  private mountFor(v: Vis, M: MountDef | null): void {
    const id = M ? M.id : '';
    if (v.mountId === id) return;
    v.mount?.dispose();
    v.mount = undefined;
    v.mountId = id;
    if (M) {
      v.mount = buildMount(M);
      this.group.add(v.mount.root);
    }
  }

  private shell(v: Vis, on: boolean, x: number, y: number, z: number, r: number, color: string): void {
    if (!on) {
      if (v.shell) v.shell.visible = false;
      return;
    }
    if (!v.shell) {
      v.shell = new THREE.Mesh(this.shellGeo, this.shellMat);
      v.shell.renderOrder = 5;
      this.group.add(v.shell);
    }
    v.shell.visible = true;
    v.shell.position.set(x, y, z);
    v.shell.scale.set(r * 0.82, r * 1.15, r * 0.82);
    (this.shellMat.uniforms.uCol.value as THREE.Color).set(color);
  }

  /** hit flash, attack wind-up tint, spawn materialise, death dissolve and status tints of a monster */
  private monsterFx(m: Monster, v: Vis, u: { uFlash: { value: THREE.Vector4 }; uDissolve: { value: number }; uRim: { value: THREE.Vector4 } }, t: number, dt: number): void {
    const fl = Math.min(1, Math.max(0, m.flash) * 7);
    const wind = m.st === 'attack' ? Math.min(1, m.anim.swing * 2) : 0;
    if (m.dead) {
      u.uDissolve.value = Math.min(1, 1 - m.dying / SHATTER_FREEZE) * 0.92;
      u.uFlash.value.set(1, 0.16, 0.25, 0.75);
    } else {
      u.uDissolve.value = m.spawnT > 0 ? Math.min(0.98, m.spawnT / 0.45) : 0;
      if (fl > 0.02) u.uFlash.value.set(1, 1, 1, fl);
      else if (m.has('freeze')) u.uFlash.value.set(0.6, 0.9, 1, 0.5);
      else if (m.broken > 0) u.uFlash.value.set(1, 0.82, 0.4, 0.22 + 0.12 * Math.sin(t * 12));
      else if (wind > 0) u.uFlash.value.set(1, 0.18, 0.18, wind * 0.36);
      else u.uFlash.value.set(1, 1, 1, 0);
    }
    if (m.isElite || m.isBoss) u.uRim.value.set(1, 0.55, 0.2, m.isBoss ? 0.7 : 0.45);
    if (v.creature) v.root.scale.setScalar(m.spawnT > 0 ? 0.6 + 0.4 * (1 - m.spawnT / 0.45) : 1);
    if (m.dead || G.game.paused) return;
    const h = m.height();
    if ((m.has('burn') || m.has('poison')) && Math.random() < dt * 14) fx.particle(m.x + (Math.random() - 0.5) * m.def.size, m.y, { z: 6 + Math.random() * h * 0.6, vz: 40, max: 0.5, size: 2.5, color: m.has('burn') ? '#ff7a3d' : '#9be15d', kind: 'ember', drag: 1 });
    if ((m.broken > 0 || m.has('stun')) && Math.random() < dt * 9) {
      const a = Math.random() * Math.PI * 2;
      fx.particle(m.x + Math.cos(a) * 12, m.y + Math.sin(a) * 5, { z: h + 6, vx: -Math.sin(a) * 40, vy: Math.cos(a) * 18, max: 0.45, size: 2.6, color: m.broken > 0 ? '#ffd166' : '#fff4c2', kind: 'glow', drag: 1 });
    }
  }

  // ------------------------------------------------------------------------------ loot, nodes, shots

  private syncLoot(loots: LootInst[], f: TerrainField, t: number): void {
    for (const l of loots) {
      let v = this.vis.get(l);
      if (!v) {
        const c = RARITY_COLORS[l.rarity] ?? '#ffffff';
        if (l.kind === 'chest') {
          const base = meshOf(this.cached('chest', () => chestGeo(false)), uber(), this.q.propShadows);
          const lid = meshOf(this.cached('chestLidLocal', () => {
            const g = new Geo();
            g.cyl(0, 0, 7.5, 7.5, 7.5, 24, '#8a5a32', { rough: 0.8 }, 12, [0, 0, Math.PI / 2]);
            for (const sx of [-1, 0, 1]) g.cyl(sx * 10.6, 0, 7.5, 7.8, 7.8, 2.2, '#ffd166', { metal: 0.9, rough: 0.3 }, 12, [0, 0, Math.PI / 2]);
            return g;
          }), uber(), this.q.propShadows);
          lid.position.set(0, 13, -7.5);
          base.add(lid);
          v = this.object(base);
          v.lid = lid;
        } else {
          const g = this.cached('loot:' + l.rarity, () => {
            const gg = new Geo();
            gg.ico(0, 0, 0, 4.4, 7.4, 4.4, c, { em: 3.4, rough: 0.08, metal: 0.3 }, 0);
            return gg;
          });
          v = this.object(meshOf(g, uber(), false));
        }
        // rarity beam
        const key = 'beam:' + l.rarity;
        let bm = this.mats.get(key) as THREE.MeshBasicMaterial | undefined;
        if (!bm) {
          bm = new THREE.MeshBasicMaterial({ color: col(c).clone().multiplyScalar(1.5), map: this.glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false });
          this.mats.set(key, bm);
        }
        const hgt = 70 + l.rarity * 34;
        let bg = this.geo.get('beamGeo:' + l.rarity);
        if (!bg) {
          bg = new THREE.PlaneGeometry(13 + l.rarity * 1.6, hgt);
          bg.translate(0, hgt / 2, 0);
          this.geo.set('beamGeo:' + l.rarity, bg);
        }
        v.beam = new THREE.Mesh(bg, bm);
        v.beam.renderOrder = 5;
        this.group.add(v.beam);
        this.vis.set(l, v);
      }
      v.seen = this.tick;
      const gy = f.groundY(l.x, l.y);
      if (l.kind === 'chest') {
        v.root.position.set(l.x, gy, l.y - 6);
        if (v.lid) v.lid.rotation.x = l.opened ? -Math.min(1.9, l.t * 5) : 0;
        if (v.beam) v.beam.visible = !l.opened;
      } else {
        v.root.position.set(l.x, gy + l.z + 4 + Math.sin(t * 3 + l.id) * 1.6, l.y);
        v.root.rotation.y = t * 2.2 + l.id;
      }
      if (v.beam) {
        v.beam.position.set(l.x, gy, l.y);
        v.beam.rotation.y = 0;
        (v.beam.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.15 * Math.sin(t * 3 + l.id);
      }
    }
  }

  private syncNodes(nodes: ResourceNode[], f: TerrainField, px: number, py: number): void {
    for (const n of nodes) {
      if (Math.abs(n.x - px) > 640 || Math.abs(n.y - py) > 540) continue;
      let v = this.vis.get(n);
      if (!v) {
        const c = itemDef(n.item).color;
        const root = new THREE.Group();
        const ready = meshOf(this.cached(`node:${n.kind}:${c}:1`, () => (n.kind === 'ore' ? oreGeo(c, ORE_GLOW.has(n.item)) : herbGeo(c, true))), uber(), this.q.propShadows);
        const spent = meshOf(this.cached(`node:${n.kind}:0`, () => (n.kind === 'ore' ? oreDepletedGeo() : herbGeo('#5a5a4a', false))), uber(), this.q.propShadows);
        root.add(ready, spent);
        root.position.set(n.x, f.groundY(n.x, n.y), n.y - 4);
        root.rotation.y = (n.id * 1.7) % 6.283;
        v = this.object(root);
        v.alt = spent;
        v.ring = ready;
        this.vis.set(n, v);
      }
      v.seen = this.tick;
      if (v.ring) v.ring.visible = n.ready;
      if (v.alt) v.alt.visible = !n.ready;
    }
  }

  private syncProjectiles(list: Projectile[], f: TerrainField, t: number): void {
    for (const pr of list) {
      let v = this.vis.get(pr);
      const k = pr.spec.kind;
      if (!v) {
        const c = pr.color;
        let mesh: THREE.Mesh;
        if (k === 'arrow' || k === 'feather') {
          const g = this.cached('arrow', () => {
            const gg = new Geo();
            gg.cyl(0, 0, 0, 0.32, 0.32, 16, '#d8c8a8', { rough: 0.6 }, 5, [0, 0, Math.PI / 2]);
            gg.cone(9.4, 0, 0, 1, 3.4, '#dfe8f4', { metal: 0.9, rough: 0.3 }, 5, [0, 0, -Math.PI / 2]);
            for (const a of [0, 1.57]) gg.quad(-6.6, 0, 0, 3.4, 2.2, '#ffffff', { rough: 0.8 }, [a, 0, 0]);
            return gg;
          });
          mesh = meshOf(g, uber(), false);
        } else if (k === 'rock') mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(3.6, 0), this.basicMat('rock', '#8a8f99', 0.6));
        else if (k === 'icelance' || k === 'shard') {
          mesh = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), this.basicMat('ice:' + c, c, 3));
          mesh.scale.set(12, 2.6, 2.6);
        } else {
          const r = k === 'meteor' ? 12 : k === 'fireball' ? 6.4 : k === 'orb' || k === 'holy' ? 5.4 : 4.2;
          mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), this.basicMat('orb:' + c, c, 3.4));
        }
        v = this.object(mesh);
        // soft halo billboard
        if (k !== 'arrow' && k !== 'rock' && k !== 'feather') {
          const hm = new THREE.SpriteMaterial({ map: this.glowTex, color: col(c).clone().multiplyScalar(1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
          hm.toneMapped = false;
          const sp = new THREE.Sprite(hm);
          sp.scale.setScalar(k === 'meteor' ? 90 : 34);
          (mesh as THREE.Object3D).add(sp);
          if (k === 'icelance' || k === 'shard') sp.scale.set(34 / 12, 34 / 2.6, 1);
        }
        this.vis.set(pr, v);
      }
      v.seen = this.tick;
      const gy = f.groundY(pr.x, pr.y);
      v.root.position.set(pr.x, gy + pr.z, pr.y);
      if (k === 'arrow' || k === 'feather' || k === 'icelance' || k === 'shard') v.root.rotation.y = -pr.ang;
      else if (k === 'rock') v.root.rotation.set(t * 9, t * 7, 0);
      if (!G.game.paused && k !== 'arrow' && k !== 'rock' && k !== 'feather' && Math.random() < 0.6) {
        fx.particle(pr.x + (Math.random() - 0.5) * 4, pr.y + (Math.random() - 0.5) * 4, { z: pr.z + (Math.random() - 0.5) * 4, vx: -pr.vx * 0.06, vy: -pr.vy * 0.06, max: 0.32, size: k === 'meteor' ? 5 : 2.6, color: pr.color, kind: 'glow', drag: 2 });
      }
    }
  }

  private syncPet(f: TerrainField, dt: number, t: number): void {
    const pet = G.world.pet;
    if (!pet) return;
    let v = this.vis.get(pet);
    if (!v) {
      const c = buildPet(pet.def.color, pet.def.color2);
      this.group.add(c.root);
      const vv: Vis = { root: c.root, creature: c, face: 0, seen: 0, dispose: () => this.drop(vv) };
      v = vv;
      this.vis.set(pet, v);
    }
    v.seen = this.tick;
    v.root.position.set(pet.x, f.groundY(pet.x, pet.y) + pet.z + 4, pet.y);
    v.root.rotation.y = pet.face > 0 ? Math.PI / 2 : -Math.PI / 2;
    v.creature?.pose({ ph: 0, k: 0, windup: 0, t, moving: true, dt });
  }

  private syncMarkers(f: TerrainField, t: number): void {
    for (const r of this.padRings) r.rotation.y = t * 2;
    this.fishRings.forEach((r, i) => {
      const k = (t * 0.6 + i * 0.37) % 1;
      r.scale.setScalar(0.5 + k * 2.2);
      (r.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
    });
    // buried treasure crosses appear as the Diver closes in
    const m = f.map;
    const p = G.player;
    const live = new Set<string>();
    if (m.kind === 'wild') {
      for (const hu of G.save.hunts) {
        if (hu.found || hu.realm !== m.realm) continue;
        const d = Math.hypot(hu.x - p.x, hu.y - p.y);
        if (d > 340) continue;
        live.add(hu.id);
        let o = this.huntMarks.get(hu.id);
        if (!o) {
          const g = new Geo();
          g.box(0, 0.6, 0, 16, 1, 3.2, '#ffd166', { em: 2.6 }, [0, Math.PI / 4, 0]);
          g.box(0, 0.6, 0, 16, 1, 3.2, '#ffd166', { em: 2.6 }, [0, -Math.PI / 4, 0]);
          o = meshOf(g, uber(), false, false);
          o.position.set(hu.x, f.groundY(hu.x, hu.y), hu.y);
          this.markers.add(o);
          this.huntMarks.set(hu.id, o);
        }
        if (Math.random() < 0.08 && !G.game.paused) fx.particle(hu.x, hu.y, { z: 4, kind: 'glow', color: '#ffd166', size: 2, max: 0.6, vx: 0, vy: 0, vz: 30, drag: 1 });
      }
    }
    for (const [id, o] of this.huntMarks) {
      if (!live.has(id)) {
        o.removeFromParent();
        this.huntMarks.delete(id);
      }
    }
  }

  dispose(): void {
    for (const v of this.vis.values()) v.dispose();
    this.vis.clear();
    for (const g of this.geo.values()) g.dispose();
    for (const m of this.mats.values()) m.dispose();
    this.shellGeo.dispose();
    this.shellMat.dispose();
    this.glowTex.dispose();
    this.group.removeFromParent();
    void uberDepth;
  }
}
