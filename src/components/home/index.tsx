import { thumbSrc } from "@/utils/thumbSrc";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Play,
  Plus,
  Star,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ExperienceCard } from "@/components/home/experience-card";
import type {
  ContinueWatchingItem,
  HeroMovie,
  MovieCard,
} from "@/lib/home-queries";
import { ease } from "@/lib/design";



function HeroTitle({ logo, title }: { logo?: string; title: string }) {
  const [ok, setOk] = useState(true);
  if (logo && ok) {
    return (
      <img
        src={thumbSrc(logo, { w: 640 })}
        alt={title}
        onError={() => setOk(false)}
        className="max-h-28 w-auto max-w-[80%] object-contain drop-shadow-[0_8px_30px_rgba(0,0,0,0.6)] sm:max-h-36"
      />
    );
  }
  return (
    <h1 className="font-display text-[clamp(2.5rem,7vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.02em] text-white drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
      {title}
    </h1>
  );
}

/* -------------------------------------------------------------------------- */
/*  HeroBanner                                                                */
/* -------------------------------------------------------------------------- */

export function HeroBanner({ movies }: { movies: HeroMovie[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (paused || movies.length <= 1) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % movies.length),
      6000,
    );
    return () => window.clearInterval(id);
  }, [paused, movies.length, index]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMouse({
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5,
    });
  };

  const movie = movies[index];
  if (!movie) return null;

  return (
    <section
      ref={sectionRef}
      className="dark relative -mx-4 h-[68vh] min-h-[520px] overflow-hidden bg-black text-white sm:-mx-6 sm:h-[78vh] lg:-mx-8 lg:rounded-[28px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        setMouse({ x: 0, y: 0 });
      }}
      onMouseMove={handleMouseMove}
      aria-roledescription="carousel"
    >
      {/* Backdrop — parallax + Ken Burns */}
      <AnimatePresence mode="sync">
        <motion.div
          key={movie.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: ease.outSoft }}
          className="absolute inset-0"
        >
          <div
            className="absolute inset-0 will-change-transform"
            style={{
              transform: `translate3d(${mouse.x * -18}px, ${mouse.y * -12}px, 0)`,
              transition: "transform 600ms var(--ease-out-soft)",
            }}
          >
            <img
              src={thumbSrc(movie.backdrop_url, { w: 1920 })}
              alt=""
              className="ken-burns h-[112%] w-[108%] -translate-x-[4%] -translate-y-[6%] object-cover"
            />
          </div>

          {/* Cinematic color grade */}
          <div className="pointer-events-none absolute inset-0 aurora opacity-70 mix-blend-soft-light" />

          {/* Bottom-up cinematic scrim */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          {/* Left-to-right darkening for text legibility */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/85 via-background/20 to-transparent" />
          {/* Vignette */}
          <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_45%,oklch(0_0_0/0.55)_100%)]" />
          {/* Film grain */}
          <div className="grain" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="absolute inset-0 flex items-end p-5 sm:p-10 lg:p-14">
        <motion.div
          key={`content-${movie.id}`}
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
          }}
          className="max-w-2xl space-y-5"
          style={{
            transform: `translate3d(${mouse.x * 8}px, ${mouse.y * 5}px, 0)`,
            transition: "transform 800ms var(--ease-out-soft)",
          }}
        >
          {/* Genre eyebrow */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.6, ease: ease.outSoft }}
            className="flex items-center gap-3"
          >
            <span className="h-px w-8 bg-primary" />
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/70">
              {movie.genres[0] ?? "Feature"} · Now streaming
            </span>
          </motion.div>

          {/* Title / logo */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 24, filter: "blur(14px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)" } }}
            transition={{ duration: 1, ease: ease.outSoft }}
          >
            <HeroTitle logo={movie.logo_url} title={movie.title} />

          </motion.div>

          {/* Meta rail */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.6 }}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/75"
          >
            <span className="rounded-sm border border-foreground/30 px-1.5 py-0.5 text-[10px]">
              {movie.rating}
            </span>
            <span>{movie.year}</span>
            <span aria-hidden className="text-primary">◆</span>
            <span>{movie.runtime}</span>
            <span aria-hidden className="text-primary">◆</span>
            <span>{movie.genres.join(" · ")}</span>
          </motion.div>

          {/* Overview */}
          <motion.p
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.6 }}
            className="max-w-xl text-[15px] leading-relaxed text-foreground/85 sm:text-base"
          >
            {movie.overview}
          </motion.p>

          {/* CTA */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.6 }}
            className="flex flex-wrap items-center gap-3 pt-2"
          >
            <Link
              to="/xem/$slug/tap-{$episode}"
              params={{ slug: movie.slug, episode: "1" }}
              className="group/cta relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-foreground px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-background shadow-[var(--shadow-cinematic)] transition-transform duration-300 hover:-translate-y-0.5"
            >
              <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 ease-out group-hover/cta:translate-x-full" />
              <Play className="h-4 w-4 fill-current" />
              <span>Xem ngay</span>
            </Link>
            <Link
              to="/phim/$slug"
              params={{ slug: movie.slug }}
              className="glass inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-medium uppercase tracking-[0.14em] text-foreground transition hover:bg-foreground/10"
            >
              <Info className="h-4 w-4" /> Chi tiết
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Progress rail — cinematic pagination */}
      <div className="absolute bottom-5 right-5 z-10 flex items-center gap-4 sm:bottom-8 sm:right-10">
        <span className="font-mono text-[11px] tracking-[0.24em] text-foreground/60">
          {String(index + 1).padStart(2, "0")}
          <span className="mx-1.5 text-foreground/30">/</span>
          {String(movies.length).padStart(2, "0")}
        </span>
        <div className="flex gap-2">
          {movies.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
              className="group relative h-[3px] w-10 overflow-hidden rounded-full bg-foreground/15"
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 bg-primary",
                  i < index && "w-full",
                  i === index && !paused && "hero-rail w-full",
                  i === index && paused && "w-full",
                  i > index && "w-0",
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HeroBannerSkeleton() {
  return (
    <div className="relative -mx-4 h-[62vh] min-h-[420px] overflow-hidden sm:-mx-6 sm:h-[70vh] lg:-mx-8 lg:rounded-3xl">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="absolute inset-0 flex items-end p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-xl space-y-3">
          <Skeleton className="h-24 w-64" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  CategoryChips                                                             */
/* -------------------------------------------------------------------------- */

const CATEGORIES = [
  "All",
  "Phim bộ",
  "Phim lẻ",
  "Anime",
  "TV Shows",
  "Thuyết minh",
  "Vietsub",
  "Hoạt hình",
  "Sắp chiếu",
];

export function CategoryChips() {
  const [active, setActive] = useState("All");
  return (
    <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {CATEGORIES.map((c) => {
        const isActive = c === active;
        return (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={cn(
              "relative shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium uppercase tracking-[0.12em] transition-colors",
              isActive ? "text-primary-foreground" : "text-foreground/70 hover:text-foreground",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="chip-pill"
                className="absolute inset-0 rounded-full bg-[var(--gradient-ember)] shadow-[0_10px_30px_-10px_var(--color-primary)]"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative">{c}</span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SectionHeader                                                             */
/* -------------------------------------------------------------------------- */

export function SectionHeader({
  title,
  subtitle,
  onScrollLeft,
  onScrollRight,
}: {
  title: string;
  subtitle?: string;
  onScrollLeft?: () => void;
  onScrollRight?: () => void;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="font-display text-xl font-bold sm:text-2xl">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-foreground-subtle">{subtitle}</p>
        )}
      </div>
      <div className="hidden gap-1 sm:flex">
        <button
          onClick={onScrollLeft}
          aria-label="Scroll left"
          className="glass grid h-9 w-9 place-items-center rounded-full transition hover:bg-foreground/10"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={onScrollRight}
          aria-label="Scroll right"
          className="glass grid h-9 w-9 place-items-center rounded-full transition hover:bg-foreground/10"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  MovieRow — horizontal scroll-snap                                         */
/* -------------------------------------------------------------------------- */

function useScroller() {
  const ref = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };
  return { ref, scrollBy };
}

export function MovieRow({
  title,
  subtitle,
  movies,
}: {
  title?: string;
  subtitle?: string;
  movies: MovieCard[];
}) {
  const { ref, scrollBy } = useScroller();

  return (
    <div className="space-y-3">
      {(title || subtitle) && (
        <SectionHeader
          title={title ?? ""}
          subtitle={subtitle}
          onScrollLeft={() => scrollBy(-1)}
          onScrollRight={() => scrollBy(1)}
        />
      )}
      <div
        ref={ref}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {movies.map((m) => (
          <ExperienceCard key={m.id} movie={m} />
        ))}
      </div>
    </div>
  );
}

function MoviePoster({ movie }: { movie: MovieCard }) {
  const ref = useRef<HTMLAnchorElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(py - 0.5) * -10}deg`);
    el.style.setProperty("--ry", `${(px - 0.5) * 12}deg`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  };
  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <Link
      ref={ref}
      to="/phim/$slug"
      params={{ slug: movie.slug }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="group relative w-[150px] shrink-0 snap-start sm:w-[170px] lg:w-[190px] [perspective:1000px]"
      style={{ ["--rx" as string]: "0deg", ["--ry" as string]: "0deg" }}
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-surface-elevated shadow-[0_10px_30px_-15px_rgba(0,0,0,0.5)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform group-hover:shadow-[0_30px_80px_-20px_oklch(0.65_0.22_15/0.5)]"
        style={{
          transform:
            "rotateX(var(--rx)) rotateY(var(--ry)) translateZ(0)",
          transformStyle: "preserve-3d",
        }}
      >
        <img
          src={thumbSrc(movie.poster_url, { w: 400 })}
          alt={movie.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]"
        />

        {/* Light sweep — follows mouse */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at var(--mx,50%) var(--my,50%), oklch(1 0 0 / 0.18), transparent 40%)",
          }}
        />

        {/* Bottom fade with meta reveal */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[oklch(0.08_0.02_280/0.95)] via-[oklch(0.08_0.02_280/0.55)] to-transparent opacity-0 transition-opacity duration-400 group-hover:opacity-100" />

        {/* Rating chip — always visible top-left */}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur-md">
          <Star className="h-3 w-3 fill-gold text-gold" />
          <span className="font-mono text-[10px] font-semibold text-white">
            {movie.rating.toFixed(1)}
          </span>
        </div>

        {/* Hover-reveal title inside poster */}
        <div className="absolute inset-x-0 bottom-0 translate-y-3 p-3 opacity-0 transition-all duration-400 group-hover:translate-y-0 group-hover:opacity-100">
          <p className="line-clamp-2 font-display text-[15px] font-medium leading-tight tracking-tight text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.6)]">
            {movie.title}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">
            {movie.year}
          </p>
        </div>

        {/* Hair border */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
      </div>

      {/* Idle title (below poster, fades out on hover) */}
      <div className="mt-2.5 space-y-0.5 transition-opacity duration-300 group-hover:opacity-60">
        <p className="truncate text-[13px] font-medium tracking-tight text-foreground">
          {movie.title}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/50">
          {movie.year}
        </p>
      </div>
    </Link>
  );
}

export function MovieRowSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-7 w-40" />
      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-hidden px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-[140px] shrink-0 sm:w-[160px] lg:w-[180px]">
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <Skeleton className="mt-1 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Top10Section                                                              */
/* -------------------------------------------------------------------------- */

export function Top10Section({ movies }: { movies: MovieCard[] }) {
  const { ref, scrollBy } = useScroller();
  return (
    <div className="space-y-3">
      <SectionHeader
        title="Top 10 hôm nay"
        subtitle="Được xem nhiều nhất trong 24h qua"
        onScrollLeft={() => scrollBy(-1)}
        onScrollRight={() => scrollBy(1)}
      />
      <div
        ref={ref}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 py-4 pl-10 sm:-mx-6 sm:px-6 sm:pl-14 lg:-mx-8 lg:px-8 lg:pl-16"
      >
        {movies.slice(0, 10).map((m, i) => (
          <ExperienceCard
            key={m.id}
            movie={m}
            rank={i + 1}
            size="lg"
          />
        ))}
      </div>
    </div>
  );
}

export function Top10Skeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-7 w-40" />
      <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-hidden px-4 pl-10 sm:-mx-6 sm:px-6 sm:pl-14 lg:-mx-8 lg:px-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="ml-6 w-[160px] shrink-0 sm:w-[180px] lg:w-[200px]">
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ContinueWatching                                                          */
/* -------------------------------------------------------------------------- */

export function ContinueWatching({ items }: { items: ContinueWatchingItem[] }) {
  const { ref, scrollBy } = useScroller();
  if (!items.length) return null;

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Tiếp tục xem"
        onScrollLeft={() => scrollBy(-1)}
        onScrollRight={() => scrollBy(1)}
      />
      <div
        ref={ref}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {items.map((m) => (
          <Link
            key={m.id}
            to="/xem/$slug/tap-{$episode}"
            params={{ slug: m.slug, episode: "1" }}
            className="group relative w-[260px] shrink-0 snap-start overflow-hidden rounded-xl bg-surface-elevated transition-transform duration-200 hover:-translate-y-1 sm:w-[300px]"
          >
            <div className="relative aspect-video overflow-hidden">
              <img
                src={thumbSrc(m.poster_url,{w:400})}
                alt={m.title}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow-primary)]">
                  <Play className="h-5 w-5 fill-current" />
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="h-1 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${m.progress * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{m.title}</p>
                <p className="truncate text-xs text-foreground-subtle">
                  {m.remaining}
                </p>
              </div>
              <span
                aria-hidden
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-foreground/10 text-foreground-muted"
              >
                <Plus className="h-4 w-4" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ContinueWatchingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-7 w-40" />
      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-hidden px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-[260px] shrink-0 sm:w-[300px]">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <Skeleton className="mt-1 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stagger wrapper                                                           */
/* -------------------------------------------------------------------------- */

export function Stagger({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
      }}
      className="space-y-10"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: "easeOut" },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
