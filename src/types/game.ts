// =====================================================================================
// AETHERIA CHRONICLES: SWORD & FORGE - single source-of-truth type contract.
// Every module imports its shared shapes from here so data, systems, renderers and UI
// agree on exactly one definition of each concept.
// =====================================================================================

/** Facing direction for 4-direction sprites: 0 DOWN, 1 UP, 2 LEFT, 3 RIGHT. */
export type Dir = 0 | 1 | 2 | 3;

export type Branch = 'sword' | 'dual' | 'shield' | 'spear' | 'bow' | 'magic';
export type WeaponType = 'sword' | 'twinblade' | 'spear' | 'halberd' | 'bow' | 'staff';
export type ArmorSlot = 'head' | 'chest' | 'boots' | 'cloak' | 'shield';
export type EquipSlot = 'mainA' | 'offA' | 'mainB' | 'offB' | 'head' | 'chest' | 'boots' | 'cloak';
export type CompanionSlot = 'main' | 'off' | 'head' | 'chest' | 'boots' | 'cloak';
export type Element = 'none' | 'fire' | 'frost' | 'lightning' | 'wind' | 'void' | 'holy' | 'poison';
export type GemType = 'flame' | 'frost' | 'lightning' | 'wind' | 'void';
/** 0 Common, 1 Uncommon, 2 Rare, 3 Epic, 4 Legendary, 5 Mythic */
export type Rarity = 0 | 1 | 2 | 3 | 4 | 5;
export type CraftGrade = 'standard' | 'fine' | 'masterwork' | 'supreme';
export type ItemCategory = 'weapon' | 'armor' | 'material' | 'consumable' | 'food' | 'gem' | 'furniture' | 'trophy';
export type MarketCategory = 'weapon' | 'armor' | 'material' | 'consumable' | 'food' | 'gem' | 'furniture';
export type GuildId = 'aegis' | 'anvil' | 'wing' | 'arcanum';
export type WorldMode = 'chronicle' | 'open';
export type MapKind = 'city' | 'wild' | 'dungeon' | 'abyss' | 'house' | 'arena';
export type Weather = 'clear' | 'rain' | 'storm' | 'blizzard' | 'ash';
export type AmbientKind = 'blossom' | 'leaf' | 'ember' | 'snow' | 'mote' | 'firefly' | 'dust' | 'none';
export type Team = 'player' | 'enemy' | 'neutral';

// ------------------------------------------------------------------ animation

export type AnimKind = 'idle' | 'walk' | 'attack' | 'block' | 'bow' | 'cast' | 'dodge' | 'hurt' | 'skill' | 'stun' | 'dead' | 'sleep';

export interface Anim {
  kind: AnimKind;
  t: number;
  walk: number;
  /** 0..1 progress of the current weapon swing */
  swing: number;
  /** swing arc start / end (world angle) */
  a0: number;
  a1: number;
  hand: 0 | 1;
  /** pre-motion star glint timer */
  glint: number;
  glintColor: string;
  /** bow draw / spell charge 0..1 */
  charge: number;
  ghosts: { x: number; y: number; z: number; t: number; dir: Dir }[];
}

// ------------------------------------------------------------------ stats

export interface StatBlock {
  atk?: number;
  def?: number;
  mag?: number;
  hp?: number;
  mp?: number;
  /** additive crit chance, 0.05 = +5% */
  crit?: number;
  /** additive crit damage, 0.2 = +20% */
  critDmg?: number;
  /** attack speed bonus fraction */
  aspd?: number;
  /** move speed bonus fraction */
  move?: number;
  /** flat break power */
  brk?: number;
  /** block efficiency bonus fraction */
  block?: number;
  /** mana regeneration bonus fraction */
  regen?: number;
  /** percentage modifiers applied after flat sums */
  atkPct?: number;
  defPct?: number;
  magPct?: number;
  hpPct?: number;
  xpPct?: number;
}

export interface Stats {
  maxHp: number;
  maxMp: number;
  maxSta: number;
  atk: number;
  def: number;
  mag: number;
  crit: number;
  critDmg: number;
  aspd: number;
  move: number;
  brk: number;
  block: number;
  mpRegen: number;
  xpMult: number;
  /** bonus elemental damage fraction added to hits, from gems and blade oils */
  elem: Partial<Record<Element, number>>;
}

// ------------------------------------------------------------------ items & gear

