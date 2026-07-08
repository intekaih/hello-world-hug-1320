import { Link } from "@tanstack/react-router";
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";
import { Play, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

import { thumbSrc } from "@/utils/thumbSrc";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { ContinueWatchingItem } from "@/lib/home-queries";
import { ProgressRing, AnimatedPercent } from "./progress-ring";
import { RemainingTimeLabel } from "./remaining-time-label";

/* -------------------------------------------------------------------------- */
/*  helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** "Shogun · Ep 8" → { clean: "Shogun", episode: "8" } */
function parseTitle(raw: string): { clean: string; episode?: string } {
  const m = raw.match(/^(.*?)[·•\-–—]\s*(?:Ep|Tập)\s*(\d+)\s*$/i);
  if (m) return { clean: m[1].trim(), episode: m[2] };
  return { clean: raw };
}

/** "38 min left" → 38 */
function parseRemainingMinutes(text: string): number {
  const m = text.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Given progress and remaining minutes, derive current position "mm:ss". */
function computeResumeTime(progress: number, remainingMin: number): string {
  const totalMin = remainingMin > 0 && progress < 1
    ? remainingMin / (1 - progress)
    : 90;
  const currentSec = Math.round(totalMin * 60 * progress);
  const mm = Math.floor(currentSec / 60);
  const ss = currentSec % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

function lastWatchedLabel(
  index: number,
  t: (k: string, v?: Record<string, string | number>) => string,
): string {
  // Deterministic pseudo-recency by index (real timestamps will replace this).
  const scale = [
    () => t("continueWatching.lastWatched.justNow"),
    () => t("continueWatching.lastWatched.minutesAgo", { n: 24 }),
    () => t("continueWatching.lastWatched.hoursAgo", { n: 3 }),
    () => t("continueWatching.lastWatched.yesterday"),
    () => t("continueWatching.lastWatched.daysAgo", { n: 3 }),
  ];
  return scale[Math.min(index, scale.length - 1)]();
}

function qualityLabel(
  index: number,
  t: (k: string, v?: Record<string, string | number>) => string,
): string {
  const q = ["continueWatching.quality.uhd", "continueWatching.quality.fullHd", "continueWatching.quality.hd"];
  return t(q[index % q.length]);
}

/* -------------------------------------------------------------------------- */
/*  Magnetic Play button — used by both variants                              */
/* -------------------------------------------------------------------------- */

function MagneticPlay({
  size = 56,
  active,
}: {
  size?: number;
  active: boolean;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 20, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 300, damping: 20, mass: 0.4 });
  const ref = useRef<HTMLSpanElement>(null);

  const onMove = (e: React.MouseEvent) => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set(((e.clientX - (r.left + r.width / 2)) / r.width) * 14);
    y.set(((e.clientY - (r.top + r.height / 2)) / r.height) * 14);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy, width: size, height: size }}
      animate={reduce ? undefined : { y: active ? -4 : 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn(
        "grid place-items-center rounded-full bg-white text-black shadow-[0_18px_50px_-12px_oklch(var(--color-primary)/0.7)]",
        "ring-1 ring-white/40 transition-colors",
        active && "bg-primary text-primary-foreground",
      )}
    >
      <Play className="ml-0.5 h-5 w-5 fill-current" />
    </motion.span>
  );
}

/* -------------------------------------------------------------------------- */
/*  ResumeExperienceCard                                                       */
/* -------------------------------------------------------------------------- */

