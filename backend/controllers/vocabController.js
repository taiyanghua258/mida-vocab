const Word = require('../models/Word');

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

function normalizeJapanese(text) {
  if (!text) return '';
  text = text.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const idx = katakana.indexOf(text[i]);
    result += idx !== -1 ? hiragana[idx] : text[i];
  }
  result = result.replace(/っ([kstnhmyrw])/g, '$1');
  return result;
}

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

function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatch(query, target, reading) {
  if (!query) return true;
  query = query.toLowerCase().trim();
  if (!query) return true;

  const queryHira = romajiToHiragana(query);

  if (reading) {
    const readingNorm = normalizeJapanese(reading.toLowerCase());
    if (readingNorm.includes(queryHira) || readingNorm === queryHira) return true;
    if (editDistance(normalizeJapanese(queryHira), readingNorm) <= 1) return true;
  }

  if (target) {
    const targetNorm = normalizeJapanese(target.toLowerCase());
    if (targetNorm.includes(queryHira) || targetNorm === queryHira) return true;
  }

  return false;
}

function wordMatchesSearch(query, word) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (!q) return true;

  if (word.japanese.toLowerCase().includes(q)) return true;
  if ((word.reading || '').toLowerCase().includes(q)) return true;
  if ((word.meaning || '').toLowerCase().includes(q)) return true;

  if (fuzzyMatch(q, word.japanese, word.reading)) return true;
  if (fuzzyMatch(q, word.meaning, null)) return true;

  return false;
}

exports.getWords = async (req, res) => {
  try {
    let { page = 1, limit = 50, partOfSpeech, tag, search } = req.query;

    page = Math.max(1, parseInt(page) || 1);
    limit = Math.max(1, Math.min(100, parseInt(limit) || 50));

    const baseQuery = { userId: req.userId };

    if (partOfSpeech) baseQuery.partOfSpeech = partOfSpeech;
    if (tag) baseQuery.tags = tag;

    let allWords = await Word.find(baseQuery).lean();

    // 排序：待复习优先，然后按 due 升序（已复习单词：距下次复习时间越长越在下面）
    const now = new Date(); now.setHours(0, 0, 0, 0);
    allWords.sort((a, b) => {
      const aDate = new Date(a.due || 0); aDate.setHours(0, 0, 0, 0);
      const bDate = new Date(b.due || 0); bDate.setHours(0, 0, 0, 0);
      const aIsDue = aDate <= now;
      const bIsDue = bDate <= now;
      if (aIsDue !== bIsDue) return aIsDue ? -1 : 1;
      // 已复习：距下次复习时间越长（due 越大）越在下面
      return aDate - bDate;
    });

    if (search) {
      allWords = allWords.filter(w => wordMatchesSearch(search, w));
    }

    const total = allWords.length;
    const pages = Math.ceil(total / limit) || 1;
    const words = allWords.slice((page - 1) * limit, page * limit);

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
    const { japanese, reading, meaning, partOfSpeech, tags } = req.body;

    if (!japanese || !meaning) {
      return res.status(400).json({ message: 'Japanese word and meaning are required' });
    }

    const word = new Word({
      userId: req.userId,
      japanese,
      reading,
      meaning,
      partOfSpeech: partOfSpeech || '名词',
      tags: tags || [],
      due: new Date()
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

    const { japanese, reading, meaning, partOfSpeech, tags } = req.body;

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
      const validPos = ['名词', '动词', '形容词', '副词', '助词', '连词', '感叹词', '代词', '数词', '接尾词', '接头词', '其他'];
      return validPos.includes(pos) ? pos : '名词';
    };

    const wordsToInsert = wordsToImport.map(w => ({
      userId: req.userId,
      japanese: w.japanese || w.word,
      reading: w.reading || w.kana || '',
      meaning: w.meaning || w.translation || '',
      partOfSpeech: normalizePos(w.partOfSpeech || w.pos),
      tags: w.tags || [],
      due: new Date()
    }));

    console.log('Importing words:', wordsToInsert.length, 'for user:', req.userId);
    const result = await Word.insertMany(wordsToInsert);
    res.status(201).json({
      message: `Imported ${result.length} words`,
      count: result.length,
      skipped: words.length - wordsToImport.length
    });
  } catch (err) {
    console.error('Import error:', err.message, err.stack);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
};
