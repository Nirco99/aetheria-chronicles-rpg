// Procedural 3D creatures: every non-humanoid monster family, mounts, pets, breakable props,
// loot and resource nodes. Each builder returns a small rig (a few meshes sharing one material)
// plus a pose function driven by the same walk phase / attack swing the 2D sprites used.
import * as THREE from 'three';
import type { MonsterDef, MountDef } from '../types/game';
import { LAYER } from './textures';
import { Geo, col, makeUber, makeUberDepth, shadeCol, type UberUniforms } from './util3';

const PI = Math.PI;

export interface CreaturePose {
  /** walk phase, attack bell (0..1..0), attack wind-up 0..1, time, moving */
  ph: number;
  k: number;
  windup: number;
  t: number;
  moving: boolean;
  dt: number;
}

export interface Creature {
  root: THREE.Group;
  mat: THREE.MeshStandardMaterial & { uu: UberUniforms };
  pose(p: CreaturePose): void;
  /** approximate height in world units (labels, hit sparks) */
  height: number;
  dispose(): void;
}

type Mat = THREE.MeshStandardMaterial & { uu: UberUniforms };

class Rig {
  readonly root = new THREE.Group();
  readonly mat: Mat;
  private depth: THREE.Material;
  constructor() {
    this.mat = makeUber({ side: THREE.DoubleSide, cut: false });
    this.depth = makeUberDepth(this.mat);
    this.mat.uu.uRim.value.set(1, 0.9, 0.8, 0.12);
  }
  /** adds a mesh whose pivot sits at (x, y, z) of its parent */
  part(g: Geo, x = 0, y = 0, z = 0, parent: THREE.Object3D = this.root): THREE.Mesh {
    const m = new THREE.Mesh(g.build(), this.mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.customDepthMaterial = this.depth;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  done(height: number, pose: (p: CreaturePose) => void): Creature {
    return {
      root: this.root, mat: this.mat, pose, height,
      dispose: () => {
        this.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
        this.mat.dispose();
        this.depth.dispose();
        this.root.removeFromParent();
      },
    };
  }
}

const FUR = { rough: 0.9 };
const HIDE = { rough: 0.7 };
const SHELL = { rough: 0.35, metal: 0.2 };
const STONE = { layer: LAYER.rock, rough: 0.9 };
const METAL = { metal: 0.9, rough: 0.3 };

function leg(len: number, r: number, c: THREE.Color | string, o = FUR, foot = true): Geo {
  const g = new Geo();
  g.limb(0, 0, 0, 0, -len, 0, r, c, o);
  if (foot) g.sphere(0, -len, r * 0.5, r * 1.2, r * 0.8, r * 1.7, shadeCol(typeof c === 'string' ? c : '#' + c.getHexString(), -0.2), o, 6);
  return g;
}

// ---------------------------------------------------------------------------------- families

function quadruped(def: { colors: string[] }, kind: 'wolf' | 'boar' | 'drake' | 'horse' | 'stag' | 'gryphon' | 'mountdrake'): Creature {
  const r = new Rig();
  const [c0, c1, c2] = [def.colors[0], def.colors[1] ?? def.colors[0], def.colors[2] ?? '#ffffff'];
  const lizard = kind === 'drake' || kind === 'mountdrake';
  const big = kind === 'horse' || kind === 'stag' || kind === 'gryphon' || kind === 'mountdrake';
  const L = big ? 30 : kind === 'boar' ? 24 : 26;
  const H = big ? 22 : kind === 'boar' ? 12 : lizard ? 9 : 14;
  const W = big ? 9 : kind === 'boar' ? 9.5 : 7;
  const o = lizard ? HIDE : FUR;
  const bodyG = new Geo();
  bodyG.sphere(0, 0, 0, W, W * (kind === 'boar' ? 0.95 : 0.82), L * 0.5, c0, o, 12);
  bodyG.sphere(0, W * 0.25, L * 0.24, W * 0.95, W * 0.9, L * 0.26, c0, o, 10);
  bodyG.sphere(0, -W * 0.3, 0, W * 0.8, W * 0.5, L * 0.42, c1, o, 10);
  if (kind === 'boar') for (let i = 0; i < 6; i++) bodyG.cone(0, W * 0.9, L * 0.3 - i * 4, 1.3, 4.5, shadeCol(c0, -0.35), o, 5, [-0.5, 0, 0]);
  if (lizard) for (let i = 0; i < 7; i++) bodyG.cone(0, W * 0.78, L * 0.34 - i * 3.6, 1.3, 4.2 - i * 0.2, c2, { em: 0.8, rough: 0.5 }, 4, [-0.3, 0, 0]);
  if (kind === 'horse' || kind === 'stag') bodyG.box(0, W * 0.84, 0, W * 1.3, 2.4, 9, '#5a3020', { rough: 0.8 });
  const body = r.part(bodyG, 0, H + W * 0.4, 0);
  // head on a neck pivot
  const headG = new Geo();
  const hs = big ? 1.15 : 1;
  if (kind === 'wolf') {
    headG.sphere(0, 0, 3.4, 5.2, 4.8, 5.6, c0, o, 10);
    headG.sphere(0, -1.2, 8, 2.9, 2.5, 4.2, c1, o, 8);
    headG.sphere(0, -0.5, 11.6, 1.2, 1, 1, '#1a1418', { rough: 0.4 }, 6);
    for (const sx of [-1, 1]) {
      headG.cone(sx * 3.2, 5.4, 1.6, 1.7, 4.4, c0, o, 4, [-0.2, 0, -sx * 0.25]);
      headG.sphere(sx * 2.3, 1.2, 7.6, 0.9, 0.9, 0.6, c2, { em: 3 }, 6);
      headG.cone(sx * 1.5, -3, 9.4, 0.5, 2.2, '#ffffff', { rough: 0.3 }, 4, [PI, 0, 0]);
    }
  } else if (kind === 'boar') {
    headG.sphere(0, 0, 4, 6.4, 5.8, 6.4, c0, o, 10);
    headG.cyl(0, -1.4, 10, 2.5, 3.1, 4.4, c1, o, 8, [PI / 2, 0, 0]);
    for (const sx of [-1, 1]) {
      headG.cone(sx * 3.6, -1.6, 10.5, 1, 6, '#f4ead0', { rough: 0.35 }, 5, [-0.9, 0, -sx * 0.5]);
      headG.sphere(sx * 3.2, 1.9, 7.8, 0.9, 0.9, 0.6, c2, { em: 3 }, 6);
      headG.sphere(sx * 5, 4.4, 2, 1.9, 2.4, 1.1, shadeCol(c0, -0.2), o, 6);
    }
  } else if (lizard) {
    headG.sphere(0, 0, 4, 4.8 * hs, 3.6 * hs, 6.4 * hs, c0, o, 10);
    headG.sphere(0, -1.4, 9.5 * hs, 3.3 * hs, 2.2 * hs, 4.4 * hs, c1, o, 8);
    for (const sx of [-1, 1]) {
      headG.cone(sx * 3 * hs, 3.4 * hs, 0.4, 1.1, 5.4, c2, { em: 0.9 }, 5, [-0.9, 0, -sx * 0.3]);
      headG.sphere(sx * 2.7 * hs, 1.3 * hs, 6.6 * hs, 0.95, 0.95, 0.6, '#ffd166', { em: 4 }, 6);
    }
  } else {
    headG.sphere(0, 0, 4, 4.2, 4.6, 7.4, c0, o, 10);
    headG.sphere(0, -1.6, 10.4, 3.1, 3, 4.4, kind === 'gryphon' ? '#f2c14e' : c1, kind === 'gryphon' ? SHELL : o, 8);
    for (const sx of [-1, 1]) {
      headG.cone(sx * 2.6, 5.4, 1, 1.4, 4.4, c0, o, 4, [-0.2, 0, -sx * 0.2]);
      headG.sphere(sx * 2.9, 1.2, 7.6, 0.9, 1, 0.6, '#140f14', { rough: 0.3 }, 6);
    }
    if (kind === 'stag') for (const sx of [-1, 1]) {
      headG.limb(sx * 2.2, 5, 0, sx * 6.4, 14, -2, 0.7, c2, { rough: 0.5 });
      headG.limb(sx * 4.6, 10, -1, sx * 9.6, 13.4, 1.6, 0.55, c2, { rough: 0.5 });
      headG.limb(sx * 6.4, 14, -2, sx * 5.4, 19, -4, 0.5, c2, { rough: 0.5 });
    }
    if (kind === 'horse') for (let i = 0; i < 6; i++) headG.sphere(0, 4.6 - i * 1.5, -1 - i * 1.7, 1.5, 2.4, 2.3, c1, FUR, 6);
  }
  const neck = new THREE.Group();
  neck.position.set(0, H + W * (big ? 1.25 : 0.7), L * (big ? 0.42 : 0.44));
  r.root.add(neck);
  if (big) {
    const ng = new Geo();
    ng.limb(0, -W * 0.7, -L * 0.1, 0, 6, 2, W * 0.5, c0, o);
    r.part(ng, 0, 0, 0, neck);
  }
  const head = r.part(headG, 0, big ? 8 : 0, big ? 3.5 : 0, neck);
  // legs: fl, fr, bl, br
  const legs: THREE.Mesh[] = [];
  const lr = big ? 2 : kind === 'boar' ? 2.2 : 1.7;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as [number, number][]) legs.push(r.part(leg(H + 2, lr, c1, o), sx * W * 0.6, H + 2, sz * L * 0.3));
  // tail
  const tailG = new Geo();
  if (lizard) {
    tailG.limb(0, 0, 0, 0, -1, -L * 0.5, W * 0.42, c0, o);
    tailG.limb(0, -1, -L * 0.5, 0, 1.5, -L * 0.86, W * 0.22, c0, o);
    tailG.sphere(0, 2, -L * 0.9, 1.9, 1.9, 1.9, c2, { em: 3.6 }, 8);
  } else if (kind === 'boar') tailG.limb(0, 0, 0, 0, 2, -5, 0.6, c1, o);
  else if (kind === 'horse' || kind === 'stag') tailG.limb(0, 0, 0, 0, -11, -5, 1.8, c1, FUR);
  else {
    tailG.limb(0, 0, 0, 0, 2.4, -9, 2, c0, o);
    tailG.sphere(0, 3, -11, 2.2, 2.1, 3.1, c1, o, 8);
  }
  const tail = r.part(tailG, 0, H + W * 0.75, -L * 0.46);
  // wings for gryphons and mount-drakes
  const wings: THREE.Mesh[] = [];
  if (kind === 'gryphon' || kind === 'mountdrake') {
    for (const sx of [-1, 1]) {
      const wg = new Geo();
      wg.limb(0, 0, 0, sx * 14, 5, -2, 1.1, c1, o);
      for (let i = 0; i < 5; i++) wg.box(sx * (4 + i * 3.4), 2 - i * 0.6, -6 - i * 0.6, 3.8, 0.6, 11 - i * 1.3, i % 2 ? c2 : shadeCol(c2, -0.18), { rough: 0.8 }, [0, sx * 0.12 * i, 0]);
      wings.push(r.part(wg, sx * W * 0.7, H + W * 1.15, 2));
    }
  }
  const height = H + W * 1.9 + (big ? 12 : 4);
  return r.done(height, (p) => {
    const s = p.moving ? 1 : 0.12;
    const sp = kind === 'boar' ? 1 : 1.1;
    legs.forEach((l, i) => {
      const off = i === 0 || i === 3 ? 0 : PI;
      l.rotation.x = Math.sin(p.ph * sp + off) * 0.75 * s;
    });
    const bob = Math.abs(Math.sin(p.ph * sp)) * 1.3 * s;
    body.position.y = H + W * 0.4 + bob - p.windup * 1.6;
    body.position.z = p.k * 6 - p.windup * 3;
    body.rotation.x = -p.windup * 0.16 + p.k * 0.14;
    neck.position.y = H + W * (big ? 1.25 : 0.7) + bob - p.windup * 2;
    neck.position.z = L * (big ? 0.42 : 0.44) + p.k * 8 - p.windup * 4;
    head.rotation.x = Math.sin(p.t * 1.7) * 0.06 + p.windup * 0.35 - p.k * 0.5;
    head.rotation.y = Math.sin(p.t * 0.9) * 0.14 * (1 - s);
    tail.rotation.y = Math.sin(p.t * (lizard ? 2.2 : 6) + p.ph) * (lizard ? 0.35 : 0.5);
    tail.rotation.x = kind === 'wolf' ? -0.3 + p.windup * 0.5 : 0;
    wings.forEach((w, i) => {
      w.rotation.z = (i === 0 ? 1 : -1) * (0.25 + Math.sin(p.t * 5) * 0.28 * (p.moving ? 1 : 0.3));
    });
  });
}

function kobold(def: MonsterDef): Creature {
  const r = new Rig();
  const [c0, c1, c2] = [def.colors[0], def.colors[1] ?? '#6b4a2f', def.colors[2] ?? '#ffd166'];
  const heavy = def.id.includes('sentinel') || def.id.includes('trooper') || !!def.boss;
  const tg = new Geo();
  tg.sphere(0, 0, 0, 6.2, 6.6, 5, c0, HIDE, 12);
  tg.sphere(0, 1, 1.6, 5.2, 4.6, 4, heavy ? '#8a8f99' : c1, heavy ? METAL : { rough: 0.8 }, 10);
  tg.torus(0, -3.2, 0, 5.2, 0.9, '#3a2a1c', { rough: 0.8 }, [PI / 2, 0, 0], PI * 2, 12);
  if (heavy) for (const sx of [-1, 1]) tg.sphere(sx * 6.4, 4.4, 0, 3.2, 2.6, 3.2, '#8a8f99', METAL, 8);
  const torso = r.part(tg, 0, 13, 0);
  const hg = new Geo();
  hg.sphere(0, 0, 0, 5.4, 4.8, 5.2, c0, HIDE, 12);
  hg.sphere(0, -1.2, 5, 3, 2.4, 3.6, shadeCol(c0, 0.1), HIDE, 8);
  hg.sphere(0, -0.4, 8.2, 1.1, 0.9, 0.9, '#2a1a1a', { rough: 0.4 }, 6);
  for (const sx of [-1, 1]) {
    hg.cone(sx * 5.6, 3.4, -0.6, 1.9, 7, c0, HIDE, 4, [0, 0, -sx * 1.1]);
    hg.sphere(sx * 2.4, 1, 4.4, 1.15, 1.25, 0.7, c2, { em: 3.4 }, 6);
    hg.cone(sx * 1.3, -2.8, 6.4, 0.45, 1.8, '#ffffff', { rough: 0.3 }, 4, [PI, 0, 0]);
  }
  if (heavy) {
    hg.sphere(0, 2.2, -0.5, 5.9, 4.4, 5.8, '#7a7f8a', METAL, 10);
    hg.cone(0, 8, -0.5, 1.4, 5, c2, { rough: 0.6 }, 5);
  }
  const head = r.part(hg, 0, 23.5, 1);
  const armG = (weapon: boolean): Geo => {
    const g = new Geo();
    g.limb(0, 0, 0, 0, -7, 2, 1.7, c0, HIDE);
    g.sphere(0, -7.6, 2.4, 1.9, 1.9, 1.9, shadeCol(c0, -0.15), HIDE, 6);
    if (weapon) {
      if (def.ranged) {
        g.limb(0, -7, 2.4, 0, -1, 12, 0.5, '#6b4a2f', { rough: 0.8 });
        g.sphere(0, -0.6, 12.6, 1.3, 1.3, 1.3, c2, { em: 2.4 }, 6);
      } else {
        g.cyl(0, -4, 8, 0.6, 0.6, 14, '#5a4030', { rough: 0.8 }, 6, [PI / 2 - 0.5, 0, 0]);
        g.box(0, 0.6, 14.4, heavy ? 6 : 1.6, heavy ? 6 : 9, 0.9, '#b8bec8', METAL, [-0.5, 0, 0]);
      }
    }
    return g;
  };
  const armR = r.part(armG(true), -6.8, 17.5, 0);
  const armL = r.part(armG(false), 6.8, 17.5, 0);
  if (heavy) {
    const sg = new Geo();
    sg.cyl(0, 0, 0, 6.4, 6.4, 1.1, '#6a5a4a', { layer: LAYER.planks, rough: 0.8 }, 12, [PI / 2, 0, 0]);
    sg.sphere(0, 0, 0.8, 1.9, 1.9, 1.1, c2, METAL, 8);
    r.part(sg, 0, -6.5, 4.6, armL);
  }
  const legs = [r.part(leg(8.5, 2.1, c1, { rough: 0.8 }), -2.9, 8.5, 0), r.part(leg(8.5, 2.1, c1, { rough: 0.8 }), 2.9, 8.5, 0)];
  const tg2 = new Geo();
  tg2.limb(0, 0, 0, 0, -3, -7, 1.3, c0, HIDE);
  const tail = r.part(tg2, 0, 9.5, -3.6);
  return r.done(30, (p) => {
    const s = p.moving ? 1 : 0;
    legs[0].rotation.x = Math.sin(p.ph) * 0.8 * s;
    legs[1].rotation.x = Math.sin(p.ph + PI) * 0.8 * s;
    const bob = Math.abs(Math.sin(p.ph)) * 0.9 * s + Math.sin(p.t * 2.4) * 0.25;
    torso.position.y = 13 + bob;
    torso.rotation.x = 0.12 + p.k * 0.3 - p.windup * 0.15;
    head.position.y = 23.5 + bob;
    head.rotation.x = -p.windup * 0.25 + p.k * 0.2;
    armR.position.y = armL.position.y = 17.5 + bob;
    armR.rotation.x = -0.25 - p.windup * 2.1 + p.k * 1.5 + Math.sin(p.ph + PI) * 0.4 * s;
    armL.rotation.x = Math.sin(p.ph) * 0.45 * s - (heavy ? 0.9 : 0);
    tail.rotation.y = Math.sin(p.t * 4) * 0.4;
  });
}

function treant(def: MonsterDef): Creature {
  const r = new Rig();
  const [c0, c1, c2] = [def.colors[0], def.colors[1] ?? '#3f8a3a', def.colors[2] ?? '#ffd166'];
  const bark = { layer: LAYER.bark, rough: 0.92 };
  const leaf = { layer: LAYER.grass, rough: 0.85, wind: 0.8 };
  const bg = new Geo();
  bg.cyl(0, 15, 0, 6.6, 9, 30, c0, bark, 10);
  bg.sphere(0, 30, 0, 9, 6.6, 8.4, c0, bark, 10);
  for (const [x, y, z, s] of [[0, 43, 0, 15], [-9, 39, 3, 10], [10, 40, -3, 10.5], [2, 37, 8, 9.5]] as number[][]) bg.sphere(x, y, z, s, s * 0.82, s, c1, leaf, 10);
  bg.sphere(-3.2, 23, 8, 1.8, 2.2, 1, c2, { em: 4.5 }, 8);
  bg.sphere(3.2, 23, 8, 1.8, 2.2, 1, c2, { em: 4.5 }, 8);
  bg.box(0, 17, 8.4, 6, 2.2, 1, '#1a120c', { rough: 1 });
  for (let i = 0; i < 5; i++) bg.limb(Math.cos(i * 1.26) * 6, 3, Math.sin(i * 1.26) * 6, Math.cos(i * 1.26) * 13, 0.6, Math.sin(i * 1.26) * 13, 2.1, shadeCol(c0, -0.15), bark);
  const body = r.part(bg, 0, 0, 0);
  const arm = (sx: number): THREE.Mesh => {
    const g = new Geo();
    g.limb(0, 0, 0, sx * 9, -8, 3, 2.7, c0, bark);
    g.limb(sx * 9, -8, 3, sx * 12, -18, 8, 2.1, c0, bark);
    for (let i = 0; i < 3; i++) g.limb(sx * 12, -18, 8, sx * (10 + i * 2.6), -24, 10 + i, 0.8, shadeCol(c0, -0.2), bark);
    g.sphere(sx * 6, -2, 1, 4.6, 3.6, 4.6, c1, leaf, 8);
    return r.part(g, sx * 8, 28, 0);
  };
  const arms = [arm(-1), arm(1)];
  return r.done(54, (p) => {
    const sway = Math.sin(p.t * 1.3) * 0.04 + (p.moving ? Math.sin(p.ph) * 0.07 : 0);
    body.rotation.z = sway;
    body.rotation.x = p.k * 0.22 - p.windup * 0.12;
    arms[0].rotation.x = -p.windup * 1.9 + p.k * 1.5 + Math.sin(p.t * 1.1) * 0.06;
    arms[1].rotation.x = -p.windup * 1.9 + p.k * 1.5 - Math.sin(p.t * 1.1) * 0.06;
    arms[0].rotation.z = sway - 0.1;
    arms[1].rotation.z = sway + 0.1;
  });
}

function spider(def: MonsterDef): Creature {
  const r = new Rig();
  const [c0, c1, c2] = [def.colors[0], def.colors[1] ?? '#2a1a2a', def.colors[2] ?? '#9be15d'];
  const bg = new Geo();
  bg.sphere(0, 0, -7, 9.4, 7.4, 10.4, c0, SHELL, 12);
  bg.sphere(0, -0.4, 5, 6.2, 5, 6.4, c1, SHELL, 10);
  for (let i = 0; i < 4; i++) bg.sphere(-3 + i * 2, 2.2, 10.2, 0.9, 0.9, 0.7, c2, { em: 4.6 }, 6);
  for (const sx of [-1, 1]) bg.cone(sx * 1.9, -3, 11.4, 0.9, 4.6, '#f4ead0', { rough: 0.3 }, 5, [PI * 0.86, 0, 0]);
  bg.sphere(0, 4, -9, 3.4, 2, 4.6, c2, { em: 1.6, rough: 0.4 }, 8);
  const body = r.part(bg, 0, 9.5, 0);
  const legs: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const sx = i < 4 ? -1 : 1;
    const j = i % 4;
    const g = new Geo();
    g.limb(0, 0, 0, sx * 10, 6.4, 0, 0.9, c1, SHELL);
    g.limb(sx * 10, 6.4, 0, sx * 17, -9.4, 0, 0.7, c1, SHELL);
    const m = r.part(g, sx * 4.4, 9.5, 6 - j * 3.6);
    m.rotation.y = sx * (0.7 - j * 0.46);
    m.userData.base = m.rotation.y;
    legs.push(m);
  }
  return r.done(20, (p) => {
    const s = p.moving ? 1 : 0.1;
    legs.forEach((l, i) => {
      const off = (i % 2 ? PI : 0) + (i < 4 ? 0 : PI);
      l.rotation.y = l.userData.base + Math.sin(p.ph * 1.5 + off) * 0.3 * s;
      l.rotation.z = Math.max(0, Math.cos(p.ph * 1.5 + off)) * 0.22 * s * (i < 4 ? -1 : 1);
    });
    body.position.y = 9.5 + Math.sin(p.t * 3) * 0.5 - p.windup * 2.4 + p.k * 4;
    body.position.z = p.k * 7 - p.windup * 3;
    body.rotation.x = -p.windup * 0.22 + p.k * 0.3;
  });
}

