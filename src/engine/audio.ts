// Fully synthesized audio: every sound effect and the adaptive music are generated with
// the Web Audio API at runtime (zero audio files).
import type { SfxName } from '../types/game';

type Wave = OscillatorType;

interface Track {
  bpm: number;
  root: number;
  minor: boolean;
  prog: number[];
  arp: number[];
  drums: number;
  pad: Wave;
  lead: Wave;
  arpVol: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private noiseBuf!: AudioBuffer;
  private last = new Map<string, number>();
  private vol = { master: 0.8, music: 0.5, sfx: 0.8 };
  private track: Track | null = null;
  private trackKey = '';
  private step = 0;
  private nextNoteTime = 0;
  private timer: number | null = null;

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(comp);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(comp);
    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.vol = { master, music, sfx };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.sfxGain.gain.value = this.vol.sfx;
    this.musicGain.gain.setTargetAtTime(this.vol.music * 0.55, this.ctx.currentTime, 0.4);
  }

  // ---------------------------------------------------------------- primitives

  private tone(f: number, dur: number, type: Wave, vol: number, o: { delay?: number; to?: number; attack?: number; out?: AudioNode; lp?: number } = {}): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + (o.delay ?? 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    const a = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = osc;
    if (o.lp) {
      const f2 = c.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.value = o.lp;
      osc.connect(f2);
      node = f2;
    }
    node.connect(g);
    g.connect(o.out ?? this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, type: BiquadFilterType, f: number, o: { delay?: number; to?: number; q?: number; out?: AudioNode; attack?: number } = {}): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + (o.delay ?? 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(f, t);
    if (o.to) filt.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + dur);
    filt.Q.value = o.q ?? 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(o.out ?? this.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // ---------------------------------------------------------------- effects

  play(name: SfxName, vol = 1): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const now = c.currentTime;
    const minGap = name === 'hit' || name === 'swing' || name === 'swing2' ? 0.035 : 0.02;
    if (now - (this.last.get(name) ?? -1) < minGap) return;
    this.last.set(name, now);
    const v = vol;
    switch (name) {
      case 'swing':
        this.noise(0.13, 0.22 * v, 'bandpass', 900, { to: 3200, q: 1.4 });
        break;
      case 'swing2':
        this.noise(0.11, 0.2 * v, 'bandpass', 1600, { to: 4600, q: 1.6 });
        break;
      case 'hit':
        this.noise(0.09, 0.32 * v, 'lowpass', 2200, { to: 500 });
        this.tone(150, 0.11, 'sine', 0.38 * v, { to: 60 });
        break;
      case 'crit':
        this.noise(0.1, 0.36 * v, 'lowpass', 3000, { to: 600 });
        this.tone(170, 0.14, 'sine', 0.42 * v, { to: 55 });
        this.tone(1760, 0.14, 'triangle', 0.14 * v, { delay: 0.01 });
        this.tone(2637, 0.12, 'triangle', 0.1 * v, { delay: 0.03 });
        break;
      case 'parry':
        for (const [f, d] of [[1240, 0.6], [1863, 0.5], [2731, 0.4], [3611, 0.3]]) this.tone(f, d, 'triangle', 0.1 * v);
        this.tone(620, 0.3, 'square', 0.05 * v, { lp: 2000 });
        this.noise(0.06, 0.3 * v, 'highpass', 4000);
        break;
      case 'block':
        this.tone(320, 0.09, 'square', 0.1 * v, { to: 180, lp: 1400 });
        this.noise(0.07, 0.25 * v, 'bandpass', 900, { q: 2 });
        break;
      case 'chime':
        this.tone(1318.5, 0.28, 'sine', 0.13 * v);
        this.tone(1975.5, 0.32, 'sine', 0.1 * v, { delay: 0.035 });
        this.tone(2637, 0.2, 'sine', 0.05 * v, { delay: 0.07 });
        break;
      case 'shatter':
        for (let i = 0; i < 9; i++) this.tone(2000 + Math.random() * 3200, 0.07 + Math.random() * 0.16, 'sine', 0.06 * v, { delay: Math.random() * 0.25 });
        this.noise(0.32, 0.12 * v, 'highpass', 6000, { to: 9000 });
        this.tone(988, 0.4, 'triangle', 0.06 * v, { delay: 0.05 });
        break;
      case 'levelup':
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.14 * v, { delay: i * 0.075 }));
        break;
      case 'switch':
        this.noise(0.35, 0.22 * v, 'bandpass', 400, { to: 4000, q: 2 });
        [440, 659.25, 880].forEach((f, i) => this.tone(f, 0.45, 'sawtooth', 0.06 * v, { delay: 0.08 + i * 0.03, lp: 2400 }));
        this.tone(1760, 0.3, 'sine', 0.08 * v, { delay: 0.2 });
        break;
      case 'break':
        this.tone(95, 0.55, 'sine', 0.6 * v, { to: 38 });
        this.noise(0.45, 0.35 * v, 'lowpass', 900, { to: 120 });
        [392, 493.88, 587.33].forEach((f) => this.tone(f, 0.5, 'square', 0.04 * v, { delay: 0.05, lp: 1800 }));
        break;
      case 'ui':
        this.tone(880, 0.045, 'square', 0.035 * v, { lp: 3000 });
        break;
      case 'uiBack':
        this.tone(620, 0.06, 'square', 0.035 * v, { to: 420, lp: 3000 });
        break;
      case 'coin':
        this.tone(1567.98, 0.08, 'square', 0.04 * v, { lp: 4000 });
        this.tone(2093, 0.14, 'square', 0.04 * v, { delay: 0.06, lp: 4000 });
        break;
      case 'anvil':
        for (const [f, d] of [[523, 0.7], [1061, 0.55], [1602, 0.45], [2390, 0.3]]) this.tone(f, d, 'triangle', 0.12 * v);
        this.noise(0.04, 0.4 * v, 'highpass', 3000);
        break;
      case 'arrow':
        this.noise(0.16, 0.18 * v, 'bandpass', 2600, { to: 700, q: 3 });
        this.tone(950, 0.08, 'sine', 0.06 * v, { to: 300 });
        break;
      case 'magic':
        [660, 990, 1320, 1760].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.07 * v, { delay: i * 0.04 }));
        this.noise(0.3, 0.06 * v, 'highpass', 5000);
        break;
      case 'fire':
        this.noise(0.45, 0.3 * v, 'lowpass', 600, { to: 2400, attack: 0.05 });
        this.tone(110, 0.4, 'sawtooth', 0.06 * v, { to: 60, lp: 600 });
        break;
      case 'ice':
        this.tone(2400, 0.22, 'triangle', 0.08 * v);
        this.tone(3150, 0.18, 'triangle', 0.06 * v, { delay: 0.02 });
        this.noise(0.22, 0.1 * v, 'highpass', 5200);
        break;
      case 'thunder':
        this.noise(1.1, 0.55 * v, 'lowpass', 1400, { to: 90, attack: 0.01 });
        this.tone(60, 0.9, 'sine', 0.35 * v, { to: 30 });
        break;
      case 'heal':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.45, 'sine', 0.09 * v, { delay: i * 0.06, attack: 0.04 }));
        break;
      case 'hurt':
        this.tone(230, 0.13, 'square', 0.09 * v, { to: 110, lp: 1200 });
        this.noise(0.08, 0.2 * v, 'lowpass', 1200);
        break;
      case 'death':
        this.tone(320, 0.9, 'sawtooth', 0.12 * v, { to: 55, lp: 1200 });
        this.noise(0.8, 0.12 * v, 'lowpass', 800, { to: 100 });
        break;
      case 'dodge':
        this.noise(0.17, 0.18 * v, 'bandpass', 900, { to: 300, q: 1.2 });
        break;
      case 'pickup':
        this.tone(987.77, 0.07, 'square', 0.04 * v, { lp: 4000 });
        this.tone(1318.5, 0.1, 'square', 0.04 * v, { delay: 0.05, lp: 4000 });
        break;
      case 'boot':
        this.tone(440, 0.06, 'sine', 0.1 * v);
        break;
      case 'bootOk':
        this.tone(880, 0.07, 'sine', 0.1 * v);
        this.tone(1320, 0.07, 'sine', 0.06 * v, { delay: 0.03 });
        break;
      case 'engage':
        this.noise(0.6, 0.25 * v, 'bandpass', 300, { to: 6000, q: 1.5 });
        [261.63, 392, 523.25, 659.25, 1046.5].forEach((f, i) => this.tone(f, 0.9, 'sawtooth', 0.045 * v, { delay: 0.12 + i * 0.02, lp: 3200, attack: 0.04 }));
        this.tone(2093, 0.6, 'sine', 0.08 * v, { delay: 0.25 });
        break;
      case 'door':
        this.noise(0.25, 0.18 * v, 'lowpass', 500, { to: 150 });
        this.tone(130, 0.2, 'triangle', 0.08 * v, { to: 90 });
        break;
      case 'quake':
        this.tone(62, 0.6, 'sine', 0.55 * v, { to: 28 });
        this.noise(0.5, 0.35 * v, 'lowpass', 400, { to: 80 });
        break;
      case 'roar':
        this.tone(150, 0.7, 'sawtooth', 0.14 * v, { to: 80, lp: 900, attack: 0.05 });
        this.noise(0.6, 0.2 * v, 'bandpass', 500, { to: 200, q: 0.8 });
        break;
      case 'error':
        this.tone(220, 0.1, 'square', 0.05 * v, { lp: 1500 });
        this.tone(165, 0.14, 'square', 0.05 * v, { delay: 0.1, lp: 1500 });
        break;
      case 'craft':
        [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.09 * v, { delay: i * 0.06 }));
        break;
      case 'awaken':
        [261.63, 329.63, 392, 493.88, 523.25, 659.25, 783.99, 987.77].forEach((f, i) => this.tone(f, 1.4, 'sine', 0.06 * v, { delay: i * 0.05, attack: 0.08 }));
        this.noise(1.2, 0.08 * v, 'highpass', 6000, { attack: 0.3 });
        break;
      case 'splash':
        this.noise(0.28, 0.2 * v, 'bandpass', 1300, { to: 500, q: 1.5 });
        break;
      case 'beam':
        this.tone(220, 0.35, 'sawtooth', 0.12 * v, { to: 990, lp: 2600 });
        this.noise(0.35, 0.18 * v, 'bandpass', 1500, { to: 5000 });
        break;
      case 'wind':
        this.noise(0.42, 0.18 * v, 'bandpass', 500, { to: 1600, q: 1.2, attack: 0.08 });
        break;
      case 'buff':
        this.tone(660, 0.22, 'sine', 0.1 * v, { to: 990 });
        this.tone(1320, 0.2, 'sine', 0.05 * v, { delay: 0.08 });
        break;
      case 'teleport':
        this.tone(400, 0.55, 'sine', 0.12 * v, { to: 1600 });
        [1046.5, 1318.5, 1567.98].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.05 * v, { delay: 0.2 + i * 0.07 }));
        break;
      case 'gather':
        this.tone(1200, 0.05, 'triangle', 0.06 * v);
        this.noise(0.05, 0.15 * v, 'highpass', 2500);
        break;
      case 'telegraph':
        this.tone(196, 0.12, 'square', 0.025 * v, { lp: 900 });
        break;
    }
  }

  // ---------------------------------------------------------------- music

  /** harmonic drop chord for rare loot: richer and brighter with every rarity step */
  chord(rarity: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - (this.last.get('chord') ?? -1) < 0.25) return;
    this.last.set('chord', now);
    const roots = [0, 0, 523.25, 587.33, 659.25, 783.99];
    const base = roots[Math.min(5, rarity)] || 523.25;
    const steps = rarity >= 5 ? [0, 4, 7, 11, 14, 19] : rarity >= 4 ? [0, 4, 7, 12, 16] : rarity >= 3 ? [0, 4, 7, 12] : [0, 7, 12];
    steps.forEach((st, i) => {
      const f = base * Math.pow(2, st / 12);
      this.tone(f, 1.1 + rarity * 0.15, 'triangle', 0.07, { delay: i * 0.055, attack: 0.01 });
      this.tone(f * 2, 0.6, 'sine', 0.025, { delay: i * 0.055 + 0.02 });
    });
    if (rarity >= 4) this.tone(base * 4, 1.6, 'sine', 0.03, { delay: 0.3, attack: 0.2 });
  }

  setMusic(kind: string, realmRoot = 62, minor = false): void {
    const key = `${kind}:${realmRoot}:${minor}`;
    if (key === this.trackKey) return;
    this.trackKey = key;
    const tracks: Record<string, Track> = {
      title: { bpm: 70, root: 62, minor: false, prog: [0, 5, 3, 4], arp: [0, 2, 4, 2, 7, 4, 2, 4], drums: 0, pad: 'sine', lead: 'triangle', arpVol: 0.05 },
      city: { bpm: 84, root: realmRoot, minor, prog: [0, 3, 4, 0, 5, 3, 1, 4], arp: [0, 2, 4, 7, 4, 2, 4, 2], drums: 0, pad: 'triangle', lead: 'triangle', arpVol: 0.045 },
      wild: { bpm: 100, root: realmRoot, minor, prog: [0, 5, 3, 4], arp: [0, 4, 2, 4, 7, 4, 2, 4], drums: 1, pad: 'triangle', lead: 'square', arpVol: 0.03 },
      dungeon: { bpm: 90, root: realmRoot - 2, minor: true, prog: [0, 5, 6, 4], arp: [0, -1, 2, -1, 4, -1, 2, 7], drums: 1, pad: 'sawtooth', lead: 'triangle', arpVol: 0.04 },
      boss: { bpm: 142, root: realmRoot - 5, minor: true, prog: [0, 5, 6, 4, 0, 3, 6, 4], arp: [0, 4, 7, 4, 0, 4, 7, 9], drums: 2, pad: 'sawtooth', lead: 'square', arpVol: 0.035 },
      abyss: { bpm: 118, root: 57, minor: true, prog: [0, 6, 5, 4], arp: [0, 2, 4, 7, 9, 7, 4, 2], drums: 2, pad: 'sawtooth', lead: 'square', arpVol: 0.03 },
      arena: { bpm: 128, root: 60, minor: false, prog: [0, 4, 5, 3], arp: [0, 4, 7, 4, 2, 4, 7, 9], drums: 2, pad: 'square', lead: 'square', arpVol: 0.03 },
      house: { bpm: 66, root: realmRoot, minor: false, prog: [0, 3, 0, 4], arp: [0, 2, 4, 2, 0, 2, 4, 7], drums: 0, pad: 'sine', lead: 'sine', arpVol: 0.04 },
    };
    this.track = tracks[kind] ?? tracks.city;
    this.step = 0;
    if (this.ctx) this.nextNoteTime = this.ctx.currentTime + 0.1;
  }

  private chordNotes(t: Track, degree: number): number[] {
    const sc = t.minor ? MINOR : MAJOR;
    const n = (deg: number): number => {
      const oct = Math.floor(deg / 7);
      const idx = ((deg % 7) + 7) % 7;
      return t.root + sc[idx] + 12 * oct;
    };
    return [n(degree), n(degree + 2), n(degree + 4), n(degree + 7)];
  }

  private schedule(): void {
    const c = this.ctx;
    const t = this.track;
    if (!c || !t || c.state !== 'running' || this.vol.music <= 0.001) return;
    const sixteenth = 60 / t.bpm / 4;
    if (this.nextNoteTime < c.currentTime - 0.5) this.nextNoteTime = c.currentTime + 0.05;
    while (this.nextNoteTime < c.currentTime + 0.25) {
      const time = this.nextNoteTime;
      const s = this.step;
      const bar = Math.floor(s / 16);
      const chord = this.chordNotes(t, t.prog[bar % t.prog.length]);
      const delay = Math.max(0, time - c.currentTime);
      const out = this.musicGain;
      if (s % 16 === 0) {
        for (let i = 0; i < 3; i++) this.tone(mtof(chord[i] - 12), sixteenth * 16 * 0.98, t.pad, 0.035, { delay, attack: 0.35, out, lp: 1100 });
        this.tone(mtof(chord[0] - 24), sixteenth * 7, 'triangle', 0.09, { delay, attack: 0.02, out });
      }
      if (s % 16 === 8 && t.drums > 0) this.tone(mtof(chord[0] - 24), sixteenth * 7, 'triangle', 0.08, { delay, attack: 0.02, out });
      if (s % 2 === 0) {
        const pi = t.arp[(s / 2) % t.arp.length];
        if (pi >= 0) {
          const scale = t.minor ? MINOR : MAJOR;
          const extra = pi >= 4 ? 12 : 0;
          const note = pi < 4 ? chord[pi % 4] : chord[0] + scale[pi % 7] + extra - scale[0];
          this.tone(mtof(note + 12), sixteenth * 1.8, t.lead, t.arpVol, { delay, attack: 0.01, out, lp: 3500 });
        }
      }
      if (t.drums > 0) {
        if (s % 8 === 0) this.tone(140, 0.18, 'sine', 0.22, { delay, to: 45, out });
        if (t.drums > 1 && s % 8 === 4) this.noise(0.12, 0.08, 'bandpass', 1800, { delay, out, q: 0.8 });
        if (s % 2 === 0) this.noise(0.03, t.drums > 1 ? 0.035 : 0.02, 'highpass', 7000, { delay, out });
      }
      this.nextNoteTime += sixteenth;
      this.step++;
    }
  }

  dispose(): void {
    if (this.timer) window.clearInterval(this.timer);
  }
}

export const audio = new AudioEngine();
