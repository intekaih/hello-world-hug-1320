// Fix: Override DNS proxy (Surfshark/NordVPN) chặn SRV queries của MongoDB Atlas
require("dns").setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");

const assetVersion = (() => {
  try {
    const files = [
      "public/css/bundle.min.css",
      "public/js/app.min.js",
      "public/js/custom-player.min.js",
    ];
    const hash = crypto.createHash("md5");
    files.forEach((f) => {
      try {
        hash.update(fs.readFileSync(path.join(__dirname, f)));
      } catch (e) { }
    });
    return hash.digest("hex").slice(0, 8);
  } catch (e) {
    return Date.now().toString(36);
  }
})();

// Config
const config = require("./src/config");
const logger = require("./src/utils/logger");
const { globalLimiter } = require("./src/middleware/rateLimit");

// Middleware & Routes
const basicAuthRoutes = require("./src/routes/auth");
const adminRoutes = require("./src/routes/admin");
const movieRoutes = require("./src/routes/movie");
const errorHandler = require("./src/middleware/errorHandler");
const categories = require("./src/config/categories");

// Internal routes (extracted from server.js)
const sitemapRoutes = require("./src/routes/internal/sitemap");
const healthRoutes = require("./src/routes/internal/health");
const seoRoutes = require("./src/routes/internal/seo");
const countries = require("./src/config/countries");

const app = express();

// Giới hạn kết nối đồng thời (Chống sập Server cục bộ)
let activeRequests = 0;
// 20 workers × 10 = 200 CCU thực tế xử lý cùng 1 mili-giây
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CCU_PER_WORKER, 10) || 10;

app.use((req, res, next) => {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    // Quá tải -> trả JSON cho API, render queue page cho HTML browser
    res.set("Connection", "close");
    res.set("Retry-After", "5");
    if (req.path.startsWith("/api/") || req.xhr) {
      return res.status(503).json({
        success: false,
        message: "Hệ thống đang quá tải, vui lòng thử lại sau giây lát.",
        retryAfter: 5,
      });
    }
    return res.status(503).render("pages/503", { layout: false });
  }
  
  activeRequests++;
  let isDone = false;
  const onResponseFinished = () => {
    if (!isDone) {
      isDone = true;
      activeRequests--;
    }
  };
  
  res.on('finish', onResponseFinished);
  res.on('close', onResponseFinished);
  
  next();
});

// Trust proxy (Nginx, Cloudflare, etc.)
app.set("trust proxy", 1);

// Security Middleware
app.use(compression());

// Nonce generation per request
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString("base64");
  next();
});

// Apply Helmet ONCE for all non-CSP security headers (X-Frame-Options, HSTS, etc.)
const helmetNonCsp = helmet({
  contentSecurityPolicy: false, // We handle CSP ourselves below
});
app.use(helmetNonCsp);

// Pre-compiled CSP template — only nonce changes per request
// Build CSP string once at startup, replace __NONCE__ per request
const cspDirectives = config.helmet.contentSecurityPolicy.directives;
const cspParts = [
  `default-src ${(cspDirectives.defaultSrc || ["'self'"]).join(" ")}`,
  `script-src 'self' __NONCE_PLACEHOLDER__ 'inline-speculation-rules' https://cdn.jsdelivr.net https://challenges.cloudflare.com`,
  `script-src-attr 'none'`,
  `style-src ${(cspDirectives.styleSrc || ["'self'"]).join(" ")}`,
  `font-src ${(cspDirectives.fontSrc || ["'self'"]).join(" ")}`,
  `img-src ${(cspDirectives.imgSrc || ["'self'"]).join(" ")}`,
  `media-src ${(cspDirectives.mediaSrc || ["'self'"]).join(" ")}`,
  `connect-src ${(cspDirectives.connectSrc || ["'self'"]).join(" ")}`,
  `frame-src ${(cspDirectives.frameSrc || ["'self'"]).join(" ")}`,
  `worker-src ${(cspDirectives.workerSrc || ["'self'"]).join(" ")}`,
];
const CSP_TEMPLATE = cspParts.join("; ");

