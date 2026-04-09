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
  dailyNewLimit: {
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
  fsrsSettings: {
    type: fsrsSettingsSchema,
    default: () => ({})
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
