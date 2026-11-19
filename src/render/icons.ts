// Procedural icons for skills, items and gear (canvas for the HUD, data URLs for DOM menus).
import type { GearItem, IconShape } from '../types/game';
import { BRANCH_INFO, RARITY_COLORS } from '../data/constants';
import { SKILL_BY_ID, ACTIVE_SKILLS, PASSIVE_BY_ID } from '../data/skills';
import { FURNITURE, itemDef } from '../data/items';
import { drawShield, drawWeapon, visOf } from './gear';
import { drawFurniture } from './props';
import { glowSprite } from './glow';
import { mix, rgba, shade, TAU } from '../engine/util';
import { gemColor } from '../systems/stats';

const canv = new Map<string, HTMLCanvasElement>();
const urls = new Map<string, string>();

function mk(key: string, size: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  let c = canv.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.scale(2, 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  paint(g);
  canv.set(key, c);
  return c;
}

function url(key: string, c: HTMLCanvasElement): string {
  let u = urls.get(key);
  if (!u) {
    u = c.toDataURL();
    urls.set(key, u);
  }
  return u;
}

// ------------------------------------------------------------------ skills

function glyph(g: CanvasRenderingContext2D, branch: string, n: number): void {
  g.strokeStyle = '#ffffff';
  g.fillStyle = '#ffffff';
  g.lineWidth = 3;
  switch (branch) {
    case 'sword':
      g.beginPath();
      g.moveTo(14, 50);
      g.lineTo(46, 14);
      g.stroke();
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(14, 38);
      g.lineTo(26, 50);
      g.stroke();
      break;
    case 'dual':
      g.beginPath();
      g.moveTo(14, 50);
      g.lineTo(46, 14);
      g.moveTo(50, 50);
      g.lineTo(18, 14);
      g.stroke();
      break;
    case 'shield':
      g.beginPath();
      g.moveTo(32, 12);
      g.lineTo(48, 18);
      g.quadraticCurveTo(48, 42, 32, 52);
      g.quadraticCurveTo(16, 42, 16, 18);
      g.closePath();
      g.stroke();
      break;
    case 'spear':
      g.beginPath();
      g.moveTo(12, 52);
      g.lineTo(46, 18);
      g.stroke();
      g.beginPath();
      g.moveTo(44, 12);
      g.lineTo(52, 20);
      g.lineTo(40, 24);
      g.closePath();
      g.fill();
      break;
    case 'bow':
      g.beginPath();
      g.arc(26, 32, 20, -1.2, 1.2);
      g.stroke();
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(33, 13);
      g.lineTo(33, 51);
      g.moveTo(16, 32);
      g.lineTo(52, 32);
      g.stroke();
      break;
    default:
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 9 : 20;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        if (i === 0) g.moveTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
        else g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
  }
  for (let i = 0; i < n; i++) {
    g.fillStyle = '#ffd166';
    g.beginPath();
    g.arc(10 + i * 7, 58, 2.4, 0, TAU);
    g.fill();
  }
}

export function skillIcon(id: string): HTMLCanvasElement {
  return mk('sk:' + id, 64, (g) => {
    const def = SKILL_BY_ID[id];
    const pas = PASSIVE_BY_ID[id];
    const branch = def ? def.branch : pas ? pas.branch : 'sword';
    const col = def ? def.color : BRANCH_INFO[branch].color;
    const grd = g.createRadialGradient(32, 28, 4, 32, 32, 44);
    grd.addColorStop(0, mix(col, '#ffffff', 0.25));
    grd.addColorStop(0.55, shade(col, -0.35));
    grd.addColorStop(1, '#070b16');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    if (pas) {
      g.strokeStyle = rgba('#ffffff', 0.35);
      g.lineWidth = 2;
      g.strokeRect(5, 5, 54, 54);
    }
    const idx = def ? ACTIVE_SKILLS.filter((s) => s.branch === branch).indexOf(def) + 1 : 0;
    glyph(g, branch, idx);
  });
}

export function skillIconURL(id: string): string {
  return url('sk:' + id, skillIcon(id));
}

// ------------------------------------------------------------------ items

function itemShape(g: CanvasRenderingContext2D, shape: IconShape, c: string, c2: string): void {
  const dark = shade(c, -0.4);
  g.fillStyle = c;
  g.strokeStyle = dark;
  g.lineWidth = 1.5;
  switch (shape) {
    case 'ore':
      g.fillStyle = '#6e6a70';
      g.beginPath();
      g.moveTo(6, 36);
      g.lineTo(10, 16);
      g.lineTo(24, 8);
      g.lineTo(40, 16);
      g.lineTo(42, 36);
      g.closePath();
      g.fill();
      g.fillStyle = c;
      for (const [x, y, r] of [[16, 22, 5], [28, 16, 6], [30, 30, 5]] as [number, number, number][]) {
        g.beginPath();
        g.moveTo(x, y - r);
        g.lineTo(x + r, y);
        g.lineTo(x, y + r);
        g.lineTo(x - r, y);
        g.fill();
      }
      break;
    case 'ingot':
      g.beginPath();
      g.moveTo(8, 34);
      g.lineTo(14, 18);
      g.lineTo(38, 18);
      g.lineTo(42, 34);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = rgba('#ffffff', 0.4);
      g.fillRect(16, 20, 20, 3);
      break;
    case 'herb':
    case 'bark':
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.ellipse(24 + Math.cos(i * 1.25) * 8, 22 + Math.sin(i * 1.25) * 8, 8, 4, i * 1.25, 0, TAU);
        g.fill();
        g.stroke();
      }
      g.fillStyle = shape === 'bark' ? '#5a3a24' : '#3f8a3a';
      g.fillRect(23, 26, 3, 16);
      break;
    case 'meat':
      g.beginPath();
      g.ellipse(22, 24, 15, 11, -0.4, 0, TAU);
      g.fill();
      g.stroke();
      g.fillStyle = '#f4efe6';
      g.beginPath();
      g.ellipse(36, 32, 4, 6, 0.6, 0, TAU);
      g.fill();
      break;
    case 'potion':
    case 'flask':
    case 'oil':
      g.fillStyle = '#c8d4e0';
      g.fillRect(20, 6, 8, 8);
      g.fillStyle = c;
      g.beginPath();
      if (shape === 'potion') g.arc(24, 28, 14, 0, TAU);
      else g.roundRect(14, 12, 20, 30, 6);
      g.fill();
      g.stroke();
      g.fillStyle = rgba('#ffffff', 0.45);
      g.beginPath();
      g.ellipse(19, 24, 3, 6, 0.3, 0, TAU);
      g.fill();
      if (shape === 'oil') {
        g.fillStyle = c2 || '#ffffff';
        g.beginPath();
        g.moveTo(36, 30);
        g.quadraticCurveTo(42, 38, 36, 42);
        g.quadraticCurveTo(30, 38, 36, 30);
        g.fill();
      }
      break;
    case 'dish':
      g.fillStyle = '#e8eef6';
      g.beginPath();
      g.ellipse(24, 30, 19, 9, 0, 0, TAU);
      g.fill();
      g.fillStyle = c;
      g.beginPath();
      g.ellipse(24, 26, 12, 7, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#5fae4e';
      g.fillRect(18, 20, 4, 3);
      break;
    case 'gem':
    case 'shard':
    case 'relic':
      g.beginPath();
      g.moveTo(24, 6);
      g.lineTo(38, 18);
      g.lineTo(24, 42);
      g.lineTo(10, 18);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = rgba('#ffffff', 0.55);
      g.beginPath();
      g.moveTo(24, 9);
      g.lineTo(31, 18);
      g.lineTo(24, 24);
      g.lineTo(17, 18);
      g.fill();
      if (shape === 'relic') {
        g.globalCompositeOperation = 'lighter';
        g.drawImage(glowSprite(c), 4, 2, 40, 44);
        g.globalCompositeOperation = 'source-over';
      }
      break;
    case 'stone':
      g.beginPath();
      g.ellipse(24, 26, 15, 13, 0, 0, TAU);
      g.fill();
      g.stroke();
      g.strokeStyle = '#ffffff';
      g.beginPath();
      g.moveTo(18, 26);
      g.lineTo(24, 18);
      g.lineTo(30, 26);
      g.lineTo(24, 34);
      g.closePath();
      g.stroke();
      break;
    case 'dust':
      for (let i = 0; i < 18; i++) {
        g.beginPath();
        g.arc(12 + (i * 7) % 24, 22 + (i * 5) % 16, 2.5, 0, TAU);
        g.fill();
      }
      break;
    case 'hide':
    case 'cloth':
      g.beginPath();
      g.moveTo(8, 12);
      g.lineTo(40, 10);
      g.lineTo(38, 38);
      g.lineTo(10, 36);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    case 'fang':
      g.beginPath();
      g.moveTo(14, 8);
      g.quadraticCurveTo(40, 14, 30, 42);
      g.quadraticCurveTo(26, 22, 14, 8);
      g.fill();
      g.stroke();
      break;
    case 'core':
    case 'essence':
      g.globalCompositeOperation = 'lighter';
      g.drawImage(glowSprite(c), 2, 2, 44, 44);
      g.globalCompositeOperation = 'source-over';
      g.beginPath();
      g.arc(24, 24, 10, 0, TAU);
      g.fill();
      g.strokeStyle = rgba('#ffffff', 0.7);
      g.beginPath();
      g.arc(24, 24, 6, 0.5, 3);
      g.stroke();
      break;
    case 'scale':
      g.beginPath();
      g.moveTo(24, 8);
      g.quadraticCurveTo(40, 18, 24, 42);
      g.quadraticCurveTo(8, 18, 24, 8);
      g.fill();
      g.stroke();
      break;
    case 'cog':
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 ? 16 : 12;
        const a = (i / 16) * TAU;
        if (i === 0) g.moveTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r);
        else g.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      g.fillStyle = '#1a1a24';
      g.beginPath();
      g.arc(24, 24, 5, 0, TAU);
      g.fill();
      break;
    case 'bone':
      g.lineWidth = 6;
      g.strokeStyle = c;
      g.beginPath();
      g.moveTo(12, 36);
      g.lineTo(36, 12);
      g.stroke();
      for (const [x, y] of [[10, 34], [14, 38], [34, 10], [38, 14]]) {
        g.beginPath();
        g.arc(x, y, 4, 0, TAU);
        g.fill();
      }
      break;
    case 'feather':
      g.beginPath();
      g.ellipse(24, 24, 7, 18, 0.6, 0, TAU);
      g.fill();
      g.stroke();
      break;
    case 'trophy':
      g.fillStyle = '#ffd166';
      g.beginPath();
      g.moveTo(12, 8);
      g.lineTo(36, 8);
      g.quadraticCurveTo(36, 30, 24, 30);
      g.quadraticCurveTo(12, 30, 12, 8);
      g.fill();
      g.fillRect(21, 30, 6, 6);
      g.fillRect(15, 36, 18, 5);
      break;
    default:
      g.fillRect(10, 10, 28, 28);
  }
}

