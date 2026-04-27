/* ================= DASHBOARD ================= */
let calendarRenderCounter = 0; // 声明在函数外部
let _onboardingChecked = false;
async function initDashboard() {
  await loadStats();
  loadWords(1);
  // 引导只在首次加载时检查一次，避免切换工作区/返回时重复弹出
  if (!_onboardingChecked) {
    _onboardingChecked = true;
    if (typeof checkAndStartOnboarding === 'function') {
      setTimeout(() => {
        checkAndStartOnboarding();
      }, 800);
    }
  }
}

async function loadStats() {
  const data = await api(`/study/stats?language=${state.currentLang}`);
  window.currentStatsData = data; // store for theme switching
  document.getElementById('totalWords').textContent = data.totalWords;
  document.getElementById('dueWords').textContent = data.dueWords;
  state.lastDueCount = data.dueWords;

  // 👇 新增以下两行：在切换语种或回到主页时，立刻同步并渲染冷却池
  state.upcomingWords = data.upcomingWords || [];
  renderUpcomingWidget();
  
  if (typeof renderStatsChart === 'function') {
    renderStatsChart(data);
  }
  if (typeof renderCalendarChart === 'function') {
    // 移除 window.currentCalendarData = null; 
    renderCalendarChart();
  }
}

let myStatsChart = null;
let myCalendarChart = null;

function renderStatsChart(statsData) {
  if (typeof echarts === 'undefined') {
    console.warn('ECharts is not defined. Skipping stats chart render.');
    return;
  }

  const chartDom = document.getElementById('statsChart');
  if (!chartDom) return;
  document.getElementById('statsChartWrapper').classList.remove('hidden');

  if (!myStatsChart) {
    myStatsChart = echarts.init(chartDom);
    window.addEventListener('resize', () => {
      if (myStatsChart) myStatsChart.resize();
    });
    
    myStatsChart.on('click', async (params) => {
      await showDetailedReviewList(params.name);
    });
  }

  // 使用 document.documentElement 确保在所有主题下都能准确取到 :root 变量
  const rootStyle = getComputedStyle(document.documentElement);
  const getColor = (varName, fallback) => {
    const val = rootStyle.getPropertyValue(varName).trim();
    return val ? `rgb(${val.split(/\s+/).join(', ')})` : fallback;
  };

  const cCharcoal = getColor('--color-charcoal', '#1a2f2b');
  const cOchre = getColor('--color-ochre', '#df9f28');
  const cTerracotta = getColor('--color-terracotta', '#d16b4a');
  const cSuccess = getColor('--color-success', '#4b7365');
  const cMuted = getColor('--color-muted', '#8b8982');
  const cSurface = getColor('--color-surface', '#ffffff');
  const cBorderline = getColor('--color-borderline', '#e5e1d8');
  const fontUi = rootStyle.getPropertyValue('--font-ui') || 'sans-serif';

  const dataArray = [
    { value: statsData.totalNewWords || 0, name: '新词 (New)', itemStyle: { color: cTerracotta } },
    { value: statsData.learningWords || 0, name: '学习中 (Learning)', itemStyle: { color: cOchre } },
    { value: statsData.reviewWords || 0, name: '待复习 (Review)', itemStyle: { color: cMuted } },
    { value: statsData.masteredWords || 0, name: '已掌握 (Mastered)', itemStyle: { color: cSuccess } }
  ].filter(item => item.value > 0);

  const option = {
    tooltip: {
      trigger: 'item',
      backgroundColor: `rgba(${(rootStyle.getPropertyValue('--color-surface').trim() || '255 255 255').split(/\s+/).join(', ')}, 0.9)`,
      borderColor: cBorderline,
      textStyle: { color: cCharcoal, fontFamily: fontUi }
    },
    // 👇 1. 直接隐藏图例，彻底告别遮挡
    legend: { 
      show: false 
    },
    series: [
      {
        name: '学习状态', 
        type: 'pie', 
        // 👇 2. 既然底部没有文字了，恢复完美的居中对齐，并放大圆环
        radius: ['40%', '75%'], 
        center: ['50%', '50%'], 
        // 👇 3. 依然保留 minAngle，防止只有几个词时扇形太小点不到
        minAngle: 15,
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 6, borderColor: cSurface, borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: {
          label: { show: true, fontSize: 13, lineHeight: 18, fontWeight: 'bold', color: cCharcoal, formatter: '{b}\n{c} 词' }
        },
        labelLine: { show: false },
        data: dataArray.length > 0 ? dataArray : [{ value: 1, name: '无数据', itemStyle: { color: cBorderline } }]
      }
    ]
  };

  myStatsChart.setOption(option);
  
  // 延迟调整尺寸，完美避开 CSS entrance 动画导致的计算错误
  setTimeout(() => myStatsChart.resize(), 350);
}

