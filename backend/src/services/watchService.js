/**
 * Watch Service - Watch page data transformation and episode processing
 *
 * Extracted from movieController.js for better maintainability.
 * Handles server/episode building, stream URL encryption, and watch page data prep.
 */

const { sourceManager } = require("../config/providers");
const { cache } = require("../core/cache");
const { encryptStreamUrl } = require("../utils/encryption");
const {
  extractSeriesBaseName,
  extractSeriesBaseNames,
  extractPartNumber,
  extractBaseName,
} = require("../utils/slugUtils");

const relatedCache = cache.related;
const partsCache = cache.parts;
const detailCache = cache.detail;

/**
 * Server priority constants
 */
const PROVIDER_ORDER = { ophim: 0, kkphim: 1, nguonc: 2 };
const LANG_ORDER = (name) => {
  const lang = name.replace(/\s*-\s*Server\s*\d+.*$/i, "").trim().toLowerCase();
  if (lang.includes("vietsub")) return 0;
  if (lang.includes("lồng") || lang.includes("long")) return 1;
  return 2;
};

/**
 * Fetches movie for watch page with caching
 */
async function getMovieForWatch(slug) {
  const cacheKey = `detail:merged:${slug}`;
  let movie = detailCache.get(cacheKey);

  if (!movie) {
    movie = await sourceManager.getDetailMerged(slug);
    if (movie) detailCache.set(cacheKey, movie);
  }

  return movie;
}

/**
 * Processes servers and episodes from merged format
 * @param {object} movie - Movie object with episodes
 * @param {string} currentEpSlug - Current episode slug
 * @param {string} preferredServerName - Preferred server from cookie
 * @returns {object} { servers, episodes, currentEp, activeServerIdx }
 */
function processMergedFormat(movie, currentEpSlug, preferredServerName) {
  const serverMap = new Map();

  for (const ep of movie.episodes) {
    for (const svr of ep.servers || []) {
      const hasM3u8 = !!svr.link_m3u8;
      const hasEmbed = !!svr.link_embed;
      if (!hasM3u8 && !hasEmbed) continue;

      if (!serverMap.has(svr.serverName)) {
        serverMap.set(svr.serverName, { _providerName: svr._providerName, episodes: [] });
      }
      serverMap.get(svr.serverName).episodes.push({
        name: ep.name,
        slug: ep.slug,
        link_m3u8: svr.link_m3u8 || "",
        link_embed: svr.link_embed || "",
        link_embed_fallback: (svr.link_m3u8 && svr.link_embed) ? svr.link_embed : "",
      });
    }
  }

  // Sort servers by provider order, then by language
  const sorted = Array.from(serverMap.entries()).sort((a, b) => {
    const oa = PROVIDER_ORDER[a[1]._providerName] ?? 99;
    const ob = PROVIDER_ORDER[b[1]._providerName] ?? 99;
    if (oa !== ob) return oa - ob;
    return LANG_ORDER(a[0]) - LANG_ORDER(b[0]);
  });

  // Assign sequential server numbers
  const servers = sorted.map(([origName, data], index) => {
    const langPrefix = origName.replace(/\s*-\s*Server\s*\d+.*$/i, "").trim() || "Server";
    const newName = `${langPrefix} - Server ${index + 1}`;
    return {
      name: newName,
      is_ai: false,
      _providerName: data._providerName,
      isNguonc: data._providerName === "nguonc",
      episodes: data.episodes,
    };
  });

  // Build episode list (unique by slug)
  const epMap2 = new Map();
  for (const ep of movie.episodes) {
    if (!epMap2.has(ep.slug)) epMap2.set(ep.slug, ep);
  }
  const episodes = Array.from(epMap2.values());

  // Find current episode
  let currentEp = null;
  let activeServerIdx = 0;
  let fallbackEp = null;
  let fallbackIdx = 0;

  // Try preferred server first
  if (preferredServerName) {
    for (let i = 0; i < servers.length; i++) {
      if (servers[i].name === preferredServerName) {
        const found = servers[i].episodes.find((e) => e.slug === currentEpSlug);
        if (found && (found.link_m3u8 || found.link_embed)) {
          currentEp = found;
          activeServerIdx = i;
          break;
        }
      }
    }
  }

  // If not found, try any server with the episode
  if (!currentEp) {
    for (let i = 0; i < servers.length; i++) {
      const found = servers[i].episodes.find((e) => e.slug === currentEpSlug);
      if (found) {
        if (!fallbackEp) { fallbackEp = found; fallbackIdx = i; }
        if (found.link_m3u8 && !currentEp) { currentEp = found; activeServerIdx = i; }
      }
    }
    if (!currentEp && fallbackEp) { currentEp = fallbackEp; activeServerIdx = fallbackIdx; }
  }

  return { servers, episodes, currentEp, activeServerIdx };
}

/**
 * Processes servers and episodes from legacy format
 * @param {object} movie - Movie object with episodes
 * @param {string} currentEpSlug - Current episode slug
 * @param {string} preferredServerName - Preferred server from cookie
 * @returns {object} { servers, episodes, currentEp, activeServerIdx }
 */
