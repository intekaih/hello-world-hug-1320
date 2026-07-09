// Shared helpers for MCP tools. Import pool data directly (avoids self-fetch)
// and reuse the same filtering shape as the /api/* handlers.
import { browsePool, slugify, type BrowseMovie } from "@/routes/api/browse";

export { browsePool, slugify };
export type { BrowseMovie };

// Same "expanded" pool used by /api/search, so search results match the site.
export const EXPANDED_POOL: BrowseMovie[] = Array.from({ length: 4 }).flatMap((_, i) =>
  browsePool.map((m) => ({
    ...m,
    id: m.id + i * 10000,
    title: i === 0 ? m.title : `${m.title} ${i + 1}`,
    slug: i === 0 ? m.slug : `${m.slug}-${i + 1}`,
  })),
);

export function toCard(m: BrowseMovie) {
  return {
    id: m.id,
    slug: m.slug,
    title: m.title,
    year: m.year,
    rating: m.rating,
    poster_url: m.poster_url,
    type: m.type,
    quality: m.quality,
    language: m.language,
    category: m.category,
    country: m.country,
  };
}
