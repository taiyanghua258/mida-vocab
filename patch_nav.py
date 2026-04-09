import re

with open("frontend/index.html", "r") as f:
    text = f.read()

# Replace Nav
target_nav = """          <span class="text-sm text-muted hidden sm:flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"></path></svg>
            <span id="welcomeUser" class="font-medium"></span>
          </span>
          <button onclick="handleLogout()" class="text-sm font-medium text-muted hover:text-terracotta transition-colors">退出</button>"""

replacement_nav = """          <span class="text-sm text-muted hidden sm:flex items-center gap-2 pr-2 border-r border-borderline">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"></path></svg>
            <span id="welcomeUser" class="font-medium"></span>
          </span>
          <button onclick="openSettings()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-parchment text-muted hover:text-ochre transition-all active:scale-95" title="FSRS 设置">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M128,104a24,24,0,1,0,24,24A24,24,0,0,0,128,104Zm0,32a8,8,0,1,1,8-8A8,8,0,0,1,128,136Zm88-16v16a80.12,80.12,0,0,1-30.76,62.8l20.42,35.37a8,8,0,0,1-13.84,8L171.39,206.8A80.21,80.21,0,0,1,136,216v40a8,8,0,0,1-16,0V216a80.21,80.21,0,0,1-35.39-9.2L64.18,242.17a8,8,0,0,1-13.84-8l20.42-35.37A80.12,80.12,0,0,1,40,136V120a80.12,80.12,0,0,1,30.76-62.8L50.34,21.83a8,8,0,0,1,13.84-8L84.61,49.2A80.21,80.21,0,0,1,120,40V0a8,8,0,0,1,16,0V40a80.21,80.21,0,0,1,35.39,9.2l20.43-35.37a8,8,0,0,1,13.84,8L185.24,57.2A80.12,80.12,0,0,1,216,120Z"></path></svg>
          </button>
          <button onclick="handleLogout()" class="text-sm font-medium text-muted hover:text-terracotta transition-colors ml-1">退出</button>"""

if target_nav in text:
    text = text.replace(target_nav, replacement_nav)
    print("Nav replaced.")

target_modal = '  <div id="wordModal"'

