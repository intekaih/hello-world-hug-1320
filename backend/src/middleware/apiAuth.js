/**
 * API Auth middleware — JSON responses for React app (không redirect về HTML)
 */

const { isUserExpired } = require("../utils/accountStatus");

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Chưa đăng nhập" });
  }
  if (isUserExpired(req.session.user)) {
    return req.session.destroy(() => {
      res.status(401).json({
        success: false,
        message: "Tai khoan da het han. Vui long gia han de tiep tuc su dung.",
      });
    });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Không có quyền truy cập" });
  }
  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
};
