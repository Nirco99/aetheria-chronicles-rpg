// Bestiary: regular monsters, night elites, dungeon guardians and the five multi-phase realm bosses.
import type { BossDef, HumanoidStyle, MonsterAttackDef, MonsterDef } from '../types/game';

type A = Partial<MonsterAttackDef> & { id: string };
const atk = (o: A): MonsterAttackDef => ({
  range: 50, cd: 1.6, windup: 0.4, recover: 0.4, shape: 'cone', r: 54, arc: 1.4, mult: 1, ...o,
});

const bite = (o: Partial<A> = {}) => atk({ id: 'bite', name: 'Bite', range: 42, cd: 1.1, windup: 0.32, r: 50, arc: 1.3, ...o });
const swipe = (o: Partial<A> = {}) => atk({ id: 'swipe', name: 'Swipe', range: 52, cd: 1.4, windup: 0.42, r: 62, arc: 1.9, ...o });

function humanoid(o: Partial<HumanoidStyle>): HumanoidStyle {
  return {
    skin: '#cfa98a', hair: '#2a2a33', hairStyle: 0, eyes: '#ff3b3b',
    chest: null, helmet: null, boots: null, cloak: null, weapon: 'sword', weaponColor: '#9aa3ad', off: null, ...o,
  };
}

const M: Record<string, MonsterDef> = {};
function mon(d: MonsterDef): void {
  M[d.id] = d;
}

// ================================================================== REALM 1
mon({
  id: 'dire_wolf', name: 'Dire Wolf', draw: 'wolf', realm: 0, hp: 0.9, atk: 1, def: 0.8, speed: 1.55, size: 13, poise: 0.8, xp: 1, aggro: 210,
  colors: ['#6b6f7a', '#3e414a', '#c9ccd4'],
  attacks: [bite(), atk({ id: 'lunge', name: 'Lunge', range: 150, cd: 3.6, windup: 0.55, shape: 'line', len: 130, w: 26, dash: 120, mult: 1.3 })],
  drops: [{ id: 'wolf_pelt', chance: 0.55 }],
});
mon({
  id: 'frenzy_boar', name: 'Frenzy Boar', draw: 'boar', realm: 0, hp: 1.3, atk: 1.1, def: 1.1, speed: 1.2, size: 15, poise: 1.2, xp: 1.15, aggro: 170,
  colors: ['#7a5240', '#4a3024', '#efe3c8'],
  attacks: [atk({ id: 'gore', name: 'Gore', range: 46, cd: 1.4, windup: 0.4, r: 52, arc: 1.2, mult: 1.1 }), atk({ id: 'charge', name: 'Charge', range: 230, cd: 4.2, windup: 0.8, shape: 'line', len: 230, w: 34, dash: 220, mult: 1.6, kb: 220 })],
  drops: [{ id: 'boar_meat', chance: 0.75, min: 1, max: 2 }, { id: 'wolf_pelt', chance: 0.12 }],
});
mon({
  id: 'kobold_scout', name: 'Kobold Scout', draw: 'kobold', realm: 0, hp: 0.8, atk: 0.9, def: 0.9, speed: 1.1, size: 11, poise: 0.8, xp: 1, aggro: 240, ranged: true, keepDistance: 140,
  colors: ['#b0763f', '#6b4423', '#5a7a3a'],
  attacks: [atk({ id: 'sling', name: 'Sling', range: 270, cd: 1.9, windup: 0.45, shape: 'proj', mult: 0.9, proj: { kind: 'rock', speed: 300, mult: 0.9, range: 320 } }), bite({ id: 'stab', name: 'Stab', mult: 0.9 })],
  drops: [{ id: 'kobold_fang', chance: 0.6 }, { id: 'ore_copper', chance: 0.15 }],
});
mon({
  id: 'kobold_trooper', name: 'Kobold Trooper', draw: 'kobold', realm: 0, hp: 1.1, atk: 1.1, def: 1.2, speed: 1.05, size: 12, poise: 1.1, xp: 1.1, aggro: 220,
  colors: ['#9a6a3a', '#5a3a1f', '#3f5f9a'],
  attacks: [atk({ id: 'thrust', name: 'Thrust', range: 70, cd: 1.5, windup: 0.45, shape: 'line', len: 82, w: 22 }), swipe({ id: 'sweep', name: 'Sweep', windup: 0.6, mult: 1.1 })],
  drops: [{ id: 'kobold_fang', chance: 0.6 }, { id: 'ore_iron', chance: 0.25 }],
});
mon({
  id: 'kobold_sentinel', name: 'Kobold Sentinel', draw: 'kobold', realm: 0, hp: 1.8, atk: 1.2, def: 1.6, speed: 0.85, size: 14, poise: 1.8, xp: 1.5, aggro: 230,
  colors: ['#8a5a2f', '#4a2f17', '#7a8a9a'],
  attacks: [swipe({ id: 'halberd', name: 'Halberd Sweep', range: 62, r: 76, arc: 2.2, windup: 0.7, mult: 1.4 }), atk({ id: 'overhead', name: 'Overhead Chop', range: 80, cd: 2.6, windup: 0.8, shape: 'line', len: 92, w: 30, mult: 1.7 })],
  drops: [{ id: 'ore_iron', chance: 0.4 }, { id: 'kobold_fang', chance: 0.5 }, { id: 'enh_stone', chance: 0.06 }],
});
mon({
  id: 'elite_thornback', name: 'Thornback, the Night Alpha', title: 'Named Elite', draw: 'wolf', realm: 0, hp: 7, atk: 1.5, def: 1.3, speed: 1.6, size: 20, poise: 4, xp: 6, aggro: 320, elite: true,
  colors: ['#2a2a3a', '#14141e', '#ff4d6a'],
  attacks: [bite({ mult: 1.2, r: 64 }), atk({ id: 'lunge', name: 'Rending Lunge', range: 180, cd: 3, windup: 0.5, shape: 'line', len: 170, w: 34, dash: 160, mult: 1.5 }), atk({ id: 'howl', name: 'Night Howl', range: 110, cd: 6, windup: 0.9, shape: 'circle', at: 'self', r: 130, mult: 1.2, status: { kind: 'stun', dur: 0.8, chance: 0.6 } })],
  drops: [{ id: 'wolf_pelt', chance: 1, min: 3, max: 5 }, { id: 'enh_stone', chance: 0.6 }],
});

