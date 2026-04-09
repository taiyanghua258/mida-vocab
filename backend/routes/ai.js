const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');

// 单个单词生成
router.post('/generate', auth, async (req, res) => {
  try {
    const { japanese } = req.body;

    if (!japanese) {
      return res.status(400).json({ message: '请输入日语单词' });
    }

    const prompt = `给定一个日语单词 "${japanese}"，请返回一个 JSON 对象，包含以下字段：
- japanese: 原单词
- reading: 假名读音
- meaning: 中文释义
- partOfSpeech: 词性（名词/动词/形容词/副词/助词/连词/感叹词/代词/数词/接尾词/接头词/其他）
- tags: 相关标签数组，必须包含 JLPT 等级（N5/N4/N3/N2/N1），以及词性、领域等相关标签。例如：["N5", "动词", "日常"]

只返回 JSON，不要其他文字。`;

    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个日语学习助手，只返回 JSON 格式的数据。' },
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
router.post('/generate-batch', auth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: '请提供文本内容' });
    }

    if (text.length > 3000) {
      return res.status(400).json({ message: '文本过长，请分批次生成（限制 3000 字符以内）' });
    }

    const prompt = `从以下文本中提取所有日语单词（日语汉字、平假名、片假名组成的词），并为每个单词生成信息。

文本内容：
${text}

要求：
1. 识别文本中所有的日语单词（日语汉字、平假名、片假名）
2. 单词去重
3. 每个单词生成：
   - japanese: 原单词
   - reading: 假名读音
   - meaning: 中文释义
   - partOfSpeech: 词性（名词/动词/形容词/副词/助词/连词/感叹词/代词/数词/接尾词/接头词/其他）
   - tags: 相关标签数组（如 N5、N4、常用等）

请只返回一个 JSON 数组，不要其他文字。例如：
[{"japanese":"桜","reading":"さくら","meaning":"樱花","partOfSpeech":"名词","tags":["N5","植物"]}]`;

    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个日语学习助手，只返回 JSON 数组格式的数据。' },
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
