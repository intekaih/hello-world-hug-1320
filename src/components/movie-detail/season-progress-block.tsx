import { Link } from "@tanstack/react-router";
import { PlayCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useSeasonProgress, parseRuntimeMinutes } from "@/hooks/useSeasonProgress";
import type { Movie } from "./types";

/**
 * SeasonProgressBlock
 * ---------------------------------------------------------------
 * "Đã xem X/Y tập · ~Zh còn lại" + midpoint copy (Zeigarnik / hunger).
 * Real data: /api/history?slug=<slug> + localStorage fallback.
 * Only renders when total_episodes > 1.
 */
export function SeasonProgressBlock({ movie }: { movie: Movie }) {
  const { t } = useTranslation();
  const runtime = parseRuntimeMinutes(movie.duration, 45);
  const p = useSeasonProgress(movie.slug, movie.total_episodes, runtime);

  if (movie.total_episodes <= 1) return null;

  const nextEp = Math.min(
    movie.total_episodes,
    (() => {
      for (let i = 1; i <= movie.total_episodes; i++) {
        if (!p.watchedSet.has(i)) return i;
      }
      return movie.total_episodes;
    })(),
  );

  const chipCopy = p.isNearComplete
    ? t("player.season.chipDone", { watched: p.watched, total: p.total })
    : t("player.season.chip", {
        watched: p.watched,
        total: p.total,
        hours: p.hoursLeft,
      });

  return (
    <section
      aria-label={chipCopy}
      className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-5 backdrop-blur-xl sm:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: "var(--gradient-ember, linear-gradient(90deg,#f97316,#ef4444))",
          transform: `scaleX(${Math.max(0.02, p.ratio)})`,
          transformOrigin: "left",
          transition: "transform 600ms ease-out",
        }}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/90">
            {chipCopy}
          </div>
          {p.isHalfway && (
            <p className="mt-1.5 text-sm font-medium text-white/85">
              {t("player.season.halfway")}
            </p>
          )}
        </div>
        <Link
          to="/xem/$slug/tap-{$episode}"
          params={{ slug: movie.slug, episode: String(nextEp) }}
          search={{ t: 0 }}
          className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_-6px_oklch(0.68_0.24_25/0.7)] transition hover:brightness-110"
          style={{ background: "var(--gradient-ember, linear-gradient(135deg,#f97316,#ef4444))" }}
        >
          <PlayCircle className="h-4 w-4" />
          {t("player.episodeShort", { n: nextEp })}
        </Link>
      </div>
    </section>
  );
}
