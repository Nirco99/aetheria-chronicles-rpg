// Title screen, save slots, character creation, settings, pause menu and the Handbook.
import type { Appearance, Dir, WorldMode } from '../types/game';
import { G } from '../core/state';
import { EYE_COLORS, HAIR_COLORS, HAIR_STYLES, SKIN_TONES, BRANCH_INFO, BRANCHES } from '../data/constants';
import { HANDBOOK } from '../data/lore';
import { AWAKENINGS, PASSIVE_SKILLS, skillsOfBranch } from '../data/skills';
import { starterKit } from '../data/items';
import { KITS, SLOT_COUNT, deleteSlot, lastSlot, saveGame, saveSettings, slotSummary, type StarterKit } from '../systems/save';
import { drawHumanoid, previewAnim, type Look } from '../render/paperdoll';
import { visOf } from '../render/gear';
import { audio } from '../engine/audio';
import { fmtTime } from '../engine/util';
import { h, btn } from './dom';
import { GAME_VERSION, RESOLUTIONS, desktop, isDesktop, isFullscreen, openWikiExternal, quitToDesktop, toggleFullscreen } from '../platform/desktop';
import { PRESET_ORDER, QUALITY, detectGpu, recommendPreset, type GfxPreset } from '../gfx/quality';

export function isElectron(): boolean {
  return isDesktop || navigator.userAgent.includes('Electron');
}

/** the strategy wiki is the one external website: it opens in the OS browser */
export function openWiki(): void {
  openWikiExternal();
  audio.play('ui');
  G.ui.toast('The Aetheria Codex opened in your web browser.', 'info');
}

export function openSavesFolder(): void {
  if (!desktop) {
    G.ui.toast('Saves live in browser storage in the web build. The desktop app keeps them in its saves folder.', 'info');
    return;
  }
  void desktop.openSavesFolder();
  G.ui.toast(`Opened ${desktop.savesDir} in Explorer.`, 'info');
}

function confirmQuitDesktop(): void {
  G.ui.confirm('Save and quit Aetheria Chronicles to the desktop?', () => {
    if (G.game.state === 'play') saveGame();
    quitToDesktop();
  }, 'Quit to Desktop');
}

// ------------------------------------------------------------------ title

export function showTitle(): void {
  const last = lastSlot();
  const menu = h('div', { class: 'title-menu' },
    last !== null ? btn('Continue', () => G.game.loadSlot(last), 'primary big') : null,
    btn('New Game', () => showCreate(), last === null ? 'primary big' : 'big'),
    btn('Load Game', () => showSlots(), 'big'),
    btn('Settings & Graphics', () => openSettings(), 'big'),
    btn('Aetheria Codex & Database', () => openWiki(), 'big wiki'),
    desktop ? btn('Open Saves Folder', () => openSavesFolder(), 'big ghost') : null,
    desktop ? btn('Quit to Desktop', () => confirmQuitDesktop(), 'big ghost') : null,
  );
  const r = G.game.renderer;
  const gfx = h('button', { class: 'gfx-chip', onclick: () => openSettings() });
  const refreshChip = (): void => {
    if (!gfx.isConnected && gfx.textContent) return;
    gfx.textContent = `Graphics: ${r.presetLabel()}${r.is3d ? '  (3D)' : ''}`;
  };
  refreshChip();
  window.setTimeout(refreshChip, 1200);
  window.setTimeout(refreshChip, 3500);
  const el = h('div', { class: 'screen title' },
    h('div', { class: 'logo' },
      h('div', { class: 'logo-top', text: 'AETHERIA CHRONICLES' }),
      h('div', { class: 'logo-sub', text: 'SWORD  &  FORGE' }),
      h('div', { class: 'logo-tag', text: 'A real-time 3D action RPG of sword skills, blacksmithing and five floating realms' })),
    menu,
    gfx,
    h('div', { class: 'title-foot', text: `v${desktop?.version ?? GAME_VERSION}  •  Ascension Edition  •  ${desktop ? 'F11 / Alt+Enter fullscreen' : 'F11 fullscreen'}  •  Every model, texture, sound and note is generated procedurally` }));
  G.ui.setScreen(el);
}

// ------------------------------------------------------------------ slots

