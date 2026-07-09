const BaseRepository = require('../../../core/database/BaseRepository');
const { WatchHistory } = require('../../../models/WatchHistory');

class HistoryRepository extends BaseRepository {
  constructor() {
    super(WatchHistory);
  }

  async findByUserMovie(userId, movieSlug) {
    return this.findOne({ user_id: userId, movie_slug: movieSlug });
  }

  async findLatestOfMovie(userId, movieSlug) {
    const doc = await this.model.findOne({ user_id: userId, movie_slug: movieSlug })
      .sort({ last_watched: -1 }).lean();
    return this._toLean(doc);
  }

  async upsertProgress(userId, { movieSlug, episodeSlug, currentTime, duration, movieName, movieThumb, movieOriginName }) {
    const setObj = {
      current_time: currentTime,
      duration,
      last_watched: new Date(),
    };
    if (movieName) setObj.movie_name = movieName;
    if (movieThumb) setObj.movie_thumb = movieThumb;
    if (movieOriginName) setObj.movie_origin_name = movieOriginName;

    const query = { user_id: userId, movie_slug: movieSlug, episode_slug: episodeSlug };

    try {
      await this.model.findOneAndUpdate(query, { $set: setObj, $setOnInsert: query }, { upsert: true, new: true });
    } catch (err) {
      await this.model.updateOne(query, { $set: setObj, $setOnInsert: query }, { upsert: true }).catch(() => {});
    }
  }

  async getByUserPaginated(userId, page = 1, limit = 24) {
    return this.paginate({ user_id: userId }, page, limit, { last_watched: -1 });
  }

  async deleteItem(userId, id) {
    if (!this._isValidId(id)) return false;
    const result = await this.model.deleteOne({ _id: id, user_id: userId });
    return result.deletedCount > 0;
  }

  async clearAll(userId) {
    await this.model.deleteMany({ user_id: userId });
  }
}

module.exports = HistoryRepository;
