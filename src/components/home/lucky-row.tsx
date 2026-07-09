import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Shuffle, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { thumbSrc } from "@/utils/thumbSrc";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import type { MovieCard } from "@/lib/home-queries";
import {
  LUCKY_ITEMS,
  LUCKY_MAX_SHUFFLES,
  consumeShuffle,
  getUserIdHash,
  pickLucky,
  readShuffleState,
  type LuckyPick,
} from "@/lib/lucky";
import type { ReasonKind } from "@/lib/recommendations/engine";

/** i18n key + colour tone for each supported lottery reason chip. */
const REASON_STYLE: Record<
  ReasonKind,
  { i18n: string; tone: string }
> = {
  highlyRated: {
    i18n: "home.lucky.reason.highlyRated",
    tone: "text-gold border-gold/30 bg-gold/10",
  },
  trending: {
    i18n: "home.lucky.reason.trending",
    tone: "text-primary border-primary/30 bg-primary/10",
  },
  unexplored: {
    i18n: "home.lucky.reason.unexplored",
    tone: "text-cyan border-cyan/30 bg-cyan/10",
  },
  similarMood: {
    i18n: "home.lucky.reason.similarMood",
    tone: "text-white/80 border-white/15 bg-white/5",
  },
  sameGenre: {
    i18n: "home.lucky.reason.similarMood",
    tone: "text-white/80 border-white/15 bg-white/5",
  },
  sameCountry: {
    i18n: "home.lucky.reason.similarMood",
    tone: "text-white/80 border-white/15 bg-white/5",
  },
  newEpisode: {
    i18n: "home.lucky.reason.trending",
    tone: "text-primary border-primary/30 bg-primary/10",
  },
  fromWatchlist: {
    i18n: "home.lucky.reason.similarMood",
    tone: "text-white/80 border-white/15 bg-white/5",
  },
  resume: {
    i18n: "home.lucky.reason.similarMood",
    tone: "text-white/80 border-white/15 bg-white/5",
  },
  rewatch: {
    i18n: "home.lucky.reason.similarMood",
    tone: "text-white/80 border-white/15 bg-white/5",
  },
};

export function LuckyRow({ pool }: { pool: MovieCard[] }) {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();

  // Hydrate salt/used from localStorage on the client only.
  const [salt, setSalt] = useState(0);
  const [used, setUsed] = useState(0);
  const [userId, setUserId] = useState("ssr");
  const [shuffling, setShuffling] = useState(false);

  useEffect(() => {
    const s = readShuffleState();
    setSalt(s.salt);
    setUsed(s.used);
    setUserId(getUserIdHash());
  }, []);

  const picks = useMemo<LuckyPick[]>(
    () =>
      pickLucky(pool, { userId, salt, count: LUCKY_ITEMS }),
    [pool, userId, salt],
  );

  const remaining = Math.max(0, LUCKY_MAX_SHUFFLES - used);
  const canShuffle = remaining > 0;

  const onShuffle = () => {
    if (!canShuffle || shuffling) return;
    const { granted, state } = consumeShuffle();
    if (!granted) {
      setUsed(state.used);
      return;
    }
    setShuffling(true);
    setUsed(state.used);
    // Slight delay lets the shuffle animation land before layout swap.
    const delay = prefersReduced ? 0 : 220;
    window.setTimeout(() => {
      setSalt(state.salt);
      setShuffling(false);
    }, delay);
  };

  if (!pool.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-primary/90">
            <Sparkles className="h-3 w-3" />
            {t("home.lucky.eyebrow")}
          </div>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white sm:text-3xl">
            {t("home.lucky.title")}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-white/60">
            {t("home.lucky.subtitle")}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={onShuffle}
            disabled={!canShuffle || shuffling}
            aria-label={t("home.lucky.shuffleAria", {
              remaining,
              max: LUCKY_MAX_SHUFFLES,
            })}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition",
              canShuffle
                ? "border-primary/40 bg-primary/15 text-white hover:border-primary/70 hover:bg-primary/25"
                : "cursor-not-allowed border-white/10 bg-white/5 text-white/40",
            )}
          >
            <Shuffle
              className={cn(
                "h-4 w-4 transition-transform",
                shuffling && "rotate-180",
              )}
            />
            {t("home.lucky.shuffle")}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 font-mono text-[10px]",
                canShuffle
                  ? "bg-white/15 text-white/90"
                  : "bg-white/5 text-white/50",
              )}
            >
              {remaining}/{LUCKY_MAX_SHUFFLES}
            </span>
          </button>
          <p className="text-[11px] text-white/50">
            {canShuffle
              ? t("home.lucky.remaining", { n: remaining })
              : t("home.lucky.exhausted")}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "scrollbar-none -mx-4 flex snap-x snap-proximity gap-4 overflow-x-auto rail-scroll px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
          shuffling && !prefersReduced && "pointer-events-none",
        )}
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {picks.map((m, i) => (
            <motion.div
              key={`${m.id}-${salt}`}
              layout={!prefersReduced}
              initial={
                prefersReduced
                  ? { opacity: 0 }
                  : { opacity: 0, y: 14, rotateZ: -3, scale: 0.94 }
              }
              animate={
                prefersReduced
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, rotateZ: 0, scale: 1 }
              }
              exit={
                prefersReduced
                  ? { opacity: 0 }
                  : { opacity: 0, y: -14, rotateZ: 3, scale: 0.94 }
              }
              transition={{
                duration: prefersReduced ? 0.15 : 0.35,
                delay: prefersReduced ? 0 : Math.min(i * 0.02, 0.18),
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-[150px] shrink-0 snap-start sm:w-[170px] lg:w-[190px]"
            >
              <LuckyCard pick={m} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LuckyCard({ pick }: { pick: LuckyPick }) {
  const { t } = useTranslation();
  const style = REASON_STYLE[pick.reason] ?? REASON_STYLE.similarMood;
  return (
    <Link
      to="/phim/$slug"
      params={{ slug: pick.slug }}
      className="group block"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-surface-elevated shadow-[0_10px_30px_-15px_rgba(0,0,0,0.5)] transition duration-500 group-hover:shadow-[0_30px_80px_-20px_oklch(0.65_0.22_15/0.5)]">
        <img
          src={thumbSrc(pick.poster_url, { w: 400 })}
          alt={pick.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <div className="absolute inset-x-2 bottom-2 space-y-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] backdrop-blur",
              style.tone,
            )}
          >
            {t(style.i18n)}
          </span>
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-white drop-shadow">
            {pick.title}
          </p>
        </div>
      </div>
    </Link>
  );
}
