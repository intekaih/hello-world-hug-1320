import { createFileRoute } from "@tanstack/react-router";

type Entry = { position: number; duration: number; updatedAt: number };
const store: Map<string, Entry> = ((globalThis as unknown as {
  __historyStore?: Map<string, Entry>;
}).__historyStore ??= new Map());

const key = (slug: string, ep: string) => `${slug}::${ep}`;

export const Route = createFileRoute("/api/history")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            slug?: string;
            episode?: string;
            position?: number;
            duration?: number;
          };
          if (!body.slug || !body.episode) {
            return new Response("Missing slug/episode", { status: 400 });
          }
          store.set(key(body.slug, body.episode), {
            position: Math.max(0, Number(body.position) || 0),
            duration: Math.max(0, Number(body.duration) || 0),
            updatedAt: Date.now(),
          });
          return Response.json({ ok: true });
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
      },
    },
  },
});
