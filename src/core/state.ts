// Global runtime registry. Modules reach shared singletons through G at call time
// (never at module-evaluation time), which keeps import graphs free of init cycles.
import type { SaveData, Settings } from '../types/game';
import type { Game } from '../game';
import type { World } from '../world/world';
import type { Player } from '../entities/player';
import type { Input } from '../engine/input';
import type { UI } from '../ui/ui';

export const DEFAULT_SETTINGS: Settings = { master: 0.8, music: 0.5, sfx: 0.8, shake: true, numbers: true, fps: false, fullscreen: false, resolution: '1440x860', quality: 1, styleMeter: true, gfx: 'auto' };

export const G = {
  game: null as unknown as Game,
  world: null as unknown as World,
  player: null as unknown as Player,
  input: null as unknown as Input,
  ui: null as unknown as UI,
  save: null as unknown as SaveData,
  settings: { ...DEFAULT_SETTINGS } as Settings,
  /** seconds of simulated (scaled) game time */
  time: 0,
  /** wall-clock seconds since start */
  realTime: 0,
  /** world time scale (SWITCH! time dilation) */
  timeScale: 1,
  debug: false,
};
