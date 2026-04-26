/* ================= STUDY ================= */
let coolingTimer = null; // Bug 5: 冷却界面倒计时定时器

// Bug 1: 中途退出保护
function confirmLeaveStudy() {
  // 如果已经是完成/冷却/无词状态，直接返回
  const cardContainer = document.getElementById('studyCardContainer');
  const isStudying = !cardContainer.classList.contains('hidden') && state.studyIndex < state.studyWords.length;
  
  if (!isStudying) {
    if (coolingTimer) { clearInterval(coolingTimer); coolingTimer = null; }
    navigate('dashboard');
    return;
  }

  const remaining = state.studyWords.length - state.studyIndex;
  const coolingCount = state.coolingWords.length;
  let msg = `当前还剩 ${remaining} 个单词未完成。`;
  if (coolingCount > 0) {
    msg += `\n\n另有 ${coolingCount} 个单词正在冷却中，退出后它们冷却完成时可能无法立即回到队列。`;
  }
  msg += `\n\n确定要退出学习吗？`;

  if (confirm(msg)) {
    if (!state.isCramMode) {
      localStorage.setItem(`active_session_${state.currentLang}`, JSON.stringify({
        studyWords: state.studyWords,
        studyIndex: state.studyIndex,
        originalTotal: state.originalTotal,
        studyStats: state.studyStats,
        sessionStats: state.sessionStats,
        isCramMode: state.isCramMode,
        // 👇 【新增这两行】：确保跨轮次状态不丢失
        sessionOriginalTotal: state.sessionOriginalTotal,
        _sessionActive: state._sessionActive
      }));
    } else {
      // 无痕模式不保存进度
      localStorage.removeItem(`active_session_${state.currentLang}`);
    }

    if (coolingTimer) { clearInterval(coolingTimer); coolingTimer = null; }
    navigate('dashboard');
  }
}

