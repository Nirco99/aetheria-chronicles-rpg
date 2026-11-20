// Character window: equipment (live paper-doll), inventory, mastery & skills, awakenings,
// guilds, companions and the realm atlas.
import type { CompanionSlot, EquipSlot, GearItem, ItemCategory } from '../types/game';
import { G } from '../core/state';
import { ACTIVE_RANKS, BRANCHES, BRANCH_INFO, GEAR_CAPACITY, HOTBAR_SIZE, QUICK_KEYS, masteryToNext, RARITY_COLORS } from '../data/constants';
import { AWAKENINGS, passivesOfBranch, skillsOfBranch } from '../data/skills';
import { GUILDS, GUILD_IDS, GUILD_RANKS, GUILD_REP, COMPANIONS, COMPANION_BY_ID, guildRank } from '../data/guilds';
import { REALMS } from '../data/realms';
import { ITEMS, gearTitle, isBlade, itemDef } from '../data/items';
import { CUPS } from '../systems/arena';
import { equipGear, unequip, useConsumable, isEquipped } from '../systems/inventory';
import { abandonBounty, bountyReady, dismissCompanion, recruit } from '../systems/guilds';
import { ownsHouse } from '../systems/housing';
import { drawHumanoid, previewAnim } from '../render/paperdoll';
import { skillIconURL } from '../render/icons';
import { audio } from '../engine/audio';
import { h, btn, gearCell, itemCell, section, tip } from './dom';
import type { Dir } from '../types/game';

const TABS: [string, string][] = [
  ['equipment', 'Equipment'], ['inventory', 'Inventory'], ['mastery', 'Mastery & Skills'], ['awakenings', 'Awakenings'],
  ['guilds', 'Guilds & Bounties'], ['companions', 'Companions'], ['atlas', 'Realm Atlas'],
];

let tab = 'equipment';
let selGear: string | null = null;
let itemCat: ItemCategory = 'consumable';
let gearFilter: 'all' | 'weapon' | 'armor' = 'all';
let compSel: string | null = null;

export function openCharacter(t = 'equipment'): void {
  tab = t;
  G.ui.openPanel('character', 'Character', (b) => {
    const tabs = h('div', { class: 'tabs' }, ...TABS.map(([id, name]) => h('button', { class: 'tab' + (tab === id ? ' on' : ''), text: name, onclick: () => { tab = id; selGear = null; G.ui.refresh(); } })));
    const body = h('div', { class: 'tab-body' });
    b.append(tabs, body);
    switch (tab) {
      case 'equipment': equipmentTab(body); break;
      case 'inventory': inventoryTab(body); break;
      case 'mastery': masteryTab(body); break;
      case 'awakenings': awakeningsTab(body); break;
      case 'guilds': guildsTab(body); break;
      case 'companions': companionsTab(body); break;
      default: atlasTab(body);
    }
  }, { wide: true });
}

