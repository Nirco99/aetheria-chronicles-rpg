// Town & crafting menus: forge (with the Anvil Hammer mini-game), smelting, tempering, gem
// sockets, salvage, shops + market ticker, alchemy/cooking, guild hall, real estate, teleport
// gate, abyss gate, coliseum, storage vault, display mounts, NPC dialogue and the decorator dock.
import type { CraftGrade, GearItem, MarketCategory, ShopKind } from '../types/game';
import type { Npc } from '../entities/npc';
import { G } from '../core/state';
import { GEM_INFO, GEM_TYPES, GRADE_INFO, RARITY_COLORS, TIERS, VAULT_CAPACITY, GEAR_CAPACITY } from '../data/constants';
import { GEAR_BASES, GEAR_BASE_IDS, ITEMS, gearName, gearTitle, gearValue, itemDef, makeGear, marketCat } from '../data/items';
import { ALCHEMY, COOKING, SMELT, blueprintCost, salvageYield, socketCost, temperCost, type Recipe } from '../data/recipes';
import { REALMS } from '../data/realms';
import { GUILDS, GUILD_IDS, GUILD_RANKS, COMPANIONS, COMPANION_BY_ID, guildRank } from '../data/guilds';
import { ROLE_LINES, ROLE_TITLES, CITY_GOSSIP } from '../data/lore';
import { MONSTERS } from '../data/monsters';
import { CUPS, arena } from '../systems/arena';
import { leaderboard, startAbyss } from '../systems/abyss';
import { autoForgeGrade, craftRecipe, forge, forgeQualityBonus, gradeFromScore, maxCraftable, salvage, socketGem, temper, unsocketGem, canForge } from '../systems/crafting';
import { addGear, addItem, countItem, gearFull, isEquipped, removeItem } from '../systems/inventory';
import { buyPrice, catIndex, CAT_NAMES, MARKET_CATS, onTrade, sellPrice, tickerLines, guildDiscountText } from '../systems/economy';
import { acceptBounty, bountyReady, joinGuild, recruit, recruitBlocker, refreshBoard, turnIn } from '../systems/guilds';
import { buyHouse, mountGear, ownsHouse, unmountGear, currentHouse } from '../systems/housing';
import { effectiveSockets } from '../systems/stats';
import { gearIconURL, itemIconURL } from '../render/icons';
import { audio } from '../engine/audio';
import { RNG, pick } from '../engine/util';
import { h, btn, gearCell, gearTooltip, itemCell, section, tip, hideTip } from './dom';

const city = (): number => G.world.map.realm;

function matList(ins: [string, number][], mult = 1): HTMLElement {
  return h('div', { class: 'mats' }, ...ins.map(([id, n]) => {
    const have = countItem(id);
    const ok = have >= n * mult;
    return tip(h('div', { class: 'mat' + (ok ? '' : ' miss') }, h('img', { src: itemIconURL(id) }), h('span', { text: `${itemDef(id).name} ${have}/${n * mult}` })), itemDef(id).desc);
  }));
}

function tabs(cur: string, list: [string, string][], set: (id: string) => void): HTMLElement {
  return h('div', { class: 'tabs' }, ...list.map(([id, n]) => h('button', { class: 'tab' + (cur === id ? ' on' : ''), text: n, onclick: () => { set(id); G.ui.refresh(); } })));
}

function allGear(): GearItem[] {
  const s = G.save;
  return [...Object.values(s.equip).filter((g): g is GearItem => !!g), ...s.gear];
}

// ================================================================== FORGE

let forgeTab = 'forge';
let bpBase = 'w_sword';
let bpTier = 0;
let bpMythic = false;
let selUid: string | null = null;

export function openForge(home: boolean): void {
  const R = REALMS[city()];
  forgeTab = 'forge';
  selUid = null;
  G.ui.openPanel('forge', home ? 'Personal Master Anvil' : R.buildings.forge, (b) => {
    const list: [string, string][] = [['forge', 'Forge'], ['smelt', 'Smelt'], ['temper', 'Temper'], ['socket', 'Gem Sockets'], ['salvage', 'Salvage']];
    if (!home) list.push(['shop', 'Smith Shop']);
    b.append(tabs(forgeTab, list, (id) => { forgeTab = id; selUid = null; }));
    const body = h('div', { class: 'tab-body' });
    b.append(body);
    if (forgeTab === 'forge') forgePane(body, home);
    else if (forgeTab === 'smelt') recipePane(body, SMELT, 'Smelt');
    else if (forgeTab === 'temper') temperPane(body);
    else if (forgeTab === 'socket') socketPane(body);
    else if (forgeTab === 'salvage') salvagePane(body);
    else shopBuy(body, 'smith');
  }, { wide: true, subtitle: home ? '+10% forging quality' : `${G.save.gold.toLocaleString()} G` });
}

