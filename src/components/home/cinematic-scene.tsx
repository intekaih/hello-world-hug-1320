import { Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { Play, ArrowUpRight } from "lucide-react";
import { useRef } from "react";

import { thumbSrc } from "@/utils/thumbSrc";
import type { HeroMovie } from "@/lib/home-queries";

/**
 * CinematicScene
 * A full-bleed scroll-linked spotlight that sits between movie rows.
 * Backdrop parallaxes and desaturates until the copy locks in the center
 * of the viewport, then releases as the user scrolls past.
 */
export function CinematicScene({
  movie,
  eyebrow = "Feature Presentation",
  kicker,
}: {
  movie: HeroMovie;
  eyebrow?: string;
  kicker?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : ["-12%", "12%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [1, 1, 1] : [1.15, 1.05, 1.15]);
  const textY = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [0, 0, 0] : [80, 0, -80]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.75, 1], [0, 1, 1, 0]);
  const dim = useTransform(scrollYProgress, [0, 0.5, 1], [0.4, 0.15, 0.4]);

  return (
    <section
      ref={ref}
      className="dark relative -mx-4 h-[90vh] min-h-[560px] overflow-hidden bg-black text-white sm:-mx-6 lg:-mx-8 lg:rounded-[32px]"
      aria-label={`${eyebrow}: ${movie.title}`}
    >
      {/* Backdrop */}
      <motion.div style={{ y, scale }} className="absolute inset-0 will-change-transform">
        <img
          src={thumbSrc(movie.backdrop_url, { w: 1920 })}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </motion.div>

      {/* Cinematic dim overlay */}
      <motion.div style={{ opacity: dim }} className="pointer-events-none absolute inset-0 bg-black" />

      {/* Aurora + vignette */}
      <div className="pointer-events-none absolute inset-0 aurora opacity-40 mix-blend-soft-light" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_35%,oklch(0_0_0/0.7)_100%)]" />
      <div className="grain" />

      {/* Anamorphic letterbox bars */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[6vh] bg-black" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[6vh] bg-black" />

      {/* Copy */}
      <div className="absolute inset-0 flex items-center justify-center px-6 sm:px-12">
        <motion.div
          style={{ y: textY, opacity }}
          className="relative flex max-w-3xl flex-col items-center text-center"
        >
          <div className="mb-6 flex items-center gap-3">
            <span className="h-px w-10 bg-primary" />
            <span className="font-mono text-[10px] uppercase tracking-[0.36em] text-foreground/70">
              {eyebrow}
            </span>
            <span className="h-px w-10 bg-primary" />
          </div>

          {kicker && (
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.32em] text-primary/90">
              {kicker}
            </p>
          )}

          <h2 className="font-display text-[clamp(2.75rem,8vw,6.5rem)] font-semibold leading-[0.95] tracking-[-0.03em] text-white drop-shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
            {movie.title}
          </h2>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.24em] text-foreground/70">
            <span className="rounded-sm border border-foreground/30 px-1.5 py-0.5">{movie.rating}</span>
            <span>{movie.year}</span>
            <span aria-hidden className="text-primary">◆</span>
            <span>{movie.runtime}</span>
            <span aria-hidden className="text-primary">◆</span>
            <span>{movie.genres.slice(0, 3).join(" · ")}</span>
          </div>

          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-foreground/80">
            {movie.overview}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/xem/$slug/tap-{$episode}"
              params={{ slug: movie.slug, episode: "1" }}
              className="group/cta relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-foreground px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.16em] text-background shadow-[var(--shadow-cinematic)] transition-transform duration-300 hover:-translate-y-0.5"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 ease-out group-hover/cta:translate-x-full"
              />
              <Play className="h-4 w-4 fill-current" />
              <span>Play trailer</span>
            </Link>
            <Link
              to="/phim/$slug"
              params={{ slug: movie.slug }}
              className="glass inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[13px] font-medium uppercase tracking-[0.16em] text-foreground transition hover:bg-foreground/10"
            >
              Enter world <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
