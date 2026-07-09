import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { browsePool, toCard } from "../data";

export default defineTool({
  name: "browse_catalog",
  title: "Browse catalog",
  description:
    "List the base MovieCC public catalog without a query. Useful for exploring what's available. Returns up to `limit` cards.",
  inputSchema: {
    limit: z.number().int().optional().describe("Max number of results. Default 50, max 200."),
    offset: z.number().int().optional().describe("How many items to skip. Default 0."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ limit, offset }) => {
    const l = Math.min(200, Math.max(1, limit ?? 50));
    const o = Math.max(0, offset ?? 0);
    const items = browsePool.slice(o, o + l).map(toCard);
    const payload = { items, total: browsePool.length, offset: o, limit: l };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
