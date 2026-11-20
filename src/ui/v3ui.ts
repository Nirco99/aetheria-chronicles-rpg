// v3.0 Full-Dive interface: Constellation Skill Graph (K), Bestiary (O), Journal & Titles (N),
// Stable & Pets (P), Wardrobe & Dyes (T), Aether Relic Codex + Arcane Enchanter (U / Master Forge),
// Black Market, adventurer dialogs, tension-bar fishing and the Assault Team Raid Briefing.
import type { Branch, GearItem, MorphKind, PowerSlot } from '../types/game';
import type { Adventurer } from '../entities/allies';
import { G } from '../core/state';
import { h, btn, section, tip, gearCell, esc } from './dom';
import { audio } from '../engine/audio';
import { fx } from '../render/fx';
import { BRANCH_INFO, HOTBAR_SIZE, RARITY_COLORS, RARITY_NAMES } from '../data/constants';
import { SKILL_BY_ID, PASSIVE_BY_ID, skillsOfBranch, passivesOfBranch } from '../data/skills';
import {
  ACHIEVEMENTS, BRIDGES, BRIDGE_BY_ID, DYES, DYE_PRICE, FISH, GAMBITS, GAMBIT_ORDER, KEYSTONES, KEYSTONE_BY_ID, MORPHS, MORPH_RANK, MOUNTS, PETS,
  POWER_BY_ID, REACTIONS, SECTOR_ORDER, SKILL_MAX_RANK, AFFINITY_NAMES, AFFINITY_RANKS, affinityRank, extractable, morphName, skillRankCost, skillRankMastery,
} from '../data/v3';
import { MONSTERS } from '../data/monsters';
import { FRAMES } from '../data/framedata';
import { huntMasteryKills, huntMasteryMf, lootTable } from '../data/loot';
import { COMPANION_BY_ID } from '../data/guilds';
import { Monster } from '../entities/monster';
import { drawMonster } from '../render/monsters';
import { affixLabel, gearTitle, gearValue, itemDef, rollAffix } from '../data/items';
import { addItem, countItem, isEquipped, removeGear, removeItem } from '../systems/inventory';
import { unlockedTitles, checkAchievements } from '../systems/achievements';
import { blackMarketStock, buyBlackMarket } from '../systems/events';
import { REALMS } from '../data/realms';
import { clamp, pick, rnd, TAU } from '../engine/util';

const refreshPlayer = () => {
  G.player.refresh();
  for (const c of G.world.party) c.refresh();
};

// ================================================================== CONSTELLATION SKILL GRAPH

interface CNode {
  id: string;
  kind: 'core' | 'active' | 'passive' | 'keystone' | 'bridge';
  x: number;
  y: number;
  r: number;
  color: string;
  label: string;
  links: string[];
  branch?: Branch;
}

function buildGraph(): CNode[] {
  const nodes: CNode[] = [{ id: 'core', kind: 'core', x: 0, y: 0, r: 26, color: '#7fe9ff', label: 'Diver Core', links: [] }];
  SECTOR_ORDER.forEach((b, i) => {
    const th = -Math.PI / 2 + (i * Math.PI) / 3;
    const col = BRANCH_INFO[b].color;
    const acts = skillsOfBranch(b);
    acts.forEach((sk, k) => {
      const rad = 110 + k * 72;
      const off = (k % 2 ? 1 : -1) * 0.1;
      nodes.push({ id: sk.id, kind: 'active', x: Math.cos(th + off) * rad, y: Math.sin(th + off) * rad, r: 15, color: col, label: sk.name, branch: b, links: [k === 0 ? 'core' : acts[k - 1].id] });
    });
    passivesOfBranch(b).forEach((ps, k) => {
      const rad = 150 + k * 100;
      nodes.push({ id: ps.id, kind: 'passive', x: Math.cos(th + 0.32) * rad, y: Math.sin(th + 0.32) * rad, r: 10, color: col, label: ps.name, branch: b, links: [acts[Math.min(acts.length - 1, k * 2)].id] });
    });
    const ks = KEYSTONES.find((k) => k.branch === b);
    if (ks) nodes.push({ id: ks.id, kind: 'keystone', x: Math.cos(th) * 490, y: Math.sin(th) * 490, r: 21, color: col, label: ks.name, branch: b, links: [acts[acts.length - 1].id] });
  });
  for (const br of BRIDGES) {
    const ia = SECTOR_ORDER.indexOf(br.a);
    const th = -Math.PI / 2 + ((ia + 0.5) * Math.PI) / 3;
    const a3 = skillsOfBranch(br.a)[2]?.id;
    const b3 = skillsOfBranch(br.b)[2]?.id;
    nodes.push({ id: br.id, kind: 'bridge', x: Math.cos(th) * 300, y: Math.sin(th) * 300, r: 13, color: '#ffffff', label: br.name, links: [a3, b3].filter(Boolean) as string[] });
  }
  return nodes;
}

let cSel = 'core';
let cView = { x: 0, y: 0, z: 0.85 };

function nodeState(n: CNode): 'owned' | 'open' | 'locked' {
  const s = G.save;
  switch (n.kind) {
    case 'core':
      return 'owned';
    case 'active': {
      if (s.learned.includes(n.id)) return 'owned';
      const sk = SKILL_BY_ID[n.id];
      return s.mastery[sk.branch].rank >= sk.rank && s.sp >= sk.sp ? 'open' : 'locked';
    }
    case 'passive': {
      const ps = PASSIVE_BY_ID[n.id];
      if ((s.passives[n.id] ?? 0) > 0) return 'owned';
      return s.mastery[ps.branch].rank >= ps.rank && s.sp >= 1 ? 'open' : 'locked';
    }
    case 'keystone': {
      if (s.keystones.includes(n.id)) return 'owned';
      const k = KEYSTONE_BY_ID[n.id];
      return s.mastery[k.branch].rank >= k.rank && s.sp >= k.sp ? 'open' : 'locked';
    }
    case 'bridge': {
      if (s.bridges.includes(n.id)) return 'owned';
      const b = BRIDGE_BY_ID[n.id];
      return s.mastery[b.a].rank >= b.rank && s.mastery[b.b].rank >= b.rank && s.sp >= b.sp ? 'open' : 'locked';
    }
  }
}

