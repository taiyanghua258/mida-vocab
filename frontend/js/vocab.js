const API_BASE = 'http://localhost:3001/api';
let currentPage = 1;
let totalPages = 1;
let editingWordId = null;

function getToken() {
  return localStorage.getItem('token');
}

function removeToken() {
  localStorage.removeItem('token');
}

function getCurrentUser() {
  const user = localStorage.getItem('user');
  if (!user) return null;
  try {
    return JSON.parse(user);
  } catch (e) {
    return null;
  }
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

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);

  if (targetDate <= today) {
    return '<span class="due">待复习</span>';
  }
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

async function loadStats() {
  try {
    const data = await api('/study/stats');
    document.getElementById('totalWords').textContent = data.totalWords;
    document.getElementById('dueWords').textContent = data.dueWords;
    document.getElementById('masteredWords').textContent = data.masteredWords;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

async function loadWords(page = 1) {
  currentPage = page;
  const search = document.getElementById('searchInput').value;
  const partOfSpeech = document.getElementById('partOfSpeechFilter').value;

  try {
    let endpoint = `/words?page=${page}&limit=50`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    if (partOfSpeech) endpoint += `&partOfSpeech=${encodeURIComponent(partOfSpeech)}`;

    const data = await api(endpoint);
    totalPages = data.pages;
    renderWordList(data.words);
    renderPagination();
  } catch (err) {
    console.error('Failed to load words:', err);
  }
}

function renderWordList(words) {
  const tbody = document.getElementById('wordTableBody');

  if (words.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">暂无单词，添加一个吧</td></tr>';
    return;
  }

  tbody.innerHTML = words.map(word => `
    <tr>
      <td>${word.japanese}</td>
      <td>${word.reading || '-'}</td>
      <td>${word.meaning}</td>
      <td>${word.partOfSpeech}</td>
      <td>${(word.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}</td>
      <td class="next-review">${formatDate(word.due)}</td>
      <td class="actions">
        <button class="btn btn-secondary" onclick="editWord('${word._id}')">编辑</button>
        <button class="btn btn-danger" onclick="deleteWord('${word._id}')">删除</button>
      </td>
    </tr>
  `).join('');
}

function renderPagination() {
  const pagination = document.getElementById('pagination');
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" onclick="loadWords(${i})">${i}</button>`;
  }
  pagination.innerHTML = html;
}

// Modal Functions
function openModal() {
  document.getElementById('wordModal').classList.add('active');
  document.getElementById('modalTitle').textContent = '添加单词';
  document.getElementById('wordForm').reset();
  editingWordId = null;
  document.getElementById('wordId').value = '';
}

function closeModal() {
  document.getElementById('wordModal').classList.remove('active');
  editingWordId = null;
}

async function editWord(id) {
  try {
    const data = await api(`/words/${id}`);
    const word = data;

    editingWordId = id;
    document.getElementById('modalTitle').textContent = '编辑单词';
    document.getElementById('wordId').value = id;
    document.getElementById('japanese').value = word.japanese;
    document.getElementById('reading').value = word.reading || '';
    document.getElementById('meaning').value = word.meaning;
    document.getElementById('partOfSpeech').value = word.partOfSpeech;
    document.getElementById('tags').value = (word.tags || []).join(', ');

    document.getElementById('wordModal').classList.add('active');
  } catch (err) {
    alert('加载单词失败');
  }
}

async function deleteWord(id) {
  if (!confirm('确定要删除这个单词吗？')) return;

  try {
    await api(`/words/${id}`, { method: 'DELETE' });
    loadWords(currentPage);
    loadStats();
  } catch (err) {
    alert('删除失败');
  }
}

async function saveWord(e) {
  e.preventDefault();

  const wordData = {
    japanese: document.getElementById('japanese').value,
    reading: document.getElementById('reading').value,
    meaning: document.getElementById('meaning').value,
    partOfSpeech: document.getElementById('partOfSpeech').value,
    tags: document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t)
  };

  try {
    if (editingWordId) {
      await api(`/words/${editingWordId}`, {
        method: 'PUT',
        body: JSON.stringify(wordData)
      });
    } else {
      await api('/words', {
        method: 'POST',
        body: JSON.stringify(wordData)
      });
    }
    closeModal();
    loadWords(currentPage);
    loadStats();
  } catch (err) {
    alert('保存失败');
  }
}

// Import/Export Functions
function openImportModal() {
  document.getElementById('importModal').classList.add('active');
  document.getElementById('importData').value = '';
}

function closeImportModal() {
  document.getElementById('importModal').classList.remove('active');
}

async function importWords() {
  const importData = document.getElementById('importData').value.trim();
  if (!importData) {
    alert('请输入要导入的数据');
    return;
  }

  try {
    let words;
    try {
      words = JSON.parse(importData);
    } catch {
      alert('JSON 格式错误');
      return;
    }

    if (!Array.isArray(words)) {
      words = [words];
    }

    const result = await api('/words/import', {
      method: 'POST',
      body: JSON.stringify({ words })
    });

    alert(`成功导入 ${result.count} 个单词`);
    closeImportModal();
    loadWords(1);
    loadStats();
  } catch (err) {
    alert('导入失败');
  }
}

async function exportWords() {
  try {
    const data = await api('/words/export?format=json');
    const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-vocab-words.json';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('导出失败');
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;

  const user = getCurrentUser();
  if (user) {
    document.getElementById('welcomeUser').textContent = `欢迎，${user.username}`;
  }

  loadWords(1);
  loadStats();

  document.getElementById('addWordBtn').addEventListener('click', openModal);
  document.getElementById('wordForm').addEventListener('submit', saveWord);
  document.getElementById('searchInput').addEventListener('input', () => loadWords(1));
  document.getElementById('partOfSpeechFilter').addEventListener('change', () => loadWords(1));
  document.getElementById('importBtn').addEventListener('click', openImportModal);
  document.getElementById('exportBtn').addEventListener('click', exportWords);
  document.getElementById('startStudyBtn').addEventListener('click', () => {
    window.location.href = 'study.html';
  });
});
