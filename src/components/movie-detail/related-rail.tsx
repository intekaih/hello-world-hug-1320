import { motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ExperienceCard } from "@/components/home/experience-card";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionHeader } from "./section-header";
import { hashId, type RelatedItem } from "./types";

/**
 * RelatedMovieRail — cinematic horizontal rail using ExperienceCard.
 * Trailer hover preview kicks in automatically when a trailer URL is provided
 * on future data — for now these entries have no trailerUrl.
 */
export function RelatedMovieRail({
  items,
  loading,
}: {
  items: RelatedItem[];
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const railRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow={t("movieDetail.related.eyebrow")}
        title={t("movieDetail.related.title")}
        action={
          !loading && items.length > 0 ? (
            <div className="hidden gap-1 sm:flex">
              <RailButton dir="left" onClick={() => scrollBy(-1)} />
              <RailButton dir="right" onClick={() => scrollBy(1)} />
            </div>
          ) : null
        }
      />

      {loading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] w-full animate-pulse rounded-xl bg-foreground/5"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center font-mono text-[11px] uppercase tracking-widest text-foreground-subtle">
          {t("movieDetail.related.empty")}
        </div>
      ) : (
        <motion.div
          ref={railRef}
          initial={reduce ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
          }}
          className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        >
          {items.map((m) => (
            <motion.div
              key={m.slug}
              variants={{
                hidden: { opacity: 0, y: 18 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.55, ease: ease.outSoft },
                },
              }}
              className="flex"
            >
              <ExperienceCard
                movie={{
                  id: hashId(m.slug),
                  slug: m.slug,
                  title: m.title,
                  poster_url: m.poster_url,
                  year: m.year,
                  rating: m.rating,
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  );
}

function RailButton({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "left" ? "Previous" : "Next"}
      className="glass grid h-9 w-9 place-items-center rounded-full transition hover:bg-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60"
    >
      {dir === "left" ? (
        <ChevronLeft className="h-4 w-4" />
      ) : (
        <ChevronRight className="h-4 w-4" />
      )}
    </button>
  );
}
