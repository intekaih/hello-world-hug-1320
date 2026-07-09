/**
 * CSRF token management for the Express BE (lovableCsrf double-submit).
 *
 * Because BE runs on a different origin (e.g. localhost:3000) than FE
 * (localhost:8080), the `csrf_token` cookie set by BE is NOT readable via
 * `document.cookie` on the FE. We fetch it once from `/auth/csrf-token`,
 * remember the token in memory, and mirror it into the `X-CSRF-Token`
 * header on every mutating request. The cookie itself rides along
 * automatically thanks to `credentials: 'include'`.
 */

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

let cachedToken: string | null = null;
let inflight: Promise<string> | null = null;

function csrfUrl(): string {
  const base = API_BASE_URL.replace(/\/+$/, "");
  return `${base}/auth/csrf-token`;
}

export function getCachedCsrfToken(): string | null {
  return cachedToken;
}

/** Fetch (and cache) a CSRF token from BE. Safe to call multiple times. */
export async function ensureBeCsrfToken(force = false): Promise<string> {
  if (typeof window === "undefined") return "";
  if (!force && cachedToken) return cachedToken;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(csrfUrl(), {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`csrf-token ${res.status}`);
      const data = (await res.json().catch(() => null)) as
        | { csrfToken?: string }
        | null;
      const token = data?.csrfToken ?? "";
      cachedToken = token || null;
      return token;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
