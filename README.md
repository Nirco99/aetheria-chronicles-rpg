# Aetheria Chronicles: Sword & Forge — Ascension Edition (v4.0)

**A real-time 3D action RPG that runs in the browser and as a standalone Windows desktop app.** Skill Connect chains, Wall-Slam physics, six elemental reactions, unique weapons, armor sets, a Relic Codex, a party of two plus 6-hero raids, simulated adventurers, mounts, pets, fishing, deep blacksmithing, housing and an infinite abyss. Everything you see and hear is generated procedurally: there are no image, model or audio files.

| | |
| --- | --- |
| **Play in the browser** | https://nirco99.github.io/aetheria-chronicles-rpg/ |
| **Aetheria Codex & Database (English / עברית)** | https://nirco99.github.io/aetheria-chronicles-rpg/wiki/ |

Every number in the codex is generated from the game's own `src/data`. The desktop app ships an offline copy of it.

[עברית למטה ↓](#עברית)

---

## What's new in v4.0: the Ascension Edition

The game now has a real 3D renderer. The simulation, the content and your saves are unchanged; what you look at is new.

- **3D world.** Sculpted terrain with plateaus, cliffs and stairs, blended ground materials, extruded city walls and dungeons, timber-framed buildings with windows that light up at night, and 3D props, furniture, trees, rocks and flowers.
- **3D characters and creatures.** Procedural rigs for the Diver, companions, adventurers, NPCs, all 16 creature families, mounts and pets, with inverse-kinematic limbs, weapon trails, hit flashes and spawn / death dissolves.
- **Lighting.** A sun and moon that follow the clock, soft shadows fitted to the camera, sky lighting, up to 24 dynamic point lights for lamps, torches, spells and loot, and volumetric light shafts through the canopy.
- **Water, lava and weather.** Shoreline foam, depth tint and sun glints; glowing lava; rain, snow, ash, blossom, fireflies and wet ground.
- **Grass.** Up to 120 GPU-instanced blades per tile that sway in the wind and part around every actor.
- **Camera and image.** Depth of field, bloom, ambient occlusion, filmic tone mapping and per-realm colour grading, with a cinematic orbit on the title screen.
- **Interface.** A redrawn HUD (vitals panel with a level medallion, glossy bars, key-capped hotbar), a new title screen and menu theme.
- **Play in the browser.** The web build is the game itself; the codex moved to `/wiki/`.

A fix that came with it:

- Kills made far away by simulated adventurers no longer give you experience, loot or bounty credit. You still get credit for your own kills, your party's, kills you assisted or stood next to, and every boss.

### Graphics presets

**Settings → Graphics** switches presets live. `Auto` picks one from your GPU.

| Preset | For | What it turns on |
| --- | --- | --- |
| **Cinematic 4K** | The strongest GPUs, screenshots | Everything in RTX Ultra at up to 4K, 40-step volumetrics, 120 grass blades per tile |
| **RTX Ultra** | RTX 4060 class and up (auto-selected there) | 4× MSAA, 4K shadow maps, full-resolution ambient occlusion, 26-step volumetric light, bokeh depth of field, 20 dynamic lights, 84 grass blades per tile |
| **High** | Mid-range GPUs | Volumetric light, bokeh depth of field, 12 dynamic lights |
| **Balanced** | Entry gaming GPUs | Ambient occlusion, tilt-shift focus, denser grass |
| **Laptop** | Integrated graphics | The 3D world with sun shadows and bloom at a reduced resolution |
| **Classic 2D** | Anything | The original v3 canvas renderer |

Measured on an Intel Iris Xe laptop, the desktop app's self-test holds a steady 60 FPS on **Laptop** (about 54 FPS average, counting the one-off stalls when a window first opens). **RTX Ultra** and **Cinematic 4K** were built for an RTX 4060-class card and render correctly, but have not been timed on one yet. If a preset is too heavy for your machine, step down one row.

To force a preset for one run: `"Aetheria Chronicles.exe" --gfx=ultra`, or add `?gfx=ultra` to the web address. The values are `classic`, `low`, `medium`, `high`, `ultra` and `cinematic`.

## Play in the browser

Open https://nirco99.github.io/aetheria-chronicles-rpg/ in a current Chrome, Edge or Firefox on a desktop or laptop. It needs WebGL 2, a keyboard and a mouse. Saves stay in that browser's local storage. On a PC with a discrete GPU, make sure the browser is using it (Windows: *Settings → System → Display → Graphics*).

## Play on Windows

| Step | What to do |
| --- | --- |
| 1 | Clone or download this repository. |
| 2 | Double-click **`Launch-Aetheria-Desktop.bat`**. The first time, and again whenever you pull a newer version, it builds `release\win-unpacked\Aetheria Chronicles.exe` (this needs [Node.js 20+](https://nodejs.org)). Otherwise it launches the exe directly. Arguments are passed through, so `Launch-Aetheria-Desktop.bat --gfx=ultra` works. |
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
  - render quality: 0.75× to 2× supersampling on top of Windows display scaling (Classic 2D only; the 3D presets manage resolution themselves)
- On a PC with both integrated and dedicated graphics, the app asks Windows for the dedicated GPU.
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

`npm run wiki:build` fails if any English string is missing its Hebrew translation, or if a build guide names a skill, item or set that no longer exists.

`"Aetheria Chronicles.exe" --selftest` plays about 10 seconds of scripted input, measures FPS, collects console errors and then exits. Add `--gfx=<preset>` to test one preset, or `--trace` to also record a Chromium trace to `saves/selftest-trace.json`.

Pushing to `main` builds the game and the codex and publishes both to GitHub Pages: the game at the site root, the codex under `/wiki/`.

**Tech stack:**

- TypeScript 5, Vite 6 and Web Audio
- three.js 0.187 (WebGL 2) with `postprocessing` and `n8ao` for the 3D renderer; every mesh, material and texture is generated in code
- Canvas 2D for the HUD and the Classic 2D renderer (offscreen chunk caches, no `shadowBlur`)
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
| `src/gfx` | The 3D renderer: engine, terrain, water, foliage, props, characters, creatures, effects, post-processing, presets |
| `src/render` | Classic 2D renderer, paper-doll, HUD, icons |
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

# כרוניקות אתריה: חרב ונפחייה — מהדורת Ascension (גרסה 4.0)

**משחק תפקידים ופעולה תלת־ממדי בזמן אמת, שרץ בדפדפן וגם כאפליקציית Windows עצמאית.** שרשראות Skill Connect, פיזיקת הטחה בקיר, שש תגובות יסודיות, נשקים ייחודיים, סטים של שריון, קודקס שרידים, חבורה של שניים ופשיטות של 6 גיבורים, הרפתקנים מדומים, בהמות רכיבה, חיות מחמד, דיג, נפחות עמוקה, בתים ותהום אינסופית. כל מה שרואים ושומעים נוצר באופן פרוצדורלי — אין במשחק קובצי תמונה, מודלים או שמע.

- **לשחק בדפדפן:** https://nirco99.github.io/aetheria-chronicles-rpg/
- **קודקס ומאגר המידע של אתריה (עברית / English):** https://nirco99.github.io/aetheria-chronicles-rpg/wiki/

כל מספר בקודקס נוצר מתוך `src/data` של המשחק. עותק לא-מקוון שלו מצורף לאפליקציית המחשב.

### מה חדש בגרסה 4.0: מהדורת Ascension

למשחק יש עכשיו מנוע תלת־ממד אמיתי. הסימולציה, התוכן והשמירות לא השתנו; מה שרואים על המסך חדש לגמרי.

- **עולם תלת־ממדי.** שטח מפוסל עם רמות, צוקים ומדרגות, חומרי קרקע שמתמזגים זה בזה, חומות עיר ומבוכים בנפח מלא, בתים עם קורות עץ וחלונות שנדלקים בלילה, ואביזרים, רהיטים, עצים, סלעים ופרחים בתלת־ממד.
- **דמויות ויצורים בתלת־ממד.** שלדים פרוצדורליים לצולל, לבני הלוויה, להרפתקנים, לדמויות העיר, לכל 16 משפחות היצורים, לבהמות הרכיבה ולחיות המחמד — עם גפיים בקינמטיקה הפוכה, שובלי להב, הבזקי פגיעה והתפוגגות בהופעה ובמוות.
- **תאורה.** שמש וירח שעוקבים אחרי השעון, צללים רכים שמותאמים למצלמה, תאורת שמיים, עד 24 מקורות אור דינמיים לפנסים, לפידים, לחשים ושלל, וקרני אור נפחיות דרך צמרות העצים.
- **מים, לבה ומזג אוויר.** קצף על קו החוף, גוון עומק ונצנוצי שמש; לבה זוהרת; גשם, שלג, אפר, פריחה, גחליליות ואדמה רטובה.
- **דשא.** עד 120 גבעולים למשבצת, מצוירים על כרטיס המסך, שמתנדנדים ברוח ומפנים דרך לכל דמות.
- **מצלמה ותמונה.** עומק שדה, זוהר, הצללת סביבה, מיפוי גוונים קולנועי ודירוג צבע לכל ממלכה, עם סיבוב מצלמה קולנועי במסך הפתיחה.
- **ממשק.** תצוגה עילית שצוירה מחדש (לוח חיוניות עם מדליון רמה, מדים מבריקים, סרגל כישורים עם מקשים), מסך פתיחה חדש ועיצוב תפריטים חדש.
- **משחק בדפדפן.** גרסת הרשת היא המשחק עצמו; הקודקס עבר לכתובת `/wiki/`.

תיקון שהגיע עם הגרסה:

- הריגות שהרפתקנים מדומים מבצעים רחוק מכם כבר לא נותנות לכם ניסיון, שלל או קרדיט לפרסים. עדיין מקבלים קרדיט על הריגות שלכם ושל החבורה, על הריגות שסייעתם בהן או שעמדתם לידן, ועל כל בוס.

#### פריסטים גרפיים

ב**הגדרות ← גרפיקה** מחליפים פריסט בזמן אמת. `Auto` בוחר פריסט לפי כרטיס המסך.

| פריסט | למי | מה הוא מפעיל |
| --- | --- | --- |
| **Cinematic 4K** | כרטיסי המסך החזקים ביותר, צילומי מסך | כל מה שב-RTX Ultra ברזולוציה של עד 4K, אור נפחי ב-40 צעדים, 120 גבעולי דשא למשבצת |
| **RTX Ultra** | RTX 4060 ומעלה (נבחר שם אוטומטית) | החלקת קצוות ‎4× MSAA, מפות צל ב-4K, הצללת סביבה ברזולוציה מלאה, אור נפחי ב-26 צעדים, עומק שדה עם בוקה, 20 אורות דינמיים, 84 גבעולי דשא למשבצת |
| **High** | כרטיסי מסך בינוניים | אור נפחי, עומק שדה עם בוקה, 12 אורות דינמיים |
| **Balanced** | כרטיסי גיימינג בסיסיים | הצללת סביבה, מיקוד Tilt-Shift, דשא צפוף יותר |
| **Laptop** | גרפיקה מובנית | העולם התלת־ממדי עם צללי שמש וזוהר, ברזולוציה מופחתת |
| **Classic 2D** | כל מחשב | מנוע הקנבס המקורי של גרסה 3 |

במדידה על לפטופ עם Intel Iris Xe, הבדיקה העצמית של אפליקציית המחשב מחזיקה 60 פריימים יציבים בפריסט **Laptop** (ממוצע של כ-54, כולל העצירות החד־פעמיות כשחלון נפתח בפעם הראשונה). **RTX Ultra** ו-**Cinematic 4K** נבנו לכרטיס ברמת RTX 4060 ומצוירים נכון, אבל עדיין לא נמדדו על כרטיס כזה. אם פריסט כבד מדי למחשב שלכם, רדו שורה אחת.

כדי לכפות פריסט להרצה אחת: `"Aetheria Chronicles.exe" --gfx=ultra`, או הוסיפו `?gfx=ultra` לכתובת בדפדפן. הערכים הם `classic`, `low`, `medium`, `high`, `ultra` ו-`cinematic`.

### איך משחקים בדפדפן

פתחו את https://nirco99.github.io/aetheria-chronicles-rpg/ ב-Chrome, Edge או Firefox עדכניים במחשב נייח או נייד. נדרשים WebGL 2, מקלדת ועכבר. השמירות נשארות באחסון המקומי של אותו דפדפן. במחשב עם כרטיס מסך ייעודי, ודאו שהדפדפן משתמש בו (ב-Windows: *הגדרות ← מערכת ← תצוגה ← גרפיקה*).

### איך משחקים ב-Windows

1. הורידו או שכפלו את המאגר.
2. לחצו פעמיים על **`Launch-Aetheria-Desktop.bat`**. בפעם הראשונה, ושוב בכל פעם שמושכים גרסה חדשה, הוא בונה את `release\win-unpacked\Aetheria Chronicles.exe` (נדרש [Node.js 20 ומעלה](https://nodejs.org)); אחרת הוא מפעיל את קובץ ההפעלה ישירות. פרמטרים מועברים הלאה, כך ש-`Launch-Aetheria-Desktop.bat --gfx=ultra` עובד.
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
  - איכות רינדור: דגימת-על מ-0.75× עד 2× מעל קנה המידה של Windows (ב-Classic 2D בלבד; הפריסטים התלת־ממדיים מנהלים את הרזולוציה בעצמם)
- במחשב שיש בו גם גרפיקה מובנית וגם כרטיס מסך ייעודי, האפליקציה מבקשת מ-Windows את הכרטיס הייעודי.
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
