// Procedural 3D humanoid: a chibi-proportioned body built from the same Look the 2D paper-doll
// uses (skin, hair style, every equipped piece and its colours), posed each frame with two-bone
// IK for arms and legs, and animated from the simulation's Anim state (walk cycle, weapon swings
// between the combo angles, thrusts, bow draw, block, cast, dodge, stagger).
import * as THREE from 'three';
import type { Anim } from '../types/game';
import type { Look } from '../render/paperdoll';
import type { GearVis } from '../render/gear';
import { angDiff, clamp, easeOutCubic, lerp } from '../engine/util';
import { LAYER } from './textures';
import { Geo, col, makeUber, makeUberDepth, shadeCol, type UberUniforms } from './util3';

const PI = Math.PI;
const HIP_Y = 15;
const SH_Y = 25.4;
const SH_X = 6.5;
const L1 = 7.6;
const L2 = 7.5;
const A1 = 6.3;
const A2 = 6.0;

const Y_UP = new THREE.Vector3(0, 1, 0);
const Y_DOWN = new THREE.Vector3(0, -1, 0);
// scratch vectors: i* belong to the IK helpers, v* to the rig update
const _i1 = new THREE.Vector3();
const _i2 = new THREE.Vector3();
const _i3 = new THREE.Vector3();
const _d = new THREE.Vector3();
const vS = new THREE.Vector3();
const vE = new THREE.Vector3();
const vShR = new THREE.Vector3();
const vShL = new THREE.Vector3();
const vHip = new THREE.Vector3();
const vFoot = new THREE.Vector3();
const vKnee = new THREE.Vector3();
const vTmp = new THREE.Vector3();

export interface HumanPose {
  anim: Anim;
  /** world aim angle and the angle the body currently faces (radians, game convention) */
  aim: number;
  face: number;
  moving: boolean;
  blocking: boolean;
  t: number;
  dt: number;
  speed: number;
  seated?: boolean;
  down?: boolean;
  stunned?: boolean;
  /** 0..1 progress through a dodge roll (player), -1 when not dodging */
  dodge?: number;
}

// ---------------------------------------------------------------------------------- gear geometry

const METAL = { metal: 0.92, rough: 0.28 };
const LEATHER = { rough: 0.72 };
const CLOTH = { rough: 0.94 };

function glowOf(v: GearVis): string | null {
  if (v.mythic) return '#ff9ad8';
  if (v.gem) return v.gem;
  if (v.temper >= 6 || v.rarity >= 4) return v.glow;
  return null;
}

/** weapons are modelled along +Y with the grip at the origin; returns the blade length */
export function weaponGeo(g: Geo, v: GearVis): number {
  const glow = glowOf(v);
  const em = glow ? { em: 2.6, rough: 0.3 } : undefined;
  const t = v.tier;
  switch (v.kind) {
    case 'sword':
    case 'twinblade': {
      const twin = v.kind === 'twinblade';
      const len = twin ? 19 + t * 0.5 : 23 + t * 0.7;
      const w = twin ? 2.3 : 2.7 + t * 0.08;
      g.cyl(0, 0, 0, 0.62, 0.62, 5, v.accent, LEATHER, 8);
      g.sphere(0, -2.9, 0, 1.05, 1.05, 1.05, v.trim, METAL, 8);
      g.box(0, 2.9, 0, twin ? 4.6 : 6.4 + t * 0.2, 1, 1.5, v.trim, METAL);
      if (t >= 3) for (const sx of [-1, 1]) g.cone(sx * (twin ? 2.6 : 3.6 + t * 0.1), 3.6, 0, 0.7, 2.2, v.trim, METAL, 6, [0, 0, -sx * 0.5]);
      g.box(0, 3.4 + len * 0.44, 0, w, len * 0.88, 0.6, v.main, METAL);
      g.cone(0, 3.4 + len * 0.94, 0, w * 0.72, len * 0.14, v.main, METAL, 4, [0, PI / 4, 0]);
      g.box(0, 3.4 + len * 0.4, 0, w * 0.32, len * 0.74, 0.72, glow ?? shadeCol(v.main, 0.25), em ?? METAL);
      if (t >= 5) g.sphere(0, 2.9, 0, 0.95, 0.95, 1.1, glow ?? v.trim, glow ? { em: 4 } : METAL, 8);
      return 3.4 + len;
    }
    case 'spear':
    case 'halberd': {
      const shaft = 46;
      g.cyl(0, 8, 0, 0.6, 0.66, shaft, v.accent, { layer: LAYER.bark, rough: 0.8 }, 7);
      g.cyl(0, -15.4, 0, 0.9, 0.5, 1.6, v.trim, METAL, 7);
      if (v.kind === 'spear') {
        g.cone(0, 35.5, 0, 1.6, 9, v.main, METAL, 4, [0, PI / 4, 0]);
        g.cyl(0, 30.4, 0, 0.95, 1.5, 2.2, v.trim, METAL, 6);
        g.box(0, 34.4, 0, 0.5, 6, 0.9, glow ?? shadeCol(v.main, 0.2), em ?? METAL);
        if (t >= 2) g.quad(1.8, 28.4, 0, 3.2, 4, v.accent === v.trim ? '#c0283f' : v.trim, { rough: 0.9, wind: 0.6 });
      } else {
        g.cone(0, 36.5, 0, 1.3, 8, v.main, METAL, 4, [0, PI / 4, 0]);
        g.box(3.4, 28.6, 0, 5.4, 8.6, 0.6, v.main, METAL);
        g.cone(6.6, 28.6, 0, 4.3, 3, v.main, METAL, 4, [0, 0, -PI / 2]);
        g.cone(-2.4, 28.6, 0, 1.5, 4, v.main, METAL, 4, [0, 0, PI / 2]);
        g.box(3.2, 28.6, 0, 3.2, 5.6, 0.74, glow ?? shadeCol(v.main, 0.2), em ?? METAL);
        g.cyl(0, 24, 0, 1, 1, 1.6, v.trim, METAL, 6);
      }
      return 40;
    }
    case 'bow': {
      // limbs curve away from the archer (+Z); the string runs along Y at z = 0
      g.cyl(0, 0, 3.4, 0.8, 0.8, 5, v.accent, LEATHER, 7);
      for (const s of [-1, 1]) {
        g.limb(0, s * 2.4, 3.4, 0, s * 9, 2.4, 0.62, v.main, { rough: 0.6 });
        g.limb(0, s * 9, 2.4, 0, s * 14.5, -0.6, 0.5, v.main, { rough: 0.6 });
        g.sphere(0, s * 14.8, -0.8, 0.7, 0.7, 0.7, v.trim, METAL, 6);
      }
      g.cyl(0, 0, -0.7, 0.12, 0.12, 29.4, glow ?? '#e8e0d0', glow ? { em: 2 } : { rough: 0.5 }, 4);
      return 6;
    }
    case 'staff': {
      const c = glow ?? v.glow;
      g.cyl(0, 6, 0, 0.62, 0.7, 40, v.accent, { layer: LAYER.bark, rough: 0.8 }, 7);
      g.cyl(0, 25.6, 0, 1.05, 0.7, 1.4, v.trim, METAL, 7);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * PI * 2;
        g.limb(Math.cos(a) * 0.6, 26, Math.sin(a) * 0.6, Math.cos(a) * 2.6, 29.4, Math.sin(a) * 2.6, 0.36, v.trim, METAL);
        g.limb(Math.cos(a) * 2.6, 29.4, Math.sin(a) * 2.6, Math.cos(a) * 1.5, 32.2, Math.sin(a) * 1.5, 0.3, v.trim, METAL);
      }
      g.ico(0, 29.8, 0, 2.3, 2.9, 2.3, c, { em: 5, rough: 0.1, metal: 0.2 }, 0);
      g.cyl(0, -14.2, 0, 0.9, 0.4, 2, v.trim, METAL, 7);
      return 32;
    }
    default:
      return 0;
  }
}

