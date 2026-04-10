const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// 新增下面这两行引入
const Word = require('../models/Word');
const ReviewLog = require('../models/ReviewLog');

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Please provide username and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user._id, username, email }
    });
  } catch (err) {
    console.error('Register error:', err.message, err.code);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Please provide username and password' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('fsrsSettings');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.fsrsSettings || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const allowedFields = ['requestRetention', 'maximumInterval', 'learningSteps', 'enableFuzz', 'dailyNewLimitJa', 'dailyNewLimitEn'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[`fsrsSettings.${field}`] = req.body[field];
      }
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('fsrsSettings');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.fsrsSettings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { username } = req.params;
    
    // 1. 获取当前发请求的用户
    const user = await User.findById(req.userId);
    
    // 2. 权限校验：只能删除自己（校验 token 中的 userId 对应的用户名，是否和 params 请求的用户名一致）
    if (!user || user.username !== username) {
      return res.status(403).json({ message: 'Forbidden: 越权操作，只能删除自己的账号' });
    }

    // 3. 级联删除相关的单词和复习日志，防止产生幽灵数据占用服务器存储
    await Word.deleteMany({ userId: user._id });
    await ReviewLog.deleteMany({ userId: user._id });

    // 4. 最后删除用户本身
    await User.findByIdAndDelete(user._id);

    res.json({ message: `用户 ${username} 及其所有词库数据已彻底删除` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
