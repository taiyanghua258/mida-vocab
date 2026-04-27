const CONFIG = { USE_MOCK_API: false, API_BASE: '/api' };

/* ================= XSS 防御 ================= */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ================= TOAST ================= */
function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  // 加入 pointer-events-auto 保证弹窗自身可以点击
  t.className = `toast toast-${type} flex items-center gap-3 px-5 py-3 rounded-xl border-l-4 bg-surface shadow-lg text-sm font-medium pointer-events-auto`;
  t.innerHTML = `<span>${escapeHtml(msg)}</span>`;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

/* ================= NAV ================= */
/* ================= USER MENU ================= */
function toggleUserMenu() {
  const menu = document.getElementById('userDropdown');
  const arrow = document.getElementById('userMenuArrow');
  
  if (menu.classList.contains('opacity-0')) {
    // 展开
    menu.classList.remove('opacity-0', 'pointer-events-none', '-translate-y-2');
    menu.classList.add('opacity-100', 'pointer-events-auto', 'translate-y-0');
    arrow.classList.add('rotate-180');
  } else {
    closeUserMenu();
  }
}

function closeUserMenu() {
  const menu = document.getElementById('userDropdown');
  const arrow = document.getElementById('userMenuArrow');
  
  if (menu && !menu.classList.contains('opacity-0')) {
    // 收起
    menu.classList.add('opacity-0', 'pointer-events-none', '-translate-y-2');
    menu.classList.remove('opacity-100', 'pointer-events-auto', 'translate-y-0');
    arrow.classList.remove('rotate-180');
  }
}

// 点击外部区域自动关闭菜单
document.addEventListener('click', (e) => {
  const container = document.getElementById('userMenuContainer');
  if (container && !container.contains(e.target)) {
    closeUserMenu();
  }
});

// 切换显示/隐藏特定分钟的冷却池单词列表 (全局单例 Tooltip，防止被 overflow-hidden 裁剪)
let _coolingTooltipListenersAdded = false;

