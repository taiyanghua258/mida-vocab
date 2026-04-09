const Word = require('../models/Word');
const ReviewLog = require('../models/ReviewLog');
const User = require('../models/User');
const { createEmptyCard, fsrs, generatorParameters, Rating, State } = require('ts-fsrs');

// 引入 dayjs 抹平服务器时区差异
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

// 设定基准时区（可按需修改，或后续让前端传参）
const TIMEZONE = "Asia/Shanghai";

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
    const user = await User.findById(req.userId).select('fsrsSettings');
    const dailyNewLimit = user?.fsrsSettings?.dailyNewLimit ?? 20;

    // 性能隐患修复：加入 limit(100) 拦截超大数组，实现单次会话的"分页打断"
    const reviewWords = await Word.find({
      userId: req.userId,
      state: { $ne: 0 },
      due: { $lte: now }
    }).sort({ due: 1 }).limit(100);

    let newWords = [];

    // 时区修复：使用 dayjs 获取严格意义上的"本地今日凌晨"
    const todayStart = dayjs().tz(TIMEZONE).startOf('day').toDate();

    const todayNewReviews = await ReviewLog.countDocuments({
      userId: req.userId,
      reviewDate: { $gte: todayStart },
      state: 0
    });

    const remainingNew = Math.max(0, dailyNewLimit - todayNewReviews);

    // 复习优先原则：只有当本次取出的待复习单词量小于一定阈值（如50）时，才塞入新词
    if (reviewWords.length < 50 && remainingNew > 0) {
      newWords = await Word.find({
        userId: req.userId,
        state: 0,
        due: { $lte: now }
      }).sort({ createdAt: 1 }).limit(remainingNew);
    }

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

    // 时区修复：如果是长线复习(>=1天)，使用 dayjs 对齐到本地时区的 00:00:00
    if (newCard.scheduled_days >= 1) {
      const alignedDue = dayjs(newCard.due).tz(TIMEZONE).startOf('day').toDate();
      newCard.due = alignedDue;
    }

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
    // 时区修复：统一日切线
    const todayStart = dayjs().tz(TIMEZONE).startOf('day').toDate();
    const tomorrowStart = dayjs(todayStart).add(1, 'day').toDate();

    const totalWords = await Word.countDocuments({ userId: req.userId });

    // 1. 查找必须复习的旧词
    const dueReviewCount = await Word.countDocuments({
      userId: req.userId,
      state: { $ne: 0 },
      due: { $lte: now }
    });

    // 2. 查找还没背过的新词
    const newWordsCount = await Word.countDocuments({
      userId: req.userId,
      state: 0
    });

    // 3. 计算今天还剩下的新词额度
    const todayNewReviews = await ReviewLog.countDocuments({
      userId: req.userId,
      reviewDate: { $gte: todayStart, $lt: tomorrowStart },
      state: 0
    });

    const user = await User.findById(req.userId).select('fsrsSettings');
    const dailyNewLimit = user?.fsrsSettings?.dailyNewLimit ?? 20;
    const remainingNew = Math.max(0, dailyNewLimit - todayNewReviews);

    // 真实待复习总数 = 旧词 + min(剩余额度, 待背新词总数)
    const dueWords = dueReviewCount + Math.min(remainingNew, newWordsCount);

    const learningWords = await Word.countDocuments({
      userId: req.userId,
      state: { $in: [1, 3] }
    });
    const reviewWords = await Word.countDocuments({
      userId: req.userId,
      state: 2
    });
    const masteredWords = await Word.countDocuments({
      userId: req.userId,
      state: 2,
      reps: { $gte: 5 }
    });
    const todayReviews = await ReviewLog.countDocuments({
      userId: req.userId,
      reviewDate: { $gte: todayStart, $lt: tomorrowStart }
    });

    res.json({
      totalWords,
      dueWords,
      newWords: newWordsCount,
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
