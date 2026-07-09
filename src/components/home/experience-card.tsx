import { Link } from "@tanstack/react-router";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import {
  Bookmark,
  Heart,
  Info,
  Play,
  Star,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { thumbSrc } from "@/utils/thumbSrc";
import { type MovieCard, hasVisibleProgress, isNearComplete } from "@/lib/home-queries";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/design";
import { useTranslation } from "@/hooks/useTranslation";
import { claimPreviewSlot, releasePreviewSlot } from "@/lib/media/preview-slot";

/** Hover-intent delay before we consider it a real preview intent. */
const HOVER_INTENT_MS = 200;


/**
 * ExperienceCard — the "Movie Experience Card" replacing the flat poster.
 *
 * Hover unfolds in four stages so anticipation builds instead of firing all
 * at once:
 *  · Stage 1 (0–120ms):   soft elevation, depth increase, cursor magnetism
 *  · Stage 2 (120–300ms): 3D tilt tracks cursor + light sweep
 *  · Stage 3 (300–600ms): muted trailer preview fades over the poster
 *  · Stage 4 (600ms+):    quick actions spring in one-by-one
 *
 * Reflection, ambient glow, and progressive metadata are always on the
 * poster — subtle enough to read as luxury, present enough to reward the
 * eye every time a card is hovered.
 *
 * Perf: transforms + opacity only, GPU-accelerated. Trailer element only
 * mounts on hover-intent and pauses when the card scrolls offscreen.
 */

export type ExperienceCardProps = {
  movie: MovieCard;
  /** Optional muted trailer preview src (mp4/webm/hls). */
  trailerUrl?: string;
  /** 0–1. If set, renders progress ring + resume glow. */
  progress?: number;
  /** e.g. "12 min left" — pairs with progress. */
  remaining?: string;
  /** Episode indicator, e.g. "S1 · E8". */
  episode?: string;
  /** Optional decorative rank number (used by Top-10 style rows). */
  rank?: number;
  /** Layout width preset. */
  size?: "sm" | "md" | "lg";
  /** Extra metadata for reveal. */
  meta?: {
    year?: number;
    runtime?: string;
    genres?: string[];
  };
  className?: string;
};

const SIZES = {
  sm: "w-[150px] sm:w-[170px]",
  md: "w-[170px] sm:w-[190px] lg:w-[210px]",
  lg: "w-[190px] sm:w-[220px] lg:w-[240px]",
} as const;

const EASE = ease.outSoft;

export function ExperienceCard({
  movie,
  trailerUrl,
  progress,
  remaining,
  episode,
  rank,
  size = "md",
  meta,
  className,
}: ExperienceCardProps) {
  const rootRef = useRef<HTMLAnchorElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();

  // Hover stage tracking — timers advance through the four stages.
  const [hovered, setHovered] = useState(false);
  const [stage, setStage] = useState(0); // 0..4
  const stageTimers = useRef<number[]>([]);

  // Trailer mount + ready state (Stage 3 fade-in).
  const [videoMounted, setVideoMounted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [inView, setInView] = useState(true);

  // Coarse-pointer tap-preview state: first tap arms the preview, second
  // tap navigates. `previewArmed` is true while we are showing the
  // preview overlay from a tap gesture (not a hover).
  const [previewArmed, setPreviewArmed] = useState(false);
  const previewSlotId = useRef<symbol | null>(null);
  const isCoarsePointer = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    isCoarsePointer.current = window.matchMedia("(pointer: coarse)").matches;
  }, []);


  // Mouse-tracked 3D tilt.
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotY = useSpring(useMotionValue(0), { stiffness: 220, damping: 22, mass: 0.5 });
  const rotX = useSpring(useMotionValue(0), { stiffness: 220, damping: 22, mass: 0.5 });
  const glowX = useMotionTemplate`${useMotionValue(50)}%`;

  const transform = useMotionTemplate`perspective(1100px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;

  // Reflection position tied to mouse via CSS custom prop on inner poster.
  const mouseX = useMotionValue(50);
  const mouseY = useMotionValue(50);
  const reflection = useMotionTemplate`radial-gradient(220px circle at ${mouseX}% ${mouseY}%, oklch(1 0 0 / 0.22), transparent 55%)`;

  // ── Intersection: pause video offscreen ─────────────────────────────
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!inView || (!hovered && !previewArmed) || videoError) {
      v.pause();
    } else if (videoReady) {
      void v.play().catch(() => {});
    }
  }, [inView, hovered, previewArmed, videoReady, videoError]);

  // ── Hover-stage orchestration ───────────────────────────────────────
  const clearStageTimers = useCallback(() => {
    stageTimers.current.forEach((id) => window.clearTimeout(id));
    stageTimers.current = [];
  }, []);

  /** Actually load the trailer — gated behind hover-intent (200ms). */
  const mountTrailer = useCallback(() => {
    if (!trailerUrl) return;
    setVideoError(false);
    setVideoMounted(true);
    // Claim the global slot so other cards stop their videos.
    previewSlotId.current = claimPreviewSlot(() => {
      // Another card took over — collapse this preview.
      const v = videoRef.current;
      if (v) v.pause();
      setVideoMounted(false);
      setVideoReady(false);
      setPreviewArmed(false);
    });
  }, [trailerUrl]);

  const enter = useCallback(() => {
    if (reduce) {
      setHovered(true);
      setStage(2);
      return;
    }
    setHovered(true);
    clearStageTimers();
    stageTimers.current.push(window.setTimeout(() => setStage(1), 0));
    stageTimers.current.push(window.setTimeout(() => setStage(2), 120));
    // Hover-intent gate: only fetch/mount the trailer after HOVER_INTENT_MS.
    // Fast scroll-throughs never trigger a network request.
    stageTimers.current.push(
      window.setTimeout(() => {
        setStage(3);
        mountTrailer();
      }, HOVER_INTENT_MS),
    );
    stageTimers.current.push(window.setTimeout(() => setStage(4), 600));
  }, [clearStageTimers, reduce, mountTrailer]);

  const leave = useCallback(() => {
    clearStageTimers();
    setHovered(false);
    setStage(0);
    setVideoReady(false);
    setPreviewArmed(false);
    rotX.set(0);
    rotY.set(0);
    if (previewSlotId.current) {
      releasePreviewSlot(previewSlotId.current);
      previewSlotId.current = null;
    }
    // Leave the video mounted for a moment to reuse on quick re-hover.
    stageTimers.current.push(
      window.setTimeout(() => setVideoMounted(false), 800),
    );
  }, [clearStageTimers, rotX, rotY]);

  useEffect(
    () => () => {
      clearStageTimers();
      if (previewSlotId.current) releasePreviewSlot(previewSlotId.current);
    },
    [clearStageTimers],
  );


  // ── Mouse tracking → tilt + reflection ──────────────────────────────
  const handleMove = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (reduce) return;
      // 3D tilt only makes sense on precise pointers. Bail early on touch.
      if (typeof window !== "undefined" &&
          !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      mx.set(px);
      my.set(py);
      mouseX.set(px * 100);
      mouseY.set(py * 100);
      rotY.set((px - 0.5) * 12); // subtle luxury tilt
      rotX.set((py - 0.5) * -8);
    },
    [mouseX, mouseY, mx, my, reduce, rotX, rotY],
  );

  // ── Quick actions handlers (no navigation) ──────────────────────────
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const toggle = (setter: (v: boolean) => void, current: boolean) =>
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setter(!current);
    };

  const stage3 = stage >= 3;
  const stage4 = stage >= 4;

  // ── Coarse-pointer gesture: first tap = preview, second tap = navigate.
  // Long-press (500ms) also triggers preview without navigation. Precise
  // pointers keep the classic hover behaviour and never enter this branch.
  const longPressTimer = useRef<number | null>(null);
  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (!isCoarsePointer.current) return; // fine pointer → normal nav
      if (!trailerUrl) return; // no preview available → let it navigate
      if (previewArmed) {
        // Second tap: release slot then navigate.
        if (previewSlotId.current) {
          releasePreviewSlot(previewSlotId.current);
          previewSlotId.current = null;
        }
        setPreviewArmed(false);
        return; // navigation proceeds
      }
      // First tap: swallow navigation, arm preview.
      e.preventDefault();
      setPreviewArmed(true);
      setStage(3);
      mountTrailer();
    },
    [mountTrailer, previewArmed, trailerUrl],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLAnchorElement>) => {
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      if (!trailerUrl) return;
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
      longPressTimer.current = window.setTimeout(() => {
        setPreviewArmed(true);
        setStage(3);
        mountTrailer();
      }, 500);
    },
    [mountTrailer, trailerUrl],
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);



  return (
    <Link
      ref={rootRef}
      to={progress != null ? "/xem/$slug/tap-{$episode}" : "/phim/$slug"}
      params={
        progress != null
          ? { slug: movie.slug, episode: "1" }
          : { slug: movie.slug }
      }
      onMouseEnter={enter}
      onMouseLeave={leave}
      onMouseMove={handleMove}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      className={cn(
        "group/card relative shrink-0 snap-start",
        SIZES[size],
        className,
      )}
      aria-label={movie.title}
    >
      {/* Ambient glow that bleeds beyond the card into neighbours */}
      <motion.div
        aria-hidden
        initial={false}
        animate={{
          opacity: hovered ? 0.9 : 0,
          scale: hovered ? 1 : 0.85,
        }}
        transition={{ duration: 0.6, ease: EASE }}
        className="pointer-events-none absolute -inset-8 -z-10 rounded-[36px] blur-2xl"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 55%, oklch(0.65 0.22 15 / 0.55), transparent 70%)",
        }}
      />

      {/* Optional decorative rank behind card */}
      {rank != null && (
        <span
          aria-hidden
          className="pointer-events-none absolute -left-6 bottom-1 select-none font-display text-[170px] italic leading-[0.78] tracking-[-0.08em] text-transparent [-webkit-text-stroke:1.5px_var(--color-primary)] sm:-left-8 sm:text-[210px]"
          style={{
            background:
              "linear-gradient(160deg, oklch(0.65 0.22 15 / 0.95) 0%, oklch(0.78 0.16 70 / 0.7) 45%, oklch(0.65 0.22 15 / 0.05) 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            fontWeight: 900,
          }}
        >
          {rank}
        </span>
      )}

      {/* Tilt wrapper */}
      <motion.div
        style={{
          transform,
          transformStyle: "preserve-3d",
        }}
        animate={{
          y: hovered ? -6 : 0,
          scale: hovered ? 1.02 : 1,
        }}
        transition={{ duration: 0.4, ease: EASE }}
        className={cn(
          "relative aspect-[2/3] overflow-hidden rounded-2xl bg-surface-elevated",
          "shadow-[0_10px_30px_-15px_rgba(0,0,0,0.6)]",
          "transition-shadow duration-500",
          "group-hover/card:shadow-[0_40px_100px_-25px_oklch(0.65_0.22_15/0.55)]",
          rank != null && "ml-8 sm:ml-10",
        )}
      >
        {/* Poster image */}
        <motion.img
          src={thumbSrc(movie.poster_url, { w: 500 })}
          alt={movie.title}
          loading="lazy"
          animate={{ scale: hovered ? 1.06 : 1 }}
          transition={{ duration: 0.9, ease: EASE }}
          className="h-full w-full object-cover"
          style={{ willChange: "transform" }}
        />

        {/* Trailer video — mounted only after 200ms hover-intent, and stopped
            if another card claims the global preview slot. Poster stays
            underneath: on error we simply skip the crossfade so the user
            keeps seeing poster + rating (no broken frame). */}
        <AnimatePresence>
          {videoMounted && trailerUrl && !videoError && (
            <motion.video
              key="trailer"
              ref={videoRef}
              src={trailerUrl}
              muted
              loop
              playsInline
              preload="metadata"
              initial={{ opacity: 0 }}
              animate={{ opacity: videoReady && stage3 ? 1 : 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              onCanPlay={() => setVideoReady(true)}
              onError={() => {
                setVideoError(true);
                setVideoReady(false);
                setVideoMounted(false);
              }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </AnimatePresence>


        {/* Reflection sheen — follows cursor */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
          style={{ background: reflection }}
        />

        {/* Slow light sweep on entry */}
        {hovered && !reduce && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            style={{
              animation: "light-sweep 1200ms var(--ease-out-soft) 180ms both",
            }}
          />
        )}

        {/* Glass overlay + bottom scrim on hover */}
        <motion.div
          aria-hidden
          initial={false}
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[oklch(0.06_0.02_280/0.94)] via-[oklch(0.06_0.02_280/0.35)] to-transparent"
        />

        {/* Rating chip — always on */}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 backdrop-blur-md">
          <Star className="h-3 w-3 fill-gold text-gold" />
          <span className="font-mono text-[10px] font-semibold text-white">
            {movie.rating.toFixed(1)}
          </span>
        </div>

        {/* Progress ring — only when actually in progress */}
        {hasVisibleProgress(progress) && (
          <ProgressBadge progress={progress!} nearlyDone={isNearComplete(progress)} />
        )}

        {/* Episode badge */}
        {episode && (
          <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white backdrop-blur-md">
            {episode}
          </div>
        )}

        {/* Progressive metadata reveal */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <motion.div
            initial={false}
            animate={{
              opacity: hovered ? 1 : 0,
              y: hovered ? 0 : 10,
            }}
            transition={{ duration: 0.45, ease: EASE, delay: hovered ? 0.15 : 0 }}
          >
            <p className="line-clamp-2 font-display text-[15px] font-medium leading-tight tracking-tight text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.7)]">
              {movie.title}
            </p>
            <motion.div
              initial={false}
              animate={{
                opacity: hovered ? 1 : 0,
                y: hovered ? 0 : 6,
              }}
              transition={{ duration: 0.4, delay: hovered ? 0.28 : 0 }}
              className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/75"
            >
              <span>{meta?.year ?? movie.year}</span>
              {meta?.runtime && (
                <>
                  <span aria-hidden className="text-primary/80">◆</span>
                  <span>{meta.runtime}</span>
                </>
              )}
              {meta?.genres?.length ? (
                <>
                  <span aria-hidden className="text-primary/80">◆</span>
                  <span className="truncate">{meta.genres.slice(0, 2).join(" · ")}</span>
                </>
              ) : null}
              {remaining && (
                <>
                  <span aria-hidden className="text-primary/80">◆</span>
                  <span>{remaining}</span>
                </>
              )}
            </motion.div>
          </motion.div>
        </div>

        {/* Quick actions — Stage 4 spring reveal */}
        <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-2">
          <QuickAction
            icon={<Play className="h-3.5 w-3.5 fill-current" />}
            label="Play"
            visible={stage4}
            delay={0}
            primary
          />
          <QuickAction
            icon={<Bookmark className={cn("h-3.5 w-3.5", saved && "fill-current")} />}
            label={saved ? "Đã lưu" : "Watchlist"}
            visible={stage4}
            delay={0.06}
            active={saved}
            onClick={toggle(setSaved, saved)}
          />
          <QuickAction
            icon={<Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />}
            label={liked ? "Đã thích" : "Favorite"}
            visible={stage4}
            delay={0.12}
            active={liked}
            onClick={toggle(setLiked, liked)}
          />
          <QuickAction
            icon={<Info className="h-3.5 w-3.5" />}
            label="Info"
            visible={stage4}
            delay={0.18}
          />
        </div>

        {/* Hairline border */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/8" />
      </motion.div>

      {/* Idle title (below poster) */}
      <div
        className={cn(
          "mt-2.5 space-y-0.5 transition-opacity duration-300",
          hovered && "opacity-40",
          rank != null && "ml-8 sm:ml-10",
        )}
      >
        <p className="truncate text-[13px] font-medium tracking-tight text-foreground">
          {movie.title}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/50">
          {meta?.year ?? movie.year}
        </p>
      </div>

      {/* Hide glow motion template unused warning */}
      <motion.span aria-hidden className="hidden" style={{ left: glowX }} />
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function QuickAction({
  icon,
  label,
  visible,
  delay,
  primary,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  visible: boolean;
  delay: number;
  primary?: boolean;
  active?: boolean;
  onClick?: (e: MouseEvent) => void;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        scale: visible ? 1 : 0.5,
        x: visible ? 0 : 14,
      }}
      transition={{
        type: "spring",
        stiffness: 320,
        damping: 22,
        delay: visible ? delay : 0,
      }}
      className={cn(
        "pointer-events-auto grid h-8 w-8 place-items-center rounded-full backdrop-blur-md transition-colors",
        primary
          ? "bg-foreground text-background shadow-[var(--shadow-glow-primary)]"
          : active
            ? "bg-primary/90 text-primary-foreground"
            : "bg-black/55 text-white hover:bg-black/75",
      )}
    >
      {icon}
    </motion.button>
  );
}

function ProgressBadge({
  progress,
  nearlyDone,
}: {
  progress: number;
  nearlyDone: boolean;
}) {
  const { t } = useTranslation();
  const clamped = Math.max(0, Math.min(1, progress));
  const R = 14;
  const C = 2 * Math.PI * R;
  const dash = C * clamped;
  return (
    <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
      <div className="relative grid h-9 w-9 place-items-center">
        <span aria-hidden className="absolute inset-0 rounded-full bg-primary/40 blur-md" />
        <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r={R} fill="none" stroke="oklch(1 0 0 / 0.2)" strokeWidth="2.5" />
          <circle
            cx="18"
            cy="18"
            r={R}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C - dash}`}
            style={{ filter: "drop-shadow(0 0 6px var(--color-primary))" }}
          />
        </svg>
        <Play className="relative h-3 w-3 fill-white text-white" />
      </div>
      {nearlyDone ? (
        <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground shadow-[0_0_14px_-4px_var(--color-primary)]">
          {t("continueWatching.nearlyDone")}
        </span>
      ) : (
        <span className="rounded-full bg-black/55 px-2 py-0.5 font-mono text-[10px] font-medium text-white backdrop-blur-md">
          {Math.round(clamped * 100)}%
        </span>
      )}
    </div>
  );
}
