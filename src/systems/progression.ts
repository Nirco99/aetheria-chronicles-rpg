// Character XP, branch mastery, Unique Skill Awakenings and the death penalty.
import type { Branch } from '../types/game';
import { G } from '../core/state';
import { ACTIVE_RANKS, BRANCH_INFO, DEATH_GOLD_FEE, DEATH_XP_LOSS, MAX_LEVEL, MAX_RANK, masteryToNext, xpToNext } from '../data/constants';
import { AWAKENINGS, skillsOfBranch } from '../data/skills';
import { audio } from '../engine/audio';
import { fx } from '../render/fx';

export function gainXp(n: number): void {
  const s = G.save;
  const p = G.player;
  if (s.level >= MAX_LEVEL || n <= 0) return;
  const amt = Math.max(1, Math.round(n * p.stats.xpMult));
  s.xp += amt;
  let leveled = false;
  while (s.level < MAX_LEVEL && s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
    s.sp++;
    leveled = true;
  }
  if (s.level >= MAX_LEVEL) s.xp = 0;
  if (leveled) {
    p.level = s.level;
    p.refresh();
    p.hp = p.stats.maxHp;
    p.mp = p.stats.maxMp;
    fx.banner('LEVEL UP!', '#ffd166', `Level ${s.level}  -  +1 Skill Point`, 60, 1.6);
    fx.burst(p.x, p.y, '#ffd166', 28, 170);
    fx.ring(p.x, p.y, '#ffd166', 10, 120, 0.6);
    audio.play('levelup');
    for (const c of G.world.party) c.syncLevel();
  }
}

export function gainMastery(b: Branch, n: number): void {
  const m = G.save.mastery[b];
  if (m.rank >= MAX_RANK || n <= 0) return;
  m.xp += n;
  while (m.rank < MAX_RANK && m.xp >= masteryToNext(m.rank)) {
    m.xp -= masteryToNext(m.rank);
    m.rank++;
    G.save.sp++;
    const unlocked = skillsOfBranch(b).filter((sk) => sk.rank === m.rank);
    G.ui.toast(`${BRANCH_INFO[b].name} Mastery Rank ${m.rank}!  +1 SP`, 'mastery');
    for (const sk of unlocked) G.ui.toast(`New Sword Skill available: ${sk.name} (press K)`, 'mastery');
    if (ACTIVE_RANKS.includes(m.rank)) audio.play('buff');
  }
  checkAwakenings();
}

export function checkAwakenings(): void {
  const s = G.save;
  if (!s || !G.player) return;
  const c = s.counters;
  const met: Record<string, boolean> = {
    aw_dual: s.mastery.sword.rank >= 10 || c.perfectParries >= 15,
    aw_smith: c.masterworks >= 5,
    aw_aegis: c.lowHpBossWins >= 1 || c.dmgBlocked >= 2000,
  };
  for (const aw of AWAKENINGS) {
    if (!s.awakenings.includes(aw.id) && met[aw.id]) {
      s.awakenings.push(aw.id);
      G.player.refresh();
      audio.play('awaken');
      G.ui.awakening(aw);
    }
  }
}

export function deathPenalty(): { xp: number; gold: number } {
  const s = G.save;
  const need = xpToNext(s.level);
  const loss = Math.min(s.xp, Math.round(need * DEATH_XP_LOSS));
  s.xp -= loss;
  const gold = Math.floor(s.gold * DEATH_GOLD_FEE);
  s.gold -= gold;
  s.counters.deaths++;
  return { xp: loss, gold };
}