window.toggleCoolingDropdown = function(event, min) {
  event.stopPropagation();
  let tooltip = document.getElementById('global-cooling-tooltip');
  
  // 关闭 tooltip 的通用函数
  function hideCoolingTooltip() {
    if (!tooltip) return;
    tooltip.classList.add('opacity-0', 'invisible', '-translate-y-2', 'scale-95');
    tooltip.classList.remove('opacity-100', 'visible', 'translate-y-0', 'scale-100');
  }
  
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'global-cooling-tooltip';
    // 增加 z-[9999] 确保在最上层
    tooltip.className = 'absolute z-[9999] p-2.5 bg-surface/95 backdrop-blur-md border border-borderline rounded-2xl shadow-[0_12px_40px_rgba(26,47,43,0.15)] opacity-0 invisible -translate-y-2 scale-95 transition-all duration-200 cursor-default origin-bottom';
    document.body.appendChild(tooltip);
  }

  // 只注册一次全局事件监听器，防止重复绑定
  if (!_coolingTooltipListenersAdded) {
    _coolingTooltipListenersAdded = true;

    // 全局点击取消
    document.addEventListener('click', (e) => {
      const tooltipEl = document.getElementById('global-cooling-tooltip');
      if (!tooltipEl) return;
      // 如果点击了 tooltip 自身内部 或 冷却按钮自身，不关闭（按钮自身的关闭由 toggle 逻辑处理）
      if (e.target.closest('#global-cooling-tooltip')) return;
      if (e.target.closest('.cooling-item-btn')) return;
      hideCoolingTooltip();
    });
    
    // 滚动时隐藏，防止悬浮位置错乱
    window.addEventListener('scroll', () => {
      const tooltipEl = document.getElementById('global-cooling-tooltip');
      if (tooltipEl && tooltipEl.classList.contains('opacity-100')) {
        tooltipEl.classList.add('opacity-0', 'invisible', '-translate-y-2', 'scale-95');
        tooltipEl.classList.remove('opacity-100', 'visible', 'translate-y-0', 'scale-100');
      }
    }, { passive: true });
  }

  // 如果已经打开了当前的，则关闭
  if (tooltip.dataset.min === String(min) && tooltip.classList.contains('opacity-100')) {
    hideCoolingTooltip();
    return;
  }

  // 计算该分钟对应的单词
  const now = Date.now();
  const wordsForThisMin = state.upcomingWords.filter(w => {
    const diffMs = new Date(w.due).getTime() - now;
    const diffMin = Math.ceil(diffMs / 60000);
    const key = diffMin > 0 ? diffMin : 1;
    return key === min;
  });

  const wordListHtml = wordsForThisMin.map(w => `
    <div class="py-1.5 border-b border-borderline/40 last:border-0 flex flex-col gap-0.5">
      <span class="font-display font-medium text-charcoal text-[13px] leading-tight break-words">${escapeHtml(w.japanese || w.word) || '-'}</span>
      ${w.meaning ? `<span class="font-ui text-[10px] text-muted leading-tight truncate">${escapeHtml(w.meaning)}</span>` : ''}
    </div>
  `).join('');

  tooltip.innerHTML = `
    <div class="text-[9px] font-bold text-muted/80 uppercase mb-1.5 px-1 tracking-widest border-b border-borderline/40 pb-1.5 flex justify-between items-center font-ui w-44 sm:w-48">
      <span>待复习单词</span>
      <span class="text-ochre">${wordsForThisMin.length}</span>
    </div>
    <div class="max-h-48 overflow-y-auto px-1 custom-scrollbar">
      ${wordListHtml}
    </div>
    <div class="tooltip-arrow absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-surface border-b border-r border-borderline rotate-45"></div>
  `;

  tooltip.dataset.min = min;

  // 定位计算 - 先重置所有动态类
  tooltip.classList.remove('origin-bottom', 'origin-top');
  tooltip.classList.add('origin-bottom'); // 默认从底部弹出

  // 定位计算
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  
  // 先设为可见但透明，以便获取高度（用 visibility: hidden 避免闪现）
  tooltip.style.display = 'block';
  tooltip.style.visibility = 'hidden';
  tooltip.classList.remove('invisible');
  
  const tooltipRect = tooltip.getBoundingClientRect();
  
  let top = rect.top + scrollY - tooltipRect.height - 12;
  let left = rect.left + scrollX + (rect.width / 2) - (tooltipRect.width / 2);
  
  // 防止左侧或右侧超出屏幕
  if (left < 10) left = 10;
  if (left + tooltipRect.width > window.innerWidth - 10) left = window.innerWidth - tooltipRect.width - 10;
  
  // 若上方空间不足，显示在下方
  const arrow = tooltip.querySelector('.tooltip-arrow');
  if (top < scrollY + 10) {
    top = rect.bottom + scrollY + 12;
    // 此时小箭头需要移到上方
    if (arrow) {
      arrow.classList.remove('-bottom-[5px]', 'border-b', 'border-r');
      arrow.classList.add('-top-[5px]', 'border-t', 'border-l');
    }
    tooltip.classList.remove('origin-bottom');
    tooltip.classList.add('origin-top');
  } else {
    // 空间充足，显示在上方，重置箭头到底部
    if (arrow) {
      arrow.classList.remove('-top-[5px]', 'border-t', 'border-l');
      arrow.classList.add('-bottom-[5px]', 'border-b', 'border-r');
    }
    tooltip.classList.add('origin-bottom');
    tooltip.classList.remove('origin-top');
  }
  
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  tooltip.style.visibility = ''; // 恢复 visibility
  
  // 触发动画显示
  // 延迟一帧确保 translate 位置先生效
  requestAnimationFrame(() => {
    tooltip.classList.add('visible', 'opacity-100', 'translate-y-0', 'scale-100');
    tooltip.classList.remove('opacity-0', 'invisible', '-translate-y-2', 'scale-95');
  });
};

