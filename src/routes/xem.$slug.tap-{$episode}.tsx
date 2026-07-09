import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Monitor } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AnimatePresence, motion } from "motion/react";

import {
  PlayerContainer,
  WatchActions,
  type ServerSource,
} from "@/components/watch/player";
import { CinemaModeLayout } from "@/components/watch/cinema-mode-layout";
import { AmbientTheaterBackground } from "@/components/watch/ambient-theater-background";
import { RouteErrorBoundary, RouteNotFound } from "@/components/route-boundaries";
import { buildPageMeta, SITE_NAME } from "@/lib/page-meta";
import { usePageMeta } from "@/hooks/usePageMeta";
import { thumbSrc } from "@/utils/thumbSrc";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/design";

const searchSchema = z.object({
  t: fallback(z.number(), 0).default(0),
});

export const Route = createFileRoute("/xem/$slug/tap-{$episode}")({
  validateSearch: zodValidator(searchSchema),
  component: WatchPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => (
    <RouteNotFound
      title="Không tìm thấy tập phim"
      description="Tập phim bạn muốn xem không tồn tại hoặc chưa được cập nhật."
    />
  ),

  head: ({ params }) => {
    const nice = params.slug
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
    return {
      meta: buildPageMeta({
        title: `Xem ${nice} Tập ${params.episode} - ${SITE_NAME}`,
        description: `Xem ${nice} tập ${params.episode} online HD Vietsub, thuyết minh miễn phí trên ${SITE_NAME}.`,
        url: `/xem/${params.slug}/tap-${params.episode}`,
        type: "video.episode",
        noindex: true,
      }),
    };
  },
});

