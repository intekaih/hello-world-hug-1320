/**
 * BaseApiProvider — Template Method pattern
 *
 * Abstract base class for movie API providers (OPhim, KKPhim, NguonC, etc.)
 * Subclasses override template methods to handle provider-specific response formats.
 *
 * Shared logic: cache, retry, fetchWithTimeout, image proxy, health tracking.
 *
 * Cache Strategy:
 * - Uses centralized cache from core/cache when available
 * - Falls back to per-instance cache for backward compatibility
 * - Stale cache for resilience when APIs fail
 */

const NodeCache = require("node-cache");
const logger = require("../utils/logger");
const { cache: centralizedCache } = require("../core/cache");
const { CACHE_NAMES } = require("../core/cache/constants");

// Flag to use centralized cache (can be disabled via env for testing)
const USE_CENTRALIZED_CACHE = process.env.USE_CENTRALIZED_CACHE !== 'false';

class BaseApiProvider {
  /**
   * @param {object} opts
   * @param {string} opts.name       — provider id: "ophim" | "kkphim" | "nguonc"
   * @param {string} opts.label      — display label: "OPhim" | "KKPhim" | "NguonC"
   * @param {string} opts.baseUrl    — API base URL (e.g. https://ophim1.com/v1/api)
   * @param {string} opts.cdnUrl     — CDN image base (e.g. https://img.ophim.live)
   * @param {number} [opts.cacheTTL=300]    — primary cache TTL in seconds
   * @param {number} [opts.maxKeys=500]     — max cache entries
   * @param {number} [opts.timeout=15000]   — fetch timeout ms
   */
  constructor(opts) {
    if (new.target === BaseApiProvider) {
      throw new Error("BaseApiProvider is abstract — use a subclass");
    }

    this.name = opts.name;
    this.label = opts.label;
    this.baseUrl = opts.baseUrl;
    this.cdnUrl = opts.cdnUrl || "";
    this.timeout = opts.timeout || 15000;
    this.cacheTTL = opts.cacheTTL || 300;
    this.maxKeys = opts.maxKeys || 500;

    // ── Cache Strategy ────────────────────────────────────────────────────────
    // Use centralized cache if available, otherwise fall back to per-instance cache
    if (USE_CENTRALIZED_CACHE && centralizedCache && centralizedCache[CACHE_NAMES.PROVIDER]) {
      this.cache = centralizedCache[CACHE_NAMES.PROVIDER];
      this.staleCache = centralizedCache[CACHE_NAMES.PROVIDER_STALE];
      this._usingCentralizedCache = true;
    } else {
      // Fallback: per-instance cache for backward compatibility or testing
      this.cache = new NodeCache({
        stdTTL: this.cacheTTL,
        checkperiod: 120,
        maxKeys: this.maxKeys,
        useClones: true,
      });

      this.staleCache = new NodeCache({
        stdTTL: 24 * 60 * 60,
        checkperiod: 3600,
        maxKeys: this.maxKeys,
        useClones: true,
      });
      this._usingCentralizedCache = false;

      // Periodic cleanup only for per-instance caches
      this._setupCleanupInterval();
    }

    // Health tracking
    this.failCount = 0;
    this.lastFailTime = 0;

    // ─── Circuit Breaker ──────────────────────────────────────────────────
    this._circuitState = 'CLOSED';
    this._failCount = 0;
    this._lastFailTime = 0;
    this._halfOpenAttempts = 0;
    // Config
    this._circuitThreshold = opts.circuitThreshold || 10;
    this._circuitCooldown = opts.circuitCooldown || 60000;
    this._circuitMaxHalfOpen = 2;
  }

  // ── Per-instance cache cleanup (only when not using centralized) ───────────

  _setupCleanupInterval() {
    setInterval(() => {
      const stats = this.cache.getStats();
      if (stats.keys > 450) {
        this.cache.flushAll();
        logger.info(this.name, 'Cache flushed due to high keys', { keys: stats.keys });
      }
    }, 300000); // Every 5 minutes
  }

