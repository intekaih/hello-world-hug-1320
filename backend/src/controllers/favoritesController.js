const database = require("../database");
const logger = require("../utils/logger");

// Toggle favorite (add/remove) — tối ưu: thử xóa trước, nếu không có thì thêm
function sanitizeStr(val) {
  if (typeof val !== "string") return "";
  return val
    .replace(/[<>"'&]/g, "")
    .trim()
    .substring(0, 500);
}

function sanitizeUrl(val) {
  if (typeof val !== "string") return "";
  val = val.trim();
  if (
    val &&
    !val.startsWith("/") &&
    !val.startsWith("http://") &&
    !val.startsWith("https://")
  )
    return "";
  return val.replace(/["'<>]/g, "").substring(0, 1000);
}

exports.toggleFavorite = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const movieSlug = sanitizeStr(req.body.movieSlug);
    const movieName = sanitizeStr(req.body.movieName);
    const movieThumb = sanitizeUrl(req.body.movieThumb);
    const movieOriginName = sanitizeStr(req.body.movieOriginName);
    const lastEpisode = sanitizeStr(req.body.lastEpisode);

    if (!movieSlug) return res.status(400).json({ error: "Thiếu movieSlug" });

    // Thử xóa trước — nếu đã có thì xóa, chỉ 1 query
    const removed = await database.removeFavorite(userId, movieSlug);
    if (removed) {
      res.json({ status: "removed", isFavorite: false });
    } else {
      // Chưa có trong favorites → thêm mới
      await database.addFavorite(userId, {
        movieSlug,
        movieName,
        movieThumb,
        movieOriginName,
        lastEpisode,
      });
      res.json({ status: "added", isFavorite: true });
    }
  } catch (err) {
    logger.error("favorites", "Lỗi toggle favorite", err);
    res.status(500).json({ error: "Lỗi server" });
  }
};

// Check if movie is favorited
exports.checkFavorite = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const isFav = await database.isFavorite(userId, req.params.slug);
    res.json({ isFavorite: isFav });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
};

// Get all favorites
exports.getFavorites = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const favorites = await database.getFavorites(userId);
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
};

// Get favorites page
exports.getFavoritesPage = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const perPage = 24;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const total = await database.countFavorites(userId);
    const totalPages = Math.ceil(total / perPage);
    const favorites = await database.getFavorites(
      userId,
      perPage,
      (page - 1) * perPage,
    );

    res.render("pages/favorites", {
      title: "Phim yêu thích - movieCC",
      favorites,
      totalFavorites: total,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    logger.error("favorites", "Lỗi trang yêu thích", err);
    res.redirect(
      "/yeu-thich?msg=" +
        encodeURIComponent("Không thể tải danh sách yêu thích. Vui lòng thử lại.") +
        "&msgtype=error",
    );
  }
};
