const BaseRepository = require('../../../core/database/BaseRepository');
const { Favorite } = require('../../../models/Favorite');

class FavoritesRepository extends BaseRepository {
  constructor() {
    super(Favorite);
  }

  async findByUserAndSlug(userId, movieSlug) {
    return this.findOne({ user_id: userId, movie_slug: movieSlug });
  }

  async toggle(userId, { movieSlug, movieName, movieThumb, movieOriginName, lastEpisode }) {
    const existing = await this.findByUserAndSlug(userId, movieSlug);
    if (existing) {
      await this.model.deleteOne({ _id: existing.id });
      return { action: 'removed' };
    }
    await this.create({
      user_id: userId,
      movie_slug: movieSlug,
      movie_name: movieName || null,
      movie_thumb: movieThumb || null,
      movie_origin_name: movieOriginName || null,
      last_episode: lastEpisode || null,
    });
    return { action: 'added' };
  }

  async isFavorite(userId, movieSlug) {
    const doc = await this.model.findOne({ user_id: userId, movie_slug: movieSlug }).lean();
    return !!doc;
  }

  async updateLastEpisode(userId, movieSlug, newEpisode) {
    await this.model.updateOne({ user_id: userId, movie_slug: movieSlug }, { last_episode: newEpisode });
  }

  async getForCheck(userId) {
    const docs = await this.model.find({ user_id: userId }).select('movie_slug movie_name movie_thumb last_episode').lean();
    return docs.map(d => this._toLean(d));
  }

  async clearAll(userId) {
    await this.model.deleteMany({ user_id: userId });
  }
}

module.exports = FavoritesRepository;