// ================================================================== REALM 2
mon({
  id: 'treant_guardian', name: 'Treant Guardian', draw: 'treant', realm: 1, hp: 2, atk: 1.15, def: 1.4, speed: 0.7, size: 17, poise: 2, xp: 1.4, aggro: 190,
  colors: ['#4a3a2a', '#2f6b4a', '#7fffd0'],
  attacks: [atk({ id: 'rootslam', name: 'Root Slam', range: 70, cd: 4, windup: 0.9, shape: 'circle', at: 'self', r: 84, mult: 1.5, status: { kind: 'root', dur: 1.2 } }), swipe({ id: 'branch', name: 'Branch Swipe', r: 72, arc: 2.0, windup: 0.55, mult: 1.1 })],
  drops: [{ id: 'treant_bark', chance: 0.7 }, { id: 'herb_lotus', chance: 0.2 }],
});
mon({
  id: 'venom_stalker', name: 'Venom Stalker', draw: 'spider', realm: 1, hp: 1, atk: 1.1, def: 0.9, speed: 1.45, size: 13, poise: 1, xp: 1.1, aggro: 220,
  colors: ['#2a3a2a', '#141e14', '#8ee05d'],
  attacks: [bite({ status: { kind: 'poison', dur: 4, chance: 0.6 } }), atk({ id: 'pounce', name: 'Pounce', range: 150, cd: 3.5, windup: 0.5, shape: 'line', len: 140, w: 28, dash: 140, mult: 1.3 }), atk({ id: 'spit', name: 'Venom Spit', range: 240, cd: 3, windup: 0.4, shape: 'proj', mult: 0.9, proj: { kind: 'spit', speed: 280, mult: 0.9, range: 280, status: { kind: 'poison', dur: 4, chance: 0.8 } } })],
  drops: [{ id: 'venom_sac', chance: 0.6 }],
});
mon({
  id: 'water_elemental', name: 'Water Elemental', draw: 'elemental', realm: 1, hp: 1.1, atk: 1.05, def: 1, speed: 0.9, size: 14, poise: 1, xp: 1.15, aggro: 240, ranged: true, flying: true, keepDistance: 160,
  colors: ['#3a90c0', '#1f5f8f', '#bff3ff'],
  attacks: [atk({ id: 'bolt', name: 'Water Bolt', range: 280, cd: 2, windup: 0.45, shape: 'proj', mult: 1, proj: { kind: 'water', speed: 320, mult: 1, range: 320, status: { kind: 'chill', dur: 2, chance: 0.3 } } }), atk({ id: 'tidal', name: 'Tidal Burst', range: 80, cd: 5, windup: 0.8, shape: 'circle', at: 'self', r: 95, mult: 1.3, kb: 220 })],
  drops: [{ id: 'water_essence', chance: 0.6 }],
});
mon({
  id: 'blight_sporeling', name: 'Blight Sporeling', draw: 'sporeling', realm: 1, hp: 0.7, atk: 1.2, def: 0.8, speed: 1.3, size: 11, poise: 0.6, xp: 0.9, aggro: 220,
  colors: ['#b07acc', '#5a3a6a', '#d0ff8a'],
  attacks: [atk({ id: 'burst', name: 'Spore Burst', range: 46, cd: 99, windup: 0.9, shape: 'circle', at: 'self', r: 72, mult: 2, status: { kind: 'poison', dur: 5 }, special: 'suicide' }), bite({ id: 'headbutt', name: 'Headbutt', mult: 0.8 })],
  drops: [{ id: 'spore_cap', chance: 0.7 }],
});
mon({
  id: 'elite_gloomweaver', name: 'Gloomweaver Matriarch', title: 'Named Elite', draw: 'spider', realm: 1, hp: 7, atk: 1.5, def: 1.3, speed: 1.4, size: 21, poise: 4, xp: 6, aggro: 300, elite: true,
  colors: ['#3a1f4a', '#1a0f24', '#ff6ad5'],
  attacks: [bite({ r: 66, mult: 1.3, status: { kind: 'poison', dur: 5, chance: 0.8 } }), atk({ id: 'pounce', name: 'Ambush Pounce', range: 190, cd: 3, windup: 0.5, shape: 'line', len: 180, w: 36, dash: 170, mult: 1.5 }), atk({ id: 'web', name: 'Web Volley', range: 260, cd: 4.5, windup: 0.6, shape: 'proj', mult: 0.9, count: 5, spread: 0.6, proj: { kind: 'spit', speed: 300, mult: 0.9, range: 320, status: { kind: 'root', dur: 1.2, chance: 0.5 } } })],
  drops: [{ id: 'venom_sac', chance: 1, min: 3, max: 5 }, { id: 'enh_stone', chance: 0.7 }],
});
mon({
  id: 'spore_pod', name: 'Healing Spore Pod', draw: 'sporeling', realm: 1, hp: 0.55, atk: 0, def: 0.5, speed: 0, size: 12, poise: 0.3, xp: 0.2, aggro: 0,
  colors: ['#7aff9a', '#2a7a3a', '#ffffff'], attacks: [], drops: [],
});

