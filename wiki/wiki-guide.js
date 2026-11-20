/* Aetheria Codex - Strategy Guide chapters. Prose is hand-written (English + Hebrew); every table and
   number inside it is read from window.AETHERIA_DATA so it always matches the game build. */
(function () {
  'use strict';
  var W = window.Wiki;
  var D = W.D, I = W.I, L = W.L, t = W.t, esc = W.esc, fmt = W.fmt, n = W.n, num = W.num;
  var F = D.frames;

  function h2(o) { return '<h2>' + esc(t(o)) + '</h2>'; }
  function h3(o) { return '<h3>' + esc(t(o)) + '</h3>'; }
  function p(o) { return '<p>' + fmt(o) + '</p>'; }
  function list(items) { return '<ul>' + items.map(function (x) { return '<li>' + fmt(x) + '</li>'; }).join('') + '</ul>'; }
  function callout(o, cls) { return '<div class="callout ' + (cls || 'cyan') + '">' + fmt(o) + '</div>'; }
  function table(head, rows) {
    return '<div class="table-wrap"><table class="dt"><thead><tr>' + head.map(function (h) { return '<th>' + esc(t(h)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + (c && typeof c === 'object' && 'en' in c ? fmt(c) : c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function link(href, o) { return '<a href="' + href + '">' + esc(t(o)) + '</a>'; }

  var CONTROLS = [
    ['W A S D / ←↑→↓', L('Move', 'תנועה')],
    [L('Left Click / J', 'קליק שמאלי / J'), L('Basic attack combo (aims at the cursor)', 'קומבו התקפה בסיסית (מכוון אל הסמן)')],
    [L('Right Click / Shift', 'קליק ימני / Shift'), L('Block - press just before impact to Perfect Parry', 'חסימה - לחצו רגע לפני הפגיעה להדיפה מושלמת')],
    ['Space', L('Dodge roll with invulnerability frames', 'גלגול התחמקות עם חסינות רגעית')],
    ['1 - 6', L('Sword Skills on your hotbar', 'כישורי החרב בסרגל המהיר')],
    ['Q', L('Swap weapon set A / B', 'החלפה בין סט נשק A ו-B')],
    ['R / Tab', L('SWITCH! (Triple SWITCH! with two companions)', 'SWITCH! (‏Triple SWITCH! עם שני בני לוויה)')],
    ['V', L('Mount / dismount (attack while riding = Charge Slam)', 'עלייה / ירידה מבהמה (תקיפה ברכיבה = הסתערות)')],
    ['F1 - F4', L('Tactical Gambits: Assault, Guard & Peel, Focus My Target, Support & Heal', 'גמביטים טקטיים: הסתערות, שמירה וחילוץ, התמקדות במטרה, תמיכה וריפוי')],
    ['E / F', L('Interact, talk, gather, enter', 'אינטראקציה, דיבור, איסוף, כניסה')],
    ['Z X C', L('Quick-use consumables', 'שימוש מהיר בשיקויים ומזון')],
    ['I / K / M / H', L('Character, Constellation Skill Graph, Realm Atlas, Handbook', 'דמות, גרף הכישורים הכוכבי, אטלס, ספר ההדרכה')],
    ['O / N / P / T / U', L('Bestiary, Journal & Titles, Stable & Pets, Wardrobe, Relic Codex', 'בסטיאריום, יומן ותארים, אורווה וחיות מחמד, ארון בגדים, קודקס שרידים')],
    ['B', L('Grid decorator inside your house', 'מעצב הרשת בתוך הבית')],
    ['Esc', L('Pause / close window', 'השהיה / סגירת חלון')],
    ['F5', L('Quick save to the saves folder', 'שמירה מהירה לתיקיית השמירות')],
    ['F11 / Alt+Enter', L('Toggle fullscreen', 'מעבר למסך מלא')],
  ];

  // ================================================================ chapters
  function desktop() {
    return h2(L('The Desktop Application', 'אפליקציית המחשב')) +
      p(L('Aetheria Chronicles is a standalone Windows desktop game (Electron). This codex is the only part that lives on the web - the game itself never opens a browser tab, and an offline copy of the codex ships inside the app.', 'כרוניקות אתריה הוא משחק מחשב עצמאי ל-Windows ‏(Electron). הקודקס הזה הוא החלק היחיד שנמצא ברשת - המשחק עצמו לעולם לא פותח לשונית דפדפן, ועותק לא מקוון של הקודקס מגיע בתוך האפליקציה.')) +
      h3(L('Install & launch', 'התקנה והפעלה')) + list([
        L('Run Launch-Aetheria-Desktop.bat. If release\\win-unpacked\\Aetheria Chronicles.exe does not exist yet, it builds it first (Node.js 20+ required once).', 'הריצו את Launch-Aetheria-Desktop.bat. אם הקובץ release\\win-unpacked\\Aetheria Chronicles.exe עדיין לא קיים, הוא נבנה תחילה (נדרש Node.js 20 ומעלה פעם אחת).'),
        L('Run Create-Desktop-Shortcut.ps1 (right-click > Run with PowerShell) to put an "Aetheria Chronicles" icon on your desktop. Add -StartMenu for a Start Menu entry too.', 'הריצו את Create-Desktop-Shortcut.ps1 (קליק ימני > Run with PowerShell) כדי ליצור סמל "Aetheria Chronicles" על שולחן העבודה. הוסיפו ‎-StartMenu‎ גם לתפריט התחל.'),
        L('Developers: npm run dist:win rebuilds the exe and this codex; npm run wiki:build regenerates only the codex from src/data; the exe accepts --selftest for an automated 60 FPS smoke test.', 'מפתחים: ‏npm run dist:win בונה מחדש את קובץ ההפעלה ואת הקודקס; ‏npm run wiki:build מייצר מחדש רק את הקודקס מתוך src/data; קובץ ההפעלה מקבל ‎--selftest‎ לבדיקת עשן אוטומטית של 60 FPS.'),
      ]) +
      h3(L('Window, display & saves', 'חלון, תצוגה ושמירות')) + list([
        L('Custom dark window frame. F11 or Alt+Enter toggles fullscreen; Settings > Display offers several window sizes and supersampled render quality.', 'מסגרת חלון כהה מותאמת. ‏F11 או Alt+Enter עוברים למסך מלא; הגדרות > תצוגה מציעות כמה גדלי חלון ואיכות רינדור עם דגימת-על.'),
        L('Saves are plain JSON files next to the exe in .\\saves: slot_1.json - slot_3.json, global_vault.json (the 100-slot vault shared by every character), settings.json and leaderboard.json. Deleted slots move to saves\\deleted instead of vanishing.', 'השמירות הן קובצי JSON רגילים ליד קובץ ההפעלה בתיקייה ‎.\\saves‎: ‏slot_1.json עד slot_3.json, ‏global_vault.json (הכספת בת 100 המקומות המשותפת לכל הדמויות), ‏settings.json ו-leaderboard.json. משבצות שנמחקות עוברות ל-saves\\deleted במקום להיעלם.'),
        L('Title screen and pause menu: Open Saves Folder, Open Strategy Wiki (this codex, in your default browser) and Quit to Desktop.', 'מסך הפתיחה ותפריט ההשהיה: פתיחת תיקיית השמירות, פתיחת ויקי האסטרטגיה (הקודקס הזה, בדפדפן ברירת המחדל) ויציאה לשולחן העבודה.'),
      ]);
  }

  function combat() {
    var rows = CONTROLS.map(function (c) { return ['<kbd>' + esc(t(c[0])) + '</kbd>', c[1]]; });
    return h2(L('Controls & Combat Basics', 'שליטה ויסודות הקרב')) + table([L('Key', 'מקש'), L('Action', 'פעולה')], rows) +
      h3(L('Combat basics', 'יסודות הקרב')) + list([
        L('Basic attacks chain into weapon combos: Longsword ' + D.combos.sword.length + ' hits, Dual Blades ' + D.combos.dual.length + ' fast hits, Spear ' + D.combos.spear.length + ' thrusts, Halberd ' + D.combos.halberd.length + ' wide sweeps, Bow arrows and Staff homing bolts (MAG).', 'התקפות בסיסיות משתלבות לקומבו לפי הנשק: חרב ארוכה ' + D.combos.sword.length + ' מכות, להבים כפולים ' + D.combos.dual.length + ' מכות מהירות, חנית ' + D.combos.spear.length + ' דקירות, הלברד ' + D.combos.halberd.length + ' טאטואים רחבים, קשת חצים ומטה קליעים מתבייתים (קסם).'),
        L('Every hit freezes its target for ' + Math.round(F.hitstop * 1000) + 'ms (hit-stop) and knocks it back. White numbers are normal hits, gold with a star are criticals, cyan are shielded or parried, purple are elemental or status damage.', 'כל מכה מקפיאה את המטרה ל-' + Math.round(F.hitstop * 1000) + ' אלפיות שנייה ומדיפה אותה. מספרים לבנים הם מכות רגילות, זהב עם כוכב הם קריטיות, ציאן הם נזק שנחסם או נהדף, וסגול הוא נזק יסודי או של מצב.'),
        L('Red ground telegraphs (cones, circles, lines, rings) fill up before every heavy attack. Leave the shape before it fills, or block and parry.', 'סימונים אדומים על הקרקע (חרוטים, עיגולים, קווים וטבעות) מתמלאים לפני כל התקפה כבדה. צאו מהצורה לפני שהיא מתמלאת, או חסמו והדפו.'),
      ]) +
      h3(L('Perfect Parry', 'הדיפה מושלמת')) +
      callout(L('Press block within ' + F.parryWindow + 's of an impact (Riposte Instinct adds up to +' + (F.parryPerRiposteRank * 3).toFixed(2) + 's, Unbreakable Bastion +' + F.parryKeystone + 's). Time freezes for ' + Math.round(F.parryFreeze * 1000) + 'ms, you take no damage, release a ring shockwave, restore ' + Math.round(F.parryRestore * 100) + '% of your MP and Stamina, and the attacker loses ' + F.parryBreakFlat + ' + ' + Math.round(F.parryBreakPct * 100) + '% of its Break Bar. Your next attack within ' + F.riposteWindow + 's is a Counter-Riposte critical (×' + F.riposteMult + '). Holding block longer only reduces damage: ' + Math.round(F.blockReduceShield * 100) + '% with a shield, ' + Math.round(F.blockReduce * 100) + '% without, and each blocked hit costs Stamina.', 'לחצו על חסימה בתוך ' + F.parryWindow + ' שניות מהפגיעה (אינסטינקט התגובה מוסיף עד ' + (F.parryPerRiposteRank * 3).toFixed(2) + ' שניות, המבצר הבלתי שביר עוד ' + F.parryKeystone + '). הזמן קופא ל-' + Math.round(F.parryFreeze * 1000) + ' אלפיות שנייה, לא תספגו נזק, ישתחרר גל הדף טבעתי, תקבלו בחזרה ' + Math.round(F.parryRestore * 100) + '% מהמאנה והסיבולת, והתוקף מאבד ' + F.parryBreakFlat + ' ועוד ' + Math.round(F.parryBreakPct * 100) + '% ממד השבירה. ההתקפה הבאה שלכם בתוך ' + F.riposteWindow + ' שניות היא תגובת-נגד קריטית (×' + F.riposteMult + '). חסימה ממושכת רק מפחיתה נזק: ' + Math.round(F.blockReduceShield * 100) + '% עם מגן, ' + Math.round(F.blockReduce * 100) + '% בלי, וכל חסימה עולה סיבולת.'), 'gold') +
      h3(L('Break Bar & Stagger', 'מד השבירה והלם')) +
      p(L('The yellow bar under an enemy\'s health is its Break Bar. Heavy hits, shield bashes, skill finishers, parries, Wall Slams and SHATTER drain it. When it empties you see "BREAK!!": bosses and elites are stunned for ' + F.breakStun + ' seconds (other monsters ' + F.breakStunSmall + 's) and every attack against them is a ' + Math.round(F.breakCritMult * 100) + '% critical.', 'הפס הצהוב מתחת לחיי האויב הוא מד השבירה. מכות כבדות, הלמות מגן, סיומי כישורים, הדיפות, הטחות בקיר ו-SHATTER מרוקנים אותו. כשהוא מתרוקן יופיע "BREAK!!": בוסים ועילית מוכים בהלם ל-' + F.breakStun + ' שניות (מפלצות אחרות ' + F.breakStunSmall + ' שניות) וכל התקפה נגדם היא קריטית של ' + Math.round(F.breakCritMult * 100) + '%.')) +
      h3(L('SWITCH! partner combos', 'שילובי SWITCH! עם השותף')) +
      p(L('Hits by you and your companions fill the Switch Gauge. When it is full, press R or Tab: you backstep out of danger, your companion dashes in with a high-Break Synchronized Chain Skill, and your next Sword Skill deals +' + Math.round(F.switchBonus * 100) + '% damage.', 'מכות שלכם ושל בני הלוויה ממלאות את מד ה-Switch. כשהוא מלא לחצו R או Tab: אתם קופצים לאחור מהסכנה, בן הלוויה מסתער עם כישור שרשרת מסונכרן ששובר הגנות, וכישור החרב הבא שלכם גורם +' + Math.round(F.switchBonus * 100) + '% נזק.')) +
      h3(L('Death & respawn', 'מוות ותחייה')) +
      p(L('At 0 HP an Emergency Crystal Teleport returns you to the last city\'s Teleport Gate at full HP and MP. You lose 15% of the XP needed for your current level (never a whole level) and a 5% gold fee. Items and gear are never lost, and the Coliseum carries no penalty at all.', 'ב-0 חיים, שיגור קריסטל חירום מחזיר אתכם לשער השיגור של העיר האחרונה עם חיים ומאנה מלאים. תאבדו 15% מהניסיון הדרוש לרמה הנוכחית (לעולם לא רמה שלמה) ודמי תחייה של 5% מהזהב. פריטים וציוד לעולם אינם אובדים, ובקולוסיאום אין עונש בכלל.'));
  }

  function fulldive() {
    return h2(L('Full-Dive Combat', 'קרב Full-Dive')) +
      callout(L('Every number in this chapter is animated and testable in ' + t(L('Combat Docs', 'תיעודים מהמשחק')) + '.', 'כל מספר בפרק הזה מונפש וניתן לבדיקה בעמוד ' + t(L('Combat Docs', 'תיעודים מהמשחק')) + '.')) +
      h3(L('Input buffering & cancels', 'אגירת קלט וביטולים')) + list([
        L('Every combat input is remembered for ' + Math.round(F.inputBuffer * 1000) + 'ms and fires the instant it becomes legal - mash early and nothing is lost.', 'כל קלט קרב נשמר ' + Math.round(F.inputBuffer * 1000) + ' אלפיות שנייה ומופעל ברגע שהוא חוקי - לחיצה מוקדמת לא הולכת לאיבוד.'),
        L('A basic attack hits at ' + Math.round(F.hitFrac * 100) + '% of its swing; its recovery after that can be cancelled into any Sword Skill (+' + Math.round(F.cancelBonus * 100) + '%), a Dodge or a Perfect Parry.', 'התקפה בסיסית פוגעת ב-' + Math.round(F.hitFrac * 100) + '% מההנפה; את ההתאוששות שאחרי זה אפשר לבטל לכל כישור חרב (+' + Math.round(F.cancelBonus * 100) + '%), להתחמקות או להדיפה מושלמת.'),
        L('A Sword Skill\'s ' + F.preMotion + 's Pre-Motion and its recovery frames can be cancelled into a Dodge, a Perfect Parry or SWITCH!.', 'את ' + F.preMotion + ' שניות קדם-התנועה של כישור חרב ואת זמן ההתאוששות שלו אפשר לבטל להתחמקות, להדיפה מושלמת או ל-SWITCH!.'),
      ]) +
      h3(L('Kinetic stepping & Wall-Slam physics', 'צעדים קינטיים ופיזיקת הטחה בקיר')) + list([
        L('Melee swings carry you forward with a ' + F.stepLight + '-' + F.stepHeavy + ' px/s micro-lunge (' + F.stepFriction + ' friction per frame) toward the cursor, stopping just short of the enemy.', 'הנפות קרב מקרוב מזיזות אתכם קדימה בזינוק קטן של ' + F.stepLight + '-' + F.stepHeavy + ' פיקסלים לשנייה (חיכוך ' + F.stepFriction + ' לפריים) לעבר הסמן, ונעצרות ממש לפני האויב.'),
        L('Knock an enemy into a wall at ' + F.slamSpeed + '+ px/s and you get WALL SLAM!: +' + Math.round(F.slamDmg * 100) + '% of the hit as impact damage, a ' + F.slamStun + 's stun and ' + Math.round(F.slamBreak * 100) + '% of the Break Bar shattered.', 'הדפו אויב אל קיר במהירות של ' + F.slamSpeed + ' פיקסלים לשנייה ומעלה ותקבלו WALL SLAM!: ‏+' + Math.round(F.slamDmg * 100) + '% מהמכה כנזק פגיעה, הלם של ' + F.slamStun + ' שניות וניפוץ ' + Math.round(F.slamBreak * 100) + '% ממד השבירה.'),
        L('Battlefield props: Explosive Alchemical Barrels, Frost Crystal Clusters, Crates and Urns. Aether Jump Pads launch you onto plateaus.', 'אביזרי שדה קרב: חביות אלכימיות נפיצות, אשכולות קריסטלי כפור, ארגזים וכדים. משטחי קפיצה של אתר משגרים אתכם אל הרמות.'),
        L('Forgiving hitboxes: your attack arcs are 15% wider than the ribbons you see, and any hit worth ' + Math.round(F.graceThreshold * 100) + '%+ of your max HP grants ' + F.graceIframes + 's of grace invulnerability.', 'תיבות פגיעה סלחניות: קשתות ההתקפה שלכם רחבות ב-15% מהסרטים שאתם רואים, וכל מכה ששווה ' + Math.round(F.graceThreshold * 100) + '% או יותר מהחיים המרביים מעניקה ' + F.graceIframes + ' שניות של חסינות חסד.'),
      ]) +
      h3(L('Skill Connect & the Finishing Nova', 'חיבור כישורים ונובת הסיום')) +
      callout(L('When a Sword Skill\'s final strike lands, a ' + F.connectWindow + 's cyan star-ring flashes. Casting a different skill inside it cancels the recovery, costs ×' + F.connectMp + ' MP and adds +' + Math.round(F.connectStep * 100) + '% damage per chain step. The fourth skill in a chain detonates a FINISHING NOVA (×' + F.novaMult + ' critical burst in a ' + F.novaRadius + ' radius, huge Break).', 'כשהמכה האחרונה של כישור חרב פוגעת, טבעת כוכב בצבע ציאן מהבהבת ל-' + F.connectWindow + ' שניות. הפעלת כישור אחר בתוכה מבטלת את ההתאוששות, עולה ×' + F.connectMp + ' מאנה ומוסיפה +' + Math.round(F.connectStep * 100) + '% נזק לכל שלב בשרשרת. הכישור הרביעי בשרשרת מפוצץ נובת סיום (פרץ קריטי ×' + F.novaMult + ' ברדיוס ' + F.novaRadius + ', שבירה עצומה).')) +
      h3(L('Style meter: D to SSS', 'מד הסגנון: מ-D עד SSS')) +
      p(L('Hits, crits, connects, parries, wall slams, reactions and kills raise your style rank (' + D.style.ranks.map(function (r) { return r.rank; }).join(', ') + '). Getting hit drops it; standing still lets it decay. At SSS you gain +25% attack speed, +15% move speed and +' + Math.round(D.loot.mfSources.styleMax * 100) + '% Magic Find.', 'מכות, קריטיות, חיבורי כישורים, הדיפות, הטחות בקיר, תגובות והריגות מעלים את דרגת הסגנון (' + D.style.ranks.map(function (r) { return r.rank; }).join(', ') + '). ספיגת מכה מורידה אותה; עמידה במקום גורמת לה לדעוך. ב-SSS תקבלו +25% מהירות התקפה, +15% מהירות תנועה ו-+' + Math.round(D.loot.mfSources.styleMax * 100) + '% מציאת שלל.'));
  }

  function forge() {
    var grades = D.grades.map(function (g) { return ['<b style="color:' + g.color + '">' + esc(t(g.name)) + '</b>', n('×' + g.mult), W.rarityBadge(g.rarity), n(g.sockets)]; });
    var temper = D.temper.chance.map(function (c, i) { return [n('+' + (i + 1)), W.tok(i < 5 ? 'enh_stone' : 'enh_greater'), W.pct(c, 0)]; });
    return h2(L('Blacksmithing, Tempering & Gems', 'נפחות, חישול ואבנים')) +
      p(L('Smelt ore into ingots, then forge any of ' + D.gearBases.length + ' blueprints in ' + D.tiers.length + ' material tiers. The Anvil Hammer Gauge decides quality: strike three times as the marker crosses the golden centre. Auto-Forge is instant but rarely beats Fine. Every blueprint, with live stats for any grade and temper level, is in the Items database.', 'התיכו עפרות למטילים ואז זייפו כל אחד מ-' + D.gearBases.length + ' שרטוטים ב-' + D.tiers.length + ' דרגות חומר. מד פטיש הסדן קובע את האיכות: הכו שלוש פעמים כשהסמן חוצה את המרכז הזהוב. זיוף אוטומטי הוא מיידי אבל כמעט אף פעם לא עולה על "משובח". כל שרטוט, עם סטטיסטיקות חיות לכל איכות ורמת חישול, נמצא במאגר הפריטים.')) +
      '<p>' + link('#items', L('Open the Items & Equipment database →', 'למאגר הפריטים והציוד ←')) + '</p>' +
      h3(L('Craft grades', 'איכויות זיוף')) + table([L('Grade', 'איכות'), L('Stats', 'סטטיסטיקות'), L('Rarity', 'נדירות'), L('Gem sockets', 'חריצים')], grades) +
      h3(L('Tempering +1 to +10', 'חישול +1 עד +10')) + p(L('Each level adds +' + Math.round(D.meta.temperStep * 100) + '% to the piece\'s flat stats. Failure only consumes the materials. Gilded Anvil membership and the Artisan\'s Pride set power raise the odds.', 'כל רמה מוסיפה +' + Math.round(D.meta.temperStep * 100) + '% לסטטיסטיקות הקבועות של הפריט. כישלון רק צורך את החומרים. חברות בסדן המוזהב וכוח הסט "גאוות האומן" משפרים את הסיכויים.')) +
      table([L('Step', 'שלב'), L('Stone', 'אבן'), L('Base success', 'הצלחת בסיס')], temper) +
      h3(L('Elemental gems', 'אבני יסוד')) + table([L('Gem', 'אבן'), L('Effect', 'השפעה')], D.gems.map(function (g) { return [W.tok(g.item), g.desc]; })) +
      p(L('Salvage spare gear for ingots, Arcane Dust and enhancement stones; socketed gems are returned.', 'פרקו ציוד מיותר למטילים, אבק ארקני ואבני חישול; אבנים משובצות מוחזרות.'));
  }

  function recipeRows(station) {
    return D.recipes.filter(function (r) { return r.station === station; }).map(function (r) {
      var it = I.item[r.out];
      var eff = it.effect && it.effect.buff ? W.statInline(it.effect.buff.stats) + ' · ' + n(Math.round(it.effect.buff.dur / 60) + (W.lang() === 'he' ? ' דק׳' : ' min')) : fmt(it.desc);
      return [W.tok(r.out, r.qty > 1 ? '×' + r.qty : ''), r.ins.map(function (x) { return W.tok(x[0], '×' + x[1]); }).join(' '), eff];
    });
  }
  function cooking() {
    return h2(L('Smelting, Alchemy & Cooking', 'התכה, אלכימיה ובישול')) +
      p(L('Smelt at any forge, brew at any Apothecary (or a home Alchemy Station) and cook at any General Store (or a home Cooking Hearth). Only one meal buff is active at a time; blade oils last 3 minutes.', 'התיכו בכל נפחייה, רקחו בכל בית מרקחת (או בעמדת אלכימיה ביתית) ובשלו בכל חנות כללית (או באח בישול ביתית). רק ארוחה אחת פעילה בכל פעם; שמני להב נמשכים 3 דקות.')) +
      h3(L('Smelting', 'התכה')) + table([L('Output', 'תוצר'), L('Ingredients', 'מרכיבים'), L('Notes', 'הערות')], recipeRows('smelt')) +
      h3(L('Alchemy', 'אלכימיה')) + table([L('Output', 'תוצר'), L('Ingredients', 'מרכיבים'), L('Effect', 'השפעה')], recipeRows('alchemy')) +
      h3(L('Cooking', 'בישול')) + table([L('Output', 'תוצר'), L('Ingredients', 'מרכיבים'), L('Effect', 'השפעה')], recipeRows('cooking'));
  }

  function guilds() {
    var ranks = D.guildRanks.map(function (r) { return esc(t(r.name)) + ' ' + n(r.rep); }).join(' → ');
    return h2(L('Guilds & Companions', 'גילדות ובני לוויה')) +
      p(L('Join any of the four guilds at a Guild Hall. The bounty board posts fresh bounties every in-game day (hunts, deliveries, night elites, dungeon clears, abyss surveys and coliseum cups). Turning them in earns gold, XP and reputation. Perks multiply with your rank in each guild and stack across guilds.', 'הצטרפו לכל אחת מארבע הגילדות באולם גילדה. לוח המשימות מפרסם משימות חדשות בכל יום משחק (ציד, משלוחים, עילית לילה, טיהור מבוכים, סקרי תהום וגביעי קולוסיאום). השלמתן מעניקה זהב, ניסיון ומוניטין. ההטבות מוכפלות לפי הדרגה בכל גילדה ומצטברות בין גילדות.')) +
      '<p class="dim">' + ranks + '</p><div class="grid">' +
      D.guilds.map(function (g) { return '<div class="card" style="border-color:' + g.color + '66"><h4 style="color:' + g.color + '">' + esc(t(g.name)) + '</h4><p class="flavor small">“' + esc(t(g.motto)) + '”</p><div class="small"><b>' + esc(t(L('Perk', 'הטבה'))) + ':</b> ' + fmt(g.perk) + '</div><div class="meta">' + esc(t(L('Hall', 'אולם'))) + ': ' + esc(t(D.realms[g.hall].city)) + '</div></div>'; }).join('') + '</div>' +
      h3(L('Companions', 'בני לוויה')) + p(L('Companions follow you, fight in real time with their own Sword Skills, dodge telegraphs, wear the gear you give them, and revive 15 seconds after being knocked out. Up to two travel with you at once.', 'בני הלוויה הולכים אחריכם, נלחמים בזמן אמת עם כישורי החרב שלהם, מתחמקים מסימונים, לובשים את הציוד שתיתנו להם וקמים לתחייה 15 שניות אחרי שהופלו. עד שניים מטיילים איתכם בבת אחת.')) +
      '<div class="grid wide">' + D.companions.map(function (c) {
        var req = [L('Level ' + c.req.level, 'רמה ' + c.req.level)];
        if (c.req.guild) req.push(L(t(I.guild[c.req.guild].short) + ' member', 'חבר ב' + t(I.guild[c.req.guild].short)));
        if (c.req.gold) req.push(L(c.req.gold.toLocaleString() + ' gold', c.req.gold.toLocaleString() + ' זהב'));
        return '<div class="card"><div class="mon-row">' + W.sprite('companion', c.id, 'md') + '<div><h4>' + esc(t(c.name)) + '</h4><div class="meta">' + esc(t(c.title)) + ' · ' + esc(t(I.branch[c.branch].name)) + '</div><div class="meta">' + req.map(function (x) { return esc(t(x)); }).join(' · ') + ' · ' + esc(t(D.realms[c.city].city)) + '</div></div></div><p class="small">' + fmt(c.bio) + '</p><div class="small"><b>' + esc(t(L('Chain Skill', 'כישור שרשרת'))) + ':</b> ' + esc(t(c.chain)) + '</div><p class="flavor small">“' + esc(t(c.lines[0])) + '”</p></div>';
      }).join('') + '</div>' +
      h3(L('Affinity', 'קרבה')) + p(L('Affinity grows with every shared kill: ' + D.affinity.map(function (a) { return t(a.name) + ' (' + a.min + ')'; }).join(', ') + ' - each rank strengthens the companion.', 'הקרבה גדלה עם כל הריגה משותפת: ' + D.affinity.map(function (a) { return t(a.name) + ' (' + a.min + ')'; }).join(', ') + ' - כל דרגה מחזקת את בן הלוויה.'));
  }

  function living() {
    return h2(L('Party, Raids & Adventurers', 'חבורה, פשיטות והרפתקנים')) +
      h3(L('Party of two & the Tactical Gambit Bar', 'חבורה של שניים וסרגל הגמביטים הטקטיים')) +
      table([L('Key', 'מקש'), L('Gambit', 'גמביט'), L('Behaviour', 'התנהגות')], D.gambits.map(function (g) { return ['<kbd>' + g.key + '</kbd>', '<b style="color:' + g.color + '">' + esc(t(g.name)) + '</b>', g.desc]; })) +
      list([L('With two companions, SWITCH! (R) becomes a TRIPLE SWITCH!: both partners chain their Synchronized Chain Skills back to back.', 'עם שני בני לוויה, SWITCH! ‏(R) הופך ל-TRIPLE SWITCH!: שני השותפים משרשרים את כישורי השרשרת המסונכרנים שלהם בזה אחר זה.')]) +
      h3(L('Assault Team Raid Briefing & 6-hero raids', 'תדריך צוות התקיפה ופשיטות של 6 גיבורים')) +
      p(L('Before a realm boss, or when you approach a roaming raid boss, the Raid Briefing lets you deploy three Ivory Aegis Vanguard knights. You, two companions and the Vanguard make a six-hero Assault Team that shares aggro.', 'לפני בוס ממלכה, או כשמתקרבים לבוס פשיטה נודד, תדריך הפשיטה מאפשר להציב שלושה אבירי חלוץ של אגיס השנהב. אתם, שני בני לוויה והחלוץ יוצרים צוות תקיפה של שישה גיבורים שחולקים את תשומת לב האויב.')) +
      '<div class="grid">' + D.raidBosses.map(function (r) { return '<a class="card link" href="#droprates/' + r.id + '"><div class="mon-row">' + W.sprite('monster', r.id, 'md') + '<div><h4>' + esc(t(r.name)) + '</h4><div class="meta">' + esc(t(r.title)) + '</div></div></div><p class="small">' + fmt(r.desc) + '</p></a>'; }).join('') + '</div>' +
      h3(L('Simulated adventurers', 'הרפתקנים מדומים')) + list([
        L('Named AI Divers roam cities and the wilds: they wander, gather, chat and fight monsters with real weapons and skills.', 'צוללים ממוחשבים עם שמות מסתובבים בערים ובשטחי הבר: משוטטים, אוספים, משוחחים ונלחמים במפלצות עם נשקים וכישורים אמיתיים.'),
        L('An orange "!" means they are under attack: defeat their attackers while staying close for a reward chest and guild reputation.', '"!" כתום פירושו שהם מותקפים: הביסו את התוקפים כשאתם בקרבת מקום וקבלו תיבת פרס ומוניטין בגילדה.'),
        L('Talk to them (E) to buy a rare material, swap materials, or start a friendly 1v1 duel: the first to fall below 10% HP yields. Nobody dies in a duel.', 'דברו איתם (E) כדי לקנות חומר נדיר, להחליף חומרים או לפתוח דו-קרב ידידותי 1 על 1: הראשון שיורד מתחת ל-10% חיים נכנע. אף אחד לא מת בדו-קרב.'),
      ]);
  }

  function world() {
    var mounts = D.mounts.map(function (m) { return [W.tok(m.id), n(m.req), num(m.price), fmt(m.desc)]; });
    var pets = D.pets.map(function (pp) { return [W.tok(pp.id), W.elBadge(I.element[pp.element].gauge || pp.element), n('+' + Math.round(pp.mf * 100) + '%'), num(pp.price)]; });
    var fish = D.fish.map(function (f) { return [W.tok(f.id), esc(t(D.realms[f.realm].short)), W.rarityBadge(f.rarity), W.pct(f.diff, 0), num(f.value)]; });
    return h2(L('Mounts, Pets, Fishing & World Events', 'רכיבה, חיות מחמד, דיג ואירועי עולם')) +
      h3(L('Mounts (V)', 'רכיבה (V)')) +
      p(L('Buy mounts at the Stable in any city (or press P anywhere to choose). Press V to ride in cities and the wilds. Attacking while mounted performs a Mounted Charge Slam - a ' + F.chargeDur + 's gallop with ' + F.chargeIframes + 's of i-frames that ends in a knockback shockwave - and dismounts you.', 'קנו בהמות רכיבה באורווה בכל עיר (או לחצו P בכל מקום כדי לבחור). לחצו V כדי לרכוב בערים ובשטחי הבר. תקיפה בזמן רכיבה מבצעת הסתערות רכובה - דהירה של ' + F.chargeDur + ' שניות עם ' + F.chargeIframes + ' שניות של חסינות שמסתיימת בגל הדף - ומורידה אתכם מהבהמה.')) +
      table([L('Mount', 'בהמה'), L('Level', 'רמה'), L('Gold', 'זהב'), L('Description', 'תיאור')], mounts) +
      h3(L('Combat pets', 'חיות קרב')) +
      p(L('Pets float beside you, vacuum up loot crystals, fire a support bolt that paints their element\'s reaction gauge, and add Magic Find while active.', 'חיות המחמד מרחפות לצדכם, שואבות גבישי שלל, יורות קליע תמיכה שצובע את מד התגובה של היסוד שלהן ומוסיפות מציאת שלל כשהן פעילות.')) +
      table([L('Pet', 'חיה'), L('Gauge', 'מד'), L('Magic Find', 'מציאת שלל'), L('Gold', 'זהב')], pets) +
      h3(L('Tension-bar fishing', 'דיג עם מד מתח')) +
      p(L('Every wild map has fishing spots. Press E, then hold Space or the mouse button to lift the green catch zone and keep the fish inside it until the bar fills. Fish cook into the Angler\'s Platter (+12% Magic Find).', 'בכל מפת בר יש נקודות דיג. לחצו E ואז החזיקו רווח או את כפתור העכבר כדי להרים את אזור התפיסה הירוק ולהשאיר את הדג בתוכו עד שהמד מתמלא. הדגים מתבשלים למגש הדייגים (+12% מציאת שלל).')) +
      table([L('Fish', 'דג'), L('Realm', 'ממלכה'), L('Rarity', 'נדירות'), L('Difficulty', 'קושי'), L('Value', 'ערך')], fish) +
      h3(L('Treasure maps, events & the Black Market', 'מפות אוצר, אירועים והשוק השחור')) + list([
        L('Ancient Treasure Maps drop from elites and bosses (12%), crates and events. Use one to mark a gold X on a wild map; stand on it and press E to dig up a chest (12% unique, otherwise 45% set piece).', 'מפות אוצר עתיקות נופלות מעילית ובוסים (12%), ארגזים ואירועים. השתמשו באחת כדי לסמן X זהוב במפת בר; עמדו עליו ולחצו E כדי לחפור תיבה (12% ייחודי, אחרת 45% חלק סט).'),
        L('Corrupted Gate Outbreak: a gate spews waves of monsters until you destroy it.', 'התפרצות שער מושחת: שער פולט גלי מפלצות עד שתהרסו אותו.'),
        L('Caravan Escort: bring a merchant wagon home to unlock the Black Market, which sells a unique, two set pieces, relic shards, Mythic Cores and treasure maps (stock rotates daily).', 'ליווי שיירה: הביאו עגלת סוחרים ליעדה כדי לפתוח את השוק השחור, שמוכר נשק ייחודי, שני חלקי סט, רסיסי שרידים, ליבות מיתיות ומפות אוצר (המלאי מתחלף מדי יום).'),
      ]);
  }

  function journal() {
    var cats = {};
    D.achievements.forEach(function (a) { (cats[a.cat] = cats[a.cat] || []).push(a); });
    var names = { combat: L('Combat', 'קרב'), legend: L('Legends', 'אגדות'), craft: L('Crafting & items', 'מלאכה ופריטים'), social: L('Party & social', 'חבורה וחברה'), world: L('World', 'עולם') };
    return h2(L('Journal, Titles & Bestiary', 'יומן, תארים ובסטיאריום')) +
      p(L('Press N for the Journal: ' + D.achievements.length + ' achievements. Many grant titles that float above your head.', 'לחצו N ליומן: ' + D.achievements.length + ' הישגים. רבים מעניקים תארים שמרחפים מעל ראשכם.')) +
      Object.keys(cats).map(function (k) {
        return h3(names[k] || L(k, k)) + table([L('Achievement', 'הישג'), L('Requirement', 'דרישה'), L('Title', 'תואר')], cats[k].map(function (a) { return ['<b>' + esc(t(a.name)) + '</b>', a.desc, a.title ? '<span class="gold">' + esc(t(a.title)) + '</span>' : '']; }));
      }).join('') +
      h3(L('Bestiary (O)', 'בסטיאריום (O)')) + p(L('Every creature you defeat is recorded with a live model, its attacks, elemental weaknesses and resistances, its drop chances and your Hunting Mastery progress.', 'כל יצור שאתם מביסים נרשם עם מודל חי, ההתקפות שלו, החולשות והעמידויות היסודיות, סיכויי השלל והתקדמות שליטת הציד שלכם.')) + '<p>' + link('#droprates', L('Open the online Bestiary →', 'לבסטיאריום המקוון ←')) + '</p>';
  }

  function economy() {
    return h2(L('Economy & Housing', 'כלכלה ודיור')) +
      h3(L('Supply and demand', 'היצע וביקוש')) + p(L('Each of the five cities tracks its own price index for weapons, armor, materials, potions, food, gems and furniture. Selling a category in bulk lowers its index in that city, buying raises it, and prices drift back over time. Every few in-game hours a Trade Boom or Shortage hits a city, while another market slumps.', 'כל אחת מחמש הערים עוקבת אחר מדד מחירים משלה לנשק, שריון, חומרים, שיקויים, מזון, אבנים ורהיטים. מכירה בכמויות מורידה את המדד באותה עיר, קנייה מעלה אותו, והמחירים חוזרים בהדרגה. כל כמה שעות משחק פורצת בעיר פריחת מסחר או מחסור, בזמן ששוק אחר צונח.')) +
      callout(L('Arbitrage tip: open the Market Ticker at any Market Exchange, buy where a category shows a down arrow, teleport (free) to the city with a Boom and sell there. Gilded Anvil membership adds a shop discount.', 'טיפ ארביטראז\': פתחו את טיקר השוק בכל בורסה, קנו היכן שקטגוריה מסומנת בחץ למטה, השתגרו (בחינם) לעיר עם פריחה ומכרו שם. חברות בסדן המוזהב מוסיפה הנחה בחנויות.')) +
      h3(L('Player housing', 'בתים לשחקן')) + table([L('House', 'בית'), L('City', 'עיר'), L('Size', 'גודל'), L('Price', 'מחיר')], D.realms.map(function (r, i) { return ['<b>' + esc(t(r.house.name)) + '</b>', link('#maps/' + i + '/city', r.city), n(r.house.w + '×' + r.house.h), num(r.house.price)]; })) +
      p(L('Press B inside your house to open the Grid Decorator. The Storage Vault (100 slots) is shared by every house and character; the Personal Master Anvil gives +10% forging quality; the Royal Bed wakes you Well Rested (+20% XP for 30 minutes); Weapon Racks and Armor Mannequins display your gear; boss Trophy Statues come from first-time boss kills and coliseum cups.', 'לחצו B בתוך הבית כדי לפתוח את מעצב הרשת. הכספת (100 משבצות) משותפת לכל הבתים והדמויות; הסדן האישי נותן +10% איכות זיוף; המיטה המלכותית מעירה אתכם רעננים (+20% ניסיון ל-30 דקות); מתקני נשק ובובות שריון מציגים את הציוד שלכם; פסלי ניצחון מגיעים מניצחון ראשון על בוסים ומגביעי הקולוסיאום.')) +
      '<p>' + link('#items', L('Browse every piece of furniture in the database →', 'לכל פריטי הריהוט במאגר ←')) + '</p>';
  }

  function endgame() {
    return h2(L('Endgame: Infinite Abyss & Coliseum', 'סוף המשחק: התהום האינסופית והקולוסיאום')) +
      h3(L('The Infinite Abyss Labyrinth', 'מבוך התהום האינסופי')) + list([
        L('Every floor is freshly generated; monster level is 8 + floor number.', 'כל קומה נוצרת מחדש; רמת המפלצות היא 8 ועוד מספר הקומה.'),
        L('Defeat the Floor Warden (a Named Elite) to open the stairs down. Every 5th floor is a Boss Rush of realm guardians fought back to back.', 'הביסו את שומר הקומה (עילית בעלת שם) כדי לפתוח את המדרגות למטה. כל קומה חמישית היא מרוץ בוסים של שומרי ממלכות ברצף.'),
        L('Loot deepens with the floor: Relic Shards from floor ' + D.loot.rules.abyss.relicFloor + ', the deep rarity table (2% Mythic) from floor ' + D.loot.rules.abyss.deepFloor + ', Mythic gear from bosses on floor ' + D.loot.rules.abyss.mythicGearFloor + '+ (' + Math.round(D.loot.rules.abyss.mythicGear * 100) + '%).', 'השלל משתפר עם העומק: רסיסי שרידים מקומה ' + D.loot.rules.abyss.relicFloor + ', טבלת הנדירות העמוקה (2% מיתי) מקומה ' + D.loot.rules.abyss.deepFloor + ', וציוד מיתי מבוסים בקומה ' + D.loot.rules.abyss.mythicGearFloor + '+ (' + Math.round(D.loot.rules.abyss.mythicGear * 100) + '%).'),
        L('Floor modifiers: Molten, Vampiric, Arcane-Shielded and Hasted; deeper floors stack two and then three. Checkpoints every 10 floors.', 'מאפייני קומה: מותך, ערפדי, מגן ארקני ומואץ; בקומות עמוקות מצטברים שניים ואז שלושה. נקודות ביקורת כל 10 קומות.'),
      ]) +
      h3(L('Grand Coliseum Arena', 'זירת הקולוסיאום הגדולה')) + p(L('Five tournament cups plus Endless Wave Survival. There is no death penalty in the arena. First wins award a cup trophy for your house.', 'חמישה גביעי טורניר ועוד הישרדות גלים אינסופית. אין עונש מוות בזירה. ניצחון ראשון מעניק גביע לבית שלכם.')) +
      table([L('Cup', 'גביע'), L('Level', 'רמה'), L('Reward', 'פרס'), L('Trophy', 'פסל')], D.cups.map(function (c) { return ['<b>' + esc(t(c.name)) + '</b>', n(c.level + '+'), num(c.gold) + ' ' + esc(t(L('gold', 'זהב'))), W.tok(c.trophy)]; }));
  }

  var CHAPTERS = [
    { id: 'desktop', title: L('Desktop App', 'אפליקציית המחשב'), render: desktop },
    { id: 'combat', title: L('Controls & Combat', 'שליטה וקרב'), render: combat },
    { id: 'fulldive', title: L('Full-Dive Combat', 'קרב Full-Dive'), render: fulldive },
    { id: 'forge', title: L('Blacksmithing', 'נפחות'), render: forge },
    { id: 'cooking', title: L('Alchemy & Cooking', 'אלכימיה ובישול'), render: cooking },
    { id: 'guilds', title: L('Guilds & Companions', 'גילדות ובני לוויה'), render: guilds },
    { id: 'living', title: L('Party & Raids', 'חבורה ופשיטות'), render: living },
    { id: 'world', title: L('Mounts, Pets & Events', 'רכיבה, חיות ואירועים'), render: world },
    { id: 'journal', title: L('Journal & Achievements', 'יומן והישגים'), render: journal },
    { id: 'economy', title: L('Economy & Housing', 'כלכלה ודיור'), render: economy },
    { id: 'endgame', title: L('Abyss & Coliseum', 'התהום והקולוסיאום'), render: endgame },
  ];

  function guidePage(args) {
    var focus = args[0];
    var side = CHAPTERS.map(function (c) { return '<a href="#guide/' + c.id + '" class="' + (focus === c.id ? 'on' : '') + '">' + esc(t(c.title)) + '</a>'; }).join('') +
      '<h5>' + esc(t(L('Reference', 'מקורות'))) + '</h5><a href="#skills">' + esc(t(L('Skills & Constellation', 'כישורים וקונסטלציה'))) + '</a><a href="#combat-docs/reactions">' + esc(t(L('Elemental Reactions', 'תגובות יסודות'))) + '</a><a href="#sets">' + esc(t(L('Sets & Relic Codex', 'סטים וקודקס'))) + '</a><a href="#maps">' + esc(t(L('Realm Atlas', 'אטלס הממלכות'))) + '</a>';
    return '<div class="page-head"><div><h1>' + esc(t(L('Strategy Guide', 'מדריך אסטרטגיה'))) + '</h1><p>' + fmt(L('Chapters on every system of the game. Tables and numbers are generated from the game data.', 'פרקים על כל מערכת במשחק. הטבלאות והמספרים נוצרים מנתוני המשחק.')) + '</p></div></div>' +
      '<div class="layout"><aside class="side">' + side + '</aside><div>' + CHAPTERS.map(function (c) { return '<section class="panel" id="sec-' + c.id + '">' + c.render() + '</section>'; }).join('') + '</div></div>';
  }

  W.register({ id: 'guide', title: L('Guide', 'מדריך'), nav: true, order: 9, render: guidePage });
  window.WikiGuide = { chapters: CHAPTERS };
})();