function forgePane(b: HTMLElement, home: boolean): void {
  const weapons = GEAR_BASE_IDS.filter((id) => GEAR_BASES[id].kind === 'weapon');
  const armors = GEAR_BASE_IDS.filter((id) => GEAR_BASES[id].kind === 'armor');
  const baseBtn = (id: string) => h('button', { class: 'chip' + (bpBase === id ? ' on' : ''), text: GEAR_BASES[id].label, onclick: () => { bpBase = id; G.ui.refresh(); } });
  const tierBtns = h('div', { class: 'chips' }, ...TIERS.map((t, i) => h('button', { class: 'chip' + (bpTier === i ? ' on' : ''), text: `${t.name}`, style: `border-color:${t.colors.main}`, onclick: () => { bpTier = i; if (i < 6) bpMythic = false; G.ui.refresh(); } })));
  const mythicToggle = bpTier === 6 ? h('label', { class: 'check' }, (() => {
    const c = h('input', { type: 'checkbox', checked: bpMythic });
    c.addEventListener('change', () => { bpMythic = c.checked; G.ui.refresh(); });
    return c;
  })(), h('span', { text: ' Mythic variant (requires Abyssal Relic Shards and a Mythic Core)' })) : null;
  const preview = makeGear(bpBase, bpTier, bpMythic ? 5 : 1, { grade: 'standard', mythic: bpMythic, forgedBy: G.save.name });
  const cost = blueprintCost(bpBase, bpTier, bpMythic);
  const err = canForge(bpBase, bpTier, bpMythic);
  const q = forgeQualityBonus(home);
  b.append(h('div', { class: 'two-col' },
    h('div', {},
      section('Weapon Blueprints', h('div', { class: 'chips' }, ...weapons.map(baseBtn))),
      section('Armor Blueprints', h('div', { class: 'chips' }, ...armors.map(baseBtn))),
      section('Material Tier', tierBtns, mythicToggle)),
    h('div', {},
      section(gearName(GEAR_BASES[bpBase], bpTier, bpMythic),
        h('div', { class: 'bp-preview' }, h('img', { src: gearIconURL(preview), class: 'big-icon' }), h('div', { html: gearTooltip(preview, false) })),
        h('div', { class: 'dim small', text: 'Stats shown at Standard grade. Fine x1.15, Masterwork x1.30, Supreme Masterpiece x1.50 + an extra gem socket, custom name and signature.' }),
        matList(cost.ins), h('div', { class: 'gold-line', text: `Forging fee: ${cost.gold.toLocaleString()} G (you have ${G.save.gold.toLocaleString()} G)` }),
        h('div', { class: 'dim small', text: `Quality bonus: x${q.toFixed(2)} sweet-spot width${home ? ' (Master Anvil)' : ''}` }),
        h('div', { class: 'row' },
          btn('Hammer the Anvil', () => hammerGame(home), 'primary', !!err),
          btn('Instant Auto-Forge', () => finishForge(autoForgeGrade()), '', !!err)),
        err ? h('div', { class: 'warn', text: err }) : null)),
  ));
}

function finishForge(grade: CraftGrade, name?: string): void {
  const res = forge(bpBase, bpTier, bpMythic, grade, name);
  if (typeof res === 'string') {
    G.ui.toast(res, 'warn');
    return;
  }
  G.ui.toast(`Forged: ${gearTitle(res)} (${GRADE_INFO[grade].name})!`, 'loot');
  G.ui.refresh();
}

function hammerGame(home: boolean): void {
  const q = forgeQualityBonus(home);
  G.ui.modal((box, close) => {
    let strike = 0;
    let score = 0;
    let pos = 0;
    let dirV = 1;
    let speed = 0.9;
    let center = 0.3 + Math.random() * 0.4;
    let done = false;
    const results: string[] = [];
    const gauge = h('div', { class: 'gauge' });
    const zoneOk = h('div', { class: 'zone ok' });
    const zoneGood = h('div', { class: 'zone good' });
    const zonePerfect = h('div', { class: 'zone perfect' });
    const marker = h('div', { class: 'marker' });
    gauge.append(zoneOk, zoneGood, zonePerfect, marker);
    const info = h('div', { class: 'hammer-info', text: 'Strike 1 of 3 - press SPACE or click when the marker crosses the golden center!' });
    const resultEl = h('div', { class: 'hammer-results' });
    const widths = { ok: 0.18 * q, good: 0.1 * q, perfect: 0.04 * q };
    const placeZones = () => {
      const set = (el: HTMLElement, w: number) => {
        el.style.left = `${Math.max(0, center - w) * 100}%`;
        el.style.width = `${Math.min(1, w * 2) * 100}%`;
      };
      set(zoneOk, widths.ok);
      set(zoneGood, widths.good);
      set(zonePerfect, widths.perfect);
    };
    placeZones();
    let last = performance.now();
    const loop = () => {
      if (done || !box.isConnected) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      pos += dirV * speed * dt;
      if (pos > 1) { pos = 1; dirV = -1; }
      if (pos < 0) { pos = 0; dirV = 1; }
      marker.style.left = `${pos * 100}%`;
      requestAnimationFrame(loop);
    };
    const hit = () => {
      if (done) return;
      const d = Math.abs(pos - center);
      const pts = d <= widths.perfect ? 3 : d <= widths.good ? 2 : d <= widths.ok ? 1 : 0;
      score += pts;
      results.push(['MISS', 'OK', 'GOOD', 'PERFECT!'][pts]);
      audio.play(pts >= 2 ? 'anvil' : pts === 1 ? 'block' : 'error');
      resultEl.textContent = results.join('  •  ');
      strike++;
      if (strike >= 3) {
        done = true;
        const grade = gradeFromScore(score, q);
        info.textContent = `Result: ${GRADE_INFO[grade].name}! (score ${score}/9)`;
        info.style.color = GRADE_INFO[grade].color;
        window.removeEventListener('keydown', key, true);
        setTimeout(() => {
          close();
          if (grade === 'supreme') {
            audio.play('awaken');
            G.ui.prompt('Supreme Masterpiece! Name your creation:', gearName(GEAR_BASES[bpBase], bpTier, bpMythic), (v) => finishForge(grade, v));
          } else finishForge(grade);
        }, 900);
        return;
      }
      speed += 0.45;
      center = 0.2 + Math.random() * 0.6;
      placeZones();
      info.textContent = `Strike ${strike + 1} of 3 - faster now!`;
    };
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        hit();
      }
    };
    window.addEventListener('keydown', key, true);
    gauge.addEventListener('mousedown', hit);
    box.append(h('div', { class: 'modal-title', text: 'Anvil Hammer Gauge' }), info, gauge, resultEl,
      h('div', { class: 'row end' }, btn('Strike!', hit, 'primary')));
    requestAnimationFrame(loop);
  }, { closable: false, cls: 'hammer' });
}

