import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Moon, Play, Sparkles } from "lucide-react";

import type { RecMovie } from "@/lib/recommendations/engine";
import { useTranslation } from "@/hooks/useTranslation";
import { ease } from "@/lib/design";
import { RecommendationReasonChip } from "./reason-chip";

/**
 * TonightPick — a single, generous "one recommendation to rule tonight"
 * hero. Keeps the personalization surface calm and confident instead of
 * bombarding with rails.
 */
export function TonightPick({ movie }: { movie: RecMovie }) {
  const { t } = useTranslation();
  // Dynamic subtitle keyed off the reason kind, with a graceful fallback.
  // e.g. sameGenre → "Vì bạn hay xem {genre}", highlyRated → "Điểm cao đêm nay", …
  const subtitleKey = `recommendations.tonight.subtitleFor.${movie.reason}`;
  const subtitle = movie.reasonValue
    ? t(subtitleKey, { value: movie.reasonValue, defaultValue: t("recommendations.tonight.subtitle") })
    : t(subtitleKey, { defaultValue: t("recommendations.tonight.subtitle") });

  return (
    <motion.div

      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: ease.outSoft }}
      className="dark relative overflow-hidden rounded-3xl bg-black text-white shadow-2xl"
    >
      <div
        className="absolute inset-0 scale-110 opacity-45 blur-3xl"
        style={{
          backgroundImage: `url(${movie.poster_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/55 to-black/95" aria-hidden />

      <div className="relative grid grid-cols-1 gap-6 p-6 md:grid-cols-[220px_1fr] md:gap-8 md:p-10">
        <Link
          to="/phim/$slug"
          params={{ slug: movie.slug }}
          className="relative mx-auto block w-[180px] overflow-hidden rounded-2xl ring-1 ring-white/15 shadow-2xl md:mx-0 md:w-[220px]"
          aria-label={movie.title}
        >
          <img src={movie.poster_url} alt={movie.title} className="h-full w-full object-cover" loading="lazy" />
        </Link>

        <div className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary backdrop-blur">
            <Moon className="h-3 w-3" />
            {t("recommendations.tonight.eyebrow")}
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold leading-tight md:text-4xl">
            {movie.title}
          </h2>
          <p className="mt-2 text-sm text-white/70 md:text-base">
            {subtitle}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-primary ring-1 ring-primary/30">
              <Sparkles className="h-3 w-3" /> {movie.rating.toFixed(1)}
            </span>
            <span className="text-[11px] text-white/60">· {movie.year}</span>
            <RecommendationReasonChip reason={movie.reason} value={movie.reasonValue} />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/phim/$slug"
              params={{ slug: movie.slug }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:shadow-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <Play className="h-4 w-4 fill-current" />
              {t("recommendations.tonight.cta")}
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
