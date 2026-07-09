import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_movie",
  title: "Get movie details",
  description:
    "Fetch full details for one movie or series by its slug: overview, cast, director, categories, poster, backdrop, trailer, and episode count.",
  inputSchema: {
    slug: z.string().min(1).describe("Movie slug, e.g. 'dune-part-two' or 'shogun'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }) => {
    // Reuse the existing route to keep a single source of truth.
    const base = process.env.SITE_URL ?? "http://localhost:8080";
    const res = await fetch(`${base}/api/movies/${encodeURIComponent(slug)}`);
    if (res.status === 404) {
      return { content: [{ type: "text", text: `No movie found for slug "${slug}"` }], isError: true };
    }
    if (!res.ok) {
      return { content: [{ type: "text", text: `Upstream error ${res.status}` }], isError: true };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: data,
    };
  },
});
