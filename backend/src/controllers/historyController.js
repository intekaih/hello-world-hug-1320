const database = require("../database");
const logger = require("../utils/logger");

exports.saveWatchProgress = async (req, res) => {
  try {
    const {
      movieSlug,
      episodeSlug,
      currentTime,
      duration,
      movieName,
      movieThumb,
      movieOriginName,
    } = req.body;
    if (!movieSlug || !episodeSlug) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin" });
    }
    await database.saveWatchProgress(req.session.user.id, {
      movieSlug,
      episodeSlug,
      currentTime: parseInt(currentTime) || 0,
      duration: parseInt(duration) || 0,
      movieName,
      movieThumb,
      movieOriginName,
    });
    res.json({ success: true });
  } catch (err) {
    logger.error("history", "Lỗi lưu tiến trình", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

exports.getWatchProgress = async (req, res) => {
  try {
    const progress = await database.getWatchProgress(
      req.session.user.id,
      req.params.slug,
      req.params.episode,
    );
    res.json({ success: true, progress: progress || null });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.getLatestProgress = async (req, res) => {
  try {
    const progress = await database.getLatestMovieProgress(
      req.session.user.id,
      req.params.slug,
    );
    res.json({ success: true, progress: progress || null });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.deleteWatchHistoryItem = async (req, res) => {
  try {
    const deleted = await database.deleteWatchHistory(
      req.session.user.id,
      req.params.id,
    );
    res.json({ success: deleted });
  } catch (err) {
    logger.error("history", "Lỗi xoá history", err);
    res.status(500).json({ success: false });
  }
};

exports.clearWatchHistory = async (req, res) => {
  try {
    await database.clearWatchHistory(req.session.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.getHistoryPage = async (req, res) => {
  try {
    const perPage = 24;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const total = await database.countWatchHistory(req.session.user.id);
    const totalPages = Math.ceil(total / perPage);
    const history = await database.getWatchHistory(
      req.session.user.id,
      perPage,
      (page - 1) * perPage,
    );
    res.render("pages/history", {
      title: "Lịch sử xem - movieCC",
      history,
      totalHistory: total,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    logger.error("history", "Lỗi trang lịch sử", err);
    res.redirect(
      "/lich-su?msg=" +
        encodeURIComponent("Không thể tải lịch sử xem. Vui lòng thử lại.") +
        "&msgtype=error",
    );
  }
};
