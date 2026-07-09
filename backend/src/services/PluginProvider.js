const vm = require("vm");
const xpath = require("xpath");
const { DOMParser } = require("@xmldom/xmldom");
const BaseApiProvider = require("./BaseApiProvider");
const logger = require("../utils/logger");

// ─── XPath Helpers ──────────────────────────────────────────────────────────

function parseHtmlToDoc(html) {
  const doc = new DOMParser({
    onError: () => {}
  }).parseFromString(html, "text/html");
  
  function clearNamespace(node) {
    if (node.namespaceURI) {
      node.namespaceURI = null;
    }
    if (node.childNodes) {
      for (let i = 0; i < node.childNodes.length; i++) {
        clearNamespace(node.childNodes[i]);
      }
    }
  }
  clearNamespace(doc.documentElement);
  return doc;
}

function evaluateXpath(node, query, returnType = "string") {
  try {
    const result = xpath.select(query, node);
    if (returnType === "nodes") {
      return result || [];
    }
    if (Array.isArray(result) && result.length > 0) {
      const first = result[0];
      if (first.nodeType === 2) { // Attribute node
        return (first.nodeValue || "").trim();
      }
      if (first.nodeType === 1) { // Element node
        return (first.textContent || "").trim();
      }
      return (first.nodeValue || first.textContent || "").trim();
    }
    return "";
  } catch (e) {
    return returnType === "nodes" ? [] : "";
  }
}

function extractValue(parentNode, query, defaultAttr = null) {
  if (!query) return "";
  try {
    const nodes = xpath.select(query, parentNode);
    if (!nodes || nodes.length === 0) return "";
    const node = nodes[0];
    
    // If it's an attribute node
    if (node.nodeType === 2) {
      return (node.nodeValue || "").trim();
    }
    // If it's an element node and we want an attribute
    if (node.nodeType === 1 && defaultAttr) {
      const val = node.getAttribute(defaultAttr);
      if (val !== undefined && val !== null) {
        return val.trim();
      }
    }
    // Default to text content
    return (node.textContent || "").trim();
  } catch (e) {
    return "";
  }
}

// ─── Class PluginProvider ───────────────────────────────────────────────────

class PluginProvider extends BaseApiProvider {
  /**
   * @param {object} pluginConfig - config từ file JSON (id, name, scriptUrl, iconUrl)
   */
  constructor(pluginConfig) {
    super({
      name: pluginConfig.id,
      label: pluginConfig.name,
      baseUrl: "", // Will be defined by plugin
      timeout: 10000,
      cacheTTL: 300,
    });
    this.scriptUrl = pluginConfig.scriptUrl;
    this.iconUrl = pluginConfig.iconUrl;
    this.isStreamingOnly = pluginConfig.isStreamingOnly !== undefined ? pluginConfig.isStreamingOnly : true; // Mặc định chỉ làm nguồn stream phụ
    this.sandbox = null;
    this.isLoaded = false;
    this.isDeclarative = false;
    this.rule = null;
  }

