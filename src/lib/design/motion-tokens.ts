/**
 * MovieCC — Motion DNA
 * ------------------------------------------------------------------
 * One consistent motion vocabulary for the whole app. Every timing,
 * easing and spring in the app should resolve to a token here.
 *
 * Names describe *intent*, not milliseconds, so designers and
 * engineers agree on when to reach for each preset.
 *
 *   fast      — 120ms — chips, toggles, focus rings
 *   micro     — 180ms — hover states, small state changes
 *   standard  — 260ms — cards, menus, dropdowns
 *   scene     — 480ms — section reveals, tab transitions
 *   hero      — 720ms — headline entrances, page hero
 *   cinematic — 1200ms — scene atmosphere, ambient crossfade
 *
 * All easings are Apple-style out-cubic-ish curves; avoid linear
 * except for progress rails.
 */

export type Ease = readonly [number, number, number, number];

export const ease = {
  /** Standard cinematic "settle" curve. Use for 95% of motion. */
  out: [0.22, 1, 0.36, 1] as Ease,
  /** Slightly softer landing for large/hero motion. */
  outSoft: [0.16, 1, 0.3, 1] as Ease,
  /** Symmetric in-out for element that both enters and exits together. */
  inOut: [0.65, 0, 0.35, 1] as Ease,
  /** Sharp punch for press / tap feedback. */
  snap: [0.4, 0, 0.2, 1] as Ease,
} as const;

export const duration = {
  fast: 0.12,
  micro: 0.18,
  standard: 0.26,
  scene: 0.48,
  hero: 0.72,
  cinematic: 1.2,
} as const;

/** Convenience: named `{duration, ease}` presets for framer-motion. */
export const transition = {
  fast: { duration: duration.fast, ease: ease.snap },
  micro: { duration: duration.micro, ease: ease.out },
  standard: { duration: duration.standard, ease: ease.out },
  scene: { duration: duration.scene, ease: ease.out },
  hero: { duration: duration.hero, ease: ease.outSoft },
  cinematic: { duration: duration.cinematic, ease: ease.outSoft },
} as const;

/** Spring presets — for gesture-driven motion (drag, hover-lift). */
export const spring = {
  /** Snappy tap/press response. */
  snap: { type: "spring" as const, stiffness: 520, damping: 34, mass: 0.6 },
  /** Default UI spring: cards, chips, floating panels. */
  soft: { type: "spring" as const, stiffness: 260, damping: 28, mass: 0.8 },
  /** Slow hero spring, for large elements. */
  hero: { type: "spring" as const, stiffness: 140, damping: 24, mass: 1 },
} as const;

/** Stagger delays — for list / grid entrances. */
export const stagger = {
  tight: 0.03,
  standard: 0.06,
  loose: 0.12,
} as const;

/** Delay presets for orchestrated reveals. */
export const delay = {
  none: 0,
  xs: 0.06,
  sm: 0.12,
  md: 0.24,
  lg: 0.4,
} as const;

/**
 * Canonical entrance variants. Use with `motion.div variants={fadeUp}`
 * to guarantee identical feel across the app.
 */
export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: transition.scene },
} as const;

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transition.standard },
} as const;

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.985 },
  show: { opacity: 1, scale: 1, transition: transition.scene },
} as const;

export const heroReveal = {
  hidden: { opacity: 0, y: 28, filter: "blur(12px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: transition.hero,
  },
} as const;

export const staggerParent = (
  childStagger: number = stagger.standard,
  startDelay: number = delay.xs,
) => ({
  hidden: {},
  show: {
    transition: {
      staggerChildren: childStagger,
      delayChildren: startDelay,
    },
  },
});
