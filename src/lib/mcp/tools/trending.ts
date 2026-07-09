import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getCatalog } from "@/lib/catalog";

export default defineTool({
  name: "trending",
  title: "Trending movies",
  description: "Top-rated titles from the active CatalogSource.",
  inputSchema: {
    limit: z.number().int().optional().describe("Max results. Default 18, max 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }) => {
    const l = Math.min(50, Math.max(1, limit ?? 18));
    const items = await getCatalog().trending(l);
    const payload = { items, total: items.length };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
