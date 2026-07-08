import { Globe } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { Locale } from "@/i18n";

const LOCALES: { code: Locale; short: string }[] = [
  { code: "vi", short: "VI" },
  { code: "en", short: "EN" },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const current = i18n.language as Locale;

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className="inline-flex items-center gap-0.5 rounded-full border border-foreground/10 bg-background/40 p-0.5 backdrop-blur-md"
    >
      {!compact && (
        <span className="pl-2.5 pr-1 text-foreground-subtle" aria-hidden>
          <Globe className="h-3.5 w-3.5" />
        </span>
      )}
      {LOCALES.map((l) => {
        const active = current === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => i18n.changeLanguage(l.code)}
            aria-pressed={active}
            aria-label={t("language.switchTo", { name: t(`language.${l.code}`) })}
            className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
              active
                ? "bg-gradient-to-r from-primary to-[oklch(0.72_0.24_35)] text-white shadow-[0_4px_16px_-4px_oklch(0.68_0.24_25/0.55)]"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            {l.short}
          </button>
        );
      })}
    </div>
  );
}
