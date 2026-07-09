/**
 * Movie Controller — Refactored
 *
 * Uses MovieSourceManager (Facade) for all multi-source operations.
 * Merge/matching logic is now in MovieSourceManager.
 * Proxy logic uses CDN Registry for dynamic referer detection.
 */

const nodeFetch = require("node-fetch");
const { sourceManager } = require("../config/providers");
const database = require("../database");
const categories = require("../config/categories");
const countries = require("../config/countries");
const { detectReferer, detectAltReferer } = require("../config/cdnRegistry");
const MovieSourceManager = require("../services/MovieSourceManager");

const {
  encryptStreamUrl,
  decryptStreamUrl,
} = require("../utils/encryption");
const logger = require("../utils/logger");
const { sanitizeContent } = require("../utils/sanitize");
const { enrichMoviesWithLogos } = require("../services/tmdbLogoService");
const { cache } = require("../core/cache");


function isTrailer(movie) {
  if (!movie) return false;
  const status = (movie.status || "").toLowerCase().trim();
  const episodeCurrent = (movie.episode_current || "").toLowerCase().trim();
  const quality = (movie.quality || "").toLowerCase().trim();
  return status === "trailer" || episodeCurrent.includes("trailer") || quality.includes("trailer");
}

function sortTrailersToEnd(items) {
  if (!Array.isArray(items)) return [];
  const nonTrailers = [];
  const trailers = [];
  for (const item of items) {
    if (isTrailer(item)) {
      trailers.push(item);
    } else {
      nonTrailers.push(item);
    }
  }
  return [...nonTrailers, ...trailers];
}

function toAbsoluteUrl(url, siteUrl) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return (siteUrl || "") + (url.startsWith("/") ? url : "/" + url);
}

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
// - Each node has limited RAM (~2-4GB available for Node.js)

// ─── Schema / SEO helpers ────────────────────────────────────────────────────

function buildCollectionSchema(name, url, movies, siteUrl) {
  if (!movies || movies.length === 0) return "";
  const obj = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${name} - movieCC`,
    url: `${siteUrl}${url}`,
    description: `Danh sách phim ${name} mới nhất tại movieCC. Xem phim ${name} chất lượng cao, phụ đề tiếng Việt.`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: movies.length,
      itemListElement: movies.slice(0, 12).map((m, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${siteUrl}/phim/${m.slug}`,
        name: (m.name || "").replace(/"/g, '\\"'),
      })),
    },
  };
  return JSON.stringify(obj).replace(/<\//g, "<\\/");
}

// ─── Related parts (seasons) ─────────────────────────────────────────────────

function extractSeriesBaseName(name) {
  if (!name) return "";
  let base = name
    .replace(/\(\s*(phần|phàn|season|ss|part|mùa)\s*\d+\s*\)/gi, "")
    .replace(/\b(phần|phàn|season|ss|part|mùa)\s*\d+/gi, "")
    .replace(/\b\d+(st|nd|rd|th)\s+(season|part)\b/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\(\s*\d{4}\s*\)/g, "");
  const parts = base.split(/[:\-–\(]/);
  base = parts[0];
  base = base.replace(/\s+\d+\s*$/, "");
  base = base.replace(/[,\.\?!;]/g, "");
  return base.replace(/\s+/g, " ").trim().toLowerCase();
}

function extractSeriesBaseNames(name) {
  if (!name) return [];
  const titles = name.split(/,\s*/);
  const results = new Set();
  for (const t of titles) {
    const b = extractSeriesBaseName(t.trim());
    if (b && b.length >= 2) results.add(b);
  }
  return [...results];
}

function extractPartNumber(name, origin_name) {
  const check = (str) => {
    if (!str) return null;
    const match = str.match(/(?:phần|phàn|season|ss|part|mùa)\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);
    const ordMatch = str.match(/(\d+)(?:st|nd|rd|th)\s+(?:season|part)/i);
    if (ordMatch) return parseInt(ordMatch[1], 10);
    const prefix = str.split(/[:\-–\(]/)[0].trim();
    const numMatch = prefix.match(/\s+(\d+)$/);
    if (numMatch) return parseInt(numMatch[1], 10);
    return null;
  };
  return check(name) || check(origin_name) || null;
}

function extractBaseName(name) {
  if (!name) return "";
  return name
    .replace(/\s*(Phần|Season|Part|Mùa)\s*\d+/gi, "")
    .replace(/\s*\d+\s*$/, "")
    .replace(/\s*[:\-–]\s*$/, "")
    .trim();
}

async function findRelatedParts(movie) {
  const baseNameN = extractSeriesBaseName(movie.name);
  const baseNamesO = extractSeriesBaseNames(movie.origin_name);
  const baseNameO = baseNamesO[0] || "";
  if ((!baseNameN || baseNameN.length < 2) && (!baseNameO || baseNameO.length < 2)) return [];

  const cacheKey = `parts:${baseNameN || baseNameO}:${movie.year || 0}`;
  const cached = cache.parts.get(cacheKey);
  if (cached) return cached;

  try {
    const q = baseNameN || baseNameO;
    const searchResult = await sourceManager.searchAll(q, 1, 20);
    const allItems = searchResult.items || [];

    const candidates = [];
    const seenSlugs = new Set();
    let hasCurrent = false;

    const nonSeasonPattern = /tóm tắt|tổng hợp|\brecap\b|\bsummary\b|\bova\b|\boad\b|\bnhật ký\b|\bdiaries\b|\bthe movie\b/i;

    for (const item of allItems) {
      if (seenSlugs.has(item.slug)) continue;

      if (!item.isCurrent && item.slug !== movie.slug) {
        const itemNameLower = (item.name || "").toLowerCase();
        const movieNameLower = (movie.name || "").toLowerCase();
        if (nonSeasonPattern.test(itemNameLower) && !nonSeasonPattern.test(movieNameLower)) continue;
      }

      const itemBaseN = extractSeriesBaseName(item.name);
      const itemBaseNamesO = extractSeriesBaseNames(item.origin_name);

      let isMatch = false;
      if (baseNameN && itemBaseN && itemBaseN === baseNameN) {
        isMatch = true;
      } else {
        const hasOriginOverlap = baseNamesO.some(bo => itemBaseNamesO.includes(bo));
        if (hasOriginOverlap) {
          if (baseNameN && itemBaseN && baseNameN !== itemBaseN) {
            if (item.type && movie.type && item.type !== movie.type) isMatch = false;
            else isMatch = true;
          } else {
            isMatch = true;
          }
        }
      }

      if (isMatch) {
        seenSlugs.add(item.slug);
        const partNum = extractPartNumber(item.name, item.origin_name);
        if (item.slug === movie.slug) hasCurrent = true;
        candidates.push({
          item, extractedPart: partNum, year: item.year || 0,
          isCurrent: item.slug === movie.slug, hasExplicit: !!partNum,
        });
      }
    }

    if (!hasCurrent) {
      candidates.push({
        item: movie, extractedPart: extractPartNumber(movie.name, movie.origin_name),
        year: movie.year || 0, isCurrent: true,
        hasExplicit: !!extractPartNumber(movie.name, movie.origin_name),
      });
    }

    const currentYear = movie.year || 0;
    let finalCandidates = candidates.filter((c) => {
      if (c.isCurrent) return true;
      if (currentYear > 0 && c.year > 0 && Math.abs(c.year - currentYear) > 20) return false;
      return true;
    });

    const explicitCount = finalCandidates.filter((c) => c.hasExplicit || c.isCurrent).length;
    if (explicitCount >= 2) {
      finalCandidates = finalCandidates.filter((c) => c.hasExplicit || c.isCurrent);
    }

    finalCandidates.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (!a.extractedPart && b.extractedPart) return -1;
      if (a.extractedPart && !b.extractedPart) return 1;
      if (a.extractedPart && b.extractedPart) return a.extractedPart - b.extractedPart;
      return 0;
    });

    const partsMap = new Map();
    let nextPart = 1;
    for (const cand of finalCandidates) {
      let partNum = cand.extractedPart;
      if (!partNum) {
        let existingPartForYear = null;
        for (const [p, obj] of partsMap.entries()) {
          if (obj.year === cand.year) { existingPartForYear = p; break; }
        }
        partNum = existingPartForYear || nextPart;
      }
      if (partNum >= nextPart) nextPart = partNum + 1;

      const partObj = {
        name: `Phần ${partNum}`,
        fullName: `Phần ${partNum}${cand.year ? " (" + cand.year + ")" : ""}`,
        slug: cand.item.slug, part: partNum, year: cand.year,
        isCurrent: cand.isCurrent, _source: cand.item._source,
      };

      if (!partsMap.has(partNum)) {
        partsMap.set(partNum, partObj);
      } else {
        const existing = partsMap.get(partNum);
        if (cand.isCurrent) partsMap.set(partNum, partObj);
        else if (!existing.isCurrent) {
          if (cand.hasExplicit && !existing.hasExplicit) partsMap.set(partNum, partObj);
          else if (!cand.hasExplicit && !existing.hasExplicit && cand.year > existing.year) partsMap.set(partNum, partObj);
        }
      }
    }

    const parts = Array.from(partsMap.values()).sort((a, b) => (a.part || 999) - (b.part || 999));
    const result = parts.length > 1 ? parts : [];
    cache.parts.set(cacheKey, result);
    return result;
  } catch (err) {
    logger.warn("parts", `findRelatedParts failed: ${baseNameO || baseNameN}`, err);
    return [];
  }
}

