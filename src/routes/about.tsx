import { createFileRoute } from "@tanstack/react-router";
import { Film, Heart, Shield, Zap } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Giới thiệu — movieCC" },
      { name: "description", content: "movieCC — nền tảng xem phim online miễn phí, tối ưu cho mọi thiết bị." },
      { property: "og:title", content: "Giới thiệu — movieCC" },
      { property: "og:description", content: "movieCC — nền tảng xem phim online miễn phí." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="text-center">
        <h1 className="font-display text-4xl font-bold text-foreground">Về movieCC</h1>
        <p className="mt-3 text-foreground/70">
          Nền tảng xem phim online miễn phí, hỗ trợ đa nền tảng — desktop, mobile web và Android.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { icon: Film, title: "Kho phim khổng lồ", desc: "Phim bộ, phim lẻ, anime cập nhật hàng ngày." },
          { icon: Zap, title: "Xem mượt", desc: "HLS streaming tối ưu cho mọi tốc độ mạng." },
          { icon: Shield, title: "Bảo mật", desc: "Session-based auth, CSRF, không quảng cáo malware." },
          { icon: Heart, title: "Miễn phí", desc: "Toàn bộ nội dung miễn phí — chỉ cần đăng ký." },
        ].map((f) => (
          <div key={f.title} className="glass rounded-2xl border border-foreground/10 p-5">
            <f.icon className="mb-3 h-6 w-6 text-primary" />
            <h3 className="font-semibold text-foreground">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