  _toSafeSlug(str) {
    if (!str) return "";
    let clean = str;
    const base = this.baseUrl || (this.rule && this.rule.baseURL) || "";
    if (str.startsWith("http") && base) {
      try {
        const urlObj = new URL(str);
        const baseObj = new URL(base);
        if (urlObj.host === baseObj.host) {
          clean = urlObj.pathname + urlObj.search;
        }
      } catch (e) {}
    }
    // Step 1: Replace path separators / and | with a placeholder
    const SEPARATOR = "\x00";
    clean = clean.replace(/[\/|]/g, SEPARATOR);
    // Step 2: Normalize — lowercase, strip non-alphanumeric except hyphen and placeholder
    clean = clean.toLowerCase()
      .replace(/[^a-z0-9\x00-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    // Step 3: Restore placeholder as double-dash, trim edges
    clean = clean.replace(/\x00+/g, "--").replace(/^-+|-+$/g, "");
    return clean;
  }

  _fromSafeSlug(slug) {
    if (!slug) return "";
    if (slug.startsWith("http")) return slug;
    
    const base = this.baseUrl || (this.rule && this.rule.baseURL) || "";
    const relPath = slug.replace(/--/g, "/");
    if (base) {
      try {
        return new URL(relPath, base).href;
      } catch (e) {}
    }
    return relPath;
  }

  async _loadScript() {
    if (this.isLoaded) return true;
    if (this._loadPromise) return this._loadPromise;

    this._loadPromise = (async () => {
      try {
        let scriptCode = "";
        if (this.scriptUrl.startsWith("http")) {
          const res = await fetch(this.scriptUrl);
          if (!res.ok) throw new Error(`Failed to fetch script: ${res.status}`);
          scriptCode = await res.text();
        } else {
          const fs = require("fs");
          const path = require("path");
          // Support loading from local file
          scriptCode = fs.readFileSync(path.resolve(__dirname, "../../..", this.scriptUrl), "utf-8");
        }

        // Kiểm tra xem có phải là JSON/Declarative Rules không
        if (this.scriptUrl.endsWith(".json") || (scriptCode.trim().startsWith("{") && scriptCode.trim().endsWith("}"))) {
          this.rule = JSON.parse(scriptCode);
          this.isDeclarative = true;
          this.baseUrl = this.rule.baseURL || this.baseUrl;
          this.isLoaded = true;
          logger.info(this.name, `Successfully loaded declarative JSON rules from ${this.scriptUrl}`);
          return true;
        }
        
        // Khởi tạo Sandbox an toàn cho Legacy JS Plugins
        this.sandbox = {
          console: console,
          JSON: JSON,
          encodeURIComponent: encodeURIComponent,
          parseInt: parseInt,
          parseFloat: parseFloat,
          Buffer: Buffer,
          atob: (str) => Buffer.from(str, 'base64').toString('binary'),
          btoa: (str) => Buffer.from(str, 'binary').toString('base64')
        };
        vm.createContext(this.sandbox);
        vm.runInContext(scriptCode, this.sandbox);
        
        this.isLoaded = true;
        logger.info(this.name, `Successfully loaded plugin script from ${this.scriptUrl}`);
        return true;
      } catch (e) {
        logger.error(this.name, `Error loading plugin script`, e);
        return false;
      } finally {
        this._loadPromise = null;
      }
    })();
    return this._loadPromise;
  }

  // --- Implement BaseApiProvider abstract methods (Not used directly by PluginProvider but required) ---
  buildEndpointUrl() { return ""; }
  normalizeListItem() { return {}; }
  normalizeDetail() { return null; }
  parseListResponse() { return null; }

  // Helper method to fetch lists
  async _fetchList(slug, page) {
    await this._loadScript();
    if (!this.isLoaded) {
      return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 } };
    }

    if (this.isDeclarative) {
      try {
        let url = this.rule.baseURL;
        const isHomepage = !slug || slug === "phim-moi-cap-nhat";
        
        if (this.rule.listURL && !isHomepage) {
          url = this.rule.listURL.replace("@slug", slug).replace("@page", page);
        } else if (page > 1 && this.rule.listURL) {
          // Homepage page 2+: use listURL with empty slug removed
          url = this.rule.listURL.replace("@slug/", "").replace("@slug", "").replace("@page", page);
        } else if (page > 1) {
          return { items: [], pagination: { totalItems: 0, totalPages: 1, currentPage: page } };
        }

        const cacheKey = `${this.name}:list:${slug}:${page}`;
        const html = await this.apiCall(url, cacheKey);
        if (!html) return { items: [] };

        const doc = parseHtmlToDoc(html);
        const itemNodes = evaluateXpath(doc, this.rule.searchList, "nodes");

        const items = itemNodes.map((itemNode) => {
          const title = extractValue(itemNode, this.rule.searchName);
          const rawHref = extractValue(itemNode, this.rule.searchResult, "href");
          
          if (!title || !rawHref) return null;

          let id = rawHref;
          if (!id.startsWith("http")) {
            id = new URL(id, this.rule.baseURL).href;
          }

          let posterUrl = "";
          if (this.rule.searchThumb) {
            posterUrl = extractValue(itemNode, this.rule.searchThumb, "src") || 
                        extractValue(itemNode, this.rule.searchThumb, "data-src");
          }
          if (!posterUrl) {
            const imgNodes = xpath.select(".//img", itemNode);
            if (imgNodes && imgNodes.length > 0) {
              posterUrl = imgNodes[0].getAttribute("src") || imgNodes[0].getAttribute("data-src") || "";
            }
          }
          if (posterUrl && !posterUrl.startsWith("http")) {
            posterUrl = new URL(posterUrl, this.rule.baseURL).href;
          }

          // Extract episode/quality badges if defined
          let episodeBadge = "Full";
          if (this.rule.searchEpisode) {
            episodeBadge = extractValue(itemNode, this.rule.searchEpisode) || "Full";
          }
          let qualityBadge = "HD";
          if (this.rule.searchQuality) {
            qualityBadge = extractValue(itemNode, this.rule.searchQuality) || "HD";
          }

          return {
            _id: id,
            slug: this._toSafeSlug(rawHref),
            name: title,
            origin_name: title,
            poster_url: this.normalizeImageUrl(posterUrl),
            thumb_url: this.normalizeImageUrl(posterUrl),
            year: 0,
            quality: qualityBadge,
            episode_current: episodeBadge,
            type: "unknown"
          };
        }).filter(Boolean);

        return {
          items,
          pagination: {
            totalItems: items.length,
            totalPages: 1,
            currentPage: page
          },
          titlePage: this.rule.name || "Phim Mới"
        };
      } catch (e) {
        logger.error(this.name, `List error for ${slug}`, e);
        return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 } };
      }
    }

    if (!this.sandbox.getUrlList || !this.sandbox.parseListResponse) {
      return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 } };
    }
    try {
      const url = this.sandbox.getUrlList(slug, JSON.stringify({ page }));
      const cacheKey = `${this.name}:list:${slug}:${page}`;
      const html = await this.apiCall(url, cacheKey);
      if (!html) return { items: [] };

      const resultJson = this.sandbox.parseListResponse(html);
      const parsed = JSON.parse(resultJson);

      const items = (parsed.items || []).map(item => ({
        _id: item.id,
        slug: item.id,
        name: item.title,
        origin_name: item.title,
        poster_url: this.normalizeImageUrl(item.posterUrl),
        thumb_url: this.normalizeImageUrl(item.backdropUrl || item.posterUrl),
        year: item.year || 0,
        quality: item.quality || "HD",
        episode_current: item.episode_current || "Full",
        type: "unknown"
      }));

      return { items, pagination: parsed.pagination, titlePage: parsed.titlePage || "Phim Mới" };
    } catch (e) {
      logger.error(this.name, `List error for ${slug}`, e);
      return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 } };
    }
  }

  // --- Override list fetchers ---
  async getNewMovies(page = 1) {
    return this._fetchList('phim-moi-cap-nhat', page);
  }

  async getByType(type, page = 1) {
    return this._fetchList(type, page);
  }

  async getByCategory(slug, page = 1) {
    return this._fetchList(slug, page);
  }

  async getByCountry(slug, page = 1) {
    return this._fetchList(slug, page);
  }

  // --- Override Search ---
  async searchMovies(keyword, page = 1, limit = 24) {
    await this._loadScript();
    if (!this.isLoaded) {
      return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 } };
    }

    if (this.isDeclarative) {
      try {
        let url;
        if (page > 1 && this.rule.searchURLPaged) {
          url = this.rule.searchURLPaged.replace("@keyword", encodeURIComponent(keyword)).replace("@page", page);
        } else {
          url = this.rule.searchURL.replace("@keyword", encodeURIComponent(keyword));
          if (url.includes("@page")) url = url.replace("@page", page);
        }
        const cacheKey = `${this.name}:search:${keyword}:${page}`;
        const html = await this.apiCall(url, cacheKey);
        if (!html) return { items: [] };

        const doc = parseHtmlToDoc(html);
        const itemNodes = evaluateXpath(doc, this.rule.searchList, "nodes");

        const items = itemNodes.map((itemNode) => {
          const title = extractValue(itemNode, this.rule.searchName);
          const rawHref = extractValue(itemNode, this.rule.searchResult, "href");
          
          if (!title || !rawHref) return null;

          let id = rawHref;
          if (!id.startsWith("http")) {
            id = new URL(id, this.rule.baseURL).href;
          }

          let posterUrl = "";
          if (this.rule.searchThumb) {
            posterUrl = extractValue(itemNode, this.rule.searchThumb, "src") || 
                        extractValue(itemNode, this.rule.searchThumb, "data-src");
          }
          if (!posterUrl) {
            const imgNodes = xpath.select(".//img", itemNode);
            if (imgNodes && imgNodes.length > 0) {
              posterUrl = imgNodes[0].getAttribute("src") || imgNodes[0].getAttribute("data-src") || "";
            }
          }
          if (posterUrl && !posterUrl.startsWith("http")) {
            posterUrl = new URL(posterUrl, this.rule.baseURL).href;
          }

          let episodeBadge = "Full";
          if (this.rule.searchEpisode) {
            episodeBadge = extractValue(itemNode, this.rule.searchEpisode) || "Full";
          }
          let qualityBadge = "HD";
          if (this.rule.searchQuality) {
            qualityBadge = extractValue(itemNode, this.rule.searchQuality) || "HD";
          }

          return {
            _id: id,
            slug: this._toSafeSlug(rawHref),
            name: title,
            origin_name: title,
            poster_url: this.normalizeImageUrl(posterUrl),
            thumb_url: this.normalizeImageUrl(posterUrl),
            year: 0,
            quality: qualityBadge,
            episode_current: episodeBadge,
            type: "unknown"
          };
        }).filter(Boolean);

        return {
          items,
          pagination: {
            totalItems: items.length,
            totalPages: 1,
            currentPage: page
          }
        };
      } catch (e) {
        logger.error(this.name, `Search error for ${keyword}`, e);
        return { items: [] };
      }
    }

    if (!this.sandbox.getUrlSearch || !this.sandbox.parseSearchResponse) {
      return { items: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1 } };
    }

    try {
      const url = this.sandbox.getUrlSearch(keyword, JSON.stringify({ page }));
      const cacheKey = `${this.name}:search:${keyword}:${page}`;
      
      const html = await this.apiCall(url, cacheKey);
      if (!html) return { items: [] };

      const resultJson = this.sandbox.parseSearchResponse(html);
      const parsed = JSON.parse(resultJson);

      const items = (parsed.items || []).map(item => ({
        _id: item.id,
        slug: this._toSafeSlug(item.id),
        name: item.title,
        origin_name: item.title,
        poster_url: this.normalizeImageUrl(item.posterUrl),
        thumb_url: this.normalizeImageUrl(item.backdropUrl || item.posterUrl),
        year: item.year || 0,
        quality: item.quality || "HD",
        episode_current: item.episode_current || "Full",
        type: "unknown"
      }));

      return { items, pagination: parsed.pagination };
    } catch (e) {
      logger.error(this.name, `Search error for ${keyword}`, e);
      return { items: [] };
    }
  }

  // --- Override GetDetail ---
  async getMovieDetail(slug) {
    await this._loadScript();
    if (!this.isLoaded) return null;

    if (this.isDeclarative) {
      try {
        let url = slug;
        if (!url.startsWith("http")) {
          url = this._fromSafeSlug(slug);
        }

        const cacheKey = `${this.name}:detail:${slug}`;
        const html = await this.apiCall(url, cacheKey);
        if (!html) return null;

        const doc = parseHtmlToDoc(html);

        let title = "";
        if (this.rule.detailTitle) {
          title = extractValue(doc, this.rule.detailTitle);
        }
        if (!title) {
          title = extractValue(doc, "//meta[@property='og:title']/@content") || 
                  extractValue(doc, "//h1") || 
                  extractValue(doc, "//h2") || 
                  "Không có tiêu đề";
        }

        let description = "";
        if (this.rule.detailDesc) {
          description = extractValue(doc, this.rule.detailDesc);
        }
        if (!description) {
          description = extractValue(doc, "//meta[@property='og:description']/@content") || 
                        extractValue(doc, "//meta[@name='description']/@content") || 
                        "";
        }

        let posterUrl = "";
        if (this.rule.detailThumb) {
          posterUrl = extractValue(doc, this.rule.detailThumb, "src") || 
                      extractValue(doc, this.rule.detailThumb, "data-src");
        }
        if (!posterUrl) {
          posterUrl = extractValue(doc, "//meta[@property='og:image']/@content");
        }
        if (posterUrl && !posterUrl.startsWith("http")) {
          posterUrl = new URL(posterUrl, this.rule.baseURL).href;
        }

        // Parse episode list
        let epNodes = evaluateXpath(doc, this.rule.chapterResult, "nodes");

        // Check for multi-server AJAX pattern (serverList + playerAjaxURL)
        let serverButtons = [];
        if (this.rule.serverList) {
          serverButtons = evaluateXpath(doc, this.rule.serverList, "nodes");
        }

        // If serverList defined but not found on detail page, try fetching watch page
        if (this.rule.serverList && serverButtons.length === 0 && this.rule.detailPlayBtn) {
          let watchUrl = extractValue(doc, this.rule.detailPlayBtn);
          if (watchUrl && !watchUrl.startsWith("http")) {
            watchUrl = new URL(watchUrl, this.rule.baseURL).href;
          }
          if (watchUrl) {
            const watchHtml = await this.apiCall(watchUrl, `${this.name}:watch:${slug}`);
            if (watchHtml) {
              const watchDoc = parseHtmlToDoc(watchHtml);
              serverButtons = evaluateXpath(watchDoc, this.rule.serverList, "nodes");
              // Also re-parse episodes from watch page (may have 'active' class etc.)
              const watchEpNodes = evaluateXpath(watchDoc, this.rule.chapterResult, "nodes");
              if (watchEpNodes.length > 0) epNodes = watchEpNodes;
            }
          }
        }

        let episodes = [];
        if (serverButtons.length > 0 && this.rule.playerAjaxURL) {
          // Multi-server: create one server group per button
          for (const svNode of serverButtons) {
            const svName = (svNode.textContent || "").trim() || "Server";
            const svType = svNode.getAttribute(this.rule.serverTypeAttr || "data-type") || "";
            const serverData = epNodes.map((epNode, epIdx) => {
              const epName = (epNode.textContent || "").trim() || `Tập ${epIdx + 1}`;
              const postId = epNode.getAttribute(this.rule.playerAjaxPostIdAttr || "data-post-id") || "";
              const chapterSt = epNode.getAttribute(this.rule.playerAjaxChapterAttr || "data-ep") || "";
              // Encode as postId|chapterSt|serverType for extractStream
              const streamId = `${postId}|${chapterSt}|${svType}`;
              return {
                name: epName.replace("Tập ", "").trim(),
                slug: this._toSafeSlug(streamId),
                link_embed: "",
                link_m3u8: `/api/proxy/plugins/stream/${this.name}/${encodeURIComponent(streamId)}/playlist.m3u8`
              };
            });
            if (serverData.length > 0) {
              episodes.push({ server_name: svName, server_data: serverData });
            }
          }
        } else {
          // Classic pattern: chapterRoads contains server groups
          const roadNodes = this.rule.chapterRoads ? evaluateXpath(doc, this.rule.chapterRoads, "nodes") : [];
          if (roadNodes.length > 0) {
            episodes = roadNodes.map((roadNode, idx) => {
              let serverName = `Server ${idx + 1}`;
              const h3Nodes = xpath.select(".//h3", roadNode);
              if (h3Nodes && h3Nodes.length > 0) {
                serverName = (h3Nodes[0].textContent || "").trim();
              }
              const roadEpNodes = evaluateXpath(roadNode, this.rule.chapterResult, "nodes");
              return {
                server_name: serverName,
                server_data: roadEpNodes.map((epNode, epIdx) => {
                  const epName = (epNode.textContent || "").trim() || `Tập ${epIdx + 1}`;
                  const epUrl = epNode.getAttribute("href") || "";
                  let resolvedEpUrl = epUrl;
                  if (!resolvedEpUrl.startsWith("http")) {
                    resolvedEpUrl = new URL(resolvedEpUrl, this.rule.baseURL).href;
                  }
                  return {
                    name: epName.replace("Tập ", "").trim(),
                    slug: this._toSafeSlug(resolvedEpUrl),
                    link_embed: "",
                    link_m3u8: `/api/proxy/plugins/stream/${this.name}/${encodeURIComponent(resolvedEpUrl)}/playlist.m3u8`
                  };
                })
              };
            }).filter(s => s.server_data.length > 0);
          } else if (epNodes.length > 0) {
            // Flat episode list — single server
            episodes = [{
              server_name: "Server mặc định",
              server_data: epNodes.map((epNode, epIdx) => {
                const epName = (epNode.textContent || "").trim() || `Tập ${epIdx + 1}`;
                const epUrl = epNode.getAttribute("href") || "";
                let resolvedEpUrl = epUrl;
                if (!resolvedEpUrl.startsWith("http")) {
                  resolvedEpUrl = new URL(resolvedEpUrl, this.rule.baseURL).href;
                }
                return {
                  name: epName.replace("Tập ", "").trim(),
                  slug: this._toSafeSlug(resolvedEpUrl),
                  link_embed: "",
                  link_m3u8: `/api/proxy/plugins/stream/${this.name}/${encodeURIComponent(resolvedEpUrl)}/playlist.m3u8`
                };
              })
            }];
          }
        }

        // Calculate episode count from parsed episodes
        let totalEpCount = 0;
        for (const server of episodes) {
          const count = (server.server_data || []).length;
          if (count > totalEpCount) totalEpCount = count;
        }
        const episodeCurrent = totalEpCount > 0 ? `Tập ${totalEpCount}` : "Tập mới";

        return {
          _id: slug,
          slug: slug,
          name: title,
          origin_name: title,
          content: description,
          type: "unknown",
          status: "ongoing",
          poster_url: this.normalizeImageUrl(posterUrl),
          thumb_url: this.normalizeImageUrl(posterUrl),
          year: 0,
          episode_current: episodeCurrent,
          episode_total: totalEpCount > 0 ? String(totalEpCount) : "",
          quality: "HD",
          lang: "Vietsub",
          category: [{ name: "Phim" }],
          episodes: episodes,
          _source: this.name
        };
      } catch (e) {
        logger.error(this.name, `Detail error for ${slug}`, e);
        return null;
      }
    }

    if (!this.sandbox.getUrlDetail || !this.sandbox.parseMovieDetail) return null;

    try {
      const url = this.sandbox.getUrlDetail(this._fromSafeSlug(slug));
      const cacheKey = `${this.name}:detail:${slug}`;
      const html = await this.apiCall(url, cacheKey);
      if (!html) return null;

      const resultJson = this.sandbox.parseMovieDetail(html);
      const data = JSON.parse(resultJson);
      if (!data || !data.title) return null;

      if (data.playUrl && (!data.servers || data.servers.length === 0) && this.sandbox.parseMovieEpisodes) {
        const watchHtml = await this.apiCall(data.playUrl, `${this.name}:watch:${slug}`);
        if (watchHtml) {
          const epsJson = this.sandbox.parseMovieEpisodes(watchHtml, data.playUrl);
          data.servers = JSON.parse(epsJson);
        }
      }

      const episodes = (data.servers || []).map(server => {
        return {
          server_name: server.name,
          server_data: (server.episodes || []).map(ep => ({
            name: ep.name.replace("Tập ", ""),
            slug: this._toSafeSlug(ep.slug),
            link_embed: "",
            link_m3u8: `/api/proxy/plugins/stream/${this.name}/${encodeURIComponent(ep.id)}/playlist.m3u8`
          }))
        };
      });

      return {
        _id: slug,
        slug: slug,
        name: data.title,
        origin_name: data.title,
        content: data.description,
        type: "unknown",
        status: (data.status || "ongoing").toLowerCase().includes("hoàn") ? "completed" : "ongoing",
        poster_url: this.normalizeImageUrl(data.posterUrl),
        thumb_url: this.normalizeImageUrl(data.backdropUrl || data.posterUrl),
        year: data.year || 0,
        episode_current: data.duration || "Full",
        quality: data.quality || "HD",
        lang: data.lang || "Vietsub",
        category: (data.category || "").split(",").map(c => ({ name: c.trim() })),
        episodes: episodes,
        _source: this.name
      };
    } catch (e) {
      logger.error(this.name, `Detail error for ${slug}`, e);
      return null;
    }
  }

  // Helper method for the stream endpoint
  async extractStream(id) {
    await this._loadScript();
    if (!this.isLoaded) return null;

    if (this.isDeclarative) {
      try {
        let html;

        // Check for AJAX player pattern: id = "postId|chapterSt|serverType"
        if (this.rule.playerAjaxURL && id.includes("|")) {
          const parts = id.split("|");
          const postId = parts[0];
          const chapterSt = parts[1];
          const serverType = parts[2] || "";
          const params = new URLSearchParams();
          const ajaxParams = this.rule.playerAjaxParams || {};
          for (const [key, val] of Object.entries(ajaxParams)) {
            params.set(key, val
              .replace("@postId", postId)
              .replace("@chapterSt", chapterSt)
              .replace("@serverType", serverType)
            );
          }
          const ajaxUrl = `${this.rule.playerAjaxURL}?${params.toString()}`;
          const cacheKey = `${this.name}:ajax:${id}`;
          html = await this.apiCall(ajaxUrl, cacheKey);
        } else {
          html = await this.apiCall(id, `${this.name}:stream:${id}`);
        }
        if (!html) return null;

        // 1. Try streamSelector
        if (this.rule.streamSelector) {
          const doc = parseHtmlToDoc(html);
          const resolved = evaluateXpath(doc, this.rule.streamSelector);
          if (resolved) {
            return { url: resolved, headers: { "Referer": this.rule.baseURL } };
          }
        }

        // 2. Try streamRegex
        if (this.rule.streamRegex) {
          const match = html.match(new RegExp(this.rule.streamRegex, "i"));
          if (match && match[1]) {
            return { url: match[1], headers: { "Referer": this.rule.baseURL } };
          }
        }

        // 3. Fallback: Generic .m3u8 / .mp4 URL search
        const streamMatch = html.match(/(https?:\/\/[^"']+\.(?:m3u8|mp4)(?:\?[^"']*)?)/i);
        if (streamMatch) {
          return { url: streamMatch[1], headers: { "Referer": this.rule.baseURL } };
        }

        // 4. Try searching inside iframe
        const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
        if (iframeMatch) {
          const iframeUrl = iframeMatch[1].startsWith("http") ? iframeMatch[1] : new URL(iframeMatch[1], this.rule.baseURL).href;
          const iframeHtml = await this.apiCall(iframeUrl, `${this.name}:iframe:${iframeUrl}`);
          if (iframeHtml) {
            const innerMatch = iframeHtml.match(/(https?:\/\/[^"']+\.(?:m3u8|mp4)(?:\?[^"']*)?)/i);
            if (innerMatch) {
              return { url: innerMatch[1], headers: { "Referer": iframeUrl } };
            }
          }
        }

        return null;
      } catch (e) {
        logger.error(this.name, `Extract stream error for ${id}`, e);
        return null;
      }
    }

    if (!this.sandbox.getUrlDetail || !this.sandbox.parseDetailResponse) return null;
    
    try {
      const url = this.sandbox.getUrlDetail(id);
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const html = await res.text();
      const resultJson = this.sandbox.parseDetailResponse(html, url);
      return JSON.parse(resultJson); // { url, headers }
    } catch (e) {
      logger.error(this.name, `Extract stream error for ${id}`, e);
      return null;
    }
  }

  // Override apiCall because it expects JSON, but plugins return HTML
  async apiCall(url, cacheKey, retries = 2) {
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
          },
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const html = await res.text();
        this.setCache(cacheKey, html);
        return html;
      } catch (e) {
        if (attempt === retries) return null;
      }
    }
  }
}

module.exports = PluginProvider;