  // ─── Cache helpers ──────────────────────────────────────────────────────────

  /**
   * Get from cache with provider-prefixed key
   */
  getCached(key) {
    return this.cache.get(key) || null;
  }

  /**
   * Set to cache with optional TTL override
   */
  setCache(key, data, ttl) {
    if (typeof ttl === "number" && ttl > 0) {
      this.cache.set(key, data, ttl);
    } else {
      this.cache.set(key, data);
    }
    this.staleCache.set(key, data);
  }

  /**
   * PERF-5: Optional hook subclasses override để tính TTL theo nội dung.
   * Default: phim đã hoàn thành (status==='completed') hoặc episode_current chứa
   * "Hoàn tất"/"Full" → cache 24h thay vì 5 phút.
   * Phim ongoing dùng TTL mặc định để cập nhật tập mới nhanh.
   */
  computeTTL(cacheKey, json) {
    try {
      const isDetail = cacheKey.includes(":detail:");
      if (!isDetail) return null;
      const m = json && json.movie ? json.movie : json;
      const status = (m?.status || "").toLowerCase();
      const ec = (m?.episode_current || m?.current_episode || "").toLowerCase();
      const completedHints = ["completed", "hoàn tất", "hoan tat", "full"];
      if (
        completedHints.some((h) => status.includes(h)) ||
        completedHints.some((h) => ec.includes(h))
      ) {
        return 24 * 60 * 60; // 24h cho phim đã hoàn thành
      }
    } catch { /* ignore */ }
    return null;
  }

  // ─── Circuit Breaker ─────────────────────────────────────────────────────
  // States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing) → CLOSED/OPEN
  // Exponential backoff: cooldown doubles per circuit OPEN cycle

  _isCircuitOpen() {
    if (this._circuitState === 'CLOSED') return false;
    if (this._circuitState === 'HALF_OPEN') {
      // Allow limited requests to test recovery
      this._halfOpenAttempts++;
      if (this._halfOpenAttempts <= this._circuitMaxHalfOpen) return false;
      return true;
    }
    // OPEN - check if cooldown expired
    const cooldown = this._circuitCooldown * Math.pow(2, this._circuitOpenCount || 0);
    if (Date.now() - this._lastFailTime > cooldown) {
      logger.info(this.name, 'Circuit breaker transitioning to HALF_OPEN', { cooldown });
      this._circuitState = 'HALF_OPEN';
      this._halfOpenAttempts = 0;
      return false;
    }
    return true;
  }

  recordSuccess() {
    if (this._circuitState === 'HALF_OPEN') {
      logger.info(this.name, 'Circuit breaker recovered — CLOSED');
      this._circuitState = 'CLOSED';
      this._failCount = 0;
      this._circuitOpenCount = 0;
    }
    this._failCount = Math.max(0, this._failCount - 1);
  }

  recordFailure() {
    this._failCount++;
    this._lastFailTime = Date.now();
    if (this._failCount >= this._circuitThreshold) {
      this._circuitState = 'OPEN';
      this._circuitOpenCount = (this._circuitOpenCount || 0) + 1;
      logger.warn(this.name,
        `Circuit breaker OPEN (fail=${this._failCount}, count=${this._circuitOpenCount})`);
    }
  }

  isHealthy() {
    if (this._circuitState === 'CLOSED') {
      if (this._failCount < this._circuitThreshold) return true;
      this._circuitState = 'OPEN';
      this._circuitOpenCount = (this._circuitOpenCount || 0) + 1;
      logger.warn(this.name, `Circuit breaker OPEN (fail=${this._failCount})`);
    }
    if (this._circuitState === 'OPEN' && !this._isCircuitOpen()) return true;
    if (this._circuitState === 'HALF_OPEN') return !this._isCircuitOpen();
    return false;
  }

  // ─── Fetch with timeout ─────────────────────────────────────────────────────

