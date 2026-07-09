/**
 * Cache Constants - Shared cache key prefixes and names
 *
 * These constants ensure consistent cache naming across providers.
 * Providers should use these when registering with the centralized cache.
 */

module.exports = {
  // Cache names (for centralized cache service)
  CACHE_NAMES: {
    HOME: 'home',
    DETAIL: 'detail',
    RELATED: 'related',
    PARTS: 'parts',
    M3U8: 'm3u8',
    REACT_API: 'reactApi',
    SUGGEST: 'suggest',
    TMDB_LOGO: 'tmdbLogo',
    TMDB_BACKDROP: 'tmdbBackdrop',
    NOTIFICATION_CHECK: 'notificationCheck',
    GEMINI: 'gemini',
    RECOMMENDATIONS: 'recommendations',
    PROVIDER: 'provider',
    PROVIDER_STALE: 'providerStale',
  },

  // Provider-specific cache key prefixes
  PROVIDER_KEYS: {
    NEW: 'new',
    DETAIL: 'detail',
    SEARCH: 'search',
    CATEGORY: 'cat',
    COUNTRY: 'country',
    TYPE: 'type',
    EPISODE: 'episode',
  },

  // TTL presets (seconds)
  TTL: {
    SHORT: 60,         // 1 minute
    MEDIUM: 180,      // 3 minutes
    LONG: 300,         // 5 minutes
    VERY_LONG: 600,   // 10 minutes
    DAY: 86400,       // 24 hours
  },
};
