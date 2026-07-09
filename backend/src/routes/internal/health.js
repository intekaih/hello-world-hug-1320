/**
 * Internal Health Route - Extracted from server.js
 * Handles /health endpoint with production security
 */

const express = require("express");
const router = express.Router();
const crypto = require("crypto");

// SEC-7: Health endpoint — production yêu cầu HEALTH_SECRET (header X-Health-Secret
// hoặc query ?secret=...). Dev mở cho dễ debug.
// Fail-closed: prod mà thiếu HEALTH_SECRET env → trả 404 và log lỗi cấu hình.
router.get("/health", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    const expected = process.env.HEALTH_SECRET;
    if (!expected) {
      console.error("[SEC-7] /health requested in production nhưng HEALTH_SECRET chưa cấu hình — endpoint bị ẩn (404).");
      return res.status(404).end();
    }
    const provided =
      req.get("X-Health-Secret") ||
      req.query.secret ||
      "";
    // timingSafeEqual để chống timing attack
    let ok = false;
    try {
      const a = Buffer.from(String(provided));
      const b = Buffer.from(expected);
      ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch { ok = false; }
    if (!ok) return res.status(404).end(); // Trả 404 thay vì 401 để giấu sự tồn tại
  }

  // Lazy-load database only when needed
  const database = require("../../database");
  try {
    await database.ping();
    res.json({ status: "ok" });
  } catch (err) {
    res.status(503).json({ status: "degraded" });
  }
});

module.exports = router;