// .apkg 转换工具教程
function showQuickGuide() {
  const guide = `
    已升级为全自动云端清洗！
    只需将 .apkg 文件拖入下方的专门虚线框区域，系统会自动将其转换为标准的 .json 文件并下载到您的设备。
    转换完成后，您只需将下载的 json 文件拖入主上传区域即可。
  `;
  alert(guide.replace(/^\s+/gm, ''));
}

// 冷却池说明 tooltip：click 切换 + 桌面 hover 显示/隐藏（修复 touch 设备 hover 卡死问题）
(function() {
  let _infoTooltipTimer = null;

  function showInfoTooltip() {
    const tip = document.getElementById('coolingPoolInfoTooltip');
    if (tip) { tip.classList.add('opacity-100'); tip.classList.remove('pointer-events-none'); }
  }
  function hideInfoTooltip() {
    const tip = document.getElementById('coolingPoolInfoTooltip');
    if (tip) { tip.classList.remove('opacity-100'); tip.classList.add('pointer-events-none'); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('coolingPoolInfoTrigger');
    if (!trigger) return;

    // 桌面 hover：延迟显示/隐藏
    trigger.addEventListener('mouseenter', () => {
      clearTimeout(_infoTooltipTimer);
      _infoTooltipTimer = setTimeout(showInfoTooltip, 150);
    });
    trigger.addEventListener('mouseleave', () => {
      clearTimeout(_infoTooltipTimer);
      _infoTooltipTimer = setTimeout(hideInfoTooltip, 200);
    });

    // 点击切换（移动端主要交互方式）
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const tip = document.getElementById('coolingPoolInfoTooltip');
      if (!tip) return;
      if (tip.classList.contains('opacity-100')) {
        hideInfoTooltip();
      } else {
        showInfoTooltip();
      }
    });

    // 全局点击关闭
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#coolingPoolInfoTrigger')) {
        hideInfoTooltip();
      }
    });
  });
})();


function navigate(viewId) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.getElementById(`view-${viewId}`).classList.add('active');
  if (viewId === 'dashboard') initDashboard();
  if (viewId === 'study') initStudy();
  if (viewId === 'auth') {
    const el = (id) => document.getElementById(id);
    if (el('username')) el('username').value = '';
    if (el('password')) el('password').value = '';
    if (el('regUsername')) el('regUsername').value = '';
    if (el('regPassword')) el('regPassword').value = '';
    if (el('regConfirmPassword')) el('regConfirmPassword').value = '';
    const loginBtn = document.querySelector('#loginForm button[type="submit"]');
    if (loginBtn) { loginBtn.disabled = false; loginBtn.innerHTML = '登录系统'; }
    const regBtn = document.querySelector('#registerForm button[type="submit"]');
    if (regBtn) { regBtn.disabled = false; regBtn.innerHTML = '注册账号'; }
  }
}

function resetCardNode(group) {
  if (!group) return;

  group.classList.remove(
    'discarded-again',
    'discarded-hard',
    'discarded-good',
    'discarded-easy'
  );

  const front = group.querySelector('.paper-card.front');
  const back = group.querySelector('.paper-card.back');

  if (front) front.classList.remove('peeled');
  if (back) back.classList.remove('revealed');
}

function resetAllCardAnimations() {
  document.querySelectorAll('.word-group').forEach(resetCardNode);

  const answerSection = document.getElementById('answerSection');
  if (answerSection) {
    answerSection.classList.remove('show');
  }
}

