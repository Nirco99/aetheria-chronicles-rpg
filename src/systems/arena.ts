// The Grand Coliseum: five Tournament Cups and Endless Wave Survival (no death penalty).
import { G } from '../core/state';
import { REALMS } from '../data/realms';
import { CUPS } from '../data/constants';
import { addItem } from './inventory';
import { gainXp } from './progression';
import { onArenaBounty } from './guilds';
import { fx } from '../render/fx';
import { audio } from '../engine/audio';
import { pick } from '../engine/util';

export { CUPS };

interface ArenaState {
  mode: 'cup' | 'endless';
  cup: number;
  round: number;
  wave: number;
  phase: 'countdown' | 'fight' | 'between' | 'done';
  t: number;
}

const GATES: [number, number][] = [[17, 3.5], [3.5, 13], [30.5, 13], [8, 20], [26, 20]];

class Arena {
  state: ArenaState | null = null;

  start(mode: 'cup' | 'endless', cup = 0): void {
    this.state = { mode, cup, round: 1, wave: 1, phase: 'countdown', t: 3.2 };
    G.world.travel('arena', 'center', () => {
      fx.banner(mode === 'cup' ? CUPS[cup].name : 'ENDLESS WAVES', '#ffd166', 'Fight!', 56, 2.2);
    });
  }

  private pool(level: number): string[] {
    const realm = Math.min(4, Math.max(0, Math.floor((level - 1) / 10)));
    return [...REALMS[realm].monsters, ...REALMS[Math.max(0, realm - 1)].monsters];
  }

  private spawn(id: string, level: number, i: number): void {
    const [gx, gy] = GATES[i % GATES.length];
    const p = G.world.map.nearestFree(gx * 32, gy * 32, 3);
    const m = G.world.spawnMonster(id, level, p.x, p.y, []);
    m.alwaysAggro = true;
    m.target = G.player;
    m.st = 'chase';
  }

  private spawnRound(): void {
    const s = this.state;
    if (!s) return;
    if (s.mode === 'cup') {
      const c = CUPS[s.cup];
      const lvl = c.level + s.round - 1;
      if (s.round < 5) {
        const n = 2 + s.round;
        const pool = this.pool(c.level);
        for (let i = 0; i < n; i++) this.spawn(pick(pool), lvl, i);
        fx.banner(`ROUND ${s.round}`, '#ffd166', `${n} challengers enter the sand!`, 52, 1.6);
      } else {
        const realm = Math.min(4, Math.floor((c.level - 1) / 10));
        this.spawn(REALMS[realm].elite, c.level + 2, 0);
        this.spawn(pick(this.pool(c.level)), lvl, 1);
        this.spawn(pick(this.pool(c.level)), lvl, 2);
        fx.banner('FINAL ROUND', '#ff5d6c', 'The Arena Champion enters!', 56, 1.8);
        audio.play('roar');
      }
    } else {
      const w = s.wave;
      const lvl = Math.max(1, G.save.level - 3 + Math.floor(w / 3));
      const n = 3 + Math.floor(w / 2);
      const pool = this.pool(lvl);
      for (let i = 0; i < n; i++) this.spawn(pick(pool), lvl, i);
      if (w % 5 === 0) {
        const realm = Math.min(4, Math.floor((lvl - 1) / 10));
        this.spawn(REALMS[realm].elite, lvl + 1, 3);
      }
      fx.banner(`WAVE ${w}`, '#ffd166', w % 5 === 0 ? 'A Named Elite joins the fray!' : '', 52, 1.4);
    }
    s.phase = 'fight';
    audio.play('engage', 0.6);
  }

  update(dt: number): void {
    const s = this.state;
    if (!s) return;
    if (s.phase === 'countdown' || s.phase === 'between') {
      s.t -= dt;
      if (s.t <= 0) this.spawnRound();
      return;
    }
    if (s.phase !== 'fight') return;
    if (G.world.monsters.some((m) => !m.dead)) return;
    if (s.mode === 'cup') {
      if (s.round >= 5) this.win();
      else {
        s.round++;
        s.phase = 'between';
        s.t = 3;
        fx.banner('ROUND CLEAR', '#7fe9ff', 'Catch your breath...', 44, 1.4);
        G.player.hp = Math.min(G.player.stats.maxHp, G.player.hp + G.player.stats.maxHp * 0.25);
      }
    } else {
      const sv = G.save;
      sv.arena.bestWave = Math.max(sv.arena.bestWave, s.wave);
      gainXp(Math.round(30 + s.wave * G.save.level * 2));
      sv.gold += 40 + s.wave * 25;
      s.wave++;
      s.phase = 'between';
      s.t = 2.5;
      G.player.hp = Math.min(G.player.stats.maxHp, G.player.hp + G.player.stats.maxHp * 0.2);
    }
  }

  private win(): void {
    const s = this.state;
    if (!s) return;
    const c = CUPS[s.cup];
    const sv = G.save;
    s.phase = 'done';
    sv.gold += c.gold;
    gainXp(Math.round(c.level * c.level * 12));
    const first = !sv.arena.cups[s.cup];
    sv.arena.cups[s.cup] = true;
    if (first) addItem(c.trophy, 1);
    onArenaBounty(s.cup);
    fx.banner('CHAMPION!', '#ffd166', `${c.name} won! +${c.gold.toLocaleString()} G${first ? ' and a trophy' : ''}`, 66, 3);
    audio.play('levelup');
    G.ui.toast(`Victory in the ${c.name}! Leave through the arena gate when ready.`, 'loot');
  }

  onDeath(): void {
    const s = this.state;
    if (s && s.mode === 'endless') G.ui.toast(`Endless run over at wave ${s.wave}. Best: ${G.save.arena.bestWave}.`, 'info');
    this.state = null;
  }

  leave(): void {
    const s = this.state;
    if (s && s.mode === 'endless') G.save.arena.bestWave = Math.max(G.save.arena.bestWave, s.wave - 1);
    this.state = null;
    G.world.travel('city:0', 'coliseum');
  }
}

export const arena = new Arena();
