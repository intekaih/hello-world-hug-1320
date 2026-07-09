import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getCatalog } from "@/lib/catalog";

export default defineTool({
  name: "search_movies",
  title: "Search movies",
  description:
    "Full-text search across the MovieCC public catalog. Filter by type, category, country, year, quality, or language. Returns paginated cards from the active CatalogSource (KKPhim if configured, else the mock pool).",
  inputSchema: {
    q: z.string().trim().optional().describe("Free-text title query."),
    type: z
      .enum(["phim-bo", "phim-le", "hoat-hinh", "tv-shows"])
      .optional()
      .describe("Catalog type filter."),
    category: z.string().optional().describe("Category slug (e.g. 'hanh-dong')."),
    country: z.string().optional().describe("Country slug (e.g. 'my', 'nhat-ban')."),
    year: z.number().int().optional().describe("Release year."),
    quality: z.enum(["4K", "FHD", "HD"]).optional(),
    language: z.enum(["Vietsub", "Lồng tiếng", "Thuyết minh"]).optional(),
    page: z.number().int().optional().describe("1-based page number. Default 1."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input) => {
    const payload = await getCatalog().search(input);
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
