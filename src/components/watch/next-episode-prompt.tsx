import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Info, Settings, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ease } from "@/lib/design";

/**
 * NextEpisodePrompt
 * ----------------------------------------------------------------------
 * Floating card in the bottom-right during the last ~30s of an episode.
 *
 * Ethical auto-next modes (Epic: Ethical auto-next UX):
 *  - autoAdvance=false → static card, no countdown, manual click only.
 *  - autoAdvance=true, softAsk=false → 30s countdown → onAutoAdvance().
 *  - softAsk=true (≥3 consecutive auto-advances) → replaces countdown
 *    with a "Continue autoplay?" prompt. No auto-fire until user answers.
 *  - showTooltip=true → one-time hint that autoplay is ON + how to disable.
 */
export function NextEpisodePrompt({
  visible,
  seconds,
  onCancel,
  onPlayNow,
  onAutoAdvance,
  nextEpisodeNumber,
  posterUrl,
  autoAdvance = true,
  softAsk = false,
  showTooltip = false,
  onTooltipSeen,
  onContinueAutoplay,
  onPauseTonight,
  onOpenSettings,
}: {
  visible: boolean;
  seconds: number;
  onCancel: () => void;
  onPlayNow: () => void;
  onAutoAdvance?: () => void;
  nextEpisodeNumber?: number;
  posterUrl?: string;
  autoAdvance?: boolean;
  softAsk?: boolean;
  showTooltip?: boolean;
  onTooltipSeen?: () => void;
  onContinueAutoplay?: () => void;
  onPauseTonight?: () => void;
  onOpenSettings?: () => void;
}) {
  const { t } = useTranslation();
  const [count, setCount] = useState(seconds);
  const firedRef = useRef(false);

  // Reset countdown whenever prompt becomes visible or seconds changes.
  useEffect(() => {
    if (!visible) {
      firedRef.current = false;
      return;
    }
    setCount(seconds);
  }, [visible, seconds]);

  // Countdown only runs when autoAdvance is active and no soft-ask blocking.
  useEffect(() => {
    if (!visible) return;
    if (!autoAdvance || softAsk) return;
    if (firedRef.current) return;
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          window.clearInterval(id);
          if (!firedRef.current) {
            firedRef.current = true;
            (onAutoAdvance ?? onPlayNow)();
          }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [visible, autoAdvance, softAsk, onAutoAdvance, onPlayNow]);

  // Auto-dismiss the one-time tooltip after a short window.
  useEffect(() => {
    if (!visible || !showTooltip) return;
    const id = window.setTimeout(() => onTooltipSeen?.(), 6000);
    return () => window.clearTimeout(id);
  }, [visible, showTooltip, onTooltipSeen]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3, ease: ease.out }}
          className="glass-strong pointer-events-auto absolute bottom-24 right-4 z-30 w-[min(340px,88vw)] overflow-hidden rounded-2xl p-4 shadow-[var(--shadow-elevated)] sm:bottom-28 sm:right-6"
        >
          {/* Progress bar — only meaningful while countdown is live */}
          {autoAdvance && !softAsk && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
              style={{
                background:
                  "var(--gradient-ember, linear-gradient(90deg,#f97316,#ef4444))",
                transform: `scaleX(${count / Math.max(1, seconds)})`,
                transformOrigin: "left",
                transition: "transform 1s linear",
              }}
            />
          )}

          <div className="flex items-start gap-3">
            {posterUrl && (
              <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md ring-1 ring-white/15">
                <img
                  src={posterUrl}
                  alt=""
                  aria-hidden
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/90">
                {t("player.nextEpisode.eyebrow")}
              </div>
              {typeof nextEpisodeNumber === "number" && (
                <div className="mt-0.5 truncate text-sm font-semibold text-white">
                  {t("player.nextEpisode.upNextLabel", { n: nextEpisodeNumber })}
                </div>
              )}
              <p className="mt-1 text-xs text-white/75">
                {softAsk
                  ? t("player.autoNext.softAsk")
                  : autoAdvance
                    ? t("player.nextEpisode.startsIn", { seconds: count })
                    : t("player.autoNext.manualHint")}
              </p>
            </div>
            <button
              onClick={onCancel}
              aria-label={t("common.close")}
              className="rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Primary actions */}
          {softAsk ? (
            <div className="mt-3 flex gap-2">
              <button
                onClick={onPauseTonight}
                className="flex-1 rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-xs font-medium text-white/85 transition hover:border-white/25 hover:bg-white/10"
              >
                {t("player.autoNext.pauseTonight")}
              </button>
              <button
                onClick={onContinueAutoplay}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-[0_6px_20px_-6px_oklch(0.68_0.24_25/0.7)]"
                style={{
                  background:
                    "var(--gradient-ember, linear-gradient(135deg,#f97316,#ef4444))",
                }}
              >
                {t("player.autoNext.continueYes")}
              </button>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-xs font-medium text-white/85 transition hover:border-white/25 hover:bg-white/10"
              >
                {t("player.nextEpisode.cancel")}
              </button>
              <button
                onClick={onPlayNow}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-[0_6px_20px_-6px_oklch(0.68_0.24_25/0.7)]"
                style={{
                  background:
                    "var(--gradient-ember, linear-gradient(135deg,#f97316,#ef4444))",
                }}
              >
                {t("player.nextEpisode.playNow")}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* One-time first-binge tooltip */}
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.15 }}
              className="mt-3 flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/8 p-2.5 text-[11px] leading-snug text-white/85"
              role="status"
            >
              <Info className="mt-[1px] h-3.5 w-3.5 shrink-0 text-primary/90" />
              <div className="flex-1">
                <span>{t("player.autoNext.tooltip")}</span>
                {onOpenSettings && (
                  <button
                    onClick={() => {
                      onTooltipSeen?.();
                      onOpenSettings();
                    }}
                    className="ml-1 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    <Settings className="h-3 w-3" />
                    {t("player.autoNext.openSettings")}
                  </button>
                )}
              </div>
              <button
                onClick={() => onTooltipSeen?.()}
                aria-label={t("common.close")}
                className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