app.use((req, res, next) => {
  // Skip CSP cho React app — SPA có bundle riêng, không cần nonce
  if (req.path.startsWith("/app")) return next();
  const nonce = res.locals.nonce;
  // Safari <16 doesn't support script-src-attr 'none' (CSP3), breaks all JS
  // Safe fallback: use 'unsafe-inline' so Safari still renders while others respect 'none'
  const scriptSrcAttr = "script-src-attr 'none'";
  const scriptSrcAttrDirective = CSP_TEMPLATE.includes(scriptSrcAttr)
    ? CSP_TEMPLATE.replace(scriptSrcAttr, "script-src-attr 'unsafe-inline'")
    : CSP_TEMPLATE;
  res.setHeader(
    "Content-Security-Policy",
    scriptSrcAttrDirective.replace("__NONCE_PLACEHOLDER__", `'nonce-${nonce}'`),
  );
  next();
});

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));
app.use(expressLayouts);
app.set("layout", "layouts/main");

// General Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// SEC-3: NoSQL injection guard — strip mọi key bắt đầu bằng $ hoặc chứa dấu .
// Áp dụng cho cả EJS và API. onSanitize chỉ log để debug, không block request.
app.use(
  mongoSanitize({
    replaceWith: "_",
    onSanitize: ({ req, key }) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[mongoSanitize] Stripped suspicious key "${key}" on ${req.method} ${req.path}`);
      }
    },
  }),
);

const isProduction = process.env.NODE_ENV === "production";
app.use(
  express.static(
    path.join(__dirname, "public"),
    isProduction
      ? {
        maxAge: "7d",
        immutable: true,
      }
      : {
        maxAge: 0,
        etag: false,
        lastModified: false,
      },
  ),
);

// Rate Limiting
app.use(globalLimiter);

// Session
app.use(session(config.session));

// Refresh session: kiểm tra DB mỗi 30s để phát hiện user bị khóa/hạ quyền
const { refreshSession } = require("./src/middleware/auth");
app.use(refreshSession);

// User session to views + global template variables
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.siteUrl = process.env.SITE_URL
    ? process.env.SITE_URL.replace(/\/$/, "")
    : `${req.headers["x-forwarded-proto"] || req.protocol || "http"}://${req.headers["x-forwarded-host"] || req.headers.host || "localhost"}`;
  res.locals.isProduction = process.env.NODE_ENV === "production";
  res.locals.v = assetVersion;
  // Inject categories & countries globally — không cần truyền thủ công ở từng controller
  res.locals.categories = categories;
  res.locals.countries = countries;
  res.locals.feedbackEnabled = process.env.ENABLE_FEEDBACK !== "false";
  res.locals.authRequired = process.env.REQUIRE_AUTH !== "false";
  // Watch page flag for conditional player CSS
  res.locals.isWatchPage = req.path.startsWith("/xem/");
  // Admin page flag for conditional admin CSS
  res.locals.isAdminPage = req.path.startsWith("/admin");
  // Tắt speculation rules cho user đã đăng nhập (tránh prerender background nặng)
  res.locals.isSpeculationEnabled = !req.session.user;
  // Image optimization via wsrv.nl - skip cho internal CDNs
  const useImageProxy = process.env.OPTIMIZE_IMAGES !== "false";
  const INTERNAL_CDNS = ["img.ophim", "ophim1.com", "kkphim", "img.phim", "cdn"];
  res.locals.thumbSrc = function (url, width) {
    if (!url || !useImageProxy) return url;
    if (!url.startsWith("http")) return url;
    // Skip proxy cho internal CDNs - đã có domain tốt rồi
    if (INTERNAL_CDNS.some(cdn => url.includes(cdn))) return url;
    const safeWidth = Math.max(80, Math.min(1600, parseInt(width, 10) || 300));
    const encoded = Buffer.from(`server:${url}`, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    return `/api/image/${encoded}?w=${safeWidth}`;
  };
  next();
});

// Early Hints: Send Link headers for critical resources — Cloudflare converts to 103 response
// This lets browsers start downloading CSS/JS BEFORE the HTML is fully generated
// Chỉ set cho các HTML page chính, không cho API, static files, hay sitemap
const EARLY_HINTS_PATTERNS = /^\/(phim\/|the-loai\/|quoc-gia\/|danh-sach\/|tim-kiem|\/?$)/;
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  // Only set for HTML pages (not API, not static)
  if (!EARLY_HINTS_PATTERNS.test(req.path)) return next();
  const links = [
    `</css/bundle.min.css?v=${assetVersion}>; rel=preload; as=style`,
    `</js/${isProduction ? "app.min.js" : "app.js"}?v=${assetVersion}>; rel=preload; as=script`,
  ];
  res.setHeader("Link", links.join(", "));
  next();
});

