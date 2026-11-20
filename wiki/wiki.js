/* Aetheria Codex & Database - core: language, router, sprites, search, tooltips and the home page.
   Every number and name comes from window.AETHERIA_DATA (generated from the game's src/data) and every
   sprite is drawn by window.AetheriaEngine (the game's own renderers). No build step for these files. */
(function () {
  'use strict';
  var D = window.AETHERIA_DATA;
  var E = window.AetheriaEngine;

  // ================================================================ language
  var lang = 'en';
  try {
    var saved = localStorage.getItem('aetheria.wiki.lang');
    if (saved === 'en' || saved === 'he') lang = saved;
    else if ((navigator.language || '').toLowerCase().indexOf('he') === 0) lang = 'he';
  } catch (e) { /* storage unavailable */ }
  var urlLang = /[?&]lang=(en|he)/.exec(location.search);
  if (urlLang) lang = urlLang[1];

  function L(en, he) { return { en: en, he: he }; }
  function t(o) { return o == null ? '' : typeof o === 'object' ? (o[lang] != null ? o[lang] : o.en) : String(o); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /** escaped text; in Hebrew every number / percentage is isolated so signs and % never flip */
  function fmt(o) {
    var s = esc(t(o));
    if (lang !== 'he') return s;
    return s.replace(/[+\-−]?\d[\d,]*(?:\.\d+)?%?/g, function (m) { return '<bdi class="n">' + m + '</bdi>'; });
  }
  /** bilingual name: Hebrew first with the English original dimmed (search friendly) */
  function bi(o) {
    if (lang === 'he' && o && o.he && o.en !== o.he) return esc(o.he) + ' <span class="dim small" lang="en">' + esc(o.en) + '</span>';
    return esc(t(o));
  }
  function n(x) { return '<bdi class="n">' + x + '</bdi>'; }
  function num(x) { return n(Math.round(x).toLocaleString('en-US')); }
  function pct(p, d) {
    if (p == null || isNaN(p)) return '-';
    if (p >= 1) return n('100%');
    if (p <= 0) return n('0%');
    var v = p * 100;
    var s = d != null ? v.toFixed(d) : v >= 10 ? v.toFixed(1).replace(/\.0$/, '') : v >= 1 ? v.toFixed(2).replace(/0$/, '').replace(/\.$/, '') : v >= 0.01 ? v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : '<0.01';
    return n(s + '%');
  }
  function secs(s) { return n(+s.toFixed(3) + (lang === 'he' ? ' ש׳' : 's')); }
  function frames(s) { return n(Math.round(s * D.meta.simHz)) + ' ' + esc(t(L('frames', 'פריימים'))); }

  // ================================================================ indexes
  function index(arr, key) { var o = {}; (arr || []).forEach(function (x) { o[x[key || 'id']] = x; }); return o; }
  var I = {
    item: index(D.items), gear: index(D.gear), base: index(D.gearBases), unique: index(D.uniques), set: index(D.sets),
    monster: index(D.monsters), skill: index(D.skills), passive: index(D.passives), power: index(D.powers), pet: index(D.pets),
    mount: index(D.mounts), companion: index(D.companions), keystone: index(D.keystones), bridge: index(D.bridges),
    reaction: index(D.reactions), gem: index(D.gems), branch: index(D.branches), element: index(D.elements), gauge: index(D.gauges),
    status: index(D.statuses), stat: index(D.statLabels), weather: index(D.weather), guild: index(D.guilds), grade: index(D.grades),
    morph: index(D.morphs, 'kind'), weapon: index(D.weapons), recipeOut: {},
  };
  D.recipes.forEach(function (r) { (I.recipeOut[r.out] = I.recipeOut[r.out] || []).push(r); });

  var STAT_ORDER = ['atk', 'mag', 'def', 'hp', 'mp', 'atkPct', 'magPct', 'defPct', 'hpPct', 'crit', 'critDmg', 'aspd', 'move', 'brk', 'block', 'regen', 'lifesteal', 'skillDmg', 'cdr', 'magicFind', 'xpPct'];
  function statName(k) { return I.stat[k] ? t(I.stat[k].name) : k; }
  function statVal(k, v) {
    var pctStat = I.stat[k] ? I.stat[k].pct : false;
    if (pctStat) return n((v > 0 ? '+' : '') + (+(v * 100).toFixed(1)) + '%');
    return n((v > 0 ? '+' : '') + Math.round(v));
  }
  function statList(st, prev) {
    var keys = STAT_ORDER.filter(function (k) { return st[k]; });
    if (!keys.length) return '<p class="dim">-</p>';
    return '<div class="stats">' + keys.map(function (k) {
      var up = prev && prev[k] != null && Math.abs(prev[k] - st[k]) > 1e-9;
      return '<div class="stat"><span>' + esc(statName(k)) + '</span><span class="v' + (up ? ' up' : '') + '">' + statVal(k, st[k]) + '</span></div>';
    }).join('') + '</div>';
  }
  function statInline(st) {
    return STAT_ORDER.filter(function (k) { return st[k]; }).map(function (k) { return statVal(k, st[k]) + ' ' + esc(statName(k)); }).join(' · ');
  }
  function rarityName(r) { return t(D.rarity[r].name); }
  function rarityBadge(r) { return '<span class="badge r' + r + '" style="--c:var(--rc)">' + esc(rarityName(r)) + '</span>'; }
  function elBadge(id) { var e = I.element[id] || I.gauge[id]; return e ? '<span class="el" style="--c:' + e.color + '">' + esc(t(e.name)) + '</span>' : ''; }

  // ================================================================ sprites (lazy, high-DPI, drawn by the game's renderers)
  var SPR = [];
  /** returns an HTML placeholder that hydrate() turns into a canvas */
  function sprite(kind, spec, cls, rarity) {
    var id = SPR.length;
    SPR.push({ kind: kind, spec: spec });
    var r = rarity == null ? '' : ' r' + rarity + (rarity >= 3 ? ' sheen' + (rarity >= 5 ? ' r5' : '') : '');
    return '<span class="sprite ' + (cls || '') + r + '" data-spr="' + id + '" aria-hidden="true"></span>';
  }
  var DPR = Math.min(2.5, window.devicePixelRatio || 1);
  function paintSprite(el) {
    var s = SPR[+el.getAttribute('data-spr')];
    if (!s || el.firstChild) return;
    var w = el.clientWidth || 64;
    var h = el.clientHeight || 64;
    var c = document.createElement('canvas');
    c.width = Math.round(w * DPR);
    c.height = Math.round(h * DPR);
    el.appendChild(c);
    var g = c.getContext('2d');
    g.scale(DPR, DPR);
    drawSprite(g, s, w, h, 0.8);
  }
  function drawSprite(g, s, w, h, time) {
    try {
      if (s.kind === 'item' || s.kind === 'gear' || s.kind === 'skill') {
        var src = s.kind === 'item' ? E.itemIcon(s.spec) : s.kind === 'skill' ? E.skillIcon(s.spec) : E.gearIcon(s.spec);
        var pad = s.kind === 'skill' ? 0 : Math.round(w * 0.06);
        g.imageSmoothingQuality = 'high';
        g.drawImage(src, pad, pad, w - pad * 2, h - pad * 2);
        if (s.kind === 'gear' && (s.spec.temper || 0) >= 4) E.drawSparks(g, s.spec, w / 2, h * 0.62, time);
      } else if (s.kind === 'monster') E.drawCreature(g, s.spec, time, w, h, 0, false);
      else if (s.kind === 'mount') E.drawMountSprite(g, s.spec, time, w, h, 3);
      else if (s.kind === 'pet') E.drawPetSprite(g, s.spec, time, w, h);
      else if (s.kind === 'companion') E.drawCompanion(g, s.spec, time, w, h);
    } catch (err) {
      if (window.console) console.warn('sprite', s, err);
    }
  }
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); paintSprite(e.target); } });
  }, { rootMargin: '300px' }) : null;
  function hydrate(root) {
    (root || document).querySelectorAll('[data-spr]').forEach(function (el) { if (io) io.observe(el); else paintSprite(el); });
  }
  /** an animated stage (detail views): redraws while connected and on screen */
  function animate(canvas, draw) {
    var g = canvas.getContext('2d');
    var t0 = performance.now();
    function frame(now) {
      if (!canvas.isConnected) return;
      var w = canvas.clientWidth;
      var h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * DPR) || canvas.height !== Math.round(h * DPR)) {
        canvas.width = Math.round(w * DPR);
        canvas.height = Math.round(h * DPR);
      }
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.clearRect(0, 0, w, h);
      draw(g, (now - t0) / 1000, w, h);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ================================================================ names, keys & links for everything
  function gearSpecOf(g) { return g.mythic ? { kind: 'mythic', base: g.base, tier: 6, temper: 0 } : { kind: 'base', base: g.base, tier: g.tier, rarity: 2, temper: 0 }; }
  /** resolve any database key to { name, href, sprite(cls), rarity, type } */
  function ref(key) {
    var x;
    if (I.item[key]) {
      x = I.item[key];
      return { name: x.name, href: '#items/' + key, sprite: function (c) { return sprite('item', key, c); }, rarity: itemRarity(x), type: L('Item', 'פריט') };
    }
    if (I.gear[key]) {
      x = I.gear[key];
      return { name: x.name, href: '#items/' + key, sprite: function (c) { return sprite('gear', gearSpecOf(x), c, x.mythic ? 5 : 2); }, rarity: x.mythic ? 5 : 2, type: L('Equipment', 'ציוד') };
    }
    if (I.unique[key]) {
      x = I.unique[key];
      return { name: x.name, href: '#items/' + key, sprite: function (c) { return sprite('gear', { kind: 'unique', unique: key, tier: 6 }, c, 4); }, rarity: 4, type: L('Unique', 'ייחודי') };
    }
    var sp = /^(set_\w+)#(\d+)$/.exec(key);
    if (sp && I.set[sp[1]]) {
      x = I.set[sp[1]];
      var pc = x.pieces[+sp[2]];
      return { name: pc.name, href: '#items/' + key, sprite: function (c) { return sprite('gear', { kind: 'set', set: sp[1], piece: +sp[2], tier: 6, rarity: 4 }, c, 4); }, rarity: 4, type: L('Set piece', 'חלק סט') };
    }
    if (I.set[key]) { x = I.set[key]; return { name: x.name, href: '#sets/' + key, sprite: function (c) { return sprite('gear', { kind: 'set', set: key, piece: 0, tier: 6, rarity: 4 }, c, 4); }, rarity: 4, type: L('Set', 'סט') }; }
    if (I.monster[key]) { x = I.monster[key]; return { name: x.name, href: '#droprates/' + key, sprite: function (c) { return sprite('monster', key, c); }, type: x.boss ? L('Boss', 'בוס') : x.elite ? L('Elite', 'עילית') : L('Monster', 'מפלצת') }; }
    if (I.skill[key]) { x = I.skill[key]; return { name: x.name, href: '#skills/' + key, sprite: function (c) { return sprite('skill', key, c); }, type: L('Sword Skill', 'כישור חרב') }; }
    if (I.passive[key]) { x = I.passive[key]; return { name: x.name, href: '#skills/' + key, sprite: function (c) { return sprite('skill', key, c); }, type: L('Passive', 'פסיבי') }; }
    if (I.pet[key]) { x = I.pet[key]; return { name: x.name, href: '#items/' + key, sprite: function (c) { return sprite('pet', key, c); }, type: L('Pet', 'חיית מחמד') }; }
    if (I.mount[key]) { x = I.mount[key]; return { name: x.name, href: '#items/' + key, sprite: function (c) { return sprite('mount', key, c); }, type: L('Mount', 'בהמת רכיבה') }; }
    if (I.companion[key]) { x = I.companion[key]; return { name: x.name, href: '#guide/guilds', sprite: function (c) { return sprite('companion', key, c); }, type: L('Companion', 'בן לוויה') }; }
    if (I.keystone[key]) { x = I.keystone[key]; return { name: x.name, href: '#skills/' + key, sprite: function (c) { return sprite('skill', D.skills.filter(function (s) { return s.branch === x.branch; })[4].id, c); }, type: L('Keystone', 'אבן ראשה') }; }
    if (I.power[key]) { x = I.power[key]; return { name: x.name, href: '#items/power:' + key, sprite: null, type: L('Golden power', 'כוח זהוב') }; }
    return { name: L(key, key), href: '#home', sprite: null, type: L('', '') };
  }
  function itemRarity(it) {
    if (it.sub === 'fish') { var f = D.fish.filter(function (x) { return x.id === it.id; })[0]; return f ? f.rarity : 0; }
    if (it.id === 'mythic_core' || it.id === 'relic_shard') return 5;
    if (it.sub === 'gem' || it.id === 'enh_greater' || it.id === 'treasure_map' || it.id === 'food_banquet') return 3;
    if (it.sub === 'trophy') return 4;
    if (it.sub === 'ingot' || it.sub === 'oil' || it.id === 'enh_stone' || it.id === 'demon_core') return 2;
    if (it.sub === 'furniture' || it.sub === 'dish' || it.sub === 'potion') return 1;
    return it.value >= 60 ? 2 : it.value >= 20 ? 1 : 0;
  }
  /** an inline token link with a small sprite */
  function tok(key, extra) {
    var r = ref(key);
    return '<a class="tok" href="' + r.href + '"' + (r.rarity != null ? ' style="--rc:var(--r-' + ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'][r.rarity] + ')"' : '') + '>' + (r.sprite ? r.sprite('xs') : '') + '<span' + (r.rarity != null ? ' class="rtext"' : '') + '>' + esc(t(r.name)) + '</span>' + (extra ? ' <span class="dim small">' + extra + '</span>' : '') + '</a>';
  }

  // ================================================================ router
  var PAGES = [];
  var PAGE = {};
  var LEGACY = { desktop: 'guide/desktop', combat: 'guide/combat', fulldive: 'guide/fulldive', constellation: 'skills', reactions: 'combat-docs/reactions', gear: 'sets', awakenings: 'skills', forge: 'guide/forge', materials: 'items', cooking: 'guide/cooking', atlas: 'maps', bosses: 'droprates', guilds: 'guide/guilds', living: 'guide/living', world: 'guide/world', journal: 'guide/journal', economy: 'guide/economy', endgame: 'guide/endgame', drops: 'droprates', 'drop-rates': 'droprates', bestiary: 'droprates', map: 'maps', atlasmap: 'maps', combatdocs: 'combat-docs', build: 'builds', recommendations: 'builds' };
  function register(p) { PAGES.push(p); PAGE[p.id] = p; }
  var current = { id: null, args: [] };
  function parseHash() {
    var h = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
    if (!h) return { id: 'home', args: [] };
    var parts = h.split('/');
    if (!PAGE[parts[0]] && LEGACY[parts[0]]) parts = LEGACY[parts[0]].split('/').concat(parts.slice(1));
    if (!PAGE[parts[0]]) return { id: 'home', args: [] };
    return { id: parts[0], args: parts.slice(1) };
  }
  var main;
  function render(keepScroll) {
    var r = parseHash();
    var changed = r.id !== current.id || r.args.join('/') !== current.args.join('/');
    current = r;
    var p = PAGE[r.id];
    SPR.length = 0;
    for (var tk in TIPS) delete TIPS[tk];
    hideTip();
    var html;
    try {
      html = p.render(r.args);
    } catch (err) {
      html = '<div class="empty">Error: ' + esc(err && err.message) + '</div>';
      if (window.console) console.error(err);
    }
    main.innerHTML = html;
    hydrate(main);
    if (p.after) p.after(r.args, main);
    document.querySelectorAll('#tabs a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-id') === (p.tab || p.id)); });
    document.title = t(p.title) + ' · ' + t(L('Aetheria Codex', 'קודקס אתריה'));
    if (changed && !keepScroll) {
      var anchor = r.args.length && document.getElementById('sec-' + r.args[r.args.length - 1]);
      if (anchor) anchor.scrollIntoView({ block: 'start' });
      else window.scrollTo(0, 0);
    }
  }
  function go(hash) { if (location.hash === hash) render(true); else location.hash = hash; }
  /** re-render the current page without moving the scroll position (filters, sliders, calculators) */
  function refresh() { var y = window.scrollY; render(true); window.scrollTo(0, y); }

  // ================================================================ tooltips (hover a token / data-tip)
  var tipEl;
  function showTip(html, x, y) {
    tipEl.innerHTML = html;
    tipEl.hidden = false;
    var r = tipEl.getBoundingClientRect();
    var left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 14));
    var top = y + 18 + r.height > window.innerHeight ? y - r.height - 12 : y + 18;
    tipEl.style.left = left + 'px';
    tipEl.style.top = Math.max(8, top) + 'px';
  }
  function hideTip() { if (tipEl) tipEl.hidden = true; }
  var TIPS = {};
  function tipAttr(html) { var k = 'tp' + Object.keys(TIPS).length; TIPS[k] = html; return ' data-tip="' + k + '"'; }

  // ================================================================ global search
  var SEARCH = null;
  function buildSearch() {
    var out = [];
    function add(key, name, type, href, spr) { out.push({ key: key, en: name.en, he: name.he, type: type, href: href, spr: spr }); }
    D.items.forEach(function (x) { add(x.id, x.name, L('Item', 'פריט'), '#items/' + x.id, ['item', x.id]); });
    D.gear.forEach(function (x) { add(x.id, x.name, L('Equipment', 'ציוד'), '#items/' + x.id, ['gear', gearSpecOf(x)]); });
    D.uniques.forEach(function (x) { add(x.id, x.name, L('Unique', 'ייחודי'), '#items/' + x.id, ['gear', { kind: 'unique', unique: x.id, tier: 6 }]); });
    D.sets.forEach(function (s) {
      add(s.id, s.name, L('Equipment set', 'סט ציוד'), '#sets/' + s.id, ['gear', { kind: 'set', set: s.id, piece: 0, tier: 6, rarity: 4 }]);
      s.pieces.forEach(function (p, i) { add(s.id + '#' + i, p.name, L('Set piece', 'חלק סט'), '#items/' + s.id + '#' + i, ['gear', { kind: 'set', set: s.id, piece: i, tier: 6, rarity: 4 }]); });
    });
    D.monsters.forEach(function (x) { add(x.id, x.name, x.boss ? L('Boss', 'בוס') : x.elite ? L('Elite', 'עילית') : L('Monster', 'מפלצת'), '#droprates/' + x.id, ['monster', x.id]); });
    D.skills.forEach(function (x) { add(x.id, x.name, L('Sword Skill', 'כישור חרב'), '#skills/' + x.id, ['skill', x.id]); });
    D.passives.forEach(function (x) { add(x.id, x.name, L('Passive', 'פסיבי'), '#skills/' + x.id, ['skill', x.id]); });
    D.keystones.forEach(function (x) { add(x.id, x.name, L('Keystone', 'אבן ראשה'), '#skills/' + x.id, null); });
    D.powers.forEach(function (x) { add(x.id, x.name, L('Golden power', 'כוח זהוב'), '#items/power:' + x.id, null); });
    D.pets.forEach(function (x) { add(x.id, x.name, L('Pet', 'חיית מחמד'), '#items/' + x.id, ['pet', x.id]); });
    D.mounts.forEach(function (x) { add(x.id, x.name, L('Mount', 'בהמת רכיבה'), '#items/' + x.id, ['mount', x.id]); });
    D.companions.forEach(function (x) { add(x.id, x.name, L('Companion', 'בן לוויה'), '#guide/guilds', ['companion', x.id]); });
    D.realms.forEach(function (x, i) { add('realm' + i, x.name, L('Realm map', 'מפת ממלכה'), '#maps/' + i + '/wild', null); add('city' + i, x.city, L('City map', 'מפת עיר'), '#maps/' + i + '/city', null); add('dun' + i, x.dungeon, L('Dungeon map', 'מפת מבוך'), '#maps/' + i + '/dungeon', null); });
    D.reactions.forEach(function (x) { add(x.id, x.name, L('Reaction', 'תגובה'), '#combat-docs/reactions', null); });
    (D.content.builds || []).forEach(function (b) { add(b.id, b.name, L('Build', 'בילד'), '#builds/' + b.id, null); });
    PAGES.forEach(function (p) { if (p.title) add('page:' + p.id, p.title, L('Page', 'עמוד'), '#' + p.id, null); });
    if (window.WikiGuide) window.WikiGuide.chapters.forEach(function (c) { add('guide:' + c.id, c.title, L('Guide chapter', 'פרק במדריך'), '#guide/' + c.id, null); });
    return out;
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
  function search(q) {
    if (!SEARCH) SEARCH = buildSearch();
    var nq = norm(q);
    if (!nq) return [];
    var words = nq.split(' ');
    var res = [];
    SEARCH.forEach(function (e) {
      var hay = norm(e.en + ' ' + e.he + ' ' + e.key);
      if (!words.every(function (w) { return hay.indexOf(w) >= 0; })) return;
      var score = norm(e[lang]).indexOf(nq) === 0 ? 0 : norm(e.en).indexOf(nq) === 0 ? 1 : 2;
      res.push({ e: e, s: score });
    });
    res.sort(function (a, b) { return a.s - b.s || a.e.en.length - b.e.en.length; });
    return res.slice(0, 14).map(function (r) { return r.e; });
  }
  var gsel = -1;
  function renderResults(q) {
    var box = document.getElementById('gresults');
    var list = search(q);
    gsel = list.length ? 0 : -1;
    if (!q.trim()) { box.hidden = true; return; }
    SPR.length = SPR.length; // keep page sprites; result sprites append
    box.innerHTML = list.length ? list.map(function (e, i) {
      return '<a class="gres' + (i === 0 ? ' on' : '') + '" href="' + e.href + '">' + (e.spr ? sprite(e.spr[0], e.spr[1], 'xs') : '<span class="sprite xs"></span>') + '<span>' + bi(e) + '</span><span class="k">' + esc(t(e.type)) + '</span></a>';
    }).join('') : '<div class="empty">' + esc(t(L('No matches', 'אין תוצאות'))) + '</div>';
    box.hidden = false;
    box.querySelectorAll('[data-spr]').forEach(paintSprite);
  }

  // ================================================================ nav & chrome
  var ICONS = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    guide: 'M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-5a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h6z',
    items: 'M14.5 3l6.5 6.5-9 9L5.5 12zM3 21l4.5-4.5M9 9l6 6',
    droprates: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
    builds: 'M12 2l3 6 6 .9-4.5 4.4 1 6.2L12 16.6 6.5 19.5l1-6.2L3 8.9 9 8z',
    skills: 'M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4',
    maps: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
    'combat-docs': 'M4 18l6-6 4 4 6-8M4 4v16h16',
    sets: 'M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7z',
  };
  function icon(id) { var d = ICONS[id] || ICONS.home; return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="' + d + '"/></svg>'; }
  function chrome() {
    var root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.getElementById('lang-en').className = 'lang-btn' + (lang === 'en' ? ' on' : '');
    document.getElementById('lang-he').className = 'lang-btn' + (lang === 'he' ? ' on' : '');
    document.getElementById('lang-en').setAttribute('aria-pressed', String(lang === 'en'));
    document.getElementById('lang-he').setAttribute('aria-pressed', String(lang === 'he'));
    document.getElementById('brand-title').textContent = t(L('Aetheria Codex', 'קודקס אתריה'));
    document.getElementById('brand-sub').textContent = t(L('Official Database & Strategy Compendium', 'מאגר המידע והמדריך האסטרטגי הרשמי'));
    document.getElementById('skip').textContent = t(L('Skip to content', 'דלגו לתוכן'));
    document.getElementById('gsearch').placeholder = t(L('Search items, monsters, skills...', 'חיפוש פריטים, מפלצות, כישורים...'));
    document.getElementById('gsearch').setAttribute('aria-label', t(L('Search the codex', 'חיפוש בקודקס')));
    document.getElementById('tabs').innerHTML = PAGES.filter(function (p) { return p.nav; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).map(function (p) {
      return '<a href="#' + p.id + '" data-id="' + p.id + '">' + icon(p.id) + '<span>' + esc(t(p.title)) + '</span></a>';
    }).join('');
    var c = D.counts;
    document.getElementById('foot').innerHTML =
      '<span>' + fmt(L('Aetheria Chronicles: Sword & Forge · Codex v' + D.version + ' · generated ' + D.generated + ' from the game source (src/data)', 'כרוניקות אתריה: חרב ונפחייה · קודקס גרסה ' + D.version + ' · נוצר ב-' + D.generated + ' ישירות מקוד המשחק (src/data)')) + '</span>' +
      '<span>' + fmt(L(c.items + ' items · ' + c.gear + ' gear blueprints · ' + c.uniques + ' uniques · ' + c.setPieces + ' set pieces · ' + c.monsters + ' creatures · ' + (c.skills + c.passives) + ' skills', c.items + ' פריטים · ' + c.gear + ' שרטוטי ציוד · ' + c.uniques + ' ייחודיים · ' + c.setPieces + ' חלקי סט · ' + c.monsters + ' יצורים · ' + (c.skills + c.passives) + ' כישורים')) + '</span>' +
      '<a href="https://github.com/Nirco99/aetheria-chronicles-rpg" rel="noopener">GitHub</a>';
  }
  function setLang(l) {
    if (l === lang) return;
    lang = l;
    try { localStorage.setItem('aetheria.wiki.lang', l); } catch (e) { /* storage unavailable */ }
    SEARCH = null;
    chrome();
    refresh();
  }

  // ================================================================ home
  function homePage() {
    var c = D.counts;
    var hub = [
      ['items', '#ffb347', L('Items & Equipment', 'פריטים וציוד'), L('Every weapon, armor, material and dish with live tempering sliders and forge recipes.', 'כל נשק, שריון, חומר ומנה, עם מחווני חישול חיים ומתכוני נפחייה.')],
      ['droprates', '#ff6b8b', L('Drop Rates & Bestiary', 'אחוזי דרופים ובסטיאריום'), L('Exact loot tables for all ' + c.monsters + ' creatures, a Magic Find calculator and where-to-farm lookups.', 'טבלאות שלל מדויקות לכל ' + c.monsters + ' היצורים, מחשבון מציאת שלל וחיפוש "איפה לפארם".')],
      ['builds', '#b46cff', L('Builds & Recommendations', 'בילדים והמלצות'), L('Six battle-tested builds, tier lists and a level-by-level progression route.', 'שישה בילדים שנבחנו בקרב, רשימות דירוג ומסלול התקדמות מרמה לרמה.')],
      ['skills', '#7fe9ff', L('Skills & Constellation', 'כישורים וקונסטלציה'), L('All ' + c.skills + ' Sword Skills with their Rune Morphs, ' + c.passives + ' passives, keystones and bridges.', 'כל ' + c.skills + ' כישורי החרב עם המורפים הרוניים, ' + c.passives + ' פסיביים, אבני ראשה וגשרים.')],
      ['maps', '#5ee6a0', L('Realm Atlas Maps', 'מפות אטלס הממלכות'), L('The real realm maps drawn by the game\'s renderer, with ore, herb, fishing, elite and dungeon layers.', 'מפות הממלכות האמיתיות, מצוירות על ידי מנוע המשחק, עם שכבות עפרות, צמחים, דיג, עילית ומבוכים.')],
      ['combat-docs', '#ffd166', L('Combat Documentation', 'תיעודים מהמשחק'), L('Animated frame data, Wall-Slam physics and the elemental reaction simulator.', 'נתוני פריימים מונפשים, פיזיקת הטחה בקיר וסימולטור תגובות היסודות.')],
      ['sets', '#ff4f7b', L('Sets, Uniques & Relic Codex', 'סטים, ייחודיים וקודקס השרידים'), L('All 8 equipment sets with 2/4/6-piece bonuses and every golden power.', 'כל 8 סטי הציוד עם בונוסי 2/4/6 חלקים וכל הכוחות הזהובים.')],
      ['guide', '#9fd3ff', L('Strategy Guide', 'מדריך אסטרטגיה'), L('Chapters on the desktop app, controls, Full-Dive combat, forging, guilds, raids and the endgame.', 'פרקים על אפליקציית המחשב, השליטה, קרב Full-Dive, נפחות, גילדות, פשיטות ומשחק הסיום.')],
    ];
    var F = D.frames;
    return '<section class="hero">' +
      '<div><div class="kick">' + esc(t(L('Official Strategy Compendium', 'המדריך האסטרטגי הרשמי'))) + '</div>' +
      '<h1>' + esc(t(L('Aetheria Codex & Database', 'קודקס ומאגר המידע של אתריה'))) + '</h1>' +
      '<p>' + fmt(L('Every item, creature, drop chance, skill and map of Aetheria Chronicles: Sword & Forge, generated straight from the game\'s source code - so the numbers here are the numbers in the game. Sprites are drawn live by the game\'s own procedural renderer.', 'כל פריט, יצור, סיכוי שלל, כישור ומפה של כרוניקות אתריה: חרב ונפחייה, נוצרים ישירות מקוד המקור של המשחק - כך שהמספרים כאן הם המספרים במשחק. הדמויות מצוירות בזמן אמת על ידי מנוע הציור הפרוצדורלי של המשחק עצמו.')) + '</p>' +
      '<div class="row"><a class="btn" href="#items">' + esc(t(L('Browse the item database', 'לעיון במאגר הפריטים'))) + '</a><a class="btn ghost" href="#droprates">' + esc(t(L('Drop-rate calculator', 'מחשבון אחוזי דרופים'))) + '</a></div>' +
      '<div class="counters">' +
      [[c.items + c.gear + c.uniques + c.setPieces, L('database entries', 'רשומות במאגר')], [c.monsters, L('creatures & bosses', 'יצורים ובוסים')], [c.skills + c.passives, L('skills', 'כישורים')], [c.recipes, L('recipes', 'מתכונים')], [c.realms, L('realm atlases', 'אטלסים')], [c.achievements, L('achievements', 'הישגים')]].map(function (x) {
        return '<div class="counter"><b>' + num(x[0]) + '</b><span>' + esc(t(x[1])) + '</span></div>';
      }).join('') + '</div></div>' +
      '<div class="hero-stage"><canvas id="hero-canvas"></canvas></div></section>' +
      '<div class="hub">' + hub.map(function (h) {
        return '<a href="#' + h[0] + '" style="--c:' + h[1] + '"><span class="ic">' + icon(h[0]) + '</span><span><b>' + esc(t(h[2])) + '</b><span>' + fmt(h[3]) + '</span></span></a>';
      }).join('') + '</div>' +
      '<div class="section-title"><h2>' + esc(t(L('Combat at a glance', 'הקרב במבט מהיר'))) + '</h2><span class="line"></span></div>' +
      '<div class="grid">' +
      [[L('Perfect Parry', 'הדיפה מושלמת'), secs(F.parryWindow), L('Block within this window of a hit. +0.04s per Riposte Instinct level, +0.08s from Unbreakable Bastion.', 'חסמו בתוך החלון הזה מהפגיעה. +0.04 ש׳ לכל רמת אינסטינקט התגובה, +0.08 ש׳ מהמבצר הבלתי שביר.')],
        [L('Skill Connect', 'חיבור כישורים'), secs(F.connectWindow), L('Fire another skill within this window of a skill\'s final strike: x' + F.connectMp + ' MP, +' + Math.round(F.connectStep * 100) + '% damage per chain step, Finishing Nova at ' + F.novaChain + '.', 'הפעילו כישור נוסף בתוך החלון שאחרי המכה האחרונה: עלות מאנה x' + F.connectMp + ', +' + Math.round(F.connectStep * 100) + '% נזק לכל שלב, נובת סיום בשלב ' + F.novaChain + '.')],
        [L('Input buffer', 'חוצץ קלט'), secs(F.inputBuffer), L('Presses that cannot act yet are remembered and fire on the first legal frame.', 'לחיצות שעדיין לא יכולות לפעול נשמרות ומופעלות בפריים החוקי הראשון.')],
        [L('Dodge i-frames', 'פריימי חסינות בהתחמקות'), secs(F.dodgeIframes), L('A ' + F.dodgeDur + 's roll costing ' + F.dodgeStamina + ' Stamina, ' + F.dodgeCooldown + 's cooldown.', 'גלגול של ' + F.dodgeDur + ' ש׳ בעלות ' + F.dodgeStamina + ' סיבולת, טעינה של ' + F.dodgeCooldown + ' ש׳.')]].map(function (x) {
        return '<a class="card link" href="#combat-docs"><div class="meta">' + esc(t(x[0])) + '</div><h4 class="gold" style="font-size:1.5rem">' + x[1] + '</h4><p class="small dim">' + fmt(x[2]) + '</p></a>';
      }).join('') + '</div>' +
      '<div class="callout cyan">' + fmt(L('This codex is regenerated from the game\'s src/data every time the game is built, and the desktop app ships an offline copy. Drop chances, stat formulas, frame data and maps are identical to what the game rolls and draws.', 'הקודקס הזה נוצר מחדש מתוך src/data של המשחק בכל בנייה, ואפליקציית המחשב כוללת עותק לא מקוון. סיכויי השלל, נוסחאות הסטטיסטיקות, נתוני הפריימים והמפות זהים למה שהמשחק מגריל ומצייר.')) + '</div>';
  }
  function homeAfter() {
    var c = document.getElementById('hero-canvas');
    if (!c) return;
    var cast = ['b_paragon', 'b_empress', 'b_wyrm', 'r_colossus', 'b_treant', 'r_reaper', 'b_kobold', 'elite_nullseraph'];
    animate(c, function (g, time, w, h) {
      var i = Math.floor(time / 4) % cast.length;
      var k = (time % 4) / 4;
      var a = k < 0.12 ? k / 0.12 : k > 0.88 ? (1 - k) / 0.12 : 1;
      g.globalAlpha = Math.max(0, a);
      var grd = g.createRadialGradient(w / 2, h * 0.9, 10, w / 2, h * 0.9, w * 0.45);
      grd.addColorStop(0, 'rgba(127,233,255,0.18)');
      grd.addColorStop(1, 'rgba(127,233,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      E.drawCreature(g, cast[i], time, w, h - 26, Math.floor(time / 1.3) % 4 === 1 ? 3 : 0, Math.sin(time * 1.7) > 0.6);
      g.globalAlpha = 1;
      var m = I.monster[cast[i]];
      g.font = '700 13px ' + (lang === 'he' ? 'Segoe UI, Arial' : 'Segoe UI, sans-serif');
      g.fillStyle = 'rgba(230,237,247,' + Math.max(0, a) * 0.85 + ')';
      g.textAlign = 'center';
      g.direction = lang === 'he' ? 'rtl' : 'ltr';
      g.fillText(t(m.name), w / 2, h - 8);
    });
  }
  register({ id: 'home', title: L('Home', 'בית'), nav: true, render: homePage, after: homeAfter });

  // ================================================================ start
  function start() {
    main = document.getElementById('main');
    tipEl = document.getElementById('tip');
    chrome();
    render();
    window.addEventListener('hashchange', function () { render(); });
    document.getElementById('lang-en').addEventListener('click', function () { setLang('en'); });
    document.getElementById('lang-he').addEventListener('click', function () { setLang('he'); });
    var gs = document.getElementById('gsearch');
    var box = document.getElementById('gresults');
    gs.addEventListener('input', function () { renderResults(gs.value); });
    gs.addEventListener('focus', function () { if (gs.value.trim()) renderResults(gs.value); });
    gs.addEventListener('keydown', function (e) {
      var items = box.querySelectorAll('.gres');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        gsel = (gsel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (a, i) { a.classList.toggle('on', i === gsel); });
      } else if (e.key === 'Enter' && items[gsel]) {
        location.hash = items[gsel].getAttribute('href');
        box.hidden = true;
        gs.blur();
      } else if (e.key === 'Escape') { box.hidden = true; gs.blur(); }
    });
    document.addEventListener('click', function (e) {
      if (!box.contains(e.target) && e.target !== gs) box.hidden = true;
      if (box.contains(e.target) && e.target.closest('a')) box.hidden = true;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== gs && !/input|textarea|select/i.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); gs.focus(); }
    });
    document.addEventListener('mouseover', function (e) {
      var el = e.target.closest && e.target.closest('[data-tip]');
      if (!el) { hideTip(); return; }
      var html = TIPS[el.getAttribute('data-tip')];
      if (html) showTip(html, e.clientX, e.clientY);
    });
    document.addEventListener('mousemove', function (e) {
      if (tipEl.hidden) return;
      var el = e.target.closest && e.target.closest('[data-tip]');
      if (el) showTip(tipEl.innerHTML, e.clientX, e.clientY);
    });
    window.addEventListener('scroll', hideTip, { passive: true });
  }

  window.Wiki = {
    D: D, E: E, I: I, L: L, t: t, esc: esc, fmt: fmt, bi: bi, n: n, num: num, pct: pct, secs: secs, frames: frames,
    lang: function () { return lang; }, register: register, go: go, refresh: refresh, render: render, start: start, hydrate: hydrate,
    sprite: sprite, drawSprite: drawSprite, animate: animate, paintSprite: paintSprite, ref: ref, tok: tok, itemRarity: itemRarity, gearSpecOf: gearSpecOf,
    statList: statList, statInline: statInline, statName: statName, statVal: statVal, STAT_ORDER: STAT_ORDER,
    rarityName: rarityName, rarityBadge: rarityBadge, elBadge: elBadge, icon: icon, tipAttr: tipAttr, current: function () { return current; },
  };
})();