async function renderCalendarChart() {
  const currentRenderId = ++calendarRenderCounter; // 捕获当前调用的 ID
  const wrapper = document.getElementById('calendarChartWrapper');
  if (!wrapper) return;
  wrapper.classList.remove('hidden');

  // 【DOM 自愈机制】
  let container = document.getElementById('nativeCalendarContainer');
  if (!container) {
      wrapper.innerHTML = `
        <div class="flex items-start justify-between mb-6 z-10 w-full">
          <div class="flex flex-col">
            <div class="text-[0.55rem] text-muted font-bold tracking-[0.3em] uppercase font-ui">Review Trajectory</div>
            <div class="text-lg font-display font-bold text-charcoal mt-1 tracking-tight">记忆刻痕热力图</div>
          </div>
          <div class="flex items-center gap-1.5 bg-surface/50 backdrop-blur-md border border-borderline rounded-full p-1 shadow-[var(--shadow-sm)]">
            <button onclick="navigateCalendarMonth(-1)" class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-charcoal hover:text-surface text-muted transition-all active:scale-90" title="上个月">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"></path></svg>
            </button>
            <span id="calendarMonthLabel" class="text-[0.7rem] text-charcoal font-bold font-ui min-w-[75px] text-center tracking-widest-plus"></span>
            <button onclick="navigateCalendarMonth(1)" class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-charcoal hover:text-surface text-muted transition-all active:scale-90" title="下个月">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L159.31,128,90.34,58.34a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"></path></svg>
            </button>
          </div>
        </div>
        <div id="nativeCalendarContainer" class="flex-1 w-full flex items-center justify-center sm:justify-start overflow-x-auto z-10 custom-scrollbar pb-4 pt-10 px-2"></div>
      `;
    container = document.getElementById('nativeCalendarContainer');
  }

  if (!window.calendarViewMonth) {
    const now = new Date();
    window.calendarViewMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  const vm = window.calendarViewMonth;
  const monthLabel = document.getElementById('calendarMonthLabel');
  if (monthLabel) monthLabel.textContent = `${vm.year}年${vm.month}月`;

  // 【加载状态】
  container.innerHTML = `
    <div class="w-full h-full flex flex-col items-center justify-center text-muted/60 text-xs animate-pulse min-h-[120px]">
      <svg class="animate-spin mb-2 h-5 w-5 text-ochre/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      编织记忆轨迹中...
    </div>
  `;

  try {
    if (!window.currentCalendarData) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; // 获取用户当前时区
      const calendarData = await api(`/study/calendar?language=${state.currentLang}&tz=${encodeURIComponent(tz)}`);
      // ⚠️ 关键拦截：如果请求期间用户又切了月份/语种，直接丢弃这份过期数据
      if (currentRenderId !== calendarRenderCounter) return; 
      window.currentCalendarData = calendarData || [];
    }
    
    if (currentRenderId !== calendarRenderCounter) return; // 拦截同步穿透

    const allData = window.currentCalendarData;
    const dataMap = new Map(allData.map(d => [d[0], d[1]]));

    const monthStr = `${vm.year}-${String(vm.month).padStart(2, '0')}`;
    const daysInMonth = new Date(vm.year, vm.month, 0).getDate();
    let firstDayIndex = new Date(vm.year, vm.month - 1, 1).getDay();
    const padDays = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    let html = `<div class="flex gap-1.5 sm:gap-3 items-end mx-auto sm:mx-0">`;
    
    // 左侧星期轴
    html += `
      <div class="flex flex-col justify-between pb-[2px] pr-1 h-[122px] sm:h-[174px] text-[10px] text-muted font-bold font-ui">
        <span class="mt-[14px] sm:mt-[20px]">一</span>
        <span>三</span>
        <span class="mb-[14px] sm:mb-[20px]">五</span>
      </div>
    `;

    // 【核心修复区域】：强制使用内联样式定义 7 行网格，绕开 Tailwind CDN 的限制
    html += `<div class="grid grid-flow-col gap-1 sm:gap-1.5" style="grid-template-rows: repeat(7, 1fr);">`;

    // 填充月初空白
    for (let i = 0; i < padDays; i++) {
      html += `<div class="w-[14px] h-[14px] sm:w-[20px] sm:h-[20px] opacity-0 pointer-events-none"></div>`;
    }

    // 渲染每一天 (替换 dashboard.js 中对应位置的代码)
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
      const count = dataMap.get(dateStr) || 0;
      
      let level = 0;
      let colorClass = "bg-borderline/30 border-borderline/50"; 
      if (count >= 40) { level = 4; colorClass = "bg-charcoal border-charcoal"; }
      else if (count >= 20) { level = 3; colorClass = "bg-terracotta border-terracotta"; }
      else if (count >= 5) { level = 2; colorClass = "bg-ochre/80 border-ochre/90"; }
      else if (count >= 1) { level = 1; colorClass = "bg-ochre/30 border-ochre/40"; }

      // 修复核心 1: 移除嵌套的 Tooltip DOM，加入 onmouseenter/onmouseleave 交由全局单例处理
      html += `
        <div class="cal-cell w-[14px] h-[14px] sm:w-[20px] sm:h-[20px] relative cursor-crosshair group z-10" 
             data-level="${level}" 
             onclick="showDetailedReviewListForDate('${dateStr}')"
             onmouseenter="showGlobalCalTooltip(this, '${dateStr}', ${count})"
             onmouseleave="hideGlobalCalTooltip()">
             
          <div class="absolute inset-0 rounded-[3px] sm:rounded transition-all duration-200 border ${colorClass} group-hover:scale-[1.3] group-hover:shadow-[0_8px_20px_rgba(26,47,43,0.15)] group-hover:border-charcoal group-hover:z-50"></div>
        </div>
      `;
    }

    html += `</div></div>`;
    container.innerHTML = html;

  } catch (err) {
    console.error("Failed to load calendar data:", err);
    container.innerHTML = `
      <div class="w-full h-full flex items-center justify-center text-terracotta text-xs opacity-70 min-h-[120px]">
        获取记忆轨迹失败，请刷新重试
      </div>
    `;
  }
}

function navigateCalendarMonth(offset) {
  if (!window.calendarViewMonth) return;
  let { year, month } = window.calendarViewMonth;
  month += offset;
  if (month < 1) { month = 12; year--; }
  if (month > 12) { month = 1; year++; }
  window.calendarViewMonth = { year, month };
  renderCalendarChart();
}

async function showDetailedReviewListForDate(dateStr) {
  document.getElementById('reviewListModalTitle').textContent = `详情：${dateStr} 的复习记录`;
  const listContainer = document.getElementById('reviewListContent');
  listContainer.innerHTML = '<div class="text-center py-6 text-muted">加载中...</div>';
  openModal('reviewListModal');

  try {
    const data = await api(`/study/reviewed_today?language=${state.currentLang}&date=${dateStr}`);
    const words = data.words || [];

    if (words.length === 0) {
      listContainer.innerHTML = '<div class="text-center py-6 text-muted">当日暂无复习记录</div>';
      return;
    }

    const isEn = state.currentLang === 'en';
    const fontClass = isEn ? 'font-sans tracking-tight' : 'font-jp';

    listContainer.innerHTML = words.map((w) => {
      let stateBadge = 'Review';
      if (w.state === 0) stateBadge = 'New';
      else if (w.state === 1 || w.state === 3) stateBadge = 'Learning';
      else if (w.state === 2 && (w.reps || 0) >= 5) stateBadge = 'Mastered';

      return `
      <div class="flex justify-between items-center p-3.5 bg-parchment rounded-xl mb-2 border border-borderline/40 hover:border-ochre/30 transition-colors">
        <div class="flex-1 min-w-0 pr-4">
          <span class="font-bold text-charcoal truncate block ${fontClass} text-[1.1rem]" ${w.language === 'ja' ? 'lang="ja"' : ''}>${escapeHtml(w.japanese)}</span>
          <span class="text-xs text-muted block mt-1 truncate">${escapeHtml(w.reading || '')} ${w.reading ? '·' : ''} ${escapeHtml(w.meaning)}</span>
        </div>
        <div class="text-right flex flex-col items-end gap-1 flex-shrink-0">
          <span class="footnote-tag font-ui">${stateBadge}</span>
          <span class="text-[10px] text-muted">复习 ${w.reps || 0} 次</span>
        </div>
      </div>
      `;
    }).join('');

  } catch (err) {
    listContainer.innerHTML = '<div class="text-center py-6 text-terracotta">加载失败，请重试</div>';
  }
}

