const loginAttempts = new Map();
const windowMs = 70 * 1000; // 70 seconds
const maxAttempts = 5;

// 定期清理过期记录，防止内存泄漏
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginAttempts.entries()) {
    record.attempts = record.attempts.filter(time => now - time < windowMs);
    if (record.attempts.length === 0) {
      loginAttempts.delete(key);
    }
  }
}, 60 * 60 * 1000); // 每小时清理一次

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const key = `login:${ip}`;

  const now = Date.now();
  const record = loginAttempts.get(key);

  if (record) {
    // Remove expired attempts
    record.attempts = record.attempts.filter(time => now - time < windowMs);

    if (record.attempts.length >= maxAttempts) {
      const oldestAttempt = record.attempts[0];
      const waitTime = Math.ceil((windowMs - (now - oldestAttempt)) / 1000);
      return res.status(429).json({
        message: `Too many login attempts. Please try again in ${waitTime} seconds.`
      });
    }

    record.attempts.push(now);
  } else {
    loginAttempts.set(key, { attempts: [now] });
  }

  next();
}

module.exports = rateLimiter;
