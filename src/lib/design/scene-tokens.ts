/**
 * MovieCC — Scene DNA
 * ------------------------------------------------------------------
 * Every homepage scene declares a `mood` (see `SceneAtmosphere`).
 * This module is the single source of truth for what each mood
 * looks like: gradient palette, accent, film-grain level, lighting
 * direction and a suggested typographic treatment.
 *
 * Values here are consumed by:
 *   - `SceneAtmosphere` (background crossfade)
 *   - `SceneSection` (per-scene overlay tint)
 *   - Editorial / Mystery / Coming-Soon scenes for accent color
 */

export type SceneMood =
  | "hero"
  | "indigo"
  | "ember"
  | "amber"
  | "violet"
  | "cyan"
  | "gold"
  | "rose"
  | "emerald"
  | "midnight";

export interface SceneToken {
  /** Primary radial gradient stop. */
  a: string;
  /** Secondary radial gradient stop. */
  b: string;
  /** Solid base beneath the two radials. */
  base: string;
  /** Accent color used by titles / eyebrows in this scene. */
  accent: string;
  /** Film grain opacity, 0–1. */
  grain: number;
  /** Lighting direction in degrees (0 = right, 90 = down). */
  lightAngle: number;
  /** Vertical rhythm hint (px) — some scenes breathe more. */
  gutter: number;
}

export const scenes: Record<SceneMood, SceneToken> = {
  hero: {
    a: "oklch(0.14 0.03 260 / 0.9)",
    b: "oklch(0.10 0.04 25 / 0.75)",
    base: "oklch(0.05 0.02 260)",
    accent: "oklch(0.78 0.16 70)",
    grain: 0.06,
    lightAngle: 200,
    gutter: 128,
  },
  indigo: {
    a: "oklch(0.18 0.10 265 / 0.85)",
    b: "oklch(0.11 0.05 280 / 0.7)",
    base: "oklch(0.06 0.03 265)",
    accent: "oklch(0.72 0.15 260)",
    grain: 0.05,
    lightAngle: 220,
    gutter: 112,
  },
  ember: {
    a: "oklch(0.22 0.14 25 / 0.75)",
    b: "oklch(0.14 0.08 15 / 0.7)",
    base: "oklch(0.06 0.03 20)",
    accent: "oklch(0.72 0.2 30)",
    grain: 0.08,
    lightAngle: 195,
    gutter: 112,
  },
  amber: {
    a: "oklch(0.22 0.10 70 / 0.7)",
    b: "oklch(0.14 0.06 60 / 0.7)",
    base: "oklch(0.06 0.02 65)",
    accent: "oklch(0.78 0.16 70)",
    grain: 0.06,
    lightAngle: 180,
    gutter: 112,
  },
  violet: {
    a: "oklch(0.20 0.12 300 / 0.8)",
    b: "oklch(0.12 0.07 320 / 0.7)",
    base: "oklch(0.06 0.03 300)",
    accent: "oklch(0.72 0.16 305)",
    grain: 0.07,
    lightAngle: 215,
    gutter: 112,
  },
  cyan: {
    a: "oklch(0.18 0.09 210 / 0.75)",
    b: "oklch(0.11 0.05 230 / 0.7)",
    base: "oklch(0.05 0.02 220)",
    accent: "oklch(0.82 0.14 210)",
    grain: 0.05,
    lightAngle: 190,
    gutter: 112,
  },
  gold: {
    a: "oklch(0.22 0.10 85 / 0.7)",
    b: "oklch(0.13 0.05 70 / 0.7)",
    base: "oklch(0.06 0.03 80)",
    accent: "oklch(0.78 0.16 85)",
    grain: 0.08,
    lightAngle: 175,
    gutter: 112,
  },
  rose: {
    a: "oklch(0.20 0.10 10 / 0.7)",
    b: "oklch(0.13 0.06 350 / 0.7)",
    base: "oklch(0.06 0.03 10)",
    accent: "oklch(0.72 0.18 15)",
    grain: 0.06,
    lightAngle: 210,
    gutter: 112,
  },
  emerald: {
    a: "oklch(0.18 0.08 160 / 0.7)",
    b: "oklch(0.11 0.05 170 / 0.7)",
    base: "oklch(0.05 0.02 160)",
    accent: "oklch(0.72 0.15 160)",
    grain: 0.05,
    lightAngle: 200,
    gutter: 112,
  },
  midnight: {
    a: "oklch(0.15 0.07 240 / 0.85)",
    b: "oklch(0.08 0.04 260 / 0.75)",
    base: "oklch(0.04 0.02 250)",
    accent: "oklch(0.72 0.15 250)",
    grain: 0.07,
    lightAngle: 225,
    gutter: 128,
  },
};

export function sceneBackground(mood: SceneMood): string {
  const s = scenes[mood];
  return [
    `radial-gradient(1400px 900px at 18% 12%, ${s.a}, transparent 62%)`,
    `radial-gradient(1100px 800px at 82% 88%, ${s.b}, transparent 60%)`,
    s.base,
  ].join(", ");
}
