/* Visual component data are from KanjiVG; historical roles are stated only where provided. */
window.createMnemonicUI = function createMnemonicUI() {
  const meanings=window.KANJI_COMPONENT_MEANINGS||{}, structures=window.KANJI_COMPONENT_STRUCTURE||{}, hanja=window.KOREAN_HANJA_READINGS||{};
  const byChar=new Map((window.KANJI_DATA?.kanji||[]).map(k=>[k.char,k]));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const positions={left:'왼쪽',right:'오른쪽',top:'위쪽',bottom:'아래쪽',tare:'왼쪽과 위를 둘러싼 부분',nyou:'아래를 둘러싼 부분',kamae:'둘러싼 부분',soto:'바깥쪽',inside:'안쪽'};
  let displayedChar=null,expanded=false,activeCard=null;
  function selectChar(char){if(displayedChar!==char){displayedChar=char;expanded=false;activeCard=null;}}
  function meaningFor(p) {
    const c=p.original||p.char;
    return meanings[c]||meanings[p.char]||hanja[c]?.labels?.join(' · ')||hanja[p.char]?.labels?.join(' · ')||byChar.get(c)?.meaning||byChar.get(p.char)?.meaning||'';
  }
  function renderPart(p,ancestors,depth){
    const where=positions[p.position]||'구성 부분',shape=p.original&&p.original!==p.char?`${p.char} (기본 모양: ${p.original})`:p.char;
    const meaning=meaningFor(p),role=p.phon?'이 부분은 자료에서 소리와 관련된 요소로 표시합니다.':'';
    const line=`<span class="component-shape">${esc(where)} <b lang="ja">${esc(shape)}</b></span><span>${meaning?`부품의 뜻: ${esc(meaning)}`:'부품의 뜻은 확인되지 않았습니다.'}</span>${role?`<span>${esc(role)}</span>`:''}`;
    const children=(structures[p.char]||[]).filter(x=>x.char!==p.char&&!ancestors.has(x.char));
    if(!children.length||depth>=8)return `<li class="component-node">${line}</li>`;
    const next=new Set(ancestors);next.add(p.char);
    return `<li class="component-node">${line}<details class="component-inner"><summary>${esc(p.char)}을 더 작게 보기</summary><ul>${children.map(c=>renderPart(c,next,depth+1)).join('')}</ul></details></li>`;
  }
  function view(k){
    selectChar(k.char);activeCard=null;
    const parts=structures[k.char]||[];
    return `<details class="mnemonic-card" ${expanded?'open':''}><summary class="mnemonic-heading"><span class="detail-label">글자 이야기 · ${esc(k.char)}</span><span class="mn-badge">구성과 뜻 <span class="mn-toggle"></span></span></summary><div class="mnemonic-content"><strong class="mn-caption">어떻게 생겼을까요?</strong>${parts.length?`<ul class="component-tree">${parts.map(p=>renderPart(p,new Set([k.char]),0)).join('')}</ul>`:'<p class="mn-origin">더 작은 구성 부분은 자료에서 확인되지 않았습니다.</p>'}${k.char==='肌'?'<p class="mn-origin">肌의 月은 몸을 뜻하는 肉의 변형이고, 几는 이 글자에서 소리와 관련됩니다. 几 자체는 안석을 뜻합니다.</p>':''}<p class="component-source">구성 모양: <a href="https://kanjivg.tagaini.net/" target="_blank" rel="noopener noreferrer">KanjiVG</a></p></div></details>`;
  }
  function bind(root,char){selectChar(char);const card=root.querySelector('.mnemonic-card');activeCard=card;card?.addEventListener('toggle',()=>{if(activeCard===card&&displayedChar===char)expanded=card.open;});}
  return {view,bind};
};
