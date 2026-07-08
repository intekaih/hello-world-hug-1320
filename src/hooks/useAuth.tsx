import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { apiGet, ApiError } from "@/api-client";
import {
  useAuthStore,
  selectIsAuthenticating,
  type AuthUser,
} from "@/store/authStore";

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
 * Root-level gate: runs the bootstrap and shows a splash while the initial
 * /me check is in flight. Public and protected pages both mount only after
 * the check completes, so `useAuthStore` is authoritative from first render.
 */
export function AuthInitializer({ children }: { children: ReactNode }) {
  useAuthBootstrap();
  const isAuthenticating = useAuthStore(selectIsAuthenticating);

  if (isAuthenticating) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-white/60">Đang khôi phục phiên đăng nhập…</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