function hideAnswerSection() {
  const answerSection = document.getElementById('answerSection');
  if (!answerSection) return;
  answerSection.classList.remove('show');
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.remove('hidden');
  requestAnimationFrame(() => {
    modal.classList.add('active');
  });

  document.body.classList.add('modal-open');

  if (id === 'settingsModal') { loadFsrsSettings(); loadNotifySettings(); }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.remove('active');

  setTimeout(() => {
    if (!modal.classList.contains('active')) {
      modal.classList.add('hidden');
    }
  }, 420);

  document.body.classList.remove('modal-open');

  if (id === 'wordModal') {
    document.getElementById('wordForm').reset();
    // 同步自定义下拉框的视觉文字回到默认值（form.reset 只重置 hidden input，不会更新 UI）
    const addWordSelect = document.getElementById('addWordSelectWrapper');
    if (addWordSelect) {
      const textEl = addWordSelect.querySelector('.select-text');
      if (textEl) textEl.textContent = '名词';
    }
    // 同时重置 modalTitle 为默认标题
    document.getElementById('modalTitle').textContent = '添加单词';
  }
  if (id === 'importModal') resetImport();
  if (id === 'dictImportModal') resetDictImport();
}

/* ================= FSRS SETTINGS ================= */
const FSRS_DEFAULTS = { requestRetention: 0.9, maximumInterval: 365, learningSteps: [1, 10], enableFuzz: true, dailyNewLimitJa: 20, dailyNewLimitEn: 20 };

async function loadFsrsSettings() {
  try {
    const data = await api('/auth/settings');
    const s = { ...FSRS_DEFAULTS, ...data };
    document.getElementById('settingsRetention').value = Math.round(s.requestRetention * 100);
    document.getElementById('retentionValue').textContent = Math.round(s.requestRetention * 100) + '%';
    document.getElementById('maximumInterval').value = s.maximumInterval;
    // 【修改点】：分拆读取
    document.getElementById('settingsNewCardsJa').value = s.dailyNewLimitJa || s.dailyNewLimit || 20;
    document.getElementById('settingsNewCardsEn').value = s.dailyNewLimitEn || s.dailyNewLimit || 20;
    document.getElementById('enableFuzz').checked = s.enableFuzz;
    document.getElementById('settingsSteps').value = (s.learningSteps || [1, 10]).join(', ');
  } catch (e) { console.error('Failed to load settings:', e); }
}

function resetFsrsSettings() {
  document.getElementById('settingsRetention').value = 90;
  document.getElementById('retentionValue').textContent = '90%';
  document.getElementById('maximumInterval').value = 365;
  // 【修改点】：分拆重置
  document.getElementById('settingsNewCardsJa').value = 20;
  document.getElementById('settingsNewCardsEn').value = 20;
  document.getElementById('enableFuzz').checked = true;
  document.getElementById('settingsSteps').value = '1, 10';
  document.getElementById('notifySoundToggle').checked = true;
  document.getElementById('notifyDesktopToggle').checked = true;
  document.getElementById('notifyVibrateToggle').checked = true;
}

document.getElementById('settingsRetention').addEventListener('input', function() {
  document.getElementById('retentionValue').textContent = this.value + '%';
});

document.getElementById('fsrsSettingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('saveSettingsBtn');
  const orgText = btn.textContent;
  btn.textContent = '保存中...';
  
  const stepsStr = document.getElementById('settingsSteps').value;
  const steps = stepsStr.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
  
  // 修复1: 严格对齐后端 User.js 的白名单字段
  const settings = {
    dailyNewLimitJa: parseInt(document.getElementById('settingsNewCardsJa').value) || 20, 
    dailyNewLimitEn: parseInt(document.getElementById('settingsNewCardsEn').value) || 20, 
    requestRetention: (parseFloat(document.getElementById('settingsRetention').value) || 90) / 100,
    maximumInterval: parseInt(document.getElementById('maximumInterval').value) || 365,
    enableFuzz: document.getElementById('enableFuzz').checked,
    learningSteps: steps.length ? steps : [1, 10]
  };

  try {
    await api('/auth/settings', {
      method: 'PUT',
      // 修复2: 移除 JSON.stringify({ settings }) 带来的无用外层包装
      body: JSON.stringify(settings)
    });

    // 保存通知设置到 localStorage
    state.notifySound = document.getElementById('notifySoundToggle').checked;
    state.notifyDesktop = document.getElementById('notifyDesktopToggle').checked;
    state.notifyVibrate = document.getElementById('notifyVibrateToggle').checked;
    localStorage.setItem('notifySettings', JSON.stringify({
      notifySound: state.notifySound,
      notifyDesktop: state.notifyDesktop,
      notifyVibrate: state.notifyVibrate
    }));

    showToast('设置已保存，新配额将在下次开始学习时生效', 'success');
    closeModal('settingsModal');
    // Bug 6: 保存后立即刷新 dashboard 统计数据
    if (document.getElementById('view-dashboard').classList.contains('active')) {
      loadStats();
    }
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  } finally {
    btn.textContent = orgText;
  }
});

