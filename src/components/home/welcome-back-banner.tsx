import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { Play, X, Sparkles } from "lucide-react";

import { thumbSrc } from "@/utils/thumbSrc";
import { useTranslation } from "@/hooks/useTranslation";
import type { ContinueWatchingItem, MovieCard } from "@/lib/home-queries";

/** Strip "· Ep 8" / "— Tập 3" trailing episode fragments from a display title. */
function parseTitle(raw: string): { clean: string; episode?: string } {
  const m = raw.match(/^(.*?)[·•\-–—]\s*(?:Ep|Tập)\s*(\d+)\s*$/i);
  if (m) return { clean: m[1].trim(), episode: m[2] };
  return { clean: raw };
}

/**
 * WelcomeBackBanner — one-shot re-entry banner shown when the user returns
 * after a 48h+ lapse. Primary action resumes the in-progress title; the
 * secondary rail below surfaces "what's new this week".
 *
 * This component is presentational — the surrounding host owns visibility
 * (lapse detection, session dedupe, and dismissal persistence).
 */
export function WelcomeBackBanner({
  resume,
  newThisWeek,
  onDismiss,
}: {
  resume: ContinueWatchingItem;
  newThisWeek: MovieCard[];
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const parsed = parseTitle(resume.title);
  const episode = resume.episodeLabel ?? parsed.episode;

  return (
    <motion.section
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      role="region"
      aria-label={t("welcomeBack.ariaLabel")}
      className="dark relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 text-white shadow-2xl"
    >
      {/* Ambient glow keyed off the resume poster */}
      <div
        className="pointer-events-none absolute inset-0 scale-125 opacity-40 blur-3xl"
        style={{
          backgroundImage: `url(${resume.poster_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/85 via-black/60 to-black/95"
        aria-hidden
      />

      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("welcomeBack.dismiss")}
        className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white/80 ring-1 ring-white/10 backdrop-blur transition hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <X className="h-4 w-4" strokeWidth={2.4} />
      </button>

      <div className="relative grid gap-6 p-5 md:grid-cols-[168px_1fr] md:gap-8 md:p-8">
        <Link
          to="/phim/$slug"
          params={{ slug: resume.slug }}
          className="mx-auto block w-[132px] overflow-hidden rounded-2xl ring-1 ring-white/15 shadow-2xl md:mx-0 md:w-[168px]"
          aria-label={parsed.clean}
        >
          <img
            src={thumbSrc(resume.poster_url, { w: 400 })}
            alt={parsed.clean}
            loading="lazy"
            className="aspect-[2/3] h-full w-full object-cover"
          />
        </Link>

        <div className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary backdrop-blur">
            <Sparkles className="h-3 w-3" />
            {t("welcomeBack.eyebrow")}
          </div>

          <h2 className="mt-3 font-display text-2xl font-bold leading-tight md:text-3xl">
            {t("welcomeBack.headline", { title: parsed.clean })}
          </h2>
          <p className="mt-2 text-sm text-white/70 md:text-base">
            {episode
              ? t("welcomeBack.subEp", { episode, remaining: resume.remaining })
              : t("welcomeBack.sub", { remaining: resume.remaining })}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/xem/$slug/tap-{$episode}"
              params={{ slug: resume.slug, episode: episode ?? "1" }}
              search={{ t: 0 }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:shadow-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <Play className="h-4 w-4 fill-current" />
              {t("welcomeBack.resume")}
            </Link>
          </div>
        </div>
      </div>

      {/* Secondary: new this week rail */}
      {newThisWeek.length > 0 && (
        <div className="relative border-t border-white/10 bg-black/40 p-5 md:p-6">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="font-display text-sm font-semibold text-white/90">
              {t("welcomeBack.newThisWeek")}
            </h3>
            <Link
              to="/danh-sach/phim-moi"
              className="text-[11px] font-medium text-primary/90 transition hover:text-primary"
            >
              {t("welcomeBack.newThisWeekMore")}
            </Link>
          </div>
          <div className="scrollbar-thin -mx-1 flex snap-x snap-proximity gap-3 overflow-x-auto rail-scroll px-1 pb-1">
            {newThisWeek.slice(0, 8).map((m) => (
              <Link
                key={`${m.id}-${m.slug}`}
                to="/phim/$slug"
                params={{ slug: m.slug }}
                className="group block w-[112px] shrink-0 snap-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 rounded-xl md:w-[128px]"
                aria-label={m.title}
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/10 transition group-hover:ring-primary/50">
                  <img
                    src={thumbSrc(m.poster_url, { w: 300 })}
                    alt={m.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                </div>
                <p className="mt-1.5 line-clamp-1 text-[11px] font-medium text-white/85 group-hover:text-primary">
                  {m.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}