function elemental(def: MonsterDef): Creature {
  const r = new Rig();
  const [c0, c1, c2] = [def.colors[0], def.colors[1] ?? '#bfe6ff', def.colors[2] ?? '#ffffff'];
  r.mat.transparent = true;
  r.mat.opacity = 0.84;
  r.mat.uu.uRim.value.set(col(c1).r, col(c1).g, col(c1).b, 1.4);
  const o = { rough: 0.08, metal: 0.1, em: 0.5 };
  const bg = new Geo();
  bg.sphere(0, 14, 0, 9, 11, 8, c0, o, 14);
  bg.sphere(0, 4, 0, 11, 5.4, 10, c0, o, 12);
  bg.sphere(0, 27, 0, 6.4, 6.4, 6, c1, o, 12);
  bg.sphere(-2.4, 28, 5.2, 1.3, 1.6, 0.8, c2, { em: 5 }, 6);
  bg.sphere(2.4, 28, 5.2, 1.3, 1.6, 0.8, c2, { em: 5 }, 6);
  const body = r.part(bg, 0, 2, 0);
  const arms = [-1, 1].map((sx) => {
    const g = new Geo();
    g.limb(0, 0, 0, sx * 6, -6, 4, 3.2, c0, o);
    g.sphere(sx * 7, -8, 6, 4.4, 4.4, 4.4, c1, o, 10);
    return r.part(g, sx * 8.4, 20, 0);
  });
  const orbit = new THREE.Group();
  r.root.add(orbit);
  for (let i = 0; i < 5; i++) {
    const g = new Geo();
    g.sphere(0, 0, 0, 1.9, 2.5, 1.9, c1, { em: 2.6, rough: 0.1 }, 8);
    r.part(g, Math.cos((i / 5) * PI * 2) * 15, 10 + (i % 3) * 7, Math.sin((i / 5) * PI * 2) * 15, orbit);
  }
  return r.done(38, (p) => {
    body.position.y = 2 + Math.sin(p.t * 2.2) * 1.8;
    body.scale.set(1 + Math.sin(p.t * 3.1) * 0.04, 1 - Math.sin(p.t * 3.1) * 0.05, 1 + Math.cos(p.t * 2.7) * 0.04);
    arms[0].rotation.x = -p.windup * 2 + p.k * 1.7 + Math.sin(p.t * 1.9) * 0.2;
    arms[1].rotation.x = -p.windup * 2 + p.k * 1.7 - Math.sin(p.t * 1.9) * 0.2;
    orbit.rotation.y = p.t * 1.4;
  });
}

