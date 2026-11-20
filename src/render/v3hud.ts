// v3 HUD layer (720px logical space): the D..SSS Style meter with its decay bar, the Skill Connect
// window, the Tactical Gambit bar, the second party frame, raid / event / duel trackers and the
// mount & pet indicators.
import { G } from '../core/state';
import { GAMBITS, GAMBIT_ORDER, AFFINITY_NAMES, affinityRank } from '../data/v3';
import { style } from '../systems/feel';
import { rgba, TAU } from '../engine/util';

const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, col: string, align: CanvasTextAlign = 'left', weight = 700): void {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(5,8,18,0.85)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = col;
  ctx.fillText(s, x, y);
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, border = 'rgba(127,233,255,0.25)'): void {
  ctx.fillStyle = 'rgba(8,12,26,0.72)';
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

export function drawPartyFrames(ctx: CanvasRenderingContext2D): void {
  const s = G.save;
  G.world.party.forEach((c, i) => {
    const y = 130 + i * 40;
    box(ctx, 12, y, 220, 34);
    const aff = affinityRank(s.affinity[c.def.id] ?? 0);
    txt(ctx, c.def.name, 22, y + 11, 11, '#7fe9ff');
    txt(ctx, c.dead ? `Knocked out (${Math.ceil(c.downT)}s)` : AFFINITY_NAMES[aff], 222, y + 11, 9, c.dead ? '#ff9aa6' : '#c9b8ff', 'right', 600);
    ctx.fillStyle = 'rgba(8,12,24,0.8)';
    ctx.fillRect(22, y + 20, 200, 7);
    ctx.fillStyle = '#4cd97b';
    ctx.fillRect(22, y + 20, 200 * (c.dead ? 0 : Math.max(0, c.hp / c.stats.maxHp)), 7);
  });
}

export function drawV3Hud(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
  const s = G.save;
  const p = G.player;
  const w = G.world;
  // ---- style meter (right side, under the bounty tracker area)
  if (G.settings.styleMeter && (style.pts > 0 || style.flash > 0)) {
    const def = style.def;
    const x = W - 150;
    const y = H - 250;
    const pop = style.flash > 0 ? 1 + style.flash * 0.6 : 1;
    ctx.save();
    ctx.translate(x + 60, y);
    ctx.scale(pop, pop);
    ctx.font = `900 italic ${def.rank.length > 1 ? 40 : 46}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(5,8,18,0.9)';
    ctx.strokeText(def.rank, 0, 0);
    const g = ctx.createLinearGradient(0, -22, 0, 22);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, def.color);
    ctx.fillStyle = g;
    ctx.fillText(def.rank, 0, 0);
    ctx.restore();
    txt(ctx, def.label, x + 60, y + 30, 10, def.color, 'center', 800);
    ctx.fillStyle = 'rgba(8,12,24,0.8)';
    ctx.fillRect(x + 4, y + 40, 112, 5);
    ctx.fillStyle = def.color;
    ctx.fillRect(x + 4, y + 40, 112 * style.progress, 5);
    if (style.lastGainT > 0) txt(ctx, style.lastGain, x + 60, y + 54, 10, rgba('#ffffff', Math.min(1, style.lastGainT)), 'center', 600);
    if (style.rank === 6) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 8);
      ctx.fillStyle = '#ff5df0';
      ctx.beginPath();
      ctx.arc(x + 60, y, 34, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // ---- skill connect window
  if (p.connectT > 0 || p.chain > 1) {
    const cx = W / 2;
    const cy = H - 150;
    if (p.connectT > 0) {
      ctx.strokeStyle = '#7fe9ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, -Math.PI / 2, -Math.PI / 2 + TAU * (p.connectT / 0.3));
      ctx.stroke();
      txt(ctx, 'CONNECT!', cx, cy + 28, 11, '#bff3ff', 'center', 800);
    }
    if (p.chain > 1) txt(ctx, `CHAIN x${p.chain}${p.chain >= 4 ? '  NOVA!' : ''}`, cx, cy - 26, 12, '#7fe9ff', 'center', 800);
  }
  if (p.riposteT > 0) txt(ctx, `RIPOSTE READY (${p.riposteT.toFixed(1)}s)`, W / 2, H - 182, 11, '#ffd166', 'center', 800);
  // ---- gambit bar (only with a party)
  if (w.party.length) {
    const gx = 14;
    const gy = 130 + w.party.length * 40 + 4;
    GAMBIT_ORDER.forEach((g, i) => {
      const on = s.gambit === g;
      box(ctx, gx + i * 56, gy, 52, 22, on ? GAMBITS[g].color : 'rgba(127,233,255,0.18)');
      txt(ctx, `${GAMBITS[g].key} ${GAMBITS[g].name.split(' ')[0]}`, gx + i * 56 + 26, gy + 11, 9, on ? GAMBITS[g].color : '#8a96aa', 'center', on ? 800 : 600);
    });
  }
  // ---- mount / pet
  let iy = H - 40;
  if (p.mounted) {
    txt(ctx, `Riding: ${p.mounted.name}  (attack = Charge Slam, V to dismount)`, 16, iy, 10, p.mounted.colors[2], 'left', 700);
    iy -= 14;
  }
  if (w.pet) txt(ctx, `Pet: ${w.pet.def.name}`, 16, iy, 10, w.pet.def.color, 'left', 700);
  // ---- trackers (event / raid / duel)
  let ty = 64;
  const ev = w.event;
  if (ev && !ev.done) {
    const label = ev.kind === 'outbreak' ? `EVENT: Seal the Corrupted Gate (wave ${ev.wave})` : `EVENT: Escort the caravan${ev.caravan?.waiting ? ' (waiting for you)' : ''}  ${ev.caravan ? Math.round((ev.caravan.hp / ev.caravan.stats.maxHp) * 100) : 0}% HP`;
    txt(ctx, label, W / 2, ty, 12, ev.kind === 'outbreak' ? '#c9a8ff' : '#ffd166', 'center', 800);
    ty += 16;
  }
  if (w.raid && w.vanguard.length) {
    txt(ctx, `ASSAULT TEAM: ${1 + w.party.length + w.vanguard.filter((v) => !v.dead).length} heroes standing`, W / 2, ty, 11, '#ffd27a', 'center', 800);
    ty += 16;
  }
  if (w.duel) txt(ctx, `DUEL vs ${w.duel.adv.advName}  -  ${Math.round((w.duel.adv.hp / w.duel.adv.stats.maxHp) * 100)}%`, W / 2, ty, 12, '#ff9a3d', 'center', 800);
}
