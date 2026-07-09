/**
 * JSON API Routes — Dành cho React app (MovieCC UI_UX Design / Capacitor)
 *
 * Prefixed với /api/react/
 * Dùng chung database, session, và providers với EJS routes.
 */

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/apiAuth");
const { suggestLimiter, reactLoginLimiter } = require("../middleware/rateLimit");
const { sourceManager } = require("../config/providers");
const database = require("../database");
const logger = require("../utils/logger");
const recommendationService = require("../services/recommendationService");
const { enrichMoviesWithLogos } = require("../services/tmdbLogoService");
const { useNewFavoritesModule, useNewHistoryModule,
        useNewNotificationsModule, useNewFeedbackModule } = require("../core/config/features");

// ─── DI Container instances ───────────────────────────────────────────────────
let favoritesService, historyService, notificationService, feedbackService;
try {
  const { favoritesService: fs, historyService: hs, notificationService: ns, feedbackService: fb } = require("../core/di/container");
  favoritesService = fs;
  historyService = hs;
  notificationService = ns;
  feedbackService = fb;
} catch {
  // container not ready yet — fallback to database calls
}

// ─── Lovable CSRF middleware ──────────────────────────────────────────────────
// Mount Lovable-compatible CSRF middleware cho toàn bộ /api/react/*
// Bypass csrf-csrf nếu request đến từ Lovable origin + có cookie `csrf_token`
// match header `X-CSRF-Token` (double-submit cookie pattern).
// Ngược lại fallback về doubleCsrfProtection (EJS / non-Lovable clients).
const { lovableCsrfProtection } = require("../middleware/lovableCsrf");
router.use(lovableCsrfProtection);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeStr(val) {
  if (typeof val !== "string") return "";
  return val.replace(/[<>"'&]/g, "").trim().substring(0, 500);
}

function sanitizeUrl(val) {
  if (typeof val !== "string") return "";
  val = val.trim();
  if (val && !val.startsWith("/") && !val.startsWith("http://") && !val.startsWith("https://")) return "";
  return val.replace(/["'<>]/g, "").substring(0, 1000);
}

// ─── IMAGE PROXY ──────────────────────────────────────────────────────────────
// Proxy request từ /api/image/{hash:data} để che nguồn gốc ảnh poster/thumb
// Base64 decode: hash = base64(data) = "providerKey:encryptedUrl"
// wsrv.nl là CDN trung gian giúp bypass CORS và cache ảnh

// F6: Domain allowlist — chống open-redirect / SSRF qua image proxy
const ALLOWED_IMAGE_HOSTS = new Set([
  "phimimg.com",
  "img.ophim.live",
  "img.ophim1.com",
  "img.nguonc.com",
  "img.kkphim.vip",
  "img.kkphim.com",
  "static.nguonc.com",
  "image.tmdb.org",
]);

function isAllowedImageHost(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (ALLOWED_IMAGE_HOSTS.has(host)) return true;
    // Cho phép subdomain của các domain trong allowlist
    for (const h of ALLOWED_IMAGE_HOSTS) {
      if (host.endsWith("." + h)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

router.get("/image/:encoded", async (req, res) => {
  const encoded = req.params.encoded;
  if (!encoded) return res.redirect("/images/no-poster.svg");

  try {
    // Format: base64(providerKey:originalUrl)
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx === -1) return res.redirect("/images/no-poster.svg");

    const originalUrl = decoded.slice(colonIdx + 1);

    if (!originalUrl || !originalUrl.startsWith("http")) {
      return res.redirect("/images/no-poster.svg");
    }

    // F6 FIX (architect HIGH #7): chỉ cho phép domain trong allowlist
    if (!isAllowedImageHost(originalUrl)) {
      return res.redirect("/images/no-poster.svg");
    }

    // F6: wsrv.nl proxy với output=webp + cache 7d cho byte-saving 25-35%
    // Browser nào không hỗ trợ WebP sẽ tự fallback nhờ Accept header
    const acceptsWebp = (req.headers.accept || "").includes("image/webp");
    const fmt = acceptsWebp ? "&output=webp" : "";
    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(originalUrl)}&w=300&n=-5${fmt}&maxage=7d`;

    res.set("Cache-Control", "public, max-age=604800, immutable");
    res.redirect(proxyUrl);
  } catch {
    res.redirect("/images/no-poster.svg");
  }
});

// ─── HOME ────────────────────────────────────────────────────────────────────

router.get("/movies/home", async (req, res) => {
  try {
    const [newP1, newP2, series, hoathinh] = await Promise.all([
      sourceManager.fetchAllNewMovies(1).catch(() => ({ items: [] })),
      sourceManager.fetchAllNewMovies(2).catch(() => ({ items: [] })),
      sourceManager.getByType("phim-bo", 1, { limit: 18 }).catch(() => ({ items: [] })),
      sourceManager.getByType("hoat-hinh", 1, { limit: 18 }).catch(() => ({ items: [] })),
    ]);

    const allNew = [...(newP1.items || []), ...(newP2.items || [])];

    const epSlugFromCurrent = (ep) => {
      if (!ep) return null;
      const s = ep.toLowerCase().trim();
      if (s === "full" || s === "complete") return "full";
      const m = s.match(/(\d+)/);
      return m ? m[1] : null;
    };
    const withEpSlug = (m) => ({ ...m, epSlug: epSlugFromCurrent(m.episode_current) });

    const rawHero = allNew.slice(0, 10).map(withEpSlug);
    const heroMovies = await enrichMoviesWithLogos(rawHero).catch(() => rawHero);

    res.json({
      heroMovies,
      top10Movies: allNew.slice(0, 10).map(withEpSlug),
      hotSeriesMovies: (series.items || []).slice(0, 8),
      animeMovies: (hoathinh.items || []).map(withEpSlug),
      newMovies: allNew.slice(0, 26).map(withEpSlug),
    });
  } catch (err) {
    logger.error("api/react", "Lỗi getHome", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── MOVIES ─────────────────────────────────────────────────────────────────

// QUAN TRỌNG: route tĩnh phải khai báo TRƯỚC route động /:slug
// Tìm slug local theo TMDB id + title (dùng cho Schedule page)
router.get("/movies/resolve", async (req, res) => {
  try {
    const { title, tmdbId } = req.query;
    if (!title) return res.status(400).json({ error: "title required" });

    const data = await sourceManager.searchAll(title, 1, 10);
    const items = data.items || [];

    // Ưu tiên kết quả có tmdb.id khớp
    let match = tmdbId
      ? items.find(m => String(m.tmdb?.id) === String(tmdbId))
      : null;

    // Fallback: kết quả đầu tiên có title gần giống
    if (!match && items.length > 0) {
      const titleLower = title.toLowerCase();
      match = items.find(m =>
        m.name?.toLowerCase().includes(titleLower) ||
        m.origin_name?.toLowerCase().includes(titleLower)
      ) || items[0];
    }

    if (!match) return res.status(404).json({ error: "not found" });
    res.json({ slug: match.slug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/movies/:slug", async (req, res) => {
  try {
    const movie = await sourceManager.getDetailMerged(req.params.slug);
    if (!movie) return res.status(404).json({ error: "Không tìm thấy phim" });
    res.json(movie);
  } catch (err) {
    logger.error("api/react", `Lỗi getMovie ${req.params.slug}`, err);
    res.status(500).json({ error: err.message });
  }
});

// Episode-specific endpoint — trả servers đúng cho tập đang xem
router.get("/movies/:slug/episode/:episode", async (req, res) => {
  try {
    const { slug, episode } = req.params;
    const movie = await sourceManager.getDetailMerged(slug);
    if (!movie) return res.status(404).json({ error: "Không tìm thấy phim" });

    // episode param format: "tap-1", "tap-2", "full" → extract number
    const epNum = parseInt(episode?.replace("tap-", "") || "1") || 1;

    // Episode slug trong movie data là "1", "2", "3"... chứ không phải "tap-1"
    const epData = movie.episodes?.find(
      e => e.slug === String(epNum) || e.slug === episode
    ) ?? movie.episodes?.[0];

    if (!epData) {
      return res.status(404).json({ error: "Không tìm thấy tập phim" });
    }

    res.json({
      name: epData.name,
      slug: epData.slug,
      servers: (epData.servers || []).map((s) => {
        // NguonC: dùng embed (m3u8 thường chết)
        if (s._providerName === "nguonc") {
          return {
            serverName: s.serverName,
            link_m3u8: "",
            link_embed: s.link_embed || "",
          };
        }
        return s;
      }),
    });
  } catch (err) {
    logger.error("api/react", `Lỗi getEpisode ${req.params.slug}/${req.params.episode}`, err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/movies/:slug/related", async (req, res) => {
  const TIMEOUT = 10000;
  try {
    const movieData = await Promise.race([
      sourceManager.getDetailMerged(req.params.slug),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT)),
    ]);
    if (!movieData) return res.json({ relatedParts: [], relatedMovies: [] });

    const movieCtrl = require("../controllers/movieController");
    const related = await Promise.race([
      Promise.all([
        (movieCtrl.findRelatedParts ? movieCtrl.findRelatedParts(movieData) : Promise.resolve([])).catch(() => []),
        (movieCtrl.getSmartRelated ? movieCtrl.getSmartRelated(movieData) : Promise.resolve([])).catch(() => []),
      ]),
      new Promise((resolve) => setTimeout(() => resolve([[], []]), TIMEOUT)),
    ]);
    const [relatedParts, relatedMovies] = related;
    res.json({ relatedParts, relatedMovies });
  } catch (err) {
    res.json({ relatedParts: [], relatedMovies: [] });
  }
});

router.get("/category/:slug", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filters = {
      year: req.query.year,
      country: req.query.country,
      sort: req.query.sort,
      category: req.query.category,
    };
    const data = await sourceManager.getByCategory(req.params.slug, page, filters);
    res.json({
      items: data.items || [],
      pagination: data.pagination || { totalItems: 0, totalPages: 0, currentPage: page },
      titlePage: data.titlePage || "",
    });
  } catch (err) {
    logger.error("api/react", `Lỗi getByCategory ${req.params.slug}`, err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/country/:slug", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filters = {
      year: req.query.year,
      category: req.query.category,
      sort: req.query.sort,
    };
    const data = await sourceManager.getByCountry(req.params.slug, page, filters);
    res.json({
      items: data.items || [],
      pagination: data.pagination || { totalItems: 0, totalPages: 0, currentPage: page },
      titlePage: data.titlePage || "",
    });
  } catch (err) {
    logger.error("api/react", `Lỗi getByCountry ${req.params.slug}`, err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/type/:type", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filters = {
      year: req.query.year,
      category: req.query.category,
      country: req.query.country,
      sort: req.query.sort,
    };
    const data = await sourceManager.getByType(req.params.type, page, filters);
    res.json({
      items: data.items || [],
      pagination: data.pagination || { totalItems: 0, totalPages: 0, currentPage: page },
      titlePage: data.titlePage || "",
    });
  } catch (err) {
    logger.error("api/react", `Lỗi getByType ${req.params.type}`, err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/search", async (req, res) => {
  try {
    const keyword = req.query.q || "";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    if (!keyword) return res.json({ items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 } });

    const data = await sourceManager.searchAll(keyword, page);
    res.json({
      items: data.items || [],
      pagination: data.pagination || { totalItems: 0, totalPages: 0, currentPage: page },
    });
  } catch (err) {
    logger.error("api/react", `Lỗi search ${req.query.q}`, err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/suggest", suggestLimiter, async (req, res) => {
  try {
    const keyword = req.query.q || "";
    if (!keyword || keyword.length < 2) return res.json([]);
    const data = await sourceManager.searchAll(keyword, 1, 8);
    res.json((data.items || []).slice(0, 8));
  } catch (err) {
    res.json([]);
  }
});

// ─── ACTOR ───────────────────────────────────────────────────────────────────

router.get("/actor/:name", async (req, res) => {
  try {
    const actorName = decodeURIComponent(req.params.name || "").trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    if (!actorName) return res.json({ items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 }, actorName: "", tmdbPerson: null });

    const nodeFetch = require("node-fetch");
    const apiKey = process.env.TMDB_API_KEY;

    // 1. Tìm người trên TMDB
    let tmdbPerson = null;
    let tmdbMovies = [];
    if (apiKey) {
      try {
        const searchRes = await nodeFetch(
          `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(actorName)}&language=vi&page=1`,
          { timeout: 5000 }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const person = (searchData.results || [])[0];
          if (person) {
            tmdbPerson = {
              id: person.id,
              name: person.name,
              profileUrl: person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : null,
              knownFor: (person.known_for || []).map(m => m.title || m.name).slice(0, 3),
            };
            // 2. Lấy filmography từ TMDB
            const credRes = await nodeFetch(
              `https://api.themoviedb.org/3/person/${person.id}/combined_credits?api_key=${apiKey}&language=vi`,
              { timeout: 5000 }
            );
            if (credRes.ok) {
              const credData = await credRes.json();
              const all = [
                ...(credData.cast || []).map(m => ({ ...m, _role: "cast" })),
              ]
                .filter(m => m.poster_path && (m.title || m.name))
                .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

              const startIdx = (page - 1) * 24;
              const pageItems = all.slice(startIdx, startIdx + 24);
              tmdbMovies = pageItems.map(m => ({
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

              res.set("Cache-Control", "public, max-age=1800");
              return res.json({
                items: tmdbMovies,
                pagination: {
                  totalItems: all.length,
                  totalPages: Math.ceil(all.length / 24),
                  currentPage: page,
                },
                actorName,
                tmdbPerson,
              });
            }
          }
        }
      } catch (tmdbErr) {
        logger.warn("api/react", `TMDB actor search failed: ${tmdbErr.message}`);
      }
    }

    // Fallback: search providers bằng tên diễn viên
    const data = await sourceManager.searchAll(actorName, page);
    res.json({
      items: data.items || [],
      pagination: data.pagination || { totalItems: 0, totalPages: 0, currentPage: page },
      actorName,
      tmdbPerson: null,
    });
  } catch (err) {
    logger.error("api/react", `Lỗi getByActor ${req.params.name}`, err);
    res.status(500).json({ error: err.message });
  }
});

// ─── TMDB TV INFO ─────────────────────────────────────────────────────────────

router.get("/tmdb/tv/:tmdbId", async (req, res) => {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return res.json({ nextEpisode: null, lastEpisode: null, status: null, name: null });

    const nodeFetch = require("node-fetch");
    const tmdbRes = await nodeFetch(
      `https://api.themoviedb.org/3/tv/${req.params.tmdbId}?api_key=${apiKey}&language=vi`,
      { timeout: 5000 }
    );
    if (!tmdbRes.ok) return res.json({ nextEpisode: null, lastEpisode: null, status: null, name: null });

    const data = await tmdbRes.json();
    const fmt = (ep) => ep ? {
      airDate: ep.air_date || null,
      episodeNumber: ep.episode_number || null,
      seasonNumber: ep.season_number || null,
      name: ep.name || null,
    } : null;

    res.set("Cache-Control", "public, max-age=3600");
    res.json({
      nextEpisode: fmt(data.next_episode_to_air),
      lastEpisode: fmt(data.last_episode_to_air),
      status: data.status || null,
      name: data.name || null,
    });
  } catch (err) {
    res.json({ nextEpisode: null, lastEpisode: null, status: null, name: null });
  }
});

// ─── SCHEDULE ────────────────────────────────────────────────────────────────

router.get("/schedule", async (req, res) => {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return res.json({ nowPlaying: [], upcoming: [], onAir: [] });

    const nodeFetch = require("node-fetch");
    const tmdbFetch = (url) => nodeFetch(url, { timeout: 6000 });

    const [nowPlayingRes, upcomingRes, onAirRes] = await Promise.allSettled([
      tmdbFetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${apiKey}&language=vi&region=VN&page=1`),
      tmdbFetch(`https://api.themoviedb.org/3/movie/upcoming?api_key=${apiKey}&language=vi&region=VN&page=1`),
      tmdbFetch(`https://api.themoviedb.org/3/tv/on_the_air?api_key=${apiKey}&language=vi&page=1`),
    ]);

    const parseItems = async (settled, type) => {
      if (settled.status === "rejected" || !settled.value?.ok) return [];
      const data = await settled.value.json().catch(() => ({}));
      return (data.results || []).slice(0, 24).map((item) => ({
        id: item.id,
        title: type === "tv" ? item.name : item.title,
        originalTitle: type === "tv" ? item.original_name : item.original_title,
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : null,
        backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
        releaseDate: type === "tv" ? item.first_air_date : item.release_date,
        rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : 0,
        overview: item.overview || "",
        type,
      }));
    };

    const [nowPlaying, upcoming, onAir] = await Promise.all([
      parseItems(nowPlayingRes, "movie"),
      parseItems(upcomingRes, "movie"),
      parseItems(onAirRes, "tv"),
    ]);

    res.set("Cache-Control", "public, max-age=3600");
    res.json({ nowPlaying, upcoming, onAir });
  } catch (err) {
    logger.error("api/react", "Lỗi getSchedule", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── AUTH ────────────────────────────────────────────────────────────────────

router.post("/auth/login", reactLoginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin đăng nhập" });
    }

    const user = await database.findUserByUsername(username);
    const valid = user && (await database.verifyPassword(password, user.password)) && user.is_active;

    if (!valid) {
      logger.warn("api/react", `Login failed: ${username}`, { ip: req.ip });
      return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
    }

    req.session.regenerate((regenErr) => {
      if (regenErr) return res.status(500).json({ success: false, message: "Lỗi phiên" });
      req.session.user = {
        id: user.id.toString(),
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      };
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ success: false, message: "Lỗi phiên" });
        logger.info("api/react", `Login success: ${username}`, { ip: req.ip, userId: user.id });
        res.json({
          success: true,
          user: {
            id: user.id.toString(),
            username: user.username,
            display_name: user.display_name,
            role: user.role,
            is_active: user.is_active,
          },
        });
      });
    });
  } catch (err) {
    logger.error("api/react", "Lỗi login", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

router.post("/auth/logout", requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) logger.error("api/react", "Lỗi logout", err);
    res.json({ success: true });
  });
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json({
    id: req.session.user.id,
    username: req.session.user.username,
    display_name: req.session.user.display_name,
    role: req.session.user.role,
  });
});