function sporeling(def: MonsterDef): Creature {
  const r = new Rig();
  const [c0, c1, c2] = [def.colors[0], def.colors[1] ?? '#f4ead0', def.colors[2] ?? '#9be15d'];
  const bg = new Geo();
  bg.cyl(0, 6, 0, 4.4, 5.6, 12, c1, { rough: 0.8 }, 10);
  bg.sphere(-1.9, 8, 4.4, 1, 1.4, 0.7, '#1a1418', { rough: 0.3 }, 6);
  bg.sphere(1.9, 8, 4.4, 1, 1.4, 0.7, '#1a1418', { rough: 0.3 }, 6);
  const body = r.part(bg, 0, 3, 0);
  const cg = new Geo();
  cg.sphere(0, 0, 0, 11, 6.6, 11, c0, { rough: 0.6 }, 14);
  cg.cyl(0, -2.6, 0, 10.4, 9, 2.4, shadeCol(c1, -0.15), { rough: 0.8 }, 14);
  for (let i = 0; i < 7; i++) cg.sphere(Math.cos(i * 0.9) * (3 + (i % 3) * 2.6), 4.6 - (i % 3) * 1.1, Math.sin(i * 0.9) * (3 + (i % 3) * 2.6), 1.7, 1, 1.7, c2, { em: 3 }, 6);
  const cap = r.part(cg, 0, 16.5, 0);
  const legs = [r.part(leg(4, 1.7, c1, { rough: 0.8 }), -2.6, 4, 0), r.part(leg(4, 1.7, c1, { rough: 0.8 }), 2.6, 4, 0)];
  return r.done(24, (p) => {
    const s = p.moving ? 1 : 0;
    legs[0].rotation.x = Math.sin(p.ph * 1.4) * 0.7 * s;
    legs[1].rotation.x = Math.sin(p.ph * 1.4 + PI) * 0.7 * s;
    const sq = 1 + Math.sin(p.t * 3) * 0.05 + p.windup * 0.2 - p.k * 0.15;
    body.position.y = 3 + Math.abs(Math.sin(p.ph * 1.4)) * 1.4 * s;
    cap.position.y = 16.5 + Math.abs(Math.sin(p.ph * 1.4)) * 1.4 * s - p.windup * 2 + p.k * 3;
    cap.scale.set(sq, 2 - sq, sq);
    cap.rotation.z = Math.sin(p.t * 2.2) * 0.08;
  });
}

