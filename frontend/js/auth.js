const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

function getCurrentUser() {
  const user = localStorage.getItem('user');
  if (!user) return null;
  try {
    return JSON.parse(user);
  } catch (e) {
    console.error('Failed to parse user data:', e);
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

async function handleResponse(response) {
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
    throw new Error('Session expired');
  }
  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (e) {
      // 无法解析错误响应，使用默认消息
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

async function register(username, email, password) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  return handleResponse(response);
}

async function login(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return handleResponse(response);
}

async function getMe() {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: { 'x-auth-token': getToken() }
  });
  return handleResponse(response);
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function redirectIfLoggedIn() {
  if (getToken()) {
    window.location.href = 'dashboard.html';
    return true;
  }
  return false;
}

// Login Form Handler
if (document.getElementById('loginForm')) {
  if (redirectIfLoggedIn()) {
    // Already logged in, redirect
  } else {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        const data = await login(email, password);
        setToken(data.token);
        setCurrentUser(data.user);
        window.location.href = 'dashboard.html';
      } catch (err) {
        alert('登录失败：' + (err.message || '请检查邮箱和密码'));
      }
    });
  }
}

// Register Form Handler
if (document.getElementById('registerForm')) {
  if (redirectIfLoggedIn()) {
    // Already logged in, redirect
  } else {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('regUsername').value;
      const password = document.getElementById('regPassword').value;
      const confirmPassword = document.getElementById('regConfirmPassword').value;

      if (password !== confirmPassword) {
        alert('两次输入的密码不一致');
        return;
      }

      if (password.length < 6) {
        alert('密码长度至少为6位');
        return;
      }

      try {
        const data = await register(username, email, password);
        setToken(data.token);
        setCurrentUser(data.user);
        window.location.href = 'dashboard.html';
      } catch (err) {
        alert('注册失败：' + (err.message || '用户名或邮箱可能已被使用'));
      }
    });
  }
}

// Logout Button
if (document.getElementById('logoutBtn')) {
  document.getElementById('logoutBtn').addEventListener('click', logout);
}
