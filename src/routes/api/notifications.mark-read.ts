import { createFileRoute } from "@tanstack/react-router";
import { notificationsStore } from "./notifications";

export const Route = createFileRoute("/api/notifications/mark-read")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { id?: string; all?: boolean };
          if (body.all) {
            notificationsStore.forEach((n) => (n.read = true));
          } else if (body.id) {
            const n = notificationsStore.find((x) => x.id === body.id);
            if (n) n.read = true;
          } else {
            return new Response("Missing id or all", { status: 400 });
          }
          return Response.json({ ok: true });
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
      },
    },
  },
});