function golem(def: MonsterDef): Creature {
  const r = new Rig();
  const [c0, c1, c2] = [def.colors[0], def.colors[1] ?? '#2a2028', def.colors[2] ?? '#ff7a3d'];
  const tg = new Geo();
  tg.ico(0, 0, 0, 13, 11.4, 9.6, c0, STONE, 1);
  tg.ico(0, -8, 0, 8.4, 6, 7.4, c1, STONE, 1, [0.4, 0.6, 0]);
  tg.ico(0, 1, 7.6, 3.6, 4.2, 1.9, c2, { em: 6, rough: 0.2 }, 0);
  for (const sx of [-1, 1]) tg.ico(sx * 13.4, 6.4, 0, 6.6, 5.6, 6.2, c0, STONE, 1, [0.3, sx, 0.2]);
  const torso = r.part(tg, 0, 25, 0);
  const hg = new Geo();
  hg.ico(0, 0, 0, 5.6, 4.6, 5.2, c1, STONE, 1);
  hg.box(0, 0.2, 4.6, 6.4, 1.3, 1, c2, { em: 6.5 });
  const head = r.part(hg, 0, 39, 1.6);
  const arm = (sx: number): THREE.Mesh => {
    const g = new Geo();
    g.ico(0, -6, 0, 4.4, 7, 4.4, c1, STONE, 1);
    g.ico(0, -17, 1.2, 6.4, 7.6, 6.4, c0, STONE, 1, [0.5, 0.3, 0.2]);
    g.ico(0, -19, 5, 1.6, 1.6, 1.3, c2, { em: 5 }, 0);
    return r.part(g, sx * 15.6, 30, 0);
  };
  const arms = [arm(-1), arm(1)];
  const lg = (): Geo => {
    const g = new Geo();
    g.ico(0, -6.4, 0, 5.2, 7.6, 5.2, c1, STONE, 1);
    g.ico(0, -13.5, 1.6, 6.2, 3.4, 7.4, c0, STONE, 1);
    return g;
  };
  const legs = [r.part(lg(), -6.4, 16, 0), r.part(lg(), 6.4, 16, 0)];
  return r.done(46, (p) => {
    const s = p.moving ? 1 : 0;
    legs[0].rotation.x = Math.sin(p.ph * 0.8) * 0.5 * s;
    legs[1].rotation.x = Math.sin(p.ph * 0.8 + PI) * 0.5 * s;
    const bob = Math.abs(Math.sin(p.ph * 0.8)) * 1.3 * s;
    torso.position.y = 25 + bob;
    torso.rotation.x = p.k * 0.34 - p.windup * 0.2;
    torso.rotation.y = Math.sin(p.ph * 0.8) * 0.1 * s;
    head.position.y = 39 + bob;
    arms[0].rotation.x = -p.windup * 2.5 + p.k * 2.1 + Math.sin(p.ph * 0.8 + PI) * 0.35 * s;
    arms[1].rotation.x = -p.windup * 2.5 + p.k * 2.1 + Math.sin(p.ph * 0.8) * 0.35 * s;
    arms[0].position.y = arms[1].position.y = 30 + bob;
  });
}

