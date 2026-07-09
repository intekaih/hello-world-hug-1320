const express = require("express");
const router = express.Router();
const { useNewHistoryModule, useNewFavoritesModule,
        useNewNotificationsModule, useNewMoviesModule } = require("../core/config/features");
const searchController = require("../controllers/searchController");
const feedbackController = require("../controllers/feedbackController");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { suggestLimiter, hlsProxyLimiter, hlsSegmentLimiter } = require("../middleware/rateLimit");
const { doubleCsrfProtection } = require("../middleware/csrf");
const { sourceManager } = require("../config/providers");

let movieCtrl, historyCtrl, favoritesCtrl, notifCtrl;

if (useNewMoviesModule) {
  const MovieController = require("../modules/movies/MovieController");
  movieCtrl = new MovieController();
} else {
  movieCtrl = require("../controllers/movieController");
}

try {
  const { historyController: hc, favoritesController: fc, notificationController: nc } = require("../core/di/container");
  historyCtrl = hc;
  favoritesCtrl = fc;
  notifCtrl = nc;
} catch {
  historyCtrl = require("../controllers/historyController");
  favoritesCtrl = require("../controllers/favoritesController");
  notifCtrl = require("../controllers/notificationController");
}

const SLUG_RE = /^[a-z0-9-]+$/;
const VALID_TYPES = [
  "phim-bo",
  "phim-le",
  "hoat-hinh",
  "tv-shows",
  "phim-vietsub",
  "phim-thuyet-minh",
  "phim-long-tieng",
  "phim-bo-dang-chieu",
  "phim-bo-hoan-thanh",
  "phim-sap-chieu",
  "subteam",
  "phim-moi-cap-nhat",
  "phim-chieu-rap",
];
const VALID_SORTS = [
  "",
  "modified.time",
  "year",
  "_id",
  "newest",
  "oldest",
  "name-az",
  "name-za",
];

function validateSlug(req, res, next) {
  const slug = req.params.slug;
  if (!slug || slug.length > 200 || !SLUG_RE.test(slug)) {
    return res
      .status(404)
      .render("pages/404", { title: "Không tìm thấy - movieCC" });
  }
  next();
}

function validateEpisodeSlug(req, res, next) {
  const episode = req.params.episode;
  if (!episode || episode.length > 200) {
    return res
      .status(404)
      .render("pages/404", { title: "Không tìm thấy - movieCC" });
  }
  // Normalize to lowercase — APIs trả "FULL", "OVA", "SP" đều hợp lệ
  req.params.episode = episode.toLowerCase();
  if (!SLUG_RE.test(req.params.episode)) {
    return res
      .status(404)
      .render("pages/404", { title: "Không tìm thấy - movieCC" });
  }
  next();
}

function validateType(req, res, next) {
  if (!VALID_TYPES.includes(req.params.type)) {
    return res
      .status(404)
      .render("pages/404", { title: "Không tìm thấy - movieCC" });
  }
  next();
}

function validateId(req, res, next) {
  const id = req.params.id;
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(400).json({ success: false, message: "ID không hợp lệ" });
  }
  next();
}

function sanitizeQuery(req, res, next) {
  if (req.query.page) {
    req.query.page = Math.max(1, parseInt(req.query.page) || 1);
  }
  if (req.query.year) {
    const y = parseInt(req.query.year);
    const maxYear = new Date().getFullYear() + 2;
    req.query.year = y >= 1900 && y <= maxYear ? String(y) : undefined;
  }
  if (req.query.sort && !VALID_SORTS.includes(req.query.sort)) {
    req.query.sort = undefined;
  }
  next();
}

// ====== ACTOR PAGES ======
const nodeFetch = (() => { try { return require("node-fetch"); } catch { return null; } })();

async function tmdbFetchActor(url) {
  if (!nodeFetch) return null;
  const r = await nodeFetch(url, { timeout: 6000 });
  if (!r.ok) return null;
  return r.json();
}

router.get("/dien-vien", optionalAuth, async (req, res) => {
  const query = (req.query.q || "").trim().substring(0, 100);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const apiKey = process.env.TMDB_API_KEY;
  let popularActors = [];
  let searchResults = [];
  let totalPages = 1;
  let totalResults = 0;

  try {
    if (query && apiKey) {
      const data = await tmdbFetchActor(
        `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=vi&page=${page}`
      );
      searchResults = (data?.results || []).map(p => ({
        id: p.id,
        name: p.name,
        profileUrl: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
        knownFor: (p.known_for || []).map(m => m.title || m.name).filter(Boolean).slice(0, 3),
      }));
      totalPages = Math.min(data?.total_pages || 1, 500);
      totalResults = data?.total_results || 0;
    } else if (apiKey) {
      const data = await tmdbFetchActor(
        `https://api.themoviedb.org/3/person/popular?api_key=${apiKey}&language=vi&page=${page}`
      );
      popularActors = (data?.results || []).map(p => ({
        id: p.id,
        name: p.name,
        profileUrl: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
        knownFor: (p.known_for || []).map(m => m.title || m.name).filter(Boolean).slice(0, 3),
      }));
      totalPages = Math.min(data?.total_pages || 1, 500);
      totalResults = data?.total_results || 0;
    }
  } catch (e) { /* ignore TMDB errors */ }

  res.render("pages/actor-search", {
    title: query ? `Tìm diễn viên "${query}" | movieCC` : `Diễn viên nổi tiếng${page > 1 ? ` - Trang ${page}` : ""} | movieCC`,
    metaDesc: "Tìm phim theo tên diễn viên yêu thích trên movieCC.",
    currentPath: "/dien-vien",
    query,
    popularActors,
    searchResults,
    currentPage: page,
    totalPages,
    totalResults,
    breadcrumbs: [{ name: "Trang chủ", url: "/" }, { name: "Diễn viên" }],
  });
});

