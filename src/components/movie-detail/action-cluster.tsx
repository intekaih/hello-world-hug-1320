import { Link } from "@tanstack/react-router";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import {
  Bookmark,
  Film,
  Heart,
  Play,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import type { Movie } from "./types";
import { useShareMovie } from "@/lib/share/use-share-movie";
import { playWhoosh } from "@/lib/ui-sound";
import { track } from "@/lib/track";

/* -------------------------------------------------------------------------- */
/*  Persisted client-side bookmark state — matches the previous behaviour     */
/* -------------------------------------------------------------------------- */

export function useBookmarkState(movie: Movie) {
  const { t } = useTranslation();
  const [fav, setFav] = useState(false);
  const [wl, setWl] = useState(false);

  useEffect(() => {
    try {
      setFav(localStorage.getItem(`fav:${movie.slug}`) === "1");
      setWl(localStorage.getItem(`wl:${movie.slug}`) === "1");
    } catch {}
  }, [movie.slug]);

  const persist = (key: string, v: boolean) => {
    try {
      if (v) localStorage.setItem(key, "1");
      else localStorage.removeItem(key);
    } catch {}
  };

  const setWatchlist = (next: boolean) => {
    setWl(next);
    persist(`wl:${movie.slug}`, next);
    // Best-effort server sync so the /watchlist page reflects the change.
    const runtimeMin = (() => {
      const m = /(\d+)/.exec(movie.duration ?? "");
      return m ? Number.parseInt(m[1], 10) : undefined;
    })();
    try {
      if (next) {
        void fetch("/api/watchlist/toggle", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            movie_slug: movie.slug,
            movie_name: movie.title,
            movie_origin_name: movie.original_title,
            movie_thumb: movie.poster_url ?? "",
            runtime: runtimeMin,
          }),
        });
      } else {
        void fetch("/api/watchlist/toggle", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            movie_slug: movie.slug,
            movie_name: movie.title,
            movie_thumb: movie.poster_url ?? "",
          }),
        });
      }
    } catch {}
  };

  return {
    fav,
    wl,
    toggleFav: () => {
      const next = !fav;
      setFav(next);
      persist(`fav:${movie.slug}`, next);
      if (next) playWhoosh();
    },
    toggleWl: () => {
      const next = !wl;
      setWatchlist(next);
      if (next) {
        playWhoosh();
        track("watchlist_add", { slug: movie.slug, source: "detail_hero" });
        // Loss-aversion + safety: 5s window to undo an add.
        toast(t("watchlist.addedToast"), {
          duration: 5000,
          action: {
            label: t("watchlist.undo"),
            onClick: () => setWatchlist(false),
          },
        });
      } else {
        toast(t("watchlist.removedToast"), {
          duration: 5000,
          action: {
            label: t("watchlist.undo"),
            onClick: () => setWatchlist(true),
          },
        });
      }
    },
  };
}

export function useShare(movie: Movie) {
  const { open } = useShareMovie();
  const share = () => {
    open({
      title: movie.title,
      slug: movie.slug,
      posterUrl: movie.poster_url,
      description: movie.overview_vi ?? movie.overview,
    });
  };
  return { copied: false, share };
}



/* -------------------------------------------------------------------------- */
/*  Magnetic primary button — Play "Watch Now"                                */
/* -------------------------------------------------------------------------- */

function MagneticWrap({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 20, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 260, damping: 20, mass: 0.4 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce) return;
    const el = wrap.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set(((e.clientX - (r.left + r.width / 2)) / r.width) * 18);
    y.set(((e.clientY - (r.top + r.height / 2)) / r.height) * 12);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={wrap}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      className="relative"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 rounded-full blur-2xl",
          !reduce && "animate-[pulse_2.6s_cubic-bezier(0.4,0,0.6,1)_infinite]",
        )}
        style={{
          background: "radial-gradient(circle, var(--color-primary) 0%, transparent 70%)",
          opacity: 0.55,
        }}
      />
      <motion.div whileTap={reduce ? undefined : { scale: 0.96 }}>{children}</motion.div>
    </motion.div>
  );
}