function previewCanvas(): HTMLCanvasElement {
  const c = h('canvas', { class: 'doll' });
  c.width = 300;
  c.height = 380;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const t0 = performance.now();
  const loop = () => {
    if (!c.isConnected) return;
    const t = (performance.now() - t0) / 1000;
    const p = G.player;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 300, 380);
    const grd = ctx.createRadialGradient(150, 300, 10, 150, 260, 200);
    grd.addColorStop(0, 'rgba(127,233,255,0.22)');
    grd.addColorStop(1, 'rgba(10,16,32,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 300, 380);
    const dir = ([0, 3, 1, 2] as Dir[])[Math.floor(t / 2) % 4];
    const aim = [Math.PI / 2, 0, -Math.PI / 2, Math.PI][[0, 3, 1, 2].indexOf(dir)];
    ctx.setTransform(3.6, 0, 0, 3.6, 150, 330);
    drawHumanoid(ctx, 0, 0, p.look, previewAnim(t), dir, { aim, moving: false, vx: 0, vy: 0, t });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return c;
}

function slotCell(slot: EquipSlot, label: string): HTMLElement {
  const g = G.save.equip[slot];
  const wrap = h('div', { class: 'eq-slot' }, h('small', { text: label }));
  if (g) wrap.appendChild(gearCell(g, () => {
    const err = unequip(slot);
    if (err) G.ui.toast(err, 'warn');
    G.ui.refresh();
  }, { compare: false }));
  else wrap.appendChild(h('div', { class: 'cell empty' }));
  return wrap;
}

function equipmentTab(b: HTMLElement): void {
  const s = G.save;
  const p = G.player;
  const st = p.stats;
  const helm = h('input', { type: 'checkbox', checked: s.showHelmet });
  helm.addEventListener('change', () => {
    s.showHelmet = helm.checked;
    p.refresh();
  });
  const left = h('div', { class: 'eq-left' },
    previewCanvas(),
    h('label', { class: 'check' }, helm, h('span', { text: ' Show Helmet (keep its stats either way)' })),
    h('div', { class: 'eq-grid' },
      slotCell('mainA', 'Set A Main'), slotCell('offA', 'Set A Off'), slotCell('mainB', 'Set B Main'), slotCell('offB', 'Set B Off'),
      slotCell('head', 'Head'), slotCell('chest', 'Chest'), slotCell('boots', 'Boots'), slotCell('cloak', 'Cloak')),
    h('div', { class: 'stats' },
      ...([['Max HP', st.maxHp], ['Max MP', st.maxMp], ['ATK', Math.round(st.atk)], ['DEF', Math.round(st.def)], ['MAG', Math.round(st.mag)],
        ['Crit', `${Math.round(st.crit * 100)}%`], ['Crit Dmg', `${Math.round(st.critDmg * 100)}%`], ['Atk Speed', `${Math.round(st.aspd * 100)}%`],
        ['Move', `${Math.round(st.move * 100)}%`], ['Break', `+${Math.round(st.brk)}`], ['XP Gain', `${Math.round(st.xpMult * 100)}%`]] as [string, string | number][])
        .map(([k, v]) => h('div', { class: 'stat' }, h('span', { text: k }), h('b', { text: String(v) })))),
    h('div', { class: 'dim small', text: `Active set: ${s.activeSet} (press Q to swap). Branches usable now: ${[...p.branches].map((x) => BRANCH_INFO[x].name).join(', ') || 'none'}` }));
  const list = s.gear.filter((g) => gearFilter === 'all' || g.kind === gearFilter);
  const grid = h('div', { class: 'grid scroll' }, ...list.map((g) => gearCell(g, () => { selGear = g.uid; G.ui.refresh(); }, { selected: selGear === g.uid })));
  const sel = s.gear.find((g) => g.uid === selGear) ?? null;
  const actions = h('div', { class: 'actions' });
  if (sel) {
    actions.append(h('div', { class: 'sel-name', text: gearTitle(sel), style: `color:${RARITY_COLORS[sel.rarity]}` }));
    const doEquip = (target: 'main' | 'off', set?: 'A' | 'B') => {
      const err = equipGear(sel, target, set);
      if (err) G.ui.toast(err, 'warn');
      selGear = null;
      G.ui.refresh();
    };
    if (sel.kind === 'weapon') {
      actions.append(btn(`Equip (Set ${s.activeSet})`, () => doEquip('main'), 'primary'));
      if (isBlade(sel)) actions.append(btn('Equip Off-hand', () => doEquip('off')));
      actions.append(btn(`Equip to Set ${s.activeSet === 'A' ? 'B' : 'A'}`, () => doEquip('main', s.activeSet === 'A' ? 'B' : 'A')));
    } else if (sel.aslot === 'shield') {
      actions.append(btn('Equip Shield', () => doEquip('off'), 'primary'), btn(`Equip to Set ${s.activeSet === 'A' ? 'B' : 'A'}`, () => doEquip('off', s.activeSet === 'A' ? 'B' : 'A')));
    } else actions.append(btn('Equip', () => doEquip('main'), 'primary'));
    const c = G.world.companion;
    if (c) actions.append(btn(`Give to ${c.def.name}`, () => giveToCompanion(c.def.id, sel)));
  } else actions.append(h('div', { class: 'dim', text: 'Select an item to equip it. Click an equipped slot to unequip. Salvage gear at any forge.' }));
  const right = h('div', { class: 'eq-right' },
    h('div', { class: 'row' }, h('b', { text: `Gear ${s.gear.length}/${GEAR_CAPACITY}` }),
      ...(['all', 'weapon', 'armor'] as const).map((f) => h('button', { class: 'chip' + (gearFilter === f ? ' on' : ''), text: f === 'all' ? 'All' : f === 'weapon' ? 'Weapons' : 'Armor', onclick: () => { gearFilter = f; G.ui.refresh(); } }))),
    grid, actions);
  b.append(h('div', { class: 'two-col' }, left, right));
}

function slotForCompanion(g: GearItem): CompanionSlot | null {
  if (g.kind === 'weapon') return 'main';
  if (g.aslot === 'shield') return 'off';
  return (g.aslot as CompanionSlot) ?? null;
}

function giveToCompanion(id: string, g: GearItem, slotOverride?: CompanionSlot): void {
  const cs = G.save.companions[id];
  const def = COMPANION_BY_ID[id];
  if (!cs) return;
  const slot = slotOverride ?? slotForCompanion(g);
  if (!slot) return;
  if (slot === 'main' && g.wtype !== def.weapon && !(def.weapon === 'sword' && g.wtype === 'twinblade') && !(def.weapon === 'halberd' && g.wtype === 'spear') && !(def.weapon === 'spear' && g.wtype === 'halberd')) {
    G.ui.toast(`${def.name} only fights with a ${def.weapon === 'sword' ? 'blade' : def.weapon}.`, 'warn');
    return;
  }
  if (slot === 'off' && g.aslot === 'shield' && def.off !== 'shield') {
    G.ui.toast(`${def.name} does not use a shield.`, 'warn');
    return;
  }
  const i = G.save.gear.findIndex((x) => x.uid === g.uid);
  if (i < 0) return;
  G.save.gear.splice(i, 1);
  const old = cs.equip[slot];
  cs.equip[slot] = g;
  if (old) G.save.gear.push(old);
  for (const pc of G.world.party) pc.refresh();
  audio.play('ui');
  G.ui.toast(`${def.name} equipped ${gearTitle(g)}.`, 'info');
  selGear = null;
  G.ui.refresh();
}

function inventoryTab(b: HTMLElement): void {
  const s = G.save;
  const cats: [ItemCategory, string][] = [['consumable', 'Potions & Oils'], ['food', 'Food'], ['material', 'Materials'], ['gem', 'Gems'], ['furniture', 'Furniture'], ['trophy', 'Trophies']];
  const ids = Object.keys(s.items).filter((id) => ITEMS[id] && ITEMS[id].cat === itemCat).sort((a, c) => itemDef(a).name.localeCompare(itemDef(c).name));
  const grid = h('div', { class: 'grid scroll' }, ...ids.map((id) => {
    const usable = !!itemDef(id).effect || id === 'treasure_map';
    const cell = itemCell(id, s.items[id], () => {
      if (usable && useConsumable(id)) G.ui.refresh();
    }, { extra: id === 'treasure_map' ? '<div class="tt-note">Click to read the map and mark a dig site.</div>' : usable ? '<div class="tt-note">Click to use. Assign to a quick slot below.</div>' : '' });
    return cell;
  }));
  const quick = h('div', { class: 'quick-assign' }, h('b', { text: 'Quick slots: ' }), ...QUICK_KEYS.map((k, i) => {
    const sel = h('select', { class: 'select' }) as HTMLSelectElement;
    sel.appendChild(h('option', { value: '', text: '(empty)' }));
    for (const id of Object.keys(ITEMS).filter((x) => ITEMS[x].effect)) {
      const o = h('option', { value: id, text: `${itemDef(id).name} (${s.items[id] ?? 0})` });
      if (s.quick[i] === id) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      s.quick[i] = sel.value || null;
      G.ui.refresh();
    });
    return h('span', { class: 'qa' }, h('kbd', { text: k }), sel);
  }));
  const salvage = h('input', { type: 'checkbox', checked: s.autoSalvage }) as HTMLInputElement;
  salvage.addEventListener('change', () => {
    s.autoSalvage = salvage.checked;
    G.ui.toast(s.autoSalvage ? 'Smart Auto-Salvage on: Common and Uncommon drops (except set pieces and uniques) become materials.' : 'Smart Auto-Salvage off.', 'info');
  });
  b.append(
    h('div', { class: 'tabs small' }, ...cats.map(([c, n]) => h('button', { class: 'tab' + (itemCat === c ? ' on' : ''), text: n, onclick: () => { itemCat = c; G.ui.refresh(); } }))),
    ids.length ? grid : h('div', { class: 'dim pad', text: 'Nothing here yet.' }),
    quick,
    h('label', { class: 'check', title: 'Common and Uncommon gear is salvaged into ingots and Arcane Dust the moment you pick it up.' }, salvage, h('span', { text: ' Smart Auto-Salvage (Common & Uncommon drops become ingots and Arcane Dust)' })),
  );
}

