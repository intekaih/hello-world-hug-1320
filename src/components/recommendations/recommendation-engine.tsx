import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { buildRecommendations, type RecInputs } from "@/lib/recommendations/engine";
import type { BrowseMovie } from "@/routes/api/browse";
import { useTranslation } from "@/hooks/useTranslation";
import { useSuppressedRecs } from "@/hooks/useSuppressedRecs";
import { useTasteStore } from "@/store/tasteStore";
import { RecommendationSection } from "./recommendation-section";
import { TonightPick } from "./tonight-pick";
import { MoodMatchRail } from "./mood-match-rail";



type PoolResp = { items: BrowseMovie[] };
type HistoryResp = {
  items: {
    slug: string;
    updatedAt: number;
    position: number;
    duration: number;
    totalEpisodes?: number;
    episode?: string;
  }[];
};
type FavResp = { items: { movie_slug: string; createdAt: number }[] };
type WatchResp = { items: { movie_slug: string; createdAt: number }[] };

async function j<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(url);
  return res.json();
}

/**
 * RecommendationEngine — client-side scoring layer.
 * Fetches pool + user signals, memoizes the scored surfaces, then
 * renders each surface with its own cinematic mood.
 */
export function RecommendationEngine() {
  const { t } = useTranslation();
  const { suppressed } = useSuppressedRecs();
  const tasteGenres = useTasteStore((s) => s.genres);
  const tasteCountry = useTasteStore((s) => s.country);
  const tasteMood = useTasteStore((s) => s.mood);




  const pool = useQuery({
    queryKey: ["rec", "pool"],
    queryFn: () => j<PoolResp>("/api/movies/pool"),
    staleTime: 5 * 60_000,
  });
  const history = useQuery({
    queryKey: ["rec", "history"],
    queryFn: () => j<HistoryResp>("/api/history"),
    staleTime: 60_000,
  });
  const favorites = useQuery({
    queryKey: ["rec", "favorites"],
    queryFn: () => j<FavResp>("/api/favorites"),
    staleTime: 60_000,
  });
  const watchlist = useQuery({
    queryKey: ["rec", "watchlist"],
    queryFn: () => j<WatchResp>("/api/watchlist"),
    staleTime: 60_000,
  });

  const surfaces = useMemo(() => {
    if (!pool.data) return null;
    const input: RecInputs = {
      pool: pool.data.items,
      history: (history.data?.items ?? []).map((h) => ({
        slug: h.slug,
        updatedAt: h.updatedAt,
        position: h.position,
        duration: h.duration,
        totalEpisodes: h.totalEpisodes,
        episode: h.episode,
      })),
      favorites: (favorites.data?.items ?? []).map((f) => ({ slug: f.movie_slug, createdAt: f.createdAt })),
      watchlist: (watchlist.data?.items ?? []).map((w) => ({ slug: w.movie_slug, createdAt: w.createdAt })),
      suppressed,
      taste: { genres: tasteGenres, country: tasteCountry, mood: tasteMood },
    };
    return buildRecommendations(input);
  }, [pool.data, history.data, favorites.data, watchlist.data, suppressed, tasteGenres, tasteCountry, tasteMood]);



  if (!surfaces) {
    return (
      <div className="space-y-8" aria-hidden>
        <div className="h-60 animate-pulse rounded-3xl bg-white/5" />
        <div className="h-72 animate-pulse rounded-3xl bg-white/5" />
      </div>
    );
  }

  return (
    <div className="space-y-14 md:space-y-20">
      {surfaces.tonightPick && <TonightPick movie={surfaces.tonightPick} />}

      {surfaces.becauseYouWatched && (
        <MoodMatchRail
          seed={surfaces.becauseYouWatched.seed}
          items={surfaces.becauseYouWatched.items}
        />
      )}

      <RecommendationSection
        mood="indigo"
        eyebrow={t("recommendations.continueMood.eyebrow")}
        title={t("recommendations.continueMood.title")}
        subtitle={t("recommendations.continueMood.subtitle")}
        items={surfaces.continueTheMood}
        entrance="drift"
      />

      <RecommendationSection
        mood="cyan"
        eyebrow={t("recommendations.similarWorlds.eyebrow")}
        title={t("recommendations.similarWorlds.title")}
        subtitle={t("recommendations.similarWorlds.subtitle")}
        items={surfaces.similarWorlds}
        entrance="focus"
      />

      <RecommendationSection
        mood="emerald"
        eyebrow={t("recommendations.hiddenGems.eyebrow")}
        title={t("recommendations.hiddenGems.title")}
        subtitle={t("recommendations.hiddenGems.subtitle")}
        items={surfaces.hiddenGems}
        entrance="focus"
      />

      <RecommendationSection
        mood="rose"
        eyebrow={t("recommendations.rewatch.eyebrow")}
        title={t("recommendations.rewatch.title")}
        subtitle={t("recommendations.rewatch.subtitle")}
        items={surfaces.quickRewatch}
        entrance="drift"
      />

      <RecommendationSection
        mood="amber"
        eyebrow={t("recommendations.newEpisodes.eyebrow")}
        title={t("recommendations.newEpisodes.title")}
        subtitle={t("recommendations.newEpisodes.subtitle")}
        items={surfaces.newEpisodes}
        entrance="iris"
      />

      <RecommendationSection
        mood="violet"
        eyebrow={t("recommendations.fromWatchlist.eyebrow")}
        title={t("recommendations.fromWatchlist.title")}
        subtitle={t("recommendations.fromWatchlist.subtitle")}
        items={surfaces.fromWatchlist}
        entrance="sweep"
      />
    </div>
  );
}
