const aiAttempts = new Map();
// 限制时间窗口：1 小时
const WINDOW_MS = 60 * 60 * 1000; 
// 每小时每个用户最多调用 AI 的次数 (包含单个生成和批量生成)
const MAX_REQUESTS = 20; 

// 定期清理过期记录，释放内存
setInterval(() => {
  const now = Date.now();
  for (const [userId, record] of aiAttempts.entries()) {
    record.timestamps = record.timestamps.filter(time => now - time < WINDOW_MS);
    if (record.timestamps.length === 0) {
      aiAttempts.delete(userId);
    }
  }
}, WINDOW_MS);

function aiRateLimiter(req, res, next) {
  // 基于用户 ID 限流，而不是 IP，这样更精准
  const userId = req.userId; 
  if (!userId) return next();

  const now = Date.now();
  const record = aiAttempts.get(userId);

  if (record) {
    record.timestamps = record.timestamps.filter(time => now - time < WINDOW_MS);
    if (record.timestamps.length >= MAX_REQUESTS) {
      return res.status(429).json({ 
        message: `AI 调用频率过高，每小时限制 ${MAX_REQUESTS} 次请求。请稍后再试。` 
      });
    }
    record.timestamps.push(now);
  } else {
    aiAttempts.set(userId, { timestamps: [now] });
  }

  next();
}

module.exports = aiRateLimiter;