// ================================================================== REALM 3
mon({
  id: 'magma_drake', name: 'Magma Drake', draw: 'drake', realm: 2, hp: 1.3, atk: 1.2, def: 1.2, speed: 1.15, size: 16, poise: 1.4, xp: 1.25, aggro: 230,
  colors: ['#b8401f', '#5a1f10', '#ffb02e'],
  attacks: [atk({ id: 'breath', name: 'Fire Breath', range: 130, cd: 3.4, windup: 0.7, r: 140, arc: 0.9, mult: 1.4, element: 'fire', status: { kind: 'burn', dur: 3, chance: 0.6 } }), atk({ id: 'tail', name: 'Tail Whip', range: 56, cd: 2, windup: 0.5, shape: 'circle', at: 'self', r: 64, mult: 1.1, kb: 180 })],
  drops: [{ id: 'drake_scale', chance: 0.6 }, { id: 'drake_meat', chance: 0.5 }],
});
mon({
  id: 'obsidian_golem', name: 'Obsidian Golem', draw: 'golem', realm: 2, hp: 2.6, atk: 1.4, def: 2, speed: 0.6, size: 19, poise: 3, xp: 1.6, aggro: 180,
  colors: ['#2a2228', '#16121a', '#ff6a2a'],
  attacks: [atk({ id: 'slam', name: 'Ground Slam', range: 80, cd: 3.8, windup: 1, shape: 'circle', at: 'self', r: 92, mult: 1.8, kb: 260, brk: 0 }), atk({ id: 'fist', name: 'Obsidian Fist', range: 56, cd: 1.8, windup: 0.6, r: 66, arc: 1.4, mult: 1.3 })],
  drops: [{ id: 'golem_core', chance: 0.5 }, { id: 'ore_orichalcum', chance: 0.2 }],
});
mon({
  id: 'flame_knight', name: 'Flame Knight', draw: 'humanoid', realm: 2, hp: 1.6, atk: 1.3, def: 1.5, speed: 1.05, size: 12, poise: 2, xp: 1.5, aggro: 240,
  colors: ['#ff7a3d', '#2a1414', '#ffd166'],
  humanoid: humanoid({ skin: '#3a2a2a', eyes: '#ffb02e', chest: { style: 2, tier: 4, main: '#3a2a2a', accent: '#ff7a3d', trim: '#ffd166' }, helmet: { style: 0, tier: 4, main: '#3a2a2a', accent: '#ff7a3d', trim: '#ffd166' }, boots: { main: '#2a1a1a', accent: '#ff7a3d' }, cloak: { main: '#a8301a', accent: '#5a1a0a', trim: '#ffd166' }, weapon: 'sword', weaponColor: '#ff9a3d', off: 'shield' }),
  attacks: [atk({ id: 'combo', name: 'Blazing Combo', range: 56, cd: 2.4, windup: 0.4, r: 62, arc: 1.6, repeat: 3, gap: 0.28, mult: 0.9, element: 'fire' }), atk({ id: 'flamedash', name: 'Flame Dash', range: 170, cd: 4, windup: 0.6, shape: 'line', len: 170, w: 30, dash: 160, mult: 1.5, element: 'fire', status: { kind: 'burn', dur: 3, chance: 0.7 } })],
  drops: [{ id: 'flame_emblem', chance: 0.5 }, { id: 'demon_core', chance: 0.12 }, { id: 'ore_crimson', chance: 0.2 }],
});
mon({
  id: 'cinder_imp', name: 'Cinder Imp', draw: 'imp', realm: 2, hp: 0.8, atk: 1.2, def: 0.9, speed: 1.5, size: 10, poise: 0.7, xp: 1, aggro: 250, ranged: true, flying: true, keepDistance: 150,
  colors: ['#d0402a', '#5a1410', '#ffd166'],
  attacks: [atk({ id: 'fireball', name: 'Fireball', range: 280, cd: 2.2, windup: 0.5, shape: 'proj', mult: 1.2, element: 'fire', proj: { kind: 'fireball', speed: 300, mult: 1.2, range: 320, element: 'fire', aoe: 40, status: { kind: 'burn', dur: 3, chance: 0.4 } } }), atk({ id: 'blink', name: 'Cinder Blink', range: 300, cd: 6, windup: 0.3, shape: 'none', mult: 0, special: 'blink' })],
  drops: [{ id: 'demon_core', chance: 0.15 }, { id: 'herb_firebell', chance: 0.25 }],
});
mon({
  id: 'elite_pyreclaw', name: 'Pyreclaw, the Ashen Drake', title: 'Named Elite', draw: 'drake', realm: 2, hp: 7, atk: 1.55, def: 1.5, speed: 1.2, size: 24, poise: 4.5, xp: 6, aggro: 320, elite: true,
  colors: ['#3a3a3a', '#141414', '#ff4d3a'],
  attacks: [atk({ id: 'breath', name: 'Ashen Breath', range: 150, cd: 3, windup: 0.7, r: 170, arc: 1, mult: 1.6, element: 'fire', status: { kind: 'burn', dur: 4, chance: 0.8 } }), atk({ id: 'tail', name: 'Tail Whip', range: 70, cd: 2, windup: 0.5, shape: 'circle', at: 'self', r: 84, mult: 1.3, kb: 220 }), atk({ id: 'meteors', name: 'Ash Meteors', range: 300, cd: 7, windup: 1.1, shape: 'circle', at: 'target', r: 70, mult: 1.6, element: 'fire', special: 'meteors' })],
  drops: [{ id: 'drake_scale', chance: 1, min: 3, max: 5 }, { id: 'demon_core', chance: 1 }],
});

