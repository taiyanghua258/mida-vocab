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
    const language = req.query.language || 'ja';
    const user = await User.findById(req.userId).select('fsrsSettings');
    // 【修改】：根据当前语种加载上限
    const dailyNewLimit = language === 'en' 
      ? (user?.fsrsSettings?.dailyNewLimitEn ?? 20) 
      : (user?.fsrsSettings?.dailyNewLimitJa ?? 20);

    // 性能隐患修复：加入 limit(100) 拦截超大数组，实现单次会话的"分页打断"
    const reviewWords = await Word.find({
      userId: req.userId,
      language,
      state: { $ne: 0 },
      due: { $lte: now }
    }).sort({ due: 1 }).limit(100);

    let newWords = [];

    // 时区修复：使用 dayjs 获取严格意义上的"本地今日凌晨"
    const todayStart = dayjs().tz(TIMEZONE).startOf('day').toDate();
    const tomorrowStart = dayjs(todayStart).add(1, 'day').toDate();

    const todayNewReviews = await ReviewLog.countDocuments({
      userId: req.userId,
      language, // 隔离每日新词上限
      reviewDate: { $gte: todayStart, $lt: tomorrowStart },
      state: 0
    });

    const remainingNew = Math.max(0, dailyNewLimit - todayNewReviews);

    // 无论是否达到 50 的阈值，先预留出今日配额保护的单词 ID
    const quotaNewWords = await Word.find({
      userId: req.userId,
      language,
      state: 0,
      due: { $lte: now }
    }).sort({ createdAt: 1 }).limit(remainingNew).select('_id');

    const quotaIds = quotaNewWords.map(w => w._id);

    // 完全遵从用户设置的新词配额，不再被复习量强行拦截
    if (remainingNew > 0) {
      newWords = await Word.find({ _id: { $in: quotaIds } }).sort({ createdAt: 1 });
    }

    // 推迟的只是"配额之外"的词
    await Word.updateMany({
      userId: req.userId,
      language,
      state: 0,
      due: { $lte: now },
      _id: { $nin: quotaIds }
    }, { $set: { due: tomorrowStart } });

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
      language: word.language, // 继承被复习单词的语种
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
    const language = req.query.language || 'ja';
    // 时区修复：统一日切线
    const todayStart = dayjs().tz(TIMEZONE).startOf('day').toDate();
    const tomorrowStart = dayjs(todayStart).add(1, 'day').toDate();

    const totalWords = await Word.countDocuments({ userId: req.userId, language });

    // 1. 查找必须复习的旧词
    const dueReviewCount = await Word.countDocuments({
      userId: req.userId,
      language,
      state: { $ne: 0 },
      due: { $lte: now }
    });

    // 2. 查找还没背过且今日到期的新词（与 getDueWords 查询条件完全一致）
    const dueNewWords = await Word.countDocuments({
      userId: req.userId,
      language,
      state: 0,
      due: { $lte: now }
    });

    // 3. 计算今天还剩下的新词额度
    const todayNewReviews = await ReviewLog.countDocuments({
      userId: req.userId,
      language,
      reviewDate: { $gte: todayStart, $lt: tomorrowStart },
      state: 0
    });

    const user = await User.findById(req.userId).select('fsrsSettings');
    // 【修改】：根据当前语种加载上限
    const dailyNewLimit = language === 'en' 
      ? (user?.fsrsSettings?.dailyNewLimitEn ?? 20) 
      : (user?.fsrsSettings?.dailyNewLimitJa ?? 20);
    const remainingNew = Math.max(0, dailyNewLimit - todayNewReviews);

    // 真实待复习总数 = 旧词 + min(剩余额度, 今日到期新词)
    const dueWords = dueReviewCount + Math.min(remainingNew, dueNewWords);

    const learningWords = await Word.countDocuments({
      userId: req.userId,
      language,
      state: { $in: [1, 3] }
    });
    const reviewWords = await Word.countDocuments({
      userId: req.userId,
      language,
      state: 2
    });
    const masteredWords = await Word.countDocuments({
      userId: req.userId,
      language,
      state: 2,
      reps: { $gte: 5 }
    });
    const todayReviews = await ReviewLog.countDocuments({
      userId: req.userId,
      language,
      reviewDate: { $gte: todayStart, $lt: tomorrowStart }
    });

    // 提前抓取未来1小时内即将冷却完毕的单词
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const upcomingWords = await Word.find({
      userId: req.userId,
      language,
      state: { $ne: 0 },
      due: { $gt: now, $lte: oneHourLater }
    }).select('_id due').sort({ due: 1 }).lean();

    res.json({
      totalWords,
      dueWords,
      newWords: dueNewWords,
      learningWords,
      reviewWords,
      masteredWords,
      todayReviews,
      upcomingWords
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
