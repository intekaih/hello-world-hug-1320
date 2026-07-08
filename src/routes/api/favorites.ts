import { createFileRoute } from "@tanstack/react-router";

export type FavoriteItem = {
  movie_slug: string;
  movie_name: string;
  movie_origin_name?: string;
  movie_thumb: string;
  createdAt: number;
};

const store: Map<string, FavoriteItem> = ((globalThis as unknown as {
  __favoritesStore?: Map<string, FavoriteItem>;
}).__favoritesStore ??= new Map());

function authed(request: Request) {
  return /mcc_session=/.test(request.headers.get("cookie") ?? "");
}

function seedIfEmpty() {
  if (store.size > 0) return;
  const IMG = (p: string) => `https://image.tmdb.org/t/p/w500${p}`;
  const seed: FavoriteItem[] = [
    { movie_slug: "oppenheimer", movie_name: "Oppenheimer", movie_origin_name: "Oppenheimer",
      movie_thumb: IMG("/fB4M9fjPr9HkfCZFEE7lqNoxDgU.png"), createdAt: Date.now() - 100000 },
    { movie_slug: "the-batman", movie_name: "The Batman", movie_origin_name: "The Batman",
      movie_thumb: IMG("/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg"), createdAt: Date.now() - 200000 },
    { movie_slug: "interstellar", movie_name: "Interstellar", movie_origin_name: "Interstellar",
      movie_thumb: IMG("/pbrkL804c8yAv3zBZR4QPEafpAR.jpg"), createdAt: Date.now() - 300000 },
  ];
  for (const s of seed) store.set(s.movie_slug, s);
}

export const Route = createFileRoute("/api/favorites")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authed(request)) return Response.json({ items: [] });
        seedIfEmpty();
        const items = Array.from(store.values()).sort((a, b) => b.createdAt - a.createdAt);
        return Response.json({ items });
      },
      DELETE: async ({ request }) => {
        if (!authed(request)) return new Response("Unauthorized", { status: 401 });
        store.clear();
        return Response.json({ ok: true });
      },
    },
  },
});

export { store as favoritesStore };
