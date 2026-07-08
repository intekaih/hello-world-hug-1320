import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Stream" },
      { name: "description", content: "Manage your account." },
    ],
  }),
  component: () => (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Profile</h1>
      <p className="text-foreground-muted">Account settings & preferences.</p>
    </div>
  ),
});
