const mongoose = require('mongoose');

const fsrsSettingsSchema = new mongoose.Schema({
  requestRetention: {
    type: Number,
    default: 0.9,
    min: 0.7,
    max: 0.99
  },
  maximumInterval: {
    type: Number,
    default: 365,
    min: 7,
    max: 36500
  },
  learningSteps: {
    type: [Number],
    default: [1, 10]
  },
  enableFuzz: {
    type: Boolean,
    default: true
  },
  // 【修改】：废弃原本统一的 dailyNewLimit，拆分成日/英两个字段
  dailyNewLimitJa: {
    type: Number,
    default: 20,
    min: 1,
    max: 200
  },
  dailyNewLimitEn: {
    type: Number,
    default: 20,
    min: 1,
    max: 200
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: false,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: '' // 留空代表使用默认的首字母头像
  },
  signature: {
    type: String,
    default: '保持纯粹，专注语言。', // 默认签名
    maxLength: 50 // 限制一下长度
  },
  fsrsSettings: {
    type: fsrsSettingsSchema,
    default: () => ({})
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
