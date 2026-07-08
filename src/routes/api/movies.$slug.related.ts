import { createFileRoute } from "@tanstack/react-router";
import { RELATED } from "./movies.$slug";

export const Route = createFileRoute("/api/movies/$slug/related")({
  server: {
    handlers: {
      GET: async () => Response.json(RELATED),
    },
  },
});
