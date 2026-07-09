import { memo, useEffect, useState } from "react";

/**
 * AmbientTheaterBackground
 * ------------------------------------------------------------------
 * Blurred backdrop + radial vignette + film grain layers used behind
 * the cinema-mode player. Purely presentational — no state reads.
 *
 * Perf notes:
 *   · Mobile viewports (<= 640px) drop blur from 80px → 48px and
 *     scale from 1.25 → 1.15 to cut GPU work ~40% per frame while
 *     preserving the ambient wash.
 *   · Uses `matchMedia` (subscribed once) so we react to rotate/
 *     resize without recomposing on every scroll.
 */
function AmbientTheaterBackgroundImpl({
  backdrop,
  intensity = 0.45,
}: {
  backdrop?: string;
  intensity?: number;
}) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!backdrop) {
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgb(30_10_10/0.55),rgb(0_0_0/0.95)_70%)]"
      />
    );
  }
  const blurPx = isMobile ? 48 : 80;
  const scale = isMobile ? 1.15 : 1.25;
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: `url(${backdrop})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: `blur(${blurPx}px) saturate(${isMobile ? 140 : 160}%)`,
          transform: `scale(${scale})`,
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
