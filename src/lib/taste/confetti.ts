import confetti from "canvas-confetti";

/**
 * Gentle brand-tinted confetti — celebrates onboarding completion.
 * No-ops for `prefers-reduced-motion` users so we never violate the setting.
 */
export function fireTasteConfetti() {
  if (typeof window === "undefined") return;
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  const colors = ["#ea580c", "#f97316", "#fbbf24", "#ffffff"];
  const defaults = {
    startVelocity: 32,
    spread: 70,
    ticks: 140,
    zIndex: 100,
    colors,
    disableForReducedMotion: true,
  } as const;

  // Two soft bursts from lower-left and lower-right — restrained, not a party.
  confetti({ ...defaults, particleCount: 60, angle: 60, origin: { x: 0.15, y: 0.85 } });
  confetti({ ...defaults, particleCount: 60, angle: 120, origin: { x: 0.85, y: 0.85 } });
  setTimeout(
    () => confetti({ ...defaults, particleCount: 40, angle: 90, origin: { x: 0.5, y: 0.75 } }),
    180,
  );
}
