import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import type { RecMovie } from "@/lib/recommendations/engine";
import type { SceneMood } from "@/components/home/scene-section";
import { SceneSection } from "@/components/home/scene-section";
import { ease } from "@/lib/design";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { suppressSlug } from "@/lib/recommendations/suppress";
import { RecommendationReasonChip } from "./reason-chip";


/**
 * RecommendationSection — cinematic wrapper around a taste-scored rail.
 * Uses SceneSection for the mood engine + a lightweight poster rail
 * (lighter than ExperienceCard to keep long lists on the page cheap).
 */
export function RecommendationSection({
  mood,
  eyebrow,
  title,
  subtitle,
  items,
  entrance = "drift",
}: {
  mood: SceneMood;
  eyebrow: string;
  title: string;
  subtitle?: string;
  items: RecMovie[];
  icon?: ReactNode;
  entrance?: "drift" | "iris" | "focus" | "sweep";
}) {
  if (items.length === 0) return null;

  return (
    <SceneSection
      mood={mood}
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      entrance={entrance}
    >
      <div className="scrollbar-thin -mx-4 flex snap-x snap-proximity gap-3 overflow-x-auto rail-scroll px-4 pb-3 md:mx-0 md:px-0 md:gap-4">
        {items.map((m, i) => (
          <RecCard key={`${m.id}-${m.slug}`} movie={m} index={i} />
        ))}
      </div>
    </SceneSection>
  );
}

function RecCard({ movie, index }: { movie: RecMovie; index: number }) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: Math.min(index * 0.025, 0.25), duration: 0.4, ease: ease.outSoft }}
      className="group relative shrink-0 snap-start"
    >
      <Link
        to="/phim/$slug"
        params={{ slug: movie.slug }}
        className={cn(
          "block w-[150px] sm:w-[168px] md:w-[188px] focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl",
        )}
        aria-label={movie.title}
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-white/5 transition-all duration-500 group-hover:ring-2 group-hover:ring-primary/60 group-hover:shadow-[0_20px_60px_-15px_rgba(234,88,12,0.55)]">
          <img
            src={movie.poster_url}
            alt={movie.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100" />
          <div className="absolute left-2 top-2">
            <RecommendationReasonChip reason={movie.reason} value={movie.reasonValue} />
          </div>
          <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-primary/90">
              ⭐ {movie.rating.toFixed(1)} · {movie.year}
            </p>
          </div>
        </div>
        <p className="mt-2 line-clamp-1 text-sm font-medium text-foreground/90 transition-colors group-hover:text-primary">
          {movie.title}
        </p>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          suppressSlug(movie.slug);
        }}
        aria-label={t("recommendations.notInterested.aria", { title: movie.title })}
        title={t("recommendations.notInterested.tooltip")}
        className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white/85 opacity-0 ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black/90 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </motion.div>
  );
}

