const NotificationRepository = require('../repositories/NotificationRepository');
const FavoritesRepository = require('../../favorites/repositories/FavoritesRepository');

class NotificationService {
  constructor(notificationRepository, favoritesRepository) {
    this.notifRepo = notificationRepository;
    this.favRepo = favoritesRepository;
  }

  /**
   * Parse episode number from a slug or name string.
   * Returns null if no valid number found.
   */
  parseEpNum(ep) {
    if (!ep) return null;
    const s = (ep.slug || ep.name || '').toString().toLowerCase();
    if (/^(ova|sp|special|trailer|extra|nc|op|ed)/i.test(s.replace(/[^a-z]/g, ''))) {
      return null;
    }
    const m = s.match(/(\d+)/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return n >= 0 && n <= 2000 ? n : null;
  }

  /**
   * Parse episode number from a raw string (e.g. "Tập 12", "12", "Full").
   * Used for saved last_episode values.
   */
  parseEpNumStr(str) {
    if (!str) return null;
    const s = str.toString().toLowerCase();
    if (s === 'full' || s === 'complete') return null;
    const m = s.match(/(\d+)/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return n >= 0 && n <= 2000 ? n : null;
  }

  /**
   * Safely parse episode_current from API response.
   * Handles non-numeric values like "Tập 12", "12/24", "Full", "Hoàn tất".
   * Returns number or null if invalid/missing.
   */
  parseEpisodeCurrent(episodeCurrent) {
    if (!episodeCurrent) return null;
    const s = episodeCurrent.toString().trim();
    if (!s || s === 'full' || s === 'complete' || s === 'hoàn tất') {
      return null;
    }
    // Extract first number from strings like "Tập 12", "12/24", "12"
    const m = s.match(/(\d+)/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return n >= 0 && n <= 2000 ? n : null;
  }

  /**
   * Find the latest episode number from a merged episode list.
   * Merged format: [{ slug, name, servers: [...] }, ...]
   * Returns null if no valid numeric episode found.
   */
  getLatestEpisodeNum(episodes) {
    if (!Array.isArray(episodes) || episodes.length === 0) return null;
    let latest = null;
    for (const ep of episodes) {
      const num = this.parseEpNum(ep);
      if (num !== null && (latest === null || num > latest)) {
        latest = num;
      }
    }
    return latest;
  }

  async getNotifications(userId, limit = 20) {
    return this.notifRepo.getByUser(userId, limit);
  }

  async getUnreadCount(userId) {
    return this.notifRepo.countUnread(userId);
  }

  async markAllRead(userId) {
    return this.notifRepo.markAllRead(userId);
  }

  async markRead(userId, notifId) {
    return this.notifRepo.markOneRead(userId, notifId);
  }

  async notifyNewEpisode(userId, { movieSlug, movieName, movieThumb, oldEpisode, newEpisode, latestEpisode }) {
    await this.notifRepo.createWithDedupe(userId, { movieSlug, movieName, movieThumb, oldEpisode, newEpisode, latestEpisode });
  }

  async checkAndNotifyNewEpisodes(userId, sourceManager) {
    const favorites = await this.favRepo.getForCheck(userId);
    if (!favorites.length) return { newEpisodes: [], count: 0 };

    const newEpisodes = [];

    async function checkFav(fav) {
      try {
        const detail = await sourceManager.getDetailMerged(fav.movie_slug);
        if (!detail) return;

        const currentEp = detail.episode_current;
        const savedEp = fav.last_episode;

        // Match legacy: no last_episode → update without notification
        if (!savedEp) {
          await this.favRepo.updateLastEpisode(userId, fav.movie_slug, currentEp);
          return;
        }

        // Match legacy: raw string inequality check (not numeric)
        if (currentEp && currentEp !== savedEp) {
          await this.notifyNewEpisode(userId, {
            movieSlug: fav.movie_slug,
            movieName: fav.movie_name,
            movieThumb: fav.movie_thumb,
            oldEpisode: savedEp,
            newEpisode: currentEp,
            latestEpisode: currentEp,
          });
          await this.favRepo.updateLastEpisode(userId, fav.movie_slug, currentEp);
          newEpisodes.push({
            movie_slug: fav.movie_slug,
            movie_name: fav.movie_name,
            movie_thumb: fav.movie_thumb,
            old_episode: savedEp,
            new_episode: currentEp,
            latest_episode: currentEp,
          });
        }
      } catch { /* skip */ }
    }

    const CONCURRENCY = 5;
    const tasks = favorites.map((fav) => () => checkFav.call(this, fav));
    const executing = [];
    let taskIndex = 0;

    const runNext = async () => {
      while (taskIndex < tasks.length) {
        if (executing.length >= CONCURRENCY) {
          await Promise.race(executing);
          const doneIdx = executing.findIndex((p) => p._done);
          if (doneIdx > -1) executing.splice(doneIdx, 1);
        }
        const idx = taskIndex++;
        const p = Promise.resolve().then(tasks[idx]);
        p._done = false;
        p.then(() => { p._done = true; });
        executing.push(p);
      }
    };

    await runNext();
    await Promise.allSettled(executing);

    const count = await this.notifRepo.countUnread(userId);
    return { newEpisodes, count };
  }
}

module.exports = NotificationService;
