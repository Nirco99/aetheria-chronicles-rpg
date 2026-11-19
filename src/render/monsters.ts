// Procedural monster renderer: 17 archetypes, walk cycles, attack windup glows, stun stars,
// spawn fade-ins, hit flashes and the crimson pre-shatter outline.
import type { Monster } from '../entities/monster';
import { drawHumanoid } from './paperdoll';
import { glowSprite } from './glow';
import { rgba, shade, TAU } from '../engine/util';
import { G } from '../core/state';
import { fx } from './fx';

type C = CanvasRenderingContext2D;

function ell(g: C, x: number, y: number, rx: number, ry: number, c: string, rot = 0): void {
  g.fillStyle = c;
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  g.fill();
}

function tri(g: C, a: [number, number], b: [number, number], c2: [number, number], col: string): void {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.lineTo(c2[0], c2[1]);
  g.closePath();
  g.fill();
}

function legs(g: C, xs: number[], y: number, len: number, ph: number, col: string, w = 3): void {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.lineCap = 'round';
  xs.forEach((x, i) => {
    const s = Math.sin(ph + (i % 2 ? Math.PI : 0)) * 3;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + s, y + len);
    g.stroke();
  });
}

function eyes(g: C, x: number, y: number, col: string, n = 1, gap = 4): void {
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) g.drawImage(glowSprite(col), x + i * gap - 4, y - 4, 8, 8);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) g.fillRect(x + i * gap - 0.8, y - 0.8, 1.6, 1.6);
}

function drawWolf(g: C, m: Monster, ph: number, k: number): void {
  const [main, dark, acc] = m.def.colors;
  legs(g, [-9, -5, 7, 11], -8, 8, ph, dark, 3.2);
  g.strokeStyle = main;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-13, -14);
  g.quadraticCurveTo(-22, -20 - Math.sin(ph) * 2, -24, -10);
  g.stroke();
  ell(g, 0, -13, 14, 7, main);
  ell(g, 0, -10, 12, 3, shade(main, 0.2));
  ell(g, 13, -17 - k * 2, 7, 6, main);
  tri(g, [17, -19 - k * 2], [26, -15 - k * 2], [17, -13 - k * 2], main);
  tri(g, [10, -21], [12, -28], [15, -21], dark);
  if (m.isElite) for (let i = 0; i < 5; i++) tri(g, [-10 + i * 4, -19], [-8 + i * 4, -27], [-6 + i * 4, -19], acc);
  eyes(g, 16, -18 - k * 2, acc);
}

function drawBoar(g: C, m: Monster, ph: number, k: number): void {
  const [main, dark, acc] = m.def.colors;
  legs(g, [-10, -5, 6, 11], -7, 7, ph, dark, 4);
  ell(g, 0, -14, 17, 10, main);
  for (let i = 0; i < 6; i++) tri(g, [-12 + i * 4, -22], [-10 + i * 4, -28], [-8 + i * 4, -22], dark);
  ell(g, 15, -12 - k, 8, 7, main);
  ell(g, 21, -10 - k, 3.5, 3, shade(main, 0.2));
  g.strokeStyle = acc;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(19, -8 - k);
  g.quadraticCurveTo(24, -10, 23, -16);
  g.stroke();
  eyes(g, 16, -15 - k, '#ff3b3b');
}