router.get("/dien-vien/:name", optionalAuth, async (req, res) => {
  const actorDisplayName = decodeURIComponent(req.params.name || "").trim().substring(0, 150);
  if (!actorDisplayName) return res.redirect("/dien-vien");

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const PER_PAGE = 24;
  const apiKey = process.env.TMDB_API_KEY;
  let tmdbPerson = null;
  let providerMovies = [];   // phim có trong database provider (có link xem)
  let tmdbMovies = [];       // filmography từ TMDB (poster TMDB, link tìm kiếm)
  let totalPages = 1;

  // 1. Tìm person + credits từ TMDB song song với provider search
  const [tmdbResult, providerResult] = await Promise.allSettled([
    (async () => {
      if (!apiKey) return null;
      const searchData = await tmdbFetchActor(
        `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(actorDisplayName)}&language=vi&page=1`
      );
      const person = (searchData?.results || [])[0];
      if (!person) return null;
      const [credData, detailData] = await Promise.all([
        tmdbFetchActor(`https://api.themoviedb.org/3/person/${person.id}/combined_credits?api_key=${apiKey}&language=vi`),
        tmdbFetchActor(`https://api.themoviedb.org/3/person/${person.id}?api_key=${apiKey}&language=vi`),
      ]);
      return { person, credits: credData, detail: detailData };
    })(),
    sourceManager.searchAll(actorDisplayName, page).catch(() => ({ items: [], pagination: {} })),
  ]);

  // 2. Xử lý TMDB result
  if (tmdbResult.status === "fulfilled" && tmdbResult.value) {
    const { person, credits, detail } = tmdbResult.value;
    tmdbPerson = {
      id: person.id,
      name: person.name,
      profileUrl: person.profile_path ? `https://image.tmdb.org/t/p/w300${person.profile_path}` : null,
      knownFor: (person.known_for || []).map(m => m.title || m.name).filter(Boolean).slice(0, 4),
      biography: detail?.biography || null,
      birthday: detail?.birthday || null,
      gender: detail?.gender || null,
      placeOfBirth: detail?.place_of_birth || null,
      alsoKnownAs: (detail?.also_known_as || []).filter(n => n !== person.name).slice(0, 3),
    };
    if (credits) {
      const all = (credits.cast || [])
        .filter(m => m.poster_path && (m.title || m.name))
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      totalPages = Math.max(totalPages, Math.ceil(all.length / PER_PAGE));
      const start = (page - 1) * PER_PAGE;
      tmdbMovies = all.slice(start, start + PER_PAGE).map(m => ({
        title: m.title || m.name,
        originalTitle: m.original_title || m.original_name || "",
        posterUrl: `https://image.tmdb.org/t/p/w300${m.poster_path}`,
        year: (m.release_date || m.first_air_date || "").substring(0, 4),
        rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : 0,
        character: m.character || "",
        mediaType: m.media_type || (m.title ? "movie" : "tv"),
        searchUrl: `/tim-kiem?q=${encodeURIComponent(m.title || m.name)}`,
      }));
    }
  }

  // 3. Xử lý provider result
  if (providerResult.status === "fulfilled") {
    const data = providerResult.value;
    providerMovies = data.items || [];
    const pag = data.pagination || {};
    if (pag.totalPages) totalPages = Math.max(totalPages, pag.totalPages);
  }

  const totalMovies = tmdbMovies.length + providerMovies.length;

  res.render("pages/actor-movies", {
    title: `Phim của ${actorDisplayName} | movieCC`,
    metaDesc: `Xem tất cả phim có sự tham gia của diễn viên ${actorDisplayName} trên movieCC.`,
    currentPath: `/dien-vien/${encodeURIComponent(actorDisplayName)}`,
    actorDisplayName,
    tmdbPerson,
    providerMovies,
    tmdbMovies,
    totalMovies,
    totalPages,
    currentPage: page,
    breadcrumbs: [
      { name: "Trang chủ", url: "/" },
      { name: "Diễn viên", url: "/dien-vien" },
      { name: actorDisplayName },
    ],
  });
});