function flyer(def: MonsterDef, kind: 'imp' | 'wyvern'): Creature {
  const r = new Rig();
  const [c0, c1, c2] = [def.colors[0], def.colors[1] ?? '#3a1a1a', def.colors[2] ?? '#ffb35c'];
  const wy = kind === 'wyvern';
  const S = wy ? 1.5 : 1;
  const bg = new Geo();
  bg.sphere(0, 0, 0, 5 * S, 5 * S, wy ? 10 * S : 5.4, c0, HIDE, 12);
  bg.sphere(0, -1.4 * S, 0, 4 * S, 3 * S, wy ? 8 * S : 4, c1, HIDE, 10);
  if (wy) {
    bg.limb(0, 1, 9 * S, 0, 6 * S, 16 * S, 2.6 * S, c0, HIDE);
    bg.limb(0, 0, -9 * S, 0, -2, -22 * S, 2.2 * S, c0, HIDE);
    bg.cone(0, -2.4, -27 * S, 2.6 * S, 6 * S, c2, { em: 1 }, 4, [-PI / 2, 0, 0]);
  }
  const body = r.part(bg, 0, 0, 0);
  const hg = new Geo();
  hg.sphere(0, 0, 0, 4.4 * S, 4 * S, wy ? 5.6 * S : 4.4, c0, HIDE, 10);
  if (wy) hg.sphere(0, -1, 5.4 * S, 2.6 * S, 2 * S, 3.8 * S, c1, HIDE, 8);
  for (const sx of [-1, 1]) {
    hg.cone(sx * 2.8 * S, 4 * S, -1.4, 1.1 * S, 5.4 * S, c1, HIDE, 5, [-0.5, 0, -sx * 0.4]);
    hg.sphere(sx * 2 * S, 0.8 * S, (wy ? 4.4 : 3.6) * S, 1 * S, 1.1 * S, 0.6, c2, { em: 5 }, 6);
  }
  if (!wy) hg.cone(0, -2.6, 3.6, 2.2, 1.6, '#f4ead0', { rough: 0.4 }, 6, [PI, 0, 0]);
  const head = r.part(hg, 0, wy ? 7 * S : 6.4, wy ? 18 * S : 2);
  const wings = [-1, 1].map((sx) => {
    const g = new Geo();
    const span = wy ? 30 : 13;
    g.limb(0, 0, 0, sx * span * 0.55, 3, 2, 0.9 * S, c1, HIDE);
    g.limb(sx * span * 0.55, 3, 2, sx * span, 0, -3, 0.7 * S, c1, HIDE);
    for (let i = 0; i < 4; i++) g.box(sx * (span * 0.2 + i * span * 0.22), 0.6, -4 * S - i, span * 0.24, 0.4, (8 - i * 1.2) * S, i % 2 ? shadeCol(c2, -0.3) : shadeCol(c0, -0.15), { rough: 0.7 }, [0, sx * 0.1 * i, 0]);
    return r.part(g, sx * 4 * S, 3 * S, 1);
  });
  let fire: THREE.Mesh | null = null;
  if (!wy) {
    const fg = new Geo();
    fg.sphere(0, 0, 0, 2, 2.6, 2, c2, { em: 6 }, 8);
    fire = r.part(fg, -6, -1, 5);
    const tg = new Geo();
    tg.limb(0, 0, 0, 0, -5, -5, 0.6, c1, HIDE);
    tg.cone(0, -6, -6, 1.3, 3, c2, { em: 2 }, 4, [-2, 0, 0]);
    r.part(tg, 0, -3, -4);
  }
  return r.done(wy ? 30 : 20, (p) => {
    const flap = Math.sin(p.t * (wy ? 5 : 13));
    wings[0].rotation.z = 0.2 + flap * 0.55;
    wings[1].rotation.z = -0.2 - flap * 0.55;
    body.position.y = flap * (wy ? -1.4 : -0.8);
    body.rotation.x = p.k * 0.4 - p.windup * 0.25;
    head.rotation.x = p.windup * 0.4 - p.k * 0.5;
    head.position.z = (wy ? 18 * S : 2) + p.k * 5;
    if (fire) fire.scale.setScalar(0.8 + Math.sin(p.t * 17) * 0.2 + p.windup * 1.4);
  });
}

