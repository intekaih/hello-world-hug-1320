import { create } from "zustand";
import { persist } from "zustand/middleware";

type UIState = {
  sidebarOpen: boolean;
  searchOpen: boolean;
  episodePanelOpen: boolean;
  /** Opt-in UI sound effects. Default OFF — the app is silent unless the
   *  user explicitly turns this on in Settings. Never gates hover or
   *  autoplayed trailer audio; only reserved for discrete confirmation
   *  cues (add-to-watchlist whoosh, episode-complete tick). */
  soundEnabled: boolean;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  setSearchOpen: (v: boolean) => void;
  setEpisodePanelOpen: (v: boolean) => void;
  setSoundEnabled: (v: boolean) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      searchOpen: false,
      episodePanelOpen: false,
      soundEnabled: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      setEpisodePanelOpen: (episodePanelOpen) => set({ episodePanelOpen }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
    }),
    {
      name: "moviecc-ui",
      // Persist only the durable preference — ephemeral open/close state
      // should reset per session.
      partialize: (s) => ({ soundEnabled: s.soundEnabled }),
    },
  ),
);
