// The Mastery Matrix: 6 branches x (5 active Sword Skills + 3 passives) = 48 skills,
// plus the three Unique Skill Awakenings. Each active skill is a timeline script run by
// the skill executor (src/systems/skills.ts) for the player and companions alike.
import type { ActiveSkillDef, AwakeningDef, Branch, PassiveSkillDef, SkillAPI } from '../types/game';

const PI = Math.PI;
/** forward-frame point (fx ahead, fy to the side) -> [angle relative to aim, radius] */
const P = (fx: number, fy: number): [number, number] => [Math.atan2(fy, fx), Math.hypot(fx, fy)];

function sk(d: Omit<ActiveSkillDef, 'run'>, run: (a: SkillAPI) => void): ActiveSkillDef {
  return { ...d, run };
}

export const ACTIVE_SKILLS: ActiveSkillDef[] = [
  // ============================================================ ONE-HANDED SWORD
  sk({ id: 'sw_gale_lunge', name: 'Gale Lunge', branch: 'sword', rank: 1, sp: 1, mp: 8, cd: 4, dur: 0.5, ai: 'gap', range: 170, color: '#7fc8ff', color2: '#ffffff',
    desc: 'Leap 150 units along your aim and cut through everything at the landing point. 170% ATK, knockback.' }, (a) => {
    a.sfx('swing');
    a.dash(a.aim, 150, 0.22);
    a.at(0.2, () => {
      a.hit({ shape: 'arc', range: 66, arc: 2.0, mult: 1.7, brk: 10, kb: 140, ribbon: { a0: -1.1, a1: 1.1, r: 58, w: 16 } });
      a.shake(3);
    });
  }),
  sk({ id: 'sw_quadrant', name: 'Quadrant Slash', branch: 'sword', rank: 4, sp: 2, mp: 14, cd: 7, dur: 0.75, ai: 'melee', range: 70, color: '#7fc8ff', color2: '#ffffff',
    desc: 'Four strikes that trace a glowing diamond in front of you. 4 x 95% ATK.' }, (a) => {
    const d: [number, number][] = [P(14, -40), P(84, 0), P(14, 40), P(-6, 0)];
    for (let i = 0; i < 4; i++) {
      const p = d[i];
      const q = d[(i + 1) % 4];
      a.at(i * 0.14, () => {
        a.sfx(i % 2 ? 'swing2' : 'swing');
        a.dash(a.aim, 12, 0.08);
        a.hit({ shape: 'arc', range: 82, arc: 2.0, mult: 0.95, brk: 5, kb: i === 3 ? 160 : 30, ribbon: { a0: p[0], a1: q[0], r: p[1], len: q[1], style: 'cross', w: 12 } });
      });
    }
    a.at(0.45, () => a.shake(3));
  }),
  sk({ id: 'sw_rising_crescent', name: 'Rising Crescent', branch: 'sword', rank: 8, sp: 3, mp: 16, cd: 8, dur: 0.6, ai: 'melee', range: 70, color: '#9ad8ff', color2: '#ffffff',
    desc: 'A falling cut followed by a rising crescent that launches foes. 145% + 160% ATK, stun.' }, (a) => {
    a.at(0, () => {
      a.sfx('swing');
      a.hit({ shape: 'arc', range: 72, arc: 1.7, mult: 1.45, brk: 8, ribbon: { a0: -1.0, a1: 0.3, r: 62, w: 15 } });
    });
    a.at(0.22, () => {
      a.sfx('swing2');
      a.dash(a.aim, 26, 0.1);
      a.hit({ shape: 'arc', range: 76, arc: 1.7, mult: 1.6, brk: 12, kb: 200, status: { kind: 'stun', dur: 0.6 }, ribbon: { a0: 1.0, a1: -0.3, r: 68, w: 17 } });
      a.shake(3);
    });
  }),
  sk({ id: 'sw_crimson_piercer', name: 'Crimson Piercer', branch: 'sword', rank: 14, sp: 4, mp: 24, cd: 12, dur: 0.75, ai: 'gap', range: 240, color: '#ff3b5c', color2: '#ffd1d1',
    desc: 'Gather crimson light, then pierce 250 units forward through every enemy. 460% ATK, huge Break.' }, (a) => {
    a.at(0, () => a.sfx('chime'));
    a.at(0.22, () => {
      a.sfx('beam');
      a.hit({ shape: 'line', range: 260, width: 42, mult: 4.6, brk: 40, kb: 260, crit: 0.15, ribbon: { a0: 0, a1: 0, len: 260, w: 22, style: 'thrust', color: '#ff3b5c', color2: '#ffd1d1' } });
      a.dash(a.aim, 210, 0.18);
      a.shake(6);
    });
  }),
  sk({ id: 'sw_stellar_cascade', name: 'Stellar Cascade', branch: 'sword', rank: 22, sp: 5, mp: 40, cd: 20, dur: 1.3, ai: 'melee', range: 80, color: '#9ad8ff', color2: '#ffffff',
    desc: 'Seven strikes that draw a seven-pointed star of light; the last one detonates. 6 x 95% + 220% ATK.' }, (a) => {
    const pts: [number, number][] = [];
    for (let k = 0; k < 7; k++) {
      const th = -PI / 2 + (k * 3 * 2 * PI) / 7;
      pts.push(P(46 + 56 * Math.cos(th), 56 * Math.sin(th)));
    }
    for (let i = 0; i < 7; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % 7];
      a.at(i * 0.13, () => {
        a.sfx(i % 2 ? 'swing2' : 'swing');
        a.hit({ shape: 'arc', range: 104, arc: 2.3, mult: i === 6 ? 2.2 : 0.95, brk: 6, kb: i === 6 ? 220 : 30, ribbon: { a0: p[0], a1: q[0], r: p[1], len: q[1], style: 'cross', w: 13, color: '#9ad8ff', color2: '#ffffff' } });
        if (i === 6) {
          a.shake(7);
          a.ring('#bfe6ff', 120);
        }
      });
    }
  }),

  // ============================================================ DUAL BLADES
  sk({ id: 'du_twin_cyclone', name: 'Twin Cyclone', branch: 'dual', rank: 1, sp: 1, mp: 10, cd: 5, dur: 0.55, ai: 'gap', range: 110, color: '#5ee7ff', color2: '#b07bff',
    desc: 'Spin forward with both blades, carving two full circles. 100% + 120% ATK.' }, (a) => {
    a.dash(a.aim, 90, 0.3);
    a.at(0.05, () => {
      a.sfx('swing');
      a.hit({ shape: 'circle', range: 74, mult: 1.0, brk: 5, ribbon: { a0: -PI, a1: PI, r: 58, w: 12, color: '#5ee7ff' } });
    });
    a.at(0.26, () => {
      a.sfx('swing2');
      a.hit({ shape: 'circle', range: 78, mult: 1.2, brk: 6, kb: 120, ribbon: { a0: PI, a1: -PI, r: 62, w: 14, color: '#b07bff' } });
    });
  }),
  sk({ id: 'du_crossguard', name: 'Crossguard Riposte', branch: 'dual', rank: 4, sp: 2, mp: 12, cd: 8, dur: 0.7, ai: 'defense', range: 60, color: '#5ee7ff', color2: '#b07bff',
    desc: 'Cross your blades for 0.6s. If struck, Perfect Parry automatically and answer with a critical X-slash (2 x 170%). Otherwise, a quick X-slash.' }, (a) => {
    let fired = false;
    const x1a = P(18, -30), x1b = P(82, 30), x2a = P(18, 30), x2b = P(82, -30);
    const xslash = (mult: number, crit: boolean) => {
      a.hit({ shape: 'arc', range: 86, arc: 2.2, mult, brk: crit ? 30 : 8, forceCrit: crit, ribbon: { a0: x1a[0], a1: x1b[0], r: x1a[1], len: x1b[1], style: 'cross', w: 14, color: '#5ee7ff' } });
      a.hit({ shape: 'arc', range: 86, arc: 2.2, mult, brk: crit ? 30 : 8, forceCrit: crit, ribbon: { a0: x2a[0], a1: x2b[0], r: x2a[1], len: x2b[1], style: 'cross', w: 14, color: '#b07bff' } });
    };
    a.counter(0.6, () => {
      fired = true;
      xslash(1.7, true);
      a.shake(5);
    });
    a.at(0.6, () => {
      if (!fired) {
        a.sfx('swing');
        xslash(0.6, false);
      }
    });
  }),
  sk({ id: 'du_phantom_step', name: 'Phantom Step', branch: 'dual', rank: 8, sp: 3, mp: 14, cd: 9, dur: 0.45, ai: 'gap', range: 230, color: '#b07bff', color2: '#ffffff',
    desc: 'Blink behind the enemy nearest your cursor and strike its back with a guaranteed critical. 240% ATK.' }, (a) => {
    const ok = a.blinkBehind(240);
    a.at(0.08, () => {
      a.sfx('swing');
      a.hit({ shape: 'arc', range: 72, arc: 2.0, mult: ok ? 2.4 : 1.4, brk: 12, forceCrit: ok, ribbon: { a0: -1.2, a1: 1.2, r: 56, w: 15, color: '#b07bff' } });
    });
  }),
  sk({ id: 'du_starfall', name: 'Starfall Tempest', branch: 'dual', rank: 14, sp: 4, mp: 32, cd: 16, dur: 1.75, ai: 'melee', range: 70, color: '#5ee7ff', color2: '#b07bff',
    desc: 'A sixteen-hit storm of cyan and violet slashes; the final blow blasts enemies away. 15 x 42% + 180% ATK.' }, (a) => {
    for (let i = 0; i < 16; i++) {
      a.at(i * 0.1, () => {
        const s = i % 2 ? 1 : -1;
        const base = ((i * 0.7) % 1.6) - 0.8;
        a.sfx(i % 2 ? 'swing2' : 'swing');
        if (i % 4 === 0) a.dash(a.aim, 10, 0.08);
        a.hit({ shape: 'arc', range: 76, arc: 2.0, mult: i === 15 ? 1.8 : 0.42, brk: 3, kb: i === 15 ? 220 : 10, ribbon: { a0: base - 0.7 * s, a1: base + 0.7 * s, r: 50 + (i % 3) * 8, w: 10, color: i % 2 ? '#b07bff' : '#5ee7ff', color2: '#ffffff' } });
        if (i === 15) a.shake(6);
      });
    }
  }),
  sk({ id: 'du_twilight_maelstrom', name: 'Twilight Maelstrom', branch: 'dual', rank: 22, sp: 5, mp: 55, cd: 28, dur: 2.35, ai: 'melee', range: 80, color: '#b07bff', color2: '#5ee7ff',
    desc: 'Ultimate: become a 27-hit hurricane of blades that you can steer. 26 x 40% + 300% ATK to everything around you.' }, (a) => {
    a.allowMove(2.3, 0.55);
    for (let i = 0; i < 27; i++) {
      a.at(i * 0.085, () => {
        const st = (i * 2.3) % (PI * 2);
        if (i % 3 === 0) a.sfx(i % 2 ? 'swing2' : 'swing');
        a.hit({ shape: 'circle', range: 96, mult: i === 26 ? 3 : 0.4, brk: 3, kb: i === 26 ? 260 : 0, ribbon: { a0: st, a1: st + 2.4, r: 44 + (i % 4) * 10, w: 9, color: i % 2 ? '#b07bff' : '#5ee7ff', color2: '#ffffff' } });
        if (i === 26) {
          a.shake(9);
          a.ring('#b07bff', 150);
        }
      });
    }
  }),

  // ============================================================ SHIELD & FORTRESS
  sk({ id: 'sh_bash', name: 'Shield Bash', branch: 'shield', rank: 1, sp: 1, mp: 8, cd: 5, dur: 0.4, ai: 'melee', range: 56, color: '#ffd166', color2: '#fff4c2',
    desc: 'Drive your shield into the enemy: stun 1.2s and massive Break damage. 110% ATK.' }, (a) => {
    a.dash(a.aim, 46, 0.12);
    a.at(0.1, () => {
      a.sfx('block');
      a.hit({ shape: 'arc', range: 60, arc: 1.4, mult: 1.1, brk: 45, kb: 160, status: { kind: 'stun', dur: 1.2 }, ribbon: { a0: -0.5, a1: 0.5, r: 44, w: 18, color: '#ffd166' } });
      a.shake(4);
    });
  }),
  sk({ id: 'sh_aegis_guard', name: 'Aegis Guard', branch: 'shield', rank: 4, sp: 2, mp: 14, cd: 12, dur: 0.3, ai: 'defense', range: 200, color: '#ffd166', color2: '#fff4c2',
    desc: 'Raise a directional barrier for 3.5s: every attack from the front is negated, and DEF +20%.' }, (a) => {
    a.sfx('buff');
    a.buff({ id: 'aegisguard', name: 'Aegis Guard', dur: 3.5, color: '#ffd166', stats: { defPct: 0.2 } });
    a.ring('#ffd166', 60);
  }),
  sk({ id: 'sh_earthshaker', name: 'Earthshaker Slam', branch: 'shield', rank: 8, sp: 3, mp: 18, cd: 10, dur: 0.65, ai: 'melee', range: 100, color: '#ffd166', color2: '#c98a3a',
    desc: 'Leap and slam the ground: 220% ATK to all nearby enemies, stun 0.8s, heavy Break.' }, (a) => {
    a.leap(a.caster.x + Math.cos(a.aim) * 40, a.caster.y + Math.sin(a.aim) * 40, 0.35);
    a.at(0.36, () => {
      a.sfx('quake');
      a.hit({ shape: 'circle', range: 118, mult: 2.2, brk: 30, kb: 220, status: { kind: 'stun', dur: 0.8 }, ribbon: false });
      a.ring('#ffd166', 130);
      a.shake(8);
    });
  }),
  sk({ id: 'sh_provocation', name: "Knight's Provocation", branch: 'shield', rank: 14, sp: 4, mp: 16, cd: 18, dur: 0.4, ai: 'defense', range: 260, color: '#ffb347', color2: '#fff4c2',
    desc: 'Taunt every enemy within 280 units for 6s and surge DEF by 50% for 8s. Protects your companion.' }, (a) => {
    a.sfx('roar');
    a.taunt(280, 6);
    a.buff({ id: 'provoke', name: 'Provocation', dur: 8, color: '#ffb347', stats: { defPct: 0.5 } });
    a.ring('#ffb347', 280);
  }),
  sk({ id: 'sh_citadel', name: 'Immortal Citadel', branch: 'shield', rank: 22, sp: 5, mp: 45, cd: 40, dur: 0.6, ai: 'defense', range: 140, color: '#ffd166', color2: '#ffffff',
    desc: 'Ultimate: raise a golden dome for 4.5s. You and allies inside are invulnerable; enemies are pushed out.' }, (a) => {
    a.sfx('awaken');
    a.zone({ kind: 'citadel', x: a.caster.x, y: a.caster.y, r: 125, dur: 4.5, color: '#ffd166', pull: -70 });
    a.ring('#fff4c2', 130);
    a.shake(4);
  }),

  // ============================================================ SPEAR & POLEARM
  sk({ id: 'sp_comet_thrust', name: 'Comet Thrust', branch: 'spear', rank: 1, sp: 1, mp: 8, cd: 4, dur: 0.4, ai: 'melee', range: 170, color: '#5ee6a0', color2: '#e0fff0',
    desc: 'A blinding thrust that pierces 190 units in a line. 210% ATK.' }, (a) => {
    a.dash(a.aim, 30, 0.1);
    a.at(0.06, () => {
      a.sfx('swing');
      a.hit({ shape: 'line', range: 190, width: 32, mult: 2.1, brk: 10, kb: 120, ribbon: { a0: 0, a1: 0, len: 190, w: 14, style: 'thrust', color: '#5ee6a0', color2: '#e0fff0' } });
    });
  }),
  sk({ id: 'sp_crescent_sweep', name: 'Crescent Sweep', branch: 'spear', rank: 4, sp: 2, mp: 12, cd: 6, dur: 0.5, ai: 'melee', range: 90, color: '#5ee6a0', color2: '#e0fff0',
    desc: 'A full 360-degree sweep that hurls enemies away. 150% ATK, strong knockback.' }, (a) => {
    a.at(0.05, () => {
      a.sfx('wind');
      a.hit({ shape: 'circle', range: 106, mult: 1.5, brk: 14, kb: 280, ribbon: { a0: -PI, a1: PI, r: 84, w: 16, color: '#5ee6a0' } });
      a.shake(3);
    });
  }),
  sk({ id: 'sp_dragon_dive', name: 'Dragon Dive', branch: 'spear', rank: 8, sp: 3, mp: 20, cd: 10, dur: 0.75, ai: 'gap', range: 260, color: '#5ee6a0', color2: '#ffffff',
    desc: 'Leap toward your cursor (up to 260 units) and crash down spear-first. 300% ATK in an area.' }, (a) => {
    const ang = Math.atan2(a.ty - a.caster.y, a.tx - a.caster.x);
    const d = Math.min(260, Math.hypot(a.tx - a.caster.x, a.ty - a.caster.y));
    a.leap(a.caster.x + Math.cos(ang) * d, a.caster.y + Math.sin(ang) * d, 0.45);
    a.at(0.46, () => {
      a.sfx('quake');
      a.hit({ shape: 'circle', range: 100, mult: 3.0, brk: 22, kb: 220, ribbon: false });
      a.ring('#5ee6a0', 110);
      a.shake(7);
    });
  }),
  sk({ id: 'sp_armor_piercer', name: 'Armor Piercer', branch: 'spear', rank: 14, sp: 4, mp: 18, cd: 12, dur: 0.45, ai: 'melee', range: 150, color: '#d9ff5a', color2: '#ffffff',
    desc: 'A twisting thrust that shreds armor: 240% ATK and -35% enemy DEF for 8s.' }, (a) => {
    a.dash(a.aim, 40, 0.12);
    a.at(0.1, () => {
      a.sfx('beam');
      a.hit({ shape: 'line', range: 165, width: 34, mult: 2.4, brk: 18, status: { kind: 'shred', dur: 8, power: 0.35 }, ribbon: { a0: 0, a1: 0, len: 170, w: 16, style: 'thrust', color: '#d9ff5a', color2: '#ffffff' } });
      a.shake(4);
    });
  }),
  sk({ id: 'sp_gale_whirlwind', name: 'Gale Whirlwind', branch: 'spear', rank: 22, sp: 5, mp: 45, cd: 24, dur: 2.6, ai: 'melee', range: 90, color: '#5ee6a0', color2: '#e0fff0',
    desc: 'Ultimate: spin your polearm for 2.5s while moving freely, then finish with a cyclone burst. 14 x 60% + 200% ATK.' }, (a) => {
    a.allowMove(2.5, 0.75);
    for (let i = 0; i < 14; i++) {
      a.at(i * 0.18, () => {
        if (i % 2 === 0) a.sfx('wind');
        a.hit({ shape: 'circle', range: 100, mult: 0.6, brk: 5, kb: 60, ribbon: { a0: i * 1.9, a1: i * 1.9 + 3.6, r: 80, w: 12, color: '#5ee6a0', color2: '#e0fff0' } });
      });
    }
    a.at(2.5, () => {
      a.hit({ shape: 'circle', range: 124, mult: 2.0, brk: 15, kb: 300, ribbon: false });
      a.ring('#5ee6a0', 130);
      a.shake(6);
    });
  }),

  // ============================================================ BOW & MARKSMANSHIP
  sk({ id: 'bw_penetrating', name: 'Penetrating Shot', branch: 'bow', rank: 1, sp: 1, mp: 8, cd: 4, dur: 0.45, ai: 'ranged', range: 420, color: '#ffb35c', color2: '#fff0d0',
    desc: 'Draw deep and loose an arrow that pierces every enemy in its path. 240% ATK.' }, (a) => {
    a.at(0.2, () => {
      a.sfx('arrow');
      a.proj({ kind: 'arrow', speed: 900, mult: 2.4, range: 620, pierce: true, brk: 10, color: '#ffb35c' }, a.aim);
    });
  }),
  sk({ id: 'bw_spread', name: 'Spread Volley', branch: 'bow', rank: 4, sp: 2, mp: 12, cd: 6, dur: 0.35, ai: 'ranged', range: 300, color: '#ffb35c', color2: '#fff0d0',
    desc: 'Fire five arrows in a fan. 5 x 110% ATK.' }, (a) => {
    a.at(0.1, () => {
      a.sfx('arrow');
      for (let i = -2; i <= 2; i++) a.proj({ kind: 'arrow', speed: 720, mult: 1.1, range: 430, brk: 4 }, a.aim + i * 0.14);
    });
  }),
  sk({ id: 'bw_backflip', name: 'Acrobatic Backflip Shot', branch: 'bow', rank: 8, sp: 3, mp: 14, cd: 9, dur: 0.55, ai: 'defense', range: 200, color: '#ffb35c', color2: '#ffffff',
    desc: 'Backflip out of danger (invulnerable), leave a snare trap that roots for 2.5s, and fire mid-air. 180% ATK.' }, (a) => {
    const ox = a.caster.x;
    const oy = a.caster.y;
    a.invuln(0.4);
    a.dash(a.aim + PI, 130, 0.3);
    a.trap(ox, oy, 10, 2.5);
    a.at(0.28, () => {
      a.sfx('arrow');
      a.proj({ kind: 'arrow', speed: 820, mult: 1.8, range: 520, brk: 6 }, a.aim);
    });
  }),
  sk({ id: 'bw_arrow_rain', name: 'Celestial Arrow Rain', branch: 'bow', rank: 14, sp: 4, mp: 26, cd: 14, dur: 0.5, ai: 'ranged', range: 380, color: '#ffe0a0', color2: '#ffffff',
    desc: 'Call 14 starlit arrows down on the area around your cursor over 1.6s. 14 x 85% ATK.' }, (a) => {
    a.at(0.15, () => {
      a.sfx('arrow');
      a.rain(a.tx, a.ty, 112, 14, 1.6, 0.85, 'none');
    });
  }),
  sk({ id: 'bw_phoenix', name: 'Phoenix Rail-Shot', branch: 'bow', rank: 22, sp: 5, mp: 50, cd: 26, dur: 1.0, ai: 'ranged', range: 560, color: '#ff7a3d', color2: '#fff0a0',
    desc: 'Ultimate: charge a phoenix-fire rail that obliterates a 640-unit line. 620% ATK, Burn, recoil dash.' }, (a) => {
    a.at(0, () => a.sfx('chime'));
    a.at(0.55, () => {
      a.sfx('beam');
      a.hit({ shape: 'line', range: 640, width: 50, mult: 6.2, brk: 40, kb: 200, element: 'fire', status: { kind: 'burn', dur: 4 }, ribbon: { a0: 0, a1: 0, len: 640, w: 30, style: 'thrust', color: '#ff7a3d', color2: '#fff0a0' } });
      a.dash(a.aim + PI, 40, 0.15);
      a.shake(9);
    });
  }),

  // ============================================================ ELEMENTAL & ARCANE MAGIC
  sk({ id: 'mg_ignis', name: 'Ignis Meteorite', branch: 'magic', rank: 1, sp: 1, mp: 14, cd: 5, dur: 0.4, ai: 'ranged', range: 380, color: '#ff6a3d', color2: '#ffd166',
    desc: 'Call a meteor onto your cursor. After a short fall it explodes: 330% MAG fire damage in an area, Burn.' }, (a) => {
    a.sfx('fire');
    a.proj({ kind: 'meteor', speed: 0, mult: 3.3, range: 0, aoe: 92, element: 'fire', magic: true, brk: 16, status: { kind: 'burn', dur: 4 } }, a.aim);
  }),
  sk({ id: 'mg_zero_lance', name: 'Absolute Zero Lance', branch: 'magic', rank: 4, sp: 2, mp: 16, cd: 7, dur: 0.35, ai: 'ranged', range: 420, color: '#7fe9ff', color2: '#ffffff',
    desc: 'Hurl a piercing lance of absolute zero that freezes enemies solid for 2s. 260% MAG.' }, (a) => {
    a.at(0.1, () => {
      a.sfx('ice');
      a.proj({ kind: 'icelance', speed: 640, mult: 2.6, range: 520, element: 'frost', magic: true, pierce: true, brk: 10, status: { kind: 'freeze', dur: 2 } }, a.aim);
    });
  }),
  sk({ id: 'mg_thunder_chain', name: 'Thunderstorm Chain', branch: 'magic', rank: 8, sp: 3, mp: 22, cd: 9, dur: 0.4, ai: 'ranged', range: 300, color: '#ffe066', color2: '#ffffff',
    desc: 'Lightning leaps between up to five enemies, 15% weaker per jump. 200% MAG, Shock.' }, (a) => {
    a.at(0.15, () => {
      a.sfx('thunder');
      a.chain(2.0, 5, 210, 'lightning', { kind: 'shock', dur: 1, chance: 0.5 });
    });
  }),
  sk({ id: 'mg_arcane_nova', name: 'Arcane Barrier & Nova', branch: 'magic', rank: 14, sp: 4, mp: 26, cd: 16, dur: 0.4, ai: 'defense', range: 120, color: '#c18cff', color2: '#ffffff',
    desc: 'Wrap yourself in a barrier worth 30% of your max HP for 6s and release a repelling nova. 190% MAG.' }, (a) => {
    a.sfx('magic');
    a.barrier(0.3, 6);
    a.at(0.15, () => {
      a.hit({ shape: 'circle', range: 126, mult: 1.9, magic: true, element: 'void', brk: 16, kb: 260, ribbon: false });
      a.ring('#c18cff', 140);
      a.shake(4);
    });
  }),
  sk({ id: 'mg_sanctuary', name: 'Sacred Aether Sanctuary', branch: 'magic', rank: 22, sp: 5, mp: 50, cd: 35, dur: 0.4, ai: 'support', range: 140, color: '#fff1a8', color2: '#ffffff',
    desc: 'Ultimate: consecrate the ground for 8s. Allies inside heal 4% max HP every half second and are cleansed; enemies are slowed.' }, (a) => {
    a.sfx('heal');
    a.zone({ kind: 'sanctuary', x: a.caster.x, y: a.caster.y, r: 135, dur: 8, color: '#fff1a8', heal: 0.04, slow: 0.4, tick: 0.5 });
    a.ring('#fff1a8', 140);
  }),
];

