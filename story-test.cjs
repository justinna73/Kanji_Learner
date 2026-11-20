const assert = require('assert');
class ClassList {
  constructor(e){this.e=e;}
  _get(){return new Set((this.e.className||'').split(/\s+/).filter(Boolean));}
  contains(x){return this._get().has(x);}
  toggle(x,force){const s=this._get();let v=force===undefined?!s.has(x):force;v?s.add(x):s.delete(x);this.e.className=[...s].join(' ');return v;}
  remove(x){this.toggle(x,false);}
}
class E {
  constructor(tag='div'){this.tag=tag;this.children=[];this.parent=null;this.dataset={};this.attrs={};this.className='';this.classList=new ClassList(this);this.listeners={};this.value='';this.textContent='';this.disabled=false;this._html='';}
  set innerHTML(h){this._html=h;this.children=[];
    for(const m of h.matchAll(/<([a-z]+)\b([^>]*)>/gi)){
      const [,tag,attr]=m; const id=attr.match(/\bid="([^"]+)"/); const story=attr.match(/data-story-index="([^"]+)"/); const chapter=attr.match(/data-chapter-index="([^"]+)"/); const flag=attr.match(/data-flag="([^"]+)"/);const go=attr.match(/data-go-kanji="([^"]+)"/);const set=attr.match(/data-story-set="([^"]+)"/);const cls=attr.match(/class="([^"]+)"/);
      if(id||story||chapter||flag||go||set||(cls&&['story-listen-here','story-jp'].some(n=>cls[1].split(' ').includes(n)))){const c=new E(tag);if(id)c.attrs.id=id[1];if(story)c.dataset.storyIndex=story[1];if(chapter)c.dataset.chapterIndex=chapter[1];if(go){c.dataset.goKanji=go[1];c.dataset.setNumber=attr.match(/data-set-number="([^"]+)"/)?.[1];}if(set)c.dataset.storySet=set[1];if(flag){c.dataset.flag=flag[1];c.dataset.status=attr.match(/data-status="([^"]+)"/)?.[1];}if(cls)c.className=cls[1];this.appendChild(c);}
    }
  }
  get innerHTML(){return this._html;}
  appendChild(c){c.parent=this;this.children.push(c);return c;}
  append(...cs){cs.forEach(c=>this.appendChild(c));}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,f){(this.listeners[k]??=[]).push(f);}
  fire(k,extra={}){let e={target:this,currentTarget:this,stopPropagation(){},...extra};for(const f of this.listeners[k]||[])f(e);if(this['on'+k])this['on'+k](e);}
  closest(selector){if(selector[0]==='.'&&this.classList.contains(selector.slice(1)))return this;return this.parent?.closest(selector)||null;}
  querySelectorAll(sel){const out=[];const match=e=> sel[0]==='#'?e.attrs.id===sel.slice(1):sel==='[data-flag]'?'flag'in e.dataset:sel==='[data-go-kanji]'?'goKanji'in e.dataset:sel==='[data-story-set]'?'storySet'in e.dataset:sel==='[data-story-index]'?'storyIndex'in e.dataset:sel==='[data-chapter-index]'?'chapterIndex'in e.dataset:sel[0]==='.'?sel.slice(1).split('.').every(c=>e.classList.contains(c)):e.tag===sel;
    const visit=e=>{for(const c of e.children){if(match(c))out.push(c);visit(c)}};visit(this);return out;}
  querySelector(sel){return this.querySelectorAll(sel)[0]||null;}
}
global.window=global;
global.document={createElement:t=>new E(t),createTextNode:t=>{const n=new E('#text');n.textContent=t;return n;}};
global.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
const spoken=[];let cancelled=0, resumed=0, paused=0;
global.speechSynthesis={getVoices:()=>[{lang:'ja-JP'}],cancel(){cancelled++;},speak(u){spoken.push(u);},pause(){paused++;},resume(){resumed++;}};
require('./content.js');require('./content-ko.js');window.KANJI_DATA.stories[0].translationKo='한국어 번역 첫 문단입니다.';window.KANJI_DATA.stories[1].translationKo='두 번째 이야기의 전체 번역입니다.';require('./story-ui.js');
const root=new E();const flags={};
const ui=window.createStoryUI({data:window.KANJI_DATA,root,onFlag:(c,s)=>{flags[c]=s;ui.refresh()},getStatus:c=>flags[c]});
const get=s=>root.querySelector(s);
assert(get('.story-jp').classList.contains('show-furigana'),'등록된 후리가나는 기본 표시됩니다');
const search=get('#story-search');
for(const query of ['1','1세트','１ 세트']){search.value=query;search.fire('input');assert.equal((get('#story-search-results').innerHTML.match(/1세트/g)||[]).length,2,'세트 번호로 두 이야기를 찾습니다');assert(!get('#story-search-results').innerHTML.includes('회 등장'),'세트 번호 검색은 등장 횟수로 표시하지 않습니다');}
get('#translation-toggle').fire('click');assert.equal(get('#story-ko').hidden,false);assert(get('#story-content').innerHTML.includes('한국어 번역 첫 문단입니다.'));
get('#story-search-results').querySelectorAll('[data-story-index]')[1].fire('click');assert(get('#story-content').innerHTML.includes('두 번째 이야기의 전체 번역입니다.'),'다른 이야기를 선택해도 번역 모드를 유지합니다');assert(get('#story-content').classList.contains('with-translation'));
get('#story-search-results').querySelectorAll('[data-story-index]')[0].fire('click');get('#translation-toggle').fire('click');assert.equal(get('#story-ko').hidden,true);
for(const q of ['巡','巡る','めぐる','meguru']){search.value=q;search.fire('input');assert.equal((get('#story-search-results').innerHTML.match(/1회 등장/g)||[]).length,2,`search ${q}`);}
const wrap=root.querySelectorAll('.story-word-wrap').find(e=>e.querySelector('[data-flag]')?.dataset.flag==='巡');assert(wrap,'target popup exists');
const word=wrap.querySelector('.story-word');word.fire('click');assert.equal(word.attrs['aria-expanded'],'true');
const buttons=wrap.querySelectorAll('[data-flag]');assert.equal(buttons.length,3);const flag=buttons[1];flag.fire('click');assert.equal(flags['巡'],'review');assert.equal(flag.attrs['aria-pressed'],'true');assert.equal(buttons[0].attrs['aria-pressed'],'false');assert(wrap.classList.contains('open'),'flagging preserves popup');
const play=get('#story-play');play.fire('click');assert.equal(spoken.length,1);assert(get('#story-position-count').textContent.startsWith('1 /'));
spoken.at(-1).onend();assert.equal(spoken.length,2);assert(get('#story-position-count').textContent.startsWith('2 /'));
get('#story-pause').fire('click');assert.equal(paused,1);play.fire('click');assert.equal(resumed,1);
const progress=get('#story-position');progress.value='5';progress.fire('input');assert.equal(spoken.length,3);assert(get('#story-position-count').textContent.startsWith('6 /'));
ui.stop();assert(cancelled>0);
window.KANJI_DATA.stories.push({title:'대상 시험',japanese:'巡る企画。巡る。',summary:'시험',targets:['企'],annotations:[{word:'企画',reading:'きかく',meaning:'기획'}]});
search.value='';search.fire('input');const last=get('#story-search-results').querySelectorAll('[data-story-index]').at(-1);last.fire('click');
const targetFlags=root.querySelectorAll('[data-flag]').map(e=>e.dataset.flag);assert(targetFlags.includes('巡')&&targetFlags.includes('企'),'all study kanji shown, including other sets');
search.value='巡';search.fire('input');assert(get('#story-search-results').innerHTML.includes('대상 시험'),'search sees non-target text across stories');assert(get('#story-search-results').innerHTML.includes('2회 등장'),'search counts repeated hits');
window.KANJI_DATA.stories.push({title:'둘째 세트 두 번째',japanese:'企画。',summary:'시험',targets:['企']},{title:'셋째 세트 첫 번째',japanese:'企画。',summary:'시험',targets:['企']},{title:'셋째 세트 두 번째',japanese:'企画。',summary:'시험',targets:['企']});
search.value='3';search.fire('input');assert.equal((get('#story-search-results').innerHTML.match(/3세트/g)||[]).length,2,'숫자 3으로 세 번째 세트의 두 이야기만 찾습니다');assert(!get('#story-search-results').innerHTML.includes('둘째 세트'));
for(const file of ['novel-series.js','novel-groups.js','novel-prologues.js','novel-target-lines.js','novel-furigana.js'])require('./'+file);
const novelRoot=new E();window.createStoryUI({data:window.KANJI_DATA,root:novelRoot,onFlag(){},getStatus(){}});
const novelGet=s=>novelRoot.querySelector(s), novelSearch=novelGet('#story-search');
assert(novelGet('#story-content').innerHTML.includes('第一章'),'new series opens first');
for(const set of ['1','2','3','4','5']){novelSearch.value=set;novelSearch.fire('input');assert.equal((novelGet('#story-search-results').innerHTML.match(/1~5세트/g)||[]).length,5,`set ${set} finds all five chapters`);}
assert.equal(novelGet('#story-content').querySelectorAll('[data-chapter-index]').length,5);
novelGet('#story-content').querySelectorAll('[data-chapter-index]')[2].fire('click');
assert(novelGet('#story-content').innerHTML.includes('第三章'),'chapter navigation works');
const makeChar=char=>({char,meaning:'뜻',words:[]});
const crossData={kanji:[makeChar('巡'),...Array.from({length:24},(_,i)=>makeChar(`dummy${i}`)),makeChar('嵐')],stories:[
  {title:'첫 이야기',japanese:'巡回嵐空。',summary:'',setNumber:1,targets:['巡'],annotations:[{word:'巡回',reading:'じゅんかい',meaning:'순회'}],furiganaSpans:[[0,'巡','じゅん'],[1,'回','かい'],[2,'嵐','あらし'],[3,'空','そら']]},
  {title:'둘째 이야기',japanese:'嵐。',summary:'',setNumber:2,targets:['嵐'],furiganaSpans:[[0,'嵐','あらし']]}
]};
const crossRoot=new E();let navigated;
window.createStoryUI({data:crossData,root:crossRoot,onFlag(){},getStatus(){},onNavigateKanji:args=>{navigated=args;}});
const crossGet=s=>crossRoot.querySelector(s);
const compound=crossRoot.querySelectorAll('.story-word-wrap').find(e=>e.querySelector('.story-word')?.innerHTML.includes('巡回'));
assert(compound,'registered compound remains one word even when automatic reading is split');assert(compound.querySelector('.story-word').innerHTML.includes('じゅんかい'));assert(compound.querySelector('.story-word-popover').innerHTML.includes('순회'));
const stormLink=crossRoot.querySelectorAll('[data-go-kanji]').find(e=>e.dataset.goKanji==='嵐');
assert(stormLink,'other set character is linked');assert.equal(stormLink.dataset.setNumber,'2');stormLink.fire('click');assert.deepEqual(navigated,{char:'嵐',setNumber:2});
assert(crossRoot.querySelectorAll('.story-word').some(e=>e.classList.contains('story-reading-only')),'reading without study kanji is not highlighted');
const options=crossGet('#story-set-options');
options.fire('change',{target:{dataset:{storySet:'1'},checked:true}});
assert(crossGet('#story-search-results').innerHTML.includes('첫 이야기'));assert(!crossGet('#story-search-results').innerHTML.includes('둘째 이야기'));
options.fire('change',{target:{dataset:{storySet:'2'},checked:true}});
assert(crossGet('#story-search-results').innerHTML.includes('둘째 이야기'));
crossGet('#story-search').value='둘째';crossGet('#story-search').fire('input');
assert(!crossGet('#story-search-results').innerHTML.includes('첫 이야기'));assert(crossGet('#story-search-results').innerHTML.includes('둘째 이야기'));
crossGet('#story-set-reset').fire('click');assert.equal(crossGet('#story-set-summary').textContent,'이야기 세트 선택 · 전체');
console.log('Story search, multi-set selection, cross-set navigation, popup flagging, and playback passed');
