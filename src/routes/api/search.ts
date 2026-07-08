import { createFileRoute } from "@tanstack/react-router";
import { POOL } from "./suggest";

const IMG = (path: string, size = "w500") =>
  `https://image.tmdb.org/t/p/${size}${path}`;

const PAGE_SIZE = 20;

// Expand pool with variants to simulate many results
const EXPANDED = Array.from({ length: 4 }).flatMap((_, i) =>
  POOL.map((m) => ({ ...m, id: m.id + i * 1000, title: i === 0 ? m.title : `${m.title} ${i + 1}` })),
);

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
        const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
        // Simulate latency for skeleton demo
        await new Promise((r) => setTimeout(r, 250));
        if (!q) {
          return Response.json({ items: [], page, totalPages: 0, total: 0 });
        }
        const matches = EXPANDED.filter((m) => m.title.toLowerCase().includes(q));
        const total = matches.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const start = (page - 1) * PAGE_SIZE;
        const items = matches.slice(start, start + PAGE_SIZE).map((m) => ({
          id: m.id,
          title: m.title,
          year: m.year,
          type: m.type,
          rating: 7.5 + (m.id % 25) / 10,
          poster_url: IMG(m.poster),
          slug: m.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        }));
        return Response.json({ items, page, totalPages, total });
      },
    },
  },
});