function recipePane(b: HTMLElement, list: Recipe[], verb: string): void {
  const wrap = h('div', { class: 'recipes scroll' });
  for (const r of list) {
    const max = maxCraftable(r);
    wrap.append(h('div', { class: 'recipe' + (max > 0 ? '' : ' dimmed') },
      itemCell(r.out, r.qty),
      h('div', { class: 'recipe-info' }, h('b', { text: `${itemDef(r.out).name}${r.qty > 1 ? ` x${r.qty}` : ''}` }), h('small', { text: itemDef(r.out).desc }), matList(r.ins)),
      h('div', { class: 'recipe-btns' },
        btn(`${verb} 1`, () => { const e = craftRecipe(r, 1); if (e) G.ui.toast(e, 'warn'); G.ui.refresh(); }, 'mini-btn', max < 1),
        btn('x5', () => { craftRecipe(r, 5); G.ui.refresh(); }, 'mini-btn', max < 5),
        btn(`Max (${max})`, () => { craftRecipe(r, max); G.ui.refresh(); }, 'mini-btn', max < 1))));
  }
  b.append(wrap);
}

function gearPicker(b: HTMLElement, filter: (g: GearItem) => boolean): GearItem | null {
  const list = allGear().filter(filter);
  b.append(h('div', { class: 'grid scroll small' }, ...list.map((g) => gearCell(g, () => { selUid = g.uid; G.ui.refresh(); }, { selected: selUid === g.uid, equipped: isEquipped(g.uid), compare: false }))));
  if (!list.length) b.append(h('div', { class: 'dim pad', text: 'No eligible gear.' }));
  return list.find((g) => g.uid === selUid) ?? null;
}

function temperPane(b: HTMLElement): void {
  const left = h('div', {});
  const g = gearPicker(left, () => true);
  const right = h('div', {});
  if (g) {
    if (g.temper >= 10) right.append(section(gearTitle(g), h('div', { text: 'This item is fully tempered (+10). Its sparks burn gold.' })));
    else {
      const c = temperCost(g);
      right.append(section(`${gearTitle(g)}  →  +${g.temper + 1}`,
        h('div', { html: gearTooltip(g, false) }),
        matList([[c.stone, c.stones]]),
        h('div', { class: 'gold-line', text: `Fee: ${c.gold.toLocaleString()} G • Success chance: ${Math.round(c.chance * 100)}%${c.chance < 1 ? ' (failure never destroys the item)' : ''}` }),
        btn('Temper', () => {
          const r = temper(g);
          G.ui.toast(r.msg, r.ok ? 'loot' : 'warn');
          G.ui.refresh();
        }, 'primary', countItem(c.stone) < c.stones || G.save.gold < c.gold)));
    }
  } else right.append(h('div', { class: 'dim pad', text: 'Select gear to temper. Each level adds 7% to its stats; +4 and above gain orbiting sparks.' }));
  b.append(h('div', { class: 'two-col' }, left, right));
}

function socketPane(b: HTMLElement): void {
  const smith = G.save.awakenings.includes('aw_smith');
  const left = h('div', {});
  const g = gearPicker(left, (x) => x.kind === 'weapon' && effectiveSockets(x, smith) > 0);
  const right = h('div', {});
  if (g) {
    const n = effectiveSockets(g, smith);
    while (g.gems.length < n) g.gems.push(null);
    const cost = socketCost(g);
    const rows = h('div', {});
    for (let i = 0; i < n; i++) {
      const cur = g.gems[i];
      rows.append(h('div', { class: 'socket-row' },
        h('b', { text: `Socket ${i + 1}: ` }),
        h('span', { text: cur ? GEM_INFO[cur].name : 'empty', style: cur ? `color:${GEM_INFO[cur].color}` : '' }),
        ...GEM_TYPES.map((gt) => btn(GEM_INFO[gt].name.replace(' Gem', ''), () => {
          const e = socketGem(g, i, gt);
          if (e) G.ui.toast(e, 'warn');
          G.ui.refresh();
        }, 'mini-btn', countItem('gem_' + gt) < 1)),
        cur ? btn('Remove', () => { unsocketGem(g, i); G.ui.refresh(); }, 'mini-btn ghost') : null));
    }
    right.append(section(gearTitle(g), h('div', { class: 'dim small', text: `Socketing costs ${cost} G per gem. Gems: ${GEM_TYPES.map((t) => `${GEM_INFO[t].name} x${countItem('gem_' + t)}`).join(', ')}` }), rows,
      h('div', { class: 'dim small', text: GEM_TYPES.map((t) => `${GEM_INFO[t].name}: ${GEM_INFO[t].desc}`).join(' ') })));
  } else right.append(h('div', { class: 'dim pad', text: `Select a weapon with sockets. Rare+ drops and Fine+ forged weapons have sockets${smith ? '; your Master Blacksmith\'s Soul grants 2 on every self-forged weapon' : ''}.` }));
  b.append(h('div', { class: 'two-col' }, left, right));
}

function salvagePane(b: HTMLElement): void {
  const left = h('div', {});
  const g = gearPicker(left, (x) => !isEquipped(x.uid));
  const right = h('div', {});
  if (g) {
    const y = salvageYield(g);
    right.append(section(`Salvage ${gearTitle(g)}`, h('div', { text: 'You will receive:' }),
      h('div', { class: 'mats' }, ...y.map(([id, n]) => h('div', { class: 'mat' }, h('img', { src: itemIconURL(id) }), h('span', { text: `${itemDef(id).name} x${n}` })))),
      btn('Salvage', () => {
        const go = () => {
          const e = salvage(g);
          if (e) G.ui.toast(e, 'warn');
          selUid = null;
          G.ui.refresh();
        };
        if (g.rarity >= 3 || g.forgedBy) G.ui.confirm(`Salvage ${gearTitle(g)}? This cannot be undone.`, go, 'Salvage');
        else go();
      }, 'danger')));
  } else right.append(h('div', { class: 'dim pad', text: 'Select spare gear to break it down into ingots, Arcane Dust and enhancement stones. Socketed gems are returned.' }));
  b.append(h('div', { class: 'two-col' }, left, right));
}