// ─── Smart related movies ────────────────────────────────────────────────────

async function getSmartRelated(movie) {
  const cacheKey = `related:${movie._source}:${movie.slug}`;
  const cached = cache.related.get(cacheKey);
  if (cached && cached.length > 0) return cached;

  const movieCategories = (movie.category || []).map((c) => c.slug);
  const movieCountries = (movie.country || []).map((c) => c.slug);
  const baseName = extractBaseName(movie.origin_name) || extractBaseName(movie.name);

  logger.info("movie", `getSmartRelated: slug=${movie.slug}, baseName="${baseName}", cats=${movieCategories.join(",")}, countries=${movieCountries.join(",")}, type=${movie.type}`);

  const fetches = [];

  // 1. Search by base name (60 items)
  if (baseName && baseName.length >= 2) {
    fetches.push(
      sourceManager.searchAll(baseName, 1, 60).catch(() => ({ items: [] }))
    );
  }

  // 2. Fetch by each category (top 3)
  for (const cat of movieCategories.slice(0, 3)) {
    fetches.push(
      sourceManager.getByCategory(cat, 1).catch(() => ({ items: [] }))
    );
  }

  // 3. Fetch by movie type
  const typeSlug =
    movie.type === "series" ? "phim-bo"
    : movie.type === "hoathinh" ? "hoat-hinh"
    : movie.type === "tvshows" ? "tv-shows"
    : null;
  if (typeSlug) {
    fetches.push(
      sourceManager.getByType(typeSlug, 1).catch(() => ({ items: [] }))
    );
  }

  // 4. Fetch by country (top 2)
  for (const country of movieCountries.slice(0, 2)) {
    fetches.push(
      sourceManager.getByCountry(country, 1).catch(() => ({ items: [] }))
    );
  }

  // 5. Also fetch "new movies" as a broad pool
  fetches.push(
    sourceManager.fetchAllNewMovies(1).catch(() => ({ items: [] }))
  );

  const results = await Promise.all(fetches);

  const candidateMap = new Map();
  for (const result of results) {
    for (const item of result.items || []) {
      if (item.slug === movie.slug) continue;
      if (!candidateMap.has(item.slug)) candidateMap.set(item.slug, item);
    }
  }

  logger.info("movie", `getSmartRelated: candidates=${candidateMap.size}, fetches=${results.length}, itemsPerFetch=[${results.map(r => (r.items || []).length).join(",")}]`);

  const scored = [];
  for (const [, item] of candidateMap) {
    let score = 0;
    const itemBaseName = extractBaseName(item.origin_name) || extractBaseName(item.name);
    const baseL = baseName ? baseName.toLowerCase() : "";
    const itemBaseL = itemBaseName ? itemBaseName.toLowerCase() : "";
    if (baseL && itemBaseL) {
      if (baseL === itemBaseL) score += 50;
      else if (itemBaseL.startsWith(baseL) || baseL.startsWith(itemBaseL)) score += 40;
      else if (itemBaseL.includes(baseL) || baseL.includes(itemBaseL)) score += 20;
    }
    const itemCategories = (item.category || []).map((c) => c.slug);
    score += itemCategories.filter((c) => movieCategories.includes(c)).length * 10;
    const itemCountries = (item.country || []).map((c) => c.slug);
    score += itemCountries.filter((c) => movieCountries.includes(c)).length * 5;
    if (movie.year && item.year && Math.abs(movie.year - item.year) <= 3) score += 3;
    if (movie.type && item.type === movie.type) score += 2;
    scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const result = scored.slice(0, 12).map((s) => s.item);
  logger.info("movie", `getSmartRelated: final result count=${result.length}, top3=[${result.slice(0,3).map(m => m.name).join(", ")}]`);
  cache.related.set(cacheKey, result);
  return result;
}

// ─── Route handlers ──────────────────────────────────────────────────────────

exports.getHome = async (req, res) => {
  try {
    const cacheKey = "home:v3";
    let cached = cache.home.get(cacheKey);

    if (!cached) {
      // Batch 1: Critical sections (new movies + series) — must load
      const [newP1, newP2, series] = await Promise.all([
        sourceManager.fetchAllNewMovies(1).catch(() => ({ items: [] })),
        sourceManager.fetchAllNewMovies(2).catch(() => ({ items: [] })),
        sourceManager.getByType("phim-bo", 1).catch(() => ({ items: [] })),
      ]);

      // Batch 2: Secondary sections — may fail gracefully
      const [single, hot, theater, anime] = await Promise.all([
        sourceManager.getByType("phim-le", 1).catch(() => ({ items: [] })),
        sourceManager.getByType("phim-bo-dang-chieu", 1).catch(() => ({ items: [] })),
        sourceManager.getByType("phim-chieu-rap", 1).catch(() => ({ items: [] })),
        sourceManager.getByType("hoat-hinh", 1).catch(() => ({ items: [] })),
      ]);

      const allNew = [
        ...(newP1.items || []),
        ...(newP2.items || []),
      ];

      const allNewFiltered = allNew.filter(m => !isTrailer(m));
      const seriesFiltered = (series.items || []).filter(m => !isTrailer(m));
      const singleFiltered = (single.items || []).filter(m => !isTrailer(m));
      const hotFiltered = (hot.items || []).filter(m => !isTrailer(m));
      const theaterFiltered = (theater.items || []).filter(m => !isTrailer(m));
      const animeFiltered = (anime.items || []).filter(m => !isTrailer(m));

      // Pre-compute image URLs (raw CDN URLs)
      // Extract episode slug from episode_current (e.g. "Tập 12" → "12", "Tập 1" → "1", "Full" → "full")
      const epSlugFromCurrent = (ep) => {
        if (!ep) return null;
        const s = ep.toLowerCase().trim();
        if (s === "full" || s === "complete") return "full";
        const m = s.match(/(\d+)/);
        return m ? m[1] : null;
      };
      const withEpSlug = (m) => ({
        ...m,
        epSlug: epSlugFromCurrent(m.episode_current),
      });
      const heroRaw = allNewFiltered.slice(0, 10);
      const heroEnriched = await enrichMoviesWithLogos(heroRaw).catch(() => heroRaw);
      cached = {
        heroMovies: heroEnriched.map((m) => withEpSlug({ ...m, content: sanitizeContent(m.content) })),
        heroMoviesProxy: heroRaw.map((m) => {
          return {
            posterProxyUrl: m.poster_url || m.thumb_url || "",
            thumbProxyUrl: m.thumb_url || m.poster_url || "",
          };
        }),
        topMovies: allNewFiltered.slice(0, 10).map(withEpSlug),
        topMoviesProxy: allNewFiltered.slice(0, 10).map((m) => {
          const raw = m.poster_url || m.thumb_url || "";
          return { posterProxyUrl: raw, thumbProxyUrl: raw };
        }),
        newMovies: allNewFiltered.slice(10, 26),
        seriesMovies: seriesFiltered.slice(0, 16),
        singleMovies: singleFiltered.slice(0, 16),
        hotMovies: hotFiltered.slice(0, 16),
        theaterMovies: theaterFiltered.slice(0, 16),
        animeMovies: animeFiltered.slice(0, 16),
      };
      // Only cache if we actually got data — avoid caching empty results on cold start
      const hasData = allNewFiltered.length > 0 || seriesFiltered.length > 0 || hotFiltered.length > 0;
      if (hasData) cache.home.set(cacheKey, cached);
    }

    const continueWatching = req.session.user
      ? await database.getWatchHistory(req.session.user.id, 12)
      : [];

    res.render("pages/home", {
      title: "movieCC - Xem phim trực tuyến miễn phí | Vietsub HD",
      metaDesc: "movieCC - Xem phim trực tuyến chất lượng cao miễn phí. Phim bộ, phim lẻ, anime, phim chiếu rạp mới nhất với phụ đề tiếng Việt, cập nhật nhanh nhất 2026.",
      isHome: true,
      ...cached,
      continueWatching,
      breadcrumbs: [{ name: "Trang chủ" }],
    });
  } catch (err) {
    logger.error("movie", "Lỗi trang chủ", err);
    res.render("pages/home", {
      title: "movieCC - Xem phim trực tuyến",
      heroMovies: [], topMovies: [], newMovies: [],
      hotMovies: [], seriesMovies: [], singleMovies: [],
      continueWatching: [], theaterMovies: [], animeMovies: [],
    });
  }
};

exports.getMovieDetail = async (req, res) => {
  try {
    const slug = req.params.slug;
    const cacheKey = `detail:merged:${slug}`;
    let movie = cache.detail.get(cacheKey);

    if (!movie) {
      movie = await sourceManager.getDetailMerged(slug);
      if (movie) cache.detail.set(cacheKey, movie);
    }

    if (!movie) {
      return res.status(404).render("pages/404", { title: "Không tìm thấy phim - movieCC" });
    }

    // Build episode list from merged format
    let episodes;
    if (Array.isArray(movie.episodes?.[0]?.servers)) {
      episodes = movie.episodes.map((ep) => ({
        name: ep.name, slug: ep.slug,
        link_embed: ep.servers?.[0]?.link_embed,
        link_m3u8: ep.servers?.[0]?.link_m3u8,
      }));
    } else {
      const firstServer = movie.episodes?.[0];
      episodes = (firstServer?.server_data || [])
        .filter((ep) => ep.link_embed || ep.link_m3u8)
        .map((ep) => ({ name: ep.name, slug: ep.slug || ep.name, link_embed: ep.link_embed, link_m3u8: ep.link_m3u8 }));
    }

    // Time-boxed related content fetch — max 10s (up to 8 parallel API calls inside)
    const RELATED_TIMEOUT = 10000;
    let relatedParts = [], relatedMovies = [];
    try {
      const relatedResult = await Promise.race([
        Promise.all([
          findRelatedParts(movie).catch(() => []),
          getSmartRelated(movie).catch(() => []),
        ]),
        new Promise((resolve) => setTimeout(() => resolve(null), RELATED_TIMEOUT)),
      ]);
      if (relatedResult) {
        [relatedParts, relatedMovies] = relatedResult;
      } else {
        logger.warn("movie", `related timeout after ${RELATED_TIMEOUT}ms for ${movie.slug}`);
      }
    } catch (e) {
      logger.warn("movie", `related fetch error for ${movie.slug}: ${e.message}`);
    }

    movie.content = sanitizeContent(movie.content);
    const rawDesc = (movie.content || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().substring(0, 200);

    const jsonLdType = movie.type === "series" || movie.type === "hoathinh" ? "TVSeries" : "Movie";
    const jsonLdObj = {
      "@context": "https://schema.org", "@type": jsonLdType,
      name: movie.name || "", alternateName: movie.origin_name || "",
      description: rawDesc, image: movie.poster_url || movie.thumb_url || "",
      datePublished: movie.year ? String(movie.year) : "",
      dateModified: new Date().toISOString().split("T")[0],
      inLanguage: movie.lang || "vi",
      url: `${res.locals.siteUrl}/phim/${movie.slug}`,
      genre: (movie.category || []).map((c) => c.name).filter(Boolean),
      contentRating: movie.quality || "HD",
    };
    if (movie.episode_total) jsonLdObj.numberOfEpisodes = movie.episode_total;
    if (movie.country?.length > 0) {
      jsonLdObj.countryOfOrigin = movie.country.map((c) => ({ "@type": "Country", name: c.name }));
    }
    const tmdbRating = movie.tmdb?.vote_average || 0;
    if (tmdbRating > 0) {
      jsonLdObj.aggregateRating = {
        "@type": "AggregateRating", ratingValue: tmdbRating.toFixed(1),
        bestRating: "10", ratingCount: movie.tmdb?.vote_count || 1,
      };
    }
    if (movie.actor?.length > 0) jsonLdObj.actor = movie.actor.slice(0, 5).map((a) => ({ "@type": "Person", name: a }));
    if (movie.director?.length > 0) jsonLdObj.director = movie.director.slice(0, 3).map((d) => ({ "@type": "Person", name: d }));
    const jsonLd = JSON.stringify(jsonLdObj).replace(/<\//g, "<\\/");

    // ── FAQ Schema (SEO + GEO) ──────────────────────────────────────────────
    const isSeries = movie.type === "series" || movie.type === "hoathinh";
    const faqData = [];
    const epCount = movie.episode_total || "?";
    if (isSeries) {
      faqData.push({ q: `${movie.name} có bao nhiêu tập?`, a: `${movie.name} có tổng cộng ${epCount} tập. Được cập nhật đều đặn trên movieCC với chất lượng ${movie.quality} và phụ đề tiếng Việt (${movie.lang}).` });
    }
    if (movie.quality) faqData.push({ q: `${movie.name} có chất lượng nào?`, a: `${movie.name} có sẵn với chất lượng ${movie.quality}${movie.lang ? ` và phụ đề tiếng Việt (${movie.lang})` : ""}. Xem online không quảng cáo trên movieCC.` });
    if (movie.year) faqData.push({ q: `${movie.name} công chiếu năm nào?`, a: `${movie.name} công chiếu vào năm ${movie.year}${movie.country?.length ? `, thuộc phim ${movie.country.map(c => c.name).join(", ")}` : ""}.` });
    if (movie.actor?.length > 0) faqData.push({ q: `Diễn viên trong ${movie.name} gồm những ai?`, a: `${movie.name} có sự tham gia của ${movie.actor.slice(0, 3).join(", ")}${movie.actor.length > 3 ? " và các diễn viên khác" : ""}.` });
    if (isSeries) faqData.push({ q: `Xem ${movie.name} ở đâu chất lượng cao?`, a: `Xem phim ${movie.name} chất lượng cao không quảng cáo tại movieCC. Cập nhật nhanh chóng với phụ đề tiếng Việt Vietsub.` });
    faqData.push({ q: `${movie.name} - Xem phim online miễn phí?`, a: `Xem phim ${movie.name} trực tuyến miễn phí chất lượng cao tại movieCC. Kho phim đa dạng: phim bộ, phim lẻ, anime với phụ đề tiếng Việt.` });

    const faqJsonLd = faqData.length > 0 ? JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqData.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    }).replace(/<\//g, "<\\/") : "";

    const ogType = movie.type === "series" || movie.type === "hoathinh" ? "video.tv_show" : "video.movie";

    const detailBreadcrumbs = [{ name: "Trang chủ", url: "/" }];
    if (movie.type === "series") detailBreadcrumbs.push({ name: "Phim Bộ", url: "/danh-sach/phim-bo" });
    else if (movie.type === "hoathinh") detailBreadcrumbs.push({ name: "Anime", url: "/danh-sach/hoat-hinh" });
    else detailBreadcrumbs.push({ name: "Phim Lẻ", url: "/danh-sach/phim-le" });
    detailBreadcrumbs.push({ name: movie.name });

    res.render("pages/movie-detail", {
      title: `${movie.name}${movie.origin_name ? " (" + movie.origin_name + ")" : ""} - Xem phim online - movieCC`,
      metaDesc: `Xem phim ${movie.name}${movie.origin_name ? " (" + movie.origin_name + ")" : ""} - ${movie.quality} ${movie.lang} - ${movie.episode_current}. ${rawDesc.substring(0, 120)}`,
      ogImage: toAbsoluteUrl(movie.poster_url || movie.thumb_url || "", res.locals.siteUrl), ogType,
      ogUrl: `${res.locals.siteUrl}/phim/${movie.slug}`,
      movie, episodes, relatedParts, relatedMovies, jsonLd,
      faqJsonLd, faqData,
      breadcrumbs: detailBreadcrumbs,
      isDetailPage: true,
    });
  } catch (err) {
    logger.error("movie", "Lỗi chi tiết phim", err);
    res.redirect("/?msg=" + encodeURIComponent("Không thể tải thông tin phim. Vui lòng thử lại.") + "&msgtype=error");
  }
};

exports.getWatch = async (req, res) => {
  try {
    const slug = req.params.slug;
    const cacheKey = `detail:merged:${slug}`;
    let movie = cache.detail.get(cacheKey);

    if (!movie) {
      movie = await sourceManager.getDetailMerged(slug);
      if (movie) cache.detail.set(cacheKey, movie);
    }

    if (!movie) return res.status(404).render("pages/404", { title: "Không tìm thấy phim - movieCC" });

    const currentEpSlug = req.params.episode;
    const isMergedFormat = Array.isArray(movie.episodes?.[0]?.servers);

    const isAdmin = req.session.user?.role === "admin";
    let servers, episodes, currentEp, activeServerIdx = 0;

    if (isMergedFormat) {
      const serverMap = new Map();
      for (const ep of movie.episodes) {
        for (const svr of ep.servers || []) {
          const isNguonc = svr._providerName === "nguonc";
          if (isNguonc) {
            const hasM3u8 = !!svr.link_m3u8;
            const hasEmbed = !!svr.link_embed;
            if (!hasM3u8 && !hasEmbed) continue;
            if (!hasM3u8 && !isAdmin) continue;
          } else {
            if (!svr.link_m3u8) continue;
          }
          if (!serverMap.has(svr.serverName)) serverMap.set(svr.serverName, { _providerName: svr._providerName, episodes: [] });
          serverMap.get(svr.serverName).episodes.push({
            name: ep.name, slug: ep.slug,
            // NguonC: ưu tiên embed (m3u8 thường chết), OPhim/KKPhim: dùng m3u8
            link_m3u8: isNguonc ? "" : svr.link_m3u8,
            // NguonC: luôn dùng embed URL nếu có (link_embed_fallback xử lý admin case riêng)
            link_embed: isNguonc ? (svr.link_embed || "") : "",
            link_embed_fallback: (isNguonc && isAdmin && svr.link_m3u8 && svr.link_embed) ? svr.link_embed : "",
          });
        }
      }

      // Sắp xếp: theo provider (ophim=1, kkphim=2, nguonc=3), rồi Vietsub trước Lồng Tiếng
      const providerOrder = { ophim: 0, kkphim: 1, nguonc: 2 };
      const langOrder = (name) => {
        const lang = name.replace(/\s*-\s*Server\s*\d+.*$/i, "").trim().toLowerCase();
        if (lang.includes("vietsub")) return 0;
        if (lang.includes("lồng") || lang.includes("long")) return 1;
        return 2;
      };
      const sorted = Array.from(serverMap.entries()).sort((a, b) => {
        const oa = providerOrder[a[1]._providerName] ?? 99;
        const ob = providerOrder[b[1]._providerName] ?? 99;
        if (oa !== ob) return oa - ob;
        return langOrder(a[0]) - langOrder(b[0]);
      });

      // Đánh số server cố định: OPhim=1, KKPhim=2, NguonC=3
      const fixedProviderIdx = { ophim: 1, kkphim: 2, nguonc: 3 };
      servers = sorted.map(([origName, data]) => {
        const num = fixedProviderIdx[data._providerName] ?? 99;
        const langPrefix = origName.replace(/\s*-\s*Server\s*\d+.*$/i, "").trim() || "Server";
        const newName = `${langPrefix} - Server ${num}`;
        return { name: newName, is_ai: false, _providerName: data._providerName, episodes: data.episodes };
      });

      const epMap2 = new Map();
      for (const ep of movie.episodes) { if (!epMap2.has(ep.slug)) epMap2.set(ep.slug, ep); }
      episodes = Array.from(epMap2.values());

      currentEp = null;
      let fallbackEp = null, fallbackIdx = 0;
      for (let i = 0; i < servers.length; i++) {
        const found = servers[i].episodes.find((e) => e.slug === currentEpSlug);
        if (found) {
          if (!fallbackEp) { fallbackEp = found; fallbackIdx = i; }
          if (found.link_m3u8 && !currentEp) { currentEp = found; activeServerIdx = i; }
        }
      }
      if (!currentEp && fallbackEp) { currentEp = fallbackEp; activeServerIdx = fallbackIdx; }
    } else {
      servers = (movie.episodes || []).map((server) => {
        const isNguonc = server._providerName === "nguonc";
        return {
          name: server.server_name, is_ai: server.is_ai || false,
          episodes: (server.server_data || [])
            .filter((ep) => isNguonc ? ep.link_embed : ep.link_m3u8)
            .map((ep) => ({
              name: ep.name,
              slug: (ep.slug || ep.name || "").toLowerCase(),
              link_m3u8: isNguonc ? "" : ep.link_m3u8,
              link_embed: isNguonc ? ep.link_embed : "",
            })),
        };
      }).filter((s) => s.episodes.length > 0);

      let legacyFallbackEp = null, legacyFallbackIdx = 0;
      currentEp = null; activeServerIdx = 0;
      for (let i = 0; i < servers.length; i++) {
        const found = servers[i]?.episodes?.find((ep) => ep.slug === currentEpSlug || ep.slug.toLowerCase() === currentEpSlug);
        if (found) {
          if (!legacyFallbackEp) { legacyFallbackEp = found; legacyFallbackIdx = i; }
          if (found.link_m3u8 && !currentEp) { currentEp = found; activeServerIdx = i; }
        }
      }
      if (!currentEp && legacyFallbackEp) { currentEp = legacyFallbackEp; activeServerIdx = legacyFallbackIdx; }

      const epMap = new Map();
      servers.forEach((server) => {
        (server.episodes || []).forEach((ep) => { if (!epMap.has(ep.slug)) epMap.set(ep.slug, ep); });
      });
      episodes = Array.from(epMap.values()).sort((a, b) => {
        const na = parseInt(a.slug.replace(/\D/g, "")) || Infinity;
        const nb = parseInt(b.slug.replace(/\D/g, "")) || Infinity;
        return na - nb;
      });
    }

    if (!currentEp) {
      return res.redirect(`/phim/${slug}?msg=${encodeURIComponent("Không tìm thấy tập phim này")}&msgtype=error`);
    }

    let streamHash = "", embedUrl = "", embedFallbackUrl = "";
    if (currentEp?.link_m3u8) streamHash = encryptStreamUrl(currentEp.link_m3u8);
    if (currentEp?.link_embed) embedUrl = `/api/embed/${encryptStreamUrl(currentEp.link_embed)}`;
    // NguonC admin fallback: có m3u8 nhưng cũng có embed dự phòng
    if (currentEp?.link_embed_fallback) embedFallbackUrl = `/api/embed/${encryptStreamUrl(currentEp.link_embed_fallback)}`;

    const serverEmbeds = {}, serverStreams = {}, serverEmbedFallbacks = {};
    servers.forEach((server, idx) => {
      const ep = server.episodes.find((e) => e.slug === currentEpSlug);
      if (ep) {
        if (ep.link_m3u8) serverStreams[idx] = encryptStreamUrl(ep.link_m3u8);
        if (ep.link_embed) serverEmbeds[idx] = `/api/embed/${encryptStreamUrl(ep.link_embed)}`;
        if (ep.link_embed_fallback) serverEmbedFallbacks[idx] = `/api/embed/${encryptStreamUrl(ep.link_embed_fallback)}`;
      }
    });

    // Time-boxed related movies fetch — max 10s
    let relatedMovies = [];
    try {
      const result = await Promise.race([
        getSmartRelated(movie).catch(() => []),
        new Promise((resolve) => setTimeout(() => resolve(null), 10000)),
      ]);
      if (result) relatedMovies = result;
    } catch (e) { /* ignore */ }

    database.recordPageView(slug, currentEpSlug, req.session.user?.id || null, req.ip, req.headers["user-agent"]);

    const watchOgType = movie.type === "series" || movie.type === "hoathinh" ? "video.tv_show" : "video.movie";
    const displayEpName = currentEp?.name || currentEpSlug;
    const displayEpPrefix = displayEpName.toLowerCase() === "full" ? "Full" : `Tập ${displayEpName}`;

    const watchJsonLdObj = {
      "@context": "https://schema.org", "@type": "VideoObject",
      name: `${movie.name} - ${displayEpPrefix}`,
      description: `Xem phim ${movie.name} - ${displayEpPrefix} - ${movie.quality} ${movie.lang}. Xem trực tuyến tốc độ cao, phụ đề tiếng Việt.`,
      thumbnailUrl: movie.poster_url || movie.thumb_url || "",
      uploadDate: movie.year ? `${movie.year}-01-01` : new Date().toISOString().split("T")[0],
      contentUrl: `${res.locals.siteUrl}/xem/${slug}/${currentEpSlug}`,
      embedUrl: `${res.locals.siteUrl}/xem/${slug}/${currentEpSlug}`,
      inLanguage: movie.lang || "vi",
    };
    const isoDuration = parseIsoDuration(movie.time);
    if (isoDuration) watchJsonLdObj.duration = isoDuration;
    if (movie.category?.length > 0) watchJsonLdObj.genre = movie.category.map((c) => c.name);
    const watchTmdb = movie.tmdb?.vote_average || 0;
    if (watchTmdb > 0) {
      watchJsonLdObj.aggregateRating = {
        "@type": "AggregateRating", ratingValue: watchTmdb.toFixed(1),
        bestRating: "10", ratingCount: movie.tmdb?.vote_count || 1,
      };
    }
    const watchJsonLd = JSON.stringify(watchJsonLdObj).replace(/<\//g, "<\\/");

    const watchBreadcrumbs = [{ name: "Trang chủ", url: "/" }];
    if (movie.type === "series") watchBreadcrumbs.push({ name: "Phim Bộ", url: "/danh-sach/phim-bo" });
    else if (movie.type === "hoathinh") watchBreadcrumbs.push({ name: "Anime", url: "/danh-sach/hoat-hinh" });
    else watchBreadcrumbs.push({ name: "Phim Lẻ", url: "/danh-sach/phim-le" });
    watchBreadcrumbs.push({ name: movie.name, url: `/phim/${slug}` });
    watchBreadcrumbs.push({ name: displayEpPrefix });

    // SEO-2: Trang /xem/* canonical về /phim/{slug} để Google chỉ index trang chi tiết,
    // tránh duplicate content giữa N tập của cùng 1 phim.
    res.render("pages/watch", {
      title: `Xem ${movie.name} - ${displayEpPrefix} - movieCC`,
      metaDesc: `Xem phim ${movie.name} - ${displayEpPrefix} - ${movie.quality} ${movie.lang}. Xem trực tuyến tốc độ cao, phụ đề tiếng Việt, không quảng cáo tại movieCC.`,
      ogImage: toAbsoluteUrl(movie.poster_url || movie.thumb_url || "", res.locals.siteUrl), ogType: watchOgType,
      ogUrl: `${res.locals.siteUrl}/xem/${slug}/${currentEpSlug}`,
      canonicalUrl: `${res.locals.siteUrl}/phim/${slug}`,
      noIndex: true, // SEO-2: trang xem không cần index (đã canonical)
      movie, currentEpisode: currentEpSlug, episodes, servers, activeServerIdx,
      serverEmbeds: JSON.stringify(serverEmbeds), serverStreams: JSON.stringify(serverStreams),
      serverEmbedFallbacks: JSON.stringify(serverEmbedFallbacks),
      streamHash, embedUrl, embedFallbackUrl, relatedMovies, watchJsonLd, breadcrumbs: watchBreadcrumbs,
    });
  } catch (err) {
    logger.error("movie", "Lỗi xem phim", err);
    res.redirect("/?msg=" + encodeURIComponent("Không thể tải phim. Server đang gặp sự cố.") + "&msgtype=error");
  }
};

// ─── Stream / Proxy handlers ─────────────────────────────────────────────────

exports.getStream = (req, res) => {
  try {
    const url = decryptStreamUrl(req.params.hash);
    if (!url) return res.status(400).json({ error: "Link không hợp lệ" });
    res.json({ url: "/api/hls/" + encodeURIComponent(req.params.hash) });
  } catch (err) {
    logger.error("movie", "Lỗi giải mã stream", err);
    res.status(400).json({ error: "Link không hợp lệ" });
  }
};

function isM3u8Url(urlStr) {
  try { return /\.m3u8$/i.test(new URL(urlStr).pathname); }
  catch { return /\.m3u8$/i.test(urlStr.split("?")[0]); }
}

function resolveHlsRef(ref, baseUrlStr) {
  try { return new URL(ref, baseUrlStr).href; } catch { return null; }
}

function validateOutboundUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.)/.test(host)) return false;
    return true;
  } catch { return false; }
}

