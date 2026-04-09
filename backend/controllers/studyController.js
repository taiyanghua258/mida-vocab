const Word = require('../models/Word');
const ReviewLog = require('../models/ReviewLog');
const User = require('../models/User');
const { createEmptyCard, fsrs, generatorParameters, Rating, State } = require('ts-fsrs');

const RESULT_TO_RATING = {
  'again': Rating.Again,
  'hard': Rating.Hard,
  'good': Rating.Good,
  'easy': Rating.Easy
};

async function getUserScheduler(userId) {
  const user = await User.findById(userId).select('fsrsSettings');
  const settings = user?.fsrsSettings || {};
  
  // ts-fsrs expects StepUnit (e.g. ['1m', '10m']) rather than raw numbers.
  let formattedSteps = ['1m', '10m'];
  if (settings.learningSteps && settings.learningSteps.length > 0) {
    formattedSteps = settings.learningSteps.map(s => `${s}m`);
  }

  return fsrs(generatorParameters({
    request_retention: settings.requestRetention ?? 0.9,
    maximum_interval: settings.maximumInterval ?? 365,
    learning_steps: formattedSteps,
    enable_fuzz: settings.enableFuzz ?? true
  }));
}

function wordToCard(word) {
  return {
    due: word.due || new Date(),
    stability: word.stability || 0,
    difficulty: word.difficulty || 0,
    elapsed_days: word.elapsed_days || 0,
    scheduled_days: word.scheduled_days || 0,
    reps: word.reps || 0,
    lapses: word.lapses || 0,
    learning_steps: word.learning_steps || 0,
    state: word.state != null ? word.state : State.New,
    last_review: word.last_review || undefined
  };
}

function formatInterval(dueDate, now) {
  const diffMs = dueDate.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}分钟后`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours}小时后`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}天后`;
}

exports.getDueWords = async (req, res) => {
  try {
    const now = new Date();

    // 【关键修复 1】：设定"逻辑跨日"边界为今天的 23:59:59。
    // 这样昨晚 11 点背的词（系统显示 1 天后复习，即明晚 11 点），第二天早上 8 点起床打开软件时，
    // 因为明晚 11 点 <= 明天 23:59:59，它就会乖乖出现在待复习列表里了！
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // 获取用户设置
    const user = await User.findById(req.userId).select('fsrsSettings');
    const dailyNewLimit = user?.fsrsSettings?.dailyNewLimit ?? 20;

    // 【关键修复 2】：获取【所有】已学习且到期的老词。
    // 移除 limit(20) 限制，使用 endOfToday 作为判定标准。
    const reviewWords = await Word.find({
      userId: req.userId,
      state: { $ne: 0 },
      due: { $lte: endOfToday }
    }).sort({ due: 1 });

    // 【关键修复 3】：新词配额独立计算，彻底与老词数量解绑
    let newWords = [];

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayNewReviews = await ReviewLog.countDocuments({
      userId: req.userId,
      reviewDate: { $gte: todayStart },
      state: 0
    });

    const remainingNew = Math.max(0, dailyNewLimit - todayNewReviews);

    if (remainingNew > 0) {
      newWords = await Word.find({
        userId: req.userId,
        state: 0,
        due: { $lte: endOfToday }
      }).sort({ createdAt: 1 }).limit(remainingNew); // 取满今天剩余的新词额度
    }

    // 合并返回 (老词 + 独立配额的新词)，移除 .slice(0, 20)
    const words = [...reviewWords, ...newWords];
    res.json(words);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSchedulingInfo = async (req, res) => {
  try {
    const { wordId } = req.query;
    if (!wordId) {
      return res.status(400).json({ message: 'wordId is required' });
    }

    const word = await Word.findOne({ _id: wordId, userId: req.userId });
    if (!word) {
      return res.status(404).json({ message: 'Word not found' });
    }

    const f = await getUserScheduler(req.userId);
    const card = wordToCard(word);
    const now = new Date();
    const schedulingCards = f.repeat(card, now);

    const info = {};
    for (const [ratingKey, recordLog] of Object.entries(schedulingCards)) {
      const ratingName = Rating[ratingKey].toLowerCase();
      info[ratingName] = {
        interval: formatInterval(recordLog.card.due, now),
        scheduled_days: recordLog.card.scheduled_days
      };
    }

    res.json(info);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.reviewWord = async (req, res) => {
  try {
    const { wordId, result, responseTime } = req.body;

    const validResults = ['again', 'hard', 'good', 'easy'];
    if (!wordId || !validResults.includes(result)) {
      return res.status(400).json({ message: 'Invalid wordId or result' });
    }

    const word = await Word.findOne({ _id: wordId, userId: req.userId });
    if (!word) {
      return res.status(404).json({ message: 'Word not found' });
    }

    const f = await getUserScheduler(req.userId);
    const card = wordToCard(word);
    const now = new Date();
    const schedulingCards = f.repeat(card, now);
    const rating = RESULT_TO_RATING[result];
    const chosen = schedulingCards[rating];

    const newCard = chosen.card;
    const log = chosen.log;

    word.due = newCard.due;
    word.stability = newCard.stability;
    word.difficulty = newCard.difficulty;
    word.elapsed_days = newCard.elapsed_days;
    word.scheduled_days = newCard.scheduled_days;
    word.learning_steps = newCard.learning_steps;
    word.reps = newCard.reps;
    word.lapses = newCard.lapses;
    word.state = newCard.state;
    word.last_review = newCard.last_review;
    await word.save();

    const reviewLog = new ReviewLog({
      userId: req.userId,
      wordId,
      reviewDate: now,
      result,
      responseTime: responseTime || 0,
      rating,
      state: log.state,
      prevStability: log.stability,
      prevDifficulty: log.difficulty,
      elapsed_days: log.elapsed_days,
      scheduled_days: log.scheduled_days
    });
    await reviewLog.save();

    res.json({
      wordId,
      due: newCard.due,
      scheduled_days: newCard.scheduled_days,
      state: newCard.state,
      reps: newCard.reps,
      stability: newCard.stability,
      difficulty: newCard.difficulty,
      interval: formatInterval(newCard.due, now)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const totalWords = await Word.countDocuments({ userId: req.userId });
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const dueWords = await Word.countDocuments({
      userId: req.userId,
      due: { $lte: endOfToday } // <--- 同步使用逻辑跨日时间
    });
    const newWords = await Word.countDocuments({
      userId: req.userId,
      state: 0 // New
    });
    const learningWords = await Word.countDocuments({
      userId: req.userId,
      state: { $in: [1, 3] } // Learning, Relearning
    });
    const reviewWords = await Word.countDocuments({
      userId: req.userId,
      state: 2 // Review
    });
    const masteredWords = await Word.countDocuments({
      userId: req.userId,
      state: 2,
      reps: { $gte: 5 }
    });

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayReviews = await ReviewLog.countDocuments({
      userId: req.userId,
      reviewDate: { $gte: todayStart, $lt: tomorrow }
    });

    res.json({
      totalWords,
      dueWords,
      newWords,
      learningWords,
      reviewWords,
      masteredWords,
      todayReviews
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
