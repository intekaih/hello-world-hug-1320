/**
 * Movie detail / episode / related — real BE (Express) integration.
 *
 * BE endpoints (all public, all prefixed by VITE_API_BASE_URL):
 *   GET /movies/:slug              → full BeMovie + episodes[] (flat)
 *   GET /movies/:slug/episode/:ep  → { name, slug, servers[] }
 *   GET /movies/:slug/related      → { relatedParts, relatedMovies }
 */
import { apiGet, ApiError } from "./base";
import { proxyImage, toCard, type BeMovie } from "./movies";
import type { Movie, RelatedItem } from "@/components/movie-detail/types";

/* ---------- BE raw shapes ---------- */

type BeEpisodeItem = {
  name: string;
  slug: string;
  link_embed?: string;
  link_m3u8?: string;
};

type BeEpisodeServer = {
  server_name?: string;
  serverName?: string;
  items?: BeEpisodeItem[];
  server_data?: BeEpisodeItem[];
};

/** BE returns the movie flat: BeMovie fields + `episodes: BeEpisodeServer[]`. */
type BeMovieDetail = BeMovie & {
  episodes?: Array<
    | BeEpisodeServer
    | (BeEpisodeItem & { servers?: Array<{ server_name?: string; link_embed?: string; link_m3u8?: string }> })
  >;
  actor?: string[];
  director?: string[] | string;
  status?: string;
};

/* ---------- helpers ---------- */

function stripHtml(html?: string): string {
  if (!html) return "";
  if (typeof DOMParser !== "undefined") {
    try {
      return new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() ?? "";
    } catch {
      /* fall through */
    }
  }
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function parseRuntimeMinutes(time?: string): string {
  if (!time) return "";
  return time;
}

function parseAgeRating(status?: string, categories?: { name: string }[]): string {
  // BE doesn't expose MPAA; approximate from cats or default.
  if (categories?.some((c) => /18\+|hành động|kinh dị/i.test(c.name))) return "PG-13";
  return "TV-14";
}

/** Flatten BE episodes into normalized [{ serverName, items[] }] shape. */
export type NormalizedEpisodeServer = {
  serverName: string;
  items: Array<{ name: string; slug: string; embed: string; m3u8: string }>;
};

export function normalizeEpisodes(be: BeMovieDetail): NormalizedEpisodeServer[] {
  const raw = be.episodes ?? [];
  if (raw.length === 0) return [];

  // Case A: KKPhim/nguonC → server_data list per server object
  if (raw[0] && (Array.isArray((raw[0] as BeEpisodeServer).items) ||
                 Array.isArray((raw[0] as BeEpisodeServer).server_data))) {
    return (raw as BeEpisodeServer[]).map((srv, idx) => ({
      serverName: srv.server_name ?? srv.serverName ?? `Server #${idx + 1}`,
      items: (srv.items ?? srv.server_data ?? []).map((ep) => ({
        name: ep.name,
        slug: ep.slug || ep.name,
        embed: ep.link_embed ?? "",
        m3u8: ep.link_m3u8 ?? "",
      })),
    }));
  }

  // Case B: merged episodes[] where each item has servers[]
  const byServer = new Map<string, NormalizedEpisodeServer>();
  for (const ep of raw as Array<BeEpisodeItem & { servers?: Array<{ server_name?: string; link_embed?: string; link_m3u8?: string }> }>) {
    const servers = ep.servers ?? [{ server_name: "Server #1", link_embed: ep.link_embed, link_m3u8: ep.link_m3u8 }];
    for (const s of servers) {
      const key = s.server_name ?? "Server #1";
      if (!byServer.has(key)) byServer.set(key, { serverName: key, items: [] });
      byServer.get(key)!.items.push({
        name: ep.name,
        slug: ep.slug || ep.name,
        embed: s.link_embed ?? "",
        m3u8: s.link_m3u8 ?? "",
      });
    }
  }
  return Array.from(byServer.values());
}

/** Map BE detail → UI `Movie` shape used by hero/meta/etc. */
export function toUiMovie(be: BeMovieDetail): Movie {
  const total = normalizeEpisodes(be).reduce(
    (max, s) => Math.max(max, s.items.length),
    0,
  );
  const directors = Array.isArray(be.director)
    ? be.director.filter(Boolean).join(", ")
    : (be.director ?? "");

  return {
    slug: be.slug,
    title: be.name,
    original_title: be.origin_name ?? be.name,
    year: be.year ?? 0,
    duration: parseRuntimeMinutes(be.time),
    quality: be.quality ?? "HD",
    language: be.lang ?? "Vietsub",
    rating: be.tmdb?.vote_average ?? be.rating ?? 0,
    age_rating: parseAgeRating(be.status, be.category),
    backdrop_url: proxyImage(be.backdrop_url || be.thumb_url || be.poster_url),
    poster_url: proxyImage(be.poster_url || be.thumb_url),
    logo_url: proxyImage(be.logo_url) || "",
    trailer_url: be.trailer_url ?? undefined,
    overview: stripHtml(be.content),
    overview_vi: stripHtml(be.content),
    categories: (be.category ?? []).map((c) => c.name),
    country: (be.country ?? []).map((c) => c.name).join(", "),
    director: directors,
    cast: be.actor ?? [],
    total_episodes: total || 1,
    parts: [],
  };
}

/* ---------- public API ---------- */

export type MovieDetailBundle = {
  movie: Movie;
  episodes: NormalizedEpisodeServer[];
  raw: BeMovieDetail;
};

export async function fetchMovieDetail(slug: string): Promise<MovieDetailBundle> {
  const be = await apiGet<BeMovieDetail>(`/movies/${encodeURIComponent(slug)}`);
  return { movie: toUiMovie(be), episodes: normalizeEpisodes(be), raw: be };
}

export type EpisodeStream = {
  name: string;
  slug: string;
  servers: Array<{ id: string; name: string; embed: string; m3u8: string; src: string }>;
};

export async function fetchEpisode(slug: string, episodeParam: string): Promise<EpisodeStream> {
  // episodeParam is a bare number (e.g. "1"); BE accepts "tap-1" or the raw slug.
  const epPath = /^tap-/.test(episodeParam) ? episodeParam : `tap-${episodeParam}`;
  const data = await apiGet<{
    name: string;
    slug: string;
    servers: Array<{ serverName?: string; server_name?: string; link_embed?: string; link_m3u8?: string }>;
  }>(`/movies/${encodeURIComponent(slug)}/episode/${encodeURIComponent(epPath)}`);

  const servers = (data.servers ?? []).map((s, idx) => {
    const name = s.serverName ?? s.server_name ?? `Server #${idx + 1}`;
    const embed = s.link_embed ?? "";
    const m3u8 = s.link_m3u8 ?? "";
    return {
      id: `srv-${idx}`,
      name,
      embed,
      m3u8,
      src: m3u8 || embed, // prefer HLS
    };
  });

  return { name: data.name, slug: data.slug, servers };
}

export async function fetchRelatedMovies(slug: string, limit = 12): Promise<RelatedItem[]> {
  try {
    const data = await apiGet<{ relatedParts?: BeMovie[]; relatedMovies?: BeMovie[] }>(
      `/movies/${encodeURIComponent(slug)}/related`,
    );
    const merged = [...(data.relatedParts ?? []), ...(data.relatedMovies ?? [])];
    return merged.slice(0, limit).map((m) => {
      const card = toCard(m);
      return {
        slug: card.slug,
        title: card.title,
        poster_url: card.poster_url,
        year: card.year,
        rating: card.rating,
      };
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return [];
    throw err;
  }
}
