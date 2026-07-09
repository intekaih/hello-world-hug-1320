/**
 * Internal SEO Routes - Extracted from server.js
 * Handles /robots.txt, /llms.txt endpoints
 */

const express = require("express");
const router = express.Router();

// Helper: lấy base URL tuyệt đối từ SITE_URL env hoặc tự detect từ request
function getBaseUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

// robots.txt — Search engines first, AI training bots second
router.get("/robots.txt", (req, res) => {
  const siteUrl = getBaseUrl(req);
  res.type("text/plain");
  res.send(
`# movieCC robots.txt
# https://moviecc.app/robots.txt

# ─── Standard Search Engines ──────────────────────────────────────────────────────
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

# ─── AI Search / Grounding (Perplexity, ChatGPT Search, Gemini) ──────────────────
# These crawlers use AI OVERviews but do NOT train on content.
# Allow them to index for AI search visibility (GEO benefit).
User-agent: PerplexityBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: GPTBot
Allow: /

# ─── AI Training (Block) ────────────────────────────────────────────────────────
# Block training crawlers — we do NOT consent to AI training
User-agent: Bytespider
Disallow: /
User-agent: CCBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: FacebookBot
Disallow: /
User-agent: GoogleOther
Disallow: /
User-agent: OAI-SearchBot
Disallow: /

# ─── Accessibility (Bing, Apple) ───────────────────────────────────────────────────
User-agent: Applebot
Allow: /
User-agent: bingbot
Allow: /
User-agent: DuckDuckBot
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`
);
});

// llms.txt — AI crawler info file (GEO standard) — contact: @ShopCC_app
router.get("/llms.txt", (req, res) => {
  const siteUrl = getBaseUrl(req);
  res.type("text/plain");
  res.send(`# movieCC
> Nền tảng xem phim trực tuyến chất lượng cao hàng đầu Việt Nam. Liên hệ: Telegram https://t.me/ShopCC_app

## Giới thiệu
movieCC là website xem phim trực tuyến cung cấp kho phim đa dạng bao gồm phim bộ, phim lẻ, anime, phim chiếu rạp với phụ đề tiếng Việt, chất lượng lên đến 4K. Nền tảng sử dụng hạ tầng máy chủ VIP 10Gbps để đảm bảo trải nghiệm xem phim mượt mà.

## Tính năng chính
- Kho phim đa dạng: Phim bộ (Hàn Quốc, Trung Quốc, Âu Mỹ), Phim lẻ, Anime, Phim chiếu rạp, TV Shows
- Chất lượng cao: Full HD, 4K UHD
- Phụ đề: Vietsub, Thuyết minh, Lồng tiếng
- Tốc độ stream: Server VIP 10Gbps
- Trải nghiệm: Không quảng cáo, giao diện responsive trên mọi thiết bị
- Cập nhật nhanh: Phim mới được cập nhật trong ngày

## Cấu trúc nội dung
- Trang chủ: ${siteUrl}/
- Tìm kiếm: ${siteUrl}/tim-kiem?q={từ khóa}
- Phim bộ: ${siteUrl}/danh-sach/phim-bo
- Phim lẻ: ${siteUrl}/danh-sach/phim-le
- Anime: ${siteUrl}/danh-sach/hoat-hinh
- Phim chiếu rạp: ${siteUrl}/danh-sach/phim-chieu-rap
- Phim mới cập nhật: ${siteUrl}/danh-sach/phim-moi-cap-nhat
- Chi tiết phim: ${siteUrl}/phim/{slug}
- Thể loại: ${siteUrl}/the-loai/{slug} (hành động, tình cảm, kinh dị, hài hước, v.v.)
- Quốc gia: ${siteUrl}/quoc-gia/{slug} (trung-quoc, han-quoc, nhat-ban, au-my, v.v.)

## Thể loại phổ biến
Hành Động, Tình Cảm, Cổ Trang, Kinh Dị, Hài Hước, Tâm Lý, Viễn Tưởng, Phiêu Lưu, Hoạt Hình, Bí Ẩn, Hình Sự, Chiến Tranh, Thể Thao, Âm Nhạc, Gia Đình, Chính Kịch, Tài Liệu

## Quốc gia phổ biến
Trung Quốc, Hàn Quốc, Nhật Bản, Âu Mỹ, Thái Lan, Việt Nam, Đài Loan, Hồng Kông, Ấn Độ, Philippines

## Chủ sở hữu
movieCC - Nền tảng xem phim trực tuyến Việt Nam

## Liên hệ
Telegram: https://t.me/ShopCC_app
Website: ${siteUrl}
`);
});

module.exports = router;