// Cache-Control for public pages — CDN caching via s-maxage
// Private/user-specific pages excluded
const UNCACHEABLE_PATHS = ["/ho-so", "/lich-su", "/yeu-thich", "/admin", "/dang-nhap", "/dang-ky", "/dang-xuat", "/gop-y", "/api/"];
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (UNCACHEABLE_PATHS.some((p) => req.path.startsWith(p))) return next();
  if (req.session?.user) {
    // Logged-in users: private, no CDN cache
    res.setHeader("Cache-Control", "private, no-cache");
  } else {
    // Public pages: CDN caches 60s, serve stale up to 5 min during revalidation
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  }
  next();
});

// Speculation Rules: Supports-Loading-Mode header cho phép prerender credentialed
// Chỉ set cho GET request trả về HTML (không phải API / auth / admin routes)
const PRERENDER_EXCLUDED = ["/api/", "/admin/", "/dang-xuat", "/xem/"];
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  const path = req.path;
  const isExcluded = PRERENDER_EXCLUDED.some((p) => path.startsWith(p));
  if (!isExcluded) {
    // Cho phép browser prerender trang này với session/cookies
    res.setHeader("Supports-Loading-Mode", "credentialed-prerender");
    // Đảm bảo cache middleware phân biệt response có/không có prerender
    res.setHeader("Vary", "Purpose, Sec-Purpose");
  }
  next();
});

// CSRF: sinh token cho mọi view, bảo vệ route nhạy cảm ở từng router
const { generateToken, handleCsrfError } = require("./src/middleware/csrf");
app.use((req, res, next) => {
  res.locals.csrfToken = generateToken(req, res);
  next();
});

// CORS headers for React app / Capacitor mobile + Lovable FE
const allowedOrigins = [
  "http://localhost:5173",     // Lovable dev (Vite default)
  "http://localhost:3000",     // Lovable dev alt / EJS same-origin
  "http://localhost:5174",     // Alt Vite port
  "http://127.0.0.1:5173",
  "https://localhost",          // Capacitor WebView (hostname: localhost, scheme: https)
  "capacitor://localhost",
  "https://hello-world-hug-1320.lovable.app",  // Lovable production
  "https://preview--hello-world-hug-1320.lovable.app",  // Lovable preview
  "https://id-preview--hello-world-hug-1320.lovable.app",
];

// Optional extra origins via env (comma-separated), thêm nếu cần
if (process.env.REACT_ALLOWED_ORIGINS) {
  process.env.REACT_ALLOWED_ORIGINS
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((o) => allowedOrigins.push(o));
}
app.use((req, res, next) => {
  // CORS cho cả /api/react (mới) và /api (Capacitor APK cũ)
  if (req.path.startsWith("/api/react") || req.path.startsWith("/api/")) {
    const origin = req.headers.origin;
    // Trong dev: allow tất cả localhost; prod: phải có trong allowlist hoặc suffix .lovable.app
    const isLovablePreview = origin && /\.lovable\.app$/.test(origin);
    const isAllowed = origin && (
      allowedOrigins.includes(origin)
      || isLovablePreview
      || (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    );
    if (isAllowed) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
    } else if (process.env.REACT_ALLOWED_ORIGIN) {
      res.header("Access-Control-Allow-Origin", process.env.REACT_ALLOWED_ORIGIN);
    }
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type, Accept, X-CSRF-Token");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(200);
  }
  next();
});

// Mobile/Tablet Redirect to React App (/app)
const isMobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  
  // Bỏ qua các route không phải giao diện chính
  if (req.path.startsWith("/app") || 
      req.path.startsWith("/api") || 
      req.path.startsWith("/admin") ||
      req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|json|xml|txt|webmanifest)$/)) {
    return next();
  }

  const userAgent = req.headers["user-agent"] || "";
  
  if (isMobileRegex.test(userAgent)) {
    let target = "/app";
    
    // Mapping Express routes to React routes
    if (req.path.startsWith("/phim/")) {
      target = "/app/movie/" + req.path.split("/")[2];
    } else if (req.path.startsWith("/xem/")) {
      const parts = req.path.split("/");
      if (parts.length >= 4) {
        target = `/app/watch/${parts[2]}/${parts[3]}`;
      }
    } else if (req.path === "/tim-kiem") {
      target = "/app/search" + (req.url.substring(req.path.length) || "");
    } else if (req.path.startsWith("/the-loai/")) {
      target = `/app/browse/${req.path.split("/")[2]}`;
    } else if (req.path === "/lich-su") {
      target = "/app/history";
    } else if (req.path === "/yeu-thich") {
      target = "/app/favorites";
    } else if (req.path === "/ho-so") {
      target = "/app/profile";
    } else if (req.path === "/dang-nhap" || req.path === "/dang-ky") {
      target = "/app/login";
    }
    
    // Tránh cache redirect này ở CDN để không ảnh hưởng Desktop
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return res.redirect(302, target);
  }
  
  next();
});

