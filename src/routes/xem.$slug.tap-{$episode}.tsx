import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
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

  // Episode source: servers[] from backend.
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

  // Resume position: URL ?t=... wins over saved progress.
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

  // Movie meta for og:image + JSON-LD.
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

  return (
    <div className="min-h-screen bg-black">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <div className="mx-auto max-w-6xl">
        {/* Video area — no padding */}
        <PlayerContainer
          slug={slug}
          episode={episode}
          totalEpisodes={TOTAL_EPISODES}
          title={title}
          servers={servers}
          initialTime={initialTime}
          onChangeEpisode={goToEpisode}
        />

        {/* Below-player content */}
        <div className="space-y-4 p-4 pb-24 text-white sm:p-6">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="glass grid h-9 w-9 place-items-center rounded-full text-white/80 hover:text-white"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-bold sm:text-2xl">
                {title}
              </h1>
              <p className="text-sm text-white/60">
                Tập {episode} / {TOTAL_EPISODES}
              </p>
            </div>
          </div>

          <WatchActions slug={slug} />

          <div className="glass rounded-2xl p-4">
            <h2 className="font-display text-base font-semibold">Nội dung</h2>
            <p className="mt-2 text-sm text-white/70">
              Mô tả phim sẽ được cập nhật ở đây.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
