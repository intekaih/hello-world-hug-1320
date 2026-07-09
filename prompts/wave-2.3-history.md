# Wave 2.3 — Wire Watch History (Continue Watching)

## Context

BE exposes 4 history endpoints (tất cả require auth):

```
GET    /api/react/history                          → danh sách history
POST   /api/react/history/progress                 { movieSlug, movieName, posterUrl, episode, episodeSlug?, position?, duration? }
GET    /api/react/history/progress/:slug/:episode  → progress cho 1 episode
DELETE /api/react/history/:id                      → xoá 1 entry
```

## Response shapes (xem backend/src/controllers/historyController.js)

### GET /history
```ts
{
  items: [
    {
      _id: string,
      movieSlug: string,
      movieName: string,
      posterUrl: string,
      episode: string,           // "1" | "Tập 1"
      episodeSlug?: string,
      position: number,           // seconds
      duration: number,           // seconds
      progressPercent: number,    // 0-100
      watchedAt: string,          // ISO
      completed: boolean
    }
  ],
  total: number
}
```

### POST /history/progress
- Accepts progress updates
- Upsert: 1 (user, movieSlug, episode)
- Returns the updated entry

### GET /history/progress/:slug/:episode
- Returns the progress entry or `{ item: null }`

## Tasks

### Task A — Tạo `src/api-client/history.ts`

```typescript
import { apiFetch } from './base';
import { proxyImage } from './movies';

export interface HistoryItem {
  id: string;
  movieSlug: string;
  movieName: string;
  posterUrl: string;        // đã wrap proxyImage
  episode: string;
  episodeSlug?: string;
  position: number;
  duration: number;
  progressPercent: number;
  watchedAt: string;
  completed: boolean;
}

export async function fetchHistory(limit = 20): Promise<HistoryItem[]> {
  // GET /history
  // Map response:
  //   _id → id
  //   posterUrl → wrap in proxyImage()
  //   other fields pass-through
  // Return items[] sorted by watchedAt desc (BE đã sort)
}

export async function saveProgress(input: {
  movieSlug: string;
  movieName: string;
  posterUrl: string;
  episode: string;
  episodeSlug?: string;
  position: number;
  duration: number;
}): Promise<void> {
  // POST /history/progress
  // Fire-and-forget pattern: caller doesn't need to await
  // But still await internally to handle errors gracefully
  // (don't throw — just console.warn on failure)
}

export async function getEpisodeProgress(
  movieSlug: string,
  episode: string
): Promise<{ position: number; duration: number; percent: number } | null> {
  // GET /history/progress/:slug/:episode
  // Return null if not found
}

export async function deleteHistory(id: string): Promise<void> {
  // DELETE /history/:id
  // Reload history list after
}
```

### Task B — Update `src/routes/history.tsx`

```typescript
export const Route = createFileRoute('/history')({
  loader: async () => {
    // Only fetch if user is authed
    // If guest, return empty + show "login to see history" message
    const items = await fetchHistory(50);
    return { items };
  },
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useAuth();
  const { items } = Route.useLoaderData();
  
  if (!user) {
    return <LoginPrompt feature="xem lịch sử" />;
  }
  
  if (items.length === 0) {
    return <EmptyState message="Bạn chưa xem phim nào" />;
  }
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {items.map((item) => (
        <HistoryCard 
          key={item.id} 
          item={item}
          onRemove={() => deleteHistory(item.id)}
        />
      ))}
    </div>
  );
}
```

### Task C — Update `src/routes/__root.tsx` cho Continue Watching

Lấy history ở `__root.tsx` loader để hiển thị Continue Watching strip ở home page:

```typescript
export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    const { user } = context.auth;
    const history = user ? await fetchHistory(10) : [];
    const homeData = await fetchHomeData();
    return { homeData, history, user };
  },
  // ...
});
```

Trong home page component, nếu `history.length > 0` thì render Continue Watching row (horizontal scroll) trên đầu.

### Task D — Auto-save progress trong watch page

Update `src/routes/xem.$slug.tap-{$episode}.tsx`:

```typescript
import { saveProgress, getEpisodeProgress } from '@/api-client/history';

function WatchPage() {
  const { user } = useAuth();
  const { slug, episode } = Route.useParams();
  const [player, setPlayer] = useState<PlayerState | null>(null);
  
  // On mount: load saved progress
  useEffect(() => {
    if (!user) return;
    getEpisodeProgress(slug, episode).then((saved) => {
      if (saved && saved.position > 10) {
        // Resume from saved position
        playerRef.current?.seekTo(saved.position);
      }
    });
  }, [slug, episode, user]);
  
  // Throttled save: every 10 seconds during playback
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const pos = playerRef.current?.getCurrentTime() ?? 0;
      const dur = playerRef.current?.getDuration() ?? 0;
      if (pos > 0 && dur > 0) {
        saveProgress({
          movieSlug: slug,
          movieName: detail.movie.name,
          posterUrl: detail.movie.posterUrl,
          episode,
          episodeSlug: `tap-${episode}`,
          position: pos,
          duration: dur,
        });
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [slug, episode, user]);
  
  // On video end: save with completed=true (via separate endpoint or flag)
  // ...
}
```

### Task E — Resume button trong Continue Watching

Mỗi HistoryCard trong Continue Watching strip:
- Click → navigate to `/xem/{slug}/tap-{episode}` với position query param
- Watch page tự động seekTo position from URL

```typescript
// In xem.$slug.tap-{$episode}.tsx loader:
loader: async ({ params, location }) => {
  const searchParams = new URLSearchParams(location.search);
  const resumeFrom = Number(searchParams.get('t')) || 0;
  // Pass to component
  return { resumeFrom, ... };
}
```

## Acceptance

- [ ] User logged in → Continue Watching strip hiển thị trên home
- [ ] Click Continue Watching card → resume từ đúng vị trí đã lưu
- [ ] Watch 10s+ → progress auto-saved (verify bằng cách check DB)
- [ ] Close tab + mở lại → progress vẫn còn
- [ ] `/history` page shows full list, có nút xoá từng entry
- [ ] Guest user thấy "Đăng nhập để xem lịch sử" thay vì history
- [ ] Auto-save không spam BE (throttle 10s)

## Reference

- `backend/src/controllers/historyController.js` — full logic
- `backend/src/models/WatchHistory.js` — schema
- `backend/src/routes/api.js` lines ~280-360 — routes
- `src/lib/auth-context.tsx` (from Wave 2.2) — for user state
- `src/api-client/movies.ts` — proxyImage helper
