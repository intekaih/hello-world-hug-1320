import { useTranslation } from "@/hooks/useTranslation";

/**
 * PlayerLoadingState — never a blank black screen.
 * Blurred backdrop is provided by AmbientTheaterBackground behind the frame;
 * this component fills the player frame with a soft skeleton + spinner.
 */
export function PlayerLoadingState({ poster }: { poster?: string }) {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden">
      {poster && (
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `url(${poster})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(30px) saturate(140%)",
            transform: "scale(1.1)",
          }}
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70"
      />
      <div className="relative flex flex-col items-center gap-4">
        <div
          className="h-14 w-14 animate-spin rounded-full border-2 border-white/15 border-t-primary shadow-[0_0_30px_oklch(0.68_0.24_25/0.4)]"
          role="status"
          aria-live="polite"
          aria-label={t("player.loading.label")}
        />
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary/90">
            {t("player.loading.eyebrow")}
          </p>
          <p className="mt-1 font-display text-sm font-medium text-white/90">
            {t("player.loading.title")}
          </p>
        </div>
      </div>
    </div>
  );
}
