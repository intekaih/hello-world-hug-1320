# MovieCC analytics — event catalog

`window.__mcTrack(event, props?)` is the single analytics sink. `src/lib/track.ts`
installs a **no-op default** so call sites are always safe, and provides
`track(event, props?)` sugar. Swap in a real provider (Plausible / PostHog / etc.)
by assigning a new function to `window.__mcTrack` from any bootstrap script —
call sites stay unchanged.

> **No PII rule.** Only slugs, event names, coarse counters, and the in-memory
> session UUID (`window.__mcSessionId`). Never user emails, IDs, addresses, or
> free-text search queries.

## Bootstrapping

`initTracking()` is called once from the router (`src/router.tsx`). It:
1. Installs `window.__mcTrack` as a no-op if nothing has claimed it.
2. Mints a session UUID at `window.__mcSessionId` (memory-only).
3. Starts a 5-minute `session_heartbeat` timer (skipped while tab hidden).

## Minimum event set

| Event                     | Fires when                                                        | Props                                              |
| ------------------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| `home_primary_cta_click`  | User clicks the hero's primary CTA (Resume / Play).               | `{ slug, kind: "resume" \| "play" }`               |
| `card_hover_preview_start`| Hover-intent (≥200 ms) mounts a card trailer preview.             | `{ slug }`                                         |
| `play_start`              | Video element begins playback for the first time on that route.   | `{ slug, source: "player" \| "trailer" \| "hero" }`|
| `auto_next_fire`          | Auto-next countdown reaches 0 and advances the episode.           | `{ slug, next }`                                   |
| `auto_next_cancel`        | User cancels/dismisses the auto-next prompt before it fires.      | `{ slug }`                                         |
| `binge_bridge_accept`     | User picks a recommendation from the post-title bridge overlay.   | `{ slug, target, action }`                         |
| `watchlist_add`           | Title added to watchlist (any surface).                           | `{ slug, source }`                                 |
| `notif_open`              | User opens the notifications tray/page.                           | `{ surface: "tray" \| "page", unread }`            |
| `session_heartbeat`       | Every 5 min while the tab is visible.                             | `{ session, minute, tick }`                        |

Additional events (already emitted): `hero_resume_shown`, `hero_resume_clicked`,
`player_tab_blurred`, `player_tab_returned`, `player_skip`, `binge_bridge_show`,
`binge_bridge_dismiss`.

## Usage

```ts
import { track } from "@/lib/track";

track("watchlist_add", { slug, source: "detail_hero" });
```

Call sites must stay resilient — never `await` `track()` and never branch on
its return value.
