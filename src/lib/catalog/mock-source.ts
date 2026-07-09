/**
 * MockSource — CatalogSource backed by the in-repo pool from
 * `src/routes/api/browse.ts` (+ suggest-only titles merged in). Deterministic,
 * used as fallback when no upstream API base is configured.
 */
import { browsePool, slugify } from "@/routes/api/browse";
import { POOL as SUGGEST_POOL } from "@/routes/api/suggest";
import type {
  BrowseParams,
  CatalogCard,
  CatalogDetail,
  CatalogSource,
  Paged,
  SearchParams,
} from "./source";

const DEFAULT_PAGE_SIZE = 24;

const MERGED: CatalogCard[] = (() => {
  const known = new Set(browsePool.map((m) => m.title.toLowerCase()));
  const extras: CatalogCard[] = SUGGEST_POOL.filter(
    (s) => !known.has(s.title.toLowerCase()),
  ).map((s, i) => ({
    id: 90000 + i,
    slug: s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    title: s.title,
    origin_name: s.title,
    poster_url: `https://image.tmdb.org/t/p/w500${s.poster}`,
    year: s.year,
    rating: 7.5,
    quality: "FHD",
    language: "Vietsub",
    category: ["Chính kịch"],
    country: ["Mỹ"],
    type:
      s.type === "Phim bộ"
        ? "phim-bo"
        : s.type === "Anime"
          ? "hoat-hinh"
          : "phim-le",
  }));
  return [...browsePool, ...extras];
})();

const EXPANDED: CatalogCard[] = Array.from({ length: 4 }).flatMap((_, i) =>
  MERGED.map((m) => ({
    ...m,
    id: (typeof m.id === "number" ? m.id : 0) + i * 10000,
    title: i === 0 ? m.title : `${m.title} ${i + 1}`,
    slug: i === 0 ? m.slug : `${m.slug}-${i + 1}`,
  })),
);

function applyFilters(items: CatalogCard[], p: SearchParams): CatalogCard[] {
  let out = items;
  const q = (p.q ?? "").trim().toLowerCase();
  if (q) out = out.filter((m) => m.title.toLowerCase().includes(q));
  if (p.type) out = out.filter((m) => m.type === p.type);
  if (p.category)
    out = out.filter((m) => m.category.some((c) => slugify(c) === p.category));
  if (p.country)
    out = out.filter((m) => m.country.some((c) => slugify(c) === p.country));
  if (p.year) out = out.filter((m) => m.year === p.year);
  if (p.quality) out = out.filter((m) => m.quality === p.quality);
  if (p.language) out = out.filter((m) => m.language === p.language);
  return out;
}

function paginate(items: CatalogCard[], page: number, pageSize: number): Paged<CatalogCard> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.max(1, Math.min(page, totalPages));
  const start = (p - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: p, totalPages, total };
}

export const MockSource: CatalogSource = {
  id: "mock",

  async search(params) {
    const items = applyFilters(EXPANDED.slice(), params);
    return paginate(items, params.page ?? 1, params.pageSize ?? DEFAULT_PAGE_SIZE);
  },

  async browse(params) {
    let items = applyFilters(EXPANDED.slice(), params);
    const sort = params.sort ?? "newest";
    if (sort === "newest") items.sort((a, b) => b.year - a.year);
    else if (sort === "oldest") items.sort((a, b) => a.year - b.year);
    else if (sort === "rating") items.sort((a, b) => b.rating - a.rating);
    else if (sort === "az") items.sort((a, b) => a.title.localeCompare(b.title));
    return paginate(items, params.page ?? 1, params.pageSize ?? DEFAULT_PAGE_SIZE);
  },

  async detail(slug) {
    const base =
      MERGED.find((m) => m.slug === slug) ??
      EXPANDED.find((m) => m.slug === slug);
    if (!base) return null;
    const detail: CatalogDetail = {
      ...base,
      backdrop_url: base.poster_url.replace("/w500", "/original"),
      logo_url: "",
      trailer_url: "",
      overview: `${base.title} — nội dung phim đang được cập nhật.`,
      overview_vi: `${base.title} — nội dung phim đang được cập nhật.`,
      duration: base.type === "phim-bo" ? "45 phút/tập" : "1h 55m",
      age_rating: "PG-13",
      director: "",
      cast: [],
      total_episodes: base.type === "phim-bo" || base.type === "hoat-hinh" ? 10 : 1,
      parts: [],
    };
    return detail;
  },

  async trending(limit = 18) {
    const seen = new Set<string>();
    return browsePool
      .slice()
      .sort((a, b) => b.rating - a.rating || b.year - a.year)
      .filter((m) => (seen.has(m.slug) ? false : (seen.add(m.slug), true)))
      .slice(0, Math.max(1, limit));
  },

  async newReleases(limit = 20, type) {
    let pool = browsePool.slice();
    if (type) pool = pool.filter((m) => m.type === type);
    return pool
      .sort((a, b) => b.year - a.year || b.rating - a.rating)
      .slice(0, Math.max(1, limit));
  },
};

export { MERGED as MOCK_MERGED };
