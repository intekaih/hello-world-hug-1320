import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist — Stream" },
      { name: "description", content: "Saved to watch later." },
    ],
  }),
  component: () => (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Watchlist</h1>
      <p className="text-foreground-muted">Queued up for later.</p>
    </div>
  ),
});
