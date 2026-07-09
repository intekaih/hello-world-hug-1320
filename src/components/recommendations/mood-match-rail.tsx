import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowRight, X } from "lucide-react";

import type { RecMovie } from "@/lib/recommendations/engine";
import type { BrowseMovie } from "@/routes/api/browse";
import { useTranslation } from "@/hooks/useTranslation";
import { ease } from "@/lib/design";
import { SceneSection } from "@/components/home/scene-section";
import { suppressSlug } from "@/lib/recommendations/suppress";
import { RecommendationReasonChip } from "./reason-chip";

/**
 * MoodMatchRail — "Because you watched [Seed]" — pairs a small seed poster
 * with a narrative arrow pointing into a horizontally-scrolling ribbon
 * of similar-mood matches. Each card carries its own reason chip and a
 * "Not interested" affordance that suppresses the slug for 14 days.
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
      <div className="flex items-stretch gap-3 md:gap-5">
        {/* Small seed poster — narrative anchor, not the hero */}
        <Link
          to="/phim/$slug"
          params={{ slug: seed.slug }}
          className="group relative block w-[92px] shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10 md:w-[112px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          aria-label={seed.title}
        >
          <img
            src={seed.poster_url}
            alt={seed.title}
            loading="lazy"
            className="aspect-[2/3] h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent px-2 pb-1.5 pt-6">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-primary/90">
              {t("recommendations.because.seedLabel")}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-white">
              {seed.title}
            </p>
          </div>
        </Link>

        {/* Narrative arrow: seed → matches */}
        <div
          className="flex shrink-0 items-center text-primary/70"
          aria-hidden
        >
          <ArrowRight className="h-6 w-6 md:h-7 md:w-7" strokeWidth={2.2} />
        </div>

        <div className="scrollbar-thin -mr-4 flex flex-1 snap-x snap-proximity gap-3 overflow-x-auto rail-scroll pr-4 pb-2 md:mr-0 md:pr-0 md:gap-4">
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
                  <img
                    src={m.poster_url}
                    alt={m.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                  />
                  <div className="absolute left-2 top-2">
                    <RecommendationReasonChip reason={m.reason} value={m.reasonValue} />
                  </div>
                </div>
                <p className="mt-2 line-clamp-1 text-xs font-medium text-foreground/90 group-hover:text-primary">
                  {m.title}
                </p>
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  suppressSlug(m.slug);
                }}
                aria-label={t("recommendations.notInterested.aria", { title: m.title })}
                title={t("recommendations.notInterested.tooltip")}
                className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white/85 opacity-0 ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black/90 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </SceneSection>
  );
}

