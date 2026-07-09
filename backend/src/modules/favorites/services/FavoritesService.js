const FavoritesRepository = require('../repositories/FavoritesRepository');

class FavoritesService {
  constructor(favoritesRepository) {
    this.favRepo = favoritesRepository;
  }

  async toggle(userId, { movieSlug, movieName, movieThumb, movieOriginName, lastEpisode }) {
    if (!movieSlug) throw new Error('Thieu movieSlug');
    return this.favRepo.toggle(userId, { movieSlug, movieName, movieThumb, movieOriginName, lastEpisode });
  }

  async isFavorite(userId, movieSlug) {
    return this.favRepo.isFavorite(userId, movieSlug);
  }

  async getFavorites(userId, limit = 24, offset = 0) {
    const docs = await this.favRepo.model
      .find({ user_id: userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    return docs.map(d => ({ ...d, id: d._id.toString() }));
  }

  async getCount(userId) {
    return this.favRepo.count({ user_id: userId });
  }

  async clear(userId) {
    return this.favRepo.clearAll(userId);
  }
}

module.exports = FavoritesService;
