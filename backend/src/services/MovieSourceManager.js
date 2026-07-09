/**
 * MovieSourceManager — Facade Pattern
 *
 * Orchestrates N movie API providers in parallel.
 * Handles: multi-source fetch, merge, dedup, cross-search fallback, episode merge.
 * All merge/matching logic lives here — controller stays thin.
 */

const logger = require("../utils/logger");

class MovieSourceManager {
  /**
   * @param {import('./BaseApiProvider')[]} providers — active provider instances
   */
  constructor(providers) {
    this.providers = providers;
  }

  // ─── Core parallel fetch (Promise.allSettled + graceful degradation) ────────

  /**
   * Call a method on all healthy providers in parallel.
   * Returns array of {data, provider} for fulfilled results.
   * Failed providers get recordFailure(), successful ones get recordSuccess().
   *
   * @param {string} method — provider method name
   * @param  {...any} args — arguments to pass
   * @returns {Promise<{data: any, provider: import('./BaseApiProvider')}[]>}
   */
  async _fetchAll(method, ...args) {
    const healthy = this.providers.filter((p) => p.isHealthy());
    if (healthy.length === 0) {
      logger.warn("sourceManager", `All providers unhealthy for ${method}, trying all anyway`);
      healthy.push(...this.providers);
    }

    const PROVIDER_TIMEOUT = 15000;

    const results = await Promise.allSettled(
      healthy.map((p) => {
        let settled = false;
        let timer;

        const providerPromise = p[method](...args)
          .then((data) => {
            if (!settled) {
              settled = true;
              p.recordSuccess();
            }
            clearTimeout(timer);
            return { data, provider: p };
          })
          .catch((err) => {
            if (!settled) {
              settled = true;
              p.recordFailure();
            }
            clearTimeout(timer);
            throw err;
          });

        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              p.recordFailure();
            }
            reject(new Error(`${p.name}: timeout after ${PROVIDER_TIMEOUT}ms for ${method}`));
          }, PROVIDER_TIMEOUT);
        });

        return Promise.race([providerPromise, timeoutPromise]);
      }),
    );

    const fulfilled = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    const rejected = results.filter((r) => r.status === "rejected");
    if (rejected.length > 0) {
      logger.warn("sourceManager", `${rejected.length}/${results.length} providers failed for ${method}`, {
        failed: rejected.map((r) => r.reason?.message || "unknown"),
      });
    }

    return fulfilled;
  }

  // ─── Merge helpers ──────────────────────────────────────────────────────────

  // ─── Normalize helpers ─────────────────────────────────────────────────────────

  /**
   * Cached normalization — avoids repeated string ops on the same input.
   * Uses Map with size limit to prevent unbounded growth.
   */
  static _normCache = new Map();
  static _NORM_CACHE_MAX = 2000;

  static normalize(str) {
    if (!str) return "";
    const existing = MovieSourceManager._normCache.get(str);
    if (existing !== undefined) return existing;
    const result = str.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (MovieSourceManager._normCache.size >= MovieSourceManager._NORM_CACHE_MAX) {
      MovieSourceManager._normCache.clear();
    }
    MovieSourceManager._normCache.set(str, result);
    return result;
  }

  /**
   * Attach and/or read cached normalized values on a movie object.
   * This avoids re-normalizing the same field across multiple isSameMovie() calls
   * within a single merge/dedupe pass.
   */
  static _norm(a) {
    if (!a) return null;
    if (!a._norm) {
      a._norm = {
        origin_name: MovieSourceManager.normalize(a.origin_name),
        name: MovieSourceManager.normalize(a.name),
      };
    }
    return a._norm;
  }

  /**
   * Check if two movies are the same.
   * Priority: exact slug → slug-prefix (season suffix) → origin_name → origin_name-prefix → name+year
   */
  static isSameMovie(a, b) {
    if (!a || !b) return false;

    // 1. Exact slug match — strongest
    if (a.slug && b.slug && a.slug === b.slug) return true;

    // Type guard: single vs series never merge (applies to all types including hoathinh)
    if (a.type && b.type && a.type !== b.type) {
      const singles = ["single", "phim-le"];
      const seriesTypes = ["series", "phim-bo"];
      if (
        (singles.includes(a.type) && seriesTypes.includes(b.type)) ||
        (seriesTypes.includes(a.type) && singles.includes(b.type))
      ) return false;
    }

    const yearA = a.year || 0;
    const yearB = b.year || 0;
    const bothHaveYear = yearA > 0 && yearB > 0;
    const yearClose = Math.abs(yearA - yearB) <= 1;

    // 2. Slug prefix: "no-le-cua-ma-do-tinh-binh" is base of "no-le-cua-ma-do-tinh-binh-phan-1"
    // Matches suffix patterns like "-phan-1", "-season-2", "-part-3", "-s2"
    if (a.slug && b.slug) {
      const [shorterSlug, longerSlug] = a.slug.length <= b.slug.length
        ? [a.slug, b.slug] : [b.slug, a.slug];
      const slugSuffix = longerSlug.slice(shorterSlug.length);
      if (longerSlug.startsWith(shorterSlug) && /^-?(phan|season|part|s|p)-?\d+$/.test(slugSuffix)) {
        if (bothHaveYear) return yearClose;
        return true;
      }
    }

    const { origin_name: normOriginA, name: normNameA } = MovieSourceManager._norm(a);
    const { origin_name: normOriginB, name: normNameB } = MovieSourceManager._norm(b);

    // 3. Exact origin_name match + year
    if (normOriginA && normOriginA === normOriginB) {
      if (bothHaveYear) return yearClose;
      return true;
    }

    // 4. Origin_name prefix: "chainedsoldier" is base of "chainedsoldierseason1"
    // Only if the extra part is a short season/number indicator
    if (normOriginA && normOriginB) {
      const [shorterO, longerO] = normOriginA.length <= normOriginB.length
        ? [normOriginA, normOriginB] : [normOriginB, normOriginA];
      const extraO = longerO.slice(shorterO.length);
      if (
        shorterO.length >= 8 &&
        longerO.startsWith(shorterO) &&
        /^(season|part|s|p)?\d{1,2}$/.test(extraO)
      ) {
        if (bothHaveYear) return yearClose;
        return true;
      }
    }

    // 5. Vietnamese name match + year — require year to avoid false matches on short/common names
    if (normNameA && normNameA === normNameB && normNameA.length >= 5) {
      if (bothHaveYear) return yearClose;
      if (normNameA.length >= 10) return true;
    }

    return false;
  }

  /**
   * Deduplicate a single provider's list (e.g., when a provider returns both
   * "movie-slug" and "movie-slug-phan-1" for the same anime).
   * Uses isSameMovie to find and remove intra-list duplicates, keeping the best item.
   */
  static dedupeList(list) {
    if (!list || list.length < 2) return list || [];
    const used = new Array(list.length).fill(false);
    const result = [];
    for (let i = 0; i < list.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      const anchor = list[i];
      const matchGroup = [anchor];
      for (let j = i + 1; j < list.length; j++) {
        if (used[j]) continue;
        if (MovieSourceManager.isSameMovie(anchor, list[j])) {
          used[j] = true;
          matchGroup.push(list[j]);
        }
      }
      const primary = MovieSourceManager.pickPrimary(matchGroup);
      result.push({ ...primary, _source: anchor._source || primary._source });
    }
    return result;
  }

  /** Score a movie source — higher = better quality primary candidate */
  static scoreSource(item) {
    if (!item) return 0;
    let s = 0;
    const total = parseInt(item.episode_total) || 0;
    const totalNum = item._episodeTotalNum || total; // NguonC luu so tap trong _episodeTotalNum
    if (totalNum > 0) s += totalNum * 2;
    else if (total > 0) s += total * 2;
    if (item.tmdb?.vote_average) s += 5;
    if (item.imdb?.vote_average) s += 3;
    const lang = (item.lang || "").toLowerCase();
    if (lang.includes("vietsub")) s += 3;
    const q = (item.quality || "").toUpperCase();
    if (q === "FHD" || q === "FULL HD") s += 4;
    else if (q === "HD") s += 2;
    const ec = (item.episode_current || "").toLowerCase();
    if (!ec.includes("trailer") && !ec.includes("sắp chiếu")) s += 1;
    return s;
  }

  /** Pick primary from N candidates */
  static pickPrimary(items) {
    if (!items || items.length === 0) return null;
    return items.reduce((best, current) =>
      MovieSourceManager.scoreSource(current) > MovieSourceManager.scoreSource(best)
        ? current
        : best,
    );
  }

  /**
   * PERF-3: Build a small set of "blocking keys" for an item. Items sharing at least
   * one blocking key are candidates for isSameMovie comparison. Drastically reduces
   * O(n²) cross-list comparisons to near O(n) when titles/slugs are well-formed.
   */
  static _bucketKeys(item) {
    const keys = [];
    if (item.slug) {
      // Use first 12 chars of slug — covers slug exact + slug prefix matches
      keys.push("s:" + item.slug.slice(0, 12));
    }
    const norm = MovieSourceManager._norm(item);
    if (norm.origin_name && norm.origin_name.length >= 4) {
      keys.push("o:" + norm.origin_name.slice(0, 8));
    }
    if (norm.name && norm.name.length >= 4) {
      keys.push("n:" + norm.name.slice(0, 8));
    }
    return keys;
  }

  /**
   * N-way merge of movie lists. Dedup via isSameMovie.
   * Primary = pickPrimary. _sources = ['op','kk','nc']
   *
   * PERF-3: Uses bucket-based blocking (Map<key, indices>) to limit isSameMovie
   * calls to candidates that share at least one prefix key. Effectively O(n)
   * when titles are well-formed.
   */
  static mergeMovieLists(...lists) {
    const allLists = lists.filter(Boolean);
    if (allLists.length === 0) return [];
    if (allLists.length === 1) {
      return allLists[0].map((m) => ({ ...m, _sources: [m._source || "unknown"] }));
    }

    // Deduplicate within each provider's list first (handles cases like
    // "movie-slug" and "movie-slug-phan-1" both returned by the same provider)
    const dedupedLists = allLists.map((l) => MovieSourceManager.dedupeList(l));

    // Flatten all items preserving list index for cross-list matching
    const flat = [];
    for (let li = 0; li < dedupedLists.length; li++) {
      for (const item of dedupedLists[li]) {
        if (item) flat.push({ item, listIdx: li });
      }
    }

    // Build buckets: blocking key -> list of indices
    const buckets = new Map();
    for (let i = 0; i < flat.length; i++) {
      const keys = MovieSourceManager._bucketKeys(flat[i].item);
      for (const k of keys) {
        let arr = buckets.get(k);
        if (!arr) { arr = []; buckets.set(k, arr); }
        arr.push(i);
      }
    }

    const used = new Array(flat.length).fill(false);
    const result = [];

    for (let ai = 0; ai < flat.length; ai++) {
      if (used[ai]) continue;
      used[ai] = true;

      const { item: anchor } = flat[ai];
      const matchGroup = [anchor];
      const sources = anchor._source ? [anchor._source] : [];
      const matchedLists = new Set([flat[ai].listIdx]);

      // Gather candidate indices via bucket lookup (small set, O(1) per key)
      const anchorKeys = MovieSourceManager._bucketKeys(anchor);
      const candidateSet = new Set();
      for (const k of anchorKeys) {
        const arr = buckets.get(k);
        if (!arr) continue;
        for (const ci of arr) {
          if (ci > ai && !used[ci]) candidateSet.add(ci);
        }
      }

      for (const bi of candidateSet) {
        if (used[bi]) continue;
        const { item: candidate, listIdx: cListIdx } = flat[bi];
        if (matchedLists.has(cListIdx)) continue;
        if (MovieSourceManager.isSameMovie(anchor, candidate)) {
          used[bi] = true;
          matchedLists.add(cListIdx);
          matchGroup.push(candidate);
          if (candidate._source && !sources.includes(candidate._source)) {
            sources.push(candidate._source);
          }
        }
      }

      const primary = MovieSourceManager.pickPrimary(matchGroup);
      const src = primary._source || anchor._source || "unknown";
      result.push({
        ...primary,
        slug: anchor.slug || primary.slug, // prefer first-seen slug for URL consistency
        _source: src,
        _sources: sources.length > 0 ? sources : [src],
      });
    }

    return result;
  }

  // ─── Episode merge ──────────────────────────────────────────────────────────

  /**
   * Extract episode number from slug/name.
   */
  static getEpNumber(ep) {
    const s = (ep.slug || ep.name || "").toLowerCase();
    if (/^(ova|sp|special|trailer|extra|nc|op|ed)/i.test(s.replace(/[^a-z]/g, ""))) {
      return null;
    }
    const m = s.match(/(\d+)/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return n >= 0 && n <= 2000 ? n : null;
  }

  /**
   * Label a server name with provider info.
   */
  static labelServer(name, providerLabel, serverIndex) {
    let base = (name || "Server").trim();
    const parenMatch = base.match(/\(([^)]+)\)\s*$/);
    if (parenMatch) {
      base = parenMatch[1].trim();
    } else {
      base = base
        .replace(/^#[^(]+/g, "")
        .replace(/^#\S+\s*/g, "")
        .replace(/\s*#\d+\s*$/g, "")
        .replace(/\s*-?\s*server\s*\d*/i, "")
        .trim();
    }
    if (!base) base = "Server";
    return `${base} - Server ${serverIndex}`;
  }

  /**
   * Merge episodes from N providers.
   * Each provider's episodes are in standard format: [{server_name, server_data: [{name, slug, link_embed, link_m3u8}]}]
   *
   * Output: [{slug, name, servers: [{serverName, link_embed, link_m3u8}]}]
   */
  static mergeEpisodes(providerEpisodes) {
    // providerEpisodes = [{episodes: [...], provider: {name, label}}, ...]
    const epMap = new Map(); // key = ep number (int) or slug

    for (let pIdx = 0; pIdx < providerEpisodes.length; pIdx++) {
      const { episodes, provider } = providerEpisodes[pIdx];
      const serverIndex = pIdx + 1;

      for (const server of episodes || []) {
        const svrName = MovieSourceManager.labelServer(
          server.server_name,
          provider.label,
          serverIndex,
        );

        for (const ep of server.server_data || []) {
          if (!ep.link_embed && !ep.link_m3u8) continue;

          const num = MovieSourceManager.getEpNumber(ep);
          const key = num !== null ? num : (ep.slug || ep.name || "unknown").toLowerCase();

          if (!epMap.has(key)) {
            epMap.set(key, {
              slug: (ep.slug || ep.name || "").toLowerCase(),
              name: ep.name,
              servers: [],
            });
          }
          epMap.get(key).servers.push({
            serverName: svrName,
            _providerName: provider.name,
            link_embed: ep.link_embed,
            link_m3u8: ep.link_m3u8,
          });
        }
      }
    }

    // Sort: numeric episodes first, specials last
    const sorted = Array.from(epMap.entries()).sort((a, b) => {
      const na = typeof a[0] === "number" ? a[0] : Infinity;
      const nb = typeof b[0] === "number" ? b[0] : Infinity;
      return na - nb;
    });

    return sorted.map(([, ep]) => ep);
  }

  // ─── Cross-search matching (generalized searchAndMatch) ─────────────────────

  /**
   * Given a movie from one provider, search other providers to find the same movie.
   * Returns array of {provider, movie} matches.
   */
  async crossSearchMatch(sourceMovie, targetProviders) {
    const keywords = [sourceMovie.name, sourceMovie.origin_name]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    const matches = [];

    for (const provider of targetProviders) {
      try {
        const results = await Promise.allSettled(
          keywords.map((kw) =>
            provider.searchMovies(kw, 1, 20).catch(() => ({ items: [] })),
          ),
        );

        const seen = new Set();
        for (const r of results) {
          if (r.status !== "fulfilled") continue;
          for (const item of r.value?.items || []) {
            if (seen.has(item.slug)) continue;
            seen.add(item.slug);
            if (MovieSourceManager.isSameMovie(sourceMovie, item)) {
              matches.push({ provider, movie: item });
              break; // one match per provider
            }
          }
        }
      } catch (e) {
        // ignore — this provider just won't have a match
      }
    }

    return matches;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Fetch new movies from all providers, merged.
   */
  async fetchAllNewMovies(page = 1) {
    const results = await this._fetchAll("getNewMovies", page);
    if (results.length === 0) {
      return { items: [], pagination: { totalItems: maxTotal, providerTotalItems: maxTotal, totalPages: Math.ceil(maxTotal / limit), currentPage: page },
    };
  }

  /**
   * Get by category from all providers, merged.
   */
  async getByCategory(slug, page = 1, filters = {}) {
    const results = await this._fetchAll("getByCategory", slug, page, filters);
    return this._mergeListResults(results, page, filters);
  }

  /**
   * Get by country from all providers, merged.
   */
  async getByCountry(slug, page = 1, filters = {}) {
    const results = await this._fetchAll("getByCountry", slug, page, filters);
    return this._mergeListResults(results, page, filters);
  }

  /**
   * Get by type from all providers, merged.
   */
  async getByType(type, page = 1, filters = {}) {
    const results = await this._fetchAll("getByType", type, page, filters);
    return this._mergeListResults(results, page, filters);
  }

  /**
   * Internal helper to merge list results from _fetchAll.
   */
  _mergeListResults(results, page, filters = {}) {
    if (results.length === 0) {
      return {
        items: [],
        pagination: { totalItems: 0, totalPages: 0, currentPage: 1 },
        titlePage: "",
      };
    }

    const lists = results.map((r) => r.data?.items || []);

    // Fast path: only 1 provider returned data — skip O(n²) dedupe/merge entirely.
    // Dedupe/merge is only needed when cross-provider dedup matters.
    const nonEmpty = lists.filter((l) => l.length > 0);
    if (nonEmpty.length === 1) {
      let items = nonEmpty[0];
      if (filters.year) items = items.filter((item) => String(item.year) === String(filters.year));
      if (filters.category) {
        items = items.filter((item) => (item.category || []).map((c) => c.slug).includes(filters.category));
      }
      if (filters.country) {
        items = items.filter((item) => (item.country || []).map((c) => c.slug).includes(filters.country));
      }

      const r = results.find((r) => r.data?.pagination) || results[0];
      const p = r.data?.pagination || { totalItems: 0, totalPages: 0, currentPage: page };
      if (filters.year && p.totalItems > 0) {
        p = { ...p, totalItems: items.length, totalPages: Math.ceil(items.length / 21) };
      }
      return {
        items,
        pagination: p,
        titlePage: results.find((r) => r.data?.titlePage)?.data?.titlePage || "",
      };
    }

    // Multi-provider: apply ALL filters BEFORE merge to reduce O(n²) workload.
    // This is push-down filtering — the sooner we reduce data, the less work the merge does.
    let filteredLists = lists;
    if (filters.year || filters.category || filters.country) {
      filteredLists = lists.map((items) => {
        let filtered = items;
        if (filters.year) filtered = filtered.filter((item) => String(item.year) === String(filters.year));
        if (filters.category) {
          filtered = filtered.filter((item) => (item.category || []).map((c) => c.slug).includes(filters.category));
        }
        if (filters.country) {
          filtered = filtered.filter((item) => (item.country || []).map((c) => c.slug).includes(filters.country));
        }
        return filtered;
      });
    }

    // Merge and deduplicate FIRST
    const deduplicatedItems = MovieSourceManager.mergeMovieLists(...filteredLists);

    // Calculate pagination based on DEDUPLICATED items (not pre-merge totals)
    const limit = 21; // items per page
    const totalItems = deduplicatedItems.length;
    const totalPages = Math.ceil(totalItems / limit);

    let maxTotal = 0, maxPages = 0, titlePage = "";
    let minTotal = Infinity, minPages = Infinity;
    for (const r of results) {
      const p = r.data?.pagination;
      if (p) {
        if (p.totalItems > maxTotal) maxTotal = p.totalItems;
        if (p.totalPages > maxPages) maxPages = p.totalPages;
        if (p.totalItems > 0 && p.totalItems < minTotal) minTotal = p.totalItems;
        if (p.totalPages > 0 && p.totalPages < minPages) minPages = p.totalPages;
      }
      if (!titlePage && r.data?.titlePage) titlePage = r.data.titlePage;
    }

    const hasFilters = !!(filters.year || filters.category || filters.country);
    if (hasFilters && minPages < Infinity) {
      maxTotal = minTotal;
      maxPages = minPages;
    }

    return {
      items: deduplicatedItems,
      pagination: { totalItems, providerTotalItems: totalItems, totalPages, currentPage: page }, titlePage,
    };
  }
}

module.exports = MovieSourceManager;
