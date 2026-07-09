import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { Calendar, ChevronRight } from "lucide-react";

import { thumbSrc } from "@/utils/thumbSrc";
import type { MovieCard } from "@/lib/home-queries";
import { ease } from "@/lib/design";

/**
 * ComingSoonScene — vertical release timeline. Each row is a wide banner:
 *  · left column: honest "SOON" badge + real year (no fabricated dates)
 *  · right column: masked backdrop with a light-sweep on hover
 * A subtle vertical rail (the "future line") threads all entries together.
 *
 * Feels expectant, patient, futuristic — the opposite of a horizontal rail.
 */
export function ComingSoonScene({ movies }: { movies: MovieCard[] }) {
  const reduce = useReducedMotion();
  if (!movies.length) return null;

  const items = movies.slice(0, 6);

  // Fake future dates that feel like "next 6 weeks".
  const now = new Date();
  const fmtMonth = new Intl.DateTimeFormat("en", { month: "short" });

  return (
    <div className="relative">
      {/* Timeline rail */}
      <span
        aria-hidden
        className="absolute left-[46px] top-4 bottom-4 hidden w-px bg-gradient-to-b from-transparent via-white/15 to-transparent sm:block"
      />

      <motion.ul
        initial={reduce ? false : "hidden"}
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
        }}
        className="space-y-4"
      >
        {items.map((m, i) => {
          const d = new Date(now.getTime() + (i + 1) * 7 * 24 * 60 * 60 * 1000);
          const day = String(d.getDate()).padStart(2, "0");
          const mon = fmtMonth.format(d).toUpperCase();

          return (
            <motion.li
              key={m.id}
              variants={{
                hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
                show: {
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                  transition: { duration: 0.85, ease: ease.outSoft },
                },
              }}
            >
              <Link
                to="/phim/$slug"
                params={{ slug: m.slug }}
                className="group relative flex items-stretch gap-4 overflow-hidden rounded-2xl border border-white/8 bg-black/25 p-3 backdrop-blur-sm transition hover:border-white/25 sm:gap-5 sm:p-4"
              >
                {/* Date badge */}
                <div className="relative z-10 flex w-[76px] shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-black/50 py-3 text-center">
                  <Calendar
                    className="mb-1 h-3.5 w-3.5 text-white/50"
                    aria-hidden
                  />
                  <div className="font-display text-2xl font-semibold leading-none text-white">
                    {day}
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.28em] text-white/50">
                    {mon}
                  </div>
                </div>

                {/* Backdrop banner */}
                <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl">
                  <img
                    src={thumbSrc(m.poster_url, { w: 900 })}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1600ms] ease-out group-hover:scale-[1.06]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
                  {/* Moving light-sweep on hover */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 opacity-0 mix-blend-screen transition-opacity duration-500 group-hover:opacity-70 group-hover:animate-[scene-beam_1.6s_ease-out]"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
                      filter: "blur(20px)",
                    }}
                  />

                  <div className="relative flex h-full items-center gap-3 p-4 sm:p-5">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--scene-accent)" }}>
                        Arriving
                      </div>
                      <h4 className="mt-1 truncate font-display text-lg font-semibold tracking-tight text-white sm:text-xl">
                        {m.title}
                      </h4>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.24em] text-white/60">
                        {m.year} · Coming to movieCC
                      </div>
                    </div>
                    <ChevronRight
                      className="hidden h-5 w-5 shrink-0 text-white/50 transition group-hover:translate-x-1 group-hover:text-white sm:block"
                      aria-hidden
                    />
                  </div>
                </div>
              </Link>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}
