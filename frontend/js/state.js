/* ================= STATE ================= */
const state = { 
  currentLang: localStorage.getItem('appLang') || 'ja', // 新增：记住上次选择的语言
  user: null, 
  token: null, 
  pagination: { page: 1, totalPages: 1, limit: 20 }, 
  studyWords: [], 
  studyIndex: 0, 
  studyStats: { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 }, 
  studyStartTime: null, 
  selectedWordIds: new Set(), 
  currentPageWords: [], 
  originalTotal: 0, 
  isCramMode: false, 
  lastDueCount: 0, 
  pollingInterval: null, 
  notificationsEnabled: false, 
  coolingWords: [], 
  upcomingWords: [], 
  notifiedWordIds: new Set(), 
  localTimer: null, 
  notifySound: true, 
  notifyDesktop: true, 
  notifyVibrate: true,
  batchAbortController: null, // Bug 2: AI 批量请求中断控制器
  studyHistory: [], // Bug 3: 复习撤回历史栈
  sessionStats: { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 }, // 跨轮次累计统计
  sessionOriginalTotal: 0 // 整个会话（含冷却轮次）的初始总词量
};

/* ================= JAPANESE FUZZY SEARCH ================= */
const hiragana = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉっゃゅょ';
const katakana = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォッャュョ';
const romajiMap = {
  a:'あ',i:'い',u:'う',e:'え',o:'お',
  ka:'か',ki:'き',ku:'く',ke:'け',ko:'こ',sa:'さ',si:'し',shi:'し',su:'す',se:'せ',so:'そ',
  ta:'た',ti:'ち',chi:'ち',tu:'つ',tsu:'つ',te:'て',to:'と',
  na:'な',ni:'に',nu:'ぬ',ne:'ね',no:'の',
  ha:'は',hi:'ひ',fu:'ふ',he:'へ',ho:'ほ',
  ma:'ま',mi:'み',mu:'む',me:'め',mo:'も',
  ya:'や',yu:'ゆ',yo:'よ',ra:'ら',ri:'り',ru:'る',re:'れ',ro:'ろ',
  wa:'わ',wo:'を',n:'ん',
  ga:'が',gi:'ぎ',gu:'ぐ',ge:'げ',go:'ご',za:'ざ',zi:'じ',ji:'じ',zu:'ず',ze:'ぜ',zo:'ぞ',
  da:'だ',di:'ぢ',du:'づ',de:'で',do:'ど',
  ba:'ば',bi:'び',bu:'ぶ',be:'べ',bo:'ぼ',
  pa:'ぱ',pi:'ぴ',pu:'ぷ',pe:'ぺ',po:'ぽ',
  kya:'きゃ',kyu:'きゅ',kyo:'きょ',sha:'しゃ',shu:'しゅ',sho:'しょ',
  cha:'ちゃ',chu:'ちゅ',cho:'ちょ',nya:'にゃ',nyu:'にゅ',nyo:'にょ',
  hya:'ひゃ',hyu:'ひゅ',hyo:'ひょ',mya:'みゃ',myu:'みゅ',myo:'みょ',
  rya:'りゃ',ryu:'りゅ',ryo:'りょ',pya:'ぴゃ',pyu:'ぴゅ',pyo:'ぴょ',
  gya:'ぎゃ',gyu:'ぎゅ',gyo:'ぎょ',bya:'びゃ',byu:'びゅ',byo:'びょ',
};

function normalizeJapanese(text) {
  if (!text) return '';
  let result = '';
  // 全角转半角
  text = text.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  // 片假名 → 平假名
  for (let i = 0; i < text.length; i++) {
    const idx = katakana.indexOf(text[i]);
    result += idx !== -1 ? hiragana[idx] : text[i];
  }
  // 小写平假名 → 大写（促音前面的っ省略）
  result = result.replace(/っ([kstnhmyrw])/g, '$1');
  return result;
}

function romajiToHiragana(text) {
  text = text.toLowerCase().replace(/[^a-z]/g, '');
  let result = '', i = 0;
  while (i < text.length) {
    let matched = false;
    // 优先尝试3字符匹配
    if (i + 2 < text.length) {
      const triple = text[i] + text[i + 1] + text[i + 2];
      if (romajiMap[triple]) { result += romajiMap[triple]; i += 3; matched = true; }
    }
    if (!matched && i + 1 < text.length) {
      const double = text[i] + text[i + 1];
      if (romajiMap[double]) { result += romajiMap[double]; i += 2; matched = true; }
    }
    if (!matched) {
      if (romajiMap[text[i]]) { result += romajiMap[text[i]]; }
      else { result += text[i]; }
      i++;
    }
  }
  return result;
}

