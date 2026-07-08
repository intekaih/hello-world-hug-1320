import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Stream" },
      { name: "description", content: "Latest updates and releases." },
    ],
  }),
  component: () => (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Notifications</h1>
      <p className="text-foreground-muted">You're all caught up.</p>
    </div>
  ),
});