function formatDate(dateStr, state) {
  if (!dateStr) return '<span class="text-xs text-muted">无日期</span>';
  const now = new Date();
  const target = new Date(dateStr);
  if (target <= now) {
    return '<span class="px-2 py-0.5 bg-ochre/10 text-ochre rounded text-xs font-semibold pulse-ochre">待复习</span>';
  }
  if (state === 0 && target > now) {
    return `<span class="text-xs text-muted">排队中(明日)</span>`;
  }
  const diffMs = target - now;
  const diffMin = Math.ceil(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.ceil(diffMs / 86400000);
  let timeStr;
  if (diffMin < 60) timeStr = `${diffMin}分钟后`;
  else if (diffHours < 24) timeStr = `${diffHours}小时后`;
  else if (diffDays === 1) timeStr = '明天';
  else if (diffDays === 2) timeStr = '后天';
  else if (diffDays <= 7) timeStr = `${diffDays}天后`;
  else timeStr = target.toLocaleDateString('zh-CN', {month:'short', day:'numeric'});
  return `<span class="text-xs text-muted">${timeStr}</span><span class="text-xs text-charcoal/30 ml-1">复习</span>`;
}

/* ================= NOTIFICATIONS & REAL-TIME POLLING ================= */
let audioCtx = null;

// 在用户首次交互时解锁 AudioContext（解决浏览器自动播放限制）
function unlockAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  document.removeEventListener('click', unlockAudio);
  document.removeEventListener('touchstart', unlockAudio);
}
document.addEventListener('click', unlockAudio);
document.addEventListener('touchstart', unlockAudio);

function playGentleDing() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // 主音 (C6 柔和敲击)
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.2);

    // 泛音 (E6 拖尾，增加空气感)
    const osc2 = audioCtx.createOscillator();
    const gainNode2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.1);
    gainNode2.gain.setValueAtTime(0, audioCtx.currentTime + 0.1);
    gainNode2.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.15);
    gainNode2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
    osc2.connect(gainNode2);
    gainNode2.connect(audioCtx.destination);
    osc2.start(audioCtx.currentTime + 0.1);
    osc2.stop(audioCtx.currentTime + 1.5);
  } catch(e) { console.log('浏览器阻止了音频播放', e); }
}

function toggleNotifications() {
  if (!('Notification' in window)) return showToast('您的浏览器不支持桌面通知', 'error');

  // 如果已经获取了系统通知权限，则进行自由开关切换
  if (Notification.permission === 'granted') {
    state.notificationsEnabled = !state.notificationsEnabled; // 反转当前状态
    
    const btn = document.getElementById('notifyBtn');
    if (state.notificationsEnabled) {
      btn.classList.add('text-ochre');
      showToast('桌面复习提醒已开启', 'success');
    } else {
      btn.classList.remove('text-ochre');
      showToast('桌面复习提醒已关闭', 'info');
    }
  } 
  // 如果还未请求过权限，则向用户发起请求
  else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        state.notificationsEnabled = true;
        document.getElementById('notifyBtn').classList.add('text-ochre');
        showToast('桌面复习提醒已开启', 'success');
      } else {
        showToast('通知权限被拒绝，将仅使用声音提醒', 'info');
      }
    });
  } 
  // 如果用户之前在浏览器设置里彻底禁用了通知
  else {
    showToast('请在浏览器设置中手动允许通知', 'error');
  }
}

