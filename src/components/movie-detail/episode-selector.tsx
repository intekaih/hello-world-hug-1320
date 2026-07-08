import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { ChevronRight, Play, Server, Sparkles } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionHeader } from "./section-header";

type HistoryEntry = {
  slug: string;
  episode: string;
  position: number;
  duration: number;
  updatedAt: number;
};

const SERVERS = [
  { id: "main", labelKey: "movieDetail.episodes.serverDefault" },
  { id: "backup", label: "Vietsub" },
  { id: "dub", label: "Thuyết minh" },
];

/**
 * EpisodeSelector — cinematic episode grid with:
 *  · server tabs (static demo data; extendable when API exposes servers)
 *  · latest episode highlighted
 *  · watched progress bar from /api/history
 *  · "Continue from episode N" CTA when history exists
 */
export function EpisodeSelector({
  slug,
  total,
}: {
  slug: string;
  total: number;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [server, setServer] = useState(SERVERS[0].id);

  const history = useQuery<{ items: HistoryEntry[] }>({
    queryKey: ["history"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/history");
        if (!res.ok) return { items: [] };
        return await res.json();
      } catch {
        return { items: [] };
      }
    },
    staleTime: 60_000,
  });

  const record = history.data?.items.find((it) => it.slug === slug);
  const watchingEp = record ? parseInt(record.episode, 10) : null;
  const watchedPct = record && record.duration > 0
    ? Math.min(1, record.position / record.duration)
    : 0;

  const eps = Array.from({ length: total }, (_, i) => i + 1);
  const latestEp = total;

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow={t("movieDetail.episodes.eyebrow")}
        title={t("movieDetail.episodes.title")}
        subtitle={t("movieDetail.episodes.count", { n: total })}
        action={
          <Link
            to="/xem/$slug/tap-{$episode}"
            params={{ slug, episode: "1" }}
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-primary transition hover:text-primary/80"
          >
            {t("movieDetail.episodes.viewAll")}{" "}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      />

      {/* Continue-from banner */}
      {watchingEp && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 backdrop-blur-md"
        >
          <div className="flex items-center gap-3 text-sm text-white">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <span>{t("movieDetail.episodes.continueFrom", { n: watchingEp })}</span>
          </div>
          <Link
            to="/xem/$slug/tap-{$episode}"
            params={{ slug, episode: String(watchingEp) }}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-black transition hover:-translate-y-0.5"
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
            {t("movieDetail.actions.resume")}
          </Link>
        </motion.div>
      )}

      {/* Server tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-foreground-subtle">
          <Server className="h-3.5 w-3.5" aria-hidden />
          {t("movieDetail.episodes.server")}
        </span>
        {SERVERS.map((s) => {
          const label = "labelKey" in s ? t(s.labelKey!) : s.label!;
          const active = s.id === server;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setServer(s.id)}
              aria-pressed={active}
              className={cn(
                "relative rounded-full px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition",
                active
                  ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                  : "text-foreground-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Episode grid */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
        {eps.map((ep) => {
          const isWatching = watchingEp === ep;
          const isLatest = ep === latestEp;
          const done = watchingEp && ep < watchingEp;

          return (
            <motion.div
              key={ep}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.35, delay: Math.min(ep * 0.015, 0.25) }}
            >
              <Link
                to="/xem/$slug/tap-{$episode}"
                params={{ slug, episode: String(ep) }}
                aria-label={`${t("movieDetail.episodes.prefix")} ${ep}`}
                className={cn(
                  "group relative flex flex-col items-center justify-center overflow-hidden rounded-xl border py-3.5 font-mono text-sm font-semibold backdrop-blur-sm transition",
                  isWatching
                    ? "border-primary/60 bg-primary/15 text-primary shadow-[0_10px_30px_-10px_var(--color-primary)]"
                    : done
                      ? "border-foreground/10 bg-background/30 text-foreground/60"
                      : "border-foreground/10 bg-background/40 text-foreground-muted hover:border-primary/50 hover:bg-primary/10 hover:text-primary",
                )}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition group-hover:opacity-100"
                />
                <span>{String(ep).padStart(2, "0")}</span>

                {isLatest && !isWatching && (
                  <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.24em] text-accent">
                    {t("movieDetail.episodes.latest")}
                  </span>
                )}
                {isWatching && (
                  <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.24em]">
                    {t("movieDetail.episodes.watching")}
                  </span>
                )}

                {/* progress bar */}
                {isWatching && watchedPct > 0 && (
                  <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
                    <span
                      className="block h-full bg-gradient-to-r from-primary to-accent"
                      style={{ width: `${watchedPct * 100}%` }}
                    />
                  </span>
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
