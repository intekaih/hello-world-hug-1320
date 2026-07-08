import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bookmark,
  Calendar,
  ChevronRight,
  Clock,
  Film,
  Globe,
  Heart,
  Languages,
  Play,
  Share2,
  Star,
  User,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Movie = {
  slug: string;
  title: string;
  original_title: string;
  year: number;
  duration: string;
  quality: string;
  language: string;
  rating: number;
  age_rating: string;
  backdrop_url: string;
  poster_url: string;
  logo_url: string;
  trailer_url?: string;
  overview: string;
  overview_vi?: string;
  categories: string[];
  country: string;
  director: string;
  cast: string[];
  total_episodes: number;
  parts: { slug: string; label: string; year: number }[];
};

type RelatedItem = {
  slug: string;
  title: string;
  poster_url: string;
  year: number;
  rating: number;
};

export const Route = createFileRoute("/phim/$slug")({
  component: MovieDetailPage,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Stream` },
      { name: "description", content: `Xem phim ${params.slug} miễn phí` },
      { property: "og:title", content: `${params.slug} — Stream` },
    ],
  }),
});

function MovieDetailPage() {
  const { slug } = Route.useParams();

  const movieQ = useQuery({
    queryKey: ["movie", slug],
    queryFn: async () => {
      const res = await fetch(`/api/movies/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json() as Promise<Movie>;
    },
  });

  const relatedQ = useQuery({
    queryKey: ["movie", slug, "related"],
    queryFn: async () => {
      const res = await fetch(`/api/movies/${slug}/related`);
      if (!res.ok) return [] as RelatedItem[];
      return res.json() as Promise<RelatedItem[]>;
    },
    enabled: movieQ.isSuccess,
  });

  if (movieQ.isLoading) return <DetailSkeleton />;

  if (movieQ.isError || !movieQ.data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-foreground-muted">Không tìm thấy phim này.</p>
        <Link
          to="/"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Về trang chủ
        </Link>
      </div>
    );
  }

  const movie = movieQ.data;

  return (
    <div className="space-y-10">
      <HeroSection movie={movie} />

      <ActionBar movie={movie} />

      <Overview movie={movie} />

      <MetaInfo movie={movie} />

      <CategoryChips categories={movie.categories} />

      {movie.total_episodes > 1 && (
        <EpisodePreview slug={movie.slug} total={movie.total_episodes} />
      )}

      {movie.parts.length > 1 && (
        <SeriesPartsNav parts={movie.parts} currentSlug={movie.slug} />
      )}

      <RelatedMovies
        items={relatedQ.data ?? []}
        loading={relatedQ.isLoading}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                      */
/* -------------------------------------------------------------------------- */

function HeroSection({ movie }: { movie: Movie }) {
  return (
    <section className="relative -mx-4 h-[60vh] min-h-[440px] overflow-hidden sm:-mx-6 sm:h-[70vh] lg:-mx-8 lg:rounded-3xl">
      <img
        src={movie.backdrop_url}
        alt=""
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/40 to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0 flex items-end p-4 sm:p-8 lg:p-12"
      >
        <div className="max-w-2xl space-y-3">
          {movie.logo_url ? (
            <img
              src={movie.logo_url}
              alt={movie.title}
              className="max-h-24 w-auto max-w-[70%] object-contain drop-shadow-2xl sm:max-h-32"
            />
          ) : (
            <h1 className="font-display text-3xl font-bold sm:text-5xl">
              {movie.title}
            </h1>
          )}

          {movie.original_title && movie.original_title !== movie.title && (
            <p className="text-sm text-foreground-subtle sm:text-base">
              {movie.original_title}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="inline-flex items-center gap-1 rounded-md bg-gold/15 px-2 py-0.5 font-semibold text-gold">
              <Star className="h-3 w-3 fill-current" />
              {movie.rating.toFixed(1)}
            </span>
            <span className="rounded border border-white/25 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">
              {movie.age_rating}
            </span>
            <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
              {movie.quality}
            </span>
            <span className="rounded bg-cyan/15 px-2 py-0.5 text-xs font-semibold text-cyan">
              {movie.language}
            </span>
            <span className="text-foreground-muted">{movie.year}</span>
            <span aria-hidden className="text-foreground-subtle">·</span>
            <span className="text-foreground-muted">{movie.duration}</span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Action bar                                                                */
/* -------------------------------------------------------------------------- */

function ActionBar({ movie }: { movie: Movie }) {
  const [fav, setFav] = useState(false);
  const [wl, setWl] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      setFav(localStorage.getItem(`fav:${movie.slug}`) === "1");
      setWl(localStorage.getItem(`wl:${movie.slug}`) === "1");
    } catch {}
  }, [movie.slug]);

  const persist = (key: string, v: boolean) => {
    try {
      if (v) localStorage.setItem(key, "1");
      else localStorage.removeItem(key);
    } catch {}
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ url, title: movie.title });
      else await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <Link
        to="/xem/$slug/tap-{$episode}"
        params={{ slug: movie.slug, episode: "1" }}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow-primary)] transition hover:brightness-110"
      >
        <Play className="h-4 w-4 fill-current" /> Xem ngay
      </Link>

      <ActionButton
        active={fav}
        onClick={() => {
          const next = !fav;
          setFav(next);
          persist(`fav:${movie.slug}`, next);
        }}
        icon={Heart}
        label="Yêu thích"
        activeClass="text-primary border-primary/40 bg-primary/10"
      />
      <ActionButton
        active={wl}
        onClick={() => {
          const next = !wl;
          setWl(next);
          persist(`wl:${movie.slug}`, next);
        }}
        icon={Bookmark}
        label="Xem sau"
        activeClass="text-cyan border-cyan/40 bg-cyan/10"
      />
      <ActionButton
        active={false}
        onClick={share}
        icon={Share2}
        label={copied ? "Đã copy" : "Chia sẻ"}
        activeClass=""
      />

      {movie.trailer_url && (
        <a
          href={movie.trailer_url}
          target="_blank"
          rel="noreferrer"
          className="glass inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-white/10"
        >
          <Film className="h-4 w-4" /> Trailer
        </a>
      )}
    </div>
  );
}