// ================================================================== REALM 4
mon({
  id: 'frost_wyvern', name: 'Frost Wyvern', draw: 'wyvern', realm: 3, hp: 1.4, atk: 1.25, def: 1.1, speed: 1.3, size: 16, poise: 1.4, xp: 1.3, aggro: 250, flying: true,
  colors: ['#8fc8ec', '#3a5a8a', '#ffffff'],
  attacks: [atk({ id: 'icebreath', name: 'Ice Breath', range: 140, cd: 3.5, windup: 0.7, r: 150, arc: 0.8, mult: 1.4, element: 'frost', status: { kind: 'chill', dur: 3 } }), atk({ id: 'dive', name: 'Dive', range: 210, cd: 4, windup: 0.7, shape: 'line', len: 200, w: 34, dash: 200, mult: 1.6 })],
  drops: [{ id: 'wyvern_scale', chance: 0.55 }, { id: 'wyvern_meat', chance: 0.5 }],
});
mon({
  id: 'phantom_lancer', name: 'Phantom Lancer', draw: 'humanoid', realm: 3, hp: 1.2, atk: 1.35, def: 1, speed: 1.25, size: 12, poise: 1.3, xp: 1.3, aggro: 260,
  colors: ['#c9c2ff', '#5a52a0', '#ffffff'],
  humanoid: humanoid({ skin: '#c9d8ff', hair: '#e8eeff', hairStyle: 1, eyes: '#7fe9ff', chest: { style: 2, tier: 5, main: '#b8c4ff', accent: '#5a52a0', trim: '#ffffff' }, helmet: { style: 0, tier: 5, main: '#b8c4ff', accent: '#5a52a0', trim: '#ffffff' }, boots: { main: '#8a94d0', accent: '#5a52a0' }, cloak: { main: '#7a72c0', accent: '#3a3280', trim: '#ffffff' }, weapon: 'spear', weaponColor: '#dfe8ff', ghost: true }),
  attacks: [atk({ id: 'lancecharge', name: 'Spectral Charge', range: 230, cd: 3.6, windup: 0.65, shape: 'line', len: 220, w: 26, dash: 200, mult: 1.6 }), swipe({ id: 'sweep', name: 'Lance Sweep', r: 82, arc: 2.6, windup: 0.55, mult: 1.1 })],
  drops: [{ id: 'phantom_cloth', chance: 0.55 }, { id: 'ore_titanium', chance: 0.2 }],
});
mon({
  id: 'ice_wraith', name: 'Ice Wraith', draw: 'wraith', realm: 3, hp: 1, atk: 1.2, def: 0.9, speed: 1.1, size: 13, poise: 0.9, xp: 1.2, aggro: 260, ranged: true, flying: true, keepDistance: 170,
  colors: ['#bff3ff', '#3a6a9a', '#ffffff'],
  attacks: [atk({ id: 'orb', name: 'Frost Orb', range: 300, cd: 2.4, windup: 0.5, shape: 'proj', mult: 1.1, proj: { kind: 'orb', speed: 200, mult: 1.1, range: 380, homing: 1.6, element: 'frost', status: { kind: 'chill', dur: 2.5 } } }), atk({ id: 'nova', name: 'Freezing Nova', range: 90, cd: 6, windup: 0.9, shape: 'circle', at: 'self', r: 105, mult: 1.2, element: 'frost', status: { kind: 'freeze', dur: 1.2, chance: 0.5 } })],
  drops: [{ id: 'frost_essence', chance: 0.6 }],
});
mon({
  id: 'frost_revenant', name: 'Frost Revenant', draw: 'humanoid', realm: 3, hp: 1.9, atk: 1.35, def: 1.7, speed: 0.9, size: 13, poise: 2.2, xp: 1.6, aggro: 230,
  colors: ['#a8d8ff', '#2a4a7a', '#ffffff'],
  humanoid: humanoid({ skin: '#8aa2bc', eyes: '#7fe9ff', chest: { style: 2, tier: 5, main: '#a8c4e0', accent: '#2a4a7a', trim: '#e8f4ff' }, helmet: { style: 0, tier: 5, main: '#a8c4e0', accent: '#2a4a7a', trim: '#e8f4ff' }, boots: { main: '#6a8aaa', accent: '#2a4a7a' }, cloak: null, weapon: 'halberd', weaponColor: '#c4e8ff' }),
  attacks: [swipe({ id: 'halberd', name: 'Glacial Sweep', range: 64, r: 80, arc: 2.2, windup: 0.65, mult: 1.4, element: 'frost' }), atk({ id: 'spikes', name: 'Frost Spikes', range: 230, cd: 4.5, windup: 0.9, shape: 'line', len: 240, w: 36, mult: 1.5, element: 'frost', status: { kind: 'chill', dur: 3 } })],
  drops: [{ id: 'frost_essence', chance: 0.4 }, { id: 'ore_starlight', chance: 0.25 }],
});
mon({
  id: 'elite_rimehowl', name: 'Rimehowl, the Glacier Wyvern', title: 'Named Elite', draw: 'wyvern', realm: 3, hp: 7, atk: 1.6, def: 1.4, speed: 1.35, size: 24, poise: 4.5, xp: 6, aggro: 330, elite: true, flying: true,
  colors: ['#e8f4ff', '#5a7ab8', '#7fe9ff'],
  attacks: [atk({ id: 'icebreath', name: 'Rime Breath', range: 160, cd: 3, windup: 0.7, r: 180, arc: 0.9, mult: 1.6, element: 'frost', status: { kind: 'freeze', dur: 1, chance: 0.4 } }), atk({ id: 'dive', name: 'Glacier Dive', range: 240, cd: 3.5, windup: 0.6, shape: 'line', len: 240, w: 40, dash: 230, mult: 1.7 }), atk({ id: 'spikes', name: 'Ice Rain', range: 300, cd: 7, windup: 1.1, shape: 'circle', at: 'target', r: 70, mult: 1.5, element: 'frost', special: 'meteors' })],
  drops: [{ id: 'wyvern_scale', chance: 1, min: 3, max: 5 }, { id: 'enh_greater', chance: 0.3 }],
});
mon({
  id: 'ice_clone', name: 'Mirror Clone', draw: 'humanoid', realm: 3, hp: 0.45, atk: 1.1, def: 0.6, speed: 1.2, size: 13, poise: 0.5, xp: 0.2, aggro: 400, ranged: true, keepDistance: 170,
  colors: ['#bff3ff', '#5a7ab8', '#ffffff'],
  humanoid: humanoid({ skin: '#dff4ff', hair: '#ffffff', hairStyle: 6, eyes: '#7fe9ff', chest: { style: 3, tier: 5, main: '#dff4ff', accent: '#7fb4ff', trim: '#ffffff' }, helmet: { style: 2, tier: 5, main: '#ffffff', accent: '#7fe9ff', trim: '#ffffff' }, boots: { main: '#bfe6ff', accent: '#7fb4ff' }, cloak: { main: '#bfe6ff', accent: '#7fb4ff', trim: '#ffffff' }, weapon: 'staff', weaponColor: '#bfe6ff', ghost: true }),
  attacks: [atk({ id: 'lances', name: 'Mirror Lances', range: 320, cd: 2.6, windup: 0.6, shape: 'proj', mult: 0.9, count: 3, spread: 0.4, proj: { kind: 'icelance', speed: 380, mult: 0.9, range: 380, element: 'frost', status: { kind: 'chill', dur: 2 } } })],
  drops: [],
});