// ================================================================== SHOPS

let shopTab = 'buy';
let buyQty = 1;

interface StockEntry {
  id?: string;
  gear?: GearItem;
}

function stockFor(kind: ShopKind): StockEntry[] {
  const r = city();
  const s = G.save;
  const rng = new RNG(s.day * 131 + r * 17 + kind.length * 7);
  const out: StockEntry[] = [];
  const tiers = TIERS.map((t, i) => [t, i] as const).filter(([t]) => t.realm === r).map(([, i]) => i);
  switch (kind) {
    case 'smith':
      for (let i = 0; i < 10; i++) out.push({ gear: makeGear(pick(GEAR_BASE_IDS), pick(tiers), rng.chance(0.25) ? 1 : 0) });
      for (const o of REALMS[r].ores) out.push({ id: o });
      for (const t of tiers) out.push({ id: TIERS[t].ingot });
      out.push({ id: 'enh_stone' });
      if (r >= 3) out.push({ id: 'enh_greater' });
      break;
    case 'general':
      out.push({ id: 'spice' }, { id: 'bread' }, { id: 'pot_hp_s' }, { id: 'pot_mp_s' }, { id: 'food_cutlet' }, { id: REALMS[r].herbs[0] });
      if (r >= 1) out.push({ id: 'fish' }, { id: 'food_soup' });
      if (r >= 4) out.push({ id: 'honey' });
      out.push({ id: 'arcane_dust' });
      break;
    case 'alchemist':
      out.push({ id: 'pot_hp_s' }, { id: 'pot_mp_s' }, { id: REALMS[r].herbs[0] });
      if (r >= 1) out.push({ id: 'pot_hp_m' }, { id: 'pot_haste' }, { id: 'water_essence' });
      if (r >= 2) out.push({ id: 'pot_crit' }, { id: 'oil_fire' });
      if (r >= 3) out.push({ id: 'pot_mp_l' }, { id: 'oil_frost' }, { id: 'pot_hp_l' });
      if (r >= 4) out.push({ id: 'oil_lightning' });
      break;
    case 'market': {
      const gems = [...GEM_TYPES];
      for (let i = 0; i < Math.min(5, 1 + r); i++) out.push({ id: 'gem_' + gems[(i + s.day) % 5] });
      const mats = Object.values(ITEMS).filter((d) => d.cat === 'material' && (d.tier ?? 0) < Math.max(1, s.unlocked) && !['relic_shard', 'mythic_core'].includes(d.id));
      for (let i = 0; i < 8; i++) out.push({ id: rng.pick(mats).id });
      break;
    }
    case 'furniture':
      for (const d of Object.values(ITEMS)) if (d.cat === 'furniture') out.push({ id: d.id });
      break;
  }
  const seen = new Set<string>();
  return out.filter((e) => !e.id || (!seen.has(e.id) && seen.add(e.id)));
}

const SHOP_GEAR = new Map<string, GearItem>();

function shopBuy(b: HTMLElement, kind: ShopKind): void {
  const r = city();
  const s = G.save;
  const stock = stockFor(kind);
  b.append(h('div', { class: 'row' }, h('b', { text: `Gold: ${s.gold.toLocaleString()} G` }), h('span', { class: 'dim', text: guildDiscountText() }),
    h('span', { class: 'dim', text: 'Quantity:' }), ...[1, 5, 10].map((q) => h('button', { class: 'chip' + (buyQty === q ? ' on' : ''), text: 'x' + q, onclick: () => { buyQty = q; G.ui.refresh(); } }))));
  const list = h('div', { class: 'shop scroll' });
  for (const e of stock) {
    if (e.gear) {
      const key = `${s.day}:${r}:${e.gear.baseId}:${e.gear.tier}:${e.gear.rarity}`;
      const g = SHOP_GEAR.get(key) ?? e.gear;
      SHOP_GEAR.set(key, g);
      const cat: MarketCategory = g.kind === 'weapon' ? 'weapon' : 'armor';
      const price = buyPrice(gearValue(g), r, cat);
      list.append(h('div', { class: 'shop-row' }, gearCell(g, undefined, { compare: true }), h('div', { class: 'shop-name' }, h('b', { text: g.name, style: `color:${RARITY_COLORS[g.rarity]}` }), h('small', { text: `${CAT_NAMES[cat]} index ${Math.round(catIndex(r, cat) * 100)}%` })),
        btn(`${price.toLocaleString()} G`, () => {
          if (s.gold < price) return G.ui.toast('Not enough gold.', 'warn');
          if (gearFull()) return G.ui.toast('Inventory full.', 'warn');
          s.gold -= price;
          addGear({ ...g, uid: g.uid + ':' + Date.now(), gems: [...g.gems], base: { ...g.base }, colors: { ...g.colors } });
          onTrade(r, cat, 1, false);
          audio.play('coin');
          G.ui.refresh();
        }, 'mini-btn', s.gold < price)));
    } else if (e.id) {
      const d = itemDef(e.id);
      const cat = marketCat(e.id);
      const price = buyPrice(d.value, r, cat);
      const total = price * buyQty;
      list.append(h('div', { class: 'shop-row' }, itemCell(e.id, countItem(e.id)), h('div', { class: 'shop-name' }, h('b', { text: d.name }), h('small', { text: `${price} G each • ${CAT_NAMES[cat]} ${Math.round(catIndex(r, cat) * 100)}% • owned ${countItem(e.id)}` })),
        btn(`Buy x${buyQty} (${total.toLocaleString()} G)`, () => {
          if (s.gold < total) return G.ui.toast('Not enough gold.', 'warn');
          s.gold -= total;
          addItem(e.id as string, buyQty);
          onTrade(r, cat, buyQty, false);
          audio.play('coin');
          G.ui.refresh();
        }, 'mini-btn', s.gold < total)));
    }
  }
  b.append(list);
}

