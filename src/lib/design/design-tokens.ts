/**
 * MovieCC — Design DNA
 * ------------------------------------------------------------------
 * Single source of truth for spacing, radius, elevation, shadow,
 * glow, blur, typography, color, gradient, glass, lighting, overlay
 * and noise tokens.
 *
 * All values here MUST mirror CSS custom properties in
 * `src/styles.css` when a value is also needed at runtime by CSS.
 * TypeScript consumers import from this module so that motion
 * components, inline styles and dynamic effects share the same
 * scale as the CSS layer.
 *
 * Rules:
 *   - Never hardcode a spacing/radius/shadow/color in a component.
 *   - Always resolve to a token (either CSS variable or exported const).
 *   - New values are added here first, then referenced from CSS or JS.
 */

/* -------------------------------------------------------------- */
/*  Spacing rhythm                                                */
/* -------------------------------------------------------------- */
export const spacing = {
  hair: "1px",
  xs: "0.25rem",   // 4
  sm: "0.5rem",    // 8
  md: "0.75rem",   // 12
  lg: "1rem",      // 16
  xl: "1.5rem",    // 24
  "2xl": "2rem",   // 32
  "3xl": "3rem",   // 48
  "4xl": "4.5rem", // 72   — scene padding
  "5xl": "6rem",   // 96   — scene gutter
  scene: "6rem",   // canonical vertical rhythm between scenes
  rail: "1.25rem", // gap between rail items
} as const;

/* -------------------------------------------------------------- */
/*  Radius                                                        */
/* -------------------------------------------------------------- */
export const radius = {
  none: "0px",
  xs: "0.375rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.25rem",
  "2xl": "1.75rem",
  card: "1rem",       // canonical card radius
  poster: "0.875rem", // poster / thumb radius
  pill: "9999px",
} as const;

/* -------------------------------------------------------------- */
/*  Elevation / Shadow                                            */
/* -------------------------------------------------------------- */
export const elevation = {
  flat: "none",
  raised:
    "0 1px 2px oklch(0 0 0 / 0.35), 0 4px 12px -4px oklch(0 0 0 / 0.4)",
  card:
    "0 2px 4px oklch(0 0 0 / 0.35), 0 12px 32px -12px oklch(0 0 0 / 0.5)",
  overlay:
    "0 6px 14px oklch(0 0 0 / 0.4), 0 30px 60px -18px oklch(0 0 0 / 0.55)",
  cinematic:
    "0 2px 4px oklch(0 0 0 / 0.4), 0 20px 40px -12px oklch(0 0 0 / 0.5), 0 60px 120px -30px oklch(0.65 0.22 15 / 0.35)",
} as const;

/* -------------------------------------------------------------- */
/*  Glow                                                          */
/* -------------------------------------------------------------- */
export const glow = {
  none: "0 0 0 transparent",
  subtle: "0 0 24px oklch(0.65 0.22 15 / 0.22)",
  primary: "0 0 40px oklch(0.65 0.22 15 / 0.35)",
  gold: "0 0 40px oklch(0.78 0.16 70 / 0.35)",
  cyan: "0 0 40px oklch(0.82 0.14 210 / 0.35)",
  hero: "0 0 90px oklch(0.65 0.22 15 / 0.45)",
} as const;

/* -------------------------------------------------------------- */
/*  Blur                                                          */
/* -------------------------------------------------------------- */
export const blur = {
  none: "0px",
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "40px",
  theater: "60px", // ambient theater background
} as const;

