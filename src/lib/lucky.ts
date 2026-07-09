/**
 * lucky.ts — "editorial lottery" seeded picker.
 *
 * Deterministic within a (userIdHash, dayKey) so repeat visits show the
 * same set. A shuffle button bumps a salt (0..3) to re-roll — capped per
 * day by shuffleQuota() to create real (not fake) scarcity.
 */
import type { MovieCard } from "@/lib/home-queries";
import type { ReasonKind } from "@/lib/recommendations/engine";

const UID_KEY = "mcc:uid";
const SHUFFLE_KEY_PREFIX = "mcc:lucky:";
export const LUCKY_MAX_SHUFFLES = 3;
export const LUCKY_ITEMS = 12;

export type LuckyPick = MovieCard & {
  reason: ReasonKind;
};

type ShuffleState = { date: string; used: number; salt: number };

/** YYYY-MM-DD in local time — the "day" boundary the lottery respects. */
export function dayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Stable, non-PII per-browser identifier. Anonymous, generated on first call. */
export function getUserIdHash(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let v = window.localStorage.getItem(UID_KEY);
    if (!v) {
      v =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem(UID_KEY, v);
    }
    return v;
  } catch {
    return "anon";
  }
}

/** Fast, decent 32-bit string hash (FNV-1a variant). */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small deterministic PRNG. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Load today's shuffle state; auto-reset when the local day rolls over. */
export function readShuffleState(): ShuffleState {
  const today = dayKey();
  if (typeof window === "undefined")
    return { date: today, used: 0, salt: 0 };
  try {
    const raw = window.localStorage.getItem(SHUFFLE_KEY_PREFIX + "state");
    if (raw) {
      const parsed = JSON.parse(raw) as ShuffleState;
      if (parsed && parsed.date === today) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { date: today, used: 0, salt: 0 };
}

function writeShuffleState(next: ShuffleState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SHUFFLE_KEY_PREFIX + "state",
      JSON.stringify(next),
    );
  } catch {
    /* ignore */
  }
}

/** Attempt to consume one shuffle. Returns the new state (unchanged if capped). */
export function consumeShuffle(): {
  state: ShuffleState;
  granted: boolean;
} {
  const cur = readShuffleState();
  if (cur.used >= LUCKY_MAX_SHUFFLES) return { state: cur, granted: false };
  const next: ShuffleState = {
    ...cur,
    used: cur.used + 1,
    salt: cur.salt + 1,
  };
  writeShuffleState(next);
  return { state: next, granted: true };
}

/** Weighted, seeded reason assignment based on the movie's own signals. */
function pickReason<T extends MovieCard>(m: T, rnd: () => number): ReasonKind {
  const currentYear = new Date().getFullYear();
  const candidates: { kind: ReasonKind; weight: number }[] = [];
  if (m.rating >= 8) candidates.push({ kind: "highlyRated", weight: 3 });
  if (m.year && m.year >= currentYear - 1)
    candidates.push({ kind: "trending", weight: 2 });
  if (m.year && m.year > 0 && m.year <= currentYear - 6)
    candidates.push({ kind: "unexplored", weight: 2 });
  candidates.push({ kind: "similarMood", weight: 1 });
  const total = candidates.reduce((s, c) => s + c.weight, 0);
  let r = rnd() * total;
  for (const c of candidates) {
    r -= c.weight;
    if (r <= 0) return c.kind;
  }
  return candidates[0].kind;
}

/** Fisher-Yates using seeded rng. */
function shuffled<T>(arr: readonly T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Deterministic pick of N items from the pool for (userId, day, salt).
 * Same inputs → same output. Increment salt via consumeShuffle() to re-roll.
 */
export function pickLucky(
  pool: readonly MovieCard[],
  opts: { userId: string; day?: string; salt?: number; count?: number },
): LuckyPick[] {
  const day = opts.day ?? dayKey();
  const salt = opts.salt ?? 0;
  const count = Math.min(opts.count ?? LUCKY_ITEMS, pool.length);
  if (!pool.length || count <= 0) return [];
  const seed = hash32(`${opts.userId}|${day}|${salt}`);
  const rnd = mulberry32(seed);
  const picked = shuffled(pool, rnd).slice(0, count);
  return picked.map((m) => ({ ...m, reason: pickReason(m, rnd) }));
}