// ================================================================== REALM 5
mon({
  id: 'seraph_automaton', name: 'Seraphim Automaton', draw: 'automaton', realm: 4, hp: 1.6, atk: 1.3, def: 1.6, speed: 0.95, size: 15, poise: 1.8, xp: 1.5, aggro: 270, ranged: true, flying: true, keepDistance: 180,
  colors: ['#f4efe6', '#c9a23a', '#7fe9ff'],
  attacks: [atk({ id: 'laser', name: 'Judgment Laser', range: 360, cd: 3.4, windup: 0.9, shape: 'line', len: 380, w: 18, mult: 1.6, element: 'holy' }), atk({ id: 'orbs', name: 'Halo Volley', range: 300, cd: 2.8, windup: 0.5, shape: 'proj', mult: 0.9, count: 3, spread: 0.4, proj: { kind: 'holy', speed: 340, mult: 0.9, range: 360, element: 'holy' } })],
  drops: [{ id: 'automaton_gear', chance: 0.55 }, { id: 'aether_dust', chance: 0.3 }],
});
mon({
  id: 'abyssal_reaver', name: 'Abyssal Reaver', draw: 'reaver', realm: 4, hp: 1.3, atk: 1.5, def: 1.1, speed: 1.5, size: 13, poise: 1.3, xp: 1.5, aggro: 280,
  colors: ['#2a1f3a', '#0f0a18', '#a970ff'],
  attacks: [atk({ id: 'scythe', name: 'Scythe Combo', range: 54, cd: 2, windup: 0.35, r: 66, arc: 2, repeat: 2, gap: 0.25, mult: 1, element: 'void' }), atk({ id: 'shadowstep', name: 'Shadow Step', range: 320, cd: 5, windup: 0.3, shape: 'none', mult: 0, special: 'blink' })],
  drops: [{ id: 'reaver_claw', chance: 0.5 }, { id: 'ore_voidsteel', chance: 0.2 }],
});
mon({
  id: 'aether_wisp', name: 'Aether Wisp', draw: 'wisp', realm: 4, hp: 0.6, atk: 1.1, def: 0.8, speed: 1.6, size: 9, poise: 0.5, xp: 0.9, aggro: 260, ranged: true, flying: true, keepDistance: 150,
  colors: ['#fff3a8', '#c9a23a', '#ffffff'],
  attacks: [atk({ id: 'spark', name: 'Spark', range: 280, cd: 1.6, windup: 0.35, shape: 'proj', mult: 0.9, proj: { kind: 'bolt', speed: 380, mult: 0.9, range: 320, element: 'lightning', status: { kind: 'shock', dur: 1, chance: 0.3 } } })],
  drops: [{ id: 'wisp_lumen', chance: 0.6 }, { id: 'aether_dust', chance: 0.3 }],
});
mon({
  id: 'zenith_templar', name: 'Zenith Templar', draw: 'humanoid', realm: 4, hp: 2.2, atk: 1.4, def: 2, speed: 1, size: 13, poise: 2.4, xp: 1.8, aggro: 250,
  colors: ['#f4efe6', '#9a2a3a', '#ffd27a'],
  humanoid: humanoid({ skin: '#e8c8a8', hair: '#e8c15a', hairStyle: 5, eyes: '#ffd166', chest: { style: 2, tier: 6, main: '#f4efe6', accent: '#9a2a3a', trim: '#ffd27a' }, helmet: { style: 0, tier: 6, main: '#f4efe6', accent: '#9a2a3a', trim: '#ffd27a' }, boots: { main: '#e8e0d0', accent: '#9a2a3a' }, cloak: { main: '#9a2a3a', accent: '#5a1420', trim: '#ffd27a' }, weapon: 'sword', weaponColor: '#fff1a8', off: 'shield' }),
  attacks: [atk({ id: 'bash', name: 'Shield Bash', range: 50, cd: 3, windup: 0.5, r: 56, arc: 1.2, mult: 1.1, status: { kind: 'stun', dur: 0.8, chance: 0.6 } }), atk({ id: 'combo', name: 'Templar Combo', range: 56, cd: 2.4, windup: 0.4, r: 64, arc: 1.6, repeat: 2, gap: 0.3, mult: 1.1 }), atk({ id: 'holyline', name: 'Holy Edge', range: 250, cd: 4.5, windup: 0.85, shape: 'line', len: 260, w: 30, mult: 1.5, element: 'holy' })],
  drops: [{ id: 'automaton_gear', chance: 0.4 }, { id: 'enh_greater', chance: 0.05 }],
});
mon({
  id: 'elite_nullseraph', name: 'Null Seraph Prime', title: 'Named Elite', draw: 'automaton', realm: 4, hp: 7, atk: 1.6, def: 1.8, speed: 1, size: 24, poise: 5, xp: 6, aggro: 340, elite: true, ranged: true, flying: true, keepDistance: 200,
  colors: ['#1a1a24', '#a970ff', '#ff4f7b'],
  attacks: [atk({ id: 'laser', name: 'Null Laser', range: 400, cd: 2.8, windup: 0.85, shape: 'line', len: 420, w: 24, mult: 1.7, element: 'void', sweep: 0.8 }), atk({ id: 'orbs', name: 'Void Volley', range: 320, cd: 2.4, windup: 0.5, shape: 'proj', mult: 1, count: 5, spread: 0.7, proj: { kind: 'orb', speed: 300, mult: 1, range: 380, element: 'void', homing: 0.8 } })],
  drops: [{ id: 'automaton_gear', chance: 1, min: 3, max: 5 }, { id: 'enh_greater', chance: 0.5 }],
});

// ================================================================== BOSSES
const B: Record<string, BossDef> = {};
function boss(d: BossDef): void {
  B[d.id] = d;
  M[d.id] = d;
}

