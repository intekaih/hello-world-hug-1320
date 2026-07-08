import { create } from "zustand";
import { persist } from "zustand/middleware";

type PlayerState = {
  volume: number;
  muted: boolean;
  playbackRate: number;
  quality: "auto" | "1080p" | "720p" | "480p";
  autoNext: boolean;
  setVolume: (v: number) => void;
  toggleMuted: () => void;
  setPlaybackRate: (r: number) => void;
  setQuality: (q: PlayerState["quality"]) => void;
  setAutoNext: (v: boolean) => void;
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      volume: 1,
      muted: false,
      playbackRate: 1,
      quality: "auto",
      autoNext: true,
      setVolume: (volume) => set({ volume }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setPlaybackRate: (playbackRate) => set({ playbackRate }),
      setQuality: (quality) => set({ quality }),
      setAutoNext: (autoNext) => set({ autoNext }),
    }),
    { name: "moviecc-player" },
  ),
);
