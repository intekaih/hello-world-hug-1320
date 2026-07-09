import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getCatalog } from "@/lib/catalog";

export default defineTool({
  name: "get_movie",
  title: "Get movie details",
  description:
    "Fetch full details for one title by slug: overview, cast, director, categories, poster, backdrop, trailer, episode count. Reads the active CatalogSource in-process (no self-fetch).",
  inputSchema: {
    slug: z.string().min(1).describe("Movie slug, e.g. 'demon-slayer' or 'shogun'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }) => {
    const data = await getCatalog().detail(slug);
    if (!data) {
      return {
        content: [{ type: "text", text: `No movie found for slug "${slug}"` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: data as unknown as Record<string, unknown>,
    };
  },
});