async function startBackgroundPolling() {
  if (state.pollingInterval) clearInterval(state.pollingInterval);
  if (state.localTimer) clearInterval(state.localTimer);

  // 首次立即拉一次，建立基准线
  await checkDueUpdates();

  // 每 15 秒后端轮询（缩短间隔，减少漏检）
  state.pollingInterval = setInterval(checkDueUpdates, 15000);
  // 每秒本地精准时钟
  state.localTimer = setInterval(tickLocalTimer, 1000);
}

async function checkDueUpdates() {
  if (!state.token) return;
  try {
    // 👇 修改这一行：带上当前语种参数，防止后台轮询全部默认拉取日语数据
    const data = await api(`/study/stats?language=${state.currentLang}`);
    const newDue = data.dueWords;
    const oldDue = state.lastDueCount;

    // 更新面板数字
    document.getElementById('totalWords').textContent = data.totalWords;
    document.getElementById('dueWords').textContent = newDue;

    // 更新冷却池列表
    state.upcomingWords = data.upcomingWords || [];

    // 核心判定：待复习数量比上次增加了，说明有新词到期！
    if (newDue > oldDue && oldDue >= 0) {
      const diff = newDue - oldDue;
      triggerDueNotification(diff);
    }

    state.lastDueCount = newDue;
    renderUpcomingWidget();
    updateTableDueTimes();
  } catch (e) { /* 静默 */ }
}

function tickLocalTimer() {
  if (!state.upcomingWords || state.upcomingWords.length === 0) return;
  const now = Date.now();
  let justDueCount = 0;

  state.upcomingWords = state.upcomingWords.filter(w => {
    const dueTime = new Date(w.due).getTime();
    if (dueTime <= now) {
       if (!state.notifiedWordIds.has(w._id)) {
           state.notifiedWordIds.add(w._id);
           justDueCount++;
       }
       return false;
    }
    return true;
  });

  if (justDueCount > 0) {
     state.lastDueCount += justDueCount;
     document.getElementById('dueWords').textContent = state.lastDueCount;
     triggerDueNotification(justDueCount);
     updateTableDueTimes();
  }

  renderUpcomingWidget();
}

// 通知去抖：60 秒内只触发一次完整提醒
let lastNotifyTime = 0;

function triggerDueNotification(count) {
  const now = Date.now();
  // 去抖：60 秒内不重复触发音效/通知/震动，但始终更新 UI
  const shouldAlert = (now - lastNotifyTime) > 60000;

  if (shouldAlert) {
    lastNotifyTime = now;

    // 风铃音效
    if (state.notifySound) playGentleDing();

    // 浏览器桌面通知
    if (state.notifyDesktop && state.notificationsEnabled && Notification.permission === 'granted') {
      new Notification("見だ | 记忆召唤", {
        body: `时间到！有 ${count} 个单词加入待复习队列，趁热打铁吧。`,
        icon: "favicon.png?v=2"
      });
    }

    // 震动（移动端）
    if (state.notifyVibrate && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }

  // 页面标题闪烁（始终生效，不受开关影响）
  if (!document.hasFocus()) {
    let blinkCount = 0;
    const originalTitle = document.title;
    const blinkInterval = setInterval(() => {
      document.title = blinkCount % 2 === 0
        ? `(${count}个待复习) 見だ`
        : originalTitle;
      blinkCount++;
      if (blinkCount >= 10) {
        clearInterval(blinkInterval);
        document.title = originalTitle;
      }
    }, 800);
  }

  // 待复习数字脉冲特效
  const dueElement = document.getElementById('dueWords').parentElement;
  dueElement.classList.add('pulse-ochre');
  setTimeout(() => dueElement.classList.remove('pulse-ochre'), 5000);
}

function loadNotifySettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('notifySettings'));
    if (saved) {
      state.notifySound = saved.notifySound !== false;
      state.notifyDesktop = saved.notifyDesktop !== false;
      state.notifyVibrate = saved.notifyVibrate !== false;
    }
    // 同步 toggle 状态到 UI
    const s = document.getElementById('notifySoundToggle');
    const d = document.getElementById('notifyDesktopToggle');
    const v = document.getElementById('notifyVibrateToggle');
    if (s) s.checked = state.notifySound;
    if (d) d.checked = state.notifyDesktop;
    if (v) v.checked = state.notifyVibrate;
  } catch (e) {}
}

