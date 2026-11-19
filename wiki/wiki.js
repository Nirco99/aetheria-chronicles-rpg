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
    ['R / Tab', L('SWITCH! with your companion', 'SWITCH! עם בן הלוויה')],
    ['E / F', L('Interact, talk, gather, enter', 'אינטראקציה, דיבור, איסוף, כניסה')],
    ['Z X C', L('Quick-use consumables', 'שימוש מהיר בשיקויים ומזון')],
    ['I / K / M / H', L('Character, Mastery, Realm Atlas, Handbook', 'דמות, שליטה, אטלס, ספר ההדרכה')],
    ['B', L('Grid decorator inside your house', 'מעצב הרשת בתוך הבית')],
    ['Esc', L('Pause / close window', 'השהיה / סגירת חלון')],
    ['F5 / F11', L('Quick save / fullscreen (desktop)', 'שמירה מהירה / מסך מלא (גרסת מחשב)')],
  ];

  // ================================================================ sections
  var state = { q: '', branch: 'all', kind: 'all', base: 'w_sword', tier: 0, grade: 0, temper: 0, mythic: false };

  function sectionHome() {
    return '<h2>' + esc(t(L('Welcome to the Strategy Wiki', 'ברוכים הבאים לוויקי האסטרטגיה'))) + '</h2>' +
      '<p class="lead">' + esc(t(L('Aetheria Chronicles: Sword & Forge is a real-time top-down action RPG. Five floating realms, 48 skills across six classless mastery branches, deep blacksmithing, player housing, four guilds, six AI companions, a living economy and an infinite procedural abyss.', 'כרוניקות אתריה: חרב ונפחייה הוא משחק תפקידים ופעולה בזמן אמת במבט עילי. חמש ממלכות מרחפות, 48 כישורים בשישה ענפי שליטה ללא מעמדות, נפחות עמוקה, בתים לשחקן, ארבע גילדות, שישה בני לוויה ממוחשבים, כלכלה חיה ותהום פרוצדורלית אינסופית.'))) + '</p>' +
      '<div class="grid">' +
      card(L('Start here', 'התחילו כאן'), L('Learn the controls, Perfect Parry, the Break Bar and SWITCH! combos in Controls & Combat.', 'למדו את השליטה, ההדיפה המושלמת, מד השבירה ושילובי SWITCH! בפרק שליטה וקרב.')) +
      card(L('Plan your build', 'תכננו את המבנה'), L('Browse and filter every Sword Skill and passive in the interactive Skill Tree.', 'עיינו וסננו כל כישור חרב ופסיבי בעץ הכישורים האינטראקטיבי.')) +
      card(L('Forge legends', 'זייפו אגדות'), L('Use the Blueprint Calculator to compare tiers, grades and tempering before you spend materials.', 'השתמשו במחשבון השרטוטים כדי להשוות דרגות, איכות וחישול לפני שתוציאו חומרים.')) +
      card(L('Conquer the realms', 'כבשו את הממלכות'), L('The Realm Atlas and Boss guides explain every city, dungeon, house price and boss phase.', 'אטלס הממלכות ומדריכי הבוסים מסבירים כל עיר, מבוך, מחיר בית ושלב בוס.')) +
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
      '<h3>' + esc(t(L('Perfect Parry', 'הדיפה מושלמת'))) + '</h3><div class="callout cyan">' + esc(t(L('Press block within 0.25 seconds of an impact (Riposte Instinct adds up to +0.12s). You take no damage, release a shockwave, restore 25 MP and 25 Stamina, your basic attack resets, and the attacker takes 60 Break damage. Holding block longer only reduces damage: 75% with a shield, 50% without, and each blocked hit costs Stamina.', 'לחצו על חסימה בתוך 0.25 שניות מהפגיעה (אינסטינקט התגובה מוסיף עד 0.12 שניות). לא תספגו נזק, ישתחרר גל הדף, תקבלו 25 מאנה ו-25 סיבולת, ההתקפה הבסיסית מתאפסת והתוקף סופג 60 נזק שבירה. חסימה ממושכת רק מפחיתה נזק: 75% עם מגן, 50% בלי, וכל חסימה עולה סיבולת.'))) + '</div>' +
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
      '<p>' + esc(t(L('Press B inside your house to open the Grid Decorator: left click places, right click picks up. The Storage Vault (100 slots) is shared by every house; the Personal Master Anvil gives +10% forging quality; the Royal Bed lets you sleep until 07:00 and wake Well Rested (+20% XP for 30 minutes); Weapon Racks and Armor Mannequins display the exact gear you mount; boss Trophy Statues come from first-time boss kills and coliseum cups.', 'לחצו B בתוך הבית כדי לפתוח את מעצב הרשת: קליק שמאלי מציב, קליק ימני מרים. הכספת (100 משבצות) משותפת לכל הבתים; הסדן האישי נותן +10% איכות זיוף; המיטה המלכותית מאפשרת לישון עד 07:00 ולהתעורר רעננים (+20% ניסיון ל-30 דקות); מעמדי נשק ובובות שריון מציגים בדיוק את הציוד שתתלו עליהם; פסלי גביע מגיעים מניצחון ראשון על בוסים ומגביעי הקולוסיאום.'))) + '</p>';
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

  var SECTIONS = [
    { id: 'home', title: L('Home', 'דף הבית'), render: sectionHome },
    { id: 'combat', title: L('Controls & Combat', 'שליטה וקרב'), render: sectionCombat },
    { id: 'skills', title: L('Skill Tree', 'עץ הכישורים'), render: sectionSkills },
    { id: 'awakenings', title: L('Unique Awakenings', 'התעוררויות ייחודיות'), render: sectionAwakenings },
    { id: 'forge', title: L('Blacksmithing', 'נפחות'), render: sectionForge },
    { id: 'materials', title: L('Materials & Drops', 'חומרים ושלל'), render: sectionMaterials },
    { id: 'cooking', title: L('Alchemy & Cooking', 'אלכימיה ובישול'), render: sectionCooking },
    { id: 'atlas', title: L('Realm Atlas', 'אטלס הממלכות'), render: sectionAtlas },
    { id: 'bosses', title: L('Boss Guides', 'מדריכי בוסים'), render: sectionBosses },
    { id: 'guilds', title: L('Guilds & Companions', 'גילדות ובני לוויה'), render: sectionGuilds },
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
