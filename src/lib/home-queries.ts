import { queryOptions } from "@tanstack/react-query";

export type HeroMovie = {
  id: number;
  slug: string;
  title: string;
  overview: string;
  backdrop_url: string;
  logo_url: string;
  year: number;
  runtime: string;
  rating: string;
  genres: string[];
  trailer_url?: string | null;
};

export type MovieCard = {
  id: number;
  slug: string;
  title: string;
  poster_url: string;
  year: number;
  rating: number;
};

/**
 * Continue-watching contract (normalized):
 *  · progress    — 0..1 clamp; caller ensures.
 *  · remaining   — pre-formatted human string ("38 min left", "còn 12 phút").
 *  · episodeLabel — optional explicit episode label, e.g. "8" or "S1E8".
 *                   Falls back to regex-parsed value from title when absent.
 */
export type ContinueWatchingItem = MovieCard & {
  progress: number;
  remaining: string;
  episodeLabel?: string;
};

/** Show progress ring/bar only inside this window — noise on 0 or 100%. */
export const PROGRESS_MIN = 0.02;
export const PROGRESS_MAX = 0.95;
export const NEAR_COMPLETE = 0.85;

export const hasVisibleProgress = (p: number | null | undefined) =>
  typeof p === "number" && p > PROGRESS_MIN && p < PROGRESS_MAX;

export const isNearComplete = (p: number | null | undefined) =>
  typeof p === "number" && p >= NEAR_COMPLETE && p < PROGRESS_MAX;

export type HomeData = {
  heroMovies: HeroMovie[];
  top10Movies: MovieCard[];
  hotSeriesMovies: MovieCard[];
  newMovies: MovieCard[];
  animeMovies: MovieCard[];
  continueWatching: ContinueWatchingItem[];
};

export const homeQueryOptions = queryOptions({
  queryKey: ["home"] as const,
  queryFn: async (): Promise<HomeData> => {
    // Real BE (Express) — see API_REFERENCE.md.
    const { fetchHomeData } = await import("@/api-client/movies");
    return fetchHomeData();
  },
  staleTime: 60_000,
});
