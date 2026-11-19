# Aetheria Chronicles: Sword & Forge

**A 60 FPS top-down oblique real-time action RPG for the desktop (Electron) and the browser**: classless sword-skill combat, Perfect Parries and Break staggers, SWITCH! partner combos, deep blacksmithing, housing, guilds, AI companions, a living economy and an Infinite Abyss. Every sprite, tile, icon, sound effect and music track is **generated procedurally at runtime**, with zero binary assets.

[English](#english) | [עברית](#עברית)

- **Play in the browser:** https://nirco99.github.io/aetheria-chronicles-rpg/
- **Bilingual Strategy Wiki (EN / עברית):** https://nirco99.github.io/aetheria-chronicles-rpg/wiki/ (also opens from the Title Screen and the Pause Menu)

---

## English

### Highlights

| | |
|---|---|
| **Combat with juice** | Pre-motion skill flashes, glowing Bézier slash ribbons, 40 ms hit-stop, physics damage numbers, polygonal crystal death shatter, red ground telegraphs, Perfect Parry shockwaves, Break Bar staggers ("BREAK!!" = 4 s stun, every hit a 150% critical). |
| **Classless mastery** | 6 branches (One-Handed Sword, Dual Blades, Shield & Fortress, Spear & Polearm, Bow & Marksmanship, Elemental & Arcane Magic), **48 skills** (5 actives + 3 passives each), Mastery Ranks 1-50, Skill Points, a 6-slot hotbar and two swappable weapon sets (`Q`). |
| **Unique Skill Awakenings** | Hidden milestones trigger a golden *"SYSTEM ANNOUNCEMENT: UNIQUE SKILL AWAKENED!"*: Dual Blades Overdrive, Master Blacksmith's Soul and Paragon's Divine Aegis. |
| **SWITCH!** | Fight beside one of 6 AI Guild Companions. A full gauge lets you backstep (1.5 s invulnerable, aggro shed) while your partner executes a Synchronized Chain Skill; your next Sword Skill deals +35%. |
| **Paper-doll renderer** | 7 visual layers in 4 directions: shadow and rarity aura, velocity-driven cape, body and boots, 5 chest silhouettes, 8 hair styles, 10 hair and 8 eye colours, helmets/hoods/circlets (toggleable), shields with an energy barrier when blocking, crossed dual blades, quivers, rune orbs, tempering sparks and gem-tinted auras. |
| **5 realms** | Emerald Plains of Arcadia, Sylvanis Twilight Forest, Pyrehold Volcanic Canyon, Crystalia Starlight Glaciers and the Aetherion Sky Citadel, each with a city, a procedural wilderness, ore veins, herbs, a night Named Elite and a dungeon with a multi-phase boss. Choose *Ascension Chronicle Mode* (bosses unlock the next gate) or *Unrestricted Open World Mode*. |
| **Blacksmithing** | Smelting, 16 blueprints in 7 material tiers, the Anvil Hammer Gauge mini-game (Standard / Fine / Masterwork / **Supreme Masterpiece** with a custom name and a "Forged by" signature), Instant Auto-Forge, tempering +1 to +10, 5 elemental gems and salvaging. |
| **Alchemy & cooking** | Potions, draughts, 3-minute Elemental Blade Oils and multi-minute buff meals, up to the *Sovereign's Banquet*. |
| **Living economy** | Per-city supply and demand indices (70%-155%) that react to bulk trading, plus rotating Trade Booms and Shortages in a live Market Ticker. |
| **Housing** | Buy a house in every city (500 G to 25,000 G) and decorate it with the Grid Decorator (`B`): shared 100-slot vault, Master Anvil (+10% forging quality), alchemy and cooking stations, Royal Bed (Well Rested +20% XP), boss trophies, and weapon racks and armor mannequins that render your exact gear. |
| **World simulation** | 24-minute day/night cycle with punch-out lighting, rain, thunderstorms, blizzards and ember ash, blossom, ember, snow and aether-mote particle layers, 4 guilds with ranks and a daily bounty board. |
| **Endgame** | The Infinite Abyss Labyrinth (procedural floors, modifiers, Boss Rush every 5th floor, checkpoints, leaderboard, Mythic crafting materials) and the Grand Coliseum (5 Tournament Cups and Endless Waves). |
| **Fair death** | Emergency Crystal Teleport back to the last city; you lose 15% of the current level's XP (never a level) and a 5% gold fee. Gear is never lost. |

### Controls

| Key | Action |
|---|---|
| `W A S D` / arrows | Move |
| Left click / `J` | Basic attack combo (aims at the cursor) |
| Right click / `Shift` | Block; press just before impact to **Perfect Parry** |
| `Space` | Dodge roll (invulnerability frames) |
| `1`-`6` | Sword Skills |
| `Q` | Swap weapon set A / B |
| `R` / `Tab` | **SWITCH!** with your companion |
| `E` / `F` | Interact, talk, gather, enter |
| `Z` `X` `C` | Quick-use consumables |
| `I` / `K` / `M` / `H` | Character, Mastery, Realm Atlas, Handbook |
| `B` | Grid Decorator (inside your house) |
| `Esc` / `F5` / `F11` | Pause, quick save, fullscreen (desktop) |

### Run it

Requires **Node.js 18+** (20 LTS recommended) and npm. No native modules, no `node-gyp`.

```bash
npm install
```

```bash
npm run dev
```
Opens the game in the browser at http://127.0.0.1:5173.

```bash
npm run electron:dev
```
Runs Vite and opens the game in a native desktop window with hot reload.

```bash
npm start
```
Typechecks, builds the production bundle and launches it in Electron.

```bash
npm run build
```
Runs `tsc --noEmit` and then `vite build` into `dist/` (the game at `/`, the wiki at `/wiki/`).

Saves are stored in `localStorage` (three slots plus autosave), which Electron persists in its user-data folder.

### Architecture

```
src/
  types/game.ts        single source-of-truth type contract shared by every module
  data/                realms, monsters + bosses, 48 skills, items, recipes, guilds, lore
  engine/              math/RNG/noise, keyboard+mouse input, Web Audio synth (SFX + music)
  world/               tile map + sliding AABB collision + BFS flow field, map generators, World simulation
  entities/            Actor base, Player, Companion AI, Monster AI, boss specials, NPCs, projectiles
  systems/             stats, combat, skill executor, basic combos, progression, inventory, crafting,
                       economy, guilds, housing, arena, abyss, save/load
  render/              renderer, baked ground chunks, tile/prop caches, paper-doll, gear, monsters,
                       FX, glow sprites, weather, HUD, icons, boot sequence
  ui/                  DOM menus (title, creation, character, forge, shops, guild, housing, ...)
wiki/                  standalone bilingual wiki (index.html, styles.css, wiki.js)
electron/main.cjs      desktop shell
```

Performance notes:
- **Fixed 60 Hz simulation** with an accumulator, per-entity hit-stop and global time dilation (SWITCH!, Perfect Parry, BREAK!!).
- **No `shadowBlur`**: every glow, aura, light and ribbon uses pre-cached radial-gradient sprites with additive (`lighter`) compositing; night lighting is a half-resolution light map multiplied over the scene.
- **Offscreen caching**: tiles, wall faces and props are painted once per realm palette; static ground and deep wall interiors are baked into 8×8-tile chunks, so a frame draws about 20 chunk images instead of about 800 tiles.
- **Y-sorted painter's algorithm** (`sortKey = y + footOffset`) over walls, props, nodes, actors, projectiles and loot.
- **Sliding sub-pixel AABB collision**: X then Y, with a 4 px corner nudge so actors never snag on oblique corners.
- Data-driven Sword Skills: each skill is a small timeline script run by a shared executor that both the player and the companions use.

### Deployment

`.github/workflows/deploy-wiki.yml` builds the web version on every push to `main` and publishes `dist/` (game plus bilingual wiki) to GitHub Pages.

### Credits

Original game. All characters, places, skills, art, music and sound are original and generated procedurally in code. Released under the MIT License.

---

<div dir="rtl" lang="he">

## עברית

### כרוניקות אתריה: חרב ונפחייה

**משחק תפקידים ופעולה בזמן אמת, במבט עילי אלכסוני וב-60 פריימים לשנייה, למחשב (Electron) ולדפדפן**: קרב כישורי חרב ללא מעמדות, הדיפות מושלמות ושבירת הגנה, שילובי SWITCH! עם שותף, נפחות עמוקה, בתים, גילדות, בני לוויה ממוחשבים, כלכלה חיה ותהום אינסופית. כל דמות, אריח, סמל, אפקט קולי וקטע מוזיקה **נוצרים בקוד בזמן ריצה**, בלי אף קובץ גרפי או קולי.

- **לשחק בדפדפן:** https://nirco99.github.io/aetheria-chronicles-rpg/
- **ויקי אסטרטגיה דו-לשוני (אנגלית / עברית):** https://nirco99.github.io/aetheria-chronicles-rpg/wiki/ (נפתח גם ממסך הפתיחה ומתפריט ההשהיה)

### מה במשחק

- **קרב עם תחושה:** הבזק לפני כישור, סרטי חיתוך זוהרים, הקפאת פגיעה של 40 אלפיות שנייה, מספרי נזק קופצים, התנפצות קריסטלים במוות, סימוני התקפה אדומים על הקרקע, הדיפה מושלמת ומד שבירה ("BREAK!!" = הלם של 4 שניות וכל מכה קריטית של 150%).
- **שליטה ללא מעמדות:** 6 ענפים (חרב ביד אחת, להבים כפולים, מגן ומבצר, חנית ומוט, קשת וקליעה, קסם יסודות וארקני), **48 כישורים**, דרגות שליטה 1-50, נקודות כישור, סרגל של 6 כישורים ושני סטים של נשק להחלפה (`Q`).
- **התעוררויות כישור ייחודיות:** אבני דרך נסתרות מפעילות הכרזה זהובה ומעניקות כוחות קבועים.
- **SWITCH!:** לוחמים לצד אחד משישה בני לוויה. כשהמד מלא, אתם קופצים לאחור עם חסינות ובן הלוויה מבצע כישור שרשרת מסונכרן; כישור החרב הבא שלכם גורם +35% נזק.
- **הדמות משתנה עם הציוד:** 7 שכבות ב-4 כיוונים: צל והילה, שכמייה שמתנופפת לפי התנועה, גוף ומגפיים, 5 צורות שריון, 8 תסרוקות, 10 צבעי שיער, 8 צבעי עיניים, קסדות שאפשר להסתיר, מגנים עם מחסום אנרגיה, להבים כפולים, אשפה, כדור רונות, ניצוצות חישול והילת אבנים.
- **5 ממלכות:** מישורי האזמרגד של ארקדיה, יער הדמדומים של סילבניס, קניון הגעש של פיירהולד, קרחוני אור הכוכבים של קריסטליה ומצודת השמיים של אתריון. בכל אחת יש עיר, טבע פרוצדורלי, עורקי עפרה, צמחים, עילית לילה ומבוך עם בוס רב-שלבי.
- **נפחות:** התכה, 16 שרטוטים ב-7 דרגות חומר, מיני-משחק פטיש הסדן (רגיל / משובח / יצירת מופת / **יצירת מופת עליונה** עם שם מותאם וחתימה), זיוף אוטומטי, חישול עד +10, 5 אבני יסוד ופירוק.
- **אלכימיה ובישול:** שיקויים, שמני להב יסודיים ל-3 דקות וארוחות חיזוק.
- **כלכלה חיה:** מדדי היצע וביקוש בכל עיר (70%-155%), פריחות ומחסורים מתחלפים וטיקר שוק חי.
- **בתים:** בית בכל עיר (500 עד 25,000 זהב) ומעצב רשת (`B`): כספת משותפת, סדן אישי, עמדות אלכימיה ובישול, מיטה מלכותית (+20% ניסיון), גביעי בוסים ומעמדים שמציגים בדיוק את הציוד שלכם.
- **עולם חי:** מחזור יום ולילה של 24 דקות עם תאורה דינמית, גשם, סופות רעמים, סופות שלג ואפר, 4 גילדות עם דרגות ולוח משימות יומי.
- **סוף המשחק:** מבוך התהום האינסופי (קומות פרוצדורליות, מאפיינים, מרוץ בוסים כל 5 קומות, נקודות ביקורת וטבלת שיאים) וזירת הקולוסיאום (5 גביעים וגלים אינסופיים).
- **מוות הוגן:** שיגור חירום לעיר האחרונה. מאבדים 15% מהניסיון של הרמה הנוכחית (אף פעם לא רמה) ו-5% מהזהב. הציוד לעולם לא אובד.

### שליטה

| מקש | פעולה |
|---|---|
| `W A S D` / חיצים | תנועה |
| קליק שמאלי / `J` | קומבו התקפה בסיסית (מכוון אל הסמן) |
| קליק ימני / `Shift` | חסימה; לחיצה רגע לפני הפגיעה = **הדיפה מושלמת** |
| `Space` | גלגול התחמקות |
| `1`-`6` | כישורי חרב |
| `Q` | החלפת סט נשק |
| `R` / `Tab` | **SWITCH!** עם בן הלוויה |
| `E` / `F` | אינטראקציה, דיבור, איסוף, כניסה |
| `Z` `X` `C` | שימוש מהיר בפריטים |
| `I` / `K` / `M` / `H` | דמות, שליטה, אטלס, ספר הדרכה |
| `B` | מעצב הרשת (בתוך הבית) |
| `Esc` / `F5` / `F11` | השהיה, שמירה מהירה, מסך מלא |

### הרצה

נדרש **Node.js 18 ומעלה** (מומלץ 20 LTS) ו-npm. אין מודולים מקומיים ואין צורך ב-`node-gyp`.

```bash
npm install
```

```bash
npm run dev
```
פותח את המשחק בדפדפן בכתובת http://127.0.0.1:5173.

```bash
npm run electron:dev
```
מריץ את Vite ופותח את המשחק בחלון שולחני עם טעינה חמה.

```bash
npm start
```
בודק טיפוסים, בונה גרסת ייצור ומריץ אותה ב-Electron.

```bash
npm run build
```
מריץ `tsc --noEmit` ואז `vite build` לתיקיית `dist/` (המשחק ב-`/` והוויקי ב-`/wiki/`).

השמירות נשמרות ב-`localStorage` (שלוש משבצות ושמירה אוטומטית), ו-Electron שומר אותן בתיקיית נתוני המשתמש.

### ארכיטקטורה

- `src/types/game.ts` הוא חוזה הטיפוסים המשותף לכל המודולים.
- סימולציה קבועה ב-60 הרץ עם הקפאת פגיעה לכל ישות והאטת זמן גלובלית.
- **ללא `shadowBlur`**: כל זוהר, הילה ואור נוצר מספרייטים של מעברי צבע רדיאליים שנשמרו מראש, עם חיבור צבעים; התאורה הלילית היא מפת אור בחצי רזולוציה.
- אריחים, קירות ואביזרים מצוירים פעם אחת לכל ממלכה; הקרקע הסטטית נאפית לנתחים של 8×8 אריחים, כך שבכל פריים מצוירות כ-20 תמונות במקום כ-800 אריחים.
- מיון לפי ציר Y (אלגוריתם הצייר) לקירות, אביזרים, דמויות, קליעים ושלל.
- התנגשות AABB מחליקה בדיוק תת-פיקסלי: קודם ציר X ואז Y, עם דחיפה של 4 פיקסלים בפינות.

### פריסה

`.github/workflows/deploy-wiki.yml` בונה את גרסת הדפדפן בכל דחיפה ל-`main` ומפרסם את `dist/` (המשחק והוויקי הדו-לשוני) ב-GitHub Pages.

### קרדיטים

משחק מקורי. כל הדמויות, המקומות, הכישורים, הגרפיקה, המוזיקה והצלילים מקוריים ונוצרים בקוד. מופץ תחת רישיון MIT.

</div>
