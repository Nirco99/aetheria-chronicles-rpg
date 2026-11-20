/* Aetheria Codex - Items & Equipment database, item detail (tempering & forging), Sets & Relic Codex,
   Bestiary with exact loot tables, the Magic Find calculator and the "where to farm" reverse lookup.
   All math runs through window.AetheriaEngine - the same functions the game uses to roll loot. */
(function () {
  'use strict';
  var W = window.Wiki;
  var D = W.D, E = W.E, I = W.I, L = W.L, t = W.t, esc = W.esc, fmt = W.fmt, n = W.n, pct = W.pct, num = W.num;
  var RN = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

  // ================================================================ shared state (kept across re-renders)
  var S = {
    items: { q: '', cat: 'all', rarity: -1, tier: -1 },
    item: { rarity: 2, grade: null, temper: 0, tier: 6, guild: 0, artisan: false, source: 'drop' },
    mf: { gear: 0, fortune: false, style: 0, mastery: false, guild: 0, pet: '', food: false, night: false, floor: 0, collapsed: false },
    best: { q: '', realm: -1, kind: 'all', level: 0 },
    find: { q: '' },
  };
  try {
    var savedMf = JSON.parse(localStorage.getItem('aetheria.wiki.mf') || 'null');
    if (savedMf && typeof savedMf === 'object') Object.keys(S.mf).forEach(function (k) { if (k in savedMf) S.mf[k] = savedMf[k]; });
  } catch (e) { /* storage unavailable */ }
  function saveMf() { try { localStorage.setItem('aetheria.wiki.mf', JSON.stringify(S.mf)); } catch (e) { /* ignore */ } }

  // ================================================================ categories
  var CATS = [
    { group: L('Weapons', 'נשקים') },
    { id: 'sword', name: L('One-Handed Swords', 'חרבות ביד אחת'), test: function (e) { return e.base === 'w_sword'; } },
    { id: 'twinblade', name: L('Twin Edges (Dual Blades)', 'להבים תאומים (להבים כפולים)'), test: function (e) { return e.base === 'w_twinblade'; } },
    { id: 'polearm', name: L('Spears & Polearms', 'חניתות וכלי מוט'), test: function (e) { return e.base === 'w_spear' || e.base === 'w_halberd'; } },
    { id: 'bow', name: L('Bows', 'קשתות'), test: function (e) { return e.base === 'w_bow'; } },
    { id: 'staff', name: L('Arcane Staves', 'מטות ארקניים'), test: function (e) { return e.base === 'w_staff'; } },
    { group: L('Armor', 'שריון') },
    { id: 'shield', name: L('Shields', 'מגינים'), test: function (e) { return e.base === 'a_shield'; } },
    { id: 'head', name: L('Helmets', 'קסדות'), test: function (e) { return e.slot === 'head'; } },
    { id: 'chest', name: L('Chest Armor', 'שריון חזה'), test: function (e) { return e.slot === 'chest'; } },
    { id: 'boots', name: L('Boots', 'מגפיים'), test: function (e) { return e.slot === 'boots'; } },
    { id: 'cloak', name: L('Capes & Cloaks', 'שכמיות וגלימות'), test: function (e) { return e.slot === 'cloak'; } },
    { group: L('Special gear', 'ציוד מיוחד') },
    { id: 'unique', name: L('Unique Weapons', 'נשקים ייחודיים'), test: function (e) { return e.type === 'unique'; } },
    { id: 'set', name: L('Set Pieces', 'חלקי סטים'), test: function (e) { return e.type === 'set'; } },
    { id: 'mythic', name: L('Mythic Blueprints', 'שרטוטים מיתיים'), test: function (e) { return e.type === 'mythic'; } },
    { id: 'power', name: L('Golden Powers (Relic Codex)', 'כוחות זהובים (קודקס השרידים)'), test: function (e) { return e.type === 'power'; } },
    { group: L('Materials', 'חומרים') },
    { id: 'ore', name: L('Ores & Ingots', 'עפרות ומטילים'), test: function (e) { return e.sub === 'ore' || e.sub === 'ingot'; } },
    { id: 'monster', name: L('Monster Parts', 'חלקי מפלצות'), test: function (e) { return e.sub === 'monster'; } },
    { id: 'herb', name: L('Herbs & Ingredients', 'צמחים ומרכיבים'), test: function (e) { return e.sub === 'herb' || e.sub === 'ingredient'; } },
    { id: 'fish', name: L('Fish', 'דגים'), test: function (e) { return e.sub === 'fish'; } },
    { id: 'gem', name: L('Elemental Gems', 'אבני יסוד'), test: function (e) { return e.sub === 'gem'; } },
    { id: 'stone', name: L('Enhancement & Relics', 'חישול ושרידים'), test: function (e) { return e.sub === 'stone' || e.sub === 'relic'; } },
    { group: L('Consumables & home', 'מתכלים ובית') },
    { id: 'potion', name: L('Potions, Oils & Maps', 'שיקויים, שמנים ומפות'), test: function (e) { return e.sub === 'potion' || e.sub === 'oil' || e.sub === 'map'; } },
    { id: 'dish', name: L('Cooked Dishes', 'מנות מבושלות'), test: function (e) { return e.sub === 'dish'; } },
    { id: 'furniture', name: L('House Furniture & Trophies', 'ריהוט ופסלי ניצחון'), test: function (e) { return e.sub === 'furniture' || e.sub === 'trophy'; } },
    { group: L('Companions', 'בני לוויה') },
    { id: 'pet', name: L('Combat Pets', 'חיות קרב'), test: function (e) { return e.type === 'pet'; } },
    { id: 'mount', name: L('Mounts', 'בהמות רכיבה'), test: function (e) { return e.type === 'mount'; } },
  ];

  var ENTRIES = null;
  function entries() {
    if (ENTRIES) return ENTRIES;
    var out = [];
    D.gear.forEach(function (g) {
      var b = I.base[g.base];
      out.push({ key: g.id, type: g.mythic ? 'mythic' : 'gear', base: g.base, slot: b.aslot, name: g.name, tier: g.tier, level: g.level, rmin: g.mythic ? 5 : 0, rmax: g.mythic ? 5 : 4, show: g.mythic ? 5 : 2, stats: g.stats, spec: W.gearSpecOf(g) });
    });
    D.uniques.forEach(function (u) {
      var b = I.base[u.base];
      out.push({ key: u.id, type: 'unique', base: u.base, slot: b.aslot, name: u.name, tier: -1, level: 0, rmin: 4, rmax: 4, show: 4, stats: u.stats, spec: { kind: 'unique', unique: u.id, tier: 6 } });
    });
    D.sets.forEach(function (s) {
      s.pieces.forEach(function (p, i) {
        var b = I.base[p.base];
        out.push({ key: s.id + '#' + i, type: 'set', base: p.base, slot: b.aslot, name: p.name, set: s, tier: -1, level: 0, rmin: 3, rmax: 4, show: 4, stats: b.stats, spec: { kind: 'set', set: s.id, piece: i, tier: 6, rarity: 4 } });
      });
    });
    D.powers.forEach(function (p) { out.push({ key: 'power:' + p.id, type: 'power', name: p.name, power: p, tier: -1, level: 0, rmin: 4, rmax: 5, show: 4 }); });
    D.items.forEach(function (it) {
      var r = W.itemRarity(it);
      out.push({ key: it.id, type: 'item', sub: it.sub, item: it, name: it.name, tier: it.tier == null ? -1 : it.tier, level: 0, rmin: r, rmax: r, show: r });
    });
    D.pets.forEach(function (p) { out.push({ key: p.id, type: 'pet', name: p.name, pet: p, tier: -1, level: p.req, rmin: 3, rmax: 3, show: 3 }); });
    D.mounts.forEach(function (m) { out.push({ key: m.id, type: 'mount', name: m.name, mount: m, tier: -1, level: m.req, rmin: 4, rmax: 4, show: 4 }); });
    ENTRIES = out;
    return out;
  }
  function catOf(id) { return CATS.filter(function (c) { return c.id === id; })[0]; }
  function typeLabel(e) {
    if (e.type === 'gear' || e.type === 'mythic') return t(I.base[e.base].label) + ' · ' + t(D.tiers[e.tier].name);
    if (e.type === 'unique') return t(L('Unique', 'ייחודי')) + ' · ' + t(I.base[e.base].label);
    if (e.type === 'set') return t(e.set.name) + ' · ' + t(I.base[e.base].label);
    if (e.type === 'power') return t(L('Golden power', 'כוח זהוב')) + ' · ' + t(slotName(e.power.slot));
    if (e.type === 'pet') return t(L('Combat pet', 'חיית קרב'));
    if (e.type === 'mount') return t(L('Mount', 'בהמת רכיבה'));
    var c = CATS.filter(function (x) { return x.test && x.test(e) && x.id; })[0];
    return c ? t(c.name) : '';
  }
  function slotName(s) { return s === 'weapon' ? L('Weapon slot', 'משבצת נשק') : s === 'armor' ? L('Armor slot', 'משבצת שריון') : L('Utility slot', 'משבצת עזר'); }
  function entrySprite(e, cls, rarity) {
    var r = rarity == null ? e.show : rarity;
    if (e.spec) return W.sprite('gear', Object.assign({}, e.spec, e.type === 'gear' ? { rarity: r } : {}), cls, r);
    if (e.type === 'item') return W.sprite('item', e.key, cls, r);
    if (e.type === 'pet') return W.sprite('pet', e.key, cls, r);
    if (e.type === 'mount') return W.sprite('mount', e.key, cls, r);
    if (e.type === 'power') return '<span class="sprite ' + (cls || '') + ' r' + r + '" style="display:grid;place-items:center;color:' + e.power.color + ';font-size:1.6em">✦</span>';
    return '';
  }
  function matches(e, st) {
    if (st.cat !== 'all') { var c = catOf(st.cat); if (!c || !c.test(e)) return false; }
    if (st.rarity >= 0 && (st.rarity < e.rmin || st.rarity > e.rmax)) return false;
    if (st.tier >= 0 && e.tier !== st.tier) return false;
    if (st.q) {
      var hay = (e.name.en + ' ' + e.name.he + ' ' + e.key + ' ' + typeLabel(e)).toLowerCase();
      if (st.q.toLowerCase().split(/\s+/).some(function (w) { return w && hay.indexOf(w) < 0; })) return false;
    }
    return true;
  }
  function shortStats(e) {
    if (e.type === 'gear' || e.type === 'mythic' || e.type === 'unique') return W.statInline(e.stats);
    if (e.type === 'set') return fmt(e.set.b2.desc);
    if (e.type === 'power') return fmt(e.power.desc);
    if (e.type === 'pet') return fmt(L('+' + Math.round(e.pet.mf * 100) + '% Magic Find · ' + e.pet.price.toLocaleString() + ' G', '+' + Math.round(e.pet.mf * 100) + '% מציאת שלל · ' + e.pet.price.toLocaleString() + ' זהב'));
    if (e.type === 'mount') return fmt(L('x' + e.mount.speed + ' speed · Lv ' + e.mount.req + ' · ' + e.mount.price.toLocaleString() + ' G', 'מהירות x' + e.mount.speed + ' · רמה ' + e.mount.req + ' · ' + e.mount.price.toLocaleString() + ' זהב'));
    return fmt(e.item.desc);
  }

  // ================================================================ items list page
  function itemsPage(args) {
    if (args[0]) return itemDetail(args.join('/'));
    var st = S.items;
    var all = entries();
    var list = all.filter(function (e) { return matches(e, st); });
    var side = '<a href="#items" data-cat="all" class="' + (st.cat === 'all' ? 'on' : '') + '"><span>' + esc(t(L('Everything', 'הכול'))) + '</span><span class="cnt">' + all.length + '</span></a>' +
      CATS.map(function (c) {
        if (c.group) return '<h5>' + esc(t(c.group)) + '</h5>';
        var cnt = all.filter(function (e) { return c.test(e); }).length;
        return '<button type="button" data-cat="' + c.id + '" class="' + (st.cat === c.id ? 'on' : '') + '"><span>' + esc(t(c.name)) + '</span><span class="cnt">' + cnt + '</span></button>';
      }).join('');
    var rar = '<div class="seg" role="group" aria-label="' + esc(t(L('Rarity', 'נדירות'))) + '"><button type="button" data-rar="-1" class="' + (st.rarity < 0 ? 'on' : '') + '">' + esc(t(L('All rarities', 'כל הנדירויות'))) + '</button>' +
      D.rarity.map(function (r) { return '<button type="button" data-rar="' + r.id + '" class="' + (st.rarity === r.id ? 'on' : '') + '" style="color:' + r.color + '">' + esc(t(r.name)) + '</button>'; }).join('') + '</div>';
    var tiers = '<select class="field" id="tier-sel" aria-label="' + esc(t(L('Material tier', 'דרגת חומר'))) + '"><option value="-1">' + esc(t(L('All tiers', 'כל הדרגות'))) + '</option>' +
      D.tiers.map(function (x) { return '<option value="' + x.id + '"' + (st.tier === x.id ? ' selected' : '') + '>' + esc(t(x.name)) + ' (' + esc(t(L('Lv', 'רמה'))) + ' ' + x.level + '+)</option>'; }).join('') + '</select>';
    var head = '<div class="page-head"><div><h1>' + esc(t(L('Items & Equipment Database', 'מאגר הפריטים והציוד'))) + '</h1><p>' +
      fmt(L('Every item in the game - ' + D.gear.length + ' forgeable gear blueprints, ' + D.uniques.length + ' unique weapons, ' + D.sets.reduce(function (s, x) { return s + x.pieces.length; }, 0) + ' set pieces and ' + D.items.length + ' materials, consumables and furnishings. Open any entry for its tempering slider, forge recipe and exact drop sources.', 'כל פריט במשחק - ' + D.gear.length + ' שרטוטי ציוד, ' + D.uniques.length + ' נשקים ייחודיים, ' + D.sets.reduce(function (s, x) { return s + x.pieces.length; }, 0) + ' חלקי סטים ו-' + D.items.length + ' חומרים, מתכלים ופריטי ריהוט. פתחו כל רשומה כדי לראות מחוון חישול, מתכון נפחייה ומקורות שלל מדויקים.')) + '</p></div></div>';
    var cards = list.slice(0, 400).map(function (e) {
      return '<a class="icard r' + e.show + '" href="#items/' + encodeURIComponent(e.key) + '">' + entrySprite(e, '') +
        '<span class="ib"><span class="nm">' + esc(t(e.name)) + '</span><span class="sub">' + esc(typeLabel(e)) + (e.level ? ' · ' + esc(t(L('Lv', 'רמה'))) + ' ' + n(e.level) : '') + '</span><span class="st">' + shortStats(e) + '</span></span></a>';
    }).join('');
    return head + '<div class="layout"><aside class="side" aria-label="' + esc(t(L('Categories', 'קטגוריות'))) + '">' + side + '</aside><div>' +
      '<div class="controls sticky"><input type="search" class="field" id="items-q" placeholder="' + esc(t(L('Filter by name, type or stat...', 'סינון לפי שם, סוג או תכונה...'))) + '" value="' + esc(st.q) + '" />' + tiers + rar +
      '<span class="dim small">' + n(list.length) + ' ' + esc(t(L('results', 'תוצאות'))) + '</span></div>' +
      (list.length ? '<div class="icards" id="icards">' + cards + '</div>' : '<div class="empty">' + esc(t(L('Nothing matches these filters.', 'אין פריטים שמתאימים לסינון.'))) + '</div>') + '</div></div>';
  }
  function itemsAfter(args, root) {
    if (args[0]) return itemDetailAfter(args.join('/'), root);
    root.querySelectorAll('[data-cat]').forEach(function (b) {
      b.addEventListener('click', function (ev) { ev.preventDefault(); S.items.cat = b.getAttribute('data-cat'); W.refresh(); });
    });
    root.querySelectorAll('[data-rar]').forEach(function (b) {
      b.addEventListener('click', function () { S.items.rarity = +b.getAttribute('data-rar'); W.refresh(); });
    });
    var ts = root.querySelector('#tier-sel');
    if (ts) ts.addEventListener('change', function () { S.items.tier = +ts.value; W.refresh(); });
    var q = root.querySelector('#items-q');
    if (q) {
      var timer;
      q.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { S.items.q = q.value; W.refresh(); var nq = document.getElementById('items-q'); if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); } }, 160);
      });
    }
  }

  // ================================================================ drop math shared by items, bestiary and reverse lookup
  function mfTotal() {
    var m = S.mf;
    var parts = [];
    parts.push([L('Gear affixes', 'אפיקסים בציוד'), m.gear / 100]);
    if (m.fortune) parts.push([I.power.p_fortune.name, I.power.p_fortune.stats.magicFind]);
    if (m.style > 0) parts.push([L('Style rank ' + D.style.ranks[m.style].rank, 'דרגת סגנון ' + D.style.ranks[m.style].rank), D.loot.mfSources.styleMax * m.style / 6]);
    if (m.mastery) parts.push([L('Hunting Mastery', 'שליטת ציד'), D.loot.mfSources.huntMastery]);
    if (m.guild > 0) parts.push([L('Crimson Wing rank ' + m.guild, 'הכנף הארגמנית דרגה ' + m.guild), D.loot.mfSources.guildPerRank * m.guild]);
    if (m.pet && I.pet[m.pet]) parts.push([I.pet[m.pet].name, I.pet[m.pet].mf]);
    if (m.food) parts.push([I.item.food_platter.name, I.item.food_platter.effect.buff.stats.magicFind]);
    if (m.night) parts.push([L('Night Hunt', 'ציד לילה'), D.loot.mfSources.night]);
    var total = parts.reduce(function (s, p) { return s + p[1]; }, 0);
    return { total: total, parts: parts };
  }
  function ctxFor(mon, level, mfv) {
    return { level: level, floor: +S.mf.floor || 0, mf: mfv == null ? mfTotal().total : mfv, raid: mon.raid };
  }
  /** per-kill chance & expected quantity of one specific item key from a creature */
  function chanceFrom(lines, key) {
    var miss = 1, qty = 0, missB = 1;
    lines.forEach(function (l) {
      var p = 0, pb = 0, q = (l.min + l.max) / 2;
      if (l.kind === 'item' && l.item === key) { p = l.chance; pb = l.base; }
      else if (l.kind === 'gem' && /^gem_/.test(key)) { p = l.chance / D.gems.length; pb = l.base / D.gems.length; q = 1; }
      else if (l.kind === 'unique' && (key === 'unique:any' || I.unique[key])) { var k = key === 'unique:any' ? 1 : 1 / D.uniques.length; p = l.chance * k; pb = l.base * k; q = 1; }
      if (p > 0) { miss *= 1 - p; missB *= 1 - pb; qty += p * q; }
    });
    return { p: 1 - miss, base: 1 - missB, qty: qty };
  }
  function lineLabel(l) {
    if (l.kind === 'item') return W.tok(l.item);
    if (l.kind === 'gem') return '<span class="tok">' + W.sprite('item', 'gem_flame', 'xs') + '<span>' + esc(t(L('Random Elemental Gem (1 of ' + D.gems.length + ')', 'אבן יסוד אקראית (אחת מ-' + D.gems.length + ')'))) + '</span></span>';
    if (l.kind === 'gear') return '<span class="tok">' + W.sprite('gear', { kind: 'base', base: 'w_sword', tier: 2, rarity: 3 }, 'xs', 3) + '<span>' + esc(t(l.key === '+gear2' ? L('Second gear piece', 'פריט ציוד שני') : L('Random gear (rarity rolled below)', 'ציוד אקראי (הנדירות מוגרלת למטה)'))) + '</span></span>';
    if (l.kind === 'unique') return '<a class="tok r4" href="#items/unique"><span class="sprite xs r4"></span><span class="rtext">' + esc(t(L('Unique weapon (1 of ' + D.uniques.length + ')', 'נשק ייחודי (אחד מ-' + D.uniques.length + ')'))) + '</span></a>';
    if (l.kind === 'mythicGear') return '<span class="tok r5"><span class="rtext">' + esc(t(L('Mythic gear piece', 'פריט ציוד מיתי'))) + '</span></span>';
    return esc(l.key);
  }
  function dropTableHtml(mon, level) {
    var mf = mfTotal().total;
    var lines = E.dropTable(mon.id, ctxFor(mon, level, mf));
    var rows = lines.map(function (l) {
      var kills = E.killsFor(l.chance, 0.9);
      return '<tr' + (l.own ? '' : ' class="dimrow"') + '><td><div class="it">' + lineLabel(l) + '</div></td>' +
        '<td class="c">' + n(l.min === l.max ? l.min : l.min + '–' + l.max) + '</td>' +
        '<td class="r">' + pct(l.base) + '</td>' +
        '<td class="r"><b class="' + (l.chance > l.base ? 'gold' : '') + '">' + pct(l.chance) + '</b></td>' +
        '<td style="min-width:90px"><div class="pbar"><b style="width:' + Math.min(100, l.base * 100) + '%"></b><i style="width:' + Math.min(100, l.chance * 100) + '%"></i></div></td>' +
        '<td class="r">' + (l.chance >= 1 ? n('1') : n((1 / l.chance).toFixed(l.chance > 0.1 ? 1 : 0))) + '</td>' +
        '<td class="r">' + (isFinite(kills) ? n(kills) : '∞') + '</td>' +
        '<td><span class="tag">' + esc(t(l.own ? L('Species table', 'טבלת המין') : L('Global rule', 'כלל כללי'))) + '</span></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="dt"><thead><tr><th>' + esc(t(L('Drop', 'שלל'))) + '</th><th class="c">' + esc(t(L('Qty', 'כמות'))) + '</th><th class="r">' + esc(t(L('Base %', 'בסיס %'))) + '</th><th class="r">' + esc(t(L('Your %', 'האחוז שלכם'))) + '</th><th></th><th class="r">' + esc(t(L('Avg kills (1/p)', 'הריגות בממוצע (1/p)'))) + '</th><th class="r">' + esc(t(L('Kills for 90%', 'הריגות ל-90%'))) + '</th><th>' + esc(t(L('Source', 'מקור'))) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function rarityOddsHtml(mon) {
    var floor = +S.mf.floor || 0;
    var src = E.sourceOf(mon.id, floor);
    var mf = mfTotal().total;
    var base = E.gearRollOdds(src, 0);
    var eff = E.gearRollOdds(src, mf);
    var effR = E.rarityOdds(src, mf);
    var rows = D.rarity.map(function (r) {
      return '<tr><td><span class="rtext r' + r.id + '">' + esc(t(r.name)) + '</span></td><td class="r">' + pct(E.rarityOdds(src, 0)[r.id]) + '</td><td class="r"><b>' + pct(effR[r.id]) + '</b></td><td style="min-width:110px"><div class="pbar" style="--c:' + r.color + '"><i style="width:' + Math.min(100, effR[r.id] * 100) + '%;background:' + r.color + '"></i></div></td></tr>';
    }).join('');
    var lines = E.dropTable(mon.id, ctxFor(mon, mon.level, mf));
    var eg = E.expectedGear(lines);
    return '<div class="table-wrap"><table class="dt"><thead><tr><th>' + esc(t(L('Rarity per gear piece', 'נדירות לכל פריט ציוד'))) + '</th><th class="r">' + esc(t(L('Base', 'בסיס'))) + '</th><th class="r">' + esc(t(L('Your odds', 'הסיכוי שלכם'))) + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="small dim">' + fmt(L('Expected gear pieces per kill: ' + eg.toFixed(3) + '. An Epic or Legendary roll becomes a random set piece ' + Math.round(D.loot.setPieceChance[src >= 1 ? 1 : 0] * 100) + '% of the time (' + (eff.set * 100).toFixed(2) + '% of all pieces); Legendary and Mythic pieces carry a random golden power. Magic Find upgrades a roll one rarity step with ' + Math.round(Math.min(1, mf * D.loot.mfRarityUpgrade) * 100) + '% chance.', 'מספר פריטי ציוד צפוי לכל הריגה: ' + eg.toFixed(3) + '. הגרלה אפית או אגדית הופכת לחלק סט אקראי ב-' + Math.round(D.loot.setPieceChance[src >= 1 ? 1 : 0] * 100) + '% מהמקרים (' + (eff.set * 100).toFixed(2) + '% מכל הפריטים); לפריטים אגדיים ומיתיים יש כוח זהוב אקראי. מציאת שלל משדרגת הגרלה בדרגת נדירות אחת בסיכוי ' + Math.round(Math.min(1, mf * D.loot.mfRarityUpgrade) * 100) + '%.')) + ' <span class="dim">' + esc(t(L('(Base column: no Magic Find.)', '(עמודת הבסיס: ללא מציאת שלל.)'))) + '</span></p>' + (base ? '' : '');
  }

  // ================================================================ Magic Find calculator (sticky)
  function calcHtml() {
    var m = S.mf;
    var tot = mfTotal();
    var styleOpts = D.style.ranks.map(function (r, i) { return '<option value="' + i + '"' + (m.style === i ? ' selected' : '') + '>' + r.rank + ' · ' + esc(t(r.label)) + ' (+' + Math.round(D.loot.mfSources.styleMax * i / 6 * 100) + '%)</option>'; }).join('');
    var guildOpts = '<option value="0">' + esc(t(L('Not a member', 'לא חבר'))) + '</option>' + D.guildRanks.map(function (r, i) { return '<option value="' + (i + 1) + '"' + (m.guild === i + 1 ? ' selected' : '') + '>' + esc(t(r.name)) + ' (+' + Math.round(D.loot.mfSources.guildPerRank * (i + 1) * 100) + '%)</option>'; }).join('');
    var petOpts = '<option value="">' + esc(t(L('No pet', 'ללא חיה'))) + '</option>' + D.pets.map(function (p) { return '<option value="' + p.id + '"' + (m.pet === p.id ? ' selected' : '') + '>' + esc(t(p.name)) + ' (+' + Math.round(p.mf * 100) + '%)</option>'; }).join('');
    return '<section class="calc' + (m.collapsed ? ' collapsed' : '') + '" id="mf-calc" aria-label="' + esc(t(L('Magic Find calculator', 'מחשבון מציאת שלל'))) + '">' +
      '<label class="lab">' + esc(t(L('Gear & affix Magic Find %', 'מציאת שלל מציוד ואפיקסים %'))) + '<input class="field" type="number" min="0" max="300" step="1" data-mf="gear" value="' + m.gear + '" /></label>' +
      '<label class="lab">' + esc(t(L('Combat Style rank', 'דרגת סגנון קרב'))) + '<select class="field" data-mf="style">' + styleOpts + '</select></label>' +
      '<label class="lab">' + esc(t(L('Guild: Crimson Wing Rangers', 'גילדה: סיירי הכנף הארגמנית'))) + '<select class="field" data-mf="guild">' + guildOpts + '</select></label>' +
      '<label class="lab">' + esc(t(L('Active combat pet', 'חיית קרב פעילה'))) + '<select class="field" data-mf="pet">' + petOpts + '</select></label>' +
      '<label class="lab">' + esc(t(L('Abyss floor (0 = surface)', 'קומה בתהום (0 = פני השטח)'))) + '<input class="field" type="number" min="0" max="200" step="1" data-mf="floor" value="' + m.floor + '" /></label>' +
      '<div class="lab" style="gap:8px">' +
      '<label class="switch"><input type="checkbox" data-mf="fortune"' + (m.fortune ? ' checked' : '') + ' />' + esc(t(I.power.p_fortune.name)) + ' (+25%)</label>' +
      '<label class="switch"><input type="checkbox" data-mf="food"' + (m.food ? ' checked' : '') + ' />' + esc(t(I.item.food_platter.name)) + ' (+12%)</label></div>' +
      '<div class="lab" style="gap:8px">' +
      '<label class="switch"><input type="checkbox" data-mf="mastery"' + (m.mastery ? ' checked' : '') + ' />' + esc(t(L('Hunting Mastery (+10%)', 'שליטת ציד (+10%)'))) + '</label>' +
      '<label class="switch"><input type="checkbox" data-mf="night"' + (m.night ? ' checked' : '') + ' />' + esc(t(L('Night Hunt 20:00-05:00 (+15%)', 'ציד לילה 20:00-05:00 (+15%)'))) + '</label></div>' +
      '<div class="total"><span>' + esc(t(L('Your Magic Find', 'מציאת השלל שלכם'))) + ': <b>' + n('+' + Math.round(tot.total * 100) + '%') + '</b></span>' +
      '<span class="dim small">' + tot.parts.filter(function (p) { return p[1] > 0; }).map(function (p) { return esc(t(p[0])) + ' ' + n('+' + Math.round(p[1] * 100) + '%'); }).join(' · ') + '</span>' +
      '<button type="button" class="btn ghost" data-mf-toggle>' + esc(t(m.collapsed ? L('Show calculator', 'הצגת המחשבון') : L('Collapse', 'כיווץ'))) + '</button></div></section>';
  }
  function bindCalc(root, onChange) {
    root.querySelectorAll('[data-mf]').forEach(function (el) {
      el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', function () {
        var k = el.getAttribute('data-mf');
        if (el.type === 'checkbox') S.mf[k] = el.checked;
        else if (k === 'pet') S.mf.pet = el.value;
        else S.mf[k] = Math.max(0, +el.value || 0);
        saveMf();
        onChange();
      });
    });
    var tg = root.querySelector('[data-mf-toggle]');
    if (tg) tg.addEventListener('click', function () { S.mf.collapsed = !S.mf.collapsed; saveMf(); W.refresh(); });
  }
  function rerenderCalcTotal() {
    var box = document.getElementById('mf-calc');
    if (!box) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = calcHtml();
    box.querySelector('.total').innerHTML = tmp.querySelector('.total').innerHTML;
    var tg = box.querySelector('[data-mf-toggle]');
    if (tg) tg.addEventListener('click', function () { S.mf.collapsed = !S.mf.collapsed; saveMf(); W.refresh(); });
  }

  // ================================================================ bestiary list
  var SPAWN_NAMES = {
    wild: L('Wilds · all day', 'שטח פתוח · כל היום'), dungeon: L('Dungeon', 'מבוך'), night: L('Night only 20:00-05:00', 'לילה בלבד 20:00-05:00'),
    boss: L('Dungeon boss', 'בוס מבוך'), raid: L('Roaming raid · night', 'פשיטה נודדת · לילה'), event: L('World event', 'אירוע עולם'), summon: L('Summoned in boss fight', 'מזומן בקרב בוס'),
  };
  function spawnTags(m) {
    return m.spawns.map(function (s) {
      var cls = s.kind === 'night' || s.kind === 'raid' ? 'night' : s.kind === 'boss' ? 'boss' : '';
      var realm = s.realm >= 0 ? t(D.realms[s.realm].short) + ' · ' : '';
      return '<span class="spawn ' + cls + '">' + esc(realm + t(SPAWN_NAMES[s.kind])) + ' · ' + esc(t(L('Lv', 'רמה'))) + ' ' + n(s.levels[0] === s.levels[1] ? s.levels[0] : s.levels[0] + '–' + s.levels[1]) + (s.kind === 'raid' || s.kind === 'event' ? '+' : '') + '</span>';
    }).join(' ');
  }
  function affinityHtml(m) {
    var w = m.weak.map(W.elBadge).join(' ');
    var r = m.resist.map(W.elBadge).join(' ');
    return (w ? '<span class="dim small">' + esc(t(L('Weak', 'חלש ל'))) + ' ×' + D.frames.weakMult + ':</span> ' + w : '') + (r ? ' <span class="dim small">' + esc(t(L('Resists', 'עמיד ל'))) + ' ×' + D.frames.resistMult + ':</span> ' + r : '');
  }
  function monKind(m) { return m.raid ? 'raid' : m.event ? 'event' : m.boss ? 'boss' : m.elite ? 'elite' : 'monster'; }
  function droppage(args) {
    if (args[0] === 'find') return findPage(args.slice(1).join('/'));
    if (args[0]) return monsterDetail(args[0]);
    var st = S.best;
    var list = D.monsters.filter(function (m) {
      if (st.realm >= 0 && !m.spawns.some(function (s) { return s.realm === st.realm; })) return false;
      if (st.kind !== 'all' && monKind(m) !== st.kind) return false;
      if (st.q) { var hay = (m.name.en + ' ' + m.name.he + ' ' + m.id).toLowerCase(); if (hay.indexOf(st.q.toLowerCase()) < 0) return false; }
      return true;
    });
    var realmChips = '<button type="button" class="chip' + (st.realm < 0 ? ' on' : '') + '" data-realm="-1">' + esc(t(L('All realms', 'כל הממלכות'))) + '</button>' + D.realms.map(function (r, i) { return '<button type="button" class="chip' + (st.realm === i ? ' on' : '') + '" data-realm="' + i + '">' + esc(t(r.short)) + '</button>'; }).join('');
    var kinds = [['all', L('All', 'הכול')], ['monster', L('Monsters', 'מפלצות')], ['elite', L('Night Elites', 'עילית לילה')], ['boss', L('Bosses', 'בוסים')], ['raid', L('Raid bosses', 'בוסי פשיטה')], ['event', L('Events', 'אירועים')]];
    var kindSeg = '<div class="seg">' + kinds.map(function (k) { return '<button type="button" data-kind="' + k[0] + '" class="' + (st.kind === k[0] ? 'on' : '') + '">' + esc(t(k[1])) + '</button>'; }).join('') + '</div>';
    return '<div class="page-head"><div><h1>' + esc(t(L('Drop Rates, Bestiary & Farming Guide', 'אחוזי דרופים, בסטיאריום ומדריך פארם'))) + '</h1><p>' +
      fmt(L('Exact per-kill drop chances for every creature, computed by the same loot function the game rolls. Set your Magic Find below and every table updates live: base %, your effective %, the average kills needed (1/p) and the kills for a 90% chance (ln 0.1 / ln(1-p)).', 'סיכויי שלל מדויקים לכל הריגה עבור כל יצור, מחושבים באותה פונקציית שלל שהמשחק מגריל. הגדירו את מציאת השלל שלכם למטה וכל הטבלאות מתעדכנות בזמן אמת: אחוז בסיס, האחוז האפקטיבי שלכם, ממוצע ההריגות הנדרש (1/p) ומספר ההריגות לסיכוי של 90% (ln 0.1 / ln(1-p)).')) + '</p></div>' +
      '<div class="row"><a class="btn" href="#droprates/find">' + esc(t(L('Where to farm an item', 'איפה לפארם פריט'))) + '</a></div></div>' +
      calcHtml() +
      '<div class="controls"><input type="search" class="field" id="best-q" placeholder="' + esc(t(L('Find a creature...', 'חיפוש יצור...'))) + '" value="' + esc(st.q) + '" />' + kindSeg + '</div><div class="controls"><div class="chips">' + realmChips + '</div></div>' +
      '<div class="grid wide" id="best-list">' + bestCards(list) + '</div>';
  }
  function bestCards(list) {
    if (!list.length) return '<div class="empty">' + esc(t(L('No creature matches.', 'אין יצור מתאים.'))) + '</div>';
    var mf = mfTotal().total;
    return list.map(function (m) {
      var lines = E.dropTable(m.id, ctxFor(m, m.level, mf)).filter(function (l) { return l.own; }).slice(0, 4);
      var st = E.monsterAt(m.id, m.level);
      var tag = m.raid ? L('Raid boss', 'בוס פשיטה') : m.boss ? L('Boss', 'בוס') : m.elite ? L('Night Elite', 'עילית לילה') : m.event ? L('Event', 'אירוע') : L('Monster', 'מפלצת');
      return '<a class="card link" href="#droprates/' + m.id + '"><div class="mon-row">' + W.sprite('monster', m.id, 'md') + '<div><h4>' + esc(t(m.name)) + '</h4><div class="meta">' + esc(t(tag)) + ' · ' + esc(t(L('Lv', 'רמה'))) + ' ' + n(m.level) + ' · ' + esc(t(L('HP', 'חיים'))) + ' ' + num(st.hp) + ' · ' + esc(t(L('Break', 'שבירה'))) + ' ' + num(st.poise) + '</div>' +
        '<div class="small" style="margin-top:4px">' + affinityHtml(m) + '</div></div></div>' +
        '<div class="small" style="margin-top:8px;display:grid;gap:3px">' + (lines.length ? lines.map(function (l) { return '<div class="row" style="justify-content:space-between"><span>' + esc(t(I.item[l.item].name)) + '</span><b class="' + (l.chance > l.base ? 'gold' : 'good') + '">' + pct(l.chance) + '</b></div>'; }).join('') : '<span class="dim">' + esc(t(L('No species drops (global rules only)', 'אין שלל ייחודי למין (כללים כלליים בלבד)'))) + '</span>') + '</div></a>';
    }).join('');
  }
  function dropAfter(args, root) {
    if (args[0] === 'find') return findAfter(args.slice(1).join('/'), root);
    if (args[0]) return monsterAfter(args[0], root);
    bindCalc(root, function () {
      rerenderCalcTotal();
      var box = document.getElementById('best-list');
      var st = S.best;
      var list = D.monsters.filter(function (m) {
        if (st.realm >= 0 && !m.spawns.some(function (s) { return s.realm === st.realm; })) return false;
        if (st.kind !== 'all' && monKind(m) !== st.kind) return false;
        if (st.q) { var hay = (m.name.en + ' ' + m.name.he + ' ' + m.id).toLowerCase(); if (hay.indexOf(st.q.toLowerCase()) < 0) return false; }
        return true;
      });
      box.innerHTML = bestCards(list);
      W.hydrate(box);
    });
    root.querySelectorAll('[data-realm]').forEach(function (b) { b.addEventListener('click', function () { S.best.realm = +b.getAttribute('data-realm'); W.refresh(); }); });
    root.querySelectorAll('[data-kind]').forEach(function (b) { b.addEventListener('click', function () { S.best.kind = b.getAttribute('data-kind'); W.refresh(); }); });
    var q = root.querySelector('#best-q');
    if (q) {
      var timer;
      q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { S.best.q = q.value; W.refresh(); var nq = document.getElementById('best-q'); if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); } }, 160); });
    }
  }

  // ================================================================ monster detail
  var monLevel = {};
  function monsterDetail(id) {
    var m = I.monster[id];
    if (!m) return '<div class="empty">' + esc(t(L('Unknown creature.', 'יצור לא מוכר.'))) + '</div>';
    var lo = Math.min.apply(null, m.spawns.map(function (s) { return s.levels[0]; }).concat([m.level]));
    var hi = Math.max.apply(null, m.spawns.map(function (s) { return s.levels[1]; }).concat([m.level]));
    var lvl = monLevel[id] || m.level;
    var tag = m.raid ? L('Roaming Raid Boss', 'בוס פשיטה נודד') : m.boss ? L('Boss', 'בוס') : m.elite ? L('Named Night Elite', 'עילית לילה בעלת שם') : m.event ? L('World event', 'אירוע עולם') : L('Monster', 'מפלצת');
    var notes = (D.content.notes || {})[id];
    var attacks = m.attacks.map(function (a) {
      var st = a.status ? (I.status[a.status.kind] ? t(I.status[a.status.kind].name) : a.status.kind) + ' ' + n(a.status.dur + (W.lang() === 'he' ? ' ש׳' : 's')) + (a.status.chance ? ' (' + Math.round(a.status.chance * 100) + '%)' : '') : '';
      return '<tr><td><b>' + esc(t(a.name)) + '</b></td><td>' + (a.element !== 'none' ? W.elBadge(a.element) : '<span class="dim">-</span>') + '</td><td class="r">' + (a.mult ? n('×' + a.mult + (a.repeat > 1 ? ' ×' + a.repeat : '') + (a.count > 1 ? ' ×' + a.count : '')) : '<span class="dim">-</span>') + '</td><td class="r">' + W.secs(a.windup) + '</td><td class="r">' + W.secs(a.cd) + '</td><td>' + esc(st) + '</td><td class="small dim">' + esc(a.shape) + (a.special ? ' · ' + esc(a.special) : '') + '</td></tr>';
    }).join('');
    var phases = m.phases.length ? '<h3>' + esc(t(L('Boss phases', 'שלבי הבוס'))) + '</h3>' + m.phases.map(function (p) {
      return '<div class="phase"><b>' + esc(t(p.name)) + '</b> <span class="dim small">' + esc(t(L('from', 'מ-'))) + ' ' + pct(p.at, 0) + ' ' + esc(t(L('HP', 'חיים'))) + (p.speed !== 1 ? ' · ' + esc(t(L('speed', 'מהירות'))) + ' ×' + n(p.speed) : '') + '</b></span><div class="small">' + p.attacks.map(function (aid) { var a = m.attacks.filter(function (x) { return x.id === aid; })[0]; return a ? esc(t(a.name)) : aid; }).join(' · ') + '</div></div>';
    }).join('') : '';
    return '<div class="crumbs"><a href="#droprates">' + esc(t(L('Drop Rates & Bestiary', 'אחוזי דרופים ובסטיאריום'))) + '</a><span class="sep"></span><span>' + esc(t(m.name)) + '</span></div>' +
      '<div class="detail"><aside class="showcase" style="--rc:' + (m.boss ? '#ff5d6c' : m.elite ? '#b46cff' : '#7fe9ff') + '">' +
      '<div class="stage"><canvas id="mon-stage"></canvas></div>' +
      '<h1>' + esc(t(m.name)) + '</h1>' + (m.title ? '<div class="flavor">' + esc(t(m.title)) + '</div>' : '') +
      '<div class="badges"><span class="badge">' + esc(t(tag)) + '</span>' + (m.element !== 'none' ? ' ' + W.elBadge(m.element) : '') + (m.flying ? ' <span class="badge" style="--c:#bfe6ff">' + esc(t(L('Flying', 'מעופף'))) + '</span>' : '') + (m.ranged ? ' <span class="badge" style="--c:#ffb35c">' + esc(t(L('Ranged', 'טווח'))) + '</span>' : '') + '</div>' +
      (m.intro ? '<p class="flavor small">' + esc(t(m.intro)) + '</p>' : '') +
      '<div class="row" style="justify-content:center"><button type="button" class="btn ghost" id="mon-anim">' + esc(t(L('Play attack', 'הפעלת התקפה'))) + '</button><button type="button" class="btn ghost" id="mon-turn">' + esc(t(L('Turn', 'סיבוב'))) + '</button></div>' +
      '</aside><div>' +
      calcHtml() +
      '<div class="panel"><div class="row"><h2 class="mt0" style="margin:0">' + esc(t(L('Stats by level', 'סטטיסטיקות לפי רמה'))) + '</h2><span class="spacer"></span><span class="temper-lvl" id="mon-lvl-out" style="font-size:1.2rem">' + esc(t(L('Lv', 'רמה'))) + ' ' + n(lvl) + '</span></div>' +
      '<input type="range" id="mon-lvl" min="' + Math.max(1, lo) + '" max="' + Math.min(60, Math.max(hi, lo + 1)) + '" value="' + lvl + '" aria-label="' + esc(t(L('Creature level', 'רמת היצור'))) + '" />' +
      '<div id="mon-stats"></div><div style="margin-top:10px">' + spawnTags(m) + '</div><p class="small" style="margin-top:10px">' + affinityHtml(m) + '</p></div>' +
      (notes ? '<div class="callout cyan"><b>' + esc(t(L('Tactical notes', 'הערות טקטיות'))) + ':</b> ' + fmt(notes) + '</div>' : '') +
      '<div class="section-title"><h2>' + esc(t(L('Loot table', 'טבלת שלל'))) + '</h2><span class="line"></span></div><div id="mon-drops"></div>' +
      '<div class="section-title"><h2>' + esc(t(L('Gear rarity odds', 'סיכויי נדירות לציוד'))) + '</h2><span class="line"></span></div><div id="mon-rarity"></div>' +
      '<div class="section-title"><h2>' + esc(t(L('Attacks & telegraphs', 'התקפות וסימונים'))) + '</h2><span class="line"></span></div>' +
      '<div class="table-wrap"><table class="dt"><thead><tr><th>' + esc(t(L('Attack', 'התקפה'))) + '</th><th>' + esc(t(L('Element', 'יסוד'))) + '</th><th class="r">' + esc(t(L('Damage', 'נזק'))) + '</th><th class="r">' + esc(t(L('Wind-up', 'הכנה'))) + '</th><th class="r">' + esc(t(L('Cooldown', 'טעינה'))) + '</th><th>' + esc(t(L('Status', 'מצב'))) + '</th><th>' + esc(t(L('Shape', 'צורה'))) + '</th></tr></thead><tbody>' + attacks + '</tbody></table></div>' +
      phases + '</div></div>';
  }
  function monsterDyn(id) {
    var m = I.monster[id];
    var lvl = monLevel[id] || m.level;
    var st = E.monsterAt(id, lvl);
    var gold = E.goldOf(id, lvl, +S.mf.floor || 0);
    var stats = document.getElementById('mon-stats');
    if (stats) stats.innerHTML = '<div class="cols3" style="margin-top:8px">' + [
      [L('HP', 'חיים'), num(st.hp)], [L('ATK', 'התקפה'), num(st.atk)], [L('DEF', 'הגנה'), num(st.def)], [L('Break Bar (poise)', 'מד שבירה'), num(st.poise)],
      [L('XP per kill', 'ניסיון להריגה'), num(st.xp)], [L('Gold per kill', 'זהב להריגה'), n(gold[0] + '–' + gold[1])], [L('Move speed', 'מהירות תנועה'), num(st.speed)], [L('Aggro range', 'טווח זיהוי'), num(m.aggro)],
      [L('Break stun', 'הלם שבירה'), W.secs(m.boss || m.elite ? D.frames.breakStun : D.frames.breakStunSmall)],
    ].map(function (x) { return '<div class="counter"><b style="font-size:1.1rem">' + x[1] + '</b><span>' + esc(t(x[0])) + '</span></div>'; }).join('') + '</div>';
    var out = document.getElementById('mon-lvl-out');
    if (out) out.innerHTML = esc(t(L('Lv', 'רמה'))) + ' ' + n(lvl);
    var dr = document.getElementById('mon-drops');
    if (dr) { dr.innerHTML = dropTableHtml(m, lvl); W.hydrate(dr); }
    var rr = document.getElementById('mon-rarity');
    if (rr) rr.innerHTML = rarityOddsHtml(m);
  }
  function monsterAfter(id, root) {
    var m = I.monster[id];
    if (!m) return;
    monsterDyn(id);
    var attack = false, dir = 0;
    var c = root.querySelector('#mon-stage');
    if (c) W.animate(c, function (g, time, w, h) { E.drawCreature(g, id, time, w, h, dir, attack); });
    var a = root.querySelector('#mon-anim');
    if (a) a.addEventListener('click', function () { attack = !attack; a.classList.toggle('on', attack); });
    var tr = root.querySelector('#mon-turn');
    if (tr) tr.addEventListener('click', function () { dir = [0, 3, 1, 2][(([0, 3, 1, 2].indexOf(dir)) + 1) % 4]; });
    var r = root.querySelector('#mon-lvl');
    if (r) r.addEventListener('input', function () { monLevel[id] = +r.value; monsterDyn(id); });
    bindCalc(root, function () { rerenderCalcTotal(); monsterDyn(id); });
  }

  // ================================================================ reverse lookup: where to farm
  var FINDABLE = null;
  function findables() {
    if (FINDABLE) return FINDABLE;
    var keys = {};
    D.monsters.forEach(function (m) { m.drops.forEach(function (d) { keys[d.id] = 1; }); });
    ['enh_stone', 'enh_greater', 'treasure_map', 'relic_shard', 'mythic_core'].forEach(function (k) { keys[k] = 1; });
    D.gems.forEach(function (g) { keys[g.item] = 1; });
    D.items.forEach(function (it) { if (it.sub === 'ore' || it.sub === 'herb' || it.sub === 'fish' || it.sub === 'ingot') keys[it.id] = 1; });
    FINDABLE = Object.keys(keys).filter(function (k) { return I.item[k]; }).concat(['unique:any']).concat(D.uniques.map(function (u) { return u.id; }));
    return FINDABLE;
  }
  function sourcesOf(key) {
    var mf = mfTotal().total;
    var floor = +S.mf.floor || 0;
    var rows = [];
    D.monsters.forEach(function (m) {
      m.spawns.forEach(function (sp) {
        var lvl = sp.levels[1];
        var lines = E.dropTable(m.id, { level: lvl, floor: floor, mf: mf, raid: m.raid });
        var c = chanceFrom(lines, key);
        if (c.p > 0) rows.push({ m: m, sp: sp, lvl: lvl, c: c });
      });
    });
    rows.sort(function (a, b) { return b.c.p - a.c.p || a.lvl - b.lvl; });
    return rows;
  }
  function otherSources(key) {
    var out = [];
    var it = I.item[key];
    (I.recipeOut[key] || []).forEach(function (r) {
      out.push([r.station === 'smelt' ? L('Smelting (any forge)', 'התכה (בכל נפחייה)') : r.station === 'alchemy' ? L('Alchemy (apothecary or home station)', 'אלכימיה (בית מרקחת או עמדה ביתית)') : L('Cooking (inn or home hearth)', 'בישול (פונדק או אח ביתית)'), r.ins.map(function (x) { return W.tok(x[0], '×' + x[1]); }).join(' ') + (r.qty > 1 ? ' <span class="dim">→ ×' + r.qty + '</span>' : '')]);
    });
    D.realms.forEach(function (R, i) {
      if (R.ores.indexOf(key) >= 0) out.push([L('Ore veins', 'עורקי עפרה'), '<a href="#maps/' + i + '/wild">' + esc(t(R.short)) + '</a> · ' + esc(t(L('mine with E', 'כרייה עם E')))]);
      if (R.herbs.indexOf(key) >= 0) out.push([L('Herb groves', 'חורשות צמחים'), '<a href="#maps/' + i + '/wild">' + esc(t(R.short)) + '</a> · ' + esc(t(L('gather with E', 'איסוף עם E')))]);
    });
    var f = D.fish.filter(function (x) { return x.id === key; })[0];
    if (f) out.push([L('Fishing', 'דיג'), '<a href="#maps/' + f.realm + '/wild">' + esc(t(D.realms[f.realm].short)) + '</a> · ' + W.rarityBadge(f.rarity) + ' · ' + esc(t(L('difficulty', 'קושי'))) + ' ' + pct(f.diff, 0)]);
    if (key === 'enh_greater' || key === 'treasure_map' || key === 'relic_shard' || key === 'mythic_core' || /^gem_/.test(key) || key === 'unique:any' || I.unique[key]) out.push([L('Black Market (unlocked by a caravan escort)', 'השוק השחור (נפתח אחרי ליווי שיירה)'), esc(t(L('Daily stock: one unique, two set pieces, a treasure map, a relic shard, a Mythic Core, 3 Greater Stones and a gem.', 'מלאי יומי: נשק ייחודי אחד, שני חלקי סט, מפת אוצר, רסיס שריד, ליבה מיתית, 3 אבני חישול גדולות ואבן יסוד.')))]);
    if (key === 'unique:any' || I.unique[key]) out.push([L('Treasure maps', 'מפות אוצר'), esc(t(L('Every dig: 12% unique, otherwise 45% set piece, otherwise an Epic piece.', 'כל חפירה: 12% נשק ייחודי, אחרת 45% חלק סט, אחרת פריט אפי.')))]);
    if (it && it.sub === 'stone') out.push([L('Salvaging tempered gear', 'פירוק ציוד מחושל'), esc(t(L('+3 and higher returns Enhancement Stones; +7 and higher also a Greater Stone.', 'פירוק פריט +3 ומעלה מחזיר אבני חישול; +7 ומעלה גם אבן חישול גדולה.')))]);
    if (key === 'arcane_dust') out.push([L('Salvaging any gear', 'פירוק כל ציוד'), esc(t(L('1 + 2 per rarity step (+1 if crafted).', '1 ועוד 2 לכל דרגת נדירות (+1 אם זויף).')))]);
    return out;
  }
  function findPage(key) {
    var st = S.find;
    var opts = findables();
    var groups = {};
    opts.forEach(function (k) {
      var lab = k === 'unique:any' || I.unique[k] ? t(L('Unique weapons', 'נשקים ייחודיים')) : (function () { var it = I.item[k]; var c = CATS.filter(function (x) { return x.test && x.id && x.test({ sub: it.sub, type: 'item' }); })[0]; return c ? t(c.name) : ''; })();
      (groups[lab] = groups[lab] || []).push(k);
    });
    var sel = '<select class="field" id="find-sel" aria-label="' + esc(t(L('Item to farm', 'פריט לפארם'))) + '"><option value="">' + esc(t(L('Choose an item...', 'בחרו פריט...'))) + '</option>' + Object.keys(groups).map(function (g) {
      return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (k) { var nm = k === 'unique:any' ? L('Any unique weapon', 'כל נשק ייחודי') : W.ref(k).name; return '<option value="' + esc(k) + '"' + (k === key ? ' selected' : '') + '>' + esc(t(nm)) + '</option>'; }).join('') + '</optgroup>';
    }).join('') + '</select>';
    var body = '';
    if (key) {
      var rows = sourcesOf(key);
      var others = otherSources(key);
      var name = key === 'unique:any' ? L('Any unique weapon', 'כל נשק ייחודי') : W.ref(key).name;
      body = '<div class="panel"><div class="row">' + (key !== 'unique:any' ? W.ref(key).sprite ? W.ref(key).sprite('md') : '' : '') + '<div><h2 class="mt0">' + esc(t(name)) + '</h2><p class="dim">' + fmt(L(rows.length + ' creature sources, ranked by your effective chance per kill.', rows.length + ' מקורות יצורים, מדורגים לפי הסיכוי האפקטיבי שלכם להריגה.')) + '</p></div>' + (I.item[key] || I.unique[key] ? '<span class="spacer"></span><a class="btn ghost" href="#items/' + key + '">' + esc(t(L('Item page', 'עמוד הפריט'))) + '</a>' : '') + '</div></div>' +
        (rows.length ? '<div class="table-wrap"><table class="dt"><thead><tr><th>#</th><th>' + esc(t(L('Source', 'מקור'))) + '</th><th>' + esc(t(L('Where & when', 'איפה ומתי'))) + '</th><th class="r">' + esc(t(L('Base %', 'בסיס %'))) + '</th><th class="r">' + esc(t(L('Your %', 'האחוז שלכם'))) + '</th><th class="r">' + esc(t(L('Avg per kill', 'ממוצע להריגה'))) + '</th><th class="r">' + esc(t(L('Expected kills', 'הריגות צפויות'))) + '</th><th class="r">' + esc(t(L('Kills for 90%', 'הריגות ל-90%'))) + '</th></tr></thead><tbody>' +
          rows.map(function (r, i) {
            var k90 = E.killsFor(r.c.p, 0.9);
            return '<tr' + (i === 0 ? ' class="hl"' : '') + '><td>' + n(i + 1) + '</td><td><div class="it">' + W.tok(r.m.id) + '</div></td><td>' + spawnTags({ spawns: [r.sp] }) + '</td><td class="r">' + pct(r.c.base) + '</td><td class="r"><b class="gold">' + pct(r.c.p) + '</b></td><td class="r">' + n(r.c.qty.toFixed(2)) + '</td><td class="r">' + n(r.c.p >= 1 ? '1' : (1 / r.c.p).toFixed(1)) + '</td><td class="r">' + (isFinite(k90) ? n(k90) : '∞') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<div class="empty">' + esc(t(L('No creature drops this item - see the other sources below.', 'אף יצור לא מפיל את הפריט הזה - ראו את המקורות האחרים למטה.'))) + '</div>') +
        (others.length ? '<div class="section-title"><h2>' + esc(t(L('Other sources', 'מקורות נוספים'))) + '</h2><span class="line"></span></div><div class="table-wrap"><table class="dt"><tbody>' + others.map(function (o) { return '<tr><td><b>' + esc(t(o[0])) + '</b></td><td>' + o[1] + '</td></tr>'; }).join('') + '</tbody></table></div>' : '');
    } else body = '<div class="empty">' + esc(t(L('Pick an ore, monster part, gem, stone, relic or unique weapon to see every source ranked from the best farm to the worst.', 'בחרו עפרה, חלק מפלצת, אבן יסוד, אבן חישול, שריד או נשק ייחודי כדי לראות כל מקור, מדורג מהפארם הטוב ביותר לגרוע ביותר.'))) + '</div>';
    void st;
    return '<div class="crumbs"><a href="#droprates">' + esc(t(L('Drop Rates & Bestiary', 'אחוזי דרופים ובסטיאריום'))) + '</a><span class="sep"></span><span>' + esc(t(L('Where to farm', 'איפה לפארם'))) + '</span></div>' +
      '<div class="page-head"><div><h1>' + esc(t(L('Where to Farm Fastest', 'איפה לפארם הכי מהר'))) + '</h1><p>' + fmt(L('Reverse lookup: every drop source of an item, sorted from the highest effective drop chance to the lowest, with Expected Kills = 1 / EffectiveDropRate.', 'חיפוש הפוך: כל מקורות השלל של פריט, ממוינים מסיכוי השלל האפקטיבי הגבוה לנמוך, עם הריגות צפויות = 1 חלקי אחוז השלל האפקטיבי.')) + '</p></div></div>' +
      calcHtml() + '<div class="controls">' + sel + '</div><div id="find-body">' + body + '</div>';
  }
  function findAfter(key, root) {
    var sel = root.querySelector('#find-sel');
    if (sel) sel.addEventListener('change', function () { W.go('#droprates/find/' + encodeURIComponent(sel.value)); });
    bindCalc(root, function () { W.refresh(); });
    void key;
  }

  // ================================================================ item detail
  function parseKey(key) {
    if (/^power:/.test(key)) return { type: 'power', power: I.power[key.slice(6)] };
    if (I.gear[key]) return { type: I.gear[key].mythic ? 'mythic' : 'gear', gear: I.gear[key] };
    if (I.unique[key]) return { type: 'unique', unique: I.unique[key] };
    var sp = /^(set_\w+)#(\d+)$/.exec(key);
    if (sp && I.set[sp[1]]) return { type: 'set', set: I.set[sp[1]], piece: +sp[2] };
    if (I.item[key]) return { type: 'item', item: I.item[key] };
    if (I.pet[key]) return { type: 'pet', pet: I.pet[key] };
    if (I.mount[key]) return { type: 'mount', mount: I.mount[key] };
    if (key === 'unique') return { type: 'uniqueList' };
    return null;
  }
  function specFor(p) {
    var s = S.item;
    if (p.type === 'gear') return { kind: 'base', base: p.gear.base, tier: p.gear.tier, rarity: s.source === 'forge' ? null : s.rarity, grade: s.source === 'forge' ? s.grade || 'standard' : null, temper: s.temper };
    if (p.type === 'mythic') return { kind: 'mythic', base: p.gear.base, tier: 6, grade: s.source === 'forge' ? s.grade || 'standard' : null, temper: s.temper };
    if (p.type === 'unique') return { kind: 'unique', unique: p.unique.id, tier: s.tier, temper: s.temper };
    if (p.type === 'set') return { kind: 'set', set: p.set.id, piece: p.piece, tier: s.tier, rarity: Math.max(3, Math.min(4, s.rarity)), temper: s.temper };
    return null;
  }
  function gearDropHtml(p) {
    // chance that one kill drops this exact base at this tier, by source type
    var srcNames = [L('Monster', 'מפלצת'), L('Night Elite', 'עילית לילה'), L('Boss', 'בוס'), L('Abyss boss (floor 20+)', 'בוס תהום (קומה 20+)')];
    var nb = D.gearBases.length;
    var mf = mfTotal().total;
    var R = D.loot.rules;
    var rows = srcNames.map(function (nm, src) {
      var eff = E.gearRollOdds(src, mf);
      var perPiece = p.type === 'mythic' ? eff.mythic / nb : (eff.plain.reduce(function (s, v) { return s + v; }, 0)) / nb;
      var perLeg = p.type === 'mythic' ? 0 : eff.plain[4] / nb;
      // exact per-kill odds of the game's gear lines: monsters roll one piece at a chance, elites 1 + a second at a chance, bosses 3
      var pieces = src === 0 ? [E.mfChance(R.gear.normal, mf, 'gear')] : src === 1 ? [1, E.mfChance(R.gear.eliteSecond, mf, 'gear')] : [1, 1, 1];
      var miss = 1, missLeg = 1, exp = 0;
      pieces.forEach(function (pc) { miss *= 1 - pc * perPiece; missLeg *= 1 - pc * perLeg; exp += pc; });
      if (p.type === 'mythic' && src === 3) miss *= 1 - E.mfChance(R.abyss.mythicGear, mf, 'gear') / nb;
      var pk = 1 - miss;
      var k90 = E.killsFor(pk);
      return '<tr><td>' + esc(t(nm)) + '</td><td class="r">' + n(exp.toFixed(2)) + '</td><td class="r"><b class="gold">' + pct(pk) + '</b></td><td class="r">' + (p.type === 'mythic' ? '-' : pct(1 - missLeg)) + '</td><td class="r">' + (isFinite(k90) ? n(k90) : '∞') + '</td></tr>';
    }).join('');
    var lv = D.tiers[p.gear.tier];
    var nxt = D.tiers[p.gear.tier + 1];
    return '<p>' + fmt(p.type === 'mythic'
      ? L('Mythic pieces drop only from Deep Abyss rolls (2% of rarity weight at floor 20+) and from Abyss bosses on floor 30+ (15% per kill, any base). They can also be forged from the Mythic blueprint below.', 'פריטים מיתיים נופלים רק מהגרלות בתהום העמוקה (2% ממשקל הנדירות בקומה 20+) ומבוסי התהום בקומה 30+ (15% להריגה, בסיס אקראי). אפשר גם לזייף אותם מהשרטוט המיתי שלמטה.')
      : L('Dropped by any creature of level ' + lv.level + (nxt ? '–' + (nxt.level - 1) : '+') + ' (tier ' + t(lv.name) + '). Every gear roll picks one of ' + nb + ' bases at random, then a rarity.', 'נופל מכל יצור ברמה ' + lv.level + (nxt ? '–' + (nxt.level - 1) : '+') + ' (דרגת ' + t(lv.name) + '). כל הגרלת ציוד בוחרת אחד מ-' + nb + ' בסיסים באקראי, ואז נדירות.')) + '</p>' +
      '<div class="table-wrap"><table class="dt"><thead><tr><th>' + esc(t(L('Killed', 'הריגת'))) + '</th><th class="r">' + esc(t(L('Gear per kill', 'ציוד להריגה'))) + '</th><th class="r">' + esc(t(L('This item, any rarity', 'הפריט הזה, כל נדירות'))) + '</th><th class="r">' + esc(t(L('Legendary', 'אגדי'))) + '</th><th class="r">' + esc(t(L('Kills for 90%', 'הריגות ל-90%'))) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="small dim">' + fmt(L('Also found in dungeon chests, from rescued adventurers and as Epic treasure-map loot. Uses your Magic Find from the Drop Rates calculator (+' + Math.round(mf * 100) + '%).', 'נמצא גם בתיבות מבוך, אצל הרפתקנים שחולצו וכשלל אפי ממפות אוצר. משתמש במציאת השלל שלכם ממחשבון אחוזי הדרופים (+' + Math.round(mf * 100) + '%).')) + '</p>';
  }
  function blueprintHtml(bp) {
    if (!bp) return '';
    return '<div class="row">' + bp.ins.map(function (x) { return W.tok(x[0], '×' + x[1]); }).join(' ') + ' <span class="tok"><b class="gold">' + num(bp.gold) + '</b>&nbsp;' + esc(t(L('gold', 'זהב'))) + '</span></div>';
  }
  function itemDetail(key) {
    var p = parseKey(key);
    if (!p) return '<div class="empty">' + esc(t(L('Unknown item.', 'פריט לא מוכר.'))) + '</div>';
    if (p.type === 'uniqueList') { S.items.cat = 'unique'; return itemsPage([]); }
    var crumbs = '<div class="crumbs"><a href="#items">' + esc(t(L('Items & Equipment', 'פריטים וציוד'))) + '</a><span class="sep"></span><span id="crumb-name"></span></div>';
    if (p.type === 'gear' || p.type === 'mythic' || p.type === 'unique' || p.type === 'set') return crumbs + gearDetail(p, key);
    if (p.type === 'power') return crumbs + powerDetail(p.power);
    if (p.type === 'pet' || p.type === 'mount') return crumbs + creatureItem(p);
    return crumbs + plainItem(p.item);
  }
  function gearDetail(p, key) {
    var s = S.item;
    var isForgeable = p.type === 'gear' || p.type === 'mythic';
    var b = I.base[p.type === 'gear' || p.type === 'mythic' ? p.gear.base : p.type === 'unique' ? p.unique.base : p.set.pieces[p.piece].base];
    var srcSeg = isForgeable ? '<div class="seg" id="src-seg"><button type="button" data-src="drop" class="' + (s.source === 'drop' ? 'on' : '') + '">' + esc(t(L('Dropped', 'נפל כשלל'))) + '</button><button type="button" data-src="forge" class="' + (s.source === 'forge' ? 'on' : '') + '">' + esc(t(L('Forged', 'זויף בנפחייה'))) + '</button></div>' : '';
    var raritySeg = p.type === 'gear' && s.source === 'drop' ? '<div class="seg" id="rar-seg">' + D.rarity.slice(0, 5).map(function (r) { return '<button type="button" data-r="' + r.id + '" class="' + (s.rarity === r.id ? 'on' : '') + '" style="color:' + r.color + '">' + esc(t(r.name)) + '</button>'; }).join('') + '</div>' :
      p.type === 'set' ? '<div class="seg" id="rar-seg">' + [3, 4].map(function (r) { return '<button type="button" data-r="' + r + '" class="' + (Math.max(3, Math.min(4, s.rarity)) === r ? 'on' : '') + '" style="color:' + D.rarity[r].color + '">' + esc(t(D.rarity[r].name)) + '</button>'; }).join('') + '</div>' : '';
    var gradeSeg = isForgeable && s.source === 'forge' ? '<div class="seg" id="grade-seg">' + D.grades.map(function (g) { return '<button type="button" data-g="' + g.id + '" class="' + ((s.grade || 'standard') === g.id ? 'on' : '') + '" style="color:' + g.color + '">' + esc(t(g.name)) + ' ' + n(Math.round(g.mult * 100) + '%') + '</button>'; }).join('') + '</div>' : '';
    var tierSeg = p.type === 'unique' || p.type === 'set' ? '<label class="lab">' + esc(t(L('Item tier (scales with the level it dropped at)', 'דרגת הפריט (לפי הרמה שבה נפל)'))) + '<select class="field" id="tier-pick">' + D.tiers.map(function (x) { return '<option value="' + x.id + '"' + (s.tier === x.id ? ' selected' : '') + '>' + esc(t(x.name)) + ' · ' + esc(t(L('Lv', 'רמה'))) + ' ' + x.level + '+</option>'; }).join('') + '</select></label>' : '';
    var extra = '';
    if (p.type === 'unique') {
      var pw = I.power[p.unique.power];
      extra += '<div class="power" style="--c:' + pw.color + '"><b>✦ ' + esc(t(pw.name)) + '</b> <span class="badge" style="--c:#ffd166">' + esc(t(L('Extractable into the Aether Relic Codex', 'ניתן לחילוץ לקודקס שרידי האתר'))) + '</span><p>' + fmt(pw.desc) + '</p></div>';
      extra += '<p class="flavor">' + esc(t(p.unique.flavor)) + '</p>';
    }
    if (p.type === 'set') extra += setBonusHtml(p.set, p.piece);
    var note = (D.content.notes || {})[p.type === 'unique' ? p.unique.id : p.type === 'set' ? p.set.id : ''];
    return '<div class="detail"><aside class="showcase" id="g-show"><div class="sprite lg" id="g-spr"><canvas id="g-canvas"></canvas></div><h1 id="g-name"></h1><div class="badges" id="g-badges"></div><div id="g-sum" class="small"></div></aside><div>' +
      '<div class="panel"><div class="controls mt0">' + srcSeg + raritySeg + gradeSeg + tierSeg + '</div>' +
      '<div class="temper-box"><div><label class="lab" for="temper">' + esc(t(L('Tempering level (+0 to +10)', 'רמת חישול (+0 עד +10)'))) + '</label><input type="range" id="temper" min="0" max="' + D.meta.maxTemper + '" step="1" value="' + s.temper + '" /><div class="ticks">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (x) { return '<span>+' + x + '</span>'; }).join('') + '</div></div><div class="temper-lvl" id="temper-out">+' + s.temper + '</div></div>' +
      '<div class="cols2" style="margin-top:12px"><div><h3 class="mt0">' + esc(t(L('Stats at this level', 'הסטטיסטיקות ברמה הזאת'))) + '</h3><div id="g-stats"></div></div><div><h3 class="mt0">' + esc(t(L('Item facts', 'נתוני הפריט'))) + '</h3><div id="g-facts"></div></div></div></div>' +
      (extra ? '<div class="panel">' + extra + '</div>' : '') +
      (note ? '<div class="callout cyan"><b>' + esc(t(L('Tactical notes', 'הערות טקטיות'))) + ':</b> ' + fmt(note) + '</div>' : '') +
      '<div class="section-title"><h2>' + esc(t(L('Tempering costs & odds', 'עלויות וסיכויי חישול'))) + '</h2><span class="line"></span></div>' +
      '<div class="controls"><label class="lab">' + esc(t(L('Gilded Anvil Syndicate rank', 'דרגה בסינדיקט הסדן המוזהב'))) + '<select class="field" id="anvil-rank"><option value="0">' + esc(t(L('Not a member', 'לא חבר'))) + '</option>' + D.guildRanks.map(function (r, i) { return '<option value="' + (i + 1) + '"' + (s.guild === i + 1 ? ' selected' : '') + '>' + esc(t(r.name)) + ' (+' + Math.round(D.temper.guildPerRank * (i + 1) * 100) + '%)</option>'; }).join('') + '</select></label>' +
      '<label class="switch"><input type="checkbox" id="artisan"' + (s.artisan ? ' checked' : '') + ' />' + esc(t(I.power.s6_anvil.name)) + ' (+' + Math.round(D.temper.setBonus * 100) + '%)</label></div><div id="g-temper"></div>' +
      (isForgeable ? '<div class="section-title"><h2>' + esc(t(L('Forge blueprint', 'שרטוט נפחייה'))) + '</h2><span class="line"></span></div><div class="panel">' + blueprintHtml(p.gear.blueprint) + '<p class="small dim" style="margin-top:8px">' + fmt(L('Forge quality = hammer score (3 strikes × 0-3) × quality (×' + D.forge.homeQuality + ' at a Personal Master Anvil, +' + Math.round(D.forge.guildQuality * 100) + '% per Gilded Anvil rank). Fine from ' + D.forge.thresholds.fine + ', Masterwork from ' + D.forge.thresholds.masterwork + ', Supreme from ' + D.forge.thresholds.supreme + '. Quick forging rolls Standard ' + Math.round(D.forge.autoOdds.standard * 100) + '% / Fine ' + Math.round(D.forge.autoOdds.fine * 100) + '% / Masterwork ' + Math.round(D.forge.autoOdds.masterwork * 100) + '%.', 'איכות הזיוף = ניקוד הפטיש (3 הקשות × 0-3) × איכות (×' + D.forge.homeQuality + ' בסדן אמן פרטי, +' + Math.round(D.forge.guildQuality * 100) + '% לכל דרגה בסדן המוזהב). משובח מ-' + D.forge.thresholds.fine + ', יצירת מופת מ-' + D.forge.thresholds.masterwork + ', עליון מ-' + D.forge.thresholds.supreme + '. זיוף מהיר מגריל רגיל ' + Math.round(D.forge.autoOdds.standard * 100) + '% / משובח ' + Math.round(D.forge.autoOdds.fine * 100) + '% / מופת ' + Math.round(D.forge.autoOdds.masterwork * 100) + '%.')) + '</p></div>' : '') +
      '<div class="section-title"><h2>' + esc(t(L('How to obtain', 'איך משיגים'))) + '</h2><span class="line"></span></div><div class="panel" id="g-obtain">' + obtainHtml(p) + '</div>' +
      (p.type === 'gear' ? '<div class="section-title"><h2>' + esc(t(L('Every tier of this blueprint', 'כל הדרגות של השרטוט'))) + '</h2><span class="line"></span></div>' + tierTable(p.gear.base) : '') +
      '</div></div>';
    void b;
  }
  function tierTable(base) {
    var rows = D.gear.filter(function (g) { return g.base === base; }).map(function (g) {
      return '<tr' + (g.id === W.current().args.join('/') ? ' class="hl"' : '') + '><td><div class="it">' + W.sprite('gear', W.gearSpecOf(g), 'xs', g.mythic ? 5 : 2) + '<a href="#items/' + g.id + '">' + esc(t(g.name)) + '</a></div></td><td class="r">' + n(g.level) + '</td><td>' + W.statInline(g.stats) + '</td><td>' + blueprintHtml(g.blueprint) + '</td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="dt"><thead><tr><th>' + esc(t(L('Item', 'פריט'))) + '</th><th class="r">' + esc(t(L('Level', 'רמה'))) + '</th><th>' + esc(t(L('Base stats (Common +0)', 'סטטיסטיקות בסיס (רגיל +0)'))) + '</th><th>' + esc(t(L('Blueprint', 'שרטוט'))) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function obtainHtml(p) {
    if (p.type === 'gear' || p.type === 'mythic') return gearDropHtml(p);
    var mf = mfTotal().total;
    var U = D.loot.rules.unique;
    if (p.type === 'unique') {
      var k = 1 / D.uniques.length;
      var rows = [[L('Roaming raid boss', 'בוס פשיטה נודד'), U.raid], [L('Realm or Abyss boss', 'בוס ממלכה או תהום'), U.boss], [L('Abyss boss, floor ' + U.deepFloor + '+', 'בוס תהום, קומה ' + U.deepFloor + '+'), U.bossDeep], [L('Named Night Elite', 'עילית לילה בעלת שם'), U.elite]];
      return '<div class="table-wrap"><table class="dt"><thead><tr><th>' + esc(t(L('Source', 'מקור'))) + '</th><th class="r">' + esc(t(L('Any unique', 'ייחודי כלשהו'))) + '</th><th class="r">' + esc(t(L('This unique', 'הייחודי הזה'))) + '</th><th class="r">' + esc(t(L('Kills for 90%', 'הריגות ל-90%'))) + '</th></tr></thead><tbody>' +
        rows.map(function (r) { var pa = E.mfChance(r[1], mf, 'unique'); var pt = pa * k; return '<tr><td>' + esc(t(r[0])) + '</td><td class="r">' + pct(pa) + '</td><td class="r"><b class="gold">' + pct(pt) + '</b></td><td class="r">' + n(E.killsFor(pt)) + '</td></tr>'; }).join('') +
        '</tbody></table></div><p class="small dim">' + fmt(L('Also: 12% of treasure-map digs (any unique) and one random unique in the Black Market every day. The tier matches the level of the creature or dig.', 'בנוסף: 12% מחפירות מפות האוצר (ייחודי כלשהו) ונשק ייחודי אקראי אחד בשוק השחור בכל יום. הדרגה תואמת לרמת היצור או החפירה.')) + ' <a href="#droprates/find/' + p.unique.id + '">' + esc(t(L('Ranked farm list', 'רשימת פארם מדורגת'))) + '</a></p>';
    }
    if (p.type === 'set') {
      var setN = D.sets.length, pieces = p.set.pieces.length;
      var rows2 = [0, 1, 2, 3].map(function (src) {
        var eff = E.gearRollOdds(src, mf);
        var per = eff.set / setN / pieces;
        return '<tr><td>' + esc(t([L('Monster', 'מפלצת'), L('Night Elite', 'עילית לילה'), L('Boss', 'בוס'), L('Deep Abyss', 'תהום עמוקה')][src])) + '</td><td class="r">' + pct(eff.set) + '</td><td class="r"><b class="gold">' + pct(per) + '</b></td></tr>';
      }).join('');
      return '<div class="table-wrap"><table class="dt"><thead><tr><th>' + esc(t(L('Per gear piece from', 'לכל פריט ציוד מ'))) + '</th><th class="r">' + esc(t(L('Any set piece', 'חלק סט כלשהו'))) + '</th><th class="r">' + esc(t(L('This exact piece', 'החלק המדויק הזה'))) + '</th></tr></thead><tbody>' + rows2 + '</tbody></table></div><p class="small dim">' + fmt(L('Set pieces replace Epic or Legendary gear rolls (' + Math.round(D.loot.setPieceChance[0] * 100) + '% from monsters, ' + Math.round(D.loot.setPieceChance[1] * 100) + '% from elites and bosses). Also: two random set pieces in the Black Market daily and 45% of non-unique treasure digs.', 'חלקי סט מחליפים הגרלות ציוד אפיות או אגדיות (' + Math.round(D.loot.setPieceChance[0] * 100) + '% ממפלצות, ' + Math.round(D.loot.setPieceChance[1] * 100) + '% מעילית ובוסים). בנוסף: שני חלקי סט אקראיים בשוק השחור בכל יום ו-45% מחפירות האוצר שאינן ייחודיות.')) + '</p>';
    }
    return '';
  }
  function setBonusHtml(set, current) {
    return '<h3 class="mt0" style="color:' + set.color + '">' + esc(t(set.name)) + ' <span class="dim small">' + esc(t(set.theme)) + '</span></h3>' +
      '<div class="stats">' + [[2, set.b2.desc], [4, set.b4.desc], [6, set.b6.desc]].map(function (b) { return '<div class="stat"><span><span class="badge" style="--c:' + set.color + '">' + n(b[0]) + ' ' + esc(t(L('pieces', 'חלקים'))) + '</span> ' + fmt(b[1]) + '</span></div>'; }).join('') + '</div>' +
      '<div class="power" style="--c:' + set.color + ';margin-top:8px"><b>✦ ' + esc(t(I.power[set.b6.power].name)) + '</b><p class="small">' + fmt(I.power[set.b6.power].desc) + '</p></div>' +
      '<div class="chips" style="margin-top:8px">' + set.pieces.map(function (pc, i) { return (i === current ? '<span class="tok" style="border-color:' + set.color + '">' : '') + W.tok(set.id + '#' + i) + (i === current ? '</span>' : ''); }).join('') + '</div>' +
      '<p class="small dim">' + fmt(L('Two-handed set weapons (spear, halberd, bow, staff) count as two pieces.', 'נשקי סט דו-ידניים (חנית, הלברד, קשת, מטה) נחשבים כשני חלקים.')) + '</p>';
  }
  function gearDyn(key) {
    var p = parseKey(key);
    var spec = specFor(p);
    var prev = E.gearPreview(spec);
    var base0 = E.gearPreview(Object.assign({}, spec, { temper: 0 }));
    var s = S.item;
    var show = document.getElementById('g-show');
    var rc = 'var(--r-' + RN[prev.rarity] + ')';
    if (show) show.style.setProperty('--rc', rc);
    var nm = p.type === 'unique' ? p.unique.name : p.type === 'set' ? p.set.pieces[p.piece].name : p.gear.name;
    var nameEl = document.getElementById('g-name');
    if (nameEl) nameEl.innerHTML = esc(t(nm)) + (spec.temper ? ' <span class="gold">+' + spec.temper + '</span>' : '');
    var cr = document.getElementById('crumb-name');
    if (cr) cr.textContent = t(nm);
    var b = I.base[spec.base || (p.type === 'unique' ? p.unique.base : p.set.pieces[p.piece].base)];
    var tierIdx = p.type === 'gear' ? p.gear.tier : p.type === 'mythic' ? 6 : s.tier;
    var badges = document.getElementById('g-badges');
    if (badges) badges.innerHTML = W.rarityBadge(prev.rarity) + ' <span class="badge" style="--c:#9fd3ff">' + esc(t(b.label)) + '</span> <span class="badge" style="--c:#ffd166">' + esc(t(D.tiers[tierIdx].name)) + ' · ' + esc(t(L('Item Lv', 'רמת פריט'))) + ' ' + n(D.tiers[tierIdx].level) + '</span>' + (prev.grade ? ' <span class="badge" style="--c:' + I.grade[prev.grade].color + '">' + esc(t(I.grade[prev.grade].name)) + '</span>' : '') + (b.wtype && I.weapon[b.wtype] && I.weapon[b.wtype].twoHanded ? ' <span class="badge" style="--c:#ff9a3d">' + esc(t(L('Two-handed', 'דו-ידני'))) + '</span>' : '');
    var sum = document.getElementById('g-sum');
    if (sum) sum.innerHTML = '<p class="dim" style="text-align:center">' + fmt(L('Rolls ' + D.affixCount[prev.rarity] + ' random affix' + (D.affixCount[prev.rarity] === 1 ? '' : 'es') + ' when it drops' + (prev.rarity >= 4 && p.type !== 'unique' && p.type !== 'set' ? ' plus a random legendary golden power' : '') + '. Shown without affixes so the base numbers are exact.', 'מגריל ' + D.affixCount[prev.rarity] + ' אפיקסים אקראיים כשהוא נופל' + (prev.rarity >= 4 && p.type !== 'unique' && p.type !== 'set' ? ' וכוח זהוב אגדי אקראי' : '') + '. מוצג ללא אפיקסים כדי שמספרי הבסיס יהיו מדויקים.')) + '</p>';
    var st = document.getElementById('g-stats');
    if (st) st.innerHTML = W.statList(prev.stats, spec.temper ? base0.stats : null);
    var facts = document.getElementById('g-facts');
    if (facts) facts.innerHTML = '<dl class="kv">' +
      '<dt>' + esc(t(L('Rarity multiplier', 'מכפיל נדירות'))) + '</dt><dd>' + n('×' + D.rarity[prev.rarity].mult) + '</dd>' +
      (prev.grade ? '<dt>' + esc(t(L('Craft grade', 'איכות זיוף'))) + '</dt><dd>' + n('×' + I.grade[prev.grade].mult) + '</dd>' : '') +
      '<dt>' + esc(t(L('Tempering', 'חישול'))) + '</dt><dd>' + n('×' + (1 + D.meta.temperStep * spec.temper).toFixed(2)) + ' ' + esc(t(L('flat stats', 'סטטיסטיקות קבועות'))) + '</dd>' +
      '<dt>' + esc(t(L('Gem sockets', 'חריצי אבנים'))) + '</dt><dd>' + n(prev.sockets) + (prev.socketCost ? ' · ' + num(prev.socketCost) + ' ' + esc(t(L('G each', 'זהב לחריץ'))) : '') + '</dd>' +
      '<dt>' + esc(t(L('Sell value', 'ערך מכירה'))) + '</dt><dd>' + num(prev.value) + ' ' + esc(t(L('gold', 'זהב'))) + '</dd>' +
      '<dt>' + esc(t(L('Salvages into', 'מתפרק ל'))) + '</dt><dd>' + prev.salvage.map(function (x) { return W.tok(x[0], '×' + x[1]); }).join(' ') + '</dd>' +
      (prev.power && p.type !== 'unique' && p.type !== 'set' ? '<dt>' + esc(t(L('Golden power', 'כוח זהוב'))) + '</dt><dd>' + esc(t(I.power[prev.power].name)) + '</dd>' : '') +
      '</dl>';
    W.hydrate(facts || document);
    var out = document.getElementById('temper-out');
    if (out) out.textContent = '+' + spec.temper;
    // tempering table
    var bonus = (s.guild ? D.temper.guildPerRank * s.guild : 0) + (s.artisan ? D.temper.setBonus : 0);
    var tot = { stones: 0, greater: 0, gold: 0 };
    var rows = prev.temperSteps.map(function (x) {
      var ch = Math.min(1, x.chance + bonus);
      var tries = 1 / ch;
      if (x.stone === 'enh_stone') tot.stones += x.stones * tries; else tot.greater += x.stones * tries;
      tot.gold += x.gold * tries;
      return '<tr' + (x.to === spec.temper ? ' class="hl"' : '') + '><td><b>+' + x.to + '</b></td><td>' + W.tok(x.stone, '×' + x.stones) + '</td><td class="r">' + num(x.gold) + '</td><td class="r">' + pct(x.chance, 0) + '</td><td class="r"><b class="' + (ch > x.chance ? 'gold' : '') + '">' + pct(ch, 0) + '</b></td><td class="r">' + n(tries.toFixed(2)) + '</td></tr>';
    }).join('');
    var tt = document.getElementById('g-temper');
    if (tt) {
      tt.innerHTML = '<div class="table-wrap"><table class="dt"><thead><tr><th>' + esc(t(L('Step', 'שלב'))) + '</th><th>' + esc(t(L('Stones', 'אבנים'))) + '</th><th class="r">' + esc(t(L('Gold', 'זהב'))) + '</th><th class="r">' + esc(t(L('Base chance', 'סיכוי בסיס'))) + '</th><th class="r">' + esc(t(L('Your chance', 'הסיכוי שלכם'))) + '</th><th class="r">' + esc(t(L('Avg tries', 'ניסיונות בממוצע'))) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<p class="small dim">' + fmt(L('Expected total for +0 → +10: ' + tot.stones.toFixed(1) + ' Enhancement Stones, ' + tot.greater.toFixed(1) + ' Greater Stones and ' + Math.round(tot.gold).toLocaleString() + ' gold. A failed attempt consumes the materials but never damages the item.', 'סך צפוי מ-+0 עד +10: ' + tot.stones.toFixed(1) + ' אבני חישול, ' + tot.greater.toFixed(1) + ' אבני חישול גדולות ו-' + Math.round(tot.gold).toLocaleString() + ' זהב. ניסיון כושל צורך את החומרים אבל לעולם לא פוגע בפריט.')) + '</p>';
      W.hydrate(tt);
    }
    return spec;
  }
  function itemDetailAfter(key, root) {
    var p = parseKey(key);
    if (!p) return;
    if (p.type === 'uniqueList') return itemsAfter([], root);
    if (p.type === 'item' || p.type === 'power') return;
    if (p.type === 'pet' || p.type === 'mount') {
      var cv = root.querySelector('#c-stage');
      if (cv) W.animate(cv, function (g, time, w, h) { if (p.type === 'pet') E.drawPetSprite(g, p.pet.id, time, w, h); else E.drawMountSprite(g, p.mount.id, time, w, h, Math.floor(time / 2.5) % 2 ? 2 : 3); });
      return;
    }
    var spec = gearDyn(key);
    var c = root.querySelector('#g-canvas');
    if (c) W.animate(c, function (g, time, w, h) {
      var sp = specFor(p);
      var icon = E.gearIcon(sp);
      g.imageSmoothingQuality = 'high';
      var bob = Math.sin(time * 1.6) * 3;
      g.drawImage(icon, w * 0.06, h * 0.06 + bob, w * 0.88, h * 0.88);
      if ((sp.temper || 0) >= 4) E.drawSparks(g, sp, w / 2, h * 0.58 + bob, time);
    });
    void spec;
    function on(sel, ev, fn) { root.querySelectorAll(sel).forEach(function (el) { el.addEventListener(ev, function () { fn(el); }); }); }
    on('#temper', 'input', function (el) { S.item.temper = +el.value; gearDyn(key); });
    on('[data-r]', 'click', function (el) { S.item.rarity = +el.getAttribute('data-r'); W.refresh(); });
    on('[data-g]', 'click', function (el) { S.item.grade = el.getAttribute('data-g'); W.refresh(); });
    on('[data-src]', 'click', function (el) { S.item.source = el.getAttribute('data-src'); W.refresh(); });
    on('#tier-pick', 'change', function (el) { S.item.tier = +el.value; W.refresh(); });
    on('#anvil-rank', 'change', function (el) { S.item.guild = +el.value; gearDyn(key); });
    on('#artisan', 'change', function (el) { S.item.artisan = el.checked; gearDyn(key); });
  }
  function plainItem(it) {
    var r = W.itemRarity(it);
    var uses = D.recipes.filter(function (x) { return x.ins.some(function (i) { return i[0] === it.id; }); });
    var made = I.recipeOut[it.id] || [];
    var eff = it.effect;
    var effHtml = '';
    if (eff) {
      var parts = [];
      if (eff.heal) parts.push(L('Restores ' + Math.round(eff.heal * 100) + '% HP', 'משחזר ' + Math.round(eff.heal * 100) + '% חיים'));
      if (eff.mana) parts.push(L('Restores ' + Math.round(eff.mana * 100) + '% MP', 'משחזר ' + Math.round(eff.mana * 100) + '% מאנה'));
      if (eff.sta) parts.push(L('Restores all Stamina', 'משחזר את כל הסיבולת'));
      if (eff.cleanse) parts.push(L('Cleanses ailments', 'מטהר מצבים שליליים'));
      effHtml = '<div class="panel"><h3 class="mt0">' + esc(t(L('Effect', 'השפעה'))) + '</h3>' + (parts.length ? '<p>' + parts.map(fmt).join(' · ') + '</p>' : '') +
        (eff.buff ? '<p><b>' + esc(t(eff.buff.name)) + '</b> · ' + esc(t(L('lasts', 'נמשך'))) + ' ' + n(Math.round(eff.buff.dur / 60) + (W.lang() === 'he' ? ' דק׳' : ' min')) + '</p>' + W.statList(eff.buff.stats) + (eff.buff.hpRegen ? '<p class="small">' + fmt(L('+' + (eff.buff.hpRegen * 100) + '% HP per second', '+' + (eff.buff.hpRegen * 100) + '% חיים בשנייה')) + '</p>' : '') + (eff.buff.oil ? '<p class="small">' + fmt(L('+15% ' + eff.buff.oil + ' damage and its status on hit', '+15% נזק ' + t(I.element[eff.buff.oil].name) + ' והמצב שלו בכל מכה')) + '</p>' : '') : '') + '</div>';
    }
    var furn = it.furniture ? D.furniture[it.furniture] : null;
    var findable = findables().indexOf(it.id) >= 0;
    var srcRows = findable ? sourcesOf(it.id).slice(0, 8) : [];
    var others = otherSources(it.id);
    return '<div class="detail"><aside class="showcase r' + r + '" style="--rc:var(--r-' + RN[r] + ')">' + W.sprite('item', it.id, 'lg', r) + '<h1>' + esc(t(it.name)) + '</h1><div class="badges">' + W.rarityBadge(r) + ' <span class="badge" style="--c:#9fd3ff">' + esc(typeLabel({ type: 'item', sub: it.sub, item: it })) + '</span>' + (it.tier != null ? ' <span class="badge" style="--c:#ffd166">' + esc(t(L('Realm', 'ממלכה'))) + ' ' + n(it.tier + 1) + '</span>' : '') + '</div><p class="flavor">' + esc(t(it.desc)) + '</p><dl class="kv"><dt>' + esc(t(L('Base value', 'ערך בסיס'))) + '</dt><dd>' + num(it.value) + ' ' + esc(t(L('gold', 'זהב'))) + '</dd>' + (furn ? '<dt>' + esc(t(L('Footprint', 'שטח'))) + '</dt><dd>' + n(furn.w + '×' + furn.h) + (furn.walkable ? ' · ' + esc(t(L('walkable', 'ניתן לדריכה'))) : '') + (furn.mounts ? ' · ' + n(furn.mounts) + ' ' + esc(t(L('display mounts', 'מתלי תצוגה'))) : '') + '</dd>' : '') + '</dl></aside><div>' +
      effHtml +
      (made.length ? '<div class="panel"><h3 class="mt0">' + esc(t(L('Recipe', 'מתכון'))) + '</h3>' + made.map(function (x) { return '<div class="row">' + x.ins.map(function (i) { return W.tok(i[0], '×' + i[1]); }).join(' ') + ' <span class="dim">→ ×' + x.qty + '</span></div>'; }).join('') + '</div>' : '') +
      (uses.length ? '<div class="panel"><h3 class="mt0">' + esc(t(L('Used in', 'משמש ב'))) + '</h3><div class="chips">' + uses.map(function (x) { return W.tok(x.out, '×' + x.qty); }).join(' ') + '</div></div>' : '') +
      (it.sub === 'ingot' || it.sub === 'monster' ? usedByBlueprints(it.id) : '') +
      (findable ? '<div class="section-title"><h2>' + esc(t(L('Best drop sources', 'מקורות השלל הטובים ביותר'))) + '</h2><span class="line"></span><a class="btn ghost" href="#droprates/find/' + it.id + '">' + esc(t(L('Full ranked list', 'הרשימה המלאה'))) + '</a></div>' +
        (srcRows.length ? '<div class="table-wrap"><table class="dt"><thead><tr><th>' + esc(t(L('Creature', 'יצור'))) + '</th><th>' + esc(t(L('Where', 'איפה'))) + '</th><th class="r">' + esc(t(L('Chance per kill', 'סיכוי להריגה'))) + '</th><th class="r">' + esc(t(L('Kills for 90%', 'הריגות ל-90%'))) + '</th></tr></thead><tbody>' + srcRows.map(function (x) { return '<tr><td>' + W.tok(x.m.id) + '</td><td>' + spawnTags({ spawns: [x.sp] }) + '</td><td class="r"><b class="gold">' + pct(x.c.p) + '</b></td><td class="r">' + n(E.killsFor(x.c.p)) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="dim">' + esc(t(L('Not dropped by creatures.', 'לא נופל מיצורים.'))) + '</p>') : '') +
      (others.length ? '<div class="section-title"><h2>' + esc(t(L('Other sources', 'מקורות נוספים'))) + '</h2><span class="line"></span></div><div class="table-wrap"><table class="dt"><tbody>' + others.map(function (o) { return '<tr><td><b>' + esc(t(o[0])) + '</b></td><td>' + o[1] + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
      '</div></div>';
  }
  function usedByBlueprints(id) {
    var list = D.gear.filter(function (g) { return g.blueprint.ins.some(function (x) { return x[0] === id; }); });
    if (!list.length) return '';
    return '<div class="panel"><h3 class="mt0">' + esc(t(L('Forge blueprints that need it', 'שרטוטי נפחייה שזקוקים לו'))) + ' <span class="dim small">' + n(list.length) + '</span></h3><div class="chips">' + list.slice(0, 40).map(function (g) { return W.tok(g.id); }).join(' ') + '</div></div>';
  }
  function creatureItem(p) {
    var x = p.pet || p.mount;
    var isPet = !!p.pet;
    return '<div class="detail"><aside class="showcase r3" style="--rc:' + (isPet ? x.color : x.colors[2]) + '"><div class="stage"><canvas id="c-stage"></canvas></div><h1>' + esc(t(x.name)) + '</h1><div class="badges"><span class="badge">' + esc(t(isPet ? L('Combat pet', 'חיית קרב') : L('Mount', 'בהמת רכיבה'))) + '</span>' + (isPet ? ' ' + W.elBadge(x.element) : '') + '</div><p class="flavor">' + fmt(x.desc) + '</p></aside><div><div class="panel"><dl class="kv">' +
      '<dt>' + esc(t(L('Price', 'מחיר'))) + '</dt><dd>' + num(x.price) + ' ' + esc(t(L('gold at the Stable (P)', 'זהב באורווה (P)'))) + '</dd>' +
      '<dt>' + esc(t(L('Required level', 'רמה נדרשת'))) + '</dt><dd>' + n(x.req) + '</dd>' +
      (isPet ? '<dt>' + esc(t(L('Magic Find', 'מציאת שלל'))) + '</dt><dd>' + n('+' + Math.round(x.mf * 100) + '%') + '</dd><dt>' + esc(t(L('Reaction gauge', 'מד תגובה'))) + '</dt><dd>' + (I.element[x.element] && I.element[x.element].gauge ? W.elBadge(I.element[x.element].gauge) : '-') + '</dd>' : '<dt>' + esc(t(L('Speed', 'מהירות'))) + '</dt><dd>' + n('×' + x.speed) + '</dd><dt>' + esc(t(L('Mounted attack', 'התקפה רכובה'))) + '</dt><dd>' + fmt(L('Charge Slam: a ' + D.frames.chargeDur + 's gallop with ' + D.frames.chargeIframes + 's of i-frames that ends in a knockback shockwave.', 'הלמות הסתערות: דהרה של ' + D.frames.chargeDur + ' ש׳ עם ' + D.frames.chargeIframes + ' ש׳ של חסינות שמסתיימת בגל הדף.')) + '</dd>') +
      '</dl></div>' + (isPet ? '<div class="callout cyan">' + fmt(L('Pets loot for you, fight beside you and apply their reaction gauge - pair a pet with your weapon element to trigger reactions constantly. Their Magic Find counts toward every drop table in this codex.', 'חיות אוספות שלל בשבילכם, נלחמות לצדכם ומוסיפות את מד התגובה שלהן - שלבו חיה עם היסוד של הנשק שלכם כדי להפעיל תגובות כל הזמן. מציאת השלל שלהן נספרת בכל טבלאות השלל בקודקס.')) + '</div>' : '') + '</div></div>';
  }
  function powerDetail(pw) {
    if (!pw) return '<div class="empty">?</div>';
    var src = pw.pool === 'legendary' ? L('Random golden power on any Legendary or Mythic gear drop (1 of ' + D.powers.filter(function (x) { return x.pool === 'legendary'; }).length + ' legendary powers).', 'כוח זהוב אקראי בכל פריט אגדי או מיתי שנופל (אחד מ-' + D.powers.filter(function (x) { return x.pool === 'legendary'; }).length + ' כוחות אגדיים).') : pw.pool === 'unique' ? L('Fixed power of a unique weapon.', 'הכוח הקבוע של נשק ייחודי.') : L('Six-piece bonus of an equipment set.', 'בונוס שישה חלקים של סט ציוד.');
    var owner = D.uniques.filter(function (u) { return u.power === pw.id; }).map(function (u) { return W.tok(u.id); }).concat(D.sets.filter(function (s) { return s.b6.power === pw.id; }).map(function (s) { return W.tok(s.id); })).join(' ');
    return '<div class="detail"><aside class="showcase" style="--rc:' + pw.color + '"><div class="sprite lg" style="display:grid;place-items:center;font-size:5rem;color:' + pw.color + '">✦</div><h1>' + esc(t(pw.name)) + '</h1><div class="badges"><span class="badge">' + esc(t(slotName(pw.slot))) + '</span>' + (pw.extractable ? ' <span class="badge" style="--c:#ffd166">' + esc(t(L('Relic Codex', 'קודקס השרידים'))) + '</span>' : ' <span class="badge" style="--c:#ff8a96">' + esc(t(L('Not extractable', 'לא ניתן לחילוץ'))) + '</span>') + '</div></aside><div><div class="power" style="--c:' + pw.color + '"><p>' + fmt(pw.desc) + '</p></div>' + (Object.keys(pw.stats).length ? '<div class="panel">' + W.statList(pw.stats) + '</div>' : '') + '<div class="panel"><h3 class="mt0">' + esc(t(L('Source', 'מקור'))) + '</h3><p>' + fmt(src) + '</p>' + (owner ? '<div class="chips">' + owner + '</div>' : '') + '<p class="small dim">' + fmt(pw.extractable ? L('At the forge\'s Relic Codex tab you can destroy the item to extract this power permanently, then equip it in the matching codex slot on any character.', 'בלשונית קודקס השרידים בנפחייה אפשר להשמיד את הפריט ולחלץ את הכוח הזה לצמיתות, ואז לצייד אותו במשבצת הקודקס המתאימה בכל דמות.') : L('Set powers only work while you wear six pieces of the set.', 'כוחות סט פועלים רק כשלובשים שישה חלקים מהסט.')) + '</p></div></div></div>';
  }

  // ================================================================ sets, uniques & the relic codex
  function setsPage(args) {
    var focus = args[0];
    var sets = D.sets.map(function (s) {
      return '<section class="panel" id="sec-' + s.id + '" style="border-color:' + (focus === s.id ? s.color : '') + '"><div class="row">' + W.sprite('gear', { kind: 'set', set: s.id, piece: 0, tier: 6, rarity: 4 }, 'md', 4) + '<div style="flex:1;min-width:0">' + setBonusHtml(s, -1) + '</div></div>' + ((D.content.notes || {})[s.id] ? '<div class="callout cyan small">' + fmt(D.content.notes[s.id]) + '</div>' : '') + '</section>';
    }).join('');
    var uniques = D.uniques.map(function (u) {
      var pw = I.power[u.power];
      return '<a class="card link" href="#items/' + u.id + '"><div class="mon-row">' + W.sprite('gear', { kind: 'unique', unique: u.id, tier: 6 }, 'md', 4) + '<div><h4 class="rtext r4">' + esc(t(u.name)) + '</h4><div class="meta">' + esc(t(I.base[u.base].label)) + ' · ' + W.statInline(u.stats) + '</div><p class="small" style="color:' + pw.color + '"><b>✦ ' + esc(t(pw.name)) + '</b></p></div></div><p class="small">' + fmt(pw.desc) + '</p></a>';
    }).join('');
    var bySlot = ['weapon', 'armor', 'utility'].map(function (sl) {
      var list = D.powers.filter(function (p) { return p.slot === sl; });
      return '<div class="panel tight"><h3 class="mt0">' + esc(t(slotName(sl))) + ' <span class="dim small">' + n(list.length) + '</span></h3><div class="table-wrap"><table class="dt"><tbody>' + list.map(function (p) {
        return '<tr><td><a href="#items/power:' + p.id + '" style="color:' + p.color + '"><b>✦ ' + esc(t(p.name)) + '</b></a></td><td class="small">' + fmt(p.desc) + '</td><td>' + (p.extractable ? '<span class="badge" style="--c:#ffd166">' + esc(t(L('Codex', 'קודקס'))) + '</span>' : '<span class="badge" style="--c:#8f9db5">' + esc(t(L('Set', 'סט'))) + '</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    }).join('');
    return '<div class="page-head"><div><h1>' + esc(t(L('Sets, Uniques & the Relic Codex', 'סטים, ייחודיים וקודקס השרידים'))) + '</h1><p>' + fmt(L('All ' + D.sets.length + ' equipment sets with their 2-, 4- and 6-piece bonuses, the ' + D.uniques.length + ' unique weapons and all ' + D.powers.length + ' golden powers. Legendary and unique powers can be extracted into the Aether Relic Codex and equipped in its weapon, armor and utility slots.', 'כל ' + D.sets.length + ' סטי הציוד עם בונוסי 2, 4 ו-6 החלקים, ' + D.uniques.length + ' הנשקים הייחודיים וכל ' + D.powers.length + ' הכוחות הזהובים. כוחות אגדיים וייחודיים ניתנים לחילוץ לקודקס שרידי האתר ולציוד במשבצות הנשק, השריון והעזר שלו.')) + '</p></div></div>' +
      '<div class="section-title"><h2>' + esc(t(L('Equipment sets', 'סטי ציוד'))) + '</h2><span class="line"></span></div><div class="cols2">' + sets + '</div>' +
      '<div class="section-title"><h2>' + esc(t(L('Unique weapons', 'נשקים ייחודיים'))) + '</h2><span class="line"></span></div><div class="grid wide">' + uniques + '</div>' +
      '<div class="section-title"><h2>' + esc(t(L('Golden powers (Aether Relic Codex)', 'כוחות זהובים (קודקס שרידי האתר)'))) + '</h2><span class="line"></span></div><div class="cols3">' + bySlot + '</div>';
  }

  W.register({ id: 'items', title: L('Items', 'פריטים וציוד'), nav: true, order: 1, render: itemsPage, after: itemsAfter });
  W.register({ id: 'droprates', title: L('Drop Rates', 'אחוזי דרופים'), nav: true, order: 2, render: droppage, after: dropAfter });
  W.register({ id: 'sets', title: L('Sets & Codex', 'סטים וקודקס'), nav: true, order: 6, render: setsPage });
  W.DB = { mfTotal: mfTotal, entries: entries, chanceFrom: chanceFrom, sourcesOf: sourcesOf, setBonusHtml: setBonusHtml, spawnTags: spawnTags, affinityHtml: affinityHtml };
})();
