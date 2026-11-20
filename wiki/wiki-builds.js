/* Aetheria Codex - recommended builds, tier lists, progression route, farming guide and the
   Skills & Constellation reference. Build content lives in wiki-src/content/builds.mjs and every
   id in it is validated against the game data when the wiki is generated. */
(function () {
  'use strict';
  var W = window.Wiki;
  var D = W.D, E = W.E, I = W.I, L = W.L, t = W.t, esc = W.esc, fmt = W.fmt, n = W.n, pct = W.pct;
  var F = D.frames;
  var C = D.content;
  var BUILDS = C.builds || [];
  var BY = {};
  BUILDS.forEach(function (b) { BY[b.id] = b; });
  void E;

  function stars(k) { var s = ''; for (var i = 1; i <= 5; i++) s += '<span style="color:' + (i <= k ? '#ffd166' : '#3a4560') + '">★</span>'; return '<span aria-label="' + k + '/5">' + s + '</span>'; }
  function morphFactor(m) { return m === 'power' ? 1.35 : m === 'clone' ? 1.4 : 1; }
  /** single-target damage of the first four hotbar skills chained with Skill Connect (rank 1, before crits & gear) */
  function chainMath(b) {
    var total = 0;
    var parts = b.hotbar.slice(0, F.novaChain).map(function (h, i) {
      var sk = I.skill[h.skill];
      var v = sk.timeline.total * (1 + F.connectStep * i) * morphFactor(h.morph);
      total += v;
      return v;
    });
    var nova = b.hotbar.length >= F.novaChain ? F.novaMult : 0;
    return { parts: parts, total: total + nova, nova: nova };
  }
  function parryWindow(b) {
    var rip = (b.passives || []).indexOf('sw_p_riposte') >= 0 ? 3 : 0;
    return F.parryWindow + F.parryPerRiposteRank * rip + (b.keystone === 'ks_shield' ? F.parryKeystone : 0);
  }

  // ================================================================ overview
  function buildCard(b) {
    var art = (b.weaponSets[0].pieces || []).map(function (k) { return W.ref(k).sprite('md'); }).join('') + (b.weaponSets[0].uniques || []).map(function (k) { return W.ref(k).sprite('md'); }).join('');
    return '<a class="build-card" href="#builds/' + b.id + '" style="--c:' + b.color + '"><div class="row"><span class="tierchip t-' + b.tier + '">' + b.tier + '</span><h3>' + esc(t(b.name)) + '</h3></div>' +
      '<div class="row">' + art + '<div class="small dim">' + esc(t(b.role)) + '<br>' + esc(t(L('Difficulty', 'קושי'))) + ' ' + stars(b.difficulty) + '</div></div>' +
      '<p class="small">' + fmt(b.tagline) + '</p>' +
      '<div class="chips">' + b.hotbar.slice(0, 6).map(function (h) { return W.sprite('skill', h.skill, 'xs'); }).join('') + '</div></a>';
  }
  function buildsPage(args) {
    var sub = args[0];
    if (sub === 'tiers') return tiersPage();
    if (sub === 'progression') return progressionPage();
    if (sub === 'farming') return farmingPage();
    if (sub && BY[sub]) return buildDetail(BY[sub]);
    return '<div class="page-head"><div><h1>' + esc(t(L('Recommended Builds & Strategy', 'בילדים מומלצים ואסטרטגיה'))) + '</h1><p>' + fmt(L('Six complete builds with gear, Relic Codex powers, hotbars, Rune Morphs, keystones, companions and rotations - plus tier lists, a level-by-level route and a Magic Find farming guide. Numbers on every card are computed from the game data.', 'שישה בילדים מלאים עם ציוד, כוחות קודקס שרידים, סרגלי כישורים, מורפים רוניים, אבני ראשה, בני לוויה וסדרי פעולות - ובנוסף רשימות דירוג, מסלול מרמה לרמה ומדריך פארם למציאת שלל. המספרים בכל כרטיס מחושבים מנתוני המשחק.')) + '</p></div>' +
      '<div class="chips"><a class="chip" href="#builds/tiers">' + esc(t(L('Tier lists', 'רשימות דירוג'))) + '</a><a class="chip" href="#builds/progression">' + esc(t(L('Progression route', 'מסלול התקדמות'))) + '</a><a class="chip" href="#builds/farming">' + esc(t(L('Farming & Magic Find', 'פארם ומציאת שלל'))) + '</a></div></div>' +
      '<div class="grid wide">' + BUILDS.map(buildCard).join('') + '</div>';
  }

  // ================================================================ build detail
  function gearBlock(b) {
    var sets = b.weaponSets.map(function (ws) {
      var toks = (ws.pieces || []).map(function (k) { return W.tok(k); }).concat((ws.uniques || []).map(function (k) { return W.tok(k); })).concat((ws.bases || []).map(function (k) { return W.tok(k + '@6'); }));
      return '<div style="margin-bottom:8px"><div class="small dim">' + esc(t(ws.label)) + '</div><div class="chips">' + toks.join(' ') + '</div></div>';
    }).join('');
    var armor = '<div class="small dim">' + esc(t(L('Armor', 'שריון'))) + '</div><div class="chips">' + (b.armor.pieces || []).map(function (k) { return W.tok(k); }).join(' ') + '</div>';
    return sets + armor;
  }
  function buildDetail(b) {
    var cm = chainMath(b);
    var pw = parryWindow(b);
    var hot = '<div class="hotbar">' + b.hotbar.map(function (h, i) {
      var sk = I.skill[h.skill];
      var mo = I.morph[h.morph];
      return '<a class="hk" href="#skills/' + sk.id + '" style="--c:' + mo.color + '"><span class="key">' + (i + 1) + '</span>' + W.sprite('skill', sk.id, 'md') + '<b>' + esc(t(sk.name)) + '</b><span class="mo">' + esc(t(mo.label)) + '</span><span class="dim">' + n('×' + sk.timeline.total) + '</span></a>';
    }).join('') + '</div>';
    var powers = b.powers.map(function (id) {
      var p = I.power[id];
      return '<div class="power" style="--c:' + p.color + ';margin-bottom:6px"><b>✦ ' + esc(t(p.name)) + '</b> <span class="dim small">' + esc(t(p.slot === 'weapon' ? L('weapon slot', 'משבצת נשק') : p.slot === 'armor' ? L('armor slot', 'משבצת שריון') : L('utility slot', 'משבצת עזר'))) + '</span><div class="small">' + fmt(p.desc) + '</div></div>';
    }).join('');
    var gems = b.gems.map(function (g) { var x = I.gem[g]; return '<div class="row" style="margin-bottom:4px">' + W.tok(x.item) + '<span class="small">' + fmt(x.desc) + '</span></div>'; }).join('');
    var ks = I.keystone[b.keystone];
    var tree = '<div class="power" style="--c:' + I.branch[ks.branch].color + '"><b>' + esc(t(ks.name)) + '</b> <span class="dim small">' + esc(t(L('Keystone', 'אבן ראשה'))) + ' · ' + esc(t(L('Rank', 'דרגה'))) + ' ' + n(ks.rank) + '</span><div class="small">' + fmt(ks.desc) + '</div></div>' +
      (b.bridges || []).map(function (id) { var br = I.bridge[id]; return '<div class="stat"><span><b>' + esc(t(br.name)) + '</b> <span class="dim small">' + esc(t(I.branch[br.a].name)) + ' + ' + esc(t(I.branch[br.b].name)) + '</span></span><span class="small">' + fmt(br.desc) + '</span></div>'; }).join('') +
      '<div class="chips" style="margin-top:8px">' + (b.passives || []).map(function (id) { var p = I.passive[id]; return '<a class="tok" href="#skills/' + id + '">' + W.sprite('skill', id, 'xs') + '<span>' + esc(t(p.name)) + ' ' + n(p.max + '/' + p.max) + '</span></a>'; }).join('') + '</div>';
    var party = '<div class="chips">' + (b.companions || []).map(function (id) { return W.tok(id); }).join(' ') + ' ' + W.tok(b.pet) + ' ' + (b.items || []).map(function (id) { return W.tok(id); }).join(' ') + '</div>' +
      '<p class="small"><b>' + esc(t(L('Gambit', 'גמביט'))) + ':</b> ' + esc(t(I.gambitName ? I.gambitName(b.gambit) : D.gambits.filter(function (g) { return g.id === b.gambit; })[0].name)) + ' <kbd>' + D.gambits.filter(function (g) { return g.id === b.gambit; })[0].key + '</kbd> - ' + fmt(D.gambits.filter(function (g) { return g.id === b.gambit; })[0].desc) + '</p>';
    return '<div class="crumbs"><a href="#builds">' + esc(t(L('Builds', 'בילדים'))) + '</a><span class="sep"></span><span>' + esc(t(b.name)) + '</span></div>' +
      '<section class="build-card" style="--c:' + b.color + '"><div class="row"><span class="tierchip t-' + b.tier + '">' + b.tier + '</span><h1 style="color:' + b.color + '">' + esc(t(b.name)) + '</h1></div>' +
      '<div class="row"><span class="badge" style="--c:' + b.color + '">' + esc(t(b.role)) + '</span><span class="small dim">' + esc(t(L('Difficulty', 'קושי'))) + ' ' + stars(b.difficulty) + '</span></div><p class="lead">' + fmt(b.tagline) + '</p>' +
      '<div class="counters">' +
      '<div class="counter"><b>' + n('×' + cm.total.toFixed(1)) + '</b><span>' + esc(t(L('4-skill chain damage (ATK, rank 1, incl. Finishing Nova)', 'נזק שרשרת של 4 כישורים (התקפה, דרגה 1, כולל נובת סיום)'))) + '</span></div>' +
      '<div class="counter"><b>' + n(Math.round(pw * 1000) + 'ms') + '</b><span>' + esc(t(L('Perfect Parry window', 'חלון הדיפה מושלמת'))) + '</span></div>' +
      '<div class="counter"><b>' + n(b.hotbar.reduce(function (s, h) { return s + I.skill[h.skill].timeline.hits.length; }, 0)) + '</b><span>' + esc(t(L('strikes on the hotbar', 'מכות בסרגל הכישורים'))) + '</span></div>' +
      '</div></section>' +
      '<div class="cols2" style="margin-top:16px"><div>' +
      '<div class="panel"><h2 class="mt0">' + esc(t(L('Playstyle', 'סגנון משחק'))) + '</h2><p>' + fmt(b.playstyle) + '</p></div>' +
      '<div class="panel"><h2 class="mt0">' + esc(t(L('Rotation', 'סדר פעולות'))) + '</h2><ol class="steps" style="--c:' + b.color + '">' + b.rotation.map(function (r) { return '<li>' + fmt(r) + '</li>'; }).join('') + '</ol></div>' +
      '<div class="panel"><h2 class="mt0">' + esc(t(L('Sword Skill hotbar & Rune Morphs', 'סרגל כישורי החרב ומורפים רוניים'))) + '</h2>' + hot + '<p class="small dim" style="margin-top:8px">' + fmt(L('Morphs unlock at skill rank ' + D.skillRanks.morphRank + '. Execution Rune ×1.35 damage; Shadow-Clone Rune echoes every hit at 40%; Elemental Rune converts the skill to the branch element.', 'מורפים נפתחים בדרגת כישור ' + D.skillRanks.morphRank + '. רונת ההוצאה להורג ×1.35 נזק; רונת שיבוט הצללים חוזרת על כל מכה ב-40%; רונת היסודות ממירה את הכישור ליסוד של הענף.')) + '</p></div>' +
      '<div class="panel"><h2 class="mt0">' + esc(t(L('Constellation', 'קונסטלציה'))) + '</h2>' + tree + '</div>' +
      '</div><div>' +
      '<div class="panel"><h2 class="mt0">' + esc(t(L('Gear', 'ציוד'))) + '</h2>' + gearBlock(b) + '<div style="margin-top:12px">' + W.DB.setBonusHtml(I.set[b.set], -1) + '</div></div>' +
      '<div class="panel"><h2 class="mt0">' + esc(t(L('Aether Relic Codex', 'קודקס שרידי האתר'))) + '</h2>' + powers + '</div>' +
      '<div class="panel"><h2 class="mt0">' + esc(t(L('Gems', 'אבני יסוד'))) + '</h2>' + gems + '</div>' +
      '<div class="panel"><h2 class="mt0">' + esc(t(L('Party, pet & consumables', 'חבורה, חיה ומתכלים'))) + '</h2>' + party + '</div>' +
      '<div class="panel"><h2 class="mt0">' + esc(t(L('Stat priority', 'סדר עדיפות לסטטיסטיקות'))) + '</h2><ol class="steps" style="--c:' + b.color + '">' + b.stats.map(function (s) { return '<li>' + esc(W.statName(s)) + '</li>'; }).join('') + '</ol></div>' +
      '<div class="cols2"><div class="panel tight"><h3 class="mt0 good">' + esc(t(L('Strengths', 'חוזקות'))) + '</h3><ul>' + b.pros.map(function (x) { return '<li>' + fmt(x) + '</li>'; }).join('') + '</ul></div><div class="panel tight"><h3 class="mt0 bad">' + esc(t(L('Weaknesses', 'חולשות'))) + '</h3><ul>' + b.cons.map(function (x) { return '<li>' + fmt(x) + '</li>'; }).join('') + '</ul></div></div>' +
      '<div class="callout">' + '<b>' + esc(t(L('Leveling', 'עלייה ברמות'))) + ':</b> ' + fmt(b.leveling) + '</div>' +
      '</div></div>';
  }

  // ================================================================ tiers, progression, farming
  function tierToken(kind, id) {
    if (kind === 'branch') return '<span class="tok"><span class="el" style="--c:' + I.branch[id].color + '">' + esc(t(I.branch[id].name)) + '</span></span>';
    if (kind === 'keystone') return '<a class="tok" href="#skills/' + id + '"><span>' + esc(t(I.keystone[id].name)) + '</span> <span class="dim small">' + esc(t(I.branch[I.keystone[id].branch].name)) + '</span></a>';
    if (kind === 'reaction') return '<a class="tok" href="#combat-docs/reactions"><b style="color:' + I.reaction[id].color + '">' + esc(t(I.reaction[id].name)) + '</b></a>';
    return W.tok(id);
  }
  function tiersPage() {
    return '<div class="crumbs"><a href="#builds">' + esc(t(L('Builds', 'בילדים'))) + '</a><span class="sep"></span><span>' + esc(t(L('Tier lists', 'רשימות דירוג'))) + '</span></div>' +
      '<div class="page-head"><div><h1>' + esc(t(L('Meta Tier Lists', 'רשימות דירוג מטא'))) + '</h1><p>' + fmt(L('S is build-defining, A is excellent, B is solid, C is niche. Rankings weigh boss performance, safety and how well each option uses the combat systems.', 'S מגדיר בילד, A מצוין, B יציב, C נישתי. הדירוג שוקל ביצועים מול בוסים, בטיחות וכמה טוב כל אפשרות מנצלת את מערכות הקרב.')) + '</p></div></div>' +
      (C.tiers || []).map(function (tl) {
        return '<section class="panel" id="sec-' + tl.id + '"><h2 class="mt0">' + esc(t(tl.title)) + '</h2><div class="tierlist">' + tl.rows.map(function (r) {
          var ids = r[tl.kind + 's'] || [];
          return '<div class="tierrow t-' + r.tier + '"><div class="tl">' + r.tier + '</div><div class="tc">' + ids.map(function (id) { return tierToken(tl.kind, id); }).join('') + '<span class="small dim" style="flex-basis:100%">' + fmt(r.why) + '</span></div></div>';
        }).join('') + '</div></section>';
      }).join('');
  }
  function progressionPage() {
    return '<div class="crumbs"><a href="#builds">' + esc(t(L('Builds', 'בילדים'))) + '</a><span class="sep"></span><span>' + esc(t(L('Progression route', 'מסלול התקדמות'))) + '</span></div>' +
      '<div class="page-head"><div><h1>' + esc(t(L('Progression Route: Level 1 to 60', 'מסלול התקדמות: מרמה 1 עד 60'))) + '</h1><p>' + fmt(L('Where to be, what to forge and whom to recruit at every stage. Gear tiers unlock at levels ' + D.tiers.map(function (x) { return x.level; }).join(', ') + '.', 'איפה להיות, מה לזייף ואת מי לגייס בכל שלב. דרגות הציוד נפתחות ברמות ' + D.tiers.map(function (x) { return x.level; }).join(', ') + '.')) + '</p></div></div>' +
      '<div class="prog">' + (C.progression || []).map(function (p) {
        var R = D.realms[p.realm];
        return '<div class="prog-step"><div><div class="lv">' + n(p.levels[0] + '–' + p.levels[1]) + '<small>' + esc(t(L('Level', 'רמה'))) + '</small></div><a class="small" href="#maps/' + p.realm + '/wild">' + esc(t(R.short)) + '</a></div><div><h3 class="mt0">' + esc(t(p.title)) + '</h3><ul>' + p.goals.map(function (g) { return '<li>' + fmt(g) + '</li>'; }).join('') + '</ul>' +
          '<div class="chips">' + (p.monsters || []).map(function (id) { return W.tok(id); }).join('') + '</div><div class="chips" style="margin-top:6px">' + (p.items || []).map(function (id) { return W.tok(id); }).join('') + '</div></div></div>';
      }).join('') + '</div>';
  }
  function farmingPage() {
    var S = D.loot.mfSources;
    var stack = [
      [I.power.p_fortune.name, I.power.p_fortune.stats.magicFind, L('Relic Codex utility slot', 'משבצת עזר בקודקס')],
      [I.item.food_platter.name, I.item.food_platter.effect.buff.stats.magicFind, L('8 minutes', '8 דקות')],
      [I.pet.pet_moth.name, I.pet.pet_moth.mf, L('active pet', 'חיה פעילה')],
      [L('Crimson Wing Rangers · Champion', 'סיירי הכנף הארגמנית · אלוף'), S.guildPerRank * 5, L('guild perk', 'בונוס גילדה')],
      [L('Style rank SSS', 'דרגת סגנון SSS'), S.styleMax, L('in combat', 'בזמן קרב')],
      [L('Night Hunt', 'ציד לילה'), S.night, L('wilds, 20:00-05:00', 'שטח פתוח, 20:00-05:00')],
      [L('Hunting Mastery', 'שליטת ציד'), S.huntMastery, L('per species', 'לכל מין')],
    ];
    var total = stack.reduce(function (s, x) { return s + x[1]; }, 0);
    var mf = W.DB.mfTotal().total;
    var farms = (C.farming.items || []).map(function (key) {
      var rows = W.DB.sourcesOf(key).slice(0, 3);
      return '<tr><td>' + W.tok(key) + '</td><td>' + (rows.length ? rows.map(function (r) { return W.tok(r.m.id, pct(r.c.p)); }).join(' ') : '<span class="dim">-</span>') + '</td><td><a href="#droprates/find/' + key + '">' + esc(t(L('all sources', 'כל המקורות'))) + '</a></td></tr>';
    }).join('');
    return '<div class="crumbs"><a href="#builds">' + esc(t(L('Builds', 'בילדים'))) + '</a><span class="sep"></span><span>' + esc(t(L('Farming & Magic Find', 'פארם ומציאת שלל'))) + '</span></div>' +
      '<div class="page-head"><div><h1>' + esc(t(L('Farming Routes & Magic Find', 'מסלולי פארם ומציאת שלל'))) + '</h1></div></div>' +
      '<div class="cols2"><div class="panel"><h2 class="mt0">' + esc(t(L('How Magic Find works', 'איך מציאת שלל עובדת'))) + '</h2><ul>' + C.farming.tips.map(function (x) { return '<li>' + fmt(x) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="panel"><h2 class="mt0">' + esc(t(L('The full Magic Find stack', 'מחסנית מציאת השלל המלאה'))) + '</h2><div class="table-wrap"><table class="dt"><tbody>' + stack.map(function (x) { return '<tr><td>' + esc(t(x[0])) + '</td><td class="dim small">' + esc(t(x[2])) + '</td><td class="r"><b class="gold">' + n('+' + Math.round(x[1] * 100) + '%') + '</b></td></tr>'; }).join('') + '<tr class="hl"><td><b>' + esc(t(L('Total before gear affixes', 'סך הכול לפני אפיקסים בציוד'))) + '</b></td><td></td><td class="r"><b class="gold">' + n('+' + Math.round(total * 100) + '%') + '</b></td></tr></tbody></table></div><p class="small dim">' + fmt(L('Magic Find affixes roll 5-15% (scaled by tier) on any weapon or armor piece.', 'אפיקסים של מציאת שלל מוגרלים בין 5% ל-15% (לפי הדרגה) על כל נשק או שריון.')) + '</p></div></div>' +
      '<div class="section-title"><h2>' + esc(t(L('Best farms right now', 'הפארמים הטובים ביותר כרגע'))) + '</h2><span class="line"></span><span class="small dim">' + fmt(L('using your calculator Magic Find (+' + Math.round(mf * 100) + '%)', 'לפי מציאת השלל במחשבון (+' + Math.round(mf * 100) + '%)')) + '</span></div>' +
      '<div class="table-wrap"><table class="dt"><thead><tr><th>' + esc(t(L('Item', 'פריט'))) + '</th><th>' + esc(t(L('Top 3 sources (chance per kill)', '3 המקורות המובילים (סיכוי להריגה)'))) + '</th><th></th></tr></thead><tbody>' + farms + '</tbody></table></div>';
  }

  // ================================================================ skills & constellation
  var SK = { branch: 'all' };
  function miniTimeline(sk) {
    var tl = sk.timeline;
    var T = Math.max(sk.dur, tl.eventsEnd + F.connectWindow, 0.3);
    var pre = '<i style="position:absolute;inset-block:0;inset-inline-start:0;width:' + (F.preMotion / (T + F.preMotion) * 100) + '%;background:#ffe066;opacity:.55"></i>';
    var off = F.preMotion / (T + F.preMotion);
    var scale = 1 - off;
    var conn = sk.timeline.hits.length ? '<i style="position:absolute;inset-block:0;inset-inline-start:' + ((off + tl.eventsEnd / T * scale) * 100) + '%;width:' + (F.connectWindow / T * scale * 100) + '%;background:#7fe9ff;opacity:.45"></i>' : '';
    var ticks = tl.hits.map(function (h) { return '<i style="position:absolute;inset-block:-2px;inset-inline-start:' + ((off + h.t / T * scale) * 100) + '%;width:2px;background:' + sk.color + '"></i>'; }).join('');
    return '<div class="pbar" style="height:10px;margin:6px 0" title="' + esc(t(L('Pre-Motion, strikes and the Skill Connect window', 'קדם-תנועה, מכות וחלון חיבור הכישורים'))) + '">' + pre + conn + ticks + '</div>';
  }
  function skillCard(sk) {
    var tl = sk.timeline;
    var magic = sk.branch === 'magic';
    return '<article class="card" id="sec-' + sk.id + '" style="border-color:' + (W.current().args[0] === sk.id ? sk.color : '') + '"><div class="mon-row" style="grid-template-columns:56px minmax(0,1fr)">' + W.sprite('skill', sk.id, 'md') + '<div><h4 style="color:' + sk.color + '">' + esc(t(sk.name)) + '</h4><div class="meta">' + esc(t(I.branch[sk.branch].name)) + ' · ' + esc(t(L('Rank', 'דרגה'))) + ' ' + n(sk.rank) + ' · ' + n(sk.sp) + ' SP</div></div></div>' +
      '<div class="small" style="margin-top:6px">' + n(sk.mp) + ' ' + esc(t(L('MP', 'מאנה'))) + ' · ' + esc(t(L('CD', 'טעינה'))) + ' ' + W.secs(sk.cd) + ' · ' + esc(t(L('cast', 'ביצוע'))) + ' ' + W.secs(sk.dur) + (tl.hits.length ? ' · <b class="gold">' + n(tl.hits.length) + '</b> ' + esc(t(L('strikes', 'מכות'))) + ' · <b class="gold">' + n('×' + tl.total) + '</b> ' + esc(t(magic ? L('MAG', 'קסם') : L('ATK', 'התקפה'))) : '') + '</div>' +
      (tl.hits.length ? miniTimeline(sk) : '') +
      '<p class="small">' + fmt(sk.desc) + '</p>' +
      '<div class="small" style="display:grid;gap:2px">' + ['power', 'clone', 'leech'].map(function (k) { return '<span><b style="color:' + I.morph[k].color + '">' + esc(t(sk.morphs[k])) + '</b></span>'; }).join('') + '</div></article>';
  }
  function skillsPage(args) {
    var focus = args[0];
    if (focus && I.skill[focus]) SK.branch = I.skill[focus].branch;
    if (focus && I.passive[focus]) SK.branch = I.passive[focus].branch;
    var br = SK.branch;
    var chips = '<button type="button" class="chip' + (br === 'all' ? ' on' : '') + '" data-br="all">' + esc(t(L('All branches', 'כל הענפים'))) + '</button>' + D.branches.map(function (b) { return '<button type="button" class="chip' + (br === b.id ? ' on' : '') + '" data-br="' + b.id + '" style="--c:' + b.color + '"><span class="dot"></span>' + esc(t(b.name)) + '</button>'; }).join('');
    var R = D.skillRanks;
    var rankRows = [1, 2, 3, 4, 5].map(function (r) {
      return '<tr><td><b>' + r + '</b></td><td class="r">' + (r === 1 ? esc(t(L('learn', 'לימוד'))) : n(R.cost[r - 2] + ' SP')) + '</td><td class="r">' + (r === 1 ? esc(t(L('unlock rank', 'דרגת פתיחה'))) : '+' + n(R.mastery[r - 2])) + '</td><td class="r">' + n('×' + (1 + R.dmg * (r - 1)).toFixed(2)) + '</td><td class="r">' + n('×' + (1 - R.cdr * (r - 1)).toFixed(2)) + '</td><td>' + (r >= R.morphRank ? '<span class="badge" style="--c:#ffd166">' + esc(t(L('Rune Morph', 'מורף רוני'))) + '</span>' : '') + '</td></tr>';
    }).join('');
    var branches = D.branches.filter(function (b) { return br === 'all' || b.id === br; });
    var body = branches.map(function (b) {
      var acts = D.skills.filter(function (s) { return s.branch === b.id; });
      var pass = D.passives.filter(function (s) { return s.branch === b.id; });
      var ks = D.keystones.filter(function (k) { return k.branch === b.id; });
      return '<section class="panel" id="sec-' + b.id + '" style="border-color:' + b.color + '55"><div class="row"><h2 class="mt0" style="color:' + b.color + ';margin:0">' + esc(t(b.name)) + '</h2><span class="dim small">' + esc(t(b.req)) + ' · ' + esc(t(L('Elemental Rune', 'רונת היסודות'))) + ': ' + W.elBadge(b.element) + '</span></div><p class="small dim">' + fmt(b.desc) + '</p>' +
        '<div class="grid">' + acts.map(skillCard).join('') + '</div>' +
        '<h3>' + esc(t(L('Passives', 'פסיביים'))) + '</h3><div class="grid">' + pass.map(function (p) { return '<article class="card" id="sec-' + p.id + '"><div class="row">' + W.sprite('skill', p.id, 'sm') + '<div><h4>' + esc(t(p.name)) + '</h4><div class="meta">' + esc(t(L('Rank', 'דרגה'))) + ' ' + n(p.rank) + ' · ' + n(p.max) + ' ' + esc(t(L('levels', 'רמות'))) + '</div></div></div><p class="small">' + fmt(p.desc) + '</p></article>'; }).join('') + '</div>' +
        ks.map(function (k) { return '<div class="power" id="sec-' + k.id + '" style="--c:' + b.color + ';margin-top:12px"><b>✦ ' + esc(t(k.name)) + '</b> <span class="dim small">' + esc(t(L('Keystone', 'אבן ראשה'))) + ' · ' + esc(t(L('Rank', 'דרגה'))) + ' ' + n(k.rank) + ' · ' + n(k.sp) + ' SP</span><div class="small">' + fmt(k.desc) + '</div></div>'; }).join('') + '</section>';
    }).join('');
    return '<div class="page-head"><div><h1>' + esc(t(L('Skills & Constellation', 'כישורים וקונסטלציה'))) + '</h1><p>' + fmt(L('All ' + D.skills.length + ' Sword Skills with their real strike timings (read from each skill\'s script), all ' + D.skills.length * 3 + ' Rune Morphs, ' + D.passives.length + ' passives, ' + D.keystones.length + ' keystones and ' + D.bridges.length + ' hybrid bridges. Active skills unlock at Mastery Ranks ' + D.meta.activeRanks.join(', ') + '; passives at ' + D.meta.passiveRanks.join(', ') + '.', 'כל ' + D.skills.length + ' כישורי החרב עם תזמוני המכות האמיתיים שלהם (נקראים מהתסריט של כל כישור), כל ' + D.skills.length * 3 + ' המורפים הרוניים, ' + D.passives.length + ' פסיביים, ' + D.keystones.length + ' אבני ראשה ו-' + D.bridges.length + ' גשרים היברידיים. כישורים פעילים נפתחים בדרגות שליטה ' + D.meta.activeRanks.join(', ') + '; פסיביים ב-' + D.meta.passiveRanks.join(', ') + '.')) + '</p></div></div>' +
      '<div class="cols2"><div class="panel tight"><h3 class="mt0">' + esc(t(L('Skill ranks', 'דרגות כישור'))) + '</h3><div class="table-wrap"><table class="dt"><thead><tr><th>' + esc(t(L('Rank', 'דרגה'))) + '</th><th class="r">' + esc(t(L('Cost', 'עלות'))) + '</th><th class="r">' + esc(t(L('Mastery needed', 'שליטה נדרשת'))) + '</th><th class="r">' + esc(t(L('Damage', 'נזק'))) + '</th><th class="r">' + esc(t(L('Cooldown', 'טעינה'))) + '</th><th></th></tr></thead><tbody>' + rankRows + '</tbody></table></div></div>' +
      '<div class="panel tight"><h3 class="mt0">' + esc(t(L('Rune Morphs', 'מורפים רוניים'))) + '</h3>' + D.morphs.map(function (m) { return '<div class="stat"><span><b style="color:' + m.color + '">' + esc(t(m.label)) + '</b></span><span class="small">' + fmt(m.desc) + '</span></div>'; }).join('') + '</div></div>' +
      '<div class="controls"><div class="chips">' + chips + '</div></div>' + body +
      '<div class="section-title"><h2>' + esc(t(L('Hybrid bridges', 'גשרים היברידיים'))) + '</h2><span class="line"></span></div><div class="grid">' + D.bridges.map(function (b) { return '<div class="card" id="sec-' + b.id + '"><h4>' + esc(t(b.name)) + '</h4><div class="meta">' + esc(t(I.branch[b.a].name)) + ' + ' + esc(t(I.branch[b.b].name)) + ' · ' + esc(t(L('Rank', 'דרגה'))) + ' ' + n(b.rank) + ' · ' + n(b.sp) + ' SP</div><p class="small">' + fmt(b.desc) + '</p></div>'; }).join('') + '</div>' +
      '<div class="section-title"><h2>' + esc(t(L('Unique Skill Awakenings', 'התעוררויות כישור ייחודיות'))) + '</h2><span class="line"></span></div><div class="grid wide">' + D.awakenings.map(function (a) { return '<div class="card"><h4 class="gold">✦ ' + esc(t(a.name)) + '</h4><p class="small">' + fmt(a.desc) + '</p><p class="small dim"><b>' + esc(t(L('How to awaken', 'איך מעוררים'))) + ':</b> ' + fmt(a.trigger) + '</p></div>'; }).join('') + '</div>';
  }
  function skillsAfter(args, root) {
    root.querySelectorAll('[data-br]').forEach(function (b) { b.addEventListener('click', function () { SK.branch = b.getAttribute('data-br'); if (W.current().args.length) location.hash = '#skills'; else W.refresh(); }); });
    void args;
  }

  W.register({ id: 'builds', title: L('Builds', 'המלצות ובילדים'), nav: true, order: 3, render: buildsPage });
  W.register({ id: 'skills', title: L('Skills', 'כישורים'), nav: true, order: 5, render: skillsPage, after: skillsAfter });
})();
