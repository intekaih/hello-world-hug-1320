import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  Bookmark,
  Flag,
  Heart,
  Play,
  Share2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { useBookmarkState, useShare } from "./action-cluster";
import type { Movie } from "./types";

/**
 * FloatingMovieActions — sticky glass dock: play, favorite, watchlist,
 * share, report, scroll-to-top. Appears after the hero leaves the fold.
 * Bottom offset uses safe-area padding so it never covers mobile chrome.
 */
export function FloatingMovieActions({ movie }: { movie: Movie }) {
  const { t } = useTranslation();
  const { fav, wl, toggleFav, toggleWl } = useBookmarkState(movie);
  const { copied, share } = useShare(movie);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pb-[env(safe-area-inset-bottom)] sm:bottom-6"
          role="toolbar"
          aria-label={movie.title}
        >
          <div className="glass-strong flex items-center gap-1 rounded-full border border-white/12 p-1.5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]">
            <Link
              to="/xem/$slug/tap-{$episode}"
              params={{ slug: movie.slug, episode: "1" }}
              aria-label={t("movieDetail.actions.watchNow")}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_20px_-6px_oklch(0.68_0.24_25/0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              style={{ background: "var(--gradient-ember)" }}
            >
              <Play className="h-4 w-4 fill-current" aria-hidden />
              <span className="hidden sm:inline">
                {t("movieDetail.actions.watchNow")}
              </span>
            </Link>
            <DockButton
              onClick={toggleFav}
              active={fav}
              label={
                fav
                  ? t("movieDetail.actions.unfavorite")
                  : t("movieDetail.actions.favorite")
              }
              icon={<Heart className={cn("h-4 w-4", fav && "fill-current")} aria-hidden />}
            />
            <DockButton
              onClick={toggleWl}
              active={wl}
              label={
                wl
                  ? t("movieDetail.actions.watchlistRemove")
                  : t("movieDetail.actions.watchlist")
              }
              icon={
                <Bookmark className={cn("h-4 w-4", wl && "fill-current")} aria-hidden />
              }
            />
            <DockButton
              onClick={share}
              label={
                copied
                  ? t("movieDetail.actions.shared")
                  : t("movieDetail.actions.share")
              }
              icon={<Share2 className="h-4 w-4" aria-hidden />}
            />
            <ReportLink label={t("movieDetail.actions.report")} />
            <div className="mx-0.5 h-6 w-px bg-white/10" aria-hidden />
            <DockButton
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              label={t("movieDetail.actions.scrollToTop")}
              icon={<ArrowUp className="h-4 w-4" aria-hidden />}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DockButton({
  onClick,
  active,
  icon,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={!!active}
      title={label}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60",
        active && "bg-primary/15 text-primary",
      )}
    >
      {icon}
    </button>
  );
}

function ReportLink({ label }: { label: string }) {
  return (
    <Link
      to="/feedback"
      aria-label={label}
      title={label}
      className="grid h-10 w-10 place-items-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60"
    >
      <Flag className="h-4 w-4" aria-hidden />
    </Link>
  );
}