function shopSell(b: HTMLElement, kind: ShopKind): void {
  const r = city();
  const s = G.save;
  const accepts = (cat: string) => kind === 'market' || (kind === 'smith' && (cat === 'material' || cat === 'weapon' || cat === 'armor')) || (kind === 'general' && (cat === 'food' || cat === 'material' || cat === 'consumable')) || (kind === 'alchemist' && (cat === 'consumable' || cat === 'material')) || (kind === 'furniture' && cat === 'furniture');
  b.append(h('div', { class: 'dim small', text: 'Selling in bulk lowers this city\'s price index for that category. Prices recover over time - and differ in every city.' }));
  const list = h('div', { class: 'shop scroll' });
  if (accepts('weapon')) {
    for (const g of s.gear) {
      const cat: MarketCategory = g.kind === 'weapon' ? 'weapon' : 'armor';
      const price = sellPrice(gearValue(g), r, cat);
      list.append(h('div', { class: 'shop-row' }, gearCell(g, undefined, { compare: false }), h('div', { class: 'shop-name' }, h('b', { text: gearTitle(g), style: `color:${RARITY_COLORS[g.rarity]}` }), h('small', { text: `${CAT_NAMES[cat]} ${Math.round(catIndex(r, cat) * 100)}%` })),
        btn(`Sell ${price.toLocaleString()} G`, () => {
          const go = () => {
            const i = s.gear.findIndex((x) => x.uid === g.uid);
            if (i < 0) return;
            s.gear.splice(i, 1);
            for (const gem of g.gems) if (gem) addItem('gem_' + gem, 1);
            s.gold += price;
            onTrade(r, cat, 1, true);
            audio.play('coin');
            G.ui.refresh();
          };
          if (g.rarity >= 3 || g.forgedBy) G.ui.confirm(`Sell ${gearTitle(g)} for ${price} G?`, go, 'Sell');
          else go();
        }, 'mini-btn')));
    }
  }
  for (const id of Object.keys(s.items).sort()) {
    const d = ITEMS[id];
    if (!d || d.cat === 'trophy' || d.value <= 0 || !accepts(d.cat)) continue;
    const cat = marketCat(id);
    const price = sellPrice(d.value, r, cat);
    const n = s.items[id];
    list.append(h('div', { class: 'shop-row' }, itemCell(id, n), h('div', { class: 'shop-name' }, h('b', { text: d.name }), h('small', { text: `${price} G each • ${CAT_NAMES[cat]} ${Math.round(catIndex(r, cat) * 100)}%` })),
      btn(`Sell 1`, () => { if (removeItem(id, 1)) { s.gold += price; onTrade(r, cat, 1, true); audio.play('coin'); } G.ui.refresh(); }, 'mini-btn'),
      btn(`Sell all (${(price * n).toLocaleString()} G)`, () => {
        let total = 0;
        for (let k = 0; k < n; k++) {
          const p = sellPrice(d.value, r, cat);
          total += p;
          onTrade(r, cat, 1, true);
        }
        removeItem(id, n);
        s.gold += total;
        audio.play('coin');
        G.ui.refresh();
      }, 'mini-btn')));
  }
  b.append(list);
}

function tickerPane(b: HTMLElement): void {
  const s = G.save;
  b.append(section('Live Market Ticker', h('div', { class: 'ticker-list' }, ...tickerLines().map((l) => h('div', { text: l })))));
  const table = h('table', { class: 'market-table' });
  table.append(h('tr', {}, h('th', { text: 'City' }), ...MARKET_CATS.map((c) => h('th', { text: CAT_NAMES[c] }))));
  for (let c = 0; c < 5; c++) {
    const unlocked = c < s.unlocked;
    table.append(h('tr', { class: unlocked ? '' : 'locked' }, h('td', { text: REALMS[c].city }), ...MARKET_CATS.map((cat) => {
      const v = catIndex(c, cat);
      return h('td', { text: unlocked ? `${Math.round(v * 100)}%` : '-', class: v > 1.1 ? 'up' : v < 0.9 ? 'down' : '' });
    })));
  }
  b.append(section('Price Indices (70% - 155%)', table, h('div', { class: 'dim small', text: 'Arbitrage tip: buy where a category is cheap (green arrows down), teleport, and sell where it booms.' })));
}

export function openShop(kind: ShopKind): void {
  const R = REALMS[city()];
  const titles: Record<ShopKind, string> = { general: R.buildings.general, smith: R.buildings.forge, alchemist: R.buildings.alchemist, market: R.buildings.market, furniture: `${R.buildings.estate} Furnishings` };
  shopTab = 'buy';
  G.ui.openPanel('shop', titles[kind], (b) => {
    const list: [string, string][] = [['buy', 'Buy'], ['sell', 'Sell']];
    if (kind === 'general') list.push(['cook', 'Cook']);
    if (kind === 'alchemist') list.push(['brew', 'Brew']);
    if (kind === 'market') list.push(['ticker', 'Market Ticker']);
    b.append(tabs(shopTab, list, (id) => (shopTab = id)));
    const body = h('div', { class: 'tab-body' });
    b.append(body);
    if (shopTab === 'buy') shopBuy(body, kind);
    else if (shopTab === 'sell') shopSell(body, kind);
    else if (shopTab === 'cook') recipePane(body, COOKING, 'Cook');
    else if (shopTab === 'brew') recipePane(body, ALCHEMY, 'Brew');
    else tickerPane(body);
  }, { wide: true });
}