const FALLBACK_SERVERS: ServerSource[] = [
  { id: "vip1", name: "VIP #1", src: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
];

const TOTAL_EPISODES = 48;

function WatchPage() {
  const { slug, episode } = Route.useParams();
  const { t: tSearch } = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [cinemaMode, setCinemaMode] = useState(false);
  const [activeServerId, setActiveServerId] = useState<string>("");

  const { data: epData } = useQuery({
    queryKey: ["be-episode", slug, episode],
    queryFn: async () => {
      try {
        const { fetchEpisode } = await import("@/api-client/movie-detail");
        const ep = await fetchEpisode(slug, episode);
        return {
          servers: ep.servers.map((s) => ({ id: s.id, name: s.name, src: s.src })),
        };
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
  const servers = epData?.servers?.length ? epData.servers : FALLBACK_SERVERS;
  const introEndSec: number | undefined = undefined;
  const recapEndSec: number | undefined = undefined;

  const { data: history } = useQuery({
    queryKey: ["history", slug, episode],
    queryFn: async () => {
      const { getEpisodeProgress } = await import("@/api-client/history");
      const saved = await getEpisodeProgress(slug, episode);
      return saved ?? { position: 0, duration: 0 };
    },
    staleTime: 0,
    gcTime: 0,
  });


  const { data: movie } = useQuery({
    queryKey: ["be-movie-meta", slug],
    queryFn: async () => {
      try {
        const { fetchMovieDetail } = await import("@/api-client/movie-detail");
        const { movie: m } = await fetchMovieDetail(slug);
        return {
          title: m.title,
          poster_url: m.poster_url,
          backdrop_url: m.backdrop_url,
          year: m.year,
          overview: m.overview,
          overview_vi: m.overview_vi,
        };
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });


  const initialTime = useMemo(() => {
    if (tSearch > 0) return tSearch;
    if (history && history.position > 5) return history.position;
    return 0;
  }, [tSearch, history]);

  const goToEpisode = (ep: number) => {
    navigate({
      to: "/xem/$slug/tap-{$episode}",
      params: { slug, episode: String(ep) },
      search: { t: 0 },
    });
  };

  const title = movie?.title ?? slug
    .split("-")
    .map((s: string) => s[0]?.toUpperCase() + s.slice(1))
    .join(" ");

  const posterUrl = movie?.poster_url ? thumbSrc(movie.poster_url, { w: 1200 }) : undefined;
  const backdropUrl = movie?.backdrop_url
    ? thumbSrc(movie.backdrop_url, { w: 1600 })
    : posterUrl;

  usePageMeta({
    title: `${t("player.nowPlaying")} ${title} · ${t("player.episodeShort", { n: episode })}`,
    description:
      movie?.overview_vi ||
      movie?.overview ||
      `Xem ${title} tập ${episode} online HD Vietsub, thuyết minh miễn phí trên ${SITE_NAME}.`,
    url: `/xem/${slug}/tap-${episode}`,
    image: posterUrl,
    type: "video.episode",
    noindex: true,
  });

  const jsonLd = useMemo(() => {
    if (!movie) return null;
    return {
      "@context": "https://schema.org",
      "@type": "TVEpisode",
      name: `${title} — Tập ${episode}`,
      episodeNumber: Number(episode) || undefined,
      image: posterUrl,
      partOfSeries: { "@type": "TVSeries", name: title, image: posterUrl },
      potentialAction: {
        "@type": "WatchAction",
        target: `/xem/${slug}/tap-${episode}`,
      },
    };
  }, [movie, title, episode, slug, posterUrl]);

  const epNum = Number(episode) || 1;
  const canPrev = epNum > 1;
  const canNext = epNum < TOTAL_EPISODES;
  const overview = movie?.overview_vi || movie?.overview;

  const toggleCinema = () => setCinemaMode((v) => !v);

  return (
    <CinemaModeLayout>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <AmbientTheaterBackground
        backdrop={backdropUrl}
        intensity={cinemaMode ? 0.28 : 0.45}
      />

      <motion.div
        animate={{
          opacity: cinemaMode ? 0 : 1,
          y: cinemaMode ? -12 : 0,
          pointerEvents: cinemaMode ? "none" : "auto",
        }}
        transition={{ duration: 0.4, ease: ease.out }}
        className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6"
      >
        <div className="mb-4 flex items-center gap-3 sm:mb-6">
          <Link
            to="/phim/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/80 backdrop-blur-md transition hover:border-white/30 hover:bg-white/10 hover:text-white"
            aria-label={t("common.back")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("common.back")}
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-primary/90">
              <span className="inline-block h-px w-5 bg-gradient-to-r from-primary to-transparent" />
              {t("player.nowPlaying")}
            </div>
            <h1 className="mt-1 truncate font-display text-lg font-semibold tracking-tight sm:text-2xl">
              {title}
            </h1>
          </div>
          <div className="hidden shrink-0 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-white/60 sm:flex">
            <span className="text-white">EP {String(epNum).padStart(2, "0")}</span>
            <span className="text-white/40">/</span>
            <span>{String(TOTAL_EPISODES).padStart(2, "0")}</span>
          </div>
        </div>
      </motion.div>

      {/* Player frame */}
      <motion.div
        layout
        transition={{ duration: 0.5, ease: ease.out }}
        className={cn(
          "relative mx-auto",
          cinemaMode
            ? "max-w-none px-0"
            : "max-w-7xl px-3 sm:px-6",
        )}
      >
        <div
          className={cn(
            "group relative overflow-hidden ring-1 ring-white/10",
            cinemaMode ? "rounded-none" : "rounded-2xl",
          )}
          style={{
            boxShadow: cinemaMode
              ? undefined
              : "0 2px 10px rgba(0,0,0,0.4), 0 30px 60px -20px rgba(0,0,0,0.7), 0 60px 120px -40px oklch(0.68 0.24 25 / 0.35)",
          }}
        >
          {!cinemaMode && (
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-2xl opacity-60"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.68 0.24 25 / 0.3), transparent 40%, oklch(0.72 0.15 200 / 0.25))",
                filter: "blur(2px)",
                zIndex: -1,
              }}
            />
          )}
          <PlayerContainer
            slug={slug}
            episode={episode}
            totalEpisodes={TOTAL_EPISODES}
            title={title}
            poster={backdropUrl}
            servers={servers}
            initialTime={initialTime}
            introEndSec={introEndSec}
            recapEndSec={recapEndSec}
            onChangeEpisode={goToEpisode}
            cinemaMode={cinemaMode}
            onToggleCinemaMode={toggleCinema}
          />
        </div>
      </motion.div>

      {/* Floating cinema exit — visible only in cinema mode */}
      <AnimatePresence>
        {cinemaMode && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={toggleCinema}
            className="fixed right-4 top-4 z-40 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/85 backdrop-blur-xl transition hover:border-white/30 hover:text-white"
            aria-label={t("player.controls.exitCinema")}
          >
            <Monitor className="h-3.5 w-3.5" />
            {t("player.controls.exitCinema")}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!cinemaMode && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4 }}
            className="mx-auto max-w-7xl px-3 sm:px-6"
          >
            <div className="mt-4 flex items-center justify-between gap-3 sm:mt-6">
              <button
                onClick={() => canPrev && goToEpisode(epNum - 1)}
                disabled={!canPrev}
                className="group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 backdrop-blur-md transition hover:border-white/30 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5"
              >
                <ChevronLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
                <span className="hidden sm:inline">{t("player.prevEpisode")}</span>
              </button>
              <div className="flex items-center gap-2.5 rounded-full border border-white/12 bg-white/5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-white/80 backdrop-blur-md">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_10px_oklch(0.68_0.24_25)]" />
                {t("player.episodeShort", { n: String(epNum).padStart(2, "0") })} · {String(TOTAL_EPISODES).padStart(2, "0")}
              </div>
              <button
                onClick={() => canNext && goToEpisode(epNum + 1)}
                disabled={!canNext}
                className="group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 backdrop-blur-md transition hover:border-white/30 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5"
              >
                <span className="hidden sm:inline">{t("player.nextEpisode.short")}</span>
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
            </div>

            <div className="mt-8 grid gap-6 pb-24 lg:grid-cols-[1fr_320px]">
              <div className="space-y-6">
                <WatchActions
                  slug={slug}
                  title={title}
                  episode={episode}
                  posterUrl={posterUrl}
                />

                {overview && (
                  <section className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-6 backdrop-blur-xl">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-40"
                      style={{
                        background:
                          "radial-gradient(circle, oklch(0.68 0.24 25 / 0.4), transparent 65%)",
                      }}
                    />
                    <div className="relative">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-block h-px w-6 bg-gradient-to-r from-primary to-transparent" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-primary/90">
                          {t("player.synopsisEyebrow")}
                        </span>
                      </div>
                      <h2 className="mt-2 font-display text-xl font-semibold tracking-tight">
                        {t("player.aboutEpisode")}
                      </h2>
                      <p className="mt-3 text-[15px] leading-[1.85] text-white/80">
                        {overview}
                      </p>
                    </div>
                  </section>
                )}
              </div>

              {posterUrl && (
                <aside className="space-y-4">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
                    <img
                      src={posterUrl}
                      alt={title}
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/90">
                        {t("player.watchingEyebrow")}
                      </div>
                      <div className="mt-1 line-clamp-2 font-display text-lg font-semibold leading-tight">
                        {title}
                      </div>
                    </div>
                  </div>
                  <Link
                    to="/phim/$slug"
                    params={{ slug }}
                    className="block rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-white/80 backdrop-blur-md transition hover:border-primary/40 hover:text-primary"
                  >
                    {t("player.viewMovieDetails")} →
                  </Link>
                </aside>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </CinemaModeLayout>
  );
}