function renderUpcomingWidget() {
  const widget = document.getElementById('upcomingWidget');
  const timeline = document.getElementById('upcomingTimeline');
  
  // 首次渲染时，将 HTML 中写死的 Tailwind hidden 类剥离，换成我们的平滑折叠类
  if (widget.classList.contains('hidden')) {
    widget.classList.remove('hidden');
    widget.classList.add('is-collapsed');
  }

  if (!state.upcomingWords || state.upcomingWords.length === 0) {
    // 隐藏时使用 is-collapsed
    widget.classList.add('is-collapsed');
    return;
  }

  // 计算分组：如 [ { 1分钟: 3词 }, { 7分钟: 1词 } ]
  const groups = {};
  const now = Date.now();
  state.upcomingWords.forEach(w => {
    const diffMs = new Date(w.due).getTime() - now;
    const diffMin = Math.ceil(diffMs / 60000);
    const key = diffMin > 0 ? diffMin : 1;
    groups[key] = (groups[key] || 0) + 1;
  });

  const sortedKeys = Object.keys(groups).map(Number).sort((a,b)=>a-b);
  timeline.innerHTML = sortedKeys.map((min, i) => `
    <button type="button" onclick="toggleCoolingDropdown(event, ${min})" class="cooling-item-btn px-3 py-1.5 bg-ochre/10 border border-ochre/20 rounded-lg text-xs font-medium text-ochre flex items-center gap-1.5 transition-all hover:bg-ochre/15 active:scale-95 ${i === 0 ? 'pulse-ochre' : ''}">
       <span class="font-mono font-bold">${min}</span> 分钟后
       <span class="bg-surface text-charcoal px-1.5 py-0.5 rounded text-[10px] shadow-sm">${groups[min]} 词</span>
    </button>
  `).join('');

  // 展开时移除 is-collapsed，触发 css 的 max-height 过渡
  widget.classList.remove('is-collapsed');
}


