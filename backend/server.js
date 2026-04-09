require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const authRoutes = require('./routes/auth');
const vocabRoutes = require('./routes/vocab');
const studyRoutes = require('./routes/study');
const aiRoutes = require('./routes/ai');

const app = express();

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
app.use(express.json({ limit: '10kb' }));
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