export function openCraft(kind: 'alchemy' | 'cooking'): void {
  if (kind === 'alchemy' && G.world.map.kind === 'city') {
    openShop('alchemist');
    shopTab = 'brew';
    G.ui.refresh();
    return;
  }
  G.ui.openPanel('craft', kind === 'alchemy' ? 'Alchemy Station' : 'Cooking Hearth', (b) => recipePane(b, kind === 'alchemy' ? ALCHEMY : COOKING, kind === 'alchemy' ? 'Brew' : 'Cook'), { wide: true });
}

// ================================================================== GUILD HALL

let guildTab = 'board';

export function openGuild(): void {
  refreshBoard();
  const R = REALMS[city()];
  G.ui.openPanel('guild', R.buildings.guild, (b) => {
    b.append(tabs(guildTab, [['board', 'Bounty Board'], ['guilds', 'Guilds'], ['recruit', 'Companions']], (id) => (guildTab = id)));
    const body = h('div', { class: 'tab-body' });
    b.append(body);
    const s = G.save;
    if (guildTab === 'board') {
      const active = h('div', { class: 'bounties' });
      for (const bo of s.bounties) {
        const ready = bountyReady(bo);
        active.append(h('div', { class: 'bounty' + (ready ? ' ready' : '') }, h('b', { text: bo.title, style: `color:${GUILDS[bo.guild].color}` }), h('span', { text: bo.desc }),
          h('small', { text: `${GUILDS[bo.guild].short} • ${bo.gold} G • ${bo.xp} XP • ${bo.rep} rep • ${ready ? 'COMPLETE' : bo.kind === 'gather' ? `${Math.min(countItem(bo.target), bo.count)}/${bo.count}` : `${bo.progress}/${bo.count}`}` }),
          btn('Turn In', () => { const e = turnIn(bo.id); if (e) G.ui.toast(e, 'warn'); G.ui.refresh(); }, 'mini-btn primary', !ready)));
      }
      if (!s.bounties.length) active.append(h('div', { class: 'dim', text: 'No active bounties.' }));
      const board = h('div', { class: 'bounties' });
      for (const bo of s.board) {
        const member = s.joined.includes(bo.guild);
        board.append(h('div', { class: 'bounty' }, h('b', { text: bo.title, style: `color:${GUILDS[bo.guild].color}` }), h('span', { text: bo.desc }),
          h('small', { text: `${GUILDS[bo.guild].short}${member ? '' : ' (members only)'} • ${bo.gold} G • ${bo.xp} XP • ${bo.rep} rep` }),
          btn('Accept', () => { const e = acceptBounty(bo.id); if (e) G.ui.toast(e, 'warn'); G.ui.refresh(); }, 'mini-btn', !member || s.bounties.length >= 5)));
      }
      body.append(section(`Your Bounties (${s.bounties.length}/5)`, active), section(`Posted Today (refreshes daily) - Day ${s.day}`, board));
    } else if (guildTab === 'guilds') {
      for (const gid of GUILD_IDS) {
        const g = GUILDS[gid];
        const joined = s.joined.includes(gid);
        const r = guildRank(s.guilds[gid]);
        body.append(h('div', { class: 'guild-card', style: `border-color:${g.color}` }, h('b', { text: g.name, style: `color:${g.color}` }), h('i', { class: 'dim', text: `"${g.motto}"` }),
          h('div', { text: `Perk: ${g.perk}` }),
          h('div', { text: joined ? `Member • ${GUILD_RANKS[r]} • ${s.guilds[gid]} reputation` : 'Not a member' }),
          joined ? null : btn(`Join the ${g.short}`, () => { joinGuild(gid); G.ui.refresh(); }, 'primary')));
      }
    } else {
      for (const c of COMPANIONS) {
        const rec = s.companions[c.id]?.recruited;
        const block = recruitBlocker(c.id);
        body.append(h('div', { class: 'comp-card' }, h('b', { text: `${c.name} - ${c.title}` }), h('p', { class: 'dim', text: c.bio }),
          h('small', { text: `Fights with: ${c.weapon}${c.off ? ' + ' + c.off : ''} • Chain Skill: ${c.chain} • Found in ${REALMS[c.city].city}` }),
          h('small', { text: `Requires: level ${c.req.level}${c.req.guild ? `, ${GUILDS[c.req.guild].short} ${GUILD_RANKS[c.req.rank ?? 0]}` : ''}${c.req.gold ? `, ${c.req.gold.toLocaleString()} G fee` : ''}` }),
          rec ? btn(s.activeCompanion === c.id ? 'In your party' : 'Summon to party', () => { recruit(c.id); G.ui.refresh(); }, 'mini-btn', s.activeCompanion === c.id)
            : btn('Recruit', () => { const e = recruit(c.id); if (e) G.ui.toast(e, 'warn'); G.ui.refresh(); }, 'mini-btn primary', !!block),
          !rec && block ? h('div', { class: 'warn small', text: block }) : null));
      }
    }
  }, { wide: true });
}

// ================================================================== ESTATE

let estateTab = 'houses';

export function openEstate(): void {
  const R = REALMS[city()];
  G.ui.openPanel('estate', R.buildings.estate, (b) => {
    b.append(tabs(estateTab, [['houses', 'Houses'], ['furniture', 'Furniture']], (id) => (estateTab = id)));
    const body = h('div', { class: 'tab-body' });
    b.append(body);
    if (estateTab === 'furniture') {
      shopBuy(body, 'furniture');
      return;
    }
    const s = G.save;
    for (const r of REALMS) {
      const owned = ownsHouse(r.id);
      const open = r.id < s.unlocked;
      body.append(h('div', { class: 'house-card' + (owned ? ' owned' : '') },
        h('b', { text: r.house.name }), h('small', { text: `${r.city} • interior ${r.house.w}x${r.house.h} tiles` }),
        h('span', { text: owned ? 'OWNED - enter through its front door in ' + r.city : `${r.house.price.toLocaleString()} G` }),
        owned ? null : btn('Buy', () => { const e = buyHouse(r.id); if (e) G.ui.toast(e, 'warn'); G.ui.refresh(); }, 'primary', !open || s.gold < r.house.price)));
    }
    body.append(h('div', { class: 'dim small', text: 'Buy furniture here, then press B inside your house to place it on the grid. The Storage Vault is shared between all houses.' }));
  }, { wide: true });
}