function drawKobold(g: C, m: Monster, ph: number, k: number, t: number): void {
  const [main, dark, acc] = m.def.colors;
  const boss = m.isBoss;
  legs(g, [-3, 3], -10, 9, ph, dark, 3.5);
  g.strokeStyle = main;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-5, -11);
  g.quadraticCurveTo(-12, -8, -14, -14 + Math.sin(t * 4) * 2);
  g.stroke();
  ell(g, 0, -17, 7, 9, main);
  ell(g, 0, -15, 5, 5, shade(main, 0.15));
  if (m.def.id !== 'kobold_scout') {
    g.fillStyle = acc;
    g.fillRect(-6, -22, 12, 8);
  }
  ell(g, 2, -30, 7, 6, main);
  tri(g, [6, -31], [13, -28], [6, -26], main);
  tri(g, [-3, -34], [-6, -42], [1, -35], dark);
  tri(g, [3, -35], [6, -43], [7, -34], dark);
  if (boss) {
    g.fillStyle = '#ffd166';
    for (let i = 0; i < 3; i++) tri(g, [-4 + i * 4, -35], [-2 + i * 4, -41], [0 + i * 4, -35], '#ffd166');
  }
  eyes(g, 6, -31, '#ff3b3b');
  // weapon
  const swing = m.st === 'attack' ? Math.sin(m.anim.swing * Math.PI) * 1.6 - 0.6 : 0.4;
  g.save();
  g.translate(7, -19);
  g.rotate(-1.1 + swing + k * 0.4);
  if (m.def.id === 'kobold_scout') {
    g.strokeStyle = '#6b4a2f';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(12, 0);
    g.stroke();
    ell(g, 13, 0, 2.5, 2.5, '#8a8f99');
  } else if (boss && m.variant === 1) {
    g.fillStyle = '#5a3a24';
    g.fillRect(-4, -1.5, 8, 3);
    g.fillStyle = '#d8dde6';
    g.beginPath();
    g.moveTo(4, -4);
    g.lineTo(34, -6);
    g.lineTo(38, 0);
    g.lineTo(34, 4);
    g.lineTo(4, 3);
    g.fill();
    g.fillStyle = rgba('#ff3b3b', 0.6);
    g.fillRect(8, -1, 26, 1.5);
  } else if (boss) {
    g.strokeStyle = '#5a3a24';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(22, 0);
    g.stroke();
    g.fillStyle = '#b8bec8';
    g.beginPath();
    g.moveTo(16, -2);
    g.quadraticCurveTo(26, -10, 28, 0);
    g.quadraticCurveTo(26, 10, 16, 2);
    g.fill();
  } else {
    g.strokeStyle = '#6b4a2f';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-6, 0);
    g.lineTo(26, 0);
    g.stroke();
    tri(g, [26, -3], [33, 0], [26, 3], '#b8bec8');
    if (m.def.id === 'kobold_sentinel') tri(g, [20, -2], [24, -9], [27, -2], '#b8bec8');
  }
  g.restore();
  if (boss && m.variant === 0) {
    ell(g, -8, -18, 6, 7, '#8a6238');
    g.strokeStyle = '#c9a46e';
    g.lineWidth = 1.2;
    g.beginPath();
    g.ellipse(-8, -18, 6, 7, 0, 0, TAU);
    g.stroke();
  }
}

function drawTreant(g: C, m: Monster, ph: number, k: number, t: number): void {
  const [main, leaf, acc] = m.def.colors;
  g.strokeStyle = shade(main, -0.2);
  g.lineWidth = 4;
  for (const dx of [-6, 0, 6]) {
    g.beginPath();
    g.moveTo(dx, -8);
    g.quadraticCurveTo(dx * 1.6 + Math.sin(ph + dx) * 2, -2, dx * 2, 0);
    g.stroke();
  }
  g.fillStyle = main;
  g.beginPath();
  g.moveTo(-10, -6);
  g.lineTo(-8, -36);
  g.lineTo(8, -36);
  g.lineTo(10, -6);
  g.closePath();
  g.fill();
  g.strokeStyle = rgba('#000000', 0.3);
  g.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(i * 4, -8);
    g.lineTo(i * 4 + 1, -34);
    g.stroke();
  }
  const arm = Math.sin(t * 2) * 0.2 + (m.st === 'attack' ? -0.8 * m.anim.swing : 0);
  g.strokeStyle = main;
  g.lineWidth = 4;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 8, -30);
    g.lineTo(s * 20, -36 + arm * 10 * s);
    g.lineTo(s * 26, -26 + arm * 8);
    g.stroke();
  }
  for (const [x, y, r] of [[-12, -44, 10], [10, -46, 11], [0, -52, 12], [-20, -36, 7], [21, -38, 7]] as [number, number, number][]) ell(g, x, y - k * 2, r, r * 0.85, shade(leaf, -0.1));
  for (const [x, y, r] of [[-12, -46, 7], [10, -48, 8], [0, -54, 8]] as [number, number, number][]) ell(g, x, y - k * 2, r, r * 0.8, leaf);
  eyes(g, -3, -28, acc, 2, 6);
  if (m.isBoss) {
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.3 + 0.15 * Math.sin(t * 2);
    g.drawImage(glowSprite('#b07acc'), -26, -60, 52, 60);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}