export function openConstellation(): void {
  const nodes = buildGraph();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  G.ui.openPanel('constellation', 'Constellation Skill Graph', (b) => {
    const s = G.save;
    const wrap = h('div', { class: 'const-wrap' });
    const cv = h('canvas', { class: 'const-canvas' }) as HTMLCanvasElement;
    const side = h('div', { class: 'const-side' });
    wrap.append(cv, side);
    b.append(h('div', { class: 'sp-line' }, h('b', { text: `Skill Points: ${s.sp}` }), h('span', { class: 'dim', text: '  Drag to pan, scroll to zoom, click a star. Sword Skills rank 1-5; at rank 3 each one unlocks three Rune Morphs.' })), wrap);
    // ---- drawing
    const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
    let drag: { x: number; y: number; vx: number; vy: number; moved: boolean } | null = null;
    const toWorld = (px: number, py: number) => ({ x: (px - cv.width / 2) / cView.z + cView.x, y: (py - cv.height / 2) / cView.z + cView.y });
    const draw = (t: number) => {
      if (!cv.isConnected) return;
      const r = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) {
        cv.width = Math.max(10, Math.round(r.width * dpr));
        cv.height = Math.max(10, Math.round(r.height * dpr));
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const bg = ctx.createRadialGradient(cv.width / 2, cv.height / 2, 10, cv.width / 2, cv.height / 2, cv.width * 0.7);
      bg.addColorStop(0, '#0d1630');
      bg.addColorStop(1, '#03050c');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cv.width, cv.height);
      for (let i = 0; i < 140; i++) {
        const sx = (Math.sin(i * 91.7) * 0.5 + 0.5) * cv.width;
        const sy = (Math.sin(i * 47.3 + 2) * 0.5 + 0.5) * cv.height;
        ctx.fillStyle = `rgba(200,230,255,${0.15 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.002 + i))})`;
        ctx.fillRect(sx, sy, 1.4, 1.4);
      }
      ctx.setTransform(cView.z * dpr / dpr, 0, 0, cView.z, cv.width / 2 - cView.x * cView.z, cv.height / 2 - cView.y * cView.z);
      // sector wedges
      SECTOR_ORDER.forEach((br, i) => {
        const th = -Math.PI / 2 + (i * Math.PI) / 3;
        ctx.fillStyle = BRANCH_INFO[br].color + '10';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 540, th - Math.PI / 6, th + Math.PI / 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = BRANCH_INFO[br].color;
        ctx.font = '700 15px "Palatino Linotype", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${BRANCH_INFO[br].name}  (Rank ${s.mastery[br].rank})`, Math.cos(th) * 560, Math.sin(th) * 560);
      });
      // links
      for (const n of nodes) {
        for (const l of n.links) {
          const o = byId.get(l);
          if (!o) continue;
          const lit = nodeState(n) === 'owned' && nodeState(o) === 'owned';
          ctx.strokeStyle = lit ? n.color : 'rgba(150,170,210,0.22)';
          ctx.lineWidth = lit ? 2.4 : 1.2;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(o.x, o.y);
          ctx.stroke();
        }
      }
      // nodes
      for (const n of nodes) {
        const st = nodeState(n);
        const pulse = st === 'open' ? 0.5 + 0.5 * Math.sin(t * 0.006) : 0;
        ctx.save();
        ctx.translate(n.x, n.y);
        if (st !== 'locked') {
          const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, n.r * 2.6);
          gl.addColorStop(0, n.color + (st === 'owned' ? '88' : '44'));
          gl.addColorStop(1, n.color + '00');
          ctx.fillStyle = gl;
          ctx.beginPath();
          ctx.arc(0, 0, n.r * (2.6 + pulse * 0.4), 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = st === 'owned' ? n.color : st === 'open' ? '#1b2a4a' : '#0d1424';
        ctx.strokeStyle = st === 'locked' ? 'rgba(150,170,210,0.35)' : n.color;
        ctx.lineWidth = n.id === cSel ? 3.5 : 1.8;
        ctx.beginPath();
        if (n.kind === 'active' || n.kind === 'keystone') {
          const k = n.kind === 'keystone' ? 10 : 4;
          for (let i = 0; i < k; i++) {
            const a = (i / k) * TAU - Math.PI / 2;
            const rr = n.kind === 'keystone' ? (i % 2 ? n.r * 0.5 : n.r) : n.r;
            ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.closePath();
        } else if (n.kind === 'bridge') {
          for (let i = 0; i < 6; i++) ctx.lineTo(Math.cos((i / 6) * TAU) * n.r, Math.sin((i / 6) * TAU) * n.r);
          ctx.closePath();
        } else ctx.arc(0, 0, n.r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        if (n.id === cSel) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(0, 0, n.r + 7 + Math.sin(t * 0.008) * 2, 0, TAU);
          ctx.stroke();
        }
        if (n.kind === 'active') {
          const rank = s.skillRanks[n.id] ?? 0;
          if (s.learned.includes(n.id)) {
            ctx.fillStyle = '#05070d';
            ctx.font = '700 11px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(rank), 0, 1);
          }
          if (s.morphs[n.id] && rank >= MORPH_RANK) {
            ctx.fillStyle = MORPHS[s.morphs[n.id]].color;
            ctx.beginPath();
            ctx.arc(n.r * 0.9, -n.r * 0.9, 4, 0, TAU);
            ctx.fill();
          }
        }
        if (cView.z > 0.75 || n.id === cSel || n.kind === 'keystone') {
          ctx.fillStyle = st === 'locked' ? 'rgba(170,185,210,0.55)' : '#e6edf7';
          ctx.font = `${n.kind === 'keystone' ? 700 : 600} 11px Segoe UI, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(n.label, 0, n.r + 5);
        }
        ctx.restore();
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
    cv.addEventListener('mousedown', (e) => (drag = { x: e.clientX, y: e.clientY, vx: cView.x, vy: cView.y, moved: false }));
    window.addEventListener('mouseup', () => (drag = null), { once: false });
    cv.addEventListener('mousemove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      const dpr = window.devicePixelRatio || 1;
      cView.x = drag.vx - (dx * dpr) / cView.z;
      cView.y = drag.vy - (dy * dpr) / cView.z;
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      cView.z = clamp(cView.z * (e.deltaY > 0 ? 0.9 : 1.1), 0.4, 2.2);
    }, { passive: false });
    cv.addEventListener('click', (e) => {
      if (drag?.moved) return;
      const r = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = toWorld((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
      let best: CNode | null = null;
      let bd = 30;
      for (const n of nodes) {
        const d = Math.hypot(n.x - w.x, n.y - w.y) - n.r;
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      if (best) {
        cSel = best.id;
        audio.play('ui');
        fillSide(side, byId.get(cSel) as CNode);
      }
    });
    fillSide(side, byId.get(cSel) ?? nodes[0]);
  }, { wide: true, subtitle: 'K' });
}

function fillSide(side: HTMLElement, n: CNode): void {
  const s = G.save;
  side.innerHTML = '';
  const redo = () => {
    refreshPlayer();
    fillSide(side, n);
    const sp = document.querySelector('.const-wrap')?.previousElementSibling?.querySelector('b');
    if (sp) sp.textContent = `Skill Points: ${s.sp}`;
  };
  const spend = (cost: number): boolean => {
    if (s.sp < cost) {
      G.ui.toast('Not enough Skill Points.', 'warn');
      audio.play('error');
      return false;
    }
    s.sp -= cost;
    audio.play('levelup');
    return true;
  };
  if (n.kind === 'core') {
    side.append(h('div', { class: 'cs-title', text: 'Diver Core' }),
      h('p', { class: 'dim', text: 'Six constellations radiate from your core: one per weapon branch. Learn Sword Skills, raise them to rank 5, choose Rune Morphs, unlock passives, cross-branch Hybrid Bridges and the mighty Keystones.' }),
      h('div', { class: 'cs-stat', text: `Skill Points: ${s.sp}` }),
      h('div', { class: 'cs-stat', text: `Learned skills: ${s.learned.length} / 30` }),
      h('div', { class: 'cs-stat', text: `Keystones: ${s.keystones.length} / 6  -  Bridges: ${s.bridges.length} / 6` }));
    return;
  }
  if (n.kind === 'active') {
    const sk = SKILL_BY_ID[n.id];
    const learned = s.learned.includes(sk.id);
    const rank = s.skillRanks[sk.id] ?? (learned ? 1 : 0);
    const m = s.mastery[sk.branch].rank;
    side.append(h('div', { class: 'cs-title', style: `color:${sk.color}`, text: sk.name }),
      h('div', { class: 'cs-sub', text: `${BRANCH_INFO[sk.branch].name} - Sword Skill${learned ? `  -  Rank ${rank}/${SKILL_MAX_RANK}` : ''}` }),
      h('p', { text: sk.desc }),
      h('div', { class: 'cs-stat', text: `MP ${sk.mp}  -  Cooldown ${sk.cd}s  -  Unlocks at Mastery Rank ${sk.rank}` }));
    if (!learned) {
      side.append(btn(m < sk.rank ? `Requires ${BRANCH_INFO[sk.branch].name} Rank ${sk.rank}` : `Learn (${sk.sp} SP)`, () => {
        if (!spend(sk.sp)) return;
        s.learned.push(sk.id);
        s.skillRanks[sk.id] = 1;
        const free = s.hotbar.indexOf(null);
        if (free >= 0) s.hotbar[free] = sk.id;
        G.ui.toast(`Learned ${sk.name}!${free >= 0 ? ` Assigned to slot ${free + 1}.` : ''}`, 'mastery');
        redo();
      }, 'primary', m < sk.rank || s.sp < sk.sp));
      return;
    }
    if (rank < SKILL_MAX_RANK) {
      const need = skillRankMastery(sk.rank, rank);
      const cost = skillRankCost(rank);
      side.append(h('div', { class: 'cs-stat', text: `Next rank: +12% damage, -5% cooldown` }),
        btn(m < need ? `Rank ${rank + 1} needs Mastery Rank ${need}` : `Rank Up to ${rank + 1} (${cost} SP)`, () => {
          if (!spend(cost)) return;
          s.skillRanks[sk.id] = rank + 1;
          G.ui.toast(`${sk.name} reached rank ${rank + 1}!${rank + 1 === MORPH_RANK ? ' Rune Morphs unlocked!' : ''}`, 'mastery');
          redo();
        }, 'primary', m < need || s.sp < cost));
    } else side.append(h('div', { class: 'cs-stat gold', text: 'MAX RANK' }));
    const morphBox = h('div', { class: 'morphs' });
    for (const k of ['power', 'clone', 'leech'] as MorphKind[]) {
      const on = s.morphs[sk.id] === k;
      const locked = rank < MORPH_RANK;
      morphBox.append(h('button', {
        class: 'morph' + (on ? ' on' : '') + (locked ? ' locked' : ''), style: `--mc:${MORPHS[k].color}`, disabled: locked,
        onclick: () => {
          s.morphs[sk.id] = k;
          audio.play('chime');
          redo();
        },
      }, h('b', { text: morphName(sk.id, k) }), h('small', { text: MORPHS[k].desc })));
    }
    side.append(h('div', { class: 'cs-sub', text: rank < MORPH_RANK ? `Rune Morphs (unlock at skill rank ${MORPH_RANK})` : 'Rune Morph (exclusive - pick one)' }), morphBox);
    const slots = h('div', { class: 'row' }, h('span', { class: 'dim', text: 'Hotbar:' }), ...Array.from({ length: HOTBAR_SIZE }, (_, i) => h('button', {
      class: 'chip' + (s.hotbar[i] === sk.id ? ' on' : ''), text: String(i + 1), onclick: () => {
        for (let j = 0; j < HOTBAR_SIZE; j++) if (s.hotbar[j] === sk.id) s.hotbar[j] = null;
        s.hotbar[i] = sk.id;
        redo();
      },
    })));
    side.append(slots);
    return;
  }
  if (n.kind === 'passive') {
    const ps = PASSIVE_BY_ID[n.id];
    const lvl = s.passives[ps.id] ?? 0;
    const can = lvl < ps.max && s.mastery[ps.branch].rank >= ps.rank && s.sp >= 1;
    side.append(h('div', { class: 'cs-title', text: ps.name }), h('div', { class: 'cs-sub', text: `Passive - Level ${lvl}/${ps.max} - Rank ${ps.rank}` }), h('p', { text: ps.desc }),
      btn(lvl >= ps.max ? 'Mastered' : `Train (1 SP)`, () => {
        if (!spend(1)) return;
        s.passives[ps.id] = lvl + 1;
        redo();
      }, 'primary', !can));
    return;
  }
  if (n.kind === 'keystone') {
    const k = KEYSTONE_BY_ID[n.id];
    const own = s.keystones.includes(k.id);
    side.append(h('div', { class: 'cs-title gold', text: k.name }), h('div', { class: 'cs-sub', text: `Keystone - ${BRANCH_INFO[k.branch].name} Rank ${k.rank}` }), h('p', { text: k.desc }),
      own ? h('div', { class: 'cs-stat gold', text: 'UNLOCKED' }) : btn(`Unlock Keystone (${k.sp} SP)`, () => {
        if (!spend(k.sp)) return;
        s.keystones.push(k.id);
        fx.banner('KEYSTONE UNLOCKED', '#ffd166', k.name, 44, 1.6);
        redo();
      }, 'gold', nodeState(n) !== 'open'));
    return;
  }
  const br = BRIDGE_BY_ID[n.id];
  const own = s.bridges.includes(br.id);
  side.append(h('div', { class: 'cs-title', text: br.name }), h('div', { class: 'cs-sub', text: `Hybrid Bridge - ${BRANCH_INFO[br.a].name} + ${BRANCH_INFO[br.b].name} (Rank ${br.rank} in both)` }), h('p', { text: br.desc }),
    own ? h('div', { class: 'cs-stat gold', text: 'UNLOCKED' }) : btn(`Link Bridge (${br.sp} SP)`, () => {
      if (!spend(br.sp)) return;
      s.bridges.push(br.id);
      redo();
    }, 'primary', nodeState(n) !== 'open'));
}

// ================================================================== BESTIARY

let bestSel: string | null = null;

export function openBestiary(): void {
  G.ui.openPanel('bestiary', 'Bestiary', (b) => {
    const s = G.save;
    const all = Object.values(MONSTERS).filter((m) => m.id !== 'ev_gate');
    const seen = all.filter((m) => (s.bestiary[m.id] ?? 0) > 0);
    const list = h('div', { class: 'best-list scroll' });
    const sorted = [...all].sort((a, b) => a.realm - b.realm || Number(!!a.boss) - Number(!!b.boss));
    for (const m of sorted) {
      const known = (s.bestiary[m.id] ?? 0) > 0;
      list.append(h('div', { class: 'best-row' + (bestSel === m.id ? ' on' : '') + (known ? '' : ' unknown'), onclick: () => { bestSel = m.id; G.ui.refresh(); } },
        h('b', { text: known ? m.name : '???' }), h('small', { text: `${m.boss ? 'Boss' : m.elite ? 'Elite' : 'Monster'} - ${m.realm >= 0 ? REALMS[Math.max(0, m.realm)].short : 'Roaming'}${known ? `  -  ${s.bestiary[m.id]} slain` : ''}` })));
    }
    const detail = h('div', { class: 'best-detail' });
    const def = bestSel ? MONSTERS[bestSel] : seen[0];
    if (def && (s.bestiary[def.id] ?? 0) > 0) {
      const cv = h('canvas', { class: 'best-canvas' }) as HTMLCanvasElement;
      cv.width = 300;
      cv.height = 240;
      const mon = new Monster(def, Math.max(1, s.level), 0, 0, []);
      mon.spawnT = 0;
      const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
      const draw = (t: number) => {
        if (!cv.isConnected) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const g = ctx.createRadialGradient(150, 170, 10, 150, 150, 170);
        g.addColorStop(0, '#1d2b4a');
        g.addColorStop(1, '#060a14');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 300, 240);
        ctx.fillStyle = 'rgba(127,233,255,0.12)';
        ctx.beginPath();
        ctx.ellipse(150, 186, 90, 26, 0, 0, TAU);
        ctx.fill();
        const sc = Math.min(2.4, 70 / Math.max(10, mon.height()));
        ctx.setTransform(sc * 1.6, 0, 0, sc * 1.6, 150, 186);
        mon.anim.t = t / 1000;
        mon.dir = (Math.floor(t / 2500) % 4) as 0 | 1 | 2 | 3;
        mon.aim = [Math.PI / 2, -Math.PI / 2, Math.PI, 0][mon.dir];
        drawMonster(ctx, mon, t / 1000);
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
      const els = (xs?: string[]) => (xs && xs.length ? xs.map((e) => e[0].toUpperCase() + e.slice(1)).join(', ') : 'none');
      const kills = s.bestiary[def.id] ?? 0;
      const need = huntMasteryKills(def);
      const lines = lootTable(def, { level: Math.max(1, s.level), floor: 0, mf: (G.player?.stats.magicFind ?? 0) + huntMasteryMf(def, kills) });
      const pct = (p: number) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
      detail.append(cv,
        h('div', { class: 'cs-title', text: def.name }),
        h('div', { class: 'cs-sub', text: `${def.title ?? (def.boss ? 'Boss' : def.elite ? 'Night Elite' : 'Monster')}` }),
        h('div', { class: 'cs-stat', text: `Slain: ${kills}  -  Element: ${def.element ?? 'none'}` }),
        h('div', { class: 'cs-stat', text: `Weak to: ${els(def.weak)} (x${FRAMES.weakMult})  -  Resists: ${els(def.resist)} (x${FRAMES.resistMult})` }),
        h('div', { class: 'cs-stat' + (kills >= need ? ' gold' : ''), text: kills >= need ? 'Hunting Mastery: +10% Magic Find against this species' : `Hunting Mastery: ${kills} / ${need} slain (+10% Magic Find once mastered)` }),
        h('div', { class: 'cs-stat', text: `Attacks: ${def.attacks.map((a) => a.name ?? a.id).join(', ')}` }),
        h('div', { class: 'cs-stat', text: `Drops: ${lines.filter((l) => l.kind === 'item' && l.own && l.item).map((l) => `${itemDef(l.item as string).name} ${pct(l.chance)}`).join(', ') || '-'}` }));
    } else detail.append(h('p', { class: 'dim pad', text: 'Defeat a creature to record it here. Every entry shows a live 3D-oblique model, its attacks, weaknesses and drops.' }));
    b.append(h('div', { class: 'sp-line', text: `Recorded: ${seen.length} / ${all.length}` }), h('div', { class: 'best-wrap' }, list, detail));
  }, { wide: true, subtitle: 'O' });
}

// ================================================================== JOURNAL: ACHIEVEMENTS & TITLES

export function openJournal(): void {
  G.ui.openPanel('journal', 'Journal: Achievements & Titles', (b) => {
    const s = G.save;
    checkAchievements(true);
    const titles = unlockedTitles();
    b.append(section('Active title',
      h('div', { class: 'chips' },
        h('button', { class: 'chip' + (!s.title ? ' on' : ''), text: 'No title', onclick: () => { s.title = null; G.ui.refresh(); } }),
        ...titles.map((t) => h('button', { class: 'chip' + (s.title === t ? ' on' : ''), text: t, onclick: () => { s.title = t; audio.play('chime'); G.ui.refresh(); } })))));
    const cats: [string, string][] = [['combat', 'Combat'], ['legend', 'Legends'], ['craft', 'Crafting & Items'], ['social', 'Party & Social'], ['world', 'World']];
    for (const [cat, name] of cats) {
      const list = ACHIEVEMENTS.filter((a) => a.cat === cat);
      const done = list.filter((a) => s.achievements.includes(a.id)).length;
      b.append(section(`${name}  (${done}/${list.length})`, h('div', { class: 'ach-grid' }, ...list.map((a) => {
        const got = s.achievements.includes(a.id);
        return h('div', { class: 'ach' + (got ? ' got' : '') }, h('b', { text: (got ? '★ ' : '☆ ') + a.name }), h('small', { text: a.desc }), a.title ? h('small', { class: 'gold', text: `Title: ${a.title}` }) : null);
      }))));
    }
    const seen = new Set(s.reactionsSeen);
    b.append(section('Elemental reactions discovered', h('div', { class: 'ach-grid' }, ...REACTIONS.map((r) => h('div', { class: 'ach' + (seen.has(r.id) ? ' got' : '') }, h('b', { style: `color:${r.color}`, text: r.name }), h('small', { text: r.desc }))))));
    b.append(section('Tactical Gambits & party', h('div', { class: 'chips' }, ...GAMBIT_ORDER.map((g) => h('button', {
      class: 'chip' + (s.gambit === g ? ' on' : ''), text: `${GAMBITS[g].key} ${GAMBITS[g].name}`, onclick: () => { s.gambit = g; G.ui.refresh(); },
    }))), h('p', { class: 'dim', text: GAMBITS[s.gambit].desc }),
    ...s.party.map((id) => {
      const v = s.affinity[id] ?? 0;
      const r = affinityRank(v);
      const next = AFFINITY_RANKS[r + 1];
      return h('div', { class: 'cs-stat', text: `${COMPANION_BY_ID[id]?.name ?? id}: ${AFFINITY_NAMES[r]} (affinity ${v}${next ? ` / ${next}` : ''}) - +${r * 3}% stats` });
    })));
  }, { wide: true, subtitle: 'N' });
}

// ================================================================== STABLE & PETS

export function openStable(): void {
  G.ui.openPanel('stable', 'Stable & Pet Sanctuary', (b) => {
    const s = G.save;
    const inCity = G.world.map.kind === 'city';
    b.append(h('p', { class: 'dim', text: inCity ? 'Buy and choose your mount (ride with V: +65% speed, attack to Charge Slam) and an elemental combat pet that loots for you and fires support bolts.' : 'You can choose your active mount and pet anywhere. New mounts and pets are sold in any city.' }));
    b.append(section('Mounts', h('div', { class: 'shop-grid' }, ...MOUNTS.map((m) => {
      const own = s.mounts.includes(m.id);
      const active = s.mount === m.id;
      return h('div', { class: 'shop-card' + (active ? ' on' : '') },
        h('div', { class: 'swatch', style: `background:linear-gradient(135deg,${m.colors[0]},${m.colors[1]});box-shadow:0 0 12px ${m.colors[2]}` }),
        h('b', { text: m.name }), h('small', { class: 'dim', text: m.desc }), h('small', { text: `Requires level ${m.req}` }),
        own ? btn(active ? 'Active' : 'Set active', () => { s.mount = m.id; audio.play('ui'); G.ui.refresh(); }, active ? 'gold mini-btn' : 'mini-btn', active)
          : btn(`Buy ${m.price.toLocaleString()} G`, () => {
            if (s.gold < m.price) return G.ui.toast('Not enough gold.', 'warn');
            s.gold -= m.price;
            s.mounts.push(m.id);
            s.mount = m.id;
            audio.play('coin');
            G.ui.toast(`${m.name} is yours! Press V to ride.`, 'loot');
            checkAchievements(true);
            G.ui.refresh();
          }, 'primary mini-btn', !inCity || s.level < m.req));
    }))));
    b.append(section('Combat pets', h('div', { class: 'shop-grid' }, ...PETS.map((p) => {
      const own = s.pets.includes(p.id);
      const active = s.pet === p.id;
      return h('div', { class: 'shop-card' + (active ? ' on' : '') },
        h('div', { class: 'swatch round', style: `background:radial-gradient(circle,${p.color2},${p.color});box-shadow:0 0 14px ${p.color}` }),
        h('b', { text: p.name }), h('small', { class: 'dim', text: p.desc }), h('small', { text: `Requires level ${p.req}` }),
        own ? btn(active ? 'Dismiss' : 'Summon', () => { G.world.setPet(active ? null : p.id); audio.play('ui'); G.ui.refresh(); }, 'mini-btn')
          : btn(`Adopt ${p.price.toLocaleString()} G`, () => {
            if (s.gold < p.price) return G.ui.toast('Not enough gold.', 'warn');
            s.gold -= p.price;
            s.pets.push(p.id);
            G.world.setPet(p.id);
            audio.play('coin');
            checkAchievements(true);
            G.ui.refresh();
          }, 'primary mini-btn', !inCity || s.level < p.req));
    }))));
  }, { wide: true, subtitle: `P  -  ${G.save.gold.toLocaleString()} G` });
}

// ================================================================== WARDROBE (TRANSMOG & DYES)

type LookSlot = 'mainA' | 'head' | 'chest' | 'boots' | 'cloak';
let wardSlot: LookSlot = 'chest';

function slotMatches(slot: LookSlot, baseId: string): boolean {
  if (slot === 'mainA') return baseId.startsWith('w_');
  const map: Record<string, string[]> = { head: ['a_helm', 'a_hood', 'a_circlet'], chest: ['a_brig', 'a_coat', 'a_plate', 'a_robe'], boots: ['a_boots'], cloak: ['a_cloak'] };
  return map[slot]?.includes(baseId) ?? false;
}

export function openWardrobe(): void {
  G.ui.openPanel('wardrobe', 'Cosmetic Wardrobe', (b) => {
    const s = G.save;
    const slots: [LookSlot, string][] = [['mainA', 'Weapon'], ['head', 'Head'], ['chest', 'Chest'], ['boots', 'Boots'], ['cloak', 'Cloak']];
    b.append(h('p', { class: 'dim', text: 'Every look you have ever owned is saved here. Transmog changes appearance only - your stats never change. Dyes recolor your armor for 150 G each.' }));
    b.append(h('div', { class: 'chips' }, ...slots.map(([id, label]) => h('button', { class: 'chip' + (wardSlot === id ? ' on' : ''), text: label + (s.transmog[id] ? ' *' : ''), onclick: () => { wardSlot = id; G.ui.refresh(); } }))));
    const looks = s.wardrobe.filter((k) => slotMatches(wardSlot, k.split('|')[0]));
    const grid = h('div', { class: 'ward-grid scroll' });
    grid.append(h('button', { class: 'ward' + (!s.transmog[wardSlot] ? ' on' : ''), onclick: () => { delete s.transmog[wardSlot]; refreshPlayer(); G.ui.refresh(); } }, h('b', { text: 'Show equipped gear' })));
    for (const key of looks) {
      const [baseId, style, tier, main, accent, trim] = key.split('|');
      grid.append(h('button', { class: 'ward' + (s.transmog[wardSlot] === key ? ' on' : ''), onclick: () => { s.transmog[wardSlot] = key; audio.play('ui'); refreshPlayer(); G.ui.refresh(); } },
        h('div', { class: 'swatches' }, h('i', { style: `background:${main}` }), h('i', { style: `background:${accent}` }), h('i', { style: `background:${trim}` })),
        h('small', { text: `${baseId.replace(/^[wa]_/, '')} - style ${style} - tier ${Number(tier) + 1}` })));
    }
    b.append(section(`Saved looks (${looks.length})`, grid));
    const dyeRow = (which: 'main' | 'accent', label: string) => h('div', { class: 'row' }, h('span', { class: 'dim', text: label }),
      h('button', { class: 'dye' + (!s.dyes[which] ? ' on' : ''), text: 'None', onclick: () => { s.dyes[which] = null; refreshPlayer(); G.ui.refresh(); } }),
      ...DYES.map((d) => h('button', {
        class: 'dye' + (s.dyes[which] === d.color ? ' on' : ''), title: `${d.name} (${DYE_PRICE} G)`, style: `background:${d.color}`, onclick: () => {
          if (s.dyes[which] === d.color) return;
          if (s.gold < DYE_PRICE) return G.ui.toast('Not enough gold.', 'warn');
          s.gold -= DYE_PRICE;
          s.dyes[which] = d.color;
          audio.play('coin');
          refreshPlayer();
          G.ui.refresh();
        },
      })));
    b.append(section('Dyes', dyeRow('main', 'Primary'), dyeRow('accent', 'Secondary')));
  }, { wide: true, subtitle: 'T' });
}

// ================================================================== RELIC CODEX & ARCANE ENCHANTER

let codexSel: string | null = null;

export function codexPane(b: HTMLElement, atForge: boolean): void {
  const s = G.save;
  b.append(h('p', { class: 'dim', text: 'Extract the golden power of a Legendary / Mythic item or a unique weapon into the Aether Relic Codex (the item is consumed). Then equip up to three relic powers - weapon, armor and utility - on top of your gear.' }));
  const slots: [PowerSlot, string][] = [['weapon', 'Weapon relic'], ['armor', 'Armor relic'], ['utility', 'Utility relic']];
  b.append(h('div', { class: 'relic-slots' }, ...slots.map(([slot, label]) => {
    const id = s.relics[slot];
    const p = id ? POWER_BY_ID[id] : null;
    return h('div', { class: 'relic' + (p ? ' on' : ''), style: p ? `--pc:${p.color}` : '' }, h('small', { text: label }), h('b', { text: p ? p.name : 'Empty' }), p ? h('small', { class: 'dim', text: p.desc }) : null,
      p ? btn('Unequip', () => { s.relics[slot] = null; refreshPlayer(); G.ui.refresh(); }, 'mini-btn ghost') : null);
  })));
  const known = s.codex.map((id) => POWER_BY_ID[id]).filter(Boolean);
  b.append(section(`Codex (${known.length} powers)`, known.length ? h('div', { class: 'codex-grid' }, ...known.map((p) => {
    const eq = s.relics[p.slot] === p.id;
    return h('div', { class: 'codex' + (eq ? ' on' : ''), style: `--pc:${p.color}` }, h('b', { text: p.name }), h('small', { text: `${p.slot} - ${p.desc}` }),
      btn(eq ? 'Equipped' : 'Equip', () => { s.relics[p.slot] = p.id; audio.play('chime'); refreshPlayer(); checkAchievements(true); G.ui.refresh(); }, 'mini-btn', eq));
  })) : h('p', { class: 'dim', text: 'No powers extracted yet.' })));
  if (!atForge) {
    b.append(h('p', { class: 'dim', text: 'Visit any Master Forge to extract new powers.' }));
    return;
  }
  const cands = s.gear.filter((g) => g.power && extractable(g.power) && !isEquipped(g.uid));
  b.append(section('Extract a power', cands.length ? h('div', { class: 'grid scroll small' }, ...cands.map((g) => gearCell(g, () => { codexSel = g.uid; G.ui.refresh(); }, { selected: codexSel === g.uid, compare: false })))
    : h('p', { class: 'dim', text: 'Unequipped Legendary, Mythic or unique items with a golden power appear here.' })));
  const g = cands.find((x) => x.uid === codexSel);
  if (g && g.power) {
    const p = POWER_BY_ID[g.power];
    const have = s.codex.includes(p.id);
    const cost = 400 + g.tier * 300;
    b.append(h('div', { class: 'row' }, h('span', { text: `${gearTitle(g)} -> ${p.name} (${p.slot})` }),
      btn(have ? 'Already in Codex' : `Extract (${cost} G + 2 Arcane Dust)`, () => {
        if (s.gold < cost) return G.ui.toast('Not enough gold.', 'warn');
        if (countItem('arcane_dust') < 2) return G.ui.toast('You need 2 Arcane Dust (salvage gear to get some).', 'warn');
        s.gold -= cost;
        removeItem('arcane_dust', 2);
        removeGear(g.uid);
        s.codex.push(p.id);
        s.counters.extracted++;
        codexSel = null;
        fx.banner('POWER EXTRACTED', p.color, p.name, 40, 1.4);
        audio.play('awaken', 0.6);
        checkAchievements(true);
        G.ui.refresh();
      }, 'gold', have)));
  }
}

let enchSel: string | null = null;

export function enchantPane(b: HTMLElement): void {
  const s = G.save;
  b.append(h('p', { class: 'dim', text: 'The Arcane Enchanter rerolls one affix of a Rare or better item. Cost scales with tier and rarity.' }));
  const cands = [...Object.values(s.equip).filter(Boolean) as GearItem[], ...s.gear].filter((g) => (g.affixes?.length ?? 0) > 0);
  b.append(h('div', { class: 'grid scroll small' }, ...cands.map((g) => gearCell(g, () => { enchSel = g.uid; G.ui.refresh(); }, { selected: enchSel === g.uid, equipped: isEquipped(g.uid), compare: false }))));
  const g = cands.find((x) => x.uid === enchSel);
  if (!g) return;
  const cost = Math.round(150 + g.tier * 160 * (1 + g.rarity * 0.4));
  b.append(section(`${gearTitle(g)} - affixes`, ...(g.affixes ?? []).map((a, i) => h('div', { class: 'row' }, h('span', { class: 'tt-affix', text: `✦ ${affixLabel(a)}` }),
    btn(`Reroll (${cost} G + 1 Arcane Dust)`, () => {
      if (s.gold < cost) return G.ui.toast('Not enough gold.', 'warn');
      if (countItem('arcane_dust') < 1) return G.ui.toast('You need Arcane Dust (salvage gear to get some).', 'warn');
      s.gold -= cost;
      removeItem('arcane_dust', 1);
      const others = (g.affixes ?? []).filter((_, j) => j !== i).map((x) => x.kind);
      const nx = rollAffix(g.kind, g.tier, others);
      (g.affixes as NonNullable<GearItem['affixes']>)[i] = nx;
      fx.burst(G.player.x, G.player.y - 30, '#c18cff', 16, 120);
      audio.play('magic');
      G.ui.toast(`New affix: ${affixLabel(nx)}`, 'loot');
      refreshPlayer();
      G.ui.refresh();
    }, 'mini-btn')))));
}

export function openCodex(atForge: boolean): void {
  G.ui.openPanel('codex', 'Aether Relic Codex', (b) => codexPane(b, atForge), { wide: true, subtitle: atForge ? 'Master Forge' : 'U' });
}

// ================================================================== BLACK MARKET

export function openBlackMarket(): void {
  G.ui.openPanel('blackmarket', 'Black Market', (b) => {
    const s = G.save;
    if (!s.blackMarket) {
      b.append(h('p', { class: 'dim pad', text: 'The hooded broker ignores you. Escort a merchant caravan through the wilds to earn an introduction.' }));
      return;
    }
    b.append(h('p', { class: 'dim', text: 'Rare goods, no questions asked. Stock rotates every in-game day.' }));
    b.append(h('div', { class: 'shop-grid' }, ...blackMarketStock().map((o) => h('div', { class: 'shop-card' },
      o.gear ? gearCell(o.gear) : h('img', { src: '', style: 'display:none' }),
      h('b', { style: o.gear ? `color:${RARITY_COLORS[o.gear.rarity]}` : '', text: o.label }),
      o.item ? h('small', { class: 'dim', text: itemDef(o.item).desc }) : h('small', { class: 'dim', text: `${RARITY_NAMES[o.gear?.rarity ?? 0]} - value ${o.gear ? gearValue(o.gear).toLocaleString() : 0} G` }),
      btn(`${o.price.toLocaleString()} G`, () => {
        const e = buyBlackMarket(o);
        if (e) G.ui.toast(e, 'warn');
        else G.ui.toast(`Purchased ${o.label}.`, 'loot');
        G.ui.refresh();
      }, 'gold mini-btn', s.gold < o.price)))));
  }, { wide: true, subtitle: `${G.save.gold.toLocaleString()} G` });
}

// ================================================================== ADVENTURER DIALOG

export function openAdventurer(a: Adventurer): void {
  const s = G.save;
  const rep = s.adventurerRep[a.advName] ?? 0;
  const offerMat = pick(REALMS[G.world.map.realm].ores);
  const wantMat = pick(['wolf_pelt', 'treant_bark', 'drake_scale', 'wyvern_scale', 'automaton_gear', 'venom_sac'].filter((id) => countItem(id) > 0)) as string | undefined;
  const rareOffer = pick(['relic_shard', 'enh_greater', 'gem_flame', 'gem_frost', 'gem_lightning', 'gem_wind', 'gem_void', 'treasure_map']);
  G.ui.modal((box, close) => {
    box.append(h('div', { class: 'modal-title', text: `${a.advName}` }), h('div', { class: 'cs-sub', text: `Adventurer - Lv.${a.level} ${BRANCH_INFO[a.kitBranch].name} - Reputation ${rep}` }),
      h('p', { class: 'modal-text', text: pick(['Need something, Diver?', 'Oh, hello there! Out hunting too?', 'Fancy a trade? Or maybe a friendly spar?', 'Careful out here - the monsters hit harder at night.']) }));
    const price = 600 + a.level * 40;
    box.append(section('Trade',
      h('div', { class: 'row' }, h('span', { text: `Buy their ${itemDef(rareOffer).name} for ${price} G` }), btn('Buy', () => {
        if (s.gold < price) return G.ui.toast('Not enough gold.', 'warn');
        s.gold -= price;
        addItem(rareOffer, 1);
        s.counters.trades++;
        s.adventurerRep[a.advName] = rep + 5;
        audio.play('coin');
        checkAchievements(true);
        close();
      }, 'mini-btn')),
      wantMat ? h('div', { class: 'row' }, h('span', { text: `Swap 3 ${itemDef(wantMat).name} for 4 ${itemDef(offerMat).name}` }), btn('Swap', () => {
        if (!removeItem(wantMat, 3)) return G.ui.toast(`You need 3 ${itemDef(wantMat).name}.`, 'warn');
        addItem(offerMat, 4);
        s.counters.trades++;
        audio.play('pickup');
        checkAchievements(true);
        close();
      }, 'mini-btn')) : null));
    box.append(h('div', { class: 'row end' },
      btn('Friendly Duel', () => { close(); G.world.startDuel(a); }, 'danger'),
      btn('Goodbye', close, 'ghost')));
  });
}

// ================================================================== FISHING (tension bar)

export function openFishing(spot: number): void {
  const w = G.world;
  const f = w.map.fishSpots[spot];
  if (!f) return;
  const realm = w.map.realm;
  const pool = FISH.filter((x) => x.realm === realm);
  const roll = Math.random();
  const fish = roll < 0.06 ? pool[pool.length - 1] : roll < 0.3 ? pool[Math.min(pool.length - 1, 1)] : pool[0];
  if (!fish) return;
  G.ui.modal((box, close) => {
    const cv = h('canvas', { class: 'fish-canvas' }) as HTMLCanvasElement;
    cv.width = 120;
    cv.height = 300;
    const info = h('div', { class: 'cs-sub', text: 'Hold SPACE or the mouse button to lift the catch zone. Keep the fish inside it until the bar fills.' });
    box.append(h('div', { class: 'modal-title', text: 'Fishing' }), h('div', { class: 'fish-wrap' }, cv, info));
    const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
    let zone = 120;
    let zv = 0;
    let fishY = 150;
    let fishV = 0;
    let target = 150;
    let prog = 0.25;
    let held = false;
    let last = performance.now();
    let done = false;
    const zh = 70 - fish.diff * 25;
    const down = (e: Event) => { held = true; e.preventDefault(); };
    const up = () => (held = false);
    const kd = (e: KeyboardEvent) => { if (e.code === 'Space') { held = true; e.preventDefault(); e.stopPropagation(); } };
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') held = false; };
    cv.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);
    window.addEventListener('keydown', kd, true);
    window.addEventListener('keyup', ku, true);
    const cleanup = () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('keydown', kd, true);
      window.removeEventListener('keyup', ku, true);
    };
    const end = (win: boolean) => {
      if (done) return;
      done = true;
      cleanup();
      close();
      const s = G.save;
      if (win) {
        addItem(fish.id, 1);
        s.fish[fish.id] = (s.fish[fish.id] ?? 0) + 1;
        s.counters.fishCaught++;
        fx.number(G.player.x, G.player.y - 50, `Caught: ${fish.name}!`, RARITY_COLORS[fish.rarity], 15);
        if (fish.rarity >= 2) audio.chord(fish.rarity);
        else audio.play('splash');
        checkAchievements(true);
      } else {
        G.ui.toast(`The ${fish.name} got away...`, 'info');
        audio.play('splash', 0.6);
      }
    };
    const loop = (now: number) => {
      if (done || !cv.isConnected) {
        cleanup();
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      zv += (held ? -900 : 700) * dt;
      zv *= 0.9;
      zone = clamp(zone + zv * dt, 0, 300 - zh);
      if (zone <= 0 || zone >= 300 - zh) zv = 0;
      if (Math.random() < dt * (0.6 + fish.diff * 2.4)) target = rnd(10, 290);
      fishV += (target - fishY) * dt * (2 + fish.diff * 6);
      fishV *= 0.92;
      fishY = clamp(fishY + fishV * dt, 8, 292);
      const inside = fishY >= zone && fishY <= zone + zh;
      prog = clamp(prog + (inside ? 0.28 : -0.2 - fish.diff * 0.1) * dt, 0, 1);
      ctx.fillStyle = '#071226';
      ctx.fillRect(0, 0, 120, 300);
      ctx.fillStyle = 'rgba(94,230,160,0.35)';
      ctx.fillRect(18, zone, 46, zh);
      ctx.strokeStyle = '#5ee6a0';
      ctx.strokeRect(18, zone, 46, zh);
      ctx.fillStyle = RARITY_COLORS[fish.rarity];
      ctx.beginPath();
      ctx.ellipse(41, fishY, 12, 6, Math.sin(now / 120) * 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#16233f';
      ctx.fillRect(84, 0, 18, 300);
      ctx.fillStyle = inside ? '#5ee6a0' : '#ffb35c';
      ctx.fillRect(84, 300 - prog * 300, 18, prog * 300);
      if (prog >= 1) end(true);
      else if (prog <= 0) end(false);
      else requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, { closable: true, cls: 'fishing' });
}

// ================================================================== RAID BRIEFING

export function openRaidBriefing(name: string, desc: string, level: number, onAccept: (vanguard: boolean) => void, onDecline?: () => void): void {
  G.ui.modal((box, close) => {
    const s = G.save;
    const party = G.world.party.map((c) => c.def.name);
    box.append(
      h('div', { class: 'aw-sys', text: 'ASSAULT TEAM RAID BRIEFING' }),
      h('div', { class: 'aw-title', text: name }),
      h('p', { class: 'aw-desc', text: desc }),
      h('div', { class: 'brief-grid' },
        h('div', {}, h('b', { text: 'Threat level' }), h('span', { text: `Lv. ${level}${level > s.level + 3 ? '  (dangerous)' : ''}` })),
        h('div', {}, h('b', { text: 'Your team' }), h('span', { text: [s.name, ...party].join(', ') })),
        h('div', {}, h('b', { text: 'Vanguard' }), h('span', { text: 'Sir Aldric Vane, Dame Liora Ashcroft, Captain Hesper Kell' }))),
      h('p', { class: 'dim', text: 'Tactics: watch the red telegraphs, Perfect Parry heavy strikes, Break the boss and chain SWITCH! on your companions. A 6-hero raid shares aggro across the whole team.' }),
      h('div', { class: 'row center' },
        btn(`Deploy the ${3 + 1 + party.length}-hero Assault Team`, () => { close(); onAccept(true); }, 'gold'),
        btn('Engage without the Vanguard', () => { close(); onAccept(false); }, 'ghost'),
        onDecline ? btn('Retreat for now', () => { close(); onDecline(); }, 'ghost') : null),
    );
  }, { cls: 'awaken', closable: false });
}