async function showDetailedReviewList(categoryName) {
  if (categoryName === '无数据') return;

  let statusFilter = '';
  if (categoryName.includes('New')) statusFilter = 'new';
  else if (categoryName.includes('Learning')) statusFilter = 'learning';
  else if (categoryName.includes('Review')) statusFilter = 'review';
  else if (categoryName.includes('Mastered')) statusFilter = 'mastered';

  if (!statusFilter) return;

  document.getElementById('reviewListModalTitle').textContent = `详情：${categoryName}`;
  const listContainer = document.getElementById('reviewListContent');
  listContainer.innerHTML = '<div class="text-center py-6 text-muted">加载中...</div>';
  
  openModal('reviewListModal');

  try {
    const data = await api(`/words?limit=100&language=${state.currentLang}&status=${statusFilter}`);
    const words = data.words || [];

    if (words.length === 0) {
      listContainer.innerHTML = '<div class="text-center py-6 text-muted">该分类下暂无单词</div>';
      return;
    }

    const isEn = state.currentLang === 'en';
    const fontClass = isEn ? 'font-sans tracking-tight' : 'font-jp';

    listContainer.innerHTML = words.map((w) => {
      let stateBadge = 'Review';
      if (w.state === 0) stateBadge = 'New';
      else if (w.state === 1 || w.state === 3) stateBadge = 'Learning';
      else if (w.state === 2 && (w.reps || 0) >= 5) stateBadge = 'Mastered';

      return `
      <div class="flex justify-between items-center p-3.5 bg-parchment rounded-xl mb-2 border border-borderline/40 hover:border-ochre/30 transition-colors">
        <div class="flex-1 min-w-0 pr-4">
          <span class="font-bold text-charcoal truncate block ${fontClass} text-[1.1rem]" ${w.language === 'ja' ? 'lang="ja"' : ''}>${escapeHtml(w.japanese)}</span>
          <span class="text-xs text-muted block mt-1 truncate">${escapeHtml(w.reading || '')} ${w.reading ? '·' : ''} ${escapeHtml(w.meaning)}</span>
        </div>
        <div class="text-right flex flex-col items-end gap-1 flex-shrink-0">
          <span class="footnote-tag font-ui">${stateBadge}</span>
          <span class="text-[10px] text-muted">复习 ${w.reps || 0} 次</span>
        </div>
      </div>
      `;
    }).join('');

  } catch (err) {
    listContainer.innerHTML = '<div class="text-center py-6 text-terracotta">加载失败，请重试</div>';
  }
}


async function loadWords(page = 1) {
  state.pagination.page = page;
  const search = document.getElementById('searchInput').value, pos = document.getElementById('partOfSpeechFilter').value;
  const tbody = document.getElementById('wordTableBody');
  // Removed destructive tbody clear to prevent layout flicker
  try {
    let endpoint = `/words?page=${page}&limit=${state.pagination.limit}&language=${state.currentLang}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    if (pos) endpoint += `&partOfSpeech=${encodeURIComponent(pos)}`;
    const data = await api(endpoint);
    state.pagination.totalPages = data.pages;
    document.getElementById('pageTotalItems').textContent = data.total || data.words.length;
    renderWordList(data.words);
    renderPagination();
  } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-terracotta">加载失败</td></tr>'; }
}

function renderWordList(words) {
  state.currentPageWords = words;
  const tbody = document.getElementById('wordTableBody');
  if (!words.length) { tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-muted">暂无单词</td></tr>'; return; }
  tbody.innerHTML = words.map(w => {
    const checked = state.selectedWordIds.has(w._id) ? 'checked' : '';
    const fontClass = w.language === 'en' ? 'font-sans tracking-tight' : 'font-jp'; // 动态字体
    const ej = escapeHtml(w.japanese);
    const er = escapeHtml(w.reading);
    const em = escapeHtml(w.meaning);
    const ep = escapeHtml(w.partOfSpeech) || '其他';
    return `
    <tr class="airy-row group ${checked ? 'bg-ochre/5 border-transparent shadow-[inset_4px_0_0_#DF9F28]' : ''}">
      <td class="px-5 py-5">
        <input type="checkbox" value="${w._id}" ${checked} onchange="toggleWordSelect('${w._id}')" class="w-4 h-4 rounded-sm border-borderline text-ochre focus:ring-1 focus:ring-ochre/30 cursor-pointer transition-all">
      </td>
      <td class="px-6 py-4">
        <span class="text-xl font-bold font-jp leading-tight block" ${w.language === 'ja' ? 'lang="ja"' : ''}>${ej}</span>
        <span class="text-xs text-muted font-jp opacity-60">${er || ''}</span>
      </td>
      <td class="px-6 py-4 text-sm font-medium font-ui opacity-90">${em}</td>
      <td class="px-4 py-4">
        <div class="flex flex-wrap gap-2 max-w-[120px] items-center">
          <span class="footnote-tag font-ui">${ep}</span>
          ${((w.tags || []).slice(0, 2).map(t => `<span class="footnote-tag font-ui">${escapeHtml(t)}</span>`)).join('')}${(w.tags || []).length > 2 ? `<span class="text-[10px] opacity-40 font-ui">+${(w.tags || []).length - 2}</span>` : ''}
        </div>
      </td>
      <td class="px-6 py-4 due-cell" data-due="${w.due}" data-state="${w.state}">${formatDate(w.due, w.state)}</td>
      <td class="px-6 py-4 text-right">
        <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onclick="editWord('${w._id}')" class="w-8 h-8 rounded-full hover:bg-parchment text-muted hover:text-charcoal transition-all flex items-center justify-center" title="编辑">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z"></path></svg>
          </button>
          <button onclick="deleteWord('${w._id}')" class="w-8 h-8 rounded-full hover:bg-parchment text-muted hover:text-terracotta transition-all flex items-center justify-center" title="删除">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"></path></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
  updateBatchBar();
}

function renderPagination() {
  const nav = document.getElementById('pagination'), { page, totalPages } = state.pagination;
  if (totalPages <= 1) return nav.innerHTML = '';
  
  let html = '';
  
  if (page > 1) {
    html += `<button onclick="loadWords(${page - 1})" class="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-charcoal hover:bg-parchment/50 transition-all cursor-pointer" title="上一页"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"></path></svg></button>`;
  }

  let startPage = Math.max(1, page - 2);
  let endPage = startPage + 4;
  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - 4);
  }

  if (startPage > 1) {
    html += `<button onclick="loadWords(1)" class="w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold transition-all bg-transparent text-muted hover:text-charcoal hover:bg-parchment/50 cursor-pointer">1</button>`;
    if (startPage > 2) html += `<span class="w-8 h-8 flex items-center justify-center text-xs text-muted/50 select-none">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    const active = i === page ? 'bg-charcoal text-surface shadow-md' : 'bg-transparent text-muted hover:text-charcoal hover:bg-parchment/50 cursor-pointer';
    html += `<button onclick="loadWords(${i})" class="w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold transition-all ${active}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="w-8 h-8 flex items-center justify-center text-xs text-muted/50 select-none">...</span>`;
    html += `<button onclick="loadWords(${totalPages})" class="w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold transition-all bg-transparent text-muted hover:text-charcoal hover:bg-parchment/50 cursor-pointer">${totalPages}</button>`;
  }

  if (page < totalPages) {
    html += `<button onclick="loadWords(${page + 1})" class="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-charcoal hover:bg-parchment/50 transition-all cursor-pointer" title="下一页"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L159.31,128,90.34,58.34a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"></path></svg></button>`;
  }

  nav.innerHTML = html;
}

