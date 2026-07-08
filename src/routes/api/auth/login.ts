import { createFileRoute } from "@tanstack/react-router";

// Mock user database (demo only)
const USERS: Record<string, { password: string; user: { id: string; username: string; name: string; avatar_url: string } }> = {
  demo: {
    password: "demo1234",
    user: {
      id: "u_demo",
      username: "demo",
      name: "Demo User",
      avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=demo",
    },
  },
  admin: {
    password: "admin1234",
    user: {
      id: "u_admin",
      username: "admin",
      name: "Admin",
      avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
    },
  },
};

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await new Promise((r) => setTimeout(r, 500)); // simulate latency
        let body: { username?: string; password?: string; remember?: boolean } = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ success: false, error: "Invalid request" }, { status: 400 });
        }
        const username = (body.username ?? "").trim().toLowerCase();
        const password = body.password ?? "";
        const record = USERS[username];
        if (!record || record.password !== password) {
          return Response.json(
            { success: false, error: "Tên đăng nhập hoặc mật khẩu không đúng." },
            { status: 401 },
          );
        }
        const maxAge = body.remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
        const token = btoa(`${record.user.id}:${Date.now()}`);
        return new Response(
          JSON.stringify({ success: true, user: record.user }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "set-cookie": `mcc_session=${token}; Path=/; Max-Age=${maxAge}; SameSite=Lax`,
            },
          },
        );
      },
    },
  },
});

export { USERS };
