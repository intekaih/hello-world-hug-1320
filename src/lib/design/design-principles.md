# MovieCC — Design Principles

> **Goal.** Even with the logo removed, users should recognize this as MovieCC.
> Every screen belongs to one cinematic operating system.

---

## 1. Foundations

All visual & motion values live in `src/lib/design/`:

| Module               | Owns                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `design-tokens.ts`   | spacing, radius, elevation, shadow, glow, blur, typography, color, gradient, glass, overlay, noise, z-index |
| `motion-tokens.ts`   | duration, easing, transitions, springs, stagger, canonical variants  |
| `scene-tokens.ts`    | homepage scene moods (gradient palette + accent + grain)             |
| `lighting-tokens.ts` | scrims, highlights, beams, lighting direction                        |

**Rule of one source.** Never hardcode a spacing value, radius, shadow,
timing or color. Reach for a token. New value? Add it here first.

CSS-side counterparts live in `src/styles.css` (`@theme`, `@utility`).
The two layers must stay aligned; if you add a token, expose it in both.

---

## 2. Motion DNA

Six intent-named presets. Everything else is a mistake.

| Preset      | Duration | Use                                                    |
| ----------- | -------- | ------------------------------------------------------ |
| `fast`      | 120 ms   | chips, toggles, focus rings, keyboard feedback         |
| `micro`     | 180 ms   | hover, small state changes                             |
| `standard`  | 260 ms   | cards, menus, dropdowns, tabs                          |
| `scene`     | 480 ms   | section reveals, tab transitions                       |
| `hero`      | 720 ms   | headline entrances, page hero, logo reveal             |
| `cinematic` | 1200 ms  | ambient crossfade, scene atmosphere, mood transitions  |

- Default easing: `ease.out` `[0.22, 1, 0.36, 1]`. Softer variant `ease.outSoft`
  for `hero` / `cinematic`.
- Springs only for gesture-driven motion: `spring.snap`, `spring.soft`,
  `spring.hero`.
- Canonical variants: `fadeUp`, `fadeIn`, `scaleIn`, `heroReveal`,
  `staggerParent(child, start)`.
- Respect `prefers-reduced-motion` — the CSS reset in `styles.css` collapses
  durations globally, plus opt-in `motion-reduce:transform-none` on transforms.

---

## 3. Visual DNA

- **Radius.** Cards `radius.card` (1rem). Posters `radius.poster` (0.875rem).
  Chips / pills `radius.pill`. Never invent a one-off radius.
- **Elevation.** Only `raised`, `card`, `overlay`, `cinematic`. Cards use
  `card`; floating panels use `overlay`; hero/CTA lifts use `cinematic`.
- **Glass.** Three strengths: `soft` (chips over media), `standard`
  (default panels), `strong` (drawers, sheets, sticky bars). Backdrop-blur
  always paired with a subtle border in `foreground/8%`.
- **Glow.** Reserved for interactive intent — primary CTAs (`glow.primary`),
  gold accents (`glow.gold`), cyan info (`glow.cyan`), hero (`glow.hero`).
  Never decorate a static element with glow.
- **Border treatment.** 1px, `border` token (`foreground/8%`). Highlight
  edges use `highlight.specular` inset, not brighter borders.
- **Lighting direction.** Key light is off-screen top-left by default;
  bottom rim for hero heights. All shadows respect this.
- **Density.** Scenes breathe (`spacing.4xl`/`5xl` vertical); rails are
  dense (`spacing.rail` between cards). Never mix rhythms within one scene.

---

## 4. Color DNA

- **Primary** `--primary` (ember red, oklch 0.65 0.22 15) — Play / CTA only.
- **Accent / Gold** — ratings, editorial eyebrows, premium tags.
- **Cyan** — info, live/HD badges, informational chips.
- **Destructive / Success / Warning** — reserved for their semantics.
- **Scene accents** live in `scenes[mood].accent`. Section titles inside
  a scene may borrow the mood accent for the eyebrow rule only, never for
  primary CTAs.
- Saturation is bounded: chroma `0.14–0.22` across the palette. Anything
  more vivid reads as a bug.
- **Never** use raw `text-white`, `bg-black`, `bg-[#...]` in components.

---

## 5. Typography DNA

