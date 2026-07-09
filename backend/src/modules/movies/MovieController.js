/**
 * Movie Controller — DI wrapper
 *
 * Wraps the existing movieController functions so it can be used
 * via the DI container. The actual logic lives in controllers/movieController.js.
 */

const movieController = require('../../controllers/movieController');

function wrap(fn) {
  return async function(req, res, next) {
    try {
      return await fn(req, res, next);
    } catch (err) {
      if (typeof next === 'function') return next(err);
      console.error('[MovieCtrl]', err.message);
    }
  };
}

class MovieController {
  getHome = wrap(movieController.getHome);
  getMovieDetail = wrap(movieController.getMovieDetail);
  getWatch = wrap(movieController.getWatch);
  getByCategory = wrap(movieController.getByCategory);
  getByCountry = wrap(movieController.getByCountry);
  getByType = wrap(movieController.getByType);
  getRelated = wrap(movieController.getRelated);
  getStream = wrap(movieController.getStream);
  proxyM3u8 = wrap(movieController.proxyM3u8);
  proxySegment = wrap(movieController.proxySegment);
  getEmbedRedirect = wrap(movieController.getEmbedRedirect);
}

module.exports = MovieController;
