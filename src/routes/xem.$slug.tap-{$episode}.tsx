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

const searchSchema = z.object({
  t: fallback(z.number(), 0).default(0),
});

export const Route = createFileRoute("/xem/$slug/tap-{$episode}")({
  validateSearch: zodValidator(searchSchema),
  component: WatchPage,
  head: ({ params }) => ({
    meta: [
      { title: `Xem tập ${params.episode} — ${params.slug} · Stream` },
      { name: "robots", content: "noindex" },
    ],
  }),
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

  const title = slug
    .split("-")
    .map((s: string) => s[0]?.toUpperCase() + s.slice(1))
    .join(" ");

  return (
    <div className="min-h-screen bg-black">
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