/** shield modelled facing +Z, centred at the origin */
export function shieldGeo(g: Geo, v: GearVis): void {
  const t = v.tier;
  if (t >= 3) {
    g.box(0, 1.6, 0, 12.5, 9, 1.2, v.main, METAL);
    g.cone(0, -5.6, 0, 6.6, 6.4, v.main, METAL, 4, [PI, PI / 4, 0]);
    g.box(0, 6.4, 0.1, 13.4, 1.3, 1.6, v.trim, METAL);
    g.box(0, 0.6, 0.75, 1.9, 13, 0.5, v.accent, METAL);
    g.box(0, 2.2, 0.75, 9.6, 1.9, 0.5, v.accent, METAL);
  } else {
    g.cyl(0, 0, 0, 7.4, 7.4, 1.2, v.main, { metal: 0.6, rough: 0.5 }, 18, [PI / 2, 0, 0]);
    g.torus(0, 0, 0.3, 7.3, 0.7, v.trim, METAL, [0, 0, 0], PI * 2, 20);
    g.box(0, 0, 0.7, 1.7, 11, 0.4, v.accent, METAL);
    g.box(0, 0, 0.7, 11, 1.7, 0.4, v.accent, METAL);
  }
  g.sphere(0, 0.4, 1, 2.1, 2.1, 1.4, glowOf(v) ?? v.trim, glowOf(v) ? { em: 3 } : METAL, 10);
}

// ---------------------------------------------------------------------------------- body parts

