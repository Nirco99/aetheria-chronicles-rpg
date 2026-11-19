// NPC names, dialogue and the in-game Adventurer's Handbook (English only).
import type { NpcRole } from '../types/game';
import { CONTROLS } from './constants';

export const NPC_NAMES = [
  'Edda', 'Corwin', 'Maelis', 'Bram', 'Isolde', 'Fenn', 'Rowan', 'Tamsin', 'Oskar', 'Wren', 'Hale', 'Linnea',
  'Dorian', 'Petra', 'Jory', 'Sabine', 'Aldo', 'Nim', 'Greta', 'Silas', 'Yara', 'Teodor', 'Mabry', 'Quill',
];

export const ROLE_TITLES: Record<NpcRole, string> = {
  smith: 'Blacksmith', merchant: 'Merchant', alchemist: 'Alchemist', guild: 'Guild Clerk', realtor: 'Realtor',
  gatekeeper: 'Gate Warden', villager: 'Villager', guard: 'City Guard', arena: 'Coliseum Master', warden: 'Abyss Warden',
  chef: 'Cook', companion: 'Adventurer', banker: 'Banker',
};

export const ROLE_LINES: Record<NpcRole, string[]> = {
  smith: ['Ore in, legends out. What are we forging today?', 'Strike the anvil when the gauge sings - that is where masterworks are born.'],
  merchant: ['Prices shift with every sale, friend. Buy low here, sell high in the next city.', 'Watch the market ticker: a shortage is a fortune waiting to happen.'],
  alchemist: ['A blade oil turns a good sword into a terrible one. Terribly good, I mean.', 'Herbs grow back. Do not be shy with your gathering.'],
  guild: ['The board has fresh bounties every morning.', 'Rank up with a guild and its perks stay with you everywhere.'],
  realtor: ['Every adventurer deserves a door to close behind them.', 'A Royal Bed and a good night of sleep - nothing levels you faster.'],
  gatekeeper: ['The Teleport Gate links every city you have unlocked.', 'Clear a realm\'s dungeon and its guardian unseals the next gate.'],
  villager: [],
  guard: ['Keep your blade sheathed inside the walls, adventurer.', 'Monsters grow bolder after dark. Named Elites prowl the wilds at night.'],
  arena: ['Five cups, one champion. Or test yourself against endless waves - no penalty if you fall here.', 'The crowd loves a Perfect Parry.'],
  warden: ['The Abyss has no bottom that anyone has found. Every fifth floor holds a gauntlet of guardians.', 'Checkpoints every ten floors. Relic shards below the tenth.'],
  chef: ['Eat well, fight well. Food buffs last for minutes, not seconds.'],
  companion: [],
  banker: ['Your vault is shared between every house you own.'],
};

export const CITY_GOSSIP: string[][] = [
  [
    'They say the old watchtower sank into the lake in a single night. Kobolds moved in the next morning.',
    'Cherry blossoms fall all year round in Arcadia. Nobody remembers why.',
    'A wolf with thorns on its back hunts the plains after dark. Bounty hunters love it.',
    'Hit the Break bar until it empties and even the toughest brute will drop to its knees.',
  ],
  [
    'The trees glow brighter when something is wrong in the forest. They have been very bright lately.',
    'Fish from the crystal lakes make the best soup in all five realms.',
    'Water elementals hate fire. And everything else, honestly.',
    'The Mystic Arcanum Hall sits right on the water. Mind the wet floors.',
  ],
  [
    'The Gilded Anvil Syndicate pays good coin for Orichalcum. Better coin for Crimson Steel.',
    'Igniscor\'s scales are harder than any anvil. Break them first, then strike.',
    'Ash storms roll in from the caldera without warning.',
    'Golems are slow. Their fists are not.',
  ],
  [
    'Starlight Crystal only shines for those who mine it at night. Or so the miners say.',
    'The Empress makes copies of herself. Strike the one that casts the shadow.',
    'Knights of the Ivory Aegis drill on the ice bridges every dawn.',
    'Blizzards hide the frost wyverns until they are already diving.',
  ],
  [
    'The Royal Grand Exchange sets the price of everything in Aetheria.',
    'The Paragon guards his front with a cross-shield. Flank him, break him, or Switch.',
    'Below the capital, the Infinite Abyss waits. Its leaderboard never stops growing.',
    'Some say the Abyss rearranges itself every time you step inside.',
  ],
];

