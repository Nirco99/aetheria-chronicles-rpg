/* Aetheria Chronicles: Sword & Forge - bilingual Strategy Wiki (English LTR / Hebrew RTL).
   Standalone: plain script, no build step, works from file:// and GitHub Pages. */
(function () {
  'use strict';

  function L(en, he) { return { en: en, he: he }; }
  var lang = 'en';
  try {
    var saved = localStorage.getItem('aetheria.wiki.lang');
    if (saved === 'en' || saved === 'he') lang = saved;
    else if ((navigator.language || '').toLowerCase().indexOf('he') === 0) lang = 'he';
  } catch (e) { /* storage unavailable */ }
  function t(o) { return o && typeof o === 'object' ? o[lang] : o; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function bi(o) { return lang === 'he' && o.en !== o.he ? esc(o.he) + ' <span class="dim">(' + esc(o.en) + ')</span>' : esc(t(o)); }

  // ================================================================ UI strings
  var UI = {
    title: L('Aetheria Chronicles', 'כרוניקות אתריה'),
    sub: L('Sword & Forge — Strategy Wiki', 'חרב ונפחייה — ויקי אסטרטגיה'),
    foot: L('Fan-made strategy companion for Aetheria Chronicles: Sword & Forge. All values mirror the game data.', 'מדריך אסטרטגיה למשחק כרוניקות אתריה: חרב ונפחייה. כל הערכים תואמים לנתוני המשחק.'),
    search: L('Search skills, effects or branches...', 'חיפוש כישורים, אפקטים או ענפים...'),
    all: L('All branches', 'כל הענפים'), active: L('Active', 'פעיל'), passive: L('Passive', 'פסיבי'), ult: L('Ultimate', 'אולטימטיבי'),
    rank: L('Rank', 'דרגה'), sp: L('SP', 'נק\' כישור'), mp: L('MP', 'מאנה'), cd: L('Cooldown', 'זמן המתנה'), sec: L('s', ' שנ\''),
    levels: L('levels', 'רמות'), req: L('Requires', 'דורש'), none: L('No skills match your search.', 'לא נמצאו כישורים תואמים.'),
    base: L('Blueprint', 'שרטוט'), tier: L('Material tier', 'דרגת חומר'), grade: L('Craft grade', 'דרגת יצירה'), temper: L('Tempering', 'חישול'),
    mythic: L('Mythic variant (T7 only)', 'גרסה מיתית (רק דרגה 7)'), stats: L('Final stats', 'נתונים סופיים'), cost: L('Forging cost', 'עלות זיוף'),
    rarity: L('Rarity', 'נדירות'), sockets: L('Gem sockets', 'חריצי אבנים'), gold: L('Gold', 'זהב'), nextTemper: L('Next tempering step', 'שלב החישול הבא'),
    chance: L('Success chance', 'סיכוי הצלחה'), maxed: L('Fully tempered (+10)', 'מחושל במלואו (+10)'),
    output: L('Result', 'תוצר'), ingredients: L('Ingredients', 'מרכיבים'), effect: L('Effect', 'אפקט'),
    monster: L('Monster', 'מפלצת'), drops: L('Drops', 'שלל'), realm: L('Realm', 'ממלכה'), city: L('City', 'עיר'), lv: L('Levels', 'רמות'),
    dungeon: L('Dungeon', 'מבוך'), boss: L('Boss', 'בוס'), house: L('House', 'בית'), price: L('Price', 'מחיר'), ores: L('Ore veins', 'עורקי עפרה'),
    herbs: L('Herbs', 'צמחים'), elite: L('Night elite', 'עילית לילה'), monsters: L('Monsters', 'מפלצות'), perk: L('Perk per rank', 'הטבה לכל דרגה'),
    hall: L('Hall', 'אולם'), recruit: L('Recruit requirement', 'תנאי גיוס'), chainSkill: L('Chain skill', 'כישור שרשרת'), fights: L('Fights with', 'נלחם עם'),
  };

  // ================================================================ core data
  var BR = {
    sword: { name: L('One-Handed Sword', 'חרב ביד אחת'), color: '#7fc8ff', req: L('Longsword or Twin Edge in main hand', 'חרב ארוכה או להב תאום ביד הראשית') },
    dual: { name: L('Dual Blades', 'להבים כפולים'), color: '#a78bfa', req: L('A blade in each hand', 'להב בכל יד') },
    shield: { name: L('Shield & Fortress', 'מגן ומבצר'), color: '#ffd166', req: L('Shield in off hand', 'מגן ביד המשנית') },
    spear: { name: L('Spear & Polearm', 'חנית ומוט'), color: '#5ee6a0', req: L('Spear or Halberd in main hand', 'חנית או הלברד ביד הראשית') },
    bow: { name: L('Bow & Marksmanship', 'קשת וקליעה'), color: '#ffb35c', req: L('Bow in main hand', 'קשת ביד הראשית') },
    magic: { name: L('Elemental & Arcane Magic', 'קסם יסודות וארקני'), color: '#c18cff', req: L('Arcane Staff in main hand', 'מטה ארקני ביד הראשית') },
  };
  var BR_ORDER = ['sword', 'dual', 'shield', 'spear', 'bow', 'magic'];

  function S(b, rank, sp, mp, cd, name, desc) { return { b: b, rank: rank, sp: sp, mp: mp, cd: cd, name: name, desc: desc, ult: rank === 22 }; }
  var SKILLS = [
    S('sword', 1, 1, 8, 4, L('Gale Lunge', 'זינוק הסערה'), L('Leap 150 units along your aim and cut everything at the landing point. 170% ATK, knockback.', 'זינוק של 150 יחידות לכיוון הכוונה וחיתוך כל מה שבנקודת הנחיתה. 170% התקפה, הדיפה.')),
    S('sword', 4, 2, 14, 7, L('Quadrant Slash', 'חיתוך הרביע'), L('Four strikes that trace a glowing diamond in front of you. 4 x 95% ATK.', 'ארבע מכות שמשרטטות יהלום זוהר לפניך. 4 × 95% התקפה.')),
    S('sword', 8, 3, 16, 8, L('Rising Crescent', 'סהר עולה'), L('A falling cut, then a rising crescent that launches foes. 145% + 160% ATK, stun.', 'חיתוך יורד ואחריו סהר עולה שמעיף אויבים. 145% + 160% התקפה, הלם.')),
    S('sword', 14, 4, 24, 12, L('Crimson Piercer', 'הדוקר הארגמני'), L('Gather crimson light, then pierce 250 units through every enemy. 460% ATK, huge Break.', 'אגירת אור ארגמני ודקירה של 250 יחידות דרך כל האויבים. 460% התקפה, שבירה עצומה.')),
    S('sword', 22, 5, 40, 20, L('Stellar Cascade', 'מפל הכוכבים'), L('Seven strikes draw a seven-pointed star; the last one detonates. 6 x 95% + 220% ATK.', 'שבע מכות משרטטות כוכב בעל שבעה קצוות; האחרונה מתפוצצת. 6 × 95% + 220% התקפה.')),
    S('dual', 1, 1, 10, 5, L('Twin Cyclone', 'ציקלון תאום'), L('Spin forward with both blades, carving two full circles. 100% + 120% ATK.', 'סחרור קדימה עם שני הלהבים ושני מעגלים מלאים. 100% + 120% התקפה.')),
    S('dual', 4, 2, 12, 8, L('Crossguard Riposte', 'הדיפת הצלב'), L('Cross your blades for 0.6s. If struck, auto Perfect Parry and a critical X-slash (2 x 170%); otherwise a quick X-slash.', 'שילוב הלהבים ל-0.6 שניות. אם תותקף: הדיפה מושלמת אוטומטית וחיתוך X קריטי (2 × 170%); אחרת חיתוך X מהיר.')),
    S('dual', 8, 3, 14, 9, L('Phantom Step', 'צעד הרפאים'), L('Blink behind the enemy nearest your cursor and strike its back with a guaranteed critical. 240% ATK.', 'השתגרות אל מאחורי האויב הקרוב לסמן ומכה בגבו עם פגיעה קריטית מובטחת. 240% התקפה.')),
    S('dual', 14, 4, 32, 16, L('Starfall Tempest', 'סערת הכוכבים הנופלים'), L('A sixteen-hit storm of cyan and violet slashes; the final blow blasts enemies away. 15 x 42% + 180% ATK.', 'סערה של 16 חיתוכים בציאן וסגול; המכה האחרונה מעיפה אויבים. 15 × 42% + 180% התקפה.')),
    S('dual', 22, 5, 55, 28, L('Twilight Maelstrom', 'מערבולת הדמדומים'), L('Become a steerable 27-hit hurricane of blades. 26 x 40% + 300% ATK around you.', 'הפוך להוריקן להבים של 27 מכות שאפשר לנווט. 26 × 40% + 300% התקפה סביבך.')),
    S('shield', 1, 1, 8, 5, L('Shield Bash', 'הלמות מגן'), L('Drive your shield into the enemy: 1.2s stun and massive Break damage. 110% ATK.', 'הנחתת המגן על האויב: הלם ל-1.2 שניות ונזק שבירה עצום. 110% התקפה.')),
    S('shield', 4, 2, 14, 12, L('Aegis Guard', 'משמר האגיס'), L('A directional barrier for 3.5s: every frontal attack is negated, DEF +20%.', 'מחסום כיווני ל-3.5 שניות: כל התקפה מלפנים מבוטלת, הגנה +20%.')),
    S('shield', 8, 3, 18, 10, L('Earthshaker Slam', 'מרעיד האדמה'), L('Leap and slam the ground: 220% ATK to nearby enemies, 0.8s stun, heavy Break.', 'זינוק וחבטה בקרקע: 220% התקפה לאויבים קרובים, הלם 0.8 שניות ושבירה כבדה.')),
    S('shield', 14, 4, 16, 18, L("Knight's Provocation", 'התגרות האביר'), L('Taunt every enemy within 280 units for 6s and surge DEF by 50% for 8s.', 'גרירת כל האויבים ברדיוס 280 אליך ל-6 שניות והגנה +50% ל-8 שניות.')),
    S('shield', 22, 5, 45, 40, L('Immortal Citadel', 'המצודה הנצחית'), L('A golden dome for 4.5s: you and allies inside are invulnerable; enemies are pushed out.', 'כיפה זהובה ל-4.5 שניות: אתה ובני בריתך בפנים חסינים; אויבים נדחפים החוצה.')),
    S('spear', 1, 1, 8, 4, L('Comet Thrust', 'דקירת השביט'), L('A blinding thrust that pierces 190 units in a line. 210% ATK.', 'דקירה מסנוורת שחודרת 190 יחידות בקו ישר. 210% התקפה.')),
    S('spear', 4, 2, 12, 6, L('Crescent Sweep', 'טאטוא הסהר'), L('A full 360-degree sweep that hurls enemies away. 150% ATK, strong knockback.', 'טאטוא של 360 מעלות שמעיף אויבים. 150% התקפה, הדיפה חזקה.')),
    S('spear', 8, 3, 20, 10, L('Dragon Dive', 'צלילת הדרקון'), L('Leap toward your cursor (up to 260 units) and crash down spear-first. 300% ATK in an area.', 'קפיצה אל הסמן (עד 260 יחידות) ונחיתה עם החנית קדימה. 300% התקפה באזור.')),
    S('spear', 14, 4, 18, 12, L('Armor Piercer', 'מפלח השריון'), L('A twisting thrust: 240% ATK and -35% enemy DEF for 8s.', 'דקירה מסתובבת: 240% התקפה והורדת 35% מהגנת האויב ל-8 שניות.')),
    S('spear', 22, 5, 45, 24, L('Gale Whirlwind', 'מערבולת הרוח'), L('Spin your polearm for 2.5s while moving, then a cyclone burst. 14 x 60% + 200% ATK.', 'סיבוב כלי המוט 2.5 שניות תוך תנועה ואז פיצוץ ציקלון. 14 × 60% + 200% התקפה.')),
    S('bow', 1, 1, 8, 4, L('Penetrating Shot', 'ירייה חודרת'), L('A deep draw and an arrow that pierces every enemy in its path. 240% ATK.', 'מתיחה עמוקה וחץ שחודר כל אויב במסלולו. 240% התקפה.')),
    S('bow', 4, 2, 12, 6, L('Spread Volley', 'מטח מניפה'), L('Five arrows in a fan. 5 x 110% ATK.', 'חמישה חצים במניפה. 5 × 110% התקפה.')),
    S('bow', 8, 3, 14, 9, L('Acrobatic Backflip Shot', 'ירי בסלטה לאחור'), L('Backflip (invulnerable), leave a snare trap that roots for 2.5s, and fire mid-air. 180% ATK.', 'סלטה לאחור (חסין), מלכודת שמשתקת ל-2.5 שניות וירי באוויר. 180% התקפה.')),
    S('bow', 14, 4, 26, 14, L('Celestial Arrow Rain', 'גשם חצים שמימי'), L('14 starlit arrows fall around your cursor over 1.6s. 14 x 85% ATK.', '14 חצי כוכבים נוחתים סביב הסמן במשך 1.6 שניות. 14 × 85% התקפה.')),
    S('bow', 22, 5, 50, 26, L('Phoenix Rail-Shot', 'קרן הפניקס'), L('Charge a phoenix-fire rail that obliterates a 640-unit line. 620% ATK, Burn, recoil dash.', 'טעינת קרן אש של עוף החול שמכלה קו של 640 יחידות. 620% התקפה, בעירה ורתע לאחור.')),
    S('magic', 1, 1, 14, 5, L('Ignis Meteorite', 'מטאוריט האש'), L('Call a meteor onto your cursor: 330% MAG fire damage in an area, Burn.', 'זימון מטאור אל הסמן: 330% נזק קסם של אש באזור, בעירה.')),
    S('magic', 4, 2, 16, 7, L('Absolute Zero Lance', 'רומח האפס המוחלט'), L('A piercing lance of absolute zero that freezes enemies for 2s. 260% MAG.', 'רומח קרח חודר שמקפיא אויבים ל-2 שניות. 260% קסם.')),
    S('magic', 8, 3, 22, 9, L('Thunderstorm Chain', 'שרשרת הסערה'), L('Lightning leaps between up to five enemies, 15% weaker per jump. 200% MAG, Shock.', 'ברק קופץ בין עד חמישה אויבים, חלש ב-15% בכל קפיצה. 200% קסם, הלם חשמלי.')),
    S('magic', 14, 4, 26, 16, L('Arcane Barrier & Nova', 'מחסום ארקני ונובה'), L('A barrier worth 30% of your max HP for 6s plus a repelling nova. 190% MAG.', 'מחסום בשווי 30% מהחיים המרביים ל-6 שניות וגל הדף. 190% קסם.')),
    S('magic', 22, 5, 50, 35, L('Sacred Aether Sanctuary', 'מקדש האתר המקודש'), L('Consecrate the ground for 8s: allies heal 4% max HP every half second and are cleansed; enemies are slowed.', 'קידוש הקרקע ל-8 שניות: בני ברית מחלימים 4% מהחיים כל חצי שנייה ומטוהרים; אויבים מואטים.')),
  ];

  function P(b, rank, name, desc) { return { b: b, rank: rank, name: name, desc: desc, passive: true }; }
  var PASSIVES = [
    P('sword', 2, L('Blade Discipline', 'משמעת הלהב'), L('+4% ATK per level while wielding a blade.', '+4% התקפה לכל רמה בזמן אחיזת להב.')),
    P('sword', 10, L('Riposte Instinct', 'אינסטינקט התגובה'), L('Perfect Parry window +0.04s per level.', 'חלון ההדיפה המושלמת +0.04 שניות לכל רמה.')),
    P('sword', 18, L('Edge Mastery', 'שליטת החוד'), L('+3% crit chance and +8% crit damage per level.', '+3% סיכוי קריטי ו-+8% נזק קריטי לכל רמה.')),
    P('dual', 2, L('Ambidexterity', 'דו-ידיות'), L('+5% attack speed per level while dual wielding.', '+5% מהירות התקפה לכל רמה בזמן אחיזה כפולה.')),
    P('dual', 10, L('Flurry Rhythm', 'קצב המטח'), L('Each consecutive hit within 1.5s adds +1% damage, up to +6% per level.', 'כל מכה רצופה בתוך 1.5 שניות מוסיפה 1% נזק, עד 6% לכל רמה.')),
    P('dual', 18, L('Twin Fang', 'ניב תאום'), L('+2% crit chance and +6% crit damage per level.', '+2% סיכוי קריטי ו-+6% נזק קריטי לכל רמה.')),
    P('shield', 2, L('Bulwark', 'חומת מגן'), L('+6% DEF per level with a shield.', '+6% הגנה לכל רמה כשמגן מצויד.')),
    P('shield', 10, L('Steadfast', 'איתנות'), L('-12% Stamina cost when blocking and +5% block efficiency per level.', '12%- עלות סיבולת בחסימה ו-+5% יעילות חסימה לכל רמה.')),
    P('shield', 18, L('Retaliation', 'תגמול'), L('Reflect 10% of blocked damage per level.', 'החזרת 10% מהנזק שנחסם לכל רמה.')),
    P('spear', 2, L('Long Reach', 'טווח ארוך'), L('+8% basic attack reach and +3% ATK per level with a polearm.', '+8% טווח התקפה בסיסית ו-+3% התקפה לכל רמה עם כלי מוט.')),
    P('spear', 10, L('Impaler', 'המשפד'), L('+4 Break power and +3% crit chance per level.', '+4 כוח שבירה ו-+3% סיכוי קריטי לכל רמה.')),
    P('spear', 18, L('Wind Footwork', 'צעדי הרוח'), L('+4% move speed and +4% attack speed per level.', '+4% מהירות תנועה ו-+4% מהירות התקפה לכל רמה.')),
    P('bow', 2, L('Eagle Eye', 'עין הנשר'), L('+4% crit chance per level with a bow.', '+4% סיכוי קריטי לכל רמה עם קשת.')),
    P('bow', 10, L('Quick Nock', 'דריכה מהירה'), L('+8% attack speed per level with a bow.', '+8% מהירות התקפה לכל רמה עם קשת.')),
    P('bow', 18, L("Hunter's Mark", 'סימן הצייד'), L('+5% ATK per level, and +5% damage per level against targets farther than 160 units.', '+5% התקפה לכל רמה, ו-+5% נזק לכל רמה נגד מטרות רחוקות מ-160 יחידות.')),
    P('magic', 2, L('Arcane Flow', 'זרימה ארקנית'), L('+12% MP regeneration and +10 max MP per level.', '+12% התחדשות מאנה ו-+10 מאנה מרבית לכל רמה.')),
    P('magic', 10, L('Elemental Attunement', 'כוונון יסודות'), L('+6% MAG per level.', '+6% קסם לכל רמה.')),
    P('magic', 18, L('Spell Echo', 'הד הלחש'), L('6% chance per level to instantly refund a spell\'s cooldown.', '6% סיכוי לכל רמה להחזיר מייד את זמן ההמתנה של לחש.')),
  ];

  var AWAKENINGS = [
    { name: L('Dual Blades Overdrive', 'האצת הלהבים הכפולים'), desc: L('+20% attack speed. Critical hits have a 10% chance to reset every Sword Skill cooldown.', '+20% מהירות התקפה. לפגיעות קריטיות יש 10% סיכוי לאפס את כל זמני ההמתנה של כישורי החרב.'), how: L('Reach One-Handed Sword Mastery Rank 10, or land 15 Perfect Parries.', 'הגעה לדרגת שליטה 10 בחרב ביד אחת, או 15 הדיפות מושלמות.'), tip: L('Practice parries on Frenzy Boars: their charge telegraph is long and readable.', 'תרגלו הדיפות על חזירי בר משתוללים: האות של ההסתערות שלהם ארוך וקריא.') },
    { name: L("Master Blacksmith's Soul", 'נשמת הנפח הגדול'), desc: L('Every weapon you forge yourself can hold 2 Elemental Gem sockets.', 'כל נשק שזייפת בעצמך יכול להכיל 2 חריצי אבני יסוד.'), how: L('Forge 5 items of Masterwork or Supreme Masterpiece grade.', 'זיוף 5 פריטים בדרגת יצירת מופת או יצירת מופת עליונה.'), tip: L('Cheap Iron blueprints count too. Buy a house anvil (+10% quality) and practise the hammer gauge.', 'גם שרטוטי ברזל זולים נחשבים. קנו סדן ביתי (+10% איכות) והתאמנו במד הפטיש.') },
    { name: L("Paragon's Divine Aegis", 'האגיס האלוהי של הפרגון'), desc: L('When HP falls below 40%, an emergency barrier worth 30% of max HP erupts. Recharges every 45 seconds.', 'כשהחיים יורדים מתחת ל-40%, מחסום חירום בשווי 30% מהחיים המרביים מתפרץ. נטען כל 45 שניות.'), how: L('Win a boss fight below 15% HP, or block 2,000 total damage.', 'ניצחון בקרב בוס עם פחות מ-15% חיים, או חסימת 2,000 נזק בסך הכול.'), tip: L('Blocking with a shield (even without parrying) quickly adds up to 2,000 blocked damage.', 'חסימה עם מגן (גם בלי הדיפה) מצטברת מהר ל-2,000 נזק חסום.') },
  ];

  var TIERS = [
    { name: L('Iron', 'ברזל'), power: 1, lvl: 1, ingot: L('Iron Ingot', 'מטיל ברזל'), mat: L('Dire Wolf Pelt', 'פרוות זאב אימה'), realm: 1 },
    { name: L('Silver', 'כסף'), power: 1.9, lvl: 10, ingot: L('Silver Ingot', 'מטיל כסף'), mat: L('Treant Bark', 'קליפת עץ-מהלך'), realm: 2 },
    { name: L('Mithril', "מית'ריל"), power: 2.6, lvl: 15, ingot: L('Mithril Ingot', "מטיל מית'ריל"), mat: L('Venom Sac', 'שק ארס'), realm: 2 },
    { name: L('Orichalcum', 'אוריכלקום'), power: 3.5, lvl: 20, ingot: L('Orichalcum Ingot', 'מטיל אוריכלקום'), mat: L('Drake Scale', 'קשקש דרקונית'), realm: 3 },
    { name: L('Crimson Demonsteel', 'פלדת שדים ארגמנית'), power: 4.5, lvl: 26, ingot: L('Crimson Demonsteel Ingot', 'מטיל פלדת שדים'), mat: L('Obsidian Core', 'ליבת אובסידיאן'), realm: 3 },
    { name: L('Starlight Crystal', 'בדולח אור כוכבים'), power: 5.7, lvl: 32, ingot: L('Starlight Crystal Ingot', 'מטיל בדולח אור כוכבים'), mat: L('Frost Wyvern Scale', 'קשקש וויברן כפור'), realm: 4 },
    { name: L('Aetherial Dragonbone', 'עצם דרקון אתרית'), power: 7, lvl: 42, ingot: L('Aetherial Dragonbone Alloy', 'סגסוגת עצם דרקון'), mat: L('Seraphim Cog', 'גלגל שיניים של שרף'), realm: 5 },
  ];

  var STAT = { atk: L('ATK', 'התקפה'), def: L('DEF', 'הגנה'), mag: L('MAG', 'קסם'), hp: L('Max HP', 'חיים מרביים'), mp: L('Max MP', 'מאנה מרבית'), crit: L('Crit chance', 'סיכוי קריטי'), aspd: L('Attack speed', 'מהירות התקפה'), move: L('Move speed', 'מהירות תנועה'), brk: L('Break power', 'כוח שבירה'), block: L('Block efficiency', 'יעילות חסימה') };
  var FRACTION = { crit: 1, aspd: 1, move: 1, block: 1 };

  function B(id, name, weapon, stats, ingots, mats) { return { id: id, name: name, weapon: weapon, stats: stats, ingots: ingots, mats: mats }; }
  var BASES = [
    B('w_sword', L('Longsword', 'חרב ארוכה'), true, { atk: 12 }, 5, 2),
    B('w_twinblade', L('Twin Edge', 'להב תאום'), true, { atk: 9, aspd: 0.08, crit: 0.03 }, 4, 2),
    B('w_spear', L('Spear', 'חנית'), true, { atk: 13, brk: 2 }, 4, 3),
    B('w_halberd', L('Halberd', 'הלברד'), true, { atk: 17, brk: 5 }, 6, 3),
    B('w_bow', L('Longbow', 'קשת ארוכה'), true, { atk: 11, crit: 0.04 }, 2, 4),
    B('w_staff', L('Arcane Staff', 'מטה ארקני'), true, { atk: 5, mag: 14, mp: 15 }, 2, 3),
    B('a_helm', L('Helm', 'קסדה'), false, { def: 4, hp: 10 }, 3, 1),
    B('a_hood', L('Hood', 'ברדס'), false, { def: 2, crit: 0.02, move: 0.02 }, 1, 3),
    B('a_circlet', L('Circlet', 'נזר'), false, { def: 2, mag: 4, mp: 10 }, 2, 2),
    B('a_brig', L('Brigandine', 'בריגנדין'), false, { def: 8, hp: 20 }, 4, 3),
    B('a_coat', L('Duelist Coat', 'מעיל דו-קרב'), false, { def: 6, crit: 0.03, aspd: 0.04 }, 2, 5),
    B('a_plate', L('Knight Plate', 'שריון אבירים'), false, { def: 12, hp: 30, move: -0.03 }, 7, 2),
    B('a_robe', L('Arcane Robe', 'גלימה ארקנית'), false, { def: 4, mag: 6, mp: 25 }, 1, 5),
    B('a_boots', L('Greaves', 'מגפי שריון'), false, { def: 3, move: 0.03 }, 3, 2),
    B('a_cloak', L('Cloak', 'שכמייה'), false, { def: 2, hp: 12, crit: 0.01 }, 1, 4),
    B('a_shield', L('Shield', 'מגן'), false, { def: 6, block: 0.1 }, 5, 1),
  ];
  var GRADES = [
    { name: L('Standard', 'רגיל'), mult: 1, rarity: 1, sockets: 0 },
    { name: L('Fine', 'משובח'), mult: 1.15, rarity: 2, sockets: 1 },
    { name: L('Masterwork', 'יצירת מופת'), mult: 1.3, rarity: 3, sockets: 1 },
    { name: L('Supreme Masterpiece', 'יצירת מופת עליונה'), mult: 1.5, rarity: 4, sockets: 2 },
  ];
  var RARITY = [L('Common', 'רגיל'), L('Uncommon', 'לא שכיח'), L('Rare', 'נדיר'), L('Epic', 'אפי'), L('Legendary', 'אגדי'), L('Mythic', 'מיתי')];
  var RARITY_MULT = [1, 1.1, 1.22, 1.36, 1.52, 1.75];
  var RARITY_COLOR = ['#c9d1d9', '#5fd38d', '#4aa8ff', '#b46cff', '#ffb347', '#ff4f7b'];
  var TEMPER_CHANCE = [1, 1, 1, 1, 1, 0.85, 0.7, 0.55, 0.4, 0.3];

  var I = {
    ore_copper: L('Copper Ore', 'עפרת נחושת'), ore_iron: L('Iron Ore', 'עפרת ברזל'), ore_silver: L('Silver Ore', 'עפרת כסף'), ore_mithril: L('Mithril Ore', "עפרת מית'ריל"),
    ore_orichalcum: L('Orichalcum Ore', 'עפרת אוריכלקום'), ore_crimson: L('Crimson Steel Ore', 'עפרת פלדה ארגמנית'), ore_titanium: L('Titanium Ore', 'עפרת טיטניום'),
    ore_starlight: L('Starlight Crystal', 'בדולח אור כוכבים'), ore_voidsteel: L('Voidsteel Ore', 'עפרת פלדת ריק'), ore_dragonbone: L('Dragonbone', 'עצם דרקון'),
    ingot_iron: L('Iron Ingot', 'מטיל ברזל'), ingot_silver: L('Silver Ingot', 'מטיל כסף'), ingot_mithril: L('Mithril Ingot', "מטיל מית'ריל"), ingot_orichalcum: L('Orichalcum Ingot', 'מטיל אוריכלקום'),
    ingot_demonsteel: L('Crimson Demonsteel Ingot', 'מטיל פלדת שדים ארגמנית'), ingot_starlight: L('Starlight Crystal Ingot', 'מטיל בדולח אור כוכבים'), ingot_dragonbone: L('Aetherial Dragonbone Alloy', 'סגסוגת עצם דרקון אתרית'),
    herb_moonleaf: L('Moonleaf', 'עלה ירח'), herb_lotus: L('Azure Lotus', 'לוטוס תכול'), herb_firebell: L('Firebell Root', 'שורש פעמון האש'), herb_frostpetal: L('Frostpetal', 'עלה כותרת כפור'), herb_skyorchid: L('Sky Orchid', 'סחלב השמיים'),
    wolf_pelt: L('Dire Wolf Pelt', 'פרוות זאב אימה'), boar_meat: L('Boar Meat', 'בשר חזיר בר'), kobold_fang: L('Kobold Fang', 'ניב קובולד'), treant_bark: L('Treant Bark', 'קליפת עץ-מהלך'),
    venom_sac: L('Venom Sac', 'שק ארס'), water_essence: L('Water Essence', 'תמצית מים'), spore_cap: L('Blight Spore Cap', 'כובע נבג מורעל'), drake_scale: L('Drake Scale', 'קשקש דרקונית'), drake_meat: L('Drake Meat', 'בשר דרקונית'),
    golem_core: L('Obsidian Core', 'ליבת אובסידיאן'), flame_emblem: L('Flame Knight Emblem', 'סמל אביר הלהבה'), demon_core: L('Demon Core', 'ליבת שד'), wyvern_scale: L('Frost Wyvern Scale', 'קשקש וויברן כפור'),
    wyvern_meat: L('Wyvern Steak', 'סטייק וויברן'), phantom_cloth: L('Phantom Silk', 'משי רפאים'), frost_essence: L('Frost Essence', 'תמצית כפור'), automaton_gear: L('Seraphim Cog', 'גלגל שיניים של שרף'),
    reaver_claw: L('Reaver Claw', 'טופר קוצר'), aether_dust: L('Aether Dust', 'אבק אתר'), wisp_lumen: L('Wisp Lumen', 'אור זוהרון'), relic_shard: L('Abyssal Relic Shard', 'רסיס שריד התהום'), mythic_core: L('Mythic Core', 'ליבה מיתית'),
    enh_stone: L('Enhancement Stone', 'אבן חישול'), enh_greater: L('Greater Enhancement Stone', 'אבן חישול גדולה'), spice: L("Traveler's Spices", 'תבלינים'), bread: L('Fresh Bread', 'לחם טרי'), fish: L('Silverscale Fish', 'דג קשקש-כסף'), honey: L('Cloud Honey', 'דבש עננים'),
    pot_hp_s: L('Minor Healing Potion', 'שיקוי ריפוי קטן'), pot_mp_s: L('Mana Tonic', 'טוניק מאנה'), pot_hp_m: L('Healing Elixir', 'אליקסיר ריפוי'), pot_haste: L('Quicksilver Draught', 'שיקוי כספית'),
    pot_crit: L('Draught of Precision', 'שיקוי דיוק'), oil_fire: L('Fire Blade Oil', 'שמן להב אש'), pot_mp_l: L('Arcane Elixir', 'אליקסיר ארקני'), oil_frost: L('Frost Blade Oil', 'שמן להב כפור'),
    pot_hp_l: L('Grand Healing Elixir', 'אליקסיר ריפוי גדול'), oil_lightning: L('Lightning Blade Oil', 'שמן להב ברק'),
    food_cutlet: L('Crisp Boar Cutlet', 'שניצל חזיר בר פריך'), food_soup: L('Lakeside Lotus Soup', 'מרק לוטוס מהאגם'), food_stew: L('Wyrm-Steak Stew', 'תבשיל סטייק דרקון'),
    food_skewer: L('Glacier Wyvern Skewer', 'שיפוד וויברן הקרחון'), food_pie: L('Sky Orchid Honey Pie', 'פאי דבש וסחלב שמיים'), food_banquet: L("Sovereign's Banquet", 'משתה הריבון'),
  };

  function R(out, qty, ins, eff) { return { out: out, qty: qty, ins: ins, eff: eff }; }
  var SMELT = [
    R('ingot_iron', 1, [['ore_iron', 2], ['ore_copper', 1]]), R('ingot_silver', 1, [['ore_silver', 2]]), R('ingot_mithril', 1, [['ore_mithril', 2], ['ore_silver', 1]]),
    R('ingot_orichalcum', 1, [['ore_orichalcum', 2]]), R('ingot_demonsteel', 1, [['ore_crimson', 3], ['ore_orichalcum', 1]]), R('ingot_starlight', 1, [['ore_starlight', 2], ['ore_titanium', 1]]),
    R('ingot_dragonbone', 1, [['ore_dragonbone', 2], ['ore_voidsteel', 1]]),
  ];
  var ALCHEMY = [
    R('pot_hp_s', 2, [['herb_moonleaf', 2]], L('Restores 30% HP.', 'משחזר 30% חיים.')),
    R('pot_mp_s', 2, [['herb_moonleaf', 1], ['kobold_fang', 1]], L('Restores 35% MP.', 'משחזר 35% מאנה.')),
    R('pot_hp_m', 2, [['herb_lotus', 2], ['water_essence', 1]], L('Restores 55% HP.', 'משחזר 55% חיים.')),
    R('pot_haste', 1, [['water_essence', 1], ['herb_lotus', 1], ['herb_moonleaf', 1]], L('+15% attack speed, +12% move speed for 3 min.', '+15% מהירות התקפה ו-+12% מהירות תנועה ל-3 דקות.')),
    R('pot_crit', 1, [['venom_sac', 1], ['herb_firebell', 1]], L('+12% crit chance for 3 min.', '+12% סיכוי קריטי ל-3 דקות.')),
    R('oil_fire', 1, [['herb_firebell', 2], ['drake_scale', 1]], L('Weapon coated in fire for 3 min: +15% fire damage and Burn.', 'הנשק מצופה באש ל-3 דקות: +15% נזק אש ובעירה.')),
    R('pot_mp_l', 2, [['herb_lotus', 2], ['frost_essence', 1]], L('Restores 70% MP and all Stamina.', 'משחזר 70% מאנה ואת כל הסיבולת.')),
    R('oil_frost', 1, [['herb_frostpetal', 2], ['frost_essence', 1]], L('Weapon coated in frost for 3 min: +15% frost damage and Chill.', 'הנשק מצופה בכפור ל-3 דקות: +15% נזק כפור והאטה.')),
    R('pot_hp_l', 2, [['herb_frostpetal', 2], ['herb_skyorchid', 1]], L('Restores 85% HP and cleanses ailments.', 'משחזר 85% חיים ומטהר מצבים שליליים.')),
    R('oil_lightning', 1, [['aether_dust', 1], ['herb_skyorchid', 1], ['water_essence', 1]], L('Weapon charged for 3 min: +15% lightning damage and Shock.', 'הנשק טעון ל-3 דקות: +15% נזק ברק והלם.')),
  ];
  var COOKING = [
    R('food_cutlet', 1, [['boar_meat', 2], ['herb_moonleaf', 1], ['spice', 1]], L('+10% ATK, +1% HP/s for 5 min.', '+10% התקפה, +1% חיים לשנייה ל-5 דקות.')),
    R('food_soup', 1, [['fish', 1], ['herb_lotus', 2]], L('+12% MAG, +40% MP regen for 6 min.', '+12% קסם, +40% התחדשות מאנה ל-6 דקות.')),
    R('food_stew', 1, [['drake_meat', 2], ['herb_firebell', 1], ['spice', 1]], L('+15% ATK, +10% DEF for 8 min.', '+15% התקפה, +10% הגנה ל-8 דקות.')),
    R('food_skewer', 1, [['wyvern_meat', 2], ['herb_frostpetal', 1]], L('+8% crit, +8% move speed for 8 min.', '+8% סיכוי קריטי, +8% מהירות ל-8 דקות.')),
    R('food_pie', 1, [['herb_skyorchid', 2], ['bread', 1], ['honey', 1]], L('+15% max HP, +1.5% HP/s for 10 min.', '+15% חיים מרביים, +1.5% חיים לשנייה ל-10 דקות.')),
    R('food_banquet', 1, [['boar_meat', 2], ['drake_meat', 1], ['wyvern_meat', 1], ['herb_skyorchid', 1], ['spice', 2]], L('+18% ATK, +15% DEF, +18% MAG, +6% crit, +6% speed for 15 min.', '+18% התקפה, +15% הגנה, +18% קסם, +6% קריטי, +6% מהירות ל-15 דקות.')),
  ];

  function M(name, drops, note) { return { name: name, drops: drops, note: note || null }; }
  var REALMS = [
    {
      name: L('Emerald Plains of Arcadia', 'מישורי האזמרגד של ארקדיה'), city: L('Arcadia, City of First Steps', 'ארקדיה, עיר הצעדים הראשונים'), lv: '1-10',
      desc: L('Rolling meadows dusted with cherry blossoms, copper and iron veins, and the Sunken Cobalt Tower on the horizon.', 'כרי דשא מכוסים בפריחת דובדבן, עורקי נחושת וברזל, ומגדל הקובלט השקוע באופק.'),
      dungeon: L('Sunken Cobalt Tower', 'מגדל הקובלט השקוע'), boss: L('Gorrak the Kobold Warchief', 'גוראק, מצביא הקובולדים'), house: L('Starter Timber Cottage', 'בקתת עץ למתחילים'), price: 500,
      ores: ['ore_copper', 'ore_iron'], herbs: ['herb_moonleaf'], elite: L('Thornback, the Night Alpha', 'גב-קוצים, אלפא הלילה'),
      special: L('Grand Forge, Guild Headquarters, Market Exchange, Grand Coliseum Arena, Infinite Abyss Gate', 'הנפחייה הגדולה, מטה הגילדות, בורסת השוק, זירת הקולוסיאום, שער התהום האינסופי'),
      mons: [
        M(L('Dire Wolf', 'זאב אימה'), [['wolf_pelt', '55%']]), M(L('Frenzy Boar', 'חזיר בר משתולל'), [['boar_meat', '75% (1-2)'], ['wolf_pelt', '12%']]),
        M(L('Kobold Scout', 'סייר קובולד'), [['kobold_fang', '60%'], ['ore_copper', '15%']]), M(L('Kobold Trooper', 'חייל קובולד'), [['kobold_fang', '60%'], ['ore_iron', '25%']], L('dungeon', 'מבוך')),
        M(L('Kobold Sentinel', 'זקיף קובולד'), [['ore_iron', '40%'], ['kobold_fang', '50%'], ['enh_stone', '6%']], L('dungeon', 'מבוך')),
      ],
    },
    {
      name: L('Sylvanis Twilight Forest & Crystal Lakes', 'יער הדמדומים של סילבניס ואגמי הבדולח'), city: L('Sylvanis Haven', 'מפלט סילבניס'), lv: '10-20',
      desc: L('Bioluminescent woods around mirror-still lakes. Silver and mithril glitter in the roots of ancient trees.', 'יערות זוהרים סביב אגמים שקטים כמראה. כסף ומית\'ריל נוצצים בשורשי עצים עתיקים.'),
      dungeon: L('Sanctuary of the Blighted Root', 'מקדש השורש המורעל'), boss: L('Nerius the Elder Arch-Treant', 'נריוס, העץ-המהלך הקדמון'), house: L('Lakeside Villa', 'וילה על שפת האגם'), price: 2000,
      ores: ['ore_silver', 'ore_mithril'], herbs: ['herb_lotus'], elite: L('Gloomweaver Matriarch', 'אם האורגים האפלה'),
      special: L('Bowyer & Alchemy Plaza, Mystic Arcanum Hall, lakeside decks', 'כיכר הקשתים והאלכימיה, אולם הארקנום המיסטי, רציפי עץ על האגם'),
      mons: [
        M(L('Treant Guardian', 'שומר עץ-מהלך'), [['treant_bark', '70%'], ['herb_lotus', '20%']]), M(L('Venom Stalker', 'צייד הארס'), [['venom_sac', '60%']]),
        M(L('Water Elemental', 'רוח מים'), [['water_essence', '60%']]), M(L('Blight Sporeling', 'נבגון מורעל'), [['spore_cap', '70%']], L('dungeon', 'מבוך')),
      ],
    },
    {
      name: L('Pyrehold Volcanic Canyon', 'קניון הגעש של פיירהולד'), city: L('Pyrehold Bastion', 'מבצר פיירהולד'), lv: '20-30',
      desc: L('Basalt crags split by rivers of lava. Orichalcum and crimson steel veins glow in the dark.', 'צוקי בזלת שנבקעים בנהרות לבה. עורקי אוריכלקום ופלדה ארגמנית זוהרים בחושך.'),
      dungeon: L('Heart of the Caldera', 'לב הלוע'), boss: L('Igniscor the Molten Wyrm', 'איגניסקור, הדרקון המותך'), house: L('Forge-Master Manor', 'אחוזת אמן הנפחייה'), price: 5000,
      ores: ['ore_orichalcum', 'ore_crimson'], herbs: ['herb_firebell'], elite: L('Pyreclaw, the Ashen Drake', 'טופר-המוקד, הדרקונית האפורה'),
      special: L('Gilded Anvil Master Smithy, magma-lit citadel', 'נפחיית המאסטר של הסדן המוזהב, מצודה מוארת במאגמה'),
      mons: [
        M(L('Magma Drake', 'דרקונית מאגמה'), [['drake_scale', '60%'], ['drake_meat', '50%']]), M(L('Obsidian Golem', 'גולם אובסידיאן'), [['golem_core', '50%'], ['ore_orichalcum', '20%']]),
        M(L('Flame Knight', 'אביר הלהבה'), [['flame_emblem', '50%'], ['demon_core', '12%'], ['ore_crimson', '20%']]), M(L('Cinder Imp', 'שדון גחלים'), [['demon_core', '15%'], ['herb_firebell', '25%']], L('dungeon', 'מבוך')),
      ],
    },
    {
      name: L('Crystalia Starlight Glaciers', 'קרחוני אור הכוכבים של קריסטליה'), city: L('Crystalia Spire', 'צריח קריסטליה'), lv: '30-40',
      desc: L('Frozen peaks under a sky of falling stars. Starlight crystal and titanium sleep beneath the ice.', 'פסגות קפואות תחת שמיים של כוכבים נופלים. בדולח אור כוכבים וטיטניום ישנים מתחת לקרח.'),
      dungeon: L('Cathedral of Eternal Frost', 'קתדרלת הכפור הנצחי'), boss: L('Valkyria the Glacial Empress', 'ולקיריה, קיסרית הקרח'), house: L('Starlight Glacier Estate', 'אחוזת קרחון אור הכוכבים'), price: 12000,
      ores: ['ore_starlight', 'ore_titanium'], herbs: ['herb_frostpetal'], elite: L('Rimehowl, the Glacier Wyvern', 'יללת-כפור, וויברן הקרחון'),
      special: L('Knights of the Ivory Aegis Command, ice-crystal bridges', 'מפקדת אבירי אגיס השנהב, גשרי בדולח קרח'),
      mons: [
        M(L('Frost Wyvern', 'וויברן כפור'), [['wyvern_scale', '55%'], ['wyvern_meat', '50%']]), M(L('Phantom Lancer', 'רומחאי רפאים'), [['phantom_cloth', '55%'], ['ore_titanium', '20%']]),
        M(L('Ice Wraith', 'רוח קרח'), [['frost_essence', '60%']]), M(L('Frost Revenant', 'נוקם הכפור'), [['frost_essence', '40%'], ['ore_starlight', '25%']], L('dungeon', 'מבוך')),
      ],
    },
    {
      name: L('Aetherion Floating Sky Citadel', 'מצודת השמיים המרחפת של אתריון'), city: L('Aetherion Royal Capital', 'בירת המלוכה אתריון'), lv: '40-50+',
      desc: L('Marble islands drifting above the clouds, guarded by seraphim constructs and haunted by abyssal reavers.', 'איי שיש מרחפים מעל העננים, מוגנים בבובות שרפים ורדופים בקוצרי תהום.'),
      dungeon: L('The Zenith Sanctum', 'מקדש הזניט'), boss: L('Paragon Aurelion, the Aegis Sovereign', 'הפרגון אורליון, ריבון האגיס'), house: L('Sovereign Sky-Palace Residence', 'ארמון השמיים של הריבון'), price: 25000,
      ores: ['ore_voidsteel', 'ore_dragonbone'], herbs: ['herb_skyorchid'], elite: L('Null Seraph Prime', 'שרף האפס העליון'),
      special: L('Royal Grand Exchange, second Infinite Abyss Gate, floating marble islands', 'הבורסה המלכותית הגדולה, שער תהום נוסף, איי שיש מרחפים'),
      mons: [
        M(L('Seraphim Automaton', 'אוטומט שרפים'), [['automaton_gear', '55%'], ['aether_dust', '30%']]), M(L('Abyssal Reaver', 'קוצר התהום'), [['reaver_claw', '50%'], ['ore_voidsteel', '20%']]),
        M(L('Aether Wisp', 'זוהרון אתר'), [['wisp_lumen', '60%'], ['aether_dust', '30%']]), M(L('Zenith Templar', 'טמפלר הזניט'), [['automaton_gear', '40%'], ['enh_greater', '5%']], L('dungeon', 'מבוך')),
      ],
    },
  ];

  var BOSSES = [
    {
      name: L('Gorrak the Kobold Warchief', 'גוראק, מצביא הקובולדים'), where: L('Sunken Cobalt Tower (Lv 11)', 'מגדל הקובלט השקוע (רמה 11)'),
      phases: [
        L('100% - Axe & Buckler: wide axe cleaves (cone) and a long Buckler Charge (line). Side-step the charge; parry the cleave for a big Break.', '100% - גרזן ומגן: חבטות גרזן רחבות (חרוט) והסתערות מגן ארוכה (קו). זוזו הצידה מההסתערות; הדפו את החבטה לשבירה גדולה.'),
        L('70% - Call to Arms: two Kobold Sentinels join and he starts Leaping Slams onto your position. Clear the sentinels with area skills or a SWITCH.', '70% - קריאה לנשק: שני זקיפי קובולד מצטרפים והוא מתחיל לזנק ולחבוט במיקום שלכם. נקו את הזקיפים בכישורי שטח או ב-SWITCH.'),
        L('40% - The Great Cleaver: he drops the buckler for a huge cleaver: 360-degree Cyclone, 3-hit combos and a Rending Dash. Stay mobile, punish his recovery.', '40% - הקופיץ הגדול: הוא זונח את המגן לטובת קופיץ ענק: ציקלון 360 מעלות, קומבו של 3 מכות וזינוק קורע. הישארו בתנועה והענישו בזמן ההתאוששות.'),
      ],
    },
    {
      name: L('Nerius the Elder Arch-Treant', 'נריוס, העץ-המהלך הקדמון'), where: L('Sanctuary of the Blighted Root (Lv 21)', 'מקדש השורש המורעל (רמה 21)'),
      phases: [
        L('100% - Elder Wrath: Vine Prisons (three circles that root you), a wide Toxic Sweep (poison) and Elder Stomp.', '100% - זעם הקדמון: כלאי גפנים (שלושה עיגולים שמשתקים), טאטוא רעיל רחב (הרעלה) ורקיעת הקדמון.'),
        L('66% - Blight Bloom: Healing Spore Pods sprout and heal him continuously - destroy them first! Root Eruption lines fan toward you.', '66% - פריחת המגפה: תרמילי נבגים מרפאים צצים ומרפאים אותו כל הזמן - השמידו אותם קודם! קווי התפרצות שורשים נשלחים לעברכם.'),
        L('33% - Withering Rage: everything gets 25% faster.', '33% - זעם הקמילה: הכול מהיר ב-25%.'),
      ],
    },
    {
      name: L('Igniscor the Molten Wyrm', 'איגניסקור, הדרקון המותך'), where: L('Heart of the Caldera (Lv 31)', 'לב הלוע (רמה 31)'),
      phases: [
        L('Armored Scales: he takes 70% less damage until his Break Bar is emptied. Fire Breath (cone + Burn), Tail Sweep and Meteor Craters.', 'קשקשים משוריינים: הוא סופג 70% פחות נזק עד שמד השבירה שלו מתרוקן. נשימת אש (חרוט + בעירה), טאטוא זנב ומכתשי מטאורים.'),
        L('60% - Molten Core: his scales re-harden. Expanding Magma Wave rings and a sweeping Lava Lance beam.', '60% - ליבה מותכת: הקשקשים מתקשים שוב. טבעות גלי מאגמה מתרחבות וקרן רומח לבה סורקת.'),
        L('30% - Cataclysm: faster meteors and waves. Save Shield Bash, parries and SWITCH chains to break him again.', '30% - קטקליזמה: מטאורים וגלים מהירים יותר. שמרו הלמות מגן, הדיפות ושרשראות SWITCH כדי לשבור אותו שוב.'),
      ],
    },
    {
      name: L('Valkyria the Glacial Empress', 'ולקיריה, קיסרית הקרח'), where: L('Cathedral of Eternal Frost (Lv 41)', 'קתדרלת הכפור הנצחי (רמה 41)'),
      phases: [
        L('100% - Winter Court: Ice Lance fans, Glacial Spikes and a Freezing Beam that rotates for 2.2 seconds - run with the beam, not against it.', '100% - חצר החורף: מניפות רומחי קרח, קוצי קרחון וקרן הקפאה שמסתובבת 2.2 שניות - רוצו עם הקרן ולא נגדה.'),
        L('65% - Mirror Court: two Mirror Clones appear (one hit kills them) and Blizzard Vortex pulls you in.', '65% - חצר המראות: שני שיבוטי מראה מופיעים (מכה אחת הורגת אותם) ומערבולת סופת שלגים מושכת אתכם פנימה.'),
        L('30% - Absolute Winter: more clones and 25% faster casting.', '30% - חורף מוחלט: עוד שיבוטים והטלה מהירה ב-25%.'),
      ],
    },
    {
      name: L('Paragon Aurelion, the Aegis Sovereign', 'הפרגון אורליון, ריבון האגיס'), where: L('The Zenith Sanctum (Lv 51)', 'מקדש הזניט (רמה 51)'),
      phases: [
        L('Front Guard: his cross-shield blocks 90% of damage from the front. Hit him from the flank or behind, use SWITCH chains (they bypass the guard), or empty his Break Bar.', 'משמר חזיתי: מגן הצלב שלו חוסם 90% מהנזק מלפנים. תקפו מהצד או מאחור, השתמשו בשרשראות SWITCH (הן עוקפות את המשמר), או רוקנו את מד השבירה.'),
        L('66% - Divine Strategy: Holy Cross (two crossing lines centred on you) and Flash Step behind you.', '66% - אסטרטגיה אלוהית: צלב קדוש (שני קווים חוצים שמרכזם בכם) וצעד הבזק אל מאחוריכם.'),
        L('33% - Sovereign Overdrive: Final Judgment (a huge circle around him) and 30% faster combos.', '33% - האצת הריבון: משפט אחרון (עיגול ענק סביבו) וקומבו מהיר ב-30%.'),
      ],
    },
  ];

  var GUILDS = [
    { name: L('Knights of the Ivory Aegis', 'אבירי אגיס השנהב'), hall: L('Crystalia Spire', 'צריח קריסטליה'), perk: L('+4% DEF and +3% max HP', '+4% הגנה ו-+3% חיים מרביים'), motto: L('The shield is the first oath.', 'המגן הוא השבועה הראשונה.') },
    { name: L('Gilded Anvil Syndicate', 'סינדיקט הסדן המוזהב'), hall: L('Pyrehold Bastion', 'מבצר פיירהולד'), perk: L('+3% shop discount, +2% tempering success, +2% forge quality', '3% הנחה בחנויות, +2% הצלחת חישול, +2% איכות זיוף'), motto: L('Every legend was hammered out on an anvil.', 'כל אגדה חושלה על סדן.') },
    { name: L('Crimson Wing Rangers', 'סיירי הכנף הארגמנית'), hall: L('Arcadia', 'ארקדיה'), perk: L('+3% move speed and +3% crit chance', '+3% מהירות תנועה ו-+3% סיכוי קריטי'), motto: L('Swift as the wind, sure as the arrow.', 'מהיר כרוח, בטוח כחץ.') },
    { name: L('Mystic Arcanum', 'הארקנום המיסטי'), hall: L('Sylvanis Haven', 'מפלט סילבניס'), perk: L('+4% MAG and +8% MP regeneration', '+4% קסם ו-+8% התחדשות מאנה'), motto: L('Knowledge is the sharpest edge.', 'ידע הוא הלהב החד ביותר.') },
  ];
  var RANKS = [[L('Recruit', 'מגויס'), 0], [L('Member', 'חבר'), 100], [L('Veteran', 'ותיק'), 300], [L('Officer', 'קצין'), 700], [L('Champion', 'אלוף'), 1500]];

  var COMPANIONS = [
    { name: L('Tobias Reed', 'טוביאס ריד'), title: L('Wandering Lancer', 'רומחאי נודד'), fights: L('Spear', 'חנית'), chain: L('Comet Relay', 'שליחות השביט'), req: L('Level 3', 'רמה 3'), city: L('Arcadia', 'ארקדיה'), bio: L('A cheerful lancer who walked every road of the Emerald Plains. Great first partner: long reach and reliable Break.', 'רומחאי עליז שהלך בכל דרכי מישורי האזמרגד. שותף ראשון מצוין: טווח ארוך ושבירה אמינה.') },
    { name: L('Kael Ashborne', 'קאל אשבורן'), title: L('Ivory Aegis Vanguard', 'חלוץ אגיס השנהב'), fights: L('Sword & Shield', 'חרב ומגן'), chain: L('Bastion Breaker', 'שובר המבצר'), req: L('Level 8, Ivory Aegis Member', 'רמה 8, חבר באגיס השנהב'), city: L('Arcadia', 'ארקדיה'), bio: L('Guards against incoming telegraphs with his shield and taunts enemies off you.', 'שומר בעזרת המגן מפני התקפות מסומנות ומושך אויבים מכם.') },
    { name: L('Lyra Windwhisper', 'לירה וינדוויספר'), title: L('Crimson Wing Scout', 'סיירת הכנף הארגמנית'), fights: L('Longbow', 'קשת ארוכה'), chain: L('Hawkeye Barrage', 'מטח עין הנץ'), req: L('Level 12, Crimson Wing Member', 'רמה 12, חברה בכנף הארגמנית'), city: L('Sylvanis Haven', 'מפלט סילבניס'), bio: L('Keeps her distance and shreds packs with volleys and arrow rain.', 'שומרת מרחק ומפרקת להקות במטחים ובגשם חצים.') },
    { name: L('Seren Vale', 'סרן וייל'), title: L('Arcanum Lightweaver', 'אורגת האור של הארקנום'), fights: L('Arcane Staff', 'מטה ארקני'), chain: L('Prism Cascade', 'מפל המנסרה'), req: L('Level 14, Mystic Arcanum Member', 'רמה 14, חברה בארקנום המיסטי'), city: L('Sylvanis Haven', 'מפלט סילבניס'), bio: L('Casts Sacred Aether Sanctuary when you drop below half HP. The best partner for hard bosses.', 'מטילה את מקדש האתר המקודש כשהחיים שלכם יורדים מתחת לחצי. השותפה הטובה ביותר לבוסים קשים.') },
    { name: L('Brannoc Ironhand', 'ברנוק איירונהנד'), title: L('Gilded Anvil Warsmith', 'נפח המלחמה של הסדן המוזהב'), fights: L('Halberd', 'הלברד'), chain: L('Anvilfall', 'נפילת הסדן'), req: L('Level 22, Gilded Anvil Member', 'רמה 22, חבר בסדן המוזהב'), city: L('Pyrehold Bastion', 'מבצר פיירהולד'), bio: L('Huge sweeping halberd hits with heavy Break - perfect against Igniscor.', 'מכות הלברד רחבות עם שבירה כבדה - מושלם נגד איגניסקור.') },
    { name: L('Mira Duskblade', 'מירה דאסקבלייד'), title: L('Twin-Fang Duelist', 'דו-קרבנית הניב התאום'), fights: L('Dual Blades', 'להבים כפולים'), chain: L('Dusk Requiem', 'רקוויאם הדמדומים'), req: L('Level 30 and a 5,000 G fee', 'רמה 30 ותשלום של 5,000 זהב'), city: L('Crystalia Spire', 'צריח קריסטליה'), bio: L('The highest single-target damage of all companions.', 'הנזק הגבוה ביותר למטרה בודדת מכל בני הלוויה.') },
  ];

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

  // ================================================================ sections
  var state = { q: '', branch: 'all', kind: 'all', base: 'w_sword', tier: 0, grade: 0, temper: 0, mythic: false };

  function sectionHome() {
    return '<h2>' + esc(t(L('Welcome to the Strategy Wiki', 'ברוכים הבאים לוויקי האסטרטגיה'))) + '</h2>' +
      '<p class="lead">' + esc(t(L('Aetheria Chronicles: Sword & Forge - Full-Dive Desktop Edition is a standalone Windows action RPG. Five floating realms, 30 Sword Skills with 90 Rune Morphs, Skill Connect chains, Wall-Slam physics, six elemental reactions, unique weapons, armor sets and a Relic Codex, a party of two plus 6-hero raids, simulated adventurers, mounts, pets, fishing, a living economy and an infinite procedural abyss. This wiki is the only part on the web.', 'כרוניקות אתריה: חרב ונפחייה - מהדורת Full-Dive למחשב הוא משחק תפקידים ופעולה עצמאי ל-Windows. חמש ממלכות מרחפות, 30 כישורי חרב עם 90 מורפים רוניים, שרשראות Skill Connect, פיזיקת הטחה בקיר, שש תגובות יסודיות, נשקים ייחודיים, סטים של שריון וקודקס שרידים, חבורה של שניים ופשיטות של 6 גיבורים, הרפתקנים מדומים, בהמות רכיבה, חיות מחמד, דיג, כלכלה חיה ותהום פרוצדורלית אינסופית. הוויקי הזה הוא החלק היחיד שנמצא ברשת.'))) + '</p>' +
      '<div class="grid">' +
      card(L('Start here', 'התחילו כאן'), L('Learn the controls, Perfect Parry, the Break Bar and SWITCH! combos in Controls & Combat.', 'למדו את השליטה, ההדיפה המושלמת, מד השבירה ושילובי SWITCH! בפרק שליטה וקרב.')) +
      card(L('Plan your build', 'תכננו את המבנה'), L('Browse and filter every Sword Skill and passive in the interactive Skill Tree.', 'עיינו וסננו כל כישור חרב ופסיבי בעץ הכישורים האינטראקטיבי.')) +
      card(L('Forge legends', 'זייפו אגדות'), L('Use the Blueprint Calculator to compare tiers, grades and tempering before you spend materials.', 'השתמשו במחשבון השרטוטים כדי להשוות דרגות, איכות וחישול לפני שתוציאו חומרים.')) +
      card(L('Conquer the realms', 'כבשו את הממלכות'), L('The Realm Atlas and Boss guides explain every city, dungeon, house price and boss phase.', 'אטלס הממלכות ומדריכי הבוסים מסבירים כל עיר, מבוך, מחיר בית ושלב בוס.')) +
      card(L('New in v3.0', 'חדש בגרסה 3.0'), L('Full-Dive combat, the Constellation graph, elemental reactions, uniques and sets, the Relic Codex, 6-hero raids, adventurers, mounts, pets, fishing and world events - each has its own chapter.', 'קרב Full-Dive, גרף הקונסטלציה, תגובות יסודיות, ייחודיים וסטים, קודקס השרידים, פשיטות של 6 גיבורים, הרפתקנים, רכיבה, חיות מחמד, דיג ואירועי עולם - לכל אחד פרק משלו.')) +
      card(L('Play on Windows', 'שחקו ב-Windows'), L('Desktop App explains Launch-Aetheria-Desktop.bat, the desktop shortcut, fullscreen and where your saves live.', 'אפליקציית המחשב מסבירה את Launch-Aetheria-Desktop.bat, קיצור הדרך בשולחן העבודה, מסך מלא והיכן נשמרות השמירות.')) +
      '</div>';
  }

  function card(title, body) { return '<div class="card"><h4>' + esc(t(title)) + '</h4><div>' + esc(t(body)) + '</div></div>'; }

  function sectionCombat() {
    var rows = CONTROLS.map(function (c) { return '<tr><td><kbd>' + esc(t(c[0])) + '</kbd></td><td>' + esc(t(c[1])) + '</td></tr>'; }).join('');
    var tips = [
      L('Basic attacks chain into weapon-specific combos: Longsword 3 hits, Dual Blades 4 fast hits, Spear long thrusts, Halberd wide sweeps, Bow arrows and Staff homing bolts (MAG).', 'התקפות בסיסיות משתלבות לקומבו לפי הנשק: חרב ארוכה 3 מכות, להבים כפולים 4 מכות מהירות, חנית דקירות ארוכות, הלברד טאטואים רחבים, קשת חצים ומטה קליעים מתבייתים (קסם).'),
      L('Every hit freezes its target for 40ms (hit-stop) and knocks it back. White numbers are normal hits, gold with a star are criticals, cyan are shielded or parried, purple are elemental or status damage.', 'כל מכה מקפיאה את המטרה ל-40 אלפיות שנייה ומדיפה אותה. מספרים לבנים הם מכות רגילות, זהב עם כוכב הם קריטיות, ציאן הם נזק שנחסם או נהדף, וסגול הוא נזק יסודי או של מצב.'),
      L('Red ground telegraphs (cones, circles, lines, rings) fill up before every heavy attack. Leave the shape before it fills, or block and parry.', 'סימונים אדומים על הקרקע (חרוטים, עיגולים, קווים וטבעות) מתמלאים לפני כל התקפה כבדה. צאו מהצורה לפני שהיא מתמלאת, או חסמו והדפו.'),
    ];
    return '<h2>' + esc(t(L('Controls & Combat', 'שליטה וקרב'))) + '</h2><div class="table-wrap"><table>' + rows + '</table></div>' +
      '<h3>' + esc(t(L('Combat basics', 'יסודות הקרב'))) + '</h3><ul>' + tips.map(function (x) { return '<li>' + esc(t(x)) + '</li>'; }).join('') + '</ul>' +
      '<h3>' + esc(t(L('Perfect Parry', 'הדיפה מושלמת'))) + '</h3><div class="callout cyan">' + esc(t(L('Press block within 0.25 seconds of an impact (Riposte Instinct adds up to +0.12s). Time freezes for 50ms, you take no damage, release a ring shockwave, restore 30% of your MP and Stamina, and the attacker loses 40 + 35% of its Break Bar. Your next attack within 1.5s is a Counter-Riposte critical. Holding block longer only reduces damage: 75% with a shield, 50% without, and each blocked hit costs Stamina.', 'לחצו על חסימה בתוך 0.25 שניות מהפגיעה (אינסטינקט התגובה מוסיף עד 0.12 שניות). הזמן קופא ל-50 אלפיות שנייה, לא תספגו נזק, ישתחרר גל הדף טבעתי, תקבלו בחזרה 30% מהמאנה והסיבולת, והתוקף מאבד 40 ועוד 35% ממד השבירה. ההתקפה הבאה שלכם בתוך 1.5 שניות היא תגובת-נגד קריטית. חסימה ממושכת רק מפחיתה נזק: 75% עם מגן, 50% בלי, וכל חסימה עולה סיבולת.'))) + '</div>' +
      '<h3>' + esc(t(L('Break Bar & Stagger', 'מד השבירה והלם'))) + '</h3><p>' + esc(t(L('The yellow bar under an enemy\'s health is its Break Bar. Heavy hits, shield bashes, skill finishers and parries drain it. When it empties you see "BREAK!!": bosses and elites are stunned for 4 seconds and every attack against them is a 150% critical.', 'הפס הצהוב מתחת לחיי האויב הוא מד השבירה. מכות כבדות, הלמות מגן, סיומי כישורים והדיפות מרוקנים אותו. כשהוא מתרוקן יופיע "BREAK!!": בוסים ועילית מוכים בהלם ל-4 שניות וכל התקפה נגדם היא קריטית של 150%.'))) + '</p>' +
      '<h3>' + esc(t(L('SWITCH! partner combos', 'שילובי SWITCH! עם השותף'))) + '</h3><p>' + esc(t(L('Hits by you and your companion fill the Switch Gauge. When it is full, press R or Tab: time slows for 0.35s, you backstep out of danger with 1.5s of invulnerability and shed enemy aggro, your companion dashes in with a high-Break Synchronized Chain Skill, and your next Sword Skill within 4 seconds deals +35% damage.', 'מכות שלכם ושל בן הלוויה ממלאות את מד ה-Switch. כשהוא מלא לחצו R או Tab: הזמן מאט ל-0.35 שניות, אתם קופצים לאחור עם חסינות של 1.5 שניות ומאבדים את תשומת לב האויבים, בן הלוויה מסתער עם כישור שרשרת מסונכרן ששובר הגנות, וכישור החרב הבא שלכם בתוך 4 שניות גורם +35% נזק.'))) + '</p>' +
      '<h3>' + esc(t(L('Death & respawn', 'מוות ותחייה'))) + '</h3><p>' + esc(t(L('At 0 HP an Emergency Crystal Teleport returns you to the last city\'s Teleport Gate at full HP and MP. You lose 15% of the XP needed for your current level (never a whole level) and a 5% gold fee. Items and gear are never lost, and the Coliseum carries no penalty at all.', 'ב-0 חיים, שיגור קריסטל חירום מחזיר אתכם לשער השיגור של העיר האחרונה עם חיים ומאנה מלאים. תאבדו 15% מהניסיון הדרוש לרמה הנוכחית (לעולם לא רמה שלמה) ודמי תחייה של 5% מהזהב. פריטים וציוד לעולם אינם אובדים, ובקולוסיאום אין עונש בכלל.'))) + '</p>';
  }

  function skillMatches(s) {
    if (state.branch !== 'all' && s.b !== state.branch) return false;
    if (state.kind === 'active' && s.passive) return false;
    if (state.kind === 'passive' && !s.passive) return false;
    if (!state.q) return true;
    var q = state.q.toLowerCase();
    return [s.name.en, s.name.he, s.desc.en, s.desc.he, BR[s.b].name.en, BR[s.b].name.he].join(' ').toLowerCase().indexOf(q) >= 0;
  }

  function skillList() {
    var all = SKILLS.concat(PASSIVES).filter(skillMatches);
    if (!all.length) return '<p class="dim">' + esc(t(UI.none)) + '</p>';
    return BR_ORDER.map(function (b) {
      var list = all.filter(function (s) { return s.b === b; });
      if (!list.length) return '';
      return '<h3 style="color:' + BR[b].color + '">' + bi(BR[b].name) + '</h3><p class="dim">' + esc(t(UI.req)) + ': ' + esc(t(BR[b].req)) + '</p><div class="grid">' + list.map(function (s) {
        var tag = s.passive ? '<span class="tag passive">' + esc(t(UI.passive)) + '</span>' : s.ult ? '<span class="tag ult">' + esc(t(UI.ult)) + '</span>' : '<span class="tag active">' + esc(t(UI.active)) + '</span>';
        var meta = s.passive ? esc(t(UI.rank)) + ' ' + s.rank + ' • 3 ' + esc(t(UI.levels)) + ' • 1 ' + esc(t(UI.sp))
          : esc(t(UI.rank)) + ' ' + s.rank + ' • ' + s.sp + ' ' + esc(t(UI.sp)) + ' • <span class="num">' + s.mp + '</span> ' + esc(t(UI.mp)) + ' • ' + esc(t(UI.cd)) + ' <span class="num">' + s.cd + '</span>' + esc(t(UI.sec));
        return '<div class="card">' + tag + '<h4>' + bi(s.name) + '</h4><div class="meta">' + meta + '</div><p>' + esc(t(s.desc)) + '</p></div>';
      }).join('') + '</div>';
    }).join('');
  }

  function sectionSkills() {
    var chips = '<button class="chip' + (state.branch === 'all' ? ' on' : '') + '" data-branch="all">' + esc(t(UI.all)) + '</button>' + BR_ORDER.map(function (b) {
      return '<button class="chip' + (state.branch === b ? ' on' : '') + '" data-branch="' + b + '" style="border-color:' + BR[b].color + '">' + esc(t(BR[b].name)) + '</button>';
    }).join('');
    var kinds = ['all', 'active', 'passive'].map(function (k) {
      var label = k === 'all' ? L('All types', 'כל הסוגים') : k === 'active' ? UI.active : UI.passive;
      return '<button class="chip' + (state.kind === k ? ' on' : '') + '" data-kind="' + k + '">' + esc(t(label)) + '</button>';
    }).join('');
    return '<h2>' + esc(t(L('Skill Tree: 6 Branches, 48 Skills', 'עץ הכישורים: 6 ענפים, 48 כישורים'))) + '</h2>' +
      '<p class="lead">' + esc(t(L('There are no classes. Fight with a branch\'s weapons to raise its Mastery Rank (1-50). Every rank and every character level grants a Skill Point. Active skills unlock at Ranks 1, 4, 8, 14 and 22; passives at Ranks 2, 10 and 18 (three levels each). Skill damage grows +1% per Mastery Rank.', 'אין מעמדות. הילחמו עם כלי הנשק של ענף כדי להעלות את דרגת השליטה שלו (1-50). כל דרגה וכל רמת דמות נותנות נקודת כישור. כישורים פעילים נפתחים בדרגות 1, 4, 8, 14 ו-22; פסיביים בדרגות 2, 10 ו-18 (שלוש רמות כל אחד). נזק הכישורים עולה ב-1% לכל דרגת שליטה.'))) + '</p>' +
      '<div class="controls"><input type="search" id="skill-q" placeholder="' + esc(t(UI.search)) + '" value="' + esc(state.q) + '" /></div>' +
      '<div class="controls">' + chips + '</div><div class="controls">' + kinds + '</div><div id="skill-list">' + skillList() + '</div>';
  }

  function sectionAwakenings() {
    return '<h2>' + esc(t(L('Unique Skill Awakenings', 'התעוררויות כישור ייחודיות'))) + '</h2><p class="lead">' + esc(t(L('Unique Skills cannot be bought with SP. When you meet a hidden milestone the system announces "UNIQUE SKILL AWAKENED!" and grants a permanent power.', 'כישורים ייחודיים לא נקנים בנקודות כישור. כשתעמדו באבן דרך נסתרת, המערכת תכריז "UNIQUE SKILL AWAKENED!" ותעניק כוח קבוע.'))) + '</p><div class="grid">' +
      AWAKENINGS.map(function (a) { return '<div class="card"><span class="tag ult">✦</span><h4>' + bi(a.name) + '</h4><p>' + esc(t(a.desc)) + '</p><p class="meta"><b>' + esc(t(L('How to awaken', 'איך מעוררים'))) + ':</b> ' + esc(t(a.how)) + '</p><p class="meta">' + esc(t(a.tip)) + '</p></div>'; }).join('') + '</div>';
  }

  function calcResult() {
    var b = BASES.filter(function (x) { return x.id === state.base; })[0];
    var tier = Number(state.tier);
    var mythic = state.mythic && tier === 6;
    var g = GRADES[Number(state.grade)];
    var rarity = mythic ? 5 : g.rarity;
    var rm = RARITY_MULT[rarity];
    var tm = 1 + 0.07 * Number(state.temper);
    var lines = Object.keys(b.stats).map(function (k) {
      var v = b.stats[k];
      var out;
      if (FRACTION[k]) out = (v * (1 + tier * 0.12) * (v > 0 ? rm * g.mult : 1) * 100).toFixed(1) + '%';
      else out = String(Math.round(Math.round(v * TIERS[tier].power) * (v > 0 ? rm * g.mult * tm : 1)));
      return '<div class="stat-line"><span>' + esc(t(STAT[k])) + '</span><b class="num">' + (v < 0 ? '' : '+') + out + '</b></div>';
    }).join('');
    var gold = Math.round(40 * Math.pow(tier + 1, 1.7) * (mythic ? 4 : 1));
    var mats = '<div class="stat-line"><span>' + esc(t(TIERS[tier].ingot)) + '</span><b class="num">x' + b.ingots + '</b></div><div class="stat-line"><span>' + esc(t(TIERS[tier].mat)) + '</span><b class="num">x' + b.mats + '</b></div>';
    if (mythic) mats += '<div class="stat-line"><span>' + esc(t(I.relic_shard)) + '</span><b class="num">x3</b></div><div class="stat-line"><span>' + esc(t(I.mythic_core)) + '</span><b class="num">x1</b></div>';
    mats += '<div class="stat-line"><span>' + esc(t(UI.gold)) + '</span><b class="num">' + gold.toLocaleString() + '</b></div>';
    var sockets = b.weapon ? Math.max([0, 0, 1, 1, 2, 2][rarity], g.sockets) : 0;
    var next = Number(state.temper) + 1;
    var temperInfo;
    if (next > 10) temperInfo = esc(t(UI.maxed));
    else {
      var greater = next > 5;
      var stones = greater ? 1 + Math.floor((next - 6) / 2) : 1 + Math.floor((next - 1) / 2);
      temperInfo = '+' + next + ': ' + stones + ' × ' + esc(t(greater ? I.enh_greater : I.enh_stone)) + ' • <span class="num">' + (80 * next * (tier + 1)).toLocaleString() + '</span> ' + esc(t(UI.gold)) + ' • ' + esc(t(UI.chance)) + ' <span class="num">' + Math.round(TEMPER_CHANCE[next - 1] * 100) + '%</span>';
    }
    return '<div class="calc-out"><div class="card"><h4>' + esc(t(UI.stats)) + '</h4>' + lines +
      '<div class="stat-line"><span>' + esc(t(UI.rarity)) + '</span><b style="color:' + RARITY_COLOR[rarity] + '">' + esc(t(RARITY[rarity])) + '</b></div>' +
      (b.weapon ? '<div class="stat-line"><span>' + esc(t(UI.sockets)) + '</span><b class="num">' + sockets + '</b></div>' : '') +
      '</div><div class="card"><h4>' + esc(t(UI.cost)) + '</h4>' + mats + '<p class="meta"><b>' + esc(t(UI.nextTemper)) + ':</b> ' + temperInfo + '</p></div></div>';
  }

  function sectionForge() {
    var opt = function (list, cur, label) { return list.map(function (x, i) { var v = x.id !== undefined ? x.id : i; return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(t(label(x))) + '</option>'; }).join(''); };
    return '<h2>' + esc(t(L('Blacksmithing & Blueprint Calculator', 'נפחות ומחשבון שרטוטים'))) + '</h2>' +
      '<p class="lead">' + esc(t(L('Smelt ore into ingots, then forge any of 16 blueprints in 7 material tiers. The Anvil Hammer Gauge decides quality: strike three times as the marker crosses the golden centre. Auto-Forge is instant but rarely beats Fine.', 'התיכו עפרות למטילים ואז זייפו כל אחד מ-16 שרטוטים ב-7 דרגות חומר. מד פטיש הסדן קובע את האיכות: הכו שלוש פעמים כשהסמן חוצה את המרכז הזהוב. זיוף אוטומטי הוא מיידי אבל כמעט אף פעם לא עולה על "משובח".'))) + '</p>' +
      '<div class="calc">' +
      '<label>' + esc(t(UI.base)) + '<select id="c-base">' + opt(BASES, state.base, function (x) { return x.name; }) + '</select></label>' +
      '<label>' + esc(t(UI.tier)) + '<select id="c-tier">' + opt(TIERS, state.tier, function (x) { return x.name; }) + '</select></label>' +
      '<label>' + esc(t(UI.grade)) + '<select id="c-grade">' + opt(GRADES, state.grade, function (x) { return x.name; }) + '</select></label>' +
      '<label>' + esc(t(UI.temper)) + '<select id="c-temper">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<option value="' + n + '"' + (Number(state.temper) === n ? ' selected' : '') + '>+' + n + '</option>'; }).join('') + '</select></label>' +
      '<label><span>' + esc(t(UI.mythic)) + '</span><input type="checkbox" id="c-mythic"' + (state.mythic ? ' checked' : '') + ' /></label>' +
      '</div><div id="calc-out">' + calcResult() + '</div>' +
      '<h3>' + esc(t(L('Grades, tempering and gems', 'דרגות, חישול ואבנים'))) + '</h3><ul>' +
      '<li>' + esc(t(L('Standard 100% (Uncommon), Fine 115% (Rare, 1 socket), Masterwork 130% (Epic, 1 socket), Supreme Masterpiece 150% (Legendary, 2 sockets, custom name and a "Forged by" signature).', 'רגיל 100% (לא שכיח), משובח 115% (נדיר, חריץ אחד), יצירת מופת 130% (אפי, חריץ אחד), יצירת מופת עליונה 150% (אגדי, 2 חריצים, שם מותאם וחתימת "זויף על ידי").'))) + '</li>' +
      '<li>' + esc(t(L('Tempering adds +7% stats per level up to +10. Levels +6 to +10 can fail, but failure only consumes the materials. From +4 the weapon gains orbiting sparks; from +6 a glowing sheen.', 'חישול מוסיף 7% לנתונים בכל רמה עד +10. רמות +6 עד +10 עלולות להיכשל, אבל כישלון רק צורך את החומרים. מ-+4 הנשק מקבל ניצוצות מסתובבים; מ-+6 ברק זוהר.'))) + '</li>' +
      '<li>' + esc(t(L('Gems: Flame (Burn), Frost (Chill), Lightning (Shock arcs), Wind (+6% attack speed, heavier knockback), Void (armor Shred, 3% lifesteal). Each adds +10% elemental damage and tints your aura and slash ribbons.', 'אבנים: להבה (בעירה), כפור (האטה), ברק (קשתות הלם), רוח (+6% מהירות התקפה, הדיפה חזקה), ריק (קריעת שריון, 3% גניבת חיים). כל אחת מוסיפה 10% נזק יסודי וצובעת את ההילה ואת סרטי החיתוך.'))) + '</li>' +
      '<li>' + esc(t(L('Salvage spare gear for ingots, Arcane Dust and enhancement stones; socketed gems are returned.', 'פרקו ציוד מיותר למטילים, אבק ארקני ואבני חישול; אבנים משובצות מוחזרות.'))) + '</li></ul>';
  }

  function itemName(id) { return I[id] ? bi(I[id]) : esc(id); }
  function recipeTable(list, smelt) {
    return '<div class="table-wrap"><table><tr><th>' + esc(t(UI.output)) + '</th><th>' + esc(t(UI.ingredients)) + '</th>' + (smelt ? '' : '<th>' + esc(t(UI.effect)) + '</th>') + '</tr>' + list.map(function (r) {
      return '<tr><td>' + itemName(r.out) + (r.qty > 1 ? ' <span class="num">x' + r.qty + '</span>' : '') + '</td><td>' + r.ins.map(function (x) { return itemName(x[0]) + ' <span class="num">x' + x[1] + '</span>'; }).join('<br>') + '</td>' + (smelt ? '' : '<td>' + esc(t(r.eff)) + '</td>') + '</tr>';
    }).join('') + '</table></div>';
  }

  function sectionMaterials() {
    var ores = REALMS.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '. ' + bi(r.name) + '</td><td>' + r.ores.map(itemName).join('<br>') + '</td><td>' + r.herbs.map(itemName).join('<br>') + '</td></tr>';
    }).join('');
    var drops = REALMS.map(function (r) {
      return r.mons.map(function (m) { return '<tr><td>' + bi(m.name) + (m.note ? ' <span class="dim">(' + esc(t(m.note)) + ')</span>' : '') + '</td><td>' + m.drops.map(function (d) { return itemName(d[0]) + ' <span class="num">' + d[1] + '</span>'; }).join('<br>') + '</td></tr>'; }).join('');
    }).join('');
    return '<h2>' + esc(t(L('Materials, Ores & Drops', 'חומרים, עפרות ושלל'))) + '</h2>' +
      '<p>' + esc(t(L('Press E next to an ore vein (1.1s) or herb (0.6s) to gather 1-2 units. Nodes regrow after 45 seconds.', 'לחצו E ליד עורק עפרה (1.1 שניות) או צמח (0.6 שניות) כדי לאסוף 1-2 יחידות. המקורות צומחים מחדש אחרי 45 שניות.'))) + '</p>' +
      '<h3>' + esc(t(L('Ore & herb locations', 'מיקומי עפרות וצמחים'))) + '</h3><div class="table-wrap"><table><tr><th>' + esc(t(UI.realm)) + '</th><th>' + esc(t(UI.ores)) + '</th><th>' + esc(t(UI.herbs)) + '</th></tr>' + ores + '</table></div>' +
      '<h3>' + esc(t(L('Smelting', 'התכה'))) + '</h3>' + recipeTable(SMELT, true) +
      '<h3>' + esc(t(L('Monster drop table', 'טבלת שלל מפלצות'))) + '</h3><div class="table-wrap"><table><tr><th>' + esc(t(UI.monster)) + '</th><th>' + esc(t(UI.drops)) + '</th></tr>' + drops + '</table></div>' +
      '<div class="callout">' + esc(t(L('Every monster also drops gold. Regular monsters have a 6% gear chance, Named Elites drop 1-2 pieces and a gem 25% of the time, bosses drop 3 pieces and a gem 60% of the time. Abyss floors 10+ drop Abyssal Relic Shards; Boss Rush guardians can drop Mythic Cores.', 'כל מפלצת מפילה גם זהב. למפלצות רגילות יש 6% סיכוי לציוד, עילית בעלת שם מפילה 1-2 פריטים ואבן ב-25% מהמקרים, ובוסים מפילים 3 פריטים ואבן ב-60%. קומות 10 ומעלה בתהום מפילות רסיסי שריד התהום; שומרי מרוץ הבוסים יכולים להפיל ליבות מיתיות.'))) + '</div>';
  }

  function sectionCooking() {
    return '<h2>' + esc(t(L('Alchemy & Cooking', 'אלכימיה ובישול'))) + '</h2>' +
      '<p>' + esc(t(L('Brew at any Apothecary (or a home Alchemy Station) and cook at any General Store (or a home Cooking Hearth). Only one meal buff is active at a time; blade oils last 3 minutes.', 'רקחו בכל בית מרקחת (או בעמדת אלכימיה ביתית) ובשלו בכל חנות כללית (או באח בישול ביתית). רק ארוחה אחת פעילה בכל פעם; שמני להב נמשכים 3 דקות.'))) + '</p>' +
      '<h3>' + esc(t(L('Alchemy', 'אלכימיה'))) + '</h3>' + recipeTable(ALCHEMY, false) +
      '<h3>' + esc(t(L('Cooking', 'בישול'))) + '</h3>' + recipeTable(COOKING, false);
  }

  function sectionAtlas() {
    return '<h2>' + esc(t(L('Realm Atlas', 'אטלס הממלכות'))) + '</h2>' +
      '<p class="lead">' + esc(t(L('In Ascension Chronicle Mode, defeating a realm\'s dungeon boss unseals the Teleport Gate to the next realm. In Unrestricted Open World Mode every realm is open from the start.', 'במצב כרוניקת העלייה, ניצחון על בוס המבוך של ממלכה פותח את שער השיגור לממלכה הבאה. במצב העולם הפתוח ללא הגבלות כל הממלכות פתוחות מההתחלה.'))) + '</p>' +
      REALMS.map(function (r, i) {
        return '<div class="card" style="margin:12px 0"><h4>' + (i + 1) + '. ' + bi(r.name) + ' <span class="dim num">Lv ' + r.lv + '</span></h4><p>' + esc(t(r.desc)) + '</p><div class="table-wrap"><table>' +
          '<tr><th>' + esc(t(UI.city)) + '</th><td>' + bi(r.city) + '<br><span class="dim">' + esc(t(r.special)) + '</span></td></tr>' +
          '<tr><th>' + esc(t(UI.dungeon)) + '</th><td>' + bi(r.dungeon) + '</td></tr><tr><th>' + esc(t(UI.boss)) + '</th><td>' + bi(r.boss) + '</td></tr>' +
          '<tr><th>' + esc(t(UI.elite)) + '</th><td>' + bi(r.elite) + ' <span class="dim">(20:00-05:00)</span></td></tr>' +
          '<tr><th>' + esc(t(UI.house)) + '</th><td>' + bi(r.house) + ' • <span class="num">' + r.price.toLocaleString() + '</span> ' + esc(t(UI.gold)) + '</td></tr>' +
          '<tr><th>' + esc(t(UI.ores)) + '</th><td>' + r.ores.map(itemName).join(', ') + '</td></tr></table></div></div>';
      }).join('');
  }

  function sectionBosses() {
    return '<h2>' + esc(t(L('Boss Phase Guides', 'מדריכי שלבי הבוסים'))) + '</h2>' +
      '<p>' + esc(t(L('Entering a boss room seals its doors until the guardian falls. Every boss has a Break Bar; Shield Bash, Perfect Parries and SWITCH chains are the fastest ways to empty it. Defeating a realm boss for the first time awards a Trophy Statue for your house.', 'כניסה לחדר בוס נועלת את הדלתות עד שהשומר נופל. לכל בוס יש מד שבירה; הלמות מגן, הדיפות מושלמות ושרשראות SWITCH הן הדרכים המהירות לרוקן אותו. ניצחון ראשון על בוס ממלכה מעניק פסל גביע לבית שלכם.'))) + '</p>' +
      BOSSES.map(function (b) {
        return '<div class="card" style="margin:12px 0"><h4>' + bi(b.name) + '</h4><div class="meta">' + esc(t(b.where)) + '</div>' + b.phases.map(function (p) { return '<div class="phase">' + esc(t(p)) + '</div>'; }).join('') + '</div>';
      }).join('');
  }

  function sectionGuilds() {
    var ranks = RANKS.map(function (r) { return esc(t(r[0])) + ' <span class="num">' + r[1] + '</span>'; }).join(' → ');
    return '<h2>' + esc(t(L('Guilds & Companions', 'גילדות ובני לוויה'))) + '</h2>' +
      '<p>' + esc(t(L('Join any of the four guilds at a Guild Hall. The bounty board posts 12 fresh bounties every in-game day (hunts, deliveries, night elites, dungeon clears, abyss surveys and coliseum cups); you can track five at once. Turning them in earns gold, XP and reputation. Perks multiply with your rank in each guild and stack across guilds.', 'הצטרפו לכל אחת מארבע הגילדות באולם גילדה. לוח המשימות מפרסם 12 משימות חדשות בכל יום משחק (ציד, משלוחים, עילית לילה, טיהור מבוכים, סקרי תהום וגביעי קולוסיאום); אפשר לעקוב אחרי חמש בבת אחת. השלמתן מעניקה זהב, ניסיון ומוניטין. ההטבות מוכפלות לפי הדרגה בכל גילדה ומצטברות בין גילדות.'))) + '</p>' +
      '<p class="dim">' + ranks + '</p><div class="grid">' +
      GUILDS.map(function (g) { return '<div class="card"><h4>' + bi(g.name) + '</h4><p><i>"' + esc(t(g.motto)) + '"</i></p><div class="meta">' + esc(t(UI.perk)) + ': ' + esc(t(g.perk)) + '</div><div class="meta">' + esc(t(UI.hall)) + ': ' + esc(t(g.hall)) + '</div></div>'; }).join('') + '</div>' +
      '<h3>' + esc(t(L('Companion profiles', 'פרופילי בני הלוויה'))) + '</h3><p>' + esc(t(L('Companions follow you, fight in real time with their own Sword Skills, dodge telegraphs, wear the gear you give them, and revive 15 seconds after being knocked out.', 'בני הלוויה הולכים אחריכם, נלחמים בזמן אמת עם כישורי החרב שלהם, מתחמקים מסימונים, לובשים את הציוד שתיתנו להם וקמים לתחייה 15 שניות אחרי שהופלו.'))) + '</p><div class="grid">' +
      COMPANIONS.map(function (c) { return '<div class="card"><h4>' + bi(c.name) + '</h4><div class="meta">' + esc(t(c.title)) + '</div><p>' + esc(t(c.bio)) + '</p><div class="meta">' + esc(t(UI.fights)) + ': ' + esc(t(c.fights)) + ' • ' + esc(t(UI.chainSkill)) + ': ' + esc(t(c.chain)) + '</div><div class="meta">' + esc(t(UI.recruit)) + ': ' + esc(t(c.req)) + ' • ' + esc(t(c.city)) + '</div></div>'; }).join('') + '</div>';
  }

  function sectionEconomy() {
    return '<h2>' + esc(t(L('Economy & Housing', 'כלכלה ודיור'))) + '</h2>' +
      '<h3>' + esc(t(L('Supply and demand', 'היצע וביקוש'))) + '</h3><p>' + esc(t(L('Each of the five cities tracks its own price index (70%-155%) for weapons, armor, materials, potions, food, gems and furniture. Selling a category in bulk lowers its index in that city, buying raises it, and prices drift back over time. Every few in-game hours a Trade Boom (135%) or Shortage (145%) hits a city, while another market slumps.', 'כל אחת מחמש הערים עוקבת אחר מדד מחירים משלה (70%-155%) לנשק, שריון, חומרים, שיקויים, מזון, אבנים ורהיטים. מכירה בכמויות מורידה את המדד באותה עיר, קנייה מעלה אותו, והמחירים חוזרים בהדרגה. כל כמה שעות משחק פורצת בעיר פריחת מסחר (135%) או מחסור (145%), בזמן ששוק אחר צונח.'))) + '</p>' +
      '<div class="callout">' + esc(t(L('Arbitrage tip: open the Market Ticker at any Market Exchange, buy where a category shows a down arrow, teleport (free) to the city with a Boom and sell there. Gilded Anvil membership adds a shop discount.', 'טיפ ארביטראז\': פתחו את טיקר השוק בכל בורסה, קנו היכן שקטגוריה מסומנת בחץ למטה, השתגרו (בחינם) לעיר עם פריחה ומכרו שם. חברות בסדן המוזהב מוסיפה הנחה בחנויות.'))) + '</div>' +
      '<h3>' + esc(t(L('Player housing', 'בתים לשחקן'))) + '</h3><div class="table-wrap"><table><tr><th>' + esc(t(UI.house)) + '</th><th>' + esc(t(UI.city)) + '</th><th>' + esc(t(UI.price)) + '</th></tr>' +
      REALMS.map(function (r) { return '<tr><td>' + bi(r.house) + '</td><td>' + esc(t(r.city)) + '</td><td class="num">' + r.price.toLocaleString() + '</td></tr>'; }).join('') + '</table></div>' +
      '<p>' + esc(t(L('Press B inside your house to open the Grid Decorator: left click places, right click picks up. The Storage Vault (100 slots) is shared by every house and every character on this PC (saves\global_vault.json); the Personal Master Anvil gives +10% forging quality; the Royal Bed lets you sleep until 07:00 and wake Well Rested (+20% XP for 30 minutes); Weapon Racks and Armor Mannequins display the exact gear you mount; boss Trophy Statues come from first-time boss kills and coliseum cups.', 'לחצו B בתוך הבית כדי לפתוח את מעצב הרשת: קליק שמאלי מציב, קליק ימני מרים. הכספת (100 משבצות) משותפת לכל הבתים ולכל הדמויות במחשב הזה (saves\global_vault.json); הסדן האישי נותן +10% איכות זיוף; המיטה המלכותית מאפשרת לישון עד 07:00 ולהתעורר רעננים (+20% ניסיון ל-30 דקות); מעמדי נשק ובובות שריון מציגים בדיוק את הציוד שתתלו עליהם; פסלי גביע מגיעים מניצחון ראשון על בוסים ומגביעי הקולוסיאום.'))) + '</p>';
  }

  function sectionEndgame() {
    var cups = [['Bronze Cup', 'גביע הארד', 5, 600], ['Silver Cup', 'גביע הכסף', 12, 1500], ['Gold Cup', 'גביע הזהב', 22, 3500], ['Platinum Cup', 'גביע הפלטינה', 32, 7000], ['Champion Cup', 'גביע האלופים', 42, 14000]];
    return '<h2>' + esc(t(L('Endgame: Infinite Abyss & Coliseum', 'סוף המשחק: התהום האינסופית והקולוסיאום'))) + '</h2>' +
      '<h3>' + esc(t(L('The Infinite Abyss Labyrinth', 'מבוך התהום האינסופי'))) + '</h3><ul>' +
      '<li>' + esc(t(L('Gates in Arcadia and Aetherion. Every floor is freshly generated; monster level is 8 + floor number.', 'שערים בארקדיה ובאתריון. כל קומה נוצרת מחדש; רמת המפלצות היא 8 ועוד מספר הקומה.'))) + '</li>' +
      '<li>' + esc(t(L('Defeat the Floor Warden (a Named Elite) to open the stairs down. Every 5th floor is a Boss Rush of 2-3 realm guardians fought back to back.', 'הביסו את שומר הקומה (עילית בעלת שם) כדי לפתוח את המדרגות למטה. כל קומה חמישית היא מרוץ בוסים של 2-3 שומרי ממלכות ברצף.'))) + '</li>' +
      '<li>' + esc(t(L('Floor modifiers: Molten (hits Burn), Vampiric (monsters heal 15% of damage dealt), Arcane-Shielded (regenerating shields worth 35% HP), Hasted (+35% speed, faster attacks). Floors 15+ have two, floors 40+ three.', 'מאפייני קומה: מותך (מכות מבעירות), ערפדי (מפלצות מחלימות 15% מהנזק), מגן ארקני (מגנים מתחדשים בשווי 35% חיים), מואץ (+35% מהירות והתקפות מהירות). מקומה 15 יש שניים, ומקומה 40 שלושה.'))) + '</li>' +
      '<li>' + esc(t(L('Checkpoints every 10 floors. Your deepest floor is recorded on the local leaderboard.', 'נקודות ביקורת כל 10 קומות. הקומה העמוקה ביותר שלכם נשמרת בטבלת השיאים המקומית.'))) + '</li></ul>' +
      '<h3>' + esc(t(L('Grand Coliseum Arena', 'זירת הקולוסיאום הגדולה'))) + '</h3><p>' + esc(t(L('Five tournament cups of five rounds each (the last round brings an Arena Champion) plus Endless Wave Survival. There is no death penalty in the arena. First wins award a cup trophy for your house.', 'חמישה גביעי טורניר של חמישה סבבים כל אחד (בסבב האחרון מופיע אלוף הזירה) ועוד הישרדות גלים אינסופית. אין עונש מוות בזירה. ניצחון ראשון מעניק גביע לבית שלכם.'))) + '</p>' +
      '<div class="table-wrap"><table><tr><th>' + esc(t(L('Cup', 'גביע'))) + '</th><th>' + esc(t(UI.lv)) + '</th><th>' + esc(t(L('Reward', 'פרס'))) + '</th></tr>' +
      cups.map(function (c) { return '<tr><td>' + esc(lang === 'he' ? c[1] : c[0]) + '</td><td class="num">' + c[2] + '+</td><td class="num">' + c[3].toLocaleString() + ' ' + esc(t(UI.gold)) + '</td></tr>'; }).join('') + '</table></div>';
  }

  // ================================================================ v3.0 Full-Dive Desktop Edition
  function list(items) { return '<ul>' + items.map(function (x) { return '<li>' + esc(t(x)) + '</li>'; }).join('') + '</ul>'; }
  function table(head, rows) {
    return '<div class="table-wrap"><table><tr>' + head.map(function (h) { return '<th>' + esc(t(h)) + '</th>'; }).join('') + '</tr>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + (typeof c === 'object' ? bi(c) : esc(c)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>';
  }
  function h2(o) { return '<h2>' + esc(t(o)) + '</h2>'; }
  function h3(o) { return '<h3>' + esc(t(o)) + '</h3>'; }
  function p(o) { return '<p>' + esc(t(o)) + '</p>'; }
  function callout(o, cls) { return '<div class="callout ' + (cls || 'cyan') + '">' + esc(t(o)) + '</div>'; }

  function sectionDesktop() {
    return h2(L('The Desktop Application', 'אפליקציית המחשב')) +
      p(L('Aetheria Chronicles is a standalone Windows desktop game (Electron). This wiki is the only part that lives on the web - the game itself never opens a browser tab.', 'כרוניקות אתריה הוא משחק מחשב עצמאי ל-Windows (Electron). הוויקי הזה הוא החלק היחיד שנמצא ברשת - המשחק עצמו לעולם לא פותח לשונית דפדפן.')) +
      h3(L('Install & launch', 'התקנה והפעלה')) + list([
        L('Run Launch-Aetheria-Desktop.bat. If release\\win-unpacked\\Aetheria Chronicles.exe does not exist yet, it builds it first (Node.js 20+ required once).', 'הריצו את Launch-Aetheria-Desktop.bat. אם הקובץ release\\win-unpacked\\Aetheria Chronicles.exe עדיין לא קיים, הוא נבנה תחילה (נדרש Node.js 20 ומעלה פעם אחת).'),
        L('Run Create-Desktop-Shortcut.ps1 (right-click > Run with PowerShell) to put an "Aetheria Chronicles" icon on your desktop. Add -StartMenu for a Start Menu entry too.', 'הריצו את Create-Desktop-Shortcut.ps1 (קליק ימני > Run with PowerShell) כדי ליצור סמל "Aetheria Chronicles" על שולחן העבודה. הוסיפו ‎-StartMenu‎ גם לתפריט התחל.'),
        L('Developers: npm run dist:win builds the exe; npm run electron:dev runs with hot reload; the exe accepts --selftest for an automated 60 FPS smoke test.', 'מפתחים: ‏npm run dist:win בונה את קובץ ההפעלה; ‏npm run electron:dev מריץ עם טעינה חמה; קובץ ההפעלה מקבל ‎--selftest‎ לבדיקת עשן אוטומטית של 60 FPS.'),
      ]) +
      h3(L('Window, display & saves', 'חלון, תצוגה ושמירות')) + list([
        L('Custom dark window frame. F11 or Alt+Enter toggles fullscreen; Settings > Display offers 1280x720, 1600x900, 1920x1080 and 2560x1440 window sizes and supersampled render quality (up to 2x on top of your display scaling).', 'מסגרת חלון כהה מותאמת. ‏F11 או Alt+Enter עוברים למסך מלא; הגדרות > תצוגה מציעות גדלי חלון 1280x720, 1600x900, 1920x1080 ו-2560x1440 ואיכות רינדור עם דגימת-על (עד פי 2 מעל קנה המידה של המסך).'),
        L('Saves are plain JSON files next to the exe in .\\saves: slot_1.json - slot_3.json, global_vault.json (the 100-slot vault shared by every character), settings.json and leaderboard.json. Deleted slots move to saves\\deleted instead of vanishing.', 'השמירות הן קובצי JSON רגילים ליד קובץ ההפעלה בתיקייה ‎.\\saves‎: ‏slot_1.json עד slot_3.json, ‏global_vault.json (הכספת בת 100 המקומות המשותפת לכל הדמויות), ‏settings.json ו-leaderboard.json. משבצות שנמחקות עוברות ל-saves\\deleted במקום להיעלם.'),
        L('Title screen and pause menu: Open Saves Folder (opens it in Explorer), Open Strategy Wiki (opens this site in your default browser; an offline copy ships with the game) and Quit to Desktop.', 'מסך הפתיחה ותפריט ההשהיה: פתיחת תיקיית השמירות (נפתחת בסייר הקבצים), פתיחת ויקי האסטרטגיה (האתר הזה נפתח בדפדפן ברירת המחדל; עותק לא-מקוון מצורף למשחק) ויציאה לשולחן העבודה.'),
      ]);
  }

  function sectionFullDive() {
    return h2(L('Full-Dive Combat', 'קרב Full-Dive')) +
      h3(L('Input buffering & cancels', 'אגירת קלט וביטולים')) + list([
        L('Every combat input (attack, skills 1-6, Q, Space, right-click parry, R) is remembered for 160ms and fires the instant it becomes legal - mash early and nothing is lost.', 'כל קלט קרב (התקפה, כישורים 1-6, ‏Q, רווח, הדיפה בקליק ימני, R) נשמר 160 אלפיות שנייה ומופעל ברגע שהוא חוקי - לחיצה מוקדמת לא הולכת לאיבוד.'),
        L('Basic attack recovery (after the hit lands) can be cancelled into any Sword Skill (SKILL CONNECT!, +15%), a Dodge or a Perfect Parry.', 'את זמן ההתאוששות של התקפה בסיסית (אחרי שהמכה פוגעת) אפשר לבטל לכל כישור חרב (‏SKILL CONNECT!, ‏+15%), להתחמקות או להדיפה מושלמת.'),
        L('A Sword Skill\'s 0.12s Pre-Motion and its recovery frames can be cancelled into a Dodge, a Perfect Parry or SWITCH!.', 'את 0.12 שניות ההכנה של כישור חרב ואת זמן ההתאוששות שלו אפשר לבטל להתחמקות, להדיפה מושלמת או ל-SWITCH!.'),
      ]) +
      h3(L('Kinetic stepping & Wall-Slam physics', 'צעדים קינטיים ופיזיקת הטחה בקיר')) + list([
        L('Melee swings carry you forward with a 110-260 px/s micro-lunge (0.84 friction per frame) toward the cursor, stopping just short of the enemy so you never pass through it.', 'הנפות קרב מקרוב מזיזות אתכם קדימה בזינוק קטן של 110-260 פיקסלים לשנייה (חיכוך 0.84 לפריים) לעבר הסמן, ונעצרות ממש לפני האויב כך שלעולם לא עוברים דרכו.'),
        L('Heavy finishers, shield bashes, spear sweeps, Charge Slams, OVERLOAD and SWITCH! chains hurl enemies. Hit a wall fast enough and you get WALL SLAM!: +45% of the hit as impact damage, a 1.5s stun and 30% of the Break Bar shattered.', 'מכות סיום כבדות, הלמות מגן, טאטואי חנית, הסתערות רכובה, ‏OVERLOAD ושרשראות SWITCH! מעיפים אויבים. אם הם נחבטים בקיר מהר מספיק מתקבל WALL SLAM!: ‏+45% מהמכה כנזק פגיעה, הלם של 1.5 שניות וניפוץ 30% ממד השבירה.'),
        L('Battlefield props: Explosive Alchemical Barrels (fire blast that burns enemies and chain-detonates other barrels), Frost Crystal Clusters (freeze everything nearby for 2.5s), Crates and Urns (coins, potions, ores, rare treasure maps). Aether Jump Pads launch you onto plateaus.', 'אביזרי שדה קרב: חביות אלכימיות נפיצות (פיצוץ אש ששורף אויבים ומפוצץ חביות אחרות), אשכולות קריסטלי כפור (מקפיאים את כל הסביבה ל-2.5 שניות), ארגזים וכדים (מטבעות, שיקויים, עפרות ומפות אוצר נדירות). משטחי קפיצה של אתר משגרים אתכם אל הרמות.'),
        L('Forgiving hitboxes: your attack arcs are 15% wider than the ribbons you see, your hurtbox is 20% tighter than your body, and any hit worth 12%+ of your max HP grants 0.35s of grace invulnerability.', 'תיבות פגיעה סלחניות: קשתות ההתקפה שלכם רחבות ב-15% מהסרטים שאתם רואים, אזור הפגיעה שלכם צר ב-20% מהגוף, וכל מכה ששווה 12% או יותר מהחיים המרביים מעניקה 0.35 שניות של חסינות חסד.'),
      ]) +
      h3(L('Skill Connect & the Finishing Nova', 'Skill Connect ונובת הסיום')) +
      callout(L('When a Sword Skill\'s final strike lands, a 0.30s cyan star-ring flashes. Casting a different skill inside it cancels the recovery, costs 30% less MP and adds +25% damage per chain step. The fourth skill in a chain detonates a FINISHING NOVA (320% critical burst, Aether gauge, huge Break).', 'כשהמכה האחרונה של כישור חרב פוגעת, טבעת כוכב בצבע ציאן מהבהבת ל-0.30 שניות. הפעלת כישור אחר בתוכה מבטלת את ההתאוששות, עולה 30% פחות מאנה ומוסיפה ‎+25%‎ נזק לכל שלב בשרשרת. הכישור הרביעי בשרשרת מפוצץ נובת סיום (FINISHING NOVA: פיצוץ קריטי של 320%, מד אתר ושבירה עצומה).')) +
      h3(L('Perfect Parry & Counter-Riposte', 'הדיפה מושלמת ותגובת-נגד')) +
      callout(L('Block within 0.25s of an impact: 100% negation, a 50ms time-freeze, a ring shockwave that shoves nearby foes, 30% of your MP and Stamina restored and a massive Break chunk. Your next attack within 1.5s becomes a Counter-Riposte: a guaranteed 240% critical.', 'חסימה בתוך 0.25 שניות מהפגיעה: ביטול מוחלט של הנזק, הקפאת זמן של 50 אלפיות שנייה, גל הלם טבעתי שהודף אויבים קרובים, החזרת 30% מהמאנה והסיבולת ונתח ענק ממד השבירה. ההתקפה הבאה בתוך 1.5 שניות הופכת לתגובת-נגד: פגיעה קריטית מובטחת של 240%.'), 'gold') +
      h3(L('Style meter: D to SSS', 'מד הסטייל: מ-D עד SSS')) +
      p(L('Hits, crits, connects, parries, wall slams, reactions and kills raise your style rank (D, C, B, A, S, SS, SSS: FULL-DIVE OVERDRIVE!). Getting hit drops it; standing still lets it decay. Each rank adds attack speed (up to +25%), move speed (up to +15%) and Magic Find (up to +40%).', 'מכות, קריטיות, חיבורי כישורים, הדיפות, הטחות בקיר, תגובות והריגות מעלים את דרגת הסטייל (D, ‏C, ‏B, ‏A, ‏S, ‏SS, ‏SSS: FULL-DIVE OVERDRIVE!). ספיגת מכה מורידה אותה; עמידה במקום גורמת לה לדעוך. כל דרגה מוסיפה מהירות התקפה (עד ‎+25%‎), מהירות תנועה (עד ‎+15%‎) ומציאת קסם (עד ‎+40%‎).'));
  }

  var KEYSTONES_W = [
    [L('Blade Ascendant', 'עליית הלהב'), BR.sword.name, L('Sword combo finishers launch a piercing crescent wave (80%). +15% crit damage.', 'מכות סיום של קומבו חרב משגרות גל סהר חודר (80%). ‎+15%‎ נזק קריטי.')],
    [L('Thousand Cuts', 'אלף חתכים'), BR.dual.name, L('Every 10th hit within 3s triggers a free whirlwind flurry. +8% attack speed.', 'כל מכה עשירית בתוך 3 שניות מפעילה מערבולת חתכים חינם. ‎+8%‎ מהירות התקפה.')],
    [L('Unbreakable Bastion', 'המבצר הבלתי שביר'), BR.shield.name, L('Perfect Parry window +0.08s and blocking costs half Stamina. +15% DEF.', 'חלון ההדיפה המושלמת ‎+0.08‎ שניות וחסימה עולה חצי סיבולת. ‎+15%‎ הגנה.')],
    [L("Dragoon's Momentum", 'תנופת הדרגון'), BR.spear.name, L('Wall Slams trigger at lower speed and deal +90% impact damage. +3 Break.', 'הטחות בקיר מופעלות במהירות נמוכה יותר וגורמות ‎+90%‎ נזק פגיעה. ‎+3‎ שבירה.')],
    [L('Deadeye Focus', 'מיקוד הצלף'), BR.bow.name, L('Your first hit on a full-HP enemy is always a critical. +8% crit chance.', 'המכה הראשונה שלכם באויב עם חיים מלאים תמיד קריטית. ‎+8%‎ סיכוי קריטי.')],
    [L('Arcane Overflow', 'הצפה ארקנית'), BR.magic.name, L('Sword Skills cost 15% less MP. +40% MP regeneration and +8% skill damage.', 'כישורי חרב עולים 15% פחות מאנה. ‎+40%‎ התחדשות מאנה ו-‎+8%‎ נזק כישורים.')],
  ];
  var BRIDGES_W = [
    [L("Duelist's Accord", 'ברית הדו-קרב'), L('Sword + Dual', 'חרב + כפולים'), L('+6% attack speed, +4% crit', '‎+6%‎ מהירות התקפה, ‎+4%‎ קריטי')],
    [L('Wind Walker', 'הולך הרוח'), L('Dual + Bow', 'כפולים + קשת'), L('+6% move speed, +12% crit damage', '‎+6%‎ מהירות תנועה, ‎+12%‎ נזק קריטי')],
    [L('Arcane Archer', 'קשת ארקני'), L('Bow + Magic', 'קשת + קסם'), L('+8% ATK, +8% MAG', '‎+8%‎ התקפה, ‎+8%‎ קסם')],
    [L('Runeguard', 'שומר הרונות'), L('Magic + Shield', 'קסם + מגן'), L('+10% DEF, +30 MP, +20% MP regen', '‎+10%‎ הגנה, ‎+30‎ מאנה, ‎+20%‎ התחדשות מאנה')],
    [L('Phalanx Doctrine', 'תורת הפלנקס'), L('Shield + Spear', 'מגן + חנית'), L('+8% DEF, +4 Break', '‎+8%‎ הגנה, ‎+4‎ שבירה')],
    [L("Lancer's Edge", 'להב הרומח'), L('Spear + Sword', 'חנית + חרב'), L('+8% ATK, +6% skill damage', '‎+8%‎ התקפה, ‎+6%‎ נזק כישורים')],
  ];

  function sectionConstellation() {
    return h2(L('Constellation Skill Graph (K)', 'גרף הכישורים הכוכבי (K)')) +
      p(L('Press K for a pan-and-zoom star map: six sector constellations (one per branch) holding 30 active Sword Skills, 18 passives, 6 Keystones and 6 cross-branch Hybrid Bridges.', 'לחצו K למפת כוכבים עם הזזה וזום: שש קונסטלציות (אחת לכל ענף) עם 30 כישורי חרב פעילים, 18 פסיביים, 6 אבני-מפתח ו-6 גשרים היברידיים בין ענפים.')) +
      h3(L('Skill ranks 1-5', 'דרגות כישור 1-5')) +
      p(L('Every learned Sword Skill can be ranked up to 5. Each rank adds +12% damage and -5% cooldown. Rank r to r+1 costs r+1 SP and needs branch Mastery equal to the skill\'s unlock rank + 3r.', 'כל כישור חרב שנלמד ניתן לשדרג עד דרגה 5. כל דרגה מוסיפה ‎+12%‎ נזק ו-‎-5%‎ זמן המתנה. מעבר מדרגה r ל-r+1 עולה r+1 נקודות כישור ודורש שליטה בענף השווה לדרגת הפתיחה של הכישור ועוד 3r.')) +
      h3(L('Rune Morphs (unlock at skill rank 3, pick one of three)', 'מורפים רוניים (נפתחים בדרגה 3, בחרו אחד משלושה)')) +
      table([L('Rune', 'רונה'), L('Effect', 'אפקט')], [
        [L('Execution / Power', 'הוצאה להורג / עוצמה'), L('x1.35 damage, +15% area, +50% damage to enemies below 30% HP. Example: "Gale Lunge: Executioner".', 'פי 1.35 נזק, ‎+15%‎ שטח, ‎+50%‎ נזק לאויבים מתחת ל-30% חיים. לדוגמה: "Gale Lunge: Executioner".')],
        [L('Shadow-Clone / Mobility', 'שיבוט צל / ניידות'), L('A violet shadow clone repeats every hit 0.25s later for 40%, plus an evasive hop after the skill. Example: "Twin Cyclone: Phantom Echo".', 'שיבוט צל סגול חוזר על כל מכה כעבור 0.25 שניות ב-40%, ועוד קפיצת התחמקות אחרי הכישור. לדוגמה: "Twin Cyclone: Phantom Echo".')],
        [L('Elemental Conversion / Leech', 'המרה יסודית / יניקה'), L('Converts the skill to the branch element (Sword: Frost, Dual: Venom, Shield: Shock, Spear: Burn, Bow: Bleed, Magic: Aether), paints its reaction gauge and heals 8% of damage dealt.', 'ממיר את הכישור ליסוד הענף (חרב: כפור, כפולים: ארס, מגן: הלם חשמלי, חנית: בעירה, קשת: דימום, קסם: אתר), צובע את מד התגובה שלו ומרפא 8% מהנזק.')],
      ]) + p(L('30 skills x 3 runes = 90 named variations, each with its own geometry, colour and effect.', '30 כישורים × 3 רונות = 90 וריאציות עם שם, כל אחת עם צורה, צבע ואפקט משלה.')) +
      h3(L('Keystones (branch Mastery 15, 3 SP)', 'אבני-מפתח (שליטה 15 בענף, 3 נקודות)')) +
      table([L('Keystone', 'אבן-מפתח'), L('Branch', 'ענף'), L('Effect', 'אפקט')], KEYSTONES_W) +
      h3(L('Hybrid Bridges (Mastery 10 in both branches, 2 SP)', 'גשרים היברידיים (שליטה 10 בשני הענפים, 2 נקודות)')) +
      table([L('Bridge', 'גשר'), L('Branches', 'ענפים'), L('Bonus', 'בונוס')], BRIDGES_W);
  }

  function sectionReactions() {
    return h2(L('Elemental Reactions', 'תגובות יסודיות')) +
      p(L('Elemental hits paint a reaction gauge (a coloured diamond above the enemy) for 4.5s. Painting a second gauge detonates a reaction and consumes both. Gauges come from skill elements, gems, blade oils, Elemental Runes, pets, set and unique powers - and melee criticals cause Bleed.', 'מכות יסודיות צובעות מד תגובה (יהלום צבעוני מעל האויב) ל-4.5 שניות. צביעת מד שני מפוצצת תגובה וצורכת את שניהם. מדים מגיעים מיסודות הכישורים, אבני חן, שמני להב, רונות יסודיות, חיות מחמד, כוחות סטים וייחודיים - ופגיעות קריטיות מקרוב גורמות לדימום.')) +
      table([L('Gauge', 'מד'), L('Source elements', 'יסודות מקור')], [
        [L('Burn', 'בעירה'), L('Fire', 'אש')], [L('Frost', 'כפור'), L('Frost', 'כפור')], [L('Shock', 'הלם חשמלי'), L('Lightning', 'ברק')],
        [L('Bleed', 'דימום'), L('Wind, melee criticals', 'רוח, פגיעות קריטיות מקרוב')], [L('Venom', 'ארס'), L('Poison', 'רעל')], [L('Aether', 'אתר'), L('Void, Holy', 'ריק, קדושה')],
      ]) +
      table([L('Reaction', 'תגובה'), L('Recipe', 'מתכון'), L('Effect', 'אפקט')], [
        ['MELT', L('Burn + Frost', 'בעירה + כפור'), L('The hit detonates for a 2.2x elemental burst.', 'המכה מתפוצצת לפרץ יסודי של פי 2.2.')],
        ['SHATTER', L('Frost + Bleed', 'כפור + דימום'), L('Ice shrapnel hits everything nearby and shatters 35% of the Break Bar.', 'רסיסי קרח פוגעים בכל הסביבה ומנפצים 35% ממד השבירה.')],
        ['OVERLOAD', L('Burn + Shock', 'בעירה + הלם'), L('A plasma blast deals area damage and hurls enemies outward (Wall-Slam fuel!).', 'פיצוץ פלזמה גורם נזק אזורי ומעיף אויבים החוצה (דלק להטחה בקיר!).')],
        ['SUPERCONDUCT', L('Frost + Shock', 'כפור + הלם'), L('Armor collapses: -40% DEF for 8 seconds.', 'השריון קורס: ‎-40%‎ הגנה ל-8 שניות.')],
        ['TEMPEST SPREAD', L('Venom + any', 'ארס + כל מד'), L('Every status and gauge on the target spreads to enemies within 150 units.', 'כל מצב ומד על המטרה מתפשטים לאויבים ברדיוס 150.')],
        ['AETHER SINGULARITY', L('Aether + any', 'אתר + כל מד'), L('A gravity vortex drags enemies together and crushes them for 2.4s.', 'מערבולת כבידה גוררת אויבים יחד ומועכת אותם למשך 2.4 שניות.')],
      ]);
  }

  var UNIQUES_W = [
    [L('Nightfall Sovereign', 'ריבון רדת הלילה'), L('Longsword', 'חרב ארוכה'), L('Every 3rd Skill Connect summons a Shadow Doppelganger that repeats your skill for 60% damage.', 'כל Skill Connect שלישי מזמן כפיל צל שחוזר על הכישור ב-60% נזק.')],
    [L('Rimecrest Blade', 'להב פסגת הכפור'), L('Longsword', 'חרב ארוכה'), L('Critical hits unleash a piercing Frost Nova (60%, Frost gauge). SHATTER +50%.', 'פגיעות קריטיות משחררות נובת כפור חודרת (60%, מד כפור). ‏SHATTER ‏‎+50%‎.')],
    [L('Dawnspark Edge', 'להב ניצוץ השחר'), L('Twin Edge', 'להב תאום'), L('Attack speed also shortens Sword Skill cooldowns; dodging leaves a damaging lance of light.', 'מהירות התקפה מקצרת גם את זמני ההמתנה; התחמקות משאירה רומח אור פוגע.')],
    [L('Verdict of the Ivory Aegis', 'פסק דין אגיס השנהב'), L('Shield', 'מגן'), L('Perfect Parries fire a Divine Judgment beam (250%) and grant a 25% max HP barrier.', 'הדיפות מושלמות יורות קרן משפט אלוהי (250%) ומעניקות מחסום של 25% מהחיים.')],
    [L('Astral Dragonbone Spear', 'חנית עצם הדרקון האסטרלית'), L('Spear', 'חנית'), L('Wall Slams and Breaks call down a draconic meteor (200% fire); thrusts reach 30% further.', 'הטחות בקיר ושבירות מורידות מטאור דרקוני (200% אש); דקירות מגיעות רחוק ב-30%.')],
    [L('Phoenix Longbow', 'קשת עוף החול'), L('Longbow', 'קשת ארוכה'), L('Arrows ignite; burning enemies explode in phoenix fire; once per 120s lethal damage revives you at 40% HP.', 'החצים מציתים; אויבים בוערים מתפוצצים באש עוף החול; פעם ב-120 שניות נזק קטלני מחייה אתכם ב-40% חיים.')],
    [L('Aetherion Arch-Staff', 'מטה הקשת של אתריון'), L('Arcane Staff', 'מטה ארקני'), L('Spells arc to 2 extra enemies for 40%; every 5th spell is free.', 'לחשים מקפצים לשני אויבים נוספים ב-40%; כל לחש חמישי בחינם.')],
  ];
  var SETS_W = [
    [L('Nightfall Duelist', 'דו-קרבן רדת הלילה'), L('+6% aspd, +4% crit', '‎+6%‎ מהירות, ‎+4%‎ קריטי'), L('+25% crit dmg, +10% skill dmg', '‎+25%‎ נזק קריטי, ‎+10%‎ נזק כישורים'), L('Skill Connect costs no MP, +10% per chain step', 'Skill Connect בלי מאנה, ‎+10%‎ לכל שלב')],
    [L('Ivory Aegis Paladin', 'פלדין אגיס השנהב'), L('+10% DEF, +5% block', '‎+10%‎ הגנה, ‎+5%‎ חסימה'), L('+12% HP, +20% MP regen', '‎+12%‎ חיים, ‎+20%‎ התחדשות מאנה'), L('Blocking heals 2%; Perfect Parry heals 10%', 'חסימה מרפאת 2%; הדיפה מושלמת מרפאת 10%')],
    [L('Sylvan Windrunner', 'רץ הרוח היערי'), L('+6% move, +3% crit', '‎+6%‎ תנועה, ‎+3%‎ קריטי'), L('+12% ATK, +6% aspd', '‎+12%‎ התקפה, ‎+6%‎ מהירות'), L('Dodging fires 3 homing wind arrows', 'התחמקות יורה 3 חיצי רוח מתבייתים')],
    [L('Pyrehold Dragonlord', 'אדון הדרקונים של פיירהולד'), L('+8% ATK, +3 Break', '‎+8%‎ התקפה, ‎+3‎ שבירה'), L('+10% HP, +20% crit dmg', '‎+10%‎ חיים, ‎+20%‎ נזק קריטי'), L('Every hit applies Burn; MELT and OVERLOAD +60%', 'כל מכה מוסיפה בעירה; ‏MELT ו-OVERLOAD ‏‎+60%‎')],
    [L('Frostspire Valkyrie', 'ולקירית צריח הכפור'), L('+5% crit', '‎+5%‎ קריטי'), L('+30% crit dmg, +4% move', '‎+30%‎ נזק קריטי, ‎+4%‎ תנועה'), L('Crits apply Frost; SHATTER +80%', 'קריטיות מוסיפות כפור; ‏SHATTER ‏‎+80%‎')],
    [L('Aetherial Archmage', 'הארכימאג האתרי'), L('+10% MAG, +30 MP', '‎+10%‎ קסם, ‎+30‎ מאנה'), L('+40% MP regen, +12% skill dmg', '‎+40%‎ התחדשות מאנה, ‎+12%‎ נזק כישורים'), L('Skills cost 30% less MP and apply Aether', 'כישורים עולים 30% פחות מאנה ומוסיפים אתר')],
    [L('Gilded Anvil Artisan', 'אומן הסדן המוזהב'), L('+4 Break, +6 DEF', '‎+4‎ שבירה, ‎+6‎ הגנה'), L('+8% ATK, +8% DEF', '‎+8%‎ התקפה, ‎+8%‎ הגנה'), L('+15% tempering, +25% gathering, +20% Break', '‎+15%‎ חישול, ‎+25%‎ איסוף, ‎+20%‎ שבירה')],
    [L('Abyssal Sovereign', 'ריבון התהום'), L('+8% HP, +2% lifesteal', '‎+8%‎ חיים, ‎+2%‎ גניבת חיים'), L('+10% ATK, +10% MAG', '‎+10%‎ התקפה, ‎+10%‎ קסם'), L('Below 50% HP: +30% damage, 6% lifesteal', 'מתחת ל-50% חיים: ‎+30%‎ נזק, 6% גניבת חיים')],
  ];
  var POWERS_W = [
    [L('Sanguine Edge', 'להב הדם'), L('Weapon', 'נשק'), L('Heal 5% of all damage dealt', 'ריפוי 5% מכל הנזק')],
    [L('Stormcaller', 'קורא הסערה'), L('Weapon', 'נשק'), L('Crits call lightning (60%, Shock)', 'קריטיות מזמנות ברק (60%, הלם)')],
    [L('Echo Strike', 'מכת הד'), L('Weapon', 'נשק'), L('15% chance basic attacks strike twice', '15% סיכוי שהתקפה בסיסית תכה פעמיים')],
    [L("Executioner's Verdict", 'פסק התליין'), L('Weapon', 'נשק'), L('+40% damage below 30% enemy HP', '‎+40%‎ נזק לאויב מתחת ל-30% חיים')],
    [L('Arcane Surge', 'נחשול ארקני'), L('Weapon', 'נשק'), L('Skill hits restore 2 MP', 'פגיעות כישור מחזירות 2 מאנה')],
    [L('Thornmail', 'שריון קוצים'), L('Armor', 'שריון'), L('Reflect 20% of melee damage', 'החזרת 20% מנזק קרוב')],
    [L('Bulwark Sigil', 'חותם המעוז'), L('Armor', 'שריון'), L('+8% block, +15% DEF', '‎+8%‎ חסימה, ‎+15%‎ הגנה')],
    [L('Second Wind', 'רוח שנייה'), L('Armor', 'שריון'), L('Below 30% HP heal 25% (90s)', 'מתחת ל-30% חיים ריפוי 25% (90 שנ\')')],
    [L('Featherstep', 'צעד נוצה'), L('Armor', 'שריון'), L('Cheaper dodges, +30% speed burst', 'התחמקויות זולות, פרץ מהירות ‎+30%‎')],
    [L('Midas Touch', 'מגע מידאס'), L('Utility', 'תועלת'), L('+30% gold', '‎+30%‎ זהב')],
    [L("Scholar's Insight", 'תובנת המלומד'), L('Utility', 'תועלת'), L('+15% XP', '‎+15%‎ ניסיון')],
    [L('Pathfinder', 'מוצא הדרך'), L('Utility', 'תועלת'), L('+10% move speed', '‎+10%‎ מהירות תנועה')],
    [L("Fortune's Favor", 'חסד המזל'), L('Utility', 'תועלת'), L('+25% Magic Find', '‎+25%‎ מציאת קסם')],
    [L('Showstopper', 'עוצר ההצגה'), L('Utility', 'תועלת'), L('Style decays 40% slower, never below C in combat', 'הסטייל דועך לאט ב-40%, לעולם לא מתחת ל-C בקרב')],
  ];

  function sectionGear() {
    return h2(L('Uniques, Sets & the Relic Codex', 'ייחודיים, סטים וקודקס השרידים')) +
      h3(L('Affixes & the Arcane Enchanter', 'תכונות והמכשף הארקני')) +
      p(L('Uncommon gear rolls 1 affix, Rare 2, Epic 3, Legendary 3 plus a golden power, Mythic 4 plus a golden power (ATK/MAG/DEF/HP flat or %, crit, crit damage, attack and move speed, Break, MP regen, lifesteal, skill damage, cooldown reduction, Magic Find, XP). The Arcane Enchanter tab at any Master Forge rerolls one affix for gold and Arcane Dust.', 'ציוד לא-שכיח מקבל תכונה אחת, נדיר 2, אפי 3, אגדי 3 ועוד כוח זהוב, מיתי 4 ועוד כוח זהוב (התקפה/קסם/הגנה/חיים קבועים או באחוזים, קריטי, נזק קריטי, מהירות התקפה ותנועה, שבירה, התחדשות מאנה, גניבת חיים, נזק כישורים, קיצור זמני המתנה, מציאת קסם וניסיון). לשונית המכשף הארקני בכל נפחייה ראשית מגרילה מחדש תכונה אחת תמורת זהב ואבקה ארקנית.')) +
      h3(L('Unique weapons (golden modifiers)', 'נשקים ייחודיים (משנים זהובים)')) +
      table([L('Unique', 'ייחודי'), L('Type', 'סוג'), L('Golden power', 'כוח זהוב')], UNIQUES_W) +
      p(L('Uniques drop from realm bosses (10%), Abyss bosses past floor 15 (18%), roaming raid bosses (45%), treasure chests and the Black Market.', 'ייחודיים נופלים מבוסי ממלכות (10%), בוסי תהום אחרי קומה 15 (18%), בוסי פשיטה נודדים (45%), תיבות אוצר והשוק השחור.')) +
      h3(L('Armor sets (2 / 4 / 6 pieces)', 'סטים של שריון (2 / 4 / 6 חלקים)')) +
      table([L('Set', 'סט'), '2', '4', '6'], SETS_W) +
      p(L('Set pieces are Epic or better drops (30% of Epic+ from elites and bosses). A two-handed set weapon counts as two pieces.', 'חלקי סט הם שלל אפי ומעלה (30% מהאפי ומעלה של עילית ובוסים). נשק סט דו-ידני נחשב לשני חלקים.')) +
      h3(L('Aether Relic Codex', 'קודקס שרידי האתר')) +
      p(L('At a Master Forge (Relic Codex tab) extract the golden power of a Legendary / Mythic item or a unique (the item is consumed; costs gold and 2 Arcane Dust). Equip up to three relic powers - one weapon, one armor, one utility - on top of whatever gear you wear. Press U to review your Codex anywhere.', 'בנפחייה ראשית (לשונית קודקס השרידים) חלצו את הכוח הזהוב של פריט אגדי / מיתי או ייחודי (הפריט נצרך; עולה זהב ו-2 אבקה ארקנית). ציידו עד שלושה כוחות שרידים - נשק, שריון ותועלת - מעל כל ציוד שאתם לובשים. לחצו U לצפייה בקודקס מכל מקום.')) +
      table([L('Legendary power', 'כוח אגדי'), L('Slot', 'משבצת'), L('Effect', 'אפקט')], POWERS_W) +
      h3(L('Loot quality of life', 'נוחות שלל')) + list([
        L('Loot beams by rarity plus harmonic drop chords that grow richer from Rare to Mythic.', 'קרני שלל לפי נדירות ואקורדי נפילה הרמוניים שמתעשרים מנדיר ועד מיתי.'),
        L('Side-by-side comparison tooltips: the equipped piece next to the hovered one with every stat difference.', 'חלוניות השוואה זו לצד זו: הפריט המצויד ליד הפריט המסומן עם כל הפרשי הנתונים.'),
        L('Smart Auto-Salvage (Character > Inventory): Common and Uncommon drops become ingots and Arcane Dust automatically.', 'פירוק אוטומטי חכם (דמות > מלאי): שלל שכיח ולא-שכיח הופך אוטומטית למטילים ואבקה ארקנית.'),
        L('Cosmetic Wardrobe (T): every look you have ever owned is saved; transmog any slot and recolor armor with 16 dyes (150 G each). Stats never change.', 'ארון בגדים קוסמטי (T): כל מראה שהיה לכם אי פעם נשמר; החליפו מראה לכל משבצת וצבעו שריון ב-16 צבעים (150 זהב כל אחד). הנתונים לעולם לא משתנים.'),
      ]);
  }

  function sectionLiving() {
    return h2(L('Party, Raids & Adventurers', 'חבורה, פשיטות והרפתקנים')) +
      h3(L('Party of two & the Tactical Gambit Bar', 'חבורה של שניים וסרגל הגמביטים הטקטיים')) + list([
        L('Recruit companions at their Guild Hall and summon up to two at once (Character > Companions).', 'גייסו בני לוויה באולם הגילדה שלהם וזמנו עד שניים בבת אחת (דמות > בני לוויה).'),
        L('F1 Assault (free targeting, aggressive skills), F2 Guard & Peel (stay close, hit whatever attacks you), F3 Focus My Target (attack your last target), F4 Support & Heal (keep distance, heals and barriers first).', 'F1 הסתערות (בחירת מטרות חופשית, כישורים תוקפניים), F2 שמירה וחילוץ (הישארות קרובה ותקיפת מי שתוקף אתכם), F3 התמקדות במטרה שלי (תקיפת המטרה האחרונה שלכם), F4 תמיכה וריפוי (שמירת מרחק, ריפוי ומחסומים קודם).'),
        L('Affinity grows with every shared kill: Acquaintance, Comrade, Trusted Ally, Sworn Partner, Soulbound (+3% companion stats per rank).', 'הזיקה גדלה עם כל הריגה משותפת: מכר, עמית, בן ברית נאמן, שותף מושבע, קשורי-נשמה (‎+3%‎ לנתוני בן הלוויה בכל דרגה).'),
        L('With two companions, SWITCH! (R) becomes a TRIPLE SWITCH!: both partners chain their Synchronized Chain Skills back to back.', 'עם שני בני לוויה, SWITCH! ‏(R) הופך ל-TRIPLE SWITCH!: שני השותפים משרשרים את כישורי השרשרת המסונכרנים שלהם בזה אחר זה.'),
      ]) +
      h3(L('Assault Team Raid Briefing & 6-hero raids', 'תדריך צוות התקיפה ופשיטות של 6 גיבורים')) +
      p(L('Before a realm boss, or when you approach a roaming raid boss, the Raid Briefing lets you deploy three Ivory Aegis Vanguard knights (Sir Aldric Vane, Dame Liora Ashcroft, Captain Hesper Kell). You, two companions and the Vanguard make a six-hero Assault Team that shares aggro.', 'לפני בוס ממלכה, או כשמתקרבים לבוס פשיטה נודד, תדריך הפשיטה מאפשר להציב שלושה אבירי חלוץ של אגיס השנהב (סר אלדריק וייין, הגברת ליורה אשקרופט, קפטן הספר קל). אתם, שני בני לוויה והחלוץ יוצרים צוות תקיפה של שישה גיבורים שחולקים את תשומת לב האויב.')) +
      table([L('Roaming raid boss', 'בוס פשיטה נודד'), L('Style', 'סגנון')], [
        [L('Colossus of the Sundered Gate', 'ענק השער המבותק'), L('Gate-stone titan: earthquake slams, boulder rain, quake rings, a charging dash. Appears at night in the wilds.', 'טיטאן מאבני שער: חבטות רעידת אדמה, גשם סלעים, טבעות רעש וזינוק הסתערות. מופיע בלילה בשטחי הבר.')],
        [L('The Hollow Reaper', 'הקוצר החלול'), L('Skeletal harvester: wide scythe sweeps, triple reaping lines, shadow-phase blinks, gravity vortexes.', 'קוצר שלדי: טאטואי מגל רחבים, שלושה קווי קציר, השתגרויות צל ומערבולות כבידה.')],
      ]) +
      h3(L('Simulated adventurers', 'הרפתקנים מדומים')) + list([
        L('Named AI Divers roam cities and the wilds: they wander, gather, chat and fight monsters with real weapons and skills.', 'צוללים ממוחשבים עם שמות מסתובבים בערים ובשטחי הבר: משוטטים, אוספים, משוחחים ונלחמים במפלצות עם נשקים וכישורים אמיתיים.'),
        L('An orange "!" means they are under attack: defeat their attackers while staying close for a reward chest and guild reputation.', '"!" כתום פירושו שהם מותקפים: הביסו את התוקפים כשאתם בקרבת מקום וקבלו תיבת פרס ומוניטין בגילדה.'),
        L('Talk to them (E) to buy a rare material, swap materials, or start a friendly 1v1 duel: a 3-2-1 countdown, and the first to fall below 10% HP yields. Nobody dies in a duel.', 'דברו איתם (E) כדי לקנות חומר נדיר, להחליף חומרים או לפתוח דו-קרב ידידותי 1 על 1: ספירה לאחור 3-2-1, והראשון שיורד מתחת ל-10% חיים נכנע. אף אחד לא מת בדו-קרב.'),
      ]);
  }

  var MOUNTS_W = [
    [L('Dun Courser', 'סוס הדהור החום'), '8', '1,800'], [L('Frostfang Wolf', 'זאב ניב הכפור'), '18', '4,200'], [L('Starlight Stag', 'אייל אור הכוכבים'), '28', '7,500'],
    [L('Ember Drake', 'דרייק הגחלים'), '38', '12,000'], [L('Aether Gryphon', 'גריפון האתר'), '48', '20,000'],
  ];
  var PETS_W = [
    [L('Ember Sprite', 'פיית הגחלים'), L('Burn', 'בעירה'), '600'], [L('Frost Wisp', 'רוח הכפור'), L('Frost', 'כפור'), '900'], [L('Spark Kit', 'גור הניצוצות'), L('Shock', 'הלם'), '1,500'],
    [L('Gale Finch', 'פרוש הסערה'), L('Bleed', 'דימום'), '2,400'], [L('Bloom Sprout', 'נבט הפריחה'), L('Venom', 'ארס'), '3,600'], [L('Void Moth', 'עש הריק'), L('Aether', 'אתר'), '6,000'],
  ];

  function sectionWorld3() {
    return h2(L('Mounts, Pets, Fishing & World Events', 'רכיבה, חיות מחמד, דיג ואירועי עולם')) +
      h3(L('Mounts (V)', 'רכיבה (V)')) +
      p(L('Buy mounts at the Stable & Pet Sanctuary in any city (or press P anywhere to choose). Press V to ride in cities and the wilds: +65% move speed. Attacking while mounted performs a Mounted Charge Slam - a gallop that ends in a 190% knockback shockwave - and dismounts you. Heavy hits knock you off.', 'קנו בהמות רכיבה באורווה ובמקדש חיות המחמד בכל עיר (או לחצו P בכל מקום כדי לבחור). לחצו V כדי לרכוב בערים ובשטחי הבר: ‎+65%‎ מהירות תנועה. תקיפה בזמן רכיבה מבצעת הסתערות רכובה - דהירה שמסתיימת בגל הדף של 190% - ומורידה אתכם מהבהמה. מכות כבדות מפילות אתכם.')) +
      table([L('Mount', 'בהמה'), L('Level', 'רמה'), L('Gold', 'זהב')], MOUNTS_W) +
      h3(L('Combat pets', 'חיות מחמד לוחמות')) +
      p(L('Pets float beside you, vacuum up loot crystals from far away and fire a support bolt every 2.2s that paints their element\'s reaction gauge - perfect for setting up MELT or SINGULARITY.', 'חיות המחמד מרחפות לצדכם, שואבות גבישי שלל ממרחק רב ויורות בכל 2.2 שניות קליע תמיכה שצובע את מד התגובה של היסוד שלהן - מושלם להכנת MELT או SINGULARITY.')) +
      table([L('Pet', 'חיית מחמד'), L('Gauge', 'מד'), L('Gold', 'זהב')], PETS_W) +
      h3(L('Tension-bar fishing', 'דיג עם מד מתח')) +
      p(L('Every wild map has fishing spots (bobbing red floats on the shore). Press E, then hold Space or the mouse button to lift the green catch zone and keep the fish inside it until the bar fills. Each realm has its own catch, up to the Legendary Ancient Root-Eel and the Mythic Starwhale Calf. Fish cook into the Angler\'s Platter (+12% Magic Find).', 'בכל מפת בר יש נקודות דיג (מצופים אדומים על החוף). לחצו E ואז החזיקו רווח או את כפתור העכבר כדי להרים את אזור התפיסה הירוק ולהשאיר את הדג בתוכו עד שהמד מתמלא. לכל ממלכה שלל משלה, עד צלופח השורש העתיק האגדי וגור לוויתן הכוכבים המיתי. הדגים מתבשלים למגש הדייג (‎+12%‎ מציאת קסם).')) +
      h3(L('Terrain', 'פני השטח')) +
      p(L('Wild maps now have two-tier plateaus with oblique rock faces, carved stone stairs and Aether Jump Pads, rivers with wooden bridges and walkable shallows, swaying grass that bends around you, footprints in snow and ripples in water, sun and moon shadows that follow the clock, drifting cloud shadows and god-rays in forests and ruins.', 'במפות הבר יש עכשיו רמות דו-מפלסיות עם צוקי סלע אלכסוניים, מדרגות אבן חצובות ומשטחי קפיצה של אתר, נהרות עם גשרי עץ ומים רדודים שאפשר ללכת בהם, דשא מתנועע שמתכופף סביבכם, עקבות בשלג ואדוות במים, צללי שמש וירח שעוקבים אחרי השעון, צללי עננים נודדים וקרני אור ביערות ובחורבות.')) +
      h3(L('Treasure maps, events & the Black Market', 'מפות אוצר, אירועים והשוק השחור')) + list([
        L('Ancient Treasure Maps drop from elites, bosses, crates and events. Use one to mark a gold X on a wild map; stand on it and press E to dig up a chest (12% unique, 45% set piece).', 'מפות אוצר עתיקות נופלות מעילית, בוסים, ארגזים ואירועים. השתמשו באחת כדי לסמן X זהוב במפת בר; עמדו עליו ולחצו E כדי לחפור תיבה (12% ייחודי, 45% חלק סט).'),
        L('Corrupted Gate Outbreak: a purple gate spews waves of monsters until you destroy it. Reward chest with a treasure map.', 'התפרצות שער מושחת: שער סגול פולט גלי מפלצות עד שתהרסו אותו. תיבת פרס עם מפת אוצר.'),
        L('Caravan Escort: a merchant wagon only moves while you stay close; ambushes target it. Bring it home to unlock the hooded Black-Market Vendor in every city, who sells uniques, set pieces, relic shards, Mythic Cores and treasure maps (stock rotates daily).', 'ליווי שיירה: עגלת סוחרים זזה רק כשאתם בקרבתה; מארבים מכוונים אליה. הביאו אותה ליעדה כדי לפתוח את סוחר השוק השחור בברדס בכל עיר, שמוכר ייחודיים, חלקי סט, רסיסי שרידים, ליבות מיתיות ומפות אוצר (המלאי מתחלף מדי יום).'),
      ]);
  }

  function sectionJournal() {
    var groups = [
      [L('Combat', 'קרב'), L('First Blood, Monster Hunter, Thousand-Slayer, Steel Reflexes, Iron Wall, Counter-Riposte, Skill Connect!, Finishing Nova, Combo Architect, Wall Slam!, Wallbreaker, Elemental Novice, Elementalist, Full-Dive Overdrive, Collateral Damage, Cavalry Charge', 'דם ראשון, צייד מפלצות, קוטל האלף, רפלקסי פלדה, חומת ברזל, תגובת-נגד, Skill Connect!, נובת סיום, אדריכל הקומבו, הטחה בקיר!, שובר הקירות, טירון היסודות, אמן היסודות, Full-Dive Overdrive, נזק נלווה, הסתערות פרשים')],
      [L('Legends', 'אגדות'), L('Tower Breaker, Root Cutter, Wyrmslayer, Winter Ends, Paragon\'s Bane, Gatebreaker, Reaper Reaped, Into the Abyss, Abyss Walker, Bottomless, Grand Champion, Aetheria Legend', 'שובר המגדל, קוצץ השורש, קוטל התולעת, סוף החורף, מכת הפרגון, שובר השער, הקוצר נקצר, אל התהום, הולך התהום, ללא תחתית, האלוף הגדול, אגדת אתריה')],
      [L('Crafting & items', 'יצירה ופריטים'), L('Apprentice Smith, Masterwork, Master Smith, Living Legend, Touched by Myth, Full Regalia, Relic Scholar, Codex Keeper, Kitchen & Cauldron', 'נפח מתלמד, יצירת מופת, נפח אמן, אגדה חיה, נגיעת המיתוס, מלכות מלאה, מלומד השרידים, שומר הקודקס, מטבח וקדרה')],
      [L('Party & world', 'חבורה ועולם'), L('Full Party, Soulbound, Triple SWITCH!, Assault Team, Good Samaritan, Duelist, Barterer, Saddle Up, Stablemaster, Best Friend, First Catch, Angler, The One That Did Not Get Away, X Marks the Spot, Gatekeeper, Escort Duty, Homeowner, Seasoned Diver, Naturalist', 'חבורה מלאה, קשורי-נשמה, Triple SWITCH!, צוות תקיפה, השומרוני הטוב, דו-קרבן, סוחר חליפין, לעלות לאוכף, אדון האורווה, חבר הכי טוב, דג ראשון, דייג, זה שלא ברח, X מסמן את המקום, שומר השער, משמר שיירה, בעל בית, צולל ותיק, חוקר הטבע')],
    ];
    return h2(L('Journal, Titles & Bestiary', 'יומן, תארים ובסטיאריום')) +
      p(L('Press N for the Journal: 56 achievements in five categories. Many grant titles (Fledgling Diver, Thousand-Slayer, the Iron Wall, Chain Virtuoso, Wallbreaker, the Elementalist, Full-Diver, Wyrmslayer, Paragon\'s Bane, Gatebreaker, Reaper-Bane, Abyss Walker, the Bottomless, Grand Champion, Master Smith, the Regal, the Soulbound, the Duelist, Stablemaster, the Angler, the Naturalist, Legend of Aetheria) that float above your head.', 'לחצו N ליומן: 56 הישגים בחמש קטגוריות. רבים מעניקים תארים (Fledgling Diver, ‏Thousand-Slayer, ‏the Iron Wall, ‏Chain Virtuoso, ‏Wallbreaker, ‏the Elementalist, ‏Full-Diver, ‏Wyrmslayer, ‏Paragon\'s Bane, ‏Gatebreaker, ‏Reaper-Bane, ‏Abyss Walker, ‏the Bottomless, ‏Grand Champion, ‏Master Smith, ‏the Regal, ‏the Soulbound, ‏the Duelist, ‏Stablemaster, ‏the Angler, ‏the Naturalist, ‏Legend of Aetheria) שמרחפים מעל ראשכם.')) +
      table([L('Category', 'קטגוריה'), L('Achievements', 'הישגים')], groups) +
      h3(L('Bestiary (O)', 'בסטיאריום (O)')) +
      p(L('Every creature you defeat is recorded with a live, rotating 3D-oblique model, its attacks, element, weaknesses, drops and your kill count.', 'כל יצור שאתם מביסים נרשם עם מודל חי ומסתובב במבט אלכסוני תלת-ממדי, ההתקפות שלו, היסוד, החולשות, השלל ומספר ההריגות שלכם.'));
  }

  var SECTIONS = [
    { id: 'home', title: L('Home', 'דף הבית'), render: sectionHome },
    { id: 'desktop', title: L('Desktop App', 'אפליקציית המחשב'), render: sectionDesktop },
    { id: 'combat', title: L('Controls & Combat', 'שליטה וקרב'), render: sectionCombat },
    { id: 'fulldive', title: L('Full-Dive Combat', 'קרב Full-Dive'), render: sectionFullDive },
    { id: 'skills', title: L('Skill Tree', 'עץ הכישורים'), render: sectionSkills },
    { id: 'constellation', title: L('Constellation & Morphs', 'קונסטלציה ומורפים'), render: sectionConstellation },
    { id: 'reactions', title: L('Elemental Reactions', 'תגובות יסודיות'), render: sectionReactions },
    { id: 'gear', title: L('Uniques, Sets & Codex', 'ייחודיים, סטים וקודקס'), render: sectionGear },
    { id: 'awakenings', title: L('Unique Awakenings', 'התעוררויות ייחודיות'), render: sectionAwakenings },
    { id: 'forge', title: L('Blacksmithing', 'נפחות'), render: sectionForge },
    { id: 'materials', title: L('Materials & Drops', 'חומרים ושלל'), render: sectionMaterials },
    { id: 'cooking', title: L('Alchemy & Cooking', 'אלכימיה ובישול'), render: sectionCooking },
    { id: 'atlas', title: L('Realm Atlas', 'אטלס הממלכות'), render: sectionAtlas },
    { id: 'bosses', title: L('Boss Guides', 'מדריכי בוסים'), render: sectionBosses },
    { id: 'guilds', title: L('Guilds & Companions', 'גילדות ובני לוויה'), render: sectionGuilds },
    { id: 'living', title: L('Party, Raids & Adventurers', 'חבורה, פשיטות והרפתקנים'), render: sectionLiving },
    { id: 'world', title: L('Mounts, Pets & Events', 'רכיבה, חיות ואירועים'), render: sectionWorld3 },
    { id: 'journal', title: L('Journal & Bestiary', 'יומן ובסטיאריום'), render: sectionJournal },
    { id: 'economy', title: L('Economy & Housing', 'כלכלה ודיור'), render: sectionEconomy },
    { id: 'endgame', title: L('Abyss & Coliseum', 'התהום והקולוסיאום'), render: sectionEndgame },
  ];

  // ================================================================ rendering
  function $(id) { return document.getElementById(id); }

  function render() {
    var root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.title = t(L('Aetheria Strategy Wiki', 'ויקי האסטרטגיה של אתריה'));
    $('brand-title').textContent = t(UI.title);
    $('brand-sub').textContent = t(UI.sub);
    $('foot').textContent = t(UI.foot);
    $('lang-en').className = 'lang-btn' + (lang === 'en' ? ' on' : '');
    $('lang-he').className = 'lang-btn' + (lang === 'he' ? ' on' : '');
    $('nav').innerHTML = SECTIONS.map(function (s) { return '<a href="#' + s.id + '" data-id="' + s.id + '">' + esc(t(s.title)) + '</a>'; }).join('');
    $('content').innerHTML = SECTIONS.map(function (s) { return '<section class="page" id="' + s.id + '">' + s.render() + '</section>'; }).join('');
    bind();
  }

  function rerenderSkills() {
    var el = $('skill-list');
    if (el) el.innerHTML = skillList();
    var chips = document.querySelectorAll('[data-branch]');
    for (var i = 0; i < chips.length; i++) chips[i].className = 'chip' + (chips[i].getAttribute('data-branch') === state.branch ? ' on' : '');
    var kinds = document.querySelectorAll('[data-kind]');
    for (var j = 0; j < kinds.length; j++) kinds[j].className = 'chip' + (kinds[j].getAttribute('data-kind') === state.kind ? ' on' : '');
  }

  function bind() {
    var q = $('skill-q');
    if (q) q.addEventListener('input', function () { state.q = q.value; rerenderSkills(); });
    var chips = document.querySelectorAll('[data-branch]');
    for (var i = 0; i < chips.length; i++) chips[i].addEventListener('click', function (e) { state.branch = e.currentTarget.getAttribute('data-branch'); rerenderSkills(); });
    var kinds = document.querySelectorAll('[data-kind]');
    for (var k = 0; k < kinds.length; k++) kinds[k].addEventListener('click', function (e) { state.kind = e.currentTarget.getAttribute('data-kind'); rerenderSkills(); });
    var ids = ['c-base', 'c-tier', 'c-grade', 'c-temper'];
    var keys = ['base', 'tier', 'grade', 'temper'];
    ids.forEach(function (id, n) {
      var el = $(id);
      if (el) el.addEventListener('change', function () { state[keys[n]] = el.value; $('calc-out').innerHTML = calcResult(); });
    });
    var my = $('c-mythic');
    if (my) my.addEventListener('change', function () { state.mythic = my.checked; $('calc-out').innerHTML = calcResult(); });
    var links = document.querySelectorAll('#nav a');
    var onScroll = function () {
      var best = SECTIONS[0].id;
      for (var s = 0; s < SECTIONS.length; s++) {
        var sec = $(SECTIONS[s].id);
        if (sec && sec.getBoundingClientRect().top < 140) best = SECTIONS[s].id;
      }
      for (var l = 0; l < links.length; l++) links[l].className = links[l].getAttribute('data-id') === best ? 'on' : '';
    };
    window.onscroll = onScroll;
    onScroll();
  }

  function setLang(l) {
    lang = l;
    try { localStorage.setItem('aetheria.wiki.lang', l); } catch (e) { /* storage unavailable */ }
    var hash = window.location.hash;
    render();
    if (hash && $(hash.slice(1))) $(hash.slice(1)).scrollIntoView();
  }

  document.getElementById('lang-en').addEventListener('click', function () { setLang('en'); });
  document.getElementById('lang-he').addEventListener('click', function () { setLang('he'); });
  render();
  if (window.location.hash && $(window.location.hash.slice(1))) $(window.location.hash.slice(1)).scrollIntoView();
})();
