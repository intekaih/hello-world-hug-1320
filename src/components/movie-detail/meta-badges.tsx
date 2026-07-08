import { motion, useReducedMotion } from "motion/react";
import { Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";
import type { Movie } from "./types";

type Badge = {
  icon?: LucideIcon;
  label: string;
  value: string;
  tone?: "default" | "gold" | "ring";
};

export function MovieMetaBadges({ movie }: { movie: Movie }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const badges: Badge[] = [
    { icon: Star, label: t("movieDetail.badges.rating"), value: movie.rating.toFixed(1), tone: "gold" },
    { label: t("movieDetail.badges.ageRating"), value: movie.age_rating, tone: "ring" },
    { label: t("movieDetail.badges.quality"), value: movie.quality },
    { label: t("movieDetail.badges.language"), value: movie.language },
    { label: t("movieDetail.badges.runtime"), value: movie.duration },
    { label: t("movieDetail.badges.year"), value: String(movie.year) },
  ];

  if (movie.total_episodes > 1) {
    badges.push({
      label: t("movieDetail.badges.episodes"),
      value: t("movieDetail.badges.episodesCount", { n: movie.total_episodes }),
    });
  }

  return (
    <motion.ul
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.06, delayChildren: 0.4 } },
      }}
      className="flex flex-wrap items-center gap-2 pt-1"
      aria-label="metadata"
    >
      {badges.map((b) => (
        <motion.li
          key={b.label}
          variants={{
            hidden: { opacity: 0, y: 8, filter: "blur(6px)" },
            show: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: { type: "spring", stiffness: 320, damping: 26 },
            },
          }}
        >
          <BadgeChip {...b} />
        </motion.li>
      ))}
      {movie.categories.slice(0, 3).map((g) => (
        <motion.li
          key={`g-${g}`}
          variants={{
            hidden: { opacity: 0, y: 8, filter: "blur(6px)" },
            show: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: { type: "spring", stiffness: 320, damping: 26 },
            },
          }}
        >
          <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-primary/95 backdrop-blur-md">
            {g}
          </span>
        </motion.li>
      ))}
    </motion.ul>
  );
}

function BadgeChip({ icon: Icon, label, value, tone = "default" }: Badge) {
  const toneCls =
    tone === "gold"
      ? "border-gold/40 bg-gold/10 text-gold"
      : tone === "ring"
        ? "border-white/40 bg-white/5 text-white"
        : "border-white/15 bg-white/[0.06] text-white/90";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${toneCls} px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] backdrop-blur-md`}
      title={label}
    >
      {Icon && <Icon className="h-3 w-3 fill-current" aria-hidden />}
      <span className="text-[9px] opacity-60">{label}</span>
      <span className="text-[10px]">{value}</span>
    </span>
  );
}
