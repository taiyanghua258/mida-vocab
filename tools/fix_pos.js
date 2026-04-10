/**
 * 一次性修复脚本：清洗数据库中已存在的词性脏数据
 * 用法：cd backend && node ../tools/fix_pos.js
 */

const path = require('path');
const dotenvResult = require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
if (dotenvResult.error) {
  require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
}
const mongoose = require('mongoose');
const Word = require('../backend/models/Word');

const posMap = {
  // 日文词性
  '名詞':'名词','動詞':'动词','形容詞':'形容词','形容動詞':'形容词',
  '副詞':'副词','助詞':'助词','接続詞':'连词','感動詞':'感叹词','感嘆詞':'感叹词',
  '代名詞':'代词','数詞':'数词','接尾詞':'接尾词','接尾辞':'接尾词',
  '接頭詞':'接头词','接頭辞':'接头词','連体詞':'其他','助動詞':'其他',
  'めいし':'名词','どうし':'动词','けいようし':'形容词',
  'い形容詞':'形容词','な形容詞':'形容词','イ形容詞':'形容词','ナ形容詞':'形容词',
  // 英文词性
  'noun':'名词','n':'名词','n.':'名词',
  'verb':'动词','v':'动词','v.':'动词','vt':'动词','vi':'动词','vt.':'动词','vi.':'动词',
  'adjective':'形容词','adj':'形容词','adj.':'形容词','a.':'形容词',
  'adverb':'副词','adv':'副词','adv.':'副词',
  'pronoun':'代词','pron':'代词','pron.':'代词',
  'preposition':'介词','prep':'介词','prep.':'介词',
  'conjunction':'连词','conj':'连词','conj.':'连词',
  'interjection':'感叹词','interj':'感叹词','interj.':'感叹词',
  'article':'冠词','art':'冠词','art.':'冠词',
  'numeral':'数词','num':'数词','num.':'数词',
  'determiner':'冠词','det':'冠词',
  // 中文变体
  '其它':'其他','名':'名词','动':'动词','形':'形容词','副':'副词',
};

const validPos = new Set([
  '名词','动词','形容词','副词','助词','连词','感叹词',
  '代词','数词','接尾词','接头词','介词','冠词','其他'
]);

function normalizePos(raw) {
  if (!raw) return '名词';
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (posMap[lower]) return posMap[lower];
  if (posMap[trimmed]) return posMap[trimmed];
  if (validPos.has(trimmed)) return trimmed;
  for (const [key, val] of Object.entries(posMap)) {
    if (lower.includes(key)) return val;
  }
  return '名词';
}

async function fix() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/my-vocab';
  console.log(`连接数据库: ${uri.replace(/\/\/[^@]+@/, '//***@')}`);

  await mongoose.connect(uri);
  console.log('已连接 MongoDB');

  const words = await Word.find({});
  console.log(`共找到 ${words.length} 个单词`);

  let fixed = 0;
  let breakdown = {};

  for (const w of words) {
    const normalized = normalizePos(w.partOfSpeech);
    if (w.partOfSpeech !== normalized) {
      const key = `"${w.partOfSpeech}" → "${normalized}"`;
      breakdown[key] = (breakdown[key] || 0) + 1;
      w.partOfSpeech = normalized;
      await w.save();
      fixed++;
    }
  }

  console.log(`\n✅ 修复完成！共修正 ${fixed} / ${words.length} 个单词的词性`);

  if (Object.keys(breakdown).length > 0) {
    console.log('\n映射明细：');
    for (const [k, v] of Object.entries(breakdown).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}: ${v} 个`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

fix().catch(err => {
  console.error('❌ 修复失败:', err);
  process.exit(1);
});
