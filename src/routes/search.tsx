import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — Stream" },
      { name: "description", content: "Search movies, shows and actors." },
    ],
  }),
  component: () => (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Search</h1>
      <p className="text-foreground-muted">Find something to watch.</p>
    </div>
  ),
});