function masteryTab(b: HTMLElement): void {
  const s = G.save;
  b.append(h('div', { class: 'sp-line' }, h('b', { text: `Skill Points: ${s.sp}` }), h('span', { class: 'dim', text: '  Earn 1 SP per character level and per branch Mastery Rank. Ranks rise as you fight with a branch\'s weapons.' })));
  const hot = h('div', { class: 'hotbar-edit' }, h('b', { text: 'Hotbar: ' }), ...s.hotbar.map((id, i) => {
    const cell = h('div', { class: 'hb-cell' }, h('kbd', { text: String(i + 1) }), id ? h('img', { src: skillIconURL(id) }) : null);
    if (id) tip(cell, `<b>${skillsOfBranch(BRANCHES.find((br) => skillsOfBranch(br).some((x) => x.id === id)) ?? 'sword').find((x) => x.id === id)?.name ?? ''}</b><div class="dim">Click to clear</div>`);
    cell.addEventListener('click', () => {
      s.hotbar[i] = null;
      G.ui.refresh();
    });
    return cell;
  }));
  b.append(hot);
  const wrap = h('div', { class: 'mastery scroll' });
  for (const br of BRANCHES) {
    const m = s.mastery[br];
    const need = masteryToNext(m.rank);
    const usable = G.player.branches.has(br);
    const col = h('div', { class: 'branch' + (usable ? ' usable' : '') },
      h('div', { class: 'branch-head', style: `border-color:${BRANCH_INFO[br].color}` },
        h('b', { text: BRANCH_INFO[br].name, style: `color:${BRANCH_INFO[br].color}` }),
        h('span', { text: `Rank ${m.rank}` }),
        h('div', { class: 'xpbar' }, h('div', { style: `width:${Math.min(100, (m.xp / need) * 100)}%;background:${BRANCH_INFO[br].color}` })),
        h('small', { class: 'dim', text: BRANCH_INFO[br].req })));
    skillsOfBranch(br).forEach((sk, idx) => {
      const learned = s.learned.includes(sk.id);
      const canLearn = !learned && m.rank >= sk.rank && s.sp >= sk.sp;
      const row = h('div', { class: 'skill-row' + (learned ? ' learned' : '') },
        h('img', { src: skillIconURL(sk.id) }),
        h('div', { class: 'skill-info' }, h('b', { text: sk.name }), h('small', { text: `Rank ${ACTIVE_RANKS[idx]} • ${sk.mp} MP • ${sk.cd}s` })));
      tip(row, `<div class="tt-title" style="color:${sk.color}">${sk.name}</div><div class="tt-sub">${BRANCH_INFO[br].name} • Active</div><div class="tt-desc">${sk.desc}</div><div class="stat"><span>Cost</span><b>${sk.mp} MP</b></div><div class="stat"><span>Cooldown</span><b>${sk.cd}s</b></div><div class="stat"><span>Unlock</span><b>Rank ${sk.rank} • ${sk.sp} SP</b></div>`);
      if (learned) {
        const slots = h('div', { class: 'slot-btns' }, ...Array.from({ length: HOTBAR_SIZE }, (_, i) => h('button', {
          class: 'mini' + (s.hotbar[i] === sk.id ? ' on' : ''), text: String(i + 1), title: `Assign to hotbar slot ${i + 1}`,
          onclick: () => {
            for (let j = 0; j < HOTBAR_SIZE; j++) if (s.hotbar[j] === sk.id) s.hotbar[j] = null;
            s.hotbar[i] = sk.id;
            audio.play('ui');
            G.ui.refresh();
          },
        })));
        row.appendChild(slots);
      } else {
        row.appendChild(btn(m.rank < sk.rank ? `Rank ${sk.rank}` : `Learn (${sk.sp} SP)`, () => {
          s.sp -= sk.sp;
          s.learned.push(sk.id);
          s.skillRanks[sk.id] = 1;
          const free = s.hotbar.indexOf(null);
          if (free >= 0) s.hotbar[free] = sk.id;
          audio.play('levelup');
          G.ui.toast(`Learned ${sk.name}!${free >= 0 ? ` Assigned to slot ${free + 1}.` : ''}`, 'mastery');
          G.ui.refresh();
        }, 'mini-btn', !canLearn));
      }
      col.appendChild(row);
    });
    for (const ps of passivesOfBranch(br)) {
      const lvl = s.passives[ps.id] ?? 0;
      const can = lvl < ps.max && m.rank >= ps.rank && s.sp >= 1;
      const row = h('div', { class: 'skill-row passive' + (lvl > 0 ? ' learned' : '') },
        h('img', { src: skillIconURL(ps.id) }),
        h('div', { class: 'skill-info' }, h('b', { text: `${ps.name} ${lvl}/${ps.max}` }), h('small', { text: `Passive • Rank ${ps.rank}` })),
        btn(lvl >= ps.max ? 'Max' : m.rank < ps.rank ? `Rank ${ps.rank}` : '+1 (1 SP)', () => {
          s.sp -= 1;
          s.passives[ps.id] = lvl + 1;
          G.player.refresh();
          audio.play('buff');
          G.ui.refresh();
        }, 'mini-btn', !can));
      tip(row, `<div class="tt-title">${ps.name}</div><div class="tt-sub">${BRANCH_INFO[br].name} • Passive</div><div class="tt-desc">${ps.desc}</div><div class="tt-note">Branch passives apply while that branch's weapons are equipped.</div>`);
      col.appendChild(row);
    }
    wrap.appendChild(col);
  }
  b.append(wrap);
}

