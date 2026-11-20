# Aetheria Chronicles: Sword & Forge — Full-Dive Desktop Edition

**A standalone Windows desktop action RPG.** Real-time top-down oblique combat at 60 FPS, Skill Connect chains, Wall-Slam physics, six elemental reactions, unique weapons, armor sets, a Relic Codex, a party of two plus 6-hero raids, simulated adventurers, mounts, pets, fishing, deep blacksmithing, housing and an infinite abyss. Everything you see and hear is generated procedurally: there are no image or audio files.

**Aetheria Codex & Database (English / עברית):** https://nirco99.github.io/aetheria-chronicles-rpg/

The codex is the only part of the project on the web. The game itself is a native desktop app, and its in-game wiki button opens the codex in your default browser (an offline copy ships inside the app). Every number in the codex is generated from the game's own `src/data`, and every sprite is drawn by the game's own renderer.

[עברית למטה ↓](#עברית)

---

## Play on Windows

| Step | What to do |
| --- | --- |
| 1 | Clone or download this repository. |
| 2 | Double-click **`Launch-Aetheria-Desktop.bat`**. The first time, it builds `release\win-unpacked\Aetheria Chronicles.exe` (this needs [Node.js 20+](https://nodejs.org)). After that it launches the exe directly. |
| 3 | *(optional)* Right-click **`Create-Desktop-Shortcut.ps1`** and choose **Run with PowerShell** to put an *Aetheria Chronicles* icon on your desktop. Add `-StartMenu` for a Start Menu entry too. |

You can also run `release\win-unpacked\Aetheria Chronicles.exe` directly. The `win-unpacked` folder is portable, so you can copy it anywhere.

### Saves, display and quitting

- **Saves** are JSON files in `.\saves` next to the exe:
  - `slot_1.json` to `slot_3.json`
  - `global_vault.json` — the 100-slot vault shared by every character
  - `settings.json` and `leaderboard.json`
  - Deleted slots are moved to `saves\deleted`, not destroyed.
- **Open Saves Folder** (title screen, pause menu or Settings) opens the folder in Explorer.
- **F11 / Alt+Enter** toggle fullscreen. **Settings → Display** has:
  - window sizes: 1280×720, 1600×900, 1920×1080 and 2560×1440
  - render quality: 0.75× to 2× supersampling on top of Windows display scaling
- **Quit to Desktop** is on the title screen and in the pause menu.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move |
| Left click / J | Basic combo. Inputs are buffered for 160 ms. |
| Right click / Shift | Block. Tap just before impact for a Perfect Parry, then attack within 1.5 s for a Counter-Riposte. |
| Space | Dodge (i-frames) |
| 1–6 | Sword Skills. Cast a different skill in the 0.30 s window after the last strike for a Skill Connect. |
| Q | Swap weapon set A / B |
| R / Tab | SWITCH! (Triple SWITCH! with two companions) |
| V | Mount / dismount. Attacking while mounted performs a Charge Slam. |
| F1–F4 | Gambits: Assault, Guard & Peel, Focus My Target, Support & Heal |
| E / F | Interact, talk, gather, fish, dig |
| Z X C | Quick consumables |
| I / K / M / H | Character, Constellation Skill Graph, Realm Atlas, Handbook |
| O / N / P / T / U | Bestiary, Journal & Titles, Stable & Pets, Wardrobe, Relic Codex |
| B | House decorator |
| F5 | Quick save |
| Esc | Pause / close |

## What's new in v3.1: the Aetheria Codex

The strategy wiki is now a code-synced database and compendium, in English (LTR) and Hebrew (RTL):

- **Items & Equipment:** all 128 gear blueprints, 7 uniques, 44 set pieces and 109 materials, consumables and furnishings. Every gear page has a +0 to +10 tempering slider and a Standard / Fine / Masterwork / Supreme selector that recompute stats with the game's own formula, plus tempering costs and odds, the forge recipe and exact drop chances.
- **Drop Rates & Bestiary:** loot tables for all 36 creatures with base %, your effective %, average kills (1/p) and kills for a 90% chance; a Magic Find calculator; and a "where to farm" lookup that ranks every source of an item.
- **Builds & Recommendations:** six complete builds, tier lists, a level 1-60 progression route and a farming guide.
- **Skills & Constellation:** every Sword Skill with its real strike timings, read from the skill scripts.
- **Atlas Maps:** the real city, wilds and dungeon maps of all five realms, drawn by the game's terrain renderer, with ore, herb, fishing, spawn, elite, dungeon, boss and housing layers.
- **Combat Docs:** an animated frame-data timeline, a Wall-Slam and Break-Bar physics demo and a reaction simulator.

Game changes behind the codex:

- Combat timings, loot rules and reaction values moved into shared data modules (`src/data/framedata.ts`, `src/data/loot.ts`), which both the game and the codex read.
- Creatures now have elemental weaknesses (×1.3 damage) and resistances (×0.6), shown in the in-game Bestiary.
- New Magic Find sources: Night Hunt (+15% in the wilds from 20:00 to 05:00), Hunting Mastery (+10% after 50 kills of a species, 10 for elites, 5 for bosses), every pet (+4% to +10%) and the Crimson Wing Rangers (+4% per rank).
- Magic Find now raises every non-guaranteed drop: full weight for gear, gems, maps and uniques, half weight for materials, stones, relic shards and Mythic Cores.
- Fixed: the Artisan's Pride set power now adds its +15% tempering success and +20% Break. The tempering screen shows your guild and set bonuses.

## What's new in v3.0

### Combat feel

- 160 ms input buffering and a cancel hierarchy: basic-attack recovery cancels into skills, dodge or parry; skill startup and recovery cancel into dodge, parry or SWITCH!.
- Kinetic micro-lunges at 110–260 px/s that stop just short of the enemy.
- **WALL SLAM!**: enemies knocked into walls take +45% impact damage, a 1.5 s stun and lose 30% of their Break Bar.
- Breakable props: explosive barrels, frost crystals, crates and urns. Aether jump pads launch you onto plateaus.
- Forgiving hitboxes: attack arcs 15% wider than the ribbon, a 20% tighter hurtbox, and 0.35 s grace i-frames.
- **Skill Connect** chains: −30% MP and +25% damage per step. The fourth skill fires a **Finishing Nova**.
- Perfect Parry: 50 ms time-freeze, 30% MP and Stamina restored, Counter-Riposte criticals.
- **Style meter** from D to SSS (FULL-DIVE OVERDRIVE!): up to +25% attack speed, +15% move speed and +40% Magic Find.

### Builds

- **Constellation Skill Graph (K)** with pan and zoom:
  - Sword Skill ranks 1–5
  - 90 Rune Morphs (Execution, Shadow-Clone, Elemental Leech)
  - 6 Keystones and 6 cross-branch Hybrid Bridges

### Elements and gear

- Six reaction gauges (Burn, Frost, Shock, Bleed, Venom, Aether) and six reactions: MELT, SHATTER, OVERLOAD, SUPERCONDUCT, TEMPEST SPREAD and AETHER SINGULARITY.
- Affixes with an Arcane Enchanter for rerolls.
- 7 unique weapons with golden powers, and 8 six-piece armor sets.
- **Aether Relic Codex**: extract golden powers and equip three relics (weapon, armor, utility).
- Harmonic drop chords, side-by-side compare tooltips, Smart Auto-Salvage, and a transmog wardrobe with 16 dyes.

### Living world

- A party of two companions with gambits, affinity ranks and Triple SWITCH!.
- Raid Briefings deploy three Vanguard knights for 6-hero raids, including the roaming raid bosses *Colossus of the Sundered Gate* and *The Hollow Reaper*.
- Simulated adventurers you can rescue, trade with or duel. Duels end at 10% HP; nobody dies.
- 5 mounts and 6 elemental pets that auto-loot and fire support bolts.
- Tension-bar fishing, Ancient Treasure Maps, Corrupted Gate outbreaks and caravan escorts, which unlock the Black Market.
- A Bestiary with live models, and 56 achievements with titles.

### Visuals

- Two-tier plateaus with oblique cliff faces and stone stairs.
- Rivers with railed bridges and walkable shallows.
- Grass that bends around you, plus footprints, ripples and dust.
- Sun and moon shadows that follow the clock, drifting cloud shadows, a 1.18× parallax foreground canopy and god-rays.
- 12-sample blade trails.
- Paper-dolls that blink and have bending knees and elbows, armor sheen and spring-physics capes.

## Build from source

Requires Node.js 20+ and Windows for the packaged exe.

```bash
npm install
npm run dist:win        # icon + codex + typecheck + Vite build + electron-builder --win --dir
npm run electron:dev    # hot-reloading desktop dev session (Vite + Electron)
npm run selftest        # build, then run the app with --selftest (writes saves/selftest-report.json)
npm run wiki:build      # regenerate wiki/wiki-data.js and wiki/wiki-engine.js from src/data
npm run wiki:serve      # preview the codex at http://127.0.0.1:4180/
```

`npm run wiki:build` fails if any English string is missing its Hebrew translation, or if a build guide names a skill, item or set that no longer exists. GitHub Pages runs it on every push to `main`.

`"Aetheria Chronicles.exe" --selftest` plays about 10 seconds of scripted input, measures FPS, collects console errors and then exits.

**Tech stack:**

- TypeScript 5, Vite 6, Canvas 2D (offscreen chunk caches, no `shadowBlur`) and Web Audio
- Electron 39 with a sandboxed preload bridge for disk saves and window controls
- electron-builder 26
- No native modules

**Project layout:**

| Path | Contents |
| --- | --- |
| `src/types` | The shared contract |
| `src/data` | Declarative content |
| `src/systems` | Combat, feel, reactions, powers, events, saves |
| `src/entities` | Player, monsters, companions, adventurers, breakables, pets |
| `src/world` | Map generation and collision with elevation |
| `src/render` | Renderer, paper-doll, terrain, HUD |
| `src/ui` | Menus |
| `src/platform` | Desktop bridge and self-test |
| `electron/` | Main and preload |
| `wiki/` | The bilingual codex (static site; `wiki-data.js` and `wiki-engine.js` are generated) |
| `wiki-src/` | Codex sources: the data extractor, the sprite engine entry, Hebrew text and build guides |
| `scripts/` | Icon generator, codex generator and a local preview server |

License: MIT.

---

<div dir="rtl" align="right">

## עברית

# כרוניקות אתריה: חרב ונפחייה — מהדורת Full-Dive למחשב

**משחק תפקידים ופעולה עצמאי ל-Windows.** קרב בזמן אמת במבט עילי אלכסוני ב-60 פריימים לשנייה, שרשראות Skill Connect, פיזיקת הטחה בקיר, שש תגובות יסודיות, נשקים ייחודיים, סטים של שריון, קודקס שרידים, חבורה של שניים ופשיטות של 6 גיבורים, הרפתקנים מדומים, בהמות רכיבה, חיות מחמד, דיג, נפחות עמוקה, בתים ותהום אינסופית. כל מה שרואים ושומעים נוצר באופן פרוצדורלי — אין במשחק קובצי תמונה או שמע.

**קודקס ומאגר המידע של אתריה (עברית / English):** https://nirco99.github.io/aetheria-chronicles-rpg/

הקודקס הוא החלק היחיד של הפרויקט שנמצא ברשת. המשחק עצמו הוא אפליקציית מחשב, וכפתור הוויקי במשחק פותח את הקודקס בדפדפן ברירת המחדל (עותק לא-מקוון מצורף לאפליקציה). כל מספר בקודקס נוצר מתוך `src/data` של המשחק, וכל דמות מצוירת על ידי מנוע הציור של המשחק עצמו.

### איך משחקים ב-Windows

1. הורידו או שכפלו את המאגר.
2. לחצו פעמיים על **`Launch-Aetheria-Desktop.bat`**. בפעם הראשונה הוא בונה את `release\win-unpacked\Aetheria Chronicles.exe` (נדרש [Node.js 20 ומעלה](https://nodejs.org)), ומאז הוא מפעיל את קובץ ההפעלה ישירות.
3. *(רשות)* קליק ימני על **`Create-Desktop-Shortcut.ps1`** ← **Run with PowerShell** יוצר סמל *Aetheria Chronicles* על שולחן העבודה. הוסיפו `-StartMenu` כדי ליצור גם קיצור בתפריט התחל.

### שמירות, תצוגה ויציאה

- **השמירות** הן קובצי JSON בתיקייה `.\saves` ליד קובץ ההפעלה:
  - `slot_1.json` עד `slot_3.json`
  - `global_vault.json` — הכספת בת 100 המקומות, משותפת לכל הדמויות
  - `settings.json` ו-`leaderboard.json`
  - משבצות שנמחקות עוברות ל-`saves\deleted` ולא נמחקות לגמרי.
- **פתיחת תיקיית השמירות** (במסך הפתיחה, בתפריט ההשהיה או בהגדרות) פותחת את התיקייה בסייר הקבצים.
- **F11 / Alt+Enter** עוברים למסך מלא. ב**הגדרות ← תצוגה** יש:
  - גדלי חלון: 1280×720, 1600×900, 1920×1080 ו-2560×1440
  - איכות רינדור: דגימת-על מ-0.75× עד 2× מעל קנה המידה של Windows
- **יציאה לשולחן העבודה** נמצאת במסך הפתיחה ובתפריט ההשהיה.

### מה חדש בגרסה 3.1: קודקס אתריה

ויקי האסטרטגיה הפך למאגר מידע ומדריך שמסונכרנים עם הקוד, בעברית (מימין לשמאל) ובאנגלית:

- **פריטים וציוד:** כל 128 שרטוטי הציוד, 7 הנשקים הייחודיים, 44 חלקי הסטים ו-109 החומרים, המתכלים ופריטי הריהוט. בכל עמוד ציוד יש מחוון חישול מ-+0 עד +10 ובחירת איכות (רגיל / משובח / יצירת מופת / עליון) שמחשבים את הסטטיסטיקות בנוסחה של המשחק, ובנוסף עלויות וסיכויי חישול, מתכון הנפחייה וסיכויי שלל מדויקים.
- **אחוזי דרופים ובסטיאריום:** טבלאות שלל לכל 36 היצורים עם אחוז בסיס, האחוז האפקטיבי שלכם, ממוצע הריגות (1/p) והריגות לסיכוי של 90%; מחשבון מציאת שלל; וחיפוש "איפה לפארם" שמדרג כל מקור של פריט.
- **בילדים והמלצות:** שישה בילדים מלאים, רשימות דירוג, מסלול התקדמות מרמה 1 עד 60 ומדריך פארם.
- **כישורים וקונסטלציה:** כל כישור חרב עם תזמוני המכות האמיתיים שלו, שנקראים מתסריטי הכישורים.
- **מפות:** מפות העיר, השטח הפתוח והמבוך האמיתיות של כל חמש הממלכות, מצוירות על ידי מנוע השטח של המשחק, עם שכבות של עפרות, צמחים, דיג, מפלצות, עילית, מבוכים, בוסים ובתים.
- **תיעודים מהמשחק:** ציר זמן מונפש של נתוני פריימים, הדגמת פיזיקה של הטחה בקיר ומד שבירה, וסימולטור תגובות.

שינויים במשחק שעומדים מאחורי הקודקס:

- תזמוני הקרב, כללי השלל וערכי התגובות עברו למודולי נתונים משותפים (`src/data/framedata.ts`, `src/data/loot.ts`) שגם המשחק וגם הקודקס קוראים.
- ליצורים יש עכשיו חולשות יסודיות (נזק ×1.3) ועמידויות (×0.6), שמוצגות בבסטיאריום שבמשחק.
- מקורות חדשים למציאת שלל: ציד לילה (+15% בשטח הפתוח בין 20:00 ל-05:00), שליטת ציד (+10% אחרי 50 הריגות של מין, 10 לעילית, 5 לבוסים), כל חיית מחמד (+4% עד +10%) וסיירי הכנף הארגמנית (+4% לכל דרגה).
- מציאת שלל מעלה עכשיו כל שלל שאינו מובטח: משקל מלא לציוד, אבני יסוד, מפות וייחודיים, וחצי משקל לחומרים, אבני חישול, רסיסי שרידים וליבות מיתיות.
- תוקן: כוח הסט "גאוות האומן" מוסיף עכשיו את +15% הצלחת החישול ואת +20% השבירה. מסך החישול מציג את בונוסי הגילדה והסט.

### מה חדש בגרסה 3.0

**תחושת קרב**

- אגירת קלט של 160 אלפיות שנייה ומדרג ביטולים: את סוף התקפה בסיסית אפשר לבטל לכישור, להתחמקות או להדיפה; את תחילת הכישור ואת סופו אפשר לבטל להתחמקות, להדיפה או ל-SWITCH!.
- צעדים קינטיים של 110–260 פיקסלים לשנייה שנעצרים ממש לפני האויב.
- **WALL SLAM!**: אויב שנזרק לקיר סופג ‎+45%‎ נזק פגיעה, הלם של 1.5 שניות ומאבד 30% ממד השבירה.
- אביזרים שבירים: חביות נפיצות, קריסטלי כפור, ארגזים וכדים. משטחי קפיצה של אתר משגרים אתכם אל הרמות.
- תיבות פגיעה סלחניות: קשתות התקפה רחבות ב-15% מהסרט הנראה, אזור פגיעה צר ב-20%, וחסינות חסד של 0.35 שניות.
- שרשראות **Skill Connect**: ‏‎-30%‎ מאנה ו-‎+25%‎ נזק לכל שלב. הכישור הרביעי משחרר **נובת סיום**.
- הדיפה מושלמת: הקפאת זמן של 50 אלפיות שנייה, החזרת 30% מהמאנה והסיבולת, ותגובות-נגד קריטיות.
- **מד סטייל** מ-D ועד SSS: עד ‎+25%‎ מהירות התקפה, ‎+15%‎ מהירות תנועה ו-‎+40%‎ מציאת קסם.

**מבנים**

- **גרף כישורים כוכבי (K)** עם הזזה וזום:
  - דרגות 1–5 לכל כישור חרב
  - 90 מורפים רוניים
  - 6 אבני-מפתח ו-6 גשרים היברידיים בין ענפים

**יסודות וציוד**

- שש תגובות יסודיות: ‏MELT, ‏SHATTER, ‏OVERLOAD, ‏SUPERCONDUCT, ‏TEMPEST SPREAD ו-AETHER SINGULARITY.
- תכונות עם מכשף ארקני להגרלה מחדש.
- 7 נשקים ייחודיים עם כוחות זהובים, ו-8 סטים של שישה חלקים.
- **קודקס שרידי האתר**: חילוץ כוחות זהובים וציוד שלושה שרידים (נשק, שריון, תועלת).
- אקורדי נפילה הרמוניים, השוואת פריטים זו לצד זו, פירוק אוטומטי חכם וארון בגדים עם 16 צבעים.

**עולם חי**

- חבורה של שני בני לוויה עם גמביטים (F1–F4), דרגות זיקה ו-Triple SWITCH!.
- תדריך פשיטה עם שלושה אבירי חלוץ לפשיטות של 6 גיבורים, כולל שני בוסי פשיטה נודדים.
- הרפתקנים מדומים שאפשר להציל, לסחור איתם ולהתמודד מולם בדו-קרב. דו-קרב נגמר ב-10% חיים — אף אחד לא מת.
- 5 בהמות רכיבה ו-6 חיות מחמד לוחמות שאוספות שלל ויורות קליעי תמיכה.
- דיג עם מד מתח, מפות אוצר, אירועי עולם, והשוק השחור שנפתח אחרי ליווי שיירה.
- בסטיאריום עם מודלים חיים, ו-56 הישגים עם תארים.

**חזות**

- רמות דו-מפלסיות עם צוקי סלע אלכסוניים ומדרגות אבן.
- נהרות עם גשרים ומים רדודים שאפשר ללכת בהם.
- דשא שמתכופף סביבכם, ועקבות, אדוות ואבק.
- צללי שמש וירח שעוקבים אחרי השעון, צללי עננים, חופת עצים בפרלקסה של 1.18× וקרני אור.
- שובלי להב של 12 דגימות.
- בובות נייר שממצמצות, עם ברכיים ומרפקים מתכופפים, ברק על השריון וגלימות עם פיזיקת קפיץ.

### בנייה מקוד המקור

נדרשים Node.js 20 ומעלה ו-Windows לבניית קובץ ההפעלה.

</div>

```bash
npm install
npm run dist:win
npm run electron:dev
npm run selftest
npm run wiki:build
npm run wiki:serve
```

<div dir="rtl" align="right">

רישיון: MIT.

</div>