exports.proxyM3u8 = async (req, res) => {
  try {
    const hash = req.params.hash;
    const url = decryptStreamUrl(hash);
    if (!url || !validateOutboundUrl(url)) return res.status(400).send("Invalid");

    const hostname = new URL(url).hostname;
    const referer = detectReferer(hostname);
    const altReferer = detectAltReferer(hostname);

    const baseFetchHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
    };

    async function attemptFetch(ref) {
      const headers = { ...baseFetchHeaders };
      if (ref) {
        headers["Referer"] = ref;
        headers["Origin"] = ref.replace(/\/$/, "");
      }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      try {
        const r = await nodeFetch(url, { signal: ctrl.signal, headers });
        return r;
      } finally {
        clearTimeout(t);
      }
    }

    let response = await attemptFetch(referer);

    if (!response.ok && altReferer) {
      logger.warn("movie", `Proxy m3u8 attempt 1 failed (${response.status}), retrying with alt referer for ${hostname}`);
      response = await attemptFetch(altReferer);
    }

    if (!response.ok && !referer) {
      response = await attemptFetch(null);
    }

    if (!response.ok) {
      logger.error("movie", `Proxy m3u8 upstream error: ${response.status} for ${url}`);
      return res.status(502).send("Upstream error");
    }

    const m3u8CacheKey = `m3u8:${url}`;
    let rewritten = cache.m3u8.get(m3u8CacheKey);

    if (!rewritten) {
      const text = await response.text();
      rewritten = text.split("\n").map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (trimmed.startsWith("#")) {
          if (trimmed.includes('URI="')) {
            return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
              const fullUri = resolveHlsRef(uri, url);
              if (!fullUri) return match;
              const h = encryptStreamUrl(fullUri);
              return isM3u8Url(fullUri)
                ? 'URI="/api/hls/' + encodeURIComponent(h) + '"'
                : 'URI="/api/hls-seg/' + encodeURIComponent(h) + '"';
            });
          }
          return line;
        }
        const fullUrl2 = resolveHlsRef(trimmed, url);
        if (!fullUrl2) return line;
        const h = encryptStreamUrl(fullUrl2);
        return isM3u8Url(fullUrl2) ? "/api/hls/" + encodeURIComponent(h) : "/api/hls-seg/" + encodeURIComponent(h);
      }).join("\n");
      cache.m3u8.set(m3u8CacheKey, rewritten);
    }

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "private, max-age=5");
    res.send(rewritten);
  } catch (err) {
    // Lỗi kỳ vọng (CDN chết, timeout, DNS): chỉ warn không cần stacktrace
    const knownErr = err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND'
      || err?.type === 'aborted' || err?.name === 'AbortError'
      || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|aborted/i.test(err?.message || '');
    if (knownErr) {
      let errHost = '';
      try { errHost = new URL(url || '').hostname; } catch { errHost = (err?.message || '').substring(0, 60); }
      logger.warn("movie", `Proxy m3u8 không khả dụng: ${errHost}`);
    } else {
      logger.error("movie", `Lỗi proxy m3u8: ${err?.message}`, err);
    }
    if (!res.headersSent) res.status(502).send("Proxy error");
  }
};

