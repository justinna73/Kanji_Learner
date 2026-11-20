const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const dir=path.join(__dirname,'..'),html=fs.readFileSync(path.join(dir,'0.open this.html'),'utf8');
const files=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>f==='content.js'||f==='content-ko.js'||/^extra-set-\d+\.js$/.test(f)||/^story-ko-\d+\.js$/.test(f));
const window={},ctx=vm.createContext({window});files.forEach(f=>vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f}));
assert.equal(window.KANJI_DATA.stories.length,90);
window.KANJI_DATA.stories.forEach((s,i)=>{
  assert(typeof s.translationKo==='string'&&/[가-힣]/.test(s.translationKo),`story ${i+1}: missing Korean translation`);
  const jp=s.japanese.trim().split(/\n\s*\n/),ko=s.translationKo.trim().split(/\n\s*\n/);
  assert.equal(ko.length,jp.length,`story ${i+1}: paragraph count`);
  const ratio=s.translationKo.replace(/\s/g,'').length/s.japanese.replace(/\s/g,'').length;
  assert(ratio>=0.35&&ratio<=1.8,`story ${i+1}: unusual translation length ${ratio.toFixed(2)}`);
});
console.log('90편의 한국어 번역, 문단 수와 분량 확인 완료');