function drawSpider(g: C, m: Monster, ph: number, k: number): void {
  const [main, dark, acc] = m.def.colors;
  g.strokeStyle = dark;
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const a = Math.sin(ph * 1.5 + i + (s > 0 ? Math.PI : 0)) * 2;
      g.beginPath();
      g.moveTo(-2 + i * 3, -9);
      g.quadraticCurveTo(-2 + i * 4 + s * 4, -18, -6 + i * 6 + s * 2 + a, -1 - s * 1.5);
      g.stroke();
    }
  }
  ell(g, -8, -11, 10, 8, main);
  ell(g, -9, -14, 6, 3, rgba(acc, 0.6));
  ell(g, 6, -10 - k, 7, 6, shade(main, -0.1));
  eyes(g, 9, -12 - k, acc, 2, 3);
}

function drawElemental(g: C, m: Monster, t: number): void {
  const [main, dark, acc] = m.def.colors;
  const w = Math.sin(t * 3) * 1.5;
  g.globalAlpha *= 0.85;
  ell(g, 0, -14, 12 + w, 15 - w, rgba(dark, 0.85));
  ell(g, 0, -16, 10 - w, 12 + w, rgba(main, 0.85));
  ell(g, -3, -21, 4, 3, rgba(acc, 0.8));
  g.globalAlpha /= 0.85;
  g.strokeStyle = rgba(acc, 0.6);
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(0, -15, 7, t * 3, t * 3 + 3.5);
  g.stroke();
  eyes(g, -3, -17, '#ffffff', 2, 6);
}

function drawSporeling(g: C, m: Monster, ph: number, t: number): void {
  const [main, dark, acc] = m.def.colors;
  if (m.healer) {
    ell(g, 0, -10, 9, 10 + Math.sin(t * 4), main);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(glowSprite(main), -16, -26, 32, 32);
    g.globalCompositeOperation = 'source-over';
    ell(g, 0, -12, 4, 4, '#ffffff');
    return;
  }
  legs(g, [-2, 2], -6, 6, ph, dark, 2.5);
  ell(g, 0, -8, 5, 5, shade(acc, -0.3));
  ell(g, 0, -15, 11, 7, main);
  for (const [x, y] of [[-5, -17], [3, -19], [6, -14]]) ell(g, x, y, 1.8, 1.5, acc);
  eyes(g, -2, -9, '#ffffff', 2, 4);
}

function drawDrake(g: C, m: Monster, ph: number, k: number, t: number): void {
  const [main, dark, acc] = m.def.colors;
  legs(g, [-9, -4, 6, 10], -6, 6, ph, dark, 3.5);
  g.strokeStyle = main;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(-12, -12);
  g.quadraticCurveTo(-24, -10, -30, -4 + Math.sin(t * 3) * 3);
  g.stroke();
  ell(g, 0, -12, 14, 8, main);
  ell(g, 0, -8, 11, 3, acc);
  tri(g, [-6, -18], [-16, -30 + Math.sin(t * 4) * 3], [4, -18], dark);
  g.strokeStyle = main;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(9, -14);
  g.quadraticCurveTo(14, -24, 17, -26 - k * 2);
  g.stroke();
  ell(g, 20, -27 - k * 2, 7, 5, main);
  tri(g, [19, -31 - k * 2], [15, -38 - k * 2], [22, -31 - k * 2], dark);
  eyes(g, 22, -28 - k * 2, acc);
  if (m.st === 'attack') {
    g.globalCompositeOperation = 'lighter';
    g.drawImage(glowSprite(acc), 18, -38, 20, 20);
    g.globalCompositeOperation = 'source-over';
  }
}

