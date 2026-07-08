import { createFileRoute } from "@tanstack/react-router";

// In-memory demo store. Replace with DB (Lovable Cloud) when persistence is needed.
type Entry = { position: number; duration: number; updatedAt: number };
const store: Map<string, Entry> = ((globalThis as unknown as {
  __historyStore?: Map<string, Entry>;
}).__historyStore ??= new Map());

const key = (slug: string, ep: string) => `${slug}::${ep}`;

export const Route = createFileRoute("/api/history/$slug/$ep")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const entry = store.get(key(params.slug, params.ep));
        return Response.json(entry ?? { position: 0, duration: 0 });
      },
    },
  },
});
