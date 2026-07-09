import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { thumbSrc } from "@/utils/thumbSrc";
import { useTranslation } from "@/hooks/useTranslation";
import { MovieActionCluster } from "./action-cluster";
import { MovieLogoReveal } from "./logo-reveal";
import { MovieMetaBadges } from "./meta-badges";
import { youTubeEmbed, type Movie } from "./types";

/**
 * MovieDetailHero — near-fullscreen cinematic chamber.
 *
 *  · Trailer autoplay (muted) with delayed reveal, controls to mute/close.
 *  · Trailer pauses when the page is hidden (visibilitychange).
 *  · Backdrop uses Ken Burns + mouse parallax when no trailer.
 *  · Layered gradients, vignette, film grain, ambient primary glow.
 *  · Poster peels in on the right column at wide breakpoints.
 *
 * All motion respects prefers-reduced-motion.
 */
export function MovieDetailHero({ movie }: { movie: Movie }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [trailerActive, setTrailerActive] = useState(false);
  const [muted, setMuted] = useState(true);
  const reduce = useReducedMotion();

  const embed = useMemo(
    () => (movie.trailer_url ? youTubeEmbed(movie.trailer_url, { muted }) : null),
    [movie.trailer_url, muted],
  );

  // Delayed autoplay for a smoother reveal.
  useEffect(() => {
    if (!embed || reduce) return;
    const id = window.setTimeout(() => setTrailerActive(true), 900);
    return () => window.clearTimeout(id);
  }, [embed, reduce]);

  // Pause background video when tab hides — saves battery and bandwidth.
  useEffect(() => {
    if (!trailerActive) return;
    const onVis = () => {
      const hidden = document.hidden;
      // Post message to YouTube iframe API. Fire-and-forget — safe if origin
      // hasn't loaded yet or postMessage is rejected.
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({
          event: "command",
          func: hidden ? "pauseVideo" : "playVideo",
          args: [],
        }),
        "*",
      );
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [trailerActive]);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || reduce) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--px", `${x * 14}px`);
    el.style.setProperty("--py", `${y * 14}px`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--px", "0px");
    el.style.setProperty("--py", "0px");
  };

  return (
    <section
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      aria-label={movie.title}
      className="dark relative -mx-4 h-[92vh] min-h-[640px] overflow-hidden bg-black text-white sm:-mx-6 lg:-mx-8 lg:rounded-[2rem]"
      style={{ ["--px" as string]: "0px", ["--py" as string]: "0px" }}
    >
      {/* Backdrop — Ken Burns + parallax */}
      <div
        className="ken-burns absolute inset-0 will-change-transform"
        style={{ transform: "translate3d(var(--px), var(--py), 0) scale(1.06)" }}
      >
        <img
          src={thumbSrc(movie.backdrop_url || movie.poster_url, { w: 1920 })}
          alt=""
          className="h-full w-full object-cover"
          fetchPriority="high"
        />
      </div>

      {/* Trailer video layer */}
      <AnimatePresence>
        {trailerActive && embed && (
          <motion.div
            key="trailer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: ease.outSoft }}
            className="pointer-events-none absolute inset-0"
            aria-hidden
          >
            <iframe
              ref={iframeRef}
              key={embed}
              src={`${embed}&enablejsapi=1`}
              title={movie.title}
              allow="autoplay; encrypted-media; picture-in-picture"
              className="absolute left-1/2 top-1/2 h-[120%] w-[178%] -translate-x-1/2 -translate-y-1/2 border-0 sm:w-[130%]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Layered scrims + ambient primary glow + film grain */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_18%,rgb(0_0_0/0.6)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/25 to-transparent" />
      <span
        aria-hidden
        className="pointer-events-none absolute -left-40 top-1/3 h-[420px] w-[420px] rounded-full opacity-40 blur-3xl"
        style={{
          background: "radial-gradient(circle, var(--color-primary), transparent 70%)",
        }}
      />
      <div className="grain pointer-events-none absolute inset-0 opacity-40" />

      {/* Trailer controls */}
      {trailerActive && embed && (
        <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5 sm:right-6 sm:top-6">
          <ControlButton
            onClick={() => setMuted((v) => !v)}
            label={
              muted
                ? t("movieDetail.hero.unmuteTrailer")
                : t("movieDetail.hero.muteTrailer")
            }
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </ControlButton>
          <ControlButton
            onClick={() => setTrailerActive(false)}
            label={t("movieDetail.hero.closeTrailer")}
          >
            <X className="h-4 w-4" />
          </ControlButton>
        </div>
      )}

      {/* Content — bottom aligned */}
      <div className="absolute inset-0 flex items-end">
        <div className="w-full p-6 sm:p-10 lg:p-14">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-2xl space-y-5">
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: ease.outSoft }}
                className="flex items-center gap-3"
              >
                <span className="inline-block h-px w-8 bg-gradient-to-r from-primary to-transparent" />
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/90">
                  {t("movieDetail.hero.eyebrow", {
                    genre: movie.categories[0] ?? t("movieDetail.hero.eyebrowFallback"),
                    year: movie.year,
                  })}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/50">
                  · {t("movieDetail.hero.nowPlaying")}
                </span>
              </motion.div>

              <MovieLogoReveal logo={movie.logo_url} title={movie.title} />

              {movie.original_title && movie.original_title !== movie.title && (
                <motion.p
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.35 }}
                  className="font-serif text-base italic text-white/70 sm:text-lg"
                >
                  “{movie.original_title}”
                </motion.p>
              )}

              <MovieMetaBadges movie={movie} />

              <MovieActionCluster movie={movie} />
            </div>

            {movie.poster_url && (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 30, rotate: -2 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.9, ease: ease.outSoft, delay: 0.2 }}
                className="hidden lg:block"
              >
                <div className="relative aspect-[2/3] w-64 overflow-hidden rounded-2xl shadow-[var(--shadow-cinematic)] ring-1 ring-white/10">
                  <img
                    src={thumbSrc(movie.poster_url, { w: 500 })}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/5" />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ControlButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/40 text-white/90 backdrop-blur-md transition-[background,border-color,color,transform] duration-200 ease-out hover:-translate-y-px hover:border-white/40 hover:bg-black/60 hover:text-white active:translate-y-0 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="grid place-items-center [&_svg]:h-4 [&_svg]:w-4">{children}</span>

    </button>
  );
}
