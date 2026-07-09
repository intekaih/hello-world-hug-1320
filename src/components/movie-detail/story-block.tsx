import { motion, useReducedMotion } from "motion/react";
import { Languages, Quote } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionHeader } from "./section-header";
import type { Movie } from "./types";

/**
 * StoryBlock — immersive synopsis with cinematic typography, gradient mask
 * on collapse, and a quote-style callout pulled from the first sentence.
 */
export function StoryBlock({ movie }: { movie: Movie }) {
  const { t, i18n } = useTranslation();
  const reduce = useReducedMotion();

  const [translated, setTranslated] = useState<string | null>(
    movie.overview_vi ?? null,
  );
  const [showVi, setShowVi] = useState(
    i18n.language === "vi" && !!movie.overview_vi,
  );
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (i18n.language === "vi" && translated) setShowVi(true);
    if (i18n.language === "en") setShowVi(false);
  }, [i18n.language, translated]);

  const onToggle = async () => {
    if (translated) {
      setShowVi((v) => !v);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: movie.overview,
          target: "vi",
          hint: movie.overview_vi,
        }),
      });
      const data = (await res.json()) as { text: string };
      setTranslated(data.text);
      setShowVi(true);
    } catch {}
    setLoading(false);
  };

  const text = showVi && translated ? translated : movie.overview;
  const long = text.length > 320;

  // Pull the first sentence for the quote block (max ~140 chars).
  const quote = (() => {
    const m = text.match(/^(.{20,160}?[.!?])\s/);
    return m ? m[1] : "";
  })();

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow={t("movieDetail.story.eyebrow")}
        title={t("movieDetail.story.title")}
        action={
          <button
            type="button"
            onClick={onToggle}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground-muted transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            <Languages className="h-3.5 w-3.5" aria-hidden />
            {loading
              ? t("movieDetail.story.translating")
              : showVi
                ? t("movieDetail.story.showOriginal")
                : t("movieDetail.story.translate")}
          </button>
        }
      />

      <div className="relative overflow-hidden rounded-3xl border border-foreground/8 bg-gradient-to-br from-background/80 via-background/40 to-background/20 p-6 backdrop-blur-sm sm:p-10">
        {/* Ambient background blur */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/25 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
        />

        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: ease.outSoft }}
            className="relative"
          >
            <p
              className={cn(
                "font-serif text-[17px] leading-[1.85] text-foreground/90 sm:text-[18px]",
                !expanded && long && "max-h-[16em] overflow-hidden",
              )}
            >
              <span className="mr-1.5 float-left font-display text-[3.75rem] font-semibold leading-[0.85] text-primary [text-shadow:0_2px_24px_oklch(0.68_0.24_25/0.45)]">
                {text.charAt(0)}
              </span>
              {text.slice(1)}
            </p>

            {!expanded && long && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background via-background/70 to-transparent"
              />
            )}

            {long && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="relative z-10 mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-primary transition hover:text-primary/80"
              >
                {expanded
                  ? t("movieDetail.story.collapse")
                  : t("movieDetail.story.expand")}
              </button>
            )}
          </motion.div>

          {/* Quote highlight */}
          {quote && (
            <motion.aside
              initial={reduce ? false : { opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: 0.15, ease: ease.outSoft }}
              className="relative flex flex-col justify-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] p-6"
            >
              <Quote
                className="h-6 w-6 text-primary/70"
                aria-hidden
                strokeWidth={1.5}
              />
              <p className="font-display text-xl leading-snug tracking-tight text-white sm:text-2xl">
                “{quote}”
              </p>
              <span className="mt-auto font-mono text-[10px] uppercase tracking-[0.28em] text-primary/80">
                {t("movieDetail.story.quote")}
              </span>
            </motion.aside>
          )}
        </div>
      </div>
    </section>
  );
}