/* -------------------------------------------------------------- */
/*  Typography scale                                              */
/* -------------------------------------------------------------- */
export const typography = {
  family: {
    display: "var(--font-display)",
    sans: "var(--font-sans)",
    mono: "var(--font-mono)",
  },
  size: {
    caption: "0.6875rem",  // 11 — meta / eyebrow
    micro: "0.75rem",      // 12
    body: "0.875rem",      // 14
    lead: "1rem",          // 16
    subtitle: "1.125rem",  // 18
    section: "1.5rem",     // 24
    title: "2rem",         // 32
    display: "3.25rem",    // 52 — hero
    epic: "5rem",          // 80 — cinematic hero
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  tracking: {
    tight: "-0.035em",
    snug: "-0.02em",
    normal: "0",
    wide: "0.08em",
    eyebrow: "0.28em",
  },
  leading: {
    tight: "0.92",
    snug: "1.15",
    normal: "1.5",
    relaxed: "1.7",
  },
} as const;

/* -------------------------------------------------------------- */
/*  Colors / Gradients / Overlays                                 */
/* -------------------------------------------------------------- */
export const color = {
  primary: "var(--primary)",
  accent: "var(--accent)",
  gold: "var(--gold)",
  cyan: "var(--cyan)",
  background: "var(--background)",
  surface: "var(--surface)",
  surfaceElevated: "var(--surface-elevated)",
  foreground: "var(--foreground)",
  muted: "var(--muted-foreground)",
  border: "var(--border)",
  destructive: "var(--destructive)",
  success: "var(--success)",
  warning: "var(--warning)",
} as const;

export const gradient = {
  primary: "var(--gradient-primary)",
  ember: "var(--gradient-ember)",
  aurora: "var(--gradient-aurora)",
  hero: "var(--gradient-hero)",
  posterFade:
    "linear-gradient(180deg, transparent 55%, oklch(0 0 0 / 0.85) 100%)",
  scrimTop:
    "linear-gradient(180deg, oklch(0 0 0 / 0.7) 0%, transparent 60%)",
  scrimBottom:
    "linear-gradient(0deg, oklch(0 0 0 / 0.85) 0%, transparent 65%)",
} as const;

/* -------------------------------------------------------------- */
/*  Glass tokens — reference the shared `glass` / `glass-strong`   */
/*  utilities in styles.css. Values here are for JS access.       */
/* -------------------------------------------------------------- */
export const glass = {
  soft: {
    background:
      "color-mix(in oklab, var(--surface-elevated) 45%, transparent)",
    border:
      "1px solid color-mix(in oklab, var(--foreground) 6%, transparent)",
    backdropFilter: "blur(16px) saturate(140%)",
  },
  standard: {
    background:
      "color-mix(in oklab, var(--surface-elevated) 55%, transparent)",
    border:
      "1px solid color-mix(in oklab, var(--foreground) 8%, transparent)",
    backdropFilter: "blur(20px) saturate(140%)",
  },
  strong: {
    background:
      "color-mix(in oklab, var(--surface-elevated) 78%, transparent)",
    border:
      "1px solid color-mix(in oklab, var(--foreground) 10%, transparent)",
    backdropFilter: "blur(32px) saturate(160%)",
  },
} as const;

/* -------------------------------------------------------------- */
/*  Overlays / Noise                                              */
/* -------------------------------------------------------------- */
export const overlay = {
  vignette:
    "radial-gradient(ellipse at center, transparent 40%, oklch(0 0 0 / 0.55) 100%)",
  vignetteStrong:
    "radial-gradient(ellipse at center, transparent 30%, oklch(0 0 0 / 0.75) 100%)",
  scrim: "oklch(0 0 0 / 0.5)",
  scrimSoft: "oklch(0 0 0 / 0.3)",
} as const;

export const noise = {
  film: 0.06,
  filmStrong: 0.11,
  dust: 0.035,
} as const;

/* -------------------------------------------------------------- */
/*  Z-index rhythm                                                */
/* -------------------------------------------------------------- */
export const z = {
  base: 0,
  raised: 10,
  sticky: 20,
  nav: 40,
  overlay: 60,
  dialog: 70,
  toast: 80,
  cinema: 90,
} as const;

export type Spacing = keyof typeof spacing;
export type Radius = keyof typeof radius;
export type Elevation = keyof typeof elevation;
export type Glow = keyof typeof glow;
export type Blur = keyof typeof blur;
