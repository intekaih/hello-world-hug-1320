/**
 * NguonC API Provider
 * Extends BaseApiProvider — Template Method pattern
 *
 * API base: https://phim.nguonc.com
 * Endpoints: /api/films/... (list), /api/film/... (detail)
 *
 * Key differences from OPhim/KKPhim:
 * - Episodes use `items` (not `server_data`), `embed` (not `link_embed`), `m3u8` (not `link_m3u8`)
 * - Category is object with numbered keys, each containing group.name + list[]
 * - Field names: `language` (not `lang`), `description` (not `content`), `original_name` (not `origin_name`)
 * - No direct `year` field in list items — extracted from category group "Năm" or created date
 * - Pagination: `paginate` (not `params.pagination`)
 */

const BaseApiProvider = require("./BaseApiProvider");
const logger = require("../utils/logger");

class NguonCProvider extends BaseApiProvider {
  constructor() {
    const baseUrl = process.env.NGUONC_BASE_URL || "https://phim.nguonc.com";
    super({
      name: "nguonc",
      label: "NguonC",
      baseUrl,
      cdnUrl: "",
      cacheTTL: 300,
      timeout: 5000,
    });

    this._headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      "Referer": "https://phim.nguonc.com/",
      "Origin": "https://phim.nguonc.com",
    };

