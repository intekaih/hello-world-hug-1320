const database = require("../database");
const { sourceManager } = require("../config/providers");
const logger = require("../utils/logger");
const { cache } = require("../core/cache");

// Cache kiểm tra tập mới: mỗi user chỉ check 5 phút 1 lần
const checkCache = cache.notificationCheck;

// Lấy danh sách thông báo
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const notifications = await database.getNotifications(userId, 20);
    res.json(notifications);
  } catch (err) {
    logger.error("notification", "Lỗi lấy thông báo", err);
    res.status(500).json({ error: "Lỗi server" });
  }
};

// Đếm thông báo chưa đọc
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const count = await database.countUnreadNotifications(userId);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
};

// Đánh dấu tất cả đã đọc
exports.markAllRead = async (req, res) => {
  try {
    const userId = req.session.user.id;
    await database.markNotificationsRead(userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
};

// Đánh dấu 1 thông báo đã đọc
exports.markRead = async (req, res) => {
  try {
    const userId = req.session.user.id;
    await database.markNotificationRead(userId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
};

// Kiểm tra tập mới cho favorites của user
exports.checkNewEpisodes = async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Throttle: chỉ check 5 phút 1 lần per user
    const cacheKey = `notif_check_${userId}`;
    if (checkCache.get(cacheKey)) {
      const count = await database.countUnreadNotifications(userId);
      return res.json({ checked: false, count });
    }

    const favorites = await database.getFavoritesForCheck(userId);
    if (!favorites.length) {
      checkCache.set(cacheKey, true);
      return res.json({ checked: true, count: 0, newEpisodes: [] });
    }

    const newEpisodes = [];

    // Hàm check từng phim
    async function checkFav(fav) {
      try {
        const detail = await sourceManager.getDetailMerged(fav.movie_slug);
        if (!detail) return;

        const currentEp = detail.episode_current;
        const savedEp = fav.last_episode;

        // Nếu chưa lưu last_episode (favorite cũ) → cập nhật mà không tạo notification
        if (!savedEp) {
          await database.updateFavoriteEpisode(userId, fav.movie_slug, currentEp);
          return;
        }

        // So sánh: nếu episode changed → có tập mới
        if (currentEp && currentEp !== savedEp) {
          await database.createNotification(userId, {
            movieSlug: fav.movie_slug,
            movieName: fav.movie_name,
            movieThumb: fav.movie_thumb,
            oldEpisode: savedEp,
            newEpisode: currentEp,
            latestEpisode: currentEp,
          });
          await database.updateFavoriteEpisode(userId, fav.movie_slug, currentEp);
          newEpisodes.push({
            movie_slug: fav.movie_slug,
            movie_name: fav.movie_name,
            movie_thumb: fav.movie_thumb,
            old_episode: savedEp,
            new_episode: currentEp,
            latest_episode: currentEp,
          });
        }
      } catch {
        /* Skip phim bị lỗi */
      }
    }

    // Concurrency limiter: giới hạn tối đa 5 API calls đồng thời, tránh fan-out spike
    const CONCURRENCY = 5;
    const tasks = favorites.map((fav) => () => checkFav(fav));
    const executing = [];
    for (const task of tasks) {
      const p = Promise.resolve().then(task);
      p.then(() => {
        const idx = executing.indexOf(p);
        if (idx > -1) executing.splice(idx, 1);
      });
      executing.push(p);
      if (executing.length >= CONCURRENCY) {
        await Promise.race(executing);
      }
    }
    await Promise.allSettled(executing);

    checkCache.set(cacheKey, true);
    const count = await database.countUnreadNotifications(userId);
    res.json({ checked: true, count, newEpisodes });
  } catch (err) {
    logger.error("notification", "Lỗi kiểm tra tập mới", err);
    res.status(500).json({ error: "Lỗi server" });
  }
};
