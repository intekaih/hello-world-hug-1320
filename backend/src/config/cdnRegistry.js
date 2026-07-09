/**
 * CDN Detection Registry
 *
 * Maps CDN hostnames to correct Referer headers for proxy requests.
 * Adding a new movie source only requires adding an entry here.
 * Returns null for unknown hosts — caller decides fallback behavior.
 *
 * IMPORTANT: More specific streaming entries MUST come before generic entries
 * because detectReferer() returns the first match.
 */

const CDN_REGISTRY = [
  {
    name: "kkphim-stream",
    hosts: ["kkphimplayer"],
    referer: "https://player.phimapi.com/",
    altReferer: "https://phimapi.com/",
  },
  {
    name: "nguonc-stream",
    hosts: ["phimmoi", "sing.phimmoi"],
    referer: "https://streamc.xyz/",
    altReferer: "https://phim.nguonc.com/",
  },
  {
    name: "ophim-stream",
    hosts: ["opstream"],
    referer: "https://ophim1.com/",
    altReferer: "https://ophim17.cc/",
  },
  {
    name: "ophim",
    hosts: ["ophim", "img.ophim"],
    referer: "https://ophim1.com/",
  },
  {
    name: "kkphim",
    hosts: ["kkphim", "phimimg", "phimapi", "s3.phim", "cdnphim", "phimhd", "vip.phim"],
    referer: "https://phimapi.com/",
  },
  {
    name: "nguonc",
    hosts: ["nguonc", "streamc"],
    referer: "https://phim.nguonc.com/",
  },
  {
    name: "hh3d-fbcdn",
    hosts: ["fbcdn.cloud", "fbcdn.net", "yanhh3d"],
    referer: "https://yanhh3d.ad/",
  },
];

/**
 * Detect the correct Referer header for a given CDN hostname.
 * @param {string} hostname — e.g. "sing.phimmoi.net"
 * @returns {string|null} referer URL or null if unknown
 */
function detectReferer(hostname) {
  if (!hostname) return null;
  for (const cdn of CDN_REGISTRY) {
    if (cdn.hosts.some((h) => hostname.includes(h))) {
      return cdn.referer;
    }
  }
  return null;
}

/**
 * Detect the alternative Referer for retry attempts.
 * @param {string} hostname
 * @returns {string|null}
 */
function detectAltReferer(hostname) {
  if (!hostname) return null;
  for (const cdn of CDN_REGISTRY) {
    if (cdn.hosts.some((h) => hostname.includes(h))) {
      return cdn.altReferer || null;
    }
  }
  return null;
}

/**
 * Get the origin (without trailing slash) for a given hostname.
 * @param {string} hostname
 * @returns {string|null}
 */
function detectOrigin(hostname) {
  const referer = detectReferer(hostname);
  return referer ? referer.replace(/\/$/, "") : null;
}

module.exports = { CDN_REGISTRY, detectReferer, detectAltReferer, detectOrigin };
