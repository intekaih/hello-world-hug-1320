import { ensureCsrfToken } from "@/hooks/useCsrfToken";

export type ApiInit = Omit<RequestInit, "body"> & {
  json?: unknown;
  body?: BodyInit | null;
};

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

  const res = await fetch(path, {
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
