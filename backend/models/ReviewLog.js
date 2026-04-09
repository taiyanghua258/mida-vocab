const mongoose = require('mongoose');

const reviewLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  wordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Word',
    required: true
  },
  reviewDate: {
    type: Date,
    default: Date.now
  },
  result: {
    type: String,
    enum: ['again', 'hard', 'good', 'easy'],
    required: true
  },
  responseTime: {
    type: Number,
    default: 0
  },
  // FSRS 日志字段
  rating: {
    type: Number,
    min: 1,
    max: 4
  },
  state: {
    type: Number
  },
  prevStability: {
    type: Number
  },
  prevDifficulty: {
    type: Number
  },
  elapsed_days: {
    type: Number
  },
  scheduled_days: {
    type: Number
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ReviewLog', reviewLogSchema);
