/**
 * Actor Controller - Actor/Movie relationship endpoints
 *
 * Handles /api/react/actor/:name endpoint
 * Fetches actor info from TMDB and fallback to provider search
 */

const nodeFetch = require("node-fetch");
const { sourceManager } = require("../config/providers");
const logger = require("../utils/logger");

/**
 * Fetches actor details and filmography from TMDB
 */
async function fetchActorFromTmdb(actorName, page = 1) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return { tmdbPerson: null, tmdbMovies: [], success: false };

  try {
    const searchRes = await nodeFetch(
      `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(actorName)}&language=vi&page=1`,
      { timeout: 5000 }
    );

    if (!searchRes.ok) return { tmdbPerson: null, tmdbMovies: [], success: false };

    const searchData = await searchRes.json();
    const person = (searchData.results || [])[0];
    if (!person) return { tmdbPerson: null, tmdbMovies: [], success: false };

    const tmdbPerson = {
      id: person.id,
      name: person.name,
      profileUrl: person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : null,
      knownFor: (person.known_for || []).map((m) => m.title || m.name).slice(0, 3),
    };

    const credRes = await nodeFetch(
      `https://api.themoviedb.org/3/person/${person.id}/combined_credits?api_key=${apiKey}&language=vi`,
      { timeout: 5000 }
    );

    if (!credRes.ok) return { tmdbPerson, tmdbMovies: [], success: false };

    const credData = await credRes.json();
    const all = [
      ...(credData.cast || []).map((m) => ({ ...m, _role: "cast" })),
    ]
      .filter((m) => m.poster_path && (m.title || m.name))
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    const startIdx = (page - 1) * 24;
    const pageItems = all.slice(startIdx, startIdx + 24);
    const tmdbMovies = pageItems.map((m) => ({
      id: m.id,
      title: m.title || m.name,
      originalTitle: m.original_title || m.original_name,
      posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
      backdropUrl: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : null,
      releaseDate: m.release_date || m.first_air_date || "",
      rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : 0,
      overview: m.overview || "",
      type: m.media_type || (m.title ? "movie" : "tv"),
      character: m.character || "",
      totalItems: all.length,
      totalPages: Math.ceil(all.length / 24),
    }));

    return { tmdbPerson, tmdbMovies, success: true, totalItems: all.length };
  } catch (tmdbErr) {
    logger.warn("api/react", `TMDB actor search failed: ${tmdbErr.message}`);
    return { tmdbPerson: null, tmdbMovies: [], success: false };
  }
}

/**
 * Searches for movies by actor name in providers
 */
async function searchActorInProviders(actorName, page = 1) {
  const data = await sourceManager.searchAll(actorName, page);
  return {
    items: data.items || [],
    pagination: data.pagination || { totalItems: 0, totalPages: 0, currentPage: page },
  };
}

/**
 * Express route handler for GET /api/react/actor/:name
 */
async function handleActor(req, res) {
  try {
    const actorName = decodeURIComponent(req.params.name || "").trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);

    if (!actorName) {
      return res.json({
        items: [],
        pagination: { totalItems: 0, totalPages: 0, currentPage: 1 },
        actorName: "",
        tmdbPerson: null,
      });
    }

    const { tmdbPerson, tmdbMovies, success, totalItems } = await fetchActorFromTmdb(actorName, page);

    if (success && tmdbPerson) {
      res.set("Cache-Control", "public, max-age=1800");
      return res.json({
        items: tmdbMovies,
        pagination: {
          totalItems,
          totalPages: Math.ceil(totalItems / 24),
          currentPage: page,
        },
        actorName,
        tmdbPerson,
      });
    }

    const providerData = await searchActorInProviders(actorName, page);
    res.json({
      items: providerData.items,
      pagination: providerData.pagination,
      actorName,
      tmdbPerson: null,
    });
  } catch (err) {
    logger.error("api/react", `Lỗi getByActor ${req.params.name}`, err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  fetchActorFromTmdb,
  searchActorInProviders,
  handleActor,
};
