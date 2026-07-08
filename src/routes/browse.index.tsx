import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/browse/")({
  beforeLoad: () => {
    throw redirect({ to: "/browse/$type", params: { type: "phim-bo" } });
  },
});
