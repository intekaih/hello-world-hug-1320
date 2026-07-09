
# Foundation Fix — Plan

Scope is large (50+ files touched by hardcoded dark styles + hero video + normalization). I'll implement in **3 tightly-scoped waves** and verify with typecheck between each, without redesigning anything.

## Wave 1 — Theme System 2.0 (tokens + surgical replacements)

**New tokens in `src/styles.css`** (both `:root` light and `.dark`):
- `--surface-glass`, `--glass-border`, `--overlay`, `--scrim`, `--hero-overlay`, `--card-overlay`, `--shadow-soft`
- Map through `@theme inline` so classes like `bg-surface-glass`, `border-glass-border`, `bg-overlay`, `text-on-media` work.
- Add utility classes: `.glass` (already exists — refine light variant), `.scrim-bottom`, `.scrim-top`, `.hero-overlay`, `.on-media` (always-white text with token-driven drop-shadow; identity in both themes because it sits over media).

**Replacement policy** (not a blind swap):
- `text-white` / `text-white/*` **on top of images/video/poster** → keep as `text-white` (rename via `.on-media` utility so intent is clear; still white in light mode — correct over media).
- `text-white` on solid non-media surfaces → `text-foreground`.
- `bg-black`, `from-black`, `to-black` scrims over media → `.scrim-bottom` / `.scrim-top` utilities (dark in both modes — scrims must stay dark to keep media legible; that's intentional, not a bug).
- `bg-black` as page/panel background → `bg-background` or `bg-surface`.
- `border-white/10..20` on glass → `border-glass-border`.
- Dialog / Sheet / Drawer / Share sheet: switch panel bg + border + text to tokens so light mode isn't a black square.
- Sidebar, Top bar, empty states, error states, notifications, language switcher: token pass.
- Home scene sections that intentionally stay dark editorial (`cinematic-scene`, `mystery-scene`, `coming-soon-scene`, `editorial-scene`, `cinematic-hero`, `genre-cosmos`): keep dark identity but scope with a `data-scene="dark"` wrapper (uses `.dark` scoped tokens) so text inside them uses `on-media` intent, not raw `text-white`. Documented as **intentional dark-only cinematic sections**.

**Light-mode hero refinement**:
- Hero overlay uses `--hero-overlay` (light: warm cream 0.35 + soft radial vignette; dark: current deep vignette).
- Hero typography uses `.on-media` so it stays readable over any backdrop in both modes.

## Wave 2 — Hero Video Pipeline

**Root cause (already visible in code)**: `heroMovies` in `src/routes/api/movies/home.ts` never returns any trailer field → Hero has no video source → static image only. `youTubeEmbed` helper exists but is only wired in movie-detail (iframe), not in home hero.

**Fixes**:
1. Add `trailer_url` (YouTube) to each hero movie in the API and to `HeroMovie` type in `src/lib/home-queries.ts`.
2. New `src/lib/media/trailer.ts`:
   - `isDirectVideoUrl(url)` → matches `.mp4|.webm|.m3u8`.
   - `getYouTubeId(url)`, `getVimeoId(url)`.
   - `normalizeTrailerSource(movie)` → returns `{ kind: 'direct'|'youtube'|'vimeo'|'none', src, id, external }`.
3. New `src/components/home/hero-trailer.tsx` with explicit states: `no-trailer`, `unsupported-url` (external button), `loading-video`, `video-ready`, `video-error`, `fallback-backdrop`.
   - Direct video: `<video muted loop playsInline autoPlay preload="metadata">`; fade in on `canplay`; pause on `visibilitychange`; cleanup on unmount; IntersectionObserver to pause when scrolled off.
   - YouTube/Vimeo: fallback backdrop with Ken Burns + "Watch Trailer" opens external in new tab. No iframe autoplay in hero (avoids the "static image" ambiguity and CPU cost).
   - None: Ken Burns backdrop + gradient (already close to today's behavior).
4. Wire into existing `HeroBanner` in `src/components/home/index.tsx` — swap the static `<img>` block for `<HeroTrailer movie=… />` behind the existing overlay/text.

## Wave 3 — Data Pipeline Audit

**New `src/lib/media/normalize.ts`** with pure helpers used by cards/hero/detail:
- `getBestBackdrop(m)`, `getBestPoster(m)`, `getBestLogo(m)`
- `getRating(m)` → number or `null`
- `getRuntime(m)` → formatted string or `null`
- `getEpisodeLabel(m)` → string or `null`
- `getGenres(m)` → string[]
- `getCastImage(person)` with initials fallback
- `renderableImage(url)` — returns `thumbSrc(url)` or `null`; components render placeholder gradient when null.

**Component tightening** (no visual redesign):
- `MoviePoster`-like usages: wrap `<img>` with `onError → hide + show initials/gradient tile`.
- `CastCarousel`: initials avatar when no photo.
- Badges: don't render if value is falsy/NaN (`{rating ? <Badge/> : null}`).
- Runtime/episode labels: use helpers, render nothing when missing.
- Hero: use `getBestLogo`/`getBestBackdrop`; text-title fallback already present in `MovieLogoReveal`.

**No API shape changes** except adding `trailer_url` to hero movies (Wave 2).

## QA
- Run `tsgo` after each wave.
- Playwright smoke: home in dark + light, movie detail, watch, search — screenshot each, verify no `text-white on light bg` regressions and hero video plays (or fallback shows).
- Language switch VI/EN sanity check (no new strings introduced, just reused).

## Risks / intentional carve-outs
- Cinematic dark scenes on home (`cinematic-hero`, `mystery-scene`, `coming-soon-scene`, `editorial-scene`, `genre-cosmos`) stay dark by design in light mode too — they're framed as "theater scenes". Documented in report.
- Scrim gradients over media stay dark in both themes (required for legibility of white-on-media text) — this is correct, not a theme bug.
- `<video>` autoplay may still be blocked on some mobile browsers despite `muted+playsInline`; fallback backdrop handles it.
- Adding trailer URLs to mock API means real network to YouTube for the external button; no autoplay attempted → no CORS/CSP surprises.

## Deliverable
Final report covering: dark-only styles found + fixed, files changed, tokens added, hero root cause + fix, normalization helpers added, remaining intentional dark areas, go/no-go.
