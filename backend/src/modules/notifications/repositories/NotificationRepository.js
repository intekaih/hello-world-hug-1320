const BaseRepository = require('../../../core/database/BaseRepository');
const { Notification } = require('../../../models/Notification');

class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
  }

  async markAllRead(userId) {
    await this.model.updateMany({ user_id: userId, is_read: false }, { is_read: true });
  }

  async markOneRead(userId, notifId) {
    if (!this._isValidId(notifId)) return;
    await this.model.updateOne({ _id: notifId, user_id: userId }, { is_read: true });
  }

  async countUnread(userId) {
    return this.model.countDocuments({ user_id: userId, is_read: false });
  }

  async getByUser(userId, limit = 20) {
    const docs = await this.model.find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();
    return docs.map(d => this._toLean(d));
  }

  async createWithDedupe(userId, { movieSlug, movieName, movieThumb, oldEpisode, newEpisode, latestEpisode }) {
    try {
      await this.model.create({
        user_id: userId,
        movie_slug: movieSlug,
        movie_name: movieName,
        movie_thumb: movieThumb,
        old_episode: oldEpisode,
        new_episode: newEpisode,
        latest_episode: latestEpisode || newEpisode,
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
}

module.exports = NotificationRepository;