function hairGeo(g: Geo, L: Look): void {
  const c = L.hair;
  const dark = shadeCol(c, -0.28);
  const lite = shadeCol(c, 0.07);
  const o = { rough: 0.5 };
  const s = L.hairStyle;
  if (s < 0) return;
  // skull cap + fringe shared by every style
  g.sphere(0, 1.5, -0.8, 6.9, 6.3, 6.9, c, o, 14);
  for (const [x, y, z, rx, ry, rz] of [[-3.4, 4.3, 4.6, 2.9, 2.3, 2.4], [0, 4.9, 5.2, 3.2, 2.2, 2.2], [3.4, 4.3, 4.6, 2.9, 2.3, 2.4]] as number[][]) g.sphere(x, y, z, rx, ry, rz, lite, o, 8);
  const spike = (x: number, y: number, z: number, len: number, rx: number, rz: number, r = 1.9): void => {
    g.cone(x, y, z, r, len, lite, o, 6, [rx, 0, rz]);
  };
  switch (s) {
    case 0: // Spiky Vanguard
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * PI * 2;
        spike(Math.cos(a) * 4.4, 6.2 + (i % 2) * 0.8, Math.sin(a) * 4.4 - 0.8, 5.8, Math.sin(a) * 0.9, -Math.cos(a) * 0.9, 2.1);
      }
      spike(0, 8.6, -0.6, 5.4, -0.2, 0, 2.2);
      break;
    case 1: // Long Straight
      g.sphere(0, -6.5, -4.4, 6.2, 10.5, 3, c, o, 12);
      for (const sx of [-1, 1]) g.sphere(sx * 5.6, -3.4, 0.8, 1.7, 7.6, 2.2, dark, o, 8);
      break;
    case 2: // High Ponytail
      g.sphere(0, 6.6, -4.4, 2.3, 2.3, 2.3, dark, o, 8);
      g.limb(0, 6.6, -5, 0, 1, -9.6, 2.1, c, o);
      g.limb(0, 1, -9.6, 0, -8.5, -8.6, 1.6, lite, o);
      break;
    case 3: // Twin Tails
      for (const sx of [-1, 1]) {
        g.sphere(sx * 6.2, 3.4, -1.5, 1.9, 1.9, 1.9, dark, o, 8);
        g.limb(sx * 6.6, 3, -1.6, sx * 8.8, -4, -2, 2, c, o);
        g.limb(sx * 8.8, -4, -2, sx * 8, -11, -1.4, 1.5, lite, o);
      }
      break;
    case 4: // Bob Cut
      g.sphere(0, -1.6, -1.4, 7.5, 5.6, 7.1, c, o, 14);
      for (const sx of [-1, 1]) g.sphere(sx * 6.1, -2.4, 2, 2.1, 4.6, 2.9, dark, o, 8);
      break;
    case 5: // Swept Fringe
      g.sphere(-2.6, 3.6, 5.3, 4.9, 2.9, 2.5, lite, o, 10, [0, 0, 0.42]);
      g.sphere(0, -2.5, -4.8, 5.6, 4.6, 2.9, dark, o, 10);
      spike(5.2, 4.4, 2, 5, 0.5, -1.2, 1.9);
      break;
    case 6: // Braided Crown
      g.torus(0, 4.7, -0.8, 6, 1.3, lite, o, [PI / 2, 0, 0], PI * 2, 16);
      g.sphere(0, 2.4, -6.9, 2.9, 2.9, 2.7, c, o, 10);
      g.sphere(0, -3.5, -5.4, 4.7, 4.5, 2.5, dark, o, 10);
      break;
    default: // Wild Mane
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI * 2;
        spike(Math.cos(a) * 5.4, 3.4 + (i % 3) * 1.6, Math.sin(a) * 5.4 - 1, 5.6 + (i % 2) * 2, Math.sin(a) * 1.3, -Math.cos(a) * 1.3, 2.3);
      }
      g.sphere(0, -6, -5, 6.3, 8.6, 3.3, dark, o, 10);
      break;
  }
}

function headGeo(L: Look): Geo {
  const g = new Geo();
  const skin = L.mannequin ? '#b5895a' : L.skin;
  g.sphere(0, 0, 0, 6.3, 6, 6.1, skin, { rough: 0.62 }, 16);
  if (!L.mannequin) {
    // anime eyes: dark almond, coloured iris, catch-light; plus brows, a blush and a small mouth
    for (const sx of [-1, 1]) {
      g.sphere(sx * 2.5, 0.3, 5.5, 1.5, 1.95, 0.72, '#1a1626', { rough: 0.25 }, 10);
      g.sphere(sx * 2.5, 0.1, 5.82, 1.08, 1.5, 0.5, L.eyes, { rough: 0.15, em: 0.28 }, 10);
      g.sphere(sx * 2.5 - 0.5, 0.95, 6.12, 0.42, 0.5, 0.22, '#ffffff', { rough: 0.2, em: 0.5 }, 6);
      g.box(sx * 2.6, 2.75, 5.5, 2.4, 0.5, 0.5, shadeCol(L.hair, -0.25), { rough: 0.6 }, [0, 0, -sx * 0.16]);
      g.sphere(sx * 3.9, -1.7, 4.6, 1.3, 0.75, 0.5, '#ff9a9a', { rough: 0.8 }, 6);
      g.sphere(sx * 6.1, -0.3, 0.2, 1, 1.5, 1.2, skin, { rough: 0.62 }, 8);
    }
    g.sphere(0, -2.8, 5.75, 0.85, 0.36, 0.3, '#b0504a', { rough: 0.6 }, 6);
  }
  const helm = L.head && L.showHelmet ? L.head : null;
  if (!helm || helm.style === 2) hairGeo(g, L);
  if (helm) {
    const m = helm.main;
    if (helm.style === 0) {
      g.sphere(0, 1.4, -0.3, 7.1, 6.6, 7.1, m, METAL, 16);
      g.box(0, 0.5, 6.5, 1.3, 6.4, 1.1, helm.trim, METAL);
      g.torus(0, 0.4, -0.3, 7, 0.75, helm.trim, METAL, [PI / 2, 0, 0], PI * 2, 20);
      for (const sx of [-1, 1]) g.box(sx * 5.6, -2.6, 2.6, 1.3, 5.4, 4.4, m, METAL);
      if (helm.tier >= 3) {
        g.cone(0, 9.6, -1.6, 1.5, 7, helm.accent, CLOTH, 6, [-0.5, 0, 0]);
        g.sphere(0, 6.9, 5.8, 1.2, 1.2, 0.9, glowOf(helm) ?? helm.accent, glowOf(helm) ? { em: 3 } : METAL, 8);
      }
    } else if (helm.style === 1) {
      g.sphere(0, 1.2, -1.1, 7.5, 7.1, 7.6, m, CLOTH, 14);
      g.cone(0, 6.8, -4.4, 4.6, 8.4, m, CLOTH, 8, [-0.85, 0, 0]);
      g.torus(0, 0.8, 4.3, 5.9, 0.75, helm.trim, CLOTH, [0.18, 0, 0], PI * 2, 18);
    } else {
      g.torus(0, 3.5, 0, 6.5, 0.6, m, METAL, [PI / 2, 0, 0], PI * 2, 20);
      g.ico(0, 4.4, 6.3, 1.3, 1.7, 0.9, glowOf(helm) ?? helm.accent, { em: 3.2, rough: 0.1 }, 0);
    }
  }
  return g;
}