export function showSlots(): void {
  const list = h('div', { class: 'slots' });
  for (let i = 0; i < SLOT_COUNT; i++) {
    const s = slotSummary(i);
    list.appendChild(h('div', { class: 'slot-card' + (s ? '' : ' empty') },
      h('div', { class: 'slot-num', text: `Slot ${i + 1}` }),
      s ? h('div', { class: 'slot-info' },
        h('b', { text: s.name }), h('span', { text: `Level ${s.level} • ${s.location}` }),
        h('small', { text: `${s.mode === 'open' ? 'Unrestricted Open World' : 'Ascension Chronicle'} • ${fmtTime(s.playTime)} played` }))
        : h('div', { class: 'slot-info', text: 'Empty slot' }),
      h('div', { class: 'row' },
        s ? btn('Load', () => G.game.loadSlot(i), 'primary') : btn('New Game', () => showCreate(i), 'primary'),
        s ? btn('Delete', () => G.ui.confirm(`Delete ${s.name} (level ${s.level}) forever?`, () => {
          deleteSlot(i);
          showSlots();
        }, 'Delete'), 'danger') : null)));
  }
  G.ui.setScreen(h('div', { class: 'screen center' }, h('div', { class: 'card wide' }, h('h2', { text: 'Load Game' }), list, h('div', { class: 'row end' }, btn('Back', () => showTitle(), 'ghost')))));
}

// ------------------------------------------------------------------ create