// ====== STATIC PAGES (no controller needed) ======
router.get("/gioi-thieu", (req, res) => {
  res.render("pages/about", {
    title: "Giới thiệu | movieCC",
    metaDesc: "movieCC - Nền tảng xem phim trực tuyến chất lượng cao hàng đầu Việt Nam. Kho phim đa dạng: phim bộ, phim lẻ, anime với phụ đề tiếng Việt.",
    breadcrumbs: [{ name: "Trang chủ", url: "/" }, { name: "Giới thiệu" }],
  });
});

router.get("/chinh-sach-bao-mat", (req, res) => {
  res.render("pages/privacy", {
    title: "Chính sách bảo mật | movieCC",
    metaDesc: "Chính sách bảo mật của movieCC. Cam kết bảo vệ quyền riêng tư của bạn khi sử dụng dịch vụ xem phim trực tuyến.",
    breadcrumbs: [{ name: "Trang chủ", url: "/" }, { name: "Chính sách bảo mật" }],
  });
});

// ====== PUBLIC PAGES (Guest có thể xem, SEO crawlable) ======
router.get("/", optionalAuth, movieCtrl.getHome);
router.get(
  "/phim/:slug",
  validateSlug,
  optionalAuth,
  movieCtrl.getMovieDetail,
);
router.get(
  "/tim-kiem",
  sanitizeQuery,
  optionalAuth,
  searchController.getSearch,
);
router.get(
  "/the-loai/:slug",
  validateSlug,
  sanitizeQuery,
  optionalAuth,
  movieCtrl.getByCategory,
);
router.get(
  "/quoc-gia/:slug",
  validateSlug,
  sanitizeQuery,
  optionalAuth,
  movieCtrl.getByCountry,
);
router.get(
  "/danh-sach/:type",
  validateType,
  sanitizeQuery,
  optionalAuth,
  movieCtrl.getByType,
);

// ====== PROTECTED PAGES (Cần đăng nhập) ======
router.get(
  "/xem/:slug/:episode",
  validateSlug,
  validateEpisodeSlug,
  requireAuth,
  movieCtrl.getWatch,
);

// History Pages & API
router.get("/lich-su", requireAuth, historyCtrl.getHistoryPage);
router.post(
  "/api/watch/progress",
  requireAuth,
  doubleCsrfProtection,
  historyCtrl.saveWatchProgress,
);
router.get(
  "/api/watch/progress/:slug/:episode",
  validateSlug,
  requireAuth,
  historyCtrl.getWatchProgress,
);
router.get(
  "/api/watch/latest/:slug",
  validateSlug,
  requireAuth,
  historyCtrl.getLatestProgress,
);
router.delete(
  "/api/watch/history/:id",
  validateId,
  requireAuth,
  doubleCsrfProtection,
  historyCtrl.deleteWatchHistoryItem,
);
router.delete(
  "/api/watch/history",
  requireAuth,
  doubleCsrfProtection,
  historyCtrl.clearWatchHistory,
);

// Favorites Pages & API
router.get("/yeu-thich", requireAuth, favoritesCtrl.getFavoritesPage);
router.post(
  "/api/favorites/toggle",
  requireAuth,
  doubleCsrfProtection,
  favoritesCtrl.toggleFavorite,
);
router.get(
  "/api/favorites/check/:slug",
  validateSlug,
  requireAuth,
  favoritesCtrl.checkFavorite,
);
router.get("/api/favorites", requireAuth, favoritesCtrl.getFavorites);

// Notification API
router.get(
  "/api/notifications",
  requireAuth,
  notifCtrl.getNotifications,
);
router.get(
  "/api/notifications/count",
  requireAuth,
  notifCtrl.getUnreadCount,
);
router.post(
  "/api/notifications/check",
  requireAuth,
  doubleCsrfProtection,
  notifCtrl.checkNewEpisodes,
);
router.post(
  "/api/notifications/read",
  requireAuth,
  doubleCsrfProtection,
  notifCtrl.markAllRead,
);
router.post(
  "/api/notifications/read/:id",
  validateId,
  requireAuth,
  doubleCsrfProtection,
  notifCtrl.markRead,
);

// Other APIs
router.get(
  "/api/related/:slug",
  validateSlug,
  optionalAuth,
  movieCtrl.getRelated,
);
router.get(
  "/api/suggest",
  suggestLimiter,
  optionalAuth,
  searchController.getSuggest,
);
// Import HLS rate limiters
router.get("/api/stream/:hash", requireAuth, movieCtrl.getStream);
// HLS proxy rate limited - chống abuse streaming proxy
// SEC: requireAuth để ngăn guest truy cập nội dung VIP qua proxy
router.get("/api/hls/:hash", hlsProxyLimiter, requireAuth, movieCtrl.proxyM3u8);
// HLS segments nhẹ hơn nhưng vẫn rate limit
router.get("/api/hls-seg/:hash", hlsSegmentLimiter, requireAuth, movieCtrl.proxySegment);
router.get("/api/embed/:hash", requireAuth, movieCtrl.getEmbedRedirect);

// ====== FEEDBACK ======
router.get("/gop-y", optionalAuth, feedbackController.getFeedbackPage);
router.post("/api/feedback", optionalAuth, doubleCsrfProtection, feedbackController.submitFeedback);

module.exports = router;
