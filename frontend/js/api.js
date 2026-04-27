/* ================= API ================= */
const api = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const config = {
    method: options.method || 'GET',
    cache: 'no-store', // 全局禁用 API 缓存，防止出现已删幽灵数据
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'x-auth-token': token })
    }
  };
  if (options.body) config.body = options.body;
  const res = await fetch(`${CONFIG.API_BASE}${endpoint}`, config);
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'API error');
  }
  return res.json();
};

/* ================= AUTH ================= */
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const btn = e.target.querySelector('button[type="submit"]');

  if (!username || !password) {
    showToast('请输入用户名和密码', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<svg class="animate-spin inline-block mr-2" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> 登录中...';

  try {
    const res = await fetch(`${CONFIG.API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || '登录失败');
    }

    const data = await res.json();
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    // 使用新的渲染函数
    renderUserInfo();
    
    showToast('登录成功', 'success');
    startBackgroundPolling();
    loadNotifySettings();
    navigate('dashboard');
  } catch (err) {
    showToast(err.message || '登录失败，请检查用户名和密码', 'error');
    btn.disabled = false;
    btn.innerHTML = '登录系统';
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('regUsername').value;
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  const btn = e.target.querySelector('button[type="submit"]');

  if (!username || !password || !confirmPassword) {
    showToast('请填写完整信息', 'error');
    return;
  }
  if (password.length < 6) {
    showToast('密码至少6位', 'error');
    return;
  }
  if (password !== confirmPassword) {
    showToast('两次密码输入不一致', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<svg class="animate-spin inline-block mr-2" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> 注册中...';

  try {
    const res = await fetch(`${CONFIG.API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email: username, password })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || '注册失败');
    }

    const data = await res.json();
    showToast('注册成功，请登录', 'success');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    btn.disabled = false;
    btn.innerHTML = '注册账号';
    showLogin();
  } catch (err) {
    showToast(err.message || '注册失败，该邮箱或用户名可能已被使用', 'error');
    btn.disabled = false;
    btn.innerHTML = '注册账号';
  }
});

function handleLogout() {
  if (state.pollingInterval) clearInterval(state.pollingInterval);
  if (state.localTimer) clearInterval(state.localTimer);
  state.token = null; state.user = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  // 重置按钮状态
  const loginBtn = document.querySelector('#loginForm button[type="submit"]');
  if (loginBtn) { loginBtn.disabled = false; loginBtn.innerHTML = '登录系统'; }
  const regBtn = document.querySelector('#registerForm button[type="submit"]');
  if (regBtn) { regBtn.disabled = false; regBtn.innerHTML = '注册账号'; }
  navigate('auth');
}

async function handleDeleteAccount() {
  closeUserMenu(); // 先关闭菜单
  
  const isConfirmed = confirm('⚠️ 危险操作：\n\n您确定要彻底注销账户吗？此操作将永久删除您的账户、所有配置以及背诵过的数据（无法恢复）！');
  if (!isConfirmed) return;
  
  const username = state.user.username;
  
  try {
    // 调用后端 authController.js 里的 deleteUser 方法
    await api(`/auth/user/${username}`, { method: 'DELETE' });
    
    showToast(`用户 ${username} 已彻底注销。江湖再见！`, 'success');
    
    // 借用登出逻辑清理本地状态并返回登录页
    setTimeout(() => {
      handleLogout();
    }, 1500);
    
  } catch (err) {
    showToast(err.message || '注销失败，请重试', 'error');
  }
}

function showRegister() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
  document.getElementById('regUsername').value = '';
  document.getElementById('regPassword').value = '';
  document.getElementById('regConfirmPassword').value = '';
  const regBtn = document.querySelector('#registerForm button[type="submit"]');
  if (regBtn) { regBtn.disabled = false; regBtn.innerHTML = '注册账号'; }
}

function showLogin() {
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  const loginBtn = document.querySelector('#loginForm button[type="submit"]');
  if (loginBtn) { loginBtn.disabled = false; loginBtn.innerHTML = '登录系统'; }
}

let currentSwitchId = 0; // 👇 新增全局变量在函数外面