export const PASSIVE_SKILLS: PassiveSkillDef[] = [
  { id: 'sw_p_discipline', name: 'Blade Discipline', branch: 'sword', rank: 2, max: 3, desc: '+4% ATK per level while wielding a blade.', stats: (l) => ({ atkPct: 0.04 * l }) },
  { id: 'sw_p_riposte', name: 'Riposte Instinct', branch: 'sword', rank: 10, max: 3, desc: 'Perfect Parry window +0.04s per level.' },
  { id: 'sw_p_edge', name: 'Edge Mastery', branch: 'sword', rank: 18, max: 3, desc: '+3% critical chance and +8% critical damage per level.', stats: (l) => ({ crit: 0.03 * l, critDmg: 0.08 * l }) },
  { id: 'du_p_ambidex', name: 'Ambidexterity', branch: 'dual', rank: 2, max: 3, desc: '+5% attack speed per level while dual wielding.', stats: (l) => ({ aspd: 0.05 * l }) },
  { id: 'du_p_flurry', name: 'Flurry Rhythm', branch: 'dual', rank: 10, max: 3, desc: 'Each consecutive hit within 1.5s adds +1% damage, up to +6% per level.' },
  { id: 'du_p_twinfang', name: 'Twin Fang', branch: 'dual', rank: 18, max: 3, desc: '+2% critical chance and +6% critical damage per level.', stats: (l) => ({ crit: 0.02 * l, critDmg: 0.06 * l }) },
  { id: 'sh_p_bulwark', name: 'Bulwark', branch: 'shield', rank: 2, max: 3, desc: '+6% DEF per level with a shield equipped.', stats: (l) => ({ defPct: 0.06 * l }) },
  { id: 'sh_p_steadfast', name: 'Steadfast', branch: 'shield', rank: 10, max: 3, desc: '-12% Stamina cost when blocking and +5% block efficiency per level.', stats: (l) => ({ block: 0.05 * l }) },
  { id: 'sh_p_retaliation', name: 'Retaliation', branch: 'shield', rank: 18, max: 3, desc: 'Reflect 10% of blocked damage back at the attacker per level.' },
  { id: 'sp_p_reach', name: 'Long Reach', branch: 'spear', rank: 2, max: 3, desc: '+8% basic attack reach and +3% ATK per level with a polearm.', stats: (l) => ({ atkPct: 0.03 * l }) },
  { id: 'sp_p_impaler', name: 'Impaler', branch: 'spear', rank: 10, max: 3, desc: '+4 Break power and +3% critical chance per level.', stats: (l) => ({ brk: 4 * l, crit: 0.03 * l }) },
  { id: 'sp_p_footwork', name: 'Wind Footwork', branch: 'spear', rank: 18, max: 3, desc: '+4% move speed and +4% attack speed per level.', stats: (l) => ({ move: 0.04 * l, aspd: 0.04 * l }) },
  { id: 'bw_p_eagle', name: 'Eagle Eye', branch: 'bow', rank: 2, max: 3, desc: '+4% critical chance per level with a bow.', stats: (l) => ({ crit: 0.04 * l }) },
  { id: 'bw_p_quicknock', name: 'Quick Nock', branch: 'bow', rank: 10, max: 3, desc: '+8% attack speed per level with a bow.', stats: (l) => ({ aspd: 0.08 * l }) },
  { id: 'bw_p_hunter', name: "Hunter's Mark", branch: 'bow', rank: 18, max: 3, desc: '+5% ATK per level, and +5% damage per level against targets more than 160 units away.', stats: (l) => ({ atkPct: 0.05 * l }) },
  { id: 'mg_p_flow', name: 'Arcane Flow', branch: 'magic', rank: 2, max: 3, desc: '+12% MP regeneration and +10 max MP per level.', stats: (l) => ({ regen: 0.12 * l, mp: 10 * l }) },
  { id: 'mg_p_attune', name: 'Elemental Attunement', branch: 'magic', rank: 10, max: 3, desc: '+6% MAG per level.', stats: (l) => ({ magPct: 0.06 * l }) },
  { id: 'mg_p_echo', name: 'Spell Echo', branch: 'magic', rank: 18, max: 3, desc: '6% chance per level to instantly refund the cooldown of a spell you cast.' },
];