function drawGolem(g: C, m: Monster, ph: number, k: number, t: number): void {
  const [main, dark, acc] = m.def.colors;
  g.fillStyle = dark;
  g.fillRect(-9, -12, 7, 12 + Math.sin(ph) * 1.5);
  g.fillRect(3, -12, 7, 12 - Math.sin(ph) * 1.5);
  g.fillStyle = main;
  g.fillRect(-13, -38, 26, 26);
  g.fillRect(-8, -50 - k, 16, 13);
  const arm = m.st === 'attack' ? -m.anim.swing * 10 : Math.sin(t * 2) * 1.5;
  g.fillRect(-21, -36 + arm, 8, 22);
  g.fillRect(13, -36 + arm, 8, 22);
  g.strokeStyle = rgba(acc, 0.85);
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(-8, -34);
  g.lineTo(-2, -26);
  g.lineTo(-6, -18);
  g.moveTo(6, -36);
  g.lineTo(2, -28);
  g.stroke();
  eyes(g, -3, -45 - k, acc, 2, 6);
}

function drawImp(g: C, m: Monster, t: number): void {
  const [main, dark, acc] = m.def.colors;
  const f = Math.sin(t * 16) * 5;
  tri(g, [-3, -18], [-16, -26 + f], [-6, -12], dark);
  tri(g, [3, -18], [16, -26 + f], [6, -12], dark);
  ell(g, 0, -16, 6, 7, main);
  ell(g, 0, -25, 5, 5, main);
  tri(g, [-3, -28], [-5, -34], [-1, -29], acc);
  tri(g, [3, -28], [5, -34], [1, -29], acc);
  g.globalCompositeOperation = 'lighter';
  g.drawImage(glowSprite('#ff7a3d'), -10, -28, 20, 20);
  g.globalCompositeOperation = 'source-over';
  eyes(g, -2, -25, acc, 2, 4);
}

function drawWyvern(g: C, m: Monster, t: number, k: number): void {
  const [main, dark, acc] = m.def.colors;
  const f = Math.sin(t * 7) * 10;
  g.fillStyle = shade(main, -0.15);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(-2, -20);
    g.lineTo(s * 30, -34 + f * (s > 0 ? 1 : 0.9));
    g.lineTo(s * 24, -18 + f * 0.4);
    g.lineTo(s * 12, -14);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = main;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-8, -18);
  g.quadraticCurveTo(-20, -12, -26, -20 + Math.sin(t * 3) * 3);
  g.stroke();
  ell(g, 0, -18, 11, 6, main);
  ell(g, 12, -24 - k * 2, 6, 4.5, main);
  tri(g, [12, -28], [8, -34], [15, -27], dark);
  eyes(g, 14, -25 - k * 2, acc);
}

function drawWraith(g: C, m: Monster, t: number): void {
  const [main, dark, acc] = m.def.colors;
  g.globalAlpha *= 0.85;
  g.fillStyle = rgba(main, 0.85);
  g.beginPath();
  g.moveTo(-10, -30);
  g.quadraticCurveTo(0, -42, 10, -30);
  g.lineTo(12, -6);
  for (let i = 0; i <= 4; i++) g.lineTo(12 - i * 6, -6 + (i % 2 ? -4 : 2) + Math.sin(t * 6 + i) * 2);
  g.closePath();
  g.fill();
  g.globalAlpha /= 0.85;
  ell(g, 0, -32, 7, 6, dark);
  eyes(g, -2, -32, acc, 2, 4);
}

function drawAutomaton(g: C, m: Monster, t: number): void {
  const [main, gold, eye] = m.def.colors;
  g.strokeStyle = rgba(gold, 0.85);
  g.lineWidth = 1.6;
  g.beginPath();
  g.ellipse(0, -22, 16, 5, t * 0.8, 0, TAU);
  g.stroke();
  g.beginPath();
  g.ellipse(0, -22, 13, 4, -t * 1.1 + 1, 0, TAU);
  g.stroke();
  g.fillStyle = main;
  g.beginPath();
  g.moveTo(0, -38);
  g.lineTo(10, -22);
  g.lineTo(0, -6);
  g.lineTo(-10, -22);
  g.closePath();
  g.fill();
  g.strokeStyle = gold;
  g.stroke();
  for (const s of [-1, 1]) {
    g.fillStyle = gold;
    g.beginPath();
    g.moveTo(s * 10, -26);
    g.lineTo(s * 20, -32 + Math.sin(t * 3) * 2);
    g.lineTo(s * 14, -20);
    g.fill();
  }
  eyes(g, 0, -24, eye);
}

