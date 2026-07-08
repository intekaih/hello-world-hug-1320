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
import type {
  ContinueWatchingItem,
  HeroMovie,
  MovieCard,
} from "@/lib/home-queries";

const MotionLink = motion.create(Link);

/* -------------------------------------------------------------------------- */
/*  HeroBanner                                                                */
/* -------------------------------------------------------------------------- */

export function HeroBanner({ movies }: { movies: HeroMovie[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || movies.length <= 1) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % movies.length),
      5000,
    );
    return () => window.clearInterval(id);
  }, [paused, movies.length]);

  const movie = movies[index];
  if (!movie) return null;

  return (
    <section
      className="relative -mx-4 h-[62vh] min-h-[420px] overflow-hidden sm:-mx-6 sm:h-[70vh] lg:-mx-8 lg:rounded-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={movie.id}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img
            src={movie.backdrop_url}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 flex items-end p-4 sm:p-8 lg:p-12">
        <motion.div
          key={`content-${movie.id}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-xl space-y-4"
        >
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

          <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted sm:text-sm">
            <span className="rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-semibold">
              {movie.rating}
            </span>
            <span>{movie.year}</span>
            <span aria-hidden>·</span>
            <span>{movie.runtime}</span>
            <span aria-hidden>·</span>
            <span>{movie.genres.join(" • ")}</span>
          </div>

          <p className="line-clamp-2 text-sm text-foreground-muted sm:line-clamp-3 sm:text-base">
            {movie.overview}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-90">
              <Play className="h-4 w-4 fill-current" /> Play
            </button>
            <button className="glass inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-white/10">
              <Info className="h-4 w-4" /> More info
            </button>
          </div>
        </motion.div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-4 right-4 z-10 flex gap-1.5 sm:bottom-6 sm:right-8">
        {movies.map((m, i) => (
          <button
            key={m.id}
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index ? "w-8 bg-primary" : "w-4 bg-white/30 hover:bg-white/60",
            )}
          />
        ))}
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
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow-primary)]"
                : "glass text-foreground-muted hover:text-foreground",
            )}
          >
            {c}
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
          className="glass grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={onScrollRight}
          aria-label="Scroll right"
          className="glass grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/10"
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
  title: string;
  subtitle?: string;
  movies: MovieCard[];
}) {
  const { ref, scrollBy } = useScroller();

  return (
    <div className="space-y-3">
      <SectionHeader
        title={title}
        subtitle={subtitle}
        onScrollLeft={() => scrollBy(-1)}
        onScrollRight={() => scrollBy(1)}
      />
      <div
        ref={ref}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {movies.map((m) => (
          <MoviePoster key={m.id} movie={m} />
        ))}
      </div>
    </div>
  );
}

function MoviePoster({ movie }: { movie: MovieCard }) {
  return (
    <motion.a
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      href="#"
      className="group relative w-[140px] shrink-0 snap-start overflow-hidden rounded-xl sm:w-[160px] lg:w-[180px]"
    >
      <div className="aspect-[2/3] overflow-hidden rounded-xl bg-surface-elevated">
        <img
          src={movie.poster_url}
          alt={movie.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="mt-2 space-y-0.5">
        <p className="truncate text-sm font-medium">{movie.title}</p>
        <div className="flex items-center gap-1.5 text-xs text-foreground-subtle">
          <Star className="h-3 w-3 fill-gold text-gold" />
          <span>{movie.rating.toFixed(1)}</span>
          <span aria-hidden>·</span>
          <span>{movie.year}</span>
        </div>
      </div>
    </motion.a>
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
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pl-10 sm:-mx-6 sm:px-6 sm:pl-14 lg:-mx-8 lg:px-8 lg:pl-16"
      >
        {movies.slice(0, 10).map((m, i) => (
          <motion.a
            key={m.id}
            href="#"
            whileHover={{ y: -4 }}
            className="group relative w-[160px] shrink-0 snap-start sm:w-[180px] lg:w-[200px]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -left-8 bottom-0 select-none font-display text-[130px] font-black leading-[0.8] text-transparent [-webkit-text-stroke:2px_var(--color-primary)] sm:-left-10 sm:text-[160px] lg:text-[180px]"
              style={{
                background:
                  "linear-gradient(180deg, oklch(0.65 0.22 15 / 0.9), oklch(0.65 0.22 15 / 0.1))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
              }}
            >
              {i + 1}
            </span>
            <div className="relative ml-6 aspect-[2/3] overflow-hidden rounded-xl bg-surface-elevated shadow-[var(--shadow-elevated)] sm:ml-8">
              <img
                src={m.poster_url}
                alt={m.title}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
          </motion.a>
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
          <motion.a
            key={m.id}
            href="#"
            whileHover={{ y: -4 }}
            className="group relative w-[260px] shrink-0 snap-start overflow-hidden rounded-xl bg-surface-elevated sm:w-[300px]"
          >
            <div className="relative aspect-video overflow-hidden">
              <img
                src={m.poster_url}
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
              <button
                aria-label="Add to list"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-foreground-muted transition hover:bg-white/5 hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </motion.a>
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
