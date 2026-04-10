/**
 * AI 批量修复词性脚本
 * 用法：cd backend && node ../tools/fix_pos_ai.js
 * 
 * 将所有 partOfSpeech='名词' 的单词批量发给 DeepSeek 重新判定词性
 */

const path = require('path');
// 让 require 能找到 backend/node_modules 里的依赖
module.paths.unshift(path.resolve(__dirname, '../backend/node_modules'));

require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const Word = require(path.resolve(__dirname, '../backend/models/Word'));

const VALID_POS_JA = ['名词','动词','形容词','副词','助词','连词','感叹词','代词','数词','接尾词','接头词','其他'];
const VALID_POS_EN = ['名词','动词','形容词','副词','代词','介词','连词','冠词','感叹词','数词','其他'];

const BATCH_SIZE = 30;
const DELAY_MS = 800; // 请求间隔，防限流

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function classifyBatch(words, language) {
  const wordList = words.map(w => w.japanese).join('\n');
  const validList = language === 'en' ? VALID_POS_EN.join('/') : VALID_POS_JA.join('/');

  const prompt = language === 'ja'
    ? `请判定以下每个日语单词的词性。可选词性：${validList}。
请严格按照以下 JSON 数组格式返回，每个元素只包含 word 和 pos 两个字段：
[{"word":"単語","pos":"名词"}, ...]
只返回 JSON，不要其他内容。

单词列表（每行一个）：
${wordList}`
    : `请判定以下每个英语单词的词性。可选词性：${validList}。
请严格按照以下 JSON 数组格式返回，每个元素只包含 word 和 pos 两个字段：
[{"word":"apple","pos":"名词"}, ...]
只返回 JSON，不要其他内容。

单词列表（每行一个）：
${wordList}`;

  const response = await axios.post(
    'https://api.deepseek.com/chat/completions',
    {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个语言学专家，只返回JSON。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      timeout: 30000,
    }
  );

  const content = response.data.choices[0].message.content.trim();
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('AI 返回无 JSON: ' + content.slice(0, 200));
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('❌ MONGODB_URI 未设置'); process.exit(1); }
  if (!process.env.DEEPSEEK_API_KEY) { console.error('❌ DEEPSEEK_API_KEY 未设置'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('✅ 已连接 MongoDB\n');

  // 找出所有词性为"名词"的单词
  const targets = await Word.find({ partOfSpeech: '名词' }).select('_id japanese language partOfSpeech');
  console.log(`📊 找到 ${targets.length} 个词性为"名词"的单词需要 AI 重新判定\n`);

  if (targets.length === 0) {
    console.log('没有需要修复的单词');
    process.exit(0);
  }

  let fixed = 0;
  let failed = 0;
  let unchanged = 0;
  const breakdown = {};

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(targets.length / BATCH_SIZE);
    const language = batch[0].language || 'ja';

    process.stdout.write(`[${batchNum}/${totalBatches}] 处理 ${batch.length} 个${language === 'en' ? '英语' : '日语'}单词... `);

    try {
      const results = await classifyBatch(batch, language);

      // 构建 word→pos 映射
      const posMap = {};
      for (const r of results) {
        if (r.word && r.pos) posMap[r.word] = r.pos;
      }

      // 更新数据库
      for (const word of batch) {
        const newPos = posMap[word.japanese];
        const validSet = language === 'en' ? VALID_POS_EN : VALID_POS_JA;

        if (newPos && validSet.includes(newPos) && newPos !== '名词') {
          await Word.updateOne({ _id: word._id }, { $set: { partOfSpeech: newPos } });
          const key = newPos;
          breakdown[key] = (breakdown[key] || 0) + 1;
          fixed++;
        } else {
          unchanged++;
        }
      }

      console.log(`✓ 修正 ${Object.keys(posMap).length} 词`);
    } catch (err) {
      console.log(`✗ 失败: ${err.message.slice(0, 80)}`);
      failed += batch.length;
    }

    if (i + BATCH_SIZE < targets.length) await sleep(DELAY_MS);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ AI 词性修复完成！`);
  console.log(`   修正: ${fixed}  |  保持名词: ${unchanged}  |  失败: ${failed}`);

  if (Object.keys(breakdown).length > 0) {
    console.log('\n新词性分布：');
    for (const [pos, count] of Object.entries(breakdown).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${pos}: +${count}`);
    }
  }

  // 最终统计
  const finalStats = await Word.aggregate([
    { $group: { _id: '$partOfSpeech', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.log('\n修复后词性总览：');
  console.table(finalStats);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ 脚本异常:', err);
  process.exit(1);
});
