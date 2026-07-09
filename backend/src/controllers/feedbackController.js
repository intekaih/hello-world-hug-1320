const database = require("../database");
const logger = require("../utils/logger");

const FEEDBACK_ENABLED = process.env.ENABLE_FEEDBACK !== "false";

/**
 * GET /gop-y — Trang feedback form
 */
exports.getFeedbackPage = (req, res) => {
    if (!FEEDBACK_ENABLED) {
        return res.status(404).render("pages/404", { title: "Không tìm thấy - movieCC" });
    }
    res.render("pages/feedback", {
        title: "Góp ý & Phản hồi - movieCC",
        success: req.query.success === "1",
    });
};

/**
 * POST /api/feedback — Submit feedback
 */
exports.submitFeedback = async (req, res) => {
    if (!FEEDBACK_ENABLED) {
        return res.status(404).json({ error: "Tính năng đã tắt" });
    }

    try {
        const { name, email, category, message, movieSlug } = req.body;

        // Validate
        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Vui lòng nhập tên" });
        }
        if (!message || !message.trim() || message.trim().length < 10) {
            return res.status(400).json({ error: "Nội dung phải có ít nhất 10 ký tự" });
        }
        if (message.length > 2000) {
            return res.status(400).json({ error: "Nội dung tối đa 2000 ký tự" });
        }

        await database.createFeedback({
            name: name.trim(),
            email: email ? email.trim() : null,
            category: category || "other",
            message: message.trim(),
            movieSlug: movieSlug || null,
            userId: req.session.user ? req.session.user.id : null,
            ip: req.ip,
        });

        logger.info("feedback", `Feedback mới từ: ${name.trim()}`);
        res.json({ success: true, message: "Cảm ơn bạn đã gửi góp ý!" });
    } catch (err) {
        if (err.message === "RATE_LIMIT") {
            return res.status(429).json({ error: "Bạn đã gửi quá nhiều. Vui lòng thử lại sau 1 giờ." });
        }
        logger.error("feedback", "Lỗi gửi feedback", err);
        res.status(500).json({ error: "Có lỗi xảy ra, vui lòng thử lại" });
    }
};

/**
 * GET /admin/feedbacks — Admin xem danh sách feedback (HTML)
 */
exports.getAdminFeedbackPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const data = await database.getFeedbacks(page, limit);
        const unread = await database.countUnreadFeedbacks();
        res.render("admin/feedbacks", {
            title: "Quản lý Góp ý - Admin",
            feedbacks: data.feedbacks,
            currentPage: page,
            totalPages: data.totalPages,
            totalCount: data.total,
            unreadCount: unread,
        });
    } catch (err) {
        logger.error("feedback", "Lỗi getAdminFeedbackPage", err);
        res.status(500).render("pages/error", { title: "Lỗi Server" });
    }
};

/**
 * GET /api/admin/feedbacks — Admin xem danh sách feedback (JSON)
 */
exports.getAdminFeedbacks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const data = await database.getFeedbacks(page, 20);
        const unread = await database.countUnreadFeedbacks();
        res.json({ ...data, unread });
    } catch (err) {
        logger.error("feedback", "Lỗi lấy feedbacks", err);
        res.status(500).json({ error: "Lỗi server" });
    }
};

/**
 * POST /api/admin/feedback/:id/read — Đánh dấu đã đọc
 */
exports.markRead = async (req, res) => {
    try {
        await database.markFeedbackRead(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Lỗi server" });
    }
};

/**
 * DELETE /api/admin/feedback/:id — Xóa feedback
 */
exports.deleteFeedback = async (req, res) => {
    try {
        const deleted = await database.deleteFeedback(req.params.id);
        res.json({ success: deleted });
    } catch (err) {
        res.status(500).json({ error: "Lỗi server" });
    }
};