boss({
  id: 'b_kobold', name: 'Gorrak the Kobold Warchief', title: 'Lord of the Sunken Cobalt Tower', draw: 'kobold', realm: 0, hp: 18, atk: 1.6, def: 1.5, speed: 1.1, size: 26, poise: 10, xp: 25, aggro: 999, boss: true,
  colors: ['#9a5a2a', '#4a2a12', '#c0283f'],
  intro: 'The kobold war-band falls silent as their chieftain raises his axe.',
  trophy: 'trophy_kobold',
  attacks: [
    atk({ id: 'axe_cleave', name: 'Axe Cleave', range: 80, cd: 1.6, windup: 0.6, r: 96, arc: 1.8, mult: 1.5 }),
    atk({ id: 'buckler_charge', name: 'Buckler Charge', range: 260, cd: 4, windup: 0.85, shape: 'line', len: 250, w: 48, dash: 240, mult: 1.6, kb: 240 }),
    atk({ id: 'leap_slam', name: 'Leaping Slam', range: 320, cd: 5, windup: 1.1, shape: 'circle', at: 'target', r: 112, mult: 2, special: 'leap', kb: 200 }),
    atk({ id: 'cleaver_spin', name: 'Cleaver Cyclone', range: 110, cd: 4, windup: 0.8, shape: 'circle', at: 'self', r: 124, mult: 1.7, kb: 220 }),
    atk({ id: 'cleaver_combo', name: 'Cleaver Combo', range: 90, cd: 2.2, windup: 0.45, r: 104, arc: 1.6, repeat: 3, gap: 0.32, mult: 1.2 }),
    atk({ id: 'dash_slash', name: 'Rending Dash', range: 300, cd: 4.5, windup: 0.6, shape: 'line', len: 310, w: 42, dash: 290, mult: 1.8 }),
  ],
  phases: [
    { at: 1, name: 'Axe & Buckler', attacks: ['axe_cleave', 'buckler_charge'] },
    { at: 0.7, name: 'Call to Arms', attacks: ['axe_cleave', 'buckler_charge', 'leap_slam'], enter: 'summon_sentinels' },
    { at: 0.4, name: 'The Great Cleaver', attacks: ['cleaver_spin', 'cleaver_combo', 'dash_slash', 'leap_slam'], speed: 1.3, enter: 'swap_weapon' },
  ],
  drops: [{ id: 'enh_stone', chance: 1, min: 2, max: 4 }, { id: 'ingot_iron', chance: 1, min: 3, max: 5 }],
});
boss({
  id: 'b_treant', name: 'Nerius the Elder Arch-Treant', title: 'Heart of the Blighted Root', draw: 'treant', realm: 1, hp: 22, atk: 1.6, def: 1.8, speed: 0.55, size: 36, poise: 12, xp: 25, aggro: 999, boss: true,
  colors: ['#3a2a1f', '#2a5a3a', '#c9ff5a'],
  intro: 'The roots shudder. Something ancient and rotten opens its eyes.',
  trophy: 'trophy_treant',
  attacks: [
    atk({ id: 'vine_prison', name: 'Vine Prison', range: 400, cd: 4.5, windup: 1.1, shape: 'circle', at: 'target', r: 62, mult: 1.3, status: { kind: 'root', dur: 2 }, special: 'vines' }),
    atk({ id: 'toxic_sweep', name: 'Toxic Sweep', range: 150, cd: 4, windup: 1, r: 175, arc: 2.4, mult: 1.6, element: 'poison', status: { kind: 'poison', dur: 5 } }),
    atk({ id: 'stomp', name: 'Elder Stomp', range: 110, cd: 3.5, windup: 0.9, shape: 'circle', at: 'self', r: 126, mult: 1.6, kb: 240 }),
    atk({ id: 'root_lines', name: 'Root Eruption', range: 400, cd: 5, windup: 1, shape: 'line', len: 380, w: 40, mult: 1.5, count: 3, spread: 0.5 }),
    atk({ id: 'spores', name: 'Healing Spores', range: 999, cd: 14, windup: 0.8, shape: 'none', mult: 0, special: 'heal_spores' }),
  ],
  phases: [
    { at: 1, name: 'Elder Wrath', attacks: ['vine_prison', 'toxic_sweep', 'stomp'] },
    { at: 0.66, name: 'Blight Bloom', attacks: ['vine_prison', 'toxic_sweep', 'stomp', 'root_lines', 'spores'], enter: 'heal_spores' },
    { at: 0.33, name: 'Withering Rage', attacks: ['vine_prison', 'toxic_sweep', 'stomp', 'root_lines', 'spores'], speed: 1.25, enter: 'enrage' },
  ],
  drops: [{ id: 'enh_stone', chance: 1, min: 3, max: 5 }, { id: 'treant_bark', chance: 1, min: 4, max: 6 }],
});
boss({
  id: 'b_wyrm', name: 'Igniscor the Molten Wyrm', title: 'Sovereign of the Caldera', draw: 'wyrm', realm: 2, hp: 24, atk: 1.7, def: 2, speed: 0.8, size: 34, poise: 14, xp: 25, aggro: 999, boss: true, element: 'fire',
  colors: ['#c0401f', '#3a140a', '#ffb02e'],
  intro: 'The lava parts. Armored scales glow white-hot. Break them to bare its heart!',
  trophy: 'trophy_wyrm',
  attacks: [
    atk({ id: 'fire_breath', name: 'Molten Breath', range: 200, cd: 4, windup: 0.9, r: 230, arc: 0.9, mult: 1.7, element: 'fire', status: { kind: 'burn', dur: 4 } }),
    atk({ id: 'tail_sweep', name: 'Tail Sweep', range: 110, cd: 3, windup: 0.7, shape: 'circle', at: 'self', r: 118, mult: 1.5, kb: 260 }),
    atk({ id: 'meteor_rain', name: 'Meteor Craters', range: 999, cd: 6, windup: 1.2, shape: 'circle', at: 'target', r: 72, mult: 1.8, element: 'fire', special: 'meteors' }),
    atk({ id: 'magma_wave', name: 'Magma Wave', range: 400, cd: 6, windup: 0.9, shape: 'ring', r: 150, inner: 90, mult: 1.6, element: 'fire', special: 'waves' }),
    atk({ id: 'lava_line', name: 'Lava Lance', range: 420, cd: 4, windup: 1, shape: 'line', len: 420, w: 46, mult: 1.8, element: 'fire', sweep: 0.9 }),
  ],
  phases: [
    { at: 1, name: 'Armored Scales', attacks: ['fire_breath', 'tail_sweep', 'meteor_rain'] },
    { at: 0.6, name: 'Molten Core', attacks: ['fire_breath', 'tail_sweep', 'meteor_rain', 'magma_wave', 'lava_line'], enter: 'armor_up' },
    { at: 0.3, name: 'Cataclysm', attacks: ['fire_breath', 'meteor_rain', 'magma_wave', 'lava_line'], speed: 1.3, enter: 'enrage' },
  ],
  drops: [{ id: 'enh_greater', chance: 1, min: 1, max: 2 }, { id: 'demon_core', chance: 1, min: 2, max: 3 }],
});
boss({
  id: 'b_empress', name: 'Valkyria the Glacial Empress', title: 'Queen of the Eternal Frost', draw: 'humanoid', realm: 3, hp: 22, atk: 1.7, def: 1.7, speed: 1.05, size: 18, poise: 12, xp: 25, aggro: 999, boss: true, element: 'frost', ranged: true, keepDistance: 150,
  colors: ['#dff4ff', '#3a6ab8', '#7fe9ff'],
  humanoid: humanoid({ skin: '#eaf4ff', hair: '#ffffff', hairStyle: 1, eyes: '#7fe9ff', chest: { style: 3, tier: 5, main: '#e8f4ff', accent: '#3a6ab8', trim: '#7fe9ff' }, helmet: { style: 2, tier: 6, main: '#ffffff', accent: '#7fe9ff', trim: '#bfe6ff' }, boots: { main: '#bfe6ff', accent: '#3a6ab8' }, cloak: { main: '#7fb4ff', accent: '#2a4a8a', trim: '#ffffff' }, weapon: 'staff', weaponColor: '#bfe6ff', scale: 1.9 }),
  intro: 'Snow stops falling mid-air. The Empress turns, and her mirror court turns with her.',
  trophy: 'trophy_empress',
  attacks: [
    atk({ id: 'ice_lances', name: 'Ice Lances', range: 400, cd: 2.6, windup: 0.6, shape: 'proj', mult: 1.2, count: 5, spread: 0.6, proj: { kind: 'icelance', speed: 420, mult: 1.2, range: 460, element: 'frost', status: { kind: 'chill', dur: 2.5 } } }),
    atk({ id: 'glacial_spikes', name: 'Glacial Spikes', range: 400, cd: 4, windup: 1, shape: 'circle', at: 'target', r: 76, mult: 1.6, element: 'frost', special: 'spikes', status: { kind: 'freeze', dur: 1, chance: 0.3 } }),
    atk({ id: 'freezing_beam', name: 'Freezing Beam', range: 460, cd: 6, windup: 1, shape: 'line', len: 470, w: 30, mult: 0.6, element: 'frost', special: 'beam_rotate', status: { kind: 'chill', dur: 2 } }),
    atk({ id: 'blizzard_vortex', name: 'Blizzard Vortex', range: 999, cd: 9, windup: 0.8, shape: 'circle', at: 'target', r: 140, mult: 0.5, element: 'frost', special: 'vortex' }),
    atk({ id: 'mirror', name: 'Mirror Court', range: 999, cd: 16, windup: 0.7, shape: 'none', mult: 0, special: 'clones' }),
  ],
  phases: [
    { at: 1, name: 'Winter Court', attacks: ['ice_lances', 'glacial_spikes', 'freezing_beam'] },
    { at: 0.65, name: 'Mirror Court', attacks: ['ice_lances', 'glacial_spikes', 'freezing_beam', 'blizzard_vortex', 'mirror'], enter: 'clones' },
    { at: 0.3, name: 'Absolute Winter', attacks: ['ice_lances', 'glacial_spikes', 'freezing_beam', 'blizzard_vortex', 'mirror'], speed: 1.25, enter: 'clones' },
  ],
  drops: [{ id: 'enh_greater', chance: 1, min: 2, max: 3 }, { id: 'frost_essence', chance: 1, min: 3, max: 5 }],
});
boss({
  id: 'b_paragon', name: 'Paragon Aurelion', title: 'The Aegis Sovereign', draw: 'humanoid', realm: 4, hp: 26, atk: 1.8, def: 2.2, speed: 1.2, size: 18, poise: 14, xp: 30, aggro: 999, boss: true, element: 'holy',
  colors: ['#f4efe6', '#9a2a3a', '#ffd27a'],
  humanoid: humanoid({ skin: '#e8c8a8', hair: '#d8d8e0', hairStyle: 5, eyes: '#ffd166', chest: { style: 2, tier: 6, main: '#f4efe6', accent: '#9a2a3a', trim: '#ffd27a' }, helmet: null, boots: { main: '#e8e0d0', accent: '#9a2a3a' }, cloak: { main: '#9a2a3a', accent: '#4a0f1a', trim: '#ffd27a' }, weapon: 'sword', weaponColor: '#fff1a8', off: 'shield', scale: 1.9 }),
  intro: 'The Paragon lowers his cross-shield. "Show me a blade that can pass my guard."',
  trophy: 'trophy_paragon',
  attacks: [
    atk({ id: 'sword_combo', name: 'Sovereign Combo', range: 80, cd: 2.2, windup: 0.45, r: 88, arc: 1.7, repeat: 3, gap: 0.3, mult: 1.2 }),
    atk({ id: 'shield_charge', name: 'Aegis Charge', range: 270, cd: 4, windup: 0.8, shape: 'line', len: 270, w: 46, dash: 260, mult: 1.6, status: { kind: 'stun', dur: 1 } }),
    atk({ id: 'sword_beams', name: 'Radiant Beams', range: 400, cd: 3, windup: 0.6, shape: 'proj', mult: 1.3, count: 3, spread: 0.5, proj: { kind: 'holy', speed: 420, mult: 1.3, range: 460, element: 'holy' } }),
    atk({ id: 'holy_cross', name: 'Holy Cross', range: 999, cd: 5.5, windup: 1.1, shape: 'line', len: 420, w: 44, mult: 2, element: 'holy', special: 'cross' }),
    atk({ id: 'blink_strike', name: 'Flash Step', range: 999, cd: 6, windup: 0.3, shape: 'none', mult: 0, special: 'blink' }),
    atk({ id: 'judgment', name: 'Final Judgment', range: 150, cd: 7, windup: 1.3, shape: 'circle', at: 'self', r: 160, mult: 2.4, element: 'holy', kb: 280 }),
  ],
  phases: [
    { at: 1, name: 'Sword & Cross', attacks: ['sword_combo', 'shield_charge', 'sword_beams'] },
    { at: 0.66, name: 'Divine Strategy', attacks: ['sword_combo', 'shield_charge', 'sword_beams', 'holy_cross', 'blink_strike'], enter: 'guard_up' },
    { at: 0.33, name: 'Sovereign Overdrive', attacks: ['sword_combo', 'holy_cross', 'blink_strike', 'judgment', 'sword_beams'], speed: 1.3, enter: 'overdrive' },
  ],
  drops: [{ id: 'enh_greater', chance: 1, min: 3, max: 4 }, { id: 'automaton_gear', chance: 1, min: 4, max: 6 }],
});

