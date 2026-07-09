import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useQueries } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookmarkPlus, PlayCircle, ThumbsDown, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/hooks/useTranslation";
import { thumbSrc } from "@/utils/thumbSrc";
import { ease } from "@/lib/design";
import { track } from "@/lib/track";
import { usePlayerStore } from "@/store/playerStore";
import {
  buildRecommendations,
  type RecMovie,
} from "@/lib/recommendations/engine";
import type { BrowseMovie } from "@/routes/api/browse";
import { youTubeEmbed } from "@/components/movie-detail/types";

type PoolResp = { items: BrowseMovie[] };
type HistoryResp = {
  items: {
    slug: string;
    updatedAt: number;
    position: number;
    duration: number;
    totalEpisodes?: number;
    episode?: string;
  }[];
};
type FavResp = { items: { movie_slug: string; createdAt: number }[] };
type WatchResp = { items: { movie_slug: string; createdAt: number }[] };

const DEFAULT_COUNTDOWN = 15;

function reasonChip(kind: RecMovie["reason"], value?: string): string {
  switch (kind) {
    case "sameGenre":
      return value ? `Cùng ${value}` : "Cùng thể loại";
    case "sameCountry":
      return value ? `Từ ${value}` : "Cùng xuất xứ";
    case "similarMood":
      return "Cùng tông";
    case "highlyRated":
      return "Điểm cao";
    case "newEpisode":
      return "Tập mới";
    case "fromWatchlist":
      return "Trong watchlist";
    case "resume":
      return "Xem tiếp";
    case "rewatch":
      return "Xem lại";
    case "unexplored":
      return "Bạn chưa xem";
    case "trending":
      return "Đang hot";
    default:
      return "Gợi ý cho bạn";
  }
}

async function j<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(url);
  return res.json();
}

/**
 * BingeBridgeOverlay
 * ---------------------------------------------------------------
 * Fires at the very end of the LAST episode (or end of a phim-le)
 * to replace the dead-end with three engine-scored picks.
 * - autoNext=true → 15s countdown then trailer autoplays MUTED
 *   (never auto-navigates to /xem).
 * - autoNext=false → static, no countdown, no trailer autoplay.
 * - prefers-reduced-motion → crossfade only.
 *
 * Events: binge_bridge_show, binge_bridge_accept, binge_bridge_dismiss
 */
