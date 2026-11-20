(() => {
  'use strict';
  const data = window.KANJI_DATA, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const mnemonics = window.createMnemonicUI();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const byChar = new Map(data.kanji.map(k => [k.char,k]));
  function koreanHanjaLabel(char) {
    const entry=window.KOREAN_HANJA_READINGS?.[char];
    if(entry?.labels?.length)return `한국 한자 음훈: ${entry.labels.join(' · ')}${entry.variant?` (한국 한자 ${entry.variant} 기준)`:''}`;
    if(entry?.readings?.length)return `한국 한자음: ${entry.readings.join(' · ')} · 훈은 확인되지 않음`;
    return '한국 한자 음훈 확인되지 않음';
  }
  function readingBackground(k) {
    const special=k.char==='曇' ? '<p><b>くもる:</b> 일본어 사전에서는 구름을 뜻하는 くも를 동사로 활용한 말로 풀이합니다. <a href="https://kotobank.jp/word/%E6%9B%87%E3%82%8B-485265" target="_blank" rel="noopener noreferrer">사전 보기 ↗</a></p>' : '<p>이 글자의 개별 읽기가 생긴 자세한 과정은 아직 확인되지 않았습니다.</p>';
    return `<details class="reading-background"><summary>음독·훈독의 배경</summary><p>일반적으로 음독은 중국에서 전해진 한자음을 일본어 발음으로 받아들인 것이고, 훈독은 해당 뜻에 일본어 단어를 붙인 읽기입니다.</p>${special}<a href="https://www.mext.go.jp/a_menu/nihongo_kyoiku/kyoiku/seikatsusha/h25_nihongo_program_a/pdf/a_25.pdf" target="_blank" rel="noopener noreferrer">음독·훈독 설명 ↗</a></details>`;
  }
  const setCount = Math.ceil(data.kanji.length / 25);
  const setOptions = Array.from({length:setCount}, (_,i) => `<option value="${i}">${i+1}세트</option>`).join('');
  $('#set-select').innerHTML = setOptions + '<option value="all">전체 세트</option>';
  $('#card-set').innerHTML = setOptions + '<option value="all">전체 세트</option>';
  $('#write-set').innerHTML = setOptions + '<option value="all">전체 세트</option>';
  $('#set-select').value = '0';
  $('#card-set').value = '0'; $('#write-set').value = '0';
  let selectedCardSets = new Set([0]), selectedWriteSets = new Set([0]);
  const key = 'kanji-notebook-card-status-v2';
  const wordKey = 'kanji-notebook-word-status-v1', completeKey = 'kanji-notebook-completed-sets-v1';
  let statuses = {}, wordStatuses = {}, completedSets = {};
  try { const saved = JSON.parse(localStorage.getItem(key) || '{}'); if (saved && typeof saved === 'object') statuses = saved; } catch (_) {}
  try { wordStatuses = JSON.parse(localStorage.getItem(wordKey) || '{}') || {}; completedSets = JSON.parse(localStorage.getItem(completeKey) || '{}') || {}; } catch (_) {}
  let current = data.kanji[0]?.char, deck = [], batchSource = [], cardIndex = 0, revealed = false, storyUI, libraryFilter = 'all', batchOffset=0, availableCount=0;
  let hideExploreMeanings = false;
  const statusText = {practice:'모름',review:'복습 필요',later:'나중에',known:'익힘'};
  const idFor = (char,index) => `${char}:${index}`;
  const cardSetIncludes = i => selectedCardSets.has(Math.floor(i / 25));
  const writeSetIncludes = i => selectedWriteSets.has(Math.floor(i / 25));
  function renderCardSetPicker() {
    const count = selectedCardSets.size;
    $('#card-set-summary').textContent = count===setCount ? '전체 세트' : count===0 ? '세트 선택' : count===1 ? `${[...selectedCardSets][0]+1}세트` : `${count}개 세트 선택`;
    $('#card-set-summary').setAttribute('aria-label',`카드 학습 세트: ${$('#card-set-summary').textContent}`);
    $('#card-set-options').innerHTML = Array.from({length:setCount},(_,i)=>`<label class="card-set-option"><input type="checkbox" data-card-set="${i}" ${selectedCardSets.has(i)?'checked':''}> ${i+1}세트${completedSets[i]?' ✓':''}</label>`).join('');
    $('#card-set').value = count===setCount ? 'all' : count===1 ? String([...selectedCardSets][0]) : 'custom';
  }
  function updateCardSets() { renderCardSetPicker(); rebuildDeck(); renderCardLibrary(); }
  $('#card-set-options').onchange = e => {
    if (!e.target.matches('[data-card-set]')) return;
    const set = Number(e.target.dataset.cardSet);
    if (e.target.checked) selectedCardSets.add(set); else selectedCardSets.delete(set);
    updateCardSets();
    $('#card-set-options').querySelector(`[data-card-set="${set}"]`)?.focus();
  };
  $('#card-set-all').onclick = () => { selectedCardSets = new Set(Array.from({length:setCount},(_,i)=>i)); updateCardSets(); };
  $('#card-set-clear').onclick = () => { selectedCardSets.clear(); updateCardSets(); };
  function renderWriteSetPicker() {
    const count=selectedWriteSets.size;
    $('#write-set-summary').textContent=count===setCount?'전체 세트':count===0?'세트 선택':count===1?`${[...selectedWriteSets][0]+1}세트`:`${count}개 세트 선택`;
    $('#write-set-summary').setAttribute('aria-label',`쓰기 연습 세트: ${$('#write-set-summary').textContent}`);
    $('#write-set-options').innerHTML=Array.from({length:setCount},(_,i)=>`<label class="card-set-option"><input type="checkbox" data-write-set="${i}" ${selectedWriteSets.has(i)?'checked':''}> ${i+1}세트${completedSets[i]?' ✓':''}</label>`).join('');
    $('#write-set').value=count===setCount?'all':count===1?String([...selectedWriteSets][0]):'custom';
  }
  function updateWriteSets() { renderWriteSetPicker(); populateWriting(); }
  $('#write-set-options').onchange = e => {
    if (!e.target.matches('[data-write-set]')) return;
    const set=Number(e.target.dataset.writeSet);
    if(e.target.checked) selectedWriteSets.add(set); else selectedWriteSets.delete(set);
    updateWriteSets();
    $('#write-set-options').querySelector(`[data-write-set="${set}"]`)?.focus();
  };
  $('#write-set-all').onclick=()=>{selectedWriteSets=new Set(Array.from({length:setCount},(_,i)=>i));updateWriteSets();};
  $('#write-set-clear').onclick=()=>{selectedWriteSets.clear();updateWriteSets();};
  function shuffledCards(cards) {
    const groups = new Map();
    for (const card of cards) { if (!groups.has(card.char)) groups.set(card.char, []); groups.get(card.char).push(card); }
    for (const group of groups.values()) for(let i=group.length-1;i>0;i--) {const j=Math.floor(Math.random()*(i+1));[group[i],group[j]]=[group[j],group[i]];}
    const result=[]; let previous=null;
    while (result.length < cards.length) {
      const candidates=[...groups.entries()].filter(([char,group])=>group.length && char!==previous);
      const eligible=candidates.length ? candidates : [...groups.entries()].filter(([,group])=>group.length);
      const largest=Math.max(...eligible.map(([,group])=>group.length));
      const tied=eligible.filter(([,group])=>group.length===largest);
      const [char,group]=tied[Math.floor(Math.random()*tied.length)];
      result.push(group.pop()); previous=char;
    }
    return result;
  }
  const getWordStatus = (char,index) => Object.hasOwn(wordStatuses,idFor(char,index)) ? wordStatuses[idFor(char,index)] : (statuses[char] || null);
  function getCharStatus(char) { const all=byChar.get(char)?.words.map((_,i)=>getWordStatus(char,i)) || []; return ['practice','review','later','known'].find(s=>all.includes(s)) || null; }
  function charStatusLabel(char) { const all=[...new Set((byChar.get(char)?.words || []).map((_,i)=>getWordStatus(char,i)))]; return all.map(s=>statusText[s] || '안 담음').join(' / '); }
  const speak = text => {
    if (!('speechSynthesis' in window)) { alert('이 브라우저에서는 음성 읽기를 사용할 수 없습니다.'); return; }
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ja-JP'; utterance.rate = .8;
    const voice = speechSynthesis.getVoices().find(v => /^ja(-|_)/i.test(v.lang)); if (voice) utterance.voice = voice;
    speechSynthesis.cancel(); speechSynthesis.speak(utterance);
  };
  function searchMatch(k, q) { return !q || [k.char,k.meaning,k.onyomi,k.kunyomi,...k.words.flatMap(w => [w.word,w.reading,w.meaning])].join(' ').toLowerCase().includes(q.toLowerCase()); }
  function persist() {
    try { localStorage.setItem(key, JSON.stringify(statuses)); localStorage.setItem(wordKey,JSON.stringify(wordStatuses)); localStorage.setItem(completeKey,JSON.stringify(completedSets)); } catch (_) { $('#card-status').textContent = '이 브라우저에 저장하지 못했습니다.'; }
    const count = data.kanji.filter(k=>getCharStatus(k.char)).length;
    $('#progress-label').textContent = `카드에 담은 한자 ${count} / ${data.kanji.length}자`;
    $('#progress-bar').style.width = `${count / data.kanji.length * 100}%`;
  }
  function setStatus(char, value) {
    if (!byChar.has(char)) return;
    if (value) statuses[char] = value; else delete statuses[char];
    byChar.get(char).words.forEach((_,i)=>delete wordStatuses[idFor(char,i)]);
    persist(); renderGrid(); renderDetail(); renderCardLibrary(); rebuildDeck();
    if (storyUI && storyUI.refresh) storyUI.refresh();
  }
  function renderGrid() {
    const set = $('#set-select').value;
    const list = data.kanji.filter((k,i) => (set === 'all' || Math.floor(i / 25) === Number(set)) && searchMatch(k, $('#explore-search').value.trim()));
    $('#kanji-grid').innerHTML = list.length ? list.map(k => `<button class="kanji-tile tile-${getCharStatus(k.char)||'unselected'} ${k.char === current ? 'selected' : ''}" data-char="${esc(k.char)}" aria-label="${esc(k.char)}${hideExploreMeanings ? '' : ', '+esc(k.meaning)}, ${esc(charStatusLabel(k.char))}" title="${esc(charStatusLabel(k.char))}" aria-pressed="${k.char === current}"><strong lang="ja">${esc(k.char)}</strong>${hideExploreMeanings ? '' : `<small>${esc(k.meaning.split(/[,;]/)[0])}</small>`}</button>`).join('') : '<p class="hint">검색 결과가 없습니다.</p>';
    $('#kanji-grid').querySelectorAll('button').forEach(b => b.onclick = () => { current = b.dataset.char; renderGrid(); renderDetail(); });
  }
  function renderDetail() {
    const k = byChar.get(current); if (!k) return;
    const state=k.words.map((_,i)=>getWordStatus(k.char,i)), uniform=state.every(s=>s===state[0])?state[0]:'mixed';
    $('#kanji-detail').innerHTML = `<div class="detail-top"><span class="detail-char" lang="ja">${esc(k.char)}</span><div>${hideExploreMeanings ? '<h4>뜻 숨김</h4>' : `<h4>${esc(k.meaning)}</h4><p class="korean-hanja">${esc(koreanHanjaLabel(k.char))}</p>`}<p>${esc(k.strokes)}획</p></div><button class="sound" data-speak="${esc(k.char)}" aria-label="${esc(k.char)} 듣기">◖♪</button></div><span class="detail-label">읽는 법</span><p class="detail-note"><b>음독</b> ${esc(k.onyomi)} &nbsp; / &nbsp; <b>훈독</b> ${esc(k.kunyomi)}</p>${hideExploreMeanings ? "" : readingBackground(k)+mnemonics.view(k)}<span class="detail-label">함께 익힐 단어</span>${k.words.map(w => `<div class="word-row"><div><span class="word-jp" lang="ja">${esc(w.word)}</span> <span class="word-reading" lang="ja">${esc(w.reading)}</span>${hideExploreMeanings ? '' : `<div class="word-meaning">${esc(w.meaning)}</div>`}${window.KANJI_EXAMPLES?.[w.word] ? `<div class="word-example" lang="ja">${esc(window.KANJI_EXAMPLES[w.word].sentence)}</div>` : '<div class="word-example pending">예문 준비 중</div>'}</div><button class="word-sound" data-speak="${esc(w.word)}" aria-label="${esc(w.word)} 듣기">◖♪</button></div>`).join('')}<div class="detail-actions"><button class="mark-review action-practice" id="add-practice" aria-pressed="${uniform==='practice'}">모름</button><button class="mark-review action-known" id="mark-known" aria-pressed="${uniform==='known'}">익힘</button><button class="mark-review action-review" id="mark-review" aria-pressed="${uniform==='review'}">복습 필요</button></div><p class="detail-note">현재 단어 상태: ${esc(charStatusLabel(k.char))}<br>여기서 고른 상태는 두 단어에 적용됩니다.</p>`;
    mnemonics.bind($('#kanji-detail'), k.char);
    $('#kanji-detail').querySelectorAll('[data-speak]').forEach(b => b.onclick = () => speak(b.dataset.speak));
    $('#add-practice').onclick = () => setStatus(k.char,'practice'); $('#mark-known').onclick = () => setStatus(k.char,'known'); $('#mark-review').onclick = () => setStatus(k.char,'review');
  }
  function renderCardLibrary() {
    const list = data.kanji.filter((k,i) => cardSetIncludes(i) && searchMatch(k, $('#card-search').value.trim()) && (libraryFilter==='all'||k.words.some((_,j)=>(getWordStatus(k.char,j)||'unselected')===libraryFilter)));
    $('#card-library-list').innerHTML = list.length ? list.map(k => `<div class="card-library-item item-${getCharStatus(k.char)||'unselected'}"><span><b lang="ja">${esc(k.char)}</b> ${esc(k.meaning)} <small>${k.words.map((w,i)=>`<span class="status-tag tag-${getWordStatus(k.char,i)||'unselected'}">${esc(w.word)} · ${esc(statusText[getWordStatus(k.char,i)]||'안 담음')}</span>`).join(' ')}</small></span><button data-add="${esc(k.char)}">모름</button><button data-later="${esc(k.char)}">나중에</button></div>`).join('') : '<p class="hint">해당 상태의 한자가 없습니다.</p>';
    $('#card-library-list').querySelectorAll('[data-add]').forEach(b => b.onclick = () => setStatus(b.dataset.add,'practice'));
    $('#card-library-list').querySelectorAll('[data-later]').forEach(b => b.onclick = () => setStatus(b.dataset.later,'later'));
  }
  function rebuildDeck(keepOffset=false) {
    if(keepOffset!==true) batchOffset=0;
    const filter = $('#card-filter').value, sort = $('#card-sort').value;
    if(keepOffset!==true){
      batchSource = data.kanji.filter((k,i)=>cardSetIncludes(i)).map(k=>({char:k.char,cards:k.words.map((word,index)=>({char:k.char,index,word})).filter(c=>filter==='all'||getWordStatus(c.char,c.index)===filter)})).filter(g=>g.cards.length);
      if (sort === 'character') batchSource.sort((a,b) => a.char.localeCompare(b.char,'ja'));
      if (sort === 'shuffle') for (let i=batchSource.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [batchSource[i],batchSource[j]]=[batchSource[j],batchSource[i]]; }
    }
    const requested=Math.max(1,Math.floor(Number($('#card-limit').value)||10)); availableCount=batchSource.length;if(batchOffset>=availableCount)batchOffset=0;
    // Keep the selected batch fixed: moving a card to another status must not
    // silently pull an unseen card into the current batch.
    deck=batchSource.slice(batchOffset,batchOffset+requested).flatMap(g=>g.cards).filter(c=>filter==='all'||getWordStatus(c.char,c.index)===filter);
    if(sort==='shuffle') deck=shuffledCards(deck);
    cardIndex = 0; revealed = false; renderCard();
  }
  function renderCard() {
    const card=deck[cardIndex], w=card?.word;
    $('#card-count').textContent = card ? `단어 카드 ${cardIndex+1} / ${deck.length} · 선택 당시 ${availableCount}자 중 ${batchOffset+1}번째 한자부터 · ${statusText[getWordStatus(card.char,card.index)]||'안 담음'}` : '카드가 없습니다';
    $('#card-controls').hidden = !card; $('#remove-card').hidden = !card; $('#flashcard').disabled = !card;
    if (!card) { $('#flashcard').innerHTML = '<span class="flash-answer">아직 이 목록에 카드가 없어요.</span><span class="flash-readings">한자를 담거나 다른 세트와 상태를 선택하세요.</span>'; return; }
    $('#flashcard').innerHTML = `<span class="flash-hint">${revealed ? '읽기와 뜻' : '어떻게 읽고 무슨 뜻일까요?'}</span><span class="flash-kanji flash-word" lang="ja">${esc(w.word)}</span>${revealed ? `<span class="flash-answer" lang="ja">${esc(w.reading)}</span><span class="flash-readings">${esc(w.meaning)} · 학습 한자 ${esc(card.char)}</span>` : '<span class="flash-readings">눌러서 정답 확인 ↗</span>'}`;
    $('#flashcard').setAttribute('aria-label', revealed ? `${w.word}: ${w.reading}, ${w.meaning}. 답 숨기기` : `${w.word}. 눌러서 답 보기`);
  }
  function move(delta) { if (!deck.length) return; cardIndex = (cardIndex + delta + deck.length) % deck.length; revealed = false; renderCard(); }
  $('#flashcard').onclick = () => { revealed = !revealed; renderCard(); };
  $('#previous').onclick = () => move(-1); $('#next').onclick = () => move(1);
  function changeCard(value) { const card=deck[cardIndex]; if (!card) return; wordStatuses[idFor(card.char,card.index)]=value; persist(); renderGrid();renderDetail();renderCardLibrary(); if(storyUI&&storyUI.refresh)storyUI.refresh(); const filter=$('#card-filter').value; if(filter!=='all'&&value!==filter){deck.splice(cardIndex,1);cardIndex=Math.min(cardIndex,Math.max(0,deck.length-1));revealed=false;renderCard();} else move(1); $('#card-status').textContent = value ? `${card.word.word}을(를) ‘${statusText[value]}’ 목록으로 옮겼어요.` : `${card.word.word}을(를) 카드에서 뺐어요.`; }
  $('#again').onclick = () => changeCard('practice'); $('#later').onclick = () => changeCard('later'); $('#known').onclick = () => changeCard('known'); $('#remove-card').onclick = () => changeCard(null);
  $('#review-card').onclick = () => changeCard('review');
  $('#card-filter').onchange = rebuildDeck; $('#card-sort').onchange = rebuildDeck; $('#card-limit').onchange = rebuildDeck;
  $('#card-set').onchange = () => { const v=$('#card-set').value; selectedCardSets=v==='all'?new Set(Array.from({length:setCount},(_,i)=>i)):new Set([Number(v)]); updateCardSets(); };
  $('#shuffle').onclick = () => {
    const previous=deck.map(c=>idFor(c.char,c.index)).join('|');
    $('#card-sort').value='shuffle'; rebuildDeck();
    if(deck.length>1 && previous===deck.map(c=>idFor(c.char,c.index)).join('|')) { deck.reverse(); renderCard(); }
  };
  $('#next-batch').onclick = () => {
    const size=Math.max(1,Math.floor(Number($('#card-limit').value)||10)), batches=Math.ceil(batchSource.length/size);
    // Skip batches whose cards have all moved out of the selected category.
    for(let i=0;i<batches;i++){batchOffset=(batchOffset+size)% (batches*size);rebuildDeck(true);if(deck.length)break;}
  };
  $$('#card-library-filters [data-filter]').forEach(b=>b.onclick=()=>{libraryFilter=b.dataset.filter;$$('#card-library-filters [data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderCardLibrary();});
  $('#export-cards').onclick = () => {
    const blob = new Blob([JSON.stringify({version:2, statuses, wordStatuses, completedSets},null,2)],{type:'application/json'}), url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href=url; link.download='한자-카드-상태.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('#import-trigger').onclick = () => $('#import-cards').click();
  $('#import-cards').onchange = async e => {
    const file = e.target.files && e.target.files[0]; if(!file)return;
    try { const parsed = JSON.parse(await file.text()); if(!parsed || ![1,2].includes(parsed.version) || !parsed.statuses || typeof parsed.statuses!=='object' || Array.isArray(parsed.statuses)) throw Error('format');
      for(const [char,status] of Object.entries(parsed.statuses)) if(byChar.has(char) && Object.hasOwn(statusText,status)) {statuses[char]=status;byChar.get(char).words.forEach((_,i)=>delete wordStatuses[idFor(char,i)]);}
      if(parsed.version===2 && parsed.wordStatuses && typeof parsed.wordStatuses==='object') for(const [id,status] of Object.entries(parsed.wordStatuses)){const pos=id.lastIndexOf(':'),char=id.slice(0,pos),index=Number(id.slice(pos+1));if(pos>0&&byChar.has(char)&&Number.isInteger(index)&&index>=0&&index<byChar.get(char).words.length&&(status===null||Object.hasOwn(statusText,status)))wordStatuses[id]=status;}
      if(parsed.version===2 && parsed.completedSets && typeof parsed.completedSets==='object')for(const [set,done] of Object.entries(parsed.completedSets))if(/^\d+$/.test(set)&&Number(set)<setCount&&done===true)completedSets[set]=true;
      persist();renderGrid();renderDetail();renderCardLibrary();rebuildDeck();renderSetComplete();if(storyUI && storyUI.refresh)storyUI.refresh();$('#card-status').textContent='카드 상태를 가져왔어요.';
    } catch (_) { $('#card-status').textContent='카드 상태 파일을 읽을 수 없어요.'; } finally { e.target.value=''; }
  };
  function renderSetComplete() {const set=$('#set-select').value;const options=Array.from({length:setCount},(_,i)=>`<option value="${i}">${i+1}세트${completedSets[i]?' ✓':''}</option>`).join('')+'<option value="all">전체 세트</option>';$('#set-select').innerHTML=options;$('#card-set').innerHTML=options+'<option value="custom">여러 세트</option>';$('#write-set').innerHTML=options+'<option value="custom">여러 세트</option>';$('#set-select').value=set;$('#set-complete').disabled=set==='all';$('#set-complete').checked=set!=='all'&&!!completedSets[set];renderCardSetPicker();renderWriteSetPicker();}
  $('#set-complete').onchange=e=>{const set=$('#set-select').value;if(set==='all')return;if(e.target.checked)completedSets[set]=true;else delete completedSets[set];persist();renderSetComplete();};
  $('#explore-search').oninput = renderGrid; $('#set-select').onchange = () => { const first = data.kanji[Number($('#set-select').value) * 25]; if(first) current=first.char; renderGrid(); renderDetail();renderSetComplete(); }; $('#card-search').oninput = renderCardLibrary;
  $('#meaning-toggle').onclick = e => { hideExploreMeanings=!hideExploreMeanings; e.currentTarget.setAttribute('aria-pressed',String(hideExploreMeanings)); e.currentTarget.textContent=hideExploreMeanings?'뜻 다시 보기':'뜻 숨기기'; renderGrid();renderDetail(); };
  function activate(name) { if(name!=='stories' && storyUI && storyUI.stop) storyUI.stop(); $$('.tab').forEach(b => b.classList.toggle('active',b.dataset.tab===name)); $$('.panel').forEach(p => p.classList.toggle('active',p.id===name)); if(name==='write') resizeCanvas(); }
  $$('.tab').forEach(b => b.onclick = () => activate(b.dataset.tab));
  $('[data-go]').onclick = () => { activate('study'); $('.workspace').scrollIntoView({behavior:'smooth'}); };
  const select=$('#write-select'), canvas=$('#writing-canvas'), ctx=canvas.getContext('2d'); let drawing=false, writeChar=current;
  function resizeCanvas() { const rect=canvas.getBoundingClientRect(); if(!rect.width)return; const scale=window.devicePixelRatio||1; canvas.width=rect.width*scale; canvas.height=rect.height*scale; ctx.setTransform(scale,0,0,scale,0,0); ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#365f50'; }
  function populateWriting() { const list=data.kanji.filter((k,i)=>writeSetIncludes(i)&&searchMatch(k,$('#write-search').value.trim())); select.innerHTML=list.length ? list.map(k=>`<option value="${esc(k.char)}">${esc(k.char)} — ${esc(k.meaning)}</option>`).join('') : '<option value="">검색 결과 없음</option>'; if(list.some(k=>k.char===writeChar))select.value=writeChar; else {writeChar=list[0]?.char||'';select.value=writeChar;} updateWriting(); }
  function updateWriting(clearCanvas=true) { const k=byChar.get(writeChar); if(!k){$('#write-guide').textContent='검색 결과가 없습니다.';$('#trace-char').textContent='';return;} const show=$('#show-guide').checked; $('#trace-char').textContent=k.char; $('#trace-char').style.display=show?'grid':'none'; const words=k.words.map(w=>`<div class="write-word"><ruby lang="ja">${esc(show?w.word:w.word.split(k.char).join('□'))}<rt>${esc(w.reading)}</rt></ruby><span>${esc(w.meaning)}</span></div>`).join(''); $('#write-guide').innerHTML=(show ? `<h4>${esc(k.char)} · ${esc(k.meaning)}</h4><p><b>${esc(k.strokes)}획.</b> ${esc(k.writing)}</p><p>음독: ${esc(k.onyomi)} · 훈독: ${esc(k.kunyomi)}</p><button class="text-button" id="speak-write">◖♪ &nbsp; 읽기 듣기</button>` : `<h4>${esc(k.meaning)}</h4><p>음독: ${esc(k.onyomi)}<br>훈독: ${esc(k.kunyomi)}</p>`) + `<span class="detail-label">단어로 익히기</span>${words}${show?'':'<p class="hint">□에 들어갈 한자를 써 보세요. 위의 읽기는 단어 전체의 읽기입니다.</p>'}`; const voice=$('#speak-write'); if(voice)voice.onclick=()=>speak(k.char); if(clearCanvas)resizeCanvas(); }
  function toggleGuide() { const show=$('#show-guide').checked; $('#write-search').hidden=!show; select.hidden=!show; $('#write-set-picker').hidden=!show; $('#writing-hint').hidden=!show; document.querySelector('label[for="write-set"]').hidden=!show; document.querySelector('label[for="write-search"]').hidden=!show; document.querySelector('label[for="write-select"]').hidden=!show; updateWriting(false); }
  function point(e){const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
  canvas.addEventListener('pointerdown',e=>{drawing=true;canvas.setPointerCapture(e.pointerId);const [x,y]=point(e);ctx.beginPath();ctx.moveTo(x,y);});
  canvas.addEventListener('pointermove',e=>{if(!drawing)return;const [x,y]=point(e);ctx.lineTo(x,y);ctx.stroke();});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,()=>{drawing=false;}));
  $('#write-search').oninput=populateWriting; $('#write-set').onchange=()=>{const v=$('#write-set').value;selectedWriteSets=v==='all'?new Set(Array.from({length:setCount},(_,i)=>i)):new Set([Number(v)]);updateWriteSets();}; select.onchange=()=>{writeChar=select.value;updateWriting();}; $('#show-guide').onchange=toggleGuide; $('#clear-canvas').onclick=resizeCanvas;
  window.addEventListener('resize',()=>{if($('#write').classList.contains('active'))resizeCanvas();});
  $('#library-count').textContent=`준비된 한자 ${data.kanji.length} / 1,110자 · 이야기 ${data.stories.length}편`;
  $('#kanji-count').textContent=`한자 ${data.kanji.length}자`;
  persist(); renderGrid(); renderDetail(); renderCardLibrary(); rebuildDeck(); populateWriting(); renderSetComplete();
  storyUI=window.createStoryUI({data,root:$('#stories'),onFlag:(char,status)=>setStatus(char,status||'practice'),getStatus:char=>{const values=byChar.get(char)?.words.map((_,i)=>getWordStatus(char,i))||[];return values.length&&values.every(s=>s===values[0])?values[0]:null;},onNavigateKanji:({char})=>{const index=data.kanji.findIndex(k=>k.char===char);if(index<0)return;$('#set-select').value=String(Math.floor(index/25));$('#explore-search').value='';current=char;activate('study');renderGrid();renderDetail();renderSetComplete();$('#kanji-detail').scrollIntoView({behavior:'smooth',block:'start'});}});
})();