function awakeningsTab(b: HTMLElement): void {
  const s = G.save;
  const c = s.counters;
  const prog: Record<string, string> = {
    aw_dual: `Sword Mastery Rank ${s.mastery.sword.rank}/10 • Perfect Parries ${c.perfectParries}/15`,
    aw_smith: `Masterwork/Supreme items forged ${c.masterworks}/5`,
    aw_aegis: `Boss wins below 15% HP ${c.lowHpBossWins}/1 • Damage blocked ${Math.floor(c.dmgBlocked)}/2,000`,
  };
  b.append(h('p', { class: 'dim', text: 'Unique Skills cannot be learned with Skill Points. The system grants them to those who meet hidden milestones.' }));
  for (const a of AWAKENINGS) {
    const on = s.awakenings.includes(a.id);
    b.append(h('div', { class: 'aw-card' + (on ? ' on' : '') }, h('b', { text: on ? a.name : 'Sealed Unique Skill' }), h('p', { text: on ? a.desc : `Hint: ${a.trigger}` }), h('small', { class: 'dim', text: prog[a.id] })));
  }
  b.append(section('Lifetime Records', h('div', { class: 'stats' },
    ...([['Monsters slain', c.kills], ['Bosses defeated', c.bossKills], ['Perfect Parries', c.perfectParries], ['Damage blocked', Math.floor(c.dmgBlocked)], ['Items forged', c.forged],
      ['Masterworks', c.masterworks], ['Resources gathered', c.gathered], ['Recipes crafted', c.crafted], ['Deaths', c.deaths]] as [string, number][])
      .map(([k, v]) => h('div', { class: 'stat' }, h('span', { text: k }), h('b', { text: v.toLocaleString() }))))));
}

