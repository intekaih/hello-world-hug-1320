/**
 * Movie Detail Service - Movie detail data fetching and transformation
 *
 * Extracted from movieController.js for better maintainability.
 * Used by both SSR routes.
 */

const { sourceManager } = require("../config/providers");
const { cache } = require("../core/cache");
const { sanitizeContent } = require("../utils/sanitize");
const { buildMovieJsonLd, buildMovieFaqJsonLd } = require("./schemaService");
const { enrichMoviesWithLogos } = require("./tmdbLogoService");
const { epSlugFromCurrent } = require("../utils/slugUtils");

const detailCache = cache.detail;

/**
 * Parses ISO duration string to ISO 8601 duration format
 * e.g. "2 giờ 30 phút" → "PT2H30M"
 */
function parseIsoDuration(timeStr) {
  if (!timeStr) return "";
  const hMatch = timeStr.match(/(\d+)\s*(giờ|hour|h)/i);
  const mMatch = timeStr.match(/(\d+)\s*(phút|minute|min|m(?!ovie))/i);
  const hours = hMatch ? parseInt(hMatch[1]) : 0;
  const mins = mMatch ? parseInt(mMatch[1]) : 0;
  if (!hours && !mins) {
    const numOnly = timeStr.match(/^(\d+)$/);
    if (numOnly) return `PT${numOnly[1]}M`;
    return "";
  }
  return `PT${hours ? hours + "H" : ""}${mins ? mins + "M" : ""}`;
}

/**
 * Fetches movie detail with caching
 * @param {string} slug - Movie slug
 * @returns {Promise<object|null>} Movie detail or null if not found
 */
async function getMovieDetail(slug) {
  const cacheKey = `detail:merged:${slug}`;
  let movie = detailCache.get(cacheKey);

  if (!movie) {
    movie = await sourceManager.getDetailMerged(slug);
    if (movie) {
      detailCache.set(cacheKey, movie);
    }
  }

  return movie;
}

/**
 * Builds episode list from merged format
 * @param {object} movie - Movie with episodes
 * @returns {Array} Flattened episode list
 */
function buildEpisodeList(movie) {
  let episodes;
  if (Array.isArray(movie.episodes?.[0]?.servers)) {
    episodes = movie.episodes.map((ep) => ({
      name: ep.name,
      slug: ep.slug,
      link_embed: ep.servers?.[0]?.link_embed,
      link_m3u8: ep.servers?.[0]?.link_m3u8,
    }));
  } else {
    const firstServer = movie.episodes?.[0];
    episodes = (firstServer?.server_data || [])
      .filter((ep) => ep.link_embed || ep.link_m3u8)
      .map((ep) => ({
        name: ep.name,
        slug: ep.slug || ep.name,
        link_embed: ep.link_embed,
        link_m3u8: ep.link_m3u8,
      }));
  }
  return episodes;
}

/**
 * Builds breadcrumbs for movie detail page
 * @param {object} movie - Movie object
 * @returns {Array} Breadcrumb items
 */
function buildDetailBreadcrumbs(movie) {
  const crumbs = [{ name: "Trang chủ", url: "/" }];
  if (movie.type === "series") crumbs.push({ name: "Phim Bộ", url: "/danh-sach/phim-bo" });
  else if (movie.type === "hoathinh") crumbs.push({ name: "Anime", url: "/danh-sach/hoat-hinh" });
  else crumbs.push({ name: "Phim Lẻ", url: "/danh-sach/phim-le" });
  crumbs.push({ name: movie.name });
  return crumbs;
}

/**
 * Enriches movie with SEO data and metadata
 * @param {object} movie - Movie object
 * @param {string} siteUrl - Site URL for absolute URLs
 * @returns {object} Movie with SEO metadata
 */
function enrichMovieWithSeo(movie, siteUrl) {
  const enriched = { ...movie };
  enriched.content = sanitizeContent(enriched.content);

  const jsonLd = buildMovieJsonLd(enriched, siteUrl);
  const faqJsonLd = buildMovieFaqJsonLd(enriched);

  return { ...enriched, jsonLd, faqJsonLd };
}

/**
 * Gets hero movies for home page with TMDB enrichment
 * @param {number} limit - Number of movies to fetch
 * @returns {Promise<Array>} Enriched hero movies
 */
async function getHeroMovies(limit = 10) {
  const allNew = await sourceManager.fetchAllNewMovies(1).catch(() => ({ items: [] }));
  const heroRaw = (allNew.items || []).slice(0, limit);
  const heroEnriched = await enrichMoviesWithLogos(heroRaw).catch(() => heroRaw);
  return heroEnriched.map((m) => ({
    ...m,
    epSlug: epSlugFromCurrent(m.episode_current),
  }));
}

/**
 * Clears movie detail cache
 * @param {string} slug - Movie slug (optional, if not provided clears all detail cache)
 */
function clearMovieCache(slug) {
  if (slug) {
    detailCache.del(`detail:merged:${slug}`);
  } else {
    // Clear all by flushing
    const keys = detailCache.keys();
    keys.forEach((k) => {
      if (k.startsWith("detail:merged:")) detailCache.del(k);
    });
  }
}

module.exports = {
  parseIsoDuration,
  getMovieDetail,
  buildEpisodeList,
  buildDetailBreadcrumbs,
  enrichMovieWithSeo,
  getHeroMovies,
  clearMovieCache,
};
