import { motion, useReducedMotion } from "motion/react";
import {
  Calendar,
  Clock,
  Film,
  Globe,
  Languages as LangIcon,
  ListVideo,
  Star,
  User,
  type LucideIcon,
} from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";
import { SectionHeader } from "./section-header";
import type { Movie } from "./types";

type Fact = { icon: LucideIcon; label: string; value: string };

/**
 * MovieFactRail — horizontal snap rail of key facts.
 * Uses lucide-react icons only, no emoji, no colored packs.
 */
export function MovieFactRail({ movie }: { movie: Movie }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const empty = t("movieDetail.facts.empty");
  const facts: Fact[] = [
    { icon: User, label: t("movieDetail.facts.director"), value: movie.director || empty },
    ...movie.cast.slice(0, 1).map((c) => ({
      icon: User,
      label: t("movieDetail.cast.title"),
      value: c,
    })),
    { icon: Globe, label: t("movieDetail.facts.country"), value: movie.country || empty },
    { icon: Calendar, label: t("movieDetail.facts.year"), value: String(movie.year) },
    { icon: LangIcon, label: t("movieDetail.facts.language"), value: movie.language || empty },
    { icon: Film, label: t("movieDetail.facts.quality"), value: movie.quality || empty },
    { icon: Clock, label: t("movieDetail.facts.year"), value: movie.duration || empty },
    { icon: Star, label: t("movieDetail.facts.rating"), value: movie.rating.toFixed(1) },
  ];

  if (movie.total_episodes > 1) {
    facts.push({
      icon: ListVideo,
      label: t("movieDetail.facts.episodes"),
      value: t("movieDetail.badges.episodesCount", { n: movie.total_episodes }),
    });
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow={t("movieDetail.facts.eyebrow")}
        title={t("movieDetail.facts.title")}
      />
      <motion.ul
        initial={reduce ? false : "hidden"}
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
        }}
        className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {facts.map((f) => (
          <motion.li
            key={`${f.label}-${f.value}`}
            variants={{
              hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
              show: {
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
                transition: { type: "spring", stiffness: 260, damping: 24 },
              },
            }}
            className="group relative flex min-w-[180px] shrink-0 items-center gap-3 overflow-hidden rounded-2xl border border-foreground/10 bg-background/40 px-4 py-3.5 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-primary/40"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/10 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <f.icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="truncate font-mono text-[9px] uppercase tracking-[0.24em] text-foreground-subtle">
                {f.label}
              </div>
              <div className="truncate text-sm font-medium text-foreground">
                {f.value}
              </div>
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}
