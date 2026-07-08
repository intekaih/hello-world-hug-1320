import { createFileRoute } from "@tanstack/react-router";
import { browsePool, type BrowseMovie } from "./browse";
import { favoritesStore } from "./favorites";

export type DiscoverMovie = {
  id: number;
  slug: string;
  title: string;
  poster_url: string;
  year: number;
  rating: number;
  category: string[];
  country: string[];
  reason?: string;
};

export type DiscoverBecause = {
  seed: { slug: string; title: string; poster_url: string };
  items: DiscoverMovie[];
};

export type DiscoverPayload = {
  personalized: boolean;
  tasteProfile: {
    topGenres: { name: string; weight: number }[];
    topCountries: { name: string; weight: number }[];
    seedCount: number;
    headline: string;
    subline: string;
  } | null;
  because: DiscoverBecause[];
  forYou: DiscoverMovie[];
  newGenres: { genre: string; items: DiscoverMovie[] }[];
  trending: DiscoverMovie[];
};

function authed(request: Request) {
  return /mcc_session=/.test(request.headers.get("cookie") ?? "");
}

function toCard(m: BrowseMovie, reason?: string): DiscoverMovie {
  return {
    id: m.id,
    slug: m.slug,
    title: m.title,
    poster_url: m.poster_url,
    year: m.year,
    rating: m.rating,
    category: m.category,
    country: m.country,
    reason,
  };
}

function scoreMovie(m: BrowseMovie, genreW: Map<string, number>, countryW: Map<string, number>) {
  let s = 0;
  for (const g of m.category) s += (genreW.get(g) ?? 0) * 3;
  for (const c of m.country) s += (countryW.get(c) ?? 0) * 1.2;
  s += m.rating * 0.15;
  return s;
}

function buildTrending(): DiscoverMovie[] {
  const seen = new Set<string>();
  return browsePool
    .slice()
    .sort((a, b) => b.rating - a.rating || b.year - a.year)
    .filter((m) => (seen.has(m.slug) ? false : (seen.add(m.slug), true)))
    .slice(0, 18)
    .map((m) => toCard(m));
}

export const Route = createFileRoute("/api/discover")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await new Promise((r) => setTimeout(r, 120));
        const trending = buildTrending();

        if (!authed(request) || favoritesStore.size === 0) {
          const payload: DiscoverPayload = {
            personalized: false,
            tasteProfile: null,
            because: [],
            forYou: trending.slice(0, 12),
            newGenres: [],
            trending,
          };
          return Response.json(payload);
        }

        // Resolve favorites to browsePool entries (by slug)
        const favs = Array.from(favoritesStore.values()).sort(
          (a, b) => b.createdAt - a.createdAt,
        );
        const seedMovies: BrowseMovie[] = [];
        const seenSlugs = new Set<string>();
        for (const f of favs) {
          const m = browsePool.find((p) => p.slug === f.movie_slug);
          if (m && !seenSlugs.has(m.slug)) {
            seedMovies.push(m);
            seenSlugs.add(m.slug);
          }
        }

        // If nothing matched, still produce a trending fallback
        if (seedMovies.length === 0) {
          const payload: DiscoverPayload = {
            personalized: false,
            tasteProfile: null,
            because: [],
            forYou: trending.slice(0, 12),
            newGenres: [],
            trending,
          };
          return Response.json(payload);
        }

        // Compute taste weights
        const genreW = new Map<string, number>();
        const countryW = new Map<string, number>();
        for (const m of seedMovies) {
          for (const g of m.category) genreW.set(g, (genreW.get(g) ?? 0) + 1);
          for (const c of m.country) countryW.set(c, (countryW.get(c) ?? 0) + 1);
        }

        const topGenres = Array.from(genreW.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([name, weight]) => ({ name, weight }));
        const topCountries = Array.from(countryW.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, weight]) => ({ name, weight }));

        const headline =
          topGenres.length > 0
            ? `Gu phim của bạn nghiêng về ${topGenres
                .slice(0, 2)
                .map((g) => g.name)
                .join(" & ")}`
            : "Đang học sở thích của bạn";
        const subline =
          topCountries[0]
            ? `Ưu tiên tác phẩm từ ${topCountries
                .slice(0, 2)
                .map((c) => c.name)
                .join(", ")} · Dựa trên ${seedMovies.length} phim đã yêu thích`
            : `Dựa trên ${seedMovies.length} phim đã yêu thích`;

        // "Vì bạn thích [Phim X]" — pick top 3 recent seeds
        const because: DiscoverBecause[] = seedMovies.slice(0, 3).map((seed) => {
          const seedGenres = new Set(seed.category);
          const items = browsePool
            .filter((m) => m.slug !== seed.slug && !seenSlugs.has(m.slug))
            .map((m) => {
              let sc = 0;
              for (const g of m.category) if (seedGenres.has(g)) sc += 3;
              if (m.country.some((c) => seed.country.includes(c))) sc += 1;
              sc += m.rating * 0.1;
              return { m, sc };
            })
            .filter((x) => x.sc > 0)
            .sort((a, b) => b.sc - a.sc)
            .slice(0, 10)
            .map(({ m }) => toCard(m, seed.category[0]));
          return {
            seed: { slug: seed.slug, title: seed.title, poster_url: seed.poster_url },
            items,
          };
        });

        // "Có thể bạn sẽ thích" — global scored, exclude favorites
        const forYou = browsePool
          .filter((m) => !seenSlugs.has(m.slug))
          .map((m) => ({ m, sc: scoreMovie(m, genreW, countryW) }))
          .sort((a, b) => b.sc - a.sc)
          .slice(0, 18)
          .map(({ m }) => {
            const matched = m.category.find((g) => genreW.has(g));
            return toCard(m, matched ? `Hợp gu ${matched}` : undefined);
          });

        // "Khám phá thể loại mới" — genres user has NOT explored
        const exploredGenres = new Set(genreW.keys());
        const unexploredGenres = new Map<string, BrowseMovie[]>();
        for (const m of browsePool) {
          for (const g of m.category) {
            if (exploredGenres.has(g)) continue;
            if (!unexploredGenres.has(g)) unexploredGenres.set(g, []);
            unexploredGenres.get(g)!.push(m);
          }
        }
        const newGenres = Array.from(unexploredGenres.entries())
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 3)
          .map(([genre, items]) => ({
            genre,
            items: items
              .slice()
              .sort((a, b) => b.rating - a.rating)
              .slice(0, 10)
              .map((m) => toCard(m, `Bạn chưa xem nhiều ${genre}`)),
          }));

        const payload: DiscoverPayload = {
          personalized: true,
          tasteProfile: {
            topGenres,
            topCountries,
            seedCount: seedMovies.length,
            headline,
            subline,
          },
          because,
          forYou,
          newGenres,
          trending,
        };
        return Response.json(payload);
      },
    },
  },
});
