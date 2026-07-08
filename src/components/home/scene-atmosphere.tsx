import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  sceneBackground,
  scenes,
  type SceneMood,
} from "@/lib/design/scene-tokens";
import { transition } from "@/lib/design/motion-tokens";

/**
 * SceneAtmosphere — a fixed backdrop that morphs colour as the user
 * scrolls between scenes. Two absolutely-positioned gradient layers
 * cross-fade whenever the scene closest to the viewport centre
 * changes, so section boundaries dissolve into one continuous
 * cinematic environment.
 *
 * Palette + accent + grain come from the shared scene DNA
 * (`@/lib/design/scene-tokens`) — no palette lives in this file.
 * Only opacity animates → GPU-friendly, 60 FPS.
 */

type Mood = SceneMood;

function layerBg(mood: Mood): string {
  return sceneBackground(mood);
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

