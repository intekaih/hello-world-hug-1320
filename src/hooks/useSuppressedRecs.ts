import { useCallback, useEffect, useState } from "react";
import {
  getSuppressedSet,
  subscribeSuppressed,
  suppressSlug,
} from "@/lib/recommendations/suppress";

/**
 * React binding for the suppression store. Returns the current suppressed
 * slug set (stable identity per change) plus a `suppress` action.
 *
 * SSR-safe: starts with an empty set and hydrates in an effect to avoid
 * hydration mismatches from touching localStorage during render.
 */
export function useSuppressedRecs() {
  const [suppressed, setSuppressed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSuppressed(getSuppressedSet());
    return subscribeSuppressed(() => setSuppressed(getSuppressedSet()));
  }, []);

  const suppress = useCallback((slug: string) => suppressSlug(slug), []);
  return { suppressed, suppress };
}
