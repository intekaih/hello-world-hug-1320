import { ensureCsrfToken } from "@/hooks/useCsrfToken";

// Backend Express API base URL — phải set trong .env Lovable:
// VITE_API_BASE_URL=http://localhost:3000
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export type ApiInit = Omit<RequestInit, "body"> & {
  json?: unknown;
  body?: BodyInit | null;
};

/** Resolve full URL: nếu path là absolute (http/https) thì giữ nguyên; nếu relative thì prefix API_BASE_URL */
function resolveUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  if (!API_BASE_URL) return path;  // dev fallback — dùng Vite proxy
  return `${API_BASE_URL.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/**
 * Base fetch wrapper. For any non-GET request, automatically attaches:
 *   - `X-CSRF-Token` header (double-submit cookie pattern)
 *   - `credentials: 'include'` so the session cookie rides along
 *   - `Content-Type: application/json` when `json` is provided
 */
export async function apiFetch<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers ?? {});

  let body = init.body ?? null;
  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  if (method !== "GET" && method !== "HEAD") {
    const token = ensureCsrfToken();
    if (token && !headers.has("X-CSRF-Token")) headers.set("X-CSRF-Token", token);
  }

  const res = await fetch(resolveUrl(path), {
    ...init,
    method,
    headers,
    body,
    credentials: init.credentials ?? "include",
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");

  if (!res.ok) {
    const message =
      (isJson && data && typeof data === "object" && "error" in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).error)
        : undefined) ?? `Request failed: ${res.status}`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export function apiGet<T = unknown>(path: string, init?: ApiInit) {
  return apiFetch<T>(path, { ...init, method: "GET" });
}

export function apiPost<T = unknown>(path: string, json?: unknown, init?: ApiInit) {
  return apiFetch<T>(path, { ...init, method: "POST", json });
}

export function apiPut<T = unknown>(path: string, json?: unknown, init?: ApiInit) {
  return apiFetch<T>(path, { ...init, method: "PUT", json });
}

export function apiPatch<T = unknown>(path: string, json?: unknown, init?: ApiInit) {
  return apiFetch<T>(path, { ...init, method: "PATCH", json });
}

export function apiDelete<T = unknown>(path: string, init?: ApiInit) {
  return apiFetch<T>(path, { ...init, method: "DELETE" });
}
