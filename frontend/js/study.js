const API_BASE = '/api';
let words = [];
let currentIndex = 0;
let startTime = null;
let reviewedCount = 0;
let againCount = 0;
let hardCount = 0;
let goodCount = 0;
let easyCount = 0;

function getToken() {
  return localStorage.getItem('token');
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-auth-token': getToken(),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    removeToken();
    localStorage.removeItem('user');
    window.location.href = 'index.html';
    throw new Error('Session expired');
  }

  if (!response.ok) {
    throw new Error(response.statusText);
  }
  return response.json();
}

function removeToken() {
  localStorage.removeItem('token');
}

async function loadDueWords() {
  try {
    words = await api('/study/due');
    if (!Array.isArray(words) || words.length === 0) {
      document.getElementById('studyCard').style.display = 'none';
      document.getElementById('noWords').style.display = 'block';
    } else {
      showWord();
    }
  } catch (err) {
    console.error('Failed to load words:', err);
    alert('加载单词失败');
  }
}

function showWord() {
  const word = words[currentIndex];
  document.getElementById('studyWord').textContent = word.japanese;
  document.getElementById('studyReading').textContent = word.reading || '';
  document.getElementById('studyMeaning').textContent = word.meaning;
  document.getElementById('showAnswerBtn').style.display = 'inline-block';
  document.getElementById('answerSection').style.display = 'none';

  // 重置间隔显示
  document.getElementById('intervalAgain').textContent = '';
  document.getElementById('intervalHard').textContent = '';
  document.getElementById('intervalGood').textContent = '';
  document.getElementById('intervalEasy').textContent = '';

  startTime = Date.now();
  updateProgress();
}

async function showAnswer() {
  document.getElementById('showAnswerBtn').style.display = 'none';
  document.getElementById('answerSection').style.display = 'block';

  // 获取调度预览
  try {
    const word = words[currentIndex];
    const info = await api(`/study/scheduling?wordId=${word._id}`);
    document.getElementById('intervalAgain').textContent = info.again ? info.again.interval : '';
    document.getElementById('intervalHard').textContent = info.hard ? info.hard.interval : '';
    document.getElementById('intervalGood').textContent = info.good ? info.good.interval : '';
    document.getElementById('intervalEasy').textContent = info.easy ? info.easy.interval : '';
  } catch (err) {
    console.error('Failed to load scheduling info:', err);
  }
}

function updateProgress() {
  const total = words.length;
  const progress = ((currentIndex) / total) * 100;
  document.getElementById('progressFill').style.width = `${progress}%`;
  document.getElementById('progressText').textContent = `${currentIndex + 1} / ${total}`;
}

async function submitReview(result) {
  const word = words[currentIndex];
  const responseTime = Date.now() - startTime;

  try {
    const data = await api('/study/review', {
      method: 'POST',
      body: JSON.stringify({
        wordId: word._id,
        result,
        responseTime
      })
    });

    reviewedCount++;
    switch (result) {
      case 'again': againCount++; break;
      case 'hard': hardCount++; break;
      case 'good': goodCount++; break;
      case 'easy': easyCount++; break;
    }

    // "again" 的单词重新加入队列末尾
    if (result === 'again') {
      words.push({ ...word, _reviewInterval: data.interval });
    }

    currentIndex++;

    if (currentIndex >= words.length) {
      showComplete();
    } else {
      showWord();
    }
  } catch (err) {
    console.error('Failed to submit review:', err);
    alert('提交失败');
  }
}

function showComplete() {
  document.getElementById('progressFill').style.width = '100%';
  document.getElementById('progressText').textContent = `${words.length} / ${words.length}`;
  document.getElementById('studyCard').style.display = 'none';
  document.getElementById('studyComplete').style.display = 'block';

  document.getElementById('completeStats').innerHTML = `
    <p>本次复习：${reviewedCount} 个单词</p>
    <p>Again: ${againCount} | Hard: ${hardCount} | Good: ${goodCount} | Easy: ${easyCount}</p>
  `;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  loadDueWords();
});
