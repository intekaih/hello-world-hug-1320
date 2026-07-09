const rateLimit = require("express-rate-limit");
const config = require("../config");

const {
  global: globalConfig,
  login: loginConfig,
  admin: adminConfig,
  suggest: suggestConfig,
} = config.rateLimit;

const globalLimiter = rateLimit({
  windowMs: globalConfig.windowMs,
  limit: globalConfig.limit,
  standardHeaders: globalConfig.standardHeaders,
  legacyHeaders: globalConfig.legacyHeaders,
  message: globalConfig.message,
  skip: (req) => {
    const staticExtensions =
      /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|map)$/i;
    return staticExtensions.test(req.path);
  },
});

const loginLimiter = rateLimit({
  windowMs: loginConfig.windowMs,
  limit: loginConfig.limit,
  standardHeaders: loginConfig.standardHeaders,
  legacyHeaders: loginConfig.legacyHeaders,
  handler: (req, res) => {
    const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
    const minutes = Math.floor(retryAfter / 60);
    const seconds = retryAfter % 60;
    res.status(429).render("pages/429", {
      layout: false,
      retryAfter,
      minutes,
      seconds,
    });
  },
});

const adminApiLimiter = rateLimit({
  windowMs: adminConfig.windowMs,
  limit: adminConfig.limit,
  standardHeaders: adminConfig.standardHeaders,
  legacyHeaders: adminConfig.legacyHeaders,
  message: adminConfig.message,
});

const suggestLimiter = rateLimit({
  windowMs: suggestConfig.windowMs,
  limit: suggestConfig.limit,
  standardHeaders: suggestConfig.standardHeaders,
  legacyHeaders: suggestConfig.legacyHeaders,
  message: suggestConfig.message,
});

// F5 Gemini translate limiter — chống abuse Gemini quota (free tier 15 RPM)
// Per-IP 20 lần/5 phút là đủ cho UX bình thường (mở vài phim).
const translateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Quá nhiều yêu cầu dịch. Vui lòng thử lại sau vài phút.",
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000),
    });
  },
});

// React API auth limiter - stricter than EJS login (JSON API abuse harder to detect)
const reactLoginLimiter = rateLimit({
  windowMs: loginConfig.windowMs,
  limit: Math.ceil(loginConfig.limit / 3), // 3x stricter than web login
  standardHeaders: loginConfig.standardHeaders,
  legacyHeaders: loginConfig.legacyHeaders,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000),
    });
  },
});

// HLS/m3u8 proxy rate limiter - chống crawler/abuse streaming proxy
// 100 requests/minute = ~1.7 requests/second = đủ cho streaming usage thông thường
// Nhiều user xem phim đồng thời sẽ trigger rate limit nếu abuse
const hlsProxyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => {
    // Skip static HLS chunks (segments) - chỉ rate limit m3u8 playlist requests
    return req.path.includes('/hls-seg/');
  },
  handler: (req, res) => {
    res.status(429).json({
      error: "Quá nhiều yêu cầu streaming. Vui lòng thử lại sau.",
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000),
    });
  },
});

// HLS segment rate limiter - nhẹ hơn vì segments là small requests
const hlsSegmentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300, // 300 segments/min = 5 segments/second
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// Image proxy rate limiter - chống abuse bandwidth qua image proxy
// 200 requests/min = ~3.3 req/sec, đủ cho browsing bình thường
const imageProxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Quá nhiều yêu cầu hình ảnh. Vui lòng thử lại sau.",
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000),
    });
  },
});

module.exports = {
  globalLimiter,
  loginLimiter,
  adminApiLimiter,
  suggestLimiter,
  reactLoginLimiter,
  translateLimiter,
  hlsProxyLimiter,
  hlsSegmentLimiter,
  imageProxyLimiter,
};
