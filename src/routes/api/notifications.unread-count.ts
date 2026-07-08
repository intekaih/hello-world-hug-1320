import { createFileRoute } from "@tanstack/react-router";
import { notificationsStore } from "./notifications";

export const Route = createFileRoute("/api/notifications/unread-count")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ count: notificationsStore.filter((n) => !n.read).length }),
    },
  },
});
