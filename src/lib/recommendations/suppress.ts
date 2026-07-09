/**
 * 14-day per-slug recommendation suppression, client-only.
 * Backed by localStorage; exposes a React subscription so score consumers
 * rebuild when a user hits "Not interested".
 */

const KEY = "rec.suppressed.v1";
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

type Store = Record<string, number>; // slug -> expiresAt (ms)

const listeners = new Set<() => void>();

function readRaw(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Store;
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function writeRaw(store: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota / disabled — silently ignore */
  }
}

function pruned(store: Store): Store {
  const now = Date.now();
  const out: Store = {};
  for (const [slug, exp] of Object.entries(store)) {
    if (exp > now) out[slug] = exp;
  }
  return out;
}

/** Read the currently-suppressed slug set (auto-prunes stale entries). */
export function getSuppressedSet(): Set<string> {
  const store = pruned(readRaw());
  return new Set(Object.keys(store));
}

/** Suppress a slug for 14 days. Notifies subscribers. */
export function suppressSlug(slug: string) {
  const store = pruned(readRaw());
  store[slug] = Date.now() + TTL_MS;
  writeRaw(store);
  listeners.forEach((l) => l());
}

/** Unsuppress (rarely used; kept for tests / user restore flows). */
export function unsuppressSlug(slug: string) {
  const store = pruned(readRaw());
  delete store[slug];
  writeRaw(store);
  listeners.forEach((l) => l());
}

/** Subscribe to suppress-set changes; returns unsubscribe. */
export function subscribeSuppressed(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
