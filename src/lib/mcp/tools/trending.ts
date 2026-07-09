import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { browsePool, toCard } from "../data";

export default defineTool({
  name: "trending",
  title: "Trending movies",
  description:
    "Top-rated titles from the MovieCC catalog, sorted by rating then year. Unique by slug.",
  inputSchema: {
    limit: z.number().int().optional().describe("Max results. Default 18, max 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ limit }) => {
    const l = Math.min(50, Math.max(1, limit ?? 18));
    const seen = new Set<string>();
    const items = browsePool
      .slice()
      .sort((a, b) => b.rating - a.rating || b.year - a.year)
      .filter((m) => (seen.has(m.slug) ? false : (seen.add(m.slug), true)))
      .slice(0, l)
      .map(toCard);
    const payload = { items, total: items.length };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
