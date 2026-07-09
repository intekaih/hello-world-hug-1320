/**
 * KKPhim API Provider
 * Extends BaseApiProvider — Template Method pattern
 *
 * API base: https://phimapi.com/v1/api (list endpoints)
 * Detail/new movies use base URL without /v1/api
 * CDN: https://phimimg.com
 */

const BaseApiProvider = require("./BaseApiProvider");

class KKPhimProvider extends BaseApiProvider {
  constructor() {
    const rawBase = process.env.KKPHIM_BASE_URL || "https://phimapi.com";
    const baseUrl = rawBase + "/v1/api";
    const cdnUrl = process.env.KKPHIM_CDN_IMAGE || "https://phimimg.com";
    super({
      name: "kkphim",
      label: "KKPhim",
      baseUrl,
      cdnUrl,
      cacheTTL: 300,
    });
    // KKPhim detail/new endpoints use raw base (no /v1/api)
    this.rawBaseUrl = rawBase;
  }

  // ─── Template Method overrides ──────────────────────────────────────────────

  normalizeListItem(item) {
    return {
      name: item.name || "",
      slug: item.slug || "",
      origin_name: item.origin_name || "",
      thumb_url: this.normalizeImageUrl(item.thumb_url),
      poster_url: this.normalizeImageUrl(item.poster_url),
      year: item.year || 0,
      quality: item.quality || "FHD",
      lang: item.lang || "Vietsub",
      episode_current: item.episode_current || "",
      episode_total: item.episode_total || "?",
      type: item.type || "hoathinh",
      time: item.time || "",
      category: item.category || [],
      country: item.country || [],
      content: item.content || "",
      rating: item.tmdb?.vote_average || item.imdb?.vote_average || 0,
      tmdb: item.tmdb ? { id: item.tmdb.id, type: item.tmdb.type } : undefined,
      _source: "kk",
    };
  }

  normalizeDetail(json) {
    // KKPhim detail: {status: true, movie: {...}, episodes: [...]}
    if ((json.status !== true && json.status !== "success") || !json.movie) return null;

    const item = json.movie;
    return {
      name: item.name || "",
      slug: item.slug || "",
      origin_name: item.origin_name || "",
      thumb_url: this.normalizeImageUrl(item.thumb_url),
      poster_url: this.normalizeImageUrl(item.poster_url),
      year: item.year || 0,
      quality: item.quality || "FHD",
      lang: item.lang || "Vietsub",
      episode_current: item.episode_current || "",
      episode_total: item.episode_total || "?",
      type: item.type || "hoathinh",
      status: item.status || "",
      time: item.time || "",
      content: item.content || "",
      category: item.category || [],
      country: item.country || [],
      actor: item.actor || [],
      director: item.director || [],
      notify: item.notify || "",
      showtimes: item.showtimes || "",
      trailer_url: item.trailer_url || "",
      episodes: json.episodes || [],
      tmdb: item.tmdb || {},
      imdb: item.imdb || {},
      _source: "kk",
    };
  }

  parseListResponse(json) {
    // KKPhim list via /v1/api: {status: true, data: {items, params: {pagination}, titlePage}}
    if ((json.status !== true && json.status !== "success") || !json.data) {
      // KKPhim new movies via raw base: {status, items, pagination: {totalItems, totalPages, ...}}
      if (json.status && json.items) {
        const pagination = json.pagination || {};
        return {
          items: json.items || [],
          pagination: {
            totalItems: pagination.totalItems || 0,
            totalPages: pagination.totalPages || Math.ceil((pagination.totalItems || 0) / (pagination.totalItemsPerPage || 10)),
            currentPage: pagination.currentPage || 1,
          },
          titlePage: "",
        };
      }
      return null;
    }

    const data = json.data;
    const pagination = data.params?.pagination || {};
    const totalItems = pagination.totalItems || 0;
    const totalItemsPerPage = pagination.totalItemsPerPage || 10;

    return {
      items: data.items || [],
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / totalItemsPerPage),
        currentPage: pagination.currentPage || 1,
      },
      titlePage: data.titlePage || "",
    };
  }

  static UNSUPPORTED_TYPES = new Set([
    "phim-bo-dang-chieu",
    "phim-bo-hoan-thanh",
    "phim-sap-chieu",
    "phim-dang-chieu",
  ]);

  async getByType(type, page = 1, filters = {}) {
    if (KKPhimProvider.UNSUPPORTED_TYPES.has(type)) {
      return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 }, titlePage: "" };
    }
    return super.getByType(type, page, filters);
  }

  buildEndpointUrl(action, params = {}) {
    const { slug, page, keyword, limit, filters, type } = params;

    switch (action) {
      case "new":
        return `${this.rawBaseUrl}/danh-sach/phim-moi-cap-nhat?page=${page || 1}`;

      case "detail":
        return `${this.rawBaseUrl}/phim/${encodeURIComponent(slug)}`;

      case "search":
        return `${this.baseUrl}/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=${limit || 10}&page=${page || 1}`;

      case "category": {
        let url = `${this.baseUrl}/the-loai/${encodeURIComponent(slug)}?page=${page || 1}`;
        url += this._buildFilterParams(filters);
        return url;
      }

      case "country": {
        let url = `${this.baseUrl}/quoc-gia/${encodeURIComponent(slug)}?page=${page || 1}`;
        url += this._buildFilterParams(filters);
        return url;
      }

      case "type": {
        const base = type === "phim-moi-cap-nhat" ? this.rawBaseUrl : this.baseUrl;
        let url = `${base}/danh-sach/${encodeURIComponent(type)}?page=${page || 1}`;
        url += this._buildFilterParams(filters);
        return url;
      }

      default:
        throw new Error(`KKPhimProvider: unknown action "${action}"`);
    }
  }

  _buildFilterParams(filters = {}) {
    let params = "";
    if (filters.year) params += `&year=${filters.year}`;
    if (filters.category) params += `&category=${filters.category}`;
    if (filters.country) params += `&country=${filters.country}`;
    if (filters.sort) {
      params += `&sort_field=${this.mapSortField(filters.sort)}&sort_type=${this.mapSortType(filters.sort)}`;
    }
    return params;
  }
}

// Singleton export
module.exports = new KKPhimProvider();
