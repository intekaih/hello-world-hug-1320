const { doubleCsrf } = require("csrf-csrf");

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  console.error(
    "[FATAL] Missing SESSION_SECRET in production. Set a strong random key in .env",
  );
  process.exit(1);
}

const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET || "moviecc_dev_csrf_secret",
  cookieName: "x-csrf-token-v2",
  cookieOptions: {
    httpOnly: true,
    // sameSite intentionally omitted: many TV browsers (Samsung, LG, Android TV
    // WebKit) do not handle SameSite=Lax correctly and drop the cookie between
    // GET and POST on the same origin, causing spurious 403 errors.
    // Security is maintained by the double-submit pattern (httpOnly cookie +
    // signed token in body) — an attacker cannot read the httpOnly cookie value.
    sameSite: false,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
  getTokenFromRequest: (req) => {
    // Token từ body (form) hoặc header (AJAX)
    return req.body._csrf || req.headers["x-csrf-token"];
  },
});

const handleCsrfError = (err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    res.clearCookie("x-csrf-token-v2");

    if (req.path.startsWith("/api")) {
      return res.status(403).json({
        success: false,
        error: "Phiên hết hạn. Vui lòng tải lại trang.",
      });
    }

    // For the login form specifically, redirect back with a clear error
    // so the browser gets a fresh CSRF token on the next GET request.
    if (req.path === "/dang-nhap") {
      return res.redirect("/dang-nhap?csrf_error=1");
    }

    return res.status(403).render("pages/403", {
      title: "Phiên hết hạn - movieCC",
      csrfExpired: true,
      currentPath: req.path || "/",
      user: (req.session && req.session.user) || null,
    });
  }
  next(err);
};

module.exports = {
  doubleCsrfProtection,
  generateToken,
  handleCsrfError,
};
