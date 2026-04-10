const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
// 1. 引入限流器
const aiRateLimiter = require('../middleware/aiRateLimiter');

// 单个单词生成
router.post('/generate', auth, aiRateLimiter, async (req, res) => {
  try {
    const { japanese, language = 'ja' } = req.body; // 接收语种

    if (!japanese) {
      return res.status(400).json({ message: '请输入单词' });
    }

    const prompt = language === 'ja'
      ? `给定一个日语单词 "${japanese}"，请返回一个 JSON 对象，包含以下字段：
- japanese: 原单词
- reading: 假名读音
- meaning: 中文释义
- partOfSpeech: 词性（名词/动词/形容词/副词/助词/连词/感叹词/代词/数词/接尾词/接头词/其他）
- tags: 相关标签数组，必须包含 JLPT 等级（N5/N4/N3/N2/N1），以及词性、领域等。例如：["N5", "动词", "日常"]
- language: "ja"
只返回 JSON，不要其他文字。`
      : `给定一个英语单词 "${japanese}"，请返回一个 JSON 对象，包含以下字段：
- japanese: 原单词（必须使用 japanese 作为键名）
- reading: 音标 (IPA)
- meaning: 中文释义
- partOfSpeech: 词性（名词/动词/形容词/副词/代词/介词/连词/冠词/感叹词/数词/其他）
- tags: 相关标签数组（如 CET4, 雅思等）。
- language: "en"
只返回 JSON，不要其他文字。`;

    // 动态设置系统人设
    const systemContent = language === 'ja' 
      ? '你是一个日语学习助手，只返回 JSON 格式的数据。' 
      : '你是一个英语学习助手，只返回 JSON 格式的数据。';

    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
      }
    );

    const content = response.data.choices[0].message.content.trim();

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = JSON.parse(content);
      }
      result.japanese = japanese;
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Content:', content);
      return res.status(500).json({ message: 'AI 返回格式错误' });
    }

    res.json(result);
  } catch (err) {
    console.error('DeepSeek API error:', err.response?.data || err.message);
    res.status(500).json({ message: 'AI 服务调用失败' });
  }
});

// 批量生成
router.post('/generate-batch', auth, aiRateLimiter, async (req, res) => {
  try {
    const { text, language = 'ja' } = req.body; // 接收语种

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: '请提供文本内容' });
    }

    if (text.length > 3000) {
      return res.status(400).json({ message: '文本过长，请分批次生成（限制 3000 字符以内）' });
    }

    // 核心修复：强调按“行”处理，不拆分短语词组
    const prompt = language === 'ja'
      ? `请将以下文本中的【每一行】视为一个独立的日语学习项（可能是单个单词，也可能是短语或词组）。请为每一行的内容生成信息。
文本内容：\n${text}\n
要求：
1. 严格按行处理并去重。即使一行内是短语，也必须作为一个整体对待，绝不要将其拆分成多个单词。
2. 为每一行的内容生成：
   - japanese: 原文本（保持整行的单词或短语）
   - reading: 假名读音
   - meaning: 中文释义
   - partOfSpeech: 词性（如果是短语可标为"其他"或"短语"）
   - tags: 相关标签数组（如 N5、N4等）
   - language: "ja"
请只返回一个 JSON 数组，不要其他文字。`
      : `请将以下文本中的【每一行】视为一个独立的英语学习项（可能是单个单词，也可能是短语或词组）。请为每一行的内容生成信息。
文本内容：\n${text}\n
要求：
1. 严格按行处理并去重。即使一行内是短语（例如 "give up", "in terms of"），也必须作为一个整体对待，绝不要将其拆分成单独的单词。
2. 为每一行的内容生成：
   - japanese: 原文本（保持整行的单词或短语，必须使用 japanese 作为键名）
   - reading: 音标 (IPA)
   - meaning: 中文释义
   - partOfSpeech: 词性（如果是短语可标为"其他"或"短语"）
   - tags: 相关标签数组
   - language: "en"
请只返回一个 JSON 数组，不要其他文字。`;

    // 动态设置系统人设
    const systemContent = language === 'ja' 
      ? '你是一个日语学习助手，只返回 JSON 数组格式的数据。' 
      : '你是一个英语学习助手，只返回 JSON 数组格式的数据。';

    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
      }
    );

    const content = response.data.choices[0].message.content.trim();

    let results;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0]);
      } else {
        results = JSON.parse(content);
      }
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Content:', content);
      return res.status(500).json({ message: 'AI 返回格式错误' });
    }

    res.json(results);
  } catch (err) {
    console.error('DeepSeek API error:', err.response?.data || err.message);
    res.status(500).json({ message: 'AI 服务调用失败' });
  }
});

module.exports = router;
