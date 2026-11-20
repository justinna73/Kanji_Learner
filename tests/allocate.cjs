const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const dir=path.join(__dirname,'..'),html=fs.readFileSync(path.join(dir,'0.open this.html'),'utf8');
// Freeze the allocation against the first 12 sets; later sets come from this plan.
const files=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]).filter(f=>f==='content.js'||f==='content-ko.js'||(/^extra-set-\d+\.js$/.test(f)&&Number(f.match(/\d+/)[0])<=12));
const window={},ctx=vm.createContext({window});files.forEach(f=>vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx));
const reference=[...fs.readFileSync(path.join(__dirname,'secondary-kanji.txt'),'utf8').trim()],used=new Set(window.KANJI_DATA.kanji.map(k=>k.char));
// Two sets already being authored when the allocation was created.
const reserved={13:'炊煮煎餓飢腐酪肪脂菓昆旬甘辛臭膳杯膨飽鍋旨嗅麺稼販',14:'駆蹴俊敏敢忍耐鍛騎疾拳掌鎖妨崩戴脚盾砕棋碁盤矯勲賜'};
for(const chars of Object.values(reserved))for(const c of chars){assert(reference.includes(c)&&!used.has(c),`invalid or duplicate ${c}`);used.add(c);}
const pool=reference.filter(c=>!used.has(c));
// Reproducible shuffle mixes entries rather than grouping by stroke count.
let seed=20261109;for(let i=pool.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
const sets=[];for(let i=0;i<pool.length;i+=25)sets.push({set:15+i/25,characters:pool.slice(i,i+25).join('')});
assert.equal(used.size+pool.length,1110);assert.equal(sets.at(-1).characters.length,10);
fs.writeFileSync(path.join(dir,'set-plan.json'),JSON.stringify({scope:'elementary-excluded joyo',source:'https://ieben.net/tyuu-kanji/list-zen/',total:1110,reserved,sets},null,2)+'\n','utf8');
console.log(`${used.size} completed or reserved; ${pool.length} allocated to ${sets.length} sets; total 1110.`);
