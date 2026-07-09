import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";

import type { ContinueWatchingItem, MovieCard } from "@/lib/home-queries";
import {
  dismissForWeek,
  markShownThisSession,
  readLastVisit,
  shouldShowWelcomeBack,
  writeLastVisit,
} from "@/lib/welcome-back";
import { WelcomeBackBanner } from "./welcome-back-banner";

/**
 * WelcomeBackHost — owns the decision to render the banner exactly once
 * per lapsed return.
 *
 * On mount it reads the *previous* lastVisit before overwriting it with
 * `now`, so a refresh mid-session can't extend the lapse window. The
 * session-shown flag then guarantees the banner won't rerender if the
 * user reloads while the tab is open.
 */
export function WelcomeBackHost({
  resume,
  newThisWeek,
}: {
  resume: ContinueWatchingItem | undefined;
  newThisWeek: MovieCard[];
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const prev = readLastVisit();
    writeLastVisit();
    // Skip when there's nothing to resume — the banner needs a title to point at.
    if (!resume) return;
    if (shouldShowWelcomeBack(prev)) {
      markShownThisSession();
      setShow(true);
    }
  }, [resume]);

  const handleDismiss = () => {
    dismissForWeek();
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && resume && (
        <WelcomeBackBanner
          resume={resume}
          newThisWeek={newThisWeek}
          onDismiss={handleDismiss}
        />
      )}
    </AnimatePresence>
  );
}
