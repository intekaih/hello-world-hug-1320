import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { browsePool, toCard } from "../data";

export default defineTool({
  name: "new_releases",
  title: "New releases",
  description: "Most recent titles in the catalog by release year (ties broken by rating).",
  inputSchema: {
    limit: z.number().int().optional().describe("Max results. Default 20, max 50."),
    type: z
      .enum(["phim-bo", "phim-le", "hoat-hinh", "tv-shows"])
      .optional()
      .describe("Optional catalog type filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ limit, type }) => {
    const l = Math.min(50, Math.max(1, limit ?? 20));
    let pool = browsePool.slice();
    if (type) pool = pool.filter((m) => m.type === type);
    const items = pool
      .sort((a, b) => b.year - a.year || b.rating - a.rating)
      .slice(0, l)
      .map(toCard);
    const payload = { items, total: items.length };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
