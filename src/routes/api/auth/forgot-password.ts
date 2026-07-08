import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/forgot-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await new Promise((r) => setTimeout(r, 700));
        try {
          const body = (await request.json()) as { identifier?: string };
          const id = (body.identifier ?? "").trim();
          if (!id) {
            return Response.json({ success: false, error: "Vui lòng nhập thông tin." }, { status: 400 });
          }
        } catch {
          return Response.json({ success: false, error: "Yêu cầu không hợp lệ." }, { status: 400 });
        }
        // Always return success to avoid account enumeration
        return Response.json({ success: true });
      },
    },
  },
});