    // PERF-6: Circuit breaker chuyên dụng cho NguonC (chặt hơn baseline 10/60s).
    // Trạng thái: closed → open (sau 3 fail) → half-open (sau 120s) → closed (1 success).
    this._cb = {
      failThreshold: 3,
      cooldownMs: 120_000,
      halfOpenProbeLimit: 1,
      state: "closed",      // closed | open | half-open
      consecutiveFails: 0,
      openedAt: 0,
      halfOpenInflight: 0,
    };
  }

  // Override: NguonC chỉ retry 1 lần để không block tổng aggregate
  async apiCall(url, cacheKey, retries = 1) {
    return super.apiCall(url, cacheKey, retries);
  }

  // Override: Add Cloudflare-bypass headers
  async fetchWithTimeout(url, timeoutMs) {
    const ms = timeoutMs || this.timeout;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: this._headers,
      });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  // ─── PERF-6: Circuit breaker overrides ────────────────────────────────────
  isHealthy() {
    const cb = this._cb;
    if (cb.state === "closed") return true;
    if (cb.state === "open") {
      if (Date.now() - cb.openedAt > cb.cooldownMs) {
        cb.state = "half-open";
        cb.halfOpenInflight = 0;
        logger.info(this.name, "Circuit breaker: open → half-open (probe)");
      } else {
        return false; // Vẫn open, skip request
      }
    }
    if (cb.state === "half-open") {
      if (cb.halfOpenInflight >= cb.halfOpenProbeLimit) return false;
      cb.halfOpenInflight++;
      return true;
    }
    return true;
  }

  recordSuccess() {
    super.recordSuccess();
    const cb = this._cb;
    cb.consecutiveFails = 0;
    if (cb.state !== "closed") {
      logger.info(this.name, `Circuit breaker: ${cb.state} → closed (recovered)`);
      cb.state = "closed";
      cb.halfOpenInflight = 0;
    }
  }

  recordFailure() {
    super.recordFailure();
    const cb = this._cb;
    cb.consecutiveFails++;
    if (cb.state === "half-open") {
      cb.state = "open";
      cb.openedAt = Date.now();
      cb.halfOpenInflight = 0;
      logger.warn(this.name, "Circuit breaker: half-open → open (probe failed)");
      return;
    }
    if (cb.state === "closed" && cb.consecutiveFails >= cb.failThreshold) {
      cb.state = "open";
      cb.openedAt = Date.now();
      logger.warn(this.name, `Circuit breaker: closed → open (${cb.consecutiveFails} fails)`);
    }
  }

  // ─── Year extraction (find by group name, not hardcode index) ───────────────

  _extractYear(rawMovie) {
    // 1. From category group with name "Năm"
    const groups = Object.values(rawMovie.category || {});
    const yearGroup = groups.find((g) => g.group?.name === "Năm");
    if (yearGroup?.list?.[0]?.name) {
      const parsed = parseInt(yearGroup.list[0].name);
      if (!isNaN(parsed)) return parsed;
    }
    // 2. From created date
    if (rawMovie.created) {
      return new Date(rawMovie.created).getFullYear();
    }
    return 0;
  }

  // ─── Category extraction (normalize NguonC grouped format) ──────────────────

  _extractCategories(rawCategory) {
    if (!rawCategory) return [];
    const groups = Object.values(rawCategory);
    const catGroup = groups.find((g) => g.group?.name === "Thể loại");
    if (!catGroup?.list) return [];
    return catGroup.list.map((c) => ({
      name: c.name || "",
      slug: this._slugify(c.name || ""),
    }));
  }

  _extractCountries(rawCategory) {
    if (!rawCategory) return [];
    const groups = Object.values(rawCategory);
    const countryGroup = groups.find((g) => g.group?.name === "Quốc gia");
    if (!countryGroup?.list) return [];
    return countryGroup.list.map((c) => ({
      name: c.name || "",
      slug: this._slugify(c.name || ""),
    }));
  }

  _extractType(rawCategory) {
    if (!rawCategory) return "series";
    const groups = Object.values(rawCategory);
    const formatGroup = groups.find((g) => g.group?.name === "Định dạng");
    if (!formatGroup?.list?.[0]?.name) return "series";
    const format = formatGroup.list[0].name.toLowerCase();
    if (format.includes("lẻ") || format === "phim lẻ") return "single";
    if (format.includes("hoạt hình")) return "hoathinh";
    return "series";
  }

  _slugify(str) {
    if (!str) return "";
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  // ─── Template Method overrides ──────────────────────────────────────────────

  normalizeImageUrl(url) {
    if (!url) return "/images/no-poster.svg";
    if (!url.startsWith("http")) return "/images/no-poster.svg";
    return url;
  }

  normalizeListItem(item) {
    return {
      name: item.name || "",
      slug: item.slug || "",
      origin_name: item.original_name || "",
      thumb_url: this.normalizeImageUrl(item.thumb_url),
      poster_url: this.normalizeImageUrl(item.poster_url),
      year: this._extractYear(item),
      quality: item.quality || "HD",
      lang: item.language || "Vietsub",
      episode_current: item.current_episode || "",
      episode_total: item.total_episodes ? String(item.total_episodes) : "?",
      _episodeTotalNum: item.total_episodes || 0, // number form for scoreSource
      type: this._extractType(item.category),
      time: item.time || "",
      category: this._extractCategories(item.category),
      country: this._extractCountries(item.category),
      content: item.description || "",
      rating: 0, // NguonC doesn't provide TMDB/IMDB ratings
      _source: "nc",
    };
  }

  normalizeDetail(json) {
    if (json.status !== "success" || !json.movie) return null;

    const m = json.movie;

    // Normalize episodes: NguonC uses items[] with embed/m3u8 field names
    const normalizedEpisodes = (m.episodes || []).map((server) => ({
      server_name: server.server_name || "Server",
      server_data: (server.items || []).map((ep) => ({
        name: ep.name || "",
        slug: (ep.slug || ep.name || "").toLowerCase(),
        link_embed: ep.embed || "",
        link_m3u8: (ep.embed || ep.m3u8) ? `/api/proxy/plugins/stream/nguonc/${encodeURIComponent(ep.embed || ep.m3u8)}/playlist.m3u8` : "",
      })),
    }));

    // Extract director/casts as arrays
    const director = m.director
      ? m.director.split(",").map((d) => d.trim()).filter(Boolean)
      : [];
    const actor = m.casts
      ? m.casts.split(",").map((a) => a.trim()).filter(Boolean)
      : [];

    return {
      name: m.name || "",
      slug: m.slug || "",
      origin_name: m.original_name || "",
      thumb_url: this.normalizeImageUrl(m.thumb_url),
      poster_url: this.normalizeImageUrl(m.poster_url),
      year: this._extractYear(m),
      quality: m.quality || "HD",
      lang: m.language || "Vietsub",
      episode_current: m.current_episode || "",
      episode_total: m.total_episodes ? String(m.total_episodes) : "?",
      _episodeTotalNum: m.total_episodes || 0,
      type: this._extractType(m.category),
      status: m.current_episode?.includes("Hoàn tất") ? "completed" : "ongoing",
      time: m.time || "",
      content: m.description || "",
      category: this._extractCategories(m.category),
      country: this._extractCountries(m.category),
      actor,
      director,
      notify: "",
      showtimes: "",
      trailer_url: "",
      episodes: normalizedEpisodes,
      tmdb: {},
      imdb: {},
      _source: "nc",
    };
  }

  parseListResponse(json) {
    if (json.status !== "success") return null;

    // NguonC uses `paginate` instead of `params.pagination`
    const paginate = json.paginate || {};
    const totalItems = paginate.total_items || 0;
    const itemsPerPage = paginate.items_per_page || 10;

    return {
      items: json.items || [],
      pagination: {
        totalItems,
        totalPages: paginate.total_page || Math.ceil(totalItems / itemsPerPage),
        currentPage: paginate.current_page || 1,
      },
      titlePage: json.cat?.title || "",
    };
  }

  static UNSUPPORTED_TYPES = new Set([
    "phim-chieu-rap",
  ]);

  async getByType(type, page = 1, filters = {}) {
    if (NguonCProvider.UNSUPPORTED_TYPES.has(type)) {
      return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 }, titlePage: "" };
    }
    return super.getByType(type, page, filters);
  }

  buildEndpointUrl(action, params = {}) {
    const { slug, page, keyword, limit, filters, type } = params;

    switch (action) {
      case "new":
        return `${this.baseUrl}/api/films/phim-moi-cap-nhat?page=${page || 1}`;

      case "detail":
        return `${this.baseUrl}/api/film/${encodeURIComponent(slug)}`;

      case "search":
        return `${this.baseUrl}/api/films/search?keyword=${encodeURIComponent(keyword)}&page=${page || 1}${limit ? `&limit=${limit}` : ''}`;

      case "category":
        return `${this.baseUrl}/api/films/the-loai/${encodeURIComponent(slug)}?page=${page || 1}`;

      case "country":
        return `${this.baseUrl}/api/films/quoc-gia/${encodeURIComponent(slug)}?page=${page || 1}`;

      case "type": {
        const typeMap = {
          "phim-bo": "phim-bo",
          "phim-le": "phim-le",
          "hoat-hinh": "hoat-hinh",
          "phim-vietsub": "phim-vietsub",
          "phim-thuyet-minh": "phim-thuyet-minh",
          "phim-long-tieng": "phim-long-tieng",
          "phim-bo-dang-chieu": "phim-dang-chieu",
          "phim-bo-hoan-thanh": "phim-hoan-thanh",
          "phim-sap-chieu": "phim-sap-chieu",
          "phim-moi-cap-nhat": "phim-moi-cap-nhat",
        };
        const ncType = typeMap[type] || type;
        if (ncType === "phim-moi-cap-nhat") {
          return `${this.baseUrl}/api/films/${encodeURIComponent(ncType)}?page=${page || 1}`;
        }
        return `${this.baseUrl}/api/films/danh-sach/${encodeURIComponent(ncType)}?page=${page || 1}`;
      }

      default:
        throw new Error(`NguonCProvider: unknown action "${action}"`);
    }
  }

  // ─── NguonC doesn't support filter params on list endpoints ─────────────────
  // No sort_field, year, country params on their API
  // Filtering must be done client-side if needed
}

// Singleton export
module.exports = new NguonCProvider();
