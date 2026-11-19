// Tiny DOM toolkit + shared tooltip / item-card builders for every menu.
import type { GearItem, StatBlock } from '../types/game';
import { G } from '../core/state';
import { GRADE_INFO, RARITY_COLORS, RARITY_NAMES, TIERS, WEAPON_INFO, ARMOR_INFO, GEM_INFO } from '../data/constants';
import { gearStats, gearTitle, gearValue, itemDef } from '../data/items';
import { activeSet, effectiveSockets } from '../systems/stats';
import { gearIconURL, itemIconURL } from '../render/icons';

type Kid = Node | string | number | null | undefined | false;
export interface Props {
  class?: string;
  style?: string;
  text?: string | number;
  html?: string;
  title?: string;
  type?: string;
  value?: string | number;
  placeholder?: string;
  disabled?: boolean;
  checked?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  src?: string;
  onclick?: (e: MouseEvent) => void;
  oninput?: (e: Event) => void;
  onchange?: (e: Event) => void;
  oncontextmenu?: (e: MouseEvent) => void;
  onmouseenter?: (e: MouseEvent) => void;
  onmouseleave?: (e: MouseEvent) => void;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, p: Props = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (p.class) el.className = p.class;
  if (p.style) el.setAttribute('style', p.style);
  if (p.text !== undefined) el.textContent = String(p.text);
  if (p.html !== undefined) el.innerHTML = p.html;
  if (p.title) el.title = p.title;
  const anyEl = el as unknown as Record<string, unknown>;
  for (const k of ['type', 'value', 'placeholder', 'disabled', 'checked', 'maxLength', 'min', 'max', 'step', 'src'] as const) {
    if (p[k] !== undefined) anyEl[k] = p[k];
  }
  if (p.onclick) el.addEventListener('click', p.onclick as EventListener);
  if (p.oninput) el.addEventListener('input', p.oninput);
  if (p.onchange) el.addEventListener('change', p.onchange);
  if (p.oncontextmenu) el.addEventListener('contextmenu', p.oncontextmenu as EventListener);
  if (p.onmouseenter) el.addEventListener('mouseenter', p.onmouseenter as EventListener);
  if (p.onmouseleave) el.addEventListener('mouseleave', p.onmouseleave as EventListener);
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    el.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  }
  return el;
}

export function btn(label: string, onclick: () => void, cls = '', disabled = false): HTMLButtonElement {
  return h('button', { class: 'btn ' + cls, text: label, disabled, onclick: () => onclick() });
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

// ------------------------------------------------------------------ tooltip

let tipEl: HTMLElement | null = null;

export function initTooltip(root: HTMLElement): void {
  tipEl = h('div', { class: 'tooltip' });
  root.appendChild(tipEl);
  window.addEventListener('mousemove', (e) => {
    if (!tipEl || tipEl.style.display !== 'block') return;
    const pad = 16;
    const r = tipEl.getBoundingClientRect();
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - r.height - 8);
    tipEl.style.left = x + 'px';
    tipEl.style.top = y + 'px';
  });
}

export function tip(el: HTMLElement, html: string | (() => string)): HTMLElement {
  el.addEventListener('mouseenter', () => {
    if (!tipEl) return;
    tipEl.innerHTML = typeof html === 'function' ? html() : html;
    tipEl.style.display = 'block';
  });
  el.addEventListener('mouseleave', hideTip);
  return el;
}

export function hideTip(): void {
  if (tipEl) tipEl.style.display = 'none';
}

const STAT_NAMES: Record<keyof StatBlock, string> = {
  atk: 'ATK', def: 'DEF', mag: 'MAG', hp: 'Max HP', mp: 'Max MP', crit: 'Crit Chance', critDmg: 'Crit Damage', aspd: 'Attack Speed',
  move: 'Move Speed', brk: 'Break Power', block: 'Block Efficiency', regen: 'MP Regen', atkPct: 'ATK', defPct: 'DEF', magPct: 'MAG', hpPct: 'Max HP', xpPct: 'XP Gain',
};
const PCT = new Set<keyof StatBlock>(['crit', 'critDmg', 'aspd', 'move', 'block', 'regen', 'atkPct', 'defPct', 'magPct', 'hpPct', 'xpPct']);

