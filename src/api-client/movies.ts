/**
 * Mappers between backend (Express) Movie shape and FE card/hero shapes.
 * BE shape reference: API_REFERENCE.md → PHẦN B.
 */
import type {
  ContinueWatchingItem,
  HeroMovie,
  HomeData,
  MovieCard,
} from "@/lib/home-queries";
import { apiGet } from "./base";

export type BeMovie = {
  id?: string | number;
  _id?: string;
  name: string;
  origin_name?: string;
  slug: string;
  thumb_url?: string;
  poster_url?: string;
  backdrop_url?: string;
  logo_url?: string;
  year?: number;
  quality?: string;
  lang?: string;
  episode_current?: string;
  episode_total?: string;
  type?: string;
  time?: string;
  category?: Array<{ name: string; slug: string }>;
  country?: Array<{ name: string; slug: string }>;
  content?: string;
  rating?: number;
  trailer_url?: string | null;
  tmdb?: { id?: number; type?: string; vote_average?: number };
  epSlug?: string | null;
};

export type BeHomeResponse = {
  heroMovies: BeMovie[];
  top10Movies: BeMovie[];
  hotSeriesMovies: BeMovie[];
  animeMovies: BeMovie[];
  newMovies: BeMovie[];
};

const IMG_PROXY =
  (import.meta.env.VITE_IMAGE_PROXY_URL as string | undefined) ?? "";

/** Wrap remote poster/backdrop URLs through the BE image proxy for CORS + cache. */
export function proxyImage(url?: string | null): string {
  if (!url) return "";
  if (!IMG_PROXY) return url;
  // BE format: /image/base64(providerKey:originalUrl). We don't know the
  // providerKey → pass through as raw base64 with empty key prefix.
  try {
    const encoded = btoa(`react:${url}`);
    return `${IMG_PROXY.replace(/\/+$/, "")}/${encoded}`;
  } catch {
    return url;
  }
}

// Hash a string slug → stable positive int (React keys expect number here).
function hashId(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickId(m: BeMovie): number {
  if (typeof m.id === "number") return m.id;
  if (typeof m.id === "string" && m.id) return hashId(m.id);
  if (m._id) return hashId(m._id);
  return hashId(m.slug);
}

function pickBackdrop(m: BeMovie): string {
  return proxyImage(m.backdrop_url || m.poster_url || m.thumb_url);
}
function pickPoster(m: BeMovie): string {
  return proxyImage(m.thumb_url || m.poster_url || m.backdrop_url);
}

function pickGenres(m: BeMovie): string[] {
  return (m.category ?? []).slice(0, 3).map((c) => c.name).filter(Boolean);
}

function pickRatingLabel(m: BeMovie): string {
  if (m.tmdb?.vote_average) return m.tmdb.vote_average.toFixed(1);
  if (typeof m.rating === "number" && m.rating > 0) return m.rating.toFixed(1);
  return m.quality || "HD";
}

export function toHero(m: BeMovie): HeroMovie {
  return {
    id: pickId(m),
    slug: m.slug,
    title: m.name,
    overview: (m.content ?? "").replace(/<[^>]+>/g, "").trim(),
    backdrop_url: pickBackdrop(m),
    logo_url: proxyImage(m.logo_url) || "",
    year: m.year ?? 0,
    runtime: m.time || "",
    rating: pickRatingLabel(m),
    genres: pickGenres(m),
    trailer_url: m.trailer_url ?? null,
  };
}

export function toCard(m: BeMovie): MovieCard {
  return {
    id: pickId(m),
    slug: m.slug,
    title: m.name,
    poster_url: pickPoster(m),
    year: m.year ?? 0,
    rating: m.tmdb?.vote_average ?? m.rating ?? 0,
  };
}

/** Fetch home data from the real Express BE and normalize to FE shape. */
export async function fetchHomeData(): Promise<HomeData> {
  const be = await apiGet<BeHomeResponse>("/movies/home");
  const continueWatching: ContinueWatchingItem[] = []; // wired later via /history
  return {
    heroMovies: (be.heroMovies ?? []).map(toHero),
    top10Movies: (be.top10Movies ?? []).map(toCard),
    hotSeriesMovies: (be.hotSeriesMovies ?? []).map(toCard),
    animeMovies: (be.animeMovies ?? []).map(toCard),
    newMovies: (be.newMovies ?? []).map(toCard),
    continueWatching,
  };
}
