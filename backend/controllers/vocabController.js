const Word = require('../models/Word');
const User = require('../models/User');
const ReviewLog = require('../models/ReviewLog');

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
const TIMEZONE = "Asia/Shanghai";

const hiragana = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉっゃゅょ';
const katakana = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォッャュョ';
const romajiMap = {
  a:'あ',i:'い',u:'う',e:'え',o:'お',
  ka:'か',ki:'き',ku:'く',ke:'け',ko:'こ',sa:'さ',si:'し',shi:'し',su:'す',se:'せ',so:'そ',
  ta:'た',ti:'ち',chi:'ち',tu:'つ',tsu:'つ',te:'て',to:'と',
  na:'な',ni:'に',nu:'ぬ',ne:'ね',no:'の',
  ha:'は',hi:'ひ',fu:'ふ',he:'へ',ho:'ほ',
  ma:'ま',mi:'み',mu:'む',me:'め',mo:'も',
  ya:'や',yu:'ゆ',yo:'よ',ra:'ら',ri:'り',ru:'る',re:'れ',ro:'ろ',
  wa:'わ',wo:'を',n:'ん',
  ga:'が',gi:'ぎ',gu:'ぐ',ge:'げ',go:'ご',za:'ざ',zi:'じ',ji:'じ',zu:'ず',ze:'ぜ',zo:'ぞ',
  da:'だ',di:'ぢ',du:'づ',de:'で',do:'ど',
  ba:'ば',bi:'び',bu:'ぶ',be:'べ',bo:'ぼ',
  pa:'ぱ',pi:'ぴ',pu:'ぷ',pe:'ぺ',po:'ぽ',
  kya:'きゃ',kyu:'きゅ',kyo:'きょ',sha:'しゃ',shu:'しゅ',sho:'しょ',
  cha:'ちゃ',chu:'ちゅ',cho:'ちょ',nya:'にゃ',nyu:'にゅ',nyo:'にょ',
  hya:'ひゃ',hyu:'ひゅ',hyo:'ひょ',mya:'みゃ',myu:'みゅ',myo:'みょ',
  rya:'りゃ',ryu:'りゅ',ryo:'りょ',pya:'ぴゃ',pyu:'ぴゅ',pyo:'ぴょ',
  gya:'ぎゃ',gyu:'ぎゅ',gyo:'ぎょ',bya:'びゃ',byu:'びゅ',byo:'びょ',
};


function romajiToHiragana(text) {
  text = text.toLowerCase().replace(/[^a-z]/g, '');
  let result = '', i = 0;
  while (i < text.length) {
    let matched = false;
    if (i + 2 < text.length) {
      const triple = text[i] + text[i + 1] + text[i + 2];
      if (romajiMap[triple]) { result += romajiMap[triple]; i += 3; matched = true; continue; }
    }
    if (i + 1 < text.length) {
      const double = text[i] + text[i + 1];
      if (romajiMap[double]) { result += romajiMap[double]; i += 2; matched = true; continue; }
    }
    if (romajiMap[text[i]]) { result += romajiMap[text[i]]; } else { result += text[i]; }
    i++;
  }
  result = result.replace(/([kstnhmyrw])/g, '$1っ');
  return result;
}

