// Builds the code-synced strategy wiki bundles from the game's source:
//   wiki/wiki-data.js   - window.AETHERIA_DATA: every item, monster, skill, recipe and realm (EN + HE)
//   wiki/wiki-engine.js - window.AetheriaEngine: the game's own procedural renderers and loot math
// Usage: node scripts/build-wiki-data.mjs [--allow-missing] [--report]
//   --allow-missing  write the bundles even if Hebrew strings are missing (drafting only)
//   --report         print every English string that still needs a Hebrew translation
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const cacheDir = join(root, 'node_modules', '.cache', 'aetheria-wiki');
mkdirSync(cacheDir, { recursive: true });

// ---------------------------------------------------------------- 1. extract the dataset from src/data
const entryOut = join(cacheDir, `data-entry-${Date.now()}.mjs`);
await build({
  entryPoints: [join(root, 'wiki-src', 'data-entry.ts')],
  outfile: entryOut,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  logLevel: 'warning',
});
const { buildDataset } = await import(pathToFileURL(entryOut).href);
const data = buildDataset();

// ---------------------------------------------------------------- 2. Hebrew
const he = (await import(pathToFileURL(join(root, 'wiki-src', 'i18n', 'he.mjs')).href)).default;
const missing = new Set();

function heOf(en) {
  if (Object.prototype.hasOwnProperty.call(he.strings, en)) return he.strings[en];
  for (const [re, rep] of he.patterns) {
    const m = en.match(re);
    if (m) return typeof rep === 'function' ? rep(m, heOf) : en.replace(re, rep);
  }
  missing.add(en);
  return en;
}

/** gear names: "<label> מ<tier>", special names whole, Mythic as a gendered trailing adjective */
function gearHe(g) {
  const base = data.gearBases.find((b) => b.id === g.base);
  const special = he.gear.special[`${g.base}:${g.tier}`];
  if (g.mythic && base.aslot === 'chest') return he.gear.mythicChest;
  let label = base.label.en;
  if (base.aslot === 'shield') label = g.tier <= 1 ? 'Buckler' : g.tier <= 3 ? 'Kite Shield' : 'Tower Aegis';
  const tierHe = heOf(data.tiers[g.tier].name.en);
  const nm = special ? special.he : `${heOf(label)} מ${tierHe}`;
  if (!g.mythic) return nm;
  const gender = special ? special.g : he.gear.gender[label];
  if (!gender) missing.add(`gender:${label}`);
  const adj = gender === 'f' ? 'מיתית' : gender === 'p' ? 'מיתיים' : 'מיתי';
  // special names are definite constructs, so the adjective takes the definite article too
  return special ? `${nm} ה${adj}` : `${nm} ${adj}`;
}
for (const g of data.gear) g.name.he = gearHe(g);

function walk(o) {
  if (Array.isArray(o)) {
    o.forEach(walk);
    return;
  }
  if (!o || typeof o !== 'object') return;
  if (typeof o.en === 'string' && Object.keys(o).every((k) => k === 'en' || k === 'he' || k === 'parts' || k === 'sep')) {
    if (o.he === undefined) o.he = o.parts ? o.parts.map(heOf).join(o.sep ?? ' ') : heOf(o.en);
    delete o.parts;
    delete o.sep;
    return;
  }
  for (const v of Object.values(o)) walk(v);
}
walk(data);

