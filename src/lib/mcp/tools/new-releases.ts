import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getCatalog } from "@/lib/catalog";

export default defineTool({
  name: "new_releases",
  title: "New releases",
  description: "Most recent titles from the active CatalogSource.",
  inputSchema: {
    limit: z.number().int().optional().describe("Max results. Default 20, max 50."),
    type: z
      .enum(["phim-bo", "phim-le", "hoat-hinh", "tv-shows"])
      .optional()
      .describe("Optional catalog type filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, type }) => {
    const l = Math.min(50, Math.max(1, limit ?? 20));
    const items = await getCatalog().newReleases(l, type);
    const payload = { items, total: items.length };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
