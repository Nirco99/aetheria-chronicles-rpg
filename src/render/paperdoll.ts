// Multi-layer procedural "paper-doll" renderer. Every equipped item visibly changes the
// character: 1 shadow & aura, 2 cape, 3 body & boots, 4 chest armor, 5 head/hair/helmet,
// 6 off-hand (shield / second blade / quiver / rune orb), 7 main-hand weapon.
import type { Anim, CompanionDef, CompanionSave, Dir, HumanoidStyle, NpcRole, SaveData } from '../types/game';
import { drawShield, drawTemperSparks, drawWeapon, visOf, type GearVis } from './gear';
import { EYE_COLORS, HAIR_COLORS, RARITY_COLORS, SKIN_TONES } from '../data/constants';
import { activeSet, gemColor } from '../systems/stats';
import { glowSprite } from './glow';
import { easeOutCubic, hash2, lerp, mix, rgba, shade, TAU } from '../engine/util';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: number;
  eyes: string;
  head: GearVis | null;
  chest: GearVis | null;
  boots: GearVis | null;
  cloak: GearVis | null;
  main: GearVis | null;
  off: GearVis | null;
  showHelmet: boolean;
  ghost: boolean;
  scale: number;
  aura: string | null;
  mannequin: boolean;
}

export interface DrawOpts {
  aim: number;
  moving: boolean;
  vx: number;
  vy: number;
  t: number;
  blocking?: boolean;
  alpha?: number;
  flash?: number;
  z?: number;
  shadow?: boolean;
  barrier?: number;
  ghosts?: boolean;
}

// ------------------------------------------------------------------ look builders

export function buildPlayerLook(save: SaveData): Look {
  const { main, off } = activeSet(save);
  const a = save.appearance;
  return {
    skin: SKIN_TONES[a.skin], hair: HAIR_COLORS[a.hairColor].color, hairStyle: a.hairStyle, eyes: EYE_COLORS[a.eyeColor].color,
    head: visOf(save.equip.head), chest: visOf(save.equip.chest), boots: visOf(save.equip.boots), cloak: visOf(save.equip.cloak),
    main: visOf(main, gemColor(main)), off: visOf(off, gemColor(off)), showHelmet: save.showHelmet, ghost: false, scale: 1,
    aura: main && main.rarity >= 3 ? RARITY_COLORS[main.rarity] : null, mannequin: false,
  };
}

export function buildCompanionLook(def: CompanionDef, cs: CompanionSave): Look {
  const e = cs.equip;
  return {
    skin: SKIN_TONES[def.skin], hair: HAIR_COLORS[def.hairColor].color, hairStyle: def.hairStyle, eyes: EYE_COLORS[def.eyeColor].color,
    head: visOf(e.head), chest: visOf(e.chest), boots: visOf(e.boots), cloak: visOf(e.cloak),
    main: visOf(e.main, gemColor(e.main)), off: visOf(e.off), showHelmet: true, ghost: false, scale: 1, aura: null, mannequin: false,
  };
}

function gv(kind: string, style: number, tier: number, main: string, accent: string, trim: string): GearVis {
  return { kind, style, tier, main, accent, trim, glow: trim, temper: 0, gem: null, rarity: 0, mythic: false };
}

export function lookFromStyle(h: HumanoidStyle): Look {
  return {
    skin: h.skin, hair: h.hair, hairStyle: h.hairStyle, eyes: h.eyes,
    head: h.helmet ? gv('head', h.helmet.style, h.helmet.tier, h.helmet.main, h.helmet.accent, h.helmet.trim) : null,
    chest: h.chest ? gv('chest', h.chest.style, h.chest.tier, h.chest.main, h.chest.accent, h.chest.trim) : null,
    boots: h.boots ? gv('boots', 0, 3, h.boots.main, h.boots.accent, h.boots.accent) : null,
    cloak: h.cloak ? gv('cloak', 0, 3, h.cloak.main, h.cloak.accent, h.cloak.trim) : null,
    main: h.weapon ? { ...gv(h.weapon, 0, 4, h.weaponColor, '#3a2a20', '#e8d8a8'), glow: h.weaponColor, temper: 6 } : null,
    off: h.off === 'shield' ? gv('shield', 0, 6, h.chest?.main ?? '#cccccc', h.chest?.accent ?? '#992222', h.chest?.trim ?? '#ffd27a')
      : h.off === 'sword' ? { ...gv('sword', 0, 4, h.weaponColor, '#3a2a20', '#e8d8a8'), glow: h.weaponColor } : null,
    showHelmet: true, ghost: !!h.ghost, scale: h.scale ?? 1, aura: null, mannequin: false,
  };
}

const CLOTHES = ['#6b4a2f', '#3f5f8a', '#5a7a4a', '#8a3a3a', '#6a5a8a', '#8a7a5a', '#3a6a6a', '#9a6a3a'];

