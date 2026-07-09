/**
 * TMDB Logo & Backdrop Service
 * Lấy logo và backdrop phim từ TMDB API và cache 24h.
 * Yêu cầu biến môi trường: TMDB_API_KEY
 */
const nodeFetch = require("node-fetch");
const { cache } = require("../core/cache");

const logoCache = cache.tmdbLogo;
const backdropCache = cache.tmdbBackdrop;

/**
 * Lấy URL logo PNG trong suốt từ TMDB.
 * @param {string|number} tmdbId  - TMDB movie/tv ID
 * @param {string} tmdbType       - "movie" | "tv"
 * @returns {Promise<string|null>} - URL ảnh logo hoặc null nếu không có
 */
async function fetchTmdbLogo(tmdbId, tmdbType) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey || !tmdbId) return null;

  const cacheKey = `logo:${tmdbType}:${tmdbId}`;
  const cached = logoCache.get(cacheKey);
  if (cached !== undefined) return cached || null;

  try {
    const type = tmdbType === "movie" ? "movie" : "tv";
    const url =
      `https://api.themoviedb.org/3/${type}/${tmdbId}/images` +
      `?include_image_language=en,vi,null&api_key=${apiKey}`;

    const res = await nodeFetch(url, { timeout: 4000 });
    if (!res.ok) {
      logoCache.set(cacheKey, "");
      return null;
    }

    const data = await res.json();
    const logos = Array.isArray(data.logos) ? data.logos : [];

    // Ưu tiên: tiếng Anh → tiếng Việt → null language → bất kỳ
    const logo =
      logos.find((l) => l.iso_639_1 === "en") ||
      logos.find((l) => l.iso_639_1 === "vi") ||
      logos.find((l) => l.iso_639_1 === null) ||
      logos[0];

    const logoUrl = logo
      ? `https://image.tmdb.org/t/p/w780${logo.file_path}`
      : "";

    logoCache.set(cacheKey, logoUrl);
    return logoUrl || null;
  } catch {
    logoCache.set(cacheKey, "");
    return null;
  }
}

/**
 * Lấy URL backdrop/background ngang từ TMDB.
 * @param {string|number} tmdbId  - TMDB movie/tv ID
 * @param {string} tmdbType       - "movie" | "tv"
 * @returns {Promise<string|null>} - URL backdrop HD hoặc null nếu không có
 */
async function fetchTmdbBackdrop(tmdbId, tmdbType) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey || !tmdbId) return null;

  const cacheKey = `backdrop:${tmdbType}:${tmdbId}`;
  const cached = backdropCache.get(cacheKey);
  if (cached !== undefined) return cached || null;

  try {
    const type = tmdbType === "movie" ? "movie" : "tv";
    // Lấy backdrop từ endpoint /images hoặc từ /movie/{id}
    const url =
      `https://api.themoviedb.org/3/${type}/${tmdbId}/images` +
      `?api_key=${apiKey}`;

    const res = await nodeFetch(url, { timeout: 4000 });
    if (!res.ok) {
      backdropCache.set(cacheKey, "");
      return null;
    }

    const data = await res.json();
    const backdrops = Array.isArray(data.backdrops) ? data.backdrops : [];

    // Ưu tiên backdrop có aspect_ratio gần 16:9 (landscape)
    // TMDB backdrop landscape có aspect > 1.5 (thường ~1.78 cho 16:9)
    const landscape = backdrops.find(b => (b.aspect_ratio || 0) >= 1.5);
    const preferred = landscape || backdrops[0];

    if (!preferred || !preferred.file_path) {
      backdropCache.set(cacheKey, "");
      return null;
    }

    // Dùng kích thước lớn nhất: original (thường 1920x1080+)
    // Hoặc w1280 cho balance giữa quality và file size
    const backdropUrl = `https://image.tmdb.org/t/p/original${preferred.file_path}`;

    backdropCache.set(cacheKey, backdropUrl);
    return backdropUrl;
  } catch {
    backdropCache.set(cacheKey, "");
    return null;
  }
}

/**
 * Enrich nhiều phim với logo VÀ backdrop từ TMDB cùng lúc (Promise.allSettled).
 * @param {Array} movies - danh sách movie objects có trường tmdb: {id, type}
 * @returns {Promise<Array>} - movies với thêm trường logo_url và backdrop_url nếu có
 */
async function enrichMoviesWithLogos(movies) {
  if (!process.env.TMDB_API_KEY) return movies;

  const results = await Promise.allSettled(
    movies.map(async (m) => {
      const tmdbId = m.tmdb?.id;
      const tmdbType = m.tmdb?.type || "movie";
      if (!tmdbId) return m;

      // Fetch logo và backdrop song song
      const [logoUrl, backdropUrl] = await Promise.all([
        fetchTmdbLogo(tmdbId, tmdbType),
        fetchTmdbBackdrop(tmdbId, tmdbType),
      ]);

      const enriched = { ...m };
      if (logoUrl) enriched.logo_url = logoUrl;
      if (backdropUrl) enriched.backdrop_url = backdropUrl;
      return enriched;
    })
  );

  return results.map((r, i) => (r.status === "fulfilled" ? r.value : movies[i]));
}

module.exports = { fetchTmdbLogo, fetchTmdbBackdrop, enrichMoviesWithLogos };
