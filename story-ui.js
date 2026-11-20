/* Story reading UI. Study words are annotated explicitly; unknown readings are never guessed. */
window.createStoryUI = function createStoryUI({ data, root, onFlag, getStatus = () => undefined, onNavigateKanji = () => {} }) {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const statusLabel = { practice:'모름', review:'복습 필요', later:'나중에', known:'익힘' };
  let storyIndex = Math.max(0, data.stories.findIndex(s => s.seriesId)), showFurigana = true, showTranslation = false, sentenceIndex = 0, sentences = [], playing = false, paused = false, playbackGeneration = 0;
  let storyWords = [], wordsByFirst = new Map(), furiganaByStart = new Map();
  const wordCache = new WeakMap();
  const readingKey = 'kanji-notebook-reading-complete-v1';
  let completed = {};
  const selectedSets = new Set(), totalSets = Math.ceil(data.kanji.length / 25);
  try { completed = JSON.parse(localStorage.getItem(readingKey) || '{}') || {}; } catch (_) {}
  const setOf = (story, index) => story.setNumber || Math.floor(index / 2) + 1;
  const rangeOf = (story, index) => story.seriesId ? `${story.setStart || setOf(story,index)}~${story.setEnd || setOf(story,index)}세트 · ${story.chapter}장` : `${setOf(story,index)}세트 · 이야기 ${index % 2 + 1}`;
  // Look up study kanji from every set, including earlier and later sets.
  const targetsFor = story => new Set(Array.isArray(story.targets) ? story.targets : data.kanji.slice(0,25).map(k => k.char));
  const chars = new Map(data.kanji.map((k,i) => [k.char, {...k, setNumber:Math.floor(i/25)+1}]));
  const html = `<div class="panel-heading"><div><p class="section-kicker">문맥 속에서 읽기 / 04</p><h3>이야기 속에서 만나요.</h3><p>표시된 단어에 마우스를 올리거나 눌러 읽기와 뜻을 확인하세요.</p></div><span class="count-badge">이야기</span></div>
    <div class="story-tools"><label for="story-search">세트 번호, 한자 또는 단어로 이야기 찾기</label><input id="story-search" type="search" placeholder="예: 3 → 1~5세트 연재, 巡, 巡る" autocomplete="off"><details class="story-set-picker"><summary id="story-set-summary">이야기 세트 선택 · 전체</summary><div class="story-set-menu"><p>원하는 세트를 하나 이상 선택하세요. 검색어와 선택한 세트에 모두 맞는 이야기가 표시됩니다.</p><div id="story-set-options" class="story-set-options">${Array.from({length:totalSets},(_,i)=>`<label><input type="checkbox" data-story-set="${i+1}"> ${i+1}세트</label>`).join('')}</div><button type="button" id="story-set-reset" class="outline-btn">선택 해제 · 전체 보기</button></div></details><div id="story-search-results" class="story-results"></div></div>
    <div class="story-reading-tools"><button id="furigana-toggle" class="outline-btn" aria-pressed="true">후리가나 숨기기</button><button id="translation-toggle" class="outline-btn" aria-pressed="false">한국어 번역 보기</button><span>후리가나는 사전 자동 분석을 포함하므로 이름과 문맥에 따라 읽기가 다를 수 있습니다.</span></div>
    <article id="story-content" class="story-paper"></article>`;
  root.innerHTML = html;
  const $ = s => root.querySelector(s);

  // Match romanized readings such as "meguru" without requiring network access.
  const kanaMap = {あ:'a',い:'i',う:'u',え:'e',お:'o',か:'ka',き:'ki',く:'ku',け:'ke',こ:'ko',さ:'sa',し:'shi',す:'su',せ:'se',そ:'so',た:'ta',ち:'chi',つ:'tsu',て:'te',と:'to',な:'na',に:'ni',ぬ:'nu',ね:'ne',の:'no',は:'ha',ひ:'hi',ふ:'fu',へ:'he',ほ:'ho',ま:'ma',み:'mi',む:'mu',め:'me',も:'mo',や:'ya',ゆ:'yu',よ:'yo',ら:'ra',り:'ri',る:'ru',れ:'re',ろ:'ro',わ:'wa',を:'o',ん:'n',が:'ga',ぎ:'gi',ぐ:'gu',げ:'ge',ご:'go',ざ:'za',じ:'ji',ず:'zu',ぜ:'ze',ぞ:'zo',だ:'da',ぢ:'ji',づ:'zu',で:'de',ど:'do',ば:'ba',び:'bi',ぶ:'bu',べ:'be',ぼ:'bo',ぱ:'pa',ぴ:'pi',ぷ:'pu',ぺ:'pe',ぽ:'po'};
  const yoon = {き:'ky',し:'sh',ち:'ch',に:'ny',ひ:'hy',み:'my',り:'ry',ぎ:'gy',じ:'j',び:'by',ぴ:'py'};
  function romanize(reading) {
    const s = [...String(reading || '').normalize('NFKC')].map(c => { const n = c.charCodeAt(0); return n >= 0x30a1 && n <= 0x30f6 ? String.fromCharCode(n - 0x60) : c; });
    let out = '', doubled = false;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === 'っ') { doubled = true; continue; }
      let part = kanaMap[s[i]] || s[i];
      if (yoon[s[i]] && ['ゃ','ゅ','ょ'].includes(s[i+1])) { part = yoon[s[i]] + ({ゃ:'a',ゅ:'u',ょ:'o'})[s[++i]]; }
      if (doubled) { part = (part.startsWith('ch') ? 't' : part[0]) + part; doubled = false; }
      out += part;
    }
    return out.toLowerCase();
  }
  function wordsFor(story) {
    if (wordCache.has(story)) return wordCache.get(story);
    const targets = targetsFor(story);
    const extras=[{word:'故郷',reading:'ふるさと',meaning:'고향',pronunciation:'후루사토'},{word:'国境',reading:'こっきょう',meaning:'국경',pronunciation:'콧쿄오'},{word:'図書館',reading:'としょかん',meaning:'도서관',pronunciation:'토쇼칸'},{word:'駅舎',reading:'えきしゃ',meaning:'역 건물',pronunciation:'에키샤'},{word:'祖母',reading:'そぼ',meaning:'할머니',pronunciation:'소보'}].filter(w=>![...w.word].some(c=>targets.has(c))).map(w=>({...w,extra:true}));
    const all = [...(story.annotations || []), ...(window.STORY_WORDS || []), ...data.stories.flatMap(s => s.annotations || []), ...data.kanji.flatMap(k => k.words || []),...extras];
    const unique = new Map();
    all.forEach(w => { if (w && w.word && w.reading && w.meaning && !unique.has(w.word)) unique.set(w.word, w); });
    const result = [...unique.values()].sort((a,b) => b.word.length - a.word.length);
    wordCache.set(story, result);
    return result;
  }
  const countTerm = (text, term) => { let count = 0, at = 0; if (!term) return 0; while ((at = text.indexOf(term, at)) !== -1) { count++; at += term.length; } return count; };
  function searchStories() {
    const q = $('#story-search').value.trim().normalize('NFKC').toLowerCase(), setMatch=q.match(/^(\d+)\s*(?:세트)?$/), setSearch=setMatch?Number(setMatch[1]):null;
    const output = data.stories.map((s, i) => {
      let n = setSearch!==null ? (setSearch >= (s.setStart || setOf(s,i)) && setSearch <= (s.setEnd || setOf(s,i)) ? 1 : 0) : (q ? countTerm((s.title+' '+s.japanese).toLowerCase(), q) : 0);
      if (q && !n && setSearch===null) {
        // Search annotations by their complete kana reading, romanization, or Korean meaning.
        const matches = wordsFor(s).filter(w => w.reading.toLowerCase() === q || romanize(w.reading) === q || w.meaning.toLowerCase().includes(q));
        const hits = new Set(matches.map(w => w.word));
        n = [...hits].reduce((total, word) => total + countTerm(s.japanese, word), 0);
      }
      return {s, i, n};
    }).filter(x => (!q || x.n) && (!selectedSets.size || [...selectedSets].some(n => n >= (x.s.setStart || setOf(x.s,x.i)) && n <= (x.s.setEnd || setOf(x.s,x.i))))).sort((a,b) => Number(!!b.s.seriesId)-Number(!!a.s.seriesId) || a.i-b.i);
    const results = $('#story-search-results');
    if (!output.length) { results.innerHTML = '<p class="story-empty">일치하는 이야기가 없습니다.</p>'; return; }
    results.innerHTML = output.map(({s,i,n}) => `<button type="button" data-story-index="${i}" class="story-result ${i === storyIndex ? 'active' : ''}"><span><b>${esc(rangeOf(s,i))}</b> · ${esc(s.title)}</span><small>${completed[i] ? '✓ 읽음' : q && setSearch===null ? `${n}회 등장` : '읽기'}</small></button>`).join('');
    results.querySelectorAll('[data-story-index]').forEach(b => b.addEventListener('click', () => { storyIndex = Number(b.dataset.storyIndex); stopPlayback(); renderStory(); searchStories(); }));
  }
  function stopPlayback() { playing = false; paused = false; playbackGeneration++; if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }
  function updateControls() {
    const slider = $('#story-position'), count = $('#story-position-count'), play = $('#story-play'), pause = $('#story-pause');
    if (!slider) return;
    slider.value = String(sentenceIndex); count.textContent = `${sentenceIndex + 1} / ${sentences.length} 문장`;
    play.textContent = paused ? '▶ 이어 듣기' : playing ? '■ 정지' : '▶ 듣기';
    pause.disabled = !playing || paused;
    root.querySelectorAll('.story-sentence').forEach((el,i) => el.classList.toggle('is-current', i === sentenceIndex && (playing || paused)));
  }
  function startAt(index) {
    stopPlayback(); sentenceIndex = Math.max(0, Math.min(index, sentences.length - 1));
    if (!('speechSynthesis' in window)) { $('#story-play-status').textContent = '이 브라우저에서는 음성 읽기를 지원하지 않습니다.'; updateControls(); return; }
    const voices = speechSynthesis.getVoices(), voice = voices.find(v => /^ja(-|_)/i.test(v.lang));
    playing = true; paused = false;
    $('#story-play-status').textContent = voice ? '문장을 눌러 그 위치부터 들을 수 있어요.' : '일본어 음성 설치 여부에 따라 발음이 달라질 수 있어요.';
    const generation = ++playbackGeneration;
    function speakSentence() {
      if (!playing || generation !== playbackGeneration) return;
      if (sentenceIndex >= sentences.length) { sentenceIndex = sentences.length - 1; playing = false; updateControls(); return; }
      const utterance = new SpeechSynthesisUtterance(sentences[sentenceIndex].text); utterance.lang = 'ja-JP'; utterance.rate = 0.85;
      if (voice) utterance.voice = voice;
      utterance.onend = () => { if (!playing || generation !== playbackGeneration) return; sentenceIndex++; speakSentence(); };
      utterance.onerror = e => { if (generation !== playbackGeneration) return; playing = false; $('#story-play-status').textContent = '음성을 재생하지 못했어요. 기기의 일본어 음성을 확인해 주세요.'; updateControls(); };
      updateControls(); speechSynthesis.speak(utterance);
    }
    speakSentence();
  }
  function splitSentences(text) {
    const out = []; let start = 0;
    for (let i = 0; i < text.length; i++) {
      if ('。！？\n'.includes(text[i])) { const piece = text.slice(start, i + 1); if (piece.trim()) out.push({ text:piece, start }); else if (out.length) out[out.length - 1].text += piece; start = i + 1; }
    }
    if (text.slice(start).trim()) out.push({text:text.slice(start), start});
    return out.length ? out : [{text:text || '', start:0}];
  }
  function annotatedSentence(text, sentenceNo, charMap, sentenceStart = 0) {
    const container = document.createElement('span'); container.className = 'story-sentence'; container.dataset.sentence = String(sentenceNo);
    container.title = '문장을 눌러 여기서부터 듣기';
    const playHere = document.createElement('button'); playHere.type = 'button'; playHere.className = 'sentence-play'; playHere.textContent = '▶'; playHere.setAttribute('aria-label', `${sentenceNo + 1}번째 문장부터 듣기`); playHere.addEventListener('click', e => { e.stopPropagation(); startAt(sentenceNo); }); container.appendChild(playHere);
    let i = 0, pending = '';
    const flush = () => { if (pending) { container.appendChild(document.createTextNode(pending)); pending = ''; } };
    while (i < text.length) {
      const word = (wordsByFirst.get(text[i]) || []).find(w => text.startsWith(w.word, i));
      const generated = furiganaByStart.get(sentenceStart + i);
      const fallbackChar = [...text.slice(i)][0];
      const fallback = charMap.get(fallbackChar);
      if (!word && !fallback && !generated) { pending += fallbackChar; i += fallbackChar.length; continue; }
      flush();
      const term = generated && (!word || generated[1].length > word.word.length)
        ? {word:generated[1], reading:generated[2], meaning:'문맥 속 읽기'}
        : word ? {...word, reading:generated && generated[1] === word.word ? generated[2] : word.reading}
          : {word:fallbackChar, reading:'', meaning:fallback?.meaning || '읽기 확인 중'};
      const wrapped = document.createElement('span'); wrapped.className = 'story-word-wrap';
      const highlighted = [...new Set([...term.word].filter(c => charMap.has(c)))];
      const button = document.createElement('button'); button.type = 'button'; button.className = `story-word${highlighted.length ? '' : ' story-reading-only'}`; button.setAttribute('aria-label', `${term.word}, ${term.reading || '읽기 미등록'}, ${term.meaning}`); button.setAttribute('aria-expanded','false');
      if (term.reading) button.innerHTML = `<ruby>${esc(term.word)}<rt>${esc(term.reading)}</rt></ruby>`; else button.textContent = term.word;
      const pop = document.createElement('span'); pop.className = 'story-word-popover';
      pop.innerHTML = `<strong lang="ja">${esc(term.word)}</strong><span class="story-word-reading" lang="ja">${esc(term.reading || '읽기 미등록')}</span>${term.pronunciation ? `<span>한국어 발음(근사): ${esc(term.pronunciation)}</span>` : ''}<span>${esc(term.meaning || '뜻 미등록')}</span><span class="story-kanji-label">학습 한자</span><span class="story-kanji-actions">${highlighted.map(c => `<span class="story-status-group"><b lang="ja">${esc(c)}</b><button type="button" class="story-set-link" data-go-kanji="${esc(c)}" data-set-number="${charMap.get(c).setNumber}">${charMap.get(c).setNumber}세트 보기 ↗</button>${['practice','review','known'].map(s => `<button type="button" data-flag="${esc(c)}" data-status="${s}" aria-pressed="${getStatus(c)===s}">${statusLabel[s]}</button>`).join('')}</span>`).join('') || '<small>이 단어에는 학습 목록의 한자가 없습니다.</small>'}</span><button type="button" class="story-listen-here">▶ 이 문장부터 듣기</button>`;
      button.addEventListener('click', e => { e.stopPropagation(); const wasOpen = wrapped.classList.contains('open'); root.querySelectorAll('.story-word-wrap.open').forEach(x => { x.classList.remove('open'); x.querySelector('.story-word').setAttribute('aria-expanded','false'); }); wrapped.classList.toggle('open', !wasOpen); button.setAttribute('aria-expanded', String(!wasOpen)); });
      pop.querySelectorAll('[data-flag]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); onFlag(b.dataset.flag,b.dataset.status); }));
      pop.querySelectorAll('[data-go-kanji]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); stopPlayback(); onNavigateKanji({char:b.dataset.goKanji, setNumber:Number(b.dataset.setNumber)}); }));
      pop.querySelector('.story-listen-here').addEventListener('click', e => { e.stopPropagation(); startAt(sentenceNo); });
      wrapped.append(button, pop); container.appendChild(wrapped); i += term.word.length;
    }
    flush();
    container.addEventListener('click', e => { if (!e.target.closest('.story-word-wrap')) startAt(sentenceNo); });
    return container;
  }
  function renderStory() {
    const story = data.stories[storyIndex]; if (!story) { $('#story-content').textContent = '아직 이야기가 없습니다.'; return; }
    storyWords = wordsFor(story); wordsByFirst = new Map();
    furiganaByStart = new Map((story.furiganaSpans || []).map(span => [span[0], span]));
    storyWords.forEach(w => { const first = w.word[0]; if (!wordsByFirst.has(first)) wordsByFirst.set(first, []); wordsByFirst.get(first).push(w); });
    sentences = splitSentences(story.japanese); sentenceIndex = 0;
    const article = $('#story-content');
    article.classList.toggle('with-translation',showTranslation);
    article.innerHTML = `<p class="section-kicker">${Math.floor(storyIndex/2)+1}세트 · 이야기 ${storyIndex%2+1}</p><h4 lang="ja">${esc(story.title)}</h4><div class="story-player" aria-label="이야기 음성 재생"><div class="story-player-controls"><button id="story-prev" type="button" aria-label="이전 문장">⏮</button><button id="story-play" type="button">▶ 듣기</button><button id="story-pause" type="button" disabled>Ⅱ 일시정지</button><button id="story-next" type="button" aria-label="다음 문장">⏭</button></div><label for="story-position">문장 위치 <span id="story-position-count"></span></label><input id="story-position" type="range" min="0" max="${Math.max(0,sentences.length - 1)}" value="0"><p id="story-play-status">문장을 눌러 그 위치부터 들을 수 있어요. 재생 위치는 문장 단위예요.</p></div><div id="story-reading-layout" class="story-reading-layout ${showTranslation ? 'bilingual' : ''}"><div class="story-jp ${showFurigana ? 'show-furigana' : ''}" lang="ja"></div><aside id="story-ko" class="story-ko" ${showTranslation?'':'hidden'}><strong>한국어 번역</strong><div>${esc(story.translationKo || '이 이야기의 전체 번역을 준비 중입니다.')}</div></aside></div><div class="story-summary"><strong>한국어 줄거리</strong>${esc(story.summary)}</div>`;
    if (story.seriesId) {
      const label = article.querySelector('.section-kicker');
      if (label) label.textContent = `${story.seriesTitle || '연재 이야기'} · ${rangeOf(story, storyIndex)}`;
      article.innerHTML += `<nav class="novel-chapter-nav" aria-label="이야기 장 선택">${data.stories.map((s,i) => s.seriesId === story.seriesId ? `<button type="button" data-chapter-index="${i}" aria-current="${i===storyIndex}">${s.chapter}장${completed[i] ? ' ✓' : ''}</button>` : '').join('')}</nav><label class="novel-complete"><input id="story-complete" type="checkbox" ${completed[storyIndex] ? 'checked' : ''}> 이 장 읽음</label>`;
    }
    const body = article.querySelector('.story-jp'), charMap = chars;
    sentences.forEach((s,i) => body.appendChild(annotatedSentence(s.text, i, charMap, s.start)));
    $('#story-play').onclick = () => { if (paused) { speechSynthesis.resume(); paused = false; playing = true; updateControls(); } else if (playing) { stopPlayback(); updateControls(); } else startAt(sentenceIndex); };
    $('#story-pause').onclick = () => { if (playing && 'speechSynthesis' in window) { speechSynthesis.pause(); paused = true; playing = false; updateControls(); } };
    $('#story-prev').onclick = () => startAt(sentenceIndex - 1);
    $('#story-next').onclick = () => startAt(sentenceIndex + 1);
    $('#story-position').oninput = e => { const wasPlaying = playing || paused; stopPlayback(); sentenceIndex = Number(e.target.value); if (wasPlaying) startAt(sentenceIndex); else updateControls(); };
    article.querySelectorAll('[data-chapter-index]').forEach(b => b.addEventListener('click', () => { storyIndex = Number(b.dataset.chapterIndex); stopPlayback(); renderStory(); searchStories(); }));
    const done = article.querySelector('#story-complete');
    if (done) done.onchange = () => { if (done.checked) completed[storyIndex] = true; else delete completed[storyIndex]; try { localStorage.setItem(readingKey, JSON.stringify(completed)); } catch (_) {} searchStories(); renderStory(); };
    updateControls();
  }
  $('#furigana-toggle').onclick = e => { showFurigana = !showFurigana; e.currentTarget.setAttribute('aria-pressed', String(showFurigana)); e.currentTarget.textContent = showFurigana ? '후리가나 숨기기' : '후리가나 모두 보기'; const body = $('.story-jp'); if (body) body.classList.toggle('show-furigana', showFurigana); };
  $('#translation-toggle').onclick = e => { showTranslation=!showTranslation;e.currentTarget.setAttribute('aria-pressed',String(showTranslation));e.currentTarget.textContent=showTranslation?'한국어 번역 숨기기':'한국어 번역 보기';$('#story-ko').hidden=!showTranslation;$('#story-reading-layout').classList.toggle('bilingual',showTranslation);$('#story-content').classList.toggle('with-translation',showTranslation); };
  $('#story-search').addEventListener('input', searchStories);
  $('#story-set-options').addEventListener('change', e => {
    const value=Number(e.target?.dataset?.storySet);
    if (!Number.isInteger(value) || value < 1 || value > totalSets) return;
    if(e.target.checked) selectedSets.add(value); else selectedSets.delete(value);
    $('#story-set-summary').textContent = `이야기 세트 선택 · ${selectedSets.size ? `${selectedSets.size}개 선택` : '전체'}`;
    searchStories();
  });
  $('#story-set-reset').addEventListener('click', () => {
    selectedSets.clear();
    root.querySelectorAll('[data-story-set]').forEach(input => { input.checked = false; });
    $('#story-set-summary').textContent = '이야기 세트 선택 · 전체';
    searchStories();
  });
  renderStory(); searchStories();
  return { refresh() { root.querySelectorAll('[data-flag]').forEach(button => button.setAttribute('aria-pressed',String(getStatus(button.dataset.flag)===button.dataset.status))); }, stop() { stopPlayback(); updateControls(); } };
};
