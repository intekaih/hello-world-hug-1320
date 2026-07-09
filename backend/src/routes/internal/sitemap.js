/**
 * Internal Sitemap Routes - Extracted from server.js
 * Handles sitemap.xml, sitemap-index.xml, and related endpoints
 */

const express = require("express");
const router = express.Router();
const NodeCache = require("node-cache");
const { sourceManager: sitemapSourceManager } = require("../../config/providers");
const categories = require("../../config/categories");
const countries = require("../../config/countries");

// Cache for sitemap data
const sitemapCache = new NodeCache({ stdTTL: 3600, maxKeys: 60, deleteOnExpire: true });

// Periodic sitemap cache cleanup - prevent memory bloat
setInterval(() => {
  const stats = sitemapCache.getStats();
  if (stats.keys > 50) {
    sitemapCache.flushAll();
    console.log('[CACHE] Flushed sitemapCache due to high keys:', stats.keys);
  }
}, 600000); // Every 10 minutes

const SITEMAP_FETCH_TIMEOUT = 8000;     // 8s max cho fetch phim
const SITEMAP_CHUNK_SIZE = 5000;        // Google giới hạn 50k URLs/sitemap; ta chunk 5k cho dễ refresh
const SITEMAP_MAX_PAGES = 10;           // 10 chunk × 5k = 50k phim mới nhất

// Helper: lấy base URL tuyệt đối từ SITE_URL env hoặc tự detect từ request
function getBaseUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

// Helper render <urlset>
function renderUrlset(urls, lastmod) {
  const tags = urls
    .map(
      (u) =>
        `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod || lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${tags}\n</urlset>`;
}

// Lazy-load tất cả phim mới (bounded) để chia chunk
// Cache key bao gồm siteUrl để tránh cross-host poisoning khi multi-domain.
async function getAllMovieUrls(siteUrl) {
  const cacheKey = `movies:all:${siteUrl}`;
  const cached = sitemapCache.get(cacheKey);
  if (cached) return cached;
  const seen = new Set();
  const all = [];
  try {
    for (let page = 1; page <= SITEMAP_MAX_PAGES; page++) {
      const fetchPromise = sitemapSourceManager.fetchAllNewMovies(page);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("sitemap_fetch_timeout")), SITEMAP_FETCH_TIMEOUT),
      );
      let result;
      try {
        result = await Promise.race([fetchPromise, timeoutPromise]);
      } catch {
        break; // timeout/lỗi: dừng, dùng những gì có
      }
      const items = result?.items || [];
      if (items.length === 0) break;
      for (const m of items) {
        if (!m.slug || seen.has(m.slug)) continue;
        seen.add(m.slug);
        all.push({
          loc: `${siteUrl}/phim/${m.slug}`,
          priority: "0.8",
          changefreq: "weekly",
        });
        if (all.length >= SITEMAP_CHUNK_SIZE * SITEMAP_MAX_PAGES) break;
      }
      if (all.length >= SITEMAP_CHUNK_SIZE * SITEMAP_MAX_PAGES) break;
    }
  } catch { /* ignore */ }
  sitemapCache.set(cacheKey, all);
  return all;
}