function torsoGeo(L: Look): Geo {
  const g = new Geo();
  const c = L.chest;
  const base = c ? c.main : L.mannequin ? '#b5895a' : '#5a6478';
  const cy = 6;
  const plate = !!c && (c.style === 2 || c.style === 4);
  const o = plate ? METAL : c && c.style === 3 ? CLOTH : LEATHER;
  // ribcage + waist
  g.sphere(0, cy + 1.4, 0, 5.9, 5.7, 4.1, base, o, 14);
  g.sphere(0, cy - 3.6, 0, 5, 3.8, 3.6, c ? shadeCol(base, -0.1) : base, o, 12);
  g.cyl(0, 11.6, 0, 1.9, 2.3, 2.4, L.mannequin ? '#b5895a' : L.skin, { rough: 0.62 }, 8);
  if (!c) {
    if (!L.mannequin) g.torus(0, 1.6, 0, 4.6, 0.9, '#3a3a4a', LEATHER, [PI / 2, 0, 0], PI * 2, 14);
    return g;
  }
  const tr = c.trim;
  const ac = c.accent;
  const gl = glowOf(c);
  g.torus(0, 1.5, 0, 4.9, 0.9, ac, LEATHER, [PI / 2, 0, 0], PI * 2, 16);
  g.box(0, 1.5, 4.1, 2.2, 1.9, 0.8, tr, METAL);
  switch (c.style) {
    case 0: // brigandine
      for (const y of [4.2, 7.6]) g.torus(0, y, 0, 5.75, 0.36, ac, LEATHER, [PI / 2, 0, 0], PI * 2, 14);
      for (let i = 0; i < 5; i++) g.sphere(-3.6 + i * 1.8, 5.9, 3.95 - Math.abs(i - 2) * 0.32, 0.45, 0.45, 0.45, tr, METAL, 6);
      for (const sx of [-1, 1]) g.sphere(sx * 6.3, 10, 0, 2.8, 2.1, 2.8, shadeCol(base, -0.12), LEATHER, 8);
      break;
    case 1: // long coat
      g.cyl(0, -2.6, 0, 5.2, 7.6, 9, shadeCol(base, -0.06), LEATHER, 12);
      g.box(0, 5.8, 3.95, 0.55, 12, 0.5, tr, METAL);
      for (const sx of [-1, 1]) {
        g.box(sx * 2.3, 9.9, 3.5, 3.3, 3.5, 0.8, tr, CLOTH, [0, 0, sx * 0.5]);
        g.sphere(sx * 6.2, 10.1, 0, 2.5, 1.9, 2.6, base, LEATHER, 8);
      }
      break;
    case 2: // plate
      g.sphere(0, cy + 2.6, 1.3, 5.3, 4.5, 3.6, shadeCol(base, 0.12), METAL, 12);
      g.box(0, 6.6, 4.5, 0.8, 8.4, 0.7, tr, METAL);
      for (const sx of [-1, 1]) {
        g.sphere(sx * 6.9, 10.4, 0, 3.7, 2.8, 3.7, base, METAL, 10);
        g.torus(sx * 6.9, 9.3, 0, 3.4, 0.5, tr, METAL, [PI / 2, 0, 0], PI * 2, 12);
        g.box(sx * 3.5, -1.4, 2.9, 3.5, 5, 1, shadeCol(base, -0.1), METAL, [0.12, 0, 0]);
      }
      g.box(0, -1.4, 3.3, 3.3, 5, 1, base, METAL, [0.12, 0, 0]);
      if (c.tier >= 3) g.ico(0, 8.4, 4.7, 1.25, 1.6, 0.8, gl ?? ac, { em: gl ? 3.4 : 1.2, rough: 0.1 }, 0);
      break;
    case 3: // robe
      g.cyl(0, -7.4, 0, 4.9, 8.4, 15.6, base, CLOTH, 14);
      g.torus(0, -14.6, 0, 8.3, 0.5, tr, CLOTH, [PI / 2, 0, 0], PI * 2, 18);
      g.box(0, -5.6, 5.3, 2.5, 12.6, 0.5, ac, CLOTH, [-0.2, 0, 0]);
      for (const sx of [-1, 1]) g.box(sx * 2.1, 9.7, 3.5, 2.9, 4.4, 0.7, tr, CLOTH, [0, 0, sx * 0.52]);
      if (c.tier >= 2) g.ico(0, 6.7, 4.2, 1.1, 1.4, 0.7, gl ?? tr, { em: 2.6, rough: 0.1 }, 0);
      break;
    default: // dragonmail
      for (let r = 0; r < 4; r++) for (let k = -2; k <= 2; k++) g.sphere(k * 2.1 + (r % 2) * 1.05, 9 - r * 2.4, 3.7 - Math.abs(k) * 0.42, 1.25, 1.35, 0.6, r % 2 ? shadeCol(base, 0.12) : base, METAL, 6);
      for (const sx of [-1, 1]) {
        g.sphere(sx * 7.1, 10.5, 0, 4, 3, 4, base, METAL, 10);
        g.cone(sx * 9.3, 13.3, 0, 1.25, 5, tr, METAL, 6, [0, 0, -sx * 0.7]);
        g.cone(sx * 7.3, 13.9, -1.6, 1.05, 4, tr, METAL, 6, [-0.3, 0, -sx * 0.3]);
      }
      g.ico(0, 7.5, 4.9, 1.5, 1.9, 0.9, gl ?? ac, { em: 4, rough: 0.1 }, 0);
      break;
  }
  return g;
}

