import { createFileRoute } from "@tanstack/react-router";
import { ACTORS } from "./actors.search";

const PAGE_SIZE = 12;

export const Route = createFileRoute("/api/actors/$name")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
        const actor = ACTORS.get(params.name);
        if (!actor) return Response.json({ actor: null, items: [], page, totalPages: 0, total: 0 });
        // Simulate an expanded filmography
        const all = Array.from({ length: 3 }).flatMap((_, k) =>
          actor.movies.map((m) => ({ ...m, id: m.id + k * 10000 })),
        );
        const total = all.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const start = (page - 1) * PAGE_SIZE;
        return Response.json({
          actor: {
            slug: actor.slug,
            name: actor.name,
            avatar_url: actor.avatar_url,
            known_for: actor.known_for,
            movie_count: total,
          },
          items: all.slice(start, start + PAGE_SIZE),
          page,
          totalPages,
          total,
        });
      },
    },
  },
});
