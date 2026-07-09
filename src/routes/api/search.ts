import { createFileRoute } from "@tanstack/react-router";
import { browsePool, slugify } from "./browse";
import { POOL as SUGGEST_POOL } from "./suggest";

const PAGE_SIZE = 24;

/** Fold suggest-only titles (e.g. Twisters, Furiosa) into the main pool so
 *  suggestions never point at a search that returns zero rows. Matched by
 *  case-insensitive title. */
const MERGED = (() => {
  const known = new Set(browsePool.map((m) => m.title.toLowerCase()));
  const extras = SUGGEST_POOL.filter(
    (s) => !known.has(s.title.toLowerCase()),
  ).map((s, i) => ({
    id: 90000 + i,
    slug: s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    title: s.title,
    origin_name: s.title,
    poster_url: `https://image.tmdb.org/t/p/w500${s.poster}`,
    year: s.year,
    rating: 7.5,
    quality: "FHD" as const,
    language: "Vietsub" as const,
    category: ["Chính kịch"],
    country: ["Mỹ"],
    type:
      s.type === "Phim bộ"
        ? ("phim-bo" as const)
        : s.type === "Anime"
          ? ("hoat-hinh" as const)
          : ("phim-le" as const),
  }));
  return [...browsePool, ...extras];
})();

// Expand pool with variants to simulate many results (deterministic).
const EXPANDED = Array.from({ length: 4 }).flatMap((_, i) =>
  MERGED.map((m) => ({
    ...m,
    id: m.id + i * 10000,
    title: i === 0 ? m.title : `${m.title} ${i + 1}`,
    slug: i === 0 ? m.slug : `${m.slug}-${i + 1}`,
  })),
);


export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
        const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
        const type = url.searchParams.get("type") ?? "";
        const category = url.searchParams.get("category") ?? "";
        const country = url.searchParams.get("country") ?? "";
        const year = url.searchParams.get("year") ?? "";
        const quality = url.searchParams.get("quality") ?? "";
        const language = url.searchParams.get("language") ?? "";

        // Small latency so skeleton shows
        await new Promise((r) => setTimeout(r, 220));

        if (!q && !type && !category && !country && !year && !quality && !language) {
          return Response.json({ items: [], page, totalPages: 0, total: 0 });
        }

        let items = EXPANDED.slice();
        if (q) items = items.filter((m) => m.title.toLowerCase().includes(q));
        if (type) items = items.filter((m) => m.type === type);
        if (category)
          items = items.filter((m) => m.category.some((c) => slugify(c) === category));
        if (country)
          items = items.filter((m) => m.country.some((c) => slugify(c) === country));
        if (year) items = items.filter((m) => String(m.year) === year);
        if (quality) items = items.filter((m) => m.quality === quality);
        if (language) items = items.filter((m) => m.language === language);

        const total = items.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const start = (page - 1) * PAGE_SIZE;
        const paged = items.slice(start, start + PAGE_SIZE).map((m) => ({
          id: m.id,
          title: m.title,
          slug: m.slug,
          year: m.year,
          rating: m.rating,
          poster_url: m.poster_url,
          type: m.type,
          quality: m.quality,
          language: m.language,
          category: m.category,
          country: m.country,
        }));
        return Response.json({ items: paged, page, totalPages, total });
      },
    },
  },
});
