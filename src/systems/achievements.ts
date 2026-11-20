// Achievements & titles: evaluated after notable events and every few seconds of play.
import { G } from '../core/state';
import { ACHIEVEMENTS } from '../data/v3';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';

let lastCheck = -1;

export function checkAchievements(force = false): void {
  const s = G.save;
  if (!s || s.slot < 0) return;
  if (!force && G.realTime - lastCheck < 0.4) return;
  lastCheck = G.realTime;
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.includes(a.id)) continue;
    let ok = false;
    try {
      ok = a.check(s);
    } catch {
      ok = false;
    }
    if (!ok) continue;
    s.achievements.push(a.id);
    fx.banner('ACHIEVEMENT UNLOCKED', '#ffd166', a.name + (a.title ? `  -  Title earned: "${a.title}"` : ''), 40, 1.8);
    audio.play('levelup', 0.6);
    G.ui.toast(`Achievement: ${a.name} - ${a.desc}${a.title ? ` Title unlocked: ${a.title} (equip it in the Journal, N).` : ''}`, 'loot');
  }
}

export function unlockedTitles(): string[] {
  const s = G.save;
  return ACHIEVEMENTS.filter((a) => a.title && s.achievements.includes(a.id)).map((a) => a.title as string);
}