settings_modal = """  <!-- Settings Modal with Glassmorphism -->
  <div id="settingsModal" class="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/20 backdrop-blur-md p-4 hidden opacity-0 transition-opacity duration-300" onclick="if(event.target===this) closeSettings()">
    <div class="modal-content bg-surface/80 backdrop-blur-3xl border border-surface shadow-2xl rounded-[2rem] w-full max-w-md overflow-hidden transform scale-95 transition-all duration-300">
      <div class="px-8 py-5 border-b border-borderline/50 flex justify-between items-center bg-surface/30">
        <h3 class="text-lg font-semibold text-charcoal flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" class="text-ochre"><path d="M112,88a24,24,0,1,1,24,24A24,24,0,0,1,112,88Zm114.78,21L215,97.4a83.69,83.69,0,0,0-5.75-13.89l5.06-12.21a16.08,16.08,0,0,0-6.1-20l-9.15-5.28a16.14,16.14,0,0,0-20.91,3.84l-8.28,10.3a86.66,86.66,0,0,0-15-5.32L152,41.56a16.14,16.14,0,0,0-15.86-13.3H119.89A16.15,16.15,0,0,0,104,41.56l-3,13.25a86.66,86.66,0,0,0-15,5.32l-8.28-10.3a16.13,16.13,0,0,0-20.9-3.84l-9.15,5.28a16.08,16.08,0,0,0-6.1,20l5.06,12.21A83.69,83.69,0,0,0,41,97.4l-11.77,11.6a16.1,16.1,0,0,0-4.66,16.6l3.5,10c3.15,9,9,16.94,20,16.94h0l12.44-2a87.72,87.72,0,0,0,12.06,8l5,12.2a16.08,16.08,0,0,0,14.86,10h51l5-12.2a87.72,87.72,0,0,0,12.06-8l12.44,2h0c11,0,16.89-7.9,20.06-16.94l3.5-10A16.1,16.1,0,0,0,226.78,109ZM128,128a40,40,0,1,1,40-40A40,40,0,0,1,128,128Z"></path></svg>
          学习算法配置
        </h3>
        <button onclick="closeSettings()" class="text-muted hover:text-charcoal w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg>
        </button>
      </div>
      <div class="p-8 space-y-6 bg-surface/50">
        <div>
          <label class="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">每日新卡上限</label>
          <input type="number" id="settingsNewCards" class="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-borderline/60 rounded-xl focus:border-ochre focus:ring-2 focus:ring-ochre/20 transition-all outline-none" min="1" max="999" value="20">
          <p class="text-[10px] text-muted mt-2 leading-tight">拦截每日无节制吸取新卡片，合理利用 FSRS 配置最大化单日记忆承载力。</p>
        </div>
        <div>
          <label class="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">FSRS 保留率 (Request Retention)</label>
          <input type="number" id="settingsRetention" class="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-borderline/60 rounded-xl focus:border-ochre focus:ring-2 focus:ring-ochre/20 transition-all outline-none" step="0.01" min="0.70" max="0.99" value="0.90">
          <p class="text-[10px] text-muted mt-2 leading-tight">默认留存率为 90% (0.9)。不建议低于 0.85 或高于 0.95。</p>
        </div>
        <div>
          <label class="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">短期步长 (Learning Steps 分钟)</label>
          <input type="text" id="settingsSteps" class="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-borderline/60 rounded-xl focus:border-ochre focus:ring-2 focus:ring-ochre/20 transition-all outline-none text-sm" placeholder="例如: 1, 10">
          <p class="text-[10px] text-muted mt-2 leading-tight">逗号分割。新词与遗忘词重新学习的过程跨度（例如：1分钟、10分钟）。</p>
        </div>
      </div>
      <div class="px-8 py-5 border-t border-borderline/50 flex justify-end gap-3 bg-surface/30">
        <button onclick="closeSettings()" class="px-5 py-2.5 text-charcoal bg-white/50 backdrop-blur-md hover:bg-white/80 border border-borderline/60 rounded-xl transition-all font-medium text-sm">取消</button>
        <button id="saveSettingsBtn" onclick="saveSettings()" class="px-6 py-2.5 bg-charcoal hover:bg-charcoal/90 text-surface rounded-xl transition-all shadow-md font-medium text-sm border border-transparent">保存配置</button>
      </div>
    </div>
  </div>

  <div id="wordModal"'''

if target_modal in text:
    text = text.replace(target_modal, settings_modal)
    print("Modal injected.")

target_js = """window.addEventListener('DOMContentLoaded', () => {"""

js_injection = """
// ====== FSRS Settings Logic ======
async function loadSettings() {
  try {
    const user = await api('/auth/me');
    const settings = user.fsrsSettings || {};
    document.getElementById('settingsNewCards').value = settings.newCardsPerDay || 20;
    document.getElementById('settingsRetention').value = settings.requestRetention || 0.9;
    document.getElementById('settingsSteps').value = (settings.learningSteps || [1, 10]).join(', ');
  } catch(e) { console.error('Failed to load settings', e); }
}

function openSettings() {
  const modal = document.getElementById('settingsModal');
  modal.classList.remove('hidden');
  // force reflow
  void modal.offsetWidth;
  modal.classList.remove('opacity-0');
  modal.querySelector('.modal-content').classList.remove('scale-95');
  loadSettings();
}

function closeSettings() {
  const modal = document.getElementById('settingsModal');
  modal.classList.add('opacity-0');
  modal.querySelector('.modal-content').classList.add('scale-95');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

async function saveSettings() {
  const btn = document.getElementById('saveSettingsBtn');
  const orgText = btn.textContent;
  btn.textContent = '保存中...';
  
  const stepsStr = document.getElementById('settingsSteps').value;
  const steps = stepsStr.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
  
  const settings = {
    newCardsPerDay: parseInt(document.getElementById('settingsNewCards').value) || 20,
    requestRetention: parseFloat(document.getElementById('settingsRetention').value) || 0.9,
    maximumInterval: 365,
    enableFuzz: true,
    learningSteps: steps.length ? steps : [1, 10]
  };

  try {
    await api('/auth/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings })
    });
    showToast('FSRS 参数已同步', 'success');
    closeSettings();
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  } finally {
    btn.textContent = orgText;
  }
}

window.addEventListener('DOMContentLoaded', () => {"""

if target_js in text:
    text = text.replace(target_js, js_injection)
    print("JS injected.")

with open("frontend/index.html", "w") as f:
    f.write(text)
