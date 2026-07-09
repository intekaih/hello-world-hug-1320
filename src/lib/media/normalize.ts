/**
 * Data normalization helpers.
 *
 * Every card/hero/detail component should route its image/rating/runtime
 * reads through here so a missing field renders a graceful fallback
 * (blank badge → nothing, broken image → gradient tile) instead of NaN
 * or a broken layout.
 */
import { thumbSrc } from "@/utils/thumbSrc";

type ImgSource = {
  url?: string | null;
  path?: string | null;
};

type MovieLike = {
  backdrop_url?: string | null;
  backdrop_path?: string | null;
  poster_url?: string | null;
  poster_path?: string | null;
  logo_url?: string | null;
  logo_path?: string | null;
  thumb_url?: string | null;
  rating?: number | string | null;
  vote_average?: number | null;
  runtime?: number | string | null;
  duration?: number | string | null;
  episode_current?: number | string | null;
  episode_total?: number | string | null;
  total_episodes?: number | null;
  categories?: string[] | null;
  genres?: string[] | null;
};

const IMG = (p: string) =>
  p.startsWith("http") ? p : `https://image.tmdb.org/t/p/original${p}`;

function firstImage(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (c && typeof c === "string" && c.trim().length > 0) return IMG(c);
  }
  return null;
}

export function getBestBackdrop(m: MovieLike): string | null {
  return firstImage(m.backdrop_url, m.backdrop_path, m.poster_url, m.poster_path);
}

export function getBestPoster(m: MovieLike): string | null {
  return firstImage(m.poster_url, m.poster_path, m.thumb_url, m.backdrop_url);
}

export function getBestLogo(m: MovieLike): string | null {
  return firstImage(m.logo_url, m.logo_path);
}

export function renderableImage(url: string | null | undefined, w = 400): string | null {
  if (!url) return null;
  return thumbSrc(url, { w });
}

export function getRating(m: MovieLike): number | null {
  const raw = m.rating ?? m.vote_average;
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function getRuntime(m: MovieLike): string | null {
  const raw = m.duration ?? m.runtime;
  if (raw == null || raw === "") return null;
  if (typeof raw === "string" && /[hm]/i.test(raw)) return raw;
  const mins = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(mins) || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const mm = mins % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

export function getEpisodeLabel(m: MovieLike): string | null {
  const cur = m.episode_current ?? null;
  const tot = m.episode_total ?? m.total_episodes ?? null;
  if (cur == null && tot == null) return null;
  if (cur != null && tot != null) return `Ep ${cur}/${tot}`;
  if (tot != null) return `${tot} tập`;
  if (cur != null) return `Ep ${cur}`;
  return null;
}

export function getGenres(m: MovieLike): string[] {
  const g = m.genres ?? m.categories ?? [];
  return Array.isArray(g) ? g.filter((x) => typeof x === "string" && x.trim()) : [];
}

export function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function getCastImage(person: ImgSource & { profile_url?: string | null }): string | null {
  return firstImage(person.url, person.profile_url, person.path);
}
