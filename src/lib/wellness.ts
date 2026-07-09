// Ethical wellness tracker — cumulative watch time per calendar day.
// Non-blocking: surfaces a gentle nudge once per day past a threshold.

const THRESHOLD_SECONDS = 3 * 60 * 60; // 3 hours
const KEY_PREFIX = "mcc:wellness:";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
const secondsKey = () => `${KEY_PREFIX}sec:${todayKey()}`;
const dismissedKey = () => `${KEY_PREFIX}dismissed:${todayKey()}`;

export function noteWatching(deltaSeconds: number): { shouldPrompt: boolean } {
  if (typeof window === "undefined") return { shouldPrompt: false };
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || deltaSeconds > 30) {
    return { shouldPrompt: false };
  }
  try {
    const prev = Number(localStorage.getItem(secondsKey()) ?? "0") || 0;
    const next = prev + deltaSeconds;
    localStorage.setItem(secondsKey(), String(next));
    const dismissed = localStorage.getItem(dismissedKey()) === "1";
    const crossed = prev < THRESHOLD_SECONDS && next >= THRESHOLD_SECONDS;
    return { shouldPrompt: !dismissed && crossed };
  } catch {
    return { shouldPrompt: false };
  }
}

export function dismissWellnessToday() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(dismissedKey(), "1");
  } catch {
    /* ignore */
  }
}

export function todayWatchedMinutes(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Math.floor((Number(localStorage.getItem(secondsKey()) ?? "0") || 0) / 60);
  } catch {
    return 0;
  }
}