function wraith(def: MonsterDef, reaver = false): Creature {
  const r = new Rig();
  const [c0, c1, c2] = [def.colors[0], def.colors[1] ?? '#1a1028', def.colors[2] ?? '#7fe9ff'];
  if (!reaver) {
    r.mat.transparent = true;
    r.mat.opacity = 0.86;
    r.mat.uu.uRim.value.set(col(c2).r, col(c2).g, col(c2).b, 1.5);
  }
  const cloth = { rough: 0.95, wind: 0.5 };
  const bg = new Geo();
  for (let i = 0; i < 6; i++) bg.cyl(0, 3 + i * 4.2, 0, 4.4 + (5 - i) * 0.5, 5.4 + (5 - i) * 0.9, 4.6, i % 2 ? shadeCol(c0, -0.12) : c0, { rough: 0.95, wind: (6 - i) * 0.22 }, 10);
  bg.sphere(0, 27, 0, 7.4, 5.4, 6, reaver ? c1 : c0, reaver ? METAL : cloth, 12);
  if (reaver) {
    for (const sx of [-1, 1]) {
      bg.sphere(sx * 8.4, 28.6, 0, 4, 3, 4, c1, METAL, 8);
      bg.cone(sx * 10.6, 32, 0, 1.3, 6.4, c2, { em: 2 }, 5, [0, 0, -sx * 0.6]);
    }
    bg.ico(0, 23, 5, 2, 2.6, 1.2, c2, { em: 6 }, 0);
  }
  const body = r.part(bg, 0, 4, 0);
  const hg = new Geo();
  hg.sphere(0, 0, -0.6, 6, 6, 6.2, c0, cloth, 12);
  hg.cone(0, 5, -3.4, 4, 7, c0, cloth, 8, [-0.7, 0, 0]);
  hg.sphere(0, -0.4, 3, 3.9, 4.2, 3, '#05060c', { rough: 1 }, 10);
  hg.sphere(-1.7, 0, 5.4, 0.95, 1.2, 0.7, c2, { em: 7 }, 6);
  hg.sphere(1.7, 0, 5.4, 0.95, 1.2, 0.7, c2, { em: 7 }, 6);
  const head = r.part(hg, 0, 36.5, 1);
  const arm = (sx: number, weapon: boolean): THREE.Mesh => {
    const g = new Geo();
    g.limb(0, 0, 0, sx * 3, -8, 5, 1.9, c0, cloth);
    g.sphere(sx * 3.2, -9, 6, 1.5, 1.5, 1.5, reaver ? c1 : '#d8e6f0', { rough: 0.5 }, 6);
    if (weapon) {
      g.cyl(sx * 3.2, -3, 9, 0.6, 0.6, 34, '#2a2030', { rough: 0.7 }, 6, [0.5, 0, 0]);
      g.box(sx * 3.2 + 5.4, 10.6, 16.4, 12, 3.2, 0.7, c2, { em: 2.2, metal: 0.8, rough: 0.25 }, [0.5, 0, -0.2]);
      g.cone(sx * 3.2 + 12, 9.4, 15.9, 1.7, 6, c2, { em: 2.2, metal: 0.8, rough: 0.25 }, 4, [0.5, 0, -1.9]);
    }
    return r.part(g, sx * 7.4, 30, 0);
  };
  const arms = [arm(-1, true), arm(1, false)];
  return r.done(46, (p) => {
    const fl = Math.sin(p.t * 2.2) * 2;
    body.position.y = 4 + fl;
    head.position.y = 36.5 + fl;
    body.rotation.x = 0.1 + p.k * 0.3 - p.windup * 0.2;
    arms[0].position.y = arms[1].position.y = 30 + fl;
    arms[0].rotation.x = -p.windup * 2.2 + p.k * 1.9 + Math.sin(p.t * 1.7) * 0.1;
    arms[0].rotation.y = p.k * -0.8;
    arms[1].rotation.x = Math.sin(p.t * 1.4) * 0.15 - p.windup * 0.5;
    head.rotation.y = Math.sin(p.t * 0.8) * 0.2;
  });
}

function automaton(def: MonsterDef): Creature {
  const r = new Rig();
  const [c0, c1, c2] = [def.colors[0], def.colors[1] ?? '#c9a23a', def.colors[2] ?? '#7fe9ff'];
  const bg = new Geo();
  bg.cyl(0, 0, 0, 8, 6, 14, c0, METAL, 12);
  bg.torus(0, 4.6, 0, 8.2, 1, c1, METAL, [PI / 2, 0, 0], PI * 2, 16);
  bg.torus(0, -4.6, 0, 6.6, 0.9, c1, METAL, [PI / 2, 0, 0], PI * 2, 16);
  bg.ico(0, 0.6, 7.2, 2.6, 3.2, 1.4, c2, { em: 6.5, rough: 0.1 }, 0);
  for (const sx of [-1, 1]) bg.sphere(sx * 9.6, 5, 0, 3.8, 3.4, 3.8, c1, METAL, 10);
  const body = r.part(bg, 0, 24, 0);
  const hg = new Geo();
  hg.sphere(0, 0, 0, 5.2, 4.6, 5.2, c0, METAL, 12);
  hg.box(0, 0.2, 4.4, 7, 1.5, 1.6, c2, { em: 7 });
  hg.cone(0, 6.6, 0, 1.3, 5, c1, METAL, 6);
  for (const sx of [-1, 1]) hg.box(sx * 5.6, 0.6, -1, 1.2, 6, 4.4, c1, METAL, [0, 0, sx * 0.3]);
  const head = r.part(hg, 0, 36.5, 0);
  const arm = (sx: number): THREE.Mesh => {
    const g = new Geo();
    g.limb(0, 0, 0, 0, -8, 1, 1.9, c0, METAL);
    g.sphere(0, -9, 1.4, 2.5, 2.5, 2.5, c1, METAL, 8);
    g.box(0, -17, 4, 1.1, 16, 3.6, '#dfe8f4', { metal: 0.95, rough: 0.15 }, [0.25, 0, 0]);
    g.box(0, -15, 4, 0.5, 12, 1.2, c2, { em: 3.5 }, [0.25, 0, 0]);
    return r.part(g, sx * 10.6, 30, 0);
  };
  const arms = [arm(-1), arm(1)];
  const ring = new Geo();
  ring.torus(0, 0, 0, 9.4, 1.2, c1, METAL, [PI / 2, 0, 0], PI * 2, 20);
  for (let i = 0; i < 6; i++) ring.box(Math.cos((i / 6) * PI * 2) * 9.4, 0, Math.sin((i / 6) * PI * 2) * 9.4, 2.4, 2.6, 2.4, c0, METAL);
  const halo = r.part(ring, 0, 11, 0);
  const jet = new Geo();
  jet.cone(0, 0, 0, 4.4, 9, c2, { em: 5 }, 8, [PI, 0, 0]);
  const thr = r.part(jet, 0, 7.5, 0);
  return r.done(44, (p) => {
    const fl = Math.sin(p.t * 2.6) * 1.3;
    body.position.y = 24 + fl;
    head.position.y = 36.5 + fl;
    head.rotation.y = Math.sin(p.t * 1.3) * 0.3;
    halo.rotation.y = p.t * 2.4;
    halo.position.y = 11 + fl;
    thr.position.y = 7.5 + fl;
    thr.scale.set(1, 0.7 + Math.sin(p.t * 21) * 0.2 + (p.moving ? 0.5 : 0), 1);
    arms[0].position.y = arms[1].position.y = 30 + fl;
    arms[0].rotation.x = -p.windup * 2.3 + p.k * 2;
    arms[1].rotation.x = -p.windup * 2.3 + p.k * 2;
    arms[0].rotation.z = -0.15 - p.k * 0.4;
    arms[1].rotation.z = 0.15 + p.k * 0.4;
    body.rotation.x = p.k * 0.25;
  });
}

