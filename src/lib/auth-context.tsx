import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";

import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  toAuthUser,
} from "@/api-client/auth";
import { useAuthStore, type AuthUser } from "@/store/authStore";

export type AuthStatus = "loading" | "authed" | "guest";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const storeStatus = useAuthStore((s) => s.status);
  const setStatus = useAuthStore((s) => s.setStatus);

  const refresh = useCallback(async () => {
    await getMe().catch(() => null);
  }, []);

  useEffect(() => {
    if (storeStatus !== "idle") return;
    setStatus("loading");
    refresh();
  }, [storeStatus, setStatus, refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const be = await apiLogin(username, password);
    useAuthStore.getState().setUser(toAuthUser(be));
  }, []);

  const register = useCallback(
    async (username: string, password: string, displayName?: string) => {
      const be = await apiRegister(username, password, displayName);
      useAuthStore.getState().setUser(toAuthUser(be));
    },
    [],
  );

  const logout = useCallback(async () => {
    await apiLogout();
  }, []);

  const status: AuthStatus =
    storeStatus === "idle" || storeStatus === "loading"
      ? "loading"
      : user
        ? "authed"
        : "guest";

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout, refresh }),
    [user, status, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
