import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/browse")({
  head: () => ({
    meta: [
      { title: "Browse — Stream" },
      { name: "description", content: "Browse all movies and shows by genre." },
    ],
  }),
  component: () => (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Browse</h1>
      <p className="text-foreground-muted">Explore the full catalog.</p>
    </div>
  ),
});