function wisp(def: MonsterDef): Creature {
  const r = new Rig();
  const [c0, c1] = [def.colors[0], def.colors[2] ?? def.colors[1] ?? '#ffffff'];
  r.mat.uu.uRim.value.set(col(c1).r, col(c1).g, col(c1).b, 1.2);
  const g = new Geo();
  g.sphere(0, 0, 0, 5.6, 5.6, 5.6, c1, { em: 7, rough: 0.1 }, 14);
  g.sphere(0, 0, 0, 7.4, 7.4, 7.4, c0, { em: 1.6, rough: 0.2 }, 12);
  const core = r.part(g, 0, 20, 0);
  const orbit = new THREE.Group();
  orbit.position.y = 20;
  r.root.add(orbit);
  for (let i = 0; i < 6; i++) {
    const mg = new Geo();
    mg.ico(0, 0, 0, 1.4, 2.4, 1.4, c1, { em: 5 }, 0);
    r.part(mg, Math.cos((i / 6) * PI * 2) * 11, Math.sin(i * 1.7) * 3, Math.sin((i / 6) * PI * 2) * 11, orbit);
  }
  return r.done(30, (p) => {
    core.position.y = 20 + Math.sin(p.t * 2.4) * 2.2;
    const s = 1 + Math.sin(p.t * 6) * 0.07 + p.windup * 0.35;
    core.scale.setScalar(s);
    orbit.rotation.y = p.t * 2.2;
    orbit.rotation.x = Math.sin(p.t * 0.9) * 0.4;
    orbit.position.y = core.position.y;
  });
}

function wyrm(def: MonsterDef): Creature {
  const r = new Rig();
  const [c0, c1, c2] = [def.colors[0], def.colors[1] ?? '#2a1414', def.colors[2] ?? '#ffb02e'];
  const segs: THREE.Mesh[] = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const k = 1 - i / (N + 2);
    const g = new Geo();
    g.sphere(0, 0, 0, 9 * k, 8 * k, 8.6, c0, HIDE, 12);
    g.sphere(0, -3 * k, 0, 7 * k, 5 * k, 7.6, c1, HIDE, 10);
    g.cone(0, 8.4 * k, 0, 2.2 * k, 7 * k, c2, { em: 1.4 }, 5, [-0.3, 0, 0]);
    segs.push(r.part(g, 0, 10, -i * 11.5));
  }
  const hg = new Geo();
  hg.sphere(0, 0, 0, 9.4, 7.6, 11, c0, HIDE, 14);
  hg.sphere(0, -2.4, 10, 6.4, 4.4, 8, c1, HIDE, 10);
  for (const sx of [-1, 1]) {
    hg.cone(sx * 5.6, 7.4, -4, 2, 12, c2, { em: 1.4 }, 6, [-0.8, 0, -sx * 0.35]);
    hg.sphere(sx * 4.6, 2.4, 6.4, 1.7, 1.9, 1, '#ffe066', { em: 7 }, 8);
    hg.cone(sx * 3, -6, 13, 0.9, 4, '#ffffff', { rough: 0.3 }, 5, [PI, 0, 0]);
  }
  hg.sphere(0, -4.4, 15.4, 3.4, 1.9, 2.6, c2, { em: 4 }, 8);
  const head = r.part(hg, 0, 16, 12);
  const wings = [-1, 1].map((sx) => {
    const g = new Geo();
    g.limb(0, 0, 0, sx * 22, 9, -2, 1.6, c1, HIDE);
    for (let i = 0; i < 5; i++) g.box(sx * (5 + i * 4.4), 3 - i * 0.6, -8 - i * 0.8, 4.8, 0.5, 15 - i * 2, i % 2 ? shadeCol(c2, -0.35) : shadeCol(c0, -0.2), { rough: 0.7 }, [0, sx * 0.1 * i, 0]);
    return r.part(g, sx * 7, 16, -8);
  });
  return r.done(40, (p) => {
    segs.forEach((s, i) => {
      s.position.x = Math.sin(p.t * 2.2 - i * 0.7) * (2 + i * 0.9);
      s.position.y = 10 + Math.sin(p.t * 1.7 - i * 0.6) * 1.6;
    });
    head.position.x = Math.sin(p.t * 2.2 + 0.7) * 2;
    head.position.y = 16 + Math.sin(p.t * 1.7) * 2 + p.windup * 7 - p.k * 4;
    head.position.z = 12 + p.k * 12 - p.windup * 5;
    head.rotation.x = -p.windup * 0.5 + p.k * 0.5;
    const flap = Math.sin(p.t * 3.4);
    wings[0].rotation.z = 0.25 + flap * 0.4;
    wings[1].rotation.z = -0.25 - flap * 0.4;
  });
}

const BASE_SIZE: Record<string, number> = { wolf: 13, boar: 15, kobold: 11, treant: 17, spider: 13, elemental: 14, sporeling: 11, drake: 16, golem: 19, imp: 10, wyvern: 16, wraith: 13, automaton: 15, wisp: 9, reaver: 13, wyrm: 16 };

/** builds the 3D rig of a non-humanoid monster, scaled to its collision size like the 2D sprite */
export function buildCreature(def: MonsterDef): Creature {
  let c: Creature;
  switch (def.draw) {
    case 'wolf': c = quadruped(def, 'wolf'); break;
    case 'boar': c = quadruped(def, 'boar'); break;
    case 'drake': c = quadruped(def, 'drake'); break;
    case 'kobold': c = kobold(def); break;
    case 'treant': c = treant(def); break;
    case 'spider': c = spider(def); break;
    case 'elemental': c = elemental(def); break;
    case 'sporeling': c = sporeling(def); break;
    case 'golem': c = golem(def); break;
    case 'imp': c = flyer(def, 'imp'); break;
    case 'wyvern': c = flyer(def, 'wyvern'); break;
    case 'wraith': c = wraith(def); break;
    case 'reaver': c = wraith(def, true); break;
    case 'automaton': c = automaton(def); break;
    case 'wisp': c = wisp(def); break;
    case 'wyrm': c = wyrm(def); break;
    default: c = sporeling(def);
  }
  const s = def.size / (BASE_SIZE[def.draw] ?? def.size);
  c.root.scale.setScalar(s);
  c.height *= s;
  return c;
}

export function buildMount(m: MountDef): Creature {
  const def = { colors: [m.colors[0], m.colors[1], m.colors[2]] };
  const kind = m.kind === 'drake' ? 'mountdrake' : m.kind === 'gryphon' ? 'gryphon' : m.kind === 'wolf' ? 'wolf' : m.kind === 'stag' ? 'stag' : 'horse';
  const c = quadruped(def, kind);
  if (m.kind === 'wolf') c.root.scale.setScalar(1.55);
  return c;
}

/** a small elemental familiar */
export function buildPet(color: string, color2: string): Creature {
  const r = new Rig();
  r.mat.uu.uRim.value.set(col(color).r, col(color).g, col(color).b, 0.9);
  const g = new Geo();
  g.sphere(0, 0, 0, 4.6, 4.2, 4.6, color, { em: 1.6, rough: 0.3 }, 12);
  g.sphere(-1.6, 0.6, 3.9, 0.8, 1, 0.5, '#141018', { rough: 0.3 }, 6);
  g.sphere(1.6, 0.6, 3.9, 0.8, 1, 0.5, '#141018', { rough: 0.3 }, 6);
  g.cone(0, 4.6, 0, 1.2, 3, color2, { em: 3 }, 5);
  const body = r.part(g, 0, 0, 0);
  const wings = [-1, 1].map((sx) => {
    const wg = new Geo();
    wg.sphere(sx * 4.4, 0, 0, 4, 0.5, 2.6, color2, { em: 2.4, rough: 0.3 }, 8);
    return r.part(wg, sx * 2.4, 1.4, -0.6);
  });
  return r.done(8, (p) => {
    const f = Math.sin(p.t * 16);
    wings[0].rotation.z = 0.3 + f * 0.6;
    wings[1].rotation.z = -0.3 - f * 0.6;
    body.rotation.z = Math.sin(p.t * 2) * 0.1;
  });
}

