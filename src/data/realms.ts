// The five realms of Aetheria: palettes, cities, resources, monsters, dungeons and bosses.
import type { AmbientKind, Weather } from '../types/game';

export type TreeKind = 'blossom' | 'oak' | 'glow' | 'charred' | 'pine' | 'crystal';

export interface RealmPalette {
  grass: string;
  grass2: string;
  grassDark: string;
  flower: string[];
  dirt: string;
  path: string;
  plaza: string;
  wood: string;
  sand: string;
  liquid: 'water' | 'lava' | 'void';
  liquidA: string;
  liquidB: string;
  cliffTop: string;
  cliffFace: string;
  wallTop: string;
  wallFace: string;
  floor: string;
  floor2: string;
  dunTop: string;
  dunFace: string;
  trees: TreeKind[];
  leaf: string;
  leaf2: string;
  trunk: string;
  roofs: string[];
  walls: string[];
  rock: string;
  lampColor: string;
  sky: string;
}

export interface RealmDef {
  id: number;
  name: string;
  short: string;
  city: string;
  cityTitle: string;
  levels: [number, number];
  desc: string;
  palette: RealmPalette;
  weather: Weather[];
  ambient: AmbientKind;
  ores: string[];
  herbs: string[];
  monsters: string[];
  dungeonMonsters: string[];
  elite: string;
  boss: string;
  dungeon: string;
  dungeonDesc: string;
  house: { name: string; price: number; w: number; h: number };
  buildings: { forge: string; guild: string; market: string; general: string; alchemist: string; estate: string };
  music: { root: number; minor: boolean };
}

