import { thumbSrc } from "@/utils/thumbSrc";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { RouteErrorBoundary, RouteNotFound } from "@/components/route-boundaries";
import { cn } from "@/lib/utils";
import { buildPageMeta } from "@/lib/page-meta";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useTranslation } from "@/hooks/useTranslation";

import {
  CastCarousel,
  EpisodeSelector,
  FloatingMovieActions,
  MovieDetailHero,
  MovieFactRail,
  SeasonProgressBlock,
  SectionHeader,
  StoryBlock,
  type Movie,
  type RelatedItem,
} from "@/components/movie-detail";


// Related rail lives below the fold — code-split it.
const LazyRelatedRail = lazy(() =>
  import("@/components/movie-detail/related-rail").then((m) => ({
    default: m.RelatedMovieRail,
  })),
);

export const Route = createFileRoute("/phim/$slug")({
  component: MovieDetailPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <NotFoundLocalized />,
  head: ({ params }) => {
    const nice = params.slug
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
    return {
      meta: buildPageMeta({
        title: `${nice} - movieCC`,
        description: `Watch ${nice} online — Vietsub, HD, cinematic streaming on movieCC.`,
        url: `/phim/${params.slug}`,
        type: "video.movie",
      }),
      links: [{ rel: "canonical", href: `/phim/${params.slug}` }],
    };
  },
});

function NotFoundLocalized() {
  const { t } = useTranslation();
  return (
    <RouteNotFound
      title={t("detail.notFound.title")}
      description={t("detail.notFound.description")}
    />
  );
}

/* -------------------------------------------------------------------------- */

function MovieDetailPage() {
  const { slug } = Route.useParams();
  const { t } = useTranslation();

  const movieQ = useQuery({
    queryKey: ["movie", slug],
    queryFn: async () => {
      const res = await fetch(`/api/movies/${slug}`);
      if (!res.ok) {
        const err = new Error(
          res.status === 404 ? t("detail.notFound.title") : `Error ${res.status}`,
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
            `Watch ${movieData.title} online on movieCC.`,
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
    if (status === 404) return <NotFoundLocalized />;
    return (
      <RouteErrorBoundary
        error={(movieQ.error as Error) ?? new Error("Failed")}
        reset={() => movieQ.refetch()}
      />
    );
  }

  const movie = movieData;

  return (
    <div className="space-y-16 pb-24">
      <MovieDetailHero movie={movie} />

      <div id="detail-body" className="space-y-16">
        <StoryBlock movie={movie} />

        {movie.cast.length > 0 && <CastCarousel cast={movie.cast} />}

        <MovieFactRail movie={movie} />

        <CategoryChips categories={movie.categories} />

        {movie.total_episodes > 1 && (
          <EpisodeSelector slug={movie.slug} total={movie.total_episodes} />
        )}

        {movie.parts.length > 1 && (
          <SeriesPartsNav parts={movie.parts} currentSlug={movie.slug} />
        )}

        {/* Lazy — mounts only when scrolled into view */}
        <LazyBelowFold>
          <Suspense fallback={<RelatedSkeleton />}>
            <LazyRelatedRail
              items={relatedQ.data ?? []}
              loading={relatedQ.isLoading}
            />
          </Suspense>
        </LazyBelowFold>
      </div>

      <FloatingMovieActions movie={movie} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small helpers kept local                                                  */
/* -------------------------------------------------------------------------- */

function LazyBelowFold({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show]);

  return <div ref={ref}>{show ? children : <RelatedSkeleton />}</div>;
}

function RelatedSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[2/3] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function CategoryChips({ categories }: { categories: string[] }) {
  const { t } = useTranslation();
  if (!categories.length) return null;
  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow={t("detail.genres.eyebrow")}
        title={t("detail.genres.title")}
      />
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

function SeriesPartsNav({
  parts,
  currentSlug,
}: {
  parts: { slug: string; label: string; year: number }[];
  currentSlug: string;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow={t("movieDetail.parts.eyebrow")}
        title={t("movieDetail.parts.title")}
      />
      <motion.div
        initial={reduce ? false : "hidden"}
        whileInView="show"
        viewport={{ once: true }}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.05 } },
        }}
        className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto rail-scroll px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {parts.map((p) => {
          const active = p.slug === currentSlug;
          return (
            <motion.div
              key={p.slug}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
              }}
              className="shrink-0"
            >
              <Link
                to="/phim/$slug"
                params={{ slug: p.slug }}
                className={cn(
                  "relative block overflow-hidden rounded-2xl border px-5 py-4 text-sm font-medium transition",
                  active
                    ? "border-primary/50 text-white"
                    : "border-foreground/10 bg-background/30 text-foreground-muted hover:border-primary/30 hover:text-foreground",
                )}
                style={
                  active ? { background: "var(--gradient-ember)" } : undefined
                }
              >
                <div className="font-display text-base font-semibold">
                  {p.label}
                </div>
                <div
                  className={cn(
                    "mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em]",
                    active ? "text-white/75" : "text-foreground-subtle",
                  )}
                >
                  {p.year}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function DetailSkeleton() {
  return (
    <div className="space-y-10">
      <Skeleton className="-mx-4 h-[92vh] min-h-[640px] rounded-none sm:-mx-6 lg:-mx-8 lg:rounded-[2rem]" />
      <Skeleton className="h-24 w-full max-w-4xl" />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
