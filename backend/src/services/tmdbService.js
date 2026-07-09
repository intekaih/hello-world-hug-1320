/**
 * TMDB Service - TMDB API integration
 *
 * Handles TV show info and Schedule data fetching from TMDB
 */

const nodeFetch = require("node-fetch");
const logger = require("../utils/logger");

const TMDB_API_BASE = "https://api.themoviedb.org/3";

/**
 * Fetches TV show info from TMDB
 */
async function getTvInfo(tmdbId) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const tmdbRes = await nodeFetch(
      `${TMDB_API_BASE}/tv/${tmdbId}?api_key=${apiKey}&language=vi`,
      { timeout: 5000 }
    );
    if (!tmdbRes.ok) return null;

    const data = await tmdbRes.json();
    const fmt = (ep) =>
      ep
        ? {
            airDate: ep.air_date || null,
            episodeNumber: ep.episode_number || null,
            seasonNumber: ep.season_number || null,
            name: ep.name || null,
          }
        : null;

    return {
      nextEpisode: fmt(data.next_episode_to_air),
      lastEpisode: fmt(data.last_episode_to_air),
      status: data.status || null,
      name: data.name || null,
    };
  } catch (err) {
    logger.warn("tmdb", `getTvInfo failed for ${tmdbId}: ${err.message}`);
    return null;
  }
}

/**
 * Fetches TMDB movie/TV data with error handling
 */
async function tmdbFetch(path, options = {}) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${TMDB_API_BASE}${path}&api_key=${apiKey}`;
    const res = await nodeFetch(url, { timeout: options.timeout || 6000 });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    logger.warn("tmdb", `tmdbFetch failed: ${err.message}`);
    return null;
  }
}

/**
 * Parses TMDB item to standard format
 */
function parseTmdbItem(item, type = "movie") {
  return {
    id: item.id,
    title: type === "tv" ? item.name : item.title,
    originalTitle: type === "tv" ? item.original_name : item.original_title,
    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : null,
    backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
    releaseDate: type === "tv" ? item.first_air_date : item.release_date,
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : 0,
    overview: item.overview || "",
    type,
  };
}

/**
 * Fetches schedule data (now playing, upcoming movies, on-air TV)
 */
async function getSchedule() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return { nowPlaying: [], upcoming: [], onAir: [] };

  const tmdbFetchForSchedule = (url) => nodeFetch(url, { timeout: 6000 });

  const [nowPlayingRes, upcomingRes, onAirRes] = await Promise.allSettled([
    tmdbFetchForSchedule(
      `${TMDB_API_BASE}/movie/now_playing?api_key=${apiKey}&language=vi&region=VN&page=1`
    ),
    tmdbFetchForSchedule(
      `${TMDB_API_BASE}/movie/upcoming?api_key=${apiKey}&language=vi&region=VN&page=1`
    ),
    tmdbFetchForSchedule(
      `${TMDB_API_BASE}/tv/on_the_air?api_key=${apiKey}&language=vi&page=1`
    ),
  ]);

  const parseItems = (settled, type) => {
    if (settled.status === "rejected" || !settled.value?.ok) return [];
    return settled.value
      .json()
      .then((data) =>
        (data.results || [])
          .slice(0, 24)
          .map((item) => parseTmdbItem(item, type))
      )
      .catch(() => []);
  };

  const [nowPlaying, upcoming, onAir] = await Promise.all([
    parseItems(nowPlayingRes, "movie"),
    parseItems(upcomingRes, "movie"),
    parseItems(onAirRes, "tv"),
  ]);

  return { nowPlaying, upcoming, onAir };
}

module.exports = {
  getTvInfo,
  tmdbFetch,
  parseTmdbItem,
  getSchedule,
};
