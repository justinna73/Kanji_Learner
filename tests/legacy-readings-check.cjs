const assert=require('assert');
global.window=global;require('../content.js');require('../content-ko.js');
for(let n=2;n<=45;n++)require(`../extra-set-${String(n).padStart(2,'0')}.js`);
for(let n=1;n<=3;n++)require(`../story-ko-${String(n).padStart(2,'0')}.js`);
require('../legacy-furigana.js');
const data=window.KANJI_DATA, study=new Set(data.kanji.map(k=>k.char));
assert.equal(data.stories.length,90);
let chars=0;
data.stories.forEach((story,index)=>{
  const covered=new Uint8Array(story.japanese.length);let end=0;
  for(const [at,word,reading] of story.furiganaSpans){assert(at>=end,`overlap ${index+1}`);assert.equal(story.japanese.slice(at,at+word.length),word);assert(reading);end=at+word.length;for(let i=at;i<end;i++)covered[i]=1;}
  for(let i=0;i<story.japanese.length;i++)if(study.has(story.japanese[i])){chars++;assert(covered[i],`reading missing in story ${index+1}: ${story.japanese[i]} at ${i}`);}
});
for(const [index,word,reading] of [[0,'美咲','みさき'],[7,'颯太','そうた'],[63,'蒼太','そうた'],[68,'充塡','じゅうてん'],[76,'露','つゆ'],[82,'拉麺','らーめん']])assert(data.stories[index].furiganaSpans.some(x=>x[1]===word&&x[2]===reading),`${word} reading`);
console.log(`90 original stories: aligned reading spans cover ${chars} study-kanji occurrences`);
