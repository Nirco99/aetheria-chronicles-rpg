// World renderer: camera, ground tiles, Y-sorted painter's algorithm for walls / props / actors,
// telegraphs, zones, loot beams, projectiles, day-night lighting with punch-out lights,
// weather and the minimap source canvas.
import type { Actor } from '../entities/actor';
import type { Prop, ResourceNode } from '../types/game';
import type { Projectile } from '../entities/projectile';
import type { LootInst, TeleInst } from '../world/world';
import { G } from '../core/state';
import { RARITY_COLORS, TILE, VIEW_H, WALL_H } from '../data/constants';
import { REALMS } from '../data/realms';
import { itemDef } from '../data/items';
import { ELEV, ELEV_H, GT, SOL, type GameMap } from '../world/tilemap';
import { drawBladeTrail, drawBreakable, drawCaravan, drawCastShadows, drawCloudShadows, drawEventGate, drawForeground, drawGrass, drawGroundFeatures, drawMount, drawPet, drawPrints, footsteps } from './v3render';
import { groundTile } from './tilecache';
import { GAUGE_COLORS } from '../data/v3';
import type { Companion } from '../entities/companion';
import type { Adventurer, Caravan, Shadow } from '../entities/allies';
import type { Breakable } from '../entities/breakable';
import type { Pet } from '../entities/pet';
import type { GaugeKind } from '../types/game';
import { minimapColor, setTileScale, wallFace, wallTop } from './tilecache';
import { bakedWall, drawGround } from './chunks';
import { propSprite, setPropScale } from './props';
import { drawHumanoid, mannequinLook, previewAnim } from './paperdoll';
import { drawMonster } from './monsters';
import { drawWeapon, visOf } from './gear';
import { glowSprite } from './glow';
import { fx } from './fx';
import { weather } from './weather';
import { Monster } from '../entities/monster';
import { Npc } from '../entities/npc';
import { clamp, hash2, lerp, mix, rgba, shade, TAU } from '../engine/util';
import { titlebarOffset } from '../platform/desktop';

interface DL {
  k: number;
  f: number;
  o: unknown;
  a: number;
  b: number;
}