export function npcLook(role: NpcRole, seed: number): Look {
  const r = (k: number) => hash2(seed, k, 77);
  const pick = <T,>(arr: T[], k: number): T => arr[Math.floor(r(k) * arr.length) % arr.length];
  const cloth = pick(CLOTHES, 3);
  const L: Look = {
    skin: pick(SKIN_TONES, 1), hair: pick(HAIR_COLORS, 2).color, hairStyle: Math.floor(r(4) * 8), eyes: pick(EYE_COLORS, 5).color,
    head: null, chest: gv('chest', r(6) < 0.5 ? 0 : 1, 0, cloth, shade(cloth, -0.35), '#d8c8a0'), boots: gv('boots', 0, 0, '#4a3424', '#2a1c14', '#2a1c14'),
    cloak: null, main: null, off: null, showHelmet: true, ghost: false, scale: 1, aura: null, mannequin: false,
  };
  switch (role) {
    case 'smith':
      L.chest = gv('chest', 0, 0, '#5a3a24', '#2a1c14', '#c9a46e');
      L.main = gv('sword', 0, 1, '#bfc6ce', '#3a2a20', '#d8c8a0');
      break;
    case 'guard':
      L.chest = gv('chest', 2, 2, '#9aa3ad', '#3f5f9a', '#e8d8a8');
      L.head = gv('head', 0, 2, '#9aa3ad', '#3f5f9a', '#e8d8a8');
      L.main = gv('spear', 0, 1, '#d7dde6', '#5a3a24', '#d8c8a0');
      L.cloak = gv('cloak', 0, 1, '#3f5f9a', '#24365a', '#e8d8a8');
      break;
    case 'alchemist':
      L.chest = gv('chest', 3, 1, '#2f6a7a', '#173a44', '#9ff5ff');
      break;
    case 'warden':
      L.chest = gv('chest', 3, 6, '#2a1f3a', '#140f1e', '#a970ff');
      L.head = gv('head', 1, 6, '#2a1f3a', '#140f1e', '#a970ff');
      L.main = gv('staff', 0, 6, '#a970ff', '#2a1f3a', '#c69bff');
      break;
    case 'arena':
      L.chest = gv('chest', 2, 3, '#c9a23a', '#7a2a1a', '#ffe29a');
      L.cloak = gv('cloak', 0, 3, '#a8301a', '#5a1a0a', '#ffd166');
      break;
    case 'guild':
    case 'realtor':
    case 'banker':
    case 'merchant':
      L.chest = gv('chest', 1, 1, cloth, shade(cloth, -0.4), '#e8d8a8');
      break;
    case 'gatekeeper':
      L.chest = gv('chest', 3, 2, '#3a5a8a', '#1c2c4a', '#7fe9ff');
      L.head = gv('head', 2, 2, '#e8d8a8', '#7fe9ff', '#ffffff');
      L.main = gv('staff', 0, 2, '#7fe9ff', '#3a2a20', '#e8eef6');
      break;
    case 'chef':
      L.chest = gv('chest', 0, 0, '#f4efe6', '#c9b8a0', '#ffffff');
      break;
    default:
      break;
  }
  return L;
}

export function mannequinLook(items: (GearVis | null)[]): Look {
  const [head, chest, boots, cloak, shield] = items;
  return {
    skin: '#b5895a', hair: '#b5895a', hairStyle: -1, eyes: '#b5895a', head, chest, boots, cloak, main: null, off: shield,
    showHelmet: true, ghost: false, scale: 1, aura: null, mannequin: true,
  };
}

// ------------------------------------------------------------------ pieces

function shoulderY(): number {
  return -27;
}

function drawLegs(ctx: CanvasRenderingContext2D, L: Look, dir: Dir, ph: number, amp: number, by: number): void {
  const pants = L.chest ? shade(L.chest.accent, -0.15) : '#3a3a4a';
  const bootC = L.boots ? L.boots.main : '#4a3424';
  const bootT = L.boots ? L.boots.trim : '#2a1c14';
  const side = dir === 2 || dir === 3;
  const legs: [number, number, number][] = [];
  if (side) {
    const f = Math.sin(ph) * 5 * amp;
    legs.push([-1.5 - f, -Math.max(0, Math.cos(ph)) * 2 * amp, -1]);
    legs.push([1.5 + f, -Math.max(0, -Math.cos(ph)) * 2 * amp, 1]);
  } else {
    legs.push([-4, -Math.max(0, Math.sin(ph)) * 3 * amp, -1]);
    legs.push([4, -Math.max(0, -Math.sin(ph)) * 3 * amp, 1]);
  }
  ctx.lineCap = 'round';
  for (const [fx, fy, sgn] of legs) {
    const hx = side ? sgn * 1.2 : sgn * 3.2;
    ctx.strokeStyle = pants;
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(hx, -14 + by);
    ctx.lineTo(fx, fy - 4);
    ctx.stroke();
    ctx.strokeStyle = bootC;
    ctx.lineWidth = 5.2;
    ctx.beginPath();
    ctx.moveTo(fx, fy - 7);
    ctx.lineTo(fx, fy - 1.5);
    ctx.stroke();
    ctx.fillStyle = bootC;
    ctx.beginPath();
    ctx.ellipse(fx + (side ? (dir === 3 ? 1.6 : 1.6) : 0), fy - 1, side ? 4 : 3, 2.2, 0, 0, TAU);
    ctx.fill();
    if (L.boots && L.boots.tier >= 2) {
      ctx.strokeStyle = bootT;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx - 2, fy - 6.5);
      ctx.lineTo(fx + 2, fy - 6.5);
      ctx.stroke();
    }
  }
}

