import { Link } from "@tanstack/react-router";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";
import { Play, Info, Volume2, VolumeX, ArrowDown, RotateCcw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { thumbSrc } from "@/utils/thumbSrc";
import type { HeroMovie } from "@/lib/home-queries";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/design";
import { normalizeTrailerSource } from "@/lib/media/trailer";
import { track } from "@/lib/track";

/**
 * CinematicHero — the emotional opening scene of MovieCC.
 *
 * Full-viewport experience. Attempts autoplay muted trailer, falls back
 * to a living Ken-Burns backdrop with volumetric fog, ambient particles,
 * mouse-reactive parallax depth, and a staged reveal that stops the eye
 * in under two seconds.
 */

const SLIDE_MS = 8500;

export type HeroResume = {
  slug: string;
  title?: string;
  progress: number;
  remaining: string;
  episode?: string;
};

type CinematicHeroProps = {
  movies: HeroMovie[];
  /** Optional trailer sources per hero movie id. */
  trailers?: Record<number, string | undefined>;
  /** Optional Zeigarnik resume — replaces primary CTA when valid. */
  resume?: HeroResume;
};

export function CinematicHero({ movies, trailers, resume }: CinematicHeroProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();

  // Mouse-reactive parallax with spring smoothing
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smoothX = useSpring(mx, { stiffness: 60, damping: 20, mass: 0.6 });
  const smoothY = useSpring(my, { stiffness: 60, damping: 20, mass: 0.6 });

  const bgX = useTransform(smoothX, (v) => v * -24);
  const bgY = useTransform(smoothY, (v) => v * -18);
  const midX = useTransform(smoothX, (v) => v * -12);
  const midY = useTransform(smoothY, (v) => v * -8);
  const contentX = useTransform(smoothX, (v) => v * 10);
  const contentY = useTransform(smoothY, (v) => v * 6);

  const movie = movies[index];

  // Skip trailer autoplay on coarse-pointer (mobile) or Save-Data.
  // Big win: kills ~5-20MB/slide of unused bandwidth + a background video
  // decode loop that stalls scrolling on low-end devices.
  const allowTrailer = useMemo(() => {
    if (typeof window === "undefined") return false;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn?.saveData) return false;
    if (conn?.effectiveType && /^(slow-)?2g$/.test(conn.effectiveType)) return false;
    return !coarse;
  }, []);

  // Prefer explicit trailer map (backward-compat); fall back to normalized
  // movie.trailer_url. Only direct video URLs autoplay; YouTube/Vimeo/none
  // gracefully fall back to the animated backdrop + optional external btn.
  const trailerSource = movie ? normalizeTrailerSource(movie) : { kind: "none" as const };
  const explicitTrailer = movie ? trailers?.[movie.id] : undefined;
  const trailerSrc = allowTrailer
    ? (explicitTrailer ??
       (trailerSource.kind === "direct" ? trailerSource.src : undefined))
    : undefined;
  const externalTrailer =
    trailerSource.kind === "youtube" || trailerSource.kind === "vimeo"
      ? trailerSource.external
      : undefined;


  // Auto-advance slides
  useEffect(() => {
    if (paused || movies.length <= 1) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % movies.length),
      SLIDE_MS,
    );
    return () => window.clearInterval(id);
  }, [paused, movies.length, index]);

  // Cue entrance
  useEffect(() => {
    const id = window.setTimeout(() => setEntered(true), 60);
    return () => window.clearTimeout(id);
  }, []);

  // Reset video state on slide change
  useEffect(() => {
    setVideoReady(false);
  }, [movie?.id]);

  const resumeValid =
    !!resume && resume.progress > 0.05 && resume.progress < 0.95 && !!resume.slug;

  useEffect(() => {
    if (resumeValid && resume) track("hero_resume_shown", { slug: resume.slug });
  }, [resumeValid, resume?.slug]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (reduce) return;
      // Skip on touch devices — no hover, wastes CPU on every scroll.
      if (typeof window !== "undefined" &&
          !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      mx.set((e.clientX - rect.left) / rect.width - 0.5);
      my.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [mx, my, reduce],
  );

  const handleLeave = useCallback(() => {
    mx.set(0);
    my.set(0);
    setPaused(false);
  }, [mx, my]);

  // Deterministic particles per slide
  const particles = useMemo(() => {
    const seed = movie?.id ?? 1;
    return Array.from({ length: 22 }, (_, i) => {
      const r = pseudo(seed * 97 + i * 13);
      return {
        left: r() * 100,
        top: 40 + r() * 60,
        size: 1 + r() * 2.5,
        delay: r() * 8,
        duration: 12 + r() * 14,
        drift: (r() - 0.5) * 60,
        opacity: 0.25 + r() * 0.55,
      };
    });
  }, [movie?.id]);

  if (!movie) return null;

  return (
    <section
      ref={sectionRef}
      className="relative -mx-4 -mt-4 h-[70dvh] min-h-[520px] overflow-hidden bg-background sm:-mx-6 sm:h-[86dvh] sm:min-h-[640px] lg:-mx-8 lg:h-[92dvh] lg:rounded-[32px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={handleLeave}
      onMouseMove={handleMouseMove}
      aria-roledescription="carousel"
      aria-label="Featured films"
    >
      {/* BACKDROP LAYER — video with image fallback, mouse parallax */}
      <AnimatePresence mode="sync">
        <motion.div
          key={movie.id}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 1.6, ease: ease.outSoft }}
          className="absolute inset-0"
        >
          <motion.div
            style={{ x: bgX, y: bgY }}
            className="absolute -inset-[8%] will-change-transform"
          >
            <img
              src={thumbSrc(movie.backdrop_url, { w: 1920 })}
              alt=""
              className={cn(
                "h-full w-full object-cover",
                reduce ? "" : "ken-burns",
                videoReady ? "opacity-0" : "opacity-100",
                "transition-opacity duration-700",
              )}
              fetchPriority="high"
            />
            {trailerSrc && (
              <video
                ref={videoRef}
                key={trailerSrc}
                src={trailerSrc}
                autoPlay
                loop
                muted={muted}
                playsInline
                onCanPlay={() => setVideoReady(true)}
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000",
                  videoReady ? "opacity-100" : "opacity-0",
                )}
              />
            )}
          </motion.div>

          {/* Volumetric fog / light rays layer */}
          <motion.div
            style={{ x: midX, y: midY }}
            aria-hidden
            className="pointer-events-none absolute -inset-[6%] mix-blend-screen opacity-70"
          >
            <div className="absolute inset-0 [background:radial-gradient(60%_45%_at_20%_18%,oklch(0.75_0.18_60/0.35),transparent_70%)]" />
            <div className="absolute inset-0 [background:radial-gradient(50%_40%_at_78%_12%,oklch(0.55_0.22_270/0.28),transparent_70%)]" />
            <div className="absolute inset-0 [background:radial-gradient(70%_60%_at_50%_120%,oklch(0.6_0.24_15/0.32),transparent_70%)]" />
          </motion.div>

          {/* Color grade + aurora */}
          <div className="pointer-events-none absolute inset-0 aurora opacity-60 mix-blend-soft-light" />

          {/* Ambient particles */}
          {!reduce && (
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              {particles.map((p, i) => (
                <span
                  key={i}
                  className="cine-particle"
                  style={
                    {
                      left: `${p.left}%`,
                      top: `${p.top}%`,
                      width: `${p.size}px`,
                      height: `${p.size}px`,
                      opacity: p.opacity,
                      animationDelay: `${p.delay}s`,
                      animationDuration: `${p.duration}s`,
                      "--drift": `${p.drift}px`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}

          {/* Anamorphic letterbox that lifts into place */}
          <motion.div
            initial={{ height: "12vh" }}
            animate={{ height: entered ? "3.5vh" : "12vh" }}
            transition={{ duration: 1.6, ease: ease.outSoft, delay: 0.1 }}
            className="pointer-events-none absolute inset-x-0 top-0 bg-black"
          />
          <motion.div
            initial={{ height: "12vh" }}
            animate={{ height: entered ? "3.5vh" : "12vh" }}
            transition={{ duration: 1.6, ease: ease.outSoft, delay: 0.1 }}
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-black"
          />

          {/* Scrims for text legibility — always dark so white content stays readable in both themes */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent" />
          <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_40%,oklch(0_0_0/0.6)_100%)]" />
          <div className="grain" />
        </motion.div>
      </AnimatePresence>

      {/* CONTENT LAYER */}
      <div className="dark absolute inset-0 flex items-end p-5 pb-14 text-white sm:p-10 sm:pb-20 lg:p-16 lg:pb-24">
        <motion.div
          key={`content-${movie.id}`}
          style={{ x: contentX, y: contentY }}
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: { staggerChildren: 0.09, delayChildren: 0.35 },
            },
          }}
          className="relative max-w-2xl space-y-5"
        >
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.7, ease: EASE }}
            className="flex items-center gap-3"
          >
            <span className="h-px w-10 bg-primary" />
            {resumeValid && resume ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary">
                Tiếp tục · Còn {resume.remaining}
              </span>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/75">
                Feature Presentation · Ep 01
              </span>
            )}
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 40, filter: "blur(20px)" },
              show: { opacity: 1, y: 0, filter: "blur(0px)" },
            }}
            transition={{ duration: 1.2, ease: EASE }}
          >
            <HeroLogo logo={movie.logo_url} title={movie.title} />
          </motion.div>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.22em] text-white/85"
          >
            <span className="rounded-sm border border-white/40 px-1.5 py-0.5 text-[10px]">
              {movie.rating}
            </span>
            <span>{movie.year}</span>
            <span aria-hidden className="text-primary">◆</span>
            <span>{movie.runtime}</span>
            <span aria-hidden className="text-primary">◆</span>
            <span>{movie.genres.slice(0, 3).join(" · ")}</span>
          </motion.div>

          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.7 }}
            className="max-w-xl text-[15px] leading-relaxed text-white/90 sm:text-base"
          >
            {movie.overview}
          </motion.p>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.7 }}
            className="flex flex-wrap items-center gap-3 pt-2"
          >
            {resumeValid && resume ? (
              resume.episode ? (
                <Link
                  to="/xem/$slug/tap-{$episode}"
                  params={{ slug: resume.slug, episode: resume.episode }}
                  onClick={() => {
                    track("hero_resume_clicked", { slug: resume.slug });
                    track("home_primary_cta_click", { slug: resume.slug, kind: "resume" });
                  }}
                  className="group/cta relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-foreground px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.16em] text-background shadow-[var(--shadow-cinematic)] transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent transition-transform duration-700 ease-out group-hover/cta:translate-x-full" />
                  <RotateCcw className="h-4 w-4" />
                  <span>Xem tiếp</span>
                </Link>
              ) : (
                <Link
                  to="/phim/$slug"
                  params={{ slug: resume.slug }}
                  onClick={() => {
                    track("hero_resume_clicked", { slug: resume.slug });
                    track("home_primary_cta_click", { slug: resume.slug, kind: "resume" });
                  }}
                  className="group/cta relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-foreground px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.16em] text-background shadow-[var(--shadow-cinematic)] transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent transition-transform duration-700 ease-out group-hover/cta:translate-x-full" />
                  <RotateCcw className="h-4 w-4" />
                  <span>Xem tiếp</span>
                </Link>
              )
            ) : (
              <Link
                to="/xem/$slug/tap-{$episode}"
                params={{ slug: movie.slug, episode: "1" }}
                onClick={() => track("home_primary_cta_click", { slug: movie.slug, kind: "play" })}
                className="group/cta relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-foreground px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.16em] text-background shadow-[var(--shadow-cinematic)] transition-transform duration-300 hover:-translate-y-0.5"
              >

                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent transition-transform duration-700 ease-out group-hover/cta:translate-x-full"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-1 rounded-full bg-primary/40 opacity-0 blur-xl transition-opacity duration-500 group-hover/cta:opacity-100"
                />
                <Play className="h-4 w-4 fill-current" />
                <span>Xem ngay</span>
              </Link>
            )}
            <Link
              to="/phim/$slug"
              params={{ slug: resumeValid && resume ? resume.slug : movie.slug }}
              className="glass inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[13px] font-medium uppercase tracking-[0.16em] text-white transition hover:bg-white/15"
            >
              <Info className="h-4 w-4" /> Chi tiết
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Trailer mute toggle (direct video) or external trailer link */}
      {trailerSrc ? (
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Bật tiếng trailer" : "Tắt tiếng trailer"}
          className="glass absolute right-5 top-5 z-20 grid h-10 w-10 place-items-center rounded-full text-foreground transition hover:bg-foreground/10 sm:right-10 sm:top-10"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      ) : externalTrailer ? (
        <a
          href={externalTrailer}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Xem trailer"
          className="glass absolute right-5 top-5 z-20 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-foreground transition hover:bg-foreground/10 sm:right-10 sm:top-10"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Trailer
        </a>
      ) : null}

      {/* Progress rail */}
      <div className="absolute bottom-5 right-5 z-10 flex items-center gap-4 sm:bottom-10 sm:right-10">
        <span className="font-mono text-[11px] tracking-[0.24em] text-foreground/60">
          {String(index + 1).padStart(2, "0")}
          <span className="mx-1.5 text-foreground/30">/</span>
          {String(movies.length).padStart(2, "0")}
        </span>
        <div className="flex gap-2">
          {movies.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
              className="group relative h-[3px] w-10 overflow-hidden rounded-full bg-foreground/15"
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 bg-primary",
                  i < index && "w-full",
                  i === index && !paused && "hero-rail w-full",
                  i === index && paused && "w-full",
                  i > index && "w-0",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Scroll invite */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: entered ? 1 : 0, y: 0 }}
        transition={{ delay: 1.6, duration: 0.8 }}
        className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center sm:hidden"
      >
        <ArrowDown className="h-5 w-5 animate-bounce text-foreground/60" />
      </motion.div>
    </section>
  );
}

/* -------------------------------------------------------------------- */

const EASE = ease.outSoft;

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

function HeroLogo({ logo, title }: { logo?: string; title: string }) {
  const [ok, setOk] = useState(true);
  if (logo && ok) {
    return (
      <img
        src={thumbSrc(logo, { w: 720 })}
        alt={title}
        onError={() => setOk(false)}
        className="max-h-32 w-auto max-w-[85%] object-contain drop-shadow-[0_10px_40px_rgba(0,0,0,0.7)] sm:max-h-40"
      />
    );
  }
  return (
    <h1 className="font-display text-[clamp(2.75rem,8vw,6rem)] font-semibold leading-[0.92] tracking-[-0.03em] text-white drop-shadow-[0_14px_50px_rgba(0,0,0,0.6)]">
      {title}
    </h1>
  );
}

/** Deterministic mulberry32 pseudo-random for stable particle positions. */
function pseudo(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