exports.proxySegment = async (req, res) => {
  try {
    const hash = req.params.hash;
    const url = decryptStreamUrl(hash);
    if (!url || !validateOutboundUrl(url)) return res.status(400).send("Invalid");

    const hostname = new URL(url).hostname;
    const referer = detectReferer(hostname);
    const altReferer = detectAltReferer(hostname);

    const baseHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "*/*",
    };
    if (req.headers.range) baseHeaders["Range"] = req.headers.range;

    async function attemptSegFetch(ref) {
      const headers = { ...baseHeaders };
      if (ref) {
        headers["Referer"] = ref;
        headers["Origin"] = ref.replace(/\/$/, "");
      }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 30000);
      try {
        const r = await nodeFetch(url, { signal: ctrl.signal, headers });
        if (!r.ok && r.status !== 206) { clearTimeout(t); return null; }
        return { response: r, timeout: t };
      } catch (e) {
        clearTimeout(t);
        return null;
      }
    }

    let result = await attemptSegFetch(referer);
    if (!result && altReferer) {
      result = await attemptSegFetch(altReferer);
    }

    if (!result) {
      return res.status(502).send("Upstream error");
    }

    const { response, timeout } = result;

    res.status(response.status);
    const ct = response.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    if (response.headers.get("content-range")) res.setHeader("Content-Range", response.headers.get("content-range"));
    if (response.headers.get("content-length")) res.setHeader("Content-Length", response.headers.get("content-length"));
    if (response.headers.get("accept-ranges")) res.setHeader("Accept-Ranges", response.headers.get("accept-ranges"));
    res.setHeader("Cache-Control", "public, max-age=86400");

    response.body.on("end", () => clearTimeout(timeout));
    response.body.on("error", () => { clearTimeout(timeout); if (!res.headersSent) res.status(502).end(); });
    response.body.pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(502).send("Proxy error");
  }
};