function armGeo(L: Look, lower: boolean): Geo {
  const g = new Geo();
  const c = L.chest;
  const sleeve = c ? shadeCol(c.main, -0.08) : L.mannequin ? '#b5895a' : '#5a6478';
  const skin = L.mannequin ? '#b5895a' : L.skin;
  const plate = !!c && (c.style === 2 || c.style === 4);
  if (!lower) g.limb(0, 0, 0, 0, -A1, 0, 2, sleeve, plate ? METAL : LEATHER);
  else {
    g.limb(0, 0, 0, 0, -A2, 0, 1.8, c && c.style !== 3 ? shadeCol(c.accent, 0.05) : sleeve, plate ? METAL : LEATHER);
    if (c && c.tier >= 2) g.torus(0, -A2 + 1.5, 0, 1.95, 0.42, c.trim, METAL, [PI / 2, 0, 0], PI * 2, 10);
    g.sphere(0, -A2 - 0.9, 0, 1.95, 1.95, 1.95, skin, { rough: 0.62 }, 8);
  }
  return g;
}

function legGeo(L: Look, lower: boolean): Geo {
  const g = new Geo();
  const pants = L.chest ? shadeCol(L.chest.accent, -0.15) : '#3a3a4a';
  const b = L.boots;
  const bootC = b ? b.main : '#4a3424';
  const mm = L.mannequin ? '#b5895a' : null;
  if (!lower) g.limb(0, 0, 0, 0, -L1, 0, 2.5, mm ?? pants, LEATHER);
  else {
    g.limb(0, 0, 0, 0, -L2 + 1.2, 0, 2.3, mm ?? bootC, b && b.tier >= 3 ? METAL : LEATHER);
    g.sphere(0, -L2 + 1, 1.5, 2.5, 1.85, 3.9, mm ?? shadeCol(bootC, -0.12), LEATHER, 8);
    if (b && b.tier >= 2) g.torus(0, -1.4, 0, 2.45, 0.5, b.trim, METAL, [PI / 2, 0, 0], PI * 2, 10);
  }
  return g;
}

function capeGeo(v: GearVis): Geo {
  const g = new Geo();
  const rows = 7;
  for (let r = 0; r < rows; r++) {
    const k = r / (rows - 1);
    const w = 11 + k * 5.5;
    const c = r === rows - 1 ? v.trim : r % 2 ? shadeCol(v.main, -0.07) : v.main;
    g.box(0, -1.6 - r * 3.25, -k * 1.6, w, 3.5, 0.5, c, { rough: 0.95, wind: k * k * 1.2 });
  }
  g.box(0, 0, 0.3, 12.6, 1.6, 1.6, v.accent, CLOTH);
  for (const sx of [-1, 1]) g.sphere(sx * 5.6, 0.2, 0.8, 1.15, 1.15, 1.15, v.trim, METAL, 6);
  return g;
}

// ---------------------------------------------------------------------------------- rig

