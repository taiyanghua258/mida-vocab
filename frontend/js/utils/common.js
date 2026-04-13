const CONFIG = { USE_MOCK_API: false, API_BASE: '/api' };

/* ================= TOAST ================= */
function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  // 加入 pointer-events-auto 保证弹窗自身可以点击
  t.className = `toast toast-${type} flex items-center gap-3 px-5 py-3 rounded-xl border-l-4 bg-surface shadow-lg text-sm font-medium pointer-events-auto`;
  t.innerHTML = `<span>${msg}</span>`;
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

// .apkg 转换工具教程
function showQuickGuide() {
  const guide = `
    已升级为全自动云端清洗！
    只需将 .apkg 文件拖入下方的专门虚线框区域，系统会自动将其转换为标准的 .json 文件并下载到您的设备。
    转换完成后，您只需将下载的 json 文件拖入主上传区域即可。
  `;
  alert(guide.replace(/^\s+/gm, ''));
}


function navigate(viewId) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.getElementById(`view-${viewId}`).classList.add('active');
  if (viewId === 'dashboard') initDashboard();
  if (viewId === 'study') initStudy();
  if (viewId === 'auth') {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('regUsername').value = '';
    document.getElementById('regPassword').value = '';
    document.getElementById('regConfirmPassword').value = '';
    const loginBtn = document.querySelector('#loginForm button[type="submit"]');
    if (loginBtn) { loginBtn.disabled = false; loginBtn.innerHTML = '登录系统'; }
    const regBtn = document.querySelector('#registerForm button[type="submit"]');
    if (regBtn) { regBtn.disabled = false; regBtn.innerHTML = '注册账号'; }
  }
}

function openModal(id) {
  document.getElementById(id).classList.add('active');
  if (id === 'settingsModal') { loadFsrsSettings(); loadNotifySettings(); }
}
function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove('active');
  if (id === 'wordModal') document.getElementById('wordForm').reset();
  if (id === 'importModal') resetImport();
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
    <div class="px-3 py-1.5 bg-ochre/10 border border-ochre/20 rounded-lg text-xs font-medium text-ochre flex items-center gap-1.5 transition-all ${i === 0 ? 'pulse-ochre' : ''}">
       <span class="font-mono font-bold">${min}</span> 分钟后
       <span class="bg-surface text-charcoal px-1.5 py-0.5 rounded text-[10px] shadow-sm">${groups[min]} 词</span>
    </div>
  `).join('');

  // 展开时移除 is-collapsed，触发 css 的 max-height 过渡
  widget.classList.remove('is-collapsed');
}

function updateTableDueTimes() {
  if (document.getElementById('view-dashboard').classList.contains('active')) {
    const cells = document.querySelectorAll('.due-cell');
    cells.forEach(cell => {
       const dueStr = cell.getAttribute('data-due');
       const wstate = parseInt(cell.getAttribute('data-state'));
       if (dueStr) cell.innerHTML = formatDate(dueStr, wstate);
    });
  }
}

