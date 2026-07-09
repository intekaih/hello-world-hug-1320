import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Mood = "relax" | "tense" | "moving";

/**
 * Taste onboarding — a lightweight, skippable preference layer that
 * feeds the recommendation engine before we have real watch signals.
 * Persisted to localStorage; a future account sync can lift this to
 * the backend without changing the read shape.
 */
type TasteState = {
  genres: string[];     // up to 3 genre labels (exact strings from browse fixture)
  country: string | null;
  mood: Mood | null;
  /** True once the user completes or explicitly skips onboarding. */
  onboarded: boolean;
  /** True if the user dismissed without completing — never re-open uninvited. */
  skipped: boolean;
  save: (input: { genres: string[]; country: string | null; mood: Mood | null }) => void;
  skip: () => void;
  reset: () => void;
  reopen: () => void;
};

export const useTasteStore = create<TasteState>()(
  persist(
    (set) => ({
      genres: [],
      country: null,
      mood: null,
      onboarded: false,
      skipped: false,
      save: ({ genres, country, mood }) =>
        set({
          genres: genres.slice(0, 3),
          country,
          mood,
          onboarded: true,
          skipped: false,
        }),
      skip: () => set({ onboarded: true, skipped: true }),
      reset: () =>
        set({ genres: [], country: null, mood: null, onboarded: false, skipped: false }),
      reopen: () => set({ onboarded: false, skipped: false }),
    }),
    {
      name: "taste.v1",
      partialize: (s) => ({
        genres: s.genres,
        country: s.country,
        mood: s.mood,
        onboarded: s.onboarded,
        skipped: s.skipped,
      }),
    },
  ),
);

/** Selector: does the user have any expressed taste we can score against? */
export function hasTasteSignal(s: Pick<TasteState, "genres" | "country" | "mood">) {
  return s.genres.length > 0 || s.country !== null || s.mood !== null;
}

/**
 * Mood → genre bias. Kept editorial (not a hard filter) so a "relax"
 * user still sees the occasional thriller if it matches their genres.
 */
export const MOOD_GENRES: Record<Mood, string[]> = {
  relax: ["Hài", "Tình cảm", "Hoạt hình"],
  tense: ["Hành động", "Kinh dị", "Tội phạm", "Bí ẩn"],
  moving: ["Chính kịch", "Lịch sử", "Tình cảm"],
};

/** Available options mirrored from the browse fixture. */
export const TASTE_GENRES = [
  "Hành động",
  "Chính kịch",
  "Hài",
  "Tình cảm",
  "Kinh dị",
  "Khoa học viễn tưởng",
  "Phiêu lưu",
  "Bí ẩn",
  "Tội phạm",
  "Lịch sử",
  "Hoạt hình",
] as const;

export const TASTE_COUNTRIES = [
  "Mỹ",
  "Hàn Quốc",
  "Nhật Bản",
  "Anh",
  "Tây Ban Nha",
] as const;