exports.getWords = async (req, res) => {
  try {
    let { page = 1, limit = 50, partOfSpeech, tag, search, language = 'ja' } = req.query; // 接收 language

    page = Math.max(1, parseInt(page) || 1);
    limit = Math.max(1, Math.min(100, parseInt(limit) || 50));

    const query = { userId: req.userId, language }; // 将 language 加入查询条件

    if (partOfSpeech) query.partOfSpeech = partOfSpeech;
    if (tag) query.tags = tag;

    // 数据库级别的模糊搜索
    if (search) {
      const searchStr = search.trim();
      const searchRegex = new RegExp(searchStr, 'i');
      
      // 借用你写好的罗马音转平假名函数，让搜索也支持罗马音查假名
      const searchHira = romajiToHiragana(searchStr);
      const hiraRegex = new RegExp(searchHira, 'i');

      query.$or = [
        { japanese: searchRegex },
        { japanese: hiraRegex },
        { reading: searchRegex },
        { reading: hiraRegex },
        { meaning: searchRegex }
      ];
    }

    // 1. 先用 MongoDB 获取符合条件的总数
    const total = await Word.countDocuments(query);
    const pages = Math.ceil(total / limit) || 1;

    // 2. 将排序、分页全部交给 MongoDB
    // sort({ due: 1 }) 刚好完美符合你的需求：过去的日期排在最前(待复习优先)，未来的日期按远近排在后面
    const words = await Word.find(query)
      .sort({ due: 1 }) 
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ words, total, page, pages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getWord = async (req, res) => {
  try {
    const word = await Word.findOne({ _id: req.params.id, userId: req.userId });
    if (!word) {
      return res.status(404).json({ message: 'Word not found' });
    }
    res.json(word);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addWord = async (req, res) => {
  try {
    const { language, japanese, reading, meaning, partOfSpeech, tags } = req.body;

    if (!japanese || !meaning) {
      return res.status(400).json({ message: 'Japanese word and meaning are required' });
    }

    // 计算今日剩余新词额度
    const user = await User.findById(req.userId).select('fsrsSettings');
    const dailyNewLimit = user?.fsrsSettings?.dailyNewLimit ?? 20;
    const todayStart = dayjs().tz(TIMEZONE).startOf('day').toDate();
    const now = new Date();

    const todayNewReviews = await ReviewLog.countDocuments({
      userId: req.userId,
      reviewDate: { $gte: todayStart },
      state: 0
    });
    const queuedNew = await Word.countDocuments({
      userId: req.userId,
      state: 0,
      due: { $lte: now }
    });
    const remainingQuota = Math.max(0, dailyNewLimit - todayNewReviews - queuedNew);
    const dueDate = remainingQuota > 0 ? now : dayjs().tz(TIMEZONE).add(1, 'day').startOf('day').toDate();

    const word = new Word({
      userId: req.userId,
      language: language || 'ja', // 记录语种
      japanese,
      reading,
      meaning,
      partOfSpeech: partOfSpeech || '名词',
      tags: tags || [],
      due: dueDate
    });

    await word.save();
    res.status(201).json(word);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateWord = async (req, res) => {
  try {
    const word = await Word.findOne({ _id: req.params.id, userId: req.userId });

    if (!word) {
      return res.status(404).json({ message: 'Word not found' });
    }

    const { language, japanese, reading, meaning, partOfSpeech, tags } = req.body;

    if (language) word.language = language; // 允许修改语种
    if (japanese) word.japanese = japanese;
    if (reading !== undefined) word.reading = reading;
    if (meaning) word.meaning = meaning;
    if (partOfSpeech) word.partOfSpeech = partOfSpeech;
    if (tags !== undefined) word.tags = tags;

    await word.save();
    res.json(word);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteWord = async (req, res) => {
  try {
    const word = await Word.findOneAndDelete({ _id: req.params.id, userId: req.userId });

    if (!word) {
      return res.status(404).json({ message: 'Word not found' });
    }

    res.json({ message: 'Word deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.exportWords = async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const words = await Word.find({ userId: req.userId }).sort({ createdAt: -1 });

    if (format === 'csv') {
      const escapeCsvField = (str) => {
        if (str === null || str === undefined) return '';
        const s = String(str);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      const csvHeader = 'Japanese,Reading,Meaning,PartOfSpeech,Tags\n';
      const csvRows = words.map(w =>
        `${escapeCsvField(w.japanese)},${escapeCsvField(w.reading)},${escapeCsvField(w.meaning)},${escapeCsvField(w.partOfSpeech)},${escapeCsvField((w.tags || []).join(';'))}`
      ).join('\n');
      res.json({ data: csvHeader + csvRows, format: 'csv' });
    } else {
      res.json({ data: words, format: 'json' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.importWords = async (req, res) => {
  try {
    const { words } = req.body;

    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ message: 'Invalid or empty words array' });
    }

    // 限制导入数量
    const MAX_IMPORT = 500;
    const wordsToImport = words.slice(0, MAX_IMPORT);

    // 规范化 partOfSpeech，'其它' -> '其他'
    const normalizePos = (pos) => {
      if (!pos) return '名词';
      if (pos === '其它') return '其他';
      // 扩充英文词性
      const validPos = ['名词', '动词', '形容词', '副词', '助词', '连词', '感叹词', '代词', '数词', '接尾词', '接头词', '介词', '冠词', '其他'];
      return validPos.includes(pos) ? pos : '名词';
    };

    const wordsToInsertRaw = wordsToImport.map(w => ({
      userId: req.userId,
      language: w.language || 'ja', // 映射传入的语种
      japanese: w.japanese || w.word,
      reading: w.reading || w.kana || '',
      meaning: w.meaning || w.translation || '',
      partOfSpeech: normalizePos(w.partOfSpeech || w.pos),
      tags: w.tags || [],
      due: new Date()
    }));

    // 【新增修复】：先进行 payload 内部去重，保留最后一个出现的重复项
    const uniqueMap = new Map();
    wordsToInsertRaw.forEach(w => {
        if (w.japanese) uniqueMap.set(w.japanese, w);
    });
    const wordsToInsert = Array.from(uniqueMap.values());

    // 提取所有准备导入的日语单词
    const newJapaneseWords = wordsToInsert.map(w => w.japanese);
    
    // 从数据库查询当前用户已有的单词
    const existingWords = await Word.find({ 
      userId: req.userId, 
      japanese: { $in: newJapaneseWords } 
    }).select('japanese').lean();
    
    // 构建 Set 用于快速查重
    const existingSet = new Set(existingWords.map(w => w.japanese));
    
    // 过滤掉已存在的单词
    const finalInsert = wordsToInsert.filter(w => !existingSet.has(w.japanese));

    // 计算今日剩余新词额度，超出的词推到明天
    if (finalInsert.length > 0) {
      const user = await User.findById(req.userId).select('fsrsSettings');
      const dailyNewLimit = user?.fsrsSettings?.dailyNewLimit ?? 20;
      const todayStart = dayjs().tz(TIMEZONE).startOf('day').toDate();

      const todayNewReviews = await ReviewLog.countDocuments({
        userId: req.userId,
        reviewDate: { $gte: todayStart },
        state: 0
      });

      // 当前还在排队的新词（state: 0, due <= now）也算占用额度
      const queuedNew = await Word.countDocuments({
        userId: req.userId,
        state: 0,
        due: { $lte: new Date() }
      });

      const usedQuota = todayNewReviews + queuedNew;
      const remainingQuota = Math.max(0, dailyNewLimit - usedQuota);

      const tomorrowStart = dayjs().tz(TIMEZONE).add(1, 'day').startOf('day').toDate();
      finalInsert.forEach((w, i) => {
        if (i >= remainingQuota) {
          w.due = tomorrowStart;
        }
      });
    }

    if (finalInsert.length === 0) {
      return res.status(200).json({ 
        message: '没有新单词需要导入（皆为重复）', 
        count: 0, 
        skipped: words.length 
      });
    }

    // 只插入不重复的新单词
    console.log('Inserting unique words:', finalInsert.length, 'for user:', req.userId);
    const result = await Word.insertMany(finalInsert);
    res.status(201).json({
      message: `Imported ${result.length} words`,
      count: result.length,
      skipped: words.length - finalInsert.length
    });
  } catch (err) {
    console.error('Import error:', err.message, err.stack);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

exports.batchDeleteWords = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '没有提供需要删除的 ID' });
    }
    // 数据库层面一次性删除
    await Word.deleteMany({ _id: { $in: ids }, userId: req.userId });
    res.json({ message: '批量删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
