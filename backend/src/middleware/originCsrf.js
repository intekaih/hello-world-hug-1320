/**
 * Origin-based CSRF protection for JSON APIs (React/Capacitor).
 *
 * Cách hoạt động:
 * - Kiểm tra header Origin hoặc Referer của mỗi request state-changing (POST/PUT/PATCH/DELETE).
 * - Nếu Origin/Referer không khớp với SITE_URL hoặc localhost → từ chối.
 * - JSON APIs không dùng cookie-based double submit vì React app gửi
 *   request qua fetch() với credentials: 'include'.
 *
 * Lý do dùng Origin-check thay vì CSRF token cho React API:
 * - React app là SPA, không render EJS → không có cách inject token vào HTML.
 * - Origin header không thể giả mạo bởi trình duyệt (browser-enforced).
 * - Capacitor (mobile) cũng set Origin header đúng.
 */

const logger = require("../utils/logger");

// Whitelist các origin hợp lệ
const ALLOWED_ORIGINS = new Set([
  "https://moviecc.app",
  "https://www.moviecc.app",
  "http://localhost:3000",
  "http://localhost:5173", // Vite dev server
  "http://localhost:4173", // Vite preview
  "capacitor://localhost",  // Capacitor iOS
  "http://localhost",       // Capacitor Android
]);

// Thêm SITE_URL nếu có
if (process.env.SITE_URL) {
  ALLOWED_ORIGINS.add(process.env.SITE_URL);
}

function extractOrigin(req) {
  // Ưu tiên Origin header (chính xác hơn)
  if (req.headers.origin) return req.headers.origin;

  // Fallback: Referer header (có path, cần bóc tách)
  const referer = req.headers.referer;
  if (referer) {
    try {
      const u = new URL(referer);
      return u.origin;
    } catch {
      return null;
    }
  }
  return null;
}

function originCsrfProtection(req, res, next) {
  // Chỉ kiểm tra state-changing methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  // Bypass trong môi trường test
  if (process.env.NODE_ENV === "test") return next();

  const origin = extractOrigin(req);

  // Nếu không có Origin/Referer → từ chối (fail-closed)
  if (!origin) {
    logger.warn("security", `CSRF blocked: no Origin/Referer`, {
      ip: req.ip,
      method: req.method,
      path: req.originalUrl,
    });
    return res.status(403).json({
      success: false,
      error: "Yêu cầu không hợp lệ. Vui lòng tải lại trang.",
    });
  }

  if (!ALLOWED_ORIGINS.has(origin)) {
    logger.warn("security", `CSRF blocked: invalid Origin ${origin}`, {
      ip: req.ip,
      method: req.method,
      path: req.originalUrl,
    });
    return res.status(403).json({
      success: false,
      error: "Nguồn yêu cầu không được phép.",
    });
  }

  next();
}

module.exports = { originCsrfProtection };
