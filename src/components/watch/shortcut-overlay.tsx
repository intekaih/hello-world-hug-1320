import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * ShortcutOverlay
 * Elegant keyboard shortcut cheatsheet triggered by pressing `?`.
 */
export function ShortcutOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const rows: { keys: string[]; label: string }[] = [
    { keys: ["Space", "K"], label: t("player.shortcuts.playPause") },
    { keys: ["←", "→"], label: t("player.shortcuts.seek") },
    { keys: ["↑", "↓"], label: t("player.shortcuts.volume") },
    { keys: ["F"], label: t("player.shortcuts.fullscreen") },
    { keys: ["M"], label: t("player.shortcuts.mute") },
    { keys: ["C"], label: t("player.shortcuts.cinema") },
    { keys: ["Esc"], label: t("player.shortcuts.close") },
    { keys: ["?"], label: t("player.shortcuts.help") },
  ];
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-xl"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={t("player.shortcuts.title")}
        >
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="glass-strong relative w-[min(92vw,520px)] rounded-2xl border border-white/12 p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-primary/90">
                  {t("player.shortcuts.eyebrow")}
                </div>
                <h3 className="mt-1 font-display text-xl font-semibold">
                  {t("player.shortcuts.title")}
                </h3>
              </div>
              <button
                onClick={onClose}
                aria-label={t("common.close")}
                className="rounded-full border border-white/10 p-2 text-white/70 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-5 space-y-2">
              {rows.map((r) => (
                <li
                  key={r.label}
                  className="flex items-center justify-between rounded-lg border border-white/6 bg-white/[0.03] px-3 py-2"
                >
                  <span className="text-[13px] text-white/85">{r.label}</span>
                  <span className="flex items-center gap-1">
                    {r.keys.map((k) => (
                      <kbd
                        key={k}
                        className="min-w-[28px] rounded-md border border-white/15 bg-black/40 px-2 py-0.5 text-center font-mono text-[11px] font-semibold text-white/90"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
