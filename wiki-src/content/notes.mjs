// Tactical notes (English + Hebrew) for every creature, unique weapon and equipment set.
// scripts/build-wiki-data.mjs fails if any creature, unique or set is missing its note.
const L = (en, he) => ({ en, he });

export default {
  // ---------------------------------------------------------------- realm 1
  dire_wolf: L('Packs open with a long Lunge - sidestep it and punish the recovery. Fire skills finish them fast.', 'להקות פותחות בזינוק ארוך - זוזו הצידה והענישו את ההתאוששות. כישורי אש מסיימים אותן מהר.'),
  frenzy_boar: L('The Charge has a long red line telegraph: the best Perfect Parry practice in the game.', 'להסתערות יש סימון קו אדום ארוך: האימון הטוב ביותר להדיפה מושלמת במשחק.'),
  kobold_scout: L('Keeps its distance and slings rocks. Close the gap with Gale Lunge or Comet Thrust.', 'שומר מרחק ומטיל אבנים בקלע. סגרו את הפער עם זינוק הסערה או דקירת השביט.'),
  kobold_trooper: L('Its thrust out-ranges swords; parry it, then combo. Reliable Iron Ore source.', 'הדקירה שלו ארוכה מטווח החרב; הדפו אותה ואז קומבו. מקור אמין לעפרת ברזל.'),
  kobold_sentinel: L('Slow and armored with a wide halberd sweep - dodge through it toward its back.', 'איטי ומשוריין עם טאטוא הלברד רחב - התחמקו דרכו אל הגב שלו.'),
  elite_thornback: L('Night only. Night Howl can stun at 60% - stay out of its circle; the Rending Lunge is parryable.', 'רק בלילה. יללת הלילה מהממת ב-60% - הישארו מחוץ למעגל שלה; את הזינוק הקורע אפשר להדוף.'),
  b_kobold: L('Phase 2 summons Kobold Sentinels; phase 3 swaps to the Great Cleaver with a spin and a dash. Lightning hurts him most.', 'בשלב 2 הוא מזמן זקיפים; בשלב 3 הוא מחליף לקופיץ הגדול עם סיבוב ומהלך. ברק פוגע בו הכי הרבה.'),
  // ---------------------------------------------------------------- realm 2
  treant_guardian: L('Root Slam roots you for 1.2 s - leave its circle. Weak to fire, resists poison and frost.', 'הלמות השורשים כובלת ל-1.2 שניות - צאו מהמעגל. חלש לאש, עמיד לרעל ולכפור.'),
  venom_stalker: L('Poison stacks fast; carry a Grand Healing Elixir to cleanse. Fire or frost both work.', 'הרעל מצטבר מהר; שאו אליקסיר ריפוי גדול לטיהור. אש או כפור - שניהם עובדים.'),
  water_elemental: L('Flying and ranged; lightning (Shock) is its weakness and it shrugs off fire and frost.', 'מעופף ותוקף מטווח; ברק (הלם חשמלי) הוא החולשה שלו והוא כמעט לא מושפע מאש וכפור.'),
  blight_sporeling: L('Explodes on purpose (Spore Burst, ×2 poison). Kill it at range or dodge the blast.', 'מתפוצץ בכוונה (פרץ נבגים, רעל ×2). הרגו אותו מטווח או התחמקו מהפיצוץ.'),
  elite_gloomweaver: L('Web Volley roots at 50% per strand; keep moving sideways and burn her.', 'מטח הקורים כובל ב-50% לכל חוט; המשיכו לנוע הצידה ושרפו אותה.'),
  spore_pod: L('Heals Nerius every few seconds - destroy pods the moment they spawn.', 'מרפא את נריוס כל כמה שניות - השמידו תרמילים ברגע שהם מופיעים.'),
  b_treant: L('Kill the Healing Spore Pods first; Vine Prison targets where you stand, so keep moving. Fire burns his bark.', 'הרגו קודם את תרמילי נבגי הריפוי; כלא הגפנים מכוון למקום שבו אתם עומדים, אז המשיכו לזוז. אש שורפת את הקליפה שלו.'),
  // ---------------------------------------------------------------- realm 3
  magma_drake: L('Fire Breath is a wide cone that Burns - flank it. Frost is its weakness.', 'נשיפת האש היא חרוט רחב שמבעיר - אגפו אותו. כפור הוא החולשה שלו.'),
  obsidian_golem: L('Very high HP and DEF with a heavy Ground Slam. Use Armor Piercer or SUPERCONDUCT before bursting.', 'הרבה חיים והגנה עם הלמות קרקע כבדה. השתמשו במפלח השריון או ב-SUPERCONDUCT לפני הפרץ.'),
  flame_knight: L('Its Blazing Combo is three quick hits - parry the first and riposte. 12% Demon Core.', 'הקומבו הלוהט שלו הוא שלוש מכות מהירות - הדפו את הראשונה והשיבו בתגובת-נגד. 12% לליבת שד.'),
  cinder_imp: L('Blinks away and lobs fireballs; frost and wind ground it. Leave them for last in a pack.', 'נעלם ומשליך כדורי אש; כפור ורוח מקרקעים אותו. השאירו אותם לסוף בקבוצה.'),
  elite_pyreclaw: L('Ash Meteors land where you stood - keep moving. Guaranteed Demon Core.', 'מטאורי האפר נוחתים היכן שעמדתם - המשיכו לזוז. ליבת שד מובטחת.'),
  b_wyrm: L('Armored Scales cut damage to 30% until you empty his Break Bar - parries and SHATTER are the key. Frost is his weakness.', 'הקשקשים המשוריינים מורידים את הנזק ל-30% עד שמרוקנים את מד השבירה - הדיפות ו-SHATTER הם המפתח. כפור הוא החולשה שלו.'),
  // ---------------------------------------------------------------- realm 4
  frost_wyvern: L('Dives in a long line; step aside and burn it. Fire and lightning are both effective.', 'צולל בקו ארוך; צעדו הצידה ושרפו אותו. אש וברק יעילים שניהם.'),
  phantom_lancer: L('A ghost: void damage cuts through it, poison and frost barely do. Spectral Charge is parryable.', 'רוח רפאים: נזק ריק חודר דרכה, רעל וכפור כמעט לא. את הסתערות הרפאים אפשר להדוף.'),
  ice_wraith: L('Freezing Nova can freeze you solid - stay out of its ring and burn it.', 'הנובה המקפיאה יכולה להקפיא אתכם לגמרי - הישארו מחוץ לטבעת ושרפו אותה.'),
  frost_revenant: L('Frost Spikes run in a straight line; side-step and punish. Drops Starlight ore.', 'קוצי הכפור רצים בקו ישר; צעדו הצידה והענישו. מפיל עפרת אור כוכבים.'),
  elite_rimehowl: L('Glacier Dive is fast and long; Ice Rain follows you. Fire is mandatory.', 'צלילת הקרחון מהירה וארוכה; גשם הקרח עוקב אחריכם. אש היא חובה.'),
  ice_clone: L('Fragile mirror copies of the Empress that fire Mirror Lances - kill them with area skills.', 'עותקי מראה שבירים של הקיסרית שיורים רמחי מראה - חסלו אותם בכישורים אזוריים.'),
  b_empress: L('Kill the mirror court at 65% and 30%; the Freezing Beam rotates, so circle with it. Fire is her weakness.', 'חסלו את חצר המראות ב-65% וב-30%; הקרן המקפיאה מסתובבת, אז הקיפו יחד איתה. אש היא החולשה שלה.'),
  // ---------------------------------------------------------------- realm 5
  seraph_automaton: L('Judgment Laser is a long, thin line - step out. Lightning short-circuits it.', 'לייזר המשפט הוא קו ארוך ודק - צאו ממנו. ברק עושה לו קצר.'),
  abyssal_reaver: L('Shadow Steps behind you; keep your back to a wall. Holy and lightning hurt it most.', 'צעד הצללים מוביל אותו אל מאחוריכם; שמרו את הגב לקיר. קודש וברק פוגעים בו הכי הרבה.'),
  aether_wisp: L('Tiny and quick; void damage pops it, lightning does little.', 'זעיר ומהיר; נזק ריק מפוצץ אותו, ברק כמעט לא.'),
  zenith_templar: L('Shield Bash can stun; strike from the side. Weak to void.', 'הלמות המגן יכולה להמם; תקפו מהצד. חלש לריק.'),
  elite_nullseraph: L('Null Laser sweeps across the arena - dodge through it, don\'t outrun it. Lightning beats it.', 'לייזר האפס סוחף את כל הזירה - התחמקו דרכו, אל תנסו לברוח ממנו. ברק מנצח אותו.'),
  b_paragon: L('A frontal guard blocks 90% until you Break him - flank, parry his combos and hit from behind. Weak to void.', 'מגן קדמי חוסם 90% עד ששוברים אותו - אגפו, הדפו את הקומבו שלו ותקפו מאחור. חלש לריק.'),
  // ---------------------------------------------------------------- roaming & events
  r_colossus: L('A 6-hero raid boss: let the Vanguard tank, parry the Gate Fist and dodge the Quake Rings outward.', 'בוס פשיטה ל-6 גיבורים: תנו לחלוץ לספוג את הבוס, הדפו את אגרוף השער והתחמקו מטבעות הרעש החוצה.'),
  r_reaper: L('Reaping Lines fan out in threes; Grasping Void pulls you in - dodge against the pull. Holy and fire hurt it.', 'קווי הקציר נפרשים בשלשות; הריק האוחז מושך פנימה - התחמקו נגד המשיכה. קודש ואש פוגעים בו.'),
  ev_gate: L('A stationary gate that pulses corruption. Destroy it to seal the outbreak; void barely scratches it.', 'שער נייח שפועם בהשחתה. השמידו אותו כדי לחתום את ההתפרצות; ריק בקושי שורט אותו.'),
  // ---------------------------------------------------------------- uniques
  uq_nightfall: L('Best in a Skill-Connect build: every third connect summons a Shadow Doppelganger. Extract it into the Relic Codex to keep it while wearing a full set.', 'הכי טוב בבילד של חיבורי כישורים: כל חיבור שלישי מזמן כפיל צללים. חלצו אותו לקודקס השרידים כדי לשמור אותו גם עם סט מלא.'),
  uq_rimecrest: L('Crits fire a Frost Nova that also paints Frost, and SHATTER deals +50% - pair it with Bleed from melee crits.', 'קריטיות יורות נובת כפור שגם צובעת כפור, ו-SHATTER גורם +50% - שלבו עם דימום מקריטיות של קרב מגע.'),
  uq_dawnspark: L('Attack speed shortens Sword Skill cooldowns - stack attack speed and the whole hotbar spins faster.', 'מהירות התקפה מקצרת את זמני הטעינה של כישורי החרב - צברו מהירות התקפה וכל הסרגל מסתובב מהר יותר.'),
  uq_ivory_verdict: L('The parry tank\'s centrepiece: every Perfect Parry fires a 250% beam and grants a 25% max HP barrier.', 'החלק המרכזי של טנק ההדיפות: כל הדיפה מושלמת יורה קרן של 250% ומעניקה מחסום של 25% מהחיים המרביים.'),
  uq_dragonbone: L('Wall Slams and Breaks drop 200% fire meteors and thrusts reach 30% further - built for slam-heavy polearm play.', 'הטחות בקיר ושבירות מורידות מטאורי אש של 200% והדקירות מגיעות רחוק יותר ב-30% - בנוי למשחק כלי מוט עם הרבה הטחות.'),
  uq_phoenix: L('Arrows ignite and burning enemies explode on death; the 120 s revive is a free second life.', 'החצים בוערים ואויבים בוערים מתפוצצים כשהם מתים; ההקמה לתחייה כל 120 שניות היא חיים שניים בחינם.'),
  uq_aetherion: L('Spells arc to two more enemies and every 5th spell is free - the mage\'s best unique.', 'לחשים מקפצים לעוד שני אויבים וכל לחש חמישי בחינם - הייחודי הטוב ביותר לקוסם.'),
  // ---------------------------------------------------------------- sets
  set_nightfall: L('Both Nightfall blades plus four armor pieces make six; the 6-piece makes Skill Connect free.', 'שני להבי רדת הלילה ועוד ארבעה חלקי שריון הם שישה; בונוס 6 החלקים הופך את חיבור הכישורים לחינמי.'),
  set_ivory: L('The tank set: DEF and block early, then HP on every block and 10% heals on Perfect Parries.', 'סט הטנק: הגנה וחסימה בהתחלה, ואחר כך חיים בכל חסימה וריפוי של 10% בהדיפות מושלמות.'),
  set_sylvan: L('The greatbow counts as two pieces, so bow + four armor pieces completes the set.', 'הקשת הגדולה נחשבת כשני חלקים, כך שקשת + ארבעה חלקי שריון משלימים את הסט.'),
  set_pyre: L('The Dragonglaive counts double. Every hit applies Burn, so any frost or shock source becomes a reaction engine.', 'גלייב הדרקון נחשב כפול. כל מכה מוסיפה בעירה, כך שכל מקור של כפור או הלם חשמלי הופך למנוע תגובות.'),
  set_frost: L('Crits apply Frost and SHATTER deals +80% - melee crits already paint Bleed, so SHATTER happens constantly.', 'קריטיות מוסיפות כפור ו-SHATTER גורם +80% - קריטיות של קרב מגע כבר צובעות דימום, כך ש-SHATTER קורה כל הזמן.'),
  set_aether: L('The staff counts double. Skills cost 30% less MP and apply Aether, which reacts with any other gauge.', 'המטה נחשב כפול. כישורים עולים 30% פחות מאנה ומוסיפים אתר, שמגיב עם כל מד אחר.'),
  set_anvil: L('A crafter\'s set: +15% tempering success, +25% gathering yield and +20% Break power.', 'סט של אומנים: +15% הצלחת חישול, +25% יבול איסוף ו-+20% כוח שבירה.'),
  set_abyss: L('High risk: below 50% HP you deal +30% damage and heal 6% of it. Pair with strong defenses.', 'סיכון גבוה: מתחת ל-50% חיים אתם גורמים +30% נזק ומרפאים 6% ממנו. שלבו עם הגנות חזקות.'),
};