export function itemIconCanvas(id: string): HTMLCanvasElement {
  return mk('it:' + id, 48, (g) => {
    const d = itemDef(id);
    g.fillStyle = 'rgba(12,18,34,0.0)';
    g.fillRect(0, 0, 48, 48);
    if (d.cat === 'furniture' && d.furniture) {
      const fd = FURNITURE[d.furniture];
      const w = fd.w * 32 + 8;
      const h = fd.h * 32 + 40;
      const sc = Math.min(44 / w, 44 / h);
      g.save();
      g.translate(24 - (w * sc) / 2, 46 - h * sc);
      g.scale(sc, sc);
      drawFurniture(g, d.furniture, w, h, id, 0);
      g.restore();
      return;
    }
    itemShape(g, d.icon, d.color, d.color2 ?? '');
  });
}

export function itemIconURL(id: string): string {
  return url('it:' + id, itemIconCanvas(id));
}

// ------------------------------------------------------------------ gear

function gearKey(gi: GearItem): string {
  return `gr:${gi.baseId}:${gi.tier}:${gi.style}:${gi.colors.main}:${gi.colors.accent}:${gi.temper}:${gi.gems.join('')}:${gi.rarity}`;
}

export function gearIconCanvas(gi: GearItem): HTMLCanvasElement {
  return mk(gearKey(gi), 48, (g) => {
    const v = visOf(gi, gemColor(gi));
    if (!v) return;
    const rc = RARITY_COLORS[gi.rarity];
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.25 + gi.rarity * 0.06;
    g.drawImage(glowSprite(rc), 0, 0, 48, 48);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (gi.kind === 'weapon') {
      g.save();
      if (gi.wtype === 'bow') {
        g.translate(22, 24);
        g.rotate(-0.6);
        g.scale(0.9, 0.9);
      } else {
        const len = gi.wtype === 'spear' || gi.wtype === 'halberd' ? 70 : gi.wtype === 'staff' ? 52 : 44;
        g.translate(8, 40);
        g.rotate(-Math.PI / 4);
        const sc = 58 / len;
        g.scale(sc, sc);
        g.translate(gi.wtype === 'spear' || gi.wtype === 'halberd' || gi.wtype === 'staff' ? 18 : 8, 0);
      }
      drawWeapon(g, v, 0.3, 0);
      g.restore();
      return;
    }
    const m = gi.colors.main;
    const a = gi.colors.accent;
    const tr = gi.colors.trim;
    g.fillStyle = m;
    g.strokeStyle = tr;
    g.lineWidth = 1.6;
    switch (gi.aslot) {
      case 'shield':
        g.save();
        g.translate(24, 24);
        drawShield(g, v, 1.6);
        g.restore();
        break;
      case 'head':
        g.beginPath();
        if (gi.style === 2) {
          g.ellipse(24, 26, 14, 6, 0, 0, TAU);
          g.lineWidth = 3;
          g.strokeStyle = tr;
          g.stroke();
          g.fillStyle = a;
          g.beginPath();
          g.arc(24, 21, 3, 0, TAU);
          g.fill();
        } else {
          g.arc(24, 26, 15, Math.PI, 0);
          g.lineTo(39, 36);
          g.lineTo(9, 36);
          g.closePath();
          g.fill();
          g.stroke();
          if (gi.style === 0) {
            g.fillStyle = '#1a1a24';
            g.fillRect(14, 26, 20, 3);
          }
        }
        break;
      case 'chest':
        g.beginPath();
        g.moveTo(12, 10);
        g.lineTo(36, 10);
        g.lineTo(40, 18);
        g.lineTo(34, 20);
        g.lineTo(34, gi.style === 1 || gi.style === 3 ? 44 : 38);
        g.lineTo(14, gi.style === 1 || gi.style === 3 ? 44 : 38);
        g.lineTo(14, 20);
        g.lineTo(8, 18);
        g.closePath();
        g.fill();
        g.stroke();
        g.fillStyle = a;
        g.fillRect(14, 28, 20, 3);
        if (gi.style === 2 || gi.style === 4) {
          g.fillStyle = m;
          g.beginPath();
          g.arc(10, 14, 5, 0, TAU);
          g.arc(38, 14, 5, 0, TAU);
          g.fill();
          g.stroke();
        }
        break;
      case 'boots':
        g.beginPath();
        g.moveTo(14, 8);
        g.lineTo(26, 8);
        g.lineTo(26, 30);
        g.lineTo(38, 34);
        g.lineTo(38, 40);
        g.lineTo(12, 40);
        g.closePath();
        g.fill();
        g.stroke();
        break;
      case 'cloak':
        g.beginPath();
        g.moveTo(16, 8);
        g.lineTo(32, 8);
        g.quadraticCurveTo(42, 28, 38, 42);
        g.lineTo(10, 42);
        g.quadraticCurveTo(6, 28, 16, 8);
        g.fill();
        g.stroke();
        g.fillStyle = a;
        g.beginPath();
        g.arc(24, 24, 4, 0, TAU);
        g.fill();
        break;
    }
  });
}

export function gearIconURL(gi: GearItem): string {
  return url(gearKey(gi), gearIconCanvas(gi));
}
