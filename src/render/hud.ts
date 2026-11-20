// Canvas HUD (drawn in a 720px-tall logical space).
import { drawPartyFrames, drawV3Hud } from './v3hud';
import type { Renderer } from './renderer';
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

const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, col: string, back = 'rgba(8,12,24,0.8)'): void {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, col);
  g.addColorStop(1, rgba('#000000', 0.25));
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.fillStyle = g;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(160,190,230,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
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

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(8,13,28,0.62)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(127,233,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawHud(ctx: CanvasRenderingContext2D, r: Renderer, t: number): void {
  const k = r.h / UI_H;
  const W = r.w / k;
  const H = UI_H;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const s = G.save;
  const p = G.player;
  const world = G.world;
  // ---------------------------------------------------------------- vitals
  panel(ctx, 12, 12, 290, 112);
  text(ctx, s.name, 24, 28, 15, '#ffffff');
  text(ctx, `Lv. ${s.level}`, 290, 28, 14, '#ffd166', 'right');
  bar(ctx, 24, 40, 266, 14, p.hp / p.stats.maxHp, p.hp < p.stats.maxHp * 0.3 ? '#ff4d5e' : '#4cd97b');
  if (p.barrier > 0) bar(ctx, 24, 40, 266, 4, p.barrier / p.stats.maxHp, '#c9a8ff', 'rgba(0,0,0,0)');
  text(ctx, `HP ${Math.ceil(p.hp)} / ${p.stats.maxHp}`, 30, 47, 10, '#ffffff', 'left', 600);
  bar(ctx, 24, 58, 266, 9, p.mp / p.stats.maxMp, '#4aa8ff');
  text(ctx, `MP ${Math.floor(p.mp)}`, 30, 63, 9, '#e6f2ff', 'left', 600);
  bar(ctx, 24, 70, 266, 6, p.sta / p.stats.maxSta, '#ffd166');
  const need = xpToNext(s.level);
  bar(ctx, 24, 80, 266, 4, s.xp / need, '#b48cff');
  text(ctx, `${s.gold.toLocaleString()} G`, 24, 96, 12, '#ffd166');
  text(ctx, `SP ${s.sp}`, 120, 96, 12, s.sp > 0 ? '#7fe9ff' : '#8a96aa');
  text(ctx, `XP ${Math.floor((s.xp / need) * 100)}%`, 290, 96, 11, '#c9b8ff', 'right', 600);
  // buffs & statuses
  let bx = 24;
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
    if (bx > 270) break;
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
    ctx.fillStyle = 'rgba(10,16,32,0.9)';
    ctx.fillRect(x, hy, slot, slot);
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
      text(ctx, String(def.mp), x + slot - 3, hy + slot - 7, 9, '#9fd0ff', 'right', 600);
    }
    ctx.strokeStyle = id ? rgba(BRANCH_INFO[SKILL_BY_ID[id].branch].color, 0.8) : 'rgba(127,233,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, hy + 0.5, slot - 1, slot - 1);
    text(ctx, String(i + 1), x + 5, hy + 8, 10, '#ffffff');
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
    const label = `[E]  ${near.label}`;
    ctx.font = `700 13px ${FONT}`;
    const tw = ctx.measureText(label).width + 28;
    panel(ctx, W / 2 - tw / 2, hy - 70, tw, 26);
    text(ctx, label, W / 2, hy - 57, 13, '#ffe9b0', 'center');
  }
  drawV3Hud(ctx, W, H, t);
  // decorator overlay
  if (G.game.decorating) drawDecor(ctx, r, k);
  // fps
  if (G.settings.fps) text(ctx, `${Math.round(G.game.fps)} FPS`, W - 14, H - 12, 11, '#7fe9ff', 'right');
  // transition fade
  const tr = world.transition;
  if (tr) {
    const a = tr.phase === 'out' ? Math.min(1, tr.t / 0.3) : Math.max(0, 1 - tr.t / 0.35);
    ctx.fillStyle = `rgba(3,5,12,${a.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawDecor(ctx: CanvasRenderingContext2D, r: Renderer, k: number): void {
  const m = G.world.map;
  const sel = G.game.decorItem;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const s = r.zoomScale;
  ctx.strokeStyle = 'rgba(127,233,255,0.35)';
  ctx.lineWidth = 1;
  for (let y = 2; y < m.h - 1; y++) {
    for (let x = 1; x < m.w - 1; x++) {
      const a = r.worldToScreen(x * TILE, y * TILE);
      ctx.strokeRect(a.x, a.y, TILE * s, TILE * s);
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
      const a = r.worldToScreen(tx * TILE, ty * TILE);
      ctx.fillStyle = ok ? 'rgba(94,230,160,0.35)' : 'rgba(255,77,94,0.35)';
      ctx.fillRect(a.x, a.y, fd.w * TILE * s, fd.h * TILE * s);
      ctx.strokeStyle = ok ? '#5ee6a0' : '#ff4d5e';
      ctx.lineWidth = 2;
      ctx.strokeRect(a.x, a.y, fd.w * TILE * s, fd.h * TILE * s);
    }
  }
  ctx.restore();
  ctx.setTransform(k, 0, 0, k, 0, 0);
  text(ctx, 'DECORATOR  -  Left click: place   Right click: pick up   B / Esc: exit', r.w / k / 2, 64, 13, '#7fe9ff', 'center');
}