// ─── Lovable CSRF token endpoint ──────────────────────────────────────────────
// Lovable FE sử dụng double-submit cookie pattern với cookie `csrf_token`.
// Endpoint này generate random token, set vào cookie (không httpOnly để JS
// đọc được), và trả về token để FE dùng cho header X-CSRF-Token.
router.get("/auth/csrf-token", (req, res) => {
  const { randomBytes } = require("crypto");
  const token = randomBytes(24).toString("hex");
  res.cookie("csrf_token", token, {
    httpOnly: false,                 // Lovable FE cần đọc để attach header
    sameSite: "lax",                 // bảo vệ CSRF cho cross-site POST
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,     // 24h
  });
  res.json({ success: true, csrfToken: token });
});

// ─── Register (Lovable) ───────────────────────────────────────────────────────
// Chưa có trong EJS backend — Lovable FE cần endpoint này cho flow signup.
router.post("/auth/register", reactLoginLimiter, async (req, res) => {
  try {
    const { username, password, displayName } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Thiếu tài khoản hoặc mật khẩu" });
    }
    if (username.length < 3 || username.length > 32) {
      return res.status(400).json({ success: false, message: "Tài khoản phải từ 3-32 ký tự" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu phải từ 6 ký tự trở lên" });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return res.status(400).json({ success: false, message: "Tài khoản chỉ chứa chữ, số, _ . -" });
    }

    const existing = await database.findUserByUsername(username);
    if (existing) {
      return res.status(409).json({ success: false, message: "Tài khoản đã tồn tại" });
    }

    const user = await database.createUser({
      username,
      password,
      display_name: (displayName || username).substring(0, 50),
      role: "user",
      is_active: true,
    });

    // Auto-login sau khi đăng ký
    req.session.regenerate((regenErr) => {
      if (regenErr) return res.status(500).json({ success: false, message: "Lỗi phiên" });
      req.session.user = {
        id: user.id.toString(),
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      };
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ success: false, message: "Lỗi phiên" });
        logger.info("api/react", `Register success: ${username}`, { ip: req.ip });
        res.json({
          success: true,
          user: {
            id: user.id.toString(),
            username: user.username,
            display_name: user.display_name,
            role: user.role,
            is_active: user.is_active,
          },
        });
      });
    });
  } catch (err) {
    logger.error("api/react", "Lỗi register", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

// ─── Forgot password (Lovable) ───────────────────────────────────────────────
// Hiện tại chỉ log + trả message chung. Production cần integrate email service.
router.post("/auth/forgot-password", reactLoginLimiter, async (req, res) => {
  try {
    const { email, username } = req.body || {};
    if (!email && !username) {
      return res.status(400).json({ success: false, message: "Cần email hoặc tài khoản" });
    }
    // Không tiết lộ user tồn tại hay không
    logger.info("api/react", `Forgot password request: ${email || username}`, { ip: req.ip });
    res.json({
      success: true,
      message: "Nếu tài khoản tồn tại, email khôi phục đã được gửi.",
    });
  } catch (err) {
    logger.error("api/react", "Lỗi forgot-password", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

// ─── Update profile (Lovable) ─────────────────────────────────────────────────
router.put("/auth/profile", requireAuth, async (req, res) => {
  try {
    const { displayName } = req.body || {};
    const updates = {};
    if (displayName !== undefined) {
      if (typeof displayName !== "string" || displayName.length < 1 || displayName.length > 50) {
        return res.status(400).json({ success: false, message: "Tên hiển thị phải từ 1-50 ký tự" });
      }
      updates.display_name = displayName;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "Không có thông tin cần cập nhật" });
    }

    await database.updateUser(req.session.user.id, updates);
    // Cập nhật session để /auth/me thấy giá trị mới
    Object.assign(req.session.user, {
      display_name: updates.display_name ?? req.session.user.display_name,
    });
    req.session.save(() => {
      res.json({ success: true, user: { ...req.session.user } });
    });
  } catch (err) {
    logger.error("api/react", "Lỗi update profile", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

// ─── Change password (Lovable) ───────────────────────────────────────────────
router.post("/auth/change-password", reactLoginLimiter, requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Thiếu mật khẩu hiện tại hoặc mới" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải từ 6 ký tự" });
    }
    const user = await database.findUserByUsername(req.session.user.username);
    if (!user || !(await database.verifyPassword(currentPassword, user.password))) {
      return res.status(401).json({ success: false, message: "Mật khẩu hiện tại không đúng" });
    }
    await database.updateUser(req.session.user.id, { password: newPassword });
    res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (err) {
    logger.error("api/react", "Lỗi change password", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

// ─── FAVORITES ───────────────────────────────────────────────────────────────

router.get("/favorites", requireAuth, async (req, res) => {
  try {
    let favorites;
    if (useNewFavoritesModule && favoritesService) {
      favorites = await favoritesService.getFavorites(req.session.user.id, 24);
    } else {
      favorites = await database.getFavorites(req.session.user.id);
    }
    res.json(favorites);
  } catch (err) {
    logger.error("api/react", "Lỗi getFavorites", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.post("/favorites/toggle", requireAuth, async (req, res) => {
  try {
    const movieSlug = sanitizeStr(req.body.movieSlug);
    const movieName = sanitizeStr(req.body.movieName);
    const movieThumb = sanitizeUrl(req.body.movieThumb);
    const movieOriginName = sanitizeStr(req.body.movieOriginName);
    const lastEpisode = sanitizeStr(req.body.lastEpisode);

    if (!movieSlug) return res.status(400).json({ error: "Thiếu movieSlug" });

    let response;
    if (useNewFavoritesModule && favoritesService) {
      const result = await favoritesService.toggle(req.session.user.id, { movieSlug, movieName, movieThumb, movieOriginName, lastEpisode });
      response = { status: result.action, isFavorite: result.action === 'added' };
    } else {
      const removed = await database.removeFavorite(req.session.user.id, movieSlug);
      if (removed) {
        response = { status: "removed", isFavorite: false };
      } else {
        await database.addFavorite(req.session.user.id, { movieSlug, movieName, movieThumb, movieOriginName, lastEpisode });
        response = { status: "added", isFavorite: true };
      }
    }

    // F10: Invalidate recommendation cache khi user thay đổi favorite
    try {
      recommendationService.invalidateUserCache(req.session.user.id);
    } catch { /* non-blocking */ }

    res.json(response);
  } catch (err) {
    logger.error("api/react", "Lỗi toggleFavorite", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.get("/favorites/check/:slug", requireAuth, async (req, res) => {
  try {
    let isFav;
    if (useNewFavoritesModule && favoritesService) {
      isFav = await favoritesService.isFavorite(req.session.user.id, req.params.slug);
    } else {
      isFav = await database.isFavorite(req.session.user.id, req.params.slug);
    }
    res.json({ isFavorite: isFav });
  } catch (err) {
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// ─── HISTORY ─────────────────────────────────────────────────────────────────

router.get("/history", requireAuth, async (req, res) => {
  try {
    let history;
    if (useNewHistoryModule && historyService) {
      history = await historyService.getHistory(req.session.user.id, 100);
    } else {
      history = await database.getWatchHistory(req.session.user.id, 100);
    }
    res.json(history);
  } catch (err) {
    logger.error("api/react", "Lỗi getHistory", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.post("/history/progress", requireAuth, async (req, res) => {
  try {
    const { movieSlug, episodeSlug, currentTime, duration, movieName, movieThumb, movieOriginName } = req.body;
    if (!movieSlug || !episodeSlug) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin" });
    }
    if (useNewHistoryModule && historyService) {
      await historyService.saveProgress(req.session.user.id, {
        movieSlug, episodeSlug, currentTime: parseInt(currentTime) || 0,
        duration: parseInt(duration) || 0, movieName, movieThumb, movieOriginName,
      });
    } else {
      await database.saveWatchProgress(req.session.user.id, {
        movieSlug, episodeSlug,
        currentTime: parseInt(currentTime) || 0,
        duration: parseInt(duration) || 0, movieName, movieThumb, movieOriginName,
      });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error("api/react", "Lỗi saveProgress", err);
    res.status(500).json({ success: false });
  }
});

router.get("/history/progress/:slug/:episode", requireAuth, async (req, res) => {
  try {
    let progress;
    if (useNewHistoryModule && historyService) {
      progress = await historyService.getProgress(req.session.user.id, req.params.slug, req.params.episode);
    } else {
      progress = await database.getWatchProgress(req.session.user.id, req.params.slug, req.params.episode);
    }
    res.json({ success: true, progress: progress || null });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.delete("/history/:id", requireAuth, async (req, res) => {
  try {
    let deleted;
    if (useNewHistoryModule && historyService) {
      deleted = await historyService.deleteItem(req.session.user.id, req.params.id);
    } else {
      deleted = await database.deleteWatchHistory(req.session.user.id, req.params.id);
    }
    res.json({ success: deleted });
  } catch (err) {
    logger.error("api/react", "Lỗi deleteHistory", err);
    res.status(500).json({ success: false });
  }
});

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

router.get("/notifications", requireAuth, async (req, res) => {
  try {
    let notifications;
    if (useNewNotificationsModule && notificationService) {
      notifications = await notificationService.getNotifications(req.session.user.id, 20);
    } else {
      notifications = await database.getNotifications(req.session.user.id, 20);
    }
    res.json(notifications);
  } catch (err) {
    logger.error("api/react", "Lỗi getNotifications", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.get("/notifications/count", requireAuth, async (req, res) => {
  try {
    let count;
    if (useNewNotificationsModule && notificationService) {
      count = await notificationService.getUnreadCount(req.session.user.id);
    } else {
      count = await database.countUnreadNotifications(req.session.user.id);
    }
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.post("/notifications/read", requireAuth, async (req, res) => {
  try {
    if (useNewNotificationsModule && notificationService) {
      await notificationService.markAllRead(req.session.user.id);
    } else {
      await database.markNotificationsRead(req.session.user.id);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.post("/notifications/read/:id", requireAuth, async (req, res) => {
  try {
    if (useNewNotificationsModule && notificationService) {
      await notificationService.markRead(req.session.user.id, req.params.id);
    } else {
      await database.markNotificationRead(req.session.user.id, req.params.id);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// ─── WATCHLIST (F4) ──────────────────────────────────────────────────────────

router.get("/watchlist", requireAuth, async (req, res) => {
  try {
    const items = await database.getWatchlist(req.session.user.id, 100);
    res.json(items);
  } catch (err) {
    logger.error("api/react", "Lỗi getWatchlist", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.post("/watchlist/toggle", requireAuth, async (req, res) => {
  try {
    const movieSlug = sanitizeStr(req.body.movieSlug);
    const movieName = sanitizeStr(req.body.movieName);
    const movieThumb = sanitizeUrl(req.body.movieThumb);
    const movieOriginName = sanitizeStr(req.body.movieOriginName);
    const lastEpisode = sanitizeStr(req.body.lastEpisode);
    const note = sanitizeStr(req.body.note || "");

    if (!movieSlug) return res.status(400).json({ error: "Thiếu movieSlug" });

    const removed = await database.removeFromWatchlist(req.session.user.id, movieSlug);
    if (removed) {
      return res.json({ status: "removed", inWatchlist: false });
    }
    await database.addToWatchlist(req.session.user.id, {
      movieSlug, movieName, movieThumb, movieOriginName, lastEpisode, note,
    });
    res.json({ status: "added", inWatchlist: true });
  } catch (err) {
    logger.error("api/react", "Lỗi toggleWatchlist", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.get("/watchlist/check/:slug", requireAuth, async (req, res) => {
  try {
    const inWl = await database.isInWatchlist(req.session.user.id, req.params.slug);
    res.json({ inWatchlist: inWl });
  } catch (err) {
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// ─── TRANSLATE (F5 - Gemini) ─────────────────────────────────────────────────

const { translate } = require("../services/geminiService");
const { translateLimiter } = require("../middleware/rateLimit");

router.post("/translate", translateLimiter || ((req, res, next) => next()), async (req, res) => {
  try {
    const text = typeof req.body.text === "string" ? req.body.text : "";
    const targetLang = typeof req.body.targetLang === "string" ? req.body.targetLang.slice(0, 5) : "vi";
    const movieSlug = typeof req.body.movieSlug === "string" ? sanitizeStr(req.body.movieSlug) : null;

    if (!text || text.trim().length < 5) {
      return res.status(400).json({ error: "Văn bản quá ngắn" });
    }
    if (text.length > 8000) {
      return res.status(400).json({ error: "Văn bản quá dài (tối đa 8000 ký tự)" });
    }

    const result = await translate({ text, targetLang, movieSlug });
    res.json({
      translatedText: result.translated_text,
      cached: result.cached,
      source: result.source,
    });
  } catch (err) {
    logger.error("api/react", "Lỗi translate", err);
    if (String(err.message).includes("GEMINI_API_KEY")) {
      return res.status(503).json({ error: "Dịch vụ dịch chưa cấu hình" });
    }
    res.status(500).json({ error: "Không thể dịch lúc này" });
  }
});

// ─── RECOMMENDATIONS (F10) ───────────────────────────────────────────────────

// recommendationService đã import ở đầu file (line 1)
const { getRecommendations } = recommendationService;

router.get("/recommendations", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(24, Math.max(4, parseInt(req.query.limit) || 12));
    const items = await getRecommendations(req.session.user.id, sourceManager, limit);
    res.json(items);
  } catch (err) {
    logger.error("api/react", "Lỗi getRecommendations", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// ─── FEEDBACK ────────────────────────────────────────────────────────────────

router.post("/feedback", async (req, res) => {
  try {
    const { name, email, category, message, movieSlug } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập tên" });
    }
    if (!message || message.trim().length < 10) {
      return res.status(400).json({ success: false, message: "Nội dung phải có ít nhất 10 ký tự" });
    }
    if (message.length > 2000) {
      return res.status(400).json({ success: false, message: "Nội dung tối đa 2000 ký tự" });
    }

    if (useNewFeedbackModule && feedbackService) {
      await feedbackService.submit({
        name: name.trim(), email: email ? email.trim() : null,
        category: category || "other", message: message.trim(), movieSlug: movieSlug || null,
        userId: req.session.user ? req.session.user.id : null, ip: req.ip,
      });
    } else {
      await database.createFeedback({
        name: name.trim(),
        email: email ? email.trim() : null,
        category: category || "other",
        message: message.trim(),
        movieSlug: movieSlug || null,
        userId: req.session.user ? req.session.user.id : null,
        ip: req.ip,
      });
    }

    res.json({ success: true, message: "Cảm ơn bạn đã gửi góp ý!" });
  } catch (err) {
    if (err.message === 'RATE_LIMIT') {
      return res.status(429).json({ success: false, message: "Bạn đã gửi quá nhiều. Vui lòng thử lại sau 1 giờ." });
    }
    logger.error("api/react", "Lỗi submitFeedback", err);
    res.status(500).json({ success: false, message: "Có lỗi xảy ra" });
  }
});

module.exports = router;
