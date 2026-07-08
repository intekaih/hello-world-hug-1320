import { thumbSrc } from "@/utils/thumbSrc";
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
import { useEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { RouteErrorBoundary, RouteNotFound } from "@/components/route-boundaries";
import { cn } from "@/lib/utils";
import { buildPageMeta } from "@/lib/page-meta";
import { usePageMeta } from "@/hooks/usePageMeta";


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
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => (
    <RouteNotFound
      title="Không tìm thấy phim"
      description="Phim bạn tìm không tồn tại hoặc đã bị gỡ khỏi hệ thống."
    />
  ),
  head: ({ params }) => {
    const nice = params.slug
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
    return {
      meta: buildPageMeta({
        title: `${nice} - movieCC`,
        description: `Xem phim ${nice} online Vietsub, thuyết minh, chất lượng HD miễn phí trên movieCC. Cập nhật tập mới nhanh nhất.`,
        url: `/phim/${params.slug}`,
        type: "video.movie",
      }),
      links: [{ rel: "canonical", href: `/phim/${params.slug}` }],
    };
  },
});


function MovieDetailPage() {
  const { slug } = Route.useParams();

  const movieQ = useQuery({
    queryKey: ["movie", slug],
    queryFn: async () => {
      const res = await fetch(`/api/movies/${slug}`);
      if (!res.ok) {
        const err = new Error(
          res.status === 404 ? "Không tìm thấy phim" : `Lỗi tải phim (${res.status})`,
        ) as Error & { status: number };
        err.status = res.status;
        throw err;
      }
      return res.json() as Promise<Movie>;
    },
    retry: (failureCount, error) => {
      const status = (error as { status?: number })?.status;
      if (status && status >= 400 && status < 500) return false;
      return failureCount < 2;
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

  const movieData = movieQ.data;
  usePageMeta(
    movieData
      ? {
          title: `${movieData.title} - movieCC`,
          description:
            movieData.overview_vi ||
            movieData.overview ||
            `Xem phim ${movieData.title} online HD Vietsub trên movieCC.`,
          url: `/phim/${slug}`,
          image: thumbSrc(movieData.backdrop_url || movieData.poster_url, {
            w: 1200,
          }),
          type: "video.movie",
        }
      : null,
  );

  if (movieQ.isLoading) return <DetailSkeleton />;

  if (movieQ.isError || !movieData) {
    const status = (movieQ.error as { status?: number } | null)?.status;
    if (status === 404) {
      return (
        <RouteNotFound
          title="Không tìm thấy phim"
          description="Phim bạn tìm không tồn tại hoặc đã bị gỡ khỏi hệ thống."
        />
      );
    }
    return (
      <RouteErrorBoundary
        error={(movieQ.error as Error) ?? new Error("Không tải được phim")}
        reset={() => movieQ.refetch()}
      />
    );
  }


  const movie: Movie = movieData;

  return (
    <div className="space-y-16 pb-8">
      <HeroSection movie={movie} />

      <div className="space-y-14">
        <Overview movie={movie} />

        {movie.cast.length > 0 && <CastRail cast={movie.cast} />}

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
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero — Cinematic Chamber                                                  */
/* -------------------------------------------------------------------------- */

function HeroSection({ movie }: { movie: Movie }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--px", `${x * 14}px`);
    el.style.setProperty("--py", `${y * 14}px`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--px", `0px`);
    el.style.setProperty("--py", `0px`);
  };

  return (
    <section
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative -mx-4 h-[90vh] min-h-[640px] overflow-hidden sm:-mx-6 lg:-mx-8 lg:rounded-[2rem]"
      style={{ ["--px" as string]: "0px", ["--py" as string]: "0px" }}
    >
      {/* Backdrop with Ken Burns + mouse parallax */}
      <div
        className="ken-burns absolute inset-0 will-change-transform"
        style={{ transform: "translate3d(var(--px), var(--py), 0) scale(1.06)" }}
      >
        <img
          src={thumbSrc(movie.backdrop_url, { w: 1920 })}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>

      {/* Aurora ambient tint */}
      <div className="aurora pointer-events-none absolute inset-0 mix-blend-soft-light opacity-70" />

      {/* Cinematic vignette + gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgb(0_0_0/0.55)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />

      {/* Film grain */}
      <div className="grain pointer-events-none absolute inset-0 opacity-40" />

      {/* Content */}
      <div className="absolute inset-0 flex items-end">
        <div className="w-full p-6 sm:p-10 lg:p-14">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            {/* Left: title stack */}
            <div className="max-w-2xl space-y-5">
              {/* Eyebrow */}
              <div className="flex items-center gap-3">
                <span className="inline-block h-px w-8 bg-gradient-to-r from-primary to-transparent" />
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/90">
                  {movie.categories[0] ?? "Feature"} · {movie.year}
                </span>
              </div>

              {/* Title / Logo */}
              {movie.logo_url ? (
                <img
                  src={thumbSrc(movie.logo_url, { w: 600 })}
                  alt={movie.title}
                  className="title-reveal max-h-28 w-auto max-w-[80%] object-contain drop-shadow-[0_10px_40px_rgba(0,0,0,0.6)] sm:max-h-40"
                />
              ) : (
                <h1 className="title-reveal font-display text-[clamp(2.5rem,7vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.02em] text-foreground drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                  {movie.title}
                </h1>
              )}

              {movie.original_title && movie.original_title !== movie.title && (
                <p className="font-serif text-base italic text-foreground-subtle sm:text-lg">
                  “{movie.original_title}”
                </p>
              )}

              {/* Meta rail */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/90">
                <span className="inline-flex items-center gap-1.5 text-gold">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {movie.rating.toFixed(1)}
                </span>
                <span aria-hidden className="text-primary/60">◆</span>
                <span className="rounded-sm border border-foreground/30 px-1.5 py-0.5 text-[10px] text-foreground/90">
                  {movie.age_rating}
                </span>
                <span aria-hidden className="text-primary/60">◆</span>
                <span className="text-foreground-muted">{movie.quality}</span>
                <span aria-hidden className="text-primary/60">◆</span>
                <span className="text-foreground-muted">{movie.language}</span>
                <span aria-hidden className="text-primary/60">◆</span>
                <span className="text-foreground-muted">{movie.duration}</span>
              </div>

              {/* Action bar */}
              <ActionBar movie={movie} />
            </div>

            {/* Right: floating poster (desktop) */}
            {movie.poster_url && (
              <motion.div
                initial={{ opacity: 0, y: 30, rotate: -2 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                className="hidden lg:block"
              >
                <div className="relative aspect-[2/3] w-64 overflow-hidden rounded-2xl shadow-[var(--shadow-cinematic)] ring-1 ring-white/10">
                  <img
                    src={thumbSrc(movie.poster_url, { w: 500 })}
                    alt={movie.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/5" />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
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
    <div className="flex flex-wrap items-center gap-2.5 pt-3 sm:gap-3">
      <Link
        to="/xem/$slug/tap-{$episode}"
        params={{ slug: movie.slug, episode: "1" }}
        className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_2px_10px_rgba(0,0,0,0.25),0_20px_40px_-15px_oklch(0.68_0.24_25/0.6),0_40px_80px_-30px_oklch(0.78_0.18_55/0.5)] transition-transform duration-500 hover:-translate-y-0.5"
        style={{ background: "var(--gradient-ember)" }}
      >
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <Play className="h-4 w-4 fill-current" />
        <span className="tracking-wide">Xem ngay</span>
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
          className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-background/40 px-4 py-2.5 text-sm font-medium text-foreground backdrop-blur-md transition hover:border-foreground/30 hover:bg-foreground/10"
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
        "inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-background/40 px-4 py-2.5 text-sm font-medium text-foreground-muted backdrop-blur-md transition hover:border-foreground/30 hover:bg-foreground/10 hover:text-foreground",
        active && activeClass,
      )}
    >
      <Icon className={cn("h-4 w-4", active && "fill-current")} />
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Overview                                                                  */
/* -------------------------------------------------------------------------- */

function Overview({ movie }: { movie: Movie }) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [showVi, setShowVi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  const text = showVi && translated ? translated : movie.overview;
  const long = text.length > 320;

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Synopsis"
        title="Nội dung phim"
        action={
          <button
            onClick={onToggle}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground-muted transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            <Languages className="h-3.5 w-3.5" />
            {showVi ? "Original" : loading ? "Đang dịch…" : "Tiếng Việt"}
          </button>
        }
      />
      <div className="relative max-w-4xl">
        <p
          className={cn(
            "text-[15px] leading-[1.85] text-foreground/85 sm:text-base",
            !expanded && long && "line-clamp-4",
          )}
        >
          <span className="mr-1.5 float-left font-display text-[3.5rem] font-semibold leading-[0.85] text-primary [text-shadow:0_2px_20px_oklch(0.68_0.24_25/0.4)]">
            {text.charAt(0)}
          </span>
          {text.slice(1)}
        </p>
        {long && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 font-mono text-[10px] uppercase tracking-[0.24em] text-primary transition hover:text-primary/80"
          >
            {expanded ? "— Thu gọn" : "+ Đọc tiếp"}
          </button>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Cast rail                                                                 */
/* -------------------------------------------------------------------------- */

function CastRail({ cast }: { cast: string[] }) {
  const initials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("");

  const palette = [
    "oklch(0.68 0.24 25)",
    "oklch(0.78 0.18 55)",
    "oklch(0.72 0.15 200)",
    "oklch(0.75 0.16 320)",
    "oklch(0.82 0.14 85)",
  ];

  return (
    <section className="space-y-4">
      <SectionHeader eyebrow="Cast" title="Diễn viên" />
      <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {cast.map((name, i) => (
          <Link
            key={name + i}
            to="/dien-vien/$name"
            params={{ name: name.toLowerCase().replace(/\s+/g, "-") }}
            className="group flex w-[110px] shrink-0 flex-col items-center gap-2.5 text-center"
          >
            <div
              className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full font-display text-xl font-semibold text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition duration-500 group-hover:ring-primary/60 group-hover:shadow-[0_20px_50px_-15px_oklch(0.68_0.24_25/0.5)]"
              style={{
                background: `linear-gradient(135deg, ${palette[i % palette.length]}, oklch(0.14 0.015 260))`,
              }}
            >
              {initials(name)}
              <span className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 transition group-hover:opacity-100" />
            </div>
            <span className="line-clamp-2 text-xs font-medium text-foreground-muted transition group-hover:text-foreground">
              {name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Meta info                                                                 */
/* -------------------------------------------------------------------------- */

function MetaInfo({ movie }: { movie: Movie }) {
  const rows: [typeof User, string, string][] = [
    [User, "Đạo diễn", movie.director],
    [Globe, "Quốc gia", movie.country],
    [Calendar, "Năm sản xuất", String(movie.year)],
    [Clock, "Thời lượng", movie.duration],
    [Film, "Chất lượng", movie.quality],
    [Users, "Ngôn ngữ", movie.language],
  ];

  return (
    <section className="space-y-4">
      <SectionHeader eyebrow="Details" title="Thông tin" />
      <dl className="grid divide-y divide-foreground/5 overflow-hidden rounded-2xl border border-foreground/8 bg-background/30 backdrop-blur-sm sm:grid-cols-2 sm:divide-y-0 sm:[&>*:nth-child(even)]:border-l sm:[&>*]:border-foreground/5 sm:[&>*:nth-child(n+3)]:border-t">
        {rows.map(([Icon, k, v]) => (
          <div key={k} className="flex items-start gap-4 p-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <dt className="font-mono text-[10px] uppercase tracking-[0.24em] text-foreground-subtle">
                {k}
              </dt>
              <dd className="mt-1 truncate text-sm font-medium text-foreground sm:text-base">
                {v || "—"}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CategoryChips({ categories }: { categories: string[] }) {
  return (
    <section className="space-y-4">
      <SectionHeader eyebrow="Genres" title="Thể loại" />
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Link
            key={c}
            to="/browse"
            className="group relative overflow-hidden rounded-full border border-foreground/12 bg-background/40 px-4 py-2 text-sm font-medium text-foreground-muted backdrop-blur-sm transition hover:border-primary/40 hover:text-primary"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
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
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Episodes"
        title="Danh sách tập"
        subtitle={`${total} tập`}
        action={
          <Link
            to="/xem/$slug/tap-{$episode}"
            params={{ slug, episode: "1" }}
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-primary transition hover:text-primary/80"
          >
            Xem tất cả <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {preview.map((ep) => (
          <Link
            key={ep}
            to="/xem/$slug/tap-{$episode}"
            params={{ slug, episode: String(ep) }}
            className="group relative overflow-hidden rounded-xl border border-foreground/10 bg-background/40 py-3.5 text-center font-mono text-sm font-semibold text-foreground-muted backdrop-blur-sm transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
          >
            <span className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition group-hover:opacity-100" />
            {String(ep).padStart(2, "0")}
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
    <section className="space-y-4">
      <SectionHeader eyebrow="Universe" title="Các phần khác" />
      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {parts.map((p) => {
          const active = p.slug === currentSlug;
          return (
            <Link
              key={p.slug}
              to="/phim/$slug"
              params={{ slug: p.slug }}
              className={cn(
                "group relative shrink-0 overflow-hidden rounded-2xl border px-5 py-4 text-sm font-medium transition",
                active
                  ? "border-primary/50 text-foreground"
                  : "border-foreground/10 bg-background/30 text-foreground-muted hover:border-primary/30 hover:text-foreground",
              )}
              style={active ? { background: "var(--gradient-ember)", color: "white" } : undefined}
            >
              <div className="font-display text-base font-semibold">{p.label}</div>
              <div className={cn("mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em]", active ? "text-white/70" : "text-foreground-subtle")}>
                {p.year}
              </div>
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
    <section className="space-y-4">
      <SectionHeader eyebrow="Discover" title="Phim liên quan" />
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
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-elevated ring-1 ring-white/5 transition duration-500 group-hover:ring-primary/40 group-hover:shadow-[0_20px_50px_-15px_oklch(0.68_0.24_25/0.4)]">
                <img
                  src={thumbSrc(m.poster_url, { w: 400 })}
                  alt={m.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.08]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
              </div>
              <div className="mt-2.5 space-y-0.5">
                <p className="truncate text-sm font-medium transition group-hover:text-primary">{m.title}</p>
                <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-subtle">
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
/*  Section header                                                            */
/* -------------------------------------------------------------------------- */

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-px w-6 bg-gradient-to-r from-primary to-transparent" />
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary/90">
            {eyebrow}
          </span>
        </div>
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-foreground-subtle">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeleton                                                                  */
/* -------------------------------------------------------------------------- */

function DetailSkeleton() {
  return (
    <div className="space-y-10">
      <Skeleton className="-mx-4 h-[90vh] min-h-[640px] rounded-none sm:-mx-6 lg:-mx-8 lg:rounded-[2rem]" />
      <Skeleton className="h-24 w-full max-w-4xl" />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