function drawWisp(g: C, m: Monster, t: number): void {
  const [main] = m.def.colors;
  g.globalCompositeOperation = 'lighter';
  const r = 10 + Math.sin(t * 9) * 2;
  g.drawImage(glowSprite(main), -r * 1.6, -22 - r * 1.6, r * 3.2, r * 3.2);
  g.globalCompositeOperation = 'source-over';
  ell(g, 0, -22, 4, 4, '#ffffff');
}

function drawReaver(g: C, m: Monster, ph: number, t: number): void {
  const [main, dark, acc] = m.def.colors;
  legs(g, [-3, 3], -10, 10, ph, dark, 3);
  g.fillStyle = main;
  g.beginPath();
  g.moveTo(-8, -10);
  g.lineTo(-6, -30);
  g.quadraticCurveTo(0, -38, 8, -30);
  g.lineTo(9, -10);
  g.closePath();
  g.fill();
  const sw = m.st === 'attack' ? Math.sin(m.anim.swing * Math.PI) * 1.4 : Math.sin(t * 2) * 0.15;
  g.strokeStyle = acc;
  g.lineWidth = 2;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 7, -26);
    g.quadraticCurveTo(s * 20, -34 - sw * 6 * s, s * 24, -14 + sw * 4);
    g.stroke();
  }
  eyes(g, -2, -30, acc, 2, 5);
}

