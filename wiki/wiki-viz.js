/* Aetheria Codex - Combat documentation (animated frame-data timelines, Wall-Slam & Break-Bar physics,
   the elemental reaction simulator) and the interactive Realm Atlas drawn by the game's own renderer. */
(function () {
  'use strict';
  var W = window.Wiki;
  var D = W.D, E = W.E, I = W.I, L = W.L, t = W.t, esc = W.esc, fmt = W.fmt, n = W.n, pct = W.pct, num = W.num;
  var F = D.frames;
  var DPR = Math.min(2.5, window.devicePixelRatio || 1);
  function rtl() { return W.lang() === 'he'; }
  function font(px, weight) { return (weight || 600) + ' ' + px + 'px ' + (rtl() ? "'Segoe UI', 'Noto Sans Hebrew', Arial, sans-serif" : "'Segoe UI', system-ui, sans-serif"); }
  function sizeCanvas(c, h) {
    var w = c.clientWidth || 800;
    if (c.width !== Math.round(w * DPR) || c.height !== Math.round(h * DPR)) {
      c.width = Math.round(w * DPR);
      c.height = Math.round(h * DPR);
      c.style.height = h + 'px';
    }
    var g = c.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { g: g, w: w, h: h };
  }
  function loop(c, draw) {
    var t0 = performance.now();
    function f(now) {
      if (!c.isConnected) return;
      draw((now - t0) / 1000);
      requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  }
  function hatch(g, x, y, w, h, color) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.strokeStyle = color;
    g.lineWidth = 1;
    for (var i = -h; i < w; i += 6) {
      g.beginPath();
      g.moveTo(x + i, y + h);
      g.lineTo(x + i + h, y);
      g.stroke();
    }
    g.restore();
  }
  function rrect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // ================================================================ frame-data timeline
  var TL = { scen: 'combo', mode: 'sword', aspd: 1, rip: 0, ks: false, press: 0.84, chain: ['sw_gale_lunge', 'sw_quadrant', 'sw_rising_crescent', 'sw_crimson_piercer'] };
  var LANE_COLORS = { startup: '#ff9a3d', active: '#ffffff', recovery: '#5b6b88', cancel: '#5ee6a0', buffer: '#7fe9ff', parry: '#ffd166', riposte: '#b46cff', freeze: '#e8fbff', iframe: '#5ee6a0', cooldown: '#5b6b88', telegraph: '#ff5d6c', premotion: '#ffe066', skill: '#4aa8ff', connect: '#7fe9ff', nova: '#bff3ff', block: '#9fb4d8' };

  function scenario() {
    var lanes = [], segs = [], marks = [], T = 2;
    function lane(name) { lanes.push(name); return lanes.length - 1; }
    if (TL.scen === 'combo') {
      var list = D.combos[TL.mode];
      var aspd = TL.aspd;
      var Lin = lane(L('Input', 'קלט')), Lsw = lane(L('Swing', 'הנפה')), Lca = lane(L('Cancel window', 'חלון ביטול')), Lst = lane(L('Step & chain', 'צעד ושרשרת'));
      var s = 0.1;
      marks.push({ lane: Lin, t: 0.1, color: LANE_COLORS.buffer, label: L('Click', 'קליק') });
      list.forEach(function (h, i) {
        var d = h.dur / aspd;
        var hit = s + d * F.hitFrac;
        segs.push({ lane: Lsw, t0: s, t1: hit, color: LANE_COLORS.startup, label: L('Startup ' + Math.round(d * F.hitFrac * 60) + 'f', 'הכנה ' + Math.round(d * F.hitFrac * 60) + 'f') });
        segs.push({ lane: Lsw, t0: hit, t1: s + d, color: LANE_COLORS.recovery, hatch: true, label: L('Recovery', 'התאוששות') });
        segs.push({ lane: Lca, t0: hit, t1: s + d, color: LANE_COLORS.cancel, label: L('Dodge / block / skill', 'התחמקות / חסימה / כישור') });
        marks.push({ lane: Lsw, t: hit, color: '#ffffff', label: L('HIT ×' + h.mult, 'מכה ×' + h.mult), flash: true });
        segs.push({ lane: Lst, t0: s, t1: s + Math.min(d, 0.12), color: '#3fb6e0', label: L('Kinetic step', 'צעד קינטי') });
        if (i < list.length - 1) marks.push({ lane: Lin, t: s + d * 0.6, color: LANE_COLORS.buffer, label: L('Queued', 'בתור') });
        s += d;
      });
      var cd = F.finisherCooldown / aspd;
      segs.push({ lane: Lsw, t0: s, t1: s + cd, color: '#3a4560', label: L('Finisher pause', 'הפסקת סיום') });
      var press = s + 0.04;
      segs.push({ lane: Lin, t0: press, t1: press + F.inputBuffer, color: LANE_COLORS.buffer, hatch: true, label: L('Buffered ' + Math.round(F.inputBuffer * 1000) + 'ms', 'בחוצץ ' + Math.round(F.inputBuffer * 1000) + 'ms') });
      marks.push({ lane: Lin, t: press, color: LANE_COLORS.buffer, label: L('Early click', 'קליק מוקדם') });
      marks.push({ lane: Lsw, t: s + cd, color: LANE_COLORS.buffer, label: L('Fires', 'יוצא') });
      segs.push({ lane: Lst, t0: s, t1: s + F.comboChain, color: '#294066', label: L('Combo chain ' + F.comboChain + 's', 'שרשרת קומבו ' + F.comboChain + ' ש׳') });
      T = s + Math.max(cd, F.comboChain) + 0.25;
    } else if (TL.scen === 'parry') {
      var W0 = F.parryWindow + F.parryPerRiposteRank * TL.rip + (TL.ks ? F.parryKeystone : 0);
      var Len = lane(L('Enemy', 'אויב')), Lyou = lane(L('You', 'אתם')), Lrw = lane(L('Result', 'תוצאה'));
      var impact = 1.0;
      segs.push({ lane: Len, t0: 0.25, t1: impact, color: LANE_COLORS.telegraph, label: L('Telegraph (wind-up)', 'סימון (הכנה)') });
      marks.push({ lane: Len, t: impact, color: '#ff5d6c', label: L('IMPACT', 'פגיעה'), flash: true });
      var pr = TL.press;
      segs.push({ lane: Lyou, t0: pr, t1: pr + W0, color: LANE_COLORS.parry, label: L('Parry window ' + Math.round(W0 * 1000) + 'ms', 'חלון הדיפה ' + Math.round(W0 * 1000) + 'ms') });
      segs.push({ lane: Lyou, t0: pr + W0, t1: Math.max(pr + W0, impact) + 0.5, color: LANE_COLORS.block, hatch: true, label: L('Holding block', 'החזקת חסימה') });
      marks.push({ lane: Lyou, t: pr, color: LANE_COLORS.parry, label: L('Block pressed', 'לחיצת חסימה') });
      var perfect = impact >= pr && impact <= pr + W0;
      if (perfect) {
        segs.push({ lane: Lrw, t0: impact, t1: impact + F.parryFreeze, color: LANE_COLORS.freeze, label: '' });
        marks.push({ lane: Lrw, t: impact, color: LANE_COLORS.parry, label: L('PERFECT PARRY · freeze ' + Math.round(F.parryFreeze * 1000) + 'ms · +' + Math.round(F.parryRestore * 100) + '% MP/Stamina · Break ' + F.parryBreakFlat + ' + ' + Math.round(F.parryBreakPct * 100) + '%', 'הדיפה מושלמת · הקפאה ' + Math.round(F.parryFreeze * 1000) + 'ms · +' + Math.round(F.parryRestore * 100) + '% מאנה/סיבולת · שבירה ' + F.parryBreakFlat + ' + ' + Math.round(F.parryBreakPct * 100) + '%'), flash: true, big: true });
        var r0 = impact + F.parryFreeze;
        segs.push({ lane: Lyou, t0: r0, t1: r0 + F.riposteWindow, color: LANE_COLORS.riposte, label: L('Counter-Riposte window ' + F.riposteWindow + 's', 'חלון תגובת-נגד ' + F.riposteWindow + ' ש׳'), alpha: 0.55 });
        var rd = D.combos.sword[2].dur * F.riposteSpeed;
        var rs = r0 + 0.2;
        segs.push({ lane: Lrw, t0: rs, t1: rs + rd * F.hitFrac, color: LANE_COLORS.startup, label: '' });
        marks.push({ lane: Lrw, t: rs + rd * F.hitFrac, color: '#b46cff', label: L('RIPOSTE ×' + F.riposteMult + ' crit', 'תגובת-נגד ×' + F.riposteMult + ' קריטי'), flash: true });
        T = r0 + F.riposteWindow + 0.2;
      } else {
        marks.push({ lane: Lrw, t: impact, color: pr > impact ? '#ff5d6c' : '#9fb4d8', label: pr > impact ? L('Too late: full hit', 'מאוחר מדי: פגיעה מלאה') : L('Blocked: −' + Math.round(F.blockReduceShield * 100) + '% with a shield, −' + Math.round(F.blockReduce * 100) + '% without', 'נחסם: −' + Math.round(F.blockReduceShield * 100) + '% עם מגן, −' + Math.round(F.blockReduce * 100) + '% בלי'), flash: true, big: true });
        T = 2.2;
      }
    } else if (TL.scen === 'skill') {
      var Lsk = lane(L('Sword Skill', 'כישור חרב')), Lht = lane(L('Strikes', 'מכות')), Lcn = lane(L('Skill Connect', 'חיבור כישורים')), Lbn = lane(L('Chain bonus', 'בונוס שרשרת'));
      var tcur = 0.05;
      var chain = TL.chain.filter(Boolean).slice(0, F.novaChain);
      chain.forEach(function (id, i) {
        var sk = I.skill[id];
        var tl = sk.timeline;
        var start = tcur + F.preMotion;
        segs.push({ lane: Lsk, t0: tcur, t1: start, color: LANE_COLORS.premotion, label: L('Pre-Motion', 'קדם-תנועה') });
        var end = Math.max(sk.dur, tl.eventsEnd);
        var bodySeg = { lane: Lsk, t0: start, t1: start + end, color: sk.color, label: sk.name, alpha: 0.75 };
        segs.push(bodySeg);
        tl.hits.forEach(function (h) { marks.push({ lane: Lht, t: start + h.t, color: sk.color, label: '', tick: true }); });
        var ev = start + tl.eventsEnd;
        var stepMult = 1 + F.connectStep * i;
        segs.push({ lane: Lbn, t0: start, t1: start + end, color: '#294066', label: L((i ? 'Chain ' + (i + 1) + ': ×' + stepMult.toFixed(2) + ' dmg, ×' + F.connectMp + ' MP' : 'Chain 1'), (i ? 'שרשרת ' + (i + 1) + ': נזק ×' + stepMult.toFixed(2) + ', מאנה ×' + F.connectMp : 'שרשרת 1')) });
        if (i === F.novaChain - 1) {
          marks.push({ lane: Lcn, t: ev, color: LANE_COLORS.nova, label: L('FINISHING NOVA ×' + F.novaMult + ' (r' + F.novaRadius + ')', 'נובת סיום ×' + F.novaMult + ' (רדיוס ' + F.novaRadius + ')'), flash: true, big: true });
          tcur = ev + 0.4;
        } else if (i < chain.length - 1) {
          segs.push({ lane: Lcn, t0: ev, t1: ev + F.connectWindow, color: LANE_COLORS.connect, label: L(Math.round(F.connectWindow * 1000) + 'ms', Math.round(F.connectWindow * 1000) + 'ms') });
          var press = ev + F.connectWindow * 0.45;
          marks.push({ lane: Lcn, t: press, color: '#ffffff', label: L('SKILL CONNECT!', 'חיבור כישורים!'), flash: true });
          // the connect cancels the rest of this skill's recovery
          bodySeg.t1 = Math.min(bodySeg.t1, press);
          tcur = press;
        } else {
          segs.push({ lane: Lcn, t0: ev, t1: ev + F.connectWindow, color: LANE_COLORS.connect, label: L('window', 'חלון') });
          tcur = Math.max(start + end, ev + F.connectWindow) + 0.2;
        }
      });
      T = tcur + 0.2;
    } else {
      var Lroll = lane(L('Dodge roll', 'גלגול התחמקות')), Lif = lane(L('Invulnerable', 'חסינות')), Lcd = lane(L('Cooldown', 'טעינה')), Lsta = lane(L('Stamina', 'סיבולת'));
      segs.push({ lane: Lroll, t0: 0.1, t1: 0.1 + F.dodgeDur, color: '#3fb6e0', label: L(Math.round(F.dodgeDur * 1000) + 'ms roll', 'גלגול ' + Math.round(F.dodgeDur * 1000) + 'ms') });
      segs.push({ lane: Lif, t0: 0.1, t1: 0.1 + F.dodgeIframes, color: LANE_COLORS.iframe, label: L(Math.round(F.dodgeIframes * 1000) + 'ms i-frames (' + Math.round(F.dodgeIframes * 60) + 'f)', 'חסינות ' + Math.round(F.dodgeIframes * 1000) + 'ms (' + Math.round(F.dodgeIframes * 60) + 'f)') });
      segs.push({ lane: Lcd, t0: 0.1, t1: 0.1 + F.dodgeCooldown, color: LANE_COLORS.cooldown, hatch: true, label: L(Math.round(F.dodgeCooldown * 1000) + 'ms', Math.round(F.dodgeCooldown * 1000) + 'ms') });
      var p2 = 0.1 + F.dodgeCooldown - 0.07;
      segs.push({ lane: Lcd, t0: p2, t1: p2 + F.inputBuffer, color: LANE_COLORS.buffer, hatch: true, label: '' });
      marks.push({ lane: Lcd, t: p2, color: LANE_COLORS.buffer, label: L('Early press buffered', 'לחיצה מוקדמת בחוצץ') });
      segs.push({ lane: Lroll, t0: 0.1 + F.dodgeCooldown, t1: 0.1 + F.dodgeCooldown + F.dodgeDur, color: '#3fb6e0', label: L('2nd roll', 'גלגול שני') });
      segs.push({ lane: Lif, t0: 0.1 + F.dodgeCooldown, t1: 0.1 + F.dodgeCooldown + F.dodgeIframes, color: LANE_COLORS.iframe, label: '' });
      marks.push({ lane: Lsta, t: 0.1, color: '#ff8a96', label: L('−' + F.dodgeStamina + ' (needs ' + F.dodgeMinStamina + ')', '−' + F.dodgeStamina + ' (דורש ' + F.dodgeMinStamina + ')') });
      segs.push({ lane: Lsta, t0: 0.1 + F.dodgeCooldown + 0.6, t1: 2.0, color: '#5ee6a0', alpha: 0.5, label: L('Regenerates after a 0.6s delay', 'מתחדשת אחרי השהיה של 0.6 ש׳') });
      T = 2.1;
    }
    return { lanes: lanes, segs: segs, marks: marks, T: T };
  }

  function drawTimeline(c, time) {
    var sc = scenario();
    var laneH = 44, top = 30, labelW = Math.min(150, (c.clientWidth || 800) * 0.24);
    var H = top + sc.lanes.length * laneH + 34;
    var cv = sizeCanvas(c, H);
    var g = cv.g, w = cv.w;
    var R = rtl();
    var x0 = R ? 12 : labelW + 8, x1 = R ? w - labelW - 8 : w - 12;
    var span = x1 - x0;
    function X(tt) { var k = tt / sc.T; return R ? x1 - k * span : x0 + k * span; }
    g.fillStyle = '#060a14';
    g.fillRect(0, 0, w, H);
    // grid every 0.1 s, labelled every 0.2 s
    g.font = font(10, 600);
    g.textAlign = 'center';
    for (var s = 0; s <= sc.T + 1e-6; s += 0.1) {
      var gx = X(s);
      var major = Math.round(s * 10) % 2 === 0;
      g.strokeStyle = major ? 'rgba(127,233,255,0.14)' : 'rgba(127,233,255,0.06)';
      g.beginPath();
      g.moveTo(gx, top - 6);
      g.lineTo(gx, H - 26);
      g.stroke();
      if (major) {
        g.fillStyle = '#6c7a93';
        g.fillText(s.toFixed(1) + 's · ' + Math.round(s * D.meta.simHz) + 'f', gx, H - 10);
      }
    }
    // lanes
    sc.lanes.forEach(function (ln, i) {
      var y = top + i * laneH;
      g.fillStyle = i % 2 ? 'rgba(13,20,38,0.6)' : 'rgba(9,14,28,0.6)';
      g.fillRect(R ? 0 : labelW, y, w - labelW, laneH);
      g.fillStyle = '#c9d6ea';
      g.font = font(12, 700);
      g.textAlign = R ? 'right' : 'left';
      g.direction = R ? 'rtl' : 'ltr';
      g.fillText(t(ln), R ? w - 10 : 10, y + laneH / 2 + 4);
    });
    g.direction = 'ltr';
    var play = time % (sc.T + 0.8);
    // segments
    sc.segs.forEach(function (sg) {
      var y = top + sg.lane * laneH + 9;
      var a = X(sg.t0), b = X(sg.t1);
      var lx = Math.min(a, b), lw = Math.max(2, Math.abs(b - a));
      var active = play >= sg.t0 && play <= sg.t1;
      g.globalAlpha = (sg.alpha || 0.85) * (active ? 1 : 0.72);
      g.fillStyle = sg.color;
      rrect(g, lx, y, lw, laneH - 18, 5);
      g.fill();
      if (sg.hatch) hatch(g, lx, y, lw, laneH - 18, 'rgba(255,255,255,0.22)');
      if (active) {
        g.globalAlpha = 1;
        g.strokeStyle = '#ffffff';
        g.lineWidth = 1.5;
        rrect(g, lx, y, lw, laneH - 18, 5);
        g.stroke();
      }
      g.globalAlpha = 1;
      var label = t(sg.label);
      if (label && lw > 30) {
        g.save();
        g.beginPath();
        g.rect(lx, y, lw, laneH - 18);
        g.clip();
        g.fillStyle = '#0a0f1c';
        g.font = font(11, 800);
        g.textAlign = 'center';
        g.direction = R ? 'rtl' : 'ltr';
        g.fillText(label, lx + lw / 2, y + (laneH - 18) / 2 + 4);
        g.restore();
      }
    });
    // markers
    sc.marks.forEach(function (mk) {
      var y = top + mk.lane * laneH;
      var x = X(mk.t);
      var lit = play >= mk.t && play < mk.t + 0.35;
      g.strokeStyle = mk.color;
      g.lineWidth = mk.tick ? 2 : 2.5;
      g.beginPath();
      g.moveTo(x, y + (mk.tick ? 12 : 4));
      g.lineTo(x, y + laneH - (mk.tick ? 12 : 4));
      g.stroke();
      if (mk.flash && lit) {
        var gr = g.createRadialGradient(x, y + laneH / 2, 2, x, y + laneH / 2, mk.big ? 60 : 34);
        gr.addColorStop(0, mk.color);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = 0.55 * (1 - (play - mk.t) / 0.35);
        g.fillStyle = gr;
        g.fillRect(x - 70, y - 20, 140, laneH + 40);
        g.globalAlpha = 1;
      }
      var label = t(mk.label);
      if (label) {
        g.font = font(mk.big ? 12 : 11, 800);
        g.direction = R ? 'rtl' : 'ltr';
        var tw = g.measureText(label).width;
        var right = R ? x - 6 - tw >= 4 : x + 6 + tw <= w - 4;
        g.textAlign = right ? (R ? 'right' : 'left') : (R ? 'left' : 'right');
        var tx = right ? (R ? x - 6 : x + 6) : (R ? x + 6 : x - 6);
        g.fillStyle = 'rgba(6,10,20,0.75)';
        var bx = g.textAlign === 'left' ? tx - 3 : tx - tw - 3;
        g.fillRect(bx, y + 1, tw + 6, 15);
        g.fillStyle = mk.color;
        g.fillText(label, tx, y + 12);
      }
    });
    g.direction = 'ltr';
    // playhead
    var px = X(Math.min(play, sc.T));
    g.strokeStyle = 'rgba(255,209,102,0.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(px, top - 10);
    g.lineTo(px, H - 26);
    g.stroke();
    g.fillStyle = '#ffd166';
    g.beginPath();
    g.moveTo(px - 5, top - 14);
    g.lineTo(px + 5, top - 14);
    g.lineTo(px, top - 6);
    g.fill();
  }
  function timelineControls() {
    var sc = [['combo', L('Basic combo', 'קומבו בסיסי')], ['parry', L('Perfect Parry', 'הדיפה מושלמת')], ['skill', L('Skill Connect chain', 'שרשרת חיבור כישורים')], ['dodge', L('Dodge & i-frames', 'התחמקות וחסינות')]];
    var html = '<div class="seg">' + sc.map(function (s) { return '<button type="button" data-scen="' + s[0] + '" class="' + (TL.scen === s[0] ? 'on' : '') + '">' + esc(t(s[1])) + '</button>'; }).join('') + '</div>';
    if (TL.scen === 'combo') {
      html += '<select class="field" id="tl-mode">' + Object.keys(D.combos).filter(function (k) { return k !== 'fists'; }).map(function (k) { var nm = k === 'dual' ? I.branch.dual.name : I.weapon[k] ? I.weapon[k].name : L(k, k); return '<option value="' + k + '"' + (TL.mode === k ? ' selected' : '') + '>' + esc(t(nm)) + ' (' + D.combos[k].length + ')</option>'; }).join('') + '</select>' +
        '<label class="lab" style="min-width:200px">' + esc(t(L('Attack speed', 'מהירות התקפה'))) + ' <b class="gold" id="tl-aspd-out">×' + TL.aspd.toFixed(2) + '</b><input type="range" id="tl-aspd" min="0.6" max="2" step="0.05" value="' + TL.aspd + '" /></label>';
    } else if (TL.scen === 'parry') {
      html += '<label class="lab" style="min-width:220px">' + esc(t(L('Block pressed at', 'לחיצת חסימה בזמן'))) + ' <b class="gold" id="tl-press-out">' + TL.press.toFixed(2) + 's</b><input type="range" id="tl-press" min="0.4" max="1.15" step="0.01" value="' + TL.press + '" /></label>' +
        '<select class="field" id="tl-rip">' + [0, 1, 2, 3].map(function (l) { return '<option value="' + l + '"' + (TL.rip === l ? ' selected' : '') + '>' + esc(t(I.passive.sw_p_riposte.name)) + ' ' + l + '/3</option>'; }).join('') + '</select>' +
        '<label class="switch"><input type="checkbox" id="tl-ks"' + (TL.ks ? ' checked' : '') + ' />' + esc(t(I.keystone.ks_shield.name)) + '</label>';
    } else if (TL.scen === 'skill') {
      for (var i = 0; i < F.novaChain; i++) {
        html += '<select class="field" data-chain="' + i + '">' + (i > 1 ? '<option value="">-</option>' : '') + D.branches.map(function (b) {
          return '<optgroup label="' + esc(t(b.name)) + '">' + D.skills.filter(function (s) { return s.branch === b.id && s.timeline.hits.length; }).map(function (s) { return '<option value="' + s.id + '"' + (TL.chain[i] === s.id ? ' selected' : '') + '>' + esc(t(s.name)) + '</option>'; }).join('') + '</optgroup>';
        }).join('') + '</select>';
      }
    }
    return html;
  }

  // ================================================================ wall slam & break bar physics
  var PH = { kb: 260, dist: 8, type: 'monster', ks: false, wind: false, boss: 'b_wyrm', brk: 0, broken: 0, delay: 0, log: [] };
  var sim = null;
  function startSlam() {
    var resist = F.kbResist[PH.type];
    var v0 = PH.kb * resist + (PH.wind ? 60 * resist : 0);
    sim = { x: 0, v: v0, v0: v0, t: 0, slam: null, done: false };
  }
  function slamPrediction() {
    var resist = F.kbResist[PH.type];
    var v0 = PH.kb * resist + (PH.wind ? 60 * resist : 0);
    var thr = PH.ks ? F.slamSpeedKeystone : F.slamSpeed;
    // discrete integration exactly like World.integrate (60 Hz)
    var dt = 1 / D.meta.simHz, x = 0, v = v0, hit = null;
    for (var i = 0; i < 600 && v > 2; i++) {
      var sp = v;
      x += v * dt;
      if (x >= PH.dist) { hit = sp; break; }
      v *= Math.max(0, 1 - F.kbDecay * dt);
    }
    return { v0: v0, thr: thr, hit: hit, slam: hit != null && hit >= thr, reach: v0 / F.kbDecay };
  }
  function drawSlam(c, time, dt) {
    var cv = sizeCanvas(c, 230);
    var g = cv.g, w = cv.w, h = cv.h;
    var R = rtl();
    var P = slamPrediction();
    if (!sim || (sim.done && sim.t > 1.6)) startSlam();
    var step = 1 / D.meta.simHz;
    sim.acc = (sim.acc || 0) + Math.min(0.05, dt);
    while (sim.acc >= step) {
      sim.acc -= step;
      sim.t += step;
      if (sim.t < 0.5 || sim.done) continue;
      var sp = sim.v;
      sim.x += sim.v * step;
      if (sim.x >= PH.dist) {
        sim.x = PH.dist;
        sim.slam = sp >= P.thr ? sp : -sp;
        sim.v = 0;
        sim.done = true;
        sim.tDone = sim.t;
      } else {
        sim.v *= Math.max(0, 1 - F.kbDecay * step);
        if (sim.v < 2) { sim.done = true; sim.tDone = sim.t; }
      }
    }
    g.fillStyle = '#070c18';
    g.fillRect(0, 0, w, h);
    var scale = Math.min(4, (w - 160) / Math.max(60, PH.dist + 50));
    var wallX = R ? 70 : w - 70;
    var dir = R ? -1 : 1;
    var startX = wallX - dir * (PH.dist + 14) * scale;
    // floor grid
    g.strokeStyle = 'rgba(127,233,255,0.06)';
    for (var gx = 0; gx < w; gx += 24) { g.beginPath(); g.moveTo(gx, 40); g.lineTo(gx, h - 40); g.stroke(); }
    // wall
    g.fillStyle = '#3a4560';
    g.fillRect(R ? wallX - 26 : wallX, 30, 26, h - 70);
    g.fillStyle = '#56627e';
    g.fillRect(R ? wallX - 26 : wallX, 30, 26, 8);
    // knockback distance markers
    g.setLineDash([4, 4]);
    g.strokeStyle = 'rgba(255,209,102,0.35)';
    var reachX = startX + dir * Math.min(PH.dist, P.reach) * scale;
    g.beginPath(); g.moveTo(reachX, 50); g.lineTo(reachX, h - 50); g.stroke();
    g.setLineDash([]);
    // player
    var py = h / 2 + 10;
    g.fillStyle = '#7fe9ff';
    g.beginPath(); g.arc(startX - dir * 46, py, 12, 0, Math.PI * 2); g.fill();
    // target
    var mx = startX + dir * sim.x * scale;
    var shake = sim.slam > 0 && time - (sim.tDone || 0) < 0.3 ? (Math.random() - 0.5) * 6 : 0;
    var col = PH.type === 'boss' ? '#ff5d6c' : PH.type === 'elite' ? '#b46cff' : '#ffb35c';
    g.fillStyle = col;
    g.beginPath(); g.arc(mx + shake, py, 16, 0, Math.PI * 2); g.fill();
    // velocity arrow
    if (!sim.done && sim.t > 0.5) {
      var len = Math.min(140, sim.v * 0.4);
      g.strokeStyle = '#ffd166';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(mx, py - 26); g.lineTo(mx + dir * len, py - 26); g.stroke();
      g.beginPath(); g.moveTo(mx + dir * len, py - 26); g.lineTo(mx + dir * (len - 8), py - 31); g.lineTo(mx + dir * (len - 8), py - 21); g.closePath(); g.fillStyle = '#ffd166'; g.fill();
    }
    if (sim.done && sim.slam > 0) {
      g.fillStyle = 'rgba(255,179,92,' + Math.max(0, 1 - (sim.t - sim.tDone) * 1.2) + ')';
      for (var k = 0; k < 10; k++) { g.fillRect(wallX - dir * (8 + Math.random() * 30), py - 30 + Math.random() * 50, 4, 4); }
    }
    // readouts
    g.font = font(13, 800);
    g.textAlign = R ? 'right' : 'left';
    g.direction = R ? 'rtl' : 'ltr';
    var tx = R ? w - 14 : 14;
    g.fillStyle = '#c9d6ea';
    g.fillText(t(L('Launch speed', 'מהירות שיגור')) + ': ' + Math.round(P.v0) + ' px/s', tx, 20);
    g.fillText(t(L('Speed at the wall', 'מהירות בקיר')) + ': ' + (P.hit == null ? t(L('never reaches it', 'לא מגיע')) : Math.round(P.hit) + ' px/s'), tx, h - 26);
    g.fillStyle = P.slam ? '#ffb35c' : '#8f9db5';
    g.fillText(P.slam ? t(L('WALL SLAM! +' + Math.round((PH.ks ? F.slamDmgKeystone : F.slamDmg) * 100) + '% damage · ' + F.slamStun + 's stun · ' + Math.round(F.slamBreak * 100) + '% Break', 'הטחה בקיר! +' + Math.round((PH.ks ? F.slamDmgKeystone : F.slamDmg) * 100) + '% נזק · הלם ' + F.slamStun + ' ש׳ · ' + Math.round(F.slamBreak * 100) + '% שבירה')) : t(L('No slam: needs ≥ ' + P.thr + ' px/s on impact', 'אין הטחה: נדרשות ≥ ' + P.thr + ' px/s בפגיעה')), tx, h - 8);
    g.direction = 'ltr';
  }

  function breakHtml() {
    var m = I.monster[PH.boss];
    var st = E.monsterAt(PH.boss, m.level);
    var max = st.poise;
    var pctFill = Math.min(1, PH.brk / max);
    var big = m.boss || m.elite;
    return '<div class="row"><b>' + esc(t(m.name)) + '</b><span class="dim small">' + esc(t(L('Break Bar', 'מד שבירה'))) + ' ' + n(Math.round(PH.brk) + ' / ' + max) + '</span><span class="spacer"></span>' + (PH.broken > 0 ? '<span class="badge solid" style="--c:#ffd166">BREAK!! ' + n(PH.broken.toFixed(1) + 's') + '</span>' : '') + '</div>' +
      '<div class="pbar" style="height:14px;margin:8px 0"><i style="width:' + (pctFill * 100) + '%;background:' + (PH.broken > 0 ? '#ffd166' : 'linear-gradient(90deg,#c9a23a,#ffd166)') + '"></i></div>' +
      '<div class="small dim">' + fmt(L('Bar = (30 + 1.5 × level) × poise ' + m.mult.poise + '. It drains ' + Math.round(F.breakDecay * 100) + '%/s after ' + F.breakDelay + 's without Break damage. Broken: ' + (big ? F.breakStun : F.breakStunSmall) + 's stun and every hit is a ×' + F.breakCritMult + ' critical.', 'המד = (30 + 1.5 × רמה) × עמידות ' + m.mult.poise + '. הוא מתרוקן ב-' + Math.round(F.breakDecay * 100) + '% לשנייה אחרי ' + F.breakDelay + ' ש׳ ללא נזק שבירה. בשבירה: הלם של ' + (big ? F.breakStun : F.breakStunSmall) + ' ש׳ וכל מכה היא קריטית ×' + F.breakCritMult + '.')) + '</div>';
  }
  function addBreak(kind) {
    var m = I.monster[PH.boss];
    var max = E.monsterAt(PH.boss, m.level).poise;
    if (PH.broken > 0) return;
    var amt = kind === 'parry' ? F.parryBreakFlat + max * F.parryBreakPct : kind === 'slam' ? max * F.slamBreak : kind === 'shatter' ? max * D.reactionRules.shatter.breakPct : kind === 'bash' ? 45 : kind === 'piercer' ? 40 : 6;
    PH.brk = Math.min(max, PH.brk + amt);
    PH.delay = F.breakDelay;
    if (PH.brk >= max) PH.broken = m.boss || m.elite ? F.breakStun : F.breakStunSmall;
  }

  // ================================================================ reaction simulator
  var RX = { a: 'burn', b: 'frost' };
  var GORDER = ['burn', 'frost', 'shock', 'bleed', 'venom', 'aether'];
  function reactionOf(first, second) {
    if (first === second) return null;
    var pairs = D.reactions.filter(function (r) { return r.b; });
    for (var i = 0; i < pairs.length; i++) {
      var r = pairs[i];
      if ((r.a === first && r.b === second) || (r.a === second && r.b === first)) return r;
    }
    if (first === 'venom' || second === 'venom') return I.reaction.tempest;
    if (first === 'aether' || second === 'aether') return I.reaction.singularity;
    return null;
  }
  function reactionNumbers(r) {
    var X = D.reactionRules;
    if (!r) return '';
    var rows = {
      melt: [[L('Total damage', 'נזק כולל'), '×' + (1 + X.melt.burst).toFixed(1)], [L('Burst with Dragonlord Inferno', 'פרץ עם תופת אדון הדרקונים'), '×' + (1 + X.melt.burst * X.melt.setBonus).toFixed(2)]],
      shatter: [[L('Shrapnel to nearby enemies', 'רסיסים לאויבים קרובים'), '×' + X.shatter.mult + ' · r' + X.shatter.radius], [L('Target', 'מטרה'), '×' + (X.shatter.mult * X.shatter.self).toFixed(2)], [L('Break Bar', 'מד שבירה'), '−' + Math.round(X.shatter.breakPct * 100) + '%'], [L('Rimecrest / Valkyrie Winter', 'פסגת הכפור / חורף הוולקירית'), '×' + X.shatter.uniqueBonus + ' / ×' + X.shatter.setBonus]],
      overload: [[L('Blast to nearby enemies', 'פיצוץ לאויבים קרובים'), '×' + X.overload.mult + ' · r' + X.overload.radius + ' · kb ' + X.overload.kb], [L('Target', 'מטרה'), '×' + X.overload.self + ' · kb ' + X.overload.selfKb], [L('Dragonlord Inferno', 'תופת אדון הדרקונים'), '×' + X.overload.setBonus]],
      superconduct: [[L('Defense shred', 'קריעת הגנה'), '−' + Math.round(X.superconduct.shred * 100) + '%'], [L('Duration', 'משך'), X.superconduct.dur + 's']],
      tempest: [[L('Spread radius', 'רדיוס התפשטות'), 'r' + X.tempest.radius], [L('Poison on spread targets', 'רעל על המטרות'), X.tempest.poisonDur + 's'], [L('Poison on target', 'רעל על המטרה'), X.tempest.selfPoisonDur + 's ×' + X.tempest.selfPoisonPower]],
      singularity: [[L('Vortex', 'מערבולת'), 'r' + X.singularity.radius + ' · ' + X.singularity.dur + 's'], [L('Damage per tick', 'נזק לכל פעימה'), '×' + X.singularity.mult + ' / ' + X.singularity.tick + 's'], [L('Total over the vortex', 'סך הכול במערבולת'), '×' + (X.singularity.mult * Math.floor(X.singularity.dur / X.singularity.tick)).toFixed(2)], [L('Pull', 'משיכה'), X.singularity.pull + ' px/s']],
    }[r.id] || [];
    return '<div class="stats">' + rows.map(function (x) { return '<div class="stat"><span>' + esc(t(x[0])) + '</span><span class="v">' + n(x[1]) + '</span></div>'; }).join('') + '</div>';
  }
  function matrixHtml() {
    var G = I.gauge;
    var head = '<div class="matrix"><div class="mh" style="--c:#8f9db5">' + esc(t(L('1st → 2nd', 'ראשון ← שני'))) + '</div>' + GORDER.map(function (k) { return '<div class="mh" style="--c:' + G[k].color + '">' + esc(t(G[k].name)) + '</div>'; }).join('');
    var rows = GORDER.map(function (a) {
      return '<div class="mh" style="--c:' + G[a].color + '">' + esc(t(G[a].name)) + '</div>' + GORDER.map(function (b) {
        var r = reactionOf(a, b);
        var on = RX.a === a && RX.b === b;
        var SHORT = { superconduct: 'SUPER­CONDUCT', tempest: 'TEMPEST', singularity: 'SINGU­LARITY' };
        var label = r ? (rtl() ? t(r.name).split(' · ').pop() : SHORT[r.id] || r.name.en) : '';
        return '<button type="button" data-rx="' + a + ',' + b + '" class="' + (r ? 'rx' : '') + (on ? ' on' : '') + '" style="--c:' + (r ? r.color : '#8f9db5') + '"' + (a === b ? ' disabled' : '') + ' title="' + esc(r ? t(r.name) : '') + '">' + (a === b ? '·' : r ? esc(label) : '—') + '</button>';
      }).join('');
    }).join('');
    return head + rows + '</div>';
  }
  function rxCard() {
    var r = reactionOf(RX.a, RX.b);
    var G = I.gauge;
    var title = '<span class="el" style="--c:' + G[RX.a].color + '">' + esc(t(G[RX.a].name)) + '</span> + <span class="el" style="--c:' + G[RX.b].color + '">' + esc(t(G[RX.b].name)) + '</span>';
    if (!r) return '<h3 class="mt0">' + title + '</h3><p>' + fmt(L('No reaction: both gauges stay on the target for ' + D.gaugeDur + 's waiting for a partner.', 'אין תגובה: שני המדים נשארים על המטרה ' + D.gaugeDur + ' ש׳ ומחכים לשותף.')) + '</p>';
    return '<h3 class="mt0">' + title + ' → <span style="color:' + r.color + '">' + esc(t(r.name)) + '</span></h3><p>' + fmt(r.desc) + '</p>' + reactionNumbers(r) +
      '<p class="small dim">' + fmt(L('Gauges last ' + D.gaugeDur + 's. Pairs are checked first, then Venom (Tempest Spread), then Aether (Singularity) - so Venom + Aether is a Tempest Spread. Damage values are multiples of the hit that completes the reaction.', 'מדים נמשכים ' + D.gaugeDur + ' ש׳. הזוגות נבדקים קודם, אחר כך ארס (התפשטות הסערה) ואז אתר (סינגולריות) - לכן ארס + אתר הוא התפשטות סערה. ערכי הנזק הם כפולות של המכה שמשלימה את התגובה.')) + '</p>';
  }
  var parts = [];
  function drawReaction(c, time, dt) {
    var cv = sizeCanvas(c, 220);
    var g = cv.g, w = cv.w, h = cv.h;
    var r = reactionOf(RX.a, RX.b);
    g.fillStyle = 'rgba(5,9,20,0.35)';
    g.fillRect(0, 0, w, h);
    var cx = w / 2, cy = h / 2 + 10;
    var cyc = time % 2.2;
    var G = I.gauge;
    var enemies = [[cx, cy], [cx - 110, cy + 30], [cx + 120, cy - 20], [cx - 60, cy - 60], [cx + 70, cy + 55]];
    var pullK = r && r.id === 'singularity' ? Math.min(1, Math.max(0, (cyc - 0.9) / 1.0)) : 0;
    enemies.forEach(function (e, i) {
      var ex = e[0] + (cx - e[0]) * pullK * 0.6, ey = e[1] + (cy - e[1]) * pullK * 0.6;
      if (r && r.id === 'overload' && cyc > 0.9 && i > 0) { var k = Math.min(1, (cyc - 0.9) * 2); ex = e[0] + (e[0] - cx) * 0.35 * k; ey = e[1] + (e[1] - cy) * 0.35 * k; }
      g.fillStyle = i === 0 ? '#ffb35c' : '#9a6a3a';
      g.beginPath(); g.arc(ex, ey, i === 0 ? 16 : 11, 0, Math.PI * 2); g.fill();
      if (r && r.id === 'tempest' && cyc > 0.9 && i > 0) {
        g.strokeStyle = 'rgba(155,225,93,' + (1 - (cyc - 0.9) / 1.3) + ')';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke();
        g.fillStyle = '#9be15d';
        g.beginPath(); g.arc(ex, ey - 16, 4, 0, Math.PI * 2); g.fill();
      }
    });
    // gauge pips: first at 0.2s, second at 0.9s
    if (cyc > 0.2 && (cyc < 0.9 || !r)) { g.fillStyle = G[RX.a].color; g.beginPath(); g.arc(cx - 8, cy - 28, 5, 0, Math.PI * 2); g.fill(); }
    if (cyc > 0.9 && !r) { g.fillStyle = G[RX.b].color; g.beginPath(); g.arc(cx + 8, cy - 28, 5, 0, Math.PI * 2); g.fill(); }
    // projectile painting the second gauge
    if (cyc > 0.55 && cyc < 0.9) { var k2 = (cyc - 0.55) / 0.35; g.fillStyle = G[RX.b].color; g.beginPath(); g.arc(30 + (cx - 30) * k2, cy - 10, 6, 0, Math.PI * 2); g.fill(); }
    if (cyc > 0.15 && cyc < 0.2) { g.fillStyle = G[RX.a].color; g.beginPath(); g.arc(cx, cy, 24, 0, Math.PI * 2); g.globalAlpha = 0.4; g.fill(); g.globalAlpha = 1; }
    if (r && cyc >= 0.9 && cyc < 0.92) {
      for (var i = 0; i < 46; i++) {
        var a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * (r.id === 'overload' ? 260 : 170);
        parts.push({ x: cx, y: cy - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8 + Math.random() * 0.5, c: i % 3 ? r.color : '#ffffff', s: r.id === 'shatter' ? 'shard' : 'dot' });
      }
    }
    if (r && cyc > 0.9) {
      var k3 = Math.min(1, (cyc - 0.9) / 0.6);
      var rad = (D.reactionRules[r.id] && D.reactionRules[r.id].radius) || 110;
      g.strokeStyle = r.color;
      g.globalAlpha = 1 - k3;
      g.lineWidth = 4;
      g.beginPath(); g.arc(cx, cy, rad * 0.8 * k3, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
      if (r.id === 'singularity') {
        g.strokeStyle = r.color;
        for (var s2 = 0; s2 < 3; s2++) { g.beginPath(); g.arc(cx, cy, 20 + s2 * 18, time * 4 + s2, time * 4 + s2 + 4); g.stroke(); }
      }
      if (r.id === 'superconduct') {
        g.font = font(16, 900);
        g.fillStyle = r.color;
        g.textAlign = 'center';
        g.fillText('−' + Math.round(D.reactionRules.superconduct.shred * 100) + '% DEF', cx, cy - 46 - k3 * 12);
      }
      g.font = font(18, 900);
      g.textAlign = 'center';
      g.fillStyle = r.color;
      g.globalAlpha = Math.min(1, (2.2 - cyc) * 2);
      g.fillText(t(r.name).split(' · ')[0], cx, 26);
      g.globalAlpha = 1;
    }
    for (var j = parts.length - 1; j >= 0; j--) {
      var p = parts[j];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(j, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94;
      g.globalAlpha = Math.min(1, p.life * 1.4);
      g.fillStyle = p.c;
      if (p.s === 'shard') { g.save(); g.translate(p.x, p.y); g.rotate(p.life * 6); g.fillRect(-4, -1.5, 8, 3); g.restore(); }
      else { g.beginPath(); g.arc(p.x, p.y, 2.4, 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  function sourcesTable() {
    var rows = D.elements.filter(function (e) { return e.gauge; }).map(function (e) {
      var gems = D.gems.filter(function (g) { return g.element === e.id; }).map(function (g) { return W.tok(g.item); });
      var pets = D.pets.filter(function (p) { return p.element === e.id; }).map(function (p) { return W.tok(p.id); });
      var br = D.branches.filter(function (b) { return b.element === e.id; }).map(function (b) { return '<span class="tag">' + esc(t(I.morph.leech.label)) + ': ' + esc(t(b.name)) + '</span>'; });
      var oils = D.items.filter(function (it) { return it.effect && it.effect.buff && it.effect.buff.oil === e.id; }).map(function (it) { return W.tok(it.id); });
      var skills = D.skills.filter(function (s) { return /fire|frost|lightning|void|holy|poison|wind/.test(''); });
      void skills;
      return '<tr><td>' + W.elBadge(e.id) + '</td><td>' + W.elBadge(e.gauge) + '</td><td><div class="chips">' + gems.concat(oils, pets, br).join(' ') + '</div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="dt"><thead><tr><th>' + esc(t(L('Hit element', 'יסוד המכה'))) + '</th><th>' + esc(t(L('Paints gauge', 'צובע מד'))) + '</th><th>' + esc(t(L('Sources', 'מקורות'))) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  // ================================================================ frame data tables
  function frameTables() {
    var groups = [
      [L('Input & basic attacks', 'קלט והתקפות בסיסיות'), [['inputBuffer', L('Input buffer', 'חוצץ קלט')], ['hitFrac', L('Hit frame (fraction of the swing)', 'פריים הפגיעה (חלק מההנפה)'), 'frac'], ['comboChain', L('Combo chain window', 'חלון שרשרת קומבו')], ['finisherCooldown', L('Pause after a finisher (÷ attack speed)', 'הפסקה אחרי סיום (÷ מהירות התקפה)')], ['attackMoveMult', L('Move speed while swinging', 'מהירות תנועה בזמן הנפה'), 'x'], ['stepHeavy', L('Kinetic step, finisher (px/s)', 'צעד קינטי, סיום (px/s)'), 'px']]],
      [L('Defense', 'הגנה'), [['dodgeDur', L('Dodge roll', 'גלגול התחמקות')], ['dodgeIframes', L('Dodge i-frames', 'חסינות בהתחמקות')], ['dodgeCooldown', L('Dodge cooldown', 'טעינת התחמקות')], ['dodgeStamina', L('Dodge Stamina cost', 'עלות סיבולת'), 'px'], ['parryWindow', L('Perfect Parry window', 'חלון הדיפה מושלמת')], ['parryFreeze', L('Parry time-freeze', 'הקפאת זמן בהדיפה')], ['riposteWindow', L('Counter-Riposte window', 'חלון תגובת-נגד')], ['riposteMult', L('Counter-Riposte damage', 'נזק תגובת-נגד'), 'x'], ['graceIframes', L('Grace i-frames after a big hit (≥' + Math.round(F.graceThreshold * 100) + '% HP)', 'חסינות חסד אחרי מכה גדולה (≥' + Math.round(F.graceThreshold * 100) + '% חיים)')]]],
      [L('Sword Skills', 'כישורי חרב'), [['preMotion', L('Pre-Motion (cancellable start)', 'קדם-תנועה (התחלה ניתנת לביטול)')], ['connectWindow', L('Skill Connect window', 'חלון חיבור כישורים')], ['connectMp', L('Connected skill MP cost', 'עלות מאנה בחיבור'), 'x'], ['connectStep', L('Damage per chain step', 'נזק לכל שלב בשרשרת'), 'pct'], ['novaMult', L('Finishing Nova damage', 'נזק נובת הסיום'), 'x'], ['switchBonus', L('First skill after SWITCH!', 'הכישור הראשון אחרי SWITCH!'), 'pct']]],
      [L('Break, knockback & Wall Slam', 'שבירה, הדיפה והטחה בקיר'), [['breakStun', L('Break stun (elites, bosses)', 'הלם שבירה (עילית, בוסים)')], ['breakStunSmall', L('Break stun (monsters)', 'הלם שבירה (מפלצות)')], ['breakCritMult', L('Crit multiplier while broken', 'מכפיל קריטי בזמן שבירה'), 'x'], ['hitstop', L('Hit-stop per hit', 'עצירת פגיעה')], ['kbDecay', L('Knockback decay (per second)', 'דעיכת הדיפה (לשנייה)'), 'x'], ['slamSpeed', L('Wall Slam minimum speed (px/s)', 'מהירות מינימום להטחה (px/s)'), 'px'], ['slamDmg', L('Wall Slam bonus damage', 'נזק בונוס בהטחה'), 'pct'], ['slamStun', L('Wall Slam stun', 'הלם הטחה')], ['weakMult', L('Elemental weakness', 'חולשה יסודית'), 'x'], ['resistMult', L('Elemental resistance', 'עמידות יסודית'), 'x']]],
    ];
    return '<div class="cols2">' + groups.map(function (gr) {
      return '<div class="panel tight"><h3 class="mt0">' + esc(t(gr[0])) + '</h3><div class="table-wrap"><table class="dt"><tbody>' + gr[1].map(function (r) {
        var v = F[r[0]];
        var val = r[2] === 'frac' ? n(Math.round(v * 100) + '%') : r[2] === 'x' ? n('×' + v) : r[2] === 'pct' ? n('+' + Math.round(v * 100) + '%') : r[2] === 'px' ? n(v) : W.secs(v) + ' <span class="dim small">' + W.frames(v) + '</span>';
        return '<tr><td>' + esc(t(r[1])) + '</td><td class="r"><b>' + val + '</b></td></tr>';
      }).join('') + '</tbody></table></div></div>';
    }).join('') + '</div>';
  }

  // ================================================================ combat docs page
  function combatPage() {
    return '<div class="page-head"><div><h1>' + esc(t(L('Combat & Mechanics Documentation', 'תיעוד הקרב והמכניקות'))) + '</h1><p>' + fmt(L('Animated, interactive diagrams of the action system. Every window, multiplier and threshold is read from the game\'s frame-data table (src/data/framedata.ts), and the skill timelines come from running each Sword Skill\'s own script.', 'דיאגרמות מונפשות ואינטראקטיביות של מערכת הקרב. כל חלון, מכפיל וסף נקראים מטבלת נתוני הפריימים של המשחק (src/data/framedata.ts), וצירי הזמן של הכישורים מגיעים מהרצת התסריט של כל כישור חרב.')) + '</p></div>' +
      '<div class="chips"><a class="chip" href="#combat-docs/timeline">' + esc(t(L('Frame data', 'נתוני פריימים'))) + '</a><a class="chip" href="#combat-docs/physics">' + esc(t(L('Wall Slam & Break', 'הטחה ושבירה'))) + '</a><a class="chip" href="#combat-docs/reactions">' + esc(t(L('Reactions', 'תגובות'))) + '</a><a class="chip" href="#combat-docs/tables">' + esc(t(L('All values', 'כל הערכים'))) + '</a></div></div>' +
      '<section id="sec-timeline"><div class="section-title"><h2>' + esc(t(L('Timeline frame-data visualizer', 'מציג נתוני פריימים על ציר זמן'))) + '</h2><span class="line"></span></div>' +
      '<div class="viz"><canvas id="tl-canvas"></canvas><div class="viz-ui" id="tl-ui">' + timelineControls() + '</div></div>' +
      '<div class="legend" style="margin-top:8px">' + [['#ff9a3d', L('Startup', 'הכנה')], ['#ffffff', L('Active hit', 'פגיעה')], ['#5b6b88', L('Recovery', 'התאוששות')], ['#5ee6a0', L('Cancel / i-frames', 'ביטול / חסינות')], ['#7fe9ff', L('Input buffer / Skill Connect', 'חוצץ קלט / חיבור')], ['#ffd166', L('Perfect Parry', 'הדיפה מושלמת')], ['#b46cff', L('Riposte', 'תגובת-נגד')], ['#ffe066', L('Pre-Motion', 'קדם-תנועה')]].map(function (x) { return '<span><i style="--c:' + x[0] + '"></i>' + esc(t(x[1])) + '</span>'; }).join('') + '</div></section>' +
      '<section id="sec-physics"><div class="section-title"><h2>' + esc(t(L('Wall-Slam & Break-Bar physics', 'פיזיקת הטחה בקיר ומד שבירה'))) + '</h2><span class="line"></span></div><div class="cols2">' +
      '<div class="viz"><canvas id="slam-canvas"></canvas><div class="viz-ui">' +
      '<label class="lab" style="min-width:170px">' + esc(t(L('Knockback power', 'עוצמת הדיפה'))) + ' <b class="gold" id="ph-kb-out">' + PH.kb + '</b><input type="range" id="ph-kb" min="40" max="320" step="10" value="' + PH.kb + '" /></label>' +
      '<label class="lab" style="min-width:170px">' + esc(t(L('Distance to wall', 'מרחק מהקיר'))) + ' <b class="gold" id="ph-dist-out">' + PH.dist + ' px</b><input type="range" id="ph-dist" min="2" max="40" step="1" value="' + PH.dist + '" /></label>' +
      '<select class="field" id="ph-type">' + [['monster', L('Monster (×1 knockback)', 'מפלצת (הדיפה ×1)')], ['elite', L('Elite (×0.35)', 'עילית (×0.35)')], ['boss', L('Boss (×0.08)', 'בוס (×0.08)')]].map(function (o) { return '<option value="' + o[0] + '"' + (PH.type === o[0] ? ' selected' : '') + '>' + esc(t(o[1])) + '</option>'; }).join('') + '</select>' +
      '<label class="switch"><input type="checkbox" id="ph-ks"' + (PH.ks ? ' checked' : '') + ' />' + esc(t(I.keystone.ks_spear.name)) + '</label>' +
      '<label class="switch"><input type="checkbox" id="ph-wind"' + (PH.wind ? ' checked' : '') + ' />' + esc(t(L('Wind gem (+60 kb)', 'אבן רוח (+60 הדיפה)'))) + '</label></div></div>' +
      '<div class="panel"><select class="field" id="ph-boss">' + D.monsters.filter(function (m) { return m.boss || m.elite; }).map(function (m) { return '<option value="' + m.id + '"' + (PH.boss === m.id ? ' selected' : '') + '>' + esc(t(m.name)) + '</option>'; }).join('') + '</select><div id="brk-box" style="margin-top:10px">' + breakHtml() + '</div>' +
      '<div class="chips" style="margin-top:10px">' + [['parry', L('Perfect Parry', 'הדיפה מושלמת')], ['slam', L('Wall Slam', 'הטחה בקיר')], ['shatter', L('SHATTER', 'SHATTER')], ['bash', I.skill.sh_bash.name], ['piercer', I.skill.sw_crimson_piercer.name], ['basic', L('Basic finisher', 'סיום בסיסי')]].map(function (b) { return '<button type="button" class="chip" data-brk="' + b[0] + '">' + esc(t(b[1])) + '</button>'; }).join('') + '<button type="button" class="chip" data-brk="reset">↺</button></div>' +
      '<p class="small dim" style="margin-top:10px">' + fmt(L('Knockback = power × resist; velocity decays by ' + F.kbDecay + '/s, so a target slides about power ÷ ' + F.kbDecay + ' px. A Wall Slam needs ≥ ' + F.slamSpeed + ' px/s at impact (' + F.slamSpeedKeystone + ' with Dragoon\'s Momentum) within ' + F.kbFresh + 's of the hit.', 'הדיפה = עוצמה × עמידות; המהירות דועכת ב-' + F.kbDecay + ' לשנייה, כך שמטרה מחליקה בערך עוצמה ÷ ' + F.kbDecay + ' פיקסלים. הטחה בקיר דורשת ≥ ' + F.slamSpeed + ' px/s בפגיעה (' + F.slamSpeedKeystone + ' עם תנופת הדרגון) בתוך ' + F.kbFresh + ' ש׳ מהמכה.')) + '</p></div></div></section>' +
      '<section id="sec-reactions"><div class="section-title"><h2>' + esc(t(L('6-way elemental reaction simulator', 'סימולטור תגובות יסודות בשש דרכים'))) + '</h2><span class="line"></span></div>' +
      '<div class="cols2"><div><div id="rx-matrix">' + matrixHtml() + '</div></div><div><div class="viz"><canvas id="rx-canvas"></canvas></div><div class="panel" id="rx-card" style="margin-top:12px">' + rxCard() + '</div></div></div>' +
      '<h3>' + esc(t(L('Which hits paint which gauge', 'אילו מכות צובעות איזה מד'))) + '</h3>' + sourcesTable() + '</section>' +
      '<section id="sec-tables"><div class="section-title"><h2>' + esc(t(L('Every frame-data value', 'כל ערכי נתוני הפריימים'))) + '</h2><span class="line"></span></div>' + frameTables() + '</section>';
  }
  function combatAfter(args, root) {
    var tl = root.querySelector('#tl-canvas');
    if (tl) loop(tl, function (time) { drawTimeline(tl, time); });
    function bindTl() {
      var ui = root.querySelector('#tl-ui');
      ui.querySelectorAll('[data-scen]').forEach(function (b) { b.addEventListener('click', function () { TL.scen = b.getAttribute('data-scen'); ui.innerHTML = timelineControls(); bindTl(); }); });
      var md = ui.querySelector('#tl-mode'); if (md) md.addEventListener('change', function () { TL.mode = md.value; });
      var as = ui.querySelector('#tl-aspd'); if (as) as.addEventListener('input', function () { TL.aspd = +as.value; ui.querySelector('#tl-aspd-out').textContent = '×' + TL.aspd.toFixed(2); });
      var pr = ui.querySelector('#tl-press'); if (pr) pr.addEventListener('input', function () { TL.press = +pr.value; ui.querySelector('#tl-press-out').textContent = TL.press.toFixed(2) + 's'; });
      var rp = ui.querySelector('#tl-rip'); if (rp) rp.addEventListener('change', function () { TL.rip = +rp.value; });
      var ks = ui.querySelector('#tl-ks'); if (ks) ks.addEventListener('change', function () { TL.ks = ks.checked; });
      ui.querySelectorAll('[data-chain]').forEach(function (s) { s.addEventListener('change', function () { TL.chain[+s.getAttribute('data-chain')] = s.value; }); });
    }
    if (root.querySelector('#tl-ui')) bindTl();
    var sc = root.querySelector('#slam-canvas');
    var last = performance.now();
    if (sc) loop(sc, function (time) { var now = performance.now(); var dt = (now - last) / 1000; last = now; drawSlam(sc, time, dt); });
    function on(id, ev, fn) { var el = root.querySelector(id); if (el) el.addEventListener(ev, function () { fn(el); }); }
    on('#ph-kb', 'input', function (el) { PH.kb = +el.value; root.querySelector('#ph-kb-out').textContent = PH.kb; sim = null; });
    on('#ph-dist', 'input', function (el) { PH.dist = +el.value; root.querySelector('#ph-dist-out').textContent = PH.dist + ' px'; sim = null; });
    on('#ph-type', 'change', function (el) { PH.type = el.value; sim = null; });
    on('#ph-ks', 'change', function (el) { PH.ks = el.checked; sim = null; });
    on('#ph-wind', 'change', function (el) { PH.wind = el.checked; sim = null; });
    on('#ph-boss', 'change', function (el) { PH.boss = el.value; PH.brk = 0; PH.broken = 0; root.querySelector('#brk-box').innerHTML = breakHtml(); });
    root.querySelectorAll('[data-brk]').forEach(function (b) {
      b.addEventListener('click', function () { var k = b.getAttribute('data-brk'); if (k === 'reset') { PH.brk = 0; PH.broken = 0; } else addBreak(k); root.querySelector('#brk-box').innerHTML = breakHtml(); });
    });
    var bt = performance.now();
    var brkTimer = setInterval(function () {
      var box = document.getElementById('brk-box');
      if (!box) { clearInterval(brkTimer); return; }
      var now = performance.now(), dt = (now - bt) / 1000;
      bt = now;
      var max = E.monsterAt(PH.boss, I.monster[PH.boss].level).poise;
      if (PH.broken > 0) { PH.broken = Math.max(0, PH.broken - dt); if (PH.broken <= 0) PH.brk = 0; }
      else if (PH.delay > 0) PH.delay -= dt;
      else if (PH.brk > 0) PH.brk = Math.max(0, PH.brk - max * F.breakDecay * dt);
      box.innerHTML = breakHtml();
    }, 100);
    var rc = root.querySelector('#rx-canvas');
    var lr = performance.now();
    if (rc) loop(rc, function (time) { var now = performance.now(); var dt = Math.min(0.05, (now - lr) / 1000); lr = now; drawReaction(rc, time, dt); });
    function bindRx() {
      root.querySelectorAll('[data-rx]').forEach(function (b) {
        b.addEventListener('click', function () {
          var ab = b.getAttribute('data-rx').split(',');
          RX.a = ab[0]; RX.b = ab[1];
          root.querySelector('#rx-matrix').innerHTML = matrixHtml();
          root.querySelector('#rx-card').innerHTML = rxCard();
          bindRx();
        });
      });
    }
    bindRx();
    if (args[0] === 'reactions') {
      var m = /^(\w+)$/.exec(args[1] || '');
      if (m && I.reaction[m[1]]) { RX.a = I.reaction[m[1]].a; RX.b = I.reaction[m[1]].b || 'burn'; }
    }
  }

  // ================================================================ realm atlas
  var AT = { realm: 0, kind: 'wild', zoom: 1, ox: 0, oy: 0, layers: { gates: true, services: true, estate: true, ore: true, herb: true, fishing: true, spawn: true, elite: true, dungeon: true, boss: true, chest: true, pad: false, raid: true }, cache: {} };
  var LAYERS = [
    ['gates', '#7fe9ff', L('Teleport gates & exits', 'שערי שיגור ויציאות')],
    ['services', '#ffd166', L('City services', 'שירותי העיר')],
    ['estate', '#ff9ad0', L('Player house deeds', 'שטרי בתים')],
    ['ore', '#c8733a', L('Ore veins (by metal tier)', 'עורקי עפרה (לפי דרגת מתכת)')],
    ['herb', '#9be15d', L('Herb groves', 'חורשות צמחים')],
    ['fishing', '#5ab8ff', L('Fishing spots', 'נקודות דיג')],
    ['spawn', '#ffb35c', L('Day monster spawns', 'מפלצות יום')],
    ['elite', '#b46cff', L('Night elite lair 20:00-05:00', 'מאורת עילית לילה 20:00-05:00')],
    ['dungeon', '#ff5d6c', L('Dungeon entrance', 'כניסה למבוך')],
    ['boss', '#ff3b5c', L('Boss arena', 'זירת בוס')],
    ['chest', '#ffe066', L('Treasure chests', 'תיבות אוצר')],
    ['pad', '#bff3ff', L('Jump pads', 'משטחי קפיצה')],
    ['raid', '#ff4f7b', L('Raid boss roaming range (night)', 'טווח שיטוט בוסי פשיטה (לילה)')],
  ];
  function layerOf(p) {
    var ty = p.type;
    if (ty === 'gate' || ty === 'exit' || ty === 'prop:gate' || ty === 'abyss' || ty === 'prop:abyssgate' || ty === 'leaveDungeon') return 'gates';
    if (ty === 'estate' || ty === 'house') return 'estate';
    if (/^shop:|^forge$|^alchemy$|^cooking$|^guild$|^stable$|^blackmarket$|^coliseum$/.test(ty)) return 'services';
    if (ty === 'ore' || ty === 'herb' || ty === 'fishing' || ty === 'spawn' || ty === 'elite' || ty === 'boss' || ty === 'chest' || ty === 'pad') return ty;
    if (ty === 'dungeon' || ty === 'prop:dungeon') return 'dungeon';
    return null;
  }
  var ORE_TIER_COLORS = ['#c8733a', '#dfe5ee', '#6fd0e8', '#e6ae47', '#d0304a', '#c4e8ff', '#7b56d6'];
  function atlasData() {
    var key = AT.realm + ':' + AT.kind;
    var c = AT.cache[key];
    if (c) return c;
    var a = E.atlas(AT.realm, AT.kind);
    var off = document.createElement('canvas');
    var s = 0.5;
    off.width = Math.round(a.w * a.tile * s);
    off.height = Math.round(a.h * a.tile * s);
    a.paint(off.getContext('2d'), s);
    c = { a: a, img: off, s: s };
    AT.cache = {};
    AT.cache[key] = c;
    return c;
  }
  function poiColor(p) {
    var l = layerOf(p);
    if (l === 'ore') { var it = I.item[p.item]; return ORE_TIER_COLORS[Math.min(6, it ? it.tier || 0 : 0)] || '#c8733a'; }
    var x = LAYERS.filter(function (y) { return y[0] === l; })[0];
    return x ? x[1] : '#ffffff';
  }
  function poiLabel(p) {
    var R = D.realms[AT.realm];
    switch (p.type) {
      case 'ore': case 'herb': return t(I.item[p.item].name);
      case 'fishing': return t(L('Fishing spot', 'נקודת דיג')) + ': ' + D.fish.filter(function (f) { return f.realm === AT.realm; }).map(function (f) { return t(I.item[f.id].name); }).join(', ');
      case 'spawn': return p.monsters.map(function (id) { return t(I.monster[id].name); }).join(' / ') + ' · ' + t(L('Lv', 'רמה')) + ' ' + p.lvl[0] + '-' + p.lvl[1];
      case 'elite': return t(I.monster[R.elite].name) + ' · 20:00-05:00';
      case 'boss': return I.monster[p.boss] ? t(I.monster[p.boss].name) + ' · ' + t(L('Lv', 'רמה')) + ' ' + p.lvl[0] : t(L('Boss arena', 'זירת בוס'));
      case 'chest': return t(L('Treasure chest', 'תיבת אוצר')) + ' · ' + W.rarityName(p.rarity);
      case 'pad': return t(L('Jump pad', 'משטח קפיצה'));
      case 'estate': return t(R.buildings.estate) + ' · ' + t(R.house.name) + ' · ' + R.house.price.toLocaleString() + ' G';
      case 'dungeon': case 'prop:dungeon': return t(R.dungeon);
      case 'prop:gate': case 'gate': return t(L('Teleport Gate', 'שער שיגור'));
      default: return p.label || p.type;
    }
  }
  function poiLink(p) {
    var R = D.realms[AT.realm];
    if (p.type === 'ore' || p.type === 'herb') return '#items/' + p.item;
    if (p.type === 'spawn') return '#droprates/' + p.monsters[0];
    if (p.type === 'elite') return '#droprates/' + R.elite;
    if (p.type === 'boss' && I.monster[p.boss]) return '#droprates/' + p.boss;
    if (p.type === 'dungeon' || p.type === 'prop:dungeon') return '#maps/' + AT.realm + '/dungeon';
    if (p.type === 'exit' && AT.kind === 'city') return '#maps/' + AT.realm + '/wild';
    if (p.type === 'exit' && AT.kind === 'wild') return '#maps/' + AT.realm + '/city';
    return null;
  }
  function drawAtlas(c, time) {
    var cv = sizeCanvas(c, c.clientHeight || 600);
    var g = cv.g, w = cv.w, h = cv.h;
    var A = atlasData();
    var a = A.a;
    var fit = Math.min(w / (a.w * a.tile), h / (a.h * a.tile));
    var sc = fit * AT.zoom;
    var mw = a.w * a.tile * sc, mh = a.h * a.tile * sc;
    AT.ox = Math.min(Math.max(AT.ox, Math.min(0, w - mw)), Math.max(0, w - mw));
    AT.oy = Math.min(Math.max(AT.oy, Math.min(0, h - mh)), Math.max(0, h - mh));
    if (AT.zoom === 1) { AT.ox = (w - mw) / 2; AT.oy = (h - mh) / 2; }
    g.fillStyle = '#03060d';
    g.fillRect(0, 0, w, h);
    g.imageSmoothingQuality = 'high';
    g.drawImage(A.img, AT.ox, AT.oy, mw, mh);
    AT.view = { sc: sc, ox: AT.ox, oy: AT.oy, w: w, h: h };
    var pulse = 0.5 + 0.5 * Math.sin(time * 3);
    if (AT.layers.raid && AT.kind === 'wild') {
      g.save();
      g.strokeStyle = 'rgba(255,79,123,' + (0.35 + 0.25 * pulse) + ')';
      g.setLineDash([10, 8]);
      g.lineWidth = 3;
      g.strokeRect(AT.ox + 4, AT.oy + 4, mw - 8, mh - 8);
      g.restore();
    }
    AT.hits = [];
    a.pois.forEach(function (p) {
      var l = layerOf(p);
      if (!l || !AT.layers[l]) return;
      var x = AT.ox + p.x * sc, y = AT.oy + p.y * sc;
      var col = poiColor(p);
      if (p.type === 'spawn' || p.type === 'boss') {
        g.fillStyle = col;
        g.globalAlpha = p.type === 'boss' ? 0.18 : 0.13;
        g.beginPath(); g.arc(x, y, Math.max(10, (p.r || 60) * sc), 0, Math.PI * 2); g.fill();
        g.globalAlpha = 0.7;
        g.strokeStyle = col;
        g.lineWidth = 1.5;
        g.stroke();
        g.globalAlpha = 1;
      }
      var r = p.type === 'elite' || p.type === 'boss' || p.type === 'dungeon' || p.type === 'prop:dungeon' || p.type === 'prop:gate' ? 8 + pulse * 2 : p.type === 'spawn' ? 5 : 4.5;
      g.fillStyle = 'rgba(3,6,13,0.75)';
      g.beginPath(); g.arc(x, y, r + 2.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = col;
      if (p.type === 'ore') { g.beginPath(); g.moveTo(x, y - r - 1); g.lineTo(x + r + 1, y); g.lineTo(x, y + r + 1); g.lineTo(x - r - 1, y); g.closePath(); g.fill(); }
      else if (p.type === 'elite') { g.beginPath(); for (var k = 0; k < 10; k++) { var ang = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); } g.closePath(); g.fill(); }
      else { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
      AT.hits.push({ x: x, y: y, r: Math.max(r + 4, p.type === 'spawn' || p.type === 'boss' ? Math.max(10, (p.r || 60) * sc * 0.6) : 0), p: p });
    });
  }
  function atlasPage(args) {
    if (args[0] != null && args[0] !== '' && !isNaN(+args[0])) AT.realm = Math.max(0, Math.min(D.realms.length - 1, +args[0]));
    if (args[1] === 'city' || args[1] === 'wild' || args[1] === 'dungeon') AT.kind = args[1];
    var R = D.realms[AT.realm];
    var realms = D.realms.map(function (r, i) { return '<a class="chip' + (AT.realm === i ? ' on' : '') + '" href="#maps/' + i + '/' + AT.kind + '">' + esc(t(r.short)) + ' <span class="dim small">' + n(r.levels[0] + '-' + r.levels[1]) + '</span></a>'; }).join('');
    var kinds = [['city', R.city], ['wild', R.short], ['dungeon', R.dungeon]].map(function (k) { return '<a class="chip' + (AT.kind === k[0] ? ' on' : '') + '" href="#maps/' + AT.realm + '/' + k[0] + '">' + esc(t(k[1])) + '</a>'; }).join('');
    var A = atlasData();
    var counts = {};
    A.a.pois.forEach(function (p) { var l = layerOf(p); if (l) counts[l] = (counts[l] || 0) + 1; });
    var layers = LAYERS.map(function (l) {
      var cnt = l[0] === 'raid' ? (AT.kind === 'wild' ? '∞' : 0) : counts[l[0]] || 0;
      if (!cnt) return '';
      var lab = l[0] === 'spawn' && AT.kind === 'dungeon' ? L('Monster rooms', 'חדרי מפלצות') : l[2];
      return '<label class="layer"><input type="checkbox" data-layer="' + l[0] + '"' + (AT.layers[l[0]] ? ' checked' : '') + ' /><span class="sw" style="--c:' + l[1] + '"></span><span>' + esc(t(lab)) + '</span><span class="cnt">' + cnt + '</span></label>';
    }).join('');
    var oreLegend = AT.kind === 'wild' ? '<div class="legend" style="margin-top:8px">' + R.ores.map(function (o) { var it = I.item[o]; return '<span><i style="--c:' + ORE_TIER_COLORS[it.tier || 0] + '"></i>' + esc(t(it.name)) + '</span>'; }).join('') + '</div>' : '';
    var info = AT.kind === 'city' ? fmt(L(t(R.cityTitle) + '. The Teleport Gate links every unlocked city. Houses: ' + t(R.house.name) + ' for ' + R.house.price.toLocaleString() + ' gold at ' + t(R.buildings.estate) + '.', t(R.cityTitle) + '. שער השיגור מחבר את כל הערים שנפתחו. בתים: ' + t(R.house.name) + ' תמורת ' + R.house.price.toLocaleString() + ' זהב ב' + t(R.buildings.estate) + '.')) :
      AT.kind === 'wild' ? fmt(L(t(R.desc) + ' Levels ' + R.levels[0] + '-' + R.levels[1] + '. Weather: ' + R.weather.filter(function (x, i, arr) { return arr.indexOf(x) === i; }).map(function (wx) { return t(I.weather[wx].name); }).join(', ') + '. Roaming raid bosses can appear anywhere at night.', t(R.desc) + ' רמות ' + R.levels[0] + '-' + R.levels[1] + '. מזג אוויר: ' + R.weather.filter(function (x, i, arr) { return arr.indexOf(x) === i; }).map(function (wx) { return t(I.weather[wx].name); }).join(', ') + '. בוסי פשיטה נודדים יכולים להופיע בכל מקום בלילה.')) :
        fmt(L(t(R.dungeonDesc) + ' Monsters level ' + (R.levels[1] - 2) + '-' + (R.levels[1] + 1) + '; the guardian waits in the boss arena.', t(R.dungeonDesc) + ' מפלצות ברמה ' + (R.levels[1] - 2) + '-' + (R.levels[1] + 1) + '; השומר מחכה בזירת הבוס.'));
    return '<div class="page-head"><div><h1>' + esc(t(L('Interactive Realm & Dungeon Atlas', 'אטלס ממלכות ומבוכים אינטראקטיבי'))) + '</h1><p>' + fmt(L('These are the real maps: the game\'s own map generator and terrain renderer draw them here, tile for tile. Drag to pan, scroll or use +/- to zoom, hover a marker for details and click it to open its page.', 'אלה המפות האמיתיות: מחולל המפות ומנוע ציור השטח של המשחק מציירים אותן כאן, אריח אחר אריח. גררו כדי להזיז, גללו או השתמשו ב-+/- כדי להתקרב, רחפו מעל סמן לפרטים ולחצו כדי לפתוח את העמוד שלו.')) + '</p></div></div>' +
      '<div class="controls"><div class="chips">' + realms + '</div></div><div class="controls"><div class="chips">' + kinds + '</div></div>' +
      '<div class="layout"><aside class="side" style="top:118px"><div class="panel tight" style="width:100%"><h3 class="mt0">' + esc(t(L('Layers', 'שכבות'))) + '</h3><div class="layer-list">' + layers + '</div>' + oreLegend + '</div><div class="panel tight small" style="width:100%">' + info + '</div></aside>' +
      '<div><div class="atlas-wrap"><canvas id="atlas" aria-label="' + esc(t(L('Map of', 'מפה של'))) + ' ' + esc(t(R.name)) + '"></canvas><div class="atlas-zoom"><button type="button" data-zoom="1.4" aria-label="+">+</button><button type="button" data-zoom="0.7" aria-label="-">−</button><button type="button" data-zoom="0" aria-label="reset">⟲</button></div></div>' +
      '<p class="small dim" id="atlas-hint">' + fmt(L('Map ' + A.a.w + '×' + A.a.h + ' tiles' + (A.a.hasElev ? ' with raised plateaus and stairs' : '') + '.', 'מפה בגודל ' + A.a.w + '×' + A.a.h + ' אריחים' + (A.a.hasElev ? ' עם רמות מוגבהות ומדרגות' : '') + '.')) + '</p></div></div>';
  }
  function atlasAfter(args, root) {
    var c = root.querySelector('#atlas');
    if (!c) return;
    AT.zoom = 1;
    loop(c, function (time) { drawAtlas(c, time); });
    root.querySelectorAll('[data-layer]').forEach(function (cb) { cb.addEventListener('change', function () { AT.layers[cb.getAttribute('data-layer')] = cb.checked; }); });
    function zoomAt(f, cx, cy) {
      var v = AT.view;
      if (!v) return;
      if (f === 0) { AT.zoom = 1; return; }
      var nz = Math.max(1, Math.min(6, AT.zoom * f));
      var k = nz / AT.zoom;
      AT.ox = cx - (cx - AT.ox) * k;
      AT.oy = cy - (cy - AT.oy) * k;
      AT.zoom = nz;
    }
    root.querySelectorAll('[data-zoom]').forEach(function (b) { b.addEventListener('click', function () { zoomAt(+b.getAttribute('data-zoom'), c.clientWidth / 2, c.clientHeight / 2); }); });
    c.addEventListener('wheel', function (e) { e.preventDefault(); var r = c.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.18 : 0.85, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    var drag = null;
    c.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, ox: AT.ox, oy: AT.oy, moved: false }; c.setPointerCapture(e.pointerId); c.classList.add('drag'); });
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      var mx = e.clientX - r.left, my = e.clientY - r.top;
      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (AT.zoom > 1) { AT.ox = drag.ox + dx; AT.oy = drag.oy + dy; }
        return;
      }
      var hit = (AT.hits || []).filter(function (hh) { return Math.hypot(hh.x - mx, hh.y - my) <= hh.r; }).sort(function (a, b) { return a.r - b.r; })[0];
      var tip = document.getElementById('tip');
      if (hit) {
        tip.innerHTML = '<h5 style="--rc:' + poiColor(hit.p) + '">' + esc(poiLabel(hit.p)) + '</h5>' + (poiLink(hit.p) ? '<span class="dim small">' + esc(t(L('Click to open', 'לחצו לפתיחה'))) + '</span>' : '');
        tip.hidden = false;
        tip.style.left = Math.min(window.innerWidth - 300, e.clientX + 14) + 'px';
        tip.style.top = (e.clientY + 16) + 'px';
        c.style.cursor = poiLink(hit.p) ? 'pointer' : 'help';
      } else { tip.hidden = true; c.style.cursor = ''; }
      AT.hover = hit;
    });
    c.addEventListener('pointerup', function (e) {
      c.classList.remove('drag');
      var moved = drag && drag.moved;
      drag = null;
      if (!moved && AT.hover && poiLink(AT.hover.p)) { document.getElementById('tip').hidden = true; location.hash = poiLink(AT.hover.p); }
      void e;
    });
    c.addEventListener('pointerleave', function () { document.getElementById('tip').hidden = true; });
  }

  W.register({ id: 'maps', title: L('Atlas Maps', 'מפות'), nav: true, order: 7, render: atlasPage, after: atlasAfter });
  W.register({ id: 'combat-docs', title: L('Combat Docs', 'תיעודים מהמשחק'), nav: true, order: 8, render: combatPage, after: combatAfter });
})();
