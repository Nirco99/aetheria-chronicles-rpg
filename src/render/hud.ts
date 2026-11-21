// Canvas HUD (drawn in a 720px-tall logical space).
import { drawPartyFrames, drawV3Hud } from './v3hud';
import type { RenderHost } from '../gfx/host';
import { G } from '../core/state';
import { BRANCH_INFO, HOTBAR_SIZE, QUICK_KEYS, UI_H, xpToNext } from '../data/constants';
import { SKILL_BY_ID } from '../data/skills';
import { itemDef } from '../data/items';
import { GUILDS } from '../data/guilds';
import { activeSet } from '../systems/stats';
import { countItem } from '../systems/inventory';
import { bountyReady } from '../systems/guilds';
import { tickerLines } from '../systems/economy';
import { arena, CUPS } from '../systems/arena';
import { canPlace } from '../systems/housing';
import { FURNITURE } from '../data/items';
import { isNight } from '../world/world';
import { skillIcon, itemIconCanvas } from './icons';
import { clamp, clockText, rgba, TAU } from '../engine/util';
import { TILE } from '../data/constants';

const FONT = '"Segoe UI Semibold", "Segoe UI", "Trebuchet MS", system-ui, sans-serif';
const SERIF = '"Palatino Linotype", "Book Antiqua", Georgia, serif';

/** trailing "ghost" fractions so lost health drains visibly behind the bar */
const lag: Record<string, number> = {};

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
}

/** rounded gauge with a glossy fill, a white-hot leading edge and an optional damage ghost */
function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, col: string, back = 'rgba(6,9,20,0.86)', ghost = ''): void {
  const f = clamp(frac, 0, 1);
  const r = Math.min(4, h / 2);
  if (back !== 'rgba(0,0,0,0)') {
    rr(ctx, x - 1, y - 1, w + 2, h + 2, r + 1);
    ctx.fillStyle = back;
    ctx.fill();
  }
  if (ghost) {
    const prev = lag[ghost] ?? f;
    const g2 = prev > f ? Math.max(f, prev - Math.max(0.0035, (prev - f) * 0.045)) : f;
    lag[ghost] = g2;
    if (g2 > f + 0.002) {
      rr(ctx, x, y, w * g2, h, r);
      ctx.fillStyle = 'rgba(255,236,190,0.85)';
      ctx.fill();
    }
  }
  if (f > 0.004) {
    ctx.save();
    rr(ctx, x, y, Math.max(h, w * f), h, r);
    ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, rgba('#ffffff', 0.55));
    g.addColorStop(0.18, col);
    g.addColorStop(0.62, col);
    g.addColorStop(1, rgba('#000000', 0.42));
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w * f, h);
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(x, y, w * f, h);
    ctx.globalAlpha = 1;
    if (h >= 8) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(x + w * f - 1.5, y, 1.5, h);
    }
    ctx.restore();
  }
  if (back !== 'rgba(0,0,0,0)') {
    rr(ctx, x - 0.5, y - 0.5, w + 1, h + 1, r + 0.5);
    ctx.strokeStyle = 'rgba(190,214,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, col = '#e6edf7', align: CanvasTextAlign = 'left', weight = 700): void {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(4,7,16,0.85)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = col;
  ctx.fillText(s, x, y);
}

/** glass panel: deep gradient, hairline frame, top sheen and gilded corner ticks */
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent = 'rgba(214,186,120,0.75)'): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(22,30,54,0.8)');
  g.addColorStop(1, 'rgba(6,9,20,0.86)');
  rr(ctx, x, y, w, h, 10);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,190,240,0.26)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const sh = ctx.createLinearGradient(x, 0, x + w, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(x + 10, y + 0.5, w - 20, 1);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.4;
  const c = 9;
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]] as number[][]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * c, cy + dy * 2.5);
    ctx.lineTo(cx + dx * 2.5, cy + dy * 2.5);
    ctx.lineTo(cx + dx * 2.5, cy + dy * c);
    ctx.stroke();
  }
}

