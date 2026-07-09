const express = require("express");
const router = express.Router();
const { useNewAdminModule } = require("../core/config/features");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { body } = require("express-validator");
const { doubleCsrfProtection } = require("../middleware/csrf");

let adminController;
let feedbackController;

if (useNewAdminModule) {
  const { adminController: ac, feedbackController: fc } = require("../core/di/container");
  adminController = ac;
  feedbackController = fc;
} else {
  adminController = require("../controllers/adminController");
  feedbackController = require("../controllers/feedbackController");
}

// Admin Pages
router.get("/", requireAuth, requireAdmin, adminController.getDashboard);
router.get("/users", requireAuth, requireAdmin, adminController.getUsers);
router.get("/feedbacks", requireAuth, requireAdmin, adminController.getFeedbacksPage || feedbackController.getAdminFeedbackPage);

const { adminApiLimiter } = require("../middleware/rateLimit");

// Admin APIs for User Management
router.post(
  "/api/users",
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  doubleCsrfProtection,
  [
    body("username")
      .isAlphanumeric()
      .withMessage("Username chỉ chứa chữ và số")
      .isLength({ min: 3 })
      .withMessage("Username tối thiểu 3 ký tự"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu tối thiểu 6 ký tự"),
    body("display_name")
      .notEmpty()
      .withMessage("Tên hiển thị không được để trống"),
    body("expires_at")
      .optional({ nullable: true })
      .isISO8601()
      .withMessage("Ngày hết hạn không hợp lệ"),
    body("account_source")
      .optional()
      .isIn(["manual", "business_api"])
      .withMessage("Nguồn tài khoản không hợp lệ"),
    body("plan")
      .optional()
      .isLength({ max: 50 })
      .withMessage("Gói tối đa 50 ký tự"),
  ],
  adminController.createUser,
);

router.put(
  "/api/users/:id",
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  doubleCsrfProtection,
  [
    body("username")
      .optional()
      .isAlphanumeric()
      .withMessage("Username chỉ chứa chữ và số")
      .isLength({ min: 3 })
      .withMessage("Username tối thiểu 3 ký tự"),
    body("password")
      .optional()
      .isLength({ min: 6 })
      .withMessage("Mật khẩu tối thiểu 6 ký tự"),
    body("display_name")
      .optional()
      .notEmpty()
      .withMessage("Tên hiển thị không được để trống"),
  ],
  adminController.updateUser,
);

router.delete(
  "/api/users/:id",
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  doubleCsrfProtection,
  adminController.deleteUser,
);

router.patch(
  "/api/users/:id/toggle-status",
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  doubleCsrfProtection,
  adminController.toggleUserStatus,
);

router.post(
  "/api/users/:id/reset-password",
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  doubleCsrfProtection,
  adminController.resetPassword,
);

router.post(
  "/api/feedback/:id/read",
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  doubleCsrfProtection,
  feedbackController.markRead,
);

router.delete(
  "/api/feedback/:id",
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  doubleCsrfProtection,
  feedbackController.deleteFeedback,
);

// Health & diagnostic endpoints for distributed PM2 monitoring
// Protected by HEALTH_SECRET header - only accessible by authorized monitoring systems
router.get("/api/health", (req, res) => {
  const healthSecret = process.env.HEALTH_SECRET;
  if (healthSecret && req.headers["x-health-secret"] !== healthSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const os = require("os");
    const memUsage = process.memoryUsage();
    const memInfo = {
      rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + "MB",
      external: Math.round(memUsage.external / 1024 / 1024) + "MB",
    };

    const uptime = process.uptime();
    const uptimeStr = uptime < 60 ? `${Math.round(uptime)}s`
      : uptime < 3600 ? `${Math.round(uptime / 60)}m`
      : `${Math.round(uptime / 3600)}h ${Math.round((uptime % 3600) / 60)}m`;

    res.json({
      status: "ok",
      node: os.hostname(),
      uptime: uptimeStr,
      platform: process.platform,
      nodeVersion: process.version,
      memory: memInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Health check failed", detail: err.message });
  }
});

module.exports = router;
