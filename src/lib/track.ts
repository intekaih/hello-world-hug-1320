/**
 * MovieCC analytics adapter (see docs/analytics.md).
 *
 * `window.__mcTrack(event, props?)` is the single sink. This module installs a
 * no-op default in the browser so every call site is safe without setup — real
 * providers (Plausible, PostHog, etc.) can later monkey-patch the same global
 * without touching any call site. `track(...)` is the sugar that forwards.
 *
 * Contract:
 *   - No PII. Only slugs, event names, coarse counters, session UUID.
 *   - Fire-and-forget. Failures never throw into React render paths.
 *
 * Bootstrapping:
 *   - `initTracking()` runs from `src/router.tsx` (or the client entry) once
 *     per page load; it installs the default sink + a 5-minute
 *     `session_heartbeat` timer.
 */

type Payload = Record<string, unknown> | undefined;
type Sink = (event: string, props?: Payload) => void;

declare global {
  interface Window {
    __mcTrack?: Sink;
    __mcSessionId?: string;
    __mcTrackInit?: boolean;
  }
}

function ensureSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  if (window.__mcSessionId) return window.__mcSessionId;
  const rnd =
    (globalThis.crypto?.randomUUID?.() as string | undefined) ??
    Math.random().toString(36).slice(2) + Date.now().toString(36);
  window.__mcSessionId = rnd;
  return rnd;
}

/** Fire-and-forget analytics hook. Safe to call from anywhere. */
export function track(event: string, props?: Payload) {
  if (typeof window === "undefined") return;
  try {
    window.__mcTrack?.(event, props);
  } catch {
    /* ignore */
  }
}

/**
 * Install the default no-op sink and start the session heartbeat.
 * Idempotent — safe to call more than once (e.g. HMR).
 */
export function initTracking() {
  if (typeof window === "undefined") return;
  if (window.__mcTrackInit) return;
  window.__mcTrackInit = true;

  ensureSessionId();

  if (!window.__mcTrack) {
    // Default sink: no-op. Replace with a real provider by assigning
    // `window.__mcTrack = (event, props) => { ... }` from any bootstrap script.
    window.__mcTrack = () => {
      /* no-op */
    };
  }

  const HEARTBEAT_MS = 5 * 60 * 1000;
  const startedAt = Date.now();
  let ticks = 0;
  const fire = () => {
    if (document.hidden) return; // don't count background tabs
    ticks += 1;
    track("session_heartbeat", {
      session: window.__mcSessionId,
      minute: Math.round((Date.now() - startedAt) / 60000),
      tick: ticks,
    });
  };
  window.setInterval(fire, HEARTBEAT_MS);
}