async function initStudy() {
  state.isCramMode = false;
  state.coolingWords = [];
  state.studyHistory = []; // Bug 3: 重置撤回历史
  if (coolingTimer) { clearInterval(coolingTimer); coolingTimer = null; }

  document.getElementById('studyComplete').classList.add('hidden');
  document.getElementById('noWords').classList.add('hidden');
  document.getElementById('studyCardContainer').classList.remove('hidden');
  document.getElementById('answerSection').classList.remove('show');
  document.getElementById('undoBtn').disabled = true; // Bug 3: 重置撤回按钮
  revealAllowed = false;

  let words = [];
  const activeSessionStr = localStorage.getItem(`active_session_${state.currentLang}`);
  
  if (activeSessionStr) {
    try {
      const activeData = JSON.parse(activeSessionStr);
      // 只有在真的有剩余单词时，并且不是无痕模式时才恢复
      if (activeData.studyWords && activeData.studyIndex < activeData.studyWords.length && !activeData.isCramMode) {
        state.studyWords = activeData.studyWords;
        state.studyIndex = activeData.studyIndex;
        state.originalTotal = activeData.originalTotal || activeData.studyWords.length;
        state.studyStats = activeData.studyStats || { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
        state.sessionStats = activeData.sessionStats || { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
        
        // 👇 【新增这两行】：正确恢复跨轮次总量和会话状态
        state.sessionOriginalTotal = activeData.sessionOriginalTotal || activeData.originalTotal || activeData.studyWords.length;
        state._sessionActive = activeData._sessionActive !== undefined ? activeData._sessionActive : true;
        
        state.isCramMode = false;
        words = state.studyWords;
        
        showToast('已恢复上次未完成的进度', 'info');
      }
    } catch (e) {}
    localStorage.removeItem(`active_session_${state.currentLang}`);
  }

  // 👇 根据状态动态更新右上角文字
  const badge = document.getElementById('studyModeBadge');
  if (badge) {
    badge.textContent = state.isCramMode ? '无痕练习' : 'FSRS 复习';
  }

  if (words.length === 0) {
    words = await api(`/study/due?language=${state.currentLang}&_t=${Date.now()}`);
    state.studyWords = words;
    state.originalTotal = words.length;
    state.studyIndex = 0;
    state.studyStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
    // 只在全新开始一局时才重置跨轮次累计统计（冷却回来时不会走这里）
    if (!state._sessionActive) {
      state.sessionStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
      state.sessionOriginalTotal = words.length; // 记录整个会话的初始总量
    }
    state._sessionActive = true;
  }

  if (state.studyWords.length === 0) {
    document.getElementById('studyCardContainer').classList.add('hidden');

    // 动态抓取真实冷却状态，而非错误展示任务达成
    const stats = await api(`/study/stats?language=${state.currentLang}`);
    if (stats.upcomingWords && stats.upcomingWords.length > 0) {
       showCoolingState(stats.upcomingWords, stats);
    } else {
       showTaskAccomplished(stats);
    }
  } else {
    renderCardStack();
    updateStudyProgress();
  }
}

function showCoolingState(upcomingWords, stats) {
  if (coolingTimer) { clearInterval(coolingTimer); coolingTimer = null; }
  
  // 1. 【新增】防抖锁，防止倒计时触发无限循环请求
  let isRefreshing = false; 

  const el = document.getElementById('noWords');
  el.classList.remove('hidden');
  el.classList.add('pop-in');

  el.querySelector('h2').textContent = '记忆冷却中 ⏳';

  const countdownEl = document.getElementById('coolingCountdown');
  countdownEl.classList.remove('hidden');

  // Bug 4: 显示当前可复习数量 + Bug 5: 今日预估
  const dueNow = stats ? stats.dueWords : 0;
  const forecast = stats ? stats.todayForecast : null;

  // 👇 1. 【新增这一行】：记录一开始界面打开时，真正在未来冷却的单词总数
  let initialCoolingCount = upcomingWords.filter(w => new Date(w.due).getTime() > Date.now()).length;

  function updateCoolingCountdown() {
    if (isRefreshing) return; // 如果已经进入刷新流程，拦截一切后续执行

    const now = Date.now();
    const remaining = upcomingWords.filter(w => new Date(w.due).getTime() > now);
    
    // 👇 2. 【修改判断条件】：不仅判断 length === 0，还要判断有没有单词刚刚到期（数量变少了）
    if (remaining.length === 0 || remaining.length < initialCoolingCount) {
      isRefreshing = true; // 立即上锁
      if (coolingTimer) { clearInterval(coolingTimer); coolingTimer = null; }
      
      // 2. 【核心】不要立刻隐藏界面，给用户视觉反馈，并强制延迟 1.5 秒抹平时差！
      countdownEl.innerHTML = `
        <div class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-ochre/10 border border-ochre/20 rounded-xl text-sm animate-pulse mb-3">
          <span class="font-bold text-ochre">正在召唤记忆...</span>
        </div>`;
      
      setTimeout(() => {
        initStudy();
      }, 1500);
      return;
    }

    // 找到最近的单词
    const nearest = remaining.reduce((a, b) => new Date(a.due) < new Date(b.due) ? a : b);
    const nearestDiff = Math.ceil((new Date(nearest.due).getTime() - now) / 1000);
    const nearestMin = Math.floor(nearestDiff / 60);
    const nearestSec = nearestDiff % 60;
    const nearestStr = nearestMin > 0 ? `${nearestMin}分${nearestSec.toString().padStart(2, '0')}秒` : `${nearestDiff}秒`;

    el.querySelector('p').textContent = `还有 ${remaining.length} 个单词正在冷却中，最近一个将在 ${nearestStr} 后到期。`;

    // 倒计时卡片
    let html = remaining.sort((a,b) => new Date(a.due) - new Date(b.due)).slice(0, 8).map(w => {
      const d = Math.ceil((new Date(w.due).getTime() - now) / 1000);
      const m = Math.floor(d / 60);
      const s = d % 60;
      return `<div class="flex items-center gap-2 px-3 py-1.5 bg-ochre/8 border border-ochre/15 rounded-lg text-xs mb-1.5">
        <span class="font-mono font-bold text-ochre">${m > 0 ? m + ':' + s.toString().padStart(2,'0') : s + 's'}</span>
        <span class="text-muted">后复习</span>
      </div>`;
    }).join('');

    // Bug 4: 显示当前可复习数
    if (dueNow > 0) {
      html = `<div class="w-full flex items-center gap-2 px-4 py-2.5 bg-success/10 border border-success/20 rounded-xl text-sm mb-3 cursor-pointer hover:bg-success/15 transition-colors" onclick="initStudy()">
        <span class="font-bold text-success">✅ 当前已有 ${dueNow} 个单词可复习</span>
        <span class="text-success/60 text-xs ml-auto">点击开始 →</span>
      </div>` + html;
    }

    // Bug 5: 今日预估
    if (forecast && forecast.totalRemainingWords > 0) {
      html += `<div class="w-full mt-3 pt-3 border-t border-borderline/30 text-xs text-muted">
        <div class="flex items-center gap-1.5 mb-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"></path></svg>
          <span>今日预估：总共还需复习约 <b class="text-charcoal">${forecast.totalRemainingWords}</b> 个单词，预计约 <b class="text-charcoal">${forecast.estimatedMinutes}</b> 分钟</span>
        </div>
        ${forecast.coolingWords > 0 ? `<div class="text-[10px] text-muted/70">其中 ${forecast.coolingWords} 个在冷却中，平均每词 ${forecast.avgSecondsPerWord} 秒</div>` : ''}
      </div>`;
    }

    countdownEl.innerHTML = html;
  }

  updateCoolingCountdown();
  if (!isRefreshing) {
    coolingTimer = setInterval(updateCoolingCountdown, 1000);
  }

  const rightBtn = document.getElementById('coolingRefreshBtn');
  if (rightBtn) {
    if (rightBtn.tagName === 'DIV') {
      rightBtn.outerHTML = `<button id="coolingRefreshBtn" onclick="initStudy()" class="w-full py-3.5 bg-transparent border border-transparent text-muted hover:text-charcoal hover:bg-surface transition-all font-bold tracking-[0.2em] uppercase text-center rounded-sm text-[0.75rem] font-ui">刷新复习</button>`;
    } else {
      rightBtn.textContent = '刷新复习';
      rightBtn.onclick = () => { initStudy(); };
    }
  }
}

function showTaskAccomplished(stats) {
  if (coolingTimer) { clearInterval(coolingTimer); coolingTimer = null; }
  state._sessionActive = false; // 会话结束，重置标记
  const el = document.getElementById('noWords');
  el.classList.remove('hidden');
  el.classList.add('pop-in');
  
  // Bug 1 Fix: 必须重置标题和描述，否则会残留之前的 "记忆冷却中"
  const h2 = el.querySelector('h2');
  if (h2) h2.textContent = '空白';
  const p = el.querySelector('p');
  if (p) p.textContent = '当前没有任何需要复习的卡片。精神已达澄澈。';
  
  const countdownEl = document.getElementById('coolingCountdown');
  const rightBtn = document.getElementById('coolingRefreshBtn');
  if (rightBtn) {
    if (rightBtn.tagName === 'BUTTON') {
      rightBtn.outerHTML = `<div id="coolingRefreshBtn" class="flex items-center gap-2 w-full">
              <button onclick="reviewLastSession('ja')" class="flex-1 py-3.5 bg-transparent border border-borderline/50 text-muted hover:text-charcoal hover:bg-surface transition-all font-bold tracking-[0.2em] uppercase text-center text-[0.75rem] rounded-sm">无痕 (日)</button>
              <button onclick="reviewLastSession('en')" class="flex-1 py-3.5 bg-transparent border border-borderline/50 text-muted hover:text-charcoal hover:bg-surface transition-all font-bold tracking-[0.2em] uppercase text-center text-[0.75rem] rounded-sm">无痕 (英)</button>
            </div>`;
    }
  }

  // Bug 5: 显示今日预估信息
  const forecast = stats ? stats.todayForecast : null;
  if (forecast && forecast.coolingWords > 0) {
    countdownEl.classList.remove('hidden');
    countdownEl.innerHTML = `
      <div class="flex items-center gap-1.5 mb-2 opacity-60">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"></path></svg>
        <span class="font-bold tracking-widest text-[9px] uppercase font-ui">Pending Cooling</span>
      </div>
      <div class="leading-relaxed text-[11px] font-ui tracking-[0.1em]">
        尚有 <b class="font-mono text-charcoal font-normal text-[13px]">${forecast.coolingWords}</b> 个卡片处于短期冷却池中，预计 <b class="font-mono text-charcoal font-normal text-[13px]">${forecast.estimatedMinutes}</b> 分钟内陆续到期。
      </div>
    `;
  } else {
    countdownEl.classList.add('hidden');
  }
}

// 提取为一个纯粹返回 HTML 字符串的函数
function getCardHTML(index, word) {
  const zIndex = 1000 - index;
  const relativeIndex = index - state.studyIndex;
  
  // 1. 判定当前是否为学术模式
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const isEditorial = currentTheme === 'editorial';

  if (isEditorial) {
    // 学术模式的独立渲染：先锋学术报 / 日语词典排版
    const ej = escapeHtml(word.japanese);
    const er = escapeHtml(word.reading) || '-';
    const em = escapeHtml(word.meaning);
    const ep = escapeHtml(word.partOfSpeech) || '其他';
    return `
      <div id="word-group-${index}" class="word-group" data-depth="${relativeIndex <= 2 ? relativeIndex : 'hidden'}" style="z-index: ${zIndex}">
        <div class="paper-card back editorial-dict-back">
          <div class="editorial-dict-header">
            <span class="reading font-display">${er}</span>
            <span class="pos font-ui">[${ep}]</span>
          </div>
          <div class="editorial-dict-divider"></div>
          <div class="meaning font-display text-charcoal">${em}</div>
        </div>
        <div class="paper-card front editorial-dict-front" onclick="revealAnswer()">
          <div class="editorial-dict-top">
            <span class="pos font-ui">[${ep}]</span>
            <span class="dict-vol font-ui">No.${(index + 1).toString().padStart(3, '0')}</span>
          </div>
          
          <div class="word font-display text-charcoal card-front-word" ${state.currentLang === 'ja' ? 'lang="ja"' : ''}>${ej}</div>
          
          <div class="mt-auto editorial-dict-footer font-ui action-hint">
            <span>点击或按下 <kbd>Space</kbd> 揭开释义</span>
          </div>
        </div>
      </div>
    `;
  }

  // 2. 默认与 Obsidian 模式
  const ej = escapeHtml(word.japanese);
  const er = escapeHtml(word.reading) || '-';
  const em = escapeHtml(word.meaning);
  const ep = escapeHtml(word.partOfSpeech) || '其他';
  const studyWordClasses = `text-charcoal mb-2 leading-none break-all transition-all duration-500`;

  return `
    <div id="word-group-${index}" class="word-group" data-depth="${relativeIndex <= 2 ? relativeIndex : 'hidden'}" style="z-index: ${zIndex}">
      <div class="paper-card back">
        <div class="text-xl font-display text-ochre mb-4 font-medium">${er}</div>
        <div class="text-2xl sm:text-3xl font-display font-semibold text-charcoal mb-4 sm:mb-6 text-center leading-tight-display">${em}</div>
        <div class="footnote-tag uppercase font-ui">${ep}</div>
      </div>
      <div class="paper-card front" onclick="revealAnswer()">
        <span class="footnote-tag uppercase mb-4 font-ui">${ep}</span>
        
        <div class="card-front-word ${studyWordClasses}" ${state.currentLang === 'ja' ? 'lang="ja"' : ''}>${ej}</div>
        
        <div class="mt-auto pt-8 text-sm text-muted/60 flex items-center justify-center font-ui">
          <span>点击撕下便签</span>
          <div class="hidden sm:flex items-center ml-2">
            <kbd class="px-2 py-[2px] bg-surface border border-borderline border-b-[3px] rounded-[4px] text-[10px] font-mono text-charcoal font-bold">Space</kbd>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 修改原有的 addCardToDOM，仅用于动态追加单张卡片
function addCardToDOM(index, word) {
  const stack = document.getElementById('cardStack');
  stack.insertAdjacentHTML('beforeend', getCardHTML(index, word));
}

// 核心优化：懒加载渲染（且最多渲染4张）
function renderCardStack() {
  const stack = document.getElementById('cardStack');
  stack.innerHTML = '';
  
  let html = '';
  // 最多只预渲染当前索引开始的 4 张卡片，彻底避免 DOM 爆炸
  const limit = Math.min(state.studyWords.length, state.studyIndex + 4);
  for (let i = state.studyIndex; i < limit; i++) {
    html += getCardHTML(i, state.studyWords[i]);
  }
  stack.innerHTML = html;

  stack.classList.remove('incoming');
  void stack.offsetWidth;
  stack.classList.add('incoming');
}

let revealTimeout;
let isReviewProcessing = false;
let revealAllowed = false;

function revealAnswer() {
  const currentGroup = document.getElementById(`word-group-${state.studyIndex}`);
  if (!currentGroup) return;

  // 【修复】：在这里获取当前的 word 对象，供后面拉取预测时间使用
  const word = state.studyWords[state.studyIndex];

  const front = currentGroup.querySelector('.front');
  const back = currentGroup.querySelector('.back');
  
  if (!front.classList.contains('peeled')) {
    revealAllowed = false;
    front.classList.add('peeled');
    back.classList.add('revealed');
    
    // 定位到专门显示预测时间的 span 类
    const intervalSpans = document.querySelectorAll('#answerSection .interval-text');
    
    if (!state.isCramMode) {
      api(`/study/scheduling?wordId=${word._id}`).then(info => {
        if (intervalSpans.length === 4) {
          intervalSpans[0].textContent = info.again ? info.again.interval : '-';
          intervalSpans[1].textContent = info.hard ? info.hard.interval : '-';
          intervalSpans[2].textContent = info.good ? info.good.interval : '-';
          intervalSpans[3].textContent = info.easy ? info.easy.interval : '-';
        }
      }).catch(err => console.log('预测时间获取失败', err));
    } else {
      // 巩固模式下，直接显示明确的中文“无痕”，消除“影响 FSRS 算法”的心理误导
      if (intervalSpans.length === 4) {
        intervalSpans[0].textContent = '无痕';
        intervalSpans[1].textContent = '无痕';
        intervalSpans[2].textContent = '无痕';
        intervalSpans[3].textContent = '无痕';
      }
    }

    if (revealTimeout) clearTimeout(revealTimeout);
    revealTimeout = setTimeout(() => {
      if (isReviewProcessing) return;
      revealAllowed = true;
      document.getElementById('answerSection').classList.add('show');
    }, 200);
  }
}

document.addEventListener('keydown', (e) => {
  if (isReviewProcessing) return;
  const viewStudy = document.getElementById('view-study');
  if (!viewStudy.classList.contains('active')) return;
  if (!document.getElementById('studyComplete').classList.contains('hidden')) return;
  const currentGroup = document.getElementById(`word-group-${state.studyIndex}`);
  if (!currentGroup) return;
  const front = currentGroup.querySelector('.front');
  if (!front.classList.contains('peeled') && (e.code === 'Space' || e.code === 'Enter')) {
    e.preventDefault();
    revealAnswer();
  } else if (front.classList.contains('peeled') && revealAllowed) {
    if (e.key === '1') submitReview('again');
    if (e.key === '2') submitReview('hard');
    if (e.key === '3') submitReview('good');
    if (e.key === '4') submitReview('easy');
  }
});

async function submitReview(result) {
  if (isReviewProcessing) return;
  isReviewProcessing = true;
  revealAllowed = false;

  if (revealTimeout) { clearTimeout(revealTimeout); revealTimeout = null; }

  const currentGroup = document.getElementById(`word-group-${state.studyIndex}`);
  if (!currentGroup) { isReviewProcessing = false; return; }
  const front = currentGroup.querySelector('.front');
  if (!front.classList.contains('peeled')) { isReviewProcessing = false; return; }

  document.getElementById('answerSection').classList.remove('show');
  const word = state.studyWords[state.studyIndex];
  
  // 【修复 1】：将 resData 提取到外层
  let resData = null; 
  
  try {
    if (!state.isCramMode) {
      resData = await api('/study/review', { method: 'POST', body: JSON.stringify({ wordId: word._id, result }) });

      // 记录撤回历史
      state.studyHistory.push({
        wordId: word._id,
        index: state.studyIndex,
        result,
        word: { ...word }
      });
      document.getElementById('undoBtn').disabled = false;

      // 捕获 1 分钟 / 10 分钟短时记忆
      if (resData.scheduled_days < 1) {
        const dueTime = new Date(resData.due).getTime();
        if (dueTime > Date.now()) {
          state.coolingWords.push(resData); 
        }
      }
    }
  } catch (err) {
    // 👇 新增防御逻辑：拦截 404 幽灵数据错误，打破死循环
    if (err.message === 'Word not found') {
      showToast('检测到该单词已被删除，正在自动清理幽灵缓存并重新加载...', 'info');
      // 清除掉产生冲突的本地进度
      localStorage.removeItem(`active_session_${state.currentLang}`);
      isReviewProcessing = false;
      // 重新向后端发起真实请求，刷新牌堆
      initStudy();
      return; 
    }

    // 👇 保留原有的常规网络错误处理
    showToast(`复习记录保存失败：${err.message || '网络异常'}`, 'error');
    console.error('Review Error', err);
    isReviewProcessing = false;
    revealAllowed = true;
    document.getElementById('answerSection').classList.add('show');
    return; 
  }
  state.studyStats.reviewed++;
  state.studyStats[result]++;
  // 跨轮次累计统计
  state.sessionStats.reviewed++;
  state.sessionStats[result]++;

  // 整组卡片飞走剥离
  if (currentGroup) {
    currentGroup.classList.add(`discarded-${result}`);
    setTimeout(() => {
      if (currentGroup.parentNode) {
        currentGroup.parentNode.removeChild(currentGroup);
      }
    }, 600);
  }

  // 【修复 2】：智能判断是否需要追加到当前牌堆底
  if (result === 'again') {
    let shouldAppend = true;
    
    // 如果后端返回了由于 FSRS 算法产生的真实下次复习时间
    if (resData && resData.due) {
      const dueTime = new Date(resData.due).getTime();
      const diffMinutes = (dueTime - Date.now()) / 60000;
      
      // 如果冷却时间超过 2 分钟（即 10 分钟那次阶梯），就不追加到牌堆底了
      // 把它留在后台，让用户完成当前牌堆后，自然进入冷却池倒计时界面
      if (diffMinutes > 2) {
        shouldAppend = false;
      }
    }

    if (shouldAppend) {
      const newWord = { ...word };
      state.studyWords.push(newWord);
      addCardToDOM(state.studyWords.length - 1, newWord);
    }
  }

  state.studyIndex++;
  
  // 懒加载优化：甩掉当前卡片后，悄悄把后面第 4 张卡片注入 DOM 底部备用
  const upcomingIndex = state.studyIndex + 3;
  if (upcomingIndex < state.studyWords.length) {
    const existing = document.getElementById(`word-group-${upcomingIndex}`);
    if (!existing) {
      addCardToDOM(upcomingIndex, state.studyWords[upcomingIndex]);
    }
  }

  updateStackDepths();
  updateStudyProgress();

  if (state.studyIndex >= state.studyWords.length) {
    setTimeout(() => {
      showStudyComplete();
      isReviewProcessing = false;
    }, 400);
  } else {
    setTimeout(() => {
      isReviewProcessing = false;
    }, 150);
  }
}

function updateStackDepths() {
  state.studyWords.forEach((_, index) => {
    if (index < state.studyIndex) return;
    const group = document.getElementById(`word-group-${index}`);
    if (!group) return;

    const relativeIndex = index - state.studyIndex;
    let depth = 'hidden';
    if (relativeIndex === 0) depth = '0';
    else if (relativeIndex === 1) depth = '1';
    else if (relativeIndex === 2) depth = '2';

    group.setAttribute('data-depth', depth);
    group.style.zIndex = String(1000 - relativeIndex);
  });
}

function updateStudyProgress() {
  // 1. 计算出当前真实的"剩余未掌握卡片数"
  const totalLeft = state.studyWords.length - state.studyIndex;

  // 2. 已完成数量 = 初始目标总量 - 剩余量
  let completed = state.originalTotal - totalLeft;
  if (completed < 0) completed = 0; // 防止极端情况下点太多重来变成负数

  // 3. 计算百分比（分母永远锁定为最开始定下的总量）
  const pct = state.originalTotal === 0 ? 0 : (completed / state.originalTotal) * 100;

  // 4. 更新 UI
  document.getElementById('progressFill').style.width = `${pct}%`;
  document.getElementById('progressText').textContent = `${completed} / ${state.originalTotal}`;
}

function showStudyComplete() {
  document.getElementById('studyCardContainer').classList.add('hidden');

  // Bug 7: 不再在完成时覆盙保存（已在 initStudy 开始时保存了）

  // 每次学完不靠旧状态，直接找后端要最新倒计时
  api(`/study/stats?language=${state.currentLang}`).then(stats => {
      if (stats.upcomingWords && stats.upcomingWords.length > 0) {
          showCoolingState(stats.upcomingWords, stats);
      } else {
          // 彻底没有待复习单词了
          const el = document.getElementById('studyComplete');
          el.classList.remove('hidden');
          el.classList.add('pop-in');
          // 使用跨轮次累计统计，而非仅当前轮次的 studyStats
          const s = state.sessionStats;
          // 会话结束，重置标记
          state._sessionActive = false;
          document.getElementById('completeStats').innerHTML = `
          <div class="border-y border-borderline/40 py-5 mb-5 flex flex-col gap-3">
            <div class="flex justify-between items-baseline">
              <span class="font-ui text-[0.65rem] tracking-widest text-muted uppercase">Reviewed Items <span class="font-sans text-[10px] ml-1 opacity-60">复习总数</span></span>
              <span class="font-mono text-xl text-charcoal leading-none">${s.reviewed}</span>
            </div>
            <div class="flex justify-between items-baseline">
              <span class="font-ui text-[0.65rem] tracking-widest text-muted uppercase">Original Quota <span class="font-sans text-[10px] ml-1 opacity-60">原始词汇量</span></span>
              <span class="font-mono text-xl text-ochre leading-none">${state.sessionOriginalTotal || state.originalTotal}</span>
            </div>
          </div>
          
          <div class="flex justify-between pt-1 text-center font-ui px-2 pb-4">
            <div class="flex flex-col gap-1 w-1/4">
              <span class="text-[10px] tracking-widest text-muted uppercase">Again</span>
              <span class="font-mono text-sm text-terracotta">${s.again}</span>
            </div>
            <div class="flex flex-col gap-1 w-1/4 border-l border-borderline/40">
              <span class="text-[10px] tracking-widest text-muted uppercase">Hard</span>
              <span class="font-mono text-sm text-ochre">${s.hard}</span>
            </div>
            <div class="flex flex-col gap-1 w-1/4 border-l border-borderline/40">
              <span class="text-[10px] tracking-widest text-muted uppercase">Good</span>
              <span class="font-mono text-sm text-charcoal">${s.good}</span>
            </div>
            <div class="flex flex-col gap-1 w-1/4 border-l border-borderline/40">
              <span class="text-[10px] tracking-widest text-muted uppercase">Easy</span>
              <span class="font-mono text-sm text-success">${s.easy}</span>
            </div>
          </div>`;
          if (typeof confetti === 'function') {
            const getRGB = (varName) => {
              const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
              const parts = val.split(/\s+/);
              return parts.length === 3 ? `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})` : `rgb(${val})`;
            };
            const themeColors = [
              getRGB('--color-ochre'),
              getRGB('--color-terracotta'),
              getRGB('--color-charcoal'),
              getRGB('--color-success')
            ];
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: themeColors });
          }
      }
  });
}

let isLoadingSession = false;
async function reviewAgain(lang) {
  if (isLoadingSession) return;
  isLoadingSession = true;

  let originalLang = state.currentLang;
  if (lang && lang !== state.currentLang) {
    switchWorkspace(lang, true);
  }

  state.isCramMode = true; // 开启纯净巩固模式，不污染 FSRS 数据
  state.studyHistory = [];
  if (coolingTimer) { clearInterval(coolingTimer); coolingTimer = null; }

  // 👇 点击再练一次时，马上更新右上角文字
  const badge = document.getElementById('studyModeBadge');
  if (badge) badge.textContent = '无痕练习';

  // 【修复 Bug 3/4】通过后端接口拉取今日数据，支持跨设备与语种隔离
  let wordsToUse = [];
  try {
    const res = await api(`/study/reviewed_today?language=${state.currentLang}`);
    wordsToUse = res.words || [];
  } catch (e) {
    showToast('拉取复习记录失败', 'error');
    isLoadingSession = false;
    return;
  }

  if (wordsToUse.length === 0) {
    const langName = state.currentLang === 'ja' ? '日语' : '英语';
    showToast(`今日没有可复习的 ${langName} 记录`, 'error');
    
    // 如果跨语种拉取失败，将语种回退到点击前，防止用户卡在幽灵状态
    if (lang && originalLang !== lang) {
      switchWorkspace(originalLang, true);
    }
    
    isLoadingSession = false;
    return;
  }

  state.studyWords = wordsToUse;
  state.originalTotal = wordsToUse.length;
  state.studyIndex = 0;
  state.studyStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
  state.sessionStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
  state._sessionActive = true;
  
  // 👇 【新增这一行】：确保无痕模式下的原始词汇量也能覆盖掉之前残留的冷却数量
  state.sessionOriginalTotal = wordsToUse.length; 
  
  revealAllowed = false;
  
  document.getElementById('studyComplete').classList.add('hidden');
  document.getElementById('noWords').classList.add('hidden');
  document.getElementById('studyCardContainer').classList.remove('hidden');
  document.getElementById('undoBtn').disabled = true;

  renderCardStack();
  updateStudyProgress();
  
  isLoadingSession = false;
}

async function reviewLastSession(lang) {
  await reviewAgain(lang); // 逻辑完全一致，直接复用
}

// Bug 2+3: 撤回上一步复习（修复 DOM 状态恢复）
async function undoLastReview() {
  if (state.studyHistory.length === 0 || state.isCramMode) {
    showToast('没有可撤回的操作', 'error');
    return;
  }

  // Bug 2: 防止撤回期间重复操作
  if (isReviewProcessing) return;
  isReviewProcessing = true;

  const last = state.studyHistory.pop();
  const undoBtn = document.getElementById('undoBtn');
  undoBtn.disabled = true;

  try {
    await api('/study/undo', { method: 'POST', body: JSON.stringify({ wordId: last.wordId }) });

    // 回退统计
    state.studyStats.reviewed = Math.max(0, state.studyStats.reviewed - 1);
    state.studyStats[last.result] = Math.max(0, state.studyStats[last.result] - 1);
    // 撤回也要同步扣减跨轮次累计统计
    state.sessionStats.reviewed = Math.max(0, state.sessionStats.reviewed - 1);
    state.sessionStats[last.result] = Math.max(0, state.sessionStats[last.result] - 1);

    // 如果该单词因为 "again" 被追加到末尾，移除末尾的副本
    if (last.result === 'again') {
      for (let i = state.studyWords.length - 1; i >= state.studyIndex; i--) {
        if (state.studyWords[i]._id === last.wordId) {
          const tailGroup = document.getElementById(`word-group-${i}`);
          if (tailGroup) tailGroup.remove();
          state.studyWords.splice(i, 1);
          break;
        }
      }
    }

    // 回退 index
    state.studyIndex--;

    // Bug 2: 先彻底移除可能残留的旧 DOM 节点
    const staleGroup = document.getElementById(`word-group-${last.index}`);
    if (staleGroup) staleGroup.remove();

    // 重新创建卡片 DOM（干净的未翻开状态）
    addCardToDOM(last.index, last.word);
    
    // Bug 5: 核心修复 - 撤回后清除新卡片的已翻面残余状态
    const nextGroup = document.getElementById(`word-group-${state.studyIndex + 1}`);
    if (nextGroup) {
      const front = nextGroup.querySelector('.front');
      const back = nextGroup.querySelector('.back');
      if (front) front.classList.remove('peeled');
      if (back) back.classList.remove('revealed');
    }

    updateStackDepths();
    updateStudyProgress();

    // Bug 2: 重置所有交互状态
    document.getElementById('answerSection').classList.remove('show');
    revealAllowed = false;
    if (revealTimeout) { clearTimeout(revealTimeout); revealTimeout = null; }

    showToast('已撤回上一步', 'success');
  } catch (err) {
    state.studyHistory.push(last);
    showToast('撤回失败: ' + err.message, 'error');
  }

  // Bug 2: 确保解锁交互
  isReviewProcessing = false;
  undoBtn.disabled = state.studyHistory.length === 0;
}

// Bug 4: 加量学习 - 释放被推迟的新词
async function handleExtraStudy() {
  const count = parseInt(document.getElementById('extraCountInput').value) || 5;
  const btn = document.getElementById('extraStudyBtn');
  btn.disabled = true;
  btn.textContent = '释放中...';

  try {
    const result = await api('/study/extra', {
      method: 'POST',
      body: JSON.stringify({ count, language: state.currentLang })
    });

    if (result.released > 0) {
      showToast(`已释放 ${result.released} 个新词，重新加载中...`, 'success');
      setTimeout(() => initStudy(), 500);
    } else {
      showToast('没有更多被推迟的新词可释放', 'info');
    }
  } catch (err) {
    showToast('释放失败: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '加量学习';
  }
}

let _onboardingRetryCount = 0;
const _ONBOARDING_MAX_RETRIES = 5;

function checkAndStartOnboarding() {
  try {
    if (localStorage.getItem('hasSeenOnboarding')) return;

    // 等待 Driver.js 加载完成（带重试上限，防止 CDN 失败时无限递归）
    if (!window.driver || !window.driver.js || !window.driver.js.driver) {
      _onboardingRetryCount++;
      if (_onboardingRetryCount > _ONBOARDING_MAX_RETRIES) {
        console.warn('[Onboarding] Driver.js 加载超时（已重试' + _ONBOARDING_MAX_RETRIES + '次），放弃引导流程。');
        return;
      }
      console.warn('[Onboarding] Driver.js 尚未加载，1秒后重试... (' + _onboardingRetryCount + '/' + _ONBOARDING_MAX_RETRIES + ')');
      setTimeout(checkAndStartOnboarding, 1000);
      return;
    }

    // 确认当前在 dashboard 视图
    const dashView = document.getElementById('view-dashboard');
    if (!dashView || !dashView.classList.contains('active')) return;

    const isMobile = window.innerWidth < 640;

    // 基础步骤（桌面和手机通用）
    const steps = [
      {
        popover: {
          title: '欢迎来到 見だ | 记忆召唤！',
          description: '这是一个基于纯粹 FSRS 算法打造的极简双语记忆系统。让我们花 1 分钟熟悉环境，掌握高分复习的诀窍。',
          align: 'center'
        }
      },
      {
        element: '#ws-btn-ja',
        popover: {
          title: '双语工作区隔离',
          description: '点击这里可以在日语（見だ）与英语（See）工作区之间无缝切换。您的词库、复习配额和冷却池都完全物理隔离！',
          side: 'bottom', align: 'start'
        }
      },
      {
        element: '#tour-action-bar',
        popover: {
          title: '建立您的专属词库',
          description: '一键导入外部词书、通过 AI 批量解析生词，或手动单个添加。这是每天复习的第一步。',
          side: 'bottom', align: 'center'
        }
      },
      {
        element: '#tour-stats-area',
        popover: {
          title: '记忆冷却与统计',
          description: '严格遵循 FSRS 最新算法。复习时每个单词都会进入专属「冷却池」，您将直观地看到今天还有多少新词和旧词「待复习」。',
          side: 'bottom', align: 'start'
        }
      },
      {
        element: '#notifyBtn',
        popover: {
          title: '千万别漏掉冷却提醒！',
          description: '强烈建议开启桌面通知（🔔）！即使页面挂在后台，系统仍会在短冷却（如1分钟、10分钟）倒计时结束后准时唤醒您。',
          side: 'bottom', align: 'end'
        }
      },
      {
        element: '#tour-study-btn',
        popover: {
          title: '沉浸复习',
          description: '当日新词和冷却完成的词在这里等您。点击此处即可马上开始召唤记忆！',
          side: 'top', align: 'end'
        }
      }
    ];

    // 最后一步：桌面端指向用户菜单，手机端指向设置齿轮按钮
    if (isMobile) {
      steps.push({
        popover: {
          title: '最后一步：个性化设置',
          description: '点击顶部导航栏的 ⚙️ 齿轮按钮进入「系统设置」，可以独立调整【英语 / 日语】每天的新词上限和记忆算法参数。设置完成后就可以开始学习啦！',
          align: 'center'
        }
      });
    } else {
      steps.push({
        element: '#userMenuContainer',
        popover: {
          title: '最后一步：个性化设置',
          description: '点击您的头像进入「系统设置」，可以独立调整【英语 / 日语】两门语言每天的新词上限和记忆算法。设置完成后就可以开始学习啦！',
          side: 'left', align: 'start'
        }
      });
    }

    // 防重入标志：防止 onDestroyStarted 内部 destroy() 再次触发自身
    let _isDestroyingOnboarding = false;

    const driverInstance = window.driver.js.driver({
      showProgress: true,
      allowClose: true,
      overlayColor: 'rgba(26, 47, 43, 0.55)',
      nextBtnText: '下一步 →',
      prevBtnText: '← 上一步',
      doneBtnText: '✓ 完成设置',
      steps: steps,
      onDestroyStarted: () => {
        // 防重入：destroy() 会再次触发 onDestroyStarted
        if (_isDestroyingOnboarding) return;
        _isDestroyingOnboarding = true;

        localStorage.setItem('hasSeenOnboarding', 'true');
        driverInstance.destroy();
        setTimeout(() => {
          openModal('settingsModal');
        }, 400);
      }
    });

    setTimeout(() => {
      driverInstance.drive();
    }, 600);

  } catch (err) {
    console.error('[Onboarding] 引导流程启动失败：', err);
    // 引导失败不应阻塞用户，标记为已看过避免反复弹出
    localStorage.setItem('hasSeenOnboarding', 'true');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  switchWorkspace(state.currentLang, true);
  const token = localStorage.getItem('token'), user = localStorage.getItem('user');
  if (token && user) {
    state.token = token; state.user = JSON.parse(user);
    
    // 👇 替换掉原本的手动渲染逻辑
    renderUserInfo();
    // 👆 替换结束
    
    if ('Notification' in window && Notification.permission === 'granted') {
      state.notificationsEnabled = true;
      const btn = document.getElementById('notifyBtn');
      if (btn) btn.classList.add('text-ochre');
    }

    startBackgroundPolling();
    loadNotifySettings();
    navigate('dashboard');
  }
  else navigate('auth');
});

// ==================== 自定义高定下拉框逻辑 ====================
function initCustomSelects() {
  document.querySelectorAll('.custom-select').forEach(wrapper => {
    const trigger = wrapper.querySelector('.select-trigger');
    const optionsList = wrapper.querySelector('.select-options');
    const textDisplay = wrapper.querySelector('.select-text');
    const hiddenInput = wrapper.querySelector('input[type="hidden"]');
    const arrow = wrapper.querySelector('.select-arrow');

    // 点击框体：展开或收起
    trigger.addEventListener('click', (e) => {
      e.stopPropagation(); // 阻止冒泡
      
      // 关闭其他可能已经打开的下拉框
      document.querySelectorAll('.select-options.is-open').forEach(list => {
        if (list !== optionsList) {
          list.classList.remove('is-open');
          list.previousElementSibling.querySelector('.select-arrow').style.transform = 'rotate(0deg)';
        }
      });

      // 切换当前的开关状态
      const isOpen = optionsList.classList.contains('is-open');
      if (isOpen) {
        optionsList.classList.remove('is-open');
        arrow.style.transform = 'rotate(0deg)';
      } else {
        optionsList.classList.add('is-open');
        arrow.style.transform = 'rotate(180deg)'; // 箭头翻转
      }
    });

    // 点击选项：选中值，关闭列表，并触发 onChange
    optionsList.querySelectorAll('li').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const value = item.getAttribute('data-value');
        const text = item.textContent;
        
        // 更新显示文字和隐藏的 input 值
        textDisplay.textContent = text;
        if (value === "") {
            textDisplay.classList.add('text-muted');
        } else {
            textDisplay.classList.remove('text-muted');
        }
        
        hiddenInput.value = value;

        // 如果是控制台的筛选框，点击后直接触发查询（替代原本的 onchange）
        if (hiddenInput.id === 'partOfSpeechFilter') {
          // 这里调用你原本用于筛选的函数，由于我没有完整的函数名，假设你直接在重新加载
          loadWords(1); 
        }

        // 收起列表
        optionsList.classList.remove('is-open');
        arrow.style.transform = 'rotate(0deg)';
      });
    });
  });

  // 点击页面空白处：收起所有已展开的下拉框
  document.addEventListener('click', () => {
    document.querySelectorAll('.select-options.is-open').forEach(list => {
      list.classList.remove('is-open');
      const wrapper = list.closest('.custom-select');
      if (wrapper) {
        const arrow = wrapper.querySelector('.select-arrow');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
      }
    });
  });
}

