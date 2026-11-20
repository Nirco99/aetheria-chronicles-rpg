// The Infinite Abyss Labyrinth: procedural floors, Floor Wardens, Boss Rush every 5th floor,
// checkpoints every 10 floors and a local leaderboard.
import type { LeaderEntry } from '../types/game';
import { G } from '../core/state';
import { onAbyssBounty } from './guilds';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { store } from '../platform/desktop';

const LB_KEY = 'aetheria.leaderboard';

export function leaderboard(): LeaderEntry[] {
  try {
    const raw = store.get(LB_KEY);
    return raw ? (JSON.parse(raw) as LeaderEntry[]) : [];
  } catch {
    return [];
  }
}

function recordLeader(floor: number): void {
  const s = G.save;
  const list = leaderboard();
  const ex = list.find((e) => e.name === s.name);
  if (ex && ex.floor >= floor) return;
  const entry: LeaderEntry = { name: s.name, level: s.level, floor, date: new Date().toISOString().slice(0, 10) };
  const next = [...list.filter((e) => e.name !== s.name), entry].sort((a, b) => b.floor - a.floor).slice(0, 10);
  store.set(LB_KEY, JSON.stringify(next));
}

export function startAbyss(floor: number): void {
  G.world.travel(`abyss:${floor}`, 'entrance', () => {
    const m = G.world.map;
    G.ui.toast(floor % 5 === 0 ? `Floor ${floor}: BOSS RUSH! Defeat every guardian in the arena chamber.` : `Floor ${floor}: find and defeat the Floor Warden to open the stairs.`, 'boss');
    if (m.modifiers.length) G.ui.toast(`Floor modifiers: ${m.modifiers.join(', ')}`, 'warn');
  });
}

export function floorCleared(): void {
  const m = G.world.map;
  const s = G.save;
  const f = m.floor;
  s.abyss.best = Math.max(s.abyss.best, f);
  if (f % 10 === 0) s.abyss.checkpoint = Math.max(s.abyss.checkpoint, f);
  recordLeader(f);
  onAbyssBounty(f);
  const c = m.entries.boss;
  m.addProp({ kind: 'stairs', x: c.x, y: c.y + 40, sprite: `stairs:${m.realm}:down`, ax: 34, ay: 50, sw: 68, sh: 56, sortOff: -40, data: { up: false }, light: { r: 120, color: '#a970ff', oy: -10 } });
  m.addInteract(c.x, c.y + 40, `Descend to Floor ${f + 1}`, { t: 'stairs' }, 44);
  fx.banner('FLOOR CLEARED', '#a970ff', f % 10 === 0 ? `Checkpoint unlocked: Floor ${f}` : `Deepest floor: ${s.abyss.best}`, 56, 2.2);
  audio.play('levelup');
}

export function descend(): void {
  startAbyss(G.world.map.floor + 1);
}

export function leaveAbyss(): void {
  G.world.travel(`city:${G.save.lastCity}`, G.save.lastCity === 4 || G.save.lastCity === 0 ? 'abyss' : 'gate');
}
