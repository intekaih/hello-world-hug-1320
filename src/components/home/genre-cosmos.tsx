import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type Genre = {
  slug: string;
  name: string;
  tagline: string;
  gradient: string;
  span: string;
};

const GENRES: Genre[] = [
  {
    slug: "hanh-dong",
    name: "Action",
    tagline: "Adrenaline, in 24 frames.",
    gradient: "from-[oklch(0.55_0.22_25)] via-[oklch(0.35_0.18_15)] to-[oklch(0.15_0.05_15)]",
    span: "sm:col-span-2 sm:row-span-2",
  },
  {
    slug: "kinh-di",
    name: "Horror",
    tagline: "Lights off. Volume up.",
    gradient: "from-[oklch(0.25_0.08_320)] via-[oklch(0.15_0.05_320)] to-[oklch(0.08_0.03_280)]",
    span: "",
  },
  {
    slug: "tinh-cam",
    name: "Romance",
    tagline: "Held breath. Held hands.",
    gradient: "from-[oklch(0.55_0.15_10)] via-[oklch(0.35_0.12_350)] to-[oklch(0.2_0.08_340)]",
    span: "",
  },
  {
    slug: "khoa-hoc-vien-tuong",
    name: "Sci-Fi",
    tagline: "Tomorrow, tonight.",
    gradient: "from-[oklch(0.35_0.15_240)] via-[oklch(0.2_0.1_260)] to-[oklch(0.1_0.05_280)]",
    span: "sm:col-span-2",
  },
  {
    slug: "hoat-hinh",
    name: "Animation",
    tagline: "Ink, light, wonder.",
    gradient: "from-[oklch(0.65_0.18_60)] via-[oklch(0.45_0.15_40)] to-[oklch(0.2_0.08_30)]",
    span: "",
  },
  {
    slug: "tam-ly",
    name: "Drama",
    tagline: "Every silence, spoken.",
    gradient: "from-[oklch(0.4_0.08_200)] via-[oklch(0.2_0.05_220)] to-[oklch(0.1_0.03_230)]",
    span: "",
  },
];

export function GenreCosmos() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section className="space-y-6" aria-label="Explore by genre">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-foreground-muted">
            The Cosmos
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Pick a mood, enter a universe
          </h2>
        </div>
        <Link
          to="/browse/$type"
          params={{ type: "the-loai" }}
          className="hidden shrink-0 items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-foreground-muted transition hover:text-foreground sm:inline-flex"
        >
          All genres <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <div
        className="grid auto-rows-[140px] grid-cols-2 gap-3 sm:auto-rows-[180px] sm:grid-cols-4 sm:gap-4"
        onMouseLeave={() => setHovered(null)}
      >
        {GENRES.map((g, i) => {
          const dim = hovered && hovered !== g.slug;
          return (
            <motion.div
              key={g.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: ease.outSoft }}
              onMouseEnter={() => setHovered(g.slug)}
              className={cn("relative", g.span)}
            >
              <Link
                to="/browse/$type"
                params={{ type: `the-loai-${g.slug}` }}
                className={cn(
                  "group relative flex h-full w-full flex-col justify-end overflow-hidden rounded-2xl p-4 transition-all duration-500 ease-out sm:p-5",
                  "border border-white/5 shadow-[var(--shadow-elevated)]",
                  dim ? "scale-[0.98] opacity-60" : "opacity-100",
                )}
              >
                {/* Gradient bed */}
                <div className={cn("absolute inset-0 bg-gradient-to-br", g.gradient)} />

                {/* Animated orb */}
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-60 blur-3xl transition-transform duration-700 ease-out group-hover:scale-125"
                  style={{ background: "radial-gradient(circle, oklch(1 0 0 / 0.35), transparent 70%)" }}
                />

                {/* Grid noise */}
                <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:14px_14px]" />

                {/* Sheen */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-full"
                />

                <div className="relative z-10">
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/60">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em] text-white sm:text-3xl">
                    {g.name}
                  </h3>
                  <p className="mt-1 max-w-[16ch] text-[11px] leading-snug text-white/70 sm:text-xs">
                    {g.tagline}
                  </p>
                </div>

                <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-white/60 transition-all duration-300 group-hover:right-3 group-hover:top-3 group-hover:text-white" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