function guildsTab(b: HTMLElement): void {
  const s = G.save;
  const cards = h('div', { class: 'guild-cards' });
  for (const gid of GUILD_IDS) {
    const g = GUILDS[gid];
    const joined = s.joined.includes(gid);
    const rep = s.guilds[gid];
    const r = guildRank(rep);
    const next = GUILD_REP[r + 1];
    cards.appendChild(h('div', { class: 'guild-card', style: `border-color:${g.color}` },
      h('b', { text: g.name, style: `color:${g.color}` }),
      h('i', { class: 'dim', text: `"${g.motto}"` }),
      h('div', { text: joined ? `Rank: ${GUILD_RANKS[r]} • ${rep} reputation${next ? ` (next at ${next})` : ' (max)'}` : 'Not a member - join at any Guild Hall.' }),
      h('small', { text: `Perk: ${g.perk}` }),
      h('small', { class: 'dim', text: `Hall: ${REALMS[g.hall].city}` })));
  }
  b.append(cards);
  const list = h('div', { class: 'bounties' });
  if (!s.bounties.length) list.append(h('div', { class: 'dim', text: 'No active bounties. Visit a Guild Hall board to accept some.' }));
  for (const bo of s.bounties) {
    const ready = bountyReady(bo);
    list.append(h('div', { class: 'bounty' + (ready ? ' ready' : '') },
      h('b', { text: bo.title, style: `color:${GUILDS[bo.guild].color}` }), h('span', { text: bo.desc }),
      h('small', { text: `${ready ? 'READY - turn in at a Guild Hall' : `Progress ${bo.kind === 'gather' ? Math.min(s.items[bo.target] ?? 0, bo.count) : bo.progress}/${bo.count}`} • ${bo.gold} G • ${bo.xp} XP • ${bo.rep} rep` }),
      btn('Abandon', () => { abandonBounty(bo.id); G.ui.refresh(); }, 'mini-btn ghost')));
  }
  b.append(section('Active Bounties', list));
}

