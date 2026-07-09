const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  const status = err.status ?? err.statusCode ?? 500;

  const requestContext = {
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection?.remoteAddress,
    sessionID: req.sessionID || null,
    userId: req.session?.user?.id || null,
    errMessage: err.message,
    errCode: err.code,
    errStack: err.stack || null,
  };
  logger.error("server", `${req.method} ${req.path} ${status}`, requestContext);

  if (res.headersSent) return next(err);

  const locals = {
    currentPath: req.path || "/",
    user: (req.session && req.session.user) || null,
  };

  if (status === 404) {
    return res.status(404).render("pages/404", {
      title: "Không tìm thấy trang - movieCC",
      ...locals,
    });
  }
  if (status === 403) {
    return res.status(403).render("pages/403", {
      title: "Truy cập bị từ chối - movieCC",
      ...locals,
    });
  }
  // SEC-8: Production luôn ẩn err.message (có thể leak path/stack).
  // Chỉ expose chi tiết khi NODE_ENV === 'development'.
  const isDev = process.env.NODE_ENV === "development";
  const safeErr = isDev ? err.message : null;

  if (status === 400) {
    // API requests nhận JSON, browser requests nhận trang lỗi
    if (req.path.startsWith("/api") || req.xhr) {
      return res.status(400).json({
        success: false,
        message: isDev ? (err.message || "Yêu cầu không hợp lệ") : "Yêu cầu không hợp lệ",
      });
    }
    return res.status(400).render("pages/400", {
      title: "Yêu cầu không hợp lệ - movieCC",
      error: safeErr,
      ...locals,
    });
  }

  // 500 — API trả JSON tối giản, EJS render trang lỗi
  if (req.path.startsWith("/api") || req.xhr) {
    return res.status(500).json({
      success: false,
      message: isDev ? (err.message || "Lỗi máy chủ") : "Lỗi máy chủ",
    });
  }

  res.status(500).render("pages/500", {
    title: "Lỗi máy chủ - movieCC",
    error: safeErr,
    ...locals,
  });
};

module.exports = errorHandler;