let searchTimer;
document.getElementById('searchInput').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadWords(1), 250); });
// 注：partOfSpeechFilter 的筛选触发已在 initCustomSelects() 中直接调用 loadWords(1) 实现

/* ================= CRUD ================= */
document.getElementById('wordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('wordId').value;
  const data = { 
    language: state.currentLang,
    japanese: document.getElementById('japanese').value, 
    reading: document.getElementById('reading').value, 
    meaning: document.getElementById('meaning').value, 
    partOfSpeech: document.getElementById('partOfSpeech').value, 
    tags: document.getElementById('tags').value.split(',').map(t => t.trim()).filter(Boolean) 
  };
  try {
    if (id) await api(`/words/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    else await api('/words', { method: 'POST', body: JSON.stringify(data) });
    closeModal('wordModal');
    showToast('保存成功', 'success');
    loadWords(state.pagination.page); loadStats();
  } catch (err) { showToast('保存失败', 'error'); }
});

async function editWord(id) {
  try {
    const word = await api(`/words/${id}`);
    if (!word) return;
    document.getElementById('modalTitle').textContent = '编辑单词';
    document.getElementById('wordId').value = id;

    document.getElementById('japanese').value = word.japanese;
    document.getElementById('reading').value = word.reading || '';
    document.getElementById('meaning').value = word.meaning;
    document.getElementById('partOfSpeech').value = word.partOfSpeech || '名词';
    // 同步自定义下拉框的视觉文字
    const addWordSelect = document.getElementById('addWordSelectWrapper');
    if (addWordSelect) {
      const textEl = addWordSelect.querySelector('.select-text');
      if (textEl) textEl.textContent = word.partOfSpeech || '名词';
    }
    document.getElementById('tags').value = (word.tags || []).join(', ');
    openModal('wordModal');
  } catch (e) {
    showToast('加载单词数据失败', 'error');
  }
}

async function deleteWord(id) {
  if (!confirm('确定要删除这个单词吗？')) return;
  await api(`/words/${id}`, { method: 'DELETE' });
  localStorage.removeItem(`active_session_${state.currentLang}`); // 清除背诵缓存，防止已删单词幽灵重现
  showToast('已删除', 'success');
  loadWords(state.pagination.page); loadStats();
}

async function handleAiGenerate() {
  const japanese = document.getElementById('japanese').value.trim();
  if (!japanese) return showToast('请先输入单词', 'error');

  const btn = document.getElementById('aiGenerateBtn');
  btn.disabled = true;
  btn.innerHTML = '<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> 生成中...';

  try {
    const res = await fetch(`${CONFIG.API_BASE}/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('token') && { 'x-auth-token': localStorage.getItem('token') }) },
      body: JSON.stringify({ japanese, language: state.currentLang })
    });

    if (!res.ok) throw new Error('生成失败');

    const data = await res.json();
    document.getElementById('reading').value = data.reading || '';
    document.getElementById('meaning').value = data.meaning || '';
    if (data.partOfSpeech) {
      document.getElementById('partOfSpeech').value = data.partOfSpeech;
    }
    document.getElementById('tags').value = (data.tags || []).join(', ');

    showToast('生成成功', 'success');
  } catch (e) {
    showToast('生成失败，请重试', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M197.67,186.37a8,8,0,0,1,0,11.29C196.58,198.73,170.82,224,128,224c-37.39,0-64.53-22.4-80-39.85V208a8,8,0,0,1-16,0V160a8,8,0,0,1,8-8H88a8,8,0,0,1,0,16H55.44C67.76,183.35,93,208,128,208c36,0,58.14-21.46,58.36-21.68A8,8,0,0,1,197.67,186.37ZM216,40a8,8,0,0,0-8,8V71.85C192.53,54.4,165.39,32,128,32,85.18,32,59.42,57.27,58.34,58.34a8,8,0,0,0,11.3,11.34C69.86,69.46,92,48,128,48c35,0,60.24,24.65,72.56,40H168a8,8,0,0,0,0,16h48a8,8,0,0,0,8-8V48A8,8,0,0,0,216,40Z"></path></svg> AI 补全`;
  }
}

/* ================= 词书导入逻辑 ================= */
function handleDictFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = ''; // 重置以支持重复上传


  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    try {
      if (file.name.endsWith('.json')) {
        const raw = JSON.parse(content);
        dictBatchWords = Array.isArray(raw) ? raw : (raw.data || []);
      } else {
        // CSV 解析逻辑
        const lines = content.split('\n').filter(l => l.trim());
        dictBatchWords = lines.slice(1).map(line => {
          const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          return {
            japanese: (cols[0] || '').replace(/^"|"$/g, '').trim(),
            reading: (cols[1] || '').replace(/^"|"$/g, '').trim(),
            meaning: (cols[2] || '').replace(/^"|"$/g, '').trim(),
            partOfSpeech: (cols[3] || '').replace(/^"|"$/g, '').trim() || '名词',
            tags: cols[4] ? cols[4].replace(/^"|"$/g, '').split(';').map(t => t.trim()) : []
          };
        });
      }

      // 自动注入当前语种并校验
      dictBatchWords = dictBatchWords.map(w => ({
        ...w,
        japanese: w.japanese || w.word,
        language: state.currentLang
      })).filter(w => w.japanese);

      if (!dictBatchWords.length) throw new Error('未识别到有效单词');

      // 【修复 Bug 6】检查文件语言是否与当前工作区匹配
      let engCount = 0;
      dictBatchWords.forEach(w => {
        if (/^[a-zA-Z\s\-']+$/.test(w.japanese)) engCount++;
      });
      
      if (state.currentLang === 'ja' && engCount > dictBatchWords.length * 0.8) {
        if (!confirm('⚠️ 语言异常警告\n\n检测到您导入的似乎是【英语】词书，但当前处于【日语】工作区。\n\n这可能导致发音和学习算法异常，确定要强行导入吗？')) {
          return; // 用户取消导入
        }
      } else if (state.currentLang === 'en' && engCount < dictBatchWords.length * 0.2) {
        if (!confirm('⚠️ 语言异常警告\n\n检测到您导入的似乎是非英语词书，但当前处于【英语】工作区。\n\n确定要强行导入吗？')) {
          return;
        }
      }

      // 切换视图
      document.getElementById('dictStep1').classList.add('hidden');
      document.getElementById('dictStep2').classList.remove('hidden');
      document.getElementById('dictBatchCount').textContent = dictBatchWords.length;
      
      const list = document.getElementById('dictBatchPreviewList');
      const isEn = state.currentLang === 'en';
      list.innerHTML = dictBatchWords.map((w, i) => `
        <div class="flex justify-between items-center p-3.5 bg-parchment rounded-xl mb-2 border border-borderline/40">
          <div class="flex-1 min-w-0 pr-4">
            <span class="font-bold text-charcoal truncate block ${isEn ? 'font-sans' : 'font-jp'}">${w.japanese}</span>
            <span class="text-[10px] text-muted block mt-0.5 truncate">${w.reading || ''} · ${w.meaning}</span>
          </div>
          <button onclick="removeDictBatchWord(${i})" class="text-muted/40 hover:text-terracotta transition-colors flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg>
          </button>
        </div>
      `).join('');

      showToast(`已解析 ${dictBatchWords.length} 个单词`, 'success');
    } catch (err) {
      showToast('文件解析失败，请检查格式', 'error');
    }
  };
  reader.readAsText(file);
}

