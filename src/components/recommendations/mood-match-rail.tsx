import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";

import type { RecMovie } from "@/lib/recommendations/engine";
import type { BrowseMovie } from "@/routes/api/browse";
import { useTranslation } from "@/hooks/useTranslation";
import { ease } from "@/lib/design";
import { SceneSection } from "@/components/home/scene-section";
import { RecommendationReasonChip } from "./reason-chip";

/**
 * MoodMatchRail — "Because you watched [Seed]" — pairs a seed poster
 * with a horizontally-scrolling ribbon of similar-mood matches.
 */
export function MoodMatchRail({
  seed,
  items,
}: {
  seed: BrowseMovie;
  items: RecMovie[];
}) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <SceneSection
      mood="violet"
      eyebrow={t("recommendations.because.eyebrow")}
      title={t("recommendations.because.title", { title: seed.title })}
      subtitle={t("recommendations.because.subtitle")}
      entrance="sweep"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr] md:gap-6">
        <Link
          to="/phim/$slug"
          params={{ slug: seed.slug }}
          className="group relative mx-auto block w-[160px] overflow-hidden rounded-2xl ring-1 ring-white/10 md:mx-0 md:w-[220px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          aria-label={seed.title}
        >
          <img
            src={seed.poster_url}
            alt={seed.title}
            loading="lazy"
            className="aspect-[2/3] h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/90">
              {t("recommendations.because.seedLabel")}
            </p>
            <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-white">{seed.title}</p>
          </div>
        </Link>

        <div className="scrollbar-thin -mx-4 flex snap-x snap-proximity gap-3 overflow-x-auto rail-scroll px-4 pb-2 md:mx-0 md:px-0 md:gap-4">
          {items.map((m, i) => (
            <motion.div
              key={`${m.id}-${m.slug}`}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: Math.min(i * 0.025, 0.2), duration: 0.4, ease: ease.outSoft }}
              className="group relative shrink-0 snap-start"
            >
              <Link
                to="/phim/$slug"
                params={{ slug: m.slug }}
                className="block w-[140px] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 md:w-[160px]"
                aria-label={m.title}
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-white/5 transition-all duration-500 group-hover:ring-2 group-hover:ring-primary/60">
                  <img src={m.poster_url} alt={m.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" />
                  <div className="absolute left-2 top-2">
                    <RecommendationReasonChip reason={m.reason} value={m.reasonValue} />
                  </div>
                </div>
                <p className="mt-2 line-clamp-1 text-xs font-medium text-foreground/90 group-hover:text-primary">
                  {m.title}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </SceneSection>
  );
}
