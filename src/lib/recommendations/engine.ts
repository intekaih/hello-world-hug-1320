/**
 * Client-side recommendation engine.
 *
 * Takes the user's signals (history, favorites, watchlist) and the full
 * pool, then produces a set of "surfaces" — each an intent-shaped list
 * with a per-item reason.
 *
 * No backend AI. All scoring is deterministic and memoizable.
 */

import type { BrowseMovie } from "@/routes/api/browse";

export type ReasonKind =
  | "sameGenre"
  | "sameCountry"
  | "similarMood"
  | "highlyRated"
  | "newEpisode"
  | "fromWatchlist"
  | "resume"
  | "rewatch"
  | "unexplored"
  | "trending";

export type RecMovie = {
  id: number;
  slug: string;
  title: string;
  poster_url: string;
  year: number;
  rating: number;
  reason: ReasonKind;
  /** Optional dynamic reason payload (e.g. genre name, seed title). */
  reasonValue?: string;
  /** Optional resume progress 0..1 */
  progress?: number;
  /** e.g. "38 phút còn lại" — pairs with progress. */
  remaining?: string;
};

export type HistorySignal = {
  slug: string;
  updatedAt: number;
  position: number;
  duration: number;
  totalEpisodes?: number;
  episode?: string;
};
export type LibrarySignal = { slug: string; createdAt: number };

export type RecInputs = {
  pool: BrowseMovie[];
  history: HistorySignal[];
  favorites: LibrarySignal[];
  watchlist: LibrarySignal[];
  /** Slugs the user hit "Not interested" on — hidden across every surface. */
  suppressed?: Set<string>;
};


export type RecSurfaces = {
  hasSignals: boolean;
  tonightPick: RecMovie | null;
  becauseYouWatched: { seed: BrowseMovie; items: RecMovie[] } | null;
  continueTheMood: RecMovie[];
  similarWorlds: RecMovie[];
  hiddenGems: RecMovie[];
  quickRewatch: RecMovie[];
  newEpisodes: RecMovie[];
  fromWatchlist: RecMovie[];
};

// ── helpers ────────────────────────────────────────────────────────────

function toRec(m: BrowseMovie, reason: ReasonKind, reasonValue?: string): RecMovie {
  return {
    id: m.id,
    slug: m.slug,
    title: m.title,
    poster_url: m.poster_url,
    year: m.year,
    rating: m.rating,
    reason,
    reasonValue,
  };
}

function buildWeights(seeds: BrowseMovie[]) {
  const genre = new Map<string, number>();
  const country = new Map<string, number>();
  const type = new Map<string, number>();
  for (const s of seeds) {
    for (const g of s.category) genre.set(g, (genre.get(g) ?? 0) + 1);
    for (const c of s.country) country.set(c, (country.get(c) ?? 0) + 1);
    type.set(s.type, (type.get(s.type) ?? 0) + 1);
  }
  return { genre, country, type };
}

function scoreAgainstWeights(
  m: BrowseMovie,
  w: ReturnType<typeof buildWeights>,
) {
  let s = 0;
  for (const g of m.category) s += (w.genre.get(g) ?? 0) * 3;
  for (const c of m.country) s += (w.country.get(c) ?? 0) * 1.2;
  s += (w.type.get(m.type) ?? 0) * 0.8;
  s += m.rating * 0.15;
  return s;
}

function topReason(m: BrowseMovie, w: ReturnType<typeof buildWeights>): {
  reason: ReasonKind;
  value?: string;
} {
  const g = m.category.find((x) => (w.genre.get(x) ?? 0) > 0);
  if (g) return { reason: "sameGenre", value: g };
  const c = m.country.find((x) => (w.country.get(x) ?? 0) > 0);
  if (c) return { reason: "sameCountry", value: c };
  if (m.rating >= 8.5) return { reason: "highlyRated" };
  return { reason: "similarMood" };
}

// ── main ──────────────────────────────────────────────────────────────

