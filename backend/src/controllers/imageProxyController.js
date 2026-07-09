/**
 * Image Proxy Controller - Secure image proxy for React app
 *
 * Handles /api/react/image/:encoded endpoint
 * Base64 decode: hash = base64(data) = "providerKey:encryptedUrl"
 * Uses wsrv.nl CDN for optimized image delivery
 */

const ALLOWED_IMAGE_HOSTS = new Set([
  "phimimg.com",
  "img.ophim.live",
  "img.ophim1.com",
  "img.nguonc.com",
  "img.kkphim.vip",
  "img.kkphim.com",
  "static.nguonc.com",
  "image.tmdb.org",
  "hoathinh3d.co",
  "yanhh3d.ad",
]);

/**
 * Checks if the URL's host is in the allowed list
 */
function isAllowedImageHost(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (ALLOWED_IMAGE_HOSTS.has(host) || host.includes("hoathinh3d") || host.includes("yanhh3d")) return true;
    for (const h of ALLOWED_IMAGE_HOSTS) {
      if (host.endsWith("." + h)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Decodes image proxy URL from base64
 * Format: base64(providerKey:originalUrl)
 */
function decodeImageProxyUrl(encoded) {
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx === -1) return null;
    const originalUrl = decoded.slice(colonIdx + 1);
    if (!originalUrl || !originalUrl.startsWith("http")) return null;
    return originalUrl;
  } catch {
    return null;
  }
}

/**
 * Checks if URL is from hotlink-protected domains
 */
function isHotlinkProtected(urlStr) {
  return urlStr.includes("hoathinh3d") || urlStr.includes("yanhh3d");
}

/**
 * Builds wsrv.nl proxy URL with optimizations
 */
function buildWsrvUrl(originalUrl, width = 300) {
  const w = Math.max(80, Math.min(1600, parseInt(width, 10) || 300));
  const acceptsWebp = false; // Caller should pass this
  const fmt = ""; // Caller should set this
  return `https://wsrv.nl/?url=${encodeURIComponent(originalUrl)}&w=${w}&n=-5${fmt}&maxage=7d`;
}

/**
 * Express route handler for GET /api/react/image/:encoded
 */
async function handleImageProxy(req, res) {
  const encoded = req.params.encoded;
  if (!encoded) return res.redirect("/images/no-poster.svg");

  try {
    const originalUrl = decodeImageProxyUrl(encoded);
    if (!originalUrl) return res.redirect("/images/no-poster.svg");

    if (!isAllowedImageHost(originalUrl)) {
      return res.redirect("/images/no-poster.svg");
    }

    if (isHotlinkProtected(originalUrl)) {
      const urlParsed = new URL(originalUrl);
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": `${urlParsed.protocol}//${urlParsed.hostname}/`,
      };
      const imgRes = await fetch(originalUrl, { headers });
      if (!imgRes.ok) {
        return res.redirect("/images/no-poster.svg");
      }
      const contentType = imgRes.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");

      const { Readable } = require("stream");
      if (imgRes.body && Readable.fromWeb) {
        Readable.fromWeb(imgRes.body).pipe(res);
      } else if (imgRes.body && imgRes.body.pipe) {
        imgRes.body.pipe(res);
      } else {
        const reader = imgRes.body.getReader();
        const stream = new Readable({
          async read() {
            const { done, value } = await reader.read();
            if (done) {
              this.push(null);
            } else {
              this.push(Buffer.from(value));
            }
          }
        });
        stream.pipe(res);
      }
      return;
    }

    const width = Math.max(80, Math.min(1600, parseInt(req.query.w, 10) || 300));
    const acceptsWebp = (req.headers.accept || "").includes("image/webp");
    const fmt = acceptsWebp ? "&output=webp" : "";
    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(originalUrl)}&w=${width}&n=-5${fmt}&maxage=7d`;

    res.set("Cache-Control", "public, max-age=604800, immutable");
    res.set("Vary", "Accept");
    res.redirect(proxyUrl);
  } catch {
    res.redirect("/images/no-poster.svg");
  }
}

module.exports = {
  isAllowedImageHost,
  decodeImageProxyUrl,
  isHotlinkProtected,
  buildWsrvUrl,
  handleImageProxy,
  ALLOWED_IMAGE_HOSTS,
};
