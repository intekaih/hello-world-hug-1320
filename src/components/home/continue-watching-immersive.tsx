import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { Compass, Sparkles } from "lucide-react";
import { useRef } from "react";

import { useTranslation } from "@/hooks/useTranslation";
import type { ContinueWatchingItem } from "@/lib/home-queries";
import { ResumeExperienceCard } from "./resume-experience-card";

/* -------------------------------------------------------------------------- */
/*  Empty state                                                                */
/* -------------------------------------------------------------------------- */

function ContinueWatchingEmpty() {
  const { t } = useTranslation();
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[oklch(0.18_0.05_270)] via-[oklch(0.13_0.04_280)] to-[oklch(0.10_0.03_290)] px-8 py-14 text-center sm:px-14 sm:py-20">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[520px] -translate-x-1/2 rounded-full bg-primary/30 blur-3xl"
      />
      <div className="relative mx-auto max-w-xl space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-white/70 backdrop-blur-md">
          <Sparkles className="h-3 w-3" aria-hidden /> {t("continueWatching.empty.eyebrow")}
        </span>
        <h3 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {t("continueWatching.empty.title")}
        </h3>
        <p className="text-sm leading-relaxed text-white/70">
          {t("continueWatching.empty.description")}
        </p>
        <div className="pt-2">
          <Link
            to="/kham-pha"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-black transition hover:-translate-y-0.5"
          >
            <Compass className="h-4 w-4" />
            {t("continueWatching.empty.cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ContinueWatchingImmersive                                                  */
/* -------------------------------------------------------------------------- */

export function ContinueWatchingImmersive({
  items,
}: {
  items: ContinueWatchingItem[];
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const railRef = useRef<HTMLDivElement>(null);

  if (!items.length) return <ContinueWatchingEmpty />;

  const [featured, ...rest] = items;

  return (
    <section aria-label={t("continueWatching.title")} className="space-y-5">
      {/* Header */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-end justify-between gap-4"
      >
        <div className="min-w-0 space-y-2">
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-primary/90">
            <span className="h-px w-6 bg-primary" />
            {t("continueWatching.eyebrow")}
          </span>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {t("continueWatching.title")}
          </h2>
          <p className="text-sm text-white/60">{t("continueWatching.subtitle")}</p>
        </div>
      </motion.div>

      {/* Rail with edge masks */}
      <div className="relative">
        {/* Edge fades */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent"
        />

        <motion.div
          ref={railRef}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
          }}
          className="scrollbar-none -mx-4 flex snap-x snap-mandatory items-stretch gap-5 overflow-x-auto px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 24 },
              show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
            }}
            className="flex"
          >
            <ResumeExperienceCard item={featured} index={0} featured />
          </motion.div>

          {rest.map((item, i) => (
            <motion.div
              key={item.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
                },
              }}
              className="flex"
            >
              <ResumeExperienceCard item={item} index={i + 1} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
