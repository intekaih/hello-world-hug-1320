import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Favorites — Stream" },
      { name: "description", content: "Titles you loved." },
    ],
  }),
  component: () => (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Favorites</h1>
      <p className="text-foreground-muted">Everything you starred.</p>
    </div>
  ),
});
