const HistoryRepository = require('../repositories/HistoryRepository');

class HistoryService {
  constructor(historyRepository) {
    this.historyRepo = historyRepository;
  }

  async saveProgress(userId, { movieSlug, episodeSlug, currentTime, duration, movieName, movieThumb, movieOriginName }) {
    if (!movieSlug || !episodeSlug) throw new Error('Thieu thong tin');
    return this.historyRepo.upsertProgress(userId, {
      movieSlug, episodeSlug,
      currentTime: parseInt(currentTime) || 0,
      duration: parseInt(duration) || 0,
      movieName, movieThumb, movieOriginName,
    });
  }

  async getProgress(userId, movieSlug, episodeSlug) {
    return this.historyRepo.findOne({ user_id: userId, movie_slug: movieSlug, episode_slug: episodeSlug });
  }

  async getLatestProgress(userId, movieSlug) {
    return this.historyRepo.findLatestOfMovie(userId, movieSlug);
  }

  async deleteItem(userId, id) {
    return this.historyRepo.deleteItem(userId, id);
  }

  async clear(userId) {
    return this.historyRepo.clearAll(userId);
  }

  async getHistory(userId, limit = 24) {
    const docs = await this.historyRepo.model
      .find({ user_id: userId })
      .sort({ last_watched: -1 })
      .limit(limit)
      .lean();
    return docs.map(d => ({ ...d, id: d._id.toString() }));
  }

  async getPage(userId, page = 1, limit = 24) {
    return this.historyRepo.getByUserPaginated(userId, page, limit);
  }

  async getCount(userId) {
    return this.historyRepo.count({ user_id: userId });
  }
}

module.exports = HistoryService;
