let customSelectDocumentListenerAdded = false;

function initCustomSelects() {
  const selects = document.querySelectorAll('[data-custom-select]');
  if (!selects.length) return;

  selects.forEach(select => {
    if (select.dataset.initialized === 'true') return;
    select.dataset.initialized = 'true';

    const trigger = select.querySelector('.select-trigger');
    const options = select.querySelector('.select-options');

    if (!trigger || !options) return;

    trigger.addEventListener('click', event => {
      event.stopPropagation();

      document.querySelectorAll('.select-options.is-open').forEach(openOptions => {
        if (openOptions !== options) {
          openOptions.classList.remove('is-open');
        }
      });

      options.classList.toggle('is-open');
    });

    options.querySelectorAll('[data-value]').forEach(option => {
      option.addEventListener('click', event => {
        event.stopPropagation();

        const value = option.dataset.value;
        const label = option.textContent.trim();

        select.dataset.value = value;

        // 同步 hidden input (如果存在)
        const hiddenInput = select.querySelector('input[type="hidden"], input:not([type])');
        if (hiddenInput) {
          hiddenInput.value = value;
          hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const textEl = trigger.querySelector('.select-text') || trigger;
        textEl.textContent = label;

        options.classList.remove('is-open');

        select.dispatchEvent(
          new CustomEvent('custom-select-change', {
            detail: { value, label }
          })
        );

        // 针对词性筛选器的特殊驱动
        if (select.id === 'partOfSpeechFilter' && typeof loadWords === 'function') {
          loadWords(1);
        }
      });
    });
  });

  if (!customSelectDocumentListenerAdded) {
    customSelectDocumentListenerAdded = true;

    document.addEventListener('click', event => {
      // 如果点击的是自定义下拉框内部，不触发关闭（内部逻辑已处理）
      if (event.target.closest('[data-custom-select]')) return;

      document.querySelectorAll('.select-options.is-open').forEach(options => {
        options.classList.remove('is-open');
      });
    });
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('aesthetic-theme') || 'light';
  applyTheme(savedTheme);
}

function updateThemeToggleText() {
  const text = document.getElementById('themeToggleText');
  if (!text) return;

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';

  if (currentTheme === 'obsidian') {
    text.textContent = '学术纸面 (Editorial)';
  } else if (currentTheme === 'editorial') {
    text.textContent = '默认暖纸 (Parchment)';
  } else {
    text.textContent = '沉浸暗调 (Zen Night)';
  }
}

function applyTheme(theme) {
  const toggleText = document.getElementById('themeToggleText');
  const themeIcon = document.getElementById('themeIcon');
  const noiseOverlay = document.getElementById('noiseOverlay');
  
  // 1. 默认亮色 (Light)
  if (theme === 'light' || !theme) {
    document.documentElement.removeAttribute('data-theme');
    if(toggleText) toggleText.textContent = '沉浸暗调 (Zen Night)';
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
    if(toggleText) toggleText.textContent = '学术纸面 (Editorial)';
    if(themeIcon) {
      themeIcon.style.transform = 'rotate(-180deg)';
      themeIcon.innerHTML = `<path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm192-8h-24a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Zm-112,72a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V200A8,8,0,0,0,128,192Z"></path>`;
    }
    if(noiseOverlay) noiseOverlay.style.opacity = '0';
    localStorage.setItem('aesthetic-theme', 'obsidian');
  }
  // 3. 复古辞典与暗室 (Editorial)
  else if (theme === 'editorial') {
    document.documentElement.setAttribute('data-theme', 'editorial');
    if(toggleText) toggleText.textContent = '默认暖纸 (Parchment)';
    if(themeIcon) {
      themeIcon.style.transform = 'rotate(90deg)';
      themeIcon.innerHTML = `<path d="M192,48V208a16,16,0,0,1-16,16H80a16,16,0,0,1-16-16V48A16,16,0,0,1,80,32h96A16,16,0,0,1,192,48ZM80,48V208h96V48Z"></path>`; // 书本 Icon
    }
    if(noiseOverlay) noiseOverlay.style.opacity = '0.1';
    localStorage.setItem('aesthetic-theme', 'editorial');
  }

  // 重绘学习卡片
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

  updateThemeToggleText();
}

function toggleAestheticTheme() {
  const root = document.documentElement;
  const currentTheme = root.getAttribute('data-theme');

  let nextTheme = 'obsidian';

  if (currentTheme === 'obsidian') {
    nextTheme = 'editorial';
  } else if (currentTheme === 'editorial') {
    nextTheme = '';
  }

  if (nextTheme) {
    root.setAttribute('data-theme', nextTheme);
    localStorage.setItem('aesthetic-theme', nextTheme);
  } else {
    root.removeAttribute('data-theme');
    localStorage.removeItem('aesthetic-theme');
  }

  applyTheme(nextTheme || 'light');
}

window.toggleAestheticTheme = toggleAestheticTheme;

document.addEventListener('DOMContentLoaded', () => {
  try {
    initTheme();
    initCustomSelects();
  } catch (err) {
    console.error('Theme init failed:', err);
  }
});
