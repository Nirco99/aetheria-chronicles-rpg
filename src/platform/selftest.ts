// Automated desktop smoke test (`Aetheria Chronicles.exe --selftest`): starts a throwaway character
// (never written to a save slot), plays ~9 seconds of real input - moving, combos, dodges, Sword
// Skills, a Skill Connect attempt, panels - measures the frame rate and collects console errors,
// then hands a JSON report to the main process, which writes saves/selftest-report.json and exits.
//
// Two numbers describe the frame rate. `fps` is the plain average, which a single slow frame drags
// down: the first time a window opens, Chromium rasterises its DOM in the GPU process and the game
// canvas waits behind it for a few hundred milliseconds (the same happens with the Classic 2D
// renderer). `fpsSteady` comes from the median frame and is what play feels like between those
// one-off stalls. The run passes when play is steady at the display rate and the average holds up.
import { G } from '../core/state';
import { audio } from '../engine/audio';
import { desktop } from './desktop';

const errors: string[] = [];

export function captureErrors(): void {
  window.addEventListener('error', (e) => errors.push(`error: ${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => errors.push(`unhandledrejection: ${String((e as PromiseRejectionEvent).reason)}`));
  const orig = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    errors.push(args.map((a) => (a instanceof Error ? a.stack ?? a.message : String(a))).join(' '));
    orig(...args);
  };
}

function key(code: string, type: 'keydown' | 'keyup'): void {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
}

function tap(code: string, hold = 60): void {
  key(code, 'keydown');
  window.setTimeout(() => key(code, 'keyup'), hold);
}

/** the canvas that receives pointer input (the HUD overlay sits above both world canvases) */
function surface(): HTMLCanvasElement {
  return (document.getElementById('hud') ?? document.getElementById('game')) as HTMLCanvasElement;
}

function click(button: number, x: number, y: number): void {
  const c = surface();
  const r = c.getBoundingClientRect();
  const opts = { clientX: r.left + x, clientY: r.top + y, button, bubbles: true };
  c.dispatchEvent(new MouseEvent('mousemove', opts));
  c.dispatchEvent(new MouseEvent('mousedown', opts));
  window.setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', opts)), 70);
}

export function runSelftest(start: () => void, ready: Promise<unknown> = Promise.resolve()): void {
  // the 3D engine loads on demand: the scripted run starts once the chosen renderer is up
  const began = performance.now();
  void ready.then(() => run(start, performance.now() - began));
}

function run(start: () => void, loadMs: number): void {
  // a player reaches the world through the title menu, so the audio device is already open by then
  audio.init();
  const t0 = performance.now();
  start();
  const frames: number[] = [];
  const work: number[] = [];
  const lite: number[] = [];
  const hitches: { at: number; ms: number; work: number }[] = [];
  // long animation frames say where a hitch was spent: script, style + layout, or waiting on the GPU
  interface Loaf { startTime: number; duration: number; renderStart: number; styleAndLayoutStart: number; scripts?: { invoker?: string; name?: string; sourceFunctionName?: string; duration: number }[] }
  const loaf: { at: number; ms: number; render: number; layout: number; scripts: string[] }[] = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as Loaf[]) {
        const end = e.startTime + e.duration;
        loaf.push({
          at: Math.round(e.startTime - t0),
          ms: Math.round(e.duration),
          render: e.renderStart ? Math.round(end - e.renderStart) : 0,
          layout: e.styleAndLayoutStart ? Math.round(end - e.styleAndLayoutStart) : 0,
          scripts: (e.scripts ?? []).map((s) => `${s.sourceFunctionName || s.invoker || s.name}:${Math.round(s.duration)}`).slice(0, 5),
        });
      }
    }).observe({ type: 'long-animation-frame', buffered: false });
  } catch {
    /* long-animation-frame entries are not available in this runtime */
  }
  let last = performance.now();
  let measuring = false;
  let liteMode = false;
  const tick = (now: number) => {
    if (measuring) {
      (liteMode ? lite : frames).push(now - last);
      if (!liteMode) {
        work.push(G.game.workMs);
        if (now - last > 34) hitches.push({ at: Math.round(now - t0), ms: +(now - last).toFixed(1), work: +G.game.workMs.toFixed(1) });
      }
    }
    last = now;
    if (performance.now() - t0 < 16000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const cx = () => surface().getBoundingClientRect().width / 2;
  const cy = () => surface().getBoundingClientRect().height / 2;
  const script: [number, () => void][] = [
    [1500, () => (measuring = true)],
    [1600, () => key('KeyD', 'keydown')],
    [2300, () => key('KeyD', 'keyup')],
    [2350, () => click(0, cx() + 120, cy())],
    [2650, () => click(0, cx() + 120, cy())],
    [2950, () => click(0, cx() + 120, cy())],
    [3300, () => tap('Space')],
    [3700, () => tap('Digit1')],
    [4300, () => tap('Digit2')],
    [4700, () => key('KeyS', 'keydown')],
    [5600, () => key('KeyS', 'keyup')],
    [5700, () => key('KeyA', 'keydown')],
    [6500, () => key('KeyA', 'keyup')],
    [6600, () => tap('KeyI')],
    [7300, () => tap('Escape')],
    [7500, () => tap('KeyO')],
    [8100, () => tap('Escape')],
    [8300, () => key('KeyW', 'keydown')],
    [9200, () => key('KeyW', 'keyup')],
    [9300, () => click(0, cx() - 100, cy() + 40)],
    [9700, () => tap('KeyQ')],
    [10200, () => click(0, cx() + 80, cy() - 40)],
    [10700, () => {
      liteMode = true;
      void import('../render/v3render').then((m) => {
        for (const k of Object.keys(m.v3flags) as (keyof typeof m.v3flags)[]) m.v3flags[k] = false;
      });
    }],
    [12700, () => (measuring = false)],
    [12800, () => finish()],
  ];
  for (const [at, fn] of script) window.setTimeout(fn, at);

  const finish = () => {
    const sorted = [...frames].sort((a, b) => a - b);
    const avg = frames.reduce((s, v) => s + v, 0) / Math.max(1, frames.length);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const fps = avg > 0 ? 1000 / avg : 0;
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const fpsSteady = median > 0 ? 1000 / median : 0;
    const w = G.world;
    const liteAvg = lite.reduce((s, v) => s + v, 0) / Math.max(1, lite.length);
    const workAvg = work.reduce((s, v) => s + v, 0) / Math.max(1, work.length);
    const report = {
      ok: errors.length === 0 && fpsSteady >= 55 && fps >= 45,
      fpsSteady: +fpsSteady.toFixed(1),
      workMsAvg: +workAvg.toFixed(2),
      fpsWithoutV3Layers: liteAvg > 0 ? +(1000 / liteAvg).toFixed(1) : 0,
      visibility: document.visibilityState,
      fps: +fps.toFixed(1),
      frameMsAvg: +avg.toFixed(2),
      frameMsP95: +p95.toFixed(2),
      frames: frames.length,
      hitches: hitches.length,
      worstFrames: hitches.sort((a, b) => b.ms - a.ms).slice(0, 10),
      rendererLoadMs: Math.round(loadMs),
      longFrames: loaf.sort((a, b) => b.ms - a.ms).slice(0, 8),
      errors,
      map: w?.map?.id,
      monsters: w?.monsters.length ?? 0,
      adventurers: w?.adventurers.length ?? 0,
      breakables: w?.breakables.length ?? 0,
      elevation: !!w?.map?.hasElev,
      kills: G.save?.counters.kills ?? 0,
      style: G.save ? G.save.counters.sssReached : 0,
      viewport: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}`,
      canvas: `${G.game.renderer.classic.w}x${G.game.renderer.classic.h}`,
      gfx: G.game.renderer.preset,
      gfxInfo: G.game.renderer.engine?.info() ?? 'classic 2D canvas',
      gfxFailure: G.game.renderer.failure,
      dynScale: G.game.renderer.dynScale,
      version: desktop?.version ?? 'browser',
    };
    // restore every v3 layer so the capture taken by the main process shows the full visuals
    void import('../render/v3render').then((m) => {
      for (const k of Object.keys(m.v3flags) as (keyof typeof m.v3flags)[]) m.v3flags[k] = true;
      window.setTimeout(() => {
        if (desktop) desktop.reportSelftest(report);
        else console.info('[selftest]', report);
      }, 400);
    });
  };
}