export const AWAKENINGS: AwakeningDef[] = [
  {
    id: 'aw_dual',
    name: 'Dual Blades Overdrive',
    desc: '+20% attack speed. Critical hits have a 10% chance to reset every Sword Skill cooldown.',
    trigger: 'Reach One-Handed Sword Mastery Rank 10, or land 15 Perfect Parries.',
  },
  {
    id: 'aw_smith',
    name: "Master Blacksmith's Soul",
    desc: 'Every weapon you forge yourself can hold 2 Elemental Gem sockets.',
    trigger: 'Forge 5 items of Masterwork or Supreme Masterpiece grade.',
  },
  {
    id: 'aw_aegis',
    name: "Paragon's Divine Aegis",
    desc: 'When your HP falls below 40%, an emergency barrier worth 30% of your max HP erupts. Recharges every 45 seconds.',
    trigger: 'Win a boss fight with less than 15% HP left, or block 2,000 total damage.',
  },
];

export const SKILL_BY_ID: Record<string, ActiveSkillDef> = Object.fromEntries(ACTIVE_SKILLS.map((s) => [s.id, s]));
export const PASSIVE_BY_ID: Record<string, PassiveSkillDef> = Object.fromEntries(PASSIVE_SKILLS.map((s) => [s.id, s]));

export function skillsOfBranch(b: Branch): ActiveSkillDef[] {
  return ACTIVE_SKILLS.filter((s) => s.branch === b);
}
export function passivesOfBranch(b: Branch): PassiveSkillDef[] {
  return PASSIVE_SKILLS.filter((s) => s.branch === b);
}
