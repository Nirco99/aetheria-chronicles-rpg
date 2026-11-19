// Dynamic supply & demand: per-city price indices (70%-155%), bulk-trade pressure, drift,
// and rotating World Trade Booms & Shortages shown in the Market Ticker.
import type { EconomyState, MarketCategory } from '../types/game';
import { G } from '../core/state';
import { REALMS } from '../data/realms';
import { GUILDS, guildRank } from '../data/guilds';
import { clamp, pick, rnd } from '../engine/util';

export const MARKET_CATS: MarketCategory[] = ['weapon', 'armor', 'material', 'consumable', 'food', 'gem', 'furniture'];
export const CAT_NAMES: Record<MarketCategory, string> = {
  weapon: 'Weapons', armor: 'Armor', material: 'Materials', consumable: 'Potions & Oils', food: 'Food', gem: 'Gems', furniture: 'Furniture',
};

export function newEconomy(): EconomyState {
  return {
    idx: REALMS.map(() => MARKET_CATS.map(() => +rnd(0.88, 1.12).toFixed(3))),
    events: [],
    nextEvent: 4,
  };
}

function absHours(): number {
  return G.save.day * 24 + G.save.time;
}

export function catIndex(city: number, cat: MarketCategory): number {
  const e = G.save.economy;
  let v = e.idx[city][MARKET_CATS.indexOf(cat)];
  for (const ev of e.events) if (ev.city === city && ev.cat === cat) v *= ev.mult;
  return clamp(v, 0.7, 1.55);
}

function discount(): number {
  const s = G.save;
  return s.joined.includes('anvil') ? 0.03 * (guildRank(s.guilds.anvil) + 1) : 0;
}

export function buyPrice(value: number, city: number, cat: MarketCategory): number {
  return Math.max(1, Math.ceil(value * catIndex(city, cat) * 1.25 * (1 - discount())));
}

export function sellPrice(value: number, city: number, cat: MarketCategory): number {
  return Math.max(1, Math.floor(value * catIndex(city, cat) * 0.5));
}

export function onTrade(city: number, cat: MarketCategory, qty: number, selling: boolean): void {
  const row = G.save.economy.idx[city];
  const i = MARKET_CATS.indexOf(cat);
  row[i] = clamp(row[i] + (selling ? -1 : 1) * 0.006 * qty, 0.7, 1.55);
}

export function updateEconomy(hours: number): void {
  const e = G.save.economy;
  const k = Math.min(1, 0.04 * hours);
  for (const row of e.idx) for (let i = 0; i < row.length; i++) row[i] += (1 - row[i]) * k;
  const now = absHours();
  e.events = e.events.filter((ev) => ev.until > now);
  e.nextEvent -= hours;
  if (e.nextEvent <= 0) {
    e.nextEvent = rnd(3, 6);
    const city = Math.floor(Math.random() * Math.max(1, G.save.unlocked));
    const cat = pick(MARKET_CATS);
    const boom = Math.random() < 0.5;
    e.events.push({ city, cat, mult: boom ? 1.35 : 1.45, kind: boom ? 'boom' : 'shortage', until: now + rnd(6, 12) });
    const other = Math.floor(Math.random() * 5);
    const oc = MARKET_CATS.indexOf(pick(MARKET_CATS));
    e.idx[other][oc] = clamp(e.idx[other][oc] - 0.22, 0.7, 1.55);
    if (G.ui) G.ui.toast(`${boom ? 'TRADE BOOM' : 'SHORTAGE'}: ${CAT_NAMES[cat]} in ${REALMS[city].city} now trade at ${Math.round(catIndex(city, cat) * 100)}%!`, 'market');
  }
}

export function tickerLines(): string[] {
  const s = G.save;
  const out: string[] = [];
  for (const ev of s.economy.events) out.push(`${ev.kind === 'boom' ? 'BOOM' : 'SHORTAGE'} • ${REALMS[ev.city].city} • ${CAT_NAMES[ev.cat]} ${Math.round(catIndex(ev.city, ev.cat) * 100)}%`);
  for (let c = 0; c < Math.max(1, s.unlocked); c++) {
    for (const cat of MARKET_CATS) {
      const v = catIndex(c, cat);
      if (v > 1.12) out.push(`▲ ${REALMS[c].city} ${CAT_NAMES[cat]} ${Math.round(v * 100)}%`);
      else if (v < 0.88) out.push(`▼ ${REALMS[c].city} ${CAT_NAMES[cat]} ${Math.round(v * 100)}%`);
    }
  }
  if (!out.length) out.push('Markets are calm across Aetheria.');
  return out;
}

export function guildDiscountText(): string {
  const d = discount();
  return d > 0 ? `${GUILDS.anvil.short} discount: ${Math.round(d * 100)}%` : '';
}