// ─── Category / Country / Type list handlers ─────────────────────────────────

// Page size = 24 (chia hết cho 2/3/4/6/8/12 → grid responsive luôn full)
const LIST_PAGE_SIZE = 24;
const MAX_OVERFETCH_PAGES = 2; // fetch tối đa 2 upstream pages để bù dedupe

/**
 * Fetch danh sách phim từ source, bù thêm trang upstream nếu dedupe ăn mất items.
 * Đảm bảo trả về đủ LIST_PAGE_SIZE items mỗi page (trừ khi hết data).
 *
 * @param {string} method - "getByCategory" | "getByCountry" | "getByType"
 * @param {string} slug - slug/type param
 * @param {number} page - client page
 * @param {object} filters - filter params
 * @returns {Promise<{items, pagination, titlePage}>}
 */
async function fetchPaddedList(method, slug, page, filters) {
  const firstData = await sourceManager[method](slug, page, filters);
  let items = (firstData.items || []).slice();
  const pagination = firstData.pagination || { totalItems: 0, totalPages: 0, currentPage: page };
  const titlePage = firstData.titlePage || "";
  const upstreamTotalPages = pagination.totalPages || 0;

  // Nếu page đầu đã đủ, không cần over-fetch
  if (items.length >= LIST_PAGE_SIZE) {
    return { items: sortTrailersToEnd(items.slice(0, LIST_PAGE_SIZE)), pagination, titlePage };
  }

  // CHỈ over-fetch ở trang 1 — tránh duplicate items giữa client pages khi paginate sâu.
  // Trade-off: trang 1 (LCP, user thường nhìn nhất) luôn full grid; các trang sau
  // có thể không full nếu upstream dedup ăn nhiều, nhưng không có dupe khó chịu.
  if (page !== 1) {
    return { items: sortTrailersToEnd(items), pagination, titlePage };
  }

  const seen = new Set(items.map((m) => m.slug).filter(Boolean));
  let nextPage = page + 1;
  let fetched = 1;

  while (
    items.length < LIST_PAGE_SIZE &&
    fetched < MAX_OVERFETCH_PAGES + 1 &&
    (upstreamTotalPages === 0 || nextPage <= upstreamTotalPages)
  ) {
    try {
      const extra = await sourceManager[method](slug, nextPage, filters);
      const extraItems = extra.items || [];
      if (extraItems.length === 0) break;
      for (const it of extraItems) {
        if (it.slug && !seen.has(it.slug)) {
          items.push(it);
          seen.add(it.slug);
          if (items.length >= LIST_PAGE_SIZE) break;
        }
      }
      nextPage++;
      fetched++;
    } catch (e) {
      break;
    }
  }

  return { items: sortTrailersToEnd(items.slice(0, LIST_PAGE_SIZE)), pagination, titlePage };
}

