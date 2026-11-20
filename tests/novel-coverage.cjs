const assert = require('assert');
const path = require('path');
const root = path.resolve(__dirname, '..');
global.window = global;
require(path.join(root, 'content.js'));
require(path.join(root, 'content-ko.js'));
for (let n=2; n<=45; n++) require(path.join(root, `extra-set-${String(n).padStart(2,'0')}.js`));
for (let n=1; n<=3; n++) require(path.join(root, `story-ko-${String(n).padStart(2,'0')}.js`));
for (const file of ['novel-series.js','novel-groups.js','novel-prologues.js','novel-target-lines.js','novel-furigana.js']) require(path.join(root,file));
const stories = window.KANJI_DATA.stories.filter(s=>s.seriesId);
assert.equal(stories.length,45,'nine five-chapter arcs');
for (let set=1; set<=45; set++) assert.equal(stories.filter(s=>s.setNumber===set).length,1,`set ${set} has a chapter`);
for (let group=0;group<9;group++) {
  const arc=stories.slice(group*5,group*5+5);
  assert.equal(new Set(arc.map(s=>s.seriesId)).size,1,'arc has one series id');
  const length=arc.reduce((n,s)=>n+[...s.japanese].length,0);
  assert(length>=1750&&length<=2200,`arc ${group+1} length ${length}`);
  for(const s of arc) {
    assert(s.translationKo.length>100,`translation missing ${s.seriesId}/${s.chapter}`);
    assert(!/[가-힣]/.test(s.japanese),`Korean leaked into Japanese ${s.seriesId}/${s.chapter}`);
    assert([...s.japanese].some(c=>s.targets.includes(c)),`set vocabulary missing ${s.seriesId}/${s.chapter}`);
    const covered=new Uint8Array(s.japanese.length);
    for(const [start,surface,reading] of s.furiganaSpans) {
      assert.equal(s.japanese.slice(start,start+surface.length),surface,`span mismatch ${s.seriesId}/${s.chapter}`);
      assert(reading,`reading missing ${s.seriesId}/${s.chapter}`);
      for(let i=start;i<start+surface.length;i++) covered[i]=1;
    }
    for(let i=0;i<s.japanese.length;i++) if (/[\u3400-\u9fff\uf900-\ufaff]/.test(s.japanese[i]))
      assert(covered[i],`kanji without contextual furigana: ${s.seriesId}/${s.chapter} ${s.japanese[i]} at ${i}`);
  }
}
console.log('45 chapters across 9 arcs: length, translations, and kanji reading coverage passed');