// ---------------------------------------------------------------------------------- objects

export function breakableGeo(variant: string): Geo {
  const g = new Geo();
  if (variant === 'barrel') {
    g.cyl(0, 10, 0, 7.4, 6.4, 20, '#7a3a1a', { layer: LAYER.planks, rough: 0.8 }, 12);
    for (const y of [4.4, 15.6]) g.torus(0, y, 0, 7.5, 0.7, '#3a3a44', METAL, [PI / 2, 0, 0], PI * 2, 16);
    g.cyl(0, 20.4, 0, 6.6, 6.6, 0.9, '#ff7a3d', { em: 2.6 }, 12);
    g.box(0, 10, 7.2, 3, 7, 0.6, '#ffd166', { em: 2 });
  } else if (variant === 'frost') {
    const cols = ['#bff3ff', '#7fe9ff', '#dff6ff'];
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      const h = 15 + (i % 3) * 7;
      g.push(Math.cos(a) * (i ? 5 : 0), 0, Math.sin(a) * (i ? 5 : 0), Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
      g.cyl(0, h * 0.4, 0, 2.8, 3.8, h * 0.8, cols[i % 3], { em: 1.6, rough: 0.08, metal: 0.2 }, 6);
      g.cone(0, h * 0.8 + 3, 0, 2.8, 6, cols[i % 3], { em: 2, rough: 0.08, metal: 0.2 }, 6);
      g.pop();
    }
  } else if (variant === 'crate') {
    g.box(0, 9, 0, 18, 18, 18, '#8a5a32', { layer: LAYER.planks, rough: 0.85 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.box(sx * 9, 9, sz * 9, 2, 19, 2, '#5a3a1a', { rough: 0.85 });
    g.box(0, 18.4, 0, 19.4, 1.2, 19.4, '#5a3a1a', { rough: 0.85 });
  } else {
    g.cyl(0, 4, 0, 6.4, 4.4, 8, '#b9845a', { layer: LAYER.plaster, rough: 0.7 }, 12);
    g.cyl(0, 12, 0, 4, 6.4, 8, '#b9845a', { layer: LAYER.plaster, rough: 0.7 }, 12);
    g.cyl(0, 17.4, 0, 4.6, 3.6, 3, '#8a5a3a', { rough: 0.7 }, 12);
    g.torus(0, 9, 0, 6.5, 0.5, '#e0c49a', { rough: 0.6 }, [PI / 2, 0, 0], PI * 2, 14);
  }
  return g;
}

export function chestGeo(lid: boolean): Geo {
  const g = new Geo();
  const o = { layer: LAYER.planks, rough: 0.8 };
  if (!lid) {
    g.box(0, 6.5, 0, 24, 13, 15, '#6b4224', o);
    for (const sx of [-1, 0, 1]) g.box(sx * 10.6, 6.5, 0, 2.2, 13.6, 15.6, '#ffd166', METAL);
    g.box(0, 9.5, 7.8, 4, 5, 1.2, '#ffd166', METAL);
  } else {
    g.cyl(0, 0, -7.5, 7.5, 7.5, 24, '#8a5a32', o, 12, [0, 0, PI / 2]);
    for (const sx of [-1, 0, 1]) g.cyl(sx * 10.6, 0, -7.5, 7.8, 7.8, 2.2, '#ffd166', METAL, 12, [0, 0, PI / 2]);
  }
  return g;
}

export function oreGeo(color: string, glow: boolean): Geo {
  const g = new Geo();
  g.ico(0, 6, 0, 13, 9, 11, '#6e6a70', STONE, 1, [0.3, 0.5, 0.1]);
  g.ico(8, 4, 4, 6, 5, 6, '#5a565c', STONE, 1, [0.8, 0.2, 0.3]);
  const o = glow ? { em: 3.4, rough: 0.12, metal: 0.4 } : { rough: 0.2, metal: 0.7 };
  for (const [x, y, z, s, rx, rz] of [[-5, 11, 3, 4, 0.3, 0.4], [3, 14, -1, 5, -0.2, -0.3], [7, 8, 6, 3.4, 0.6, -0.6], [-2, 8, 8, 3, 0.9, 0.2], [-8, 7, -4, 3.4, -0.5, 0.5]] as number[][]) g.ico(x, y, z, s * 0.62, s * 1.25, s * 0.62, color, o, 0, [rx, 0, rz]);
  return g;
}

export function oreDepletedGeo(): Geo {
  const g = new Geo();
  g.ico(0, 4.5, 0, 12, 6.4, 10, '#4a474c', STONE, 1, [0.3, 0.5, 0.1]);
  g.ico(7, 3, 4, 5, 4, 5, '#3f3c42', STONE, 1, [0.8, 0.2, 0.3]);
  return g;
}

export function herbGeo(color: string, ready: boolean): Geo {
  const g = new Geo();
  const stem = ready ? '#3f8a3a' : '#5a5a4a';
  for (let i = -2; i <= 2; i++) {
    g.limb(0, 0, 0, i * 3.4, ready ? 11 : 4.4, Math.abs(i) * 1.2 - 1, 0.6, stem, { rough: 0.8, wind: 0.5 });
    if (ready) g.sphere(i * 3.4, 12.4, Math.abs(i) * 1.2 - 1, 2.1, 2.3, 2.1, color, { em: 2.2, rough: 0.4, wind: 0.6 }, 8);
  }
  for (const sx of [-1, 1]) g.sphere(sx * 3.4, 2, 2, 3.4, 0.7, 2, shadeCol(stem, -0.1), { rough: 0.8, wind: 0.15 }, 6, [0, 0, sx * 0.4]);
  return g;
}

export function caravanGeo(): Geo {
  const g = new Geo();
  const w = { layer: LAYER.planks, rough: 0.8 };
  g.box(-6, 14, 0, 40, 12, 22, '#6b4224', w);
  g.cyl(-6, 26, 0, 12, 12, 40, '#e8dcc0', { rough: 0.95 }, 12, [0, 0, PI / 2]);
  for (const x of [-18, 6]) for (const z of [-12.5, 12.5]) {
    g.cyl(x, 7, z, 7, 7, 2.4, '#3a2414', w, 12, [PI / 2, 0, 0]);
    g.cyl(x, 7, z, 1.6, 1.6, 3, '#a07a4a', METAL, 8, [PI / 2, 0, 0]);
  }
  g.box(18, 12, 0, 12, 1.6, 2, '#5a3a24', w);
  // the draft horse
  g.sphere(32, 17, 0, 12, 7, 6.4, '#8a5a32', FUR, 12);
  g.sphere(43, 26, 0, 5, 4, 3.6, '#8a5a32', FUR, 10, [0, 0, -0.5]);
  for (const [x, z] of [[26, -3.4], [26, 3.4], [38, -3.4], [38, 3.4]] as [number, number][]) g.limb(x, 14, z, x, 1, z, 1.7, '#5a3a24', FUR);
  return g;
}

export { makeUber, makeUberDepth };