// ================================================================== v3: ROAMING RAID BOSSES & WORLD EVENTS
boss({
  id: 'r_colossus', name: 'Colossus of the Sundered Gate', title: 'Roaming Raid Boss', draw: 'golem', realm: 0, hp: 44, atk: 1.9, def: 2.3, speed: 0.75, size: 32, poise: 20, xp: 45, aggro: 999, boss: true,
  colors: ['#4a4f5e', '#22252e', '#7fe9ff'],
  intro: 'Gate-stone grinds against gate-stone. The Colossus turns its hollow eyes toward you.',
  trophy: 'relic_shard',
  attacks: [
    atk({ id: 'col_fist', name: 'Gate Fist', range: 100, cd: 2, windup: 0.6, r: 120, arc: 1.6, mult: 1.6, kb: 240 }),
    atk({ id: 'col_slam', name: 'Sundering Slam', range: 130, cd: 4, windup: 1, shape: 'circle', at: 'self', r: 150, mult: 2, kb: 300 }),
    atk({ id: 'col_boulders', name: 'Boulder Rain', range: 999, cd: 6, windup: 1.2, shape: 'circle', at: 'target', r: 80, mult: 1.8, special: 'meteors' }),
    atk({ id: 'col_quake', name: 'Quake Rings', range: 400, cd: 6.5, windup: 0.9, shape: 'ring', r: 170, inner: 100, mult: 1.6, special: 'waves' }),
    atk({ id: 'col_charge', name: 'Gatebreaker Charge', range: 320, cd: 5, windup: 0.9, shape: 'line', len: 330, w: 70, dash: 300, mult: 2, kb: 320 }),
  ],
  phases: [
    { at: 1, name: 'Waking Titan', attacks: ['col_fist', 'col_slam', 'col_charge'] },
    { at: 0.6, name: 'Gate Fury', attacks: ['col_fist', 'col_slam', 'col_boulders', 'col_charge'], enter: 'enrage' },
    { at: 0.3, name: 'Sundered', attacks: ['col_fist', 'col_slam', 'col_boulders', 'col_quake', 'col_charge'], speed: 1.3, enter: 'enrage' },
  ],
  drops: [{ id: 'enh_greater', chance: 1, min: 2, max: 3 }, { id: 'relic_shard', chance: 1, min: 1, max: 2 }, { id: 'treasure_map', chance: 0.6 }],
});
boss({
  id: 'r_reaper', name: 'The Hollow Reaper', title: 'Roaming Raid Boss', draw: 'wraith', realm: 0, hp: 38, atk: 2.1, def: 1.7, speed: 1.3, size: 30, poise: 16, xp: 45, aggro: 999, boss: true, element: 'void',
  colors: ['#1a1030', '#cfc6b0', '#ff4f7b'],
  intro: 'Bone scythes unfold in the dark. The Hollow Reaper has come to harvest.',
  trophy: 'relic_shard',
  attacks: [
    atk({ id: 'rep_sweep', name: 'Scythe Sweep', range: 120, cd: 1.8, windup: 0.55, r: 150, arc: 2.6, mult: 1.7, element: 'void' }),
    atk({ id: 'rep_lines', name: 'Reaping Lines', range: 420, cd: 4.5, windup: 0.9, shape: 'line', len: 420, w: 40, mult: 1.8, count: 3, spread: 0.6, element: 'void' }),
    atk({ id: 'rep_blink', name: 'Shadow Phase', range: 999, cd: 5, windup: 0.3, shape: 'none', mult: 0, special: 'blink' }),
    atk({ id: 'rep_vortex', name: 'Grasping Void', range: 999, cd: 9, windup: 0.8, shape: 'circle', at: 'target', r: 150, mult: 0.6, element: 'void', special: 'vortex' }),
    atk({ id: 'rep_cross', name: 'Harvest Cross', range: 999, cd: 6, windup: 1.1, shape: 'line', len: 440, w: 44, mult: 2.1, element: 'void', special: 'cross' }),
  ],
  phases: [
    { at: 1, name: 'The Harvest', attacks: ['rep_sweep', 'rep_lines', 'rep_blink'] },
    { at: 0.6, name: 'Hollow Night', attacks: ['rep_sweep', 'rep_lines', 'rep_blink', 'rep_vortex'], enter: 'enrage' },
    { at: 0.3, name: 'Final Reaping', attacks: ['rep_sweep', 'rep_lines', 'rep_blink', 'rep_vortex', 'rep_cross'], speed: 1.35, enter: 'enrage' },
  ],
  drops: [{ id: 'enh_greater', chance: 1, min: 2, max: 3 }, { id: 'mythic_core', chance: 0.25 }, { id: 'treasure_map', chance: 0.6 }],
});
mon({
  id: 'ev_gate', name: 'Corrupted Gate', draw: 'wisp', realm: 0, hp: 7, atk: 1.1, def: 1.6, speed: 0, size: 26, poise: 6, xp: 3, aggro: 320,
  colors: ['#3a0f4a', '#a970ff', '#ff4f7b'],
  attacks: [atk({ id: 'gate_pulse', name: 'Corruption Pulse', range: 110, cd: 4.5, windup: 1, shape: 'circle', at: 'self', r: 110, mult: 1.2, element: 'void', kb: 200 })],
  drops: [{ id: 'relic_shard', chance: 0.35 }, { id: 'enh_stone', chance: 1, min: 2, max: 3 }],
});

export const MONSTERS = M;
export const BOSSES = B;
export const BOSS_IDS = ['b_kobold', 'b_treant', 'b_wyrm', 'b_empress', 'b_paragon'];

/** level-scaled base stats */
export function monsterStats(d: MonsterDef, level: number): { hp: number; atk: number; def: number; xp: number; poise: number; speed: number } {
  return {
    hp: Math.round((20 + 12 * Math.pow(level, 1.25)) * d.hp),
    atk: (8 + 3.4 * level) * d.atk,
    def: (2 + 1.1 * level) * d.def,
    xp: Math.round(12 * Math.pow(level, 1.3) * d.xp),
    poise: Math.round((30 + level * 1.5) * d.poise),
    speed: 70 * d.speed,
  };
}
