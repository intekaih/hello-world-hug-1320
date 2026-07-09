import { createFileRoute } from "@tanstack/react-router";
import { browsePool } from "../browse";

/**
 * Full browse pool — used by the client-side recommendation engine.
 * Small payload (~40 items), cached aggressively. Keeps recommendation
 * scoring on the client where it belongs.
 */
export const Route = createFileRoute("/api/movies/pool")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify({ items: browsePool }), {
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=300",
          },
        }),
    },
  },
});
