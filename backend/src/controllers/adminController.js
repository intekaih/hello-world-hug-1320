const database = require("../database");
const logger = require("../utils/logger");
const { validationResult } = require("express-validator");
const { logAdminAction, ADMIN_ACTIONS } = require("../utils/adminAudit");

exports.getDashboard = async (req, res) => {
  try {
    const [stats, viewStats, onlineUsers] = await Promise.all([
      database.getUserStats(),
      database.getViewStats(),
      database.countOnlineUsers(5),
    ]);

    res.render("admin/dashboard", {
      title: "Bảng điều khiển - movieCC",
      stats: {
        totalUsers: stats.totalUsers,
        activeUsers: stats.activeUsers,
        onlineUsers,
        totalViews: viewStats.totalViews,
        todayViews: viewStats.todayViews,
        uniqueIPs: viewStats.uniqueIPs,
        botViews: viewStats.botViews,
      },
      recentUsers: stats.recentUsers,
    });
  } catch (err) {
    logger.error("admin", "Lỗi tải dashboard", err);
    res.status(500).render("pages/500", {
      title: "Lỗi máy chủ - movieCC",
      error: process.env.NODE_ENV === "development" ? err.message : null,
    });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const search = (req.query.q || "").trim();
    const [users, totalUsers] = await Promise.all([
      database.getUsers(page, limit, search),
      database.countUsers(search),
    ]);
    const totalPages = Math.ceil(totalUsers / limit);
    res.render("admin/users", {
      title: "Quản lý tài khoản - movieCC",
      users,
      currentPage: page,
      totalPages,
      totalUsers,
      searchQuery: search,
    });
  } catch (err) {
    logger.error("admin", "Lỗi tải danh sách users", err);
    res.status(500).render("pages/500", {
      title: "Lỗi máy chủ - movieCC",
      error: process.env.NODE_ENV === "development" ? err.message : null,
    });
  }
};

