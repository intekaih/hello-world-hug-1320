const { sourceManager } = require("../config/providers");
const logger = require("../utils/logger");
const { cache } = require("../core/cache");
const suggestCache = cache.suggest;

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

exports.getSearch = async (req, res) => {
  try {
    const keyword = req.query.q || "";
    const page = parseInt(req.query.page) || 1;
    const filterCategory = req.query.category || "";
    const filterCountry = req.query.country || "";

    let results = [];
    let totalResults = 0;
    let totalPages = 0;

    const PAGE_SIZE = 24;
    if (keyword) {
      const data = await sourceManager.searchAll(keyword, page);
      let items = data.items || [];
      totalResults = data.pagination?.totalItems || 0;

      const hasFilters = !!(filterCategory || filterCountry);

      if (filterCategory) {
        items = items.filter(
          (m) => m.category && m.category.some((c) => c.slug === filterCategory),
        );
      }
      if (filterCountry) {
        items = items.filter(
          (m) => m.country && m.country.some((c) => c.slug === filterCountry),
        );
      }

      results = sortTrailersToEnd(items.slice(0, PAGE_SIZE));

      if (hasFilters) {
        totalResults = results.length;
        totalPages = results.length > 0 ? page + 1 : page;
      } else {
        totalPages = Math.ceil(totalResults / PAGE_SIZE);
      }
    }

    let searchJsonLd = "";
    if (keyword && results.length > 0) {
      const searchJsonLdObj = {
        "@context": "https://schema.org",
        "@type": "SearchResultsPage",
        name: `Kết quả tìm kiếm "${keyword}" trên movieCC`,
        url: `${res.locals.siteUrl || ""}/tim-kiem?q=${encodeURIComponent(keyword)}`,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: results.length,
          itemListElement: results.slice(0, 10).map((m, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            url: `${res.locals.siteUrl || ""}/phim/${m.slug}`,
            name: m.name || m.origin_name || "",
          })),
        },
      };
      searchJsonLd = JSON.stringify(searchJsonLdObj).replace(/<\//g, "<\\/");
    }

    res.render("pages/search", {
      title: keyword ? `Tìm kiếm "${keyword}" - movieCC` : "Tìm kiếm phim - movieCC",
      metaDesc: keyword
        ? `Kết quả tìm kiếm "${keyword}" trên movieCC. Tìm phim bộ, phim lẻ, anime với phụ đề tiếng Việt, chất lượng cao.`
        : "Tìm kiếm phim trực tuyến trên movieCC. Phim bộ, phim lẻ, anime với phụ đề tiếng Việt, chất lượng cao.",
      keyword, results, totalResults, totalPages, currentPage: page,
      filterCategory, filterCountry, searchJsonLd,
      noIndex: !!keyword,
      breadcrumbs: keyword
        ? [{ name: "Trang chủ", url: "/" }, { name: "Tìm kiếm", url: "/tim-kiem" }, { name: keyword }]
        : [{ name: "Trang chủ", url: "/" }, { name: "Tìm kiếm" }],
    });
  } catch (err) {
    logger.error("search", "Lỗi tìm kiếm", err);
    res.render("pages/search", {
      title: "Tìm kiếm - movieCC", keyword: req.query.q || "",
      results: [], totalResults: 0, totalPages: 0, currentPage: 1,
      filterCategory: "", filterCountry: "",
    });
  }
};

exports.getSuggest = async (req, res) => {
  try {
    const keyword = req.query.q || "";
    if (!keyword || keyword.length < 2) return res.json([]);

    const cacheKey = `suggest:${keyword.toLowerCase()}`;
    const cached = suggestCache.get(cacheKey);
    if (cached) return res.json(cached);

    const data = await sourceManager.searchAll(keyword, 1, 8);
    const items = (data.items || []).slice(0, 8);

    suggestCache.set(cacheKey, items);
    res.json(items);
  } catch (err) {
    logger.error("search", "Lỗi gợi ý", err);
    res.json([]);
  }
};
