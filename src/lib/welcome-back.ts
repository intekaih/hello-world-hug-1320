/**
 * Welcome-back banner storage.
 *
 * Two rules:
 * - "Lapse" = time since last recorded visit > 48h.
 * - Dismissal suppresses the banner for 7 days.
 * - Session flag prevents re-showing on refresh within the same tab session
 *   (acceptance: refresh liên tục không spam banner).
 *
 * localStorage — cross-session persistence for lastVisit + dismissedUntil.
 * sessionStorage — one-show-per-tab-session guarantee.
 */

const LAST_VISIT_KEY = "welcomeBack.lastVisit";
const DISMISSED_UNTIL_KEY = "welcomeBack.dismissedUntil";
const SESSION_SHOWN_KEY = "welcomeBack.shownThisSession";

const LAPSE_MS = 48 * 60 * 60 * 1000;
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function safeLocal(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
function safeSession(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Read the last recorded visit time (ms). Null if never recorded. */
export function readLastVisit(): number | null {
  const s = safeLocal();
  if (!s) return null;
  const raw = s.getItem(LAST_VISIT_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Record "user was here at `now`" — overwrites any prior value. */
export function writeLastVisit(now = Date.now()): void {
  safeLocal()?.setItem(LAST_VISIT_KEY, String(now));
}

/** True if the user dismissed within the last 7 days. */
export function isDismissed(now = Date.now()): boolean {
  const s = safeLocal();
  if (!s) return false;
  const raw = s.getItem(DISMISSED_UNTIL_KEY);
  if (!raw) return false;
  const until = Number(raw);
  return Number.isFinite(until) && until > now;
}

/** Snooze the banner for 7 days from `now`. */
export function dismissForWeek(now = Date.now()): void {
  safeLocal()?.setItem(DISMISSED_UNTIL_KEY, String(now + DISMISS_MS));
}

/** Session-scoped: has the banner already rendered in this tab session? */
export function wasShownThisSession(): boolean {
  return safeSession()?.getItem(SESSION_SHOWN_KEY) === "1";
}
export function markShownThisSession(): void {
  safeSession()?.setItem(SESSION_SHOWN_KEY, "1");
}

/**
 * Decide, based on the *previous* lastVisit, whether the banner should show.
 * Callers pass the value they read BEFORE overwriting with `writeLastVisit`.
 */
export function shouldShowWelcomeBack(
  previousLastVisit: number | null,
  now = Date.now(),
): boolean {
  if (isDismissed(now)) return false;
  if (wasShownThisSession()) return false;
  if (previousLastVisit == null) return false; // brand-new user — no lapse yet
  return now - previousLastVisit > LAPSE_MS;
}

export const LAPSE_THRESHOLD_MS = LAPSE_MS;