function torsoPath(ctx: CanvasRenderingContext2D, side: boolean, by: number): void {
  const w = side ? 6 : 8;
  const wb = side ? 5.5 : 7;
  ctx.beginPath();
  ctx.moveTo(-w, -29 + by);
  ctx.quadraticCurveTo(0, -32 + by, w, -29 + by);
  ctx.lineTo(wb, -13 + by);
  ctx.quadraticCurveTo(0, -11.5 + by, -wb, -13 + by);
  ctx.closePath();
}

function drawTorso(ctx: CanvasRenderingContext2D, L: Look, dir: Dir, by: number, t: number): void {
  const side = dir === 2 || dir === 3;
  const back = dir === 1;
  const c = L.chest;
  const base = c ? c.main : L.mannequin ? '#b5895a' : '#5a6478';
  // robe / coat skirts drawn before the torso body
  if (c && (c.style === 3 || c.style === 1)) {
    const long = c.style === 3;
    ctx.fillStyle = shade(base, -0.08);
    ctx.beginPath();
    ctx.moveTo(-7, -15 + by);
    ctx.lineTo(7, -15 + by);
    ctx.lineTo(long ? 10 : 9, long ? -1.5 : -4 + by);
    if (!long && !back && !side) {
      ctx.lineTo(1.5, -4 + by);
      ctx.lineTo(0, -12 + by);
      ctx.lineTo(-1.5, -4 + by);
    }
    ctx.lineTo(long ? -10 : -9, long ? -1.5 : -4 + by);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c.trim;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(long ? -10 : -9, (long ? -1.5 : -4 + by) - 0.6);
    ctx.lineTo(long ? 10 : 9, (long ? -1.5 : -4 + by) - 0.6);
    ctx.stroke();
  }
  torsoPath(ctx, side, by);
  ctx.fillStyle = base;
  ctx.fill();
  if (c && (c.style === 2 || c.style === 4 || (c.style === 0 && c.tier >= 2))) {
    ctx.fillStyle = rgba(shade(base, 0.6), 0.28);
    ctx.fillRect(side ? -5 : -7, -29 + by, side ? 4 : 5, 14);
  }
  ctx.strokeStyle = shade(base, -0.45);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  if (!c) {
    if (!L.mannequin) {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(-7, -16 + by, 14, 2.4);
    }
    return;
  }
  const trim = c.trim;
  const acc = c.accent;
  switch (c.style) {
    case 0: {
      ctx.strokeStyle = acc;
      ctx.lineWidth = 1;
      for (const yy of [-25, -20.5]) {
        ctx.beginPath();
        ctx.moveTo(-7, yy + by);
        ctx.lineTo(7, yy + by);
        ctx.stroke();
      }
      ctx.fillStyle = trim;
      for (const xx of [-5, -1.5, 2, 5.5]) {
        ctx.fillRect(xx, -23.3 + by, 1, 1);
        ctx.fillRect(xx, -18.8 + by, 1, 1);
      }
      break;
    }
    case 1: {
      if (!back && !side) {
        ctx.fillStyle = trim;
        ctx.beginPath();
        ctx.moveTo(-5, -29.5 + by);
        ctx.lineTo(0, -22 + by);
        ctx.lineTo(5, -29.5 + by);
        ctx.lineTo(3, -29.5 + by);
        ctx.lineTo(0, -25 + by);
        ctx.lineTo(-3, -29.5 + by);
        ctx.fill();
        ctx.strokeStyle = trim;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(0, -22 + by);
        ctx.lineTo(0, -13 + by);
        ctx.stroke();
      }
      break;
    }
    case 2: {
      ctx.strokeStyle = rgba(shade(base, 0.6), 0.8);
      ctx.lineWidth = 1.2;
      if (!side) {
        ctx.beginPath();
        ctx.moveTo(0, -29 + by);
        ctx.lineTo(0, -15 + by);
        ctx.stroke();
      }
      ctx.fillStyle = acc;
      if (!back && !side) {
        ctx.beginPath();
        ctx.moveTo(-2.5, -26 + by);
        ctx.lineTo(2.5, -26 + by);
        ctx.lineTo(0, -21 + by);
        ctx.fill();
      }
      ctx.fillStyle = shade(base, -0.15);
      for (let i = -1; i <= 1; i++) ctx.fillRect(i * 4.6 - 2.2, -14.5 + by, 4.4, 5);
      ctx.strokeStyle = trim;
      ctx.lineWidth = 0.7;
      for (let i = -1; i <= 1; i++) ctx.strokeRect(i * 4.6 - 2.2, -14.5 + by, 4.4, 5);
      break;
    }
    case 3: {
      ctx.fillStyle = acc;
      ctx.fillRect(-7, -16.5 + by, 14, 2.6);
      ctx.strokeStyle = trim;
      ctx.lineWidth = 1;
      if (!back && !side) {
        ctx.beginPath();
        ctx.moveTo(-4, -29.5 + by);
        ctx.lineTo(0, -24 + by);
        ctx.lineTo(4, -29.5 + by);
        ctx.stroke();
      }
      break;
    }
    case 4: {
      ctx.strokeStyle = shade(base, -0.35);
      ctx.lineWidth = 0.8;
      for (let row = 0; row < 3; row++) {
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.arc(k * 3 + (row % 2) * 1.5, -26 + row * 4 + by, 1.8, 0, Math.PI);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(c.glow, 0.55 + 0.25 * Math.sin(t * 3));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-6, -15 + by);
      ctx.lineTo(0, -21 + by);
      ctx.lineTo(6, -15 + by);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
  }
  ctx.fillStyle = shade(acc, -0.1);
  ctx.fillRect(-7, -15.5 + by, 14, 2);
  if (!back && !side) {
    ctx.fillStyle = trim;
    ctx.fillRect(-1.3, -15.8 + by, 2.6, 2.6);
  }
}

function drawPauldrons(ctx: CanvasRenderingContext2D, L: Look, dir: Dir, by: number): void {
  const c = L.chest;
  if (!c || !(c.style === 2 || c.style === 4 || (c.style === 0 && c.tier >= 3))) return;
  const side = dir === 2 || dir === 3;
  const xs = side ? [0] : [-8.5, 8.5];
  for (const x of xs) {
    ctx.fillStyle = c.style === 4 ? shade(c.main, -0.1) : c.main;
    ctx.beginPath();
    if (c.style === 4) {
      ctx.moveTo(x - 4, -24 + by);
      ctx.lineTo(x + Math.sign(x || 1) * 6, -31 + by);
      ctx.lineTo(x + 4, -24 + by);
    } else ctx.ellipse(x, -27 + by, c.style === 2 ? 5 : 4, 3.6, 0, 0, TAU);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c.trim;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
}

function drawArm(ctx: CanvasRenderingContext2D, L: Look, sx: number, sy: number, hx: number, hy: number): void {
  const c = L.chest;
  const sleeve = c ? (c.style === 2 || c.style === 4 ? shade(c.main, -0.1) : c.main) : L.mannequin ? '#b5895a' : '#5a6478';
  ctx.lineCap = 'round';
  ctx.strokeStyle = sleeve;
  ctx.lineWidth = c && c.style === 3 ? 5.4 : 4.2;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.fillStyle = L.skin;
  ctx.beginPath();
  ctx.arc(hx, hy, 2.3, 0, TAU);
  ctx.fill();
}

function drawHair(ctx: CanvasRenderingContext2D, L: Look, dir: Dir, hy: number, t: number, helmetCovers: boolean): void {
  if (L.mannequin || L.hairStyle < 0) return;
  const h = L.hair;
  const dark = shade(h, -0.3);
  const back = dir === 1;
  const side = dir === 2 || dir === 3;
  const st = L.hairStyle;
  const sway = Math.sin(t * 2.4) * 1.2;
  ctx.fillStyle = h;
  // long extras first (visible below helmets too)
  if (st === 1) {
    ctx.fillStyle = dark;
    if (back) ctx.fillRect(-9.5, hy - 4, 19, 14);
    else if (side) ctx.fillRect(-9, hy - 4, 7, 14);
    else {
      ctx.fillRect(-11, hy - 3, 4, 13);
      ctx.fillRect(7, hy - 3, 4, 13);
    }
  } else if (st === 3) {
    ctx.fillStyle = h;
    for (const sgn of side ? [-1] : [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sgn * 11 + sway * 0.5, hy + 7, 3, 8, sgn * 0.2, 0, TAU);
      ctx.fill();
    }
  } else if (st === 2 && (back || side)) {
    ctx.beginPath();
    ctx.ellipse((side ? -8 : 0) + sway, hy + 4, 3.2, 8, 0.2, 0, TAU);
    ctx.fill();
  }
  if (helmetCovers) return;
  ctx.fillStyle = h;
  ctx.beginPath();
  if (back) {
    ctx.arc(0, hy, 9.6, Math.PI * 0.95, Math.PI * 2.05);
    ctx.lineTo(9.4, hy + 5);
    ctx.quadraticCurveTo(0, hy + 9, -9.4, hy + 5);
    ctx.closePath();
  } else {
    ctx.arc(0, hy, 9.6, Math.PI * 1.02, Math.PI * 1.98);
    ctx.quadraticCurveTo(side ? 4 : 0, hy - 3, -9.4, hy - 1);
    ctx.closePath();
  }
  ctx.fill();
  switch (st) {
    case 0:
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + 0.25 + i * 0.62;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - 0.25) * 8, hy + Math.sin(a - 0.25) * 8);
        ctx.lineTo(Math.cos(a) * 14, hy + Math.sin(a) * 13);
        ctx.lineTo(Math.cos(a + 0.25) * 8, hy + Math.sin(a + 0.25) * 8);
        ctx.fill();
      }
      if (!back) {
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 3.5 - 2, hy - 6);
          ctx.lineTo(i * 3.5, hy - 1);
          ctx.lineTo(i * 3.5 + 2, hy - 6);
          ctx.fill();
        }
      }
      break;
    case 2:
      ctx.beginPath();
      ctx.arc(0, hy - 10, 3, 0, TAU);
      ctx.fill();
      break;
    case 4:
      ctx.beginPath();
      ctx.ellipse(-8.5, hy + 1, 2.6, 6, 0, 0, TAU);
      ctx.ellipse(8.5, hy + 1, 2.6, 6, 0, 0, TAU);
      ctx.fill();
      break;
    case 5:
      if (!back) {
        ctx.beginPath();
        ctx.moveTo(-9, hy - 4);
        ctx.quadraticCurveTo(0, hy - 10, 8, hy + 1);
        ctx.quadraticCurveTo(2, hy - 3, -9, hy - 1);
        ctx.fill();
      }
      break;
    case 6:
      ctx.fillStyle = dark;
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 9, hy - 2 + Math.sin(a) * 6, 1.8, 0, TAU);
        ctx.fill();
      }
      break;
    case 7:
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * 0.85 + (i / 8) * Math.PI * 1.3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 10, hy + Math.sin(a) * 9, 4, 0, TAU);
        ctx.fill();
      }
      break;
  }
  ctx.strokeStyle = rgba(shade(h, 0.4), 0.5);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(0, hy, 7, Math.PI * 1.2, Math.PI * 1.5);
  ctx.stroke();
}

