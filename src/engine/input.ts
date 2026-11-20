// Keyboard + mouse state with per-update edge detection.

export class Input {
  readonly down = new Set<string>();
  private pressedSet = new Set<string>();
  private releasedSet = new Set<string>();
  mx = 0;
  my = 0;
  readonly mdown = [false, false, false];
  private mpressed = [false, false, false];
  private mreleased = [false, false, false];
  lastMouseMove = 0;
  wheel = 0;
  /** set by the UI while a text field has focus */
  typing = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F2', 'F3', 'F4', 'F5'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressedSet.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.releasedSet.add(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mdown.fill(false);
    });
    canvas.addEventListener('mousemove', (e) => this.onMove(e));
    window.addEventListener('mousemove', (e) => this.onMove(e));
    canvas.addEventListener('mousedown', (e) => {
      if (e.button > 2) return;
      this.mdown[e.button] = true;
      this.mpressed[e.button] = true;
      this.onMove(e);
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button > 2) return;
      if (this.mdown[e.button]) this.mreleased[e.button] = true;
      this.mdown[e.button] = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
  }

  private onMove(e: MouseEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.mx = e.clientX - r.left;
    this.my = e.clientY - r.top;
    this.lastMouseMove = performance.now();
  }

  isDown(...codes: string[]): boolean {
    if (this.typing) return false;
    for (const c of codes) if (this.down.has(c)) return true;
    return false;
  }

  pressed(...codes: string[]): boolean {
    if (this.typing) return false;
    for (const c of codes) if (this.pressedSet.has(c)) return true;
    return false;
  }

  released(...codes: string[]): boolean {
    for (const c of codes) if (this.releasedSet.has(c)) return true;
    return false;
  }

  mouseDown(b: number): boolean {
    return this.mdown[b];
  }

  mousePressed(b: number): boolean {
    return this.mpressed[b];
  }

  mouseReleased(b: number): boolean {
    return this.mreleased[b];
  }

  /** consume a pressed key so later handlers in the same frame ignore it */
  consume(code: string): void {
    this.pressedSet.delete(code);
  }

  consumeMouse(b: number): void {
    this.mpressed[b] = false;
  }

  endFrame(): void {
    this.pressedSet.clear();
    this.releasedSet.clear();
    this.mpressed.fill(false);
    this.mreleased.fill(false);
    this.wheel = 0;
  }
}
