import { createFileRoute } from "@tanstack/react-router";

type HistoryEntry = {
  position: number;
  duration: number;
  updatedAt: number;
  slug: string;
  episode: string;
  name?: string;
  origin_name?: string;
  thumb?: string;
  totalEpisodes?: number;
};

const store: Map<string, HistoryEntry> = ((globalThis as unknown as {
  __historyStore?: Map<string, HistoryEntry>;
}).__historyStore ??= new Map());

const key = (slug: string, ep: string) => `${slug}::${ep}`;

function requireAuth(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return /mcc_session=/.test(cookie);
}

// Seed a few items for demo when list is empty and user is authed
function seedIfEmpty() {
  if (store.size > 0) return;
  const seed: HistoryEntry[] = [
    {
      slug: "shogun", episode: "8", position: 1260, duration: 3000,
      updatedAt: Date.now() - 1000 * 60 * 30,
      name: "Shogun", origin_name: "Shōgun",
      thumb: "https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WnzG1AInL.jpg",
      totalEpisodes: 10,
    },
    {
      slug: "dune-part-two", episode: "1", position: 6234, duration: 9960,
      updatedAt: Date.now() - 1000 * 60 * 60 * 3,
      name: "Dune: Part Two", origin_name: "Dune: Part Two",
      thumb: "https://image.tmdb.org/t/p/w500/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
    },
    {
      slug: "the-bear", episode: "5", position: 540, duration: 1800,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24,
      name: "The Bear", origin_name: "The Bear",
      thumb: "https://image.tmdb.org/t/p/w500/zPyHtXA8NLdrGDsPvBhI0pZfM63.jpg",
      totalEpisodes: 10,
    },
    {
      slug: "fallout", episode: "3", position: 300, duration: 3600,
      updatedAt: Date.now() - 1000 * 60 * 60 * 48,
      name: "Fallout", origin_name: "Fallout",
      thumb: "https://image.tmdb.org/t/p/w500/AnsSKmcvZuJRB6tIF3TrmYuwLwT.jpg",
      totalEpisodes: 8,
    },
  ];
  for (const s of seed) store.set(key(s.slug, s.episode), s);
}

export const Route = createFileRoute("/api/history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!requireAuth(request)) return Response.json({ items: [] });
        seedIfEmpty();
        // Keep only most recent episode per slug
        const latestBySlug = new Map<string, HistoryEntry>();
        for (const entry of store.values()) {
          const prev = latestBySlug.get(entry.slug);
          if (!prev || prev.updatedAt < entry.updatedAt) latestBySlug.set(entry.slug, entry);
        }
        const items = Array.from(latestBySlug.values()).sort((a, b) => b.updatedAt - a.updatedAt);
        return Response.json({ items });
      },
      POST: async ({ request }) => {
        if (!requireAuth(request)) return new Response("Unauthorized", { status: 401 });
        try {
          const body = (await request.json()) as Partial<HistoryEntry>;
          if (!body.slug || !body.episode) {
            return new Response("Missing slug/episode", { status: 400 });
          }
          const prev = store.get(key(body.slug, body.episode));
          store.set(key(body.slug, body.episode), {
            slug: body.slug,
            episode: body.episode,
            position: Math.max(0, Number(body.position) || 0),
            duration: Math.max(0, Number(body.duration) || 0),
            updatedAt: Date.now(),
            name: body.name ?? prev?.name,
            origin_name: body.origin_name ?? prev?.origin_name,
            thumb: body.thumb ?? prev?.thumb,
            totalEpisodes: body.totalEpisodes ?? prev?.totalEpisodes,
          });
          return Response.json({ ok: true });
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
      },
      DELETE: async ({ request }) => {
        if (!requireAuth(request)) return new Response("Unauthorized", { status: 401 });
        const url = new URL(request.url);
        const slug = url.searchParams.get("slug");
        if (slug) {
          for (const k of Array.from(store.keys())) {
            if (k.startsWith(`${slug}::`)) store.delete(k);
          }
        } else {
          store.clear();
        }
        return Response.json({ ok: true });
      },
    },
  },
});
