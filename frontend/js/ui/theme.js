/* ================= AESTHETIC THEME ENGINE ================= */
// 主题循环队列： default -> obsidian -> editorial -> default...
const THEMES = ['light', 'obsidian', 'editorial'];

function toggleAestheticTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const currentIndex = THEMES.indexOf(currentTheme);
  const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];

  if (document.startViewTransition) {
    document.startViewTransition(() => applyTheme(nextTheme));
  } else {
    applyTheme(nextTheme);
  }
}

function applyTheme(theme) {
  const toggleText = document.getElementById('themeToggleText');
  const themeIcon = document.getElementById('themeIcon');
  const noiseOverlay = document.getElementById('noiseOverlay');
  
  // 1. 默认亮色 (Light)
  if (theme === 'light') {
    document.documentElement.removeAttribute('data-theme');
    if(toggleText) toggleText.textContent = '切换: 深色模式';
    if(themeIcon) {
      themeIcon.style.transform = 'rotate(0deg)';
      themeIcon.innerHTML = `<path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23Z"></path>`; // 月亮
    }
    if(noiseOverlay) noiseOverlay.style.opacity = '0';
    localStorage.setItem('aesthetic-theme', 'light');
  } 
  // 2. 深色模式 (Obsidian)
  else if (theme === 'obsidian') {
    document.documentElement.setAttribute('data-theme', 'obsidian');
    if(toggleText) toggleText.textContent = '切换: 学术辞典';
    if(themeIcon) {
      themeIcon.style.transform = 'rotate(-180deg)';
      // 太阳图标
      themeIcon.innerHTML = `<path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm192-8h-24a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Zm-112,72a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V200A8,8,0,0,0,128,192Z"></path>`;
    }
    if(noiseOverlay) noiseOverlay.style.opacity = '0';
    localStorage.setItem('aesthetic-theme', 'obsidian');
  }
  // 3. 复古辞典与暗室 (Editorial)
  else if (theme === 'editorial') {
    document.documentElement.setAttribute('data-theme', 'editorial');
    if(toggleText) toggleText.textContent = '切换: 默认亮色';
    if(themeIcon) {
      themeIcon.style.transform = 'rotate(90deg)';
      themeIcon.innerHTML = `<path d="M192,48V208a16,16,0,0,1-16,16H80a16,16,0,0,1-16-16V48A16,16,0,0,1,80,32h96A16,16,0,0,1,192,48ZM80,48V208h96V48Z"></path>`; // 书本 Icon
    }
    // 开启物理微糙感
    if(noiseOverlay) noiseOverlay.style.opacity = '0.1';
    localStorage.setItem('aesthetic-theme', 'editorial');
  }

  // P1 #12: 如果正在学习模式，切换主题后重新渲染卡片结构
  const viewStudy = document.getElementById('view-study');
  if (viewStudy && viewStudy.classList.contains('active') && typeof renderCardStack === 'function') {
    renderCardStack();
  }

  // ECharts Theme Switch
  if (typeof renderStatsChart === 'function' && window.currentStatsData) {
    setTimeout(() => renderStatsChart(window.currentStatsData), 50);
  }
  if (typeof renderCalendarChart === 'function' && window.currentCalendarData) {
    setTimeout(() => renderCalendarChart(), 50);
  }
}

// 页面加载时恢复状态
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('aesthetic-theme') || 'light';
  applyTheme(savedTheme);
  initCustomSelects(); 
});