// Routes
app.use("/", basicAuthRoutes);
app.use("/admin", adminRoutes);
app.use("/", movieRoutes); // Main public routes

// Internal routes (extracted from server.js for better maintainability)
app.use(sitemapRoutes);
app.use(healthRoutes);
app.use(seoRoutes);

// Download APK route — check multiple locations
app.get("/download/:filename", (req, res, next) => {
  const validNames = ["MovieCC.apk"];
  const { filename } = req.params;
  if (!validNames.includes(filename)) return next();
  // Thử deploy_termux/ (dev trên PC) → fallback public/ (production trên phone)
  const locations = [
    path.join(__dirname, "..", "deploy_termux", filename),
    path.join(__dirname, "public", filename),
  ];
  const apkPath = locations.find(p => fs.existsSync(p));
  if (!apkPath) return next();
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.sendFile(apkPath, (err) => {
    // Guard: nếu headers đã gửi rồi thì không gọi next() nữa
    if (err && !res.headersSent) next();
  });
});

// JSON API for React app / Capacitor
const apiRoutes = require("./src/routes/api");
app.use("/api/proxy", require("./src/routes/proxy")); // Thêm proxy cho plugin test
app.use("/api/business/accounts", require("./src/routes/businessAccounts"));
app.use("/api/react", apiRoutes);
// Tương thích ngược: Capacitor APK cũ gọi /api/... thay vì /api/react/...
app.use("/api", apiRoutes);

// Health check (minimal, no internal info)
const database = require("./src/database");

// ── Sitemap.xml phải đặt TRƯỚC static middleware để tránh bị override ──
// Helper: lay base URL tuyet doi tu SITE_URL env hoac tu detect tu request
function getBaseUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

// SEO-1: Chia thành sitemap-index + nhiều sitemap con để tăng crawl budget
//        Google ưu tiên các URL trong sitemap được phân nhóm rõ ràng.
const { sourceManager: sitemapSourceManager } = require("./src/config/providers");
const NodeCache = require("node-cache");
const sitemapCache = new NodeCache({ stdTTL: 3600, maxKeys: 60, deleteOnExpire: true });

// Periodic sitemap cache cleanup - prevent memory bloat
setInterval(() => {
  const stats = sitemapCache.getStats();
  if (stats.keys > 50) {
    sitemapCache.flushAll();
    logger.info('cache', 'Flushed sitemapCache due to high keys', { keys: stats.keys });
  }
}, 600000); // Every 10 minutes

const SITEMAP_FETCH_TIMEOUT = 8000;     // 8s max cho fetch phim
const SITEMAP_CHUNK_SIZE = 5000;        // Google giới hạn 50k URLs/sitemap; ta chunk 5k cho dễ refresh
const SITEMAP_MAX_PAGES = 10;           // 10 chunk × 5k = 50k phim mới nhất

