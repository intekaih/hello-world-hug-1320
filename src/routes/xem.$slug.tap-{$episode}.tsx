import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";

import {
  PlayerContainer,
  WatchActions,
  type ServerSource,
} from "@/components/watch/player";
import { Link } from "@tanstack/react-router";
import { RouteErrorBoundary, RouteNotFound } from "@/components/route-boundaries";
import { buildPageMeta, SITE_NAME } from "@/lib/page-meta";
import { usePageMeta } from "@/hooks/usePageMeta";
import { thumbSrc } from "@/utils/thumbSrc";


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

/* Fallback demo HLS sources if the API fails. */
const FALLBACK_SERVERS: ServerSource[] = [
  {
    id: "vip1",
    name: "VIP #1",
    src: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  },
];

const TOTAL_EPISODES = 48;

function WatchPage() {
  const { slug, episode } = Route.useParams();
  const { t } = Route.useSearch();
  const navigate = useNavigate();

  const { data: epData } = useQuery({
    queryKey: ["episode", slug, episode],
    queryFn: async () => {
      const res = await fetch(`/api/movies/${slug}/episode/tap-${episode}`);
      if (!res.ok) return null;
      return res.json() as Promise<{ servers: ServerSource[] }>;
    },
    staleTime: 5 * 60 * 1000,
  });
  const servers = epData?.servers?.length ? epData.servers : FALLBACK_SERVERS;

  const { data: history } = useQuery({
    queryKey: ["history", slug, episode],
    queryFn: async () => {
      const res = await fetch(`/api/history/${slug}/${episode}`);
      if (!res.ok) return { position: 0, duration: 0 };
      return res.json() as Promise<{ position: number; duration: number }>;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const { data: movie } = useQuery({
    queryKey: ["movie", slug, "meta"],
    queryFn: async () => {
      const res = await fetch(`/api/movies/${slug}`);
      if (!res.ok) return null;
      return res.json() as Promise<{
        title: string;
        poster_url: string;
        backdrop_url: string;
        year?: number;
        overview?: string;
        overview_vi?: string;
      }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const initialTime = useMemo(() => {
    if (t > 0) return t;
    if (history && history.position > 5) return history.position;
    return 0;
  }, [t, history]);

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

  const posterUrl = movie?.poster_url
    ? thumbSrc(movie.poster_url, { w: 1200 })
    : undefined;

  const backdropUrl = movie?.backdrop_url
    ? thumbSrc(movie.backdrop_url, { w: 1600 })
    : posterUrl;

  usePageMeta({
    title: `Xem ${title} Tập ${episode} - ${SITE_NAME}`,
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
      partOfSeries: {
        "@type": "TVSeries",
        name: title,
        image: posterUrl,
      },
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* Ambient blurred backdrop */}
      {backdropUrl && (
        <>
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10 opacity-40"
            style={{
              backgroundImage: `url(${backdropUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(80px) saturate(160%)",
              transform: "scale(1.2)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgb(0_0_0/0.85)_100%)]"
          />
          <div
            aria-hidden
            className="grain pointer-events-none fixed inset-0 -z-10 opacity-30"
          />
        </>
      )}

      <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
        {/* Top nav rail */}
        <div className="mb-4 flex items-center gap-3 sm:mb-6">
          <Link
            to="/phim/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/80 backdrop-blur-md transition hover:border-white/30 hover:bg-white/10 hover:text-white"
            aria-label="Trở về"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Trở về
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-primary/90">
              <span className="inline-block h-px w-5 bg-gradient-to-r from-primary to-transparent" />
              Now Playing
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

        {/* Player frame — cinematic */}
        <div
          className="group relative overflow-hidden rounded-2xl ring-1 ring-white/10"
          style={{
            boxShadow:
              "0 2px 10px rgba(0,0,0,0.4), 0 30px 60px -20px rgba(0,0,0,0.7), 0 60px 120px -40px oklch(0.68 0.24 25 / 0.35)",
          }}
        >
          {/* Ambient glow ring */}
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
          <PlayerContainer
            slug={slug}
            episode={episode}
            totalEpisodes={TOTAL_EPISODES}
            title={title}
            poster={backdropUrl}
            servers={servers}
            initialTime={initialTime}
            onChangeEpisode={goToEpisode}
          />
        </div>

        {/* Episode nav rail */}
        <div className="mt-4 flex items-center justify-between gap-3 sm:mt-6">
          <button
            onClick={() => canPrev && goToEpisode(epNum - 1)}
            disabled={!canPrev}
            className="group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 backdrop-blur-md transition hover:border-white/30 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5"
          >
            <ChevronLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">Tập trước</span>
          </button>
          <div className="flex items-center gap-2.5 rounded-full border border-white/12 bg-white/5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-white/80 backdrop-blur-md">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_10px_oklch(0.68_0.24_25)]" />
            Episode {String(epNum).padStart(2, "0")} · {String(TOTAL_EPISODES).padStart(2, "0")}
          </div>
          <button
            onClick={() => canNext && goToEpisode(epNum + 1)}
            disabled={!canNext}
            className="group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 backdrop-blur-md transition hover:border-white/30 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5"
          >
            <span className="hidden sm:inline">Tập tiếp</span>
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Below-player content */}
        <div className="mt-8 grid gap-6 pb-24 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <WatchActions slug={slug} />

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
                      Synopsis
                    </span>
                  </div>
                  <h2 className="mt-2 font-display text-xl font-semibold tracking-tight">
                    Về tập này
                  </h2>
                  <p className="mt-3 text-[15px] leading-[1.85] text-white/80">
                    {overview}
                  </p>
                </div>
              </section>
            )}
          </div>

          {/* Side rail — poster + info */}
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
                    Watching
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
                Xem chi tiết phim →
              </Link>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