export interface GearColors {
  main: string;
  accent: string;
  trim: string;
  glow: string;
}

export interface GearItem {
  uid: string;
  baseId: string;
  kind: 'weapon' | 'armor';
  wtype?: WeaponType;
  aslot?: ArmorSlot;
  /** visual sub-style: chest 0 brigandine 1 coat 2 plate 3 robe 4 dragonmail; head 0 helm 1 hood 2 circlet */
  style: number;
  tier: number;
  rarity: Rarity;
  grade: CraftGrade | null;
  temper: number;
  sockets: number;
  gems: (GemType | null)[];
  base: StatBlock;
  name: string;
  customName?: string;
  forgedBy?: string;
  mythic?: boolean;
  colors: GearColors;
}

export type IconShape =
  | 'ore' | 'ingot' | 'herb' | 'meat' | 'potion' | 'flask' | 'dish' | 'gem' | 'stone' | 'dust'
  | 'hide' | 'fang' | 'core' | 'shard' | 'scale' | 'cloth' | 'cog' | 'bone' | 'feather' | 'furniture'
  | 'trophy' | 'oil' | 'bark' | 'essence' | 'relic';

export interface BuffSpec {
  id: string;
  name: string;
  dur: number;
  color: string;
  stats?: StatBlock;
  hpRegen?: number;
  oil?: Element;
  icon?: string;
}

export interface ConsumableEffect {
  heal?: number;
  mana?: number;
  sta?: number;
  buff?: BuffSpec;
  cleanse?: boolean;
}

export type FurnitureKind =
  | 'vault' | 'anvil' | 'alchemy' | 'hearth' | 'bed' | 'trophy' | 'rack' | 'mannequin'
  | 'rug' | 'plant' | 'lantern' | 'bookshelf' | 'table' | 'chair' | 'banner';

export interface ItemDef {
  id: string;
  name: string;
  cat: ItemCategory;
  value: number;
  desc: string;
  icon: IconShape;
  color: string;
  color2?: string;
  tier?: number;
  effect?: ConsumableEffect;
  furniture?: FurnitureKind;
  gem?: GemType;
  trophyOf?: string;
}

export interface FurnitureDef {
  kind: FurnitureKind;
  w: number;
  h: number;
  walkable: boolean;
  mounts: number;
  light?: string;
}

export interface PlacedFurniture {
  item: string;
  kind: FurnitureKind;
  tx: number;
  ty: number;
  mounts: (GearItem | null)[];
}

export interface HouseSave {
  owned: boolean;
  furniture: PlacedFurniture[];
}

// ------------------------------------------------------------------ status & buffs

export type StatusKind = 'burn' | 'poison' | 'chill' | 'freeze' | 'stun' | 'root' | 'shred' | 'shock';

export interface StatusApply {
  kind: StatusKind;
  dur: number;
  chance?: number;
  power?: number;
}

export interface StatusInst {
  kind: StatusKind;
  t: number;
  power: number;
  tick: number;
}

export interface BuffInst {
  spec: BuffSpec;
  t: number;
}

// ------------------------------------------------------------------ combat geometry

export interface RibbonSpec {
  /** start / end angle relative to aim (radians) */
  a0: number;
  a1: number;
  r?: number;
  w?: number;
  color?: string;
  color2?: string;
  /** thrust ribbons are straight; star ribbons zig-zag */
  style?: 'arc' | 'thrust' | 'cross';
  len?: number;
}

export type ProjKind =
  | 'arrow' | 'bolt' | 'fireball' | 'icelance' | 'orb' | 'spit' | 'rock' | 'feather'
  | 'holy' | 'shard' | 'water' | 'meteor' | 'rail' | 'spore';

export interface ProjSpec {
  kind: ProjKind;
  speed: number;
  mult: number;
  range: number;
  radius?: number;
  pierce?: boolean;
  element?: Element;
  status?: StatusApply;
  magic?: boolean;
  homing?: number;
  color?: string;
  brk?: number;
  kb?: number;
  aoe?: number;
}

export interface SkillHitOpts {
  shape: 'arc' | 'circle' | 'line' | 'ring';
  range?: number;
  arc?: number;
  /** angle offset from the cast aim */
  angle?: number;
  width?: number;
  inner?: number;
  at?: 'self' | 'cursor' | 'point';
  px?: number;
  py?: number;
  mult: number;
  brk?: number;
  kb?: number;
  element?: Element;
  status?: StatusApply;
  magic?: boolean;
  crit?: number;
  forceCrit?: boolean;
  ribbon?: RibbonSpec | false;
  maxTargets?: number;
  heal?: number;
}

