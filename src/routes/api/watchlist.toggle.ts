import { createFileRoute } from "@tanstack/react-router";
import { watchlistStore, type WatchlistItem } from "./watchlist";

function authed(request: Request) {
  return /mcc_session=/.test(request.headers.get("cookie") ?? "");
}

export const Route = createFileRoute("/api/watchlist/toggle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authed(request)) return new Response("Unauthorized", { status: 401 });
        try {
          const body = (await request.json()) as Partial<WatchlistItem>;
          if (!body.movie_slug || !body.movie_name || !body.movie_thumb) {
            return new Response("Missing fields", { status: 400 });
          }
          if (watchlistStore.has(body.movie_slug)) {
            watchlistStore.delete(body.movie_slug);
            return Response.json({ ok: true, saved: false });
          }
          watchlistStore.set(body.movie_slug, {
            movie_slug: body.movie_slug,
            movie_name: body.movie_name,
            movie_origin_name: body.movie_origin_name,
            movie_thumb: body.movie_thumb,
            createdAt: Date.now(),
          });
          return Response.json({ ok: true, saved: true });
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
      },
    },
  },
});