function mk(g: Geo, mat: THREE.Material, depth: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(g.build(), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.customDepthMaterial = depth;
  return m;
}

/** two-bone IK: returns the joint (elbow / knee) position for a chain root -> target */
function ik(root: THREE.Vector3, target: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3, out: THREE.Vector3): void {
  _i1.subVectors(target, root);
  let d = _i1.length();
  const max = l1 + l2 - 0.05;
  if (d > max) {
    _i1.multiplyScalar(max / d);
    target.copy(root).add(_i1);
    d = max;
  }
  if (d < 0.001) {
    out.copy(root).addScaledVector(pole, l1);
    return;
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _i2.copy(_i1).multiplyScalar(1 / d);
  _i3.copy(pole).addScaledVector(_i2, -pole.dot(_i2));
  if (_i3.lengthSq() < 1e-6) _i3.set(0, 0, 1);
  _i3.normalize();
  out.copy(root).addScaledVector(_i2, a).addScaledVector(_i3, h);
}

function aim(obj: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3): void {
  obj.position.copy(from);
  _d.subVectors(to, from);
  if (_d.lengthSq() < 1e-8) return;
  obj.quaternion.setFromUnitVectors(Y_DOWN, _d.normalize());
}

const POLE_KNEE = new THREE.Vector3(0, 0.15, 1).normalize();
const POLE_ELBOW_R = new THREE.Vector3(-0.55, -0.6, -0.6).normalize();
const POLE_ELBOW_L = new THREE.Vector3(0.55, -0.6, -0.6).normalize();

export class Human3D {
  readonly root = new THREE.Group();
  readonly mat: THREE.MeshStandardMaterial & { uu: UberUniforms };
  private depth: THREE.Material;
  private body = new THREE.Group();
  private upper = new THREE.Group();
  private torso!: THREE.Mesh;
  private head!: THREE.Mesh;
  private armU: THREE.Mesh[] = [];
  private armL: THREE.Mesh[] = [];
  private legU: THREE.Mesh[] = [];
  private legL: THREE.Mesh[] = [];
  private cape: THREE.Mesh | null = null;
  private main: THREE.Mesh | null = null;
  private off: THREE.Mesh | null = null;
  private quiver: THREE.Mesh | null = null;
  private orb: THREE.Mesh | null = null;
  private look!: Look;
  private key = '';
  private amp = 0;
  private capeLag = 0;
  private twist = 0;
  private lean = 0;
  private downK = 0;
  bladeLen = 0;
  /** world-space hilt and tip of the main-hand weapon, updated every frame */
  readonly hilt = new THREE.Vector3();
  readonly tip = new THREE.Vector3();
  melee = false;
  private hR = new THREE.Vector3();
  private hL = new THREE.Vector3();
  private wDir = new THREE.Vector3(0, 0, 1);
  private oDir = new THREE.Vector3(0, 0, 1);

  constructor(look: Look) {
    this.mat = makeUber({ side: THREE.DoubleSide, cut: false });
    this.depth = makeUberDepth(this.mat);
    this.root.add(this.body);
    this.body.add(this.upper);
    this.setLook(look);
  }

  static keyOf(L: Look): string {
    const v = (g: GearVis | null): string => (g ? `${g.kind}${g.style}${g.tier}${g.main}${g.accent}${g.trim}${g.glow}${g.temper}${g.gem}${g.rarity}${g.mythic}` : '-');
    return `${L.skin}${L.hair}${L.hairStyle}${L.eyes}${v(L.head)}${v(L.chest)}${v(L.boots)}${v(L.cloak)}${v(L.main)}${v(L.off)}${L.showHelmet}${L.ghost}${L.scale}${L.mannequin}`;
  }

  setLook(L: Look): void {
    const key = Human3D.keyOf(L);
    if (key === this.key) return;
    this.key = key;
    this.look = L;
    for (const c of [...this.body.children, ...this.upper.children]) {
      if (c === this.upper) continue;
      (c as THREE.Mesh).geometry?.dispose();
      c.removeFromParent();
    }
    this.armU = [];
    this.armL = [];
    this.legU = [];
    this.legL = [];
    const m = this.mat;
    const d = this.depth;
    this.torso = mk(torsoGeo(L), m, d);
    this.torso.position.y = HIP_Y;
    this.head = mk(headGeo(L), m, d);
    this.upper.add(this.torso, this.head);
    for (let i = 0; i < 2; i++) {
      const au = mk(armGeo(L, false), m, d);
      const al = mk(armGeo(L, true), m, d);
      this.upper.add(au, al);
      this.armU.push(au);
      this.armL.push(al);
      const lu = mk(legGeo(L, false), m, d);
      const ll = mk(legGeo(L, true), m, d);
      this.body.add(lu, ll);
      this.legU.push(lu);
      this.legL.push(ll);
    }
    this.cape = null;
    if (L.cloak) {
      this.cape = mk(capeGeo(L.cloak), m, d);
      this.upper.add(this.cape);
    }
    this.main = null;
    this.off = null;
    this.quiver = null;
    this.orb = null;
    this.bladeLen = 0;
    this.melee = false;
    if (L.main) {
      const g = new Geo();
      this.bladeLen = weaponGeo(g, L.main);
      this.main = mk(g, m, d);
      this.upper.add(this.main);
      this.melee = L.main.kind !== 'bow' && L.main.kind !== 'staff';
      if (L.main.kind === 'bow') {
        const qg = new Geo();
        qg.cyl(0, 0, 0, 1.7, 1.4, 11, '#6b4a2f', LEATHER, 8);
        for (let i = 0; i < 4; i++) qg.cyl(-0.8 + (i % 2) * 1.2, 6.5, -0.5 + (i > 1 ? 1 : 0), 0.16, 0.16, 5, '#e8e0d0', { rough: 0.6 }, 4);
        this.quiver = mk(qg, m, d);
        this.quiver.position.set(-3, 21, -4.6);
        this.quiver.rotation.set(0.2, 0, 0.5);
        this.upper.add(this.quiver);
      }
    }
    if (L.off) {
      const g = new Geo();
      if (L.off.kind === 'shield') shieldGeo(g, L.off);
      else weaponGeo(g, L.off);
      this.off = mk(g, m, d);
      this.upper.add(this.off);
    }
    this.root.scale.setScalar(0.96 * L.scale);
    if (L.ghost) {
      m.transparent = true;
      m.opacity = 0.6;
      m.uu.uRim.value.set(0.35, 0.75, 1.0, 1.6);
    } else if (L.aura) {
      const a = col(L.aura);
      m.uu.uRim.value.set(a.r, a.g, a.b, 0.5);
    } else m.uu.uRim.value.set(0.9, 0.95, 1.0, 0.16);
  }

  /** poses the rig for this frame */
  update(p: HumanPose): void {
    const L = this.look;
    const A = p.anim;
    const main = L.main;
    const off = L.off;
    const kind = main?.kind ?? 'none';
    const twoHand = kind === 'spear' || kind === 'halberd' || kind === 'staff' || kind === 'bow';
    const dual = !!off && (off.kind === 'sword' || off.kind === 'twinblade');
    const shield = !!off && off.kind === 'shield';
    const attacking = A.kind === 'attack';
    const skill = A.kind === 'skill';
    const walk = p.moving && !attacking && !skill && !p.seated;
    const k = 1 - Math.exp(-p.dt * 12);
    this.amp = lerp(this.amp, walk ? Math.min(1.25, 0.55 + p.speed / 190) : 0, k);
    const amp = this.amp;
    const ph = A.walk;
    const sw = Math.min(1, A.swing);
    const swE = easeOutCubic(sw);
    const hump = Math.sin(PI * sw);
    // ---- body: bob, lean, crouch
    const bob = amp > 0.05 ? Math.abs(Math.sin(ph)) * 1.1 * amp - 0.5 * amp : Math.sin(p.t * 2.2) * 0.28;
    let hipY = HIP_Y + bob;
    let pitch = amp * 0.13;
    let roll = 0;
    let dodgeK = 0;
    if (A.kind === 'dodge' || (p.dodge ?? -1) >= 0) {
      dodgeK = 1;
      hipY -= 4.2;
      pitch = 0.78;
    }
    if (attacking && this.melee) pitch += hump * 0.2;
    if (p.stunned) {
      roll = Math.sin(p.t * 7) * 0.12;
      pitch += 0.22;
      hipY -= 1.2;
    }
    if (A.kind === 'hurt') pitch -= 0.14;
    this.downK = lerp(this.downK, p.down || A.kind === 'dead' || A.kind === 'sleep' ? 1 : 0, 1 - Math.exp(-p.dt * 7));
    if (p.seated) hipY = HIP_Y + 2;
    this.lean = lerp(this.lean, pitch, k);
    this.body.position.set(0, this.downK * -11 + (p.seated ? 0 : 0), 0);
    this.body.rotation.set(this.lean - this.downK * 1.46, 0, roll);
    // ---- weapon direction (relative to the facing angle)
    let rel = 0;
    const handR = this.hR.set(-7.3, hipY + 1.2, 1.6 - Math.sin(ph) * 3.4 * amp);
    const handL = this.hL.set(7.3, hipY + 1.2, 1.6 + Math.sin(ph) * 3.4 * amp);
    const wd = this.wDir;
    const od = this.oDir;
    let twist = 0;
    let bowDraw = 0;
    let shieldFront = false;
    const shR = vShR.set(-SH_X, SH_Y + bob, 0);
    const shL = vShL.set(SH_X, SH_Y + bob, 0);
    const dirOf = (r: number, out: THREE.Vector3, up = 0.1): THREE.Vector3 => out.set(-Math.sin(r), up, Math.cos(r)).normalize();
    // rest poses
    if (kind === 'spear' || kind === 'halberd' || kind === 'staff') {
      wd.set(-0.06, 1, 0.16).normalize();
      handR.set(-7.4, hipY + 3.4, 3 - Math.sin(ph) * 1.4 * amp);
    } else if (kind === 'bow') {
      wd.set(0, 1, 0);
      handR.set(-7.6, hipY + 2.6, 2.4 - Math.sin(ph) * 2 * amp);
    } else wd.set(-0.34, -0.2 + Math.sin(ph) * 0.12 * amp, 0.92).normalize();
    od.set(0.34, -0.2, 0.92).normalize();
    const blocking = p.blocking || A.kind === 'block';
    if ((attacking || skill) && main) {
      const flurry = skill && this.melee;
      const r0 = angDiff(p.face, A.a0);
      const r1 = angDiff(p.face, A.a1);
      if (kind === 'spear' && !flurry) {
        const th = hump * 10;
        wd.set(0, 0.04, 1).normalize();
        handR.set(-3.4, SH_Y - 3.5 + bob, 4.6 + th);
      } else if (kind === 'bow') {
        bowDraw = attacking ? Math.min(1, sw * 2.6) * (sw < 0.45 ? 1 : 0) : A.charge > 0 ? A.charge : 0.6;
        wd.set(0, 1, 0);
        handR.set(-1.6, SH_Y - 1.4 + bob, 9.4);
        handL.set(-1.6, SH_Y - 1.4 + bob, 8.4 - bowDraw * 8.4);
      } else if (kind === 'staff') {
        const a = attacking ? 0.25 + hump * 1.15 : 0.5 + Math.sin(A.t * 6) * 0.18;
        wd.set(0, Math.cos(a), Math.sin(a)).normalize();
        handR.set(-5.4, SH_Y - 4 + bob + hump * 2, 5 + hump * 3);
      } else if (flurry) {
        rel = Math.sin(A.t * 15) * 1.2;
        twist = rel * 0.55;
        dirOf(rel - twist, wd, 0.12 + Math.cos(A.t * 15) * 0.25);
        handR.copy(shR).addScaledVector(wd, 9).setY(SH_Y - 2.2 + bob);
        if (dual) {
          const r2 = Math.sin(A.t * 15 + 1.7) * 1.2;
          dirOf(r2 - twist, od, 0.1);
          handL.copy(shL).addScaledVector(od, 9).setY(SH_Y - 2.4 + bob);
        }
      } else if (A.hand === 0 || !dual) {
        rel = lerp(r0, r1, swE);
        twist = clamp(rel * 0.55, -1.1, 1.1);
        dirOf(rel - twist, wd, 0.06 + hump * 0.16);
        handR.copy(shR).addScaledVector(wd, 9.4).setY(SH_Y - 2.4 + bob + hump * 1.6);
      } else {
        rel = lerp(r0, r1, swE);
        twist = clamp(rel * 0.55, -1.1, 1.1);
        dirOf(rel - twist, od, 0.06 + hump * 0.16);
        handL.copy(shL).addScaledVector(od, 9.4).setY(SH_Y - 2.4 + bob + hump * 1.6);
      }
    } else if (blocking) {
      if (shield) {
        shieldFront = true;
        handL.set(2.4, SH_Y - 4 + bob, 8.6);
        wd.set(-0.5, 0.75, -0.3).normalize();
        handR.set(-8.2, SH_Y - 6 + bob, 0.6);
      } else if (this.melee) {
        wd.set(0.86, 0.5, 0.1).normalize();
        handR.set(-3.6, SH_Y - 4.6 + bob, 8.2);
        if (dual) {
          od.set(-0.86, 0.5, 0.1).normalize();
          handL.set(3.6, SH_Y - 4.2 + bob, 7.6);
        }
      }
    } else if (A.kind === 'cast' && main) {
      wd.set(0, 0.95, 0.3).normalize();
      handR.set(-6, SH_Y + 1.5 + bob, 4.5);
    }
    if (dodgeK) {
      handR.set(-6.4, hipY + 4, 4);
      handL.set(6.4, hipY + 4, 4);
    }
    if (p.seated) {
      handL.set(4.6, hipY + 3.4, 6.4);
    }
    // two-handed grips: the off hand slides onto the shaft
    if (twoHand && kind !== 'bow' && !dodgeK) handL.copy(handR).addScaledVector(wd, -7).add(vTmp.set(2.6, 0, 0));
    this.twist = lerp(this.twist, twist, 1 - Math.exp(-p.dt * 26));
    this.upper.position.set(0, 0, 0);
    this.upper.rotation.set(0, -this.twist, 0);
    this.torso.position.y = hipY;
    this.head.position.set(0, hipY + 12.6 + 6.1, 0.5);
    this.head.rotation.set(amp * -0.06 + (p.stunned ? 0.3 : 0), clamp(angDiff(p.face, p.aim) * 0.5, -0.7, 0.7) + this.twist * 0.6, 0);
    // ---- arms
    vS.set(-SH_X, SH_Y + bob, 0);
    ik(vS, handR, A1, A2 + 1.2, POLE_ELBOW_R, vE);
    aim(this.armU[0], vS, vE);
    aim(this.armL[0], vE, handR);
    vS.set(SH_X, SH_Y + bob, 0);
    ik(vS, handL, A1, A2 + 1.2, POLE_ELBOW_L, vE);
    aim(this.armU[1], vS, vE);
    aim(this.armL[1], vE, handL);
    // ---- weapons
    if (this.main) {
      this.main.position.copy(handR);
      if (kind === 'bow') this.main.quaternion.identity();
      else this.main.quaternion.setFromUnitVectors(Y_UP, wd);
    }
    if (this.off) {
      if (shield) {
        if (shieldFront) {
          this.off.position.set(2.2, SH_Y - 4.4 + bob, 10.2);
          this.off.rotation.set(0, 0, 0);
        } else {
          this.off.position.copy(handL).add(vTmp.set(2.1, 2.6, 0.4));
          this.off.rotation.set(0, 1.15, 0.08);
        }
      } else {
        this.off.position.copy(handL);
        this.off.quaternion.setFromUnitVectors(Y_UP, od);
      }
    }
    // ---- legs
    for (let i = 0; i < 2; i++) {
      const sx = i === 0 ? -1 : 1;
      const lp = ph + (i === 0 ? 0 : PI);
      const hip = vHip.set(sx * 3.1, hipY, 0);
      const foot = vFoot.set(sx * 3.3, Math.max(0, Math.cos(lp)) * 3.6 * amp, Math.sin(lp) * 5.6 * amp);
      if (dodgeK) foot.set(sx * 3.3, 3.2, -3 + i * 5);
      if (p.seated) foot.set(sx * 7.4, hipY - 9.6, 2.4);
      if (attacking && this.melee && !p.seated) foot.z += sx * (i === 0 ? -1 : 1) * hump * 2.6 + (i === 0 ? hump * 3 : -hump * 2);
      const knee = vKnee;
      ik(hip, foot, L1, L2, POLE_KNEE, knee);
      aim(this.legU[i], hip, knee);
      aim(this.legL[i], knee, foot);
    }
    // ---- cape trails behind with speed
    if (this.cape) {
      this.capeLag = lerp(this.capeLag, Math.min(1, p.speed / 170) * 0.85 + dodgeK * 0.4, 1 - Math.exp(-p.dt * 6));
      this.cape.position.set(0, SH_Y + 1.3 + bob, -3.5);
      this.cape.rotation.set(-0.1 - this.capeLag - Math.sin(p.t * 2.4) * 0.03, 0, 0);
    }
    if (this.quiver) this.quiver.position.y = hipY + 6;
    // ---- blade sample for trails
    if (this.main && this.melee) {
      this.root.updateWorldMatrix(true, true);
      this.hilt.copy(handR).addScaledVector(wd, 4);
      this.tip.copy(handR).addScaledVector(wd, this.bladeLen);
      this.upper.localToWorld(this.hilt);
      this.upper.localToWorld(this.tip);
    }
  }

  dispose(): void {
    this.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.mat.dispose();
    this.depth.dispose();
    this.root.removeFromParent();
  }
}