export type ZoneKind = 'sanctuary' | 'citadel' | 'vortex' | 'fire' | 'poison' | 'aegis' | 'frost' | 'void';

export interface ZoneSpec {
  kind: ZoneKind;
  x: number;
  y: number;
  r: number;
  dur: number;
  color: string;
  team: Team;
  tick?: number;
  heal?: number;
  mult?: number;
  slow?: number;
  pull?: number;
  element?: Element;
  status?: StatusApply;
  follow?: boolean;
}

export type TeleShape =
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'cone'; x: number; y: number; a: number; arc: number; r: number }
  | { kind: 'line'; x: number; y: number; a: number; len: number; w: number }
  | { kind: 'ring'; x: number; y: number; r: number; inner: number };

export type SfxName =
  | 'swing' | 'swing2' | 'hit' | 'crit' | 'parry' | 'block' | 'chime' | 'shatter' | 'levelup'
  | 'switch' | 'break' | 'ui' | 'uiBack' | 'coin' | 'anvil' | 'arrow' | 'magic' | 'fire' | 'ice'
  | 'thunder' | 'heal' | 'hurt' | 'death' | 'dodge' | 'pickup' | 'boot' | 'bootOk' | 'engage'
  | 'door' | 'quake' | 'roar' | 'error' | 'craft' | 'awaken' | 'splash' | 'beam' | 'wind'
  | 'buff' | 'teleport' | 'gather' | 'telegraph';

export interface SkillCaster {
  x: number;
  y: number;
  aim: number;
  level: number;
}

/** The scripting surface every active Sword Skill uses (player and companions share it). */
export interface SkillAPI {
  readonly caster: SkillCaster;
  readonly aim: number;
  readonly tx: number;
  readonly ty: number;
  at(t: number, fn: () => void): void;
  dash(angle: number, dist: number, dur: number): void;
  leap(x: number, y: number, dur: number): void;
  hit(o: SkillHitOpts): number;
  proj(p: ProjSpec, angle: number): void;
  blinkBehind(maxDist: number): boolean;
  buff(spec: BuffSpec): void;
  barrier(fraction: number, dur: number): void;
  zone(z: Omit<ZoneSpec, 'team'>): void;
  trap(x: number, y: number, dur: number, root: number): void;
  taunt(radius: number, dur: number): void;
  chain(mult: number, jumps: number, range: number, element: Element, status?: StatusApply): void;
  counter(dur: number, onTrigger: () => void): void;
  invuln(dur: number): void;
  ribbon(r: RibbonSpec): void;
  ring(color: string, radius: number): void;
  sfx(name: SfxName): void;
  shake(power: number): void;
  allowMove(dur: number, speedMult: number): void;
  rain(x: number, y: number, r: number, count: number, dur: number, mult: number, element: Element): void;
}

export interface ActiveSkillDef {
  id: string;
  name: string;
  branch: Branch;
  rank: number;
  sp: number;
  mp: number;
  cd: number;
  dur: number;
  desc: string;
  color: string;
  color2: string;
  /** companion AI hint */
  ai: 'melee' | 'ranged' | 'gap' | 'support' | 'defense';
  range: number;
  run: (api: SkillAPI) => void;
}

export interface PassiveSkillDef {
  id: string;
  name: string;
  branch: Branch;
  rank: number;
  desc: string;
  max: number;
  stats?: (lvl: number) => StatBlock;
}

export interface AwakeningDef {
  id: string;
  name: string;
  desc: string;
  trigger: string;
}

// ------------------------------------------------------------------ monsters

export type MonsterDrawKind =
  | 'wolf' | 'boar' | 'kobold' | 'treant' | 'spider' | 'elemental' | 'sporeling' | 'drake'
  | 'golem' | 'humanoid' | 'imp' | 'wyvern' | 'wraith' | 'automaton' | 'wisp' | 'reaver' | 'wyrm';

