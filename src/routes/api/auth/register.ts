import { createFileRoute } from "@tanstack/react-router";

// Demo-only in-memory store. Replace with Lovable Cloud auth when wiring real backend.
const REGISTERED = new Map<string, { password: string; name: string }>();

export const Route = createFileRoute("/api/auth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { username?: string; password?: string; name?: string } = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ success: false, error: "Invalid request" }, { status: 400 });
        }
        const username = (body.username ?? "").trim().toLowerCase();
        const password = body.password ?? "";
        const name = (body.name ?? username).trim();

        if (!username || username.length < 3) {
          return Response.json({ success: false, error: "Tên đăng nhập tối thiểu 3 ký tự." }, { status: 400 });
        }
        if (password.length < 6) {
          return Response.json({ success: false, error: "Mật khẩu tối thiểu 6 ký tự." }, { status: 400 });
        }
        if (REGISTERED.has(username)) {
          return Response.json({ success: false, error: "Tên đăng nhập đã tồn tại." }, { status: 409 });
        }
        REGISTERED.set(username, { password, name });

        const user = {
          id: `u_${username}`,
          username,
          name,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
        };
        const token = btoa(`${user.id}:${Date.now()}`);
        return new Response(JSON.stringify({ success: true, user }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie": `mcc_session=${token}; Path=/; Max-Age=${60 * 60 * 24}; SameSite=Lax`,
          },
        });
      },
    },
  },
});
