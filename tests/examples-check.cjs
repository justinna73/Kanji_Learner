const assert=require('assert');global.window=global;
require('../content.js');require('../content-ko.js');
for(let n=2;n<=45;n++)require(`../extra-set-${String(n).padStart(2,'0')}.js`);
require('../example-sentences.js');require('../example-manual.js');
const entries=KANJI_DATA.kanji.flatMap(k=>k.words),missing=entries.filter(w=>!KANJI_EXAMPLES[w.word]);
for(const k of [...KANJI_DATA.kanji.slice(0,25),...KANJI_DATA.kanji.slice(125,150)])for(const w of k.words)assert(KANJI_EXAMPLES[w.word],`missing priority example ${w.word}`);
for(const e of Object.values(KANJI_EXAMPLES))assert(typeof e.sentence==='string'&&/[。！？]$/.test(e.sentence)&&[...e.sentence].length<=85);
console.log(`${entries.length-missing.length} / ${entries.length} word entries have examples; ${missing.length} still missing`);
