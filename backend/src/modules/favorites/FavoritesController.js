const FavoritesRepository = require('./repositories/FavoritesRepository');
const FavoritesService = require('./services/FavoritesService');
const logger = require('../../utils/logger');

function sanitizeStr(val) {
  if (typeof val !== 'string') return '';
  return val.replace(/[<>"'&]/g, '').trim().substring(0, 500);
}

function sanitizeUrl(val) {
  if (typeof val !== 'string') return '';
  val = val.trim();
  if (val && !val.startsWith('/') && !val.startsWith('http://') && !val.startsWith('https://')) return '';
  return val.replace(/["'<>]/g, '').substring(0, 1000);
}

class FavoritesController {
  constructor(favoritesService) {
    this.favService = favoritesService;
  }

  toggleFavorite = async (req, res) => {
    try {
      const userId = req.session.user.id;
      const movieSlug = sanitizeStr(req.body.movieSlug);
      const movieName = sanitizeStr(req.body.movieName);
      const movieThumb = sanitizeUrl(req.body.movieThumb);
      const movieOriginName = sanitizeStr(req.body.movieOriginName);
      const lastEpisode = sanitizeStr(req.body.lastEpisode);

      if (!movieSlug) return res.status(400).json({ error: 'Thieu movieSlug' });

      const result = await this.favService.toggle(userId, { movieSlug, movieName, movieThumb, movieOriginName, lastEpisode });
      res.json({ status: result.action, isFavorite: result.action === 'added' });
    } catch (err) {
      logger.error('favorites', 'Loi toggle favorite', err);
      res.status(500).json({ error: 'Loi server' });
    }
  };

  checkFavorite = async (req, res) => {
    try {
      const userId = req.session.user.id;
      const isFav = await this.favService.isFavorite(userId, req.params.slug);
      res.json({ isFavorite: isFav });
    } catch (err) {
      res.status(500).json({ error: 'Loi server' });
    }
  };

  getFavorites = async (req, res) => {
    try {
      const userId = req.session.user.id;
      const favorites = await this.favService.getFavorites(userId);
      res.json(favorites);
    } catch (err) {
      res.status(500).json({ error: 'Loi server' });
    }
  };

  getFavoritesPage = async (req, res) => {
    try {
      const userId = req.session.user.id;
      const perPage = 24;
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const total = await this.favService.getCount(userId);
      const totalPages = Math.ceil(total / perPage);
      const favorites = await this.favService.getFavorites(userId, perPage, (page - 1) * perPage);

      res.render('pages/favorites', {
        title: 'Phim yeu thich - movieCC',
        favorites,
        totalFavorites: total,
        currentPage: page,
        totalPages,
      });
    } catch (err) {
      logger.error('favorites', 'Loi trang yeu thich', err);
      res.redirect('/');
    }
  };
}

module.exports = FavoritesController;
