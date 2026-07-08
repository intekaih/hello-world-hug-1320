import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemeState = {
  /** null = follow system, true = force dark, false = force light. */
  isDark: boolean | null;
  /** Effective theme after resolving system preference. */
  resolved: "dark" | "light";
  toggle: () => void;
  setDark: (v: boolean) => void;
  followSystem: () => void;
  /** Recomputes `resolved` from `isDark` + current media query. */
  syncResolved: () => void;
};

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

function resolve(pref: boolean | null): "dark" | "light" {
  if (pref === null) return systemPrefersDark() ? "dark" : "light";
  return pref ? "dark" : "light";
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: null,
      resolved: "dark",
      toggle: () => {
        const next = get().resolved === "dark" ? false : true;
        set({ isDark: next, resolved: resolve(next) });
      },
      setDark: (isDark) => set({ isDark, resolved: resolve(isDark) }),
      followSystem: () => set({ isDark: null, resolved: resolve(null) }),
      syncResolved: () => set({ resolved: resolve(get().isDark) }),
    }),
    {
      name: "moviecc-theme",
      partialize: (s) => ({ isDark: s.isDark }),
      onRehydrateStorage: () => (state) => {
        if (state) state.resolved = resolve(state.isDark);
      },
    },
  ),
);

