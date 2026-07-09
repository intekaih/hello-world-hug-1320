import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { Star } from "lucide-react";

import { thumbSrc } from "@/utils/thumbSrc";
import type { MovieCard } from "@/lib/home-queries";
import { ease } from "@/lib/design";

/**
 * EditorialScene — magazine-inspired layout: one dominant feature poster on
 * the left, four smaller "side stories" on the right. Serif italic display
 * heading pulled from the feature title; hover reveals editor's note tint.
 *
 * Used for Editor's Pick — feels curated, hand-selected, not algorithmic.
 */
export function EditorialScene({ movies }: { movies: MovieCard[] }) {
  const reduce = useReducedMotion();
  if (!movies.length) return null;

  const [feature, ...rest] = movies;
  const side = rest.slice(0, 4);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Feature */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.9, ease: ease.outSoft }}
        className="lg:col-span-7"
      >
        <Link
          to="/phim/$slug"
          params={{ slug: feature.slug }}
          className="group relative block overflow-hidden rounded-3xl ring-1 ring-white/8"
        >
          <div className="relative aspect-[16/10]">
            <img
              src={thumbSrc(feature.poster_url, { w: 1200 })}
              alt={feature.title}
              className="h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.05]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <span className="font-mono text-[10px] uppercase tracking-[0.32em]" style={{ color: "var(--scene-accent)" }}>
                Cover story · {feature.year}
              </span>
              <h3 className="mt-2 max-w-xl font-serif text-[clamp(1.75rem,3.2vw,2.75rem)] italic leading-[1.05] tracking-tight text-white">
                {feature.title}
              </h3>
              <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/80">
                <Star className="h-3 w-3 fill-gold text-gold" aria-hidden />
                {feature.rating.toFixed(1)}
                <span aria-hidden className="text-white/40">·</span>
                <span>Read the pick →</span>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Sidebar — stacked mini entries */}
      <motion.ul
        initial={reduce ? false : "hidden"}
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } },
        }}
        className="flex flex-col gap-4 lg:col-span-5"
      >
        {side.map((m, i) => (
          <motion.li
            key={m.id}
            variants={{
              hidden: { opacity: 0, x: 30 },
              show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: ease.outSoft } },
            }}
          >
            <Link
              to="/phim/$slug"
              params={{ slug: m.slug }}
              className="group flex gap-4 rounded-2xl border border-white/8 bg-black/25 p-3 backdrop-blur-sm transition hover:border-white/25 hover:bg-black/40"
            >
              <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
                <img
                  src={thumbSrc(m.poster_url, { w: 240 })}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-white/45">
                  N°{String(i + 2).padStart(2, "0")} · {m.year}
                </div>
                <h4 className="mt-1 line-clamp-2 font-serif text-[15px] italic leading-tight text-white transition group-hover:text-white">
                  {m.title}
                </h4>
                <div className="mt-1.5 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.24em] text-white/60">
                  <Star className="h-2.5 w-2.5 fill-gold text-gold" aria-hidden />
                  {m.rating.toFixed(1)}
                </div>
              </div>
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
