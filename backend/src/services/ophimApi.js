/**
 * OPhim API Provider
 * Extends BaseApiProvider — Template Method pattern
 *
 * API base: https://ophim1.com/v1/api
 * CDN: https://img.ophim.live
 */

const BaseApiProvider = require("./BaseApiProvider");

class OPhimProvider extends BaseApiProvider {
  constructor() {
    const baseUrl = (process.env.OPHIM_BASE_URL || "https://ophim1.com") + "/v1/api";
    const cdnUrl = process.env.OPHIM_CDN_IMAGE || "https://img.ophim.live";
    super({
      name: "ophim",
      label: "OPhim",
      baseUrl,
      cdnUrl,
      cacheTTL: 300,
    });
  }

  // ─── Template Method overrides ──────────────────────────────────────────────

  normalizeImageUrl(url) {
    if (!url) return "/images/no-poster.svg";
    let fullUrl = url;
    if (!url.startsWith("http")) {
      fullUrl = `${this.cdnUrl}/uploads/movies/${url}`;
    }
    return fullUrl;
  }

  normalizeListItem(item) {
    return {
      name: item.name || "",
      slug: item.slug || "",
      origin_name: item.origin_name || "",
      thumb_url: this.normalizeImageUrl(item.thumb_url),
      poster_url: this.normalizeImageUrl(item.poster_url),
      year: item.year || 0,
      quality: item.quality || "HD",
      lang: item.lang || "Vietsub",
      episode_current: item.episode_current || "",
      episode_total: item.episode_total || "?",
      type: item.type || "series",
      time: item.time || "",
      category: item.category || [],
      country: item.country || [],
      content: item.content || "",
      rating: item.tmdb?.vote_average || item.imdb?.vote_average || 0,
      tmdb: item.tmdb ? { id: item.tmdb.id, type: item.tmdb.type } : undefined,
      _source: "op",
    };
  }

  normalizeDetail(json) {
    // OPhim detail: apiCall returns raw JSON, we need to extract data.item
    if (json.status !== "success" || !json.data?.item) return null;

    const data = json.data;
    const item = data.item;
    return {
      name: item.name || "",
      slug: item.slug || "",
      origin_name: item.origin_name || "",
      thumb_url: this.normalizeImageUrl(item.thumb_url),
      poster_url: this.normalizeImageUrl(item.poster_url),
      year: item.year || 0,
      quality: item.quality || "HD",
      lang: item.lang || "Vietsub",
      episode_current: item.episode_current || "",
      episode_total: item.episode_total || "?",
      type: item.type || "series",
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
      episodes: item.episodes || [],
      tmdb: item.tmdb || {},
      imdb: item.imdb || {},
      _source: "op",
    };
  }

  parseListResponse(json) {
    // OPhim list: {status: "success", data: {items, params: {pagination}, titlePage, APP_DOMAIN_CDN_IMAGE}}
    if (json.status !== "success" || !json.data) return null;

    const data = json.data;
    const pagination = data.params?.pagination || {};
    const totalItems = pagination.totalItems || 0;
    const totalItemsPerPage = pagination.totalItemsPerPage || 24;

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

  buildEndpointUrl(action, params = {}) {
    const { slug, page, keyword, limit, filters, type } = params;

    switch (action) {
      case "new":
        return `${this.baseUrl}/danh-sach/phim-moi-cap-nhat?page=${page || 1}`;

      case "detail":
        return `${this.baseUrl}/phim/${encodeURIComponent(slug)}`;

      case "search":
        return `${this.baseUrl}/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=${limit || 24}&page=${page || 1}`;

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
        let typeSlug = type;
        let url;
        // Special handling for Anime to enable filtering support
        if (typeSlug === "hoat-hinh") {
          url = `${this.baseUrl}/danh-sach/phim-moi-cap-nhat?page=${page || 1}&type=hoathinh`;
        } else {
          url = `${this.baseUrl}/danh-sach/${encodeURIComponent(typeSlug)}?page=${page || 1}`;
        }
        url += this._buildFilterParams(filters);
        return url;
      }

      default:
        throw new Error(`OPhimProvider: unknown action "${action}"`);
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

  // ─── Override getByType to fix anime titlePage ──────────────────────────────

  async getByType(type, page = 1, filters = {}) {
    const result = await super.getByType(type, page, filters);
    if (type === "hoat-hinh" && result.titlePage === "") {
      result.titlePage = "Phim Hoạt Hình";
    }
    return result;
  }
}

// Singleton export
module.exports = new OPhimProvider();