export function showCreate(preferSlot?: number): void {
  const ap: Appearance = { skin: 1, hairStyle: 0, hairColor: 0, eyeColor: 1 };
  let name = 'Aster';
  let mode: WorldMode = 'chronicle';
  let kit: StarterKit = 'sword_shield';
  let slot = preferSlot ?? (() => {
    for (let i = 0; i < SLOT_COUNT; i++) if (!slotSummary(i)) return i;
    return 0;
  })();
  const kitItems = starterKit();
  const canvas = h('canvas', { class: 'preview' });
  canvas.width = 520;
  canvas.height = 600;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const form = h('div', { class: 'create-form scroll' });
  const swatches = (colors: string[], get: () => number, set: (i: number) => void, names?: string[]) => {
    const row = h('div', { class: 'swatches' });
    colors.forEach((c, i) => row.appendChild(h('button', {
      class: 'swatch' + (get() === i ? ' on' : ''), style: `background:${c}`, title: names?.[i] ?? '',
      onclick: () => {
        set(i);
        render();
      },
    })));
    return row;
  };
  const render = () => {
    form.innerHTML = '';
    const nameInput = h('input', { class: 'input', value: name, maxLength: 16, placeholder: 'Character name' });
    nameInput.addEventListener('input', () => (name = nameInput.value));
    nameInput.addEventListener('keydown', (e) => e.stopPropagation());
    form.append(
      h('h2', { text: 'Create Your Diver' }),
      h('label', { text: 'Name' }), nameInput,
      h('label', { text: 'Skin Tone' }), swatches(SKIN_TONES, () => ap.skin, (i) => (ap.skin = i)),
      h('label', { text: `Hair Style - ${HAIR_STYLES[ap.hairStyle]}` }),
      h('div', { class: 'chips' }, ...HAIR_STYLES.map((n, i) => h('button', { class: 'chip' + (ap.hairStyle === i ? ' on' : ''), text: n, onclick: () => { ap.hairStyle = i; render(); } }))),
      h('label', { text: `Hair Color - ${HAIR_COLORS[ap.hairColor].name}` }), swatches(HAIR_COLORS.map((c) => c.color), () => ap.hairColor, (i) => (ap.hairColor = i), HAIR_COLORS.map((c) => c.name)),
      h('label', { text: `Eye Color - ${EYE_COLORS[ap.eyeColor].name}` }), swatches(EYE_COLORS.map((c) => c.color), () => ap.eyeColor, (i) => (ap.eyeColor = i), EYE_COLORS.map((c) => c.name)),
      h('label', { text: 'Starting Weapons (every starter weapon is in your bag - mastery is classless)' }),
      h('div', { class: 'cards' }, ...KITS.map((k) => h('button', { class: 'pick' + (kit === k.id ? ' on' : ''), onclick: () => { kit = k.id; render(); } },
        h('b', { text: k.name, style: `color:${BRANCH_INFO[k.branch].color}` }), h('span', { text: k.desc })))),
      h('label', { text: 'World Mode' }),
      h('div', { class: 'cards two' },
        h('button', { class: 'pick' + (mode === 'chronicle' ? ' on' : ''), onclick: () => { mode = 'chronicle'; render(); } }, h('b', { text: 'Ascension Chronicle Mode' }), h('span', { text: 'Defeat each realm\'s dungeon boss to unseal the Teleport Gate to the next realm. The intended journey.' })),
        h('button', { class: 'pick' + (mode === 'open' ? ' on' : ''), onclick: () => { mode = 'open'; render(); } }, h('b', { text: 'Unrestricted Open World Mode' }), h('span', { text: 'All five realms and cities are open from the start. Explore at your own risk.' }))),
      h('label', { text: 'Save Slot' }),
      h('div', { class: 'chips' }, ...Array.from({ length: SLOT_COUNT }, (_, i) => {
        const s = slotSummary(i);
        return h('button', { class: 'chip' + (slot === i ? ' on' : ''), text: s ? `Slot ${i + 1}: ${s.name} (overwrite)` : `Slot ${i + 1}: empty`, onclick: () => { slot = i; render(); } });
      })),
      h('div', { class: 'row end' }, btn('Back', () => showTitle(), 'ghost'), btn('Begin Adventure', () => {
        const go = () => {
          stop = true;
          G.game.newGame(slot, name, { ...ap }, mode, kit);
        };
        if (slotSummary(slot)) G.ui.confirm(`Overwrite the character in slot ${slot + 1}?`, go, 'Overwrite');
        else go();
      }, 'primary big')),
    );
  };
  let stop = false;
  const t0 = performance.now();
  const loop = () => {
    if (stop || !canvas.isConnected) return;
    const t = (performance.now() - t0) / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grd = ctx.createRadialGradient(260, 420, 20, 260, 360, 300);
    grd.addColorStop(0, 'rgba(127,233,255,0.25)');
    grd.addColorStop(1, 'rgba(10,16,32,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 520, 600);
    ctx.strokeStyle = 'rgba(127,233,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(260, 470, 120, 34, 0, 0, Math.PI * 2);
    ctx.stroke();
    const k = kitItems;
    const mainOff: Record<StarterKit, [typeof k.sword, typeof k.sword | null]> = {
      sword_shield: [k.sword, k.shield], dual: [k.sword, k.sword2], spear: [k.spear, null], bow: [k.bow, null], staff: [k.staff, null],
    };
    const [main, off] = mainOff[kit];
    const look: Look = {
      skin: SKIN_TONES[ap.skin], hair: HAIR_COLORS[ap.hairColor].color, hairStyle: ap.hairStyle, eyes: EYE_COLORS[ap.eyeColor].color,
      head: null, chest: visOf(k.chest), boots: visOf(k.boots), cloak: visOf(k.cloak), main: visOf(main), off: visOf(off),
      showHelmet: true, ghost: false, scale: 1, aura: null, mannequin: false,
    };
    const dir = ([0, 3, 1, 2] as Dir[])[Math.floor(t / 1.6) % 4];
    const aim = [Math.PI / 2, 0, -Math.PI / 2, Math.PI][[0, 3, 1, 2].indexOf(dir)];
    ctx.setTransform(5, 0, 0, 5, 260, 470);
    drawHumanoid(ctx, 0, 0, look, previewAnim(t), dir, { aim, moving: true, vx: Math.cos(aim) * 120, vy: Math.sin(aim) * 120, t });
    requestAnimationFrame(loop);
  };
  render();
  G.ui.setScreen(h('div', { class: 'screen create' }, form, h('div', { class: 'create-preview' }, canvas, h('div', { class: 'preview-cap', text: 'Your equipped gear always shows on your character.' }))));
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------------ settings

export function openSettings(): void {
  G.ui.modal((box, close) => {
    const s = G.settings;
    const slider = (label: string, key: 'master' | 'music' | 'sfx') => {
      const inp = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key] });
      inp.addEventListener('input', () => {
        s[key] = Number(inp.value);
        G.game.applySettings();
      });
      return h('div', { class: 'set-row' }, h('span', { text: label }), inp);
    };
    const toggle = (label: string, key: 'shake' | 'numbers' | 'fps') => {
      const inp = h('input', { type: 'checkbox', checked: s[key] });
      inp.addEventListener('change', () => {
        s[key] = inp.checked;
        G.game.applySettings();
      });
      return h('label', { class: 'set-row check' }, h('span', { text: label }), inp);
    };
    const styleToggle = (() => {
      const inp = h('input', { type: 'checkbox', checked: s.styleMeter });
      inp.addEventListener('change', () => (s.styleMeter = inp.checked));
      return h('label', { class: 'set-row check' }, h('span', { text: 'Style Meter (D - SSS)' }), inp);
    })();
    const quality = h('select', { class: 'select' }) as HTMLSelectElement;
    for (const [v, label] of [[0.75, 'Performance (0.75x)'], [1, 'Native (1x)'], [1.5, 'Supersampled (1.5x)'], [2, 'Ultra Supersampled (2x)']] as [number, string][]) {
      const o = h('option', { value: String(v), text: label }) as HTMLOptionElement;
      if (Math.abs(s.quality - v) < 0.01) o.selected = true;
      quality.append(o);
    }
    quality.addEventListener('change', () => {
      s.quality = Number(quality.value);
      G.game.applySettings();
    });
    const fsBox = h('input', { type: 'checkbox', checked: isFullscreen() });
    fsBox.addEventListener('change', () => {
      const on = toggleFullscreen();
      s.fullscreen = desktop ? on : fsBox.checked;
    });
    const res = h('select', { class: 'select' }) as HTMLSelectElement;
    res.append(h('option', { value: '', text: 'Window size...' }));
    for (const r of RESOLUTIONS) res.append(h('option', { value: r.id, text: `${r.w} x ${r.h}` }));
    res.addEventListener('change', () => {
      const r = RESOLUTIONS.find((x) => x.id === res.value);
      if (!r) return;
      s.resolution = r.id;
      s.fullscreen = false;
      fsBox.checked = false;
      if (desktop) desktop.setResolution(r.w, r.h);
      else G.ui.toast('Window sizes apply to the desktop app.', 'info');
    });
    // ---- graphics: renderer + quality preset, applied live
    const rec = recommendPreset();
    const gfxSel = h('select', { class: 'select gfx-select' }) as HTMLSelectElement;
    const label = (p: GfxPreset): string => (p === 'classic' ? 'Classic 2D (original canvas renderer)' : `3D - ${QUALITY[p].label}`);
    gfxSel.append(h('option', { value: 'auto', text: `Auto (recommended: ${rec === 'classic' ? 'Classic 2D' : QUALITY[rec].label})` }));
    for (const p of PRESET_ORDER) gfxSel.append(h('option', { value: p, text: label(p) }));
    gfxSel.value = s.gfx;
    const gfxDesc = h('div', { class: 'gfx-desc' });
    const gpu = detectGpu();
    const describe = (): void => {
      const cur = G.game.renderer.preset;
      const d = cur === 'classic' ? 'The original 2D renderer. Runs on anything.' : QUALITY[cur].desc;
      gfxDesc.innerHTML = '';
      gfxDesc.append(h('div', { text: d }), h('small', { class: 'dim', text: `GPU: ${gpu || 'unknown'}${G.game.renderer.is3d ? '  -  ' + (G.game.renderer.engine?.info() ?? '') : ''}` }));
    };
    gfxSel.addEventListener('change', () => {
      s.gfx = gfxSel.value as typeof s.gfx;
      gfxDesc.textContent = 'Switching renderer...';
      void G.game.renderer.setPreset(s.gfx).then(() => {
        if (G.game.renderer.failure) G.ui.toast(G.game.renderer.failure, 'warn');
        describe();
      });
    });
    describe();
    box.append(h('div', { class: 'modal-title', text: 'Settings' }),
      h('div', { class: 'modal-sub', text: 'Graphics' }),
      h('div', { class: 'set-row' }, h('span', { text: 'Renderer & quality' }), gfxSel),
      gfxDesc,
      h('div', { class: 'modal-sub', text: 'Audio & interface' }),
      slider('Master Volume', 'master'), slider('Music', 'music'), slider('Sound Effects', 'sfx'),
      toggle('Screen Shake', 'shake'), toggle('Damage Numbers', 'numbers'), toggle('Show FPS', 'fps'), styleToggle,
      h('div', { class: 'modal-sub', text: 'Display' }),
      h('label', { class: 'set-row check' }, h('span', { text: 'Fullscreen (F11 / Alt+Enter)' }), fsBox),
      h('div', { class: 'set-row' }, h('span', { text: 'Resolution' }), res),
      h('div', { class: 'set-row' }, h('span', { text: 'Classic 2D render quality' }), quality),
      h('div', { class: 'row' }, btn('Open Saves Folder', () => openSavesFolder(), 'ghost')),
      h('div', { class: 'row end' }, btn('Done', () => {
        saveSettings(G.settings);
        close();
      }, 'primary')));
  });
}