exports.getByCategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const filters = { year: req.query.year, country: req.query.country, sort: req.query.sort, category: req.query.category };
    const PAGE_SIZE = LIST_PAGE_SIZE;

    const data = await fetchPaddedList("getByCategory", req.params.slug, page, filters);
    const movies = data.items || [];
    const totalItems = data.pagination?.totalItems || 0;
    let catName = data.titlePage || "";

    const cat = categories.find((c) => c.slug === req.params.slug);
    catName = catName || cat?.name || req.params.slug;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);

    if (movies.length === 0 && page > 1) {
      const qp = new URLSearchParams();
      if (filters.year) qp.set("year", filters.year);
      if (filters.country) qp.set("country", filters.country);
      if (filters.sort) qp.set("sort", filters.sort);
      const qs = qp.toString();
      return res.redirect(`/the-loai/${req.params.slug}${qs ? "?" + qs : ""}`);
    }

    const basePath = `/the-loai/${req.params.slug}`;
    const hasFilters = filters.year || filters.country || filters.sort;
    const canonicalUrl = `${res.locals.siteUrl}${basePath}${page > 1 ? '?page=' + page : ''}`;

    res.render("pages/category", {
      title: `${catName}${page > 1 ? ' - Trang ' + page : ''} - Xem phim online - movieCC`,
      metaDesc: `Danh sách phim thể loại ${catName} mới nhất${page > 1 ? ' - Trang ' + page : ''}. Xem phim ${catName} chất lượng cao, phụ đề tiếng Việt tại movieCC.`,
      categoryName: catName, categorySlug: req.params.slug,
      movies, totalPages, currentPage: page,
      filterType: "category", activeFilters: filters,
      canonicalUrl, noIndex: !!hasFilters,
      collectionJsonLd: buildCollectionSchema(catName, basePath, movies, res.locals.siteUrl || ""),
      paginationPrev: page > 1 ? `${basePath}?page=${page - 1}` : null,
      paginationNext: page < totalPages ? `${basePath}?page=${page + 1}` : null,
      breadcrumbs: [{ name: "Trang chủ", url: "/" }, { name: "Thể loại", url: "/tim-kiem" }, { name: catName }],
    });
  } catch (err) {
    logger.error("movie", "Lỗi thể loại", err);
    res.redirect("/?msg=" + encodeURIComponent("Không thể tải danh sách phim. Vui lòng thử lại.") + "&msgtype=error");
  }
};

