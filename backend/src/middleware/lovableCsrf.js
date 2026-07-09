/**
 * Lovable CSRF Bypass Middleware
 *
 * Lovable FE sử dụng client-generated CSRF token trong cookie `csrf_token`
 * (double-submit cookie pattern) thay vì server-signed token như csrf-csrf lib.
 * Cơ chế này vẫn an toàn nếu kết hợp với:
 *   1. Same-Origin / Origin/Referer header check
 *   2. httpOnly session cookie
 *   3. SameSite=Lax cookie attribute
 *
 * Middleware này wrap `doubleCsrfProtection`:
 *   - Nếu request đến từ Lovable origin (allowedOrigins Lovable) VÀ có cookie
 *     `csrf_token` + header `X-CSRF-Token` match → bypass CSRF
 *   - Ngược lại → dùng default doubleCsrfProtection
 *
 * Mount: chỉ áp dụng cho /api/react/* (KHÔNG áp dụng cho EJS form routes).
 */

const { doubleCsrfProtection } = require("./csrf");
const { timingSafeEqual } = require("crypto");

// Lovable origin patterns
const LOVABLE_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https:\/\/localhost$/,
  /^capacitor:\/\/localhost$/,
  /\.lovable\.app$/,
];

function isLovableOrigin(origin) {
  if (!origin) return false;
  return LOVABLE_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

function isProductionLovableOrigin(origin) {
  if (!origin) return false;
  return origin.endsWith(".lovable.app") || origin === "https://hello-world-hug-1320.lovable.app";
}

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Kiểm tra double-submit cookie pattern:
 * - Cookie `csrf_token` phải tồn tại
 * - Header `X-CSRF-Token` phải khớp cookie value
 * - Origin phải là Lovable trusted
 */
function verifyLovableDoubleSubmit(req) {
  const origin = req.headers.origin;
  const isDev = process.env.NODE_ENV !== "production";
  const originOk = isDev
    ? isLovableOrigin(origin)
    : isProductionLovableOrigin(origin);
  if (!originOk) return false;

  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers["x-csrf-token"];
  if (!cookieToken || !headerToken) return false;
  return safeEqual(cookieToken, headerToken);
}

/**
 * Middleware: bypass csrf-csrf cho Lovable, fallback cho non-Lovable.
 * Dùng trong apiRouter thay cho `doubleCsrfProtection` trực tiếp.
 */
function lovableCsrfProtection(req, res, next) {
  // Chỉ áp dụng cho non-GET methods
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  // Path bắt đầu bằng /api/react → Lovable path
  const isReactPath = req.path.startsWith("/auth") ||
                      req.path.startsWith("/favorites") ||
                      req.path.startsWith("/watchlist") ||
                      req.path.startsWith("/history") ||
                      req.path.startsWith("/notifications") ||
                      req.path.startsWith("/translate") ||
                      req.path.startsWith("/feedback");

  if (isReactPath && verifyLovableDoubleSubmit(req)) {
    return next();
  }

  // Fallback csrf-csrf (EJS forms hoặc invalid Lovable request)
  return doubleCsrfProtection(req, res, next);
}

module.exports = {
  lovableCsrfProtection,
  verifyLovableDoubleSubmit,
  isLovableOrigin,
};
