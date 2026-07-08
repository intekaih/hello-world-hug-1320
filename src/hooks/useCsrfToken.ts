/**
 * Read the CSRF token from the `csrf_token` cookie or a `<meta name="csrf-token">` tag.
 * Server-safe (returns "" during SSR).
 */
export function readCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
  return meta?.content ?? "";
}

/**
 * Ensure a CSRF token cookie exists. If not, generate one client-side
 * (double-submit cookie pattern — server compares header vs cookie).
 * Safe to call multiple times; no-op after the first.
 */
export function ensureCsrfToken(): string {
  if (typeof document === "undefined") return "";
  let token = readCsrfToken();
  if (!token) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    // 1 day, Lax, path=/. Not HttpOnly on purpose — must be JS-readable.
    document.cookie = `csrf_token=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24}; SameSite=Lax`;
  }
  return token;
}
