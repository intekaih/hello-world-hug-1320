import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Next local 5:00 AM (ms since epoch). Used to snooze autoplay overnight. */
function nextLocalFiveAm(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(5, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

type PlayerState = {
  volume: number;
  muted: boolean;
  playbackRate: number;
  quality: "auto" | "1080p" | "720p" | "480p";
  autoNext: boolean;
  /** True after the user has seen the "auto-next is ON" hint once. */
  firstBingeTooltipSeen: boolean;
  /** Epoch ms; while now < this value, treat autoNext as OFF. */
  pauseAutoplayUntil: number | null;
  setVolume: (v: number) => void;
  toggleMuted: () => void;
  setPlaybackRate: (r: number) => void;
  setQuality: (q: PlayerState["quality"]) => void;
  setAutoNext: (v: boolean) => void;
  markBingeTooltipSeen: () => void;
  /** Pause autoplay until the next local 5:00 AM. */
  pauseAutoplayTonight: () => void;
  resumeAutoplay: () => void;
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      volume: 1,
      muted: false,
      playbackRate: 1,
      quality: "auto",
      autoNext: true,
      firstBingeTooltipSeen: false,
      pauseAutoplayUntil: null,
      setVolume: (volume) => set({ volume }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setPlaybackRate: (playbackRate) => set({ playbackRate }),
      setQuality: (quality) => set({ quality }),
      setAutoNext: (autoNext) => set({ autoNext }),
      markBingeTooltipSeen: () => set({ firstBingeTooltipSeen: true }),
      pauseAutoplayTonight: () =>
        set({ pauseAutoplayUntil: nextLocalFiveAm() }),
      resumeAutoplay: () => set({ pauseAutoplayUntil: null }),
    }),
    { name: "moviecc-player" },
  ),
);

/** Convenience selector: is autoplay currently effectively enabled? */
export function isAutoplayActive(s: {
  autoNext: boolean;
  pauseAutoplayUntil: number | null;
}): boolean {
  if (!s.autoNext) return false;
  if (s.pauseAutoplayUntil && Date.now() < s.pauseAutoplayUntil) return false;
  return true;
}
