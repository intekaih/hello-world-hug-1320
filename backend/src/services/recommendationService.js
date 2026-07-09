/**
 * F10: Recommendation Service — Item-based collaborative filter
 *
 * Strategy:
 *  1. Lấy danh sách phim user A đã yêu thích (seed).
 *  2. Tìm các users B khác có chung ít nhất 1 phim với A (co-favorite).
 *  3. Đếm tần suất các phim B yêu thích nhưng A chưa yêu thích (candidate).
 *  4. Sắp xếp theo score (số user co-favorite cùng phim đó) → top N.
 *  5. Fallback: nếu user mới (không có favorites), recommend từ history hoặc trending.
 *
 * Cache 30 phút mỗi user. Recompute khi user thêm/bớt favorite cũng OK.
 */

const { Favorite, WatchHistory } = require("../models");
const { cache } = require("../core/cache");

const recommendationCache = cache.recommendations;

async function getRecommendations(userId, sourceManager, limit = 12) {
  const cacheKey = `rec:${userId}:${limit}`;
  const hit = recommendationCache.get(cacheKey);
  if (hit) return hit;

  const out = await computeRecommendations(userId, sourceManager, limit);
  recommendationCache.set(cacheKey, out);
  return out;
}

async function computeRecommendations(userId, sourceManager, limit) {
  // 1. Seed: phim user đã yêu thích
  const myFavs = await Favorite.find({ user_id: userId })
    .select("movie_slug")
    .lean();
  const mySlugSet = new Set(myFavs.map((f) => f.movie_slug));

  // 2. Cold start: user mới chưa có favorites → fallback dùng history hoặc trending
  if (mySlugSet.size === 0) {
    return fallbackRecommend(userId, sourceManager, limit);
  }

  // 3-5. Aggregation pipeline — tính score trực tiếp trong Mongo, bounded
  // và chỉ trả về tối đa `limit*3` candidates (sau khi loại slug user đã có).
  // Tránh tải hàng nghìn docs về Node và scan O(n).
  const mySlugArr = [...mySlugSet];
  const ranked = await Favorite.aggregate([
    // Bước 1: tìm peers có chung favorite (limit 200)
    { $match: { movie_slug: { $in: mySlugArr }, user_id: { $ne: userId } } },
    { $group: { _id: "$user_id" } },
    { $limit: 200 },
    // Bước 2: lấy favorites của các peers đó (bounded join)
    {
      $lookup: {
        from: "favorites",
        let: { peerId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$user_id", "$$peerId"] } } },
          { $limit: 50 }, // mỗi peer chỉ lấy tối đa 50 favorites
          { $project: { _id: 0, movie_slug: 1, movie_name: 1, movie_thumb: 1, movie_origin_name: 1, last_episode: 1 } },
        ],
        as: "favs",
      },
    },
    { $unwind: "$favs" },
    // Bước 3: loại bỏ phim user đã có
    { $match: { "favs.movie_slug": { $nin: mySlugArr } } },
    // Bước 4: group + đếm score
    {
      $group: {
        _id: "$favs.movie_slug",
        score: { $sum: 1 },
        name: { $first: "$favs.movie_name" },
        thumb_url: { $first: "$favs.movie_thumb" },
        origin_name: { $first: "$favs.movie_origin_name" },
        episode_current: { $first: "$favs.last_episode" },
      },
    },
    { $sort: { score: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        slug: "$_id",
        score: 1,
        name: 1,
        thumb_url: 1,
        origin_name: 1,
        episode_current: { $ifNull: ["$episode_current", "Full"] },
      },
    },
  ]).option({ maxTimeMS: 4000 });

  if (ranked.length === 0) {
    return fallbackRecommend(userId, sourceManager, limit);
  }

  if (ranked.length < Math.min(6, limit)) {
    // Quá ít → bổ sung từ trending fallback
    const fb = await fallbackRecommend(userId, sourceManager, limit - ranked.length);
    const haveSlugs = new Set(ranked.map((r) => r.slug));
    for (const f of fb) {
      if (haveSlugs.has(f.slug)) continue;
      ranked.push(f);
      if (ranked.length >= limit) break;
    }
  }

  return ranked.map((r) => ({
    name: r.name || r.slug,
    slug: r.slug,
    thumb_url: r.thumb_url || "",
    poster_url: r.thumb_url || "",
    origin_name: r.origin_name || "",
    episode_current: r.episode_current || "Full",
    year: 0,
    quality: "HD",
    lang: "Vietsub",
    type: "series",
    category: [],
    country: [],
    content: "",
    rating: 0,
    _score: r.score,
  }));
}

async function fallbackRecommend(userId, sourceManager, limit) {
  // Lấy lịch sử user → tìm phim cùng category trong trending
  const recent = await WatchHistory.find({ user_id: userId })
    .sort({ last_watched: -1 })
    .limit(5)
    .lean();

  if (recent.length === 0 && sourceManager) {
    // Hoàn toàn cold → trả phim mới nhất
    try {
      const data = await sourceManager.fetchAllNewMovies(1);
      return (data?.items || []).slice(0, limit);
    } catch {
      return [];
    }
  }

  // Có history → trending để recommend
  if (sourceManager) {
    try {
      const data = await sourceManager.fetchAllNewMovies(1);
      const watched = new Set(recent.map((r) => r.movie_slug));
      return (data?.items || [])
        .filter((m) => !watched.has(m.slug))
        .slice(0, limit);
    } catch {
      return [];
    }
  }
  return [];
}

function invalidateUserCache(userId) {
  const keys = cache.keys().filter((k) => k.startsWith(`rec:${userId}:`));
  keys.forEach((k) => cache.del(k));
}

module.exports = { getRecommendations, invalidateUserCache };