// ================================================================== GATES

export function openGate(): void {
  const s = G.save;
  G.ui.openPanel('gate', 'Teleport Gate', (b) => {
    for (const r of REALMS) {
      const open = r.id < s.unlocked;
      const here = G.world.map.realm === r.id;
      const prevBoss = r.id > 0 ? MONSTERS[REALMS[r.id - 1].boss].name : '';
      b.append(h('div', { class: 'gate-row' + (open ? '' : ' locked') },
        h('div', {}, h('b', { text: r.city }), h('small', { text: ` ${r.cityTitle} • Lv. ${r.levels[0]}-${r.levels[1]}` })),
        open ? btn(here ? 'You are here' : 'Teleport', () => {
          G.ui.closePanel();
          audio.play('teleport');
          G.world.travel(`city:${r.id}`, 'gate');
        }, 'primary', here) : h('span', { class: 'dim', text: `Sealed - defeat ${prevBoss}` })));
    }
  });
}

export function openAbyssGate(): void {
  const s = G.save;
  G.ui.openPanel('abyss', 'Infinite Abyss Labyrinth', (b) => {
    const starts = [1];
    for (let f = 10; f <= s.abyss.checkpoint; f += 10) starts.push(f + 1);
    b.append(h('p', { text: 'Each floor is newly generated. Defeat the Floor Warden to open the stairs. Every 5th floor is a Boss Rush. Floors 10+ drop Abyssal Relic Shards; Boss Rush guardians may drop Mythic Cores.' }),
      h('div', { class: 'dim small', text: `Monster level = 8 + floor. Deepest: ${s.abyss.best}. Modifiers: Molten (burning hits), Vampiric (lifesteal), Arcane-Shielded (regenerating shields), Hasted (faster).` }),
      h('div', { class: 'row wrap' }, ...starts.map((f) => btn(`Enter Floor ${f}`, () => { G.ui.closePanel(); startAbyss(f); }, f === 1 ? 'primary' : ''))));
    const lb = leaderboard();
    const table = h('table', { class: 'market-table' }, h('tr', {}, h('th', { text: '#' }), h('th', { text: 'Diver' }), h('th', { text: 'Level' }), h('th', { text: 'Deepest Floor' }), h('th', { text: 'Date' })));
    lb.forEach((e, i) => table.append(h('tr', {}, h('td', { text: i + 1 }), h('td', { text: e.name }), h('td', { text: e.level }), h('td', { text: e.floor }), h('td', { text: e.date }))));
    b.append(section('Leaderboard', lb.length ? table : h('div', { class: 'dim', text: 'No dives recorded yet.' })));
  });
}

export function openColiseum(): void {
  const s = G.save;
  G.ui.openPanel('coliseum', 'Grand Coliseum Arena', (b) => {
    b.append(h('p', { text: 'Five tournament cups of five rounds each, or endless waves for glory. Falling in the arena carries no death penalty.' }));
    CUPS.forEach((c, i) => b.append(h('div', { class: 'gate-row' }, h('div', {}, h('b', { text: c.name }), h('small', { text: ` Recommended Lv. ${c.level} • Reward ${c.gold.toLocaleString()} G${s.arena.cups[i] ? ' • WON' : ' + trophy'}` })),
      btn('Enter', () => { G.ui.closePanel(); arena.start('cup', i); }, s.arena.cups[i] ? '' : 'primary'))));
    b.append(h('div', { class: 'gate-row' }, h('div', {}, h('b', { text: 'Endless Wave Survival' }), h('small', { text: ` Best wave: ${s.arena.bestWave}` })), btn('Enter', () => { G.ui.closePanel(); arena.start('endless'); }, 'primary')));
  });
}

// ================================================================== VAULT & MOUNTS

export function openVault(): void {
  G.ui.openPanel('vault', 'Storage Vault', (b) => {
    const s = G.save;
    const v = s.vault;
    const used = v.gear.length + Object.keys(v.items).length;
    const inv = h('div', { class: 'grid scroll' });
    for (const g of s.gear) inv.append(gearCell(g, () => {
      if (used >= VAULT_CAPACITY) return G.ui.toast('Vault full.', 'warn');
      s.gear = s.gear.filter((x) => x.uid !== g.uid);
      v.gear.push(g);
      G.ui.refresh();
    }, { compare: false }));
    for (const id of Object.keys(s.items)) inv.append(itemCell(id, s.items[id], () => {
      if (!v.items[id] && used >= VAULT_CAPACITY) return G.ui.toast('Vault full.', 'warn');
      const n = s.items[id];
      removeItem(id, n);
      v.items[id] = (v.items[id] ?? 0) + n;
      G.ui.refresh();
    }));
    const vault = h('div', { class: 'grid scroll' });
    for (const g of v.gear) vault.append(gearCell(g, () => {
      if (s.gear.length >= GEAR_CAPACITY) return G.ui.toast('Inventory full.', 'warn');
      v.gear = v.gear.filter((x) => x.uid !== g.uid);
      s.gear.push(g);
      G.ui.refresh();
    }, { compare: false }));
    for (const id of Object.keys(v.items)) vault.append(itemCell(id, v.items[id], () => {
      addItem(id, v.items[id]);
      delete v.items[id];
      G.ui.refresh();
    }));
    b.append(h('div', { class: 'two-col' }, section('Inventory (click to store)', inv), section(`Vault ${used}/${VAULT_CAPACITY} (click to take)`, vault)));
  }, { wide: true });
}

