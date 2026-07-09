import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getCatalog } from "@/lib/catalog";

export default defineTool({
  name: "browse_catalog",
  title: "Browse catalog",
  description:
    "Page through the MovieCC catalog without a query. Backed by the active CatalogSource.",
  inputSchema: {
    type: z
      .enum(["phim-bo", "phim-le", "hoat-hinh", "tv-shows"])
      .optional()
      .describe("Catalog type."),
    category: z.string().optional(),
    country: z.string().optional(),
    year: z.number().int().optional(),
    sort: z.enum(["newest", "oldest", "rating", "az"]).optional(),
    page: z.number().int().optional(),
    limit: z.number().int().optional().describe("Page size. Default 24, max 200."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, ...rest }) => {
    const pageSize = Math.min(200, Math.max(1, limit ?? 24));
    const payload = await getCatalog().browse({ ...rest, pageSize });
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
