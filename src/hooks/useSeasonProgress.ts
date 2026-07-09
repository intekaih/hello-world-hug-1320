import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

type ApiEntry = {
  slug: string;
  episode: string;
  position: number;
  duration: number;
  updatedAt: number;
};

const LOCAL_KEY = (slug: string) => `mcc:watched:${slug}`;

function readLocal(slug: string): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY(slug));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr.filter((n) => Number.isFinite(n)));
  } catch {
    return new Set();
  }
}

/** Persist a watched-episode marker locally. Safe to call repeatedly. */
export function markEpisodeWatchedLocal(slug: string, episode: number) {
  if (typeof window === "undefined") return;
  try {
    const set = readLocal(slug);
    if (set.has(episode)) return;
    set.add(episode);
    window.localStorage.setItem(LOCAL_KEY(slug), JSON.stringify([...set]));
    window.dispatchEvent(new CustomEvent("mcc:watched-change", { detail: { slug } }));
  } catch {
    /* ignore quota */
  }
}

/** "45 phút", "1h 30m", "90 min" → minutes number, or fallback. */
export function parseRuntimeMinutes(input: string | undefined, fallback = 45): number {
  if (!input) return fallback;
  const s = input.toLowerCase();
  let mins = 0;
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  const p = s.match(/(\d+)\s*(phút|min)/);
  if (h) mins += parseInt(h[1], 10) * 60;
  if (m) mins += parseInt(m[1], 10);
  if (!h && !m && p) mins = parseInt(p[1], 10);
  if (!mins) {
    const lone = s.match(/^\s*(\d+)\s*$/);
    if (lone) mins = parseInt(lone[1], 10);
  }
  return mins > 0 ? mins : fallback;
}

export type SeasonProgress = {
  watched: number;
  total: number;
  ratio: number;
  hoursLeft: number;
  isHalfway: boolean;
  isNearComplete: boolean;
  watchedSet: Set<number>;
};

export function useSeasonProgress(
  slug: string | undefined,
  totalEpisodes: number,
  episodeRuntimeMin = 45,
): SeasonProgress {
  const enabled = Boolean(slug) && totalEpisodes > 1;
  const q = useQuery({
    queryKey: ["history", "season", slug],
    queryFn: async () => {
      const res = await fetch(`/api/history?slug=${encodeURIComponent(slug!)}`);
      if (!res.ok) return { items: [] as ApiEntry[] };
      return (await res.json()) as { items: ApiEntry[] };
    },
    enabled,
    staleTime: 30_000,
  });

  const [localTick, setLocalTick] = useState(0);
  useEffect(() => {
    if (!slug) return;
    const onChange = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d || d.slug === slug) setLocalTick((t) => t + 1);
    };
    window.addEventListener("mcc:watched-change", onChange);
    return () => window.removeEventListener("mcc:watched-change", onChange);
  }, [slug]);

  return useMemo(() => {
    const set = new Set<number>();
    // API: watched if position/duration >= 0.9 OR position present > 60s on last watched ep
    for (const it of q.data?.items ?? []) {
      const n = Number(it.episode);
      if (!Number.isFinite(n)) continue;
      const ratio = it.duration > 0 ? it.position / it.duration : 0;
      if (ratio >= 0.9) set.add(n);
    }
    if (slug) for (const n of readLocal(slug)) set.add(n);
    const total = Math.max(1, totalEpisodes);
    const watched = Math.min(set.size, total);
    const left = Math.max(0, total - watched);
    const hoursLeft = Math.round(((left * episodeRuntimeMin) / 60) * 10) / 10;
    const ratio = watched / total;
    return {
      watched,
      total,
      ratio,
      hoursLeft,
      isHalfway: total > 1 && ratio >= 0.5 && ratio < 0.95,
      isNearComplete: ratio >= 0.9,
      watchedSet: set,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, slug, totalEpisodes, episodeRuntimeMin, localTick]);
}