function PlayCTA({ slug, label }: { slug: string; label: string }) {
  return (
    <MagneticWrap>
      <Link
        to="/xem/$slug/tap-{$episode}"
        params={{ slug, episode: "1" }}
        className={cn(
          "group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full px-7 py-3.5 text-sm font-semibold text-primary-foreground",
          "shadow-[0_2px_10px_rgba(0,0,0,0.25),0_20px_40px_-15px_oklch(0.68_0.24_25/0.6),0_40px_80px_-30px_oklch(0.78_0.18_55/0.55)]",
          "transition-transform duration-500 hover:-translate-y-0.5",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary/70",
        )}
        style={{ background: "var(--gradient-ember)" }}
      >
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <Play className="h-4 w-4 fill-current" aria-hidden />
        <span className="tracking-wide">{label}</span>
      </Link>
    </MagneticWrap>
  );
}


/* -------------------------------------------------------------------------- */
/*  Secondary action — glass button with spring press                         */
/* -------------------------------------------------------------------------- */

function GlassAction({
  icon: Icon,
  label,
  active,
  activeClass,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  activeClass?: string;
  onClick: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.94 }}
      whileHover={reduce ? undefined : { y: -1 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      aria-label={label}
      aria-pressed={!!active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/85 backdrop-blur-md transition-colors",
        "hover:border-white/30 hover:bg-white/[0.12] hover:text-white",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60",
        active && activeClass,
      )}
    >
      <Icon className={cn("h-4 w-4", active && "fill-current")} aria-hidden />
      <span>{label}</span>
    </motion.button>
  );
}

/* -------------------------------------------------------------------------- */
/*  MovieActionCluster                                                         */
/* -------------------------------------------------------------------------- */

export function MovieActionCluster({ movie }: { movie: Movie }) {
  const { t } = useTranslation();
  const { fav, wl, toggleFav, toggleWl } = useBookmarkState(movie);
  const { copied, share } = useShare(movie);

  return (
    <div className="flex flex-wrap items-center gap-2.5 pt-4 sm:gap-3">
      <PlayCTA slug={movie.slug} label={t("movieDetail.actions.watchNow")} />

      {/* Secondary emphasis — "Thêm vào danh sách" sits right next to Play */}
      <motion.button
        type="button"
        onClick={toggleWl}
        whileTap={{ scale: 0.96 }}
        whileHover={{ y: -1 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        aria-pressed={wl}
        aria-label={
          wl
            ? t("movieDetail.actions.watchlistRemove")
            : t("movieDetail.actions.watchlist")
        }
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold backdrop-blur-md transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60",
          wl
            ? "border-cyan/50 bg-cyan/15 text-white"
            : "border-white/25 bg-white/[0.08] text-white hover:border-white/45 hover:bg-white/[0.14]",
        )}
      >
        <Bookmark className={cn("h-4 w-4", wl && "fill-current")} aria-hidden />
        <span>
          {wl
            ? t("movieDetail.actions.watchlistRemove")
            : t("movieDetail.actions.watchlist")}
        </span>
      </motion.button>

      <GlassAction
        icon={Heart}
        active={fav}
        activeClass="text-primary border-primary/40 bg-primary/10"
        label={
          fav
            ? t("movieDetail.actions.unfavorite")
            : t("movieDetail.actions.favorite")
        }
        onClick={toggleFav}
      />
      {movie.trailer_url && (
        <GlassAction
          icon={Film}
          label={t("movieDetail.actions.trailer")}
          onClick={() => window.open(movie.trailer_url, "_blank", "noopener")}
        />
      )}
      <GlassAction
        icon={Share2}
        label={
          copied ? t("movieDetail.actions.shared") : t("movieDetail.actions.share")
        }
        onClick={share}
      />
    </div>
  );
}