- Display family `Fraunces` (serif) for hero, movie titles, section titles.
- Sans `Geist` for body, meta, controls. Mono `Geist Mono` for eyebrows,
  timecodes, numeric stats.
- Scale: `caption 11 / micro 12 / body 14 / lead 16 / subtitle 18 /
  section 24 / title 32 / display 52 / epic 80`.
- Tracking: display uses `tight` (-0.035em); eyebrows use `eyebrow`
  (0.28em) with mono uppercase.
- Leading: display `tight` (0.92); body `normal` (1.5); long-form
  `relaxed` (1.7).
- One H1 per page. Section headers always use the shared
  `SectionHeader` primitive (eyebrow rule + serif title + optional
  subtitle) so rhythm is identical across pages.

---

## 6. Interaction DNA

| Surface        | Hover                              | Focus                    | Press                       | Loading             |
| -------------- | ---------------------------------- | ------------------------ | --------------------------- | ------------------- |
| Button primary | glow rises, y -1                   | `outline` ring primary   | scale 0.98 (spring.snap)    | dot pulse           |
| Card / poster  | lift 4px, specular sweep           | ring primary, offset 3px | scale 0.99                  | shimmer skeleton    |
| Chip           | bg tint +6%                        | ring primary             | scale 0.97                  | —                   |
| Icon button    | bg glass soft                      | ring primary             | scale 0.94                  | spinner replaces    |
| Menu / dialog  | none (already elevated)            | trap focus, esc closes   | —                           | fade in scene       |
| Player         | controls glass strong on move      | visible ring on controls | tap toggles play            | player-loading-state |
| Search input   | border animates to primary         | ring primary + glow      | —                           | debounce + skeleton |

- All interactive elements ≥ 44×44 tap target.
- Focus ring is **always visible** on keyboard focus (`:focus-visible`
  outline in `styles.css`). Never remove it, never restyle per-component.
- Disabled = `opacity 0.5`, `pointer-events: none`, no color change.
- Error uses `destructive` + inline copy; never color-only.
- Success uses `success` + icon; never color-only.

---

## 7. Micro Details

- **Cursor**: default; `pointer` only on true actions.
- **Scrollbars**: hidden on horizontal rails (`scrollbar-none` utility),
  native on long content.
- **Skeletons**: single shared shimmer (`skeleton-shimmer` utility).
- **Grain**: `grain` (0.06) as default; `grain-strong` (0.11) only on
  hero backdrops. `dust` (0.035) on scene atmosphere.
- **Icons**: `lucide-react` at 16/20/24. Never mix icon libraries.
- **Badges**: top-left of poster for status, top-right for rating.
- **Section rhythm**: eyebrow → title → optional subtitle → 24px gap →
  content. Enforced by `SectionHeader`.

---

## 8. Accessibility (WCAG AA)

- Contrast ≥ 4.5:1 for body, 3:1 for large text and icons.
- Every interactive element has an accessible name.
- Motion collapses to ≤ 10ms under `prefers-reduced-motion`.
- Keyboard shortcuts documented in `ShortcutOverlay` (`?` opens it).
- Skip link to `#main-content` in the app shell.

---

## 9. Performance

- Only animate `opacity`, `transform`, `filter`. No `top/left/width`.
- Backdrop blur only on `glass.*` utilities; never inline.
- Scene atmosphere uses two layered gradients with crossfade — not
  N stacked layers.
- Offscreen scene effects pause via `IntersectionObserver` where used.
- Prefer CSS variables over per-component styled objects.

---

## 10. How to add a new component

1. Pick the closest primitive (button, card, chip, dialog). If none, ask
   whether it truly belongs to MovieCC's vocabulary before inventing one.
2. Use tokens from `@/lib/design`. Never invent a duration, radius or shadow.
3. Use `transition.standard` unless intent says otherwise.
4. Use `SectionHeader` for anything with an eyebrow + title.
5. Wrap emotional / cinematic surfaces in the `grain` + scrim + vignette
   layer stack (see `lightingLayerOrder`).
6. Verify: dark & light, keyboard focus, `prefers-reduced-motion`, mobile
   44px targets, no hardcoded color / spacing.

---

## The Litmus Test

Cover the logo. Screenshot any page. Ask: *"Could this belong to any
other streaming app?"* If yes, it isn't finished.
