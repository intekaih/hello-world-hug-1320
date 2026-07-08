import { create } from "zustand";

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  avatar_url: string;
};

export type AuthStatus = "idle" | "loading" | "ready";

type AuthState = {
  user: AuthUser | null;
  status: AuthStatus;
  /** Unix ms when the session cookie is expected to expire (best-effort). */
  expiresAt: number | null;
  setUser: (user: AuthUser | null, expiresAt?: number | null) => void;
  setStatus: (status: AuthStatus) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "idle",
  expiresAt: null,
  setUser: (user, expiresAt = null) =>
    set({ user, expiresAt, status: "ready" }),
  setStatus: (status) => set({ status }),
  reset: () => set({ user: null, expiresAt: null, status: "ready" }),
}));

/** Convenience selectors */
export const selectIsAuthenticated = (s: AuthState) => !!s.user;
export const selectIsAuthenticating = (s: AuthState) =>
  s.status === "idle" || s.status === "loading";
