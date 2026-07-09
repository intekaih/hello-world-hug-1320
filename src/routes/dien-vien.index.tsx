import { thumbSrc } from "@/utils/thumbSrc";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Search as SearchIcon, User } from "lucide-react";

type Actor = { slug: string; name: string; avatar_url: string; known_for: string[] };

export const Route = createFileRoute("/dien-vien/")({
  head: () => ({
    meta: [
      { title: "Tìm diễn viên — movieCC" },
      { name: "description", content: "Tìm phim theo diễn viên yêu thích." },
    ],
  }),
  component: ActorSearchPage,
});

function ActorSearchPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), 300);
    return () => clearTimeout(t);
  }, [input]);

  const query = useQuery<{ items: Actor[] }>({
    queryKey: ["actors", "search", debounced],
    queryFn: async ({ signal }) =>
      (await fetch(`/api/actors/search?q=${encodeURIComponent(debounced)}`, { signal })).json(),
  });

  const items = query.data?.items ?? [];

  const goToActor = (slug: string) =>
    navigate({ to: "/dien-vien/$name", params: { name: slug } });

  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
            <User className="h-7 w-7 text-foreground" />
          </div>
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground">Tìm phim theo diễn viên</h1>
        <p className="text-muted-foreground">
          Nhập tên diễn viên và khám phá toàn bộ tác phẩm của họ.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const first = items[0];
            if (input.trim()) {
              const slug = first
                ? first.slug
                : input.toLowerCase().replace(/[^a-z0-9]+/g, "-");
              goToActor(slug);
            }
          }}
          className="relative"
        >
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="VD: Timothée Chalamet, Zendaya..."
            className="h-14 w-full rounded-full border border-white/10 bg-black/40 pl-12 pr-32 text-base text-white placeholder:text-white/60 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-full bg-gradient-to-r from-primary to-primary/80 px-5 text-sm font-semibold text-white shadow-lg shadow-primary/30"
          >
            Tìm
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {(query.isLoading ? Array.from({ length: 12 }) : items).map((a, i) =>
          a ? (
            <motion.button
              key={(a as Actor).slug}
              onClick={() => goToActor((a as Actor).slug)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="glass group flex flex-col items-center gap-2 rounded-2xl border border-foreground/10 p-4 text-center transition hover:border-primary/50"
            >
              <img
                src={thumbSrc((a as Actor).avatar_url,{w:200})}
                alt=""
                loading="lazy"
                className="h-20 w-20 rounded-full bg-foreground/10 object-cover ring-2 ring-white/10 transition group-hover:ring-primary/60"
              />
              <div className="text-sm font-medium text-foreground group-hover:text-primary">
                {(a as Actor).name}
              </div>
              <div className="line-clamp-2 text-[11px] text-muted-foreground">
                {(a as Actor).known_for.join(" · ")}
              </div>
            </motion.button>
          ) : (
            <div key={i} className="glass space-y-2 rounded-2xl border border-foreground/10 p-4">
              <div className="mx-auto h-20 w-20 animate-pulse rounded-full bg-foreground/10" />
              <div className="mx-auto h-3 w-2/3 animate-pulse rounded bg-foreground/10" />
              <div className="mx-auto h-3 w-1/2 animate-pulse rounded bg-foreground/10" />
            </div>
          ),
        )}
      </div>

      {!query.isLoading && items.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">Không tìm thấy diễn viên nào.</p>
          <Link to="/browse/$type" params={{ type: "phim-moi-cap-nhat" }} className="mt-3 inline-block text-sm text-primary hover:underline">
            Duyệt phim mới cập nhật →
          </Link>
        </div>
      )}
    </div>
  );
}