function drawHead(ctx: CanvasRenderingContext2D, L: Look, dir: Dir, hy: number, t: number): void {
  const back = dir === 1;
  const side = dir === 2 || dir === 3;
  const helm = L.head && L.showHelmet ? L.head : null;
  const covers = !!helm && (helm.style === 0 || helm.style === 1);
  if (helm && helm.style === 1) {
    ctx.fillStyle = shade(helm.main, -0.15);
    ctx.beginPath();
    ctx.arc(0, hy, 11.5, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = L.skin;
  ctx.fillRect(-2, hy + 7, 4, 4);
  ctx.beginPath();
  ctx.arc(0, hy, 9, 0, TAU);
  ctx.fill();
  if (L.mannequin) {
    ctx.strokeStyle = shade(L.skin, -0.3);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.fillStyle = rgba('#000000', 0.08);
  ctx.beginPath();
  ctx.arc(0, hy + 2, 8, 0.2, Math.PI - 0.2);
  ctx.fill();
  if (!back && !L.mannequin) {
    const eyes = side ? [3.6] : [-3.3, 3.3];
    for (const ex of eyes) {
      ctx.fillStyle = '#1b1b24';
      ctx.beginPath();
      ctx.ellipse(ex, hy + 0.5, 1.7, 2.4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = L.eyes;
      ctx.beginPath();
      ctx.ellipse(ex, hy + 1, 1.2, 1.7, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ex - 0.9, hy - 1, 0.9, 0.9);
    }
    ctx.strokeStyle = rgba('#5a2a2a', 0.7);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    if (side) ctx.moveTo(5, hy + 5), ctx.lineTo(7, hy + 4.6);
    else ctx.arc(0, hy + 4, 1.6, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }
  drawHair(ctx, L, dir, hy, t, covers);
  if (!helm) return;
  const m = helm.main;
  if (helm.style === 0) {
    ctx.fillStyle = m;
    ctx.beginPath();
    ctx.arc(0, hy - 1, 10.4, Math.PI, 0);
    ctx.lineTo(10.4, hy + 5);
    ctx.lineTo(back ? -10.4 : 6, hy + 5);
    if (!back) {
      ctx.lineTo(6, hy - 2);
      ctx.lineTo(-6, hy - 2);
      ctx.lineTo(-6, hy + 5);
    }
    ctx.lineTo(-10.4, hy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = helm.trim;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-10.4, hy - 1.5);
    ctx.lineTo(10.4, hy - 1.5);
    ctx.stroke();
    if (!back && !side) {
      ctx.strokeStyle = shade(m, -0.4);
      ctx.beginPath();
      ctx.moveTo(0, hy - 2);
      ctx.lineTo(0, hy + 3);
      ctx.stroke();
    }
    if (helm.tier >= 4) {
      ctx.fillStyle = helm.accent;
      ctx.beginPath();
      ctx.moveTo(-1.5, hy - 11);
      ctx.quadraticCurveTo(side ? -14 : 0, hy - 22, side ? -16 : 1.5, hy - 10);
      ctx.closePath();
      ctx.fill();
    }
  } else if (helm.style === 1) {
    ctx.fillStyle = m;
    ctx.beginPath();
    ctx.moveTo(-11.5, hy + 4);
    ctx.quadraticCurveTo(-12, hy - 13, 0, hy - 15);
    ctx.quadraticCurveTo(12, hy - 13, 11.5, hy + 4);
    if (back) ctx.quadraticCurveTo(0, hy + 14, -11.5, hy + 4);
    else {
      ctx.lineTo(8, hy + 4);
      ctx.quadraticCurveTo(8, hy - 7, 0, hy - 8);
      ctx.quadraticCurveTo(-8, hy - 7, -8, hy + 4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = helm.trim;
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    ctx.strokeStyle = helm.trim;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, hy - 1, 9.4, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    if (!back) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glowSprite(helm.accent), -4, hy - 13, 8, 8);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = helm.accent;
      ctx.beginPath();
      ctx.arc(0, hy - 9, 1.6, 0, TAU);
      ctx.fill();
    }
    if (helm.tier >= 5) {
      ctx.fillStyle = helm.trim;
      for (const xx of [-5, 0, 5]) {
        ctx.beginPath();
        ctx.moveTo(xx - 1.6, hy - 9.5);
        ctx.lineTo(xx, hy - (xx === 0 ? 16 : 14));
        ctx.lineTo(xx + 1.6, hy - 9.5);
        ctx.fill();
      }
    }
  }
}

function drawCape(ctx: CanvasRenderingContext2D, L: Look, dir: Dir, vx: number, vy: number, t: number, by: number): void {
  const c = L.cloak;
  if (!c) return;
  const sp = Math.hypot(vx, vy);
  const m = Math.min(1, sp / 150);
  const sway = Math.sin(t * 2.6) * 1.4 + Math.sin(t * 7.3) * m * 1.2;
  const side = dir === 2 || dir === 3;
  ctx.fillStyle = c.main;
  ctx.strokeStyle = c.trim;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (side) {
    const tr = 4 + m * 9;
    ctx.moveTo(-3, -29 + by);
    ctx.lineTo(2, -29 + by);
    ctx.quadraticCurveTo(-2 - tr * 0.4, -16, -5 - tr * 0.6, -4 + sway * 0.5);
    ctx.lineTo(-9 - tr, -6 + sway);
    ctx.quadraticCurveTo(-8 - tr * 0.5, -18, -3, -29 + by);
  } else {
    const dx = (-vx / 150) * 4;
    const lift = dir === 1 ? -m * 3 : 0;
    ctx.moveTo(-8, -29 + by);
    ctx.lineTo(8, -29 + by);
    ctx.lineTo(11 + dx + sway * 0.4, -4 + lift);
    ctx.quadraticCurveTo(dx, -2 + lift + sway * 0.5, -11 + dx + sway * 0.4, -4 + lift);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (dir === 1) {
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.moveTo(0, -23 + by);
    ctx.lineTo(3.5, -18 + by);
    ctx.lineTo(0, -13 + by);
    ctx.lineTo(-3.5, -18 + by);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c.trim;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function drawQuiver(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(-2.5, -2, 5, 13);
  ctx.strokeStyle = '#c9a46e';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(-2.5, -2, 5, 13);
  const cols = ['#f4f0e6', '#c0283f', '#f4f0e6'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = cols[i];
    ctx.beginPath();
    ctx.moveTo(-2 + i * 2, -2);
    ctx.lineTo(-2.6 + i * 2, -7);
    ctx.lineTo(-0.8 + i * 2, -2);
    ctx.fill();
  }
  ctx.restore();
}

function restAngle(kind: string, dir: Dir): number {
  if (kind === 'spear' || kind === 'halberd' || kind === 'staff') return -1.42;
  if (kind === 'bow') return dir === 1 ? -0.3 : 0.25;
  return dir === 1 ? 1.9 : 1.15;
}

// ------------------------------------------------------------------ main draw

export function drawHumanoid(ctx: CanvasRenderingContext2D, x: number, y: number, L: Look, A: Anim, dir: Dir, o: DrawOpts): void {
  const s = L.scale;
  const z = o.z ?? 0;
  if (o.shadow !== false) {
    const k = Math.max(0.4, 1 - z / 110);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 12 * s * k, 4.6 * s * k, 0, 0, TAU);
    ctx.fill();
  }
  if (L.aura) {
    const p = 0.55 + 0.25 * Math.sin(o.t * 3);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * p;
    ctx.drawImage(glowSprite(L.aura), x - 20 * s, y - 8 * s, 40 * s, 16 * s);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = rgba(L.aura, 0.6 * p);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 15 * s, 5.5 * s, 0, 0, TAU);
    ctx.stroke();
  }
  if (o.ghosts !== false) {
    for (const g of A.ghosts) {
      drawHumanoid(ctx, g.x, g.y, L, A, g.dir, { ...o, z: g.z, alpha: Math.min(0.45, g.t * 1.8), shadow: false, ghosts: false, flash: 0, barrier: 0 });
    }
  }
  const alpha = (o.alpha ?? 1) * (L.ghost ? 0.62 : 1);
  ctx.save();
  ctx.translate(x, y - z);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  const side = dir === 2 || dir === 3;
  if (dir === 2) ctx.scale(-1, 1);
  const moving = o.moving && A.kind !== 'attack' && A.kind !== 'skill';
  const ph = A.walk;
  const amp = moving ? 1 : 0;
  const by = moving ? -Math.abs(Math.sin(ph)) * 1.6 : Math.sin(o.t * 2.2) * 0.45;
  const swinging = A.kind === 'attack';
  const lean = swinging ? Math.sin(Math.PI * Math.min(1, A.swing)) * 2.4 : 0;
  // local aim (mirrored when facing left)
  let aim = o.aim;
  if (dir === 2) aim = Math.PI - aim;
  const lx = Math.cos(aim) * lean;
  const ly = Math.sin(aim) * lean * 0.5;

  // weapon & hand geometry
  const main = L.main;
  const off = L.off;
  const sY = shoulderY() + by;
  const mainShoulderX = side ? 1.5 : dir === 1 ? -8 : 8;
  const offShoulderX = side ? -2 : dir === 1 ? 8 : -8;
  let wAng = main ? restAngle(main.kind, dir) : 1.2;
  let thrust = 0;
  let bowDraw = 0;
  const melee = main && main.kind !== 'bow' && main.kind !== 'staff';
  if (A.kind === 'attack' && main) {
    if (main.kind === 'spear' && melee) {
      wAng = aim;
      thrust = Math.sin(Math.PI * Math.min(1, A.swing)) * 12;
    } else if (main.kind === 'bow') {
      wAng = aim;
      bowDraw = Math.min(1, A.swing * 2.6) * (A.swing < 0.45 ? 1 : 0);
    } else if (main.kind === 'staff') wAng = -1.2 + Math.sin(Math.PI * A.swing) * 1.4;
    else if (A.hand === 0) {
      let a0 = A.a0;
      let a1 = A.a1;
      if (dir === 2) {
        a0 = Math.PI - a0;
        a1 = Math.PI - a1;
      }
      wAng = lerp(a0, a1, easeOutCubic(Math.min(1, A.swing)));
    }
  } else if (A.kind === 'skill' && main) {
    if (main.kind === 'bow') {
      wAng = aim;
      bowDraw = A.charge > 0 ? A.charge : 0.6;
    } else if (main.kind === 'staff') wAng = -1.25 + Math.sin(A.t * 6) * 0.2;
    else wAng = aim + Math.sin(A.t * 17) * 1.15;
  } else if (A.kind === 'block' || o.blocking) {
    if (melee) wAng = aim - 1.25;
  } else if (A.kind === 'cast' && main) wAng = -1.3;
  const reach = 9 + thrust;
  const mhx = mainShoulderX + Math.cos(wAng) * reach * 0.8 + lx;
  const mhy = sY + 2 + Math.sin(wAng) * reach * 0.6 + ly;
  // off hand
  const dualOff = !!off && (off.kind === 'sword' || off.kind === 'twinblade');
  let oAng = dir === 1 ? 1.2 : 1.95;
  if (dualOff && A.kind === 'attack' && A.hand === 1) {
    let a0 = A.a0;
    let a1 = A.a1;
    if (dir === 2) {
      a0 = Math.PI - a0;
      a1 = Math.PI - a1;
    }
    oAng = lerp(a0, a1, easeOutCubic(Math.min(1, A.swing)));
  } else if (dualOff && A.kind === 'skill') oAng = aim + Math.PI * 0.6 + Math.sin(A.t * 17 + 1.5) * 1.1;
  const ohx = offShoulderX + Math.cos(oAng) * 7 + lx;
  const ohy = sY + 3 + Math.sin(oAng) * 5 + ly;
  const shieldFront = !!off && off.kind === 'shield' && (o.blocking || A.kind === 'block');

  const drawMainWeapon = () => {
    if (!main) return;
    ctx.save();
    ctx.translate(mhx, mhy);
    ctx.rotate(wAng);
    drawWeapon(ctx, main, o.t, bowDraw);
    ctx.restore();
    if (main.temper >= 4) {
      const len = main.kind === 'spear' || main.kind === 'halberd' ? 46 : main.kind === 'staff' ? 35 : main.kind === 'bow' ? 4 : 28;
      drawTemperSparks(ctx, mhx + Math.cos(wAng) * len, mhy + Math.sin(wAng) * len, main, o.t);
    }
  };
  const drawOffItem = () => {
    if (!off) return;
    if (off.kind === 'shield') {
      if (shieldFront) return;
      ctx.save();
      ctx.translate(side ? -3 : dir === 1 ? 10 : -10.5, sY + 8);
      if (side) ctx.scale(0.5, 1);
      drawShield(ctx, off, 0.95);
      ctx.restore();
    } else if (dualOff) {
      ctx.save();
      ctx.translate(ohx, ohy);
      ctx.rotate(oAng);
      drawWeapon(ctx, off, o.t + 0.7);
      ctx.restore();
    }
  };
  const drawShieldFront = () => {
    if (!shieldFront || !off) return;
    const fx0 = Math.cos(aim) * 11;
    const fy0 = sY + 9 + Math.sin(aim) * 6;
    ctx.save();
    ctx.translate(fx0, fy0);
    drawShield(ctx, off, 1.05);
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba('#7fe9ff', 0.55 + 0.2 * Math.sin(o.t * 12));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(aim) * 15, sY + 10 + Math.sin(aim) * 7, 15, 10, 0, aim - 1.1, aim + 1.1);
    ctx.stroke();
    ctx.globalAlpha = 0.35 * alpha;
    ctx.drawImage(glowSprite('#7fe9ff'), Math.cos(aim) * 16 - 14, sY + 10 + Math.sin(aim) * 7 - 12, 28, 24);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'source-over';
  };
  const quiver = !!main && main.kind === 'bow';

  // ---- back layers
  if (dir !== 1) drawCape(ctx, L, dir, o.vx, o.vy, o.t, by);
  if (dir === 1) {
    drawMainWeapon();
    if (dualOff) drawOffItem();
  }
  if (quiver && dir !== 1) drawQuiver(ctx, side ? -4 : 5, sY - 3, side ? -0.6 : 0.35);
  if (side) drawOffItem();
  if (L.mannequin) {
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(-1.5, -14, 3, 14);
    ctx.fillRect(-7, -2, 14, 3);
  } else drawLegs(ctx, L, dir, ph, amp, by);
  // back arm (side views)
  if (side) drawArm(ctx, L, -1, sY + 1, -1 + Math.sin(ph + Math.PI) * 4 * amp, sY + 11);
  drawTorso(ctx, L, dir, by, o.t);
  drawPauldrons(ctx, L, dir, by);
  if (quiver && dir === 1) drawQuiver(ctx, -4, sY - 1, -0.3);
  // arms
  if (!side) {
    const offHandX = dualOff ? ohx : (dir === 1 ? 9.5 : -9.5) + Math.sin(ph) * 1.2 * amp;
    const offHandY = dualOff ? ohy : sY + 11 + Math.cos(ph) * 1.5 * amp;
    drawArm(ctx, L, offShoulderX, sY + 1, shieldFront ? Math.cos(aim) * 10 : offHandX, shieldFront ? sY + 9 + Math.sin(aim) * 5 : offHandY);
    if (main || L.mannequin === false) drawArm(ctx, L, mainShoulderX, sY + 1, main ? mhx : 9.5 - Math.sin(ph) * 1.2 * amp, main ? mhy : sY + 11 - Math.cos(ph) * 1.5 * amp);
  }
  drawHead(ctx, L, dir, -39 + by + ly * 0.5, o.t);
  if (dir === 1) drawCape(ctx, L, dir, o.vx, o.vy, o.t, by);
  if (dir === 1 && off && off.kind === 'shield') drawOffItem();
  if (dir === 0) drawOffItem();
  if (dir !== 1) {
    if (side) drawArm(ctx, L, 1.5, sY + 1, main ? mhx : 1.5 + Math.sin(ph) * 4 * amp, main ? mhy : sY + 11);
    drawMainWeapon();
  }
  drawShieldFront();
  if (main && main.kind === 'staff' && !L.mannequin) {
    const ox = side ? -12 : dir === 1 ? 12 : -14;
    const oy = sY - 6 + Math.sin(o.t * 3) * 2;
    const col = main.gem ?? main.glow;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowSprite(col), ox - 8, oy - 8, 16, 16);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = mix(col, '#ffffff', 0.5);
    ctx.beginPath();
    ctx.arc(ox, oy, 2.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(col, 0.8);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(ox, oy, 5, 2, o.t * 2, 0, TAU);
    ctx.stroke();
  }
  // pre-motion glint on weapon tip
  if (A.glint > 0 && main) {
    const len = main.kind === 'spear' || main.kind === 'halberd' ? 48 : 30;
    const gx = mhx + Math.cos(wAng) * len;
    const gy = mhy + Math.sin(wAng) * len;
    const k = A.glint / 0.12;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowSprite(A.glintColor), gx - 16, gy - 16, 32, 32);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    const r = 9 * (1 - Math.abs(k - 0.5));
    ctx.beginPath();
    ctx.moveTo(gx, gy - r * 1.5);
    ctx.lineTo(gx + r * 0.25, gy - r * 0.25);
    ctx.lineTo(gx + r * 1.5, gy);
    ctx.lineTo(gx + r * 0.25, gy + r * 0.25);
    ctx.lineTo(gx, gy + r * 1.5);
    ctx.lineTo(gx - r * 0.25, gy + r * 0.25);
    ctx.lineTo(gx - r * 1.5, gy);
    ctx.lineTo(gx - r * 0.25, gy - r * 0.25);
    ctx.closePath();
    ctx.fill();
  }
  if ((o.flash ?? 0) > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, (o.flash ?? 0) * 7) * alpha;
    ctx.drawImage(glowSprite('#ffffff'), -15, -54, 30, 56);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (L.ghost) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 * alpha;
    ctx.drawImage(glowSprite('#9fdcff'), -16, -52, 32, 54);
    ctx.globalCompositeOperation = 'source-over';
  }
  if ((o.barrier ?? 0) > 0) {
    ctx.globalAlpha = 0.5 + 0.15 * Math.sin(o.t * 6);
    ctx.strokeStyle = '#c9a8ff';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, -22, 17, 27, 0, 0, TAU);
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18;
    ctx.drawImage(glowSprite('#b48cff'), -18, -50, 36, 56);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** static preview pose for menus (character creator, equipment screen, mannequins) */
export function previewAnim(t: number): Anim {
  return { kind: 'idle', t, walk: t * 8, swing: 0, a0: 0, a1: 0, hand: 0, glint: 0, glintColor: '#fff', charge: 0, ghosts: [] };
}
