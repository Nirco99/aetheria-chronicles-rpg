// Game orchestrator: state machine (title / boot / play), fixed-timestep simulation at 60 Hz,
// time dilation, camera, interaction dispatch, hotkeys, decorator input and autosave.
import type { Appearance, Interactable, WorldMode } from './types/game';
import type { Actor } from './entities/actor';
import { G } from './core/state';
import { Input } from './engine/input';
import { audio } from './engine/audio';
import { Renderer } from './render/renderer';
import { drawHud } from './render/hud';
import { fx } from './render/fx';
import { BootSequence } from './render/boot';
import { World } from './world/world';
import { Player } from './entities/player';
import { UI } from './ui/ui';
import { refreshDecorPalette } from './ui/town';
import { UI_H, TILE } from './data/constants';
import { REALMS } from './data/realms';
import { newSave, loadGame, saveGame, loadSettings, type StarterKit } from './systems/save';
import { refreshBoard } from './systems/guilds';
import { ownsHouse, placeFurniture, furnitureAt, removeFurniture, useFurniture } from './systems/housing';
import { descend, leaveAbyss } from './systems/abyss';
import { arena } from './systems/arena';
import { addItem, addGear } from './systems/inventory';
import { gainXp } from './systems/progression';
import { makeGear } from './data/items';
import { angTo, lerp } from './engine/util';
import { desktop, installTitlebar, migrateBrowserSaves } from './platform/desktop';
import { runSelftest } from './platform/selftest';
import { GAMBITS, GAMBIT_ORDER } from './data/v3';
import { checkAchievements } from './systems/achievements';
import { style } from './systems/feel';

type GState = 'title' | 'boot' | 'play';

const STEP = 1 / 60;

