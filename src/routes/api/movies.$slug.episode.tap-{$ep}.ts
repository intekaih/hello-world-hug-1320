import { createFileRoute } from "@tanstack/react-router";

// Demo HLS sources per server. Replace with real upstream when available.
const DEFAULT_SERVERS = [
  {
    id: "vip1",
    name: "VIP #1",
    type: "hls" as const,
    src: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  },
  {
    id: "vip2",
    name: "VIP #2",
    type: "hls" as const,
    src: "https://test-streams.mux.dev/pts_shift/master.m3u8",
  },
  {
    id: "bk",
    name: "Backup",
    type: "hls" as const,
    src: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
  },
];

export const Route = createFileRoute("/api/movies/$slug/episode/tap-{$ep}")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const ep = Number(params.ep);
        if (!Number.isFinite(ep) || ep < 1) {
          return Response.json({ error: "Invalid episode" }, { status: 400 });
        }
        return Response.json({
          slug: params.slug,
          episode: params.ep,
          episode_number: ep,
          title: `Tập ${ep}`,
          duration: 2640,
          servers: DEFAULT_SERVERS,
          subtitles: [
            { lang: "vi", label: "Tiếng Việt", src: "" },
            { lang: "en", label: "English", src: "" },
          ],
        });
      },
    },
  },
});
