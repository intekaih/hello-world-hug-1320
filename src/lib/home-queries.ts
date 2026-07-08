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
};

export type MovieCard = {
  id: number;
  slug: string;
  title: string;
  poster_url: string;
  year: number;
  rating: number;
};

export type ContinueWatchingItem = MovieCard & {
  progress: number;
  remaining: string;
};

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
    const res = await fetch("/api/movies/home");
    if (!res.ok) throw new Error("Failed to load home");
    return res.json();
  },
  staleTime: 60_000,
});
