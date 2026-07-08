import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/anime")({
  head: () => ({
    meta: [
      { title: "Anime — movieCC" },
      { name: "description", content: "Tuyển tập anime Vietsub & thuyết minh cập nhật mỗi ngày trên movieCC." },
      { property: "og:title", content: "Anime — movieCC" },
      { property: "og:description", content: "Tuyển tập anime Vietsub & thuyết minh cập nhật mỗi ngày." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AnimePage,
});

function AnimePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="glass rounded-3xl border border-white/5 p-8 text-center">
        <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h1 className="font-display text-3xl font-bold text-white">Anime</h1>
        <p className="mx-auto mt-2 max-w-xl text-white/60">
          Kho anime Vietsub & thuyết minh được cập nhật liên tục. Chọn thể loại bên dưới để bắt đầu.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/browse/$type"
            params={{ type: "hoat-hinh" }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Xem tất cả Anime
          </Link>
          <Link
            to="/browse/$type"
            params={{ type: "phim-moi" }}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-white/80 hover:border-primary/40 hover:text-white"
          >
            Phim mới
          </Link>
        </div>
      </div>
    </div>
  );
}