// ------------------------------------------------------------------ pause

export function openPause(): void {
  const s = G.save;
  G.ui.openPanel('pause', 'Paused', (b) => {
    b.append(
      h('div', { class: 'pause-info', text: `${s.name} • Level ${s.level} • ${G.world.map.name} • ${fmtTime(s.playTime)} played • ${s.mode === 'open' ? 'Unrestricted Open World' : 'Ascension Chronicle'}` }),
      h('div', { class: 'pause-menu' },
        btn('Resume', () => G.ui.closePanel(), 'primary'),
        btn('Save Game', () => {
          G.ui.toast(saveGame() ? 'Game saved.' : 'Saving failed (storage unavailable).', 'info');
        }),
        btn('Character & Inventory (I)', () => G.ui.openCharacter('equipment')),
        btn('Constellation Skill Graph (K)', () => G.ui.openConstellation()),
        btn('Journal: Achievements & Titles (N)', () => G.ui.openJournal()),
        btn('Bestiary (O)', () => G.ui.openBestiary()),
        btn('Stable & Pets (P)', () => G.ui.openStable()),
        btn('Wardrobe (T)', () => G.ui.openWardrobe()),
        btn('Relic Codex (U)', () => G.ui.openCodex(false)),
        btn("Adventurer's Handbook (H)", () => openHandbook()),
        btn('Settings & Graphics', () => openSettings()),
        btn('Aetheria Codex & Database', () => openWiki(), 'wiki'),
        desktop ? btn('Open Saves Folder', () => openSavesFolder()) : null,
        btn('Save & Quit to Title', () => G.ui.confirm('Save and return to the title screen?', () => G.game.quitToTitle(), 'Quit'), 'danger'),
        desktop ? btn('Save & Quit to Desktop', () => confirmQuitDesktop(), 'danger') : null,
      ));
  });
}

