const express = require("express");
const router = express.Router();
const https = require("https");
const http = require("http");
const url = require("url");
const { webcrypto } = require("crypto");
const { requireAuth } = require("../middleware/auth");
const { hlsProxyLimiter } = require("../middleware/rateLimit");

// NguonC AES-GCM decryption — reverse-engineered from player.js
const NGUONC_HMAC_SECRET = "stream-derive-v1";

async function decryptNguoncM3u8(encryptedM3u8, videoHash) {
    // Parse IV from #ENC-AESGCM;iv=xxx
    const ivMatch = encryptedM3u8.match(/#ENC-AESGCM;iv=([a-f0-9]+)/i);
    if (!ivMatch) return null;
    const ivBytes = new Uint8Array(ivMatch[1].match(/.{1,2}/g).map(h => parseInt(h, 16)));

    // Find base64-encoded ciphertext (first non-comment, non-empty line)
    const dataLine = encryptedM3u8.split('\n').find(l => l.trim() && !l.startsWith('#'));
    if (!dataLine) return null;
    const ciphertext = Uint8Array.from(Buffer.from(dataLine.trim(), 'base64'));

    // Key derivation: HMAC-SHA256(secret="stream-derive-v1", data=videoHash)
    const encoder = new TextEncoder();
    const hmacKey = await webcrypto.subtle.importKey(
        "raw", encoder.encode(NGUONC_HMAC_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signature = await webcrypto.subtle.sign("HMAC", hmacKey, encoder.encode(videoHash));

    // Use full 32-byte HMAC signature as AES-256-GCM key
    const aesKey = await webcrypto.subtle.importKey(
        "raw", new Uint8Array(signature),
        { name: "AES-GCM" }, false, ["decrypt"]
    );

    // Decrypt
    const decrypted = await webcrypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBytes }, aesKey, ciphertext
    );
    return new TextDecoder().decode(decrypted);
}

// SEC: Domain allowlist cho stream proxy — chống SSRF
const ALLOWED_STREAM_HOSTS = new Set([
  "hoathinh3d.co",
  "s1.phim1280.tv",
  "kk.tn178.cc",
  "stream.ophim.cc",
  "sv1.vuighe.me",
  "sphim.biz",
  "kkphim.com",
  "ophim.cc",
  "phimapi.com",
  "phim.nguonc.com",
  "nguonc.com", "zyxcdn.com", "fbcdn.cloud", "yanhh3d.ad",
]);

function isAllowedStreamHost(targetUrl) {
  try {
    const u = new URL(targetUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    // Block private/internal IPs
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|0\.|169\.254\.|::1|localhost)/i.test(host)) return false;
    if (ALLOWED_STREAM_HOSTS.has(host) || host.includes("hoathinh3d") || host.includes("yanhh3d") || host.includes("zyxcdn") || host.includes("fbcdn") || host.includes("ticktok") || host.includes("tiktok") || host.includes("streamc") || host.includes("hihihoho") || host.includes("amass") || host.includes("ibyteimg")) return true;
    for (const h of ALLOWED_STREAM_HOSTS) {
      if (host.endsWith("." + h)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// SEC: Validate pluginId — chỉ cho phép slug hợp lệ
const VALID_PLUGIN_ID = /^[a-z0-9_-]{1,30}$/;

// Helper fetch for auto-hh3d
async function fetchUrl(reqUrl, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(reqUrl, { headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
    });
}

router.get("/auto-hh3d", requireAuth, hlsProxyLimiter, async (req, res) => {
    try {
        // Fetch homepage to find a movie
        const homeHtml = await fetchUrl("https://yanhh3d.ad/");
        
        // Find a movie detail link (flw-item pattern)
        const flwMatch = homeHtml.match(/<div[^>]*class="[^"]*flw-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div class="clearfix">/i);
        let movieUrl = '';
        if (flwMatch) {
            const linkMatch = flwMatch[1].match(/href="([^"]+)"/i);
            if (linkMatch) {
                movieUrl = linkMatch[1];
                if (!movieUrl.startsWith('http')) {
                    movieUrl = 'https://yanhh3d.ad' + movieUrl;
                }
            }
        }
        
        if (!movieUrl) return res.status(500).json({ error: "Không tìm thấy phim trên homepage." });
        
        console.log("[auto-hh3d] Movie:", movieUrl);
        
        // Fetch detail page to find a watch/play link
        const detailHtml = await fetchUrl(movieUrl);
        const playMatch = detailHtml.match(/href="([^"]+\/tap-\d+[^"]*)"/i) ||
            detailHtml.match(/class="[^"]*btn-play[^"]*"[^>]+href="([^"]+)"/i);
        
        let watchUrl = playMatch ? playMatch[1] : movieUrl + '/tap-1';
        if (!watchUrl.startsWith('http')) {
            watchUrl = 'https://yanhh3d.ad' + watchUrl;
        }
        console.log("[auto-hh3d] Watch page:", watchUrl);
        
        // Fetch watch page
        const watchHtml = await fetchUrl(watchUrl);
        
        // Find the first server button with a direct m3u8 data-src
        const svRegex = /<a[^>]+name=["']?(LINK\d+)["']?[^>]+data-src=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let svMatch;
        let m3u8Url = null;
        let serverLabel = "";
        
        while ((svMatch = svRegex.exec(watchHtml)) !== null) {
            const dataSrc = svMatch[2];
            const label = svMatch[3].replace(/<[^>]*>/g, '').trim();
            if (dataSrc.includes('.m3u8')) {
                m3u8Url = dataSrc;
                serverLabel = `${svMatch[1]} (${label})`;
                break;
            }
        }
        
        if (!m3u8Url) {
            return res.status(500).json({ error: "Không tìm thấy link m3u8 trong watch page." });
        }
        
        console.log("[auto-hh3d] Found m3u8:", serverLabel, "->", m3u8Url.substring(0, 80));
        
        // Build proxy URL with proper referer for fbcdn
        const referer = "https://yanhh3d.ad/";
        const origin = "https://yanhh3d.ad";
        const proxyUrl = `http://localhost:3000/api/proxy/stream?url=${encodeURIComponent(m3u8Url)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}`;
        
        return res.json({ success: true, proxyUrl, server: serverLabel, directUrl: m3u8Url });
    } catch (e) {
        console.error("[auto-hh3d] Error:", e);
        res.status(500).json({ error: e.message });
    }
});


router.get("/auto-nguonc", requireAuth, hlsProxyLimiter, async (req, res) => {
    try {
        const { enabledProviders } = require("../config/providers");
        const nguonc = enabledProviders.find(p => p.id === "nguonc" || p.name === "nguonc");
        if (!nguonc) return res.status(500).json({ error: "Plugin NguonC chưa bật" });

        // Lấy danh sách phim để test
        const newMovies = await nguonc._fetchList("phim-dang-chieu", 1);
        if (!newMovies || newMovies.items.length === 0) return res.status(500).json({ error: "Không lấy được danh sách" });
        
        const detail = await nguonc.getMovieDetail(newMovies.items[0].slug);
        if (!detail || !detail.episodes || detail.episodes.length === 0 || detail.episodes[0].server_data.length === 0) {
            return res.status(500).json({ error: "Phim không có tập nào" });
        }

        const firstEp = detail.episodes[0].server_data[0];
        // Fake link là: /api/proxy/plugins/stream/nguonc/ID/playlist.m3u8
        // Đổi thành absolute localhost URL để test trên frontend
        const proxyUrl = `http://localhost:3000${firstEp.link_m3u8}`;
        res.json({ success: true, proxyUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get("/stream", requireAuth, hlsProxyLimiter, (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("Missing url");

    // SEC: Validate domain — chống SSRF
    if (!isAllowedStreamHost(targetUrl)) {
        return res.status(403).send("Domain not allowed");
    }

    const parsedUrl = url.parse(targetUrl);
    const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: "GET",
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": req.query.referer || "https://hoathinh3d.co/",
            "Origin": req.query.origin || "https://hoathinh3d.co"
        }
    };

    const client = parsedUrl.protocol === "https:" ? https : http;

    const proxyReq = client.request(options, (proxyRes) => {
        const isM3U8 = targetUrl.includes(".m3u8");

        // Prevent aggressive browser caching of proxy responses
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        if (isM3U8) {
            let body = "";
            proxyRes.on("data", chunk => body += chunk);
            proxyRes.on("end", () => {
                const obfMatch = body.match(/data-obf=["']([^"']+)["']/i);
                let realM3u8 = null;
                if (obfMatch) {
                    try {
                        const streamData = JSON.parse(Buffer.from(obfMatch[1], 'base64').toString('utf8'));
                        realM3u8 = streamData.pU || streamData.sU || streamData.sUb;
                    } catch (e) {
                        console.error("Error decoding data-obf in proxy:", e);
                    }
                } else {
                    // Mới: fbcdn.cloud dùng const pU = "..." trong script hoặc data-stream-url="..."
                    const puMatch = body.match(/const\s+(pU|sU|sUb)\s*=\s*["']([^"']+)["']/i);
                    const streamUrlMatch = body.match(/data-stream-url=["']([^"']+)["']/i);
                    if (puMatch) {
                        realM3u8 = puMatch[2];
                    } else if (streamUrlMatch) {
                        realM3u8 = streamUrlMatch[1];
                    }
                }

                if (realM3u8) {
                    const newProxyUrl = `/api/proxy/stream?url=${encodeURIComponent(realM3u8)}&referer=${encodeURIComponent(options.headers.Referer)}&origin=${encodeURIComponent(options.headers.Origin)}`;
                    res.writeHead(302, {
                        'Location': newProxyUrl,
                        'Content-Length': '0',
                        'Cache-Control': 'no-store'
                    });
                    return res.end();
                }

                // Copy headers since we are actually responding with rewritten m3u8
                const blockHeaders = ['content-length', 'content-encoding', 'transfer-encoding', 'cache-control', 'etag', 'last-modified', 'expires'];
                Object.keys(proxyRes.headers).forEach(key => {
                    const k = key.toLowerCase();
                    if (!k.startsWith('access-control-') && !blockHeaders.includes(k)) {
                        res.setHeader(key, proxyRes.headers[key]);
                    }
                });

                // Rewrite inner URLs in m3u8
                const lines = body.split("\n");
                const rewritten = lines.map(line => {
                    line = line.trim();
                    // Strip EXT-X-BASE-URI completely so it doesn't override our proxy paths
                    if (line.startsWith("#EXT-X-BASE-URI")) return "";
                    
                    if (line && !line.startsWith("#")) {
                        // It's an inner URL (either full or relative)
                        let absoluteUrl = line;
                        if (!line.startsWith("http")) {
                            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
                            absoluteUrl = baseUrl + line;
                        }
                        // Add cache buster to chunk URLs to bypass previously cached broken/CORS-blocked chunks
                        const cacheBuster = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
                        return `/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(options.headers.Referer)}&origin=${encodeURIComponent(options.headers.Origin)}&ext=.ts&_cb=${cacheBuster}`;
                    }
                    return line;
                }).filter(l => l !== "").join("\n");
                // Set content length for rewritten content
                res.setHeader("Content-Length", Buffer.byteLength(rewritten));
                res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
                res.send(rewritten);
            });
        } else {
            // Copy headers except those that might break things (CORS, length, encoding, cache)
            const blockHeaders = ['content-length', 'content-encoding', 'transfer-encoding', 'cache-control', 'etag', 'last-modified', 'expires'];
            Object.keys(proxyRes.headers).forEach(key => {
                const k = key.toLowerCase();
                if (!k.startsWith('access-control-') && !blockHeaders.includes(k)) {
                    res.setHeader(key, proxyRes.headers[key]);
                }
            });

            if (targetUrl.match(/\.(png|jpg|jpeg)$/i) || (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].includes('image'))) {
                // ZYXCDN disguises video chunks as images by prepending a 188-byte PNG header.
                // We must strip these 188 bytes and change Content-Type to video/MP2T so hls.js can play it.
                res.setHeader("Content-Type", "video/MP2T");
                res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
                
                let isPngChecked = false;
                let shouldStrip = false;
                let bytesStripped = 0;
                const stripLength = 188;

                proxyRes.on('data', chunk => {
                    if (!isPngChecked) {
                        isPngChecked = true;
                        // Check PNG magic number: 89 50 4E 47
                        if (chunk.length >= 4 && chunk[0] === 0x89 && chunk[1] === 0x50 && chunk[2] === 0x4E && chunk[3] === 0x47) {
                            shouldStrip = true;
                        }
                    }

                    if (shouldStrip && bytesStripped < stripLength) {
                        const bytesToStrip = Math.min(stripLength - bytesStripped, chunk.length);
                        bytesStripped += bytesToStrip;
                        if (chunk.length > bytesToStrip) {
                            res.write(chunk.slice(bytesToStrip));
                        }
                    } else {
                        res.write(chunk);
                    }
                });
                proxyRes.on('end', () => res.end());
                
            } else {
                // For normal .ts files, just pipe directly
                res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
                proxyRes.pipe(res);
            }
        }
    });

    proxyReq.on("error", (e) => {
        console.error("Proxy error:", e);
        res.status(500).send("Proxy error");
    });

    proxyReq.end();
});

// Endpoint động lấy luồng stream từ Plugin, dùng m3u8 extension để HLS player nhận diện
router.get("/plugins/stream/:pluginId/:episodeId/playlist.m3u8", requireAuth, hlsProxyLimiter, async (req, res) => {
    try {
        const { pluginId, episodeId } = req.params;

        // SEC: Validate pluginId format
        if (!VALID_PLUGIN_ID.test(pluginId)) {
            return res.status(400).send("Invalid plugin ID");
        }

        const { enabledProviders } = require("../config/providers");
        const plugin = enabledProviders.find(p => p.id === pluginId || p.name === pluginId);
        
        if (!plugin || typeof plugin.extractStream !== "function") {
            return res.status(404).send("Plugin not found or invalid");
        }

        let proxyUrl = "";

        if (pluginId === "nguonc") {
            try {
                // NguonC AES-GCM decryption (2025+): Fetch embed → decode data-obf →
                // fetch encrypted sUb.m3u8 → decrypt AES-GCM → rewrite URLs through proxy
                const resHtml = await fetch(episodeId, { headers: { "User-Agent": "Mozilla/5.0" } });
                const html = await resHtml.text();
                const embedBase = new URL(episodeId).origin;
                
                const obfMatch = html.match(/data-obf=["']([^"']+)["']/);
                if (obfMatch) {
                    const streamData = JSON.parse(Buffer.from(obfMatch[1], 'base64').toString('utf8'));
                    const videoHash = streamData.hD;
                    const sUb = streamData.sUb;
                    
                    if (sUb && videoHash) {
                        // Fetch encrypted m3u8
                        const encM3u8Url = `${embedBase}/${sUb}.m3u8`;
                        const encRes = await fetch(encM3u8Url, {
                            headers: { "User-Agent": "Mozilla/5.0", "Referer": episodeId, "Origin": embedBase }
                        });
                        const encM3u8 = await encRes.text();
                        
                        if (encM3u8.includes('#ENC-AESGCM')) {
                            // Decrypt AES-GCM
                            const plainM3u8 = await decryptNguoncM3u8(encM3u8, videoHash);
                            if (plainM3u8 && plainM3u8.includes('#EXTM3U')) {
                                // Rewrite chunk URLs through proxy
                                const referer = embedBase + "/";
                                const origin = embedBase;
                                const lines = plainM3u8.split('\n');
                                const rewritten = lines.map(line => {
                                    line = line.trim();
                                    if (line && !line.startsWith('#')) {
                                        let absoluteUrl = line;
                                        if (!line.startsWith('http')) {
                                            absoluteUrl = new URL(line, encM3u8Url).href;
                                        }
                                        const cacheBuster = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
                                        return `/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}&ext=.ts&_cb=${cacheBuster}`;
                                    }
                                    return line;
                                }).join('\n');
                                
                                // Send rewritten m3u8 directly (no redirect needed)
                                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                                res.setHeader('Cache-Control', 'no-store, no-cache');
                                res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                                return res.send(rewritten);
                            }
                        }
                        
                        // Fallback: if not encrypted (future-proof for pU return)
                        if (streamData.pU) {
                            proxyUrl = `/api/proxy/stream?url=${encodeURIComponent(streamData.pU)}&referer=${encodeURIComponent(embedBase + "/")}&origin=${encodeURIComponent(embedBase)}`;
                        }
                    }
                }
            } catch (e) {
                console.error("NguonC AES-GCM proxy extraction failed:", e);
            }
        }

        if (!proxyUrl) {
            const data = await plugin.extractStream(episodeId);
            if (!data || !data.url) {
                return res.status(500).send("Cannot extract stream from plugin");
            }
            proxyUrl = `/api/proxy/stream?url=${encodeURIComponent(data.url)}&referer=${encodeURIComponent(data.headers?.Referer || "")}&origin=${encodeURIComponent(data.headers?.Origin || "")}`;
        }
        
        res.redirect(proxyUrl);
    } catch (e) {
        console.error("Plugin proxy error:", e);
        res.status(500).send("Internal Plugin Error");
    }
});

module.exports = router;
