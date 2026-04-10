// 优先加载根目录 .env，若不存在则 fallback 到 backend/.env
const _path = require('path');
const _dotenvResult = require('dotenv').config({ path: _path.resolve(__dirname, '../.env') });
if (_dotenvResult.error) {
  require('dotenv').config(); // fallback: 加载当前目录 (backend/) 下的 .env
}
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const authRoutes = require('./routes/auth');
const vocabRoutes = require('./routes/vocab');
const studyRoutes = require('./routes/study');
const aiRoutes = require('./routes/ai');

const app = express();
app.set('trust proxy', 1); // 信任 Nginx 代理，获取真实客户端 IP

// 启动时清理 uploads 临时目录，防止上次崩溃残留的文件占用磁盘
const uploadsDir = path.join(__dirname, 'uploads');
const fs = require('fs');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
} else {
  const staleFiles = fs.readdirSync(uploadsDir);
  if (staleFiles.length > 0) {
    staleFiles.forEach(f => {
      try { fs.unlinkSync(path.join(uploadsDir, f)); } catch (e) { /* ignore */ }
    });
    console.log(`Cleaned ${staleFiles.length} stale file(s) from uploads/`);
  }
}

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

if (!process.env.CORS_ORIGIN) {
  console.warn('WARNING: CORS_ORIGIN not set, defaulting to * (allow all origins)');
}

// Middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/my-vocab', {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/words', vocabRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/ai', aiRoutes);

// Root route - serve frontend index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (IPv4)`);
});
