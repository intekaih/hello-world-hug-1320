import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { Eye, Star } from "lucide-react";

import { thumbSrc } from "@/utils/thumbSrc";
import type { MovieCard } from "@/lib/home-queries";

/**
 * MysteryScene — Hidden Gems. Each card is veiled in darkness until
 * the user hovers/focuses it, at which point the veil lifts and the
 * title emerges. Encourages exploration by rewarding curiosity.
 *
 * The layout is intentionally denser (masonry-ish) so the section
 * feels like walking through a dim archive rather than another rail.
 */
export function MysteryScene({ movies }: { movies: MovieCard[] }) {
  const reduce = useReducedMotion();
  if (!movies.length) return null;

  const items = movies.slice(0, 8);

  return (
    <motion.div
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.06 } },
      }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      {items.map((m, i) => (
        <motion.div
          key={m.id}
          variants={{
            hidden: { opacity: 0, y: 20, filter: "blur(8px)" },
            show: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          className={i % 5 === 0 ? "row-span-2" : ""}
        >
          <VeiledCard movie={m} tall={i % 5 === 0} />
        </motion.div>
      ))}
    </motion.div>
  );
}

function VeiledCard({ movie, tall }: { movie: MovieCard; tall: boolean }) {
  return (
    <Link
      to="/phim/$slug"
      params={{ slug: movie.slug }}
      className={`group relative block overflow-hidden rounded-2xl ring-1 ring-white/8 transition-shadow duration-500 hover:ring-white/25 hover:shadow-[0_20px_60px_-20px_var(--scene-accent)] ${tall ? "aspect-[3/5]" : "aspect-[2/3]"}`}
    >
      <img
        src={thumbSrc(movie.poster_url, { w: 500 })}
        alt={movie.title}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-110"
      />
      {/* Heavy veil that lifts on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-black/70 transition-opacity duration-700 ease-out group-hover:opacity-20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-100 backdrop-blur-md transition duration-700 group-hover:opacity-0 group-hover:backdrop-blur-0"
      />

      {/* Emerging info */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-4">
        <div className="translate-y-2 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-white/80">
            Hidden gem · {movie.year}
          </div>
          <h4 className="mt-1 line-clamp-2 font-serif text-base italic text-white">
            {movie.title}
          </h4>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.24em] text-white/70">
            <Star className="h-2.5 w-2.5 fill-gold text-gold" aria-hidden />
            {movie.rating.toFixed(1)}
          </div>
        </div>
      </div>

      {/* The eye icon that hints "look here" — fades out on hover */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-500 group-hover:opacity-0">
        <span
          className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/40 text-white/80 backdrop-blur-md"
          style={{ boxShadow: "0 0 30px oklch(0.7 0.15 160 / 0.4)" }}
        >
          <Eye className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