export function buildRecommendations(input: RecInputs): RecSurfaces {
  const { pool, history, favorites, watchlist } = input;
  const bySlug = new Map(pool.map((m) => [m.slug, m]));

  const historySeeds = history
    .map((h) => bySlug.get(h.slug))
    .filter((m): m is BrowseMovie => Boolean(m));
  const favSeeds = favorites
    .map((f) => bySlug.get(f.slug))
    .filter((m): m is BrowseMovie => Boolean(m));
  const watchSeeds = watchlist
    .map((w) => bySlug.get(w.slug))
    .filter((m): m is BrowseMovie => Boolean(m));

  const consumed = new Set<string>([
    ...history.map((h) => h.slug),
    ...favorites.map((f) => f.slug),
  ]);
  const hasSignals =
    historySeeds.length + favSeeds.length + watchSeeds.length > 0;

  // ── Fallback: no signals → trending only ────────────────────────────
  if (!hasSignals) {
    const trending = pool
      .slice()
      .sort((a, b) => b.rating - a.rating || b.year - a.year)
      .slice(0, 16)
      .map((m) => toRec(m, "trending"));
    return {
      hasSignals: false,
      tonightPick: trending[0] ?? null,
      becauseYouWatched: null,
      continueTheMood: trending.slice(0, 12),
      similarWorlds: [],
      hiddenGems: pool
        .slice()
        .sort((a, b) => b.rating - a.rating)
        .slice(8, 20)
        .map((m) => toRec(m, "highlyRated")),
      quickRewatch: [],
      newEpisodes: [],
      fromWatchlist: [],
    };
  }

  // Recency-weighted seed set (history counts more when recent, favorites always count 2).
  const now = Date.now();
  const decay = (t: number) => Math.exp(-(now - t) / (1000 * 60 * 60 * 24 * 14));
  const weightedSeeds: BrowseMovie[] = [];
  for (const h of history) {
    const m = bySlug.get(h.slug);
    if (!m) continue;
    const w = Math.max(0.4, decay(h.updatedAt) * 2);
    for (let i = 0; i < Math.round(w); i++) weightedSeeds.push(m);
  }
  for (const m of favSeeds) {
    weightedSeeds.push(m, m);
  }
  const weights = buildWeights(weightedSeeds);

  // ── Because You Watched — top-recent history seed ───────────────────
  const seedForBecause = historySeeds[0] ?? favSeeds[0];
  let becauseYouWatched: RecSurfaces["becauseYouWatched"] = null;
  if (seedForBecause) {
    const seedGenres = new Set(seedForBecause.category);
    const seedCountries = new Set(seedForBecause.country);
    const items = pool
      .filter((m) => m.slug !== seedForBecause.slug && !consumed.has(m.slug))
      .map((m) => {
        let s = 0;
        for (const g of m.category) if (seedGenres.has(g)) s += 3;
        for (const c of m.country) if (seedCountries.has(c)) s += 1;
        if (m.type === seedForBecause.type) s += 0.6;
        s += m.rating * 0.1;
        return { m, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map(({ m }) => {
        const shared = m.category.find((g) => seedGenres.has(g));
        return toRec(m, shared ? "sameGenre" : "similarMood", shared);
      });
    becauseYouWatched = { seed: seedForBecause, items };
  }

  // ── Continue the Mood — taste-weighted, exclude already seen ────────
  const scored = pool
    .filter((m) => !consumed.has(m.slug))
    .map((m) => ({ m, s: scoreAgainstWeights(m, weights) }))
    .sort((a, b) => b.s - a.s);

  const continueTheMood = scored
    .slice(0, 14)
    .map(({ m }) => {
      const r = topReason(m, weights);
      return toRec(m, r.reason, r.value);
    });

  // ── Similar Worlds — same TYPE dominant (phim-bo vs phim-le etc.) ──
  const dominantType = [...weights.type.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const similarWorlds = dominantType
    ? scored
        .filter(({ m }) => m.type === dominantType)
        .slice(0, 12)
        .map(({ m }) => toRec(m, "similarMood", dominantType === "phim-bo" ? "Cùng thế giới series" : undefined))
    : [];

  // ── Hidden Gems — high rating, low overlap with taste ───────────────
  const hiddenGems = pool
    .filter((m) => !consumed.has(m.slug) && m.rating >= 7.8)
    .map((m) => {
      const overlap = m.category.reduce((n, g) => n + (weights.genre.get(g) ?? 0), 0);
      return { m, score: m.rating - overlap * 0.3 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(({ m }) => toRec(m, "highlyRated"));

  // ── Quick Rewatch — completed items (>92% or older favorites) ──────
  const completed = history
    .filter((h) => h.duration > 0 && h.position / h.duration >= 0.92)
    .map((h) => bySlug.get(h.slug))
    .filter((m): m is BrowseMovie => Boolean(m));
  const quickRewatch = (completed.length > 0 ? completed : favSeeds.slice(0, 6))
    .slice(0, 8)
    .map((m) => toRec(m, "rewatch"));

  // ── New Episodes You May Like — series in taste but not consumed ──
  const newEpisodes = pool
    .filter((m) => m.type === "phim-bo" && !consumed.has(m.slug))
    .map((m) => ({ m, s: scoreAgainstWeights(m, weights) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 10)
    .map(({ m }) => toRec(m, "newEpisode"));

  // ── From Your Watchlist — surface saved but unseen ─────────────────
  const fromWatchlist = watchSeeds
    .filter((m) => !new Set(history.map((h) => h.slug)).has(m.slug))
    .slice(0, 8)
    .map((m) => toRec(m, "fromWatchlist"));

  // ── Tonight's Pick — highest-scoring taste-match, tiebreak on rating
  const tonightPick =
    continueTheMood[0] ??
    becauseYouWatched?.items[0] ??
    hiddenGems[0] ??
    null;

  return {
    hasSignals: true,
    tonightPick,
    becauseYouWatched,
    continueTheMood,
    similarWorlds,
    hiddenGems,
    quickRewatch,
    newEpisodes,
    fromWatchlist,
  };
}
