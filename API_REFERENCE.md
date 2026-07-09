# API Reference — Backend movieCC (Express + Mongoose)

Base URL: `${VITE_API_BASE_URL}` (default: `http://localhost:3000/api/react`)

Auth: Session cookie (httpOnly, sameSite=lax) + CSRF token (header `X-CSRF-Token`, double-submit cookie)

## AUTH

- `POST /auth/login` `{username, password, remember?}`
  → `{success, user: {id, username, display_name, role, is_active, avatar_url?}}`
  → Set-Cookie: `mcc_session=...; mcc_csrf=...`
- `POST /auth/register` `{username, password, email?, display_name?}` → `{success, user}`
- `POST /auth/logout` → `{success}`
- `GET  /auth/me` → `{user: {...} | null, expires_at?: number}`
- `POST /auth/forgot-password` `{username|email}` → `{success, message}`
- `PATCH /auth/profile` `{display_name?, avatar_url?, password?}` → `{success, user}`

## MOVIES

- `GET /movies/home` → `HomeResponse` (xem PHẦN A)
- `GET /movies/pool?type=&category=&country=&page=` → `PaginatedResponse<Movie>`
- `GET /movies/:slug` → `Movie` (xem PHẦN B)
- `GET /movies/:slug/episode/:episode` → `EpisodeServers` (xem PHẦN C)
- `GET /movies/:slug/related` → `{relatedParts: RelatedPart[], relatedMovies: Movie[]}`
- `GET /category/:slug?page=&year=&sort=` → `PaginatedResponse<Movie>`
- `GET /country/:slug?page=` → `PaginatedResponse<Movie>`
- `GET /type/:type?page=&category=&country=&year=&sort=` → `PaginatedResponse<Movie>`
- `GET /search?q=&page=` → `PaginatedResponse<Movie>`
- `GET /suggest?q=` → `Movie[]` (max 8)
- `GET /actor/:name?page=` → `ActorResponse`
- `GET /schedule?region=VN` → `ScheduleResponse` (xem PHẦN D)

## USER LIBRARY (cần auth + CSRF)

- `GET    /favorites` → `FavoriteItem[]`
- `POST   /favorites/toggle` `{movie_slug, movie_name, movie_thumb, movie_origin_name, last_episode}` → `{status: 'added'|'removed', isFavorite}`
- `GET    /favorites/check/:slug` → `{isFavorite}`
- `GET    /watchlist` → `WatchlistItem[]`
- `POST   /watchlist/toggle` `{movie_slug, movie_name, movie_thumb, movie_origin_name, last_episode}` → `{status, inWatchlist}`
- `PATCH  /watchlist/note` `{movie_slug, note}` → `{success}`
- `GET    /watchlist/check/:slug` → `{inWatchlist}`

## HISTORY (cần auth + CSRF)

- `GET    /history` → `HistoryItem[]`
- `POST   /history` `{movie_slug, episode_slug, movie_name, movie_thumb, movie_origin_name, current_time, duration}` → `{success}`
- `DELETE /history/:slug/:episodeSlug` → `{success}`
- `GET    /history/:slug/:episodeSlug/progress` → `{progress: {current_time, duration, last_watched}|null}`

## NOTIFICATIONS (cần auth + CSRF)

- `GET    /notifications` → `Notification[]`
- `POST   /notifications/check` → `{checked, count, newEpisodes: [...]}`
- `GET    /notifications/unread-count` → `{count}`
- `POST   /notifications/mark-read` `{id}` → `{success}`
- `POST   /notifications/mark-all-read` → `{success}`

## TRANSLATE

- `POST /translate` `{text, target_lang='vi'}` → `{translatedText, cached, source: 'memory'|'db'|'api'|'skip'}`

## FEEDBACK

- `POST /feedback` `{movie_slug?, type: 'bug'|'suggestion'|'other', message, email?, attachments?}`

## IMAGE PROXY (public)

- `GET /image/:encodedUrl` → ảnh (encoded = base64 của URL TMDB/ophim)

---

## PHẦN A — HomeResponse

```ts
{
  heroMovies: Movie[],          // 5-8 phim nổi bật (poster lớn)
  top10Movies: Movie[],         // top 10 tuần
  hotSeriesMovies: Movie[],     // phim bộ hot
  animeMovies: Movie[],         // hoạt hình
  newMovies: Movie[]            // mới cập nhật
}
```

## PHẦN B — Movie

```ts
{
  id?: string,
  name: string,                 // "Đảo Hải Tặc"
  origin_name: string,          // "ONE PIECE"
  slug: string,                 // "dao-hai-tac"
  thumb_url: string,            // poster dọc
  poster_url: string,           // poster ngang (backdrop)
  year: number,
  quality: string,              // "HD" | "FHD" | "4K" | "CAM"
  lang: string,                 // "Vietsub" | "Lồng tiếng" | "Thuyết minh"
  episode_current: string,      // "Tập 1100" | "HD" | ""
  episode_total: string,        // "1100" | ""
  type: 'series' | 'single' | 'hoathinh' | string,
  time: string,                 // "24 phút/tập" | "1h 55m"
  category: {name, slug}[],
  country: {name, slug}[],
  content: string,              // HTML overview
  rating: number,               // 0-10
  actor?: string[],
  director?: string[],
  trailer_url?: string,
  episodes?: Episode[],         // nếu type=series|hoathinh
  status?: 'completed' | 'ongoing',
  logo_url?: string,            // TMDB logo trong suốt
  backdrop_url?: string,        // TMDB backdrop 16:9
  tmdb?: {id, type, vote_average},
  epSlug?: string | null        // episode slug đầu tiên
}
```

## PHẦN C — EpisodeServers

```ts
{
  name: string,                 // "Tập 1"
  slug: string,                 // "tap-1"
  servers: [
    {serverName: "VIP", link_m3u8: "https://...", link_embed?: "https://..."},
    {serverName: "Server 2", link_m3u8: "https://..."}
  ]
}
```

## PHẦN D — ScheduleResponse

```ts
{
  nowPlaying: ScheduleMovie[],  // đang chiếu rạp
  upcoming: ScheduleMovie[],    // sắp chiếu
  onAir: ScheduleMovie[]        // phim bộ đang phát sóng
}

ScheduleMovie = {
  id, title, originalTitle,
  posterUrl, backdropUrl,
  releaseDate, rating, overview,
  type: 'movie' | 'tv'
}
```

## LỖI — Server trả về

```ts
{ error: string }  // status 4xx/5xx
```