// ------------------------------------------------------------------ handbook

export function openHandbook(): void {
  const sections = [
    ...HANDBOOK,
    {
      id: 'compendium', title: 'Skill Compendium',
      body: BRANCHES.map((b) => `<h3 style="color:${BRANCH_INFO[b].color}">${BRANCH_INFO[b].name}</h3><p class="dim">Requires: ${BRANCH_INFO[b].req}</p><ul>${skillsOfBranch(b).map((s) => `<li><b>${s.name}</b> <span class="dim">(Rank ${s.rank}, ${s.sp} SP, ${s.mp} MP, ${s.cd}s)</span> - ${s.desc}</li>`).join('')}${PASSIVE_SKILLS.filter((p) => p.branch === b).map((p) => `<li><b>${p.name}</b> <span class="dim">(Passive, Rank ${p.rank}, up to ${p.max} levels)</span> - ${p.desc}</li>`).join('')}</ul>`).join(''),
    },
    {
      id: 'awakenings-list', title: 'Awakening Records',
      body: AWAKENINGS.map((a) => `<h3>${G.save?.awakenings.includes(a.id) ? a.name : '??? (Sealed)'}</h3><p>${G.save?.awakenings.includes(a.id) ? a.desc : 'The system has not yet recognised you.'}</p>`).join(''),
    },
  ];
  let cur = sections[0].id;
  G.ui.openPanel('handbook', "Adventurer's Handbook", (b) => {
    const nav = h('div', { class: 'hb-nav scroll' }, ...sections.map((s) => h('button', { class: 'hb-link' + (s.id === cur ? ' on' : ''), text: s.title, onclick: () => { cur = s.id; G.ui.refresh(); } })));
    const sec = sections.find((s) => s.id === cur) ?? sections[0];
    b.append(h('div', { class: 'hb' }, nav, h('div', { class: 'hb-body scroll' }, h('h2', { text: sec.title }), h('div', { html: sec.body }))));
  }, { wide: true });
}
