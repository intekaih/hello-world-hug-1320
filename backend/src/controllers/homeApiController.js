/**
 * Home API Controller - React App Home Data
 *
 * Handles /api/react/movies/home endpoint
 */

const { sourceManager } = require("../config/providers");
const { cache } = require("../core/cache");
const { enrichMoviesWithLogos } = require("../services/tmdbLogoService");
const { epSlugFromCurrent } = require("../utils/slugUtils");
const logger = require("../utils/logger");

const reactApiCache = cache.reactApi;

/**
 * Builds epSlug from episode_current string
 */
function buildEpSlug(ep) {
  if (!ep) return null;
  const s = ep.toLowerCase().trim();
  if (s === "full" || s === "complete") return "full";
  const m = s.match(/(\d+)/);
  return m ? m[1] : null;
}

/**
 * Enriches movie with epSlug
 */
function withEpSlug(m) {
  return { ...m, epSlug: buildEpSlug(m.episode_current) };
}

function isTrailer(movie) {
  if (!movie) return false;
  const status = (movie.status || "").toLowerCase().trim();
  const episodeCurrent = (movie.episode_current || "").toLowerCase().trim();
  const quality = (movie.quality || "").toLowerCase().trim();
  return status === "trailer" || episodeCurrent.includes("trailer") || quality.includes("trailer");
}

/**
 * Fetches home data for React app
 * Uses caching with 2-minute TTL
 */
async function getHomeData() {
  const cacheKey = "home:v2";
  const cached = reactApiCache.get(cacheKey);

  if (cached) {
    return { data: cached, fromCache: true };
  }

  const [newP1, series, hoathinh] = await Promise.all([
    sourceManager.fetchAllNewMovies(1).catch(() => ({ items: [] })),
    sourceManager.getByType("phim-bo", 1, { limit: 18 }).catch(() => ({ items: [] })),
    sourceManager.getByType("hoat-hinh", 1, { limit: 18 }).catch(() => ({ items: [] })),
  ]);

  const allNew = newP1.items || [];
  const allNewFiltered = allNew.filter(m => !isTrailer(m));
  const seriesFiltered = (series.items || []).filter(m => !isTrailer(m));
  const hoathinhFiltered = (hoathinh.items || []).filter(m => !isTrailer(m));

  const rawHero = allNewFiltered.slice(0, 10).map(withEpSlug);
  const heroMovies = await enrichMoviesWithLogos(rawHero).catch(() => rawHero);

  const payload = {
    heroMovies,
    top10Movies: allNewFiltered.slice(0, 10).map(withEpSlug),
    hotSeriesMovies: seriesFiltered.slice(0, 8).map(withEpSlug),
    animeMovies: hoathinhFiltered.map(withEpSlug),
    newMovies: allNewFiltered.slice(0, 26).map(withEpSlug),
  };

  reactApiCache.set(cacheKey, payload);

  return { data: payload, fromCache: false };
}

/**
 * Express route handler for GET /api/react/movies/home
 */
async function handleHome(req, res) {
  try {
    const { data, fromCache } = await getHomeData();

    if (fromCache) {
      res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
    } else {
      res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    }

    res.json(data);
  } catch (err) {
    logger.error("api/react", "Lỗi getHome", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getHomeData,
  handleHome,
};
