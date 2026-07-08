import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";


/**
 * SceneAtmosphere — a fixed backdrop that morphs colour as the user
 * scrolls between scenes. Two absolutely-positioned gradient layers
 * cross-fade whenever the scene closest to the viewport centre
 * changes, so section boundaries dissolve into one continuous
 * cinematic environment.
 *
 * Only opacity animates → GPU-friendly, 60 FPS.
 */

type Mood =
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

const PALETTES: Record<Mood, { a: string; b: string; base: string }> = {
  hero: {
    a: "oklch(0.14 0.03 260 / 0.9)",
    b: "oklch(0.10 0.04 25 / 0.75)",
    base: "oklch(0.05 0.02 260)",
  },
  indigo: {
    a: "oklch(0.18 0.10 265 / 0.85)",
    b: "oklch(0.11 0.05 280 / 0.7)",
    base: "oklch(0.06 0.03 265)",
  },
  ember: {
    a: "oklch(0.22 0.14 25 / 0.75)",
    b: "oklch(0.14 0.08 15 / 0.7)",
    base: "oklch(0.06 0.03 20)",
  },
  amber: {
    a: "oklch(0.22 0.10 70 / 0.7)",
    b: "oklch(0.14 0.06 60 / 0.7)",
    base: "oklch(0.06 0.02 65)",
  },
  violet: {
    a: "oklch(0.20 0.12 300 / 0.8)",
    b: "oklch(0.12 0.07 320 / 0.7)",
    base: "oklch(0.06 0.03 300)",
  },
  cyan: {
    a: "oklch(0.18 0.09 210 / 0.75)",
    b: "oklch(0.11 0.05 230 / 0.7)",
    base: "oklch(0.05 0.02 220)",
  },
  gold: {
    a: "oklch(0.22 0.10 85 / 0.7)",
    b: "oklch(0.13 0.05 70 / 0.7)",
    base: "oklch(0.06 0.03 80)",
  },
  rose: {
    a: "oklch(0.20 0.10 10 / 0.7)",
    b: "oklch(0.13 0.06 350 / 0.7)",
    base: "oklch(0.06 0.03 10)",
  },
  emerald: {
    a: "oklch(0.18 0.08 160 / 0.7)",
    b: "oklch(0.11 0.05 170 / 0.7)",
    base: "oklch(0.05 0.02 160)",
  },
  midnight: {
    a: "oklch(0.15 0.07 240 / 0.85)",
    b: "oklch(0.08 0.04 260 / 0.75)",
    base: "oklch(0.04 0.02 250)",
  },
};

function layerBg(mood: Mood): string {
  const { a, b, base } = PALETTES[mood];
  return [
    `radial-gradient(1400px 900px at 18% 12%, ${a}, transparent 62%)`,
    `radial-gradient(1100px 800px at 82% 88%, ${b}, transparent 60%)`,
    base,
  ].join(", ");
}

export function SceneAtmosphere() {
  const [current, setCurrent] = useState<Mood>("hero");
  const [previous, setPrevious] = useState<Mood | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let raf = 0;
    const pick = () => {
      const els = Array.from(
        document.querySelectorAll<HTMLElement>("[data-scene-mood]"),
      );
      if (!els.length) return;
      const mid = window.innerHeight / 2;
      let best: HTMLElement | null = null;
      let bestDist = Infinity;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        const c = (r.top + r.bottom) / 2;
        const d = Math.abs(c - mid);
        if (d < bestDist) {
          bestDist = d;
          best = el;
        }
      }
      if (!best) return;
      const m = best.getAttribute("data-scene-mood") as Mood | null;
      if (!m || !PALETTES[m]) return;
      setCurrent((prev) => {
        if (prev === m) return prev;
        setPrevious(prev);
        // Clear previous after transition finishes so we don't leak layers.
        window.setTimeout(() => setPrevious(null), 1800);
        return m;
      });
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        pick();
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >

      {/* Base current layer — always on. */}
      <div
        className="absolute inset-0"
        style={{ background: layerBg(current) }}
      />
      {/* Previous layer overlays and fades out — creates crossfade. */}
      <AnimatePresence>
        {previous && (
          <motion.div
            key={previous}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
            style={{ background: layerBg(previous) }}
          />
        )}
      </AnimatePresence>
      {/* Vignette + constant film-grain overlay. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(0_0_0/0.55)_100%)]" />
      <div className="absolute inset-0 opacity-[0.035] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:26px_26px]" />
    </div>
  );
}