exports.getByCountry = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const filters = { year: req.query.year, category: req.query.category, sort: req.query.sort };
    const PAGE_SIZE = LIST_PAGE_SIZE;

    const data = await fetchPaddedList("getByCountry", req.params.slug, page, filters);
    const movies = data.items || [];
    const totalItems = data.pagination?.totalItems || 0;
    let countryName = data.titlePage || "";

    const c = countries.find((c) => c.slug === req.params.slug);
    countryName = countryName || c?.name || req.params.slug;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);

    if (movies.length === 0 && page > 1) {
      const qp = new URLSearchParams();
      if (filters.year) qp.set("year", filters.year);
      if (filters.category) qp.set("category", filters.category);
      if (filters.sort) qp.set("sort", filters.sort);
      const qs = qp.toString();
      return res.redirect(`/quoc-gia/${req.params.slug}${qs ? "?" + qs : ""}`);
    }

    const basePath = `/quoc-gia/${req.params.slug}`;
    const hasFilters = filters.year || filters.category || filters.sort;
    const canonicalUrl = `${res.locals.siteUrl}${basePath}${page > 1 ? '?page=' + page : ''}`;

    res.render("pages/category", {
      title: `Phim ${countryName}${page > 1 ? ' - Trang ' + page : ''} - Xem phim online - movieCC`,
      metaDesc: `Danh sách phim ${countryName} mới nhất${page > 1 ? ' - Trang ' + page : ''}. Xem phim ${countryName} chất lượng cao, phụ đề tiếng Việt tại movieCC.`,
      categoryName: countryName, categorySlug: req.params.slug,
      movies, totalPages, currentPage: page,
      filterType: "country", activeFilters: filters,
      canonicalUrl, noIndex: !!hasFilters,
      collectionJsonLd: buildCollectionSchema(countryName, basePath, movies, res.locals.siteUrl || ""),
      paginationPrev: page > 1 ? `${basePath}?page=${page - 1}` : null,
      paginationNext: page < totalPages ? `${basePath}?page=${page + 1}` : null,
      breadcrumbs: [{ name: "Trang chủ", url: "/" }, { name: "Quốc gia", url: "/tim-kiem" }, { name: countryName }],
    });
  } catch (err) {
    logger.error("movie", "Lỗi quốc gia", err);
    res.redirect("/?msg=" + encodeURIComponent("Không thể tải danh sách phim. Vui lòng thử lại.") + "&msgtype=error");
  }
};

