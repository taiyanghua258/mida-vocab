const mongoose = require('mongoose');
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
  let state = word.state != null ? word.state : State.New;
  let last_review = word.last_review ? new Date(word.last_review) : undefined;

  // 修复 ts-fsrs 5.x 严格校验报错: "last_review is required when state is not New"
  if (state !== State.New && !last_review) {
    last_review = word.due ? new Date(word.due) : new Date();
  }

  return {
    due: word.due ? new Date(word.due) : new Date(),
    stability: word.stability ?? 0,
    difficulty: word.difficulty ?? 0,
    elapsed_days: word.elapsed_days || 0,
    scheduled_days: word.scheduled_days || 0,
    reps: word.reps || 0,
    lapses: word.lapses || 0,
    learning_steps: word.learning_steps || 0,
    state: state,
    last_review: last_review
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
    const dailyNewLimit = language === 'en' 
      ? (user?.fsrsSettings?.dailyNewLimitEn ?? 20) 
      : (user?.fsrsSettings?.dailyNewLimitJa ?? 20);

    const reviewWords = await Word.find({
      userId: req.userId,
      language,
      state: { $ne: 0 },
      due: { $lte: now }
    }).sort({ due: 1 }).limit(100);

    let newWords = [];

    const todayStart = dayjs().tz(TIMEZONE).startOf('day').toDate();
    const tomorrowStart = dayjs(todayStart).add(1, 'day').toDate();

    const todayNewReviews = await ReviewLog.countDocuments({
      userId: req.userId,
      language,
      reviewDate: { $gte: todayStart, $lt: tomorrowStart },
      state: 0
    });

    const remainingNew = Math.max(0, dailyNewLimit - todayNewReviews);

    // 【核心修复】：防止 remainingNew 为 0 时触发 Mongoose 的 limit(0) 无限查询
    let quotaNewWords = [];
    if (remainingNew > 0) {
      quotaNewWords = await Word.find({
        userId: req.userId,
        language,
        state: 0,
        due: { $lte: now }
      }).sort({ createdAt: -1 }).limit(remainingNew).select('_id');
    }

    const quotaIds = quotaNewWords.map(w => w._id);

    if (quotaIds.length > 0) {
      newWords = await Word.find({ _id: { $in: quotaIds } }).sort({ createdAt: -1 });
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

    const RATING_NAMES = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
    const info = {};
    for (const [ratingKey, recordLog] of Object.entries(schedulingCards)) {
      const ratingName = RATING_NAMES[ratingKey];
      if (!ratingName) continue; // Skip unknown keys safely
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

    // 抓取复习前的完整 Word 快照，用于精确撤回
    const wordSnapshot = word.toObject();
    delete wordSnapshot._id;
    delete wordSnapshot.__v;
    delete wordSnapshot.createdAt;
    delete wordSnapshot.updatedAt;

    // FSRS 审计修复：移除 startOf('day') 对齐
    // 原逻辑将 due 强制回退到当天凌晨 00:00，会使复习间隔比 FSRS 计算值
    // 系统性缩短最多 18 小时。对于 2-3 天的短间隔卡片影响尤为严重。
    // 现在完全信任 FSRS 原生调度的 due 时间，不做任何人为干预。

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
      prevLearningSteps: log.learning_steps,
      elapsed_days: log.elapsed_days,
      scheduled_days: log.scheduled_days,
      wordSnapshot
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
    if (err.name === 'VersionError') {
      return res.status(409).json({ message: '并发请求冲突，请稍后再试' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const now = new Date();
    const language = req.query.language || 'ja';
    const todayStart = dayjs().tz(TIMEZONE).startOf('day').toDate();
    const tomorrowStart = dayjs(todayStart).add(1, 'day').toDate();

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const shortReviewLimit = new Date(now.getTime() + 30 * ONE_DAY_MS);
    const masteredLimit = new Date(now.getTime() + 100 * ONE_DAY_MS);

    // 使用聚合管道，将 7 次沉重的全表扫瞄合并为 1 次极限扫描
    const [wordStats] = await Word.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.userId), language } },
      { $group: {
          _id: null,
          totalWords: { $sum: 1 },
          dueReviewCount: { $sum: { $cond: [ { $and: [ { $ne: ["$state", 0] }, { $lte: ["$due", now] } ] }, 1, 0 ] } },
          totalNewWords: { $sum: { $cond: [ { $eq: ["$state", 0] }, 1, 0 ] } },
          dueNewWordsBase: { $sum: { $cond: [ { $and: [ { $eq: ["$state", 0] }, { $lte: ["$due", now] } ] }, 1, 0 ] } },
          todayDueWords: {
            $sum: {
              $cond: [
                { $lte: ["$due", now] },
                1,
                0
              ]
            }
          },
          shortReviewWords: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$due", now] },
                    { $lte: ["$due", shortReviewLimit] }
                  ]
                },
                1,
                0
              ]
            }
          },
          longReviewWords: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$due", shortReviewLimit] },
                    { $lte: ["$due", masteredLimit] }
                  ]
                },
                1,
                0
              ]
            }
          },
          masteredWords: {
            $sum: {
              $cond: [
                { $gt: ["$due", masteredLimit] },
                1,
                0
              ]
            }
          }
      }}
    ]);

    // 如果该语言下完全没有单词，提供兜底 0 值
    const stats = wordStats || {
      totalWords: 0, dueReviewCount: 0, dueNewWordsBase: 0,
      todayDueWords: 0, shortReviewWords: 0, longReviewWords: 0, masteredWords: 0
    };

    // ReviewLog 的查询保持原样即可，因为数据量相对较小且有明确时间范围
    const [todayNewReviews, todayReviews] = await Promise.all([
      ReviewLog.countDocuments({ userId: req.userId, language, reviewDate: { $gte: todayStart, $lt: tomorrowStart }, state: 0 }),
      ReviewLog.countDocuments({ userId: req.userId, language, reviewDate: { $gte: todayStart, $lt: tomorrowStart } })
    ]);

    const totalWords = stats.totalWords;
    const dueReviewCount = stats.dueReviewCount;
    const dueNewWordsBase = stats.dueNewWordsBase;
    const todayDueWords = stats.todayDueWords || 0;
    const shortReviewWords = stats.shortReviewWords || 0;
    const longReviewWords = stats.longReviewWords || 0;
    const masteredWords = stats.masteredWords || 0;

    let dueNewWords = dueNewWordsBase;

    const user = await User.findById(req.userId).select('fsrsSettings');
    // 【修改】：根据当前语种加载上限
    const dailyNewLimit = language === 'en' 
      ? (user?.fsrsSettings?.dailyNewLimitEn ?? 20) 
      : (user?.fsrsSettings?.dailyNewLimitJa ?? 20);
    const remainingNew = Math.max(0, dailyNewLimit - todayNewReviews);

    // Bug 3/4 修复后续：如果今日待背新词不够，但发现队列里（明天）存在被推迟的词，那么它实际也算作“由于你的额度盈余而被召回可用”
    if (dueNewWordsBase < remainingNew) {
      const deficit = remainingNew - dueNewWordsBase;
      const postponedCount = await Word.countDocuments({
        userId: req.userId,
        language,
        state: 0,
        due: { $gt: now }
      });
      dueNewWords += Math.min(deficit, postponedCount);
    }

    // 真实待复习总数 = 旧词 + min(剩余额度, 今日到期新词)
    const dueWords = dueReviewCount + Math.min(remainingNew, dueNewWords);

    // 提前抓取未来1小时内即将冷却完毕的单词
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const upcomingWords = await Word.find({
      userId: req.userId,
      language,
      state: { $ne: 0 },
      due: { $gt: now, $lte: oneHourLater }
    }).select('_id due japanese reading meaning').sort({ due: 1 }).lean();

    // ===== 级联感知的今日预估 =====
    // 考虑 FSRS learning steps 的完整级联效应：
    // 一个新词需经历 初始复习 → 1min冷却 → 复习 → 10min冷却 → 复习 → 毕业
    // 冷却池里的词复习后也可能再次进入冷却

    const endOfDay = dayjs().tz(TIMEZONE).endOf('day').toDate();
    const userSettings = user?.fsrsSettings || {};
    const configSteps = (userSettings.learningSteps?.length
      ? userSettings.learningSteps
      : [1, 10]); // 用户配置的学习步骤（分钟）
    const totalConfigSteps = configSteps.length;
    const fullCascadeMinutes = configSteps.reduce((a, b) => a + b, 0); // e.g. 11 for [1,10]

    // 冷却中的词（带 learning_steps 用于计算剩余级联）
    const coolingWordsToday = await Word.find({
      userId: req.userId,
      language,
      state: { $ne: 0 }, // Include any short-term Review items (state=2) due today
      due: { $gt: now, $lte: endOfDay }
    }).select('due learning_steps').sort({ due: -1 }).lean();
    const allCoolingToday = coolingWordsToday.length;

    // 当前已到期的 Learning/Relearning 词（它们也会触发后续级联）
    const dueLearningWords = await Word.find({
      userId: req.userId,
      language,
      state: { $ne: 0 },
      due: { $lte: now }
    }).select('learning_steps').lean();

    // 估算每词平均耗时（基于最近50条ReviewLog的responseTime，兜底15秒）
    const recentLogs = await ReviewLog.find({
      userId: req.userId,
      language,
      responseTime: { $gt: 0 }
    }).sort({ createdAt: -1 }).limit(50).select('responseTime').lean();

    let avgResponseTime = 15; // 默认15秒/词
    if (recentLogs.length > 0) {
      const totalTime = recentLogs.reduce((sum, l) => sum + l.responseTime, 0);
      avgResponseTime = Math.round(totalTime / recentLogs.length / 1000); // ms → s
      if (avgResponseTime < 5) avgResponseTime = 5;
      if (avgResponseTime > 60) avgResponseTime = 60;
    }

    const dueNewCount = Math.min(remainingNew, dueNewWords);
    const dueReviewOnlyCount = Math.max(0, dueReviewCount - dueLearningWords.length); // 纯 Review(state=2) 词
    const todayRemainingWords = dueWords + allCoolingToday;

    // --- 计算每类词的级联完成时间 & 总复习轮数 ---
    let maxCascadeEnd = 0; // 距现在最长的级联结束时间（秒）
    let totalReviewRounds = 0; // 总复习交互次数

    // (a) 纯 Review 词（state=2，已到期）：只需 1 轮复习，无级联
    totalReviewRounds += Math.max(0, dueReviewOnlyCount);

    // (b) 新词（state=0）：完整级联 → 初始复习 + 每个 step 冷却 + 复习
    //     例 [1,10]：review → 1min → review → 10min → review → 毕业
    //     cascade = (steps+1)*avgResp + sum(steps)*60
    if (dueNewCount > 0) {
      const newCascadeSeconds = (totalConfigSteps + 1) * avgResponseTime + fullCascadeMinutes * 60;
      maxCascadeEnd = Math.max(maxCascadeEnd, newCascadeSeconds);
      totalReviewRounds += dueNewCount * (totalConfigSteps + 1);
    }

    // (c) 已到期的 Learning/Relearning 词：从当前 step 继续级联
    //     step=0 → 还需 review + steps[1:]冷却 + 对应复习
    //     step=1 → 复习后毕业
    for (const w of dueLearningWords) {
      const step = w.learning_steps || 0;
      const remainingReviews = Math.max(1, totalConfigSteps - step);
      const remainingCoolingSeconds = configSteps.slice(step + 1).reduce((a, b) => a + b, 0) * 60;
      const cascade = remainingReviews * avgResponseTime + remainingCoolingSeconds;
      maxCascadeEnd = Math.max(maxCascadeEnd, cascade);
      totalReviewRounds += remainingReviews;
    }

    // (d) 冷却中的词：等待到期 + 复习 + 剩余 steps 冷却 + 复习
    //     例 step=0, due=+3min → 等3min + review + 10min冷却 + review
    for (const w of coolingWordsToday) {
      const waitSeconds = Math.max(0, (new Date(w.due).getTime() - now.getTime()) / 1000);
      const step = w.learning_steps || 0;
      const remainingReviews = Math.max(1, totalConfigSteps - step);
      const remainingCoolingSeconds = configSteps.slice(step + 1).reduce((a, b) => a + b, 0) * 60;
      const cascade = waitSeconds + remainingReviews * avgResponseTime + remainingCoolingSeconds;
      maxCascadeEnd = Math.max(maxCascadeEnd, cascade);
      totalReviewRounds += remainingReviews;
    }

    // 总纯答题时间 vs 最长级联时间线，取较大值
    // 因为答题和冷却并行进行（答这个词时另一个词在冷却）
    const totalReviewSeconds = totalReviewRounds * avgResponseTime;
    const totalSeconds = Math.max(maxCascadeEnd, totalReviewSeconds);
    const estimatedMinutes = Math.ceil(totalSeconds / 60);

    res.json({
      totalWords,
      totalNewWords: stats.totalNewWords || 0,
      dueWords,
      newWords: dueNewWords,
      todayDueWords,
      shortReviewWords,
      longReviewWords,
      masteredWords,
      todayReviews,
      upcomingWords,
      dailyNewLimit,
      remainingNew,
      todayForecast: {
        totalRemainingWords: todayRemainingWords,
        coolingWords: allCoolingToday,
        estimatedMinutes,
        avgSecondsPerWord: avgResponseTime
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.undoReview = async (req, res) => {
  try {
    const { wordId } = req.body;
    if (!wordId) return res.status(400).json({ message: 'wordId is required' });

    // 找到该词最近的一条复习记录
    const lastLog = await ReviewLog.findOne({ userId: req.userId, wordId }).sort({ createdAt: -1 });
    if (!lastLog) return res.status(404).json({ message: '没有可撤回的复习记录' });

    const word = await Word.findOne({ _id: wordId, userId: req.userId });
    if (!word) return res.status(404).json({ message: 'Word not found' });

    // 找到该词倒数第二条复习记录（如果存在），来恢复上一次状态
    const prevLog = await ReviewLog.findOne({
      userId: req.userId, wordId,
      _id: { $ne: lastLog._id }
    }).sort({ createdAt: -1 });

    if (lastLog.wordSnapshot) {
      // 精确还原：使用复习前的完整快照
      const snap = lastLog.wordSnapshot;
      word.due = snap.due;
      word.stability = snap.stability;
      word.difficulty = snap.difficulty;
      word.elapsed_days = snap.elapsed_days;
      word.scheduled_days = snap.scheduled_days;
      word.learning_steps = snap.learning_steps;
      word.reps = snap.reps;
      word.lapses = snap.lapses;
      word.state = snap.state;
      word.last_review = snap.last_review;
    } else if (prevLog) {
      // 旧数据兼容：还原到上一次复习后的状态
      word.stability = lastLog.prevStability ?? 0;
      word.difficulty = lastLog.prevDifficulty ?? 0;
      word.elapsed_days = lastLog.elapsed_days ?? 0;
      word.scheduled_days = lastLog.scheduled_days ?? 0;
      word.learning_steps = lastLog.prevLearningSteps ?? 0;
      word.state = lastLog.state != null ? lastLog.state : 0;
      word.last_review = prevLog.reviewDate;
      word.due = lastLog.reviewDate; 
      word.reps = Math.max(0, (word.reps || 1) - 1);
      word.lapses = lastLog.rating === 1 ? Math.max(0, (word.lapses || 1) - 1) : word.lapses;
    } else {
      // 旧数据兼容：没有前一条记录，说明是第一次复习，恢复到新卡状态
      word.stability = 0;
      word.difficulty = 0;
      word.elapsed_days = 0;
      word.scheduled_days = 0;
      word.state = 0;
      word.reps = 0;
      word.lapses = 0;
      word.last_review = null;
      word.due = new Date();
      word.learning_steps = 0;
    }

    await word.save();
    await ReviewLog.deleteOne({ _id: lastLog._id });

    res.json({ message: '已撤回', word });
  } catch (err) {
    if (err.name === 'VersionError') {
      return res.status(409).json({ message: '并发请求冲突，请稍后再试' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addExtraNewWords = async (req, res) => {
  try {
    const { count = 5, language = 'ja' } = req.body;
    const safeCount = Math.min(Math.max(1, parseInt(count) || 5), 50);

    // 1. 获取用户，直接动态提升用户的单日配额上限（最高不超过 Schema 限制的 200）
    const user = await User.findById(req.userId);
    let newLimit = 0;
    
    if (language === 'en') {
      const currentLimit = user.fsrsSettings?.dailyNewLimitEn ?? 20;
      newLimit = Math.min(currentLimit + safeCount, 200);
      user.fsrsSettings.dailyNewLimitEn = newLimit;
    } else {
      const currentLimit = user.fsrsSettings?.dailyNewLimitJa ?? 20;
      newLimit = Math.min(currentLimit + safeCount, 200);
      user.fsrsSettings.dailyNewLimitJa = newLimit;
    }

    // Mongoose 修改嵌套对象必须要 markModified
    user.markModified('fsrsSettings');
    await user.save();

    // 2. 此时无需再去操作 Word 表。前端再次调用 getDueWords 时，
    // remainingNew 会自然扩大，底层原本的 deficit 追溯逻辑会自动把明天的词拉过来！
    res.json({ message: `配额已临时增加至 ${newLimit}，已释放 ${safeCount} 个新词`, released: safeCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getTodayReviewedWords = async (req, res) => {
  try {
    const language = req.query.language || 'ja';
    const dateStr = req.query.date;
    
    let targetStart;
    if (dateStr) {
      targetStart = dayjs.tz(dateStr, TIMEZONE).startOf('day').toDate();
    } else {
      targetStart = dayjs().tz(TIMEZONE).startOf('day').toDate();
    }
    const targetEnd = dayjs(targetStart).add(1, 'day').toDate();

    const logs = await ReviewLog.find({
      userId: req.userId,
      language,
      reviewDate: { $gte: targetStart, $lt: targetEnd }
    }).select('wordId').lean();

    const wordIds = [...new Set(logs.map(log => log.wordId.toString()))];
    
    if (wordIds.length === 0) {
      return res.json({ words: [] });
    }

    const words = await Word.find({
      _id: { $in: wordIds },
      userId: req.userId
    }).lean();

    res.json({ words });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getCalendarStats = async (req, res) => {
  try {
    const language = req.query.language || 'ja';
    // 动态获取前端传来的时区，如果没传则 fallback 到基准时区
    const userTz = req.query.tz || TIMEZONE; 
    
    const oneYearAgo = dayjs().tz(userTz).subtract(1, 'year').startOf('day').toDate();
    
    const stats = await ReviewLog.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(req.userId),
          language,
          reviewDate: { $gte: oneYearAgo }
        } 
      },
      // 第一层分组：按 "日期 + 单词ID" 去重，确保同一天同一个词复习多次只算一次
      {
        $group: {
          _id: {
            // ⚠️ 使用用户真实所在的区时进行天级别的截断和聚合
            date: { $dateToString: { format: "%Y-%m-%d", date: "$reviewDate", timezone: userTz } },
            wordId: "$wordId"
          }
        }
      },
      // 第二层分组：按 "日期" 统计去重后的真实单词数量
      {
        $group: {
          _id: "$_id.date",
          count: { $sum: 1 }
        }
      }
    ]);

    const calendarData = stats.map(item => [item._id, item.count]);
    
    res.json(calendarData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
