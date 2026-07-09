import { useEffect, type ReactNode } from "react";

import { apiGet, ApiError } from "@/api-client";
import { useAuthStore, type AuthUser } from "@/store/authStore";

type MeResponse = {
  user: AuthUser | null;
  /** Optional: server may return session expiry as unix seconds or ms. */
  expires_at?: number;
};

/**
 * Fires GET /api/auth/me once on mount, hydrates the Zustand auth store.
 * On 401 the store is cleared (user = null) but we do NOT force-redirect —
 * public pages must stay reachable. Protected surfaces gate on the store.
 */
export function useAuthBootstrap() {
  const status = useAuthStore((s) => s.status);
  const setStatus = useAuthStore((s) => s.setStatus);
  const setUser = useAuthStore((s) => s.setUser);
  const reset = useAuthStore((s) => s.reset);

  useEffect(() => {
    if (status !== "idle") return;
    setStatus("loading");

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8_000);

    (async () => {
      try {
        const data = await apiGet<MeResponse>("/api/auth/me", {
          signal: controller.signal,
        });
        if (data.user) {
          const exp = data.expires_at
            ? data.expires_at < 1e12
              ? data.expires_at * 1000
              : data.expires_at
            : null;
          setUser(data.user, exp);
        } else {
          reset();
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          reset();
        } else {
          console.warn("[auth] /me failed", err);
          reset();
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    })();
  }, [status, setStatus, setUser, reset]);
}

/**
 * Root-level bootstrap: fires the /me check on mount and always renders
 * children. Public pages must remain reachable during the initial probe;
 * protected surfaces gate on the auth store independently. Rendering the
 * same tree on server and client avoids hydration mismatches.
 */
export function AuthInitializer({ children }: { children: ReactNode }) {
  useAuthBootstrap();
  return <>{children}</>;
}