/* ================= ONBOARDING (Driver.js v1.0) ================= */
function checkAndStartOnboarding() {
  // 1. 检查是否已经完成过引导
  if (localStorage.getItem('mida_onboarding_v2') === 'true') return;

  // 2. 确保依赖已加载 (v1.0 的调用方式是 window.driver.js.driver)
  if (!window.driver || !window.driver.js) {
    console.warn('Driver.js 未正确加载');
    return;
  }

  // 3. 动态注入符合“見だ”美学的自定义样式 (避免污染 main.css)
  if (!document.getElementById('mida-driver-style')) {
    const style = document.createElement('style');
    style.id = 'mida-driver-style';
    style.innerHTML = `
      .mida-tour-popover {
        font-family: var(--font-ui), sans-serif !important;
        border-radius: var(--radius-card) !important;
        border: 1px solid rgb(var(--color-borderline)) !important;
        background-color: rgb(var(--color-surface)) !important;
        box-shadow: 0 20px 40px rgba(26,47,43,0.12) !important;
        padding: 20px !important;
        max-width: 320px !important;
      }
      .mida-tour-popover .driver-popover-title {
        font-family: var(--font-display), sans-serif !important;
        color: rgb(var(--color-charcoal)) !important;
        font-size: 1.15rem !important;
        font-weight: 700 !important;
        margin-bottom: 8px !important;
        letter-spacing: 0.05em !important;
      }
      .mida-tour-popover .driver-popover-description {
        color: rgb(var(--color-muted)) !important;
        font-size: 0.85rem !important;
        line-height: 1.6 !important;
      }
      .mida-tour-popover .driver-popover-footer {
        margin-top: 16px !important;
      }
      .mida-tour-popover .driver-popover-footer button {
        border-radius: 8px !important;
        text-shadow: none !important;
        font-weight: 600 !important;
        font-size: 0.75rem !important;
        padding: 8px 14px !important;
        transition: all 0.2s !important;
        font-family: var(--font-ui), sans-serif !important;
        letter-spacing: 0.05em !important;
      }
      /* 下一步/完成按钮 */
      .mida-tour-popover .driver-popover-next-btn {
        background-color: rgb(var(--color-charcoal)) !important;
        color: rgb(var(--color-surface)) !important;
        border: none !important;
      }
      .mida-tour-popover .driver-popover-next-btn:hover {
        background-color: rgba(var(--color-charcoal), 0.9) !important;
      }
      /* 上一步按钮 */
      .mida-tour-popover .driver-popover-prev-btn {
        background-color: rgb(var(--color-surface)) !important;
        color: rgb(var(--color-charcoal)) !important;
        border: 1px solid rgb(var(--color-borderline)) !important;
      }
      /* 跳过按钮 */
      .mida-tour-popover .driver-popover-close-btn {
        color: rgb(var(--color-muted)) !important;
      }
      .mida-tour-popover .driver-popover-progress-text {
        color: rgb(var(--color-ochre)) !important;
        font-weight: 700 !important;
        font-size: 0.75rem !important;
      }
    `;
    document.head.appendChild(style);
  }

  const driver = window.driver.js.driver;

  // 4. 配置并初始化引导
  const driverObj = driver({
    showProgress: true,
    animate: true,
    allowClose: false, // 防止误触外部关闭
    doneBtnText: '开启旅程',
    closeBtnText: '跳过',
    nextBtnText: '下一步',
    prevBtnText: '上一步',
    popoverClass: 'mida-tour-popover',
    steps: [
      {
        element: '#ws-btn-ja',
        popover: {
          title: '🌐 全新双语工作区',
          description: '现在您可以随时在「日语」和「英语」之间无缝切换。两个词库的数据、进度完全隔离，互不干扰。',
          side: 'bottom', align: 'start'
        }
      },
      {
        element: '#tour-stats-area',
        popover: {
          title: '📊 掌握学习脉络',
          description: '这里实时反映您的总词汇量和今日待复习数。数字会随着您的学习轨迹跳动。',
          side: 'bottom', align: 'start'
        }
      },
      {
        element: '#tour-action-bar',
        popover: {
          title: '⚡ 强大的构建工具',
          description: '支持单个添加、AI 批量智能提取，现在还支持直接拖入 Anki 的 .apkg 词书进行云端清洗与导入！',
          side: 'top', align: 'center'
        }
      },
      {
        element: '#upcomingWidget',
        popover: {
          title: '⏳ 记忆冷却池',
          description: '基于 FSRS 算法。刚刚学过的新词会在这里停留 1~10 分钟“冷却预热”，等待您趁热打铁进行二次巩固。',
          side: 'top', align: 'start'
        }
      },
      {
        element: '#tour-study-btn',
        popover: {
          title: '🚀 准备好了吗？',
          description: '点击这里，进入沉浸式的学习心流状态。保持纯粹，专注语言。',
          side: 'left', align: 'center'
        }
      }
    ],
    onDestroyStarted: () => {
      // 当用户点击跳过或走完最后一步时触发
      if (!driverObj.hasNextStep() || confirm("确定要退出新手引导吗？")) {
        localStorage.setItem('mida_onboarding_v2', 'true');
        driverObj.destroy();
      }
    },
  });

  // 5. 延迟启动，确保面板数据和动画（如数字翻滚）加载完成
  setTimeout(() => {
    driverObj.drive();
  }, 1000);
}

// 供设置页手动触发使用（可选）：重新观看引导
window.replayOnboarding = function() {
  localStorage.removeItem('mida_onboarding_v2');
  checkAndStartOnboarding();
};