// ---------------------------------------------------------------- 3. guides, builds & tier lists (bilingual content, validated against the data)
const content = { ...(await import(pathToFileURL(join(root, 'wiki-src', 'content', 'builds.mjs')).href)).default };
content.notes = (await import(pathToFileURL(join(root, 'wiki-src', 'content', 'notes.mjs')).href)).default;
const ids = {
  skill: new Set(data.skills.map((s) => s.id)),
  passive: new Set(data.passives.map((s) => s.id)),
  keystone: new Set(data.keystones.map((s) => s.id)),
  bridge: new Set(data.bridges.map((s) => s.id)),
  unique: new Set(data.uniques.map((s) => s.id)),
  set: new Set(data.sets.map((s) => s.id)),
  power: new Set(data.powers.map((s) => s.id)),
  item: new Set(data.items.map((s) => s.id)),
  monster: new Set(data.monsters.map((s) => s.id)),
  pet: new Set(data.pets.map((s) => s.id)),
  mount: new Set(data.mounts.map((s) => s.id)),
  companion: new Set(data.companions.map((s) => s.id)),
  gambit: new Set(data.gambits.map((s) => s.id)),
  gem: new Set(data.gems.map((s) => s.id)),
  base: new Set(data.gearBases.map((s) => s.id)),
  branch: new Set(data.branches.map((s) => s.id)),
  reaction: new Set(data.reactions.map((s) => s.id)),
  morph: new Set(data.morphs.map((s) => s.kind)),
  piece: new Set(data.sets.flatMap((s) => s.pieces.map((_p, i) => `${s.id}#${i}`))),
};
const bad = [];
function checkRefs(o, path) {
  if (Array.isArray(o)) return o.forEach((v, i) => checkRefs(v, `${path}[${i}]`));
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    const kind = k.replace(/s$/, '');
    if (ids[kind] && !(v && typeof v === 'object' && !Array.isArray(v))) {
      for (const id of Array.isArray(v) ? v : [v]) if (typeof id === 'string' && !ids[kind].has(id)) bad.push(`${path}.${k}: unknown ${kind} "${id}"`);
    } else checkRefs(v, `${path}.${k}`);
  }
}
checkRefs(content, 'content');
function checkLang(o, path) {
  if (Array.isArray(o)) return o.forEach((v, i) => checkLang(v, `${path}[${i}]`));
  if (!o || typeof o !== 'object') return;
  if ('en' in o || 'he' in o) {
    if (typeof o.en !== 'string' || typeof o.he !== 'string' || !o.en.trim() || !o.he.trim()) bad.push(`${path}: needs both en and he`);
    return;
  }
  for (const [k, v] of Object.entries(o)) checkLang(v, `${path}.${k}`);
}
checkLang(content, 'content');
for (const x of [...data.monsters, ...data.uniques, ...data.sets]) if (!content.notes[x.id]) bad.push(`content.notes: missing tactical note for "${x.id}"`);
for (const id of Object.keys(content.notes)) if (!ids.monster.has(id) && !ids.unique.has(id) && !ids.set.has(id)) bad.push(`content.notes: unknown id "${id}"`);
data.content = content;

if (missing.size) {
  console.error(`\n${missing.size} string(s) have no Hebrew translation:`);
  if (args.has('--report') || missing.size <= 60) for (const s of missing) console.error('  ' + JSON.stringify(s));
}
if (bad.length) {
  console.error(`\n${bad.length} content problem(s):`);
  for (const b of bad) console.error('  ' + b);
}
if ((missing.size && !args.has('--allow-missing')) || bad.length) {
  console.error('\nwiki-data.js was NOT written.');
  process.exit(1);
}

// ---------------------------------------------------------------- 4. write wiki/wiki-data.js
data.generated = new Date().toISOString().slice(0, 10);
const counts = {
  items: data.items.length, gear: data.gear.length, uniques: data.uniques.length, sets: data.sets.length,
  setPieces: data.sets.reduce((s, x) => s + x.pieces.length, 0), monsters: data.monsters.length, skills: data.skills.length,
  passives: data.passives.length, recipes: data.recipes.length, realms: data.realms.length, achievements: data.achievements.length,
};
data.counts = counts;
const banner = '/* Generated by scripts/build-wiki-data.mjs from src/data - do not edit by hand. */\n';
writeFileSync(join(root, 'wiki', 'wiki-data.js'), banner + 'window.AETHERIA_DATA = ' + JSON.stringify(data) + ';\n');

// ---------------------------------------------------------------- 5. bundle the procedural engine
await build({
  entryPoints: [join(root, 'wiki-src', 'engine.ts')],
  outfile: join(root, 'wiki', 'wiki-engine.js'),
  bundle: true,
  format: 'iife',
  globalName: 'AetheriaEngine',
  platform: 'browser',
  target: 'es2019',
  minify: true,
  legalComments: 'none',
  banner: { js: '/* Generated by scripts/build-wiki-data.mjs: the game\'s own renderers and loot math for the wiki. */' },
  logLevel: 'warning',
});

const size = (f) => (readFileSync(join(root, 'wiki', f)).length / 1024).toFixed(0) + ' KB';
console.log(`wiki-data.js ${size('wiki-data.js')}, wiki-engine.js ${size('wiki-engine.js')}`);
console.log(Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '));
if (missing.size) console.log(`(drafting build: ${missing.size} untranslated strings)`);
void existsSync;