exports.createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ success: false, message: errors.array()[0].msg });
    }

    const { username, password, display_name, role } = req.body;
    const VALID_ROLES = ["user", "admin"];

    if (!username || !password || !display_name) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin bắt buộc" });
    }

    const safeRole = VALID_ROLES.includes(role) ? role : "user";

    if (await database.findUserByUsername(username)) {
      return res
        .status(400)
        .json({ success: false, message: "Tên đăng nhập đã tồn tại" });
    }

    const newUser = await database.createUser({
      username,
      password,
      display_name,
      role: safeRole,
    });
    logger.info(
      "security",
      `Admin tạo tài khoản: ${username} (role: ${safeRole})`,
      {
        ip: req.ip,
        adminId: req.session.user.id,
        admin: req.session.user.username,
      },
    );
    await logAdminAction(req, ADMIN_ACTIONS.CREATE_USER, 'USER', newUser.id, { username, role: safeRole });
    const { password: _, ...safeUser } = newUser;
    res.json({
      success: true,
      message: "Tạo tài khoản thành công",
      user: safeUser,
    });
  } catch (err) {
    logger.error("admin", "Lỗi tạo tài khoản", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ, vui lòng thử lại" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ success: false, message: errors.array()[0].msg });
    }

    const id = req.params.id;

    const ALLOWED_FIELDS = [
      "username",
      "password",
      "display_name",
      "role",
      "is_active",
    ];
    const VALID_ROLES = ["user", "admin"];
    const updates = {};
    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.role && !VALID_ROLES.includes(updates.role)) {
      return res
        .status(400)
        .json({ success: false, message: "Role không hợp lệ" });
    }

    if (updates.username) {
      const existing = await database.findUserByUsername(updates.username);
      if (existing && existing.id !== id) {
        return res
          .status(400)
          .json({ success: false, message: "Tên đăng nhập đã tồn tại" });
      }
    }

    const updated = await database.updateUser(id, updates);
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const changedFields = Object.keys(updates).filter((k) => k !== "password");
    if (updates.password) changedFields.push("password");
    logger.info(
      "security",
      `Admin cập nhật user ${id}: [${changedFields.join(", ")}]`,
      {
        ip: req.ip,
        adminId: req.session.user.id,
        admin: req.session.user.username,
      },
    );
    await logAdminAction(req, ADMIN_ACTIONS.UPDATE_USER, 'USER', id, { changedFields, updates });
    if (req.session.user && String(req.session.user.id) === String(id)) {
      if (updates.username) req.session.user.username = updates.username;
      if (updates.display_name !== undefined) req.session.user.display_name = updates.display_name;
      if (updates.role) req.session.user.role = updates.role;
      req.session.save(() => {});
    }

    const { password: _, ...safeUser } = updated;
    res.json({ success: true, message: "Cập nhật thành công", user: safeUser });
  } catch (err) {
    logger.error("admin", "Lỗi cập nhật tài khoản", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ, vui lòng thử lại" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const id = req.params.id;

    if (req.session.user.id === id) {
      logger.warn("security", `Admin tự xóa chính mình bị chặn`, {
        ip: req.ip,
        adminId: req.session.user.id,
        admin: req.session.user.username,
      });
      return res.status(400).json({
        success: false,
        message: "Không thể xóa tài khoản của chính mình",
      });
    }

    const userToDelete = await database.getUserById(id);
    if (userToDelete && userToDelete.role === "admin") {
      const adminCount = await database.countAdmins();
      if (adminCount <= 1) {
        logger.warn(
          "security",
          `Xóa admin cuối cùng bị chặn: ${userToDelete.username}`,
          {
            ip: req.ip,
            adminId: req.session.user.id,
            admin: req.session.user.username,
          },
        );
        return res.status(400).json({
          success: false,
          message: "Không thể xóa tài khoản admin cuối cùng",
        });
      }
    }

    const deleted = await database.deleteUser(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    logger.info(
      "security",
      `Admin xóa user ${id} (${userToDelete?.username || "unknown"})`,
      {
        ip: req.ip,
        adminId: req.session.user.id,
        admin: req.session.user.username,
      },
    );
    await logAdminAction(req, ADMIN_ACTIONS.DELETE_USER, 'USER', id, { username: userToDelete?.username });
    res.json({ success: true, message: "Xóa tài khoản thành công" });
  } catch (err) {
    logger.error("admin", "Lỗi xóa tài khoản", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ, vui lòng thử lại" });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const user = await database.getUserById(id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    if (req.session.user.id === id) {
      logger.warn("security", `Admin tự khóa chính mình bị chặn`, {
        ip: req.ip,
        adminId: req.session.user.id,
        admin: req.session.user.username,
      });
      return res.status(400).json({
        success: false,
        message: "Không thể vô hiệu hóa tài khoản của chính mình",
      });
    }

    if (user.role === "admin" && user.is_active) {
      const activeAdminCount = await database.countAdmins(true);
      if (activeAdminCount <= 1) {
        logger.warn(
          "security",
          `Khóa admin hoạt động cuối cùng bị chặn: ${user.username}`,
          {
            ip: req.ip,
            adminId: req.session.user.id,
            admin: req.session.user.username,
          },
        );
        return res.status(400).json({
          success: false,
          message: "Không thể khóa tài khoản admin hoạt động cuối cùng",
        });
      }
    }

    const updated = await database.updateUser(id, {
      is_active: !user.is_active,
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }
    logger.info(
      "security",
      `Admin ${!user.is_active ? "kích hoạt" : "khóa"} user ${id} (${user.username})`,
      {
        ip: req.ip,
        adminId: req.session.user.id,
        admin: req.session.user.username,
      },
    );
    await logAdminAction(req, ADMIN_ACTIONS.TOGGLE_USER_STATUS, 'USER', id, {
      action: !user.is_active ? 'ACTIVATE' : 'DEACTIVATE',
      username: user.username
    });
    const { password: _, ...safeUser } = updated;
    res.json({
      success: true,
      message: "Cập nhật trạng thái thành công",
      user: safeUser,
    });
  } catch (err) {
    logger.error("admin", "Lỗi cập nhật trạng thái tài khoản", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ, vui lòng thử lại" });
  }
};

// Reset mật khẩu về mật khẩu tạm — chỉ admin dùng, trả về plaintext 1 lần duy nhất
exports.resetPassword = async (req, res) => {
  try {
    const id = req.params.id;

    if (req.session.user.id === id) {
      return res.status(400).json({
        success: false,
        message:
          "Không thể reset mật khẩu của chính mình qua chức năng này. Hãy dùng trang Hồ sơ.",
      });
    }

    const result = await database.resetUserPasswordToTemp(id);
    if (!result) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    logger.info(
      "security",
      `Admin reset mật khẩu cho user ${id} (${result.user.username})`,
      {
        ip: req.ip,
        adminId: req.session.user.id,
        admin: req.session.user.username,
      },
    );
    await logAdminAction(req, ADMIN_ACTIONS.RESET_PASSWORD, 'USER', id, { username: result.user.username });

    res.json({
      success: true,
      message: "Đặt lại mật khẩu thành công",
      tempPassword: result.tempPassword,
      username: result.user.username,
      display_name: result.user.display_name,
    });
  } catch (err) {
    logger.error("admin", "Lỗi reset mật khẩu", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ, vui lòng thử lại" });
  }
};
