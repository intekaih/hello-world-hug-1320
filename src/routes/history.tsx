import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — Stream" },
      { name: "description", content: "Your recently watched titles." },
    ],
  }),
  component: () => (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">History</h1>
      <p className="text-foreground-muted">Pick up where you left off.</p>
    </div>
  ),
});
