const database = require("../database");
const { validationResult } = require("express-validator");
const logger = require("../utils/logger");
const { isUserExpired } = require("../utils/accountStatus");

exports.getLogin = (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("pages/login", { title: "Đăng nhập - movieCC", layout: false, query: req.query });
};

exports.getForgotPassword = (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("pages/forgot-password", {
    title: "Quên mật khẩu - movieCC",
    layout: false,
  });
};

exports.postLogin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("pages/login", {
        title: "Đăng nhập - movieCC",
        layout: false,
        error: errors.array()[0].msg,
      });
    }

    const isDev = process.env.NODE_ENV !== "production";
    const skipTurnstile = isDev && !process.env.FORCE_TURNSTILE;
    const turnstileToken = req.body["cf-turnstile-response"];

    if (!skipTurnstile) {
      if (!turnstileToken) {
        return res.render("pages/login", {
          title: "Đăng nhập - movieCC",
          layout: false,
          error: "Vui lòng xác thực bạn là con người",
        });
      }

      if (process.env.TURNSTILE_SECRET_KEY) {
        const verifyForm = new URLSearchParams();
        verifyForm.append("secret", process.env.TURNSTILE_SECRET_KEY);
        verifyForm.append("response", turnstileToken);

        try {
          const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            body: verifyForm,
          });
          const turnstileData = await turnstileRes.json();
          if (!turnstileData.success) {
            return res.render("pages/login", {
              title: "Đăng nhập - movieCC",
              layout: false,
              error: "Xác minh bị từ chối, vui lòng thử lại.",
            });
          }
        } catch (err) {
          logger.error("auth", "Lỗi Turnstile verify", err);
          return res.render("pages/login", {
            title: "Đăng nhập - movieCC",
            layout: false,
            error: "Không thể xác thực, vui lòng thử lại.",
          });
        }
      }
    }

    const { username, password } = req.body;
    const user = await database.findUserByUsername(username);

    if (
      user &&
      (await database.verifyPassword(password, user.password)) &&
      user.is_active &&
      !isUserExpired(user)
    ) {
      return req.session.regenerate((regenErr) => {
        if (regenErr) {
          logger.error(
            "security",
            `Đăng nhập thất bại (session regenerate): ${username}`,
            { ip: req.ip, userId: user.id, error: regenErr.message },
          );
          return res.render("pages/login", {
            title: "Đăng nhập - movieCC",
            layout: false,
            error: "Không thể tạo phiên đăng nhập. Vui lòng thử lại.",
          });
        }
        req.session.user = {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          role: user.role,
          expires_at: user.expires_at || null,
        };
        return req.session.save((err) => {
          if (err) {
            logger.error(
              "security",
              `Đăng nhập thất bại (session save): ${username}`,
              { ip: req.ip, userId: user.id, error: err.message },
            );
            return res.render("pages/login", {
              title: "Đăng nhập - movieCC",
              layout: false,
              error: "Không thể tạo phiên đăng nhập. Vui lòng thử lại.",
            });
          }
          logger.info("security", `Đăng nhập thành công: ${username}`, {
            ip: req.ip,
            userId: user.id,
          });
          res.redirect("/");
        });
      });
    }

    const reason = !user
      ? "user_not_found"
      : !user.is_active
        ? "account_disabled"
        : isUserExpired(user)
          ? "account_expired"
        : "wrong_password";
    logger.warn("security", `Đăng nhập thất bại: ${username} (${reason})`, {
      ip: req.ip,
    });
    res.render("pages/login", {
      title: "Đăng nhập - movieCC",
      layout: false,
      error: "Sai tài khoản hoặc mật khẩu",
    });
  } catch (err) {
    logger.error("auth", "Lỗi đăng nhập", err);
    res.render("pages/login", {
      title: "Đăng nhập - movieCC",
      layout: false,
      error: "Đã xảy ra lỗi, vui lòng thử lại",
    });
  }
};

exports.logout = (req, res) => {
  const username = req.session.user?.username || "unknown";
  logger.info("security", `Đăng xuất: ${username}`, { ip: req.ip });
  req.session.destroy((err) => {
    if (err) logger.error("auth", "Session destroy error", err);
    res.redirect("/dang-nhap");
  });
};

exports.getProfile = async (req, res) => {
  try {
    const user = await database.getUserById(req.session.user.id);
    res.render("pages/profile", {
      title: "Hồ sơ - movieCC",
      profileUser: user,
    });
  } catch (err) {
    logger.error("auth", "Lỗi trang hồ sơ", err);
    res.redirect(
      "/ho-so?msg=" + encodeURIComponent("Không thể tải hồ sơ. Vui lòng thử lại.") + "&msgtype=error",
    );
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    const user = await database.getUserById(req.session.user.id);

    if (!errors.isEmpty()) {
      return res.render("pages/profile", {
        title: "Hồ sơ - movieCC",
        profileUser: user,
        error: errors.array()[0].msg,
      });
    }

    const { display_name, current_password, new_password, confirm_password } =
      req.body;
    const updateData = { display_name };

    if (new_password) {
      if (!current_password) {
        return res.render("pages/profile", {
          title: "Hồ sơ - movieCC",
          profileUser: user,
          error: "Vui lòng nhập mật khẩu hiện tại",
        });
      }
      if (!(await database.verifyPassword(current_password, user.password))) {
        return res.render("pages/profile", {
          title: "Hồ sơ - movieCC",
          profileUser: user,
          error: "Mật khẩu hiện tại không đúng",
        });
      }
      if (new_password.length < 6) {
        return res.render("pages/profile", {
          title: "Hồ sơ - movieCC",
          profileUser: user,
          error: "Mật khẩu mới phải có ít nhất 6 ký tự",
        });
      }
      if (new_password !== confirm_password) {
        return res.render("pages/profile", {
          title: "Hồ sơ - movieCC",
          profileUser: user,
          error: "Mật khẩu xác nhận không khớp",
        });
      }
      updateData.password = new_password;
    }

    await database.updateUser(req.session.user.id, updateData);
    logger.info(
      "security",
      `Cập nhật hồ sơ: user_${req.session.user.id}${new_password ? " (credentials_changed)" : ""}`,
      { userId: req.session.user.id },
    );

    req.session.user.display_name = display_name;
    req.session.save((err) => {
      if (err) {
        logger.error("auth", "Session save error sau cập nhật hồ sơ", err);
        return res.redirect(
          "/ho-so?msg=" +
            encodeURIComponent(
              "Cập nhật thành công nhưng phiên có lỗi. Vui lòng đăng nhập lại.",
            ) +
            "&msgtype=error",
        );
      }
      res.redirect(
        "/ho-so?msg=" +
          encodeURIComponent("Cập nhật hồ sơ thành công!") +
          "&msgtype=success",
      );
    });
  } catch (err) {
    logger.error("auth", "Lỗi cập nhật hồ sơ", err);
    res.redirect(
      "/ho-so?msg=" +
        encodeURIComponent("Đã xảy ra lỗi khi cập nhật") +
        "&msgtype=error",
    );
  }
};
