const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // --- 新增：语种字段 ---
  language: {
    type: String,
    enum: ['ja', 'en'],
    default: 'ja'
  },
  // ----------------------
  japanese: { // 保持此字段名不变，英语也存在这里
    type: String,
    required: true,
    trim: true
  },
  reading: {
    type: String,
    trim: true
  },
  meaning: {
    type: String,
    required: true,
    trim: true
  },
  partOfSpeech: {
    type: String,
    // 修改：扩充英语词性
    enum: ['名词', '动词', '形容词', '副词', '助词', '连词', '感叹词', '代词', '数词', '接尾词', '接头词', '介词', '冠词', '其他'],
    default: '名词'
  },
  tags: [{
    type: String,
    trim: true
  }],
  // FSRS Card 字段
  due: {
    type: Date,
    default: Date.now
  },
  stability: {
    type: Number,
    default: 0
  },
  difficulty: {
    type: Number,
    default: 0
  },
  elapsed_days: {
    type: Number,
    default: 0
  },
  scheduled_days: {
    type: Number,
    default: 0
  },
  learning_steps: {
    type: Number,
    default: 0
  },
  reps: {
    type: Number,
    default: 0
  },
  lapses: {
    type: Number,
    default: 0
  },
  state: {
    type: Number,
    default: 0 // 0=New, 1=Learning, 2=Review, 3=Relearning
  },
  last_review: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

wordSchema.index({ userId: 1, language: 1, japanese: 1 });
wordSchema.index({ userId: 1, language: 1, due: 1 }); // 加入 language
wordSchema.index({ userId: 1, language: 1, state: 1, due: 1 }); // 加入 language

const Word = mongoose.model('Word', wordSchema);

// 👇 新增这一行：强制同步并重建数据库真实索引
Word.syncIndexes().then(() => console.log('Word 表索引已强制同步！'));

module.exports = Word;
