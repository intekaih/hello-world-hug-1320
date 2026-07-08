import { createFileRoute } from "@tanstack/react-router";
import { watchlistStore } from "./watchlist";

function authed(request: Request) {
  return /mcc_session=/.test(request.headers.get("cookie") ?? "");
}

export const Route = createFileRoute("/api/watchlist/note")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authed(request)) return new Response("Unauthorized", { status: 401 });
        try {
          const body = (await request.json()) as { movie_slug?: string; note?: string };
          if (!body.movie_slug) return new Response("Missing slug", { status: 400 });
          const item = watchlistStore.get(body.movie_slug);
          if (!item) return new Response("Not found", { status: 404 });
          item.note = (body.note ?? "").slice(0, 500);
          watchlistStore.set(body.movie_slug, item);
          return Response.json({ ok: true });
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
      },
    },
  },
});
