import { useState } from "react";
import { Sparkles, Pencil } from "lucide-react";

import { useTasteStore, TASTE_GENRES, TASTE_COUNTRIES } from "@/store/tasteStore";
import { useTranslation } from "@/hooks/useTranslation";
import { TasteOnboardingModal } from "@/components/onboarding/taste-onboarding-modal";

/**
 * TastePreferencesCard — a lightweight summary + edit shortcut for the
 * taste profile. Uses the same onboarding modal for editing so the two
 * flows never drift. Safe to render outside authenticated routes.
 */
export function TastePreferencesCard() {
  const { t } = useTranslation();
  const genres = useTasteStore((s) => s.genres);
  const country = useTasteStore((s) => s.country);
  const mood = useTasteStore((s) => s.mood);
  const onboarded = useTasteStore((s) => s.onboarded);
  const [open, setOpen] = useState(false);

  const empty = genres.length === 0 && !country && !mood;

  return (
    <section className="glass rounded-2xl border border-foreground/10 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("taste.profile.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("taste.profile.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-foreground/10 bg-surface-elevated px-4 py-2 text-sm text-foreground/85 transition hover:border-primary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <Pencil className="h-3.5 w-3.5" />
          {onboarded && !empty ? t("taste.profile.edit") : t("taste.profile.setup")}
        </button>
      </div>

      {empty ? (
        <p className="mt-5 rounded-xl border border-dashed border-foreground/10 bg-foreground/[0.02] p-4 text-sm text-muted-foreground">
          {t("taste.profile.empty")}
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          <Summary label={t("taste.genres.label")}>
            {genres.length ? (
              <ChipRow items={genres} />
            ) : (
              <em className="text-xs text-muted-foreground">{t("taste.profile.none")}</em>
            )}
          </Summary>
          <Summary label={t("taste.country.label")}>
            {country ? <ChipRow items={[country]} /> : <em className="text-xs text-muted-foreground">{t("taste.profile.none")}</em>}
          </Summary>
          <Summary label={t("taste.mood.label")}>
            {mood ? <ChipRow items={[t(`taste.mood.options.${mood}.title`)]} /> : <em className="text-xs text-muted-foreground">{t("taste.profile.none")}</em>}
          </Summary>
        </div>
      )}

      <TasteOnboardingModal open={open} onOpenChange={setOpen} />
      {/* Keep dead code refs so tree-shaker doesn't drop constants we may want to display later */}
      <span className="sr-only">
        {TASTE_GENRES.length} {TASTE_COUNTRIES.length}
      </span>
    </section>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function ChipRow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <span
          key={x}
          className="inline-flex items-center rounded-full bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-primary/20"
        >
          {x}
        </span>
      ))}
    </div>
  );
}
