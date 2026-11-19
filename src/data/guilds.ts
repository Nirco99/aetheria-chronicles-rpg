// Guild factions, the six recruitable AI companions and the bounty board generator.
import type { Bounty, CompanionDef, GuildDef, GuildId } from '../types/game';
import { REALMS } from './realms';
import { MONSTERS } from './monsters';
import { itemDef } from './items';
import { RNG } from '../engine/util';

export const GUILDS: Record<GuildId, GuildDef> = {
  aegis: {
    id: 'aegis', name: 'Knights of the Ivory Aegis', short: 'Ivory Aegis', color: '#efe6d2', hall: 3,
    motto: 'The shield is the first oath.',
    perk: '+4% DEF and +3% max HP per rank',
    perkStats: (r) => ({ defPct: 0.04 * r, hpPct: 0.03 * r }),
  },
  anvil: {
    id: 'anvil', name: 'Gilded Anvil Syndicate', short: 'Gilded Anvil', color: '#ffd166', hall: 2,
    motto: 'Every legend was hammered out on an anvil.',
    perk: '+3% shop discount, +2% tempering success and wider forge sweet spots per rank',
    perkStats: () => ({}),
  },
  wing: {
    id: 'wing', name: 'Crimson Wing Rangers', short: 'Crimson Wing', color: '#ff5d6c', hall: 0,
    motto: 'Swift as the wind, sure as the arrow.',
    perk: '+3% move speed and +3% critical chance per rank',
    perkStats: (r) => ({ move: 0.03 * r, crit: 0.03 * r }),
  },
  arcanum: {
    id: 'arcanum', name: 'Mystic Arcanum', short: 'Mystic Arcanum', color: '#c18cff', hall: 1,
    motto: 'Knowledge is the sharpest edge.',
    perk: '+4% MAG and +8% MP regeneration per rank',
    perkStats: (r) => ({ magPct: 0.04 * r, regen: 0.08 * r }),
  },
};
export const GUILD_IDS: GuildId[] = ['aegis', 'anvil', 'wing', 'arcanum'];
export const GUILD_RANKS = ['Recruit', 'Member', 'Veteran', 'Officer', 'Champion'];
export const GUILD_REP = [0, 100, 300, 700, 1500];

export function guildRank(rep: number): number {
  let r = 0;
  for (let i = 0; i < GUILD_REP.length; i++) if (rep >= GUILD_REP[i]) r = i;
  return r;
}

export const COMPANIONS: CompanionDef[] = [
  {
    id: 'tobias', name: 'Tobias Reed', title: 'Wandering Lancer', guild: null, branch: 'spear', weapon: 'spear', off: null,
    skin: 2, hairStyle: 0, hairColor: 1, eyeColor: 2,
    colors: { main: '#3f7a4a', accent: '#24452a', trim: '#e8d7b5', glow: '#9effc8' },
    req: { level: 3 }, city: 0, chain: 'Comet Relay',
    bio: 'A cheerful lancer who walked every road of the Emerald Plains before the gates of Arcadia ever opened.',
    lines: ["Need a spear at your back? I'm cheap and I don't snore. Much.", 'Fill the Switch gauge and shout - I will be there.', 'These plains are kinder by daylight. The night belongs to Thornback.'],
  },
  {
    id: 'kael', name: 'Kael Ashborne', title: 'Ivory Aegis Vanguard', guild: 'aegis', branch: 'shield', weapon: 'sword', off: 'shield',
    skin: 1, hairStyle: 5, hairColor: 3, eyeColor: 1,
    colors: { main: '#efe6d2', accent: '#9a2a3a', trim: '#ffd27a', glow: '#fff1a8' },
    req: { level: 8, guild: 'aegis', rank: 1 }, city: 0, chain: 'Bastion Breaker',
    bio: 'A knight of the Ivory Aegis who believes no ally should ever fall while he still stands.',
    lines: ['Stay behind my shield until you see an opening.', 'Prove yourself to the Aegis and my blade is yours.', 'A perfect parry is a promise kept.'],
  },
  {
    id: 'lyra', name: 'Lyra Windwhisper', title: 'Crimson Wing Scout', guild: 'wing', branch: 'bow', weapon: 'bow', off: null,
    skin: 0, hairStyle: 2, hairColor: 4, eyeColor: 2,
    colors: { main: '#a8301a', accent: '#4a140a', trim: '#ffd166', glow: '#ffb35c' },
    req: { level: 12, guild: 'wing', rank: 1 }, city: 1, chain: 'Hawkeye Barrage',
    bio: 'The fastest scout of the Crimson Wing. She can split an arrow at two hundred paces - in the rain.',
    lines: ['I never miss twice.', 'Wing members only, sorry. Earn your feathers first!', 'Those lakes hide more than fish.'],
  },
  {
    id: 'seren', name: 'Seren Vale', title: 'Arcanum Lightweaver', guild: 'arcanum', branch: 'magic', weapon: 'staff', off: null,
    skin: 7, hairStyle: 1, hairColor: 7, eyeColor: 4,
    colors: { main: '#4b2f8a', accent: '#24154a', trim: '#ffd27a', glow: '#c69bff' },
    req: { level: 14, guild: 'arcanum', rank: 1 }, city: 1, chain: 'Prism Cascade',
    bio: 'A gentle scholar of the Mystic Arcanum who weaves healing light as easily as lightning.',
    lines: ['I will keep you standing. Try to keep me out of the front row.', 'The Arcanum shares its secrets with its own.', 'Every spell is a question asked of the world.'],
  },
  {
    id: 'brannoc', name: 'Brannoc Ironhand', title: 'Gilded Anvil Warsmith', guild: 'anvil', branch: 'spear', weapon: 'halberd', off: null,
    skin: 5, hairStyle: 7, hairColor: 4, eyeColor: 0,
    colors: { main: '#c0283f', accent: '#2a0d12', trim: '#ffd166', glow: '#ff9a3d' },
    req: { level: 22, guild: 'anvil', rank: 1 }, city: 2, chain: 'Anvilfall',
    bio: 'A towering warsmith who tests every halberd he forges on the hardest golems of the caldera.',
    lines: ['Steel tells the truth. Swing and listen.', 'Syndicate members get my hammer - and my halberd.', 'Bring me Orichalcum and I will bring you legends.'],
  },
  {
    id: 'mira', name: 'Mira Duskblade', title: 'Twin-Fang Duelist', guild: null, branch: 'dual', weapon: 'sword', off: 'sword',
    skin: 3, hairStyle: 3, hairColor: 0, eyeColor: 3,
    colors: { main: '#16161c', accent: '#2a0d12', trim: '#c0283f', glow: '#ff3b5c' },
    req: { level: 30, gold: 5000 }, city: 3, chain: 'Dusk Requiem',
    bio: 'A mercenary duelist who fights with two blades and a smile. Her loyalty is expensive - and absolute.',
    lines: ['Five thousand gold and I am yours until the last floor of the Abyss.', 'Two blades, zero hesitation.', 'Call the Switch. I love an entrance.'],
  },
];
export const COMPANION_BY_ID: Record<string, CompanionDef> = Object.fromEntries(COMPANIONS.map((c) => [c.id, c]));

