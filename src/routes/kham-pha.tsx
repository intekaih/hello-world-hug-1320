import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Sparkles, Heart, Compass, LogIn, TrendingUp, Wand2 } from "lucide-react";

import type { DiscoverPayload, DiscoverMovie } from "./api/discover";
import { useAuthStore, selectIsAuthenticated } from "@/store/authStore";

async function fetchDiscover(): Promise<DiscoverPayload> {
  const res = await fetch("/api/discover", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
}

export const Route = createFileRoute("/kham-pha")({
  component: DiscoverPage,
  head: () => ({
    meta: [
      { title: "Khám phá — Gợi ý cá nhân hóa | MovieCC" },
      {
        name: "description",
        content:
          "Trang khám phá cá nhân hóa: AI phân tích phim bạn yêu thích để gợi ý những tựa phim hợp gu nhất.",
      },
    ],
  }),
});

function PosterCard({ movie, index }: { movie: DiscoverMovie; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.4 }}
      className="group relative shrink-0"
    >
      <Link
        to="/phim/$slug"
        params={{ slug: movie.slug }}
        className="block w-[150px] sm:w-[170px] md:w-[190px]"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-white/5 transition-all duration-500 group-hover:ring-2 group-hover:ring-primary/60 group-hover:shadow-[0_20px_60px_-15px_rgba(234,88,12,0.6)]">
          <img
            src={movie.poster_url}
            alt={movie.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100" />
          <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-primary/90">
              ⭐ {movie.rating.toFixed(1)} · {movie.year}
            </p>
          </div>
          {movie.reason && (
            <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur">
              {movie.reason}
            </div>
          )}
        </div>
        <p className="mt-2 line-clamp-1 text-sm font-medium text-foreground/90 group-hover:text-primary transition-colors">
          {movie.title}
        </p>
      </Link>
    </motion.div>
  );
}

function Rail({
  eyebrow,
  title,
  subtitle,
  items,
  icon,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  items: DiscoverMovie[];
  icon?: React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <div className="flex items-center gap-2 text-primary/80">
            {icon}
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">
              {eyebrow}
            </span>
          </div>
          <h2 className="mt-1 font-display text-xl font-bold text-foreground md:text-2xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-3 md:gap-4">
        {items.map((m, i) => (
          <PosterCard key={`${m.id}-${m.slug}`} movie={m} index={i} />
        ))}
      </div>
    </section>
  );
}

function TasteHero({
  data,
  isAuthed,
}: {
  data: DiscoverPayload;
  isAuthed: boolean;
}) {
  const t = data.tasteProfile;
  const backdrop = data.forYou[0]?.poster_url ?? data.trending[0]?.poster_url;

  return (
    <div className="dark relative overflow-hidden rounded-3xl bg-black text-white shadow-2xl">
      {backdrop && (
        <>
          <div
            className="absolute inset-0 scale-110 blur-3xl opacity-40"
            style={{
              backgroundImage: `url(${backdrop})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/90" />
        </>
      )}
      <div className="relative px-6 py-10 md:px-10 md:py-14">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary backdrop-blur">
            <Sparkles className="h-3 w-3" />
            {isAuthed && data.personalized ? "Dành riêng cho bạn" : "Khám phá"}
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight md:text-5xl">
            {t ? t.headline : "Những tựa phim đang bùng nổ"}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/70 md:text-base">
            {t
              ? t.subline
              : isAuthed
                ? "Thả tim vài bộ phim để chúng tôi bắt đầu học gu của bạn."
                : "Đăng nhập và thả tim phim yêu thích để nhận gợi ý được cá nhân hóa bằng AI."}
          </p>

          {t && (
            <div className="mt-6 flex flex-wrap gap-2">
              {t.topGenres.map((g) => (
                <span
                  key={g.name}
                  className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {g.name}
                </span>
              ))}
              {t.topCountries.map((c) => (
                <span
                  key={c.name}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-white/80"
                >
                  {c.name}
                </span>
              ))}
            </div>
          )}

          {!isAuthed && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:shadow-primary/60"
              >
                <LogIn className="h-4 w-4" />
                Đăng nhập để cá nhân hóa
              </Link>
              <Link
                to="/browse/$type"
                params={{ type: "phim-bo" }}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/90 backdrop-blur hover:bg-white/10"
              >
                Duyệt thư viện
              </Link>
            </div>
          )}
          {isAuthed && !data.personalized && (
            <div className="mt-6">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/30 hover:shadow-primary/60"
              >
                <Heart className="h-4 w-4" />
                Bắt đầu thả tim phim
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function DiscoverPage() {
  const isAuthed = useAuthStore(selectIsAuthenticated);
  const { data, isLoading, error } = useQuery({
    queryKey: ["discover", isAuthed],
    queryFn: fetchDiscover,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-6">
        <div className="h-64 animate-pulse rounded-3xl bg-muted" />
        <div className="space-y-6">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-5 w-48 animate-pulse rounded bg-muted" />
              <div className="flex gap-3">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div
                    key={j}
                    className="h-[270px] w-[170px] shrink-0 animate-pulse rounded-2xl bg-muted"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center">
        <p className="text-muted-foreground">Không tải được gợi ý. Vui lòng thử lại.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 p-4 md:p-6 md:space-y-14">
      <TasteHero data={data} isAuthed={isAuthed} />

      {data.because.map((b, i) => (
        <Rail
          key={b.seed.slug}
          eyebrow={`Vì bạn thích #${i + 1}`}
          title={`Vì bạn thích “${b.seed.title}”`}
          subtitle="Cùng thể loại · Cùng quốc gia sản xuất"
          items={b.items}
          icon={<Heart className="h-3.5 w-3.5 fill-primary" />}
        />
      ))}

      <Rail
        eyebrow={data.personalized ? "Đề xuất cho bạn" : "Đang thịnh hành"}
        title={data.personalized ? "Có thể bạn sẽ thích" : "Đang được xem nhiều nhất"}
        subtitle={
          data.personalized
            ? "Chọn lọc dựa trên toàn bộ danh sách yêu thích của bạn"
            : "Top phim đang bùng nổ trên MovieCC"
        }
        items={data.forYou}
        icon={
          data.personalized ? (
            <Wand2 className="h-3.5 w-3.5" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5" />
          )
        }
      />

      {data.newGenres.map((ng) => (
        <Rail
          key={ng.genre}
          eyebrow="Khám phá thể loại mới"
          title={`Bước ra vùng an toàn: ${ng.genre}`}
          subtitle={`Bạn chưa xem nhiều ${ng.genre} — hãy thử những tựa phim tốt nhất`}
          items={ng.items}
          icon={<Compass className="h-3.5 w-3.5" />}
        />
      ))}

      {data.personalized && (
        <Rail
          eyebrow="Trending"
          title="Đang được xem nhiều"
          items={data.trending}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
      )}
    </div>
  );
}
