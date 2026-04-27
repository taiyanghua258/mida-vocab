/* ================= ONBOARDING SYSTEM ================= */

const ONBOARDING_VERSION = 2;
const ONBOARDING_MAX_RETRIES = 12;
const ONBOARDING_RETRY_DELAY = 500;

let onboardingState = {
  checkedThisSession: false,
  running: false,
  driverInstance: null,
  retryTimer: null
};

function getOnboardingUserIdentity() {
  const user = (typeof state !== 'undefined' && state && state.user) ? state.user : null;

  if (!user) return null;

  return (
    user._id ||
    user.id ||
    user.username ||
    user.email ||
    null
  );
}

function getOnboardingStorageKey() {
  const identity = getOnboardingUserIdentity();

  if (!identity) {
    return null;
  }

  return `mida_onboarding_v${ONBOARDING_VERSION}_user_${identity}`;
}

function getLegacyOnboardingKeys() {
  return [
    'hasSeenOnboarding',
    'mida_onboarding_v2'
  ];
}

function hasCompletedOnboarding() {
  const user = (typeof state !== 'undefined' && state && state.user) ? state.user : null;

  if (user && user.onboarding && Number(user.onboarding.version) >= ONBOARDING_VERSION) {
    return true;
  }

  const key = getOnboardingStorageKey();

  if (!key) return false;

  if (localStorage.getItem(key) === 'true') {
    return true;
  }

  return false;
}

async function syncOnboardingCompletedToServer() {
  if (typeof api !== 'function') return;
  try {
    await api('/auth/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({
        version: ONBOARDING_VERSION
      })
    });
  } catch (err) {
    console.warn('[Onboarding] failed to sync completion:', err);
  }
}

function markOnboardingCompleted() {
  const key = getOnboardingStorageKey();

  if (key) {
    localStorage.setItem(key, 'true');
  }

  clearPendingOnboardingForCurrentUser();

  // 兼容旧逻辑：不再依赖它们，但完成后可清理旧 key，避免误判。
  getLegacyOnboardingKeys().forEach((legacyKey) => {
    localStorage.removeItem(legacyKey);
  });

  if (typeof state !== 'undefined' && state && state.token) {
    syncOnboardingCompletedToServer();
  }
}

function getPendingOnboardingKeyForUsername(username) {
  if (!username) return null;
  return `mida_onboarding_pending_${String(username).trim().toLowerCase()}`;
}

function markPendingOnboardingForUsername(username) {
  const key = getPendingOnboardingKeyForUsername(username);
  if (key) {
    localStorage.setItem(key, String(Date.now()));
  }
}

function hasPendingOnboardingForCurrentUser() {
  const user = (typeof state !== 'undefined' && state && state.user) ? state.user : null;
  if (!user) return false;

  const candidates = [
    user.username,
    user.email
  ].filter(Boolean);

  return candidates.some((value) => {
    const key = getPendingOnboardingKeyForUsername(value);
    return key && localStorage.getItem(key);
  });
}

function clearPendingOnboardingForCurrentUser() {
  const user = (typeof state !== 'undefined' && state && state.user) ? state.user : null;
  if (!user) return;

  [user.username, user.email].filter(Boolean).forEach((value) => {
    const key = getPendingOnboardingKeyForUsername(value);
    if (key) {
      localStorage.removeItem(key);
    }
  });
}

function shouldStartOnboarding(options = {}) {
  if (options.force === true) {
    return true;
  }

  if (typeof state === 'undefined' || !state || !state.user || !state.token) {
    return false;
  }

  if (hasPendingOnboardingForCurrentUser()) {
    return true;
  }

  return !hasCompletedOnboarding();
}

function isDashboardActive() {
  const dashboard = document.getElementById('view-dashboard');
  return !!dashboard && dashboard.classList.contains('active');
}