function fuzzyMatch(query, target, reading) {
  if (!query) return true;
  query = query.toLowerCase().trim();
  if (!query) return true;

  // 罗马字 → 平假名（用于和读音匹配）
  const queryHira = romajiToHiragana(query);
  // 拉丁化查询（用于和 meaning 匹配）
  const queryLower = query;

  // 1. reading（假名读音）精确包含
  if (reading) {
    const readingNorm = normalizeJapanese(reading.toLowerCase());
    if (readingNorm.includes(queryHira) || readingNorm === queryHira) return true;
    if (editDistance(normalizeJapanese(queryHira), readingNorm) <= 1) return true;
  }

  // 2. 汉字词直接包含（用户输入汉字）
  if (target) {
    const targetNorm = normalizeJapanese(target.toLowerCase());
    if (targetNorm.includes(queryHira) || targetNorm === queryHira) return true;
  }

  // 3. meaning 包含原文
  // (由调用方额外判断)

  return false;
}

function wordMatchesSearch(query, word) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (!q) return true;

  // 直接全文匹配
  if (word.japanese.toLowerCase().includes(q)) return true;
  if ((word.reading || '').toLowerCase().includes(q)) return true;
  if ((word.meaning || '').toLowerCase().includes(q)) return true;

  // 模糊匹配（罗马字/假名/输入错误）
  if (fuzzyMatch(q, word.japanese, word.reading)) return true;
  if (fuzzyMatch(q, word.meaning, null)) return true;

  return false;
}

function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}


/* ================= USER PROFILE ================= */
let tempAvatarBase64 = ''; // 暂存选中的头像

// 1. 抽离出一个渲染用户信息的通用函数
function renderUserInfo() {
  if (!state.user) return;
  const uname = state.user.username;
  const firstLetter = uname.charAt(0).toUpperCase();
  const avatarUrl = state.user.avatar || '';
  const signature = state.user.signature || '保持纯粹，专注语言。';

  // 渲染文字
  const welcomeUser = document.getElementById('welcomeUser');
  if (welcomeUser) welcomeUser.textContent = uname;
  
  const dropdownUsername = document.getElementById('dropdownUsername');
  if (dropdownUsername) dropdownUsername.textContent = uname;

  if (document.getElementById('dropdownSignature')) {
    document.getElementById('dropdownSignature').textContent = signature;
  }
  if (document.getElementById('signatureInput')) {
    document.getElementById('signatureInput').value = signature;
  }

  // 渲染头像（导航栏、下拉菜单、编辑弹窗）
  const letterIds = ['navAvatarLetter', 'dropdownAvatarLetter', 'previewAvatarLetter'];
  const imgIds = ['navAvatarImg', 'dropdownAvatarImg', 'previewAvatarImg'];

  if (avatarUrl) {
    letterIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    imgIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.src = avatarUrl; el.classList.remove('hidden'); }
    });
    tempAvatarBase64 = avatarUrl;
  } else {
    imgIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    letterIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = firstLetter; el.classList.remove('hidden'); }
    });
    tempAvatarBase64 = '';
  }
}

// 2. 处理图片选择与 Base64 转换
function handleAvatarSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // 限制图片大小 (2MB)
  if (file.size > 2 * 1024 * 1024) {
    return showToast('图片太大啦，请选择 2MB 以下的图片', 'error');
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    tempAvatarBase64 = e.target.result;
    const previewImg = document.getElementById('previewAvatarImg');
    if (previewImg) {
      previewImg.src = tempAvatarBase64;
      previewImg.classList.remove('hidden');
    }
    const previewLetter = document.getElementById('previewAvatarLetter');
    if (previewLetter) previewLetter.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

// 3. 提交资料修改
document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('saveProfileBtn');
  const orgText = btn.textContent;
  btn.textContent = '保存中...';
  btn.disabled = true;

  const signature = document.getElementById('signatureInput').value.trim();

  try {
    const updatedUser = await api('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ 
        avatar: tempAvatarBase64, 
        signature: signature 
      })
    });

    // 更新本地状态
    state.user = updatedUser;
    localStorage.setItem('user', JSON.stringify(updatedUser));
    
    // 重新渲染UI
    renderUserInfo();
    showToast('个人资料已更新', 'success');
    closeModal('profileModal');
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  } finally {
    btn.textContent = orgText;
    btn.disabled = false;
  }
});