export function openMount(index: number): void {
  G.ui.openPanel('mount', 'Display', (b) => {
    const house = currentHouse();
    const f = house?.furniture[index];
    if (!f) return;
    const names = f.kind === 'rack' ? ['Weapon 1', 'Weapon 2', 'Weapon 3'] : ['Head', 'Chest', 'Boots', 'Cloak', 'Shield'];
    const slots = h('div', { class: 'eq-grid' }, ...names.map((n, i) => {
      const g = f.mounts[i];
      const w = h('div', { class: 'eq-slot' }, h('small', { text: n }));
      w.append(g ? gearCell(g, () => { const e = unmountGear(index, i); if (e) G.ui.toast(e, 'warn'); G.ui.refresh(); }, { compare: false }) : h('div', { class: 'cell empty' }));
      return w;
    }));
    const eligible = G.save.gear.filter((g) => (f.kind === 'rack' ? g.kind === 'weapon' : g.kind === 'armor'));
    const grid = h('div', { class: 'grid scroll' }, ...eligible.map((g) => gearCell(g, () => {
      let slot = f.kind === 'rack' ? f.mounts.findIndex((m) => !m) : ['head', 'chest', 'boots', 'cloak', 'shield'].indexOf(g.aslot ?? '');
      if (slot < 0) slot = 0;
      const e = mountGear(index, slot, g);
      if (e) G.ui.toast(e, 'warn');
      G.ui.refresh();
    }, { compare: false })));
    b.append(h('div', { class: 'dim small', text: 'Mounted gear is shown on the display exactly as forged. Click a slot to take it back.' }), slots, section('Your gear', grid));
  }, { wide: true });
}

// ================================================================== NPC DIALOGUE

export function openNpc(n: Npc): void {
  const sp = n.spawn;
  const r = city();
  if (sp.role === 'companion' && sp.companion) {
    const c = COMPANION_BY_ID[sp.companion];
    const block = recruitBlocker(c.id);
    G.ui.modal((box, close) => {
      box.append(h('div', { class: 'modal-title', text: `${c.name} - ${c.title}` }), h('p', { class: 'npc-line', text: `"${pick(c.lines)}"` }), h('p', { class: 'dim', text: c.bio }),
        block ? h('div', { class: 'warn small', text: block }) : '',
        h('div', { class: 'row end' }, btn('Goodbye', close, 'ghost'), btn('Recruit', () => {
          const e = recruit(c.id);
          if (e) G.ui.toast(e, 'warn');
          close();
        }, 'primary', !!block)));
    });
    return;
  }
  const lines = sp.role === 'villager' || sp.role === 'guard' ? [...CITY_GOSSIP[r], ...ROLE_LINES[sp.role]] : ROLE_LINES[sp.role];
  const line = lines.length ? pick(lines) : 'Fine day in Aetheria.';
  const actions: [string, () => void][] = [];
  switch (sp.role) {
    case 'smith': actions.push(['Use the Forge', () => openForge(false)]); break;
    case 'merchant': actions.push(['Trade', () => openShop('market')]); break;
    case 'alchemist': actions.push(['Shop & Brew', () => openShop('alchemist')]); break;
    case 'chef': actions.push(['Shop & Cook', () => openShop('general')]); break;
    case 'guild': actions.push(['Guild Hall & Bounties', () => openGuild()]); break;
    case 'realtor': actions.push(['Houses & Furniture', () => openEstate()]); break;
    case 'gatekeeper': actions.push(['Teleport', () => openGate()]); break;
    case 'arena': actions.push(['Coliseum', () => openColiseum()]); break;
    case 'warden': actions.push(['Enter the Abyss', () => openAbyssGate()]); break;
    default: break;
  }
  G.ui.modal((box, close) => {
    box.append(h('div', { class: 'modal-title', text: `${sp.name}, ${ROLE_TITLES[sp.role]}` }), h('p', { class: 'npc-line', text: `"${line}"` }),
      h('div', { class: 'row end' }, btn('Goodbye', close, 'ghost'), ...actions.map(([l, fn]) => btn(l, () => { close(); fn(); }, 'primary'))));
  });
}

// ================================================================== DECORATOR DOCK

let dock: HTMLElement | null = null;

export function openDecorPalette(): void {
  closeDecorPalette();
  const render = () => {
    if (!dock) return;
    dock.innerHTML = '';
    const s = G.save;
    const ids = Object.keys(s.items).filter((id) => ITEMS[id]?.furniture);
    dock.append(h('div', { class: 'dock-title', text: 'Furniture' }));
    if (!ids.length) dock.append(h('div', { class: 'dim small', text: 'You own no furniture. Buy some from any Realtor, or earn boss trophies.' }));
    for (const id of ids) {
      const el = itemCell(id, s.items[id], () => {
        G.game.decorItem = G.game.decorItem === id ? null : id;
        render();
      }, { selected: G.game.decorItem === id });
      dock.append(h('div', { class: 'dock-item' }, el, h('small', { text: itemDef(id).name })));
    }
    dock.append(btn('Exit Decorator (B)', () => G.game.toggleDecor(), 'ghost'));
  };
  dock = h('div', { class: 'dock' });
  G.ui.root.appendChild(dock);
  (dock as HTMLElement & { rerender?: () => void }).rerender = render;
  render();
}

export function refreshDecorPalette(): void {
  const d = dock as (HTMLElement & { rerender?: () => void }) | null;
  d?.rerender?.();
}

export function closeDecorPalette(): void {
  dock?.remove();
  dock = null;
  hideTip();
}
