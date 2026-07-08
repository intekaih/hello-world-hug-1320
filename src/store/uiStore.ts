import { create } from "zustand";

type UIState = {
  sidebarOpen: boolean;
  searchOpen: boolean;
  episodePanelOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  setSearchOpen: (v: boolean) => void;
  setEpisodePanelOpen: (v: boolean) => void;
};

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  searchOpen: false,
  episodePanelOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setEpisodePanelOpen: (episodePanelOpen) => set({ episodePanelOpen }),
}));
