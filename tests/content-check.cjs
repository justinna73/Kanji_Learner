const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const dir=path.join(__dirname,'..'),html=fs.readFileSync(path.join(dir,'0.open this.html'),'utf8');
const files=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]).filter(f=>f==='content.js'||f==='content-ko.js'||/^extra-set-\d+\.js$/.test(f));
const window={},context=vm.createContext({window});
files.forEach(f=>vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),context,{filename:f}));
const d=window.KANJI_DATA,unique=new Set(d.kanji.map(k=>k.char));
assert.equal(unique.size,d.kanji.length,'duplicate kanji');
const secondary=new Set([...fs.readFileSync(path.join(__dirname,'secondary-kanji.txt'),'utf8').trim()]);
assert.equal(secondary.size,1110,'secondary reference count');
assert(d.kanji.every(k=>secondary.has(k.char)),`outside secondary list: ${d.kanji.filter(k=>!secondary.has(k.char)).map(k=>k.char).join(' ')}`);
const plan=JSON.parse(fs.readFileSync(path.join(dir,'set-plan.json'),'utf8'));
for(const entry of plan.sets){const actual=d.kanji.slice((entry.set-1)*25,entry.set*25).map(k=>k.char);if(actual.length)assert.equal(actual.join(''),entry.characters,`set ${entry.set}: allocated characters differ`);}
for(const k of d.kanji){assert.equal(k.words.length,2,`${k.char}: two words required`);for(const w of k.words)assert(w.word.includes(k.char)&&w.reading&&w.meaning,`${k.char}: incomplete word`);assert(k.writing&&k.meaning&&k.strokes,`${k.char}: incomplete entry`);}
for(const [i,s] of d.stories.entries()){
 const targets=s.targets||d.kanji.slice(0,25).map(k=>k.char),targetSet=new Set(targets);
 const length=[...s.japanese.replace(/\s/g,'')].length;
 assert(length>=800&&length<=1200,`story ${i+1}: unexpected length ${length}`);
 const expected=d.kanji.slice(Math.floor(i/2)*25,Math.floor(i/2)*25+25).map(k=>k.char);
 assert.equal(targetSet.size,expected.length,`story ${i+1}: wrong target count`);
 assert(expected.every(c=>targetSet.has(c)),`story ${i+1}: targets do not match set`);
 assert(targets.every(c=>s.japanese.includes(c)),`story ${i+1}: missing targets`);
 const words=[...(s.annotations||[]),...(window.STORY_WORDS||[]),...d.kanji.flatMap(k=>k.words||[])].filter(w=>w.word&&w.reading&&w.meaning&&[...w.word].some(c=>targetSet.has(c))).sort((a,b)=>b.word.length-a.word.length);
 let p=0,unmatched=[];while(p<s.japanese.length){const w=words.find(w=>s.japanese.startsWith(w.word,p));if(w){if(!w.pronunciation)unmatched.push(`${w.word}(발음 없음)`);p+=w.word.length;}else{const c=String.fromCodePoint(s.japanese.codePointAt(p));if(targetSet.has(c))unmatched.push(c);p+=c.length;}}
 assert.equal(unmatched.length,0,`story ${i+1}: ${unmatched.join(', ')}`);
 console.log(`${i+1}. ${s.title}: ${targets.length}자, ${s.japanese.replace(/\s/g,'').length}자 분량, 주석 확인`);
}
assert.equal(d.stories.length,Math.ceil(d.kanji.length/25)*2,'each set must have two stories');
console.log(`한자 ${d.kanji.length}자, 단어 ${d.kanji.length*2}개, 이야기 ${d.stories.length}편 확인`);