export const REALMS: RealmDef[] = [
  {
    id: 0,
    name: 'Emerald Plains of Arcadia',
    short: 'Emerald Plains',
    city: 'Arcadia',
    cityTitle: 'City of First Steps',
    levels: [1, 10],
    desc: 'Rolling meadows dusted with cherry blossoms, copper and iron veins, and the Sunken Cobalt Tower on the horizon.',
    palette: {
      grass: '#5fae4e', grass2: '#6dbd58', grassDark: '#3f8a3a', flower: ['#ffd1e8', '#fff3a8', '#ffffff', '#ff9ec7'],
      dirt: '#a07a52', path: '#c9b48e', plaza: '#cfc6b4', wood: '#9a6b3f', sand: '#e6d39a',
      liquid: 'water', liquidA: '#3d8fd6', liquidB: '#5fb4f0',
      cliffTop: '#6aa456', cliffFace: '#8a6e52', wallTop: '#bfb7a6', wallFace: '#8e8573',
      floor: '#4d5f86', floor2: '#435478', dunTop: '#5a6f9e', dunFace: '#34416a',
      trees: ['blossom', 'oak', 'oak'], leaf: '#4f9e48', leaf2: '#7cc867', trunk: '#6b4a2f',
      roofs: ['#b8483e', '#3f6fb8', '#c98a3a', '#5a8a4a'], walls: ['#efe3cb', '#e8d7b5', '#d9cdb5'],
      rock: '#8f959c', lampColor: '#ffd58a', sky: '#9fd3ff',
    },
    weather: ['clear', 'clear', 'clear', 'rain', 'storm'],
    ambient: 'blossom',
    ores: ['ore_copper', 'ore_iron'],
    herbs: ['herb_moonleaf'],
    monsters: ['dire_wolf', 'frenzy_boar', 'kobold_scout'],
    dungeonMonsters: ['kobold_scout', 'kobold_trooper', 'kobold_sentinel'],
    elite: 'elite_thornback',
    boss: 'b_kobold',
    dungeon: 'Sunken Cobalt Tower',
    dungeonDesc: 'A drowned watchtower of cobalt stone, overrun by a kobold war-band.',
    house: { name: 'Starter Timber Cottage', price: 500, w: 12, h: 9 },
    buildings: { forge: 'Grand Forge', guild: 'Guild Headquarters', market: 'Market Exchange', general: 'Hearthside General Store', alchemist: 'Moonleaf Apothecary', estate: 'Arcadia Real Estate' },
    music: { root: 62, minor: false },
  },
  {
    id: 1,
    name: 'Sylvanis Twilight Forest & Crystal Lakes',
    short: 'Twilight Forest',
    city: 'Sylvanis Haven',
    cityTitle: 'Haven of the Crystal Lakes',
    levels: [10, 20],
    desc: 'Bioluminescent woods around mirror-still lakes. Silver and mithril glitter in the roots of ancient trees.',
    palette: {
      grass: '#2f6b5e', grass2: '#367866', grassDark: '#214f46', flower: ['#7fe9ff', '#c9a3ff', '#9effc8', '#ffffff'],
      dirt: '#5d4a3a', path: '#8a7a64', plaza: '#9aa4a0', wood: '#7a5a3a', sand: '#b8b08a',
      liquid: 'water', liquidA: '#1f5f8f', liquidB: '#3a90c0',
      cliffTop: '#2e6656', cliffFace: '#4a4a5a', wallTop: '#8a9a94', wallFace: '#5d6b66',
      floor: '#3a4a36', floor2: '#33412f', dunTop: '#4e6a3e', dunFace: '#2c3a24',
      trees: ['glow', 'glow', 'oak'], leaf: '#1f7a6a', leaf2: '#3fd0b0', trunk: '#3e3040',
      roofs: ['#2f5a6e', '#5a3f7a', '#3f6a4a', '#6a4a3a'], walls: ['#d8e0d6', '#c8d4cc', '#b8c4bc'],
      rock: '#6a7480', lampColor: '#9ff5ff', sky: '#20304a',
    },
    weather: ['clear', 'clear', 'rain', 'rain'],
    ambient: 'firefly',
    ores: ['ore_silver', 'ore_mithril'],
    herbs: ['herb_lotus'],
    monsters: ['treant_guardian', 'venom_stalker', 'water_elemental'],
    dungeonMonsters: ['venom_stalker', 'blight_sporeling', 'treant_guardian'],
    elite: 'elite_gloomweaver',
    boss: 'b_treant',
    dungeon: 'Sanctuary of the Blighted Root',
    dungeonDesc: 'A hollow beneath the oldest tree, choked by a spreading rot.',
    house: { name: 'Lakeside Villa', price: 2000, w: 14, h: 10 },
    buildings: { forge: 'Lakeside Forge', guild: 'Mystic Arcanum Hall', market: 'Lakeshore Exchange', general: 'Driftwood Provisions', alchemist: 'Bowyer & Alchemy Plaza', estate: 'Haven Housing Guild' },
    music: { root: 57, minor: true },
  },
  {
    id: 2,
    name: 'Pyrehold Volcanic Canyon',
    short: 'Volcanic Canyon',
    city: 'Pyrehold Bastion',
    cityTitle: 'The Magma-Lit Citadel',
    levels: [20, 30],
    desc: 'Basalt crags split by rivers of lava. Orichalcum and crimson steel veins glow in the dark.',
    palette: {
      grass: '#4a3a36', grass2: '#55443e', grassDark: '#3a2c29', flower: ['#ff7a3d', '#ffb35c', '#ff4d3a', '#ffd166'],
      dirt: '#5a4036', path: '#7a6a62', plaza: '#6e6460', wood: '#5a3a2a', sand: '#8a6a52',
      liquid: 'lava', liquidA: '#e0451f', liquidB: '#ffb02e',
      cliffTop: '#3a2e2c', cliffFace: '#251c1c', wallTop: '#5e5450', wallFace: '#3a3230',
      floor: '#3e302c', floor2: '#352825', dunTop: '#4a3632', dunFace: '#2a1c1a',
      trees: ['charred', 'charred'], leaf: '#3a2a26', leaf2: '#ff7a3d', trunk: '#2a1e1c',
      roofs: ['#5a2a2a', '#3a3a44', '#7a3a1a', '#4a2a3a'], walls: ['#8a7a72', '#7a6c66', '#968a82'],
      rock: '#3e3434', lampColor: '#ffae5c', sky: '#2a1414',
    },
    weather: ['clear', 'ash', 'ash'],
    ambient: 'ember',
    ores: ['ore_orichalcum', 'ore_crimson'],
    herbs: ['herb_firebell'],
    monsters: ['magma_drake', 'obsidian_golem', 'flame_knight'],
    dungeonMonsters: ['cinder_imp', 'flame_knight', 'obsidian_golem'],
    elite: 'elite_pyreclaw',
    boss: 'b_wyrm',
    dungeon: 'Heart of the Caldera',
    dungeonDesc: 'Galleries carved through the living volcano, down to the molten heart.',
    house: { name: 'Forge-Master Manor', price: 5000, w: 16, h: 11 },
    buildings: { forge: 'Gilded Anvil Master Smithy', guild: 'Bastion Guild Hall', market: 'Cinder Exchange', general: 'Ashfall Supplies', alchemist: 'Emberroot Alchemy', estate: 'Bastion Estates' },
    music: { root: 52, minor: true },
  },
  {
    id: 3,
    name: 'Crystalia Starlight Glaciers',
    short: 'Starlight Glaciers',
    city: 'Crystalia Spire',
    cityTitle: 'Spire of Starlight',
    levels: [30, 40],
    desc: 'Frozen peaks under a sky of falling stars. Starlight crystal and titanium sleep beneath the ice.',
    palette: {
      grass: '#dfe9f2', grass2: '#e9f1f8', grassDark: '#c4d4e2', flower: ['#bfefff', '#ffffff', '#c9d8ff', '#a8e6ff'],
      dirt: '#a9b8c8', path: '#b8c8d8', plaza: '#cad8e6', wood: '#8a7a6a', sand: '#d8e4ee',
      liquid: 'water', liquidA: '#4f8fc0', liquidB: '#8fc8ec',
      cliffTop: '#e8f0f8', cliffFace: '#8aa2bc', wallTop: '#d8e6f4', wallFace: '#9ab0c8',
      floor: '#7a92b0', floor2: '#6e86a4', dunTop: '#a8c4e0', dunFace: '#5a7494',
      trees: ['pine', 'pine'], leaf: '#2e5a52', leaf2: '#ffffff', trunk: '#4a3a32',
      roofs: ['#3a5a9a', '#5a7ab8', '#2a4a7a', '#6a5aa8'], walls: ['#f2f6fb', '#e4ecf6', '#d6e2ee'],
      rock: '#9ab0c8', lampColor: '#bfe6ff', sky: '#1a2a4a',
    },
    weather: ['clear', 'blizzard', 'blizzard'],
    ambient: 'snow',
    ores: ['ore_starlight', 'ore_titanium'],
    herbs: ['herb_frostpetal'],
    monsters: ['frost_wyvern', 'phantom_lancer', 'ice_wraith'],
    dungeonMonsters: ['frost_revenant', 'ice_wraith', 'phantom_lancer'],
    elite: 'elite_rimehowl',
    boss: 'b_empress',
    dungeon: 'Cathedral of Eternal Frost',
    dungeonDesc: 'A frozen cathedral whose choir still sings for an empress of ice.',
    house: { name: 'Starlight Glacier Estate', price: 12000, w: 18, h: 12 },
    buildings: { forge: 'Glacierforge', guild: 'Knights of the Ivory Aegis Command', market: 'Frostline Exchange', general: 'Spire Provisions', alchemist: 'Starlight Apothecary', estate: 'Spire Estates' },
    music: { root: 59, minor: false },
  },
  {
    id: 4,
    name: 'Aetherion Floating Sky Citadel',
    short: 'Sky Citadel',
    city: 'Aetherion Royal Capital',
    cityTitle: 'The Floating Crown',
    levels: [40, 50],
    desc: 'Marble islands drifting above the clouds, guarded by seraphim constructs and haunted by abyssal reavers.',
    palette: {
      grass: '#8fcf8a', grass2: '#a0dc98', grassDark: '#6fb06a', flower: ['#fff1a8', '#f6a5ff', '#ffffff', '#a8d8ff'],
      dirt: '#c8b896', path: '#efe8da', plaza: '#f4efe6', wood: '#b08a5a', sand: '#efe2c0',
      liquid: 'void', liquidA: '#7fb4ff', liquidB: '#dbeaff',
      cliffTop: '#eae4d8', cliffFace: '#b8ae9c', wallTop: '#f6f2ea', wallFace: '#c8bfae',
      floor: '#e6dcc8', floor2: '#dccfb8', dunTop: '#f2ece0', dunFace: '#9a2a3a',
      trees: ['crystal', 'oak'], leaf: '#5aa86a', leaf2: '#bfe6ff', trunk: '#d8cfc0',
      roofs: ['#2a4aa8', '#c9a23a', '#8a2a4a', '#3a8aa8'], walls: ['#ffffff', '#f4efe6', '#ece4d6'],
      rock: '#d8d0c0', lampColor: '#fff1a8', sky: '#7fb4ff',
    },
    weather: ['clear', 'clear', 'storm'],
    ambient: 'mote',
    ores: ['ore_voidsteel', 'ore_dragonbone'],
    herbs: ['herb_skyorchid'],
    monsters: ['seraph_automaton', 'abyssal_reaver', 'aether_wisp'],
    dungeonMonsters: ['zenith_templar', 'seraph_automaton', 'abyssal_reaver'],
    elite: 'elite_nullseraph',
    boss: 'b_paragon',
    dungeon: 'The Zenith Sanctum',
    dungeonDesc: 'The crimson-marble keep at the top of the world, where the Paragon awaits worthy challengers.',
    house: { name: 'Sovereign Sky-Palace Residence', price: 25000, w: 20, h: 13 },
    buildings: { forge: 'Royal Armory Forge', guild: 'Hall of the Four Banners', market: 'Royal Grand Exchange', general: 'Skyport Provisions', alchemist: 'Celestial Alchemy', estate: 'Crown Estates' },
    music: { root: 60, minor: false },
  },
];

export const CITY_NAMES = REALMS.map((r) => r.city);