export interface MonsterAttackDef {
  id: string;
  name?: string;
  range: number;
  cd: number;
  windup: number;
  recover: number;
  shape: 'cone' | 'circle' | 'line' | 'ring' | 'proj' | 'none';
  r?: number;
  arc?: number;
  len?: number;
  w?: number;
  inner?: number;
  at?: 'self' | 'target';
  mult: number;
  brk?: number;
  kb?: number;
  element?: Element;
  status?: StatusApply;
  dash?: number;
  proj?: ProjSpec;
  count?: number;
  spread?: number;
  repeat?: number;
  gap?: number;
  special?: string;
  weight?: number;
  /** rotates the telegraph while charging (beam sweeps) */
  sweep?: number;
}

export interface HumanoidStyle {
  skin: string;
  hair: string;
  hairStyle: number;
  eyes: string;
  chest: { style: number; tier: number; main: string; accent: string; trim: string } | null;
  helmet: { style: number; tier: number; main: string; accent: string; trim: string } | null;
  boots: { main: string; accent: string } | null;
  cloak: { main: string; accent: string; trim: string } | null;
  weapon: WeaponType | null;
  weaponColor: string;
  off: 'shield' | 'sword' | null;
  ghost?: boolean;
  scale?: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  draw: MonsterDrawKind;
  realm: number;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  size: number;
  poise: number;
  xp: number;
  aggro: number;
  attacks: MonsterAttackDef[];
  drops: { id: string; chance: number; min?: number; max?: number }[];
  colors: string[];
  ranged?: boolean;
  flying?: boolean;
  element?: Element;
  elite?: boolean;
  boss?: boolean;
  title?: string;
  humanoid?: HumanoidStyle;
  keepDistance?: number;
}

export interface BossPhase {
  /** phase starts when HP fraction drops to or below this value */
  at: number;
  name: string;
  attacks: string[];
  speed?: number;
  enter?: string;
}

export interface BossDef extends MonsterDef {
  phases: BossPhase[];
  trophy: string;
  intro: string;
}

// ------------------------------------------------------------------ world

export type GroundTile = number;

export type PropKind =
  | 'tree' | 'rock' | 'building' | 'lamp' | 'gate' | 'abyssgate' | 'crystal' | 'chest'
  | 'furniture' | 'fountain' | 'statue' | 'sign' | 'stall' | 'banner' | 'bush' | 'dungeon'
  | 'pillar' | 'well' | 'bench' | 'crate' | 'stairs' | 'torch' | 'flowers' | 'coliseum' | 'board';

export interface Prop {
  id: number;
  kind: PropKind;
  x: number;
  y: number;
  /** sprite cache key */
  sprite: string;
  /** sprite anchor: sprite drawn at (x - ax, y - ay) */
  ax: number;
  ay: number;
  sw: number;
  sh: number;
  /** extra sort offset */
  sortOff: number;
  light?: { r: number; color: string; flicker?: boolean; oy?: number };
  data?: Record<string, unknown>;
  hidden?: boolean;
}

export interface ResourceNode {
  id: number;
  kind: 'ore' | 'herb';
  item: string;
  x: number;
  y: number;
  ready: boolean;
  respawn: number;
  color: string;
}

export type ShopKind = 'general' | 'smith' | 'alchemist' | 'market' | 'furniture';

export type InteractAction =
  | { t: 'gate' }
  | { t: 'abyss' }
  | { t: 'coliseum' }
  | { t: 'shop'; shop: ShopKind }
  | { t: 'forge'; home?: boolean }
  | { t: 'alchemy' }
  | { t: 'cooking' }
  | { t: 'guild' }
  | { t: 'estate' }
  | { t: 'house' }
  | { t: 'exitHouse' }
  | { t: 'dungeon' }
  | { t: 'leaveDungeon' }
  | { t: 'crystal' }
  | { t: 'stairs' }
  | { t: 'leaveAbyss' }
  | { t: 'leaveArena' }
  | { t: 'npc'; npc: number }
  | { t: 'sign'; text: string }
  | { t: 'furniture'; index: number }
  | { t: 'node'; node: number }
  | { t: 'companion'; id: string };

export interface Interactable {
  id: number;
  x: number;
  y: number;
  r: number;
  label: string;
  action: InteractAction;
  disabled?: boolean;
}

export interface MapExit {
  x: number;
  y: number;
  w: number;
  h: number;
  to: string;
  entry: string;
  label: string;
}

export interface SpawnZone {
  x: number;
  y: number;
  r: number;
  monsters: string[];
  lvl: [number, number];
  count: number;
  respawn: number;
  timer: number;
  alive: number;
}

