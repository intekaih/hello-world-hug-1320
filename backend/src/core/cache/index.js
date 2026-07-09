/**
 * Centralized Cache Service
 *
 * Provides unified cache management across the application.
 * Currently uses NodeCache, but is designed for Redis migration.
 *
 * To enable Redis:
 * 1. Set USE_REDIS=true
 * 2. Configure REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
 * 3. npm install redis
 *
 * Usage:
 *   const { cache } = require('../core/cache');
 */

const NodeCache = require("node-cache");

// ── Pre-configured cache instances ─────────────────────────────────────────────

const cache = {
  /**
   * Homepage cache - short TTL for fresh content
   * TTL: 90s, MaxKeys: 50
   */
  home: new NodeCache({
    stdTTL: 90,
    checkperiod: 60,
    maxKeys: 50,
    deleteOnExpire: true,
  }),

  /**
   * Movie detail cache - medium TTL
   * TTL: 180s, MaxKeys: 200
   */
  detail: new NodeCache({
    stdTTL: 180,
    checkperiod: 120,
    maxKeys: 200,
    deleteOnExpire: true,
  }),

  /**
   * Related movies cache - longer TTL
   * TTL: 300s, MaxKeys: 150
   */
  related: new NodeCache({
    stdTTL: 300,
    checkperiod: 120,
    maxKeys: 150,
    deleteOnExpire: true,
  }),

  /**
   * Movie parts/seasons cache
   * TTL: 600s, MaxKeys: 100
   */
  parts: new NodeCache({
    stdTTL: 600,
    checkperiod: 120,
    maxKeys: 100,
    deleteOnExpire: true,
  }),

  /**
   * M3U8/stream cache - medium TTL
   * TTL: 300s, MaxKeys: 50
   */
  m3u8: new NodeCache({
    stdTTL: 300,
    checkperiod: 60,
    maxKeys: 50,
    deleteOnExpire: true,
  }),

  /**
   * React API cache - shared across all /api/react endpoints
   * TTL: 60s, MaxKeys: 500
   */
  reactApi: new NodeCache({
    stdTTL: 60,
    checkperiod: 60,
    maxKeys: 500,
    deleteOnExpire: true,
  }),

  /**
   * Search suggestion cache - short TTL for real-time results
   * TTL: 60s, MaxKeys: 200
   */
  suggest: new NodeCache({
    stdTTL: 60,
    checkperiod: 30,
    maxKeys: 200,
    deleteOnExpire: true,
  }),

  /**
   * TMDB logo cache - very long TTL for static assets
   * TTL: 24h, MaxKeys: 500
   */
  tmdbLogo: new NodeCache({
    stdTTL: 86400,
    checkperiod: 3600,
    maxKeys: 500,
    deleteOnExpire: true,
  }),

  /**
   * TMDB backdrop cache
   * TTL: 24h, MaxKeys: 500
   */
  tmdbBackdrop: new NodeCache({
    stdTTL: 86400,
    checkperiod: 3600,
    maxKeys: 500,
    deleteOnExpire: true,
  }),

  /**
   * Notification check cache - per user, short TTL
   * TTL: 300s, MaxKeys: 1000
   */
  notificationCheck: new NodeCache({
    stdTTL: 300,
    checkperiod: 120,
    maxKeys: 1000,
    deleteOnExpire: true,
  }),

  /**
   * Gemini translation cache - long TTL for translations
   * TTL: 1h, MaxKeys: 5000
   */
  gemini: new NodeCache({
    stdTTL: 3600,
    checkperiod: 600,
    maxKeys: 5000,
    deleteOnExpire: true,
  }),

  /**
   * Recommendations cache - long TTL
   * TTL: 30min, MaxKeys: 5000
   */
  recommendations: new NodeCache({
    stdTTL: 1800,
    checkperiod: 300,
    maxKeys: 5000,
    deleteOnExpire: true,
  }),

  /**
   * Generic provider cache for BaseApiProvider
   * TTL: configurable, Default MaxKeys: 500
   */
  provider: new NodeCache({
    stdTTL: 300,
    checkperiod: 120,
    maxKeys: 500,
    deleteOnExpire: true,
  }),

  /**
   * Stale cache for providers - 24h fallback
   */
  providerStale: new NodeCache({
    stdTTL: 86400,
    checkperiod: 3600,
    maxKeys: 500,
    deleteOnExpire: true,
  }),
};

// ── Cache utilities ────────────────────────────────────────────────────────────

/**
 * Periodic cleanup to prevent memory bloat
 * Run this on app startup
 */
function setupCacheCleanup() {
  const MAX_KEYS_THRESHOLD = 400;

  setInterval(() => {
    const stats = cache.reactApi.getStats();
    if (stats.keys > MAX_KEYS_THRESHOLD) {
      cache.reactApi.flushAll();
      console.log(`[Cache] Flushed reactApi cache (${stats.keys} keys)`);
    }
  }, 5 * 60 * 1000);
}

/**
 * Get all cache stats for monitoring
 */
function getCacheStats() {
  const stats = {};
  for (const [name, instance] of Object.entries(cache)) {
    if (instance.getStats) {
      stats[name] = instance.getStats();
    }
  }
  return stats;
}

// ── Redis Adapter (Future) ────────────────────────────────────────────────────
// To enable Redis, set USE_REDIS=true and install redis package:
// npm install redis
//
// const USE_REDIS = process.env.USE_REDIS === "true";
//
// async function getRedisClient() {
//   const { createClient } = require("redis");
//   const client = createClient({
//     socket: { host: process.env.REDIS_HOST, port: parseInt(process.env.REDIS_PORT) },
//     password: process.env.REDIS_PASSWORD,
//   });
//   await client.connect();
//   return client;
// }

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  cache,
  setupCacheCleanup,
  getCacheStats,
};