function isElementUsable(selector) {
  if (!selector) return true;

  const el = document.querySelector(selector);
  if (!el) return false;

  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDashboardReady() {
  for (let i = 0; i < ONBOARDING_MAX_RETRIES; i++) {
    if (isDashboardActive()) {
      return true;
    }

    await wait(ONBOARDING_RETRY_DELAY);
  }

  return false;
}

async function waitForDriverReady() {
  for (let i = 0; i < ONBOARDING_MAX_RETRIES; i++) {
    if (window.driver && window.driver.js && typeof window.driver.js.driver === 'function') {
      return true;
    }

    await wait(ONBOARDING_RETRY_DELAY);
  }

  return false;
}

async function waitForAnyTourTargetReady() {
  const selectors = [
    '#ws-btn-ja',
    '#tour-stats-area',
    '#tour-action-bar',
    '#upcomingWidget',
    '#tour-study-btn'
  ];

  for (let i = 0; i < ONBOARDING_MAX_RETRIES; i++) {
    if (selectors.some(isElementUsable)) {
      return true;
    }

    await wait(ONBOARDING_RETRY_DELAY);
  }

  return false;
}

function injectOnboardingStyle() {
  if (document.getElementById('mida-driver-style')) return;

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
      max-width: min(320px, calc(100vw - 32px)) !important;
      color: rgb(var(--color-charcoal)) !important;
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

    .mida-tour-popover .driver-popover-next-btn {
      background-color: rgb(var(--color-charcoal)) !important;
      color: rgb(var(--color-surface)) !important;
      border: none !important;
    }

    .mida-tour-popover .driver-popover-prev-btn {
      background-color: rgb(var(--color-surface)) !important;
      color: rgb(var(--color-charcoal)) !important;
      border: 1px solid rgb(var(--color-borderline)) !important;
    }

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

function buildOnboardingSteps() {
  const baseSteps = [
    {
      element: '#ws-btn-ja',
      popover: {
        title: '全新双语工作区',
        description: '您可以在「日语」和「英语」之间切换。两个词库的数据、进度和复习节奏互不干扰。',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#tour-stats-area',
      popover: {
        title: '掌握学习脉络',
        description: '这里会实时显示总词汇量和今日待复习数，帮助您快速判断当前学习状态。',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#tour-action-bar',
      popover: {
        title: '构建您的词库',
        description: '您可以单个添加、批量导入，也可以使用 AI 辅助整理词条。',
        side: 'top',
        align: 'center'
      }
    },
    {
      element: '#upcomingWidget',
      popover: {
        title: '记忆冷却池',
        description: '刚学习过的新词会在这里短暂停留，等待您趁热巩固。',
        side: 'top',
        align: 'start'
      }
    },
    {
      element: '#tour-study-btn',
      popover: {
        title: '开始学习',
        description: '准备好后，从这里进入沉浸式学习流程。',
        side: 'left',
        align: 'center'
      }
    }
  ];

  const usableSteps = baseSteps.filter((step) => {
    if (!step.element) return true;
    return isElementUsable(step.element);
  });

  if (usableSteps.length === 0) {
    return [
      {
        popover: {
          title: '欢迎来到 見だ',
          description: '您的学习空间已经准备好了。您可以从添加单词开始，也可以进入设置调整学习节奏。',
          align: 'center'
        }
      }
    ];
  }

  return usableSteps;
}

function cleanupOnboardingInstance() {
  if (onboardingState.retryTimer) {
    clearTimeout(onboardingState.retryTimer);
    onboardingState.retryTimer = null;
  }

  onboardingState.driverInstance = null;
  onboardingState.running = false;
}

async function startOnboarding(options = {}) {
  try {
    if (onboardingState.running) {
      return false;
    }

    if (!shouldStartOnboarding(options)) {
      onboardingState.checkedThisSession = true;
      return false;
    }

    onboardingState.running = true;

    const dashboardReady = await waitForDashboardReady();
    if (!dashboardReady) {
      cleanupOnboardingInstance();
      console.warn('[Onboarding] Dashboard not ready.');
      return false;
    }

    const driverReady = await waitForDriverReady();
    if (!driverReady) {
      cleanupOnboardingInstance();
      console.warn('[Onboarding] Driver.js not ready.');
      return false;
    }

    await waitForAnyTourTargetReady();

    // 给 loadStats/loadWords、CSS 入场动画、布局计算留一点稳定时间。
    await wait(350);

    if (!isDashboardActive()) {
      cleanupOnboardingInstance();
      return false;
    }

    injectOnboardingStyle();

    const steps = buildOnboardingSteps();

    const driverFactory = window.driver.js.driver;

    const driverInstance = driverFactory({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: 'rgba(26, 47, 43, 0.55)',
      doneBtnText: '开启旅程',
      closeBtnText: '跳过',
      nextBtnText: '下一步',
      prevBtnText: '上一步',
      popoverClass: 'mida-tour-popover',
      steps,

      onDestroyStarted: () => {
        markOnboardingCompleted();

        try {
          driverInstance.destroy();
        } finally {
          cleanupOnboardingInstance();
          onboardingState.checkedThisSession = true;
        }
      }
    });

    onboardingState.driverInstance = driverInstance;
    driverInstance.drive();

    return true;
  } catch (err) {
    console.error('[Onboarding] failed to start:', err);
    cleanupOnboardingInstance();
    return false;
  }
}

async function maybeStartOnboarding() {
  if (onboardingState.checkedThisSession || onboardingState.running) {
    return false;
  }

  return startOnboarding({ force: false });
}

async function replayOnboarding() {
  const key = getOnboardingStorageKey();

  if (key) {
    localStorage.removeItem(key);
  }

  onboardingState.checkedThisSession = false;

  if (onboardingState.driverInstance) {
    try {
      onboardingState.driverInstance.destroy();
    } catch (err) {
      console.warn('[Onboarding] failed to destroy old instance:', err);
    }
  }

  cleanupOnboardingInstance();

  return startOnboarding({ force: true });
}

window.startOnboarding = startOnboarding;
window.maybeStartOnboarding = maybeStartOnboarding;
window.replayOnboarding = replayOnboarding;
window.markPendingOnboardingForUsername = markPendingOnboardingForUsername;
