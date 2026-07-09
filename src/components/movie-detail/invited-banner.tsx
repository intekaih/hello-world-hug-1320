import { useSearch } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

/**
 * Shown when a user lands on /phim/{slug} via a share link (?ref=share).
 * Non-blocking, dismissible, no dark patterns — just warm attribution so
 * the invitee knows a friend meant this recommendation for them.
 */
export function InvitedBanner({ title }: { title: string }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const search = useSearch({ strict: false }) as { ref?: string };
  const [dismissed, setDismissed] = useState(false);

  const isInvited = search?.ref === "share";

  // Reset dismissal when slug (via title) changes.
  useEffect(() => {
    setDismissed(false);
  }, [title]);

  if (!isInvited || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.aside
        role="status"
        aria-live="polite"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative mx-auto mt-4 flex max-w-4xl items-center gap-3 rounded-2xl border border-primary/25",
          "bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-4 py-3 backdrop-blur",
        )}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/90">
            {t("share.invited.eyebrow")}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-foreground">
            {t("share.invited.title", { title })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-foreground-muted transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={t("share.invited.dismiss")}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </motion.aside>
    </AnimatePresence>
  );
}