// ------------------------------------------------------------------ bounty board

const GUILD_FOCUS: Record<GuildId, Bounty['kind'][]> = {
  aegis: ['hunt', 'dungeon', 'elite', 'hunt'],
  anvil: ['gather', 'gather', 'hunt', 'arena'],
  wing: ['hunt', 'elite', 'gather', 'hunt'],
  arcanum: ['gather', 'abyss', 'hunt', 'elite'],
};

export function generateBoard(unlocked: number, day: number, level: number): Bounty[] {
  const rng = new RNG(day * 7919 + unlocked * 131 + 17);
  const out: Bounty[] = [];
  const realms = Math.max(1, Math.min(5, unlocked));
  let n = 0;
  for (const gid of Object.keys(GUILDS) as GuildId[]) {
    const kinds = GUILD_FOCUS[gid];
    for (let k = 0; k < 3; k++) {
      const kind = kinds[(k + day) % kinds.length];
      const realm = Math.min(realms - 1, rng.int(Math.max(0, realms - 2), realms - 1));
      const R = REALMS[realm];
      const lvl = Math.max(level, R.levels[0]);
      const baseGold = Math.round(60 + lvl * 18);
      const baseXp = Math.round(40 + Math.pow(lvl, 1.7) * 10);
      const id = `b${day}_${n++}`;
      if (kind === 'hunt') {
        const m = rng.pick(R.monsters);
        const count = rng.int(6, 12);
        out.push({ id, guild: gid, kind, target: m, count, progress: 0, realm, gold: baseGold * 2, xp: baseXp * 3, rep: 40, title: `Cull the ${MONSTERS[m].name}s`, desc: `Slay ${count} ${MONSTERS[m].name}s in the ${R.short}.` });
      } else if (kind === 'gather') {
        const pool = [...R.ores, ...R.herbs];
        const it = rng.pick(pool);
        const count = rng.int(5, 10);
        out.push({ id, guild: gid, kind, target: it, count, progress: 0, realm, gold: baseGold * 2, xp: baseXp * 2, rep: 35, title: `Requisition: ${itemDef(it).name}`, desc: `Deliver ${count} ${itemDef(it).name} to any Guild Hall. Items are handed over on turn-in.` });
      } else if (kind === 'elite') {
        const e = R.elite;
        out.push({ id, guild: gid, kind, target: e, count: 1, progress: 0, realm, gold: baseGold * 5, xp: baseXp * 8, rep: 90, title: `Night Bounty: ${MONSTERS[e].name}`, desc: `This Named Elite stalks the ${R.short} after nightfall (20:00-05:00). Hunt it down.` });
      } else if (kind === 'dungeon') {
        out.push({ id, guild: gid, kind, target: R.boss, count: 1, progress: 0, realm, gold: baseGold * 6, xp: baseXp * 10, rep: 120, title: `Clear the ${R.dungeon}`, desc: `Defeat ${MONSTERS[R.boss].name} in the ${R.dungeon}.` });
      } else if (kind === 'abyss') {
        const floor = Math.max(3, Math.min(60, Math.floor(level / 2) + rng.int(0, 4)));
        out.push({ id, guild: gid, kind, target: String(floor), count: 1, progress: 0, realm, gold: baseGold * 5, xp: baseXp * 7, rep: 100, title: `Abyss Survey: Floor ${floor}`, desc: `Reach floor ${floor} of the Infinite Abyss Labyrinth.` });
      } else {
        const cup = Math.max(0, Math.min(4, Math.floor(level / 10)));
        out.push({ id, guild: gid, kind: 'arena', target: String(cup), count: 1, progress: 0, realm, gold: baseGold * 4, xp: baseXp * 6, rep: 80, title: `Coliseum Glory`, desc: `Win the ${['Bronze', 'Silver', 'Gold', 'Platinum', 'Champion'][cup]} Cup at the Grand Coliseum in Arcadia.` });
      }
    }
  }
  return out;
}