export function fmtStat(k: keyof StatBlock, v: number): string {
  if (PCT.has(k)) return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(v * 100 % 1 ? 1 : 0)}%`;
  return `${v >= 0 ? '+' : ''}${Math.round(v)}`;
}

export function statLines(s: StatBlock, cmp?: StatBlock): string {
  const keys = new Set([...Object.keys(s), ...(cmp ? Object.keys(cmp) : [])] as (keyof StatBlock)[]);
  let out = '';
  for (const k of keys) {
    const v = s[k] ?? 0;
    const c = cmp ? cmp[k] ?? 0 : null;
    if (!v && !c) continue;
    let diff = '';
    if (c !== null && Math.abs(v - c) > 0.0001) {
      const d = v - c;
      diff = ` <span class="${d > 0 ? 'up' : 'down'}">(${fmtStat(k, d)})</span>`;
    }
    out += `<div class="stat"><span>${STAT_NAMES[k]}</span><b>${fmtStat(k, v)}</b>${diff}</div>`;
  }
  return out;
}

export function equippedCounterpart(g: GearItem): GearItem | null {
  const s = G.save;
  const { main, off } = activeSet(s);
  if (g.kind === 'weapon') return main && main.uid !== g.uid ? main : null;
  if (g.aslot === 'shield') return off && off.aslot === 'shield' && off.uid !== g.uid ? off : null;
  const eq = s.equip[g.aslot as 'head' | 'chest' | 'boots' | 'cloak'];
  return eq && eq.uid !== g.uid ? eq : null;
}

export function gearTooltip(g: GearItem, compare = true): string {
  const rc = RARITY_COLORS[g.rarity];
  const type = g.kind === 'weapon' ? WEAPON_INFO[g.wtype!].name : ARMOR_INFO[g.aslot!].name;
  const other = compare ? equippedCounterpart(g) : null;
  const sockets = effectiveSockets(g, G.save?.awakenings.includes('aw_smith') ?? false);
  let gems = '';
  for (let i = 0; i < sockets; i++) {
    const gem = g.gems[i];
    gems += gem ? `<span class="gem" style="color:${GEM_INFO[gem].color}">◆ ${GEM_INFO[gem].name}</span>` : '<span class="gem empty">◇ Empty socket</span>';
  }
  return `<div class="tt-title" style="color:${rc}">${esc(gearTitle(g))}</div>
<div class="tt-sub">${RARITY_NAMES[g.rarity]} ${type} • ${TIERS[g.tier].name} tier${g.grade ? ` • <span style="color:${GRADE_INFO[g.grade].color}">${GRADE_INFO[g.grade].name}</span>` : ''}</div>
${statLines(gearStats(g), other ? gearStats(other) : undefined)}
${gems ? `<div class="tt-gems">${gems}</div>` : ''}
${g.forgedBy ? `<div class="tt-forged">Forged by ${esc(g.forgedBy)}</div>` : ''}
${other ? `<div class="tt-note">Compared with equipped: ${esc(gearTitle(other))}</div>` : ''}
<div class="tt-value">Value ${gearValue(g).toLocaleString()} G</div>`;
}

export function itemTooltip(id: string, extra = ''): string {
  const d = itemDef(id);
  return `<div class="tt-title">${esc(d.name)}</div><div class="tt-sub">${d.cat.charAt(0).toUpperCase() + d.cat.slice(1)}</div><div class="tt-desc">${esc(d.desc)}</div>${extra}<div class="tt-value">Value ${d.value.toLocaleString()} G</div>`;
}

export function gearCell(g: GearItem, onclick?: (e: MouseEvent) => void, opts: { selected?: boolean; equipped?: boolean; compare?: boolean } = {}): HTMLElement {
  const cell = h('div', { class: `cell r${g.rarity}${opts.selected ? ' sel' : ''}${opts.equipped ? ' eq' : ''}`, onclick, oncontextmenu: (e) => { e.preventDefault(); onclick?.(e); } },
    h('img', { src: gearIconURL(g) }),
    g.temper > 0 ? h('span', { class: 'badge', text: '+' + g.temper }) : null,
    opts.equipped ? h('span', { class: 'badge eqb', text: 'E' }) : null);
  return tip(cell, () => gearTooltip(g, opts.compare !== false));
}

export function itemCell(id: string, qty: number, onclick?: (e: MouseEvent) => void, opts: { selected?: boolean; extra?: string } = {}): HTMLElement {
  const cell = h('div', { class: `cell item${opts.selected ? ' sel' : ''}`, onclick }, h('img', { src: itemIconURL(id) }), qty > 1 || qty === 0 ? h('span', { class: 'qty', text: qty }) : null);
  return tip(cell, () => itemTooltip(id, opts.extra ?? ''));
}

export function section(title: string, ...kids: Kid[]): HTMLElement {
  return h('div', { class: 'section' }, h('div', { class: 'section-title', text: title }), ...kids);
}
