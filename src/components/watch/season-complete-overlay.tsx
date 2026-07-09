import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { thumbSrc } from "@/utils/thumbSrc";
import { ease } from "@/lib/design";

type Related = {
  slug: string;
  title: string;
  poster_url: string;
  year: number;
  rating: number;
};

/**
 * SeasonCompleteOverlay
 * -----------------------------------------------------------------
 * Full-screen (within the player container) surface shown at the
 * very end of the LAST episode — replaces the dead-end silence with
 * three human next actions from related-rail data.
 * No auto-advance, no fake FOMO.
 */
export function SeasonCompleteOverlay({
  visible,
  slug,
  title,
  onDismiss,
}: {
  visible: boolean;
  slug: string;
  title: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const { data } = useQuery({
    queryKey: ["movie", slug, "related"],
    queryFn: async () => {
      const res = await fetch(`/api/movies/${slug}/related`);
      if (!res.ok) return [] as Related[];
      return (await res.json()) as Related[];
    },
    enabled: visible,
    staleTime: 5 * 60_000,
  });

  const recs = (data ?? []).slice(0, 3);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: ease.out }}
          className="absolute inset-0 z-40 grid place-items-center bg-black/85 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-label={t("player.complete.title", { title })}
        >
          <button
            onClick={onDismiss}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/5 p-2 text-white/80 transition hover:border-white/30 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mx-auto w-full max-w-4xl px-6 py-8">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-primary/90">
              <Sparkles className="h-3.5 w-3.5" />
              {t("player.complete.eyebrow")}
            </div>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white sm:text-4xl">
              {t("player.complete.title", { title })}
            </h2>
            <p className="mt-2 text-sm text-white/70">
              {t("player.complete.subtitle")}
            </p>

            {recs.length > 0 ? (
              <ul className="mt-6 grid grid-cols-3 gap-3 sm:gap-5">
                {recs.map((r) => (
                  <li key={r.slug}>
                    <Link
                      to="/phim/$slug"
                      params={{ slug: r.slug }}
                      onClick={onDismiss}
                      className="group block overflow-hidden rounded-xl ring-1 ring-white/10 transition hover:ring-primary/50"
                    >
                      <div className="relative aspect-[2/3] bg-white/5">
                        <img
                          src={thumbSrc(r.poster_url, { w: 400 })}
                          alt={r.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-2.5">
                          <div className="line-clamp-2 font-display text-xs font-semibold leading-tight text-white sm:text-sm">
                            {r.title}
                          </div>
                          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">
                            {r.year} · ★ {r.rating.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-6 h-40 rounded-xl border border-white/10 bg-white/[0.02]" />
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/phim/$slug"
                params={{ slug }}
                onClick={onDismiss}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 transition hover:border-white/30 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("player.complete.back")}
              </Link>
              <Link
                to="/browse"
                onClick={onDismiss}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_-6px_oklch(0.68_0.24_25/0.7)] transition hover:brightness-110"
                style={{ background: "var(--gradient-ember, linear-gradient(135deg,#f97316,#ef4444))" }}
              >
                {t("player.complete.browse")}
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