export function ResumeExperienceCard({
  item,
  index,
  featured = false,
}: {
  item: ContinueWatchingItem;
  index: number;
  featured?: boolean;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState(false);

  const { clean, episode } = parseTitle(item.title);
  const remainingMin = parseRemainingMinutes(item.remaining);
  const resumeAt = computeResumeTime(item.progress, remainingMin);
  const pct = Math.round(item.progress * 100);
  const isSeries = !!episode;
  const isNearlyDone = item.progress > 0.85;

  const width = featured
    ? "w-[86vw] max-w-[720px]"
    : "w-[300px] sm:w-[340px]";
  const aspect = featured ? "aspect-[16/9]" : "aspect-[16/10]";

  return (
    <motion.div
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileHover={reduce ? undefined : { scale: 1.015 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={cn("group relative shrink-0 snap-start", width)}
    >
      {/* Ambient backdrop glow — appears on hover, radiates behind card */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-8 rounded-[36px] opacity-0 blur-3xl transition-opacity duration-500",
          "bg-[radial-gradient(ellipse_at_center,var(--color-primary)_0%,transparent_65%)]",
          hover && "opacity-40",
        )}
      />

      <Link
        to="/xem/$slug/tap-{$episode}"
        params={{ slug: item.slug, episode: episode ?? "1" }}
        className={cn(
          "relative block overflow-hidden rounded-2xl bg-black ring-1 ring-white/10",
          "shadow-[0_20px_50px_-25px_rgba(0,0,0,0.9)]",
        )}
      >
        <div className={cn("relative w-full overflow-hidden", aspect)}>
          {/* Backdrop */}
          <motion.img
            src={thumbSrc(item.poster_url, { w: featured ? 1200 : 640 })}
            alt={clean}
            loading="lazy"
            className="h-full w-full object-cover"
            animate={
              reduce
                ? undefined
                : {
                    scale: hover ? 1.06 : 1,
                    filter: hover ? "brightness(1.08) saturate(1.08)" : "brightness(0.85) saturate(0.95)",
                  }
            }
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* Bottom scrim */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
          {/* Left scrim for legibility on featured */}
          {featured && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
          )}

          {/* Top-left metadata: episode + quality */}
          <div className="absolute left-4 top-4 flex items-center gap-2">
            {isSeries && (
              <span className="rounded-md bg-black/55 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/90 backdrop-blur-md">
                {t("continueWatching.episode", { n: episode! })}
              </span>
            )}
            <span className="rounded-md border border-white/25 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-white/90 backdrop-blur-md">
              {qualityLabel(index, t)}
            </span>
          </div>

          {/* Top-right: last watched */}
          <div className="absolute right-4 top-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">
              {lastWatchedLabel(index, t)}
            </span>
          </div>

          {/* Center-right floating ring + play button */}
          <motion.div
            className={cn(
              "absolute z-10",
              featured ? "right-8 top-1/2 -translate-y-1/2" : "right-5 top-1/2 -translate-y-1/2",
            )}
            animate={reduce ? undefined : { y: hover ? -6 : 0, scale: hover ? 1.05 : 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <ProgressRing
              progress={item.progress}
              size={featured ? 96 : 76}
              stroke={featured ? 4 : 3}
            >
              <MagneticPlay size={featured ? 64 : 52} active={hover} />
            </ProgressRing>
          </motion.div>

          {/* Bottom content */}
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            {/* Sliding metadata block */}
            <motion.div
              initial={false}
              animate={
                reduce
                  ? undefined
                  : { y: hover ? 0 : 8, opacity: hover ? 1 : 0.9 }
              }
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={cn("space-y-2", featured ? "max-w-[62%]" : "max-w-[70%]")}
            >
              <h3
                className={cn(
                  "font-display font-semibold leading-tight tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.7)]",
                  featured ? "text-2xl sm:text-3xl" : "text-lg",
                )}
              >
                {clean}
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                <RemainingTimeLabel label={item.remaining} />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">
                  <AnimatedPercent value={item.progress} />
                  <span className="ml-1 text-white/45">
                    {t("continueWatching.percentWatched", { n: pct }).replace(/^\d+%\s*/, "")}
                  </span>
                </span>
              </div>


              {/* Emotional resume line */}
              <motion.p
                initial={false}
                animate={
                  reduce
                    ? undefined
                    : {
                        opacity: hover ? 1 : 0,
                        y: hover ? 0 : 6,
                        height: hover ? "auto" : 0,
                      }
                }
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden text-[13px] italic text-white/85"
              >
                {isNearlyDone && isSeries
                  ? t("continueWatching.nextEpisodeWaiting")
                  : remainingMin > 0
                    ? t("continueWatching.remainingMinutes", { minutes: remainingMin })
                    : t("continueWatching.pickUpWhereLeft")}
              </motion.p>
            </motion.div>

            {/* Thin timeline progress bar */}
            <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={
                  reduce ? { duration: 0 } : { duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }
                }
                className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary shadow-[0_0_10px_var(--color-primary)]"
              />
            </div>

            {/* Resume-from label */}
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
                {t("continueWatching.resumeFrom", { time: resumeAt })}
              </span>
              {featured && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {t("continueWatching.resume")}
                </span>
              )}
            </div>
          </div>

          {/* Hairline border */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
        </div>
      </Link>
    </motion.div>
  );
}
