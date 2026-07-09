import { useMemo, useState } from "react";
import { Check, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useTasteStore,
  TASTE_GENRES,
  TASTE_COUNTRIES,
  type Mood,
} from "@/store/tasteStore";
import { fireTasteConfetti } from "@/lib/taste/confetti";

const MOODS: readonly Mood[] = ["relax", "tense", "moving"];

/**
 * TasteOnboardingModal — a 1-screen, always-skippable preference intake.
 * Pick up to 3 genres + 1 country + 1 mood. Persisted locally; no login
 * required. The parent decides when to show it (see AppOnboardingHost).
 */
export function TasteOnboardingModal({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}) {
  const { t } = useTranslation();
  const initialGenres = useTasteStore((s) => s.genres);
  const initialCountry = useTasteStore((s) => s.country);
  const initialMood = useTasteStore((s) => s.mood);
  const save = useTasteStore((s) => s.save);
  const skip = useTasteStore((s) => s.skip);

  const [genres, setGenres] = useState<string[]>(initialGenres);
  const [country, setCountry] = useState<string | null>(initialCountry);
  const [mood, setMood] = useState<Mood | null>(initialMood);

  const canSave = useMemo(
    () => genres.length > 0 || country !== null || mood !== null,
    [genres, country, mood],
  );

  const toggleGenre = (g: string) => {
    setGenres((prev) => {
      if (prev.includes(g)) return prev.filter((x) => x !== g);
      if (prev.length >= 3) return prev; // hard cap at 3
      return [...prev, g];
    });
  };

  const handleSave = () => {
    save({ genres, country, mood });
    fireTasteConfetti();
    onOpenChange(false);
    onComplete?.();
  };

  const handleSkip = () => {
    skip();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="dark max-w-2xl overflow-hidden border-white/10 bg-neutral-950 p-0 text-white"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(234,88,12,0.18), transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative max-h-[85vh] overflow-y-auto p-6 md:p-8">
          <DialogHeader className="text-left">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary backdrop-blur">
              <Sparkles className="h-3 w-3" />
              {t("taste.eyebrow")}
            </div>
            <DialogTitle className="mt-3 font-display text-2xl font-bold leading-tight md:text-3xl">
              {t("taste.title")}
            </DialogTitle>
            <p className="mt-2 text-sm text-white/70">{t("taste.subtitle")}</p>
          </DialogHeader>

          {/* Genres */}
          <section className="mt-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-white/90">
                {t("taste.genres.label")}
              </h3>
              <span className="text-[11px] text-white/50">
                {t("taste.genres.count", { current: genres.length, max: 3 })}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {TASTE_GENRES.map((g) => {
                const on = genres.includes(g);
                const disabled = !on && genres.length >= 3;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGenre(g)}
                    disabled={disabled}
                    aria-pressed={on}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                      on
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                        : disabled
                          ? "cursor-not-allowed bg-white/5 text-white/30 ring-1 ring-white/10"
                          : "bg-white/5 text-white/85 ring-1 ring-white/10 hover:bg-white/10",
                    )}
                  >
                    {on && <Check className="h-3 w-3" strokeWidth={3} />}
                    {g}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Country */}
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-white/90">
              {t("taste.country.label")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {TASTE_COUNTRIES.map((c) => {
                const on = country === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCountry(on ? null : c)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                      on
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                        : "bg-white/5 text-white/85 ring-1 ring-white/10 hover:bg-white/10",
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Mood */}
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-white/90">
              {t("taste.mood.label")}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {MOODS.map((m) => {
                const on = mood === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(on ? null : m)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-2xl p-4 text-left transition ring-1",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                      on
                        ? "bg-primary/15 ring-primary/60"
                        : "bg-white/5 ring-white/10 hover:bg-white/10",
                    )}
                  >
                    <p className="text-sm font-semibold text-white">
                      {t(`taste.mood.options.${m}.title`)}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-white/60">
                      {t(`taste.mood.options.${m}.desc`)}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Footer actions */}
          <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleSkip}
              className="rounded-full px-4 py-2 text-sm font-medium text-white/60 transition hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              {t("taste.actions.skip")}
            </button>
            <div className="flex items-center gap-2">
              <p className="mr-2 text-[11px] text-white/40">
                {t("taste.editableLater")}
              </p>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                  canSave
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/60"
                    : "cursor-not-allowed bg-white/10 text-white/40",
                )}
              >
                <Sparkles className="h-4 w-4" />
                {t("taste.actions.save")}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
