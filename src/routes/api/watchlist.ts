import { createFileRoute } from "@tanstack/react-router";

export type WatchlistItem = {
  movie_slug: string;
  movie_name: string;
  movie_origin_name?: string;
  movie_thumb: string;
  note?: string;
  runtime?: number; // minutes — used for total-hours estimate
  createdAt: number;
};

const store: Map<string, WatchlistItem> = ((globalThis as unknown as {
  __watchlistStore?: Map<string, WatchlistItem>;
}).__watchlistStore ??= new Map());

function authed(request: Request) {
  return /mcc_session=/.test(request.headers.get("cookie") ?? "");
}

function seedIfEmpty() {
  if (store.size > 0) return;
  const IMG = (p: string) => `https://image.tmdb.org/t/p/w500${p}`;
  const seed: WatchlistItem[] = [
    { movie_slug: "house-of-the-dragon", movie_name: "House of the Dragon",
      movie_origin_name: "House of the Dragon",
      movie_thumb: IMG("/z2yahl2uefxDCl0nogcRBstwruJ.jpg"),
      note: "Xem sau khi hết Shogun",
      createdAt: Date.now() - 100000 },
    { movie_slug: "3-body-problem", movie_name: "3 Body Problem", movie_origin_name: "3 Body Problem",
      movie_thumb: IMG("/yzD9Kf4vjSy5cJefz25f7Y4B9tt.jpg"), createdAt: Date.now() - 200000 },
    { movie_slug: "wednesday", movie_name: "Wednesday", movie_origin_name: "Wednesday",
      movie_thumb: IMG("/9PFonBhy4cQy7Jz20NpMygczOkv.jpg"), createdAt: Date.now() - 300000 },
  ];
  for (const s of seed) store.set(s.movie_slug, s);
}

export const Route = createFileRoute("/api/watchlist")({
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

export { store as watchlistStore };
