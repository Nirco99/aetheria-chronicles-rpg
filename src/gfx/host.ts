// Render host: owns the classic 2D world canvas, the 3D world canvas and the HUD overlay canvas,
// and presents one camera / picking interface to the rest of the game whichever renderer is active.
import { G } from '../core/state';
import { Renderer } from '../render/renderer';
import { titlebarOffset } from '../platform/desktop';
import type { Engine3D } from './engine';
import { QUALITY, hasWebGL2, recommendPreset, type GfxPreset } from './quality';

export type GfxSetting = GfxPreset | 'auto';

export class RenderHost {
  readonly classic: Renderer;
  engine: Engine3D | null = null;
  preset: GfxPreset = 'classic';
  readonly hud: HTMLCanvasElement;
  readonly hctx: CanvasRenderingContext2D;
  /** HUD canvas size in device pixels */
  w = 1;
  h = 1;
  dpr = 1;
  cssW = 1;
  cssH = 1;
  /** message shown when the 3D renderer could not start */
  failure = '';
  private Engine: typeof Engine3D | null = null;

  constructor(readonly canvas2d: HTMLCanvasElement, readonly canvas3d: HTMLCanvasElement, hud: HTMLCanvasElement) {
    this.classic = new Renderer(canvas2d);
    this.hud = hud;
    this.hctx = hud.getContext('2d') as CanvasRenderingContext2D;
    this.canvas3d.style.display = 'none';
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get is3d(): boolean {
    return this.preset !== 'classic' && !!this.engine;
  }

  get ctx(): CanvasRenderingContext2D {
    return this.hctx;
  }

  get cam(): { x: number; y: number; zoom: number; pulse: number; pulseZ: number; sx: number; sy: number } {
    return this.is3d ? (this.engine as Engine3D).cam : this.classic.cam;
  }

  get quality(): number {
    return this.classic.quality;
  }
  set quality(v: number) {
    this.classic.quality = v;
  }

  get dynScale(): number {
    return this.is3d ? (this.engine as Engine3D).dynScale : this.classic.dynScale;
  }

  /** HUD pixels per world unit at the focus point */
  get zoomScale(): number {
    if (this.is3d) return ((this.engine as Engine3D).zoomScale / (this.engine as Engine3D).dpr) * this.dpr;
    return (this.classic.zoomScale / this.classic.dpr) * this.dpr;
  }

  /** resolves "auto" and loads the 3D engine on demand; falls back to classic when WebGL2 is missing */
  async setPreset(setting: GfxSetting): Promise<void> {
    let want: GfxPreset = setting === 'auto' ? recommendPreset() : setting;
    if (want !== 'classic' && !hasWebGL2()) {
      this.failure = 'WebGL 2 is not available: using the Classic 2D renderer.';
      want = 'classic';
    }
    if (want === this.preset && (want === 'classic' || this.engine)) return;
    if (this.engine) {
      this.engine.dispose();
      this.engine = null;
      // a WebGL context cannot change its attributes: swap in a fresh canvas for the next engine
      const fresh = this.canvas3d.cloneNode(false) as HTMLCanvasElement;
      this.canvas3d.replaceWith(fresh);
      (this as { canvas3d: HTMLCanvasElement }).canvas3d = fresh;
    }
    if (want !== 'classic') {
      try {
        if (!this.Engine) this.Engine = (await import('./engine')).Engine3D;
        this.engine = new this.Engine(this.canvas3d, want as Exclude<GfxPreset, 'classic'>);
        this.failure = '';
      } catch (err) {
        console.error('[gfx] 3D renderer failed to start', err);
        this.failure = '3D renderer failed to start: using the Classic 2D renderer.';
        this.engine = null;
        want = 'classic';
      }
    }
    this.preset = want;
    this.canvas3d.style.display = this.is3d ? 'block' : 'none';
    this.canvas2d.style.display = this.is3d ? 'none' : 'block';
    document.body.classList.toggle('gfx3d', this.is3d);
    this.resize();
    if (G.player && G.world?.map) this.snap(G.player.x, G.player.y - 18);
  }

  presetLabel(): string {
    return this.preset === 'classic' ? 'Classic 2D' : QUALITY[this.preset].label;
  }

  resize(): void {
    const top = titlebarOffset();
    const cw = window.innerWidth;
    const ch = Math.max(200, window.innerHeight - top);
    this.cssW = cw;
    this.cssH = ch;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cw * ch * dpr * dpr > 3.7e6) dpr = Math.sqrt(3.7e6 / (cw * ch));
    this.dpr = dpr;
    this.hud.style.width = cw + 'px';
    this.hud.style.height = ch + 'px';
    this.w = this.hud.width = Math.round(cw * dpr);
    this.h = this.hud.height = Math.round(ch * dpr);
    this.canvas3d.style.width = cw + 'px';
    this.canvas3d.style.height = ch + 'px';
    this.classic.resize();
    this.engine?.resize(cw, ch);
  }

  snap(x: number, y: number): void {
    this.classic.snap(x, y);
    this.engine?.snap(x, y);
  }

  update(dt: number): void {
    if (this.is3d) (this.engine as Engine3D).update(dt);
    else this.classic.update(dt);
  }

  /** draws the world; the HUD canvas is cleared and left for the caller to paint */
  render(t: number): void {
    this.hctx.setTransform(1, 0, 0, 1, 0, 0);
    this.hctx.clearRect(0, 0, this.w, this.h);
    if (this.is3d) (this.engine as Engine3D).render(t);
    else this.classic.render(t);
  }

  screenToWorld(cssX: number, cssY: number): { x: number; y: number } {
    return this.is3d ? (this.engine as Engine3D).screenToWorld(cssX, cssY) : this.classic.screenToWorld(cssX, cssY);
  }

  /** world point -> HUD canvas pixels */
  worldToScreen(x: number, y: number, z = 0): { x: number; y: number } {
    if (this.is3d) {
      const p = (this.engine as Engine3D).worldToScreen(x, y, z);
      return { x: p.x * this.dpr, y: p.y * this.dpr };
    }
    const p = this.classic.worldToScreen(x, y - z);
    return { x: (p.x / this.classic.dpr) * this.dpr, y: (p.y / this.classic.dpr) * this.dpr };
  }

  minimap(): HTMLCanvasElement {
    return this.classic.minimap();
  }
}