// 词书批量导入（加入容错与 UI 解锁）
async function handleDictBatchImport() {
  const btn = document.getElementById('dictBatchConfirmBtn');
  const pb = document.getElementById('dictImportProgressBar');
  const fill = document.getElementById('dictImportProgressFill');
  const count = document.getElementById('dictImportProgressCount');

  btn.disabled = true;
  pb.classList.remove('hidden');
  
  const total = dictBatchWords.length;
  const chunkSize = 50;
  let processed = 0;
  let hasError = false;

  try {
    const useAiFix = document.getElementById('aiDictPosToggle')?.checked;
    if (useAiFix) {
      document.getElementById('dictImportProgressText').textContent = 'AI正在校验词性并导入...';
    } else {
      document.getElementById('dictImportProgressText').textContent = '正在处理词书...';
    }

    for (let i = 0; i < total; i += chunkSize) {
      let chunk = dictBatchWords.slice(i, i + chunkSize);
      
      // AI 词性修复逻辑
      if (useAiFix) {
        try {
          const aiRes = await api('/ai/generate-pos', {
            method: 'POST',
            body: JSON.stringify({ words: chunk, language: state.currentLang })
          });
          if (Array.isArray(aiRes) && aiRes.length === chunk.length) {
            chunk = chunk.map((w, index) => ({
              ...w,
              partOfSpeech: aiRes[index] || w.partOfSpeech || '名词'
            }));
          }
        } catch (aiErr) {
          console.warn('AI 词性修复由于网络或并发限制失败，降级使用原始解析', aiErr);
        }
      }

      await api('/words/import', { method: 'POST', body: JSON.stringify({ words: chunk }) });
      processed += chunk.length;
      count.textContent = `${processed}/${total}`;
      fill.style.width = `${(processed / total) * 100}%`;
    }
    showToast('词书导入成功', 'success');
    closeModal('dictImportModal');
    loadWords(1); loadStats();
  } catch (e) {
    hasError = true;
    showToast('导入中断: ' + (e.message || '发现无法解析的脏数据'), 'error');
  } finally {
    btn.disabled = false;
    // 【修改核心】：不论成功失败，最后都要把进度条藏起来，防止卡死视觉
    if (hasError) {
      setTimeout(() => { pb.classList.add('hidden'); }, 1500);
    } else {
      pb.classList.add('hidden');
    }
  }
}

// 独立的 APKG 云端转换逻辑（加入渐进式进度条）
async function handleApkgConvert(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  if (!file.name.endsWith('.apkg')) {
    showToast('请上传标准 .apkg 格式的文件', 'error');
    return;
  }

  const dropZone = document.getElementById('apkgDropZone');
  const pb = document.getElementById('apkgProgressBar');
  const fill = document.getElementById('apkgProgressFill');
  const pctText = document.getElementById('apkgProgressPct');

  // 隐藏拖拽区，显示进度条
  dropZone.classList.add('hidden');
  pb.classList.remove('hidden');
  fill.style.width = '0%';
  pctText.textContent = '0%';

  // 模拟平滑进度 (渐进式靠近 95%)
  let progress = 0;
  const interval = setInterval(() => {
    progress += (95 - progress) * 0.08; 
    fill.style.width = `${progress}%`;
    pctText.textContent = `${Math.floor(progress)}%`;
  }, 500);

  const formData = new FormData();
  formData.append('dictFile', file);

  try {
    const response = await fetch(`${CONFIG.API_BASE}/words/upload-apkg`, {
      method: 'POST',
      headers: { 'x-auth-token': localStorage.getItem('token') },
      body: formData
    });

    clearInterval(interval);

    if (response.ok) {
      fill.style.width = '100%';
      pctText.textContent = '100%';

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace('.apkg', '_converted.json');
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      showToast('转换成功！文件已开始下载，完成后拖入上方主区域即可导入', 'success');
    } else {
      const result = await response.json();
      throw new Error(result.message);
    }
  } catch (err) {
    clearInterval(interval);
    showToast(err.message || '转换失败，请检查文件有效性', 'error');
  } finally {
    // 延迟 2 秒后恢复初始界面
    setTimeout(() => {
      pb.classList.add('hidden');
      dropZone.classList.remove('hidden');
      fill.style.width = '0%';
    }, 2000);
  }
}

function resetDictImport() {
  dictBatchWords = [];
  document.getElementById('dictStep1').classList.remove('hidden');
  document.getElementById('dictStep2').classList.add('hidden');
}

function removeDictBatchWord(index) {
  dictBatchWords.splice(index, 1);
  document.getElementById('dictBatchCount').textContent = dictBatchWords.length;
  if (!dictBatchWords.length) resetDictImport();
  else {
    // 重新渲染列表
    const list = document.getElementById('dictBatchPreviewList');
    const isEn = state.currentLang === 'en';
    list.innerHTML = dictBatchWords.map((w, i) => `
      <div class="flex justify-between items-center p-3.5 bg-parchment rounded-xl mb-2 border border-borderline/40">
        <div class="flex-1 min-w-0 pr-4">
          <span class="font-bold text-charcoal truncate block ${isEn ? 'font-sans' : 'font-jp'}">${w.japanese}</span>
          <span class="text-[10px] text-muted block mt-0.5 truncate">${w.reading || ''} · ${w.meaning}</span>
        </div>
        <button onclick="removeDictBatchWord(${i})" class="text-muted/40 hover:text-terracotta transition-colors flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg>
        </button>
      </div>
    `).join('');
  }
}

/* ================= BATCH IMPORT ================= */
let dictBatchWords = [];
let batchGeneratedWords = [];

// 新增：响应用户在预览列表中的修改（使用 oninput 实时同步）
function updateBatchWord(index, field, value) {
  if (batchGeneratedWords[index]) {
    batchGeneratedWords[index][field] = value;
  }
}

