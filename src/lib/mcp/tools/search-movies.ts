import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { EXPANDED_POOL, slugify, toCard } from "../data";

export default defineTool({
  name: "search_movies",
  title: "Search movies",
  description:
    "Full-text search across the MovieCC public catalog. Filter by type, category, country, year, quality, or language. Returns paginated cards.",
  inputSchema: {
    q: z.string().trim().optional().describe("Free-text title query. Case-insensitive."),
    type: z
      .enum(["phim-bo", "phim-le", "hoat-hinh", "tv-shows"])
      .optional()
      .describe("Catalog type: series, movie, animation, or TV show."),
    category: z.string().optional().describe("Category slug (e.g. 'hanh-dong')."),
    country: z.string().optional().describe("Country slug (e.g. 'my', 'nhat-ban')."),
    year: z.number().int().optional().describe("Release year."),
    quality: z.enum(["4K", "FHD", "HD"]).optional(),
    language: z.enum(["Vietsub", "Lồng tiếng", "Thuyết minh"]).optional(),
    page: z.number().int().optional().describe("1-based page number. Default 1."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ q, type, category, country, year, quality, language, page }) => {
    const PAGE_SIZE = 24;
    const p = Math.max(1, page ?? 1);
    let items = EXPANDED_POOL.slice();
    const qq = (q ?? "").trim().toLowerCase();
    if (qq) items = items.filter((m) => m.title.toLowerCase().includes(qq));
    if (type) items = items.filter((m) => m.type === type);
    if (category) items = items.filter((m) => m.category.some((c) => slugify(c) === category));
    if (country) items = items.filter((m) => m.country.some((c) => slugify(c) === country));
    if (year) items = items.filter((m) => m.year === year);
    if (quality) items = items.filter((m) => m.quality === quality);
    if (language) items = items.filter((m) => m.language === language);

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const start = (p - 1) * PAGE_SIZE;
    const paged = items.slice(start, start + PAGE_SIZE).map(toCard);
    const structured = { items: paged, page: p, totalPages, total };
    return {
      content: [{ type: "text", text: JSON.stringify(structured) }],
      structuredContent: structured,
    };
  },
});