export interface NpcSpawn {
  x: number;
  y: number;
  role: NpcRole;
  name: string;
  wander: number;
  shop?: ShopKind;
  companion?: string;
}

export type NpcRole =
  | 'smith' | 'merchant' | 'alchemist' | 'guild' | 'realtor' | 'gatekeeper' | 'villager'
  | 'guard' | 'arena' | 'warden' | 'chef' | 'companion' | 'banker';

export interface BossRoom {
  x: number;
  y: number;
  w: number;
  h: number;
  boss: string;
  level: number;
  doorCells: number[];
  started: boolean;
  defeated: boolean;
}

// ------------------------------------------------------------------ guilds, bounties, companions

export interface GuildDef {
  id: GuildId;
  name: string;
  short: string;
  color: string;
  hall: number;
  motto: string;
  perk: string;
  perkStats: (rank: number) => StatBlock;
}

export type BountyKind = 'hunt' | 'gather' | 'elite' | 'dungeon' | 'abyss' | 'arena';

export interface Bounty {
  id: string;
  guild: GuildId;
  kind: BountyKind;
  target: string;
  count: number;
  progress: number;
  realm: number;
  gold: number;
  xp: number;
  rep: number;
  title: string;
  desc: string;
}

export interface CompanionDef {
  id: string;
  name: string;
  title: string;
  guild: GuildId | null;
  branch: Branch;
  weapon: WeaponType;
  off: 'shield' | 'sword' | null;
  skin: number;
  hairStyle: number;
  hairColor: number;
  eyeColor: number;
  colors: GearColors;
  req: { level: number; guild?: GuildId; rank?: number; gold?: number };
  bio: string;
  lines: string[];
  city: number;
  chain: string;
}

export interface CompanionSave {
  recruited: boolean;
  equip: Record<CompanionSlot, GearItem | null>;
}

// ------------------------------------------------------------------ economy

export interface MarketEvent {
  city: number;
  cat: MarketCategory;
  mult: number;
  kind: 'boom' | 'shortage';
  until: number;
}

export interface EconomyState {
  idx: number[][];
  events: MarketEvent[];
  nextEvent: number;
}

// ------------------------------------------------------------------ save data

export interface Appearance {
  skin: number;
  hairStyle: number;
  hairColor: number;
  eyeColor: number;
}

export interface Counters {
  perfectParries: number;
  masterworks: number;
  dmgBlocked: number;
  kills: number;
  bossKills: number;
  deaths: number;
  forged: number;
  lowHpBossWins: number;
  gathered: number;
  crafted: number;
}

export interface SaveData {
  version: number;
  slot: number;
  name: string;
  appearance: Appearance;
  mode: WorldMode;
  created: number;
  playTime: number;
  level: number;
  xp: number;
  gold: number;
  sp: number;
  hp: number;
  mp: number;
  equip: Record<EquipSlot, GearItem | null>;
  activeSet: 'A' | 'B';
  showHelmet: boolean;
  gear: GearItem[];
  items: Record<string, number>;
  vault: { gear: GearItem[]; items: Record<string, number> };
  mastery: Record<Branch, { rank: number; xp: number }>;
  learned: string[];
  passives: Record<string, number>;
  hotbar: (string | null)[];
  quick: (string | null)[];
  awakenings: string[];
  counters: Counters;
  guilds: Record<GuildId, number>;
  joined: GuildId[];
  bounties: Bounty[];
  board: Bounty[];
  boardDay: number;
  companions: Record<string, CompanionSave>;
  activeCompanion: string | null;
  houses: Record<number, HouseSave>;
  unlocked: number;
  bosses: boolean[];
  lastCity: number;
  map: string;
  px: number;
  py: number;
  time: number;
  day: number;
  economy: EconomyState;
  arena: { cups: boolean[]; bestWave: number };
  abyss: { best: number; checkpoint: number };
  elitesSlain: string[];
  tutorialSeen: boolean;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  shake: boolean;
  numbers: boolean;
  fps: boolean;
}

export interface LeaderEntry {
  name: string;
  level: number;
  floor: number;
  date: string;
}

export interface SlotSummary {
  slot: number;
  name: string;
  level: number;
  location: string;
  playTime: number;
  mode: WorldMode;
  saved: number;
}