function companionsTab(b: HTMLElement): void {
  const s = G.save;
  const rec = COMPANIONS.filter((c) => s.companions[c.id]?.recruited);
  if (!rec.length) {
    b.append(h('div', { class: 'dim pad', text: 'No companions yet. Meet them in the cities (look for the cyan names) and recruit them at their Guild Hall.' }));
  }
  const listEl = h('div', { class: 'comp-list' });
  for (const c of COMPANIONS) {
    const r = s.companions[c.id]?.recruited;
    const active = s.party.includes(c.id);
    listEl.append(h('div', { class: 'comp' + (active ? ' on' : '') + (r ? '' : ' locked'), onclick: () => { if (r) { compSel = c.id; G.ui.refresh(); } } },
      h('b', { text: c.name }), h('small', { text: c.title }), h('small', { class: 'dim', text: r ? (active ? 'In your party' : 'Recruited') : `Found in ${REALMS[c.city].city}` })));
  }
  b.append(listEl);
  const id = compSel && s.companions[compSel]?.recruited ? compSel : s.party[0] ?? null;
  if (!id) return;
  const def = COMPANION_BY_ID[id];
  const cs = s.companions[id];
  const slots: CompanionSlot[] = ['main', 'off', 'head', 'chest', 'boots', 'cloak'];
  const eq = h('div', { class: 'eq-grid' }, ...slots.map((sl) => {
    const g = cs.equip[sl];
    const wrap = h('div', { class: 'eq-slot' }, h('small', { text: sl }));
    wrap.append(g ? gearCell(g, () => {
      if (G.save.gear.length >= GEAR_CAPACITY) return G.ui.toast('Inventory full.', 'warn');
      cs.equip[sl] = null;
      G.save.gear.push(g);
      for (const pc of G.world.party) pc.refresh();
      G.ui.refresh();
    }, { compare: false }) : h('div', { class: 'cell empty' }));
    return wrap;
  }));
  const giveGrid = h('div', { class: 'grid scroll small' }, ...s.gear.filter((g) => !isEquipped(g.uid)).map((g) => gearCell(g, () => giveToCompanion(id, g), { compare: false })));
  b.append(section(`${def.name} - ${def.title}`,
    h('p', { class: 'dim', text: def.bio }),
    h('div', { class: 'row' },
      s.party.includes(id) ? btn('Dismiss from party', () => { dismissCompanion(id); G.ui.refresh(); }, 'ghost') : btn(`Summon to party (${s.party.length}/2)`, () => { const e = recruit(id); if (e) G.ui.toast(e, 'warn'); G.ui.refresh(); }, 'primary'),
      h('span', { class: 'dim', text: `Synchronized Chain Skill: ${def.chain}` })),
    h('div', { class: 'dim small', text: 'Click an equipped piece to take it back; click an item below to give it.' }),
    eq, giveGrid));
}

function atlasTab(b: HTMLElement): void {
  const s = G.save;
  for (const r of REALMS) {
    const open = r.id < s.unlocked;
    b.append(h('div', { class: 'atlas' + (open ? '' : ' locked') },
      h('div', { class: 'atlas-head' }, h('b', { text: `${r.id + 1}. ${r.name}` }), h('span', { text: `Lv. ${r.levels[0]}-${r.levels[1]}${open ? '' : ' • SEALED'}` })),
      h('p', { text: r.desc }),
      h('small', { text: `City: ${r.city} (${r.cityTitle}) • Dungeon: ${r.dungeon} • Boss: ${s.bosses[r.id] ? 'DEFEATED' : 'undefeated'} • House: ${r.house.name} (${r.house.price.toLocaleString()} G)${ownsHouse(r.id) ? ' - OWNED' : ''}` })));
  }
  b.append(section('Endgame', h('div', { text: `Infinite Abyss deepest floor: ${s.abyss.best} • checkpoint: ${s.abyss.checkpoint}` }),
    h('div', { text: `Coliseum cups: ${CUPS.map((c, i) => `${c.name} ${s.arena.cups[i] ? '✔' : '✗'}`).join(' • ')} • Endless best wave: ${s.arena.bestWave}` })));
}