function processLegacyFormat(movie, currentEpSlug, preferredServerName) {
  const servers = (movie.episodes || []).map((server) => {
    return {
      name: server.server_name,
      is_ai: server.is_ai || false,
      episodes: (server.server_data || [])
        .filter((ep) => ep.link_embed || ep.link_m3u8)
        .map((ep) => ({
          name: ep.name,
          slug: (ep.slug || ep.name || "").toLowerCase(),
          link_m3u8: ep.link_m3u8 || "",
          link_embed: ep.link_embed || "",
        })),
    };
  }).filter((s) => s.episodes.length > 0);

  let currentEp = null;
  let activeServerIdx = 0;
  let fallbackEp = null;
  let fallbackIdx = 0;

  // Try preferred server first
  if (preferredServerName) {
    for (let i = 0; i < servers.length; i++) {
      if (servers[i].name === preferredServerName) {
        const found = servers[i]?.episodes?.find(
          (ep) => ep.slug === currentEpSlug || ep.slug.toLowerCase() === currentEpSlug
        );
        if (found && (found.link_m3u8 || found.link_embed)) {
          currentEp = found;
          activeServerIdx = i;
          break;
        }
      }
    }
  }

  // If not found, try any server with the episode
  if (!currentEp) {
    for (let i = 0; i < servers.length; i++) {
      const found = servers[i]?.episodes?.find(
        (ep) => ep.slug === currentEpSlug || ep.slug.toLowerCase() === currentEpSlug
      );
      if (found) {
        if (!fallbackEp) { fallbackEp = found; fallbackIdx = i; }
        if (found.link_m3u8 && !currentEp) { currentEp = found; activeServerIdx = i; }
      }
    }
    if (!currentEp && fallbackEp) { currentEp = fallbackEp; activeServerIdx = fallbackIdx; }
  }

  // Build episode list (unique by slug)
  const epMap = new Map();
  servers.forEach((server) => {
    (server.episodes || []).forEach((ep) => {
      if (!epMap.has(ep.slug)) epMap.set(ep.slug, ep);
    });
  });
  const episodes = Array.from(epMap.values()).sort((a, b) => {
    const na = parseInt(a.slug.replace(/\D/g, "")) || Infinity;
    const nb = parseInt(b.slug.replace(/\D/g, "")) || Infinity;
    return na - nb;
  });

  return { servers, episodes, currentEp, activeServerIdx };
}

/**
 * Encrypts stream URLs for the current episode
 * @param {object} currentEp - Current episode
 * @returns {object} { streamHash, embedUrl, embedFallbackUrl }
 */
function encryptEpisodeUrls(currentEp) {
  let streamHash = "";
  let embedUrl = "";
  let embedFallbackUrl = "";

  if (currentEp?.link_m3u8) {
    streamHash = currentEp.link_m3u8.startsWith('/api/')
      ? currentEp.link_m3u8
      : encryptStreamUrl(currentEp.link_m3u8);
  }

  if (currentEp?.link_embed) {
    embedUrl = `/api/embed/${encryptStreamUrl(currentEp.link_embed)}`;
  }

  if (currentEp?.link_embed_fallback) {
    embedFallbackUrl = `/api/embed/${encryptStreamUrl(currentEp.link_embed_fallback)}`;
  }

  return { streamHash, embedUrl, embedFallbackUrl };
}

/**
 * Builds encrypted stream/embed URLs for all servers (for client-side switching)
 * @param {Array} servers - Array of servers
 * @param {string} currentEpSlug - Current episode slug
 * @returns {object} { serverEmbeds, serverStreams, serverEmbedFallbacks }
 */
function buildServerEmbeds(servers, currentEpSlug) {
  const serverEmbeds = {};
  const serverStreams = {};
  const serverEmbedFallbacks = {};

  servers.forEach((server, idx) => {
    const ep = server.episodes.find((e) => e.slug === currentEpSlug);
    if (ep) {
      if (ep.link_m3u8) {
        serverStreams[idx] = ep.link_m3u8.startsWith('/api/')
          ? ep.link_m3u8
          : encryptStreamUrl(ep.link_m3u8);
      }
      if (ep.link_embed) {
        serverEmbeds[idx] = `/api/embed/${encryptStreamUrl(ep.link_embed)}`;
      }
      if (ep.link_embed_fallback) {
        serverEmbedFallbacks[idx] = `/api/embed/${encryptStreamUrl(ep.link_embed_fallback)}`;
      }
    }
  });

  return { serverEmbeds, serverStreams, serverEmbedFallbacks };
}

/**
 * Builds watch page breadcrumbs
 * @param {object} movie - Movie object
 * @param {string} slug - Movie slug
 * @param {string} currentEpSlug - Current episode slug
 * @returns {Array} Breadcrumb items
 */
function buildWatchBreadcrumbs(movie, slug, currentEpSlug) {
  const crumbs = [{ name: "Trang chủ", url: "/" }];

  if (movie.type === "series") crumbs.push({ name: "Phim Bộ", url: "/danh-sach/phim-bo" });
  else if (movie.type === "hoathinh") crumbs.push({ name: "Anime", url: "/danh-sach/hoat-hinh" });
  else crumbs.push({ name: "Phim Lẻ", url: "/danh-sach/phim-le" });

  crumbs.push({ name: movie.name, url: `/phim/${slug}` });
  crumbs.push({ name: currentEpSlug });
  return crumbs;
}

/**
 * Formats episode name for display
 * @param {string} epSlug - Episode slug
 * @returns {string} Formatted episode name
 */
function formatEpisodeDisplayName(epSlug) {
  if (!epSlug) return "";
  const s = epSlug.toLowerCase();
  if (s === "full") return "Full";
  if (!isNaN(Number(epSlug))) return `Tập ${epSlug}`;
  return epSlug;
}

module.exports = {
  PROVIDER_ORDER,
  LANG_ORDER,
  getMovieForWatch,
  processMergedFormat,
  processLegacyFormat,
  encryptEpisodeUrls,
  buildServerEmbeds,
  buildWatchBreadcrumbs,
  formatEpisodeDisplayName,
};
