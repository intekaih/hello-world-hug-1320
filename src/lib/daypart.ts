/**
 * Daypart — contextual cue for ritual/habit copy on Home.
 * Uses Asia/Ho_Chi_Minh so a Saigon user's 23:30 stays "late_night"
 * regardless of the device timezone. Falls back to local hour if Intl
 * misbehaves. Accepts an override for tests / URL mock (?hour=23).
 */
export type Daypart = "morning" | "afternoon" | "evening" | "late_night";

export function getSaigonHour(hourOverride?: number): number {
  if (typeof hourOverride === "number" && Number.isFinite(hourOverride)) {
    return ((Math.trunc(hourOverride) % 24) + 24) % 24;
  }
  try {
    const s = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour12: false,
      hour: "2-digit",
    }).format(new Date());
    const h = parseInt(s, 10);
    if (Number.isFinite(h)) return h % 24;
  } catch {
    /* ignore */
  }
  return new Date().getHours();
}

export function getDaypart(hourOverride?: number): Daypart {
  const h = getSaigonHour(hourOverride);
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 23) return "evening";
  return "late_night"; // 23–04
}

/**
 * Late-night rerank: shorter/tighter first. We don't have runtime in the
 * home card contract, so approximate: highest rating first (people commit
 * more confidently late), then newest year as tiebreaker.
 * Pure — returns a new array; original untouched.
 */
export function rerankForLateNight<T extends { rating: number; year: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => b.rating - a.rating || b.year - a.year);
}

/** Read `?hour=NN` from location — dev/QA override, no effect in SSR. */
export function readHourOverride(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const v = new URLSearchParams(window.location.search).get("hour");
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
