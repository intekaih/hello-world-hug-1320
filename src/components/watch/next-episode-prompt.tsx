import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ease } from "@/lib/design";

/**
 * NextEpisodePrompt
 * ----------------------------------------------------------------------
 * Floating countdown card in the bottom-right that appears when the user
 * is inside the last ~30 seconds of an episode. Auto-advances at t=0
 * unless dismissed. Purely visual + a callback — no player coupling.
 */
export function NextEpisodePrompt({
  visible,
  seconds,
  onCancel,
  onPlayNow,
  nextEpisodeNumber,
  posterUrl,
}: {
  visible: boolean;
  seconds: number;
  onCancel: () => void;
  onPlayNow: () => void;
  nextEpisodeNumber?: number;
  posterUrl?: string;
}) {
  const { t } = useTranslation();
  const [count, setCount] = useState(seconds);

  useEffect(() => {
    if (!visible) return;
    setCount(seconds);
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          window.clearInterval(id);
          onPlayNow();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [visible, seconds, onPlayNow]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3, ease: ease.out }}
          className="glass-strong pointer-events-auto absolute bottom-24 right-4 z-30 w-[min(320px,86vw)] overflow-hidden rounded-2xl p-4 shadow-[var(--shadow-elevated)] sm:bottom-28 sm:right-6"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
            style={{
              background: "var(--gradient-ember, linear-gradient(90deg,#f97316,#ef4444))",
              transform: `scaleX(${count / seconds})`,
              transformOrigin: "left",
              transition: "transform 1s linear",
            }}
          />
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/90">
                {t("player.nextEpisode.eyebrow")}
              </div>
              <p className="mt-1 text-sm font-medium text-white">
                {t("player.nextEpisode.startsIn", { seconds: count })}
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
              style={{ background: "var(--gradient-ember, linear-gradient(135deg,#f97316,#ef4444))" }}
            >
              {t("player.nextEpisode.playNow")}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
