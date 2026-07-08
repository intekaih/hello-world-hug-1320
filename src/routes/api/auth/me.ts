import { createFileRoute } from "@tanstack/react-router";
import { USERS } from "./login";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cookie = request.headers.get("cookie") ?? "";
        const match = /mcc_session=([^;]+)/.exec(cookie);
        if (!match) return Response.json({ user: null }, { status: 200 });
        try {
          const decoded = atob(match[1]!);
          const userId = decoded.split(":")[0];
          const record = Object.values(USERS).find((u) => u.user.id === userId);
          if (!record) return Response.json({ user: null });
          return Response.json({ user: record.user });
        } catch {
          return Response.json({ user: null });
        }
      },
    },
  },
});
