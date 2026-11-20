// Automated desktop smoke test (`Aetheria Chronicles.exe --selftest`): starts a throwaway character
// (never written to a save slot), plays ~9 seconds of real input - moving, combos, dodges, Sword
// Skills, a Skill Connect attempt, panels - measures the frame rate and collects console errors,
// then hands a JSON report to the main process, which writes saves/selftest-report.json and exits.
import { G } from '../core/state';
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

function click(button: number, x: number, y: number): void {
  const c = document.getElementById('game') as HTMLCanvasElement;
  const r = c.getBoundingClientRect();
  const opts = { clientX: r.left + x, clientY: r.top + y, button, bubbles: true };
  c.dispatchEvent(new MouseEvent('mousemove', opts));
  c.dispatchEvent(new MouseEvent('mousedown', opts));
  window.setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', opts)), 70);
}

export function runSelftest(start: () => void): void {
  const t0 = performance.now();
  start();
  const frames: number[] = [];
  const work: number[] = [];
  const lite: number[] = [];
  let last = performance.now();
  let measuring = false;
  let liteMode = false;
  const tick = (now: number) => {
    if (measuring) {
      (liteMode ? lite : frames).push(now - last);
      if (!liteMode) work.push(G.game.workMs);
    }
    last = now;
    if (performance.now() - t0 < 16000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const cx = () => (document.getElementById('game') as HTMLCanvasElement).getBoundingClientRect().width / 2;
  const cy = () => (document.getElementById('game') as HTMLCanvasElement).getBoundingClientRect().height / 2;
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
    const w = G.world;
    const liteAvg = lite.reduce((s, v) => s + v, 0) / Math.max(1, lite.length);
    const workAvg = work.reduce((s, v) => s + v, 0) / Math.max(1, work.length);
    const report = {
      ok: errors.length === 0 && fps >= 55,
      workMsAvg: +workAvg.toFixed(2),
      fpsWithoutV3Layers: liteAvg > 0 ? +(1000 / liteAvg).toFixed(1) : 0,
      visibility: document.visibilityState,
      fps: +fps.toFixed(1),
      frameMsAvg: +avg.toFixed(2),
      frameMsP95: +p95.toFixed(2),
      frames: frames.length,
      errors,
      map: w?.map?.id,
      monsters: w?.monsters.length ?? 0,
      adventurers: w?.adventurers.length ?? 0,
      breakables: w?.breakables.length ?? 0,
      elevation: !!w?.map?.hasElev,
      kills: G.save?.counters.kills ?? 0,
      style: G.save ? G.save.counters.sssReached : 0,
      viewport: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}`,
      canvas: `${G.game.renderer.w}x${G.game.renderer.h}`,
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
