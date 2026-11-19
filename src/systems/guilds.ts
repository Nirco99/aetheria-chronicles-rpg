// Guild membership, reputation ranks, the bounty board and companion recruitment.
import type { CompanionSave, GearItem, GuildId } from '../types/game';
import { G } from '../core/state';
import { COMPANION_BY_ID, GUILDS, GUILD_RANKS, generateBoard, guildRank } from '../data/guilds';
import { makeGear } from '../data/items';
import { tierForLevel } from '../data/constants';
import { countItem, removeItem } from './inventory';
import { gainXp } from './progression';
import { audio } from '../engine/audio';

export function refreshBoard(force = false): void {
  const s = G.save;
  if (!force && s.boardDay === s.day && s.board.length) return;
  s.boardDay = s.day;
  s.board = generateBoard(s.unlocked, s.day, s.level).filter((b) => !s.bounties.some((a) => a.title === b.title && a.guild === b.guild));
}

export function joinGuild(g: GuildId): void {
  const s = G.save;
  if (s.joined.includes(g)) return;
  s.joined.push(g);
  s.guilds[g] = s.guilds[g] ?? 0;
  G.player.refresh();
  audio.play('buff');
  G.ui.toast(`You joined the ${GUILDS[g].name}! Rank: Recruit.`, 'mastery');
}

export function acceptBounty(id: string): string | null {
  const s = G.save;
  const b = s.board.find((x) => x.id === id);
  if (!b) return 'That bounty is no longer posted.';
  if (!s.joined.includes(b.guild)) return `Join the ${GUILDS[b.guild].name} to accept its bounties.`;
  if (s.bounties.length >= 5) return 'You can track at most 5 bounties at once.';
  s.board = s.board.filter((x) => x.id !== id);
  s.bounties.push(b);
  audio.play('ui');
  return null;
}

export function bountyReady(b: { kind: string; target: string; count: number; progress: number }): boolean {
  if (b.kind === 'gather') return countItem(b.target) >= b.count;
  return b.progress >= b.count;
}

export function turnIn(id: string): string | null {
  const s = G.save;
  const b = s.bounties.find((x) => x.id === id);
  if (!b) return 'Unknown bounty.';
  if (!bountyReady(b)) return 'This bounty is not complete yet.';
  if (b.kind === 'gather') removeItem(b.target, b.count);
  s.bounties = s.bounties.filter((x) => x.id !== id);
  s.gold += b.gold;
  const before = guildRank(s.guilds[b.guild]);
  s.guilds[b.guild] += b.rep;
  const after = guildRank(s.guilds[b.guild]);
  gainXp(b.xp);
  audio.play('coin');
  G.ui.toast(`Bounty complete: +${b.gold} G, +${b.xp} XP, +${b.rep} ${GUILDS[b.guild].short} reputation.`, 'loot');
  if (after > before) {
    G.player.refresh();
    audio.play('levelup');
    G.ui.toast(`${GUILDS[b.guild].name} rank up: ${GUILD_RANKS[after]}! Perks increased.`, 'mastery');
  }
  return null;
}

export function abandonBounty(id: string): void {
  G.save.bounties = G.save.bounties.filter((x) => x.id !== id);
}

function progress(kind: string, match: (target: string) => boolean, set?: number): void {
  for (const b of G.save.bounties) {
    if (b.kind !== kind || b.progress >= b.count || !match(b.target)) continue;
    b.progress = set ?? b.progress + 1;
    if (b.progress >= b.count) G.ui.toast(`Bounty ready: ${b.title} - turn it in at any Guild Hall.`, 'mastery');
  }
}

export function onKillBounty(defId: string): void {
  progress('hunt', (t) => t === defId);
  progress('elite', (t) => t === defId);
}
export function onBossBounty(bossId: string): void {
  progress('dungeon', (t) => t === bossId);
}
export function onAbyssBounty(floor: number): void {
  progress('abyss', (t) => floor >= Number(t), 1);
}
export function onArenaBounty(cup: number): void {
  progress('arena', (t) => cup >= Number(t), 1);
}

// ------------------------------------------------------------------ companions

export function recruitBlocker(id: string): string | null {
  const s = G.save;
  const def = COMPANION_BY_ID[id];
  if (!def) return 'Unknown companion.';
  if (s.companions[id]?.recruited) return null;
  if (s.level < def.req.level) return `${def.name} wants a partner of at least level ${def.req.level}.`;
  if (def.req.guild) {
    if (!s.joined.includes(def.req.guild)) return `${def.name} only fights alongside members of the ${GUILDS[def.req.guild].name}.`;
    if (guildRank(s.guilds[def.req.guild]) < (def.req.rank ?? 0)) return `Reach ${GUILD_RANKS[def.req.rank ?? 0]} rank in the ${GUILDS[def.req.guild].short} first.`;
  }
  if (def.req.gold && s.gold < def.req.gold) return `${def.name}'s fee is ${def.req.gold.toLocaleString()} G.`;
  return null;
}

export function defaultCompanionGear(id: string): CompanionSave['equip'] {
  const def = COMPANION_BY_ID[id];
  const t = tierForLevel(G.save.level);
  const wBase: Record<string, string> = { sword: 'w_sword', twinblade: 'w_twinblade', spear: 'w_spear', halberd: 'w_halberd', bow: 'w_bow', staff: 'w_staff' };
  const chest = def.branch === 'magic' ? 'a_robe' : def.branch === 'dual' || def.branch === 'bow' ? 'a_coat' : def.branch === 'shield' ? 'a_plate' : 'a_brig';
  const head = def.branch === 'shield' ? 'a_helm' : def.branch === 'magic' ? 'a_circlet' : def.branch === 'bow' ? 'a_hood' : null;
  const g = (base: string, cloth = false): GearItem => makeGear(base, t, 1, cloth ? { colors: def.colors } : {});
  return {
    main: g(wBase[def.weapon]),
    off: def.off === 'shield' ? g('a_shield') : def.off === 'sword' ? g('w_twinblade') : null,
    head: head ? g(head, head === 'a_hood') : null,
    chest: g(chest, chest === 'a_coat' || chest === 'a_robe'),
    boots: g('a_boots'),
    cloak: g('a_cloak', true),
  };
}

export function recruit(id: string): string | null {
  const s = G.save;
  const block = recruitBlocker(id);
  if (block) return block;
  const def = COMPANION_BY_ID[id];
  if (!s.companions[id]?.recruited) {
    if (def.req.gold) s.gold -= def.req.gold;
    s.companions[id] = { recruited: true, equip: defaultCompanionGear(id) };
    G.ui.toast(`${def.name} joined your party!`, 'mastery');
    audio.play('levelup');
  }
  s.activeCompanion = id;
  G.world.setCompanion(id);
  G.world.npcs = G.world.npcs.filter((n) => n.spawn.companion !== id);
  return null;
}

export function dismissCompanion(): void {
  G.save.activeCompanion = null;
  G.world.setCompanion(null);
}