function drawWyrm(g: C, m: Monster, t: number, k: number): void {
  const [main, dark, acc] = m.def.colors;
  for (let i = 6; i >= 1; i--) {
    const x = -i * 9;
    const y = -12 + Math.sin(t * 2 + i * 0.8) * 5;
    ell(g, x, y, 13 - i * 0.8, 10 - i * 0.6, i % 2 ? main : shade(main, -0.12));
    if (m.armored) {
      g.strokeStyle = rgba('#ffd08a', 0.6);
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y - 3, 8 - i * 0.5, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
  }
  ell(g, 6, -26 - k * 3, 15, 12, main);
  ell(g, 18, -24 - k * 3, 10, 7, shade(main, 0.08));
  tri(g, [0, -34 - k * 3], [-8, -50 - k * 3], [6, -36 - k * 3], dark);
  tri(g, [8, -36 - k * 3], [6, -52 - k * 3], [14, -36 - k * 3], dark);
  g.strokeStyle = rgba(acc, 0.9);
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-4, -22);
  g.lineTo(4, -16);
  g.lineTo(-2, -10);
  g.stroke();
  eyes(g, 16, -28 - k * 3, acc);
  if (!m.armored || m.broken > 0) {
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.45;
    g.drawImage(glowSprite('#ff7a3d'), -40, -40, 70, 50);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}

export function drawMonster(g: C, m: Monster, t: number): void {
  const def = m.def;
  const baseSize: Record<string, number> = { wolf: 13, boar: 15, kobold: 11, treant: 17, spider: 13, elemental: 14, sporeling: 11, drake: 16, golem: 19, imp: 10, wyvern: 16, wraith: 13, automaton: 15, wisp: 9, reaver: 13, wyrm: 16, humanoid: 12 };
  const s = def.draw === 'humanoid' ? 1 : def.size / (baseSize[def.draw] ?? def.size);
  const lift = def.flying ? 12 + Math.sin(t * 3 + m.bob) * 3 : 0;
  const x = m.x;
  const y = m.y;
  const fadeIn = m.spawnT > 0 ? 1 - m.spawnT / 0.45 : 1;
  const alpha = fadeIn;
  // shadow
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(x, y + 1, def.size * 1.0 * (def.draw === 'humanoid' ? (m.look?.scale ?? 1) : 1), def.size * 0.38, 0, 0, TAU);
  g.fill();
  if (m.spawnT > 0) {
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = (1 - fadeIn) * 0.8;
    g.drawImage(glowSprite('#bfe6ff'), x - 24, y - 50, 48, 56);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
  if (m.dead && m.dying > 0) {
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.9;
    g.drawImage(glowSprite('#ff2a40'), x - def.size * 2.6, y - m.height() - 8, def.size * 5.2, m.height() + 20);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
  if (def.draw === 'humanoid' && m.look) {
    drawHumanoid(g, x, y, m.look, m.anim, m.dir, { aim: m.aim, moving: m.moving, vx: m.vx, vy: m.vy, t, alpha, flash: m.flash, z: m.z + lift, blocking: m.frontGuard && m.broken <= 0 });
  } else {
    const facingLeft = Math.cos(m.aim) < 0;
    g.save();
    g.translate(x, y - m.z - lift);
    g.scale(facingLeft ? -s : s, s);
    g.globalAlpha = alpha;
    const ph = m.anim.walk;
    const windup = m.st === 'attack' ? Math.min(1, m.anim.swing * 2) : 0;
    const k = m.st === 'attack' ? Math.sin(m.anim.swing * Math.PI) : 0;
    switch (def.draw) {
      case 'wolf': drawWolf(g, m, ph, k); break;
      case 'boar': drawBoar(g, m, ph, k); break;
      case 'kobold': drawKobold(g, m, ph, k, t); break;
      case 'treant': drawTreant(g, m, ph, k, t); break;
      case 'spider': drawSpider(g, m, ph, k); break;
      case 'elemental': drawElemental(g, m, t); break;
      case 'sporeling': drawSporeling(g, m, ph, t); break;
      case 'drake': drawDrake(g, m, ph, k, t); break;
      case 'golem': drawGolem(g, m, ph, k, t); break;
      case 'imp': drawImp(g, m, t); break;
      case 'wyvern': drawWyvern(g, m, t, k); break;
      case 'wraith': drawWraith(g, m, t); break;
      case 'automaton': drawAutomaton(g, m, t); break;
      case 'wisp': drawWisp(g, m, t); break;
      case 'reaver': drawReaver(g, m, ph, t); break;
      case 'wyrm': drawWyrm(g, m, t, k); break;
      default: ell(g, 0, -12, 10, 10, def.colors[0]);
    }
    if (windup > 0) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = windup * 0.5;
      g.drawImage(glowSprite('#ff3b3b'), -20, -40, 40, 40);
      g.globalCompositeOperation = 'source-over';
    }
    if (m.flash > 0) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = Math.min(1, m.flash * 7);
      g.drawImage(glowSprite('#ffffff'), -20, -44, 40, 46);
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
    g.globalAlpha = 1;
  }
  // shield bubble (Arcane-Shielded)
  if (m.shield > 0) {
    g.strokeStyle = rgba('#9fdcff', 0.5 + 0.2 * Math.sin(t * 5));
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(x, y - m.height() * 0.45 - lift, def.size * 1.5, m.height() * 0.6, 0, 0, TAU);
    g.stroke();
  }
  // stun / break stars
  if ((m.broken > 0 || m.has('stun') || m.has('freeze')) && !m.dead) {
    const hy = y - m.height() - lift - 6;
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * TAU) / 3;
      g.fillStyle = m.broken > 0 ? '#ffd166' : m.has('freeze') ? '#bff3ff' : '#fff4c2';
      g.beginPath();
      g.arc(x + Math.cos(a) * 12, hy + Math.sin(a) * 4, 2.2, 0, TAU);
      g.fill();
    }
  }
  if (m.has('freeze')) {
    g.fillStyle = rgba('#bff3ff', 0.35);
    g.beginPath();
    g.ellipse(x, y - m.height() * 0.45, def.size * 1.3, m.height() * 0.55, 0, 0, TAU);
    g.fill();
  }
  if (!m.dead && (m.has('burn') || m.has('poison')) && Math.random() < 0.25 && !G.game.paused) {
    fx.particle(x + (Math.random() - 0.5) * def.size, y - Math.random() * m.height() * 0.6, { z: 6, vz: 40, max: 0.5, size: 2.5, color: m.has('burn') ? '#ff7a3d' : '#9be15d', kind: 'ember', drag: 1 });
  }
}
