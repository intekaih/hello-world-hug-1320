import { useEffect, useState } from "react";

import { useTasteStore } from "@/store/tasteStore";
import { TasteOnboardingModal } from "./taste-onboarding-modal";

/**
 * AppOnboardingHost — opens the taste-onboarding modal exactly once,
 * after the persisted store rehydrates. Skipping or saving both count
 * as "onboarded" so we never nag the user again. Users can reopen it
 * from /profile at any time.
 *
 * Mounted globally so the modal is available to any route without
 * blocking navigation. Login is NOT required.
 */
export function AppOnboardingHost() {
  const onboarded = useTasteStore((s) => s.onboarded);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (onboarded) return;
    // Small delay so the first paint is content, not a modal.
    const t = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(t);
  }, [onboarded]);

  return (
    <TasteOnboardingModal
      open={open}
      onOpenChange={setOpen}
      onComplete={() => {
        // Nudge listeners (e.g. the discover route) to re-run.
        window.dispatchEvent(new CustomEvent("taste:completed"));
      }}
    />
  );
}