exports.getByType = async (req, res) => {
  try {

    const page = parseInt(req.query.page) || 1;
    const filters = { year: req.query.year, category: req.query.category, country: req.query.country, sort: req.query.sort };
    const typeNames = {
      "phim-bo": "Phim Bộ", "phim-le": "Phim Lẻ", "hoat-hinh": "Anime",
      "tv-shows": "TV Shows", "phim-vietsub": "Phim Vietsub",
      "phim-thuyet-minh": "Phim Thuyết Minh", "phim-long-tieng": "Phim Lồng Tiếng",
      "phim-bo-dang-chieu": "Phim Bộ Đang Chiếu", "phim-bo-hoan-thanh": "Phim Bộ Hoàn Thành",
      "phim-sap-chieu": "Phim Sắp Chiếu", subteam: "Subteam",
      "phim-moi-cap-nhat": "Phim Mới Cập Nhật", "phim-chieu-rap": "Phim Chiếu Rạp",
    };
    const PAGE_SIZE = LIST_PAGE_SIZE;


    const data = await fetchPaddedList("getByType", req.params.type, page, filters);

    const movies = data.items || [];
    const totalItems = data.pagination?.totalItems || 0;
    const typeName = typeNames[req.params.type] || data.titlePage || req.params.type;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);

    if (movies.length === 0 && page > 1) {
      const qp = new URLSearchParams();
      if (filters.year) qp.set("year", filters.year);
      if (filters.category) qp.set("category", filters.category);
      if (filters.country) qp.set("country", filters.country);
      if (filters.sort) qp.set("sort", filters.sort);
      const qs = qp.toString();
      return res.redirect(`/danh-sach/${req.params.type}${qs ? "?" + qs : ""}`);
    }

    const basePath = `/danh-sach/${req.params.type}`;
    const hasFilters = filters.year || filters.category || filters.country || filters.sort;
    const canonicalUrl = `${res.locals.siteUrl}${basePath}${page > 1 ? '?page=' + page : ''}`;

    res.render("pages/category", {
      title: `${typeName}${page > 1 ? ' - Trang ' + page : ''} - Xem phim online - movieCC`,
      metaDesc: `Danh sách ${typeName} mới nhất${page > 1 ? ' - Trang ' + page : ''}. Xem ${typeName} chất lượng cao, phụ đề tiếng Việt tại movieCC.`,
      categoryName: typeName, categorySlug: req.params.type,
      movies, totalPages, currentPage: page,
      filterType: "type", activeFilters: filters,
      canonicalUrl, noIndex: !!hasFilters,
      collectionJsonLd: buildCollectionSchema(typeName, basePath, movies, res.locals.siteUrl || ""),
      paginationPrev: page > 1 ? `${basePath}?page=${page - 1}` : null,
      paginationNext: page < totalPages ? `${basePath}?page=${page + 1}` : null,
      breadcrumbs: [{ name: "Trang chủ", url: "/" }, { name: typeName }],
    });

  } catch (err) {
    logger.error("movie", "Lỗi danh sách", err);
    res.redirect("/?msg=" + encodeURIComponent("Không thể tải danh sách phim. Vui lòng thử lại.") + "&msgtype=error");
  }
};

// ─── Image proxy & Embed redirect ───────────────────────────────────────────


exports.getEmbedRedirect = (req, res) => {
  try {
    const url = decryptStreamUrl(req.params.hash);
    if (!url) return res.redirect("/");
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return res.redirect("/");

    // Escape URL cho HTML attribute (encode với template literal thay vì string replace)
    const escapeHtmlAttr = (str) => String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "&#39;");

    const safeUrl = escapeHtmlAttr(url);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    // #region debug log
    fetch('http://127.0.0.1:7334/ingest/4879e3de-6ad8-49f4-951c-0d45dbf9f33e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'15fdfc'},body:JSON.stringify({sessionId:'15fdfc',location:'movieController.js:1125',message:'embed page served',data:{url:safeUrl,hasUrl:!!safeUrl},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:#000}#w{width:100%;height:100%;display:flex;align-items:center;justify-content:center}#w iframe{width:100%;height:100%;border:none;background:#000}</style></head><body><div id="w"><iframe id="f" src="${safeUrl}" allow="autoplay; encrypted-media; fullscreen"></iframe></div><script>
// #region debug log
var logCount=0;
fetch('http://127.0.0.1:7334/ingest/4879e3de-6ad8-49f4-951c-0d45dbf9f33e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'15fdfc'},body:JSON.stringify({sessionId:'15fdfc',location:'embed-page:fs-init',message:'fullscreen handler initialized',data:{url:'${safeUrl}'},timestamp:Date.now()})}).catch(()=>{});
// #endregion
var d=document.documentElement,w=document.getElementById('w'),f=document.getElementById('f');
function fs(){
    // #region debug log
    logCount++;
    fetch('http://127.0.0.1:7334/ingest/4879e3de-6ad8-49f4-951c-0d45dbf9f33e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'15fdfc'},body:JSON.stringify({sessionId:'15fdfc',location:'embed-page:fs-change',message:'fullscreenchange event',data:{fullscreenElement:document.fullscreenElement?document.fullscreenElement.tagName:'null',callCount:logCount},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if(document.fullscreenElement===f){
        var r=d.requestFullscreen||d.webkitRequestFullscreen||d.mozRequestFullScreen||d.msRequestFullscreen;
        if(r){r.call(d);fetch('http://127.0.0.1:7334/ingest/4879e3de-6ad8-49f4-951c-0d45dbf9f33e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'15fdfc'},body:JSON.stringify({sessionId:'15fdfc',location:'embed-page:fs-requested',message:'requested fullscreen on wrapper',data:{success:true},timestamp:Date.now()})}).catch(()=>{})}
    }
}
f.addEventListener('fullscreenchange',fs);f.addEventListener('webkitfullscreenchange',fs);f.addEventListener('mozfullscreenchange',fs);f.addEventListener('MSFullscreenChange',fs);</script></body></html>`);
  } catch { res.redirect("/"); }
};
// ─── Lazy-load related movies API ────────────────────────────────────────────

exports.getRelated = async (req, res) => {
  try {
    const slug = req.params.slug;
    const cacheKey = `detail:merged:${slug}`;
    // Thử lấy từ cache trước; nếu cache lạnh (server restart) thì fetch mới
    let movie = cache.detail.get(cacheKey);
    if (!movie) {
      movie = await sourceManager.getDetailMerged(slug);
      if (!movie) return res.json({ relatedParts: [], relatedMovies: [] });
    }

    const [relatedParts, relatedMovies] = await Promise.all([
      findRelatedParts(movie).catch(() => []),
      getSmartRelated(movie).catch(() => []),
    ]);

    res.json({ relatedParts, relatedMovies });
  } catch (err) {
    res.json({ relatedParts: [], relatedMovies: [] });
  }
};

// Export merge helpers for backward compat (searchController imports these)
exports.mergeMovieLists = MovieSourceManager.mergeMovieLists;
exports.fetchBoth = async (p1, p2) => {
  const [r1, r2] = await Promise.allSettled([p1, p2]);
  return [r1.status === "fulfilled" ? r1.value : null, r2.status === "fulfilled" ? r2.value : null];
};
// Export for api.js (React app)
exports.findRelatedParts = findRelatedParts;
exports.getSmartRelated = getSmartRelated;