// 新增：统一渲染可编辑的批量预览列表
function renderBatchPreviewList() {
  const list = document.getElementById('batchPreviewList');
  const fontClass = state.currentLang === 'en' ? 'font-sans tracking-tight' : 'font-jp';
  
  // 简单的转义防止引号破坏 HTML
  const esc = (str) => (str || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  list.innerHTML = batchGeneratedWords.map((w, i) => `
    <div class="flex items-start sm:items-center gap-3 p-3 bg-parchment rounded-xl mb-2 border border-borderline/40 transition-colors focus-within:border-ochre/40">
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label class="block text-[10px] text-muted mb-0.5 ml-1 tracking-widest uppercase">单词</label>
          <input type="text" value="${esc(w.japanese)}" oninput="updateBatchWord(${i}, 'japanese', this.value)" class="aesthetic-input w-full px-2 py-1.5 text-[0.85rem] ${fontClass} bg-surface" placeholder="单词">
        </div>
        <div>
          <label class="block text-[10px] text-muted mb-0.5 ml-1 tracking-widest uppercase">读音</label>
          <input type="text" value="${esc(w.reading)}" oninput="updateBatchWord(${i}, 'reading', this.value)" class="aesthetic-input w-full px-2 py-1.5 text-[0.85rem] ${fontClass} bg-surface" placeholder="读音">
        </div>
        <div>
          <label class="block text-[10px] text-muted mb-0.5 ml-1 tracking-widest uppercase">含义</label>
          <input type="text" value="${esc(w.meaning)}" oninput="updateBatchWord(${i}, 'meaning', this.value)" class="aesthetic-input w-full px-2 py-1.5 text-[0.85rem] bg-surface" placeholder="含义">
        </div>
      </div>
      <button onclick="removeBatchWord(${i})" class="w-8 h-8 mt-5 sm:mt-0 flex items-center justify-center rounded-full hover:bg-surface text-muted/50 hover:text-terracotta transition-all flex-shrink-0" title="移除此项">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg>
      </button>
    </div>
  `).join('');
}

async function handleBatchGenerate() {
  const text = document.getElementById('importWordsText').value.trim();
  const language = state.currentLang; 
  if (!text) return showToast('请输入单词内容', 'error');

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return showToast('请输入有效的单词', 'error');

  // ================= 新增：语言识别预警 (优化版) =================
  let engCount = 0;
  let longChineseNoteCount = 0;
  const kanaRegex = /[\u3040-\u309F\u30A0-\u30FF]/; // 匹配假名

  lines.forEach(line => {
    // 统计纯英文字母构成的行
    if (/^[a-zA-Z\s\-\.,'!]+$/.test(line)) engCount++;
    // 如果没有假名，全是汉字，且长度超过 8 个字，大概率是用户粘贴的中文笔记/废话
    else if (!kanaRegex.test(line) && line.length > 8 && /[\u4e00-\u9fa5]/.test(line)) longChineseNoteCount++;
  });

  if (state.currentLang === 'ja') {
    if (engCount > lines.length * 0.5) {
      if (!confirm('⚠️ 语言异常警告\n\n检测到您输入的文本大部分是【英语】，但当前处于【日语】工作区。\nAI 会自动过滤非目标语言。确定要继续吗？')) return;
    } else if (longChineseNoteCount > 0 && lines.length <= 5) {
      // 只有当行数较少，且检测到超长无假名的中文字符串时，稍微提醒一下
      if (!confirm('⚠️ 内容预警\n\n检测到可能包含中文句子或笔记（如解释说明）。\nAI 将会自动丢弃非日语词汇，纯汉字的日语词会被保留。确定要继续吗？')) return;
    }
  } else if (state.currentLang === 'en') {
    if (engCount < lines.length * 0.2) {
      if (!confirm('⚠️ 语言异常警告\n\n检测到您输入的文本大部分似乎不是【英语】。\n当前处于英语工作区，AI 将会自动丢弃非英语内容。确定要继续吗？')) return;
    }
  }
  // ================= 新增结束 =================

  // ========== 前端轻量级“垃圾阻击”（优化速度与 API 成本） ==========
  const validLines = [];
  const kanaRegexForFilter = /[\u3040-\u309F\u30A0-\u30FF]/;
  
  lines.forEach(line => {
    if (state.currentLang === 'ja') {
      // 1. 如果是纯英文/数字/符号，直接剔除（不发给后端）
      if (/^[a-zA-Z0-9\s\-\.,'!]+$/.test(line)) return; 
      // 2. 如果超过 10 个字，且完全没有假名，大概率是长篇中文笔记，直接剔除
      if (line.length > 10 && !kanaRegexForFilter.test(line)) return; 
    }
    // 留下来的加入有效数组
    validLines.push(line);
  });

  if (validLines.length === 0) {
    return showToast('未检测到有效的单词内容，已被自动过滤', 'error');
  } else if (validLines.length < lines.length) {
    showToast(`已在前端自动拦截 ${lines.length - validLines.length} 行非目标语言内容`, 'info');
  }

  // Bug 2: 创建 AbortController 以支持中断
  if (state.batchAbortController) state.batchAbortController.abort();
  state.batchAbortController = new AbortController();
  const signal = state.batchAbortController.signal;

  const btn = document.getElementById('batchGenerateBtn');
  btn.disabled = true;
  btn.innerHTML = 'AI 解析中...';

  const pb = document.getElementById('aiProgressBar');
  const pCount = document.getElementById('aiProgressCount');
  const pFill = document.getElementById('aiProgressFill');
  pb.classList.remove('hidden');

  batchGeneratedWords = [];
  const total = validLines.length;
  const chunkSize = 10; 
  let processed = 0;

  pCount.textContent = `0/${total}`;
  pFill.style.width = `0%`;

  try {
    for (let i = 0; i < total; i += chunkSize) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const chunkLines = validLines.slice(i, i + chunkSize);
      const chunkText = chunkLines.join('\n');

      const res = await fetch(`${CONFIG.API_BASE}/ai/generate-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('token') && { 'x-auth-token': localStorage.getItem('token') }) },
        body: JSON.stringify({ text: chunkText, language: state.currentLang }),
        signal // Bug 2: 传入 signal 以支持 fetch 级别中断
      });

      if (!res.ok) throw new Error('AI 解析中断');
      const chunkResult = await res.json();
      batchGeneratedWords.push(...chunkResult);

      processed += chunkLines.length;
      pCount.textContent = `${processed}/${total}`;
      pFill.style.width = `${(processed / total) * 100}%`;
    }

    document.getElementById('importStep1').classList.add('hidden');
    document.getElementById('importStep2').classList.remove('hidden');
    document.getElementById('batchCount').textContent = batchGeneratedWords.length;

    // 渲染可编辑的列表
    renderBatchPreviewList();

    showToast('全部生成成功', 'success');
  } catch (e) {
    if (e.name === 'AbortError') {
      console.log('AI 批量生成已被用户中断');
    } else {
      showToast('生成过程中发生网络错误', 'error');
    }
  } finally {
    state.batchAbortController = null;
    btn.disabled = false;
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M197.67,186.37a8,8,0,0,1,0,11.29C196.58,198.73,170.82,224,128,224c-37.39,0-64.53-22.4-80-39.85V208a8,8,0,0,1-16,0V160a8,8,0,0,1,8-8H88a8,8,0,0,1,0,16H55.44C67.76,183.35,93,208,128,208c36,0,58.14-21.46,58.36-21.68A8,8,0,0,1,197.67,186.37ZM216,40a8,8,0,0,0-8,8V71.85C192.53,54.4,165.39,32,128,32,85.18,32,59.42,57.27,58.34,58.34a8,8,0,0,0,11.3,11.34C69.86,69.46,92,48,128,48c35,0,60.24,24.65,72.56,40H168a8,8,0,0,0,0,16h48a8,8,0,0,0,8-8V48A8,8,0,0,0,216,40Z"></path></svg> AI 补全`;
    pb.classList.add('hidden'); 
  }
}

function removeBatchWord(index) {
  batchGeneratedWords.splice(index, 1);
  document.getElementById('batchCount').textContent = batchGeneratedWords.length;
  // 重新渲染可编辑列表
  renderBatchPreviewList();
}

async function handleBatchImport() {
  if (!batchGeneratedWords.length) return showToast('没有单词可导入', 'error');
  const btn = document.getElementById('batchImportBtn');
  const progressBar = document.getElementById('importProgressBar');
  const progressFill = document.getElementById('importProgressFill');
  const progressCount = document.getElementById('importProgressCount');
  const previewList = document.getElementById('batchPreviewList');

  btn.disabled = true; btn.innerHTML = '导入中...';
  previewList.classList.add('opacity-50');
  progressBar.classList.remove('hidden');
  progressBar.style.display = 'block';
  
  const total = batchGeneratedWords.length;
  // 数据库保存速度极快，每次发 50 个
  const chunkSize = 50; 
  let processed = 0;
  let successCount = 0;

  progressCount.textContent = `0/${total}`;
  progressFill.style.width = '0%';

  try {
    for (let i = 0; i < total; i += chunkSize) {
      const chunk = batchGeneratedWords.slice(i, i + chunkSize);
      
      const result = await api('/words/import', {
        method: 'POST',
        body: JSON.stringify({ words: chunk })
      });
      
      successCount += (result.count || 0);
      processed += chunk.length;
      
      // 真实进度更新
      progressCount.textContent = `${processed}/${total}`;
      progressFill.style.width = `${(processed / total) * 100}%`;
    }

    // 稍微等待 300 毫秒让用户看清 100% 满状态的动画
    await new Promise(r => setTimeout(r, 300));
    const userSettings = await api('/auth/settings');
    const limit = state.currentLang === 'en'
      ? (userSettings.dailyNewLimitEn || 20)
      : (userSettings.dailyNewLimitJa || 20);
    if (successCount > limit) {
        showToast(`导入 ${successCount} 词。超出今日上限的部分已自动加入明日计划`, 'info');
    } else {
        showToast(`成功导入 ${successCount} 个新单词`, 'success');
    }
    resetImport();
    closeModal('importModal');
    loadWords(1); loadStats();
  } catch (e) {
    showToast('导入中断，请重试', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '确认导入';
    previewList.classList.remove('opacity-50');
    progressBar.classList.add('hidden');
  }
}

function resetImport() {
  // Bug 2: 中断正在进行的 AI 解析请求
  if (state.batchAbortController) {
    state.batchAbortController.abort();
    state.batchAbortController = null;
  }

  batchGeneratedWords = [];
  document.getElementById('importStep1').classList.remove('hidden');
  document.getElementById('importStep2').classList.add('hidden');
  document.getElementById('importWordsText').value = '';
  
  const pb = document.getElementById('importProgressBar');
  if (pb) { pb.classList.add('hidden'); pb.style.display = ''; }
  document.getElementById('importProgressFill').style.width = '0%';
  
  // 重置 AI 进度条
  const aiPb = document.getElementById('aiProgressBar');
  if (aiPb) { aiPb.classList.add('hidden'); }
  const aiFill = document.getElementById('aiProgressFill');
  if (aiFill) { aiFill.style.width = '0%'; }

  const genBtn = document.getElementById('batchGenerateBtn');
  if (genBtn) { genBtn.disabled = false; genBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M197.67,186.37a8,8,0,0,1,0,11.29C196.58,198.73,170.82,224,128,224c-37.39,0-64.53-22.4-80-39.85V208a8,8,0,0,1-16,0V160a8,8,0,0,1,8-8H88a8,8,0,0,1,0,16H55.44C67.76,183.35,93,208,128,208c36,0,58.14-21.46,58.36-21.68A8,8,0,0,1,197.67,186.37ZM216,40a8,8,0,0,0-8,8V71.85C192.53,54.4,165.39,32,128,32,85.18,32,59.42,57.27,58.34,58.34a8,8,0,0,0,11.3,11.34C69.86,69.46,92,48,128,48c35,0,60.24,24.65,72.56,40H168a8,8,0,0,0,0,16h48a8,8,0,0,0,8-8V48A8,8,0,0,0,216,40Z"></path></svg> AI 补全`; }
}

async function exportWords() {
  try {
    const data = await api(`/words/export?language=${state.currentLang}`);
    const blob = new Blob([JSON.stringify(data.data || data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'my-vocab-words.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('导出成功', 'success');
  } catch (e) { showToast('导出失败', 'error'); }
}

/* ================= BATCH SELECTION ================= */
function toggleWordSelect(id) {
  if (state.selectedWordIds.has(id)) {
    state.selectedWordIds.delete(id);
  } else {
    state.selectedWordIds.add(id);
  }
  // 直接更新对应行，不重新渲染整个表格
  const _cb = document.querySelector(`input[value="${id}"]`);
  const row = _cb ? _cb.closest('tr') : null;
  if (row) {
    const cb = row.querySelector('input[type="checkbox"]');
    cb.checked = state.selectedWordIds.has(id);
    row.classList.toggle('bg-ochre/5', state.selectedWordIds.has(id));
  }
  updateBatchBar();
}

function toggleSelectAll() {
  const checkbox = document.getElementById('selectAllCheckbox');
  if (checkbox.checked) {
    state.currentPageWords.forEach(w => {
      state.selectedWordIds.add(w._id);
      const _cb = document.querySelector(`input[value="${w._id}"]`);
      const row = _cb ? _cb.closest('tr') : null;
      if (row) {
        row.querySelector('input[type="checkbox"]').checked = true;
        row.classList.add('bg-ochre/5');
      }
    });
  } else {
    state.currentPageWords.forEach(w => {
      state.selectedWordIds.delete(w._id);
      const _cb = document.querySelector(`input[value="${w._id}"]`);
      const row = _cb ? _cb.closest('tr') : null;
      if (row) {
        row.querySelector('input[type="checkbox"]').checked = false;
        row.classList.remove('bg-ochre/5');
      }
    });
  }
  updateBatchBar();
}

function clearWordSelection() {
  state.selectedWordIds.forEach(id => {
    const _cb = document.querySelector(`input[value="${id}"]`);
    const row = _cb ? _cb.closest('tr') : null;
    if (row) {
      row.querySelector('input[type="checkbox"]').checked = false;
      row.classList.remove('bg-ochre/5');
    }
  });
  state.selectedWordIds.clear();
  const selectAll = document.getElementById('selectAllCheckbox');
  selectAll.checked = false;
  selectAll.indeterminate = false;
  updateBatchBar();
}

function updateBatchBar() {
  const bar = document.getElementById('batchActionBar');
  const count = state.selectedWordIds.size;
  document.getElementById('selectedCount').textContent = count;
  const selectAll = document.getElementById('selectAllCheckbox');
  selectAll.checked = state.currentPageWords.length > 0 && state.currentPageWords.every(w => state.selectedWordIds.has(w._id));
  selectAll.indeterminate = count > 0 && !selectAll.checked;
  if (count === 0) {
    bar.classList.add('hidden');
  } else {
    bar.classList.remove('hidden');
  }
}

async function batchDeleteSelected() {
  if (state.selectedWordIds.size === 0) return;
  if (!confirm(`确定删除选中的 ${state.selectedWordIds.size} 个单词吗？此操作不可恢复。`)) return;

  const batchBar = document.getElementById('batchActionBar');
  const ids = Array.from(state.selectedWordIds);
  
  batchBar.classList.add('hidden'); // 隐藏操作栏

  try {
    // 发送单次批量删除请求
    await api(`/words/batch-delete`, { 
      method: 'POST', 
      body: JSON.stringify({ ids }) 
    });
    
    state.selectedWordIds.clear();
    localStorage.removeItem(`active_session_${state.currentLang}`); // 清除背诵缓存
    showToast('批量删除成功', 'success');
    loadWords(state.pagination.page);
    loadStats();
  } catch (e) {
    showToast('批量删除失败', 'error');
  }
}

async function clearWorkspace() {
  const langName = state.currentLang === 'en' ? '英语' : '日语';
  const targetText = state.currentLang === 'en' ? 'CLEAR EN' : 'CLEAR JA';
  
  const userInput = prompt(`⚠️ 危险操作警告 ⚠️\n\n您即将清空当前【${langName}】工作区下的所有单词（包括已掌握的进度）！\n此操作不可恢复。\n\n请输入 "${targetText}" 以确认清空：`);
  
  if (userInput !== targetText) {
    if (userInput !== null) showToast('输入不匹配，已取消清空操作', 'info');
    return;
  }

  try {
    const res = await api('/words/clear-all', { 
      method: 'POST',
      body: JSON.stringify({ language: state.currentLang })
    });
    localStorage.removeItem(`active_session_${state.currentLang}`); // 清除背诵缓存
    showToast(`已清空 ${langName} 工作区，删除了 ${res.count} 个单词`, 'success');
    state.currentPage = 1;
    loadWords(1);
    loadStats();
  } catch (e) {
    showToast('清空失败，请重试', 'error');
  }
}

async function batchExportSelected() {
  if (state.selectedWordIds.size === 0) return showToast('请先选择要导出的单词', 'error');

  try {
    // 提示用户正在处理
    const btn = document.querySelector('button[onclick="batchExportSelected()"]');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '导出中...';
    btn.disabled = true;

    // 拉取用户所有单词（使用 export 接口突破分页限制）
    const data = await api(`/words/export?language=${state.currentLang}`);
    const allWords = data.data || [];

    // 根据选中的 ID 跨页过滤出需要导出的词
    const wordsToExport = allWords.filter(w => state.selectedWordIds.has(w._id));

    if (wordsToExport.length === 0) {
      btn.innerHTML = oldHtml;
      btn.disabled = false;
      return showToast('未找到对应的数据', 'error');
    }

    // 生成文件下载
    const blob = new Blob([JSON.stringify(wordsToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = `my-vocab-selected-${Date.now()}.json`; 
    a.click();
    URL.revokeObjectURL(url);
    
    showToast(`成功导出 ${wordsToExport.length} 个单词`, 'success');

    // 恢复按钮状态
    btn.innerHTML = oldHtml;
    btn.disabled = false;
  } catch (e) { 
    showToast('导出失败，请重试', 'error'); 
    // 恢复按钮状态
    const btn = document.querySelector('button[onclick="batchExportSelected()"]');
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M224,152v56a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V152a8,8,0,0,1,16,0v56H208V152a8,8,0,0,1,16,0ZM93.66,133.66a8,8,0,0,1,11.32-11.32L120,137.38V40a8,8,0,0,1,16,0v97.38l15-15a8,8,0,0,1,11.32,11.32l-28.69,28.68a8,8,0,0,1-11.32,0Z"></path></svg> 导出`;
    btn.disabled = false;
  }
}

/* ================= CALENDAR TOOLTIP (单例管理器) ================= */
let calTooltipTimer = null;

window.showGlobalCalTooltip = function(el, dateStr, count) {
  let tooltip = document.getElementById('globalCalTooltip');
  
  // 懒加载创建全局唯一的提示框 DOM
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'globalCalTooltip';
    // 使用 fixed 彻底脱离正常的文档流束缚，z-index 设为极高
    tooltip.className = 'fixed z-[9999] pointer-events-none px-3 py-2 bg-charcoal text-surface text-[10px] rounded-[4px] shadow-lg font-ui text-center leading-tight transition-opacity duration-150 opacity-0 hidden';
    document.body.appendChild(tooltip);
  }

  // 注入数据
  tooltip.innerHTML = `
    <div class="font-bold tracking-widest text-[0.65rem] text-muted/80 mb-1 border-b border-surface/20 pb-1">${dateStr}</div>
    复习了 <span class="font-bold text-ochre text-[12px] mx-0.5">${count}</span> 项
    <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-charcoal"></div>
  `;

  // 获取当前 Hover 方块在屏幕上的精确绝对坐标
  const rect = el.getBoundingClientRect();
  
  // 显示一下以获取真实宽高（计算位置需要）
  tooltip.classList.remove('hidden');
  
  const top = rect.top - tooltip.offsetHeight - 8; // 向上偏移 8px
  const left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2); // 水平居中对齐方块

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;

  // 清除可能存在的淡出定时器
  if (calTooltipTimer) clearTimeout(calTooltipTimer);

  // 强制浏览器重排，触发淡入动画
  void tooltip.offsetWidth; 
  tooltip.classList.remove('opacity-0');
  tooltip.classList.add('opacity-100');
};

window.hideGlobalCalTooltip = function() {
  const tooltip = document.getElementById('globalCalTooltip');
  if (!tooltip) return;

  tooltip.classList.remove('opacity-100');
  tooltip.classList.add('opacity-0');

  // 等待动画结束后彻底隐藏，防止遮挡鼠标交互
  calTooltipTimer = setTimeout(() => {
    if (tooltip.classList.contains('opacity-0')) {
        tooltip.classList.add('hidden');
    }
  }, 150);
};

// （可选）移动端兼容：当用户滑动页面时，主动清除提示框防止其残留在屏幕上
window.addEventListener('scroll', window.hideGlobalCalTooltip, { passive: true });

