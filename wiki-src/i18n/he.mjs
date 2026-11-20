// Hebrew dictionary for the code-synced wiki data. Keys are the exact English strings emitted by
// wiki-src/data-entry.ts; scripts/build-wiki-data.mjs fails the build when any string is missing.
// he-legacy.json holds the translations carried over from the v3.0 hand-written wiki.
import { readFileSync } from 'node:fs';
import items from './he-items.mjs';
import gear from './he-gear.mjs';
import skills from './he-skills.mjs';
import bestiary from './he-bestiary.mjs';
import world from './he-world.mjs';

const legacy = JSON.parse(readFileSync(new URL('./he-legacy.json', import.meta.url), 'utf-8'));

export default {
  strings: { ...legacy, ...items, ...gear, ...skills, ...bestiary, ...world },

  /** templated descriptions: [regex, replacement | (match, heOf) => string] */
  patterns: [
    [/^Raw material mined from veins in Realm (\d)\. Smelt it into ingots at any forge\.$/, 'חומר גלם שנכרה מעורקי מתכת בממלכה $1. התיכו אותו למטילים בכל נפחייה.'],
    [/^Refined (.+)-tier metal used by every forge blueprint of that tier\.$/, (m, heOf) => `מתכת מזוקקת בדרגת ${heOf(m[1])}, המשמשת את כל שרטוטי הנפחייה בדרגה זו.`],
    [/^A reagent herb gathered in Realm (\d)\. Used in alchemy and cooking\.$/, 'עשב מרפא שנאסף בממלכה $1. משמש באלכימיה ובבישול.'],
    [/^Defeat (?:the )?(.+)\.$/, (m, heOf) => `הביסו את ${heOf(m[1])}.`],
  ],

  /** procedural gear names: "<label> מ<tier>"; Mythic agrees with the noun (f / m / p = plural) */
  gear: {
    special: {
      'a_coat:4': { he: 'מעיל הדו-קרבן של רדת הלילה', g: 'm' },
      'a_plate:5': { he: 'שריון האבירים של אגיס השנהב', g: 'm' },
      'a_shield:6': { he: 'מגן המגדל הטמפלרי', g: 'm' },
      'a_robe:6': { he: 'גלימת ריבון האתר', g: 'f' },
      'w_sword:6': { he: 'להב עצם הדרקון האתרי', g: 'm' },
    },
    mythicChest: 'שריון הדרקון האתרי המיתי',
    gender: {
      Longsword: 'f', 'Twin Edge': 'm', Spear: 'f', Halberd: 'm', Longbow: 'f', 'Arcane Staff': 'm',
      Helm: 'f', Hood: 'm', Circlet: 'm', Brigandine: 'm', 'Duelist Coat': 'm', 'Knight Plate': 'm', 'Arcane Robe': 'f',
      Greaves: 'p', Cloak: 'f', Buckler: 'm', 'Kite Shield': 'm', 'Tower Aegis': 'm',
    },
  },
};