/** keyboard key cap; returns its width */
function keycap(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, size = 10): number {
  ctx.font = `700 ${size}px ${FONT}`;
  const w = Math.max(size + 6, ctx.measureText(key).width + 8);
  rr(ctx, x, y - size * 0.8, w, size * 1.6, 3);
  ctx.fillStyle = 'rgba(20,28,52,0.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,130,0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText(key, x + w / 2, y + 0.5);
  return w;
}

export function drawHud(ctx: CanvasRenderingContext2D, r: RenderHost, t: number): void {
  const k = r.h / UI_H;
  const W = r.w / k;
  const H = UI_H;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const s = G.save;
  const p = G.player;
  const world = G.world;
  // ---------------------------------------------------------------- vitals
  panel(ctx, 12, 12, 318, 112);
  // level medallion with the XP ring
  const need = xpToNext(s.level);
  const mx0 = 46;
  const my0 = 50;
  ctx.beginPath();
  ctx.arc(mx0, my0, 25, 0, TAU);
  const mg = ctx.createRadialGradient(mx0 - 6, my0 - 8, 2, mx0, my0, 26);
  mg.addColorStop(0, '#34466e');
  mg.addColorStop(1, '#0b1124');
  ctx.fillStyle = mg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(30,40,70,0.9)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mx0, my0, 25, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(s.xp / need, 0, 1));
  ctx.strokeStyle = '#c9a8ff';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mx0, my0, 28.5, 0, TAU);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(214,186,120,0.8)';
  ctx.stroke();
  ctx.font = `700 9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c9b8ff';
  ctx.fillText('LV', mx0, my0 - 11);
  ctx.font = `700 21px ${SERIF}`;
  ctx.fillStyle = '#fff3cf';
  ctx.fillText(String(s.level), mx0, my0 + 4);
  ctx.font = `700 16px ${SERIF}`;
  ctx.textAlign = 'left';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(4,7,16,0.85)';
  ctx.strokeText(s.name, 86, 29);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(s.name, 86, 29);
  if (s.title) text(ctx, s.title, 318, 29, 10, '#ffd166', 'right', 600);
  const low = p.hp < p.stats.maxHp * 0.3;
  bar(ctx, 86, 41, 232, 15, p.hp / p.stats.maxHp, low ? (Math.floor(t * 6) % 2 ? '#ff6b78' : '#e0324a') : '#3fd47a', undefined, 'hp');
  if (p.barrier > 0) bar(ctx, 86, 41, 232, 4, p.barrier / p.stats.maxHp, '#c9a8ff', 'rgba(0,0,0,0)');
  text(ctx, `${Math.ceil(p.hp)} / ${p.stats.maxHp}`, 202, 48.5, 10.5, '#ffffff', 'center', 700);
  bar(ctx, 86, 61, 232, 9, p.mp / p.stats.maxMp, '#3d9bff', undefined, 'mp');
  text(ctx, `${Math.floor(p.mp)}`, 202, 65.5, 8.5, '#e6f2ff', 'center', 700);
  bar(ctx, 86, 74, 232, 5, p.sta / p.stats.maxSta, '#ffcf5a');
  text(ctx, `${s.gold.toLocaleString()} G`, 86, 94, 12, '#ffd166');
  if (s.sp > 0) {
    const pulse = 0.7 + 0.3 * Math.sin(t * 5);
    text(ctx, `${s.sp} SKILL POINT${s.sp > 1 ? 'S' : ''}  [K]`, 318, 94, 10.5, rgba('#7fe9ff', pulse), 'right');
  } else text(ctx, `XP ${Math.floor((s.xp / need) * 100)}%`, 318, 94, 10.5, '#c9b8ff', 'right', 600);
  // buffs & statuses
  let bx = 30;
  for (const b of p.buffs) {
    ctx.fillStyle = rgba(b.spec.color, 0.85);
    ctx.beginPath();
    ctx.arc(bx + 7, 112, 7, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bx + 7, 112, 7, -Math.PI / 2, -Math.PI / 2 + TAU * (b.t / b.spec.dur));
    ctx.stroke();
    text(ctx, b.t > 60 ? `${Math.ceil(b.t / 60)}m` : `${Math.ceil(b.t)}s`, bx + 16, 112, 9, '#e6edf7', 'left', 600);
    bx += 46;
    if (bx > 290) break;
  }
  for (const st of p.statuses) {
    text(ctx, st.kind.toUpperCase(), bx + 2, 112, 9, '#ff9aa6');
    bx += 44;
  }
  // companions (party of two)
  drawPartyFrames(ctx);
  // ---------------------------------------------------------------- minimap & clock
  const mmW = 180;
  const mmH = 132;
  const mx = W - mmW - 14;
  const my = 30;
  const m = world.map;
  text(ctx, m.name, W - 14, 18, 12, '#bfe6ff', 'right');
  panel(ctx, mx - 4, my - 4, mmW + 8, mmH + 8);
  const mm = r.minimap();
  const scale = Math.min(mmW / m.w, mmH / m.h);
  const mw = m.w * scale;
  const mh = m.h * scale;
  const ox = mx + (mmW - mw) / 2;
  const oy = my + (mmH - mh) / 2;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mm, ox, oy, mw, mh);
  ctx.imageSmoothingEnabled = true;
  const dot = (x: number, y: number, col: string, rad = 2.2) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(ox + (x / TILE) * scale, oy + (y / TILE) * scale, rad, 0, TAU);
    ctx.fill();
  };
  for (const it of m.interacts) {
    const a = it.action.t;
    if (a === 'gate' || a === 'crystal') dot(it.x, it.y, '#7fe9ff', 3);
    else if (a === 'dungeon' || a === 'abyss' || a === 'stairs') dot(it.x, it.y, '#a970ff', 3);
    else if (a === 'forge' || a === 'shop' || a === 'alchemy' || a === 'guild' || a === 'estate' || a === 'house' || a === 'coliseum') dot(it.x, it.y, '#ffd166', 2);
  }
  for (const e of m.exits) dot(e.x + e.w / 2, e.y + e.h / 2, '#5ee6a0', 3);
  for (const mo of world.monsters) if (!mo.dead && Math.hypot(mo.x - p.x, mo.y - p.y) < 700) dot(mo.x, mo.y, mo.isBoss || mo.isElite ? '#ff9a3d' : '#ff4d5e', mo.isBoss || mo.isElite ? 3 : 1.6);
  for (const pc of world.party) if (!pc.dead) dot(pc.x, pc.y, '#7fe9ff', 2.4);
  for (const v of world.vanguard) if (!v.dead) dot(v.x, v.y, '#ffd27a', 2.2);
  for (const a of world.adventurers) dot(a.x, a.y, a.helpNeeded ? '#ff9a3d' : '#5ee6a0', a.helpNeeded ? 3 : 1.8);
  for (const f of m.fishSpots) dot(f.wx, f.wy, '#7fc8ff', 2);
  for (const pd of m.pads) dot(pd.x, pd.y, '#7fe9ff', 1.8);
  if (world.caravan) dot(world.caravan.x, world.caravan.y, '#ffd166', 3.2);
  if (world.event && !world.event.done) dot(world.event.x, world.event.y, '#c9a8ff', 3.6);
  for (const mo of world.monsters) if (mo.raid && !mo.dead) dot(mo.x, mo.y, '#ff2a40', 4.2);
  if (m.kind === 'wild') {
    for (const hu of s.hunts) {
      if (hu.found || hu.realm !== m.realm) continue;
      const hx = ox + (hu.x / TILE) * scale;
      const hy2 = oy + (hu.y / TILE) * scale;
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy2 - 3);
      ctx.lineTo(hx + 3, hy2 + 3);
      ctx.moveTo(hx + 3, hy2 - 3);
      ctx.lineTo(hx - 3, hy2 + 3);
      ctx.stroke();
    }
  }
  dot(p.x, p.y, '#ffffff', 3);
  const night = isNight(s.time);
  const wname = { clear: night ? 'Clear night' : 'Clear', rain: 'Rain', storm: 'Thunderstorm', blizzard: 'Blizzard', ash: 'Ember Ash' }[m.outdoor ? world.weather : 'clear'];
  text(ctx, `Day ${s.day}  ${clockText(s.time)}`, mx, my + mmH + 16, 11, night ? '#9fb4ff' : '#ffe9b0');
  text(ctx, m.outdoor ? wname : m.kind === 'house' ? 'Indoors' : 'Underground', W - 14, my + mmH + 16, 11, '#bfe6ff', 'right');
  // ---------------------------------------------------------------- bounty tracker
  let by = my + mmH + 36;
  if (s.bounties.length) {
    text(ctx, 'BOUNTIES', W - 14, by, 10, '#ffd166', 'right');
    by += 14;
    for (const b of s.bounties) {
      const ready = bountyReady(b);
      const prog = b.kind === 'gather' ? `${Math.min(countItem(b.target), b.count)}/${b.count}` : `${b.progress}/${b.count}`;
      text(ctx, `${b.title}  ${ready ? 'READY' : prog}`, W - 14, by, 10, ready ? '#7dff9a' : GUILDS[b.guild].color, 'right', 600);
      by += 13;
    }
  }
  // ---------------------------------------------------------------- mode info / ticker
  if (m.kind === 'arena' && arena.state) {
    const a = arena.state;
    text(ctx, a.mode === 'cup' ? `${CUPS[a.cup].name} - Round ${a.round}/5` : `Endless - Wave ${a.wave} (best ${s.arena.bestWave})`, W / 2, 20, 14, '#ffd166', 'center');
  } else if (m.kind === 'abyss') {
    text(ctx, `Infinite Abyss - Floor ${m.floor}${m.floor % 5 === 0 ? ' (Boss Rush)' : ''}   Best ${s.abyss.best}`, W / 2, 20, 13, '#c9a8ff', 'center');
    if (m.modifiers.length) text(ctx, m.modifiers.join(' / '), W / 2, 36, 11, '#ff9aa6', 'center', 600);
  } else if (m.kind === 'city' && !world.boss) {
    const lines = tickerLines();
    const str = lines.join('      •      ');
    ctx.font = `600 11px ${FONT}`;
    const tw = ctx.measureText(str).width + 120;
    const sx = W / 2 + 180 - ((t * 40) % tw);
    ctx.save();
    ctx.beginPath();
    ctx.rect(W / 2 - 220, 10, 440, 20);
    ctx.clip();
    ctx.fillStyle = 'rgba(8,13,28,0.55)';
    ctx.fillRect(W / 2 - 220, 10, 440, 20);
    text(ctx, str, sx, 20, 11, '#ffe9b0', 'left', 600);
    text(ctx, str, sx + tw, 20, 11, '#ffe9b0', 'left', 600);
    ctx.restore();
  }
  // ---------------------------------------------------------------- boss bar
  const boss = world.boss;
  if (boss && !boss.dead) {
    const bw = Math.min(620, W - 420);
    const bx0 = W / 2 - bw / 2;
    panel(ctx, bx0 - 10, 44, bw + 20, 50);
    text(ctx, boss.def.name, bx0, 56, 14, '#ffb3bb');
    const phase = boss.bdef ? `Phase ${boss.phase + 1}: ${boss.bdef.phases[boss.phase].name}` : 'Floor Warden';
    text(ctx, phase, bx0 + bw, 56, 11, '#ffd166', 'right', 600);
    bar(ctx, bx0, 66, bw, 12, boss.hp / boss.stats.maxHp, '#e0324a');
    if (boss.bdef) for (const ph of boss.bdef.phases.slice(1)) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx0 + bw * ph.at - 1, 64, 2, 16);
    }
    bar(ctx, bx0, 81, bw, 6, boss.broken > 0 ? 1 : boss.brk / Math.max(1, boss.brkMax), boss.broken > 0 ? '#fff1a8' : '#ffd166');
    if (boss.broken > 0) text(ctx, 'BROKEN', W / 2, 84, 10, '#000000', 'center');
    if (boss.armored) text(ctx, 'ARMORED - break the scales!', W / 2, 102, 11, '#ffb02e', 'center');
    if (boss.frontGuard && boss.broken <= 0) text(ctx, 'FRONT GUARD - flank, Switch, or Break!', W / 2, 102, 11, '#fff1a8', 'center');
  }
  // ---------------------------------------------------------------- hotbar
  const slot = 48;
  const gap = 6;
  const total = HOTBAR_SIZE * slot + (HOTBAR_SIZE - 1) * gap;
  const hx = W / 2 - total / 2;
  const hy = H - slot - 16;
  panel(ctx, hx - 8, hy - 8, total + 16, slot + 16);
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const x = hx + i * (slot + gap);
    const id = s.hotbar[i];
    ctx.save();
    rr(ctx, x, hy, slot, slot, 7);
    ctx.fillStyle = 'rgba(8,12,26,0.92)';
    ctx.fill();
    ctx.clip();
    if (id) {
      const def = SKILL_BY_ID[id];
      ctx.drawImage(skillIcon(id), x, hy, slot, slot);
      const usable = p.branches.has(def.branch);
      const cd = p.skillCd[id] ?? 0;
      if (!usable) {
        ctx.fillStyle = 'rgba(80,10,20,0.6)';
        ctx.fillRect(x, hy, slot, slot);
      }
      if (cd > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.moveTo(x + slot / 2, hy + slot / 2);
        ctx.arc(x + slot / 2, hy + slot / 2, slot * 0.72, -Math.PI / 2, -Math.PI / 2 + TAU * (cd / def.cd));
        ctx.closePath();
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, hy, slot, slot);
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(x + slot / 2, hy + slot / 2);
        ctx.arc(x + slot / 2, hy + slot / 2, slot * 0.72, -Math.PI / 2, -Math.PI / 2 + TAU * (cd / def.cd));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        text(ctx, cd.toFixed(cd < 10 ? 1 : 0), x + slot / 2, hy + slot / 2, 13, '#ffffff', 'center');
      } else if (p.mp < def.mp) {
        ctx.fillStyle = 'rgba(20,40,120,0.45)';
        ctx.fillRect(x, hy, slot, slot);
      }
      text(ctx, String(def.mp), x + slot - 4, hy + slot - 7, 9, '#9fd0ff', 'right', 600);
      if (cd <= 0 && usable && p.mp >= def.mp) {
        const sheen = ctx.createLinearGradient(x, hy, x, hy + slot);
        sheen.addColorStop(0, 'rgba(255,255,255,0.16)');
        sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
        ctx.fillStyle = sheen;
        ctx.fillRect(x, hy, slot, slot);
      }
    }
    ctx.restore();
    rr(ctx, x + 0.5, hy + 0.5, slot - 1, slot - 1, 7);
    ctx.strokeStyle = id ? rgba(BRANCH_INFO[SKILL_BY_ID[id].branch].color, 0.85) : 'rgba(150,190,240,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    keycap(ctx, String(i + 1), x - 3, hy - 1, 9);
  }
  // weapon set
  const { main, off } = activeSet(s);
  const wsx = hx - 182;
  panel(ctx, wsx, hy - 8, 166, slot + 16);
  text(ctx, `SET ${s.activeSet}`, wsx + 10, hy + 6, 11, '#7fe9ff');
  text(ctx, '[Q] swap', wsx + 156, hy + 6, 9, '#8a96aa', 'right', 600);
  text(ctx, main ? (main.customName ?? main.name) + (main.temper ? ` +${main.temper}` : '') : 'Unarmed', wsx + 10, hy + 24, 10, '#e6edf7', 'left', 600);
  text(ctx, off ? (off.customName ?? off.name) : '-', wsx + 10, hy + 38, 10, '#aab6c8', 'left', 600);
  // quick items
  const qx = hx + total + 16;
  panel(ctx, qx, hy - 8, 3 * 42 + 12, slot + 16);
  for (let i = 0; i < 3; i++) {
    const x = qx + 6 + i * 42;
    const id = s.quick[i];
    ctx.fillStyle = 'rgba(10,16,32,0.9)';
    ctx.fillRect(x, hy + 4, 38, 38);
    if (id) {
      ctx.drawImage(itemIconCanvas(id), x + 3, hy + 7, 32, 32);
      text(ctx, String(countItem(id)), x + 36, hy + 36, 10, countItem(id) ? '#ffffff' : '#ff6a6a', 'right');
    }
    ctx.strokeStyle = 'rgba(127,233,255,0.25)';
    ctx.strokeRect(x + 0.5, hy + 4.5, 37, 37);
    text(ctx, QUICK_KEYS[i], x + 5, hy + 11, 9, '#ffd166');
  }
  // switch gauge
  if (world.party.length) {
    const gw = total;
    const gy = hy - 22;
    const full = p.switchGauge >= 100;
    bar(ctx, hx, gy, gw, 6, p.switchGauge / 100, full ? '#7fe9ff' : '#3f8fc0');
    if (full) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 8);
      text(ctx, 'SWITCH READY  [R] / [TAB]', W / 2, gy - 10, 13, rgba('#7fe9ff', pulse), 'center');
    }
    if (p.chainT > 0) text(ctx, `SWITCH COMBO +35%  ${p.chainT.toFixed(1)}s`, W / 2, gy - 26, 12, '#bff3ff', 'center');
  }
  // interact prompt
  const near = world.nearest;
  if (near && !world.transition && !G.game.decorating) {
    ctx.font = `700 13px ${FONT}`;
    const tw = ctx.measureText(near.label).width + 58;
    panel(ctx, W / 2 - tw / 2, hy - 72, tw, 28);
    keycap(ctx, 'E', W / 2 - tw / 2 + 10, hy - 58, 11);
    text(ctx, near.label, W / 2 + 14, hy - 58, 13, '#ffe9b0', 'center');
  }
  drawV3Hud(ctx, W, H, t);
  // decorator overlay
  if (G.game.decorating) drawDecor(ctx, r, k);
  // fps
  if (G.settings.fps) text(ctx, `${Math.round(G.game.fps)} FPS${r.is3d && r.engine ? '   ' + r.engine.info() : ''}`, W - 14, H - 12, 11, '#7fe9ff', 'right');
  // transition fade
  const tr = world.transition;
  if (tr) {
    const a = tr.phase === 'out' ? Math.min(1, tr.t / 0.3) : Math.max(0, 1 - tr.t / 0.35);
    ctx.fillStyle = `rgba(3,5,12,${a.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawDecor(ctx: CanvasRenderingContext2D, r: RenderHost, k: number): void {
  const m = G.world.map;
  const sel = G.game.decorItem;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cell = (x0: number, y0: number, w: number, h: number): void => {
    const a = r.worldToScreen(x0, y0);
    const b = r.worldToScreen(x0 + w, y0);
    const c = r.worldToScreen(x0 + w, y0 + h);
    const d = r.worldToScreen(x0, y0 + h);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
  };
  ctx.strokeStyle = 'rgba(127,233,255,0.35)';
  ctx.lineWidth = 1;
  for (let y = 2; y < m.h - 1; y++) {
    for (let x = 1; x < m.w - 1; x++) {
      cell(x * TILE, y * TILE, TILE, TILE);
      ctx.stroke();
    }
  }
  const mw = G.game.mouseWorld();
  const tx = Math.floor(mw.x / TILE);
  const ty = Math.floor(mw.y / TILE);
  if (sel) {
    const d = itemDef(sel);
    if (d.furniture) {
      const fd = FURNITURE[d.furniture];
      const ok = canPlace(d.furniture, tx, ty);
      cell(tx * TILE, ty * TILE, fd.w * TILE, fd.h * TILE);
      ctx.fillStyle = ok ? 'rgba(94,230,160,0.35)' : 'rgba(255,77,94,0.35)';
      ctx.fill();
      ctx.strokeStyle = ok ? '#5ee6a0' : '#ff4d5e';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.setTransform(k, 0, 0, k, 0, 0);
  text(ctx, 'DECORATOR  -  Left click: place   Right click: pick up   B / Esc: exit', r.w / k / 2, 64, 13, '#7fe9ff', 'center');
}