function switchWorkspace(lang, isInitial = false) {
  hideAnswerSection();
  resetAllCardAnimations();

  // 增加防抖：如果点击的是当前已激活的语言，直接忽略，避免重复刷新动画
  if (state.currentLang === lang && !isInitial) return;

  const dashActive = document.getElementById('view-dashboard').classList.contains('active');
  const switchId = ++currentSwitchId; // 👇 新增：每次切换生成唯一 ID

  // 1. 触发淡出离场动画（如果在主控制台且非首次加载）
  if (!isInitial && dashActive) {
    document.body.classList.add('workspace-switching');
  }

  state.currentLang = lang;
  localStorage.setItem('appLang', lang);
  window.currentCalendarData = null; // ⚠️ 只在这里（切换语种时）销毁热力图缓存！

  // ========== Logo 丝滑滚动切换动效 (保持原有逻辑) ==========
  const brandJa = document.getElementById('brand-ja');
  const brandEn = document.getElementById('brand-en');
  if (brandJa && brandEn) {
    if (isInitial) {
      brandJa.style.transition = 'none';
      brandEn.style.transition = 'none';
    }
    if (lang === 'ja') {
      brandJa.classList.remove('-translate-y-8', 'translate-y-8', 'opacity-0');
      brandJa.classList.add('translate-y-0', 'opacity-100');
      brandEn.classList.remove('translate-y-0', '-translate-y-8', 'opacity-100');
      brandEn.classList.add('translate-y-8', 'opacity-0');
    } else {
      brandJa.classList.remove('translate-y-0', 'translate-y-8', 'opacity-100');
      brandJa.classList.add('-translate-y-8', 'opacity-0');
      brandEn.classList.remove('translate-y-8', '-translate-y-8', 'opacity-0');
      brandEn.classList.add('translate-y-0', 'opacity-100');
    }
    if (isInitial) {
      setTimeout(() => {
        brandJa.style.transition = '';
        brandEn.style.transition = '';
      }, 50);
    }
  }

  // ========== 按钮及界面文案切换 (保持原有逻辑) ==========
  const btnJa = document.getElementById('ws-btn-ja');
  const btnEn = document.getElementById('ws-btn-en');
  if (btnJa && btnEn) {
    btnJa.className = lang === 'ja' 
      ? 'px-3 py-1.5 rounded-full text-[0.75rem] font-bold transition-all bg-charcoal text-surface shadow-sm font-ui' 
      : 'px-3 py-1.5 rounded-full text-[0.75rem] font-bold transition-all text-muted hover:text-charcoal font-ui';
    btnEn.className = lang === 'en' 
      ? 'px-3 py-1.5 rounded-full text-[0.75rem] font-bold transition-all bg-charcoal text-surface shadow-sm font-ui' 
      : 'px-3 py-1.5 rounded-full text-[0.75rem] font-bold transition-all text-muted hover:text-charcoal font-ui';
  }

  const tableHeader = document.getElementById('tableHeaderWord');
  if (tableHeader) tableHeader.textContent = lang === 'ja' ? '日语单词' : '英语单词';
  
  const addWordLabel = document.getElementById('addWordLabel');
  if (addWordLabel) addWordLabel.innerHTML = lang === 'ja' ? '日语 <span class="text-terracotta">*</span>' : '英语 <span class="text-terracotta">*</span>';
  
  const inputEl = document.getElementById('japanese');
  if (inputEl) {
    inputEl.placeholder = lang === 'ja' ? '桜' : 'apple';
    if (lang === 'ja') {
      inputEl.classList.add('font-jp');
      inputEl.classList.remove('font-sans', 'tracking-tight');
    } else {
      inputEl.classList.add('font-sans', 'tracking-tight');
      inputEl.classList.remove('font-jp');
    }
  }
  
  const readingLabel = document.getElementById('readingLabel');
  if (readingLabel) readingLabel.textContent = lang === 'ja' ? '读音' : '音标 (IPA)';

  // 清空之前可能选中的多选框
  clearWordSelection();

  // ========== 数据拉取与进场动画编排 ==========
  if (dashActive) {
    if (isInitial) {
      // 初始进入页面，直接加载，不播切换动画
      document.body.classList.remove('workspace-switching'); // 清除可能残留的切换态
      loadStats();
      loadWords(1);
    } else {
      // 切换语言时：等待 200ms 让旧数据带着动画沉下去并变透明
      setTimeout(async () => {
        // 并发拉取新数据
        await Promise.all([
          loadStats(),
          loadWords(1)
        ]);
        
        // 数据替换完毕后，在下一帧移除 switching 状态，触发新数据“弹上来”的动画
        requestAnimationFrame(() => {
          document.body.classList.remove('workspace-switching');
        });
      }, 200);
    }
  }
}

