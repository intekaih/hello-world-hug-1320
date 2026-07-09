/**
 * Home Service - Home page data fetching and preparation
 *
 * Extracted from movieController.js for better maintainability.
 */

const { sourceManager } = require("../config/providers");
const { cache } = require("../core/cache");
const { enrichMoviesWithLogos } = require("./tmdbLogoService");
const { sanitizeContent } = require("../utils/sanitize");
const { epSlugFromCurrent } = require("../utils/slugUtils");

const homeCache = cache.home;

/**
 * Fetches and prepares all home page data
 * Returns cached data if available, otherwise fetches fresh data
 */
async function getHomeData() {
  const cacheKey = "home:v3";
  const cached = homeCache.get(cacheKey);

  if (cached) return cached;

  // Fetch all data in parallel for performance
  const [newP1, newP2, series, single, hot, theater, anime] = await Promise.all([
    sourceManager.fetchAllNewMovies(1).catch(() => ({ items: [] })),
    sourceManager.fetchAllNewMovies(2).catch(() => ({ items: [] })),
    sourceManager.getByType("phim-bo", 1).catch(() => ({ items: [] })),
    sourceManager.getByType("phim-le", 1).catch(() => ({ items: [] })),
    sourceManager.getByType("phim-bo-dang-chieu", 1).catch(() => ({ items: [] })),
    sourceManager.getByType("phim-chieu-rap", 1).catch(() => ({ items: [] })),
    sourceManager.getByType("hoat-hinh", 1).catch(() => ({ items: [] })),
  ]);

  const allNew = [
    ...(newP1.items || []),
    ...(newP2.items || []),
  ];

  // Helper to add epSlug to movie
  const withEpSlug = (m) => ({
    ...m,
    epSlug: epSlugFromCurrent(m.episode_current),
  });

  // Enrich hero movies with TMDB logos
  const heroRaw = allNew.slice(0, 10);
  const heroEnriched = await enrichMoviesWithLogos(heroRaw).catch(() => heroRaw);

  const data = {
    heroMovies: heroEnriched.map((m) => withEpSlug({ ...m, content: sanitizeContent(m.content) })),
    heroMoviesProxy: heroRaw.map((m) => {
      return {
        posterProxyUrl: m.poster_url || m.thumb_url || "",
        thumbProxyUrl: m.thumb_url || m.poster_url || "",
      };
    }),
    topMovies: allNew.slice(0, 10).map(withEpSlug),
    topMoviesProxy: allNew.slice(0, 10).map((m) => {
      const raw = m.poster_url || m.thumb_url || "";
      return { posterProxyUrl: raw, thumbProxyUrl: raw };
    }),
    newMovies: allNew.slice(10, 26),
    seriesMovies: (series.items || []).slice(0, 16),
    singleMovies: (single.items || []).slice(0, 16),
    hotMovies: (hot.items || []).slice(0, 16),
    theaterMovies: (theater.items || []).slice(0, 16),
    animeMovies: (anime.items || []).slice(0, 16),
  };

  // Only cache if we actually got data
  const hasData = allNew.length > 0 || (series.items?.length || 0) > 0 || (hot.items?.length || 0) > 0;
  if (hasData) {
    homeCache.set(cacheKey, data);
  }

  return data;
}

/**
 * Clears home cache (for admin refresh)
 */
function clearHomeCache() {
  homeCache.del("home:v3");
}

module.exports = {
  getHomeData,
  clearHomeCache,
};
