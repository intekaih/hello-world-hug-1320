/**
 * MovieCC — Lighting DNA
 * ------------------------------------------------------------------
 * Rules for how "light" behaves across the app.
 *
 * MovieCC's cinematic feel comes from consistent, low-angle,
 * cool-warm contrast lighting. Every glow, scrim, sweep and
 * highlight should read as if lit from the same off-screen source.
 *
 * Use these tokens instead of ad-hoc `boxShadow: "0 0 ..."`.
 */

export const lightingDirection = {
  /** Off-screen top-left key light (default). */
  keyTL: { x: -0.4, y: -0.6 },
  /** Off-screen top-right key light. */
  keyTR: { x: 0.4, y: -0.6 },
  /** Bottom rim light — used behind heroes / posters. */
  rimBottom: { x: 0, y: 0.9 },
} as const;

export const highlight = {
  /** Sharp specular used on card top edges. */
  specular:
    "linear-gradient(180deg, oklch(1 0 0 / 0.14) 0%, oklch(1 0 0 / 0) 40%)",
  /** Soft ambient rim for posters. */
  posterRim:
    "inset 0 1px 0 oklch(1 0 0 / 0.12), inset 0 -20px 40px oklch(0 0 0 / 0.35)",
  /** Interactive lift highlight (hover). */
  liftEdge:
    "inset 0 1px 0 oklch(1 0 0 / 0.18), 0 20px 40px -18px oklch(0.65 0.22 15 / 0.5)",
} as const;

export const scrim = {
  top: "linear-gradient(180deg, oklch(0 0 0 / 0.65), transparent 55%)",
  bottom: "linear-gradient(0deg, oklch(0 0 0 / 0.85), transparent 65%)",
  left: "linear-gradient(90deg, oklch(0 0 0 / 0.7), transparent 60%)",
  right: "linear-gradient(270deg, oklch(0 0 0 / 0.7), transparent 60%)",
  ambient:
    "radial-gradient(ellipse at center, transparent 40%, oklch(0 0 0 / 0.55) 100%)",
} as const;

export const beam = {
  /** Diagonal light sweep for CTA / poster hover. */
  sweep:
    "linear-gradient(115deg, transparent 30%, oklch(1 0 0 / 0.12) 50%, transparent 70%)",
  /** Vertical shaft for hero backdrops. */
  shaft:
    "linear-gradient(180deg, oklch(1 0 0 / 0.08), transparent 55%)",
} as const;

/**
 * Recommended layer order (top → bottom) for cinematic surfaces:
 *   1. content
 *   2. highlight.specular
 *   3. beam.sweep (optional, hover only)
 *   4. base color / image
 *   5. scrim.bottom (for text legibility)
 *   6. vignette (ambient)
 *   7. film grain
 */
export const lightingLayerOrder = [
  "content",
  "specular",
  "beam",
  "base",
  "scrim",
  "vignette",
  "grain",
] as const;