function ActionButton({
  active,
  onClick,
  icon: Icon,
  label,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Heart;
  label: string;
  activeClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-sm font-medium text-foreground-muted transition hover:bg-white/5 hover:text-foreground",
        active && activeClass,
      )}
    >
      <Icon className={cn("h-4 w-4", active && "fill-current")} />
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Overview + translate                                                      */
/* -------------------------------------------------------------------------- */

function Overview({ movie }: { movie: Movie }) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [showVi, setShowVi] = useState(false);
  const [loading, setLoading] = useState(false);

  const onToggle = async () => {
    if (translated) {
      setShowVi((v) => !v);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: movie.overview,
          target: "vi",
          hint: movie.overview_vi,
        }),
      });
      const data = (await res.json()) as { text: string };
      setTranslated(data.text);
      setShowVi(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-semibold">Nội dung</h2>
        <button
          onClick={onToggle}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-foreground-muted transition hover:bg-white/5 hover:text-foreground disabled:opacity-50"
        >
          <Languages className="h-3.5 w-3.5" />
          {showVi ? "Original" : loading ? "Đang dịch…" : "Dịch tiếng Việt"}
        </button>
      </div>
      <p className="max-w-4xl text-sm leading-relaxed text-foreground-muted sm:text-base">
        {showVi && translated ? translated : movie.overview}
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Meta info                                                                 */
/* -------------------------------------------------------------------------- */

function MetaInfo({ movie }: { movie: Movie }) {
  const rows: [typeof User, string, string][] = [
    [User, "Đạo diễn", movie.director],
    [Users, "Diễn viên", movie.cast.join(", ")],
    [Globe, "Quốc gia", movie.country],
    [Calendar, "Năm sản xuất", String(movie.year)],
    [Clock, "Thời lượng", movie.duration],
  ];

  return (
    <section className="glass rounded-2xl p-4 sm:p-6">
      <h2 className="mb-4 font-display text-lg font-semibold">Thông tin</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([Icon, k, v]) => (
          <div key={k} className="flex items-start gap-3 text-sm">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground-subtle" />
            <div className="min-w-0">
              <dt className="text-xs uppercase tracking-wider text-foreground-subtle">
                {k}
              </dt>
              <dd className="mt-0.5 text-foreground">{v}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CategoryChips({ categories }: { categories: string[] }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold">Thể loại</h2>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Link
            key={c}
            to="/browse"
            className="glass rounded-full px-3 py-1.5 text-sm font-medium text-foreground-muted transition hover:bg-primary/15 hover:text-primary"
          >
            {c}
          </Link>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Episode preview                                                           */
/* -------------------------------------------------------------------------- */

function EpisodePreview({ slug, total }: { slug: string; total: number }) {
  const preview = Array.from({ length: Math.min(12, total) }).map((_, i) => i + 1);
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Danh sách tập</h2>
          <p className="text-xs text-foreground-subtle">{total} tập</p>
        </div>
        <Link
          to="/xem/$slug/tap-{$episode}"
          params={{ slug, episode: "1" }}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Xem tất cả <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {preview.map((ep) => (
          <Link
            key={ep}
            to="/xem/$slug/tap-{$episode}"
            params={{ slug, episode: String(ep) }}
            className="glass rounded-lg py-2.5 text-center text-sm font-semibold transition hover:bg-primary/15 hover:text-primary"
          >
            {ep}
          </Link>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Series parts nav                                                          */
/* -------------------------------------------------------------------------- */

function SeriesPartsNav({
  parts,
  currentSlug,
}: {
  parts: { slug: string; label: string; year: number }[];
  currentSlug: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold">Các phần khác</h2>
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {parts.map((p) => {
          const active = p.slug === currentSlug;
          return (
            <Link
              key={p.slug}
              to="/phim/$slug"
              params={{ slug: p.slug }}
              className={cn(
                "shrink-0 rounded-xl border px-4 py-3 text-sm font-medium transition",
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-white/10 text-foreground-muted hover:bg-white/5 hover:text-foreground",
              )}
            >
              <div className="font-semibold">{p.label}</div>
              <div className="text-xs text-foreground-subtle">{p.year}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Related                                                                   */
/* -------------------------------------------------------------------------- */

function RelatedMovies({
  items,
  loading,
}: {
  items: RelatedItem[];
  loading: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold">Phim liên quan</h2>
      {loading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[2/3] w-full rounded-xl" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((m) => (
            <Link
              key={m.slug}
              to="/phim/$slug"
              params={{ slug: m.slug }}
              className="group"
            >
              <div className="aspect-[2/3] overflow-hidden rounded-xl bg-surface-elevated">
                <img
                  src={m.poster_url}
                  alt={m.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="mt-2 space-y-0.5">
                <p className="truncate text-sm font-medium">{m.title}</p>
                <div className="flex items-center gap-1.5 text-xs text-foreground-subtle">
                  <Star className="h-3 w-3 fill-gold text-gold" />
                  <span>{m.rating.toFixed(1)}</span>
                  <span aria-hidden>·</span>
                  <span>{m.year}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeleton                                                                  */
/* -------------------------------------------------------------------------- */

function DetailSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="-mx-4 h-[60vh] min-h-[440px] rounded-none sm:-mx-6 lg:-mx-8 lg:rounded-3xl" />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-32 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
      </div>
      <Skeleton className="h-24 w-full max-w-4xl" />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
