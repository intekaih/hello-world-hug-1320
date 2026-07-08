import { createFileRoute } from "@tanstack/react-router";
import { browsePool } from "./browse";

const now = () => Date.now();
const DAY = 1000 * 60 * 60 * 24;

// Bucket the pool deterministically into schedule sections
const nowPlaying = browsePool.filter((m) => m.type === "phim-le" && m.year >= 2023).slice(0, 12);
const upcoming = browsePool
  .filter((m) => m.type === "phim-le")
  .slice(0, 10)
  .map((m, i) => ({ ...m, release_date: now() + DAY * (i + 2) }));
const onAir = browsePool
  .filter((m) => m.type === "phim-bo")
  .slice(0, 12)
  .map((m, i) => ({
    ...m,
    next_episode: (i % 12) + 1,
    air_day: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][i % 7],
    air_time: `${19 + (i % 3)}:00`,
  }));

export const Route = createFileRoute("/api/schedule")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ now_playing: nowPlaying, upcoming, on_air: onAir }),
    },
  },
});