const ORE_GLOW = new Set(['ore_mithril', 'ore_starlight', 'ore_voidsteel', 'ore_crimson', 'ore_orichalcum']);

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  w = 1;
  h = 1;
  dpr = 1;
  scale = 1;
  /** supersampling multiplier on top of devicePixelRatio (Settings > Render quality) */
  quality = 1;
  /** dynamic-resolution factor (drops when the frame rate sags, recovers when it is stable) */
  dynScale = 1;
  private perfAcc = 0;
  private perfFrames = 0;
  private perfGood = 0;
  cam = { x: 0, y: 0, zoom: 1, pulse: 0, pulseZ: 1, sx: 0, sy: 0 };
  private light: HTMLCanvasElement;
  private lctx: CanvasRenderingContext2D;
  private dl: DL[] = [];
  private dlN = 0;
  private minimapFor: GameMap | null = null;
  /** elevation lift (px) of a world point on the current map */
  private lift: (x: number, y: number) => number = () => 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d') as CanvasRenderingContext2D;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const top = titlebarOffset();
    const cw = window.innerWidth;
    const ch = Math.max(200, window.innerHeight - top);
    // high-DPI supersampling inside a pixel budget (2.4 MP at Native quality), then dynamic resolution
    const q = this.quality || 1;
    const base = Math.min(2.5, (window.devicePixelRatio || 1) * q);
    const budget = 2.4e6 * q * q;
    const cap = Math.sqrt(budget / Math.max(1, cw * ch));
    this.dpr = Math.max(0.6, Math.min(base, cap) * this.dynScale);
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    this.w = this.canvas.width = Math.round(cw * this.dpr);
    this.h = this.canvas.height = Math.round(ch * this.dpr);
    this.scale = this.h / VIEW_H;
    this.light.width = Math.ceil(this.w / 2);
    this.light.height = Math.ceil(this.h / 2);
    setTileScale(this.scale);
    setPropScale(this.scale);
  }

  get zoomScale(): number {
    return this.scale * this.cam.zoom * this.cam.pulseZ;
  }

  screenToWorld(cssX: number, cssY: number): { x: number; y: number } {
    const s = this.zoomScale;
    return { x: (cssX * this.dpr - this.w / 2) / s + this.cam.x, y: (cssY * this.dpr - this.h / 2) / s + this.cam.y };
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    const s = this.zoomScale;
    return { x: (x - this.cam.x) * s + this.w / 2, y: (y - this.cam.y) * s + this.h / 2 };
  }

  snap(x: number, y: number): void {
    this.cam.x = x;
    this.cam.y = y;
    this.clampCam();
  }

  private clampCam(): void {
    const m = G.world?.map;
    if (!m) return;
    const s = this.zoomScale;
    const vw = this.w / s;
    const vh = this.h / s;
    this.cam.x = m.pw <= vw ? m.pw / 2 : clamp(this.cam.x, vw / 2, m.pw - vw / 2);
    this.cam.y = m.ph <= vh ? m.ph / 2 : clamp(this.cam.y, vh / 2, m.ph - vh / 2);
  }

  /** dynamic resolution: keep 60 FPS by trading render resolution, with hysteresis */
  private adaptResolution(dt: number): void {
    this.perfAcc += dt;
    this.perfFrames++;
    if (this.perfAcc < 1.25) return;
    const fps = this.perfFrames / this.perfAcc;
    this.perfAcc = 0;
    this.perfFrames = 0;
    if (fps < 53 && this.dynScale > 0.55) {
      this.dynScale = Math.max(0.55, this.dynScale - 0.15);
      this.perfGood = 0;
      this.resize();
    } else if (fps > 58.5 && this.dynScale < 1) {
      this.perfGood += 1.25;
      if (this.perfGood >= 6) {
        this.perfGood = 0;
        this.dynScale = Math.min(1, this.dynScale + 0.1);
        this.resize();
      }
    } else this.perfGood = 0;
  }

  update(dt: number): void {
    this.adaptResolution(dt);
    const p = G.player;
    const mw = G.game.mouseWorld();
    const lookX = p.x + (mw.x - p.x) * 0.12;
    const lookY = p.y - 18 + (mw.y - p.y) * 0.1;
    const k = 1 - Math.exp(-dt * 7);
    this.cam.x = lerp(this.cam.x, lookX, k);
    this.cam.y = lerp(this.cam.y, lookY, k);
    if (this.cam.pulse > 0) {
      this.cam.pulse -= dt;
      this.cam.pulseZ = lerp(this.cam.pulseZ, this.cam.pulse > 0.25 ? 1.14 : 1, 1 - Math.exp(-dt * 12));
    } else this.cam.pulseZ = lerp(this.cam.pulseZ, 1, 1 - Math.exp(-dt * 8));
    this.clampCam();
    const w = G.world;
    if (!G.game.paused) footsteps([p, ...w.party, ...w.vanguard, ...w.adventurers, ...w.monsters.filter((m) => !m.def.flying && Math.abs(m.x - p.x) < 500)], w.map, dt);
    const sh = fx.shakeAmt;
    this.cam.sx = sh > 0 ? (Math.random() - 0.5) * sh * 2 : 0;
    this.cam.sy = sh > 0 ? (Math.random() - 0.5) * sh * 2 : 0;
  }

  private push(k: number, f: number, o: unknown, a = 0, b = 0): void {
    let e = this.dl[this.dlN];
    if (!e) {
      e = { k, f, o, a, b };
      this.dl[this.dlN] = e;
    } else {
      e.k = k;
      e.f = f;
      e.o = o;
      e.a = a;
      e.b = b;
    }
    this.dlN++;
  }

  // ---------------------------------------------------------------- frame

  render(t: number): void {
    const ctx = this.ctx;
    const world = G.world;
    const m = world.map;
    const R = REALMS[m.realm];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = m.kind === 'dungeon' || m.kind === 'abyss' ? '#05070d' : R.palette.liquid === 'void' ? R.palette.sky : '#0b0f1a';
    ctx.fillRect(0, 0, this.w, this.h);
    const s = this.zoomScale;
    const ox = Math.round(-this.cam.x * s + this.w / 2 + this.cam.sx * s);
    const oy = Math.round(-this.cam.y * s + this.h / 2 + this.cam.sy * s);
    ctx.setTransform(s, 0, 0, s, ox, oy);
    const vw = this.w / s;
    const vh = this.h / s;
    const x0 = Math.max(0, Math.floor((this.cam.x - vw / 2) / TILE) - 1);
    const x1 = Math.min(m.w - 1, Math.ceil((this.cam.x + vw / 2) / TILE) + 1);
    const y0 = Math.max(0, Math.floor((this.cam.y - vh / 2) / TILE) - 1);
    const y1 = Math.min(m.h - 1, Math.ceil((this.cam.y + vh / 2) / TILE) + 4);
    const frame = Math.floor(t * 4) % 4;
    // ---- ground (baked chunks + animated liquids)
    drawGround(ctx, m, x0, y0, x1, y1, frame, s);
    const lift = m.hasElev ? (x: number, y: number) => m.liftAt(x, y) * ELEV_H : () => 0;
    this.lift = lift;
    // ---- ground decals, footprints, pads / fishing / dig sites
    this.drawDecals(ctx, t);
    drawPrints(ctx);
    drawGroundFeatures(ctx, m, t, lift);
    // ---- sorted pass (only walls that can overlap actors take part)
    this.dlN = 0;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const i = ty * m.w + tx;
        if (m.solid[i] === SOL.WALL && !bakedWall(m, i)) this.push((ty + 1) * TILE, 0, null, tx, ty);
      }
    }
    const left = this.cam.x - vw / 2 - 120;
    const right = this.cam.x + vw / 2 + 120;
    const top = this.cam.y - vh / 2 - 60;
    const bottom = this.cam.y + vh / 2 + 220;
    const inView = (x: number, y: number): boolean => x > left && x < right && y > top && y < bottom;
    for (const p of m.props) if (!p.hidden && inView(p.x, p.y)) this.push(p.y + p.sortOff, 1, p);
    for (const n of m.nodes) if (inView(n.x, n.y)) this.push(n.y, 2, n);
    const p = G.player;
    const actors: Actor[] = [
      p, ...world.party.filter((c) => !c.dead), ...world.vanguard.filter((v) => !v.dead), ...world.adventurers, ...world.shadows,
      ...world.breakables, ...(world.caravan ? [world.caravan] : []), ...world.monsters, ...world.npcs,
    ];
    // v3: long sun / moon shadows and swaying grass sit on the ground under every sprite
    drawCastShadows(ctx, actors, m.props, lift, inView);
    drawGrass(ctx, m, x0, y0, x1, Math.min(m.h - 1, y1 - 3), t, [p, ...world.party, ...world.adventurers, ...world.monsters], lift);
    for (const a of actors) if (inView(a.x, a.y) && !a.removed) this.push(a.y + 0.5, 3, a);
    for (const pr of world.projectiles) if (inView(pr.x, pr.y)) this.push(pr.y + 1, 4, pr);
    for (const l of world.loots) if (inView(l.x, l.y)) this.push(l.y, 5, l);
    if (world.pet && inView(world.pet.x, world.pet.y)) this.push(world.pet.y + 2, 7, world.pet);
    if (m.hasElev) {
      // plateau rims that overlap lower ground to the north are re-drawn in sorted order
      for (let ty = Math.max(1, y0); ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const i = ty * m.w + tx;
          if (m.elev[i] === ELEV.PLATEAU && m.elev[i - m.w] === ELEV.GROUND) this.push(ty * TILE + 0.25, 6, null, tx, ty);
        }
      }
    }
    const list = this.dl;
    const n = this.dlN;
    const sorted = list.slice(0, n).sort((a, b) => a.k - b.k);
    for (const e of sorted) {
      switch (e.f) {
        case 0:
          this.drawWall(ctx, m, e.a, e.b);
          break;
        case 1: {
          const pr = e.o as Prop;
          const L = lift(pr.x, pr.y);
          if (L) ctx.translate(0, -L);
          this.drawProp(ctx, pr, t);
          if (L) ctx.translate(0, L);
          break;
        }
        case 2: {
          const n = e.o as ResourceNode;
          const L = lift(n.x, n.y);
          if (L) ctx.translate(0, -L);
          this.drawNode(ctx, n, t);
          if (L) ctx.translate(0, L);
          break;
        }
        case 3: {
          const a = e.o as Actor;
          const L = lift(a.x, a.y);
          if (L) ctx.translate(0, -L);
          this.drawActor(ctx, a, t);
          if (L) ctx.translate(0, L);
          break;
        }
        case 4:
          this.drawProjectile(ctx, e.o as Projectile, t);
          break;
        case 5: {
          const l = e.o as LootInst;
          const L = lift(l.x, l.y);
          if (L) ctx.translate(0, -L);
          this.drawLoot(ctx, l, t);
          if (L) ctx.translate(0, L);
          break;
        }
        case 6:
          ctx.drawImage(groundTile(m.realm, m.ground[e.b * m.w + e.a], Math.floor(hash2(e.a, e.b, 7) * 4), 0), e.a * TILE, e.b * TILE - ELEV_H, TILE, TILE);
          break;
        case 7: {
          const pet = e.o as Pet;
          const L = lift(pet.x, pet.y);
          if (L) ctx.translate(0, -L);
          drawPet(ctx, pet, t);
          if (L) ctx.translate(0, L);
          break;
        }
      }
    }
    drawCloudShadows(ctx, m, t, this.cam.x, this.cam.y, vw, vh);
    // ---- day/night lighting (multiply), then emissive overlays so skills glow in the dark
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawLighting(ctx, t, x0, x1, y0, y1);
    ctx.setTransform(s, 0, 0, s, ox, oy);
    for (const tl of world.teles) this.drawTele(ctx, tl, t);
    this.drawBeams(ctx, t);
    fx.drawWorld(ctx);
    this.drawRains(ctx);
    this.drawLabels(ctx, actors);
    fx.drawNumbers(ctx);
    // ---- screen space: foreground canopy (1.18x parallax), god-rays, weather
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawForeground(ctx, this.w, this.h, s, this.cam.x, this.cam.y, t);
    weather.draw(ctx, this, t);
  }

  // ---------------------------------------------------------------- pieces

  private drawWall(ctx: CanvasRenderingContext2D, m: GameMap, tx: number, ty: number): void {
    const i = ty * m.w + tx;
    const v = Math.floor(hash2(tx, ty, 3) * 4);
    const depth = m.wallStyle === 'dungeon' || m.wallStyle === 'interior' ? m.wdepth[i] : 0;
    ctx.drawImage(wallTop(m.realm, m.wallStyle, Math.min(3, depth), v), tx * TILE, ty * TILE - WALL_H, TILE, TILE);
    const south = ty + 1 < m.h ? m.solid[i + m.w] : SOL.WALL;
    if (south !== SOL.WALL) ctx.drawImage(wallFace(m.realm, m.wallStyle, v + tx), tx * TILE, (ty + 1) * TILE - WALL_H, TILE, WALL_H);
  }

  private drawProp(ctx: CanvasRenderingContext2D, p: Prop, t: number): void {
    const m = G.world.map;
    const spr = propSprite(p, m.realm);
    let dy = 0;
    if (p.kind === 'crystal') dy = Math.sin(t * 2.2) * 3;
    ctx.drawImage(spr, p.x - p.ax, p.y - p.ay + dy, p.sw, p.sh);
    if (p.kind === 'gate' || p.kind === 'abyssgate') {
      const col = p.kind === 'gate' ? '#7fe9ff' : '#a970ff';
      const cx = p.x;
      const cy = p.y - p.ay + (p.kind === 'gate' ? 86 : 74);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 3);
      ctx.drawImage(glowSprite(col), cx - 40, cy - 50, 80, 100);
      ctx.strokeStyle = rgba('#ffffff', 0.55);
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, 24 - i * 7, 32 - i * 9, 0, t * (1.5 + i) + i, t * (1.5 + i) + i + 2.2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    } else if (p.kind === 'crystal') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6 + 0.2 * Math.sin(t * 4);
      ctx.drawImage(glowSprite('#7fe9ff'), p.x - 30, p.y - p.ay + dy - 4, 60, 70);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    } else if (p.kind === 'torch' || (p.kind === 'building' && p.data?.type === 'forge')) {
      if (Math.random() < 0.08 && !G.game.paused) fx.particle(p.x + (p.kind === 'torch' ? 0 : p.sw / 2 - 28), p.y - (p.kind === 'torch' ? 30 : p.sh - 10), { z: 0, vy: -30, vx: (Math.random() - 0.5) * 10, max: 1.2, size: p.kind === 'torch' ? 2 : 6, color: p.kind === 'torch' ? '#ffb35c' : '#8a8a8a', kind: p.kind === 'torch' ? 'ember' : 'smoke', drag: 0.4 });
    } else if (p.kind === 'furniture') this.drawMounts(ctx, p, t);
  }

  private drawMounts(ctx: CanvasRenderingContext2D, p: Prop, t: number): void {
    const kind = String(p.data?.kind);
    if (kind !== 'rack' && kind !== 'mannequin') return;
    const house = G.save.houses[G.world.map.realm];
    const f = house?.furniture[Number(p.data?.index)];
    if (!f) return;
    if (kind === 'rack') {
      f.mounts.forEach((g, i) => {
        if (!g) return;
        const v = visOf(g);
        if (!v) return;
        ctx.save();
        ctx.translate(p.x - p.sw / 2 + 18 + i * ((p.sw - 30) / 2), p.y - 8);
        ctx.rotate(-Math.PI / 2);
        drawWeapon(ctx, v, t);
        ctx.restore();
      });
    } else {
      const items = [0, 1, 2, 3, 4].map((i) => visOf(f.mounts[i] ?? null));
      drawHumanoid(ctx, p.x, p.y - 2, mannequinLook(items), previewAnim(0), 0, { aim: Math.PI / 2, moving: false, vx: 0, vy: 0, t: 0, shadow: false });
    }
  }

  private drawNode(ctx: CanvasRenderingContext2D, n: ResourceNode, t: number): void {
    const col = itemDef(n.item).color;
    if (n.kind === 'ore') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(n.x, n.y + 2, 15, 5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = n.ready ? '#6e6a70' : '#4a474c';
      ctx.beginPath();
      ctx.moveTo(n.x - 15, n.y + 2);
      ctx.lineTo(n.x - 11, n.y - 14);
      ctx.lineTo(n.x - 1, n.y - 22);
      ctx.lineTo(n.x + 11, n.y - 15);
      ctx.lineTo(n.x + 15, n.y + 2);
      ctx.closePath();
      ctx.fill();
      if (n.ready) {
        for (const [dx, dy, r] of [[-6, -10, 4], [4, -14, 5], [6, -5, 3], [-2, -4, 3]] as [number, number, number][]) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(n.x + dx, n.y + dy - r);
          ctx.lineTo(n.x + dx + r * 0.8, n.y + dy);
          ctx.lineTo(n.x + dx, n.y + dy + r * 0.7);
          ctx.lineTo(n.x + dx - r * 0.8, n.y + dy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = rgba('#ffffff', 0.6);
          ctx.fillRect(n.x + dx - 1, n.y + dy - r * 0.6, 1.4, 1.4);
        }
        if (ORE_GLOW.has(n.item)) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 2 + n.id);
          ctx.drawImage(glowSprite(col), n.x - 20, n.y - 30, 40, 36);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(n.x, n.y + 1, 9, 3, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = n.ready ? '#3f8a3a' : '#5a5a4a';
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.quadraticCurveTo(n.x + i * 3, n.y - 8, n.x + i * 5 + Math.sin(t * 2 + i) * 1.5, n.y - (n.ready ? 14 : 5));
        ctx.stroke();
      }
      if (n.ready) {
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(n.x - 6 + i * 6, n.y - 14 - (i % 2) * 3, 3, 0, TAU);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25;
        ctx.drawImage(glowSprite(col), n.x - 14, n.y - 26, 28, 24);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  private drawActor(ctx: CanvasRenderingContext2D, a: Actor, t: number): void {
    if (a.kind === 'prop') {
      drawBreakable(ctx, a as Breakable, t);
      return;
    }
    if (a.kind === 'caravan') {
      drawCaravan(ctx, a as Caravan, t);
      return;
    }
    if (a.kind === 'shadow') {
      const sh = a as Shadow;
      const k = sh.run.done ? Math.max(0, 1 - sh.fade / 0.35) : 1;
      drawHumanoid(ctx, sh.x, sh.y, { ...sh.look, ghost: true, aura: '#7fe9ff' }, sh.anim, sh.dir, { aim: sh.aim, moving: false, vx: 0, vy: 0, t, z: sh.z, alpha: 0.6 * k, shadow: false });
      drawBladeTrail(ctx, sh.anim, '#7fe9ff', 0);
      return;
    }
    if (a instanceof Monster && a.def.id === 'ev_gate') {
      drawEventGate(ctx, a.x, a.y, t, a.hp / a.stats.maxHp);
      return;
    }
    if (a instanceof Monster) {
      drawMonster(ctx, a, t);
      if (!a.dead && !a.isBoss && (a.hpBarT > 0 || a.isElite) && a.spawnT <= 0) this.drawHpBar(ctx, a);
      return;
    }
    if (a instanceof Npc) {
      drawHumanoid(ctx, a.x, a.y, a.look, a.anim, a.dir, { aim: a.aim, moving: a.moving, vx: a.vx, vy: a.vy, t });
      return;
    }
    if (a.kind === 'player') {
      const p = G.player;
      if (p.dead && p.deathT > 0.5) return;
      const blink = p.iframes > 1.6 && !p.dead ? (Math.floor(t * 20) % 2 ? 0.35 : 0.9) : 1;
      if (p.dead) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glowSprite('#7fe9ff'), p.x - 24, p.y - 56, 48, 60);
        ctx.globalCompositeOperation = 'source-over';
      }
      const M = p.mounted;
      const seatH = M ? (M.kind === 'drake' || M.kind === 'gryphon' ? 20 : 16) : 0;
      if (M) drawMount(ctx, p.x, p.y, M, p.dir, p.anim.walk, false);
      drawHumanoid(ctx, p.x, p.y - seatH, p.look, p.anim, p.dir, { aim: p.aim, moving: p.moving && !M, vx: p.vx, vy: p.vy, t, blocking: p.blocking, flash: p.flash, z: p.z, barrier: p.barrier, alpha: blink * (p.dead ? 1 - p.deathT * 1.6 : 1), seated: !!M, shadow: !M });
      if (M) drawMount(ctx, p.x, p.y, M, p.dir, p.anim.walk, true);
      drawBladeTrail(ctx, p.anim, p.weaponColor, 0);
      if (p.parryFlash > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = p.parryFlash * 3;
        ctx.drawImage(glowSprite('#bff3ff'), p.x - 30, p.y - 60, 60, 66);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      return;
    }
    if (a.kind === 'companion') {
      const c = a as Companion;
      drawHumanoid(ctx, c.x, c.y, c.look, c.anim, c.dir, { aim: c.aim, moving: c.moving, vx: c.vx, vy: c.vy, t, blocking: c.guard, flash: c.flash, z: c.z, barrier: c.barrier, alpha: c.iframes > 0.9 && c.st !== 'chain' ? 0.7 : 1 });
      drawBladeTrail(ctx, c.anim, c.def.colors.glow, 0);
      const ring = c.role === 'adventurer' ? ((c as Adventurer).dueling ? '#ff5d6c' : '#5ee6a0') : c.role === 'vanguard' ? '#ffd27a' : c.def.colors.glow;
      ctx.strokeStyle = rgba(ring, 0.6);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + 1, 13, 5, 0, 0, TAU);
      ctx.stroke();
    }
  }

  private drawHpBar(ctx: CanvasRenderingContext2D, m: Monster): void {
    const w = m.isElite ? 46 : 30;
    const x = m.x - w / 2;
    const y = m.y - m.height() - (m.def.flying ? 16 : 0) - 10;
    ctx.fillStyle = 'rgba(5,8,18,0.75)';
    ctx.fillRect(x - 1, y - 1, w + 2, 6);
    ctx.fillStyle = m.isElite ? '#ff9a3d' : '#ff4d5e';
    ctx.fillRect(x, y, w * clamp(m.hp / m.stats.maxHp, 0, 1), 3);
    if (m.brkMax > 0 && (m.brk > 0 || m.broken > 0)) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x, y + 3.2, w * (m.broken > 0 ? 1 : m.brk / m.brkMax), 1.6);
    }
    if (m.shield > 0) {
      ctx.fillStyle = '#9fdcff';
      ctx.fillRect(x, y - 2, w * (m.shield / Math.max(1, m.shieldMax)), 1.5);
    }
  }

  private drawLabels(ctx: CanvasRenderingContext2D, actors: Actor[]): void {
    const p = G.player;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const title = G.save.title;
    if (title && !p.dead) {
      const ty = p.y - 62 - this.lift(p.x, p.y) - (p.mounted ? 16 : 0) - p.z;
      ctx.font = '700 8px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(5,8,18,0.85)';
      ctx.strokeText(`< ${title} >`, p.x, ty);
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`< ${title} >`, p.x, ty);
    }
    for (const a of actors) {
      if (a.dead || a === p) continue;
      const lifted = this.lift(a.x, a.y);
      if (a instanceof Monster && Object.keys(a.gauges).length && a.spawnT <= 0) {
        const gs = Object.keys(a.gauges) as GaugeKind[];
        const gy = a.y - a.height() - (a.def.flying ? 16 : 0) - 18 - lifted;
        gs.forEach((g, i) => {
          const gx = a.x + (i - (gs.length - 1) / 2) * 9;
          ctx.fillStyle = GAUGE_COLORS[g];
          ctx.beginPath();
          ctx.moveTo(gx, gy - 4);
          ctx.lineTo(gx + 3.5, gy);
          ctx.lineTo(gx, gy + 4);
          ctx.lineTo(gx - 3.5, gy);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(5,8,18,0.8)';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }
      let label = '';
      let color = '#e6edf7';
      let y = a.y - 54 - lifted;
      if (a instanceof Npc) {
        if (Math.hypot(a.x - p.x, a.y - p.y) > 150) continue;
        label = a.displayName;
        color = a.spawn.role === 'companion' ? '#7fe9ff' : '#ffe9b0';
      } else if (a instanceof Monster) {
        if ((!a.isElite && !a.raid && a.def.id !== 'ev_gate') || a.spawnT > 0) continue;
        label = `${a.def.name}  Lv.${a.level}`;
        color = a.raid ? '#ff5d6c' : a.def.id === 'ev_gate' ? '#c9a8ff' : '#ff9a3d';
        y = a.y - a.height() - (a.def.flying ? 16 : 0) - 14 - lifted;
      } else if (a.kind === 'companion') {
        const c = a as Companion;
        label = a.displayName;
        color = c.role === 'adventurer' ? '#5ee6a0' : c.role === 'vanguard' ? '#ffd27a' : '#7fe9ff';
        if (c.role === 'adventurer') {
          const adv = c as Adventurer;
          if (Math.hypot(a.x - p.x, a.y - p.y) > 260 && !adv.helpNeeded) continue;
          if (adv.bubbleT > 0) {
            ctx.font = '600 9px "Trebuchet MS", "Segoe UI", sans-serif';
            const bw = ctx.measureText(adv.bubble).width + 10;
            ctx.fillStyle = 'rgba(245,248,255,0.92)';
            ctx.beginPath();
            ctx.roundRect(a.x - bw / 2, y - 30, bw, 14, 5);
            ctx.fill();
            ctx.fillStyle = '#1a2340';
            ctx.fillText(adv.bubble, a.x, y - 18);
          }
          if (adv.helpNeeded) {
            ctx.font = '900 16px "Trebuchet MS", "Segoe UI", sans-serif';
            ctx.fillStyle = Math.floor(G.realTime * 4) % 2 ? '#ff9a3d' : '#ffd166';
            ctx.fillText('!', a.x, y - 32);
          }
        }
      }
      if (!label) continue;
      ctx.font = '700 9px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(5,8,18,0.85)';
      ctx.strokeText(label, a.x, y);
      ctx.fillStyle = color;
      ctx.fillText(label, a.x, y);
      if (a instanceof Npc && a.spawn.role !== 'villager' && a.spawn.role !== 'guard') {
        ctx.font = '8px "Trebuchet MS", "Segoe UI", sans-serif';
        const role = a.spawn.role === 'companion' ? 'Recruitable Companion' : a.spawn.role;
        ctx.strokeText(role.charAt(0).toUpperCase() + role.slice(1), a.x, y - 10);
        ctx.fillStyle = '#aab6c8';
        ctx.fillText(role.charAt(0).toUpperCase() + role.slice(1), a.x, y - 10);
      }
    }
  }

  private drawDecals(ctx: CanvasRenderingContext2D, t: number): void {
    const world = G.world;
    for (const z of world.zones) {
      const s = z.spec;
      const k = Math.min(1, z.t / 0.25) * (z.t > s.dur - 0.4 ? (s.dur - z.t) / 0.4 : 1);
      ctx.globalAlpha = 0.22 * k;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.85 * k;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.stroke();
      if (s.kind === 'vortex' || s.kind === 'sanctuary') {
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          const r = s.r * (0.3 + i * 0.22);
          const a0 = (s.kind === 'vortex' ? -t * 3 : t) + i * 2;
          ctx.arc(s.x, s.y, r, a0, a0 + 1.8);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (s.kind === 'citadel') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 * k;
        ctx.drawImage(glowSprite(s.color, 0.8), s.x - s.r, s.y - s.r * 1.2, s.r * 2, s.r * 1.6);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    for (const tr of world.traps) {
      ctx.strokeStyle = rgba('#ffb35c', 0.7 + 0.3 * Math.sin(t * 6));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, 18, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        ctx.beginPath();
        ctx.moveTo(tr.x + Math.cos(a) * 10, tr.y + Math.sin(a) * 10);
        ctx.lineTo(tr.x + Math.cos(a) * 18, tr.y + Math.sin(a) * 18);
        ctx.stroke();
      }
    }
    for (const pr of world.projectiles) {
      if (pr.spec.kind !== 'meteor') continue;
      const k = Math.min(1, pr.t / 0.6);
      const r = pr.spec.aoe ?? 80;
      ctx.strokeStyle = rgba('#ff7a3d', 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = rgba('#ff7a3d', 0.25);
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, r * k, 0, TAU);
      ctx.fill();
    }
    for (const l of world.loots) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(l.x, l.y + 2, l.kind === 'chest' ? 14 : 8, 4, 0, 0, TAU);
      ctx.fill();
    }
  }

  private drawTele(ctx: CanvasRenderingContext2D, tl: TeleInst, t: number): void {
    const s = tl.shape;
    const k = Math.min(1, tl.t / tl.dur);
    if (tl.beam && s.kind === 'line') {
      ctx.save();
      ctx.translate(s.x, s.y - 16);
      ctx.rotate(s.a);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.85;
      ctx.drawImage(glowSprite(tl.color), 0, -s.w, s.len, s.w * 2);
      ctx.fillStyle = rgba('#ffffff', 0.85);
      ctx.fillRect(0, -s.w * 0.18, s.len, s.w * 0.36);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      return;
    }
    const pulse = 0.85 + 0.15 * Math.sin(t * 18);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = rgba(tl.color, 0.85 * pulse);
    const base = rgba(tl.color, 0.12);
    const fill = rgba(tl.color, 0.3 + 0.15 * k);
    switch (s.kind) {
      case 'circle':
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * k, 0, TAU);
        ctx.fill();
        break;
      case 'ring':
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.arc(s.x, s.y, s.inner, 0, TAU, true);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.inner + (s.r - s.inner) * k, 0, TAU);
        ctx.arc(s.x, s.y, s.inner, 0, TAU, true);
        ctx.fill();
        break;
      case 'cone':
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.arc(s.x, s.y, s.r, s.a - s.arc / 2, s.a + s.arc / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.arc(s.x, s.y, s.r * k, s.a - s.arc / 2, s.a + s.arc / 2);
        ctx.closePath();
        ctx.fill();
        break;
      case 'line':
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.a);
        ctx.fillStyle = base;
        ctx.fillRect(0, -s.w / 2, s.len, s.w);
        ctx.strokeRect(0, -s.w / 2, s.len, s.w);
        ctx.fillStyle = fill;
        ctx.fillRect(0, -s.w / 2, s.len * k, s.w);
        ctx.restore();
        break;
    }
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, pr: Projectile, t: number): void {
    const c = pr.color;
    const x = pr.x;
    const y = pr.y - pr.z;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(pr.x, pr.y, 4, 2, 0, 0, TAU);
    ctx.fill();
    switch (pr.spec.kind) {
      case 'arrow':
      case 'feather':
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(pr.ang);
        ctx.strokeStyle = '#d8c8a8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(6, 0);
        ctx.stroke();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(6, -2.5);
        ctx.lineTo(11, 0);
        ctx.lineTo(6, 2.5);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-12, -2, 4, 1.2);
        ctx.fillRect(-12, 0.8, 4, 1.2);
        ctx.restore();
        if (pr.spec.pierce) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(glowSprite(c), x - 14, y - 8, 28, 16);
          ctx.globalCompositeOperation = 'source-over';
        }
        break;
      case 'rock':
        ctx.fillStyle = '#8a8f99';
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, TAU);
        ctx.fill();
        break;
      case 'icelance':
      case 'shard':
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(pr.ang);
        ctx.fillStyle = rgba('#dff6ff', 0.95);
        ctx.beginPath();
        ctx.moveTo(-14, -3);
        ctx.lineTo(12, 0);
        ctx.lineTo(-14, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glowSprite('#7fe9ff'), x - 16, y - 12, 32, 24);
        ctx.globalCompositeOperation = 'source-over';
        break;
      case 'meteor': {
        const r = 10 + (1 - pr.z / 320) * 4;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glowSprite('#ff7a3d'), x - r * 3, y - r * 3, r * 6, r * 6);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.6, 0, TAU);
        ctx.fill();
        break;
      }
      default: {
        const r = pr.spec.kind === 'fireball' ? 7 : pr.spec.kind === 'orb' ? 6 : pr.spec.kind === 'holy' ? 6 : 4.5;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glowSprite(c), x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = mix(c, '#ffffff', 0.55);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.55 + Math.sin(t * 20) * 0.4, 0, TAU);
        ctx.fill();
      }
    }
  }

  private drawLoot(ctx: CanvasRenderingContext2D, l: LootInst, t: number): void {
    const col = RARITY_COLORS[l.rarity] ?? '#ffffff';
    if (l.kind === 'chest') {
      const x = l.x;
      const y = l.y;
      ctx.fillStyle = '#6b4224';
      ctx.fillRect(x - 13, y - 16, 26, 16);
      ctx.fillStyle = l.opened ? '#3a2414' : '#8a5a32';
      if (l.opened) ctx.fillRect(x - 13, y - 28, 26, 8);
      else ctx.fillRect(x - 14, y - 22, 28, 9);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 13, y - 16, 26, 16);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x - 2, y - 16, 4, 5);
      if (l.opened) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.max(0, 1 - l.t / 3);
        ctx.drawImage(glowSprite('#ffd166'), x - 20, y - 40, 40, 40);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      return;
    }
    const y = l.y - l.z - Math.sin(t * 3 + l.id) * 2;
    ctx.save();
    ctx.translate(l.x, y);
    ctx.rotate(Math.sin(t * 2 + l.id) * 0.2);
    ctx.fillStyle = rgba(col, 0.9);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  private drawBeams(ctx: CanvasRenderingContext2D, t: number): void {
    ctx.globalCompositeOperation = 'lighter';
    for (const l of G.world.loots) {
      if (l.kind === 'chest' && l.opened) continue;
      const col = RARITY_COLORS[l.rarity] ?? '#ffffff';
      const h = 70 + l.rarity * 30;
      const a = 0.35 + 0.12 * Math.sin(t * 3 + l.id);
      ctx.globalAlpha = a;
      ctx.drawImage(glowSprite(col, 0.9), l.x - 7, l.y - h, 14, h + 6);
      ctx.globalAlpha = a * 0.8;
      ctx.drawImage(glowSprite(col), l.x - 16, l.y - 14, 32, 22);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawRains(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = rgba('#ffe0a0', 0.9);
    ctx.lineWidth = 1.6;
    for (const r of G.world.rains) {
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#ffe0a0';
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (const d of r.drops) {
        const k = d.t / 0.22;
        const yy = d.y - 200 * (1 - k);
        ctx.beginPath();
        ctx.moveTo(d.x + 30 * (1 - k), yy - 16);
        ctx.lineTo(d.x + 30 * (1 - k) - 4, yy);
        ctx.stroke();
      }
    }
  }

  // ---------------------------------------------------------------- lighting

  darkness(): { d: number; color: string } {
    const m = G.world.map;
    const h = G.save.time;
    let night = 0;
    if (h >= 20 || h < 5) night = 1;
    else if (h >= 17) night = (h - 17) / 3;
    else if (h < 7) night = (7 - h) / 2;
    let d = 0;
    let color = '#1a2348';
    if (m.kind === 'dungeon' || m.kind === 'abyss') {
      d = m.dark;
      color = m.kind === 'abyss' ? '#1a1030' : '#121628';
    } else if (m.kind === 'house') {
      d = m.dark + night * 0.35;
      color = '#2a1c18';
    } else {
      d = night * 0.64;
      if (h >= 17 && h < 20) color = mix('#ff8a5a', '#1a2348', night);
      else if (h >= 5 && h < 7) color = mix('#ffb38a', '#1a2348', night);
      const w = G.world.weather;
      if (w === 'rain' || w === 'storm') d = Math.max(d, 0.22) + 0.08;
      if (w === 'ash') {
        d = Math.max(d, 0.18);
        color = mix(color, '#6a3020', 0.4);
      }
    }
    if (G.world.lightning > 0) d *= 1 - G.world.lightning;
    return { d: clamp(d, 0, 0.88), color };
  }

  private drawLighting(ctx: CanvasRenderingContext2D, t: number, x0: number, x1: number, y0: number, y1: number): void {
    const { d, color } = this.darkness();
    if (d < 0.02) return;
    const L = this.lctx;
    const lw = this.light.width;
    const lh = this.light.height;
    L.globalCompositeOperation = 'source-over';
    L.fillStyle = mix('#ffffff', color, d);
    L.fillRect(0, 0, lw, lh);
    L.globalCompositeOperation = 'lighter';
    const s = this.zoomScale / 2;
    const sx = (x: number) => (x - this.cam.x) * s + lw / 2;
    const sy = (y: number) => (y - this.cam.y) * s + lh / 2;
    const light = (x: number, y: number, r: number, col: string, a = 1) => {
      const px = sx(x);
      const py = sy(y);
      const rr = r * s;
      if (px < -rr || py < -rr || px > lw + rr || py > lh + rr) return;
      L.globalAlpha = a;
      L.drawImage(glowSprite(col, 0.55), px - rr, py - rr, rr * 2, rr * 2);
    };
    const m = G.world.map;
    for (const p of m.props) {
      if (!p.light) continue;
      const fl = p.light.flicker ? 0.9 + 0.1 * Math.sin(t * 13 + p.id * 1.7) : 1;
      light(p.x, p.y + (p.light.oy ?? 0), p.light.r * fl, p.light.color, 0.95);
    }
    const p = G.player;
    light(p.x, p.y - 20, m.kind === 'dungeon' || m.kind === 'abyss' ? 150 : 95, '#ffe9c8', 0.75);
    if (p.look?.main && (p.look.main.temper >= 6 || p.look.main.gem)) light(p.x, p.y - 20, 60, p.look.main.gem ?? p.look.main.glow, 0.6);
    for (const c of G.world.party) if (!c.dead) light(c.x, c.y - 20, 70, '#ffe9c8', 0.45);
    for (const v of G.world.vanguard) if (!v.dead) light(v.x, v.y - 20, 60, '#ffd27a', 0.4);
    if (G.world.pet) light(G.world.pet.x, G.world.pet.y - G.world.pet.z, 55, G.world.pet.def.color, 0.6);
    for (const pd of m.pads) light(pd.x, pd.y, 40, '#7fe9ff', 0.4);
    for (const b of G.world.breakables) if (b.variant === 'barrel' || b.variant === 'frost') light(b.x, b.y - 10, 36, b.variant === 'barrel' ? '#ff7a3d' : '#7fe9ff', 0.4);
    for (const pr of G.world.projectiles) if (pr.spec.kind !== 'arrow' && pr.spec.kind !== 'rock') light(pr.x, pr.y - pr.z, 46, pr.color, 0.8);
    for (const z of G.world.zones) light(z.spec.x, z.spec.y, z.spec.r, z.spec.color, 0.45);
    for (const l of G.world.loots) if (!(l.kind === 'chest' && l.opened)) light(l.x, l.y - 20, 45, RARITY_COLORS[l.rarity] ?? '#ffffff', 0.7);
    for (const n of m.nodes) if (n.ready && ORE_GLOW.has(n.item)) light(n.x, n.y - 10, 50, itemDef(n.item).color, 0.6);
    for (const mo of G.world.monsters) if (mo.def.draw === 'wisp' || mo.def.draw === 'imp' || mo.def.element === 'fire') light(mo.x, mo.y - 20, 60, mo.def.colors[2] ?? '#ffb35c', 0.6);
    if (REALMS[m.realm].palette.liquid === 'lava') {
      let count = 0;
      for (let ty = y0; ty <= y1 && count < 140; ty += 2) {
        for (let tx = x0; tx <= x1 && count < 140; tx += 2) {
          if (m.ground[ty * m.w + tx] === GT.LIQUID) {
            light(tx * TILE + 16, ty * TILE + 16, 60, '#ff7a3d', 0.5);
            count++;
          }
        }
      }
    }
    L.globalAlpha = 1;
    L.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.light, 0, 0, this.w, this.h);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- minimap

  minimap(): HTMLCanvasElement {
    const m = G.world.map;
    if (m.minimap && this.minimapFor === m) return m.minimap;
    const c = document.createElement('canvas');
    c.width = m.w;
    c.height = m.h;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    const img = g.createImageData(m.w, m.h);
    for (let i = 0; i < m.w * m.h; i++) {
      let col = minimapColor(m.realm, m.ground[i], m.solid[i], m.wallStyle);
      if (m.hasElev && m.elev[i] === ELEV.PLATEAU) col = shade(col, 0.18);
      else if (m.hasElev && m.elev[i] === ELEV.STAIRS) col = '#c9b48a';
      else if (m.ground[i] === GT.BRIDGE) col = '#8a5a32';
      else if (m.ground[i] === GT.SHALLOW) col = '#6fb8e8';
      const n = parseInt(col.slice(1), 16);
      img.data[i * 4] = (n >> 16) & 255;
      img.data[i * 4 + 1] = (n >> 8) & 255;
      img.data[i * 4 + 2] = n & 255;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    m.minimap = c;
    this.minimapFor = m;
    return c;
  }
}
