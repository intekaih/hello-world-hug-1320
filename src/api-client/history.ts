/**
 * Watch history client — wraps the Express BE endpoints:
 *   GET    /api/react/history
 *   POST   /api/react/history/progress
 *   GET    /api/react/history/progress/:slug/:episode
 *   DELETE /api/react/history/:id
 *
 * All routes require auth; callers should gate on `useAuth().user`.
 */
import { apiFetch, apiGet, apiDelete, apiPost, ApiError } from "./base";
import { proxyImage } from "./movies";

export interface HistoryItem {
  id: string;
  movieSlug: string;
  movieName: string;
  posterUrl: string; // proxied
  posterUrlRaw: string; // original (for re-posting to BE)
  episode: string;
  episodeSlug?: string;
  position: number;
  duration: number;
  progressPercent: number;
  watchedAt: string;
  completed: boolean;
}

interface BeHistoryEntry {
  _id: string;
  movieSlug: string;
  movieName: string;
  posterUrl: string;
  episode: string;
  episodeSlug?: string;
  position: number;
  duration: number;
  progressPercent: number;
  watchedAt: string;
  completed: boolean;
}

function toItem(e: BeHistoryEntry): HistoryItem {
  return {
    id: e._id,
    movieSlug: e.movieSlug,
    movieName: e.movieName,
    posterUrl: proxyImage(e.posterUrl),
    posterUrlRaw: e.posterUrl,
    episode: e.episode,
    episodeSlug: e.episodeSlug,
    position: e.position ?? 0,
    duration: e.duration ?? 0,
    progressPercent: e.progressPercent ?? 0,
    watchedAt: e.watchedAt,
    completed: !!e.completed,
  };
}

export async function fetchHistory(limit = 20): Promise<HistoryItem[]> {
  try {
    const res = await apiGet<{ items: BeHistoryEntry[]; total: number }>(
      `/api/react/history?limit=${limit}`,
    );
    return (res.items ?? []).map(toItem);
  } catch (e) {
    // Guest / unauthenticated → empty list, not an error.
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return [];
    console.warn("[history] fetchHistory failed", e);
    return [];
  }
}

export interface SaveProgressInput {
  movieSlug: string;
  movieName: string;
  posterUrl: string; // raw (BE will store as-is)
  episode: string;
  episodeSlug?: string;
  position: number;
  duration: number;
}

export async function saveProgress(input: SaveProgressInput): Promise<void> {
  try {
    await apiPost("/api/react/history/progress", input);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return;
    console.warn("[history] saveProgress failed", e);
  }
}

/** Best-effort variant for tab-close / beacon paths — uses keepalive. */
export function saveProgressBeacon(input: SaveProgressInput): void {
  try {
    void apiFetch("/api/react/history/progress", {
      method: "POST",
      json: input,
      keepalive: true,
    } as RequestInit & { json: unknown }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export async function getEpisodeProgress(
  movieSlug: string,
  episode: string,
): Promise<{ position: number; duration: number; percent: number } | null> {
  try {
    const res = await apiGet<{ item: BeHistoryEntry | null }>(
      `/api/react/history/progress/${encodeURIComponent(movieSlug)}/${encodeURIComponent(episode)}`,
    );
    if (!res.item) return null;
    return {
      position: res.item.position ?? 0,
      duration: res.item.duration ?? 0,
      percent: res.item.progressPercent ?? 0,
    };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 404)) return null;
    console.warn("[history] getEpisodeProgress failed", e);
    return null;
  }
}

export async function deleteHistory(id: string): Promise<void> {
  await apiDelete(`/api/react/history/${encodeURIComponent(id)}`);
}