// Helper render <urlset>
function renderUrlset(urls, lastmod) {
  const tags = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod || lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
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

app.get("/robots.txt", (req, res) => {
  const siteUrl = getBaseUrl(req);
  res.type("text/plain");
  res.send(
`# movieCC robots.txt
# https://moviecc.app/robots.txt

# ── Standard Search Engines ──────────────────────────────────────────────────
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /dang-nhap/
Disallow: /dang-xuat/
Disallow: /ho-so/
Disallow: /quen-mat-khau/
Disallow: /lich-su/
Disallow: /yeu-thich/
Disallow: /gop-y/

# ── AI Search / Grounding (Perplexity, ChatGPT Search, Gemini) ──────────
# These crawlers use AI OVERviews but do NOT train on content.
# Allow them to index for AI search visibility (GEO benefit).
User-agent: PerplexityBot
Allow: /

User-agent: FacebookBot
Allow: /

# ── AI Training Scrapers ─────────────────────────────────────────────────
# Block crawlers that train on content without permission.
# These do NOT affect search engine indexing (Googlebot/Googlebot-Image unaffected).
User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: AmazonBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Google-Extended
Disallow: /

# ── Sitemap ─────────────────────────────────────────────────────────────
Sitemap: ${siteUrl}/sitemap.xml

# ── AI Crawler Info ─────────────────────────────────────────────────────
# movieCC welcomes AI search engines for content indexing (Perplexity, ChatGPT Search).
# Structured site info for AI: ${siteUrl}/llms.txt
# Contact: https://t.me/ShopCC_app`,
  );
});

// X-Robots-Tag: explicitly allow all major crawlers (counters Cloudflare's
// default bot-management blocks that may apply after robots.txt is read)
app.use((req, res, next) => {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  // Allow search engines + AI search crawlers; noindex everything else
  const allowedCrawlers = [
    "googlebot", "googlebot-image", "googlebot-video", "googlebot-news",
    "bingbot", "msnbot", "yandexbot", "baiduspider",
    "duckduckbot", "applebot", "facebookbot",
    "perplexitybot",
  ];
  const isAllowed = allowedCrawlers.some((c) => ua.includes(c));
  if (!isAllowed && ua.length > 0) {
    // Noindex for unknown/unclassified crawlers
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  }
  next();
});

const reactDistPath = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(reactDistPath)) {
  app.use("/app", express.static(reactDistPath, {
    maxAge: 0,
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (!isProduction || path.basename(filePath) === "index.html") {
        res.setHeader("Cache-Control", "no-cache");
        return;
      }
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    },
  }));
  // SPA catch-all: mọi route con /app/* đều trả index.html để React Router xử lý
  app.get("/app/*", (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(reactDistPath, "index.html"));
  });
}

// 404 Handler
app.use((req, res) => {
  res.status(404).render("pages/404", {
    title: "Không tìm thấy trang - movieCC",
  });
});

// CSRF error (EBADCSRFTOKEN) trước errorHandler chung
app.use(handleCsrfError);

// Error Handling
app.use(errorHandler);

// Khởi động server
(async () => {
  // Kết nối MongoDB trước khi listen
  const database = require("./src/database");
  await database.connect();

  const host = process.env.REPL_SLUG ? "0.0.0.0" : "localhost";
  const server = app.listen(config.port, host, () => {
    console.log(`movieCC đang chạy tại http://${host}:${config.port}`);

    // PRE-WARMUP CACHE: warm-up provider caches định kỳ để tránh cold start
    // Lưu ý: movieController dùng NodeCache riêng, nên ta chỉ warmup provider-level caches
    const { sourceManager } = require("./src/config/providers");

    async function warmupHomepageCache() {
      try {
        // Pre-fetch và cache data ở provider level trước
        await Promise.all([
          sourceManager.fetchAllNewMovies(1),
          sourceManager.fetchAllNewMovies(2),
          sourceManager.getByType("phim-bo", 1),
          sourceManager.getByType("phim-le", 1),
          sourceManager.getByType("phim-bo-dang-chieu", 1),
          sourceManager.getByType("phim-chieu-rap", 1),
          sourceManager.getByType("hoat-hinh", 1),
        ]);
        logger.info('cache', 'Provider caches pre-warmed');;
      } catch (e) {
        logger.error('cache', 'Provider warmup failed', e);;
      }
    }

    // Warmup ngay lần đầu sau 5s, sau đó mỗi 60s
    setTimeout(warmupHomepageCache, 5000);
    setInterval(warmupHomepageCache, 60000);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${config.port} đã được sử dụng. Hãy chọn port khác.`);
    } else {
      console.error("Lỗi khởi động server:", err);
    }
    process.exit(1);
  });

  function gracefulShutdown(signal) {
    console.log(`\n${signal} received. Đang tắt server...`);
    server.close(async () => {
      try {
        await database.disconnect();
        console.log("Server đã tắt.");
      } catch (err) {
        console.error("Lỗi khi đóng MongoDB:", err.message);
      }
      process.exit(0);
    });
    setTimeout(() => {
      console.error("Không thể tắt gracefully, force exit.");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Bắt unhandled promise rejection — ngăn crash toàn bộ PM2 worker
  process.on("unhandledRejection", (reason) => {
    console.error("[FATAL] Unhandled Rejection:", reason);
    // Chỉ log, không crash process — để PM2 không restart liên tục
  });
})().catch((err) => {
  console.error("[FATAL] Không thể khởi động server:", err.message);
  process.exit(1);
});