// Sitemap index — liệt kê các sitemap con
router.get(["/sitemap.xml", "/sitemap-index.xml"], async (req, res) => {
  const siteUrl = getBaseUrl(req);
  const now = new Date().toISOString().split("T")[0];
  const cacheKey = `index:${siteUrl}`;
  const cached = sitemapCache.get(cacheKey);
  if (cached) {
    res.type("application/xml");
    return res.send(cached);
  }

  // Tính số chunk phim — chỉ thêm vào index khi có phim, tránh /sitemap-movies-1.xml trả 404
  const allMovies = await getAllMovieUrls(siteUrl);
  const movieChunks = allMovies.length > 0 ? Math.ceil(allMovies.length / SITEMAP_CHUNK_SIZE) : 0;

  const sitemaps = [
    `${siteUrl}/sitemap-static.xml`,
    `${siteUrl}/sitemap-categories.xml`,
    `${siteUrl}/sitemap-countries.xml`,
    ...Array.from({ length: movieChunks }, (_, i) => `${siteUrl}/sitemap-movies-${i + 1}.xml`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps
    .map((s) => `  <sitemap>\n    <loc>${s}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`)
    .join("\n")}\n</sitemapindex>`;

  sitemapCache.set(cacheKey, xml);
  res.type("application/xml");
  res.send(xml);
});

router.get("/sitemap-static.xml", (req, res) => {
  const siteUrl = getBaseUrl(req);
  const now = new Date().toISOString().split("T")[0];
  const staticUrls = [
    { loc: `${siteUrl}/`, priority: "1.0", changefreq: "daily" },
    { loc: `${siteUrl}/gioi-thieu`, priority: "0.5", changefreq: "monthly" },
    { loc: `${siteUrl}/chinh-sach-bao-mat`, priority: "0.4", changefreq: "monthly" },
    { loc: `${siteUrl}/tim-kiem`, priority: "0.7", changefreq: "weekly" },
    { loc: `${siteUrl}/danh-sach/phim-bo`, priority: "0.9", changefreq: "hourly" },
    { loc: `${siteUrl}/danh-sach/phim-le`, priority: "0.9", changefreq: "hourly" },
    { loc: `${siteUrl}/danh-sach/hoat-hinh`, priority: "0.9", changefreq: "hourly" },
    { loc: `${siteUrl}/danh-sach/phim-chieu-rap`, priority: "0.7", changefreq: "daily" },
    { loc: `${siteUrl}/danh-sach/phim-moi-cap-nhat`, priority: "1.0", changefreq: "hourly" },
    { loc: `${siteUrl}/danh-sach/phim-vietsub`, priority: "0.7", changefreq: "daily" },
    { loc: `${siteUrl}/danh-sach/phim-thuyet-minh`, priority: "0.7", changefreq: "daily" },
    { loc: `${siteUrl}/danh-sach/phim-bo-dang-chieu`, priority: "0.7", changefreq: "daily" },
  ];
  res.type("application/xml").send(renderUrlset(staticUrls, now));
});

router.get("/sitemap-categories.xml", (req, res) => {
  const siteUrl = getBaseUrl(req);
  const now = new Date().toISOString().split("T")[0];
  const urls = categories.map((cat) => ({
    loc: `${siteUrl}/the-loai/${cat.slug}`,
    priority: "0.7",
    changefreq: "daily",
  }));
  res.type("application/xml").send(renderUrlset(urls, now));
});

router.get("/sitemap-countries.xml", (req, res) => {
  const siteUrl = getBaseUrl(req);
  const now = new Date().toISOString().split("T")[0];
  const urls = countries.map((c) => ({
    loc: `${siteUrl}/quoc-gia/${c.slug}`,
    priority: "0.6",
    changefreq: "weekly",
  }));
  res.type("application/xml").send(renderUrlset(urls, now));
});

router.get("/sitemap-movies-:idx.xml", async (req, res) => {
  const siteUrl = getBaseUrl(req);
  const idx = parseInt(req.params.idx, 10);
  if (!Number.isInteger(idx) || idx < 1 || idx > SITEMAP_MAX_PAGES) {
    return res.status(404).end();
  }
  const cacheKey = `movies-chunk:${idx}:${siteUrl}`;
  const cached = sitemapCache.get(cacheKey);
  if (cached) {
    res.type("application/xml");
    return res.send(cached);
  }
  const all = await getAllMovieUrls(siteUrl);
  const start = (idx - 1) * SITEMAP_CHUNK_SIZE;
  const slice = all.slice(start, start + SITEMAP_CHUNK_SIZE);
  if (slice.length === 0) return res.status(404).end();
  const now = new Date().toISOString().split("T")[0];
  const xml = renderUrlset(slice, now);
  sitemapCache.set(cacheKey, xml);
  res.type("application/xml").send(xml);
});

module.exports = router;