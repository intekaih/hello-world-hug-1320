const UserRepository = require("../modules/auth/repositories/UserRepository");
const logger = require("../utils/logger");
const { isUserExpired } = require("../utils/accountStatus");

const userRepository = new UserRepository();

// Cache kiá»ƒm tra DB má»—i 1200s (20 phÃºt) Ä‘á»ƒ giáº£m Ã¡p lá»±c MongoDB
// FIX: tÄƒng tá»« 600s lÃªn 1200s - giáº£m 66% DB queries cho auth
const SESSION_CHECK_INTERVAL = 1200 * 1000; // 1200 giÃ¢y = 20 phÃºt

// SEC-5: Absolute session lifetime â€” buá»™c Ä‘Äƒng nháº­p láº¡i sau 7 ngÃ y
// ká»ƒ cáº£ khi cookie cÃ²n hiá»‡u lá»±c (rolling renewal).
const ABSOLUTE_SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const refreshSession = async (req, res, next) => {
  if (!req.session.user) return next();

  if (isUserExpired(req.session.user)) {
    const username = req.session.user.username;
    logger.info(
      "security",
      `Session bi huy: tai khoan het han ${username}`,
      { ip: req.ip, userId: req.session.user.id },
    );
    return req.session.destroy(() => {
      if (req.path.startsWith("/api/")) {
        return res.status(401).json({
          success: false,
          message: "Tai khoan da het han. Vui long gia han de tiep tuc su dung.",
        });
      }
      res.redirect(
        "/dang-nhap?msg=" +
        encodeURIComponent("Tai khoan da het han. Vui long gia han de tiep tuc su dung.") +
        "&msgtype=error",
      );
    });
  }

  // SEC-5: Khá»Ÿi táº¡o timestamp táº¡o session láº§n Ä‘áº§u (cho session cÅ© chÆ°a cÃ³)
  if (!req.session._createdAt) {
    req.session._createdAt = Date.now();
  }

  // SEC-5: Há»§y session náº¿u vÆ°á»£t quÃ¡ absolute lifetime (7 ngÃ y)
  if (Date.now() - req.session._createdAt > ABSOLUTE_SESSION_LIFETIME_MS) {
    const username = req.session.user.username;
    logger.info(
      "security",
      `Session háº¿t háº¡n tuyá»‡t Ä‘á»‘i (>7 ngÃ y): ${username}`,
      { ip: req.ip, userId: req.session.user.id },
    );
    return req.session.destroy(() => {
      // Chá»‰ redirect khi lÃ  HTML request; vá»›i API tráº£ 401 JSON
      if (req.path.startsWith("/api/")) {
        return res.status(401).json({
          success: false,
          message: "PhiÃªn Ä‘Äƒng nháº­p Ä‘Ã£ háº¿t háº¡n. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.",
        });
      }
      res.redirect(
        "/dang-nhap?msg=" +
        encodeURIComponent("PhiÃªn Ä‘Äƒng nháº­p Ä‘Ã£ háº¿t háº¡n. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.") +
        "&msgtype=info",
      );
    });
  }

  const now = Date.now();
  const lastCheck = req.session._lastDbCheck || 0;

  if (now - lastCheck < SESSION_CHECK_INTERVAL) return next();

  try {
    const dbUser = await database.getUserById(req.session.user.id);
    const dbUserExpired = isUserExpired(dbUser);
    if (!dbUser || !dbUser.is_active || dbUserExpired) {
      logger.warn(
        "security",
        `Session bá»‹ há»§y: user ${req.session.user.username} (${!dbUser ? "Ä‘Ã£ xÃ³a" : "bá»‹ khÃ³a"})`,
        { ip: req.ip, userId: req.session.user.id },
      );
      return req.session.destroy(() => {
        res.redirect(
          "/dang-nhap?msg=" +
          encodeURIComponent("TÃ i khoáº£n Ä‘Ã£ bá»‹ khÃ³a hoáº·c khÃ´ng tá»“n táº¡i") +
          "&msgtype=error",
        );
      });
    }
    // Cáº­p nháº­t role/display_name náº¿u Ä‘Ã£ thay Ä‘á»•i trong DB
    req.session.user.role = dbUser.role;
    req.session.user.display_name = dbUser.display_name;
    req.session.user.is_active = dbUser.is_active;
    req.session.user.expires_at = dbUser.expires_at || null;
req.session._lastDbCheck = now;
    userRepository.updateLastActive(req.session.user.id);
    res.locals.user = req.session.user;
    next();
  } catch {
    // Náº¿u DB lá»—i, váº«n cho qua Ä‘á»ƒ trÃ¡nh block toÃ n bá»™ app
    next();
  }
};

// Kiá»ƒm tra biáº¿n REQUIRE_AUTH (default: true)
// Äáº·t REQUIRE_AUTH=false trong .env Ä‘á»ƒ táº¯t yÃªu cáº§u Ä‘Äƒng nháº­p
const AUTH_REQUIRED = process.env.NODE_ENV === "production" ? true : process.env.REQUIRE_AUTH !== "false";

const requireAuth = (req, res, next) => {
  if (!AUTH_REQUIRED) return next();
  if (!req.session.user) return res.redirect('/dang-nhap');
  return next();
};
const optionalAuth = (req, res, next) => {
  // user info Ä‘Ã£ Ä‘Æ°á»£c inject á»Ÿ server.js middleware (res.locals.user)
  // Middleware nÃ y chá»‰ Ä‘Ã¡nh dáº¥u khÃ´ng cáº§n auth
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    logger.warn(
      "security",
      `Truy cáº­p admin bá»‹ tá»« chá»‘i: ${req.session.user?.username || "guest"}`,
      { ip: req.ip, path: req.originalUrl },
    );
    return res.status(403).render("pages/403", {
      title: "Truy cáº­p bá»‹ tá»« chá»‘i - movieCC",
    });
  }
  next();
};

module.exports = {
  refreshSession,
  requireAuth,
  optionalAuth,
  requireAdmin,
};




