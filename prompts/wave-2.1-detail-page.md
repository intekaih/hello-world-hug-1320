# Wave 2.1 — Wire Movie Detail Page to Real BE

## Context

BE đã expose 4 endpoints cho detail page (tất cả PUBLIC, không cần auth):

```
GET /api/react/movies/:slug              → full movie + episodes list
GET /api/react/movies/:slug/episode/:ep  → single episode stream URL
GET /api/react/movies/:slug/related      → related movies
GET /api/react/movies/resolve?path=...   → resolve slug from URL path
```

## BE response shapes (xem backend/src/controllers/movieController.js để biết chi tiết)

### GET /movies/:slug
```ts
{
  movie: {
    _id, slug, name, origin_name, content, type, status, poster_url, thumb_url,
    trailer_url, time, episode_current, episode_total, quality, lang, year,
    category: [{id, name, slug}],
    country: [{id, name, slug}],
    actor: [string],
    director: [string],
    tmdb: { vote_average, vote_count },
    modified: { time: ISOString }
  },
  episodes: [
    {
      server_name: string,    // "Server #1"
      items: [
        {
          name: string,        // "Tập 1" | "1"
          slug: string,        // "tap-1" (already URL-safe)
          embed: string,       // iframe URL
          m3u8: string         // optional HLS
        }
      ]
    }
  ]
}
```

### GET /movies/:slug/episode/:episode
```ts
{
  episode: {
    name, slug, embed, m3u8
  },
  movieSlug: string,
  movieName: string
}
```

### GET /movies/:slug/related
```ts
{
  items: Movie[],  // cùng shape với card
  total: number
}
```

## Tasks

### Task A — Tạo `src/api-client/movie-detail.ts`

```typescript
import { apiFetch, proxyImage } from './base';
import { mapToCard, type MovieCard } from './movies';

export interface MovieDetail {
  movie: {
    slug: string;
    name: string;
    originName: string;
    content: string;          // HTML description
    type: 'single' | 'series' | 'hoathinh' | 'tvshows';
    status: 'completed' | 'ongoing';
    posterUrl: string;
    thumbUrl: string;
    trailerUrl?: string;
    year: number;
    episodeCurrent: string;   // "Tập 5" | "Full"
    episodeTotal: string;     // "12" | "?"
    quality: string;          // "HD" | "FHD" | "CAM"
    lang: string;             // "Vietsub" | "Thuyết Minh"
    categories: { id: string; name: string; slug: string }[];
    countries: { id: string; name: string; slug: string }[];
    actors: string[];
    directors: string[];
    rating: number;           // 0-10
    ratingCount: number;
    modifiedAt: string;       // ISO
  };
  episodes: {
    serverName: string;
    items: {
      name: string;
      slug: string;
      embed: string;
      m3u8?: string;
    }[];
  }[];
}

export async function fetchMovieDetail(slug: string): Promise<MovieDetail> {
  // 1. GET /movies/:slug
  // 2. Map BE fields → UI-friendly fields:
  //    origin_name → originName
  //    poster_url → posterUrl (wrap in proxyImage)
  //    thumb_url  → thumbUrl
  //    trailer_url → trailerUrl
  //    episode_current → episodeCurrent
  //    episode_total → episodeTotal
  //    category[] → categories[]
  //    country[] → countries[]
  //    actor[] → actors[]
  //    director[] → directors[]
  //    tmdb.vote_average → rating
  //    tmdb.vote_count → ratingCount
  //    modified.time → modifiedAt
  // 3. Strip HTML from content (use DOMParser, fallback to regex)
  // 4. Return mapped object
}

export async function fetchEpisode(slug: string, episode: string) {
  // GET /movies/:slug/episode/:episode
  // Return { embed, m3u8, name, movieName }
}

export async function fetchRelatedMovies(slug: string, limit = 12) {
  // GET /movies/:slug/related
  // Map items[] to MovieCard[] using mapToCard
}
```

### Task B — Update `src/routes/phim.$slug.tsx`

Replace mock data với:

```typescript
export const Route = createFileRoute('/phim/$slug')({
  loader: async ({ params }) => {
    const detail = await fetchMovieDetail(params.slug);
    const related = await fetchRelatedMovies(params.slug, 12);
    return { detail, related };
  },
  component: MovieDetailPage,
});

function MovieDetailPage() {
  const { detail, related } = Route.useLoaderData();
  // Use detail.episodes, detail.movie.* in existing UI
  // Replace any hard-coded mock values
}
```

Add a state hook for selected episode (default first episode of first server).

### Task C — Update `src/routes/xem.$slug.tap-{$episode}.tsx`

The watch page should:
1. Call `fetchEpisode(slug, episode)` to get stream URL
2. Call `fetchMovieDetail(slug)` to get movie name + poster (for background)
3. If user logged in, call `POST /history/progress` (don't break if not logged in)
4. Render player with embed/m3u8 URL

### Task D — Error handling

- If slug not found → render "Không tìm thấy phim" page (404)
- If episode not found → render "Tập không tồn tại"
- If BE offline → fallback message + retry button

## Acceptance

- [ ] `/phim/lat-mat-1990` (hoặc slug thật) hiển thị full thông tin từ BE
- [ ] Episodes list render đầy đủ servers + items
- [ ] Click episode → navigate `/xem/{slug}/tap-{ep}` với stream URL từ BE
- [ ] Related movies carousel lấy từ BE
- [ ] Loading state + error state đều có UI
- [ ] Image URLs đi qua proxyImage()

## Reference

- `src/api-client/movies.ts` — đã có `mapToCard`, `proxyImage`, `Movie` type
- `src/api-client/base.ts` — đã có `apiFetch` với CSRF + credentials
- `backend/src/controllers/movieController.js` — BE logic
- `backend/src/routes/api.js` lines ~100-200 — route definitions