export class Game {
  readonly renderer: Renderer;
  state: GState = 'title';
  private boot: BootSequence | null = null;
  private last = 0;
  private acc = 0;
  fps = 60;
  frameDt = 0.016;
  camDelta = { x: 0, y: 0 };
  private slowT = 0;
  private slowScale = 1;
  decorating = false;
  decorItem: string | null = null;
  private autosaveT = 0;
  private lastMapId = '';
  private titleT = 0;
  /** hard time-freeze (Perfect Parry, Finishing Nova): the world stops, rendering continues */
  private freezeT = 0;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    G.game = this;
    G.input = new Input(canvas);
    this.renderer = new Renderer(canvas);
    G.ui = new UI(uiRoot);
    G.world = new World();
    migrateBrowserSaves();
    G.settings = loadSettings();
    installTitlebar(() => this.renderer.resize());
    const unlock = () => audio.init();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('beforeunload', () => {
      if (this.state === 'play') saveGame();
    });
  }

  start(): void {
    this.applySettings();
    this.titleScene();
    if (desktop?.selftest) runSelftest(() => this.startSelftest());
    else G.ui.showTitle();
    if (desktop && G.settings.fullscreen && !desktop.isFullscreen()) desktop.setFullscreen(true);
    requestAnimationFrame((t) => {
      this.last = t;
      requestAnimationFrame(this.frame);
    });
    const dev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
    if (dev) {
      (window as unknown as Record<string, unknown>).__aetheria = {
        G,
        give: (id: string, n = 1) => addItem(id, n),
        gear: (base: string, tier = 0, rarity = 2) => addGear(makeGear(base, tier, rarity as 0)),
        gold: (n: number) => (G.save.gold += n),
        xp: (n: number) => gainXp(n),
        tp: (map: string, entry = 'gate') => G.world.travel(map, entry),
        spawn: (id: string, lvl = 5) => G.world.spawnMonster(id, lvl, G.player.x + 120, G.player.y, []),
        time: (h: number) => (G.save.time = h),
      };
    }
  }

  get paused(): boolean {
    return this.state !== 'play' || this.uiBlocking();
  }

  uiBlocking(): boolean {
    return G.ui.blocking;
  }

  applySettings(): void {
    const s = G.settings;
    audio.setVolumes(s.master, s.music, s.sfx);
    this.renderer.quality = s.quality;
    this.renderer.resize();
  }

  freeze(dur: number): void {
    this.freezeT = Math.max(this.freezeT, dur);
  }

  /** throwaway character for the desktop self-test: never written to a save slot */
  startSelftest(): void {
    G.save = newSave(-1, 'Selftest', { skin: 2, hairStyle: 1, hairColor: 2, eyeColor: 1 }, 'open', 'sword_shield');
    G.save.learned.push('sw_quadrant', 'sh_bash');
    G.save.hotbar = ['sw_gale_lunge', 'sw_quadrant', 'sh_bash', null, null, null];
    G.save.skillRanks = { sw_gale_lunge: 1, sw_quadrant: 1, sh_bash: 1 };
    this.enterWorld('wild:0', 'north');
    this.boot = null;
    this.state = 'play';
    G.ui.setScreen(null);
  }

  // ---------------------------------------------------------------- flows

  private titleScene(): void {
    G.save = newSave(-1, 'Aster', { skin: 1, hairStyle: 0, hairColor: 0, eyeColor: 1 }, 'open', 'sword_shield');
    G.save.time = 18.6;
    G.player = new Player();
    G.player.refresh();
    G.world.party = [];
    G.world.pet = null;
    G.world.load('city:0', 'gate');
    G.world.transition = null;
    fx.banners.length = 0;
    this.state = 'title';
    audio.setMusic('title');
  }

  private enterWorld(mapId: string, entry: string, px?: number, py?: number): void {
    G.player = new Player();
    G.player.refresh();
    G.player.hp = Math.min(G.save.hp, G.player.stats.maxHp);
    G.player.mp = Math.min(G.save.mp, G.player.stats.maxMp);
    G.world.party = [];
    G.world.pet = null;
    style.reset();
    G.world.load(mapId, entry);
    G.world.transition = null;
    if (px && py && G.world.map.boxFree(px, py, G.player.hw, G.player.hh)) {
      G.player.x = px;
      G.player.y = py;
    }
    G.world.setParty();
    refreshBoard();
    checkAchievements(true);
    this.snapCamera();
    this.lastMapId = G.world.map.id;
    this.decorating = false;
    G.ui.closeDecor();
    fx.clear();
    fx.banners.length = 0;
    this.boot = new BootSequence(G.save.name);
    this.state = 'boot';
    G.ui.setScreen(null);
    G.ui.closePanel(true);
  }

  newGame(slot: number, name: string, appearance: Appearance, mode: WorldMode, kit: StarterKit): void {
    G.save = newSave(slot, name, appearance, mode, kit);
    refreshBoard(true);
    this.enterWorld('city:0', 'gate');
    saveGame();
    const tips = [
      `Welcome to Arcadia, ${G.save.name}! WASD to move, Left Click to attack, Right Click / Shift to block, Space to dodge.`,
      'Press 1 to use your first Sword Skill. Learn more skills with Skill Points in the Mastery window (K).',
      'Visit the Guild Headquarters to join guilds, take bounties and recruit companions. Press H for the Handbook.',
      'Leave through the south gate to explore the Emerald Plains. Gather ore and herbs with E.',
    ];
    tips.forEach((t, i) => setTimeout(() => G.ui.toast(t, 'info'), 2200 + i * 2600));
  }

  loadSlot(slot: number): void {
    const d = loadGame(slot);
    if (!d) {
      G.ui.toast('That save could not be loaded.', 'warn');
      return;
    }
    G.save = d;
    const [kind] = d.map.split(':');
    const ok = kind === 'city' || kind === 'wild' || (kind === 'house' && ownsHouse(Number(d.map.split(':')[1])));
    this.enterWorld(ok ? d.map : `city:${d.lastCity}`, ok && kind === 'house' ? 'door' : 'gate', ok ? d.px : undefined, ok ? d.py : undefined);
  }

  quitToTitle(): void {
    saveGame();
    G.ui.closePanel(true);
    this.decorating = false;
    G.ui.closeDecor();
    arena.state = null;
    this.titleScene();
    G.ui.showTitle();
  }

  // ---------------------------------------------------------------- helpers

  mouseWorld(): { x: number; y: number } {
    return this.renderer.screenToWorld(G.input.mx, G.input.my);
  }

  mouseAimFor(a: Actor): number {
    const m = this.mouseWorld();
    return angTo(a.x, a.y - 14, m.x, m.y);
  }

  slowmo(dur: number, scale: number): void {
    this.slowT = Math.max(this.slowT, dur);
    this.slowScale = Math.min(this.slowT > dur ? this.slowScale : 1, scale);
  }

  zoomPulse(_z: number, dur: number): void {
    this.renderer.cam.pulse = dur;
  }

  snapCamera(): void {
    this.renderer.snap(G.player.x, G.player.y - 18);
  }

  fadeFlash(): void {
    fx.flash('#05070d', 1);
  }

  toggleDecor(): void {
    const m = G.world.map;
    if (!this.decorating && (m.kind !== 'house' || !ownsHouse(m.realm))) {
      G.ui.toast('The decorator works inside a house you own.', 'info');
      return;
    }
    this.decorating = !this.decorating;
    this.decorItem = null;
    if (this.decorating) G.ui.openDecor();
    else G.ui.closeDecor();
  }

  interact(it: Interactable): void {
    const a = it.action;
    const w = G.world;
    const r = w.map.realm;
    switch (a.t) {
      case 'gate': G.ui.openGate(); break;
      case 'abyss': G.ui.openAbyss(); break;
      case 'coliseum': G.ui.openColiseum(); break;
      case 'shop': G.ui.openShop(a.shop); break;
      case 'forge': G.ui.openForge(!!a.home); break;
      case 'alchemy': G.ui.openShop('alchemist'); break;
      case 'cooking': G.ui.openCraft('cooking'); break;
      case 'guild': G.ui.openGuild(); break;
      case 'estate': G.ui.openEstate(); break;
      case 'house':
        if (ownsHouse(r)) w.travel(`house:${r}`, 'door');
        else G.ui.toast(`${REALMS[r].house.name} is for sale at the ${REALMS[r].buildings.estate} for ${REALMS[r].house.price.toLocaleString()} G.`, 'info');
        break;
      case 'exitHouse':
        if (this.decorating) this.toggleDecor();
        w.travel(`city:${r}`, 'house');
        break;
      case 'dungeon': w.travel(`dun:${r}`, 'entrance'); break;
      case 'leaveDungeon': w.travel(`wild:${r}`, 'dungeon'); break;
      case 'crystal':
        audio.play('teleport');
        w.travel(`city:${r}`, 'gate');
        break;
      case 'stairs': descend(); break;
      case 'leaveAbyss': leaveAbyss(); break;
      case 'leaveArena': arena.leave(); break;
      case 'npc': {
        const n = w.npcById(a.npc);
        if (n) G.ui.openNpc(n);
        break;
      }
      case 'sign': G.ui.toast(a.text, 'info'); break;
      case 'furniture': useFurniture(a.index); break;
      case 'node': {
        const n = w.nodeById(a.node);
        if (n) G.player.beginGather(n);
        break;
      }
      case 'companion': G.ui.openGuild(); break;
      case 'adventurer': {
        const adv = w.adventurerById(a.id);
        if (adv) G.ui.openAdventurer(adv);
        break;
      }
      case 'fish': G.ui.openFishing(a.spot); break;
      case 'dig': w.dig(a.id); break;
      case 'stable': G.ui.openStable(); break;
      case 'blackmarket': G.ui.openBlackMarket(); break;
    }
  }

  // ---------------------------------------------------------------- loop

  /** milliseconds of main-thread work in the last frame (simulation + draw recording) */
  workMs = 0;

  private frame = (now: number): void => {
    const workStart = performance.now();
    const realDt = Math.min(0.1, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.frameDt = realDt;
    this.fps = lerp(this.fps, 1 / realDt, 0.05);
    G.realTime += realDt;
    const camBefore = { x: this.renderer.cam.x, y: this.renderer.cam.y };
    this.handleKeys();
    if (this.state === 'boot' && this.boot) {
      this.boot.update(realDt);
      if (G.input.pressed('Space', 'Enter', 'Escape') || G.input.mousePressed(0)) this.boot.skip();
      G.input.endFrame();
      if (this.boot.done) {
        this.boot = null;
        this.state = 'play';
        const m = G.world.map;
        fx.banner(m.name, '#bfe6ff', REALMS[m.realm].cityTitle, 36, 2.2);
      }
    } else if (this.state === 'play') {
      if (this.slowT > 0) this.slowT -= realDt;
      G.timeScale = this.slowT > 0 ? this.slowScale : 1;
      if (this.freezeT > 0 && !this.uiBlocking()) {
        this.freezeT -= realDt;
        this.acc = 0;
        this.renderer.update(realDt * 0.2);
      } else if (this.uiBlocking()) {
        G.input.endFrame();
        this.acc = 0;
      } else {
        this.acc += realDt;
        let steps = 0;
        while (this.acc >= STEP && steps < 5) {
          const dt = STEP * G.timeScale;
          G.time += dt;
          if (this.decorating) this.decorInput();
          G.world.update(dt, STEP);
          fx.update(dt, STEP);
          this.acc -= STEP;
          steps++;
          G.input.endFrame();
        }
        if (steps === 5) this.acc = 0;
        this.renderer.update(realDt);
        this.autosaveT += realDt;
        if (this.autosaveT > 180) {
          this.autosaveT = 0;
          saveGame();
        }
        if (G.world.map.id !== this.lastMapId && !G.world.transition) {
          this.lastMapId = G.world.map.id;
          if (G.world.map.kind === 'city' || G.world.map.kind === 'house') saveGame();
          if (this.decorating && G.world.map.kind !== 'house') this.toggleDecor();
        }
      }
    } else {
      this.titleT += realDt;
      const m = G.world.map;
      this.renderer.cam.x = m.pw / 2 + Math.sin(this.titleT * 0.08) * 360;
      this.renderer.cam.y = m.ph / 2 + Math.cos(this.titleT * 0.06) * 200;
      for (const n of G.world.npcs) n.update(realDt);
      fx.update(realDt, realDt);
      G.input.endFrame();
    }
    this.camDelta.x = this.renderer.cam.x - camBefore.x;
    this.camDelta.y = this.renderer.cam.y - camBefore.y;
    this.render(now / 1000);
    this.workMs = performance.now() - workStart;
    requestAnimationFrame(this.frame);
  };

  private render(t: number): void {
    const ctx = this.renderer.ctx;
    if (this.state === 'boot' && this.boot) {
      this.boot.draw(ctx, this.renderer.w, this.renderer.h);
      return;
    }
    this.renderer.render(t);
    const k = this.renderer.h / UI_H;
    if (this.state === 'play') {
      drawHud(ctx, this.renderer, t);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      fx.drawScreen(ctx, this.renderer.w / k, UI_H);
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const g = ctx.createRadialGradient(this.renderer.w / 2, this.renderer.h / 2, this.renderer.h * 0.2, this.renderer.w / 2, this.renderer.h / 2, this.renderer.h);
      g.addColorStop(0, 'rgba(4,6,14,0.15)');
      g.addColorStop(1, 'rgba(4,6,14,0.85)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.renderer.w, this.renderer.h);
    }
  }

  private decorInput(): void {
    const inp = G.input;
    const mw = this.mouseWorld();
    const tx = Math.floor(mw.x / TILE);
    const ty = Math.floor(mw.y / TILE);
    if (inp.mousePressed(0)) {
      inp.consumeMouse(0);
      if (this.decorItem) {
        if (placeFurniture(this.decorItem, tx, ty)) {
          if (!G.save.items[this.decorItem]) this.decorItem = null;
          refreshDecorPalette();
        } else audio.play('error');
      }
    }
    if (inp.mousePressed(2)) {
      inp.consumeMouse(2);
      const i = furnitureAt(tx, ty);
      if (i >= 0) {
        const e = removeFurniture(i);
        if (e) G.ui.toast(e, 'warn');
        refreshDecorPalette();
      }
    }
  }

  private handleKeys(): void {
    const inp = G.input;
    if (this.state !== 'play') return;
    const ui = G.ui;
    const toggle = (id: string, open: () => void) => {
      if (ui.panelId === id) ui.closePanel();
      else if (!ui.hasModal) open();
    };
    if (inp.pressed('Escape')) {
      inp.consume('Escape');
      if (ui.back()) return;
      if (this.decorating) this.toggleDecor();
      else ui.openPause();
      return;
    }
    if (inp.typing) return;
    if (inp.pressed('KeyI')) {
      inp.consume('KeyI');
      toggle('character', () => ui.openCharacter('equipment'));
    }
    if (inp.pressed('KeyK')) {
      inp.consume('KeyK');
      toggle('constellation', () => ui.openConstellation());
    }
    if (inp.pressed('KeyO')) {
      inp.consume('KeyO');
      toggle('bestiary', () => ui.openBestiary());
    }
    if (inp.pressed('KeyN')) {
      inp.consume('KeyN');
      toggle('journal', () => ui.openJournal());
    }
    if (inp.pressed('KeyP')) {
      inp.consume('KeyP');
      toggle('stable', () => ui.openStable());
    }
    if (inp.pressed('KeyT')) {
      inp.consume('KeyT');
      toggle('wardrobe', () => ui.openWardrobe());
    }
    if (inp.pressed('KeyU')) {
      inp.consume('KeyU');
      toggle('codex', () => ui.openCodex(false));
    }
    GAMBIT_ORDER.forEach((g, i) => {
      const code = `F${i + 1}`;
      if (!inp.pressed(code)) return;
      inp.consume(code);
      G.save.gambit = g;
      G.ui.toast(`Gambit: ${GAMBITS[g].name} - ${GAMBITS[g].desc}`, 'info');
      audio.play('ui');
    });
    if (inp.pressed('KeyM')) {
      inp.consume('KeyM');
      toggle('character', () => ui.openCharacter('atlas'));
    }
    if (inp.pressed('KeyH')) {
      inp.consume('KeyH');
      toggle('handbook', () => ui.openHandbook());
    }
    if (inp.pressed('KeyB') && !ui.blocking) {
      inp.consume('KeyB');
      this.toggleDecor();
    }
    if (inp.pressed('F5')) {
      inp.consume('F5');
      G.ui.toast(saveGame() ? 'Quick saved.' : 'Saving failed.', 'info');
    }
  }
}
