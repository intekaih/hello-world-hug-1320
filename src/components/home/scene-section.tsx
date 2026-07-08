import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useRef, type ReactNode, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

/**
 * SceneSection — wraps a homepage row in a scroll-linked cinematic scene.
 *
 * Each section gets its own "mood": accent color, ambient orb positions,
 * lighting angle, particle density. As the user scrolls a section into
 * view the background morphs — orbs drift, gradients breathe, a tint
 * fades in — then releases as it exits. Section boundaries dissolve so
 * the homepage feels like continuous camera movement, not stacked cards.
 */

export type SceneMood =
  | "ember" // warm orange/red — trending, hot
  | "amber" // gold — editor's picks, prestige
  | "violet" // purple/magenta — because you watched, personal
  | "cyan" // teal/blue — cinematic collection, cool
  | "gold" // deep gold — Oscar / awards
  | "rose" // pink — actor spotlight, human
  | "emerald" // green — hidden gems
  | "indigo" // deep blue — new episodes
  | "midnight"; // dark cyan — coming soon

const MOOD_TOKENS: Record<
  SceneMood,
  {
    a: string; // primary orb color
    b: string; // secondary orb color
    tint: string; // ambient tint
    accent: string; // small accent (for eyebrow chip)
  }
> = {
  ember: {
    a: "oklch(0.65 0.24 25 / 0.55)",
    b: "oklch(0.55 0.20 15 / 0.35)",
    tint: "oklch(0.25 0.10 20 / 0.18)",
    accent: "oklch(0.70 0.22 30)",
  },
  amber: {
    a: "oklch(0.78 0.18 70 / 0.45)",
    b: "oklch(0.55 0.14 55 / 0.30)",
    tint: "oklch(0.28 0.08 65 / 0.15)",
    accent: "oklch(0.80 0.16 75)",
  },
  violet: {
    a: "oklch(0.55 0.22 300 / 0.55)",
    b: "oklch(0.40 0.18 320 / 0.35)",
    tint: "oklch(0.22 0.10 300 / 0.20)",
    accent: "oklch(0.68 0.22 305)",
  },
  cyan: {
    a: "oklch(0.75 0.14 210 / 0.45)",
    b: "oklch(0.45 0.12 230 / 0.35)",
    tint: "oklch(0.22 0.08 220 / 0.18)",
    accent: "oklch(0.78 0.15 210)",
  },
  gold: {
    a: "oklch(0.80 0.16 85 / 0.50)",
    b: "oklch(0.50 0.14 65 / 0.35)",
    tint: "oklch(0.25 0.08 70 / 0.20)",
    accent: "oklch(0.82 0.16 85)",
  },
  rose: {
    a: "oklch(0.68 0.20 10 / 0.45)",
    b: "oklch(0.50 0.18 350 / 0.35)",
    tint: "oklch(0.24 0.08 10 / 0.16)",
    accent: "oklch(0.72 0.20 8)",
  },
  emerald: {
    a: "oklch(0.65 0.16 155 / 0.40)",
    b: "oklch(0.40 0.12 170 / 0.30)",
    tint: "oklch(0.22 0.08 160 / 0.18)",
    accent: "oklch(0.70 0.18 155)",
  },
  indigo: {
    a: "oklch(0.50 0.20 265 / 0.55)",
    b: "oklch(0.35 0.16 280 / 0.40)",
    tint: "oklch(0.20 0.10 265 / 0.22)",
    accent: "oklch(0.65 0.22 260)",
  },
  midnight: {
    a: "oklch(0.40 0.14 240 / 0.45)",
    b: "oklch(0.25 0.10 260 / 0.35)",
    tint: "oklch(0.15 0.06 250 / 0.28)",
    accent: "oklch(0.60 0.18 240)",
  },
};

export function SceneSection({
  children,
  mood,
  eyebrow,
  title,
  subtitle,
  align = "left",
  intensity = 1,
  className,
}: {
  children: ReactNode;
  mood: SceneMood;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  align?: "left" | "center";
  intensity?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const tokens = MOOD_TOKENS[mood];

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Orb drift + tint breathing
  const orbAY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-30%", "20%"]);
  const orbBY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["30%", "-20%"]);
  const orbAX = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-10%", "8%"]);
  const orbBX = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["12%", "-8%"]);
  const tintOpacity = useTransform(
    scrollYProgress,
    [0, 0.35, 0.65, 1],
    [0, intensity, intensity, 0],
  );

  return (
    <section
      ref={ref}
      className={cn(
        "relative -mx-4 overflow-hidden px-4 py-14 sm:-mx-6 sm:px-6 sm:py-20 lg:-mx-8 lg:px-8",
        className,
      )}
      style={
        {
          "--scene-accent": tokens.accent,
        } as CSSProperties
      }
      data-mood={mood}
    >
      {/* Ambient tint wash */}
      <motion.div
        aria-hidden
        style={{ opacity: tintOpacity, background: tokens.tint }}
        className="pointer-events-none absolute inset-0"
      />

      {/* Drifting orb A */}
      <motion.div
        aria-hidden
        style={{ y: orbAY, x: orbAX }}
        className="pointer-events-none absolute -left-[20%] top-[-10%] h-[520px] w-[520px] rounded-full blur-[120px] will-change-transform"
      >
        <div className="h-full w-full rounded-full" style={{ background: tokens.a }} />
      </motion.div>

      {/* Drifting orb B */}
      <motion.div
        aria-hidden
        style={{ y: orbBY, x: orbBX }}
        className="pointer-events-none absolute -right-[15%] bottom-[-20%] h-[480px] w-[480px] rounded-full blur-[130px] will-change-transform"
      >
        <div className="h-full w-full rounded-full" style={{ background: tokens.b }} />
      </motion.div>

      {/* Subtle grid noise */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" />

      {/* Section header */}
      {(eyebrow || title || subtitle) && (
        <header
          className={cn(
            "relative z-10 mb-8 flex flex-col gap-2",
            align === "center" && "items-center text-center",
          )}
        >
          {eyebrow && (
            <div
              className={cn(
                "flex items-center gap-2.5",
                align === "center" && "justify-center",
              )}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: tokens.accent, boxShadow: `0 0 12px ${tokens.accent}` }}
              />
              <span
                className="font-mono text-[10px] uppercase tracking-[0.34em]"
                style={{ color: tokens.accent }}
              >
                {eyebrow}
              </span>
            </div>
          )}
          {title && (
            <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl lg:text-[2.75rem]">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="max-w-xl text-sm text-foreground/70 sm:text-[15px]">{subtitle}</p>
          )}
        </header>
      )}

      <div className="relative z-10">{children}</div>
    </section>
  );
}
