import { memo } from "react";

/**
 * AmbientTheaterBackground
 * ------------------------------------------------------------------
 * Blurred backdrop + radial vignette + film grain layers used behind
 * the cinema-mode player. Purely presentational — no state, no reads.
 * Uses only `background-image`, `filter: blur`, and static transforms
 * so the browser can composite once and reuse.
 */
function AmbientTheaterBackgroundImpl({
  backdrop,
  intensity = 0.45,
}: {
  backdrop?: string;
  intensity?: number;
}) {
  if (!backdrop) {
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgb(30_10_10/0.55),rgb(0_0_0/0.95)_70%)]"
      />
    );
  }
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: `url(${backdrop})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(80px) saturate(160%)",
          transform: "scale(1.25)",
          opacity: intensity,
          willChange: "opacity",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_28%,rgb(0_0_0/0.85)_100%)]"
      />
      <div
        aria-hidden
        className="grain pointer-events-none fixed inset-0 -z-10 opacity-25"
      />
    </>
  );
}

export const AmbientTheaterBackground = memo(AmbientTheaterBackgroundImpl);
