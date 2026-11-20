// Save slots, the account-wide shared vault, settings and migration of older saves.
// On the desktop build every key is a JSON file in ./saves (see platform/desktop.ts):
// slot_1..3.json, global_vault.json, settings.json, leaderboard.json, last_slot.json.
import type { Appearance, Branch, EquipSlot, GearItem, SaveData, Settings, SlotSummary, WorldMode } from '../types/game';
import { G, DEFAULT_SETTINGS } from '../core/state';
import { BRANCHES } from '../data/constants';
import { starterKit } from '../data/items';
import { REALMS } from '../data/realms';
import { newEconomy } from './economy';
import { store } from '../platform/desktop';

export const SAVE_VERSION = 3;
export const SLOT_COUNT = 3;
export type StarterKit = 'sword_shield' | 'dual' | 'spear' | 'bow' | 'staff';

export const KITS: { id: StarterKit; name: string; desc: string; skill: string; branch: Branch }[] = [
  { id: 'sword_shield', name: 'Sword & Shield', desc: 'Balanced offense with blocks and bashes. Set B: Spear.', skill: 'sw_gale_lunge', branch: 'sword' },
  { id: 'dual', name: 'Dual Blades', desc: 'A blade in each hand for relentless combos. Set B: Longbow.', skill: 'du_twin_cyclone', branch: 'dual' },
  { id: 'spear', name: 'Spear', desc: 'Long reach and sweeping control. Set B: Sword & Shield.', skill: 'sp_comet_thrust', branch: 'spear' },
  { id: 'bow', name: 'Longbow', desc: 'Strike from afar and kite. Set B: Dual Blades.', skill: 'bw_penetrating', branch: 'bow' },
  { id: 'staff', name: 'Arcane Staff', desc: 'Homing bolts and elemental spells. Set B: Sword & Shield.', skill: 'mg_ignis', branch: 'magic' },
];

const key = (slot: number): string => `aetheria.save.${slot}`;

export function newSave(slot: number, name: string, appearance: Appearance, mode: WorldMode, kit: StarterKit): SaveData {
  const k = starterKit();
  const equip: Record<EquipSlot, SaveData['equip'][EquipSlot]> = { mainA: null, offA: null, mainB: null, offB: null, head: null, chest: k.chest, boots: k.boots, cloak: k.cloak };
  const gear: GearItem[] = [];
  switch (kit) {
    case 'sword_shield':
      equip.mainA = k.sword;
      equip.offA = k.shield;
      equip.mainB = k.spear;
      gear.push(k.sword2, k.bow, k.staff);
      break;
    case 'dual':
      equip.mainA = k.sword;
      equip.offA = k.sword2;
      equip.mainB = k.bow;
      gear.push(k.shield, k.spear, k.staff);
      break;
    case 'spear':
      equip.mainA = k.spear;
      equip.mainB = k.sword;
      equip.offB = k.shield;
      gear.push(k.sword2, k.bow, k.staff);
      break;
    case 'bow':
      equip.mainA = k.bow;
      equip.mainB = k.sword;
      equip.offB = k.sword2;
      gear.push(k.shield, k.spear, k.staff);
      break;
    case 'staff':
      equip.mainA = k.staff;
      equip.mainB = k.sword;
      equip.offB = k.shield;
      gear.push(k.sword2, k.spear, k.bow);
      break;
  }
  const kd = KITS.find((x) => x.id === kit) ?? KITS[0];
  const mastery = Object.fromEntries(BRANCHES.map((b) => [b, { rank: 1, xp: 0 }])) as SaveData['mastery'];
  return {
    version: SAVE_VERSION,
    slot,
    name: name.trim().slice(0, 16) || 'Aster',
    appearance,
    mode,
    created: Date.now(),
    playTime: 0,
    level: 1,
    xp: 0,
    gold: 250,
    sp: 1,
    hp: 9999,
    mp: 9999,
    equip,
    activeSet: 'A',
    showHelmet: true,
    gear,
    items: { pot_hp_s: 6, pot_mp_s: 4, food_cutlet: 2, spice: 3, enh_stone: 2 },
    vault: { gear: [], items: {} },
    mastery,
    learned: [kd.skill],
    passives: {},
    hotbar: [kd.skill, null, null, null, null, null],
    quick: ['pot_hp_s', 'pot_mp_s', 'food_cutlet'],
    awakenings: [],
    counters: {
      perfectParries: 0, masterworks: 0, dmgBlocked: 0, kills: 0, bossKills: 0, deaths: 0, forged: 0, lowHpBossWins: 0, gathered: 0, crafted: 0,
      skillConnects: 0, maxChain: 0, novas: 0, wallSlams: 0, reactions: 0, ripostes: 0, sssReached: 0, breakables: 0, fishCaught: 0, treasures: 0,
      eventsWon: 0, caravans: 0, duelsWon: 0, assists: 0, trades: 0, raidsWon: 0, tripleSwitches: 0, chargeSlams: 0, extracted: 0, uniquesFound: 0,
    },
    guilds: { aegis: 0, anvil: 0, wing: 0, arcanum: 0 },
    joined: [],
    bounties: [],
    board: [],
    boardDay: -1,
    companions: {},
    activeCompanion: null,
    houses: {},
    unlocked: mode === 'open' ? 5 : 1,
    bosses: [false, false, false, false, false],
    lastCity: 0,
    map: 'city:0',
    px: 0,
    py: 0,
    time: 8,
    day: 1,
    economy: newEconomy(),
    arena: { cups: [false, false, false, false, false], bestWave: 0 },
    abyss: { best: 0, checkpoint: 0 },
    elitesSlain: [],
    tutorialSeen: false,
    skillRanks: { [kd.skill]: 1 },
    morphs: {},
    keystones: [],
    bridges: [],
    codex: [],
    relics: { weapon: null, armor: null, utility: null },
    wardrobe: [],
    transmog: {},
    dyes: { main: null, accent: null },
    autoSalvage: false,
    party: [],
    gambit: 'assault',
    affinity: {},
    mounts: [],
    mount: null,
    pets: [],
    pet: null,
    achievements: [],
    title: null,
    bestiary: {},
    reactionsSeen: [],
    hunts: [],
    blackMarket: false,
    fish: {},
    raidBosses: [],
    adventurerRep: {},
  };
}

