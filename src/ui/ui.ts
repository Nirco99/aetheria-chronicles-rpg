// UI manager: one main panel at a time, stacked modals, toasts, full-screen menus and the
// golden "SYSTEM ANNOUNCEMENT: UNIQUE SKILL AWAKENED!" modal.
import type { AwakeningDef } from '../types/game';
import type { Npc } from '../entities/npc';
import { G } from '../core/state';
import { audio } from '../engine/audio';
import { h, btn, hideTip, initTooltip } from './dom';
import { openHandbook, openPause, openSettings, showCreate, showSlots, showTitle } from './screens';
import { openCharacter } from './character';
import {
  openColiseum, openAbyssGate, openCraft, openDecorPalette, openEstate, openForge, openGate, openGuild, openMount, openNpc, openShop, openVault, closeDecorPalette,
} from './town';
import type { ShopKind } from '../types/game';
import type { Adventurer } from '../entities/allies';
import {
  openAdventurer, openBestiary, openBlackMarket, openCodex, openConstellation, openFishing, openJournal, openRaidBriefing, openStable, openWardrobe,
} from './v3ui';

export type ToastKind = 'info' | 'warn' | 'loot' | 'mastery' | 'buff' | 'boss' | 'market';

export class UI {
  readonly root: HTMLElement;
  private panel: HTMLElement | null = null;
  private panelBody: HTMLElement | null = null;
  panelId: string | null = null;
  private build: ((body: HTMLElement) => void) | null = null;
  private onClose: (() => void) | null = null;
  private modals: HTMLElement[] = [];
  private toasts: HTMLElement;
  private screen: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.toasts = h('div', { class: 'toasts' });
    root.appendChild(this.toasts);
    initTooltip(root);
  }

  get blocking(): boolean {
    return !!this.panel || this.modals.length > 0 || !!this.screen;
  }

  get hasModal(): boolean {
    return this.modals.length > 0;
  }

  // ---------------------------------------------------------------- screens

  setScreen(el: HTMLElement | null): void {
    if (this.screen) this.screen.remove();
    this.screen = el;
    if (el) this.root.appendChild(el);
    hideTip();
  }

  // ---------------------------------------------------------------- panels

  openPanel(id: string, title: string, build: (body: HTMLElement) => void, opts: { wide?: boolean; onClose?: () => void; subtitle?: string } = {}): void {
    this.closePanel(true);
    const body = h('div', { class: 'panel-body' });
    const panel = h('div', { class: 'panel' + (opts.wide ? ' wide' : '') },
      h('div', { class: 'panel-head' },
        h('div', { class: 'panel-title' }, h('span', { text: title }), opts.subtitle ? h('small', { text: opts.subtitle }) : null),
        h('button', { class: 'x', text: '✕', title: 'Close (Esc)', onclick: () => this.closePanel() })),
      body);
    this.root.appendChild(panel);
    this.panel = panel;
    this.panelBody = body;
    this.panelId = id;
    this.build = build;
    this.onClose = opts.onClose ?? null;
    build(body);
    audio.play('ui');
  }

  refresh(): void {
    if (!this.panelBody || !this.build) return;
    const scrolls = Array.from(this.panelBody.querySelectorAll('.scroll')).map((e) => e.scrollTop);
    const top = this.panelBody.scrollTop;
    this.panelBody.innerHTML = '';
    this.build(this.panelBody);
    this.panelBody.scrollTop = top;
    Array.from(this.panelBody.querySelectorAll('.scroll')).forEach((e, i) => (e.scrollTop = scrolls[i] ?? 0));
    hideTip();
  }

  closePanel(silent = false): void {
    if (!this.panel) return;
    this.panel.remove();
    this.panel = null;
    this.panelBody = null;
    this.panelId = null;
    this.build = null;
    hideTip();
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
    if (!silent) audio.play('uiBack');
  }

  /** Esc handling: closes the topmost layer; returns true if something was closed */
  back(): boolean {
    if (this.modals.length) {
      const m = this.modals[this.modals.length - 1];
      if (m.dataset.closable === '0') return true;
      this.closeModal(m);
      return true;
    }
    if (this.panel) {
      this.closePanel();
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- modals

  modal(build: (box: HTMLElement, close: () => void) => void, opts: { closable?: boolean; cls?: string } = {}): () => void {
    const box = h('div', { class: 'modal-box ' + (opts.cls ?? '') });
    const overlay = h('div', { class: 'modal' }, box);
    overlay.dataset.closable = opts.closable === false ? '0' : '1';
    const close = () => this.closeModal(overlay);
    build(box, close);
    this.root.appendChild(overlay);
    this.modals.push(overlay);
    return close;
  }

  private closeModal(m: HTMLElement): void {
    m.remove();
    this.modals = this.modals.filter((x) => x !== m);
    hideTip();
  }

  confirm(msg: string, onYes: () => void, yesLabel = 'Confirm'): void {
    this.modal((box, close) => {
      box.append(
        h('p', { class: 'modal-text', text: msg }),
        h('div', { class: 'row end' }, btn('Cancel', close, 'ghost'), btn(yesLabel, () => {
          close();
          onYes();
        }, 'primary')),
      );
    });
  }

  prompt(title: string, initial: string, onOk: (v: string) => void, maxLength = 28): void {
    this.modal((box, close) => {
      const input = h('input', { class: 'input', value: initial, maxLength });
      const ok = () => {
        close();
        onOk(input.value);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') ok();
        if (e.key === 'Escape') close();
        e.stopPropagation();
      });
      box.append(h('div', { class: 'modal-title', text: title }), input, h('div', { class: 'row end' }, btn('Cancel', close, 'ghost'), btn('OK', ok, 'primary')));
      setTimeout(() => input.focus(), 30);
    });
  }

  awakening(def: AwakeningDef): void {
    this.modal((box, close) => {
      box.append(
        h('div', { class: 'aw-sys', text: 'SYSTEM ANNOUNCEMENT' }),
        h('div', { class: 'aw-title', text: 'UNIQUE SKILL AWAKENED!' }),
        h('div', { class: 'aw-name', text: def.name }),
        h('p', { class: 'aw-desc', text: def.desc }),
        h('p', { class: 'aw-trigger', text: `Condition met: ${def.trigger}` }),
        h('div', { class: 'row center' }, btn('Accept the Power', close, 'gold')),
      );
    }, { cls: 'awaken' });
  }

  // ---------------------------------------------------------------- toasts

  toast(msg: string, kind: ToastKind | string = 'info'): void {
    const el = h('div', { class: 'toast ' + kind, text: msg });
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 6) this.toasts.firstElementChild?.remove();
    setTimeout(() => el.classList.add('out'), 4200);
    setTimeout(() => el.remove(), 4800);
  }

  // ---------------------------------------------------------------- delegates

  showTitle(): void {
    showTitle();
  }
  showSlots(): void {
    showSlots();
  }
  showCreate(): void {
    showCreate();
  }
  openSettings(): void {
    openSettings();
  }
  openPause(): void {
    openPause();
  }
  openHandbook(): void {
    openHandbook();
  }
  openCharacter(tab = 'equipment'): void {
    openCharacter(tab);
  }
  openForge(home = false): void {
    openForge(home);
  }
  openCraft(kind: 'alchemy' | 'cooking'): void {
    openCraft(kind);
  }
  openShop(kind: ShopKind): void {
    openShop(kind);
  }
  openGuild(): void {
    openGuild();
  }
  openEstate(): void {
    openEstate();
  }
  openGate(): void {
    openGate();
  }
  openAbyss(): void {
    openAbyssGate();
  }
  openColiseum(): void {
    openColiseum();
  }
  openVault(): void {
    openVault();
  }
  openMount(index: number): void {
    openMount(index);
  }
  openNpc(npc: Npc): void {
    openNpc(npc);
  }
  openDecor(): void {
    openDecorPalette();
  }
  closeDecor(): void {
    closeDecorPalette();
  }
  get gameReady(): boolean {
    return !!G.save;
  }
  // ---- v3 panels
  openConstellation(): void {
    openConstellation();
  }
  openBestiary(): void {
    openBestiary();
  }
  openJournal(): void {
    openJournal();
  }
  openStable(): void {
    openStable();
  }
  openWardrobe(): void {
    openWardrobe();
  }
  openCodex(atForge: boolean): void {
    openCodex(atForge);
  }
  openBlackMarket(): void {
    openBlackMarket();
  }
  openAdventurer(a: Adventurer): void {
    openAdventurer(a);
  }
  openFishing(spot: number): void {
    openFishing(spot);
  }
  openRaidBriefing(name: string, desc: string, level: number, onAccept: (vanguard: boolean) => void, onDecline?: () => void): void {
    openRaidBriefing(name, desc, level, onAccept, onDecline);
  }
}