export function BingeBridgeOverlay({
  visible,
  slug,
  title,
  onDismiss,
}: {
  visible: boolean;
  slug: string;
  title: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const autoNext = usePlayerStore((s) => s.autoNext);
  const navigate = useNavigate();

  const [pool, history, favorites, watchlist] = useQueries({
    queries: [
      {
        queryKey: ["rec", "pool"],
        queryFn: () => j<PoolResp>("/api/movies/pool"),
        staleTime: 5 * 60_000,
        enabled: visible,
      },
      {
        queryKey: ["rec", "history"],
        queryFn: () => j<HistoryResp>("/api/history"),
        staleTime: 60_000,
        enabled: visible,
      },
      {
        queryKey: ["rec", "favorites"],
        queryFn: () => j<FavResp>("/api/favorites"),
        staleTime: 60_000,
        enabled: visible,
      },
      {
        queryKey: ["rec", "watchlist"],
        queryFn: () => j<WatchResp>("/api/watchlist"),
        staleTime: 60_000,
        enabled: visible,
      },
    ],
  });

  const picks: RecMovie[] = useMemo(() => {
    if (!pool.data) return [];
    const surfaces = buildRecommendations({
      pool: pool.data.items,
      history: [
        // Inject the just-finished title as the freshest history seed so the
        // engine treats it as "vừa xem".
        {
          slug,
          updatedAt: Date.now(),
          position: 1,
          duration: 1,
        },
        ...(history.data?.items ?? []).map((h) => ({
          slug: h.slug,
          updatedAt: h.updatedAt,
          position: h.position,
          duration: h.duration,
          totalEpisodes: h.totalEpisodes,
          episode: h.episode,
        })),
      ],
      favorites: (favorites.data?.items ?? []).map((f) => ({
        slug: f.movie_slug,
        createdAt: f.createdAt,
      })),
      watchlist: (watchlist.data?.items ?? []).map((w) => ({
        slug: w.movie_slug,
        createdAt: w.createdAt,
      })),
    });
    const base =
      surfaces.becauseYouWatched?.items ?? surfaces.continueTheMood ?? [];
    return base.filter((m) => m.slug !== slug).slice(0, 3);
  }, [pool.data, history.data, favorites.data, watchlist.data, slug]);

  const pick1 = picks[0];

  // Trailer meta for pick #1 (has trailer_url on catalog entries).
  const [pickMeta, setPickMeta] = useState<{
    trailer_url?: string;
    backdrop_url?: string;
    poster_url?: string;
  } | null>(null);
  useEffect(() => {
    if (!visible || !pick1) return;
    let cancelled = false;
    fetch(`/api/movies/${pick1.slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (!cancelled && m) setPickMeta(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, pick1?.slug]);

  // Countdown → trailer autoplay (never navigates).
  const [countdown, setCountdown] = useState(DEFAULT_COUNTDOWN);
  const [trailerLive, setTrailerLive] = useState(false);
  useEffect(() => {
    if (!visible) {
      setCountdown(DEFAULT_COUNTDOWN);
      setTrailerLive(false);
      return;
    }
    if (!autoNext) return; // respect setting → no countdown at all
    const id = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(id);
          setTrailerLive(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [visible, autoNext]);

  // Fire show event once per open.
  const shownRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      shownRef.current = false;
      return;
    }
    if (shownRef.current || picks.length === 0) return;
    shownRef.current = true;
    track("binge_bridge_show", {
      slug,
      pickCount: picks.length,
      autoNext,
    });
  }, [visible, picks.length, slug, autoNext]);

  const dismiss = (reason: "close" | "not_interested") => {
    track("binge_bridge_dismiss", { slug, reason });
    onDismiss();
  };

  const accept = (target: RecMovie, action: "watch" | "watchlist") => {
    track("binge_bridge_accept", { slug, target: target.slug, action });
  };

  const addToWatchlist = async (target: RecMovie) => {
    accept(target, "watchlist");
    try {
      const res = await fetch("/api/watchlist/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          movie_slug: target.slug,
          movie_name: target.title,
          movie_thumb: target.poster_url,
        }),
      });
      if (res.ok) toast.success(t("player.bridge.added"));
    } catch {
      /* ignore — toast omitted rather than fake success */
    }
  };

  const openDetail = (target: RecMovie) => {
    accept(target, "watch");
    onDismiss();
    navigate({ to: "/phim/$slug", params: { slug: target.slug } });
  };

  const trailerSrc = pickMeta?.trailer_url
    ? youTubeEmbed(pickMeta.trailer_url, { muted: true })
    : null;

  const heroBackdrop = pickMeta?.backdrop_url
    ? thumbSrc(pickMeta.backdrop_url, { w: 1600 })
    : pick1?.poster_url
      ? thumbSrc(pick1.poster_url, { w: 1200 })
      : undefined;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.45, ease: ease.out }}
          className="absolute inset-0 z-40 overflow-hidden bg-black/90 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-label={t("player.bridge.eyebrow") + " " + title}
        >
          {/* Ambient hero background — poster or trailer */}
          <div className="absolute inset-0">
            {trailerLive && trailerSrc ? (
              <iframe
                title={pick1?.title ?? "trailer"}
                src={trailerSrc}
                allow="autoplay; encrypted-media"
                className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 opacity-70"
              />
            ) : heroBackdrop ? (
              <img
                src={heroBackdrop}
                alt=""
                aria-hidden
                className="h-full w-full object-cover opacity-40"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />
          </div>

          <button
            onClick={() => dismiss("close")}
            aria-label={t("player.bridge.close")}
            className="absolute right-4 top-4 z-10 rounded-full border border-white/15 bg-white/5 p-2 text-white/80 transition hover:border-white/30 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative mx-auto flex h-full max-w-5xl flex-col justify-end px-6 pb-8 pt-16 sm:pb-12">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-primary/90">
              {t("player.bridge.eyebrow")}
              <span className="text-white/40">·</span>
              <span className="truncate text-white/80">{title}</span>
            </div>
            <p className="mt-1 text-sm text-white/70">
              {t("player.bridge.subtitle")}
            </p>

            {picks.length > 0 ? (
              <ul className="mt-5 grid grid-cols-3 gap-3 sm:gap-5">
                {picks.map((p, idx) => (
                  <li
                    key={p.slug}
                    className={
                      idx === 0
                        ? "ring-2 ring-primary/60 rounded-xl"
                        : undefined
                    }
                  >
                    <Link
                      to="/phim/$slug"
                      params={{ slug: p.slug }}
                      onClick={() => accept(p, "watch")}
                      className="group block overflow-hidden rounded-xl ring-1 ring-white/10 transition hover:ring-primary/50"
                    >
                      <div className="relative aspect-[2/3] bg-white/5">
                        <img
                          src={thumbSrc(p.poster_url, { w: 400 })}
                          alt={p.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-2.5">
                          <div className="line-clamp-2 font-display text-xs font-semibold leading-tight text-white sm:text-sm">
                            {p.title}
                          </div>
                          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">
                            {p.year} · ★ {p.rating.toFixed(1)}
                          </div>
                          <div className="mt-1.5 inline-flex max-w-full items-center rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-primary/95">
                            <span className="truncate">{reasonChip(p.reason, p.reasonValue)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-5 h-40 rounded-xl border border-white/10 bg-white/[0.02]" />
            )}

            {pick1 && autoNext && !trailerLive && (
              <div
                className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60"
                aria-live="polite"
              >
                {t("player.bridge.trailerIn", { s: countdown })}
              </div>
            )}
            {pick1 && trailerLive && (
              <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-primary/90">
                {t("player.bridge.trailerPlaying")}
              </div>
            )}

            {pick1 && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => openDetail(pick1)}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_-6px_oklch(0.68_0.24_25/0.7)] transition hover:brightness-110"
                  style={{
                    background:
                      "var(--gradient-ember, linear-gradient(135deg,#f97316,#ef4444))",
                  }}
                >
                  <PlayCircle className="h-4 w-4" />
                  {t("player.bridge.playNow")}
                </button>
                <button
                  onClick={() => addToWatchlist(pick1)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 transition hover:border-white/30 hover:text-white"
                >
                  <BookmarkPlus className="h-4 w-4" />
                  {t("player.bridge.addWatchlist")}
                </button>
                <button
                  onClick={() => dismiss("not_interested")}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-white/60 transition hover:border-white/25 hover:text-white/85"
                >
                  <ThumbsDown className="h-4 w-4" />
                  {t("player.bridge.notInterested")}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
