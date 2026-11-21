// Platform layer. In the packaged Windows app the preload script exposes window.aetheriaDesktop,
// and every save, the shared vault, settings and the leaderboard live as JSON files in ./saves.
// Running in a plain browser (dev server) falls back to localStorage with the same keys.

export interface DesktopBridge {
  readonly isDesktop: true;
  readonly version: string;
  readonly savesDir: string;
  readonly selftest: boolean;
  readonly packaged: boolean;
  readFile(name: string): string | null;
  writeFile(name: string, data: string): boolean;
  removeFile(name: string): boolean;
  listFiles(): string[];
  openSavesFolder(): Promise<string>;
  toggleFullscreen(): boolean;
  setFullscreen(on: boolean): boolean;
  isFullscreen(): boolean;
  setResolution(w: number, h: number): void;
  quit(): void;
  openWiki(): void;
  openExternal(url: string): void;
  reportSelftest(report: unknown): void;
  onFullscreenChange(cb: (on: boolean) => void): void;
}

export const desktop: DesktopBridge | null = (window as unknown as { aetheriaDesktop?: DesktopBridge }).aetheriaDesktop ?? null;
export const isDesktop = !!desktop;
export const WIKI_URL = 'https://nirco99.github.io/aetheria-chronicles-rpg/wiki/';
export const GAME_VERSION = '4.0.0';
export const REPO_URL = 'https://github.com/Nirco99/aetheria-chronicles-rpg';
export const TITLEBAR_H = 32;

export const RESOLUTIONS: { id: string; w: number; h: number }[] = [
  { id: '1280x720', w: 1280, h: 720 },
  { id: '1600x900', w: 1600, h: 900 },
  { id: '1920x1080', w: 1920, h: 1080 },
  { id: '2560x1440', w: 2560, h: 1440 },
];

/** logical storage key -> file name inside ./saves */
function fileFor(key: string): string | null {
  const m = /^aetheria\.save\.(\d+)$/.exec(key);
  if (m) return `slot_${Number(m[1]) + 1}.json`;
  switch (key) {
    case 'aetheria.vault':
      return 'global_vault.json';
    case 'aetheria.settings':
      return 'settings.json';
    case 'aetheria.leaderboard':
      return 'leaderboard.json';
    case 'aetheria.lastSlot':
      return 'last_slot.json';
    default:
      return null;
  }
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** synchronous key/value store backed by ./saves/*.json on desktop and localStorage in a browser */
export const store = {
  get(key: string): string | null {
    const f = desktop ? fileFor(key) : null;
    if (desktop && f) return desktop.readFile(f);
    return lsGet(key);
  },
  set(key: string, value: string): boolean {
    const f = desktop ? fileFor(key) : null;
    if (desktop && f) return desktop.writeFile(f, value);
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    const f = desktop ? fileFor(key) : null;
    if (desktop && f) {
      desktop.removeFile(f);
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/** one-time import of v1 saves kept in Electron's localStorage into the ./saves folder */
export function migrateBrowserSaves(): number {
  if (!desktop) return 0;
  let moved = 0;
  const keys = ['aetheria.save.0', 'aetheria.save.1', 'aetheria.save.2', 'aetheria.settings', 'aetheria.leaderboard', 'aetheria.lastSlot'];
  for (const k of keys) {
    const f = fileFor(k);
    if (!f) continue;
    const old = lsGet(k);
    if (old && desktop.readFile(f) === null && desktop.writeFile(f, old)) moved++;
  }
  return moved;
}

export function openWikiExternal(): void {
  if (desktop) desktop.openWiki();
  else window.open(location.protocol.startsWith('http') ? './wiki/' : WIKI_URL, '_blank', 'noopener');
}

export function quitToDesktop(): void {
  if (desktop) desktop.quit();
  else window.close();
}

export function toggleFullscreen(): boolean {
  if (desktop) return desktop.toggleFullscreen();
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
  return !document.fullscreenElement;
}

export function isFullscreen(): boolean {
  return desktop ? desktop.isFullscreen() : !!document.fullscreenElement;
}

/** builds the themed HTML title bar that pairs with Electron's caption-button overlay */
export function installTitlebar(onChange: () => void): void {
  if (!desktop) return;
  const bar = document.createElement('div');
  bar.id = 'titlebar';
  const ver = desktop.version;
  bar.innerHTML =
    '<svg viewBox="0 0 64 64" width="18" height="18" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#0b1630"/><path d="M32 6l5 30h-10z" fill="#7fe9ff"/><rect x="20" y="36" width="24" height="5" rx="2" fill="#f2c14e"/><rect x="29" y="41" width="6" height="14" rx="2" fill="#8a5a2b"/></svg>' +
    `<span class="tb-title">Aetheria Chronicles</span><span class="tb-sub">Sword &amp; Forge - Ascension Edition v${ver}</span>`;
  document.body.prepend(bar);
  const apply = (fs: boolean) => {
    document.body.classList.toggle('framed', !fs);
    onChange();
  };
  apply(desktop.isFullscreen());
  desktop.onFullscreenChange(apply);
}

export function titlebarOffset(): number {
  return document.body.classList.contains('framed') ? TITLEBAR_H : 0;
}