export interface HandbookSection {
  id: string;
  title: string;
  body: string;
}

const controlsTable = '<table class="hb-table">' + CONTROLS.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('') + '</table>';

export const HANDBOOK: HandbookSection[] = [
  {
    id: 'welcome', title: 'Welcome, Diver',
    body: `<p>The five realms of <b>Aetheria</b> float in an endless sky, joined by ancient Teleport Gates. You are a <b>Diver</b> - an adventurer whose mind is linked to the Aether itself.</p>
<p>Your journey begins in <b>Arcadia, City of First Steps</b>. Each realm has a city, a wilderness full of monsters and resources, and a dungeon guarded by a mighty boss. Defeat the five guardians, master the forge, build a home, rise through the guilds - and when the realms are conquered, descend into the <b>Infinite Abyss Labyrinth</b>.</p>
<p>Press <kbd>H</kbd> at any time to reopen this Handbook. A bilingual (English / Hebrew) Strategy Wiki is available from the Title Screen and the Pause Menu.</p>`,
  },
  { id: 'controls', title: 'Controls', body: `<p>Mouse and keyboard. Attacks and skills aim toward your cursor.</p>${controlsTable}` },
  {
    id: 'combat', title: 'Combat Basics',
    body: `<p><b>Basic attacks</b> chain into combos that depend on your weapon: Longswords swing a 3-hit combo, Dual Blades a fast 4-hit flurry, Spears thrust far, Halberds sweep wide, Bows fire arrows and Staves cast homing arcane bolts (scaling with MAG).</p>
<p><b>Dodge</b> (<kbd>Space</kbd>) rolls you a short distance with invulnerability frames. Dodging and blocking spend <b>Stamina</b> (the yellow bar), which recovers quickly when you stop.</p>
<p>Every hit freezes its target for a split second (hit-stop) and knocks it back. Damage numbers tell the story: <b>white</b> is normal, <b style="color:#ffd166">gold with a star</b> is critical, <b style="color:#7fe9ff">cyan</b> means shielded or parried, <b style="color:#c18cff">purple</b> is elemental or status damage.</p>
<p>Watch the ground: monsters and bosses project <b style="color:#ff5d6c">red telegraphs</b> (cones, circles, lines and rings) that fill up before the attack lands. Step out before the fill completes.</p>`,
  },
  {
    id: 'parry', title: 'Blocking & Perfect Parry',
    body: `<p>Hold <kbd>Right Click</kbd> or <kbd>Shift</kbd> to block attacks coming from the front. A shield blocks 75% of the damage, any other weapon 50%. Each blocked hit costs Stamina; run dry and your guard breaks.</p>
<p>Press block within <b>0.25 seconds</b> of an impact for a <b>PERFECT PARRY</b>: you take no damage, release a shockwave, restore 25 MP and 25 Stamina, your basic attack is instantly ready, and the attacker suffers massive <b>Break damage</b>.</p>`,
  },
  {
    id: 'break', title: 'Break Bar & Stagger',
    body: `<p>Bosses, elites and tougher monsters have a yellow <b>Break Bar</b> under their health. Heavy attacks, shield bashes, skill finishers and Perfect Parries drain it.</p>
<p>Empty it and the enemy is <b>BROKEN!!</b> - stunned for 4 seconds, and every attack against it is a critical hit dealing <b>150%</b> damage. Save your strongest Sword Skills for that window. Some guardians, like Igniscor's armored scales or the Paragon's cross-shield guard, can only be truly hurt once broken or flanked.</p>`,
  },
  {
    id: 'switch', title: 'SWITCH! Partner Combos',
    body: `<p>Recruit a companion at a Guild Hall and fight side by side. Every hit either of you lands fills the <b>Switch Gauge</b>.</p>
<p>When it is full, press <kbd>R</kbd> or <kbd>Tab</kbd>: time slows, you backstep out of danger with 1.5s of invulnerability and shed enemy aggro, while your companion dashes in with a high-Break <b>Synchronized Chain Skill</b>. Follow up with any Sword Skill within 4 seconds for <b>+35% Combo Damage</b>.</p>`,
  },
  {
    id: 'skills', title: 'Sword Skills & Mastery',
    body: `<p>There are no classes. Six <b>Mastery Branches</b> - One-Handed Sword, Dual Blades, Shield & Fortress, Spear & Polearm, Bow & Marksmanship and Elemental & Arcane Magic - level up (Ranks 1-50) whenever you fight with their weapons.</p>
<p>Each rank and each character level grant <b>Skill Points</b>. Spend them in the Mastery window (<kbd>K</kbd>) on 5 active Sword Skills and 3 passives per branch, then drag skills to your 6-slot hotbar.</p>
<p>A skill needs the right weapon: blades for Sword skills, a blade in each hand for Dual Blades, a shield in your off hand for Shield skills, and so on. Use <kbd>Q</kbd> to swap between weapon sets A and B mid-combat and weave branches together. Every Sword Skill ignites with a bright flash and chime the moment you activate it.</p>`,
  },
  {
    id: 'awaken', title: 'Unique Skill Awakenings',
    body: `<p>The Aether watches how you fight. Reach certain milestones and the system will announce a <b>Unique Skill Awakening</b> - a permanent power that cannot be bought or traded.</p>
<ul><li><b>Dual Blades Overdrive</b> - for those who master the sword or the perfect parry.</li><li><b>Master Blacksmith's Soul</b> - for those who forge true masterworks.</li><li><b>Paragon's Divine Aegis</b> - for those who refuse to fall.</li></ul>`,
  },
  {
    id: 'forge', title: 'Blacksmithing',
    body: `<p>At any forge: <b>Smelt</b> ore into ingots, then <b>Forge</b> blueprints for all six weapon types (Longsword, Twin Edge, Spear, Halberd, Longbow, Arcane Staff) and armor (helms, hoods, circlets, brigandines, coats, plate, robes, greaves, cloaks and shields) across seven material tiers: Iron, Silver, Mithril, Orichalcum, Crimson Demonsteel, Starlight Crystal and Aetherial Dragonbone.</p>
<p>The <b>Anvil Hammer Gauge</b> decides quality: strike three times as the marker crosses the sweet spot. The result is <b>Standard</b> (100%), <b>Fine</b> (115%), <b>Masterwork</b> (130%) or a <b>Supreme Masterpiece</b> (150% stats, an extra gem socket, a custom name and a "Forged by" signature). <b>Auto-Forge</b> skips the mini-game but rarely beats Fine.</p>
<p><b>Temper</b> gear from +1 to +10 with Enhancement Stones (higher levels can fail but never destroy the item); tempered weapons glow and gather orbiting sparks. <b>Socket</b> Elemental Gems (Flame, Frost, Lightning, Wind, Void) into weapons to tint their aura and slash ribbons and add elemental effects. <b>Salvage</b> spare gear into ingots, Arcane Dust and stones.</p>`,
  },
  {
    id: 'alchemy', title: 'Alchemy & Cooking',
    body: `<p>Alchemy stations brew healing potions, mana tonics, draughts of precision and quicksilver, and <b>Elemental Blade Oils</b> that coat your weapon in fire, frost or lightning for 3 minutes.</p>
<p>Cooking hearths turn monster meat and herbs into buff meals lasting several minutes - from a <b>Crisp Boar Cutlet</b> to the legendary <b>Sovereign's Banquet</b>. Only one meal buff can be active at a time.</p>`,
  },
  {
    id: 'economy', title: 'Markets & Trade',
    body: `<p>Every city tracks its own supply and demand. Price indices for weapons, armor, materials, consumables, food, gems and furniture float between <b>70%</b> and <b>155%</b>. Selling in bulk drives a price down; buying drives it up; both drift back over time.</p>
<p>Watch the <b>Market Ticker</b> for <b>Trade Booms</b> and <b>Shortages</b>: buy cheap in one city, teleport, and sell high in another.</p>`,
  },
  {
    id: 'housing', title: 'Player Housing',
    body: `<p>Every city sells a house - from the Starter Timber Cottage (500G) to the Sovereign Sky-Palace Residence (25,000G). Buy furniture from any realtor, step inside and press <kbd>B</kbd> to open the <b>Grid Decorator</b>.</p>
<p>Place a <b>Storage Vault</b> (100 slots shared by all your houses), a <b>Personal Master Anvil</b> (+10% forging quality), <b>Alchemy</b> and <b>Cooking</b> stations, a <b>Royal Bed</b> (sleep until morning and wake Well Rested: +20% XP for 30 minutes), boss <b>Trophy Statues</b>, and <b>Weapon Racks</b> and <b>Armor Mannequins</b> that display the exact gear you mount on them.</p>`,
  },
  {
    id: 'guilds', title: 'Guilds & Companions',
    body: `<p>Four guilds welcome you: the <b>Knights of the Ivory Aegis</b>, the <b>Gilded Anvil Syndicate</b>, the <b>Crimson Wing Rangers</b> and the <b>Mystic Arcanum</b>. Join at any Guild Hall, take bounties from the board and turn them in to earn gold, XP and reputation. Ranks (Recruit, Member, Veteran, Officer, Champion) unlock permanent perks.</p>
<p>Six AI companions can join you. They follow you, fight in real time, use their own Sword Skills, wear the gear you give them and answer your <b>SWITCH!</b></p>`,
  },
  {
    id: 'world', title: 'Realms, Day & Night',
    body: `<p>A full day lasts 24 minutes. Night brings darkness, lanterns and <b>Named Elites</b> that prowl each wilderness from 20:00 to 05:00. Weather changes with the realm: rain, thunderstorms, blizzards and ember ash.</p>
<p>In <b>Ascension Chronicle Mode</b>, clearing a realm's dungeon boss unseals the Teleport Gate to the next realm. In <b>Unrestricted Open World Mode</b>, all five realms are open from the start.</p>`,
  },
  {
    id: 'endgame', title: 'Abyss & Coliseum',
    body: `<p>The <b>Infinite Abyss Labyrinth</b> (gates in Arcadia and Aetherion) generates a new floor every time. Floors carry modifiers - <i>Molten</i>, <i>Vampiric</i>, <i>Arcane-Shielded</i>, <i>Hasted</i> - and every fifth floor is a <b>Boss Rush</b>. Checkpoints unlock every ten floors, and deeper floors drop the Relic Shards and Mythic Cores needed for Mythic blueprints. Your deepest dives are recorded on the leaderboard.</p>
<p>The <b>Grand Coliseum</b> in Arcadia hosts five Tournament Cups and Endless Wave Survival. Falling in the arena carries no death penalty.</p>`,
  },
  {
    id: 'death', title: 'Death & Respawn',
    body: `<p>When your HP reaches zero, an <b>Emergency Crystal Teleport</b> returns you to the Teleport Gate of the last city you visited at full HP and MP.</p>
<p>You lose <b>15% of the XP needed for your current level</b> (never a whole level - XP stops at zero) and a <b>5% gold</b> revival fee. Your items and gear are never lost.</p>`,
  },
];