function migrate(d: SaveData): SaveData {
  const fresh = newSave(d.slot, d.name, d.appearance, d.mode, 'sword_shield');
  const out = { ...fresh, ...d } as SaveData;
  out.counters = { ...fresh.counters, ...(d.counters ?? {}) };
  out.mastery = { ...fresh.mastery, ...(d.mastery ?? {}) };
  out.guilds = { ...fresh.guilds, ...(d.guilds ?? {}) };
  out.arena = { ...fresh.arena, ...(d.arena ?? {}) };
  out.abyss = { ...fresh.abyss, ...(d.abyss ?? {}) };
  out.vault = d.vault ?? fresh.vault;
  out.economy = d.economy?.idx?.length === 5 ? d.economy : fresh.economy;
  if (!Array.isArray(out.hotbar) || out.hotbar.length < 6) out.hotbar = [...(out.hotbar ?? []), null, null, null, null, null, null].slice(0, 6);
  // v3: every learned skill starts at rank 1, the single active companion joins the party
  out.skillRanks = { ...(d.skillRanks ?? {}) };
  for (const id of out.learned) if (!out.skillRanks[id]) out.skillRanks[id] = 1;
  out.relics = { ...fresh.relics, ...(d.relics ?? {}) };
  out.dyes = { ...fresh.dyes, ...(d.dyes ?? {}) };
  if (!Array.isArray(d.party)) out.party = d.activeCompanion && d.companions?.[d.activeCompanion]?.recruited ? [d.activeCompanion] : [];
  out.party = out.party.filter((id) => out.companions[id]?.recruited).slice(0, 2);
  out.version = SAVE_VERSION;
  return out;
}

// ------------------------------------------------------------------ account-wide shared vault

const VAULT_KEY = 'aetheria.vault';

/** the 100-slot vault is shared by every character on this PC (global_vault.json) */
function loadSharedVault(fallback: SaveData['vault']): SaveData['vault'] {
  try {
    const raw = store.get(VAULT_KEY);
    if (raw) {
      const v = JSON.parse(raw) as SaveData['vault'];
      return { gear: Array.isArray(v.gear) ? v.gear : [], items: v.items ?? {} };
    }
  } catch {
    /* corrupt vault file: fall back to the character's own copy */
  }
  return fallback;
}

function saveSharedVault(v: SaveData['vault']): void {
  store.set(VAULT_KEY, JSON.stringify(v));
}

export function saveGame(): boolean {
  const s = G.save;
  if (!s) return false;
  const p = G.player;
  const m = G.world?.map;
  if (m && (m.kind === 'city' || m.kind === 'wild' || m.kind === 'house')) {
    s.map = m.id;
    s.px = p.x;
    s.py = p.y;
  } else {
    s.map = `city:${s.lastCity}`;
    s.px = 0;
    s.py = 0;
  }
  s.hp = p.hp;
  s.mp = p.mp;
  if (s.slot < 0) return false;
  try {
    saveSharedVault(s.vault);
    const ok = store.set(key(s.slot), JSON.stringify({ ...s, vault: { gear: [], items: {} } }));
    store.set('aetheria.lastSlot', String(s.slot));
    return ok;
  } catch {
    return false;
  }
}

function readSlot(slot: number): SaveData | null {
  try {
    const raw = store.get(key(slot));
    if (!raw) return null;
    return migrate(JSON.parse(raw) as SaveData);
  } catch {
    return null;
  }
}

export function loadGame(slot: number): SaveData | null {
  const d = readSlot(slot);
  if (d) d.vault = loadSharedVault(d.vault);
  return d;
}

export function slotSummary(slot: number): SlotSummary | null {
  const d = readSlot(slot);
  if (!d) return null;
  const [kind, arg] = d.map.split(':');
  const r = REALMS[Number(arg) || 0];
  const loc = kind === 'city' ? r.city : kind === 'wild' ? r.short : kind === 'house' ? r.house.name : r.city;
  return { slot, name: d.name, level: d.level, location: loc, playTime: d.playTime, mode: d.mode, saved: d.created };
}

export function lastSlot(): number | null {
  try {
    const v = store.get('aetheria.lastSlot');
    if (v === null) return null;
    const n = Number(v);
    return readSlot(n) ? n : null;
  } catch {
    return null;
  }
}

export function deleteSlot(slot: number): void {
  store.remove(key(slot));
}

export function loadSettings(): Settings {
  try {
    const raw = store.get('aetheria.settings');
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  store.set('aetheria.settings', JSON.stringify(s));
}
