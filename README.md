# Aetheria Chronicles: Sword & Forge — Full-Dive Desktop Edition

**A standalone Windows desktop action RPG.** Real-time top-down oblique combat at 60 FPS, Skill Connect chains, Wall-Slam physics, six elemental reactions, unique weapons, armor sets, a Relic Codex, a party of two plus 6-hero raids, simulated adventurers, mounts, pets, fishing, deep blacksmithing, housing and an infinite abyss. Everything you see and hear is generated procedurally: there are no image or audio files.

**Strategy Wiki (English / עברית):** https://nirco99.github.io/aetheria-chronicles-rpg/

The wiki is the only part of the project on the web. The game itself is a native desktop app, and its in-game wiki button opens the site in your default browser (an offline copy ships inside the app).

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
npm run dist:win        # icon + typecheck + Vite build + electron-builder --win --dir
npm run electron:dev    # hot-reloading desktop dev session (Vite + Electron)
npm run selftest        # build, then run the app with --selftest (writes saves/selftest-report.json)
```

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
| `wiki/` | The standalone bilingual site |

License: MIT.

---

<div dir="rtl" align="right">

## עברית

# כרוניקות אתריה: חרב ונפחייה — מהדורת Full-Dive למחשב

**משחק תפקידים ופעולה עצמאי ל-Windows.** קרב בזמן אמת במבט עילי אלכסוני ב-60 פריימים לשנייה, שרשראות Skill Connect, פיזיקת הטחה בקיר, שש תגובות יסודיות, נשקים ייחודיים, סטים של שריון, קודקס שרידים, חבורה של שניים ופשיטות של 6 גיבורים, הרפתקנים מדומים, בהמות רכיבה, חיות מחמד, דיג, נפחות עמוקה, בתים ותהום אינסופית. כל מה שרואים ושומעים נוצר באופן פרוצדורלי — אין במשחק קובצי תמונה או שמע.

**ויקי האסטרטגיה (עברית / English):** https://nirco99.github.io/aetheria-chronicles-rpg/

הוויקי הוא החלק היחיד של הפרויקט שנמצא ברשת. המשחק עצמו הוא אפליקציית מחשב, וכפתור הוויקי במשחק פותח את האתר בדפדפן ברירת המחדל (עותק לא-מקוון מצורף לאפליקציה).

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
```

<div dir="rtl" align="right">

רישיון: MIT.

</div>