  async fetchWithTimeout(url, timeoutMs) {
    const ms = timeoutMs || this.timeout;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
          Accept: "application/json",
        },
      });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  // ─── Core API call with retry + cache ───────────────────────────────────────

  /**
   * Fetch an API endpoint with retry, 429 handling, and stale cache fallback.
   * @param {string} url — full URL to fetch
   * @param {string} cacheKey — cache key
   * @param {number} [retries=2]
   * @returns {object|null}
   */
  async apiCall(url, cacheKey, retries = 2) {
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await this.fetchWithTimeout(url);

        if (!res.ok) {
          // Rate limited — backoff with jitter
          if (res.status === 429 && attempt < retries) {
            const retryAfterHeader = res.headers.get("retry-after");
            const baseDelay = retryAfterHeader
              ? Math.min(parseInt(retryAfterHeader, 10) * 1000, 30000)
              : 3000 * (attempt + 1);
            const jitter = Math.random() * 1000;
            logger.warn(this.name, `Rate limit 429, retry in ${Math.round((baseDelay + jitter) / 1000)}s`, { url, attempt });
            await new Promise((r) => setTimeout(r, baseDelay + jitter));
            continue;
          }
          // Server error — retry with jitter
          if (res.status >= 500 && attempt < retries) {
            const jitter = Math.random() * 500;
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1) + jitter));
            continue;
          }
          logger.error(this.name, `API error: ${res.status}`, { url });
          const stale = this.staleCache.get(cacheKey);
          if (stale) {
            logger.warn(this.name, `Using stale cache for: ${cacheKey}`);
            return stale;
          }
          return null;
        }

        const json = await res.json();
        const ttl = this.computeTTL(cacheKey, json);
        this.setCache(cacheKey, json, ttl);
        return json;
      } catch (err) {
        if (attempt < retries) {
          const jitter = Math.random() * 500;
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1) + jitter));
          continue;
        }
        const stale = this.staleCache.get(cacheKey);
        if (stale) {
          logger.warn(this.name, `All retries failed, using stale cache: ${cacheKey}`);
          return stale;
        }
        logger.error(this.name, `API call failed: ${url}`, err);
        return null;
      }
    }
    return null;
  }

  // ─── Image URL normalization (proxy through server) ─────────────────────────

  normalizeImageUrl(url) {
    if (!url) return "/images/no-poster.svg";
    let fullUrl = url;
    if (!url.startsWith("http")) {
      if (this.cdnUrl) {
        fullUrl = `${this.cdnUrl}/${url.replace(/^\//, "")}`;
      } else {
        return "/images/no-poster.svg";
      }
    }
    return fullUrl;
  }

  // ─── Sort field mapping (shared across OPhim/KKPhim) ────────────────────────

  mapSortField(sort) {
    const map = {
      newest: "modified.time",
      oldest: "modified.time",
      "name-az": "name",
      "name-za": "name",
      year: "year",
      _id: "_id",
      "modified.time": "modified.time",
    };
    return map[sort] || "modified.time";
  }

  mapSortType(sort) {
    return sort === "oldest" || sort === "name-az" ? "asc" : "desc";
  }

  // ─── Template methods — MUST be overridden by subclasses ────────────────────

  /**
   * Get provider name identifier.
   * @returns {string} e.g. "ophim", "kkphim", "nguonc"
   */
  getProviderName() {
    return this.name;
  }

  /**
   * Build the full URL for a given endpoint action.
   * @param {'list'|'detail'|'search'|'category'|'country'|'type'|'new'} action
   * @param {object} params — action-specific params (slug, page, keyword, filters, etc.)
   * @returns {string} full URL
   */
  buildEndpointUrl(action, params) {
    throw new Error(`${this.name}: buildEndpointUrl() must be implemented`);
  }

  /**
   * Normalize a raw list item from this provider into movieCC standard format.
   * @param {object} rawItem — raw item from API response
   * @returns {object} normalized item
   */
  normalizeListItem(rawItem) {
    throw new Error(`${this.name}: normalizeListItem() must be implemented`);
  }

  /**
   * Normalize a raw detail response into movieCC standard format.
   * @param {object} rawJson — full API JSON response for detail
   * @returns {object|null} normalized movie detail with episodes
   */
  normalizeDetail(rawJson) {
    throw new Error(`${this.name}: normalizeDetail() must be implemented`);
  }

  /**
   * Parse the list API response wrapper to extract items + pagination.
   * @param {object} json — raw API JSON response
   * @returns {{ items: object[], pagination: object, titlePage: string }|null}
   */
  parseListResponse(json) {
    throw new Error(`${this.name}: parseListResponse() must be implemented`);
  }

  // ─── Public API (uses template methods) ─────────────────────────────────────

  /**
   * Get newly updated movies.
   */
  async getNewMovies(page = 1) {
    const url = this.buildEndpointUrl("new", { page });
    const cacheKey = `${this.name}:new:${page}`;
    const json = await this.apiCall(url, cacheKey);
    if (!json) return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 } };

    const parsed = this.parseListResponse(json);
    if (!parsed) return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 } };

    const items = (parsed.items || []).map((item) => this.normalizeListItem(item));
    return { items, pagination: parsed.pagination };
  }

  /**
   * Get movie detail including episodes.
   */
  async getMovieDetail(slug) {
    const url = this.buildEndpointUrl("detail", { slug });
    const cacheKey = `${this.name}:detail:${slug}`;

    const json = await this.apiCall(url, cacheKey);
    if (!json) return null;

    const result = this.normalizeDetail(json);
    return result;
  }

  /**
   * Search movies by keyword.
   */
  async searchMovies(keyword, page = 1, limit = 24) {
    const url = this.buildEndpointUrl("search", { keyword, page, limit });
    const cacheKey = `${this.name}:search:${keyword}:${page}:${limit}`;
    const json = await this.apiCall(url, cacheKey);
    if (!json) return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 } };

    const parsed = this.parseListResponse(json);
    if (!parsed) return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 } };

    const items = (parsed.items || []).map((item) => this.normalizeListItem(item));
    return { items, pagination: parsed.pagination };
  }

  /**
   * Get movies by category/genre.
   */
  async getByCategory(slug, page = 1, filters = {}) {
    const url = this.buildEndpointUrl("category", { slug, page, filters });
    const cacheKey = `${this.name}:cat:${slug}:${page}:${JSON.stringify(filters)}`;
    const json = await this.apiCall(url, cacheKey);
    if (!json) return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 }, titlePage: "" };

    const parsed = this.parseListResponse(json);
    if (!parsed) return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 }, titlePage: "" };

    const items = (parsed.items || []).map((item) => this.normalizeListItem(item));
    return { items, pagination: parsed.pagination, titlePage: parsed.titlePage || "" };
  }

  /**
   * Get movies by country.
   */
  async getByCountry(slug, page = 1, filters = {}) {
    const url = this.buildEndpointUrl("country", { slug, page, filters });
    const cacheKey = `${this.name}:country:${slug}:${page}:${JSON.stringify(filters)}`;
    const json = await this.apiCall(url, cacheKey);
    if (!json) return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 }, titlePage: "" };

    const parsed = this.parseListResponse(json);
    if (!parsed) return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 }, titlePage: "" };

    const items = (parsed.items || []).map((item) => this.normalizeListItem(item));
    return { items, pagination: parsed.pagination, titlePage: parsed.titlePage || "" };
  }

  /**
   * Get movies by type (phim-bo, phim-le, hoat-hinh, etc.)
   */
  async getByType(type, page = 1, filters = {}) {
    const url = this.buildEndpointUrl("type", { type, page, filters });
    const cacheKey = `${this.name}:type:${type}:${page}:${JSON.stringify(filters)}`;
    const json = await this.apiCall(url, cacheKey);
    if (!json) return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 }, titlePage: "" };

    const parsed = this.parseListResponse(json);
    if (!parsed) return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 }, titlePage: "" };

    const items = (parsed.items || []).map((item) => this.normalizeListItem(item));
    return { items, pagination: parsed.pagination, titlePage: parsed.titlePage || "" };
  }
}

module.exports = BaseApiProvider